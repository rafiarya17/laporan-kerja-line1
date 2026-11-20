import {after} from 'next/server';
import {remapReviewPart,approveLine4,isLine4Decision,line4ReviewSnapshot} from '@/lib/line4-review';
import {productionReviewLines,requiresProductionReview,sqlSubmissionEnabled} from '@/lib/sql-intake';
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
export async function POST(r:Request){
 if(portalPreview()){
  try{const b=await r.json();if(b.action!=='snapshot')return previewBlocked();return Response.json(previewWorkspace(String(b.date||''),String(b.shift||'1'),String(b.line||'')),{headers:previewHeaders});}
  catch{return Response.json({ok:false,error:'INVALID_JSON'},{status:400});}
 }
 const h=headers(r),reply=(x:unknown,status=200)=>Response.json(x,{status,headers:h});
 if(!origins.has(r.headers.get('origin')||''))return reply({ok:false,error:'ORIGIN_NOT_ALLOWED'},403);
 if(!receiverReady()||receiverMode()!=='production')return reply({ok:false,error:'LEADER_NOT_CONFIGURED'},503);
 try{
 if(Number(r.headers.get('content-length')||0)>26000)return reply({ok:false,error:'REQUEST_TOO_LARGE'},413);
 const text=await r.text();if(Buffer.byteLength(text)>26000)return reply({ok:false,error:'REQUEST_TOO_LARGE'},413);
 let body;try{body=JSON.parse(text);}catch{return reply({ok:false,error:'INVALID_JSON'},400);}
 if(!['snapshot','target','submit','decide','decideBatch','revisionDetail','reviseProduction','remapReviewPart'].includes(body?.action))return reply({ok:false,error:'INVALID_ACTION'},400);
 const pilotEnabled=process.env.VERCEL_ENV==='production' && sqlSubmissionEnabled('LINE_4');
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
  const outcomes=await Promise.all(line4Commands.map((cmd:Parameters<typeof approveLine4>[0])=>approveLine4(cmd,body.leader)));
  if(outcomes.some(outcome=>outcome.ok)) scheduleDelivery();
  if(!otherCommands.length) return reply({ok:true,results:outcomes});
  const {workspace}=await callReceiver('leader',{...body,payload:{...body.payload,commands:otherCommands}},65000);
  if(!workspace?.ok||!Array.isArray(workspace.results)) return reply({ok:false,error:'LEADER_UNCONFIRMED_RETRY_SAME_ID'},503);
  return reply({ok:true,results:[...outcomes,...workspace.results]});
 }
 const isPilotSnapshot=pilotEnabled&&body.action==='snapshot'&&(!body.line||requiresProductionReview(body.line))&&body.phase!=='targets';
 const [result,pilot]=await Promise.all([
  callReceiver('leader',body,65000),
  isPilotSnapshot ? line4ReviewSnapshot(body.date,body.shift,body.line || '') : null,
 ]);
 const workspace=result.workspace;
 if(typeof workspace?.ok!=='boolean')return reply({ok:false,error:'LEADER_UNCONFIRMED'},503);
 if(workspace.ok && pilotEnabled && body.action==='snapshot' && body.phase==='targets' && (!body.line || requiresProductionReview(body.line))) workspace.data.reportsLoaded=false;
 if(workspace.ok&&pilot){
  const reports=workspace.data.reports;
  const existing=new Set(reports.map((report:{id:string})=>report.id));
  workspace.data.reports=[...pilot.reports.filter(report=>!existing.has(report.id)),...reports];
  workspace.data.requests=[...workspace.data.requests,...pilot.requests];
  workspace.data.approvalLines=[...new Set([...(workspace.data.approvalLines||[]),...productionReviewLines])];
 }
 return reply(workspace,workspace.ok?200:409);
 }catch(error){console.warn('LEADER_GATEWAY_ERROR',error instanceof Error?error.message:'UNKNOWN');return reply({ok:false,error:'LEADER_UNCONFIRMED_RETRY_SAME_ID'},503);}
}
