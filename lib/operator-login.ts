import { createHash, randomBytes } from "node:crypto";
import { sqlDatabase } from "./sql-intake";
import type { Submission } from "./lkh";
export function sameRequestOrigin(req:Request) {
  const url=new URL(req.url);
  const origin=req.headers.get("origin");
  // Next normalizes the loopback hostname in Request.url behind the preview relay.
  return origin===url.origin || (url.hostname==="localhost" && req.headers.get("host")==="127.0.0.1:"+url.port && origin===url.protocol+"//127.0.0.1:"+url.port);
}
export const cookieName = "lkh_operator_session";
export const sessionSeconds = 30 * 60;
const digest = (value: string) => createHash("sha256").update(value).digest("hex");
export const cookie = (token: string, age: number) => cookieName + "=" + token + "; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=" + age;
function tokenHash(req: Request) {
  const value = (req.headers.get("cookie") || "").split(";").map(v=>v.trim()).find(v=>v.startsWith(cookieName+"="))?.slice(cookieName.length+1);
  return value && /^[a-f0-9]{64}$/.test(value) ? digest(value) : "";
}
export async function sessionState(req: Request) {
  if (process.env.VERCEL_ENV !== "production") return {enabled:false, actor:null};
  const sql=sqlDatabase();
  const [row]=await sql`SELECT f.enabled, a.id, a.name, a.lines FROM lkh_operator_login_settings f
    LEFT JOIN lkh_operator_sessions s ON s.token_hash=${tokenHash(req)} AND s.expires_at>now()
    LEFT JOIN lkh_operator_accounts a ON a.id=s.account_id AND a.enabled WHERE f.id`;
  if (!row) throw Error("Missing operator settings");
  return {enabled:row.enabled===true, actor:row.enabled && row.id ? {id:String(row.id), name:String(row.name), lines:row.lines as string[]} : null};
}
export async function startSession(req:Request, nik:string) {
  const sql=sqlDatabase();
  const ip=(req.headers.get("x-vercel-forwarded-for") || req.headers.get("x-forwarded-for") || "local").split(",")[0].trim();
  const [rate]=await sql`INSERT INTO lkh_operator_login_attempts AS a(client_hash,window_start,attempts)
    VALUES (${digest(ip)},now(),1) ON CONFLICT(client_hash) DO UPDATE SET
      attempts=CASE WHEN a.window_start < now()-interval '1 minute' THEN 1 ELSE a.attempts+1 END,
      window_start=CASE WHEN a.window_start < now()-interval '1 minute' THEN now() ELSE a.window_start END RETURNING attempts, window_start::text AS bucket`;
  if(Number(rate.attempts)>30) return {status:429,error:"Terlalu banyak percobaan. Coba lagi dalam satu menit."};
  const token=randomBytes(32).toString("hex");
  // Match either input against the same full-NIK hashes, including future roster changes.
  const hashes = nik.length === 6
    ? Array.from({length:100}, (_, suffix) => digest(nik + "-" + String(suffix).padStart(2, "0")))
    : [digest(nik)];
  const [row]=await sql`WITH candidates AS (
    SELECT a.id, a.name, a.lines
    FROM lkh_operator_login_settings f
    CROSS JOIN jsonb_array_elements_text(${JSON.stringify(hashes)}::jsonb) AS input(hash)
    JOIN lkh_operator_accounts a ON a.enabled AND
      a.lookup_hash=encode(sha256(convert_to(f.lookup_salt || input.hash,'UTF8')),'hex')
    WHERE f.id AND f.enabled
    LIMIT 2
  ), matches AS (
    SELECT count(*)::int AS total FROM candidates
  ), added AS (
    INSERT INTO lkh_operator_sessions(token_hash,account_id,expires_at)
    SELECT ${digest(token)},id,now()+make_interval(secs=>${sessionSeconds})
    FROM candidates, matches WHERE total=1 RETURNING account_id
  ) SELECT total, id, name, lines FROM matches LEFT JOIN added ON true
    LEFT JOIN candidates ON candidates.id=added.account_id`;
  if (row?.total === 2) return {status:409,error:"Tambahkan 2 angka terakhir NIK Anda. Enam angka awal ini dipakai lebih dari satu operator."};
  if (!row?.id) return {status:401,error:"NIK kerja belum terdaftar atau login sedang nonaktif."};
  await sql.transaction([
    sql`DELETE FROM lkh_operator_sessions WHERE expires_at<now() OR token_hash=${tokenHash(req)}`,
    sql`UPDATE lkh_operator_login_attempts SET attempts=greatest(attempts-1,0) WHERE client_hash=${digest(ip)} AND window_start=${rate.bucket}::timestamptz`,
    sql`DELETE FROM lkh_operator_login_attempts WHERE window_start<now()-interval '1 day'`
  ]);
  return {status:200,actor:{id:row.id,name:row.name,lines:row.lines},token};
}
export async function endSession(req:Request) {
  const hash=tokenHash(req);
  if(hash) await sqlDatabase()`DELETE FROM lkh_operator_sessions WHERE token_hash=${hash}`;
}
export function actorMatches(name:string,payload:Submission) {
  const form=payload?.form;
  if(!Array.isArray(form?.operator))return false;
  const primary=form.operator[0]==="__other_option__" ? String(form.operatorLainnya||"").split(",")[0].trim() : form.operator[0];
  return primary===name;
}
export async function claimReport(req:Request,id:string) {
  const rows=await sqlDatabase()`UPDATE lkh_operator_sessions SET report_id=${id} WHERE token_hash=${tokenHash(req)}
    AND expires_at>now() AND (report_id IS NULL OR report_id=${id}) RETURNING account_id`;
  return rows.length===1;
}
export async function releaseReport(req:Request,id:string) {
  await sqlDatabase()`UPDATE lkh_operator_sessions SET report_id=NULL WHERE token_hash=${tokenHash(req)} AND report_id=${id}`;
}
