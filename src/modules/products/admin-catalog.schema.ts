import {z} from 'zod';
import type {Prisma} from '@prisma/client';
export const adminCatalogQuery=z.object({
  q:z.string().trim().max(200).optional(),
  status:z.enum(['ACTIVE','DRAFT','ARCHIVED']).optional(),
  categoryId:z.string().cuid().optional(),
  page:z.coerce.number().int().positive().default(1),
  limit:z.coerce.number().int().positive().max(100).default(12),
  sort:z.enum(['createdAt','name']).default('createdAt'),
  order:z.enum(['asc','desc']).default('desc'),
});
export function adminCatalogWhere(query:z.infer<typeof adminCatalogQuery>):Prisma.ProductWhereInput {
  return {
    ...(query.status?{status:query.status}:{}),
    ...(query.categoryId?{categoryId:query.categoryId}:{}),
    ...(query.q?{OR:[
      {name:{contains:query.q,mode:'insensitive'}},
      {description:{contains:query.q,mode:'insensitive'}},
      {variants:{some:{sku:{contains:query.q,mode:'insensitive'}}}},
    ]}:{}),
  };
}
export const adminProductInclude = {category:true,images:{orderBy:{position:'asc'}},variants:{include:{inventory:true},orderBy:{price:'asc'}}} satisfies Prisma.ProductInclude;
