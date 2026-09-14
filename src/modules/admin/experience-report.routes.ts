import {Router} from 'express';
import {prisma} from '../../database/prisma.js';
import {experienceReportQuery,experienceReportWhere} from './experience-report.schema.js';
export const experienceReportRouter=Router();
// Mounted after the parent reports router's ADMIN authentication middleware.
experienceReportRouter.get('/',async(req,res,next)=>{try{
 const query=experienceReportQuery.parse(req.query),where=experienceReportWhere(query);
 const distributionQuery=prisma.experienceReview.groupBy({where,by:['overallRating'],orderBy:{overallRating:'asc'},_count:{_all:true}});
 const [reviews,aggregate,distribution]=await prisma.$transaction([
  prisma.experienceReview.findMany({where,skip:(query.page-1)*query.limit,take:query.limit,orderBy:[{createdAt:'desc'},{id:'asc'}],select:{id:true,orderId:true,overallRating:true,deliveryRating:true,checkoutRating:true,comment:true,createdAt:true,user:{select:{email:true,profile:{select:{firstName:true,lastName:true}}}}}}),
  prisma.experienceReview.aggregate({where,_avg:{overallRating:true,deliveryRating:true,checkoutRating:true},_count:{_all:true,deliveryRating:true,checkoutRating:true}}),
  distributionQuery,
 ]);
 const total=aggregate._count._all;
 res.json({success:true,data:{totalReviews:total,averageRating:aggregate._avg.overallRating,averageDeliveryRating:aggregate._avg.deliveryRating,averageCheckoutRating:aggregate._avg.checkoutRating,deliveryResponses:aggregate._count.deliveryRating,checkoutResponses:aggregate._count.checkoutRating,ratingDistribution:distribution.map(row=>({rating:row.overallRating,count:row._count._all})),reviews,pagination:{page:query.page,limit:query.limit,total,totalPages:Math.ceil(total/query.limit)}}});
}catch(error){next(error);}});
