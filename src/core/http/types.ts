import type { Role } from '@prisma/client';
export interface AuthUser { id:string; role:Role; email:string }
declare global { namespace Express { interface Request { requestId:string; user?:AuthUser } } }
