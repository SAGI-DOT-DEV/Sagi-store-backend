import {describe,it,expect} from 'vitest';
import {adminCatalogQuery,adminCatalogWhere} from './admin-catalog.schema.js';
describe('admin catalog filters',()=>{
 it('does not restrict admin catalog to active products',()=>expect(adminCatalogWhere(adminCatalogQuery.parse({}))).toEqual({}));
 it('applies explicit status and searches SKU/name/description',()=>{
   const where=adminCatalogWhere(adminCatalogQuery.parse({q:' Rice ',status:'DRAFT'}));
   expect(where.status).toBe('DRAFT');expect(where.OR).toHaveLength(3);
   expect(where.OR?.[0]).toEqual({name:{contains:'Rice',mode:'insensitive'}});
 });
 it('bounds pagination and rejects invalid statuses',()=>{
   for(const query of [{page:0},{limit:101},{status:'ALL'},{q:'a'.repeat(201)}])expect(adminCatalogQuery.safeParse(query).success).toBe(false);
   expect(adminCatalogQuery.parse({page:'2'}).page).toBe(2);
 });
});
