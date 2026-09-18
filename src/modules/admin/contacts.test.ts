import {it,expect,vi} from 'vitest';
vi.mock('../../database/prisma.js',()=>({prisma:{user:{findMany:vi.fn().mockResolvedValue([])}}}));
import {prisma} from '../../database/prisma.js';
import {listAdminUsers} from './contacts.service.js';
it('reads only the public admin directory fields, without password or session data',async()=>{
 await expect(listAdminUsers()).resolves.toEqual([]);
 expect(prisma.user.findMany).toHaveBeenCalledWith({select:{id:true,email:true,role:true,createdAt:true,emailVerifiedAt:true,profile:{select:{firstName:true,lastName:true}}},orderBy:[{createdAt:'desc'},{id:'desc'}]});
});
