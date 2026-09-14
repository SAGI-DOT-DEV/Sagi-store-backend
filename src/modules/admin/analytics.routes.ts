import {Router} from 'express';
import {authenticate,authorize} from '../../core/middleware/auth.js';
import {analyticsQuery,getAnalytics} from './analytics.service.js';
export const analyticsRouter=Router();
analyticsRouter.use(authenticate,authorize('ADMIN'));
analyticsRouter.get('/',async(req,res,next)=>{try{const {days}=analyticsQuery.parse(req.query);res.setHeader('Cache-Control','no-store');res.json({success:true,data:await getAnalytics(days)});}catch(error){next(error);}});
