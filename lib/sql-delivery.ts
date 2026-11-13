import { randomUUID } from 'node:crypto';
import { callReceiver, ReceiverError } from './receiver';
import { sqlDatabase } from './sql-intake';
import type { Submission } from './lkh';

type ReceiverCall = typeof callReceiver;
export function deliveryNeedsReview(code: string) {
  return /CONFLICT|DUPLICATE|REMOVED|CANCELLED|NEEDS_REVIEW|INVALID_SUBMISSION|INVALID_PROCESS_TIME|INVALID_QTY|INVALID_DANDORI|INVALID_STATUS|INVALID_ISSUE_TIME|INCOMPLETE_ISSUE|REPAIR_REJECT_NEEDS_ISSUE/.test(code);
}
export async function forwardSqlReport(payload: Submission, call: ReceiverCall = callReceiver) {
  // Receiver submit is idempotent. A timeout after its commit is retried with the same payload and ID.
  const result = await call('submit',payload,22000);
  const receipt=result.receipt;
  if (!receipt || receipt.id!==payload.id || receipt.mode!=='production' || receipt.state!=='QUEUED' || !Number.isFinite(Date.parse(receipt.receivedAt))) {
    throw new ReceiverError('INVALID_RECEIPT');
  }
  return receipt;
}

export async function drainSqlDelivery(budgetMs=55000, call: ReceiverCall=callReceiver) {
  // Preview is always isolated from the live receiver, even when production env is copied accidentally.
  if(process.env.VERCEL_ENV !== 'production' && call===callReceiver) return {skipped:'preview'};
  const sql=sqlDatabase(),owner=randomUUID(),start=Date.now();
  const [lock]=await sql`UPDATE lkh_delivery_worker SET owner=${owner}::uuid,lease_until=now()+interval '100 seconds',last_run_at=now()
    WHERE id=true AND lease_until<now() RETURNING id`;
  if(!lock) return {skipped:'worker-active'};
  let delivered=0,review=0;
  try {
    while(Date.now()-start<budgetMs-25000) {
      const [owned]=await sql`UPDATE lkh_delivery_worker SET lease_until=now()+interval '100 seconds' WHERE id=true AND owner=${owner}::uuid AND lease_until>now() RETURNING id`;
      if(!owned) break;
      const [job]=await sql`SELECT id,payload FROM lkh_reports WHERE delivery_state='PENDING' AND next_attempt_at<=now() ORDER BY next_attempt_at,received_at LIMIT 1`;
      if(!job) break;
      await sql`UPDATE lkh_reports SET attempts=attempts+1,next_attempt_at=now()+interval '100 seconds' WHERE id=${job.id}`;
      try {
        const receipt=await forwardSqlReport(job.payload as Submission,call);
        await sql`UPDATE lkh_reports SET delivery_state='DELIVERED',downstream_receipt=${JSON.stringify(receipt)}::jsonb,delivered_at=clock_timestamp(),last_error=NULL WHERE id=${job.id}`;
        delivered++;
      } catch(error) {
        const code=error instanceof ReceiverError ? error.code : 'DELIVERY_UNCONFIRMED';
        const state=deliveryNeedsReview(code)?'NEEDS_REVIEW':'PENDING';
        await sql`UPDATE lkh_reports SET delivery_state=${state},last_error=${code},next_attempt_at=now()+make_interval(secs=>LEAST(900,30*power(2,LEAST(attempts,5)))::int) WHERE id=${job.id}`;
        if(state==='NEEDS_REVIEW') review++;
        // Avoid repeated pressure on a busy or unavailable receiver within one run.
        else break;
      }
    }
    return {delivered,review};
  } finally {
    await sql`UPDATE lkh_delivery_worker SET owner=NULL,lease_until='-infinity' WHERE id=true AND owner=${owner}::uuid`;
  }
}
