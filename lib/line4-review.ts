import { EARLY_PRODUCTION_MINUTES, validateSubmission, type Submission } from './lkh';
import { intakeMaster, sqlDatabase } from './sql-intake';

// The submitted payload stays immutable so operator retries retain the same receipt.
const reportId = /^LKH-[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i;
const requestId = /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i;

export function isLine4Decision(command: {id?: unknown} | null | undefined) {
  return typeof command?.id === 'string' && reportId.test(command.id);
}

type Command = {id: string; requestId: string; expectedHash: string; decision: string; reason: string; fields?: Record<string,string>};

const productionFields = ['qtyOk','qtyRepair','qtyReject','jamMulaiProses','jamSelesaiProses','lembur','kendala','kendala4M','permasalahan','tindakan','pic','jamMulaiKendala','jamSelesaiKendala'] as const;
const dandoriFields = ['tahapDandori','hasilDandori','catatanDandori'] as const;
const editable: readonly string[] = [...productionFields,...dandoriFields];
function reviewFields(form: Submission['form']) {
  return form.jenisAktivitas==='DANDORI'?dandoriFields:productionFields;
}

export async function approveLine4(command: Command, leaderValue: unknown) {
  const { id, expectedHash } = command;
  const request = command.requestId;
  const leader = typeof leaderValue === 'string' ? leaderValue.trim() : '';
  const reason = typeof command.reason === 'string' ? command.reason.trim() : '';
  const fail = (error: string) => ({ok: false as const, id, requestId: request, error});
  if (!reportId.test(id) || command.decision !== 'approve' || !requestId.test(request) ||
      !/^[a-f0-9]{64}$/.test(expectedHash)) return fail('LINE4_INVALID_APPROVAL');
  if (leader.length < 2 || leader.length > 80 || /[\x00-\x1f]/.test(leader) || /^[=+@-]/.test(leader)) return fail('LEADER_NAME_REQUIRED');
  if (reason.length < 5 || reason.length > 500 || /[\x00-\x1f]/.test(reason) || /^[=+@-]/.test(reason)) return fail('REASON_REQUIRED');

  const sql = sqlDatabase();
  const edits = command.fields;
  if (edits !== undefined && (!edits || typeof edits !== 'object' || Array.isArray(edits) ||
      !Object.keys(edits).length || Object.entries(edits).some(([k,v])=>!editable.includes(k)||typeof v!=='string'||v.length>3000))) return fail('INVALID_CORRECTION');
  let corrected;
  if (edits) {
    const [row]=await sql`SELECT payload,leader_review AS review FROM lkh_reports
      WHERE id=${id} AND payload->>'line' ~ '^LINE_[1-8]$' AND leader_review IS NOT NULL`;
    if(!row)return fail('LINE4_APPROVAL_NOT_FOUND');
    if(!row.review.approvedAt){
      const allowed: readonly string[]=reviewFields(row.payload.form);
      if(Object.keys(edits).some(k=>!allowed.includes(k)))return fail('INVALID_CORRECTION');
      corrected={...row.review.corrected,...edits};
      const form={...row.payload.form,...corrected,part:row.review.deliveryPart||row.payload.form.part};
      const errors=validateSubmission({...row.payload,form},(await intakeMaster()).mapping,Date.now(),EARLY_PRODUCTION_MINUTES);
      if(errors.length)return fail(errors.join(' '));
    }
  }
  const actor = JSON.stringify({ requestId: request, leader, reason, requestEdits: edits??null, corrected });
  const [released] = await sql`UPDATE lkh_reports
    SET leader_review=leader_review || ${actor}::jsonb || jsonb_build_object('approvedAt',clock_timestamp()),
        next_attempt_at=clock_timestamp()
    WHERE id=${id} AND payload->>'line' ~ '^LINE_[1-8]$' AND leader_review IS NOT NULL
      AND leader_review->>'approvedAt' IS NULL AND delivery_state='PENDING'
      AND encode(sha256(convert_to(payload::text || COALESCE(leader_review->>'deliveryPart',''),'UTF8')),'hex')=${expectedHash}
    RETURNING id`;
  if (!released) {
    const [existing] = await sql`SELECT leader_review AS review,
      encode(sha256(convert_to(payload::text || COALESCE(leader_review->>'deliveryPart',''),'UTF8')),'hex') AS hash
      FROM lkh_reports WHERE id=${id} AND payload->>'line' ~ '^LINE_[1-8]$' AND leader_review IS NOT NULL`;
    if (!existing) return fail('LINE4_APPROVAL_NOT_FOUND');
    if (existing.hash !== expectedHash) return fail('VERSION_CHANGED_REFRESH');
    if (existing.review.requestId !== request) return fail('LINE4_ALREADY_DECIDED');
    if (existing.review.leader !== leader || existing.review.reason !== reason || editable.some(k=>existing.review.requestEdits?.[k]!==edits?.[k])) return fail('REQUEST_ID_CONFLICT');
  }
  return {ok: true as const, result: {id, requestId: request, state: 'LINE4_APPROVED'}};
}

export async function remapReviewPart(id: string, hash: string, part: string, actor: string) {
  if (!reportId.test(id) || typeof part !== 'string' || !part || part.length > 500 ||
      typeof actor !== 'string' || actor.trim().length < 2 || actor.length > 80) return false;
  const sql = sqlDatabase();
  const [row] = await sql`SELECT payload, leader_review FROM lkh_reports WHERE id=${id}
    AND payload->>'line' ~ '^LINE_[1-8]$' AND leader_review IS NOT NULL`;
  if (!row) return false;
  const {mapping} = await intakeMaster();
  const options = mapping[row.payload.line]?.mesin_part_mapping[row.payload.form.mesin]?.options || [];
  if (!options.includes(part) || options.includes(row.leader_review.deliveryPart || row.payload.form.part)) return false;
  const [updated] = await sql`UPDATE lkh_reports SET
    leader_review=(leader_review - 'approvedAt' - 'requestId') || jsonb_build_object(
      'deliveryPart',${part}::text,'remappedBy',${actor.trim()}::text,'remappedAt',clock_timestamp()),
    delivery_state='PENDING', last_error=NULL,next_attempt_at='infinity'
    WHERE id=${id} AND leader_review=${JSON.stringify(row.leader_review)}::jsonb
    AND encode(sha256(convert_to(payload::text || COALESCE(leader_review->>'deliveryPart',''),'UTF8')),'hex')=${hash}
    AND ((delivery_state='PENDING' AND leader_review->>'approvedAt' IS NULL)
      OR (delivery_state='NEEDS_REVIEW' AND last_error='INVALID_MASTER_SELECTION')) RETURNING id`;
  return Boolean(updated);
}

export async function line4ReviewSnapshot(date: string, shift: string, line: string) {
  const sql = sqlDatabase();
  const rows = await sql`SELECT id,payload,leader_review AS review,delivery_state,
    encode(sha256(convert_to(payload::text || COALESCE(leader_review->>'deliveryPart',''),'UTF8')),'hex') AS hash
    FROM lkh_reports
    WHERE leader_review IS NOT NULL AND payload->>'line' ~ '^LINE_[1-8]$'
      AND (${line}::text = '' OR payload->>'line' = ${line})
      AND payload->'form'->>'tanggal'=${date} AND payload->'form'->>'shift'=${shift}
    ORDER BY received_at`;
  const requests = [];
  const reports = [];
  for (const row of rows) {
    const form = {...row.payload.form,...row.review.corrected} as Submission['form'];
    const approved = Boolean(row.review.approvedAt);
    if (approved) requests.push({ id:row.id, requestId:row.review.requestId, state:'DONE' });
    reports.push({
      id: row.id, line: row.payload.line, date, shift, hash: row.hash,
      machine: form.mesin, part: row.review.deliveryPart || form.part, originalPart: form.part, reviewSource: 'LINE4_WEB', viewOnly: false,
      operator: form.operator.map(name=>name==='__other_option__'?form.operatorLainnya:name).join(', '),
      state: !approved?'WAITING_LEADER':row.delivery_state==='NEEDS_REVIEW'?'HELD':'WAITING_TF_SYNC',
      validation: row.delivery_state==='NEEDS_REVIEW'?'Penerusan perlu diperiksa oleh admin.':'',
      reviewFields:Object.fromEntries(reviewFields(form).map(k=>[k,form[k]])),
      input: {ok:Number(form.qtyOk),repair:Number(form.qtyRepair),reject:Number(form.qtyReject),
        start:form.jamMulaiProses,end:form.jamSelesaiProses,overtime:form.lembur,problem:form.permasalahan,action:form.tindakan},
    });
  }
  return {reports,requests};
}
