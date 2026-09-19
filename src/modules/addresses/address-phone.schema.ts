import { z } from 'zod';

// Empty strings allow customers to clear an optional number when editing.
export const addressPhoneSchema = z.string().trim().max(30).refine(value =>
  value === '' || (/^\+?[\d\s().-]+$/.test(value) && value.replace(/\D/g, '').length >= 7 && value.replace(/\D/g, '').length <= 15),
  'Enter a valid phone number with 7–15 digits'
).nullable().optional();
