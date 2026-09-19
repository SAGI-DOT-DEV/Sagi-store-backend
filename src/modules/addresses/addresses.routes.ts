import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../../database/prisma.js';
import { authenticate } from '../../core/middleware/auth.js';
import { NotFoundError } from '../../core/errors/app-error.js';
import { validate } from '../../core/middleware/validate.js';
import { addressPhoneSchema } from './address-phone.schema.js';

const fields={label:z.string().trim().max(80).optional(),line1:z.string().trim().min(1).max(200),line2:z.string().trim().max(200).optional(),city:z.string().trim().min(1).max(100),state:z.string().trim().max(100).optional(),country:z.string().trim().length(2).transform(v=>v.toUpperCase()),postalCode:z.string().trim().min(3).max(20),isDefault:z.boolean().optional()};
const addressFields={...fields,phone:addressPhoneSchema,phone2:addressPhoneSchema};
const createSchema=z.object({body:z.object(addressFields).strict(),params:z.object({}),query:z.object({})});
const updateSchema=z.object({body:z.object(addressFields).partial().strict().refine(v=>Object.keys(v).length>0),params:z.object({id:z.string().cuid()}),query:z.object({})});
const idSchema=z.object({body:z.object({}).default({}),params:z.object({id:z.string().cuid()}),query:z.object({})});
export const addressesRouter=Router(); addressesRouter.use(authenticate);
addressesRouter.get('/',async(req,res,next)=>{try{res.json({success:true,data:await prisma.address.findMany({where:{userId:req.user!.id},orderBy:[{isDefault:'desc'},{createdAt:'desc'}]})});}catch(e){next(e)}});
addressesRouter.post('/',validate(createSchema),async(req,res,next)=>{try{const data=req.body;const address=await prisma.$transaction(async tx=>{if(data.isDefault)await tx.address.updateMany({where:{userId:req.user!.id},data:{isDefault:false}});return tx.address.create({data:{...data,userId:req.user!.id}});});res.status(201).json({success:true,data:address});}catch(e){next(e)}});
addressesRouter.patch('/:id',validate(updateSchema),async(req,res,next)=>{try{const existing=await prisma.address.findFirst({where:{id:String(req.params.id),userId:req.user!.id}});if(!existing)throw new NotFoundError('Address not found');const address=await prisma.$transaction(async tx=>{if(req.body.isDefault)await tx.address.updateMany({where:{userId:req.user!.id},data:{isDefault:false}});return tx.address.update({where:{id:existing.id},data:req.body});});res.json({success:true,data:address});}catch(e){next(e)}});
addressesRouter.delete('/:id',validate(idSchema),async(req,res,next)=>{try{const result=await prisma.address.deleteMany({where:{id:String(req.params.id),userId:req.user!.id}});if(!result.count)throw new NotFoundError('Address not found');res.status(204).send();}catch(e){next(e)}});
