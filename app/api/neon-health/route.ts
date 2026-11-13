import { neon } from "@neondatabase/serverless";

export const runtime = "nodejs";
export const preferredRegion = "sin1";

export async function GET() {
  const connectionString = process.env.DATABASE_URL;
  if (process.env.VERCEL_ENV !== "preview" || !connectionString) {
    return new Response(null, { status: 404 });
  }

  const headers = { "Cache-Control": "no-store" };
  try {
    const sql = neon(connectionString);
    const [result] = await sql`SELECT 1 AS ok`;
    if (result?.ok !== 1) throw new Error("Unexpected database response");
    return Response.json({ ok: true }, { headers });
  } catch {
    return Response.json({ ok: false }, { status: 503, headers });
  }
}
