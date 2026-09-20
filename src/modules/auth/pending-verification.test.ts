import { beforeEach, expect, it, vi } from 'vitest';
vi.mock('bcrypt',()=>({default:{compare:vi.fn()}}));
vi.mock('../../database/prisma.js',()=>({prisma:{user:{findUnique:vi.fn()},pendingUserRegistration:{findUnique:vi.fn(),updateMany:vi.fn()}}}));
vi.mock('../../config/env.js',()=>({env:{}}));
vi.mock('./email-verification.service.js',()=>({sendUserVerificationEmail:vi.fn()}));
import bcrypt from 'bcrypt';
import { prisma } from '../../database/prisma.js';
import { AuthService } from './auth.service.js';
import { resendVerification } from './pending-verification.service.js';
import { sendUserVerificationEmail } from './email-verification.service.js';
const pending={id:'pending-1',email:'test@example.com',passwordHash:'hash',firstName:'Ada',tokenHash:'old-token',expiresAt:new Date(0)};
beforeEach(()=>{
 vi.resetAllMocks();
 vi.mocked(prisma.user.findUnique).mockResolvedValue(null);
 vi.mocked(prisma.pendingUserRegistration.findUnique).mockResolvedValue(pending as never);
 vi.mocked(bcrypt.compare).mockResolvedValue(true as never);
 vi.mocked(prisma.pendingUserRegistration.updateMany).mockResolvedValue({count:1});
 vi.mocked(sendUserVerificationEmail).mockResolvedValue(true);
});
it('returns the verification message for correct pending credentials, even after link expiry',async()=>{
 await expect(new AuthService().login('TEST@example.com','password')).rejects.toMatchObject({code:'EMAIL_VERIFICATION_REQUIRED',statusCode:403,message:'Please verify your email before signing in'});
 expect(sendUserVerificationEmail).not.toHaveBeenCalled();
});
it('does not reveal pending registration on a wrong password',async()=>{
 vi.mocked(bcrypt.compare).mockResolvedValue(false as never);
 await expect(new AuthService().login('test@example.com','wrong')).rejects.toMatchObject({code:'UNAUTHENTICATED'});
 await expect(resendVerification('test@example.com','wrong')).rejects.toMatchObject({code:'UNAUTHENTICATED'});
 expect(prisma.pendingUserRegistration.updateMany).not.toHaveBeenCalled();
 expect(sendUserVerificationEmail).not.toHaveBeenCalled();
});
it('resends a fresh token without overwriting profile or password',async()=>{
 expect(await resendVerification('test@example.com','password')).toEqual({verificationEmailSent:true});
 const update=vi.mocked(prisma.pendingUserRegistration.updateMany).mock.calls[0][0]!;
 expect(Object.keys(update.data).sort()).toEqual(['expiresAt','tokenHash']);
 expect(update.data.tokenHash).not.toBe('old-token');
 expect(sendUserVerificationEmail).toHaveBeenCalledWith(expect.objectContaining({email:pending.email,firstName:'Ada',token:expect.any(String)}));
});
it('reports delivery failure honestly',async()=>{
 vi.mocked(sendUserVerificationEmail).mockResolvedValue(false);
 expect(await resendVerification('test@example.com','password')).toEqual({verificationEmailSent:false});
});
it('handles a registration verified or resent concurrently without sending',async()=>{
 vi.mocked(prisma.pendingUserRegistration.updateMany).mockResolvedValue({count:0});
 await expect(resendVerification('test@example.com','password')).rejects.toMatchObject({code:'VERIFICATION_CHANGED'});
 expect(sendUserVerificationEmail).not.toHaveBeenCalled();
});
