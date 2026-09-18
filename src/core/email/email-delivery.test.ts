import { afterEach, expect, it, vi } from 'vitest';
import { deliverEmail, emailConfigSchema } from './email-delivery.js';
const message={to:'customer@example.com',subject:'Verify',text:'Verify your email',html:'<p>Verify</p>'};
const config=emailConfigSchema.parse({EMAIL_PROVIDER:'resend',RESEND_API_KEY:'test-key',EMAIL_FROM:'SAGI <mail@example.com>'});
afterEach(()=>{vi.unstubAllGlobals();vi.useRealTimers();});
it('sends existing templates over HTTPS with idempotency and returns provider ID',async()=>{
  const fetcher=vi.fn().mockResolvedValue(new Response(JSON.stringify({id:'email-123'})));
  vi.stubGlobal('fetch',fetcher);
  await expect(deliverEmail(message,'log-123',config)).resolves.toEqual({messageId:'email-123'});
  const [url,options]=fetcher.mock.calls[0];
  expect(url).toBe('https://api.resend.com/emails');
  expect(options.headers['Idempotency-Key']).toBe('log-123');
  expect(JSON.parse(options.body)).toMatchObject({...message,to:[message.to],from:config.EMAIL_FROM});
});
it('rejects missing credentials before a network call',async()=>{
  const fetcher=vi.fn();vi.stubGlobal('fetch',fetcher);
  await expect(deliverEmail(message,'key',{...config,RESEND_API_KEY:''})).rejects.toThrow('not configured');
  expect(fetcher).not.toHaveBeenCalled();
});
it.each([401,403,429,500])('handles HTTP %s without exposing provider body',async status=>{
  vi.stubGlobal('fetch',vi.fn().mockResolvedValue(new Response('sensitive provider body',{status})));
  await expect(deliverEmail(message,'key',config)).rejects.toThrow(`HTTP ${status}`);
});
it('rejects malformed success responses',async()=>{
  vi.stubGlobal('fetch',vi.fn().mockResolvedValue(new Response('{}')));
  await expect(deliverEmail(message,'key',config)).rejects.toThrow('invalid response');
});
it('aborts stalled requests within configured timeout',async()=>{
  vi.useFakeTimers();
  vi.stubGlobal('fetch',vi.fn((_url,options)=>new Promise((_,reject)=>options.signal.addEventListener('abort',()=>reject(new Error('aborted'))))));
  const assertion=expect(deliverEmail(message,'key',config)).rejects.toThrow('timed out');
  await vi.advanceTimersByTimeAsync(10000);await assertion;
});
