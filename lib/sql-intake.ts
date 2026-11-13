import { neon } from '@neondatabase/serverless';
import { validateSubmission, type Master, type Submission, type Receipt } from './lkh';
import { callReceiver } from './receiver';
import { trialMaster } from './sql-preview-master';

export function sqlIntakeEnabled() {
  return process.env.LKH_SQL_INTAKE === '1' && Boolean(process.env.DATABASE_URL) &&
    (process.env.VERCEL_ENV === 'production' || process.env.LKH_SQL_PREVIEW === '1');
}
// A fresh deadline for every HTTP query, including sequential worker queries.
export const sqlDatabase = () => neon(process.env.DATABASE_URL!, {fetchOptions:{
  get signal() { return AbortSignal.timeout(12000); },
}});

export async function intakeMaster(maxAgeSeconds=60) {
  const sql = sqlDatabase();
  const [cached] = await sql`SELECT mapping,version FROM lkh_master_cache WHERE id=true AND refreshed_at > now()-make_interval(secs=>${maxAgeSeconds})`;
  if (cached) return cached as {mapping: Master; version: string};
  const live = process.env.VERCEL_ENV === 'preview'
    ? {mapping: trialMaster, version: 'sql-intake-preview-v1'}
    : await callReceiver('master', {});
  if (!live.mapping || !Object.keys(live.mapping).length || typeof live.version !== 'string') throw new Error('INVALID_MASTER');
  await sql`INSERT INTO lkh_master_cache(id,mapping,version) VALUES(true,${JSON.stringify(live.mapping)}::jsonb,${live.version})
    ON CONFLICT(id) DO UPDATE SET mapping=excluded.mapping,version=excluded.version,refreshed_at=clock_timestamp()`;
  return {mapping: live.mapping as Master,version: live.version as string};
}

export async function submitSqlReport(payload: Submission) {
  const sql = sqlDatabase();
  if (!payload || typeof payload.id !== 'string' || !/^LKH(?:99)?-[0-9a-f-]{36}$/i.test(payload.id)) {
    return {status:400,body:{ok:false,error:'ID laporan tidak valid.',clearPending:true}};
  }
  const json=JSON.stringify(payload);
  const conflict = {status:502,body:{ok:false,code:'ID_PAYLOAD_CONFLICT',clearPending:false,
    error:'ID laporan sudah tersimpan dengan isi berbeda. Simpan ID ini dan hubungi admin; jangan buat laporan baru.'}};
  const accepted = (row: Record<string,unknown>) => ({status:200,body:{ok:true,receipt:{
    id:payload.id,state:'SQL_SAVED',mode:process.env.VERCEL_ENV === 'preview' ? 'test' : 'production',receivedAt:new Date(String(row.received_at)).toISOString(),
  } as Receipt}});
  // Resolve retries before validation: accepted data survives master/date changes.
  const [known]=await sql`SELECT received_at,payload=${json}::jsonb AS matches FROM lkh_reports WHERE id=${payload.id}`;
  if(known) return known.matches ? accepted(known) : conflict;
  const master=await intakeMaster(900);
  const errors=validateSubmission(payload,master.mapping);
  if(errors.length) return {status:400,body:{ok:false,error:errors.join(' '),clearPending:true}};
  const [saved]=await sql`INSERT INTO lkh_reports(id,payload,master_version) VALUES(${payload.id},${json}::jsonb,${master.version})
    ON CONFLICT(id) DO UPDATE SET id=excluded.id WHERE lkh_reports.payload=excluded.payload RETURNING received_at`;
  return saved ? accepted(saved) : conflict;
}
