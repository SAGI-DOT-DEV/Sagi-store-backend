import nodemailer from 'nodemailer';
import { z } from 'zod';

export const emailConfigSchema = z.object({
  EMAIL_PROVIDER: z.enum(['resend', 'gmail']).default('gmail'),
  RESEND_API_KEY: z.string().optional(),
  EMAIL_FROM: z.string().min(3),
  EMAIL_TIMEOUT_MS: z.coerce.number().int().min(1000).max(30000).default(10000),
  GMAIL_USER: z.string().optional(),
  GMAIL_APP_PASSWORD: z.string().optional(),
});
export type EmailConfig = z.infer<typeof emailConfigSchema>;
export interface EmailMessage { from?: string; to: string; subject: string; text: string; html: string; }

// No automatic fallback or retries: a timeout may occur after provider acceptance.
export async function deliverEmail(message: EmailMessage, idempotencyKey: string, config: EmailConfig): Promise<{messageId:string}> {
  if (config.EMAIL_PROVIDER === 'resend') {
    if (!config.RESEND_API_KEY?.trim()) throw new Error('Resend API key is not configured');
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), config.EMAIL_TIMEOUT_MS);
    try {
      const response = await fetch('https://api.resend.com/emails', {
        method: 'POST', redirect: 'error', signal: controller.signal,
        headers: { Authorization: `Bearer ${config.RESEND_API_KEY}`, 'Content-Type': 'application/json', 'Idempotency-Key': idempotencyKey },
        body: JSON.stringify({from:config.EMAIL_FROM,to:[message.to],subject:message.subject,text:message.text,html:message.html}),
      });
      if (!response.ok) throw new Error(`Email provider rejected the request (HTTP ${response.status}); check sender verification, API key and quota`);
      const result = z.object({id:z.string().min(1)}).safeParse(await response.json());
      if (!result.success) throw new Error('Email provider returned an invalid response');
      return {messageId:result.data.id};
    } catch (error) {
      if (controller.signal.aborted) throw new Error('Email delivery timed out; acceptance could not be confirmed');
      // Do not log provider bodies, credentials, recipient details, or token-bearing HTML.
      if (error instanceof Error && error.message.startsWith('Email provider')) throw error;
      throw new Error('Unable to reach the email provider');
    } finally { clearTimeout(timer); }
  }
  if (!config.GMAIL_USER || !config.GMAIL_APP_PASSWORD) throw new Error('Gmail is not configured');
  const transport = nodemailer.createTransport({service:'gmail',auth:{user:config.GMAIL_USER,pass:config.GMAIL_APP_PASSWORD.replaceAll(' ','')},connectionTimeout:config.EMAIL_TIMEOUT_MS,greetingTimeout:config.EMAIL_TIMEOUT_MS,socketTimeout:config.EMAIL_TIMEOUT_MS});
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const sent = await Promise.race([
      transport.sendMail({...message,from:config.EMAIL_FROM}),
      new Promise<never>((_,reject)=>{timer=setTimeout(()=>{transport.close();reject(new Error('Email delivery timed out'));},config.EMAIL_TIMEOUT_MS);}),
    ]);
    return {messageId:sent.messageId};
  } finally { if(timer)clearTimeout(timer);transport.close(); }
}

export function sendEmail(message: EmailMessage, idempotencyKey: string) {
  const config = emailConfigSchema.safeParse(process.env);
  if (!config.success) throw new Error('Email delivery configuration is invalid');
  return deliverEmail(message, idempotencyKey, config.data);
}
