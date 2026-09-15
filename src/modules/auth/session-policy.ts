import type { CookieOptions } from 'express';
export function refreshCookieOptions(production: boolean): CookieOptions {
  return { httpOnly: true, secure: production, sameSite: 'lax', path: '/api/v1/auth' };
}
export function isAllowedAuthOrigin(origin: string | undefined, fetchSite: string | undefined, appUrl: string, corsOrigins: string) {
  // Postman/CLI may omit Origin; browser requests must not bypass the check.
  if (!origin) return !fetchSite;
  return [new URL(appUrl).origin, ...corsOrigins.split(',').map(value => value.trim())].includes(origin);
}
