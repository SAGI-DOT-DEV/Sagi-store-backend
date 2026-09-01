import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../../database/prisma.js';
import { authenticate } from '../../core/middleware/auth.js';
import { ConflictError, NotFoundError } from '../../core/errors/app-error.js';
import { validate } from '../../core/middleware/validate.js';

const rating=z.number().int().min(1).max(5);
const createExperienceReview=z.object({body:z.object({orderId:z.string().cuid(),deliveryRating:rating.optional(),checkoutRating:rating.optional(),overallRating:rating,comment:z.string().trim().min(1).max(2_000).optional()}).strict(),params:z.object({}),query:z.object({})});
const experienceReviewQuery=z.object({body:z.object({}).default({}),params:z.object({}),query:z.object({orderId:z.string().cuid()})});

export const reviewsRouter=Router();
reviewsRouter.use(authenticate);

reviewsRouter.get('/experience',validate(experienceReviewQuery),async(req,res,next)=>{try{const review=await prisma.experienceReview.findUnique({where:{userId_orderId:{userId:req.user!.id,orderId:String(req.query.orderId)}}});res.json({success:true,data:review});}catch(error){next(error)}});

reviewsRouter.post('/experience',validate(createExperienceReview),async(req,res,next)=>{try{const order=await prisma.order.findFirst({where:{id:req.body.orderId,userId:req.user!.id},select:{id:true,status:true}});if(!order)throw new NotFoundError('Order not found');if(order.status!=='DELIVERED')throw new ConflictError('Experience reviews are available after delivery');const existing=await prisma.experienceReview.findUnique({where:{userId_orderId:{userId:req.user!.id,orderId:order.id}},select:{id:true}});if(existing)throw new ConflictError('You have already reviewed this order');const review=await prisma.experienceReview.create({data:{userId:req.user!.id,orderId:order.id,deliveryRating:req.body.deliveryRating,checkoutRating:req.body.checkoutRating,overallRating:req.body.overallRating,comment:req.body.comment}});res.status(201).json({success:true,data:review});}catch(error){next(error)}});
