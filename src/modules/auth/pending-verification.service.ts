import bcrypt from 'bcrypt';
import { createHash, randomBytes } from 'node:crypto';
import { prisma } from '../../database/prisma.js';
import { AppError, AuthenticationError } from '../../core/errors/app-error.js';
import { sendUserVerificationEmail } from './email-verification.service.js';

export async function pendingCredentials(email: string, password: string) {
  const pending = await prisma.pendingUserRegistration.findUnique({where:{email:email.trim().toLowerCase()}});
  if (!pending || !await bcrypt.compare(password,pending.passwordHash)) throw new AuthenticationError('Invalid email or password');
  return pending;
}

export async function rejectPendingLogin(email: string, password: string): Promise<never> {
  await pendingCredentials(email,password);
  throw new AppError('EMAIL_VERIFICATION_REQUIRED',403,'Please verify your email before signing in');
}

export async function resendVerification(email: string, password: string) {
  const pending = await pendingCredentials(email,password);
  const token = randomBytes(32).toString('base64url');
  // Replace the token, not the saved password or profile. Expired registrations can retry.
  const updated = await prisma.pendingUserRegistration.updateMany({where:{id:pending.id,tokenHash:pending.tokenHash},data:{tokenHash:createHash('sha256').update(token).digest('hex'),expiresAt:new Date(Date.now()+86400000)}});
  if (!updated.count) throw new AppError('VERIFICATION_CHANGED',409,'Verification changed. Please try signing in again.');
  return {verificationEmailSent:await sendUserVerificationEmail({email:pending.email,firstName:pending.firstName,token})};
}
