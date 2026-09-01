import { createCipheriv,createHash,randomBytes } from 'node:crypto';
import { spawn } from 'node:child_process';
import { createReadStream,createWriteStream } from 'node:fs';
import { mkdtemp,rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pipeline } from 'node:stream/promises';
import cron from 'node-cron';
import { google } from 'googleapis';
import { env } from '../../config/env.js';
import { prisma } from '../../database/prisma.js';
import { logger } from '../../core/logger/logger.js';

type BackupInput={source:'MANUAL'|'SCHEDULED';actorId?:string};

function configuration(){
 if(!env.GOOGLE_DRIVE_FOLDER_ID||!env.GOOGLE_SERVICE_ACCOUNT_JSON_BASE64||!env.BACKUP_ENCRYPTION_KEY_BASE64)throw new Error('Backup storage is not configured');
 const key=Buffer.from(env.BACKUP_ENCRYPTION_KEY_BASE64,'base64');
 if(key.length!==32)throw new Error('BACKUP_ENCRYPTION_KEY_BASE64 must decode to 32 bytes');
 return {key,credentials:JSON.parse(Buffer.from(env.GOOGLE_SERVICE_ACCOUNT_JSON_BASE64,'base64').toString('utf8'))};
}

function dumpDatabase(destination:string){return new Promise<void>((resolve,reject)=>{const child=spawn('pg_dump',['--format=custom','--no-owner','--no-privileges',`--file=${destination}`,env.DATABASE_URL],{stdio:['ignore','ignore','pipe']});child.stderr.resume();child.on('error',()=>reject(new Error('pg_dump could not be started; install PostgreSQL client tools')));child.on('close',code=>code===0?resolve():reject(new Error(`pg_dump failed (exit ${code})`)));});}

async function checksum(path:string){const hash=createHash('sha256');for await(const chunk of createReadStream(path))hash.update(chunk);return hash.digest('hex');}

export class BackupService {
 async createBackup(input:BackupInput){
  const fileName=`sagi-${new Date().toISOString().replace(/[:.]/g,'-')}.dump.enc`;
  const backup=await prisma.backup.create({data:{source:input.source,initiatedById:input.actorId,fileName,status:'RUNNING'}});
  let directory:string|undefined;
  try{
   const {key,credentials}=configuration();
   directory=await mkdtemp(join(tmpdir(),'sagi-backup-'));
   const dump=join(directory,'database.dump');const encrypted=join(directory,fileName);
   await dumpDatabase(dump);
   const iv=randomBytes(12);const cipher=createCipheriv('aes-256-gcm',key,iv);
   await pipeline(createReadStream(dump),cipher,createWriteStream(encrypted));
   const authTag=cipher.getAuthTag();const hash=await checksum(encrypted);
   const auth=new google.auth.GoogleAuth({credentials,scopes:['https://www.googleapis.com/auth/drive.file']});
   const drive=google.drive({version:'v3',auth});
   const upload=await drive.files.create({requestBody:{name:fileName,parents:[env.GOOGLE_DRIVE_FOLDER_ID!],mimeType:'application/octet-stream',appProperties:{backupId:backup.id,checksumSha256:hash}},media:{mimeType:'application/octet-stream',body:createReadStream(encrypted)},fields:'id,size'});
   if(!upload.data.id)throw new Error('Google Drive did not return an uploaded file ID');
   const completed=await prisma.backup.update({where:{id:backup.id},data:{status:'SUCCEEDED',driveFileId:upload.data.id,sizeBytes:BigInt(upload.data.size??0),checksumSha256:hash,encryptionIv:iv.toString('base64'),encryptionAuthTag:authTag.toString('base64'),completedAt:new Date()}});
   await prisma.auditLog.create({data:{actorId:input.actorId,actorRole:input.actorId?'ADMIN':undefined,action:'DATABASE_BACKUP_SUCCEEDED',entityType:'Backup',entityId:backup.id,metadata:{source:input.source,driveFileId:upload.data.id}}});
   return completed;
  }catch(error){const message=error instanceof Error?error.message:'Unknown backup error';await prisma.backup.update({where:{id:backup.id},data:{status:'FAILED',errorMessage:message.slice(0,1000),completedAt:new Date()}});await prisma.auditLog.create({data:{actorId:input.actorId,actorRole:input.actorId?'ADMIN':undefined,action:'DATABASE_BACKUP_FAILED',entityType:'Backup',entityId:backup.id,metadata:{source:input.source}}});throw error;
  }finally{if(directory)await rm(directory,{recursive:true,force:true});}
 }
}

export const backupService=new BackupService();

export function scheduleBackups(){if(!env.BACKUP_ENABLED)return;if(!cron.validate(env.BACKUP_CRON))throw new Error('BACKUP_CRON is invalid');cron.schedule(env.BACKUP_CRON,()=>{void backupService.createBackup({source:'SCHEDULED'}).catch(error=>logger.error({err:error},'scheduled backup failed'));},{timezone:env.BACKUP_TIMEZONE});logger.info({cron:env.BACKUP_CRON,timezone:env.BACKUP_TIMEZONE},'database backups scheduled');}
