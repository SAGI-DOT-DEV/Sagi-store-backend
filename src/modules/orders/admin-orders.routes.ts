import {Router} from 'express';
import {z} from 'zod';
import {prisma} from '../../database/prisma.js';
import {authenticate,authorize} from '../../core/middleware/auth.js';
import {NotFoundError} from '../../core/errors/app-error.js';
import {adminOrdersQuery,adminOrdersWhere,adminOrderSelect,adminOrderDetailSelect} from './admin-orders.schema.js';
export const adminOrdersRouter=Router();
adminOrdersRouter.use(authenticate,authorize('ADMIN'));
adminOrdersRouter.get('/',async(req,res,next)=>{try{
 const query=adminOrdersQuery.parse(req.query),where=adminOrdersWhere(query);
 const [items,total]=await prisma.$transaction([prisma.order.findMany({where,select:adminOrderSelect,orderBy:[{createdAt:'desc'},{id:'asc'}],skip:(query.page-1)*query.limit,take:query.limit}),prisma.order.count({where})]);
 res.json({success:true,data:{items,pagination:{page:query.page,limit:query.limit,total,totalPages:Math.ceil(total/query.limit)}}});
}catch(error){next(error);}});
adminOrdersRouter.get('/:id',async(req,res,next)=>{try{
 const id=z.string().cuid().parse(req.params.id);
 const order=await prisma.order.findUnique({where:{id},select:adminOrderDetailSelect});
 if(!order)throw new NotFoundError('Order not found');
 res.json({success:true,data:order});
}catch(error){next(error);}});
