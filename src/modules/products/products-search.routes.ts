import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../../database/prisma.js';
import { validate } from '../../core/middleware/validate.js';

const listSchema=z.object({body:z.object({}).default({}),params:z.object({}),query:z.object({q:z.string().trim().max(200).optional(),slug:z.string().trim().max(200).optional(),categoryId:z.string().cuid().optional(),category:z.string().trim().max(100).optional(),minPrice:z.coerce.number().nonnegative().optional(),maxPrice:z.coerce.number().nonnegative().optional(),page:z.coerce.number().int().positive().default(1),limit:z.coerce.number().int().positive().max(100).default(20),sort:z.enum(['createdAt','name','price']).default('createdAt'),order:z.enum(['asc','desc']).default('desc')})});

export const productsSearchRouter=Router();
productsSearchRouter.get('/',validate(listSchema),async(req,res,next)=>{try{
 const q=listSchema.shape.query.parse(req.query) as {q?:string;slug?:string;categoryId?:string;category?:string;minPrice?:number;maxPrice?:number;page:number;limit:number;sort:'createdAt'|'name'|'price';order:'asc'|'desc'};
 const where={status:'ACTIVE' as const,...(q.slug?{slug:q.slug}:{}),...(q.categoryId?{categoryId:q.categoryId}:{}),...(q.category?{category:{slug:q.category}}:{}),...(q.minPrice!==undefined||q.maxPrice!==undefined?{variants:{some:{price:{...(q.minPrice!==undefined?{gte:q.minPrice}:{}),...(q.maxPrice!==undefined?{lte:q.maxPrice}:{})}}}}:{}),...(q.q?{OR:[{name:{contains:q.q,mode:'insensitive' as const}},{description:{contains:q.q,mode:'insensitive' as const}},{variants:{some:{OR:[{sku:{contains:q.q,mode:'insensitive' as const}},{name:{contains:q.q,mode:'insensitive' as const}}]}}}]}:{})};
 const skip=(q.page-1)*q.limit;
 const include={category:true,images:true,variants:{include:{inventory:true}}} as const;
 let items; let total:number;
 if(q.sort==='price'){
  const all=await prisma.product.findMany({where,include});
  all.sort((a,b)=>{const priceA=Math.min(...a.variants.map(item=>Number(item.price)),Number.POSITIVE_INFINITY);const priceB=Math.min(...b.variants.map(item=>Number(item.price)),Number.POSITIVE_INFINITY);return (priceA-priceB)*(q.order==='asc'?1:-1);});
  total=all.length;items=all.slice(skip,skip+q.limit);
 }else{
  const orderBy=q.sort==='name'?{name:q.order}:{createdAt:q.order};
  const result=await prisma.$transaction([prisma.product.findMany({where,include,orderBy,skip,take:q.limit}),prisma.product.count({where})]);
  items=result[0];total=result[1];
 }
 res.json({success:true,data:{items,pagination:{page:q.page,limit:q.limit,total,totalPages:Math.ceil(total/q.limit)}}});
}catch(error){next(error)}});
