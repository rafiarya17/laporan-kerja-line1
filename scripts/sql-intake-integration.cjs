/* eslint-disable @typescript-eslint/no-require-imports */
// Run ONLY against the isolated trial database. Does not call Apps Script/Telegram.
const assert=require('node:assert/strict');
const {randomUUID}=require('node:crypto');
const {neon,neonConfig}=require('@neondatabase/serverless');
const {initialForm}=require('../.test-build/lkh.js');
const {submitSqlReport,intakeMaster}=require('../.test-build/sql-intake.js');
const {drainSqlDelivery}=require('../.test-build/sql-delivery.js');
const {ReceiverError}=require('../.test-build/receiver.js');
if(!process.env.DATABASE_URL?.includes('ep-hidden-darkness-aooyqmpu')) throw Error('ISOLATED_TRIAL_DATABASE_REQUIRED');
// This remote harness crosses an HTTP proxy; production retains its 12-second per-query deadline.
if(process.env.SQL_TEST_PROXY_TIMEOUT==='1') neonConfig.fetchFunction=(url,options)=>fetch(url,{...options,signal:AbortSignal.timeout(120000)});
process.env.VERCEL_ENV='preview';
process.env.LKH_SQL_INTAKE='1';
process.env.LKH_SQL_PREVIEW='1';
const sql=neon(process.env.DATABASE_URL);
const ids=[];
function payload(){const id='LKH99-'+randomUUID();ids.push(id);return {id,line:'LINE_99',form:{...initialForm,tanggal:'2026-11-12',shift:'1',operator:['OPERATOR TEST A'],mesin:'PRESS DUMMY',part:'BODY_DUMMY-PN99001',jamMulaiProses:'08:00',jamSelesaiProses:'09:00',qtyOk:'100',qtyRepair:'0',qtyReject:'0',lembur:'No'}};}
function accepted(p){return {receipt:{id:p.id,mode:'production',state:'QUEUED',receivedAt:new Date().toISOString()}};}
(async()=>{
  await intakeMaster();
  // Keep prior runs' isolated load fixtures out of the worker fault scenarios.
  await sql`UPDATE lkh_reports SET next_attempt_at=now()+interval '1 year' WHERE master_version='sql-intake-preview-v1' AND delivery_state='PENDING'`;
  console.log('master ready');
  const times=[];
  const results=await Promise.all(Array.from({length:27},async()=>{const start=Date.now();const r=await submitSqlReport(payload());times.push(Date.now()-start);return r;}));
  assert(results.every(r=>r.status===200 && r.body.receipt.state==='SQL_SAVED'));
  console.log('27 concurrent inserts committed');
  const same=payload();
  const retries=await Promise.all(Array.from({length:27},()=>submitSqlReport(same)));
  assert(retries.every(r=>r.status===200));
  assert.equal(new Set(retries.map(r=>r.body.receipt.receivedAt)).size,1);
  const conflict=await submitSqlReport({...same,form:{...same.form,qtyOk:'999'}});
  assert.equal(conflict.status,502);assert.equal(conflict.body.clearPending,false);
  const bad=payload();bad.form.jamSelesaiProses='07:00';
  assert.equal((await submitSqlReport(bad)).status,400);
  const [badCount]=await sql`SELECT count(*)::int AS n FROM lkh_reports WHERE id=${bad.id}`;
  assert.equal(badCount.n,0);
  console.log('27 same-ID retries committed once');
  await sql`UPDATE lkh_reports SET next_attempt_at=now()+interval '1 year' WHERE id=ANY(${ids})`;
  const parallel=payload();await submitSqlReport(parallel);
  const calls=[];
  const fake=async(action,p)=>{assert.equal(action,'submit');calls.push(p.id);return accepted(p);};
  const workers=await Promise.all([drainSqlDelivery(65000,fake),drainSqlDelivery(65000,fake)]);
  assert(workers.some(w=>w.skipped==='worker-active'));
  assert.equal(new Set(calls).size,calls.length);
  console.log('parallel worker lease passed');
  const slow=payload();await submitSqlReport(slow);
  await drainSqlDelivery(65000,async()=>{throw new ReceiverError('RECEIVER_TIMEOUT');});
  const [pending]=await sql`SELECT delivery_state,last_error,attempts FROM lkh_reports WHERE id=${slow.id}`;
  assert.equal(pending.delivery_state,'PENDING');assert.equal(pending.last_error,'RECEIVER_TIMEOUT');
  await sql`UPDATE lkh_reports SET next_attempt_at=now() WHERE id=${slow.id}`;
  await drainSqlDelivery(65000,fake);
  const [done]=await sql`SELECT delivery_state,payload,attempts FROM lkh_reports WHERE id=${slow.id}`;
  assert.equal(done.delivery_state,'DELIVERED');assert.deepEqual(done.payload,slow);assert.equal(done.attempts,2);
  console.log('timeout recovered with original payload');
  const review=payload();await submitSqlReport(review);
  await drainSqlDelivery(65000,async()=>{throw new ReceiverError('SOURCE_REMOVED_REQUIRES_REVIEW');});
  const [held]=await sql`SELECT delivery_state FROM lkh_reports WHERE id=${review.id}`;
  assert.equal(held.delivery_state,'NEEDS_REVIEW');
  const expired=payload();await submitSqlReport(expired);
  await sql`UPDATE lkh_delivery_worker SET owner=${randomUUID()}::uuid,lease_until=now()-interval '1 second' WHERE id=true`;
  await drainSqlDelivery(65000,fake);
  const [recovered]=await sql`SELECT delivery_state FROM lkh_reports WHERE id=${expired.id}`;
  assert.equal(recovered.delivery_state,'DELIVERED');
  times.sort((a,b)=>a-b);
  console.log(JSON.stringify({ok:true,concurrent:27,sameIdRetries:27,duplicateCalls:false,invalidRejected:true,timeoutRecovered:true,reviewPreserved:true,expiredLeaseRecovered:true,minimumMs:times[0],p95Ms:times[25],maxMs:times[26],ids},null,2));
})().catch(e=>{console.error(e.name,e.message.replace(/postgresql:\/\/[^\s]+/g,'[redacted]'));process.exitCode=1;});
