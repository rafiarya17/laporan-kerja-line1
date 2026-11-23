const {test}=require('node:test');
const assert=require('node:assert/strict');
const {telemetryStore}=require('../.test-build/champer-telemetry');
test('progress, plan to date and runtime performance use separate denominators',async()=>{
  const {champerSessionKpis:calc}=await import('../app/dashboard/champer-session-kpis.mjs');
  const job={part:'PIPE 1_BLS-E475A-0000-0305',state:'ACTIVE',baseline:{observedAt:1000},targetQty:1000};
  const time={from:1000,to:601000,down:60000,covered:600000};
  const result=calc(job,90,601000,2,time);
  assert.equal(result.progress,.09);
  assert.equal(result.performance,1);
  assert.equal(result.efficiency,1.08);
  assert.equal(calc(job,90,601000,null,time).efficiency,null);
  assert.equal(calc(job,90,601000,2,null).performance,null);
  assert.equal(calc(job,90,8001000,2,time).plannedQty,1000);
  assert.equal(calc(job,90,1000,2,null).efficiency,null);
});
test('downtime outside the session is excluded even when both edges fall between samples',async()=>{
  const points=[[2000,2000,1300],[4000,4000,2300],[1000,1000,300],[5000,5000,2300]];
  const read=telemetryStore('https://test.upstash.io','t',async()=>({ok:true,json:async()=>({result:points.map(p=>JSON.stringify(p))})}));
  assert.deepEqual(await read.sessionTime(1500,4500),{from:1500,to:4500,down:1500,covered:3000});
});
test('session timing and target to date remain visible without a verified conversion',async()=>{
  const {champerSessionKpis:calc}=await import('../app/dashboard/champer-session-kpis.mjs');
  const job={part:'PIECE_CONVERSION_UNVERIFIED',state:'ACTIVE',baseline:{observedAt:1000},targetQty:2100};
  const time={from:1000,to:601000,down:60000,covered:600000};
  const result=calc(job,31,601000,3.5,time);
  assert.equal(result.plannedQty,100);
  assert.equal(result.runMs,540000);
  assert.equal(result.pcs,null);
  assert.equal(result.efficiency,null);
  assert.equal(result.performance,null);
  assert.equal(result.awaitingConversion,true);
  const bpa=calc({...job,part:'PIPE 1_BPA-E4742-0000-0335'},90,601000,3.5,time);
  assert.equal(bpa.pcs,90);
  assert.equal(bpa.performance,1);
  assert.equal(bpa.efficiency,.9);
  assert.equal(bpa.provisional,true);
});
