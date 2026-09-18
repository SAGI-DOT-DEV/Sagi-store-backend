import { beforeEach, it, expect, vi } from 'vitest';
vi.mock('../../core/email/email-delivery.js',()=>({sendEmail:vi.fn()}));
vi.mock('../../config/env.js',()=>({env:{APP_URL:'https://store.test',EMAIL_FROM:'SAGI <mail@example.com>'}}));
vi.mock('../../core/logger/logger.js',()=>({logger:{error:vi.fn(),warn:vi.fn()}}));
vi.mock('../../database/prisma.js',()=>({prisma:{emailLog:{create:vi.fn(),update:vi.fn()}}}));
import { sendEmail } from '../../core/email/email-delivery.js';
import { prisma } from '../../database/prisma.js';
import { sendUserVerificationEmail } from './email-verification.service.js';
beforeEach(()=>{vi.clearAllMocks();vi.mocked(prisma.emailLog.create).mockResolvedValue({id:'log-1'} as never);vi.mocked(prisma.emailLog.update).mockResolvedValue({} as never);});
it('records provider acceptance and retains verification URL without activating a user',async()=>{
  vi.mocked(sendEmail).mockResolvedValue({messageId:'accepted-1'});
  expect(await sendUserVerificationEmail({email:'customer@example.com',firstName:'Customer',token:'test-token'})).toBe(true);
  expect(sendEmail).toHaveBeenCalledWith(expect.objectContaining({to:'customer@example.com',text:expect.stringContaining('https://store.test/verify-email?token=test-token')}),'log-1');
  expect(prisma.emailLog.update).toHaveBeenCalledWith(expect.objectContaining({data:expect.objectContaining({status:'SENT',providerMessageId:'accepted-1'})}));
});
it('returns false and records FAILED on provider timeout',async()=>{
  vi.mocked(sendEmail).mockRejectedValue(new Error('Email delivery timed out'));
  expect(await sendUserVerificationEmail({email:'customer@example.com',firstName:'Customer',token:'test-token'})).toBe(false);
  expect(prisma.emailLog.update).toHaveBeenCalledWith(expect.objectContaining({data:expect.objectContaining({status:'FAILED',error:'Email delivery timed out'})}));
});
