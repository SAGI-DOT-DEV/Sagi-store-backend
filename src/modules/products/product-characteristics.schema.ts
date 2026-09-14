import { z } from 'zod';

export const productCharacteristics = {
  origin: z.string().trim().max(150).transform(value => value || null).nullable().optional(),
  highlights: z.array(z.string().trim().min(1).max(40)).max(5).optional(),
};
