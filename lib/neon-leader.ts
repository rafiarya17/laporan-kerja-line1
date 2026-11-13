import { neon } from '@neondatabase/serverless';
import { trialMaster } from './neon-trial';
import { validateSubmission, type Submission } from './lkh';

const catalog = Object.entries(trialMaster.LINE_99.mesin_part_mapping).flatMap(([machine, config]) =>
  config.options.map(part => ({line:'LINE_99', machine, machineId:machine, part})));
const dateValid = (v: unknown): v is string => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) && Number.isFinite(Date.parse(v+'T00:00:00Z')) && new Date(v+'T00:00:00Z').toISOString().slice(0,10) === v;
const bad = (error: string) => ({ok:false,error});
type Command = { action:string; leader?:string; date?:string; shift?:string; line?:string; payload?:Record<string,unknown> };

export async function neonLeader(body: Command): Promise<Record<string,unknown>> {
 const sql=neon(process.env.DATABASE_URL!);
 if(body.action==='snapshot') {
  if(!dateValid(body.date)||!['1','2'].includes(body.shift||'')) return bad('INVALID_DATE_SHIFT');
  const [targets,reports,actions]=await Promise.all([
   sql`SELECT * FROM lkh_trial_targets WHERE date=${body.date} AND shift=${body.shift}`,
   sql`SELECT id,coalesce(effective_payload,payload) AS payload,version,state FROM lkh_trial_reports
       WHERE coalesce(effective_payload,payload)->'form'->>'tanggal'=${body.date}
       AND coalesce(effective_payload,payload)->'form'->>'shift'=${body.shift} ORDER BY received_at DESC`,
   sql`SELECT request_id, result FROM lkh_trial_actions ORDER BY created_at DESC LIMIT 100`,
  ]);
  return {ok:true,data:{trial:true,date:body.date,shift:body.shift,reportLine:body.line||'',reportsLoaded:true,
   checkedAt:new Date().toISOString(),catalog,targets,
   reports:reports.map(r=>{const p=r.payload as Submission,f=p.form;return {
    id:r.id,line:p.line,machine:f.mesin,part:f.part,operator:f.operator.map(o=>o==='__other_option__'?f.operatorLainnya:o).join(', '),
    state:r.state,hash:String(r.version),viewOnly:false,validation:validateSubmission(p,trialMaster).join(' '),
    input:{date:f.tanggal,shift:f.shift,machineId:f.mesin,part:f.part,start:f.jamMulaiProses,end:f.jamSelesaiProses,ok:Number(f.qtyOk),repair:Number(f.qtyRepair),reject:Number(f.qtyReject)},
   };}), requests:actions.map(a=>({requestId:a.request_id,id:a.result.id,state:'DONE'})),
  }};
 }
 if(typeof body.leader!=='string'||body.leader.trim().length<2||body.leader.length>100) return bad('LEADER_REQUIRED');
 const p=body.payload;
 if(!p||typeof p.requestId!=='string'||p.requestId.length>100) return bad('INVALID_REQUEST_ID');
 if(body.action==='decideBatch') {
  if(!Array.isArray(p.commands)||p.commands.length<1||p.commands.length>20) return bad('INVALID_BATCH');
  const results=[];
  for(const item of p.commands) {
   if(item.decision!=='approve') return bad('INVALID_DECISION');
   const r=await neonLeader({action:'decide',leader:body.leader,payload:item});
   results.push({...r,id:item.id});
  }
  return {ok:true,trial:true,results};
 }
 // Check the original command before deriving a revision from the current row.
 const [prior]=await sql`SELECT command,result FROM lkh_trial_actions WHERE request_id=${p.requestId}`;
 if(prior) {
  const original={...prior.command,payload:{...prior.command.payload}};
  delete original.payload.effectivePayload;
  const [same]=await sql`SELECT ${JSON.stringify(original)}::jsonb=${JSON.stringify(body)}::jsonb AS matches`;
  return same.matches?{ok:true,trial:true,result:prior.result}:bad('REQUEST_ID_CONFLICT');
 }
 let command=body;
 if(body.action==='target') {
  if(p.line!=='LINE_99'||!dateValid(p.date)||!['1','2'].includes(String(p.shift))||!Number.isSafeInteger(p.expectedVersion)||Number(p.expectedVersion)<0||!Array.isArray(p.items)||p.items.length>100) return bad('INVALID_TARGET');
  const seen=new Set();
  for(const item of p.items) {
   if(item.line!=='LINE_99'||!catalog.some(c=>c.machine===item.machine&&c.part===item.part))return bad('MASTER_SELECTION_INVALID');
   if(!Number.isSafeInteger(item.targetQty)||item.targetQty<1||item.targetQty>999999999)return bad('TARGET_QTY_INVALID');
   const key=JSON.stringify([item.machine,item.part]);if(seen.has(key))return bad('DUPLICATE_TARGET_QTY_CONFLICT');seen.add(key);
  }
  if(Number(p.expectedVersion)>0&&(typeof p.reason!=='string'||p.reason.trim().length<5))return bad('REASON_REQUIRED');
 } else if(body.action==='decide') {
  if(typeof p.id!=='string'||typeof p.expectedHash!=='string'||!['approve','hold','revise'].includes(String(p.decision)))return bad('INVALID_DECISION');
  if(typeof p.reason!=='string'||p.reason.trim().length<5||p.reason.length>3000)return bad('REASON_REQUIRED');
  const [row]=await sql`SELECT coalesce(effective_payload,payload) AS payload FROM lkh_trial_reports WHERE id=${p.id}`;
  if(!row)return bad('REPORT_NOT_FOUND');
  let payload=row.payload as Submission;
  if(p.decision==='revise') {
   const f=p.fields as Record<string,unknown>;
   if(!f||f.line!=='LINE_99'||f.isTest!==true)return bad('INVALID_REVISION');
   payload={...payload,form:{...payload.form,tanggal:String(f.date),shift:String(f.shift),mesin:String(f.machineId),part:String(f.part),jamMulaiProses:String(f.start),jamSelesaiProses:String(f.end),qtyOk:String(f.ok),qtyRepair:String(f.repair),qtyReject:String(f.reject)}};
   command={...body,payload:{...p,effectivePayload:payload}};
  }
  if(p.decision!=='hold') {const errors=validateSubmission(payload,trialMaster);if(errors.length)return bad(errors.join(' '));}
 } else return bad('INVALID_ACTION');
 try {
  const [r]=await sql`SELECT apply_lkh_trial_action(${JSON.stringify(command)}::jsonb) AS result`;
  return {ok:true,trial:true,result:r.result};
 } catch(e) {
  const code=e instanceof Error?e.message:'';
  const known=['VERSION_CHANGED_REFRESH','REQUEST_ID_CONFLICT','REPORT_ALREADY_APPROVED','REPORT_NOT_FOUND'];
  const error=known.find(c=>code.includes(c));
  if(error)return bad(error);
  throw e;
 }
}
