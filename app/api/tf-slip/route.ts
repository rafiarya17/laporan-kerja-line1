import { processInterval, type LkhForm } from '@/lib/lkh';
import { sqlDatabase, sqlSubmissionEnabled } from '@/lib/sql-intake';

export async function POST(request: Request) {
  const headers = {'Cache-Control':'private, no-store'};
  const reply = (body: unknown, status = 200) => Response.json(body,{status,headers});
  if (request.headers.get('origin') !== new URL(request.url).origin) return reply({error:'Asal permintaan tidak valid.'},403);
  if (process.env.VERCEL_ENV !== 'production' || !sqlSubmissionEnabled('LINE_1')) return reply({error:'Data produksi belum tersedia.'},503);
  const params = new URL(request.url).searchParams;
  const date = params.get('date') || '', shift = params.get('shift') || '', line = params.get('line') || '';
  const day = new Date(date+'T00:00:00Z');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isFinite(+day) || day.toISOString().slice(0,10)!==date || !['','1','2'].includes(shift) || (line && !/^LINE_[1-8]$/.test(line))) return reply({error:'Filter tanggal, shift, atau line tidak valid.'},400);
  try {
    const start = performance.now();
    const sql = sqlDatabase();
    const reports = await sql`SELECT id,payload->>'line' AS line,
      (payload->'form') || COALESCE(leader_review->'corrected','{}'::jsonb) AS form,
      leader_review->>'approvedAt' AS approved, leader_review->>'deliveryPart' AS part
      FROM lkh_reports WHERE leader_review IS NOT NULL AND payload->>'line' ~ '^LINE_[1-8]$'
      AND payload->'form'->>'tanggal'=${date}
      AND (${shift}::text='' OR payload->'form'->>'shift'=${shift})
      AND (${line}::text='' OR payload->>'line'=${line})
      ORDER BY line, payload->'form'->>'shift', received_at, id`;
    const now = Date.now();
    const rows = [];
    let pending = 0, waitingEnd = 0, invalid = 0;
    for (const report of reports) {
      const form = report.form as LkhForm;
      if (form.jenisAktivitas === 'DANDORI') continue;
      if (!report.approved) { pending++; continue; }
      const interval = processInterval(form);
      if (!interval || interval.end <= interval.start) { invalid++; continue; }
      if (interval.end > now) { waitingEnd++; continue; }
      rows.push({id:report.id,line:report.line,shift:form.shift,machine:form.mesin,part:report.part || form.part,
        ok:form.qtyOk,repair:form.qtyRepair,reject:form.qtyReject,approved:report.approved});
    }
    return Response.json({rows,pending,waitingEnd,invalid,asOf:new Date(now).toISOString()},
      {headers:{...headers,'Server-Timing':'read;dur='+(performance.now()-start).toFixed(1)}});
  } catch { return reply({error:'Data TF Slip belum bisa dimuat. Silakan muat ulang.'},503); }
}
