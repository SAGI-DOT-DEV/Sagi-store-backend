import {google,type analyticsdata_v1beta} from 'googleapis';
import {z} from 'zod';
import {AppError} from '../../core/errors/app-error.js';
export const analyticsQuery=z.object({days:z.enum(['7','30','90']).default('30')});
const credentialSchema=z.object({client_email:z.string().email(),private_key:z.string().min(1),type:z.literal('service_account')});
export const analyticsConfigSchema=z.object({GA4_ENABLED:z.enum(['true','false']).default('false'),GA4_PROPERTY_ID:z.string().regex(/^\d+$/).optional(),GA4_SERVICE_ACCOUNT_JSON_BASE64:z.string().optional()});
type Report=analyticsdata_v1beta.Schema$RunReportResponse;
export function reportRows(report:Report){return (report.rows??[]).map(row=>({label:row.dimensionValues?.[0]?.value??'',values:(row.metricValues??[]).map(metric=>{const value=Number(metric.value??0);return Number.isFinite(value)?value:0;})}));}
const definitions=[
 {key:'overview',dimensions:[],metrics:['activeUsers','sessions','screenPageViews','engagementRate']},
 {key:'daily',dimensions:['date'],metrics:['sessions','screenPageViews']},
 {key:'channels',dimensions:['sessionDefaultChannelGroup'],metrics:['sessions']},
 {key:'pages',dimensions:['pagePath'],metrics:['screenPageViews']},
 {key:'countries',dimensions:['country'],metrics:['activeUsers']},
 {key:'devices',dimensions:['deviceCategory'],metrics:['sessions']},
 {key:'events',dimensions:['eventName'],metrics:['eventCount']},
 {key:'products',dimensions:['itemName'],metrics:['itemsViewed','itemsAddedToCart','itemsPurchased']},
] as const;
async function fetchAnalytics(days:string){
 if(!process.env.GA4_ENABLED||process.env.GA4_ENABLED==='false')return {configured:false as const};
 const parsed=analyticsConfigSchema.safeParse(process.env);
 if(!parsed.success)throw new AppError('SERVICE_UNAVAILABLE',503,'Google Analytics configuration is invalid.');
 const config=parsed.data;
 if(config.GA4_ENABLED!=='true')return {configured:false as const};
 if(!config.GA4_PROPERTY_ID||!config.GA4_SERVICE_ACCOUNT_JSON_BASE64)throw new AppError('SERVICE_UNAVAILABLE',503,'Set GA4_PROPERTY_ID and GA4_SERVICE_ACCOUNT_JSON_BASE64 on the backend.');
 let credentials:z.infer<typeof credentialSchema>;
 try{credentials=credentialSchema.parse(JSON.parse(Buffer.from(config.GA4_SERVICE_ACCOUNT_JSON_BASE64,'base64').toString('utf8')));}catch{throw new AppError('SERVICE_UNAVAILABLE',503,'The analytics service account credentials are invalid.');}
 try{
  const auth=new google.auth.GoogleAuth({credentials,scopes:['https://www.googleapis.com/auth/analytics.readonly']});
  const client=google.analyticsdata({version:'v1beta',auth});
  const reports=await Promise.all(definitions.map(async definition=>{
   const response=await client.properties.runReport({property:`properties/${config.GA4_PROPERTY_ID}`,requestBody:{dateRanges:[{startDate:`${Number(days)-1}daysAgo`,endDate:'today'}],dimensions:definition.dimensions.map(name=>({name})),metrics:definition.metrics.map(name=>({name})),limit:definition.key==='daily'?'90':'10',
    ...(definition.key==='events'?{dimensionFilter:{filter:{fieldName:'eventName',inListFilter:{values:['view_item','add_to_cart','begin_checkout','purchase','search']}}}}:{}),
    ...(definition.key==='daily'?{orderBys:[{dimension:{dimensionName:'date'}}]}:definition.dimensions.length?{orderBys:[{metric:{metricName:definition.metrics[0]},desc:true}]}:{})}}, {timeout:15000});
   return [definition.key,{rows:reportRows(response.data),thresholded:response.data.metadata?.subjectToThresholding??false}] as const;
  }));
  return {configured:true as const,days:Number(days),fetchedAt:new Date().toISOString(),reports:Object.fromEntries(reports)};
 }catch{throw new AppError('ANALYTICS_UNAVAILABLE',502,'Unable to read Google Analytics. Check the Data API, property ID, and service account Viewer access, then retry.');}
}
type Result=Awaited<ReturnType<typeof fetchAnalytics>>;
const cache=new Map<string,{expires:number;data:Result}>(),pending=new Map<string,Promise<Result>>();
export async function getAnalytics(days:string){
 const hit=cache.get(days);if(hit&&hit.expires>Date.now())return hit.data;
 const running=pending.get(days);if(running)return running;
 const request=fetchAnalytics(days).then(data=>{if(data.configured)cache.set(days,{expires:Date.now()+300000,data});return data;}).finally(()=>pending.delete(days));pending.set(days,request);return request;
}
