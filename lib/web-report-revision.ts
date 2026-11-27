import {invalidateCardData} from './telegram-card-cache';
import { sqlDatabase } from './sql-intake';
import { validateSubmission, EARLY_PRODUCTION_MINUTES, type Submission } from './lkh';

export const sheetFields: Record<string,string> = {
  qtyOk:'ok', qtyRepair:'repair', qtyReject:'reject', jamMulaiProses:'start', jamSelesaiProses:'end',
  lembur:'overtime', kendala:'hasIssue', kendala4M:'issue4m', permasalahan:'problem', tindakan:'action',
  pic:'pic', jamMulaiKendala:'issueStart', jamSelesaiKendala:'issueEnd',
};
const uuid=/^[a-f\d]{8}(?:-[a-f\d]{4}){3}-[a-f\d]{12}$/i;
const safe=(v:unknown,min:number,max:number):v is string=>typeof v==='string'&&v.trim().length>=min&&v.length<=max&&!/^[=+@-]|[\x00-\x1f]/.test(v.trim());
type Revision={id:string;requestId:string;version:string;reason:string;fields:Record<string,string>};
export async function reviseApproved(cmd:Revision,leader:unknown) {
  const reject=(error:string)=>({ok:false as const,error});
  if(!cmd || !uuid.test(cmd.requestId) || !uuid.test(cmd.version) || typeof cmd.id!=='string' || cmd.id.length>50)return reject('INVALID_CORRECTION');
  if(!safe(leader,2,80))return reject('LEADER_NAME_REQUIRED');
  if(!safe(cmd.reason,5,500))return reject('REASON_REQUIRED');
  const fields=cmd.fields;
  if(!fields||typeof fields!=='object'||Array.isArray(fields)||!Object.keys(fields).length||
    Object.entries(fields).some(([k,v])=>!Object.hasOwn(sheetFields,k)||typeof v!=='string'||v.length>1000||/^[=+@]|[\x00-\x08\x0b\x0c\x0e-\x1f]/.test(v)))return reject('INVALID_CORRECTION');
  const sql=sqlDatabase(),actor=leader.trim(),reason=cmd.reason.trim(),edits=JSON.stringify(fields);
  const success={ok:true as const,result:{id:cmd.id,requestId:cmd.requestId,state:'WEB_REVISED'}};
  async function existing() {
    const [prior]=await sql`SELECT report_id=${cmd.id} AND previous_version=${cmd.version}::uuid AND fields=${edits}::jsonb
      AND actor=${actor} AND reason=${reason} AS matches FROM lkh_report_revisions WHERE request_id=${cmd.requestId}::uuid`;
    return prior ? prior.matches ? success : reject('REQUEST_ID_CONFLICT') : null;
  }
  const prior=await existing();
  if(prior)return prior;
  const [row]=await sql`SELECT payload, leader_review AS review FROM lkh_reports WHERE id=${cmd.id}
    AND leader_review->>'approvedAt' IS NOT NULL AND (payload->>'line' ~ '^LINE_[1-8]$' OR
    (payload->>'line'='LINE_99' AND leader_review->>'testOnly'='true'))`;
  if(!row || (row.review.revisionId||row.review.requestId)!==cmd.version)return await existing() || reject('VERSION_CHANGED_REFRESH');
  const payload=row.payload as Submission;
  const previous={...payload.form,...row.review.corrected,part:row.review.deliveryPart||payload.form.part};
  if(previous.jenisAktivitas==='DANDORI')return reject('INVALID_CORRECTION');
  if(Object.entries(fields).every(([k,v])=>v===previous[k]))return reject('NO_CHANGES');
  // Identity fields cannot be edited here. Historical operators and parts remain valid for their original report.
  const master={[payload.line]:{operators:previous.operator,mesin_part_mapping:{[previous.mesin]:{options:[previous.part]}}}};
  const errors=validateSubmission({...payload,form:{...previous,...fields}},master,Date.now(),EARLY_PRODUCTION_MINUTES);
  if(errors.length)return reject(errors.join(' '));
  const before=JSON.stringify(Object.fromEntries(Object.keys(fields).map(k=>[k,previous[k]])));
  const [saved]=await sql`WITH changed AS (
    UPDATE lkh_reports SET leader_review=leader_review || jsonb_build_object(
      'deliveryCorrection',COALESCE(leader_review->'deliveryCorrection',leader_review->'corrected','{}'::jsonb),
      'corrected',COALESCE(leader_review->'corrected','{}'::jsonb) || ${edits}::jsonb,'revisionId',${cmd.requestId}::text,
      'lastRevision',jsonb_build_object('actor',${actor}::text,'reason',${reason}::text,'at',clock_timestamp()))
    WHERE id=${cmd.id} AND leader_review->>'approvedAt' IS NOT NULL
      AND COALESCE(leader_review->>'revisionId',leader_review->>'requestId')=${cmd.version}
    RETURNING id,leader_review
  ) INSERT INTO lkh_report_revisions(request_id,report_id,previous_version,actor,reason,previous_fields,fields,mirror_state)
    SELECT ${cmd.requestId}::uuid,id,${cmd.version}::uuid,${actor},${reason},${before}::jsonb,${edits}::jsonb,
      CASE WHEN leader_review->>'testOnly'='true' THEN 'TEST_ONLY' ELSE 'PENDING' END FROM changed RETURNING report_id`;
  if (saved) invalidateCardData(payload.form.tanggal, payload.form.shift);
  return saved ? success : await existing() || reject('VERSION_CHANGED_REFRESH');
}
