import { createHmac } from "node:crypto";

const SAFE_CODES = new Set(['BUSY_RETRY_SAME_ID', 'ID_PAYLOAD_CONFLICT', 'DUPLICATE_ID_REQUIRES_REVIEW', 'SOURCE_REMOVED_REQUIRES_REVIEW', 'SUBMISSION_CANCELLED', 'INTAKE_DUPLICATE_JOBS_REVIEW', 'INTAKE_JOB_CONFLICT', 'INTAKE_JOB_NEEDS_REVIEW', 'SOURCE_WRITE_UNCONFIRMED', 'INTAKE_QUEUE_WRITE_UNCONFIRMED', 'INTAKE_QUEUE_UNCONFIRMED', 'QUEUE_MISSING', 'MASTER_SCHEMA_CHANGED', 'MASTER_NOT_CONFIGURED', 'PRODUCTION_DISABLED', 'PRODUCTION_CONFIGURATION_INVALID', 'SOURCE_ID_COLUMN_MISSING', 'LEDGER_NOT_CONFIGURED', 'LEDGER_SCHEMA_MISSING', 'UNAUTHORIZED', 'INVALID_ENVELOPE', 'INVALID_SUBMISSION', 'INVALID_PROCESS_TIME', 'INVALID_QTY', 'INVALID_DANDORI', 'INVALID_STATUS', 'INVALID_ISSUE_TIME', 'INCOMPLETE_ISSUE', 'REPAIR_REJECT_NEEDS_ISSUE']);
export class ReceiverError extends Error {
  constructor(public readonly code: string) { super(code); this.name = 'ReceiverError'; }
}

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
/** ASCII transport avoids Apps Script POST decoding differences for non-ASCII names/parts.
 * JSON.parse restores the original UTF-16 text, including surrogate pairs.
 */
export function receiverWireBody(value: unknown): string {
  return JSON.stringify(value).replace(/[\u007f-\uffff]/g, char => "\\u" + char.charCodeAt(0).toString(16).padStart(4, "0"));
}
export async function callReceiver(action: string, payload: unknown, timeoutMs = 22000) {
  const mode = receiverMode();
  const prefix = mode === "production" ? "LKH_PRODUCTION" : "LKH_TEST";
  const endpoint = process.env[prefix + "_URL"], secret = receiverSecret(mode);
  if (!endpoint || !secret) throw new Error("RECEIVER_NOT_CONFIGURED");
  const url = new URL(endpoint);
  if (url.protocol !== "https:" || url.hostname !== "script.google.com" || !/^\/macros\/s\/[^/]+\/exec$/.test(url.pathname)) throw new Error("INVALID_RECEIVER_URL");
  const body = receiverWireBody({ action, mode, timestamp: Date.now(), payload });
  const signature = createHmac("sha256", secret).update(body).digest("hex");
  let response: Response;
  try { response = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json; charset=utf-8" }, body: JSON.stringify({ body, signature }), signal: AbortSignal.timeout(timeoutMs), cache: "no-store", redirect: "follow" }); }
  catch (error) { throw new ReceiverError(error instanceof Error && ['TimeoutError','AbortError'].includes(error.name) ? 'RECEIVER_TIMEOUT' : 'RECEIVER_NETWORK_ERROR'); }
  if (!response.ok) throw new ReceiverError("RECEIVER_UNAVAILABLE");
  let result;
  try { result = await response.json(); } catch { throw new ReceiverError('RECEIVER_INVALID_RESPONSE'); }
  if (!result || result.ok !== true) {
    // Private server diagnostics only: never include payloads, signatures or configuration.
    if (action === 'leader') console.warn('LEADER_RECEIVER_REJECTED', String(result?.error || 'INVALID_RESPONSE').slice(0, 240));
    throw new ReceiverError(SAFE_CODES.has(result?.error) ? result.error : 'RECEIVER_REJECTED');
  }
  if (result.mode !== mode) throw new ReceiverError('RECEIVER_MODE_MISMATCH');
  return result;
}

