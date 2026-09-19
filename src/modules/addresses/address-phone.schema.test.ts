import { describe, expect, it } from 'vitest';
import { addressPhoneSchema } from './address-phone.schema.js';

describe('address phone numbers', () => {
  it('preserves legacy addresses and allows clearing the second phone', () => {
    for (const value of [undefined, null, '']) expect(addressPhoneSchema.safeParse(value).success).toBe(true);
  });
  it('accepts formatted international numbers', () => {
    for (const value of ['+234 803 123 4567', '+1 (416) 555-1234']) expect(addressPhoneSchema.safeParse(value).success).toBe(true);
  });
  it('rejects invalid numbers', () => {
    for (const value of ['abc', '123', '+1234567890123456', '1234567<script>']) expect(addressPhoneSchema.safeParse(value).success).toBe(false);
  });
});
