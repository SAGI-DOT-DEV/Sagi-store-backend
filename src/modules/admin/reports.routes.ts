import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../../database/prisma.js';
import { authenticate, authorize } from '../../core/middleware/auth.js';
import { validate } from '../../core/middleware/validate.js';

const completedStatuses=['PAID','PROCESSING','SHIPPED','OUT_FOR_DELIVERY','DELIVERED'] as const;
const reportQuery=z.object({body:z.object({}).default({}),params:z.object({}),query:z.object({from:z.coerce.date().optional(),to:z.coerce.date().optional(),limit:z.coerce.number().int().positive().max(100).default(10)})});
const readQuery=(value:unknown)=>reportQuery.parse({body:{},params:{},query:value}).query;

export const reportsRouter=Router();
reportsRouter.use(authenticate,authorize('ADMIN'));

reportsRouter.get('/sales',validate(reportQuery),async(req,res,next)=>{try{
 const query=readQuery(req.query);const createdAt={...(query.from?{gte:query.from}:{}),...(query.to?{lt:query.to}:{})};
 const orders=await prisma.order.findMany({where:{status:{in:[...completedStatuses]},...(Object.keys(createdAt).length?{createdAt}: {})},select:{total:true,items:{select:{quantity:true}}}});
 const revenue=orders.reduce((sum,order)=>sum+Number(order.total),0);const unitsSold=orders.reduce((sum,order)=>sum+order.items.reduce((items,item)=>items+item.quantity,0),0);const orderCount=orders.length;
 res.json({success:true,data:{revenue:Number(revenue.toFixed(2)),orders:orderCount,averageOrderValue:orderCount?Number((revenue/orderCount).toFixed(2)):0,unitsSold,filters:{from:query.from?.toISOString()??null,to:query.to?.toISOString()??null}}});
}catch(error){next(error)}});

reportsRouter.get('/inventory',async(_req,res,next)=>{try{const rows=await prisma.inventory.findMany({include:{variant:{select:{id:true,sku:true,name:true,product:{select:{name:true}}}}}});res.json({success:true,data:rows.map(r=>({variantId:r.variantId,sku:r.variant.sku,product:r.variant.product.name,name:r.variant.name,quantity:r.quantity,reservedQuantity:r.reservedQuantity,availableQuantity:r.quantity-r.reservedQuantity}))});}catch(error){next(error)}});
reportsRouter.get('/order-operations',async(_req,res,next)=>{try{const [awaitingShipment,delivered]=await Promise.all([prisma.order.findMany({where:{status:{in:['PAID','PROCESSING','SHIPPED','OUT_FOR_DELIVERY']}},orderBy:{createdAt:'desc'}}),prisma.order.findMany({where:{status:'DELIVERED'},orderBy:{updatedAt:'desc'}})]);res.json({success:true,data:{awaitingShipment,delivered}});}catch(error){next(error)}});

const reviewReportQuery=z.object({body:z.object({}).default({}),params:z.object({}),query:z.object({from:z.coerce.date().optional(),to:z.coerce.date().optional(),status:z.enum(['PENDING','APPROVED','REJECTED']).optional(),productId:z.string().cuid().optional(),limit:z.coerce.number().int().positive().max(100).default(20)})});
reportsRouter.get('/reviews',validate(reviewReportQuery),async(req,res,next)=>{try{
 const query=reviewReportQuery.parse({body:{},params:{},query:req.query}).query;
 const createdAt={...(query.from?{gte:query.from}:{}),...(query.to?{lt:query.to}:{})};
 const where={...(query.status?{status:query.status}:{}),...(query.productId?{productId:query.productId}:{}),...(Object.keys(createdAt).length?{createdAt}: {})};
 const [reviews,total]=await Promise.all([
  prisma.review.findMany({where,orderBy:{createdAt:'desc'},take:query.limit,select:{id:true,rating:true,comment:true,status:true,createdAt:true,product:{select:{id:true,name:true,slug:true}},user:{select:{id:true,email:true,profile:{select:{firstName:true,lastName:true}}}}}}),
  prisma.review.count({where})
 ]);
 const aggregate=await prisma.review.aggregate({where,_avg:{rating:true},_count:{_all:true}});
 const distribution=await prisma.review.groupBy({where,by:['rating'],_count:{rating:true},orderBy:{rating:'asc'}});
 const productGroups=await prisma.review.groupBy({where,by:['productId'],_count:{productId:true},_avg:{rating:true},orderBy:{_count:{productId:'desc'}}});
 const productIds=productGroups.map(group=>group.productId);
 const products=productIds.length?await prisma.product.findMany({where:{id:{in:productIds}},select:{id:true,name:true,slug:true}}):[];
 const productMap=new Map(products.map(product=>[product.id,product]));
 res.json({success:true,data:{totalReviews:total,averageRating:Number((aggregate._avg.rating??0).toFixed(2)),ratingDistribution:distribution.map(row=>({rating:row.rating,count:row._count.rating})),byProduct:productGroups.map(row=>({product:productMap.get(row.productId)??{id:row.productId},reviews:row._count.productId,averageRating:Number((row._avg.rating??0).toFixed(2))})),reviews,filters:{from:query.from?.toISOString()??null,to:query.to?.toISOString()??null,status:query.status??null,productId:query.productId??null}}});
}catch(error){next(error)}});

reportsRouter.get('/product-performance',validate(reportQuery),async(req,res,next)=>{try{
 const query=readQuery(req.query);const createdAt={...(query.from?{gte:query.from}:{}),...(query.to?{lt:query.to}:{})};
 const orders=await prisma.order.findMany({where:{status:{in:[...completedStatuses]},...(Object.keys(createdAt).length?{createdAt}: {})},select:{items:{select:{variantId:true,sku:true,name:true,unitPrice:true,quantity:true}}}});
 const totals=new Map<string,{variantId:string;sku:string;name:string;unitsSold:number;revenue:number}>();
 for(const order of orders)for(const item of order.items){const current=totals.get(item.variantId)??{variantId:item.variantId,sku:item.sku,name:item.name,unitsSold:0,revenue:0};current.unitsSold+=item.quantity;current.revenue+=Number(item.unitPrice)*item.quantity;totals.set(item.variantId,current);}
 const products=[...totals.values()].map(item=>({...item,revenue:Number(item.revenue.toFixed(2))})).sort((a,b)=>b.unitsSold-a.unitsSold||b.revenue-a.revenue);const bestSeller=products[0]??null;const worstSeller=products.length?products[products.length-1]:null;
 res.json({success:true,data:{bestSeller,worstSeller,products:products.slice(0,query.limit),filters:{from:query.from?.toISOString()??null,to:query.to?.toISOString()??null}}});
}catch(error){next(error)}});
