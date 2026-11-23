const test=require('node:test');
const assert=require('node:assert/strict');
const {validateTelemetry}=require('../.test-build/champer-telemetry.js');

test('timed read-only samples retain independent durations and count overlap once',async()=>{
  const {sampleShift}=await import('../local-bridge/shift-signals.mjs');
  const from=Date.parse('2026-11-23T07:30:00+07:00');
  let s=null;
  for(const [offset,m,d] of [[0,0,0],[5,1,0],[10,1,1],[15,0,1],[20,0,0],[25,0,0]])
    s=sampleShift(s,from+offset*1000,m,d);
  assert.deepEqual([s.mtcMs,s.dandoriMs,s.down,s.covered],[10000,10000,15000,25000]);
  s=sampleShift(s,from+45000,0,0);
  assert.equal(s.covered,25000);
  s=sampleShift(s,from+50000,1,null);
  assert.equal(s.covered,25000);
  assert.equal(s.mtcKnown,30000);
  const payload={collectorId:'test',machine:'AUTO_CHAMPER',tag:'DXP|Device1|D100',sentAt:s.at,localReady:true,status:'UNKNOWN',reading:null,calls:s};
  assert.deepEqual(validateTelemetry(payload,'test',s.at).calls,s);
  assert.throws(()=>validateTelemetry({...payload,calls:{...s,down:s.covered+1}},'test',s.at));
});
test('samples straddling a WIB shift boundary allocate only their own interval',async()=>{
  const {sampleShift}=await import('../local-bridge/shift-signals.mjs');
  const boundary=Date.parse('2026-11-23T19:30:00+07:00');
  const prev=sampleShift(null,boundary-3000,1,1);
  let archived;
  const next=sampleShift(prev,boundary+2000,0,0,s=>{archived=s;});
  assert.equal(next.start,boundary);assert.equal(next.down,2000);assert.equal(archived.down,3000);
  assert.equal(sampleShift(next,boundary,1,1),next);
});
