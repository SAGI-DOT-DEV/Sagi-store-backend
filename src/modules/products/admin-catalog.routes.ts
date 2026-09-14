import {Router} from 'express';
import {z} from 'zod';
import {prisma} from '../../database/prisma.js';
import {authenticate,authorize} from '../../core/middleware/auth.js';
import {NotFoundError} from '../../core/errors/app-error.js';
import {adminCatalogQuery,adminCatalogWhere,adminProductInclude} from './admin-catalog.schema.js';

export const adminCatalogRouter=Router();
adminCatalogRouter.use(authenticate,authorize('ADMIN'));
adminCatalogRouter.get('/',async(req,res,next)=>{
  try {
    const query=adminCatalogQuery.parse(req.query);
    const where=adminCatalogWhere(query);
    const [items,total]=await prisma.$transaction([
      prisma.product.findMany({where,include:adminProductInclude,orderBy:[{[query.sort]:query.order},{id:'asc'}],skip:(query.page-1)*query.limit,take:query.limit}),
      prisma.product.count({where}),
    ]);
    res.json({success:true,data:{items,pagination:{page:query.page,limit:query.limit,total,totalPages:Math.ceil(total/query.limit)}}});
  }catch(error){next(error);}
});
adminCatalogRouter.get('/:id',async(req,res,next)=>{
  try {
    const id=z.string().cuid().parse(req.params.id);
    const product=await prisma.product.findUnique({where:{id},include:adminProductInclude});
    if(!product)throw new NotFoundError('Product not found');
    res.json({success:true,data:product});
  }catch(error){next(error);}
});
