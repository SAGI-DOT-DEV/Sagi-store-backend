import { sendEmail } from '../../core/email/email-delivery.js';
import { storeEmail, emailParagraph } from '../../core/email/store-template.js';
import { orderEmailTemplate } from '../../core/email/order-template.js';
import { env } from '../../config/env.js';
import { prisma } from '../../database/prisma.js';
import { logger } from '../../core/logger/logger.js';

export async function sendUserVerificationEmail(input:{email:string;firstName:string;token:string}){
 const emailLog=await prisma.emailLog.create({data:{recipient:input.email,template:'user-email-verification',status:'PENDING'}});
 const url=new URL('/verify-email',env.APP_URL);url.searchParams.set('token',input.token);url.searchParams.set('type','user');
 try{const sent=await sendEmail({from:env.EMAIL_FROM,to:input.email,subject:'Confirm your SAGI email address',...storeEmail({appUrl:env.APP_URL,title:'Welcome to your pantry',preview:'Confirm your email to finish creating your SAGI account.',firstName:input.firstName,body:emailParagraph('Thank you for joining SAGI. Confirm your email address to finish setting up your account.')+emailParagraph('This link expires in 24 hours. If you did not create an account, you can safely ignore this email.'),text:'Confirm your email to finish creating your SAGI account. This link expires in 24 hours. If you did not create an account, you can ignore this email.',action:{label:'Confirm email address',url:url.href}})},emailLog.id);await prisma.emailLog.update({where:{id:emailLog.id},data:{status:'SENT',providerMessageId:sent.messageId,sentAt:new Date()}});return true;}catch(error){await prisma.emailLog.update({where:{id:emailLog.id},data:{status:'FAILED',error:error instanceof Error?error.message.slice(0,1000):'Unknown email error'}});logger.error({err:error,recipient:input.email},'verification email failed');return false;}
}

export async function sendExperienceReviewEmail(input:{orderId:string;userId:string;email:string;firstName?:string|null}){
 const notification=await prisma.notification.create({data:{userId:input.userId,orderId:input.orderId,type:'EXPERIENCE_REVIEW_REQUEST',status:'PENDING'}});
 const emailLog=await prisma.emailLog.create({data:{recipient:input.email,template:'experience-review-request',status:'PENDING',orderId:input.orderId}});
 const url=new URL('/review',env.APP_URL);url.searchParams.set('orderId',input.orderId);
 try{const sent=await sendEmail({from:env.EMAIL_FROM,to:input.email,subject:'How was your SAGI experience?',...storeEmail({appUrl:env.APP_URL,title:'How was your SAGI experience?',preview:'Your order has arrived. Share your experience with us.',firstName:input.firstName,body:emailParagraph('Your order has been delivered. We hope it brings something special to your table.')+emailParagraph('Tell us about your checkout, delivery and overall experience. Your feedback helps us improve.'),text:'Your order has been delivered. Tell us about your checkout, delivery and overall experience.',action:{label:'Leave a review',url:url.href}})},emailLog.id);await prisma.$transaction([prisma.emailLog.update({where:{id:emailLog.id},data:{status:'SENT',providerMessageId:sent.messageId,sentAt:new Date()}}),prisma.notification.update({where:{id:notification.id},data:{status:'SENT'}})]);return true;}catch(error){await prisma.$transaction([prisma.emailLog.update({where:{id:emailLog.id},data:{status:'FAILED',error:error instanceof Error?error.message.slice(0,1000):'Unknown email error'}}),prisma.notification.update({where:{id:notification.id},data:{status:'FAILED'}})]);logger.error({err:error,orderId:input.orderId,recipient:input.email},'experience review email failed');return false;}
}

export async function sendOrderEmail(input:{orderId:string;userId:string;email:string;firstName?:string|null;status:string;transactionReference?:string;amount?:string;currency?:string}){
 const template=input.status==='PAID'?'payment-confirmation':`order-status-${input.status.toLowerCase()}`;
 const alreadySent=await prisma.emailLog.findFirst({where:{orderId:input.orderId,template,status:{in:['SENT','PENDING']}},select:{id:true}});
 if(alreadySent)return true;
 const log=await prisma.emailLog.create({data:{recipient:input.email,template,status:'PENDING',orderId:input.orderId,transactionReference:input.transactionReference}});
 try{
  const order=await prisma.order.findUnique({where:{id:input.orderId},include:{items:true}});
  if(!order)throw new Error('Order not found while composing email');
  const message=orderEmailTemplate({appUrl:env.APP_URL,firstName:input.firstName,status:input.status,order,transactionReference:input.transactionReference});
  const sent=await sendEmail({from:env.EMAIL_FROM,to:input.email,...message},log.id);
  await prisma.emailLog.update({where:{id:log.id},data:{status:'SENT',providerMessageId:sent.messageId,sentAt:new Date()}});return true;
 }catch(error){await prisma.emailLog.update({where:{id:log.id},data:{status:'FAILED',error:error instanceof Error?error.message.slice(0,1000):'Unknown email error'}});logger.error({err:error,orderId:input.orderId,recipient:input.email},'order email failed');return false;}
}
