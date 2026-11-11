import {ChamperError,fail,operatorAction,poll,result,view,Target,Evidence,validateTarget,uuid} from '@/lib/champer-core';
import {redisStore} from '@/lib/champer-store';
import {equal,issueCookie,validCookie} from '@/lib/champer-auth';
import {callReceiver,receiverMode,receiverReady} from '@/lib/receiver';
import {prepareReport,reserveReport,confirmReport,ReportInput} from '@/lib/champer-report';
import {validateSubmission,Receipt} from '@/lib/lkh';
import {submitReport} from '@/lib/submission-service';
export const runtime='nodejs';
export const dynamic='force-dynamic';
export const maxDuration=120;
const origin='https://berlindo-lkh.vercel.app';
const headers={'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'};
function config(){return {url:process.env.CHAMPER_REDIS_URL||'',token:process.env.CHAMPER_REDIS_TOKEN||'',device:process.env.CHAMPER_DEVICE_TOKEN||'',pair:process.env.CHAMPER_TABLET_CODE||'',source:process.env.CHAMPER_SOURCE_ID||'',collector:process.env.CHAMPER_COLLECTOR_ID||''};}
function ready(){const c=config();return process.env.CHAMPER_CLOUD_ENABLED==='1'&&process.env.VERCEL_ENV==='production'&&receiverMode()==='production'&&receiverReady()&&!!c.url&&!!c.token&&c.device.length>=32&&c.pair.length>=24&&!!c.source&&!!c.collector;}
function tablet(r:Request){const value=(r.headers.get('cookie')||'').split(';').map(s=>s.trim()).find(s=>s.startsWith('champer_tablet='))?.slice(15)||'';if(!validCookie(value,config().pair))fail('TABLET_PAIRING_REQUIRED',401);}
function device(r:Request){if(!equal(r.headers.get('authorization')||'','Bearer '+config().device))fail('DEVICE_UNAUTHORIZED',401);}
const store=()=>redisStore(config().url,config().token,'berlindo:champer:pilot:v1');
async function selectedTarget(input:Record<string,unknown>){
 const t=input.target as Target;validateTarget(t);
 const [data,master]=await Promise.all([callReceiver('leader',{action:'snapshot',phase:'targets',date:t.date,shift:t.shift,line:t.line},65000),callReceiver('master',{})]);
 const snapshot=data.workspace;
 if(!snapshot?.ok||snapshot.data?.date!==t.date||String(snapshot.data.shift)!==t.shift||!Array.isArray(snapshot.data.targets))fail('TARGET_UNAVAILABLE',503);
 const line=snapshot.data.targets.find((x:{line:string})=>x.line===t.line);
 const item=line?.items?.find((x:{machine:string;part:string})=>x.machine===t.machine&&x.part===t.part);
 if(!item||line.version!==t.version||item.targetQty!==t.targetQty)fail('TARGET_CHANGED_RELOAD');
 const mapping=master.mapping?.LINE_99;
 if(!mapping?.mesin_part_mapping?.['AUTO CHAMPER']?.options?.includes(t.part)||!Array.isArray(input.operators)||!(input.operators as unknown[]).every(o=>typeof o==='string'&&o!=='__other_option__'&&mapping.operators.includes(o)))fail('MASTER_CHANGED_RELOAD');
}
async function handle(r:Request){
 try{
  const path=new URL(r.url).pathname.split('/').at(-1);
  if(r.method==='GET'&&path==='capabilities')return Response.json({enabled:!!ready(),machine:'AUTO_CHAMPER',mode:'PLC_PILOT',reportsEnabled:ready()&&process.env.CHAMPER_REPORT_ENABLED==='1',plcWrites:false,productionUsable:false},{headers});
  if(!ready())fail('CLOUD_BRIDGE_NOT_CONFIGURED',503);
  if(r.method==='GET'&&path==='state'){tablet(r);const state=await store().transaction(s=>view(s,Date.now()));return Response.json(state,{headers});}
  if(r.method!=='POST')fail('NOT_FOUND',404);
  if(!['pair','operator','poll','result','report'].includes(path||''))fail('NOT_FOUND',404);
  if(path==='poll'||path==='result')device(r);
  else {if(r.headers.get('origin')!==origin)fail('ORIGIN_NOT_ALLOWED',403);if(path!=='pair')tablet(r);}
  if(r.headers.get('content-type')?.split(';')[0]!=='application/json')fail('JSON_REQUIRED',415);
  const raw=await r.text();if(Buffer.byteLength(raw)>16000)fail('BODY_TOO_LARGE',413);
  let b:Record<string,unknown>;try{b=JSON.parse(raw);}catch{fail('INVALID_JSON',400);}
  if(!b||typeof b!=='object'||Array.isArray(b))fail('INVALID_JSON',400);
  if(path==='report'){
   if(process.env.CHAMPER_REPORT_ENABLED!=='1')fail('REPORT_BRIDGE_NOT_ENABLED',503);
   const input=b as unknown as ReportInput;
   const prepared=await store().transaction(s=>({payload:prepareReport(s,input),existing:s.jobs.find(j=>j.id===input.jobId)?.report}));
   if(prepared.existing?.state==='QUEUED')return Response.json({ok:true,report:prepared.existing},{headers});
   if(!prepared.existing){
    const master=await callReceiver('master',{});
    const errors=validateSubmission(prepared.payload,master.mapping);
    if(errors.length)return Response.json({ok:false,error:errors.join(' ')},{status:400,headers});
   }
   const reserved=await store().transaction(s=>reserveReport(s,input,prepared.payload));
   if(reserved.state==='QUEUED')return Response.json({ok:true,report:reserved},{headers});
   const sent=await submitReport(reserved.payload,true,'production',callReceiver);
   if(!sent.body.ok)return Response.json(sent.body,{status:sent.status,headers});
   const report=await store().transaction(s=>confirmReport(s,input.jobId,sent.body.receipt as Receipt));
   return Response.json({ok:true,report},{headers});
  }
  if(path==='pair'){
   // Pairing code has 96+ bits of entropy; never sent in URLs or returned to browser.
   if(typeof b.code!=='string'||!equal(b.code,config().pair))fail('PAIRING_CODE_INVALID',401);
   return Response.json({ok:true},{headers:{...headers,'Set-Cookie':'champer_tablet='+issueCookie(config().pair)+'; HttpOnly; Secure; SameSite=Strict; Path=/api/champer; Max-Age=28800'}});
  }
  if(path==='operator'){
   // Confirm accepted retries before checking a target that may since have changed.
   if(b.action==='prepare'){
    const prior=await store().transaction(s=>typeof b.requestId==='string'&&Object.hasOwn(s.requests,b.requestId)?operatorAction(s,b,Date.now()):null);
    if(prior)return Response.json({ok:true,job:prior},{headers});
    await selectedTarget(b);
   }
   const j=await store().transaction(s=>operatorAction(s,b,Date.now()));return Response.json({ok:true,job:j},{headers});
  }
  if(b.sourceId!==config().source)fail('SOURCE_MISMATCH',403);
  if(path==='poll'){
   if(typeof b.ready!=='boolean'||!uuid(b.instanceId))fail('INVALID_READY',400);
   const owner=b.instanceId,source=String(b.sourceId),isReady=b.ready;
   const command=await store().transaction(s=>poll(s,owner,source,isReady,Date.now()));return Response.json({command,serverTime:Date.now()},{headers});
  }
  if(!uuid(b.commandId)||!uuid(b.lease))fail('INVALID_COMMAND',400);
  const payload={commandId:b.commandId,lease:b.lease,evidence:b.evidence as Evidence};
  const answer=await store().transaction(s=>result(s,payload,Date.now(),config().collector));return Response.json(answer,{headers});
 }catch(e){const known=e instanceof ChamperError;return Response.json({ok:false,error:known?e.message:'SERVICE_UNAVAILABLE_RETRY_SAME_ID'},{status:known?e.status:503,headers});}
}
export const GET=handle;
export const POST=handle;
