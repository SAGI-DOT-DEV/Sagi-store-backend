import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../../database/prisma.js';
import { authenticate } from '../../core/middleware/auth.js';
import { NotFoundError, ValidationError } from '../../core/errors/app-error.js';
import { validate } from '../../core/middleware/validate.js';
import { env } from '../../config/env.js';

const requestSchema=z.object({body:z.object({addressId:z.string().cuid()}),params:z.object({}),query:z.object({})});
export const shippingRouter=Router();
shippingRouter.post('/rates',authenticate,validate(requestSchema),async(req,res,next)=>{try{
 if(!env.SHIPPO_API_KEY)throw new ValidationError('Shippo is not configured');
 const [address,settings,cart]=await Promise.all([
  prisma.address.findFirst({where:{id:req.body.addressId,userId:req.user!.id}}),
  prisma.shippingSettings.findUnique({where:{id:'default'}}),
  prisma.cart.findUnique({where:{userId:req.user!.id},include:{items:{include:{variant:{include:{product:true}}}}}})
 ]);
 if(!address)throw new NotFoundError('Address not found');
 if(!settings)throw new ValidationError('Shipping warehouse settings are not configured');
 if(!cart?.items.length)throw new NotFoundError('Cart is empty');
 const subtotal=cart.items.reduce((sum,item)=>sum+Number(item.variant.price)*item.quantity,0);
 const free= settings.freeShippingThreshold!==null && subtotal>=Number(settings.freeShippingThreshold);
 if(free){res.json({success:true,data:{subtotal,currency:settings.currency,freeShippingEligible:true,rates:[{id:'free-shipping',carrier:'SAGI',service:'Free Shipping',amount:'0.00',currency:settings.currency}]}});return;}
 const parcels=cart.items.map(item=>({length:Number(item.variant.lengthCm??10),width:Number(item.variant.widthCm??10),height:Number(item.variant.heightCm??10),distance_unit:'cm',weight:Math.max(0.1,Number(item.variant.weightGrams??500)*item.quantity/1000),mass_unit:'kg'}));
 const response=await fetch('https://api.goshippo.com/shipments',{method:'POST',headers:{Authorization:`ShippoToken ${env.SHIPPO_API_KEY}`,'Content-Type':'application/json'},body:JSON.stringify({address_from:{name:settings.shipFromName,company:settings.shipFromCompany||undefined,street1:settings.shipFromStreet1,street2:settings.shipFromStreet2||undefined,city:settings.shipFromCity,state:settings.shipFromState||undefined,zip:settings.shipFromPostalCode,country:settings.shipFromCountry,phone:settings.shipFromPhone||undefined,email:settings.shipFromEmail||undefined},address_to:{street1:address.line1,street2:address.line2||undefined,city:address.city,state:address.state||undefined,zip:address.postalCode,country:address.country},parcels,async:false,object_purpose:'PURCHASE'})});
 if(!response.ok)throw new ValidationError(`Shippo rate request failed (${response.status})`);
 const shipment:any=await response.json();
 const rates=(shipment.rates??[]).filter((r:any)=>r.object_id&&r.amount!==undefined).map((r:any)=>({id:r.object_id,carrier:r.provider,service:r.servicelevel?.name??r.service??'Standard',serviceToken:r.servicelevel?.token??null,amount:r.amount,currency:String(r.currency??settings.currency).toUpperCase(),estimatedDays:r.estimated_days??null,durationTerms:r.duration_terms??null,attributes:Array.isArray(r.attributes)?r.attributes:[]})).sort((a:any,b:any)=>Number(a.amount)-Number(b.amount));
 const bestRate=rates.find((rate:any)=>rate.attributes.includes('BESTVALUE')||rate.attributes.includes('CHEAPEST'))??rates[0]??null;
 res.json({success:true,data:{subtotal,currency:settings.currency,freeShippingEligible:false,shipmentId:shipment.object_id,bestRate,rates}});
}catch(error){next(error)}});
