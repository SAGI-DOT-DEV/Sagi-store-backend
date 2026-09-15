import { it, expect, vi } from 'vitest';
vi.mock('../../database/prisma.js',()=>({prisma:{session:{findUnique:vi.fn()}}}));
vi.mock('../../config/env.js',()=>({env:{}}));
vi.mock('./email-verification.service.js',()=>({sendUserVerificationEmail:vi.fn()}));
import { AuthService } from './auth.service.js';
import { prisma } from '../../database/prisma.js';
it('missing refresh tokens return authentication errors before touching the database',async()=>{
  for(const value of [undefined,null,'','  ']) {
    await expect(new AuthService().rotate(value as unknown as string)).rejects.toMatchObject({statusCode:401,code:'UNAUTHENTICATED'});
  }
  expect(prisma.session.findUnique).not.toHaveBeenCalled();
});
