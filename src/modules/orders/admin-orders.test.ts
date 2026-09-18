import {describe,it,expect} from 'vitest';
import {adminOrdersQuery,adminOrdersWhere,adminOrderSelect,adminOrderDetailSelect} from './admin-orders.schema.js';
describe('admin orders query',()=>{
 it('includes quantities, saved names and linked product names in the ledger',()=>{expect(adminOrderSelect.items.select).toEqual({id:true,name:true,quantity:true,variant:{select:{product:{select:{name:true}}}}});});
 it('defaults to paginated all-customer orders',()=>{const query=adminOrdersQuery.parse({});expect(query.page).toBe(1);expect(query.limit).toBe(20);expect(adminOrdersWhere(query)).toEqual({});});
 it('filters status and searches customer and order fields',()=>{const where=adminOrdersWhere(adminOrdersQuery.parse({q:' test ',status:'PAID'}));expect(where.status).toBe('PAID');expect(where.OR).toHaveLength(4);expect(where.OR?.[0]).toEqual({id:{contains:'test',mode:'insensitive'}});});
 it('rejects invalid pagination and statuses',()=>{for(const input of [{page:0},{limit:101},{status:'UNKNOWN'},{q:'x'.repeat(201)}])expect(adminOrdersQuery.safeParse(input).success).toBe(false);});
 it('does not select authentication secrets or provider session IDs',()=>{const select=JSON.stringify([adminOrderSelect,adminOrderDetailSelect]);for(const field of ['passwordHash','sessions','checkoutSessionId','paymentIntentId'])expect(select).not.toContain(field);});
});
