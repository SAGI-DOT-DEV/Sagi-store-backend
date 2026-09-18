import { sendEmail } from '../../core/email/email-delivery.js';
import { env } from '../../config/env.js';
import { prisma } from '../../database/prisma.js';
import { logger } from '../../core/logger/logger.js';

export async function sendUserVerificationEmail(input:{email:string;firstName:string;token:string}){
 const emailLog=await prisma.emailLog.create({data:{recipient:input.email,template:'user-email-verification',status:'PENDING'}});
 const url=new URL('/verify-email',env.APP_URL);url.searchParams.set('token',input.token);url.searchParams.set('type','user');
 try{const sent=await sendEmail({from:env.EMAIL_FROM,to:input.email,subject:'Confirm your SAGI email address',text:`Hello ${input.firstName}, confirm your email address: ${url.toString()}`,html:`<p>Hello ${input.firstName},</p><p><a href="${url.toString()}">Confirm your email address</a></p><p>This link expires in 24 hours.</p>`},emailLog.id);await prisma.emailLog.update({where:{id:emailLog.id},data:{status:'SENT',providerMessageId:sent.messageId,sentAt:new Date()}});return true;}catch(error){await prisma.emailLog.update({where:{id:emailLog.id},data:{status:'FAILED',error:error instanceof Error?error.message.slice(0,1000):'Unknown email error'}});logger.error({err:error,recipient:input.email},'verification email failed');return false;}
}

export async function sendExperienceReviewEmail(input:{orderId:string;userId:string;email:string;firstName?:string|null}){
 const notification=await prisma.notification.create({data:{userId:input.userId,orderId:input.orderId,type:'EXPERIENCE_REVIEW_REQUEST',status:'PENDING'}});
 const emailLog=await prisma.emailLog.create({data:{recipient:input.email,template:'experience-review-request',status:'PENDING',orderId:input.orderId}});
 const url=new URL('/review',env.APP_URL);url.searchParams.set('orderId',input.orderId);
 try{const greeting=input.firstName?`Hello ${input.firstName}`:'Hello';const sent=await sendEmail({from:env.EMAIL_FROM,to:input.email,subject:'How was your SAGI experience?',text:`${greeting}, your order has been delivered. Tell us about your experience: ${url.toString()}`,html:`<p>${greeting},</p><p>Your order has been delivered. We would love to hear about your experience.</p><p><a href="${url.toString()}">Leave a review</a></p>`},emailLog.id);await prisma.$transaction([prisma.emailLog.update({where:{id:emailLog.id},data:{status:'SENT',providerMessageId:sent.messageId,sentAt:new Date()}}),prisma.notification.update({where:{id:notification.id},data:{status:'SENT'}})]);return true;}catch(error){await prisma.$transaction([prisma.emailLog.update({where:{id:emailLog.id},data:{status:'FAILED',error:error instanceof Error?error.message.slice(0,1000):'Unknown email error'}}),prisma.notification.update({where:{id:notification.id},data:{status:'FAILED'}})]);logger.error({err:error,orderId:input.orderId,recipient:input.email},'experience review email failed');return false;}
}

export async function sendOrderEmail(input:{orderId:string;userId:string;email:string;firstName?:string|null;status:string;transactionReference?:string;amount?:string;currency?:string}){
 const template=input.status==='PAID'?'payment-confirmation':`order-status-${input.status.toLowerCase()}`;
 const alreadySent=await prisma.emailLog.findFirst({where:{orderId:input.orderId,template,status:{in:['SENT','PENDING']}},select:{id:true}});
 if(alreadySent)return true;
 const log=await prisma.emailLog.create({data:{recipient:input.email,template,status:'PENDING',orderId:input.orderId,transactionReference:input.transactionReference}});
 try{
  const order=await prisma.order.findUnique({where:{id:input.orderId},include:{items:true}});
  if(!order)throw new Error('Order not found while composing email');
  const currency=(input.currency??order.currency).toUpperCase();
  const money=(value:unknown)=>`${currency} ${Number(value).toFixed(2)}`;
  const itemRows=order.items.map(item=>({name:item.name,quantity:item.quantity,unitPrice:Number(item.unitPrice),lineTotal:Number(item.unitPrice)*item.quantity}));
  const itemText=itemRows.map(item=>`${item.name} x ${item.quantity} — ${money(item.lineTotal)}`).join('\\n');
  const itemHtml=itemRows.map(item=>`<tr><td style="padding:10px 0;border-bottom:1px solid #eee">${item.name}<br><span style="color:#666;font-size:13px">Quantity: ${item.quantity}</span></td><td style="padding:10px 0;border-bottom:1px solid #eee;text-align:right">${money(item.lineTotal)}</td></tr>`).join('');
  const greeting=input.firstName?`Hello ${input.firstName},`:'Hello,';
  const statusLabel=input.status.replaceAll('_',' ').toLowerCase().replace(/\\b\\w/g,letter=>letter.toUpperCase());
  const isPaid=input.status==='PAID';
  const subject=isPaid?'Payment confirmed — your SAGI order is being prepared':`Your SAGI order is now ${statusLabel}`;
  const reviewUrl=new URL('/review',env.APP_URL);reviewUrl.searchParams.set('orderId',input.orderId);
  const text=isPaid?`${greeting}\\n\\nThank you for your order. We have received your payment and your order is now being prepared.\\n\\n${itemText}\\n\\nSubtotal: ${money(order.subtotal)}\\nShipping: ${money(order.shippingAmount)}\\nTotal paid: ${money(order.total)}\\n\\nYour payment reference is ${input.transactionReference??'available in your account'}.`:`${greeting}\\n\\nYour order status is now ${statusLabel}.\\n\\n${itemText}\\n\\nOrder total: ${money(order.total)}${input.status==='DELIVERED'?`\\n\\nWe hope you enjoy your order. Leave a review: ${reviewUrl.toString()}`:''}`;
  const html=isPaid?`<div style="font-family:Arial,sans-serif;color:#222;max-width:600px;margin:auto"><h2 style="color:#176b4d">Payment confirmed</h2><p>${greeting}</p><p>Thank you for shopping with SAGI. Your payment has been received and your order is now being prepared.</p><table style="width:100%;border-collapse:collapse">${itemHtml}</table><table style="width:100%;margin-top:16px"><tr><td>Subtotal</td><td style="text-align:right">${money(order.subtotal)}</td></tr><tr><td>Shipping</td><td style="text-align:right">${money(order.shippingAmount)}</td></tr><tr><td style="font-weight:bold;padding-top:8px">Total paid</td><td style="font-weight:bold;text-align:right;padding-top:8px">${money(order.total)}</td></tr></table><p style="margin-top:24px">Payment reference: <strong>${input.transactionReference??'See your SAGI account'}</strong></p></div>`:`<div style="font-family:Arial,sans-serif;color:#222;max-width:600px;margin:auto"><h2 style="color:#176b4d">${input.status==='DELIVERED'?'Order delivered':'Order update'}</h2><p>${greeting}</p><p>Your order status is now <strong>${statusLabel}</strong>.</p><table style="width:100%;border-collapse:collapse">${itemHtml}</table><p style="margin-top:20px">Order total: <strong>${money(order.total)}</strong></p>${input.status==='DELIVERED'?`<p>We hope you enjoy your order.</p><p><a href="${reviewUrl.toString()}" style="background:#176b4d;color:#fff;padding:12px 18px;text-decoration:none;border-radius:4px">Leave a review</a></p>`:''}</div>`;
  const sent=await sendEmail({from:env.EMAIL_FROM,to:input.email,subject,text,html},log.id);
  await prisma.emailLog.update({where:{id:log.id},data:{status:'SENT',providerMessageId:sent.messageId,sentAt:new Date()}});return true;
 }catch(error){await prisma.emailLog.update({where:{id:log.id},data:{status:'FAILED',error:error instanceof Error?error.message.slice(0,1000):'Unknown email error'}});logger.error({err:error,orderId:input.orderId,recipient:input.email},'order email failed');return false;}
}
