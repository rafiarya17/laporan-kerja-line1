import { timingSafeEqual } from 'node:crypto';
import { sqlDatabase } from '@/lib/sql-intake';
import { drainSqlDelivery } from '@/lib/sql-delivery';

export const maxDuration=90;
function allowed(request:Request) {
  const configured=process.env.LKH_DELIVERY_SECRET;
  const received=request.headers.get('authorization') || '';
  if(!configured || !received.startsWith('Bearer ')) return false;
  const a=Buffer.from(received.slice(7)),b=Buffer.from(configured);
  return a.length===b.length && timingSafeEqual(a,b);
}
export async function POST(request:Request) {
  if(!allowed(request)) return Response.json({ok:false},{status:401});
  if(!process.env.DATABASE_URL) return Response.json({ok:false,code:'SQL_INTAKE_DISABLED'},{status:503});
  try{return Response.json({ok:true,...await drainSqlDelivery(65000)},{headers:{'Cache-Control':'no-store'}});}
  catch {return Response.json({ok:false,code:'DELIVERY_RETRY_REQUIRED'},{status:503});}
}
export async function GET(request:Request) {
  if(!allowed(request)) return Response.json({ok:false},{status:401});
  if(!process.env.DATABASE_URL) return Response.json({ok:false},{status:503});
  const sql=sqlDatabase();
  const counts=await sql`SELECT delivery_state,count(*)::int AS count,min(received_at) AS oldest FROM lkh_reports GROUP BY delivery_state`;
  const review=await sql`SELECT id,last_error,attempts FROM lkh_reports WHERE delivery_state='NEEDS_REVIEW' ORDER BY received_at LIMIT 50`;
  return Response.json({ok:true,counts,review},{headers:{'Cache-Control':'no-store'}});
}
