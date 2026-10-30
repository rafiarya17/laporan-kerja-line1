import type { Receipt, Submission } from "@/lib/lkh";
import { validateSubmission } from "@/lib/lkh";
import { callReceiver, receiverMode, receiverReady } from "@/lib/receiver";

export const maxDuration = 90;
export async function POST(request: Request) {
  const fail = (error: string, status: number) => Response.json({ ok: false, error }, { status, headers: { "Cache-Control": "no-store" } });
  const origin = request.headers.get("origin");
  if (!origin || origin !== new URL(request.url).origin) return fail("Asal pengiriman tidak valid.", 403);
  if (!request.headers.get("content-type")?.startsWith("application/json")) return fail("Format pengiriman harus JSON.", 415);
  if (!receiverReady()) return fail("Penerima belum diaktifkan. Isian tetap tersimpan di perangkat ini.", 503);
  try {
    const raw = await request.text();
    if (new TextEncoder().encode(raw).length > 24000) return fail("Laporan terlalu panjang.", 413);
    let payload: Submission;
    try { payload = JSON.parse(raw); } catch { return fail("Format laporan tidak valid.", 400); }
    const known = await callReceiver("lookup", payload);
    if (known.exists !== true) {
      const current = await callReceiver("master", {});
      const errors = validateSubmission(payload, current.mapping);
      if (errors.length) return fail(errors.join(" "), 400);
    }
    const result = await callReceiver("submit", payload);
    const receipt = result.receipt as Receipt;
    if (!receipt || receipt.id !== payload.id || receipt.mode !== receiverMode() || !["TEST_SAVED", "QUEUED"].includes(receipt.state) || (receipt.mode === "test" && receipt.state !== "TEST_SAVED") || (receipt.mode === "production" && receipt.state !== "QUEUED") || !Number.isFinite(Date.parse(receipt.receivedAt))) throw new Error("INVALID_RECEIPT");
    return Response.json({ ok: true, receipt }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return fail("Penerimaan belum dapat dikonfirmasi. Jangan buat laporan baru; coba kirim ulang dengan ID yang sama.", 502);
  }
}
