import type { Prisma } from '@prisma/client';
import { adminProductInclude } from './admin-catalog.schema.js';
import { productCharacteristics } from './product-characteristics.schema.js';
import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../../database/prisma.js';
import { authenticate,authorize } from '../../core/middleware/auth.js';
import { ConflictError,NotFoundError } from '../../core/errors/app-error.js';
import { validate } from '../../core/middleware/validate.js';

const updateSchema=z.object({body:z.object({...productCharacteristics,name:z.string().trim().min(1).max(200).optional(),slug:z.string().trim().min(1).max(200).optional(),description:z.string().trim().min(1).max(10000).optional(),status:z.enum(['ACTIVE','DRAFT','ARCHIVED']).optional(),categoryId:z.string().cuid().nullable().optional(),metadata:z.record(z.string(),z.unknown()).optional()}).strict().refine(value=>Object.keys(value).length>0),params:z.object({id:z.string().cuid()}),query:z.object({})});
const idSchema=z.object({body:z.object({}).default({}),params:z.object({id:z.string().cuid()}),query:z.object({})});

export const productsAdminRouter=Router();
productsAdminRouter.patch('/:id',authenticate,authorize('ADMIN'),validate(updateSchema),async(req,res,next)=>{
 try {
  const input=updateSchema.parse({body:req.body,params:req.params,query:req.query}).body;
  const product=await prisma.product.update({
   where:{id:String(req.params.id)},
   data:{...input,metadata:input.metadata as Prisma.InputJsonObject|undefined},
   include:adminProductInclude,
  });
  await prisma.auditLog.create({data:{actorId:req.user!.id,actorRole:req.user!.role,action:'PRODUCT_UPDATED',entityType:'Product',entityId:product.id}});
  res.json({success:true,data:product});
 }catch(error){next(error);}
});
productsAdminRouter.delete('/:id',authenticate,authorize('ADMIN'),validate(idSchema),async(req,res,next)=>{try{const id=String(req.params.id);const product=await prisma.product.findUnique({where:{id},select:{id:true}});if(!product)throw new NotFoundError('Product not found');if(await prisma.productVariant.count({where:{productId:id}}))throw new ConflictError('Products with variants cannot be deleted; archive the product instead');await prisma.product.delete({where:{id}});await prisma.auditLog.create({data:{actorId:req.user!.id,actorRole:req.user!.role,action:'PRODUCT_DELETED',entityType:'Product',entityId:id}});res.status(204).send();}catch(error){next(error)}});
