import { Router } from 'express'; import { z } from 'zod'; import { prisma } from '../../database/prisma.js'; import { authenticate,authorize } from '../../core/middleware/auth.js'; import { ordersService } from './orders.service.js'; import { NotFoundError } from '../../core/errors/app-error.js'; import { validate } from '../../core/middleware/validate.js';
export const ordersRouter=Router();
ordersRouter.use(authenticate);

const orderDetails={items:true,histories:{orderBy:{createdAt:'asc' as const}},payments:{orderBy:{createdAt:'desc' as const}}};
const createOrder=z.object({body:z.object({addressId:z.string().cuid(),shippingRateId:z.string().min(1)}).strict(),params:z.object({}),query:z.object({})});

ordersRouter.post('/',validate(createOrder),async(req,res,next)=>{try{res.status(201).json({success:true,data:await ordersService.create(req.user!.id,req.body.addressId,req.body.shippingRateId)});}catch(e){next(e)}});

// Kept separate as a stable customer-facing route; GET /orders remains compatible.
ordersRouter.get('/purchase-history',async(req,res,next)=>{try{const orders=await prisma.order.findMany({where:{userId:req.user!.id},include:orderDetails,orderBy:{createdAt:'desc'}});res.json({success:true,data:orders});}catch(e){next(e)}});

ordersRouter.get('/',async(req,res,next)=>{try{res.json({success:true,data:await prisma.order.findMany({where:{userId:req.user!.id},include:orderDetails,orderBy:{createdAt:'desc'}})});}catch(e){next(e)}});

ordersRouter.get('/:id',async(req,res,next)=>{try{const o=await prisma.order.findFirst({where:{id:String(req.params.id),userId:req.user!.id},include:orderDetails});if(!o)throw new NotFoundError('Order not found');res.json({success:true,data:o});}catch(e){next(e)}});

const fulfillmentStatus=z.enum(['PROCESSING','SHIPPED','OUT_FOR_DELIVERY','DELIVERED']);
const updateStatus=z.object({body:z.object({status:fulfillmentStatus}),params:z.object({id:z.string().min(1)}),query:z.object({})});
ordersRouter.patch('/:id/status',authorize('ADMIN'),validate(updateStatus),async(req,res,next)=>{try{const o=await ordersService.transitionFulfillmentStatus(String(req.params.id),req.body.status,{id:req.user!.id,role:'ADMIN'});res.json({success:true,data:o});}catch(e){next(e)}});
