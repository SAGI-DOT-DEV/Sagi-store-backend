import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../../database/prisma.js';
import { authenticate } from '../../core/middleware/auth.js';
import { NotFoundError } from '../../core/errors/app-error.js';
import { validate } from '../../core/middleware/validate.js';

const itemSchema=z.object({body:z.object({variantId:z.string().cuid()}),params:z.object({}),query:z.object({})});
const deleteSchema=z.object({body:z.object({}).default({}),params:z.object({variantId:z.string().cuid()}),query:z.object({})});
export const wishlistRouter=Router(); wishlistRouter.use(authenticate);
wishlistRouter.get('/',async(req,res,next)=>{try{const wishlist=await prisma.wishlist.findUnique({where:{userId:req.user!.id},include:{items:{include:{variant:{include:{product:{include:{images:true,category:true}},inventory:true}}}}}});res.json({success:true,data:wishlist??{items:[]}});}catch(error){next(error)}});
wishlistRouter.post('/items',validate(itemSchema),async(req,res,next)=>{try{const variant=await prisma.productVariant.findUnique({where:{id:req.body.variantId},select:{id:true}});if(!variant)throw new NotFoundError('Product variant not found');const wishlist=await prisma.$transaction(async tx=>{const w=await tx.wishlist.upsert({where:{userId:req.user!.id},create:{userId:req.user!.id},update:{}});await tx.wishlistItem.upsert({where:{wishlistId_variantId:{wishlistId:w.id,variantId:variant.id}},create:{wishlistId:w.id,variantId:variant.id},update:{}});return tx.wishlist.findUniqueOrThrow({where:{id:w.id},include:{items:true}});});res.status(201).json({success:true,data:wishlist});}catch(error){next(error)}});
wishlistRouter.delete('/items/:variantId',validate(deleteSchema),async(req,res,next)=>{try{const wishlist=await prisma.wishlist.findUnique({where:{userId:req.user!.id},select:{id:true}});if(!wishlist)throw new NotFoundError('Wishlist item not found');const result=await prisma.wishlistItem.deleteMany({where:{wishlistId:wishlist.id,variantId:String(req.params.variantId)}});if(!result.count)throw new NotFoundError('Wishlist item not found');res.status(204).send();}catch(error){next(error)}});
