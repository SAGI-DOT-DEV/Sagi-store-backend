import {it,expect} from 'vitest';
import {experienceReportQuery,experienceReportWhere} from './experience-report.schema.js';
it('defaults to all dates with bounded pagination',()=>{const q=experienceReportQuery.parse({});expect(q.limit).toBe(10);expect(q.page).toBe(1);expect(experienceReportWhere(q)).toEqual({});});
it('uses an inclusive start and exclusive end',()=>{const q=experienceReportQuery.parse({from:'2026-09-01',to:'2026-09-13'});expect(experienceReportWhere(q)).toEqual({createdAt:{gte:q.from,lt:q.to}});});
it('rejects invalid ranges, dates and pagination',()=>{for(const q of [{from:'bad'},{from:'2026-09-13',to:'2026-09-01'},{page:0},{limit:101}])expect(experienceReportQuery.safeParse(q).success).toBe(false);});
