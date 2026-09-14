import {z} from 'zod';
export const experienceReportQuery=z.object({from:z.coerce.date().optional(),to:z.coerce.date().optional(),page:z.coerce.number().int().positive().max(100000).default(1),limit:z.coerce.number().int().positive().max(100).default(10)}).refine(q=>!q.from||!q.to||q.from<q.to,'From must be before to.');
export function experienceReportWhere(query:z.infer<typeof experienceReportQuery>){return {...(query.from||query.to?{createdAt:{...(query.from?{gte:query.from}:{}),...(query.to?{lt:query.to}:{})}}:{})};}
