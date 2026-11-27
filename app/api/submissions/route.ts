import {leaderInputAccountId} from "@/lib/operator-directory";
import {actorMatches, claimReport, cookie, endSession, releaseReport, sameRequestOrigin, sessionState} from "@/lib/operator-login";
import { after } from "next/server";
import { requiresProductionReview, sqlIntakeEnabled, sqlSubmissionEnabled, submitSqlReport } from "@/lib/sql-intake";
import { drainSqlDelivery } from "@/lib/sql-delivery";
import type { Submission } from "@/lib/lkh";
import {portalPreview,previewBlocked} from '@/lib/portal-preview';
import { submitReport } from "@/lib/submission-service";
import { callReceiver, receiverMode, receiverReady } from "@/lib/receiver";

export const maxDuration = 90;
export async function POST(request: Request) {
  if(portalPreview() && !sqlIntakeEnabled())return previewBlocked();
  const fail = (error: string, status: number) => Response.json({ ok: false, error }, { status, headers: { "Cache-Control": "no-store" } });
  if (!sameRequestOrigin(request)) return fail("Asal pengiriman tidak valid.", 403);
  if (!request.headers.get("content-type")?.startsWith("application/json")) return fail("Format pengiriman harus JSON.", 415);
  if (!sqlIntakeEnabled() && !receiverReady()) return fail("Penerima belum diaktifkan. Isian tetap tersimpan di perangkat ini.", 503);
  try {
    const raw = await request.text();
    if (new TextEncoder().encode(raw).length > 24000) return fail("Laporan terlalu panjang.", 413);
    let payload: Submission;
    try { payload = JSON.parse(raw); } catch { return fail("Format laporan tidak valid.", 400); }
    if (process.env.VERCEL_ENV === 'production' && (requiresProductionReview(payload?.line) || payload?.line === "LINE_99") && !sqlSubmissionEnabled(payload.line)) {
      return fail("Penerimaan laporan produksi sedang tidak tersedia. Coba lagi dengan ID yang sama.", 503);
    }
    const {enabled,actor}=await sessionState(request);
    const singleReportSession = enabled && actor?.id !== leaderInputAccountId;
    if(enabled) {
      if(!actor || actor.id!==request.headers.get("x-lkh-actor"))return fail("Masuk dengan NIK pelapor untuk mengirim laporan.",401);
      if(singleReportSession && !actorMatches(actor.name,payload))return fail("Nama pelapor harus sesuai dengan sesi operator.",403);
      if(!/^LKH(?:99)?-[0-9a-f-]{36}$/i.test(payload.id))return fail("ID laporan tidak valid.",400);
      if(singleReportSession && !await claimReport(request,payload.id))return fail("Sesi sudah digunakan. Masuk kembali untuk melanjutkan.",401);
    }
    const started=performance.now();
    const result = sqlSubmissionEnabled(payload?.line) ? await submitSqlReport(payload,actor?.id) : await submitReport(payload, request.headers.get("x-lkh-retry") === "1", receiverMode(), callReceiver);
    if (sqlSubmissionEnabled(payload?.line) && result.body.ok && !('receipt' in result.body && result.body.receipt?.awaitingLeader)) after(async () => {
      try { await drainSqlDelivery(); } catch { console.error("LKH_SQL_DELIVERY_RETRY_REQUIRED"); }
    });
    const response=Response.json(result.body, {status: result.status, headers: {"Cache-Control": "no-store", "Server-Timing": `submission;dur=${Math.round(performance.now()-started)}`}});
    if(singleReportSession && result.body.ok) {
      await endSession(request);
      response.headers.set("Set-Cookie",cookie("",0));
    } else if(singleReportSession && result.status<500) {
      await releaseReport(request,payload.id);
    }
    return response;
  } catch {
    return fail("Penerimaan belum dapat dikonfirmasi. Jangan buat laporan baru; coba kirim ulang dengan ID yang sama.", 502);
  }
}
