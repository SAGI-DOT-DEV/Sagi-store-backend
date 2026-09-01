import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../../database/prisma.js';
import { authenticate, authorize } from '../../core/middleware/auth.js';
import { validate } from '../../core/middleware/validate.js';

const settingsSchema=z.object({body:z.object({freeShippingThreshold:z.number().nonnegative().nullable(),currency:z.literal('CAD').default('CAD'),shipFromName:z.string().trim().min(1).max(150),shipFromCompany:z.string().trim().max(150).nullable().optional(),shipFromPhone:z.string().trim().max(30).nullable().optional(),shipFromEmail:z.string().email().nullable().optional(),shipFromStreet1:z.string().trim().min(1).max(200),shipFromStreet2:z.string().trim().max(200).nullable().optional(),shipFromCity:z.string().trim().min(1).max(100),shipFromState:z.string().trim().max(100).nullable().optional(),shipFromPostalCode:z.string().trim().min(3).max(20),shipFromCountry:z.literal('CA').default('CA')}).strict(),params:z.object({}),query:z.object({})});
const emptySchema=z.object({body:z.object({}).default({}),params:z.object({}),query:z.object({})});
const settingsId='default';

export const shippingSettingsRouter=Router();
shippingSettingsRouter.use(authenticate,authorize('ADMIN'));
shippingSettingsRouter.get('/',validate(emptySchema),async(_req,res,next)=>{try{res.json({success:true,data:await prisma.shippingSettings.findUnique({where:{id:settingsId}})});}catch(error){next(error)}});
shippingSettingsRouter.put('/',validate(settingsSchema),async(req,res,next)=>{try{const settings=await prisma.shippingSettings.upsert({where:{id:settingsId},create:{id:settingsId,...req.body},update:req.body});res.json({success:true,data:settings});}catch(error){next(error)}});
