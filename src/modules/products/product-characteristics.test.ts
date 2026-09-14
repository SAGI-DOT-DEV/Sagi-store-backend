import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { productCharacteristics } from './product-characteristics.schema.js';

const schema = z.object(productCharacteristics);
describe('optional product characteristics', () => {
  it('allows existing products without details', () => expect(schema.parse({})).toEqual({}));
  it('trims values', () => expect(schema.parse({origin:' Ogun ',highlights:[' Unpolished ']})).toEqual({origin:'Ogun',highlights:['Unpolished']}));
  it('allows clearing values', () => {
    expect(schema.parse({origin:' ',highlights:[]})).toEqual({origin:null,highlights:[]});
    expect(schema.parse({origin:null})).toEqual({origin:null});
  });
  it('rejects oversized or blank highlights', () => {
    for (const highlights of [[' '], ['a'.repeat(41)], Array(6).fill('Natural')]) expect(schema.safeParse({highlights}).success).toBe(false);
    expect(schema.safeParse({origin:'a'.repeat(151)}).success).toBe(false);
  });
});
