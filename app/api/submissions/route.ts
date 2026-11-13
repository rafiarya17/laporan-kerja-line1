import { after } from "next/server";
import { sqlIntakeEnabled, sqlSubmissionEnabled, submitSqlReport } from "@/lib/sql-intake";
import { drainSqlDelivery } from "@/lib/sql-delivery";
import type { Submission } from "@/lib/lkh";
import {portalPreview,previewBlocked} from '@/lib/portal-preview';
import { submitReport } from "@/lib/submission-service";
import { callReceiver, receiverMode, receiverReady } from "@/lib/receiver";

export const maxDuration = 90;
export async function POST(request: Request) {
  if(portalPreview() && !sqlIntakeEnabled())return previewBlocked();
  const fail = (error: string, status: number) => Response.json({ ok: false, error }, { status, headers: { "Cache-Control": "no-store" } });
  const origin = request.headers.get("origin");
  if (!origin || origin !== new URL(request.url).origin) return fail("Asal pengiriman tidak valid.", 403);
  if (!request.headers.get("content-type")?.startsWith("application/json")) return fail("Format pengiriman harus JSON.", 415);
  if (!sqlIntakeEnabled() && !receiverReady()) return fail("Penerima belum diaktifkan. Isian tetap tersimpan di perangkat ini.", 503);
  try {
    const raw = await request.text();
    if (new TextEncoder().encode(raw).length > 24000) return fail("Laporan terlalu panjang.", 413);
    let payload: Submission;
    try { payload = JSON.parse(raw); } catch { return fail("Format laporan tidak valid.", 400); }
    const started=performance.now();
    const result = sqlSubmissionEnabled(payload?.line) ? await submitSqlReport(payload) : await submitReport(payload, request.headers.get("x-lkh-retry") === "1", receiverMode(), callReceiver);
    if (sqlSubmissionEnabled(payload?.line) && result.body.ok) after(async () => {
      try { await drainSqlDelivery(); } catch { console.error("LKH_SQL_DELIVERY_RETRY_REQUIRED"); }
    });
    return Response.json(result.body, {status: result.status, headers: {"Cache-Control": "no-store", "Server-Timing": `submission;dur=${Math.round(performance.now()-started)}`}});
  } catch {
    return fail("Penerimaan belum dapat dikonfirmasi. Jangan buat laporan baru; coba kirim ulang dengan ID yang sama.", 502);
  }
}
