import { Prisma } from '@prisma/client';
import { prisma } from '../../database/prisma.js';
import { retryWriteConflict } from '../../database/transaction.js';
import { ConflictError, NotFoundError } from '../../core/errors/app-error.js';
import { releaseReservedInventory, reserveInventory } from '../inventory/inventory.service.js';
import { StripePaymentProvider } from './stripe.provider.js';

const provider=new StripePaymentProvider();
const reference=()=>`SAGI-TXN-${new Date().toISOString().slice(0,10).replaceAll('-','')}-${crypto.randomUUID().slice(0,8).toUpperCase()}`;
const checkoutCreationLeaseMs=60_000;
type CheckoutClaim={paymentId:string;attemptId:string;transactionReference:string;amount:Prisma.Decimal;currency:string;customerEmail:string;checkoutSessionId:string|null;stripeIdempotencyKey:string};

export class PaymentService {
 private async claimCheckout(orderId:string,userId:string,idempotencyKey:string):Promise<CheckoutClaim>{
  return retryWriteConflict(()=>prisma.$transaction(async tx=>{
   const locked=await tx.$queryRaw<{id:string}[]>`SELECT "id" FROM "Order" WHERE "id"=${orderId} AND "userId"=${userId} FOR UPDATE`;
   if(!locked[0])throw new NotFoundError('Order not found');
   const order=await tx.order.findUniqueOrThrow({where:{id:orderId},include:{user:true,payments:true}});
   if(!['PENDING_PAYMENT','PAYMENT_PROCESSING'].includes(order.status))throw new ConflictError('This order is no longer awaiting payment');
   const existing=await tx.paymentAttempt.findUnique({where:{idempotencyKey},include:{payment:true}});
   if(existing&&existing.payment.orderId!==order.id)throw new ConflictError('Idempotency-Key was already used for a different order');
   let payment=existing?.payment??order.payments.find(item=>['PENDING','PROCESSING','FAILED'].includes(item.status));
   if(!payment)payment=await tx.payment.create({data:{orderId,transactionReference:reference(),provider:'stripe',amount:order.total,currency:order.currency}});
   if(payment.checkoutSessionId)return {paymentId:payment.id,attemptId:existing?.id??'',transactionReference:payment.transactionReference,amount:payment.amount,currency:payment.currency,customerEmail:order.user.email,checkoutSessionId:payment.checkoutSessionId,stripeIdempotencyKey:payment.id};
   if(payment.status==='PROCESSING'&&payment.updatedAt.getTime()>Date.now()-checkoutCreationLeaseMs)throw new ConflictError('Checkout session creation is already in progress');
   payment=await tx.payment.update({where:{id:payment.id},data:{status:'PROCESSING',failureCode:null,failureMessage:null}});
   const stripeIdempotencyKey=`${payment.id}:${crypto.randomUUID()}`;
   const attempt=existing??await tx.paymentAttempt.upsert({where:{idempotencyKey},create:{paymentId:payment.id,idempotencyKey,status:'PROCESSING',metadata:{stripeIdempotencyKey}},update:{}});
   if(attempt.paymentId!==payment.id)throw new ConflictError('Idempotency-Key was already used for a different order');
   if(existing)await tx.paymentAttempt.update({where:{id:attempt.id},data:{status:'PROCESSING',failureCode:null,failureMessage:null,metadata:{stripeIdempotencyKey}}});
   return {paymentId:payment.id,attemptId:attempt.id,transactionReference:payment.transactionReference,amount:payment.amount,currency:payment.currency,customerEmail:order.user.email,checkoutSessionId:null,stripeIdempotencyKey};
  },{isolationLevel:Prisma.TransactionIsolationLevel.Serializable,maxWait:10000,timeout:15000}));
 }

 private async claimExpiredSession(paymentId:string,attemptId:string,checkoutSessionId:string,userId:string):Promise<CheckoutClaim>{
  return retryWriteConflict(()=>prisma.$transaction(async tx=>{
   const existing=await tx.payment.findUnique({where:{id:paymentId},select:{orderId:true}});
   if(!existing)throw new NotFoundError('Payment not found');
   const locked=await tx.$queryRaw<{id:string}[]>`SELECT "id" FROM "Order" WHERE "id"=${existing.orderId} AND "userId"=${userId} FOR UPDATE`;
   if(!locked[0])throw new NotFoundError('Order not found');
   const payment=await tx.payment.findUniqueOrThrow({where:{id:paymentId},include:{order:{include:{user:true,items:true}}}});
   if(payment.checkoutSessionId!==checkoutSessionId)throw new ConflictError('Checkout session changed; retry the request');
   if(!['PENDING_PAYMENT','PAYMENT_PROCESSING'].includes(payment.order.status))throw new ConflictError('This order is no longer awaiting payment');
   // The session was confirmed expired by Stripe before this transaction. Release
   // its hold here so a delayed expiry webhook cannot block a replacement session.
   for(const item of [...payment.order.items].sort((a,b)=>a.variantId.localeCompare(b.variantId)))await releaseReservedInventory(tx,{variantId:item.variantId,quantity:item.quantity,orderId:payment.orderId,transactionReference:payment.transactionReference});
   await tx.payment.update({where:{id:payment.id},data:{status:'PROCESSING',checkoutSessionId:null,paymentIntentId:null,failureCode:null,failureMessage:null}});
   const stripeIdempotencyKey=`${payment.id}:${crypto.randomUUID()}`;
   const attempt=await tx.paymentAttempt.update({where:{id:attemptId},data:{status:'PROCESSING',providerReference:null,failureCode:null,failureMessage:null,metadata:{stripeIdempotencyKey}}});
   await tx.transactionLog.create({data:{transactionReference:payment.transactionReference,paymentId:payment.id,orderId:payment.orderId,userId,provider:'stripe',type:'CHECKOUT_EXPIRED_RETRY',status:'PROCESSING',amount:payment.amount,currency:payment.currency,message:'Expired Stripe Checkout session confirmed and inventory reservation released before retry'}});
   return {paymentId:payment.id,attemptId:attempt.id,transactionReference:payment.transactionReference,amount:payment.amount,currency:payment.currency,customerEmail:payment.order.user.email,checkoutSessionId:null,stripeIdempotencyKey};
  },{isolationLevel:Prisma.TransactionIsolationLevel.Serializable}));
 }

 private async createCheckout(orderId:string,userId:string,claim:CheckoutClaim){
  let checkout:{checkoutSessionId:string;paymentIntentId?:string;url:string|null;status?:string|null;paymentStatus?:string|null}|undefined;
  try{
   const createdCheckout=await provider.createCheckoutSession({transactionReference:claim.transactionReference,orderId,amount:Number(claim.amount),currency:claim.currency.toLowerCase(),customerEmail:claim.customerEmail,idempotencyKey:claim.stripeIdempotencyKey});
   checkout=createdCheckout;
   const liveCheckout=await provider.retrieveCheckoutSession(createdCheckout.checkoutSessionId);
   if(liveCheckout.status!=='open'||!liveCheckout.url)throw new ConflictError('Stripe Checkout session is not available for payment');
   await retryWriteConflict(()=>prisma.$transaction(async tx=>{
    const locked=await tx.$queryRaw<{id:string}[]>`SELECT "id" FROM "Order" WHERE "id"=${orderId} AND "userId"=${userId} FOR UPDATE`;
    if(!locked[0])throw new NotFoundError('Order not found');
    const payment=await tx.payment.findUniqueOrThrow({where:{id:claim.paymentId},include:{order:{include:{items:true}}}});
    if(payment.checkoutSessionId===createdCheckout.checkoutSessionId)return;
    if(payment.checkoutSessionId)throw new ConflictError('Checkout session changed; retry the request');
    if(!['PENDING_PAYMENT','PAYMENT_PROCESSING'].includes(payment.order.status))throw new ConflictError('This order is no longer awaiting payment');
    for(const item of [...payment.order.items].sort((a,b)=>a.variantId.localeCompare(b.variantId))){
     const inventory=await reserveInventory(tx,item.variantId,item.quantity);
     await tx.inventoryTransaction.create({data:{inventoryId:inventory.id,orderId,actorId:userId,type:'RESERVED',previousQuantity:inventory.quantity,quantityChanged:0,newQuantity:inventory.quantity,reason:`Reserved ${item.quantity} for Stripe Checkout`,transactionReference:claim.transactionReference}});
    }
    await tx.payment.update({where:{id:payment.id},data:{status:'PROCESSING',checkoutSessionId:createdCheckout.checkoutSessionId,paymentIntentId:createdCheckout.paymentIntentId,failureCode:null,failureMessage:null}});
    await tx.paymentAttempt.update({where:{id:claim.attemptId},data:{status:'PROCESSING',providerReference:createdCheckout.checkoutSessionId,failureCode:null,failureMessage:null}});
    await tx.transactionLog.create({data:{transactionReference:claim.transactionReference,paymentId:claim.paymentId,orderId,userId,provider:'stripe',type:'CHECKOUT_CREATED',status:'PROCESSING',amount:claim.amount,currency:claim.currency,message:'Stripe Checkout session created and inventory reserved'}});
   },{isolationLevel:Prisma.TransactionIsolationLevel.Serializable,maxWait:5000,timeout:10000}));
   return {transactionReference:claim.transactionReference,checkoutSessionId:createdCheckout.checkoutSessionId,url:createdCheckout.url};
  }catch(error){
   if(checkout)await provider.expireCheckoutSession(checkout.checkoutSessionId).catch(()=>undefined);
   await prisma.$transaction([prisma.payment.updateMany({where:{id:claim.paymentId,checkoutSessionId:null},data:{status:'FAILED'}}),prisma.paymentAttempt.updateMany({where:{id:claim.attemptId},data:{status:'FAILED',failureMessage:error instanceof Error?error.message.slice(0,1000):'Unable to create checkout session'}})]);
   throw error;
  }
 }

 async checkout(orderId:string,userId:string,idempotencyKey:string){
  let claim=await this.claimCheckout(orderId,userId,idempotencyKey);
  if(claim.checkoutSessionId){
   const checkout=await provider.retrieveCheckoutSession(claim.checkoutSessionId);
   if(checkout.status==='complete'||checkout.paymentStatus==='paid')throw new ConflictError('Payment confirmation is pending');
   if(checkout.status==='open'&&checkout.url)return {transactionReference:claim.transactionReference,checkoutSessionId:checkout.checkoutSessionId,url:checkout.url};
   if(checkout.status!=='expired')throw new ConflictError('Checkout session is not available for payment');
   if(!claim.attemptId)throw new ConflictError('Checkout attempt is unavailable; retry with the original idempotency key');
   claim=await this.claimExpiredSession(claim.paymentId,claim.attemptId,claim.checkoutSessionId,userId);
  }
  return this.createCheckout(orderId,userId,claim);
 }
}

export const paymentService=new PaymentService();
