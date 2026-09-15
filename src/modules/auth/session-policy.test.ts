import { it, expect } from 'vitest';
import { refreshCookieOptions, isAllowedAuthOrigin } from './session-policy.js';
it('uses matching host-only cookie settings for login, refresh and logout',()=>{
  expect(refreshCookieOptions(true)).toEqual({httpOnly:true,secure:true,sameSite:'lax',path:'/api/v1/auth'});
  expect(refreshCookieOptions(false).secure).toBe(false);
});
it('rejects hostile and missing browser origins, allows trusted origins and CLI',()=>{
  const check=(origin?:string,site?:string)=>isAllowedAuthOrigin(origin,site,'https://store.test','http://localhost:3001');
  expect(check('https://store.test')).toBe(true);
  expect(check('https://store.test.evil.test')).toBe(false);
  expect(check('null')).toBe(false);
  expect(check(undefined,'cross-site')).toBe(false);
  expect(check()).toBe(true);
});
