import type { RequestHandler } from 'express'; import { randomUUID } from 'node:crypto';
export const requestId:RequestHandler=(req,res,next)=>{req.requestId=req.header('x-request-id')??`req_${randomUUID()}`;res.setHeader('x-request-id',req.requestId);next();};
