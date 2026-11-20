import { sqlDatabase } from '@/lib/sql-intake';
import { publicWeldingMart } from '@/lib/welding-mart';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const [row] = await sqlDatabase()`
      SELECT snapshot FROM welding_dashboard_snapshot ORDER BY captured_at DESC LIMIT 1
    `;
    if (!row?.snapshot) throw new Error('SNAPSHOT_UNAVAILABLE');
    return Response.json(publicWeldingMart(row.snapshot), {
      headers: { 'Cache-Control': 'public, max-age=30, s-maxage=300', 'X-Content-Type-Options': 'nosniff' }
    });
  } catch {
    return Response.json({error:'MART_UNAVAILABLE'}, {status:503, headers:{'Cache-Control':'no-store'}});
  }
}
