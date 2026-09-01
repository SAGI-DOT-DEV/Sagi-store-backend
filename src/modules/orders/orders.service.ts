import { OrderStatus, Prisma } from '@prisma/client';
import { prisma } from '../../database/prisma.js';
import { retryWriteConflict } from '../../database/transaction.js';
import { ConflictError, InventoryError, NotFoundError, ValidationError } from '../../core/errors/app-error.js';
import { sendExperienceReviewEmail,sendOrderEmail } from '../auth/email-verification.service.js';

export class OrdersService {
 async create(userId:string,addressId:string,shippingRateId:string){
  let shipping={amount:new Prisma.Decimal(0),currency:'USD',carrier:null as string|null,service:null as string|null};
  if(shippingRateId){
   const response=await fetch(`https://api.goshippo.com/rates/${encodeURIComponent(shippingRateId)}`,{headers:{Authorization:`ShippoToken ${process.env.SHIPPO_API_KEY??''}`}});
   if(!response.ok)throw new ValidationError('Selected shipping rate is no longer available');
   const rate:any=await response.json();
   if(rate.amount===undefined)throw new ValidationError('Selected shipping rate is invalid');
   shipping={amount:new Prisma.Decimal(String(rate.amount)),currency:String(rate.currency??'USD').toUpperCase(),carrier:rate.provider??null,service:rate.servicelevel?.name??null};
  }
  return retryWriteConflict(()=>prisma.$transaction(async tx=>{
   if(addressId){const address=await tx.address.findFirst({where:{id:addressId,userId},select:{id:true}});if(!address)throw new NotFoundError('Address not found');}
   const cart=await tx.cart.findUnique({where:{userId},include:{items:{include:{variant:{include:{product:true,inventory:true}}}}}});
   if(!cart?.items.length)throw new NotFoundError('Cart is empty');
   for(const item of cart.items){if(item.variant.product.status!=='ACTIVE'||!item.variant.inventory)throw new InventoryError(`Variant ${item.variant.sku} is unavailable`);}
   const subtotal=cart.items.reduce((sum,i)=>sum.add(i.variant.price.mul(i.quantity)),new Prisma.Decimal(0));
   // Inventory is deliberately not reserved yet. A hold starts only after a
   // Stripe Checkout session exists, allowing Stripe's expiry webhook to
   // release it even when this server is not continuously running.
   const total=subtotal.add(shipping.amount);
   const order=await tx.order.create({data:{userId,addressId,status:'PENDING_PAYMENT',currency:shipping.currency,subtotal,shippingAmount:shipping.amount,total,shippingRateId,shippingCarrier:shipping.carrier,shippingService:shipping.service,items:{create:cart.items.map(i=>({variantId:i.variantId,sku:i.variant.sku,name:i.variant.name??i.variant.product.name,unitPrice:i.variant.price,quantity:i.quantity}))},histories:{create:{newStatus:'PENDING_PAYMENT',actorId:userId,reason:'Order created; inventory will be reserved when Checkout starts'}}},include:{items:true}});
   await tx.cartItem.deleteMany({where:{cartId:cart.id}});
   await tx.auditLog.create({data:{actorId:userId,actorRole:'CUSTOMER',action:'ORDER_CREATED',entityType:'Order',entityId:order.id}});
   return order;
  },{isolationLevel:Prisma.TransactionIsolationLevel.Serializable,maxWait:5000,timeout:10000}));
 }

 async transitionFulfillmentStatus(orderId:string,status:OrderStatus,actor:{id:string;role:'ADMIN'}){
  const transitions:Partial<Record<OrderStatus,OrderStatus[]>>={
   PAID:['PROCESSING'],
   PROCESSING:['SHIPPED'],
   SHIPPED:['OUT_FOR_DELIVERY'],
   OUT_FOR_DELIVERY:['DELIVERED'],
  };
  const updated=await prisma.$transaction(async tx=>{
   const current=await tx.order.findUnique({where:{id:orderId}});
   if(!current)throw new NotFoundError('Order not found');
   if(!transitions[current.status]?.includes(status))throw new ConflictError(`Cannot change an order from ${current.status} to ${status}`);
   const updated=await tx.order.updateMany({where:{id:orderId,status:current.status},data:{status}});
   if(updated.count!==1)throw new ConflictError('Order status changed concurrently; retry the request');
   await tx.orderStatusHistory.create({data:{orderId,actorId:actor.id,previousStatus:current.status,newStatus:status,reason:'Admin fulfillment update'}});
   await tx.auditLog.create({data:{actorId:actor.id,actorRole:actor.role,action:'ORDER_STATUS_CHANGED',entityType:'Order',entityId:orderId,previousValue:{status:current.status},newValue:{status}}});
   return tx.order.findUniqueOrThrow({where:{id:orderId}});
  });
  void prisma.user.findUnique({where:{id:updated.userId},include:{profile:true}}).then(customer=>customer?sendOrderEmail({orderId:updated.id,userId:customer.id,email:customer.email,firstName:customer.profile?.firstName,status,transactionReference:undefined}):undefined).catch(()=>undefined);
  if(status==='DELIVERED'){
   void prisma.user.findUnique({where:{id:updated.userId},include:{profile:true}}).then(customer=>customer?sendExperienceReviewEmail({orderId:updated.id,userId:customer.id,email:customer.email,firstName:customer.profile?.firstName}):undefined).catch(()=>undefined);
  }
  return updated;
 }
}
export const ordersService=new OrdersService();
