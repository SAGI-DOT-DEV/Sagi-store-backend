import {z} from 'zod';
import {OrderStatus,type Prisma} from '@prisma/client';
export const adminOrdersQuery=z.object({q:z.string().trim().max(200).optional(),status:z.nativeEnum(OrderStatus).optional(),page:z.coerce.number().int().positive().max(100000).default(1),limit:z.coerce.number().int().positive().max(100).default(20)});
export function adminOrdersWhere(query:z.infer<typeof adminOrdersQuery>):Prisma.OrderWhereInput{
 return {...(query.status?{status:query.status}:{}),...(query.q?{OR:[{id:{contains:query.q,mode:'insensitive'}},{user:{email:{contains:query.q,mode:'insensitive'}}},{user:{profile:{firstName:{contains:query.q,mode:'insensitive'}}}},{user:{profile:{lastName:{contains:query.q,mode:'insensitive'}}}}]}:{})};
}
export const adminOrderSelect={id:true,status:true,currency:true,total:true,createdAt:true,user:{select:{email:true,profile:{select:{firstName:true,lastName:true,phone:true}}}},_count:{select:{items:true}},items:{select:{id:true,name:true,quantity:true,variant:{select:{product:{select:{name:true}}}}}}} satisfies Prisma.OrderSelect;
export const adminOrderDetailSelect={...adminOrderSelect,subtotal:true,shippingAmount:true,shippingCarrier:true,shippingService:true,
 address:{select:{line1:true,line2:true,city:true,state:true,country:true,postalCode:true}},
 items:{select:{id:true,name:true,sku:true,quantity:true,unitPrice:true,variant:{select:{product:{select:{images:{orderBy:{position:'asc'},take:1,select:{url:true}}}}}}}},
 histories:{orderBy:{createdAt:'asc'},select:{id:true,previousStatus:true,newStatus:true,createdAt:true}},
 payments:{orderBy:{createdAt:'desc'},select:{id:true,status:true,amount:true,currency:true,provider:true,transactionReference:true,createdAt:true}},
} satisfies Prisma.OrderSelect;
