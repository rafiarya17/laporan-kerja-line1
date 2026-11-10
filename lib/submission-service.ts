import { validateSubmission, type Submission, type Receipt } from './lkh';
import { ReceiverError } from './receiver';

type Call = (action: string, payload: unknown, timeoutMs?: number) => Promise<any>; // eslint-disable-line @typescript-eslint/no-explicit-any
export async function submitReport(payload: Submission, retry: boolean, mode: 'test' | 'production', call: Call) {
  let stage = 'lookup';
  const started = Date.now();
  const id = /^LKH-[0-9a-f-]{36}$/i.test(payload?.id || '') ? payload.id : 'invalid';
  try {
    let known = false;
    if (retry) known = (await call('lookup', payload)).exists === true;
    if (!known) {
      stage = 'master';
      let errors: string[] = [];
      let masterFailure: unknown;
      try { errors = validateSubmission(payload, (await call('master', {})).mapping); }
      catch (error) { masterFailure = error; }
      // Previously accepted reports must survive master changes and outages.
      if (masterFailure || errors.length) {
        stage = 'lookup';
        if (!retry) known = (await call('lookup', payload)).exists === true;
        if (!known) {
          if (masterFailure) throw masterFailure;
          return { status: 400, body: {ok: false, error: errors.join(' '), clearPending: true} };
        }
      }
    }
    stage = 'submit';
    const result = await call('submit', payload);
    const receipt = result.receipt as Receipt;
    if (!receipt || receipt.id !== payload.id || receipt.mode !== mode || receipt.state !== (mode === 'production' ? 'QUEUED' : 'TEST_SAVED') || !Number.isFinite(Date.parse(receipt.receivedAt))) throw new ReceiverError('INVALID_RECEIPT');
    console.info(JSON.stringify({event:'lkh_submission', id, stage, outcome:'accepted', elapsedMs:Date.now()-started}));
    return {status:200, body:{ok:true, receipt}};
  } catch (error) {
    const code = error instanceof ReceiverError ? error.code : 'UNEXPECTED_RECEIVER_ERROR';
    console.error(JSON.stringify({event:'lkh_submission', id, stage, code, elapsedMs:Date.now()-started}));
    const review = ['ID_PAYLOAD_CONFLICT','DUPLICATE_ID_REQUIRES_REVIEW','SOURCE_REMOVED_REQUIRES_REVIEW','SUBMISSION_CANCELLED','INTAKE_DUPLICATE_JOBS_REVIEW','INTAKE_JOB_CONFLICT','INTAKE_JOB_NEEDS_REVIEW'].includes(code);
    const errorText = review
      ? 'Laporan perlu diperiksa admin. Simpan ID laporan ini; jangan membuat laporan pengganti. Kode: '+code
      : code === 'BUSY_RETRY_SAME_ID'
      ? 'Penerima sedang melayani pengiriman lain. Tunggu sebentar lalu coba kirim ulang dengan ID yang sama.'
      : 'Konfirmasi penerimaan belum tersedia. Laporan mungkin masih diproses. Coba kirim ulang dengan ID yang sama; jangan membuat laporan baru.';
    // Keep 5xx for already-open legacy clients, which clear pending IDs on any 4xx.
    return {status:502, body:{ok:false, error:errorText, code, needsReview:review, clearPending:false}};
  }
}
