import { Router } from 'express'; import type { OrderStatus } from '@prisma/client'; import { prisma } from '../../database/prisma.js'; import { authenticate,authorize } from '../../core/middleware/auth.js'; import { ordersService } from './orders.service.js'; import { NotFoundError } from '../../core/errors/app-error.js';
export const ordersRouter=Router();
ordersRouter.use(authenticate);

const orderDetails={items:true,histories:{orderBy:{createdAt:'asc' as const}},payments:{orderBy:{createdAt:'desc' as const}}};

ordersRouter.post('/',async(req,res,next)=>{try{res.status(201).json({success:true,data:await ordersService.create(req.user!.id,req.body.addressId)});}catch(e){next(e)}});

// Kept separate as a stable customer-facing route; GET /orders remains compatible.
ordersRouter.get('/purchase-history',async(req,res,next)=>{try{const orders=await prisma.order.findMany({where:{userId:req.user!.id},include:orderDetails,orderBy:{createdAt:'desc'}});res.json({success:true,data:orders});}catch(e){next(e)}});

ordersRouter.get('/',async(req,res,next)=>{try{res.json({success:true,data:await prisma.order.findMany({where:{userId:req.user!.id},include:orderDetails,orderBy:{createdAt:'desc'}})});}catch(e){next(e)}});

ordersRouter.get('/:id',async(req,res,next)=>{try{const o=await prisma.order.findFirst({where:{id:String(req.params.id),userId:req.user!.id},include:orderDetails});if(!o)throw new NotFoundError('Order not found');res.json({success:true,data:o});}catch(e){next(e)}});

ordersRouter.patch('/:id/status',authorize('ADMIN'),async(req,res,next)=>{try{const current=await prisma.order.findUnique({where:{id:String(req.params.id)}});if(!current)throw new NotFoundError('Order not found');const status=req.body.status as OrderStatus;const o=await prisma.$transaction(async tx=>{const x=await tx.order.update({where:{id:current.id},data:{status}});await tx.orderStatusHistory.create({data:{orderId:x.id,actorId:req.user!.id,previousStatus:current.status,newStatus:status,reason:req.body.reason}});await tx.auditLog.create({data:{actorId:req.user!.id,actorRole:req.user!.role,action:'ORDER_STATUS_CHANGED',entityType:'Order',entityId:x.id,previousValue:{status:current.status},newValue:{status}}});return x});res.json({success:true,data:o});}catch(e){next(e)}});
