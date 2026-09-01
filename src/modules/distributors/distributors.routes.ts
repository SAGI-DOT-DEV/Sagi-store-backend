import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../../database/prisma.js';
import { ConflictError } from '../../core/errors/app-error.js';
import { validate } from '../../core/middleware/validate.js';

const signup=z.object({body:z.object({firstName:z.string().trim().min(1).max(100),lastName:z.string().trim().min(1).max(100),phone:z.string().trim().min(7).max(30),email:z.string().trim().email()}),params:z.object({}),query:z.object({})});
export const distributorsRouter=Router();
distributorsRouter.post('/signup',validate(signup),async(req,res,next)=>{try{const email=req.body.email.toLowerCase();if(await prisma.distributor.findUnique({where:{email}}))throw new ConflictError('Email already registered');const distributor=await prisma.distributor.create({data:{firstName:req.body.firstName.trim(),lastName:req.body.lastName.trim(),phone:req.body.phone.trim(),email}});await prisma.auditLog.create({data:{action:'DISTRIBUTOR_SIGNED_UP',entityType:'Distributor',entityId:distributor.id}});res.status(201).json({success:true,data:distributor});}catch(e){next(e)}});
