import { Router } from 'express';
import { z } from 'zod';
import { authenticate } from '../../core/middleware/auth.js';
import { validate } from '../../core/middleware/validate.js';
import { cartService } from './cart.service.js';

const variantId=z.string().min(1);
const quantity=z.number().int().min(1).max(100);
const addItem=z.object({body:z.object({variantId,quantity}),params:z.object({}),query:z.object({})});
const updateItem=z.object({body:z.object({quantity}),params:z.object({variantId}),query:z.object({})});
const removeItem=z.object({body:z.object({}),params:z.object({variantId}),query:z.object({})});

export const cartRouter=Router();
cartRouter.use(authenticate);
cartRouter.get('/',async(req,res,next)=>{try{res.json({success:true,data:await cartService.get(req.user!.id)});}catch(e){next(e)}});
cartRouter.post('/items',validate(addItem),async(req,res,next)=>{try{res.status(201).json({success:true,data:await cartService.addItem(req.user!.id,req.body.variantId,req.body.quantity)});}catch(e){next(e)}});
cartRouter.patch('/items/:variantId',validate(updateItem),async(req,res,next)=>{try{res.json({success:true,data:await cartService.setItemQuantity(req.user!.id,String(req.params.variantId),req.body.quantity)});}catch(e){next(e)}});
cartRouter.delete('/items/:variantId',validate(removeItem),async(req,res,next)=>{try{res.json({success:true,data:await cartService.removeItem(req.user!.id,String(req.params.variantId))});}catch(e){next(e)}});
