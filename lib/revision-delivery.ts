import { callReceiver } from './receiver';
import { sqlDatabase } from './sql-intake';
import { sheetFields } from './web-report-revision';
type Fields=Record<string,string>;
type Job={request_id:string;report_id:string;line:string;actor:string;reason:string;previous_fields:Fields;fields:Fields;sheet_hash:string|null};
function sheetValue(key:string,value:string) {
  if(key==='lembur' || key==='kendala'){
    if(['Yes','Ada','Ya'].includes(value))return 'Ya';
    if(['No','Tidak'].includes(value))return 'Tidak';
  }
  if(key.startsWith('qty') && value!=='' && Number.isFinite(Number(value)))return String(Number(value));
  return value;
}
// The pinned source hash and request ID survive a timeout after the receiver accepted a revision.
export async function mirrorRevision(job:Job,pin:(hash:string)=>Promise<void>,call=callReceiver) {
  const payload={id:job.report_id,line:job.line};
  let hash=job.sheet_hash;
  const desired=Object.fromEntries(Object.entries(job.fields).map(([k,v])=>[sheetFields[k],sheetValue(k,v)]));
  if(!hash){
    const {workspace}=await call('leader',{action:'revisionDetail',payload},18000);
    const detail=workspace?.result;
    if(!workspace?.ok||detail?.id!==job.report_id||detail?.line!==job.line||!Array.isArray(detail.fields)||!/^[a-f0-9]{64}$/.test(detail.hash))throw Error(workspace?.error||'REPORT_NOT_READY');
    const current=Object.fromEntries(detail.fields.map((f:{key:string;value:string})=>[f.key,f.value]));
    let changed=false;
    for(const [key,before] of Object.entries(job.previous_fields)){
      const name=sheetFields[key];
      if(!Object.hasOwn(current,name))throw Error('REVISION_SCHEMA_CHANGED');
      const value=sheetValue(key,String(current[name]));
      if(value===desired[name])continue;
      if(value!==sheetValue(key,before))throw Error('VERSION_CHANGED_REFRESH');
      changed=true;
    }
    if(!changed)return 'APPLIED';
    hash=String(detail.hash);
    await pin(hash);
  }
  const {workspace}=await call('leader',{action:'reviseProduction',leader:job.actor,payload:{...payload,requestId:job.request_id,
    expectedHash:hash,fields:desired,reason:job.reason}},22000);
  const result=workspace?.result;
  if(!workspace?.ok||result?.id!==job.report_id||result?.requestId!==job.request_id)throw Error(workspace?.error||'REVISION_UNCONFIRMED');
  if(result.state==='REQUEST_DONE')return 'APPLIED';
  if(result.state==='REQUEST_SAVED')return 'PENDING';
  throw Error('REVISION_UNCONFIRMED');
}
export async function drainRevisionDelivery(){
  if(process.env.VERCEL_ENV!=='production')return;
  const sql=sqlDatabase();
  // Claim one due revision atomically. Each report's predecessor must finish first.
  const [job]=await sql`WITH due AS (SELECT q.request_id,r.payload->>'line' AS line FROM lkh_report_revisions q
    JOIN lkh_reports r ON r.id=q.report_id LEFT JOIN lkh_report_revisions prev ON prev.request_id=q.previous_version
    WHERE q.mirror_state='PENDING' AND q.next_attempt_at<=now() AND r.delivery_state='DELIVERED'
      AND (prev.request_id IS NULL OR prev.mirror_state='APPLIED')
    ORDER BY q.next_attempt_at LIMIT 1 FOR UPDATE OF q SKIP LOCKED)
    UPDATE lkh_report_revisions q SET next_attempt_at=now()+interval '2 minutes' FROM due
      WHERE q.request_id=due.request_id RETURNING q.*,due.line`;
  if(!job)return;
  let state='PENDING',error=null;
  try{
    state=await mirrorRevision(job as Job,async hash=>{
      await sql`UPDATE lkh_report_revisions SET sheet_hash=${hash} WHERE request_id=${job.request_id}::uuid`;
    });
  }catch(e){
    error=e instanceof Error?e.message:'REVISION_UNCONFIRMED';
    if(/VERSION_CHANGED|SCHEMA_CHANGED|SOURCE_REMOVED|REQUEST_ID_CONFLICT|REVISION_(?:SELECTION|SCOPE|VALIDATION)|MASTER_SELECTION_INVALID/.test(error))state='REVIEW';
  }
  await sql`UPDATE lkh_report_revisions SET mirror_state=${state},last_error=${error},next_attempt_at=now()+interval '45 seconds'
    WHERE request_id=${job.request_id}::uuid`;
}
