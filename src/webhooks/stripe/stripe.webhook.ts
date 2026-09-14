import type { RequestHandler } from 'express';
import Stripe from 'stripe';
import { env } from '../../config/env.js';
import { prisma } from '../../database/prisma.js';
import { retryWriteConflict } from '../../database/transaction.js';
import { releaseReservedInventory, sellReservedInventory } from '../../modules/inventory/inventory.service.js';
import { sendOrderEmail } from '../../modules/auth/email-verification.service.js';
import { removePurchasedQuantities } from '../../modules/cart/purchased-cart.service.js';

const stripe=new Stripe(env.STRIPE_SECRET_KEY);

const succeeded=async(paymentId:string,eventId:string)=>retryWriteConflict(()=>prisma.$transaction(async tx=>{
 const payment=await tx.payment.findUnique({where:{id:paymentId},include:{order:{include:{items:true}}}});
 if(!payment)return;
 const claimed=await tx.payment.updateMany({where:{id:payment.id,status:{in:['PENDING','PROCESSING']}},data:{status:'SUCCEEDED'}});
 if(claimed.count===0)return;
 const paid=await tx.order.updateMany({where:{id:payment.orderId,status:{in:['PENDING_PAYMENT','PAYMENT_PROCESSING']}},data:{status:'PAID'}});
 if(paid.count===0)throw new Error('Order cannot be fulfilled from its current status');
 await removePurchasedQuantities(tx,payment.order.userId,payment.order.items);
 await tx.paymentAttempt.updateMany({where:{paymentId:payment.id,status:'PROCESSING'},data:{status:'SUCCEEDED',failureCode:null,failureMessage:null}});
 await tx.orderStatusHistory.create({data:{orderId:payment.orderId,previousStatus:payment.order.status,newStatus:'PAID',reason:'Confirmed by Stripe webhook'}});
 for(const item of [...payment.order.items].sort((a,b)=>a.variantId.localeCompare(b.variantId)))await sellReservedInventory(tx,{variantId:item.variantId,quantity:item.quantity,orderId:payment.orderId,transactionReference:payment.transactionReference});
 await tx.transactionLog.create({data:{transactionReference:payment.transactionReference,paymentId:payment.id,orderId:payment.orderId,userId:payment.order.userId,provider:'stripe',type:'PAYMENT_SUCCEEDED',status:'SUCCEEDED',amount:payment.amount,currency:payment.currency,stripeEventId:eventId,message:'Payment confirmed and inventory deducted'}});
},{isolationLevel:'Serializable',maxWait:5000,timeout:10000}));

const expired=async(paymentId:string,eventId:string,checkoutSessionId:string)=>retryWriteConflict(()=>prisma.$transaction(async tx=>{
 const payment=await tx.payment.findUnique({where:{id:paymentId},include:{order:{include:{items:true}}}});
 if(!payment)return;
 if(payment.checkoutSessionId!==checkoutSessionId)return;
 const cancelled=await tx.order.updateMany({where:{id:payment.orderId,status:{in:['PENDING_PAYMENT','PAYMENT_PROCESSING']}},data:{status:'CANCELLED'}});
 if(cancelled.count===0)return;
 await tx.payment.updateMany({where:{id:payment.id,status:{in:['PENDING','PROCESSING']}},data:{status:'CANCELED'}});
 await tx.paymentAttempt.updateMany({where:{paymentId:payment.id,status:'PROCESSING'},data:{status:'CANCELED',failureCode:null,failureMessage:null}});
 await tx.orderStatusHistory.create({data:{orderId:payment.orderId,previousStatus:payment.order.status,newStatus:'CANCELLED',reason:'Stripe Checkout session expired'}});
 for(const item of [...payment.order.items].sort((a,b)=>a.variantId.localeCompare(b.variantId)))await releaseReservedInventory(tx,{variantId:item.variantId,quantity:item.quantity,orderId:payment.orderId,transactionReference:payment.transactionReference});
 await tx.transactionLog.create({data:{transactionReference:payment.transactionReference,paymentId:payment.id,orderId:payment.orderId,userId:payment.order.userId,provider:'stripe',type:'CHECKOUT_EXPIRED',status:'CANCELED',amount:payment.amount,currency:payment.currency,stripeEventId:eventId,message:'Stripe Checkout session expired and inventory reservation was released'}});
},{isolationLevel:'Serializable',maxWait:5000,timeout:10000}));

const asyncPaymentFailed=async(paymentId:string,eventId:string,checkoutSessionId:string)=>retryWriteConflict(()=>prisma.$transaction(async tx=>{
 const payment=await tx.payment.findUnique({where:{id:paymentId},include:{order:{include:{items:true}}}});
 if(!payment)return;
 if(payment.checkoutSessionId!==checkoutSessionId)return;
 const cancelled=await tx.order.updateMany({where:{id:payment.orderId,status:{in:['PENDING_PAYMENT','PAYMENT_PROCESSING']}},data:{status:'CANCELLED'}});
 if(cancelled.count===0)return;
 await tx.payment.updateMany({where:{id:payment.id,status:{in:['PENDING','PROCESSING']}},data:{status:'FAILED',failureMessage:'Stripe reported that an asynchronous payment failed'}});
 await tx.paymentAttempt.updateMany({where:{paymentId:payment.id,status:'PROCESSING'},data:{status:'FAILED',failureMessage:'Stripe reported that an asynchronous payment failed'}});
 await tx.orderStatusHistory.create({data:{orderId:payment.orderId,previousStatus:payment.order.status,newStatus:'CANCELLED',reason:'Stripe asynchronous payment failed'}});
 for(const item of [...payment.order.items].sort((a,b)=>a.variantId.localeCompare(b.variantId)))await releaseReservedInventory(tx,{variantId:item.variantId,quantity:item.quantity,orderId:payment.orderId,transactionReference:payment.transactionReference});
 await tx.transactionLog.create({data:{transactionReference:payment.transactionReference,paymentId:payment.id,orderId:payment.orderId,userId:payment.order.userId,provider:'stripe',type:'ASYNC_PAYMENT_FAILED',status:'FAILED',amount:payment.amount,currency:payment.currency,stripeEventId:eventId,message:'Asynchronous Stripe payment failed and inventory reservation was released'}});
},{isolationLevel:'Serializable',maxWait:5000,timeout:10000}));

const notifyPaymentSuccess=async(paymentId:string)=>{
 const info=await prisma.payment.findUnique({where:{id:paymentId},include:{order:{include:{user:{include:{profile:true}}}}}});
 if(info?.order)await sendOrderEmail({orderId:info.order.id,userId:info.order.userId,email:info.order.user.email,firstName:info.order.user.profile?.firstName,status:'PAID',transactionReference:info.transactionReference,amount:String(info.amount),currency:info.currency});
};

export const stripeWebhook:RequestHandler=async(req,res,next)=>{try{
 const signature=req.header('stripe-signature');
 if(!signature){res.status(400).json({error:'Missing Stripe signature.'});return;}
 let event:Stripe.Event;
 try{event=stripe.webhooks.constructEvent(req.body,signature,env.STRIPE_WEBHOOK_SECRET);}
 catch{res.status(400).json({error:'Webhook signature verification failed.'});return;}
 const prior=await prisma.stripeEvent.findUnique({where:{id:event.id}});
 // A prior event can have been recorded as processed before its payment was
 // discoverable (for example, Checkout completed before payment_intentId was
 // persisted). Only skip true duplicates that are already linked to a payment.
 if(prior?.status==='PROCESSED'&&prior.paymentId){res.status(200).json({received:true});return;}
 const object=event.data.object as Stripe.Checkout.Session|Stripe.PaymentIntent;
 const paymentIntentId='payment_intent' in object&&typeof object.payment_intent==='string'?object.payment_intent:object.id.startsWith('pi_')?object.id:undefined;
 const checkoutSessionId=object.id.startsWith('cs_')?object.id:undefined;
 // Stripe may send `payment_intent` on checkout.session.completed before the
 // payment intent ID has been persisted on our Payment row. Always fall back
 // to the Checkout Session ID so successful Checkout payments are resolved.
 let payment=paymentIntentId?await prisma.payment.findUnique({where:{paymentIntentId}}):null;
 if(!payment&&checkoutSessionId)payment=await prisma.payment.findUnique({where:{checkoutSessionId}});
 await prisma.stripeEvent.upsert({where:{id:event.id},create:{id:event.id,type:event.type,apiVersion:event.api_version,livemode:event.livemode,payload:event as unknown as object,paymentId:payment?.id},update:{status:'PROCESSING',attempts:{increment:1},errorMessage:null}});
 try{
  if(event.type==='payment_intent.succeeded'&&payment){await succeeded(payment.id,event.id);void notifyPaymentSuccess(payment.id).catch(()=>undefined);}
  if(event.type==='checkout.session.completed'&&payment&&(object as Stripe.Checkout.Session).payment_status==='paid'){await succeeded(payment.id,event.id);void notifyPaymentSuccess(payment.id).catch(()=>undefined);}
  if(event.type==='checkout.session.async_payment_succeeded'&&payment){await succeeded(payment.id,event.id);void notifyPaymentSuccess(payment.id).catch(()=>undefined);}
  if(event.type==='checkout.session.expired'&&payment&&checkoutSessionId)await expired(payment.id,event.id,checkoutSessionId);
  if(event.type==='checkout.session.async_payment_failed'&&payment&&checkoutSessionId)await asyncPaymentFailed(payment.id,event.id,checkoutSessionId);
  if(event.type==='payment_intent.payment_failed'&&payment){const failed=await prisma.payment.updateMany({where:{id:payment.id,status:{in:['PENDING','PROCESSING']}},data:{failureCode:(object as Stripe.PaymentIntent).last_payment_error?.code,failureMessage:(object as Stripe.PaymentIntent).last_payment_error?.message}});if(failed.count===0)await prisma.transactionLog.create({data:{transactionReference:payment.transactionReference,paymentId:payment.id,orderId:payment.orderId,provider:'stripe',type:'PAYMENT_FAILED_IGNORED',status:'IGNORED',amount:payment.amount,currency:payment.currency,stripeEventId:event.id,message:'Ignored an out-of-order payment failure for an already resolved payment'}});}
  await prisma.stripeEvent.update({where:{id:event.id},data:{status:'PROCESSED',processedAt:new Date()}});
 }catch(error){await prisma.stripeEvent.update({where:{id:event.id},data:{status:'FAILED',errorMessage:error instanceof Error?error.message:'Unknown error'}});throw error;}
 res.status(200).json({received:true});
}catch(e){next(e)}};
