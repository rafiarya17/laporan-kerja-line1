import {invalidateCardData,isTelegramCardPoll,readCardData} from '@/lib/telegram-card-cache';
import {targetProgress} from '@/lib/target-progress';
import {reviseApproved} from '@/lib/web-report-revision';
import {drainRevisionDelivery} from '@/lib/revision-delivery';
import {enrichPlanning,savePlanning} from '@/lib/leader-planning';
import {after} from 'next/server';
import {remapReviewPart,approveLine4,isLine4Decision,line4ReviewSnapshot,webReviewWorkspace} from '@/lib/line4-review';
import {productionReviewLines,requiresProductionReview,sqlDatabase,sqlSubmissionEnabled} from '@/lib/sql-intake';
import {drainSqlDelivery} from '@/lib/sql-delivery';
import {callReceiver, receiverMode, receiverReady} from '@/lib/receiver';
import {portalPreview,previewWorkspace,previewBlocked,previewHeaders} from '@/lib/portal-preview';
export const maxDuration=120;
const origins=new Set(['https://berlindo-miniapp-lab.smartboy1.chatgpt.site','https://berlindo-miniapp-lab.ardentacorn21.chatgpt.site','https://berlindo-lkh.vercel.app']);
function headers(r:Request){const h=new Headers({'Cache-Control':'no-store','Vary':'Origin'}),o=r.headers.get('origin');if(o&&origins.has(o)){h.set('Access-Control-Allow-Origin',o);h.set('Access-Control-Allow-Methods','POST, OPTIONS');h.set('Access-Control-Allow-Headers','Content-Type');}return h;}
export async function OPTIONS(r:Request){return new Response(null,{status:origins.has(r.headers.get('origin')||'')?204:403,headers:headers(r)});}
// Owner-requested no-login workspace. Origin checks are CSRF defense, not identity authentication.
// Receiver independently enforces pilot approval and versioned production correction boundaries.
function scheduleDelivery() {
 after(async () => {
  try { await drainSqlDelivery(); }
  catch { console.error('LINE4_APPROVED_DELIVERY_RETRY_REQUIRED'); }
 });
}
function validWebReviewScope({date,shift,line}:{date:unknown;shift:unknown;line:unknown}) {
 if(typeof date!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(date)||(shift!=='1'&&shift!=='2'))return false;
 const time=Date.parse(date+'T00:00:00Z');
 return Number.isFinite(time)&&new Date(time).toISOString().slice(0,10)===date&&(line===''||line==='LINE_99'||requiresProductionReview(line));
}
export async function POST(r:Request){
 if(portalPreview()){
  try{
   const b=await r.json();if(b.action!=='snapshot')return previewBlocked();
   if(b.phase==='target-progress'){
    const shifts=b.shift==='all'?['1','2']:[b.shift];
    const reports=shifts.flatMap(shift=>previewWorkspace(b.date,shift,b.line).data.reports
     .filter(r=>!b.line||r.line===b.line).map(r=>({...r,workspaceShift:shift})));
    return Response.json({ok:true,data:{date:b.date,shift:b.shift,reportLine:b.line||'',reports}},{headers:previewHeaders});
   }
   const sample=previewWorkspace(String(b.date||''),String(b.shift||'1'),String(b.line||''));
   if(b.phase==='web-reports'){
    const reports=sample.data.reports.filter(report=>!b.line||report.line===b.line).map(report=>({
     ...report,reviewSource:'LINE4_WEB',viewOnly:false,hash:'preview',revisionVersion:'preview-version',
     testOnly:report.line==='LINE_99',state:report.line==='LINE_99'?'TEST_APPROVED':'TF_WEB_READY',
     reviewFields:{qtyOk:String(report.input.ok),qtyRepair:String(report.input.repair),qtyReject:String(report.input.reject),
      jamMulaiProses:report.input.start,jamSelesaiProses:report.input.end,lembur:'No'},
    }));
    return Response.json({...sample,data:{...sample.data,reports}},{headers:previewHeaders});
   }
   if(b.phase==='legacy-reports')sample.data.reports=sample.data.reports.filter(report=>report.line==='LINE_99');
   return Response.json(sample,{headers:previewHeaders});
  }
  catch{return Response.json({ok:false,error:'INVALID_JSON'},{status:400});}
 }
 const h=headers(r),reply=(x:unknown,status=200)=>Response.json(x,{status,headers:h});
 if(!origins.has(r.headers.get('origin')||''))return reply({ok:false,error:'ORIGIN_NOT_ALLOWED'},403);
 try{
 if(Number(r.headers.get('content-length')||0)>26000)return reply({ok:false,error:'REQUEST_TOO_LARGE'},413);
 const text=await r.text();if(Buffer.byteLength(text)>26000)return reply({ok:false,error:'REQUEST_TOO_LARGE'},413);
 let body;try{body=JSON.parse(text);}catch{return reply({ok:false,error:'INVALID_JSON'},400);}
 if(!['snapshot','target','submit','decide','decideBatch','revisionDetail','reviseProduction','reviseApproved','remapReviewPart'].includes(body?.action))return reply({ok:false,error:'INVALID_ACTION'},400);
 const pilotEnabled=process.env.VERCEL_ENV==='production' && sqlSubmissionEnabled('LINE_4');
 const receiverConfigured=receiverReady()&&receiverMode()==='production';
 const notConfigured=()=>reply({ok:false,error:'LEADER_NOT_CONFIGURED'},503);
 if(body.action==='snapshot'&&body.phase==='target-progress'){
  const {date,shift,line=''}=body;
  if(!validWebReviewScope({date,shift:shift==='all'?'1':shift,line}))return reply({ok:false,error:'INVALID_REVIEW_FILTER'},400);
  if(!pilotEnabled)return reply({ok:false,error:'WEB_REVIEW_UNAVAILABLE'},503);
  const start=performance.now();
  if(line==='' && isTelegramCardPoll(r,shift)){
   const cached=await readCardData('progress',date,shift,()=>targetProgress(date,shift,line));
   h.set('X-Card-Data-Time',String(cached.loadedAt));
   return reply({ok:true,data:cached.data});
  }
  const data=await targetProgress(date,shift,line);
  h.set('Server-Timing','neon;dur='+(performance.now()-start).toFixed(1));
  return reply({ok:true,data});
 }
 if(body.action==='snapshot'&&body.phase==='web-reports'){
  const scope={date:body.date,shift:body.shift,line:body.line??''};
  if(!validWebReviewScope(scope))return reply({ok:false,error:'INVALID_REVIEW_FILTER'},400);
  if(!pilotEnabled)return reply({ok:false,error:'WEB_REVIEW_UNAVAILABLE'},503);
  const start=performance.now();
  if(scope.line==='LINE_99' && isTelegramCardPoll(r,scope.shift)){
   const cached=await readCardData('line99',scope.date,scope.shift,()=>webReviewWorkspace(scope.date,scope.shift,scope.line));
   h.set('X-Card-Data-Time',String(cached.loadedAt));
   return reply({ok:true,data:cached.data});
  }
  const data=await webReviewWorkspace(scope.date,scope.shift,scope.line);
  h.set('Server-Timing','neon;dur='+(performance.now()-start).toFixed(1));
  return reply({ok:true,data});
 }
 if(body.action==='reviseApproved'){
  if(!pilotEnabled)return notConfigured();
  const result=await reviseApproved(body.payload,body.leader);
  if(result.ok)after(drainRevisionDelivery);
  return reply(result,result.ok?200:409);
 }
 if(body.action==='remapReviewPart'){
  const cmd=body.payload;
  const ok=pilotEnabled && cmd && await remapReviewPart(cmd.id,cmd.expectedHash,cmd.part,body.leader);
  return reply(ok?{ok:true}:{ok:false,error:'VERSION_CHANGED_REFRESH'},ok?200:409);
 }
 if(pilotEnabled && body.action==='decide' && isLine4Decision(body.payload)){
  const outcome=await approveLine4(body.payload,body.leader);
  if(outcome.ok) scheduleDelivery();
  return reply(outcome,outcome.ok?200:409);
 }
 if(pilotEnabled && body.action==='decideBatch' && Array.isArray(body.payload?.commands) &&
    body.payload.commands.some(isLine4Decision)){
  const commands=body.payload.commands;
  if(!commands.length||commands.length>20||new Set(commands.map((cmd:{id?:string})=>cmd?.id)).size!==commands.length)
   return reply({ok:false,error:'BULK_LIMIT_20'},409);
  const line4Commands=commands.filter(isLine4Decision);
  const otherCommands=commands.filter((command: Parameters<typeof isLine4Decision>[0])=>!isLine4Decision(command));
  if(otherCommands.length&&!receiverConfigured)return notConfigured();
  const outcomes=await Promise.all(line4Commands.map((cmd:Parameters<typeof approveLine4>[0])=>approveLine4(cmd,body.leader)));
  if(outcomes.some(outcome=>outcome.ok)) scheduleDelivery();
  if(!otherCommands.length) return reply({ok:true,results:outcomes});
  const {workspace}=await callReceiver('leader',{...body,payload:{...body.payload,commands:otherCommands}},65000);
  if(!workspace?.ok||!Array.isArray(workspace.results)) return reply({ok:false,error:'LEADER_UNCONFIRMED_RETRY_SAME_ID'},503);
  return reply({ok:true,results:[...outcomes,...workspace.results]});
 }
 if(pilotEnabled && ['revisionDetail','reviseProduction'].includes(body.action) && typeof body.payload?.id==='string'){
  const [native]=await sqlDatabase()`SELECT id FROM lkh_reports WHERE id=${body.payload.id} AND leader_review IS NOT NULL`;
  if(native)return reply({ok:false,error:'OPEN_NATIVE_REVISION'},409);
 }
 if(!receiverConfigured)return notConfigured();
 if(body.action==='snapshot'&&body.phase==='legacy-reports'){
  const {workspace}=await callReceiver('leader',{...body,phase:'reports'},65000);
  if(typeof workspace?.ok!=='boolean')return reply({ok:false,error:'LEADER_UNCONFIRMED'},503);
  return reply(workspace,workspace.ok?200:409);
 }
 const isPilotSnapshot=pilotEnabled&&body.action==='snapshot'&&(!body.line||body.line==='LINE_99'||requiresProductionReview(body.line))&&body.phase!=='targets';
 const receiverBody=body.action==='target' && Array.isArray(body.payload?.items)
  ? {...body,payload:{...body.payload,items:body.payload.items.map((item:{line:string;machine:string;part:string;targetQty:number})=>({
     line:item.line,machine:item.machine,part:item.part,targetQty:item.targetQty
    }))}}
  : body;
 const [result,pilot]=await Promise.all([
  callReceiver('leader',receiverBody,65000),
  isPilotSnapshot ? line4ReviewSnapshot(body.date,body.shift,body.line || '') : null,
 ]);
 const workspace=result.workspace;
 if(typeof workspace?.ok!=='boolean')return reply({ok:false,error:'LEADER_UNCONFIRMED'},503);
 if(workspace.ok && pilotEnabled && body.action==='snapshot' && body.phase==='targets' && (!body.line || body.line==='LINE_99' || requiresProductionReview(body.line))) workspace.data.reportsLoaded=false;
 if(workspace.ok&&pilot){
  const reports=workspace.data.reports;
  const existing=new Set(reports.map((report:{id:string})=>report.id));
  workspace.data.reports=[...pilot.reports.filter(report=>!existing.has(report.id)),...reports];
  workspace.data.requests=[...workspace.data.requests,...pilot.requests];
  workspace.data.approvalLines=[...new Set([...(workspace.data.approvalLines||[]),...productionReviewLines])];
 }
 if(workspace.ok && body.action==='snapshot' && process.env.DATABASE_URL){
  try { await enrichPlanning(workspace.data, body.phase==='targets' && !body.line && isTelegramCardPoll(r,body.shift) ? body.shift : undefined); } catch { console.warn('LEADER_PLANNING_READ_UNAVAILABLE'); }
 }
 if(workspace.ok && body.action==='target' && Number.isInteger(workspace.result?.version)){
  try { await savePlanning(body.payload,workspace.result.version); }
  finally { invalidateCardData(body.payload.date,body.payload.shift); }
 }
 return reply(workspace,workspace.ok?200:409);
 }catch(error){console.warn('LEADER_GATEWAY_ERROR',error instanceof Error?error.message:'UNKNOWN');return reply({ok:false,error:'LEADER_UNCONFIRMED_RETRY_SAME_ID'},503);}
}
