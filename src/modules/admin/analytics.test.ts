import {it,expect} from 'vitest';
import {analyticsQuery,analyticsConfigSchema,reportRows} from './analytics.service.js';
it('bounds analytics ranges and accepts numeric property IDs only',()=>{expect(analyticsQuery.parse({}).days).toBe('30');expect(analyticsQuery.safeParse({days:'3650'}).success).toBe(false);expect(analyticsConfigSchema.safeParse({GA4_PROPERTY_ID:'G-TEST'}).success).toBe(false);});
it('normalizes report metrics and handles empty reports',()=>{expect(reportRows({})).toEqual([]);expect(reportRows({rows:[{dimensionValues:[{value:'Canada'}],metricValues:[{value:'12'},{value:'NaN'}]}]})).toEqual([{label:'Canada',values:[12,0]}]);});
