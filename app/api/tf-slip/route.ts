import { portalPreview } from '@/lib/portal-preview';
import { processInterval, type LkhForm } from '@/lib/lkh';
import { sqlDatabase, sqlSubmissionEnabled } from '@/lib/sql-intake';

function validDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const time = Date.parse(value + 'T00:00:00Z');
  return Number.isFinite(time) && new Date(time).toISOString().slice(0, 10) === value;
}

export async function POST(request: Request) {
  const headers = {'Cache-Control':'private, no-store'};
  const reply = (body: unknown, status = 200) => Response.json(body,{status,headers});
  if (request.headers.get('origin') !== new URL(request.url).origin) return reply({error:'Asal permintaan tidak valid.'},403);
  const params = new URL(request.url).searchParams;
  const date = params.get('date') || '', shift = params.get('shift') || '', line = params.get('line') || '';
  const to = params.get('to') ?? date;
  if (!validDate(date) || !validDate(to) || to < date || !['','1','2'].includes(shift) || (line && !/^LINE_[1-8]$/.test(line))) {
    return reply({error:'Periksa rentang tanggal, shift, dan line.'},400);
  }
  if (portalPreview()) {
    const sampleDates = date === to ? [date] : [date, to];
    const rows = sampleDates.flatMap(day => Array.from({length: 28}, (_, index) => ({
      id: 'CONTOH-' + day + '-' + index, date: day,
      line: 'LINE_' + (1 + index % 8),
      shift: index < 14 ? '1' : '2',
      machine: 'Mesin contoh ' + (1 + index % 8),
      part: 'PART-CONTOH-' + (101 + index),
      revised: index % 5 === 0,
      ok: 100 + index, repair: index % 3, reject: index % 2,
      approved: day + (index < 14 ? 'T16:35:00+07:00' : 'T23:35:00+07:00'),
    }))).filter(row => (!shift || row.shift === shift) && (!line || row.line === line));
    return reply({preview:true, rows, pending:0, waitingEnd:0, invalid:0, asOf:new Date().toISOString()});
  }
  if (process.env.VERCEL_ENV !== 'production' || !sqlSubmissionEnabled('LINE_1')) return reply({error:'Data produksi belum tersedia.'},503);
  try {
    const start = performance.now();
    const sql = sqlDatabase();
    const reports = await sql`SELECT id,payload->>'line' AS line,
      (payload->'form') || COALESCE(NULLIF(leader_review->'corrected','null'::jsonb),'{}'::jsonb) AS form,
      leader_review->>'approvedAt' AS approved, leader_review->>'deliveryPart' AS part,
      (NOT (payload->'form' @> COALESCE(NULLIF(leader_review->'corrected','null'::jsonb),'{}'::jsonb))
        OR COALESCE(NULLIF(leader_review->>'deliveryPart',''),payload->'form'->>'part')
          IS DISTINCT FROM payload->'form'->>'part') AS revised
      FROM lkh_reports WHERE leader_review IS NOT NULL AND payload->>'line' ~ '^LINE_[1-8]$'
      AND (payload->'form'->>'tanggal') BETWEEN ${date} AND ${to}
      AND (${shift}::text='' OR payload->'form'->>'shift'=${shift})
      AND (${line}::text='' OR payload->>'line'=${line})
      ORDER BY payload->'form'->>'tanggal', line, payload->'form'->>'shift', received_at, id`;
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
      rows.push({id:report.id,date:form.tanggal,line:report.line,shift:form.shift,machine:form.mesin,part:report.part || form.part,
        ok:form.qtyOk,repair:form.qtyRepair,reject:form.qtyReject,approved:report.approved,revised:report.revised});
    }
    return Response.json({rows,pending,waitingEnd,invalid,asOf:new Date(now).toISOString()},
      {headers:{...headers,'Server-Timing':'read;dur='+(performance.now()-start).toFixed(1)}});
  } catch { return reply({error:'Data TF Slip belum bisa dimuat. Silakan muat ulang.'},503); }
}
