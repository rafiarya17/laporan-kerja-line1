import { createHmac } from "node:crypto";

export function receiverMode(): "test" | "production" {
  // Preview deployments never inherit the production write path.
  return process.env.LKH_MODE === "production" && process.env.VERCEL_ENV !== "preview" ? "production" : "test";
}
function receiverSecret(mode: "test" | "production") {
  if (mode === "test") return process.env.LKH_TEST_SECRET;
  // Vercel cannot rename an existing Secret. During an explicit cutover it
  // stays under its old key, scoped to Production only, without reading it.
  return process.env.LKH_PRODUCTION_SECRET ||
    (process.env.LKH_PRODUCTION_USE_LEGACY_SECRET === "1" ? process.env.LKH_TEST_SECRET : undefined);
}
export function receiverReady() {
  const mode = receiverMode();
  const prefix = mode === "production" ? "LKH_PRODUCTION" : "LKH_TEST";
  return Boolean(process.env[prefix + "_URL"] && receiverSecret(mode));
}
export async function callReceiver(action: string, payload: unknown) {
  const mode = receiverMode();
  const prefix = mode === "production" ? "LKH_PRODUCTION" : "LKH_TEST";
  const endpoint = process.env[prefix + "_URL"], secret = receiverSecret(mode);
  if (!endpoint || !secret) throw new Error("RECEIVER_NOT_CONFIGURED");
  const url = new URL(endpoint);
  if (url.protocol !== "https:" || url.hostname !== "script.google.com" || !/^\/macros\/s\/[^/]+\/exec$/.test(url.pathname)) throw new Error("INVALID_RECEIVER_URL");
  const body = JSON.stringify({ action, mode, timestamp: Date.now(), payload });
  const signature = createHmac("sha256", secret).update(body).digest("hex");
  const response = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ body, signature }), signal: AbortSignal.timeout(22000), cache: "no-store", redirect: "follow" });
  if (!response.ok) throw new Error("RECEIVER_UNAVAILABLE");
  const result = await response.json();
  if (!result || result.ok !== true || result.mode !== mode) throw new Error("RECEIVER_REJECTED");
  return result;
}
