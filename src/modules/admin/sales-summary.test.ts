import { describe, it, expect } from 'vitest';
import { summarizeSales } from './sales-summary.js';

describe('sales summary', () => {
  it('returns real zeroes for an empty period', () => {
    expect(summarizeSales([])).toEqual({revenue:0,orders:0,averageOrderValue:0,unitsSold:0,series:[]});
  });
  it('groups by UTC order month and sums cents without decimal drift', () => {
    const summary = summarizeSales([
      {total:'0.10',createdAt:new Date('2026-01-31T23:59:59Z'),items:[{quantity:2}]},
      {total:'0.20',createdAt:new Date('2026-01-15T00:00:00Z'),items:[{quantity:1}]},
      {total:'12.00',createdAt:new Date('2026-02-01T00:00:00Z'),items:[{quantity:4}]},
    ]);
    expect(summary).toEqual({revenue:12.3,orders:3,averageOrderValue:4.1,unitsSold:7,series:[
      {month:'2026-01',revenue:0.3,orders:2},{month:'2026-02',revenue:12,orders:1},
    ]});
  });
});
