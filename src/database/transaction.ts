import { Prisma } from '@prisma/client';

/** Retries PostgreSQL serialization/deadlock aborts; all other failures surface immediately. */
export async function retryWriteConflict<T>(operation:()=>Promise<T>,maxAttempts=3):Promise<T>{
 for(let attempt=1;;attempt++){
  try{return await operation();}
  catch(error){
   if(!(error instanceof Prisma.PrismaClientKnownRequestError)||error.code!=='P2034'||attempt>=maxAttempts)throw error;
   await new Promise(resolve=>setTimeout(resolve,25*attempt));
  }
 }
}
