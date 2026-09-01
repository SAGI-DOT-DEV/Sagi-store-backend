import { createHash } from 'node:crypto';
import { Router } from 'express';
import { z } from 'zod';
import { env } from '../../config/env.js';
import { AppError } from '../../core/errors/app-error.js';
import { authenticate, authorize } from '../../core/middleware/auth.js';
import { validate } from '../../core/middleware/validate.js';

const signatureRequest=z.object({body:z.object({}).default({}),params:z.object({}),query:z.object({})});

export const uploadsRouter=Router();

uploadsRouter.post('/products/cloudinary-signature',authenticate,authorize('ADMIN'),validate(signatureRequest),(_req,res,next)=>{try{
 if(!env.CLOUDINARY_CLOUD_NAME||!env.CLOUDINARY_API_KEY||!env.CLOUDINARY_API_SECRET)throw new AppError('SERVICE_UNAVAILABLE',503,'Cloudinary is not configured');
 const timestamp=Math.floor(Date.now()/1000);
 const folder=env.CLOUDINARY_PRODUCT_FOLDER;
 const signature=createHash('sha1').update(`folder=${folder}&timestamp=${timestamp}${env.CLOUDINARY_API_SECRET}`).digest('hex');
 res.json({success:true,data:{cloudName:env.CLOUDINARY_CLOUD_NAME,apiKey:env.CLOUDINARY_API_KEY,timestamp,signature,folder,uploadUrl:`https://api.cloudinary.com/v1_1/${env.CLOUDINARY_CLOUD_NAME}/image/upload`}});
}catch(error){next(error)}});
