import { callReceiver, receiverMode, receiverReady } from "@/lib/receiver";

export const maxDuration = 120;
const allowedOrigins = new Set([
  "https://berlindo-miniapp-lab.smartboy1.chatgpt.site",
  "https://berlindo-miniapp-lab.ardentacorn21.chatgpt.site",
  "https://berlindo-lkh.vercel.app",
]);

function responseHeaders(request: Request) {
  const origin = request.headers.get("origin");
  const headers = new Headers({ "Cache-Control": "no-store", "Vary": "Origin" });
  if (origin && allowedOrigins.has(origin)) {
    headers.set("Access-Control-Allow-Origin", origin);
    headers.set("Access-Control-Allow-Methods", "POST, OPTIONS");
    headers.set("Access-Control-Allow-Headers", "Content-Type");
  }
  return headers;
}

export async function OPTIONS(request: Request) {
  const origin = request.headers.get("origin");
  return new Response(null, { status: origin && allowedOrigins.has(origin) ? 204 : 403, headers: responseHeaders(request) });
}

export async function POST(request: Request) {
  const headers = responseHeaders(request);
  const fail = (error: string, status: number) => Response.json({ ok: false, error }, { status, headers });
  const origin = request.headers.get("origin");
  if (origin && !allowedOrigins.has(origin)) return fail("ORIGIN_NOT_ALLOWED", 403);
  if (!receiverReady() || receiverMode() !== "production") return fail("PILOT_NOT_CONFIGURED", 503);
  try {
    if (Number(request.headers.get("content-length") || 0) > 24000) return fail("REQUEST_TOO_LARGE", 413);
    const text = await request.text();
    if (Buffer.byteLength(text, "utf8") > 24000) return fail("REQUEST_TOO_LARGE", 413);
    const body = JSON.parse(text);
    if (body?.line !== "LINE_99" || body?.isTest !== true || !["snapshot", "submit", "decide"].includes(body?.action)) return fail("LINE99_ONLY", 400);
    if (typeof body.initData !== "string" || !body.initData || body.initData.length > 12000) return fail("OPEN_IN_TELEGRAM", 401);
    const result = await callReceiver("line99", body, 65000);
    if (!result.pilot || typeof result.pilot.ok !== "boolean") return fail("PILOT_RECEIVER_NOT_READY", 503);
    return Response.json(result.pilot, { status: result.pilot.ok ? 200 : 409, headers });
  } catch {
    return fail("PILOT_UNAVAILABLE_RETRY_SAME_ID", 503);
  }
}
