import { neon } from '@neondatabase/serverless';
import { validateSubmission, type Submission, type Receipt } from './lkh';
import { trialMaster, neonTrialEnabled } from './neon-trial';

export async function submitNeonTrial(payload: Submission) {
  if (!neonTrialEnabled()) throw new Error('NEON_TRIAL_DISABLED');
  if (payload?.line !== 'LINE_99' || !/^LKH99-[0-9a-f-]{36}$/i.test(payload?.id || '')) {
    return {status: 400, body: {ok: false, error: 'Pilih Line 99 untuk pengujian.', clearPending: true}};
  }
  const sql = neon(process.env.DATABASE_URL!);
  const json = JSON.stringify(payload);
  const receipt = (row: Record<string, unknown>): Receipt => ({
    id: payload.id, state: 'TEST_SAVED', mode: 'test',
    receivedAt: new Date(String(row.received_at)).toISOString(),
  });
  const conflict = {status: 409, body: {
    ok: false, code: 'ID_PAYLOAD_CONFLICT', clearPending: false,
    error: 'ID ini sudah tersimpan dengan isi berbeda. Simpan ID dan hubungi admin.',
  }};
  // Return the original receipt even if the master changes after acceptance.
  const [known] = await sql`
    SELECT received_at, payload = ${json}::jsonb AS matches
    FROM lkh_trial_reports WHERE id = ${payload.id}
  `;
  if (known) return known.matches
    ? {status: 200, body: {ok: true, receipt: receipt(known)}} : conflict;
  const errors = validateSubmission(payload, trialMaster);
  if (errors.length) return {status: 400, body: {ok: false, error: errors.join(' '), clearPending: true}};
  // Unique-ID locking resolves simultaneous retries without a global lock.
  // Conflicting payloads never overwrite the original report.
  const [saved] = await sql`
    INSERT INTO lkh_trial_reports (id, payload) VALUES (${payload.id}, ${json}::jsonb)
    ON CONFLICT (id) DO UPDATE SET id = EXCLUDED.id
    WHERE lkh_trial_reports.payload = EXCLUDED.payload
    RETURNING received_at
  `;
  if (!saved) return conflict;
  return {status: 200, body: {ok: true, receipt: receipt(saved)}};
}
