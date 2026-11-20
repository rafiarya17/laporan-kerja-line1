const {test}=require('node:test');
const assert=require('node:assert/strict');
const {workShift}=require('../.test-build/welding-shift');
const {shiftPlan,shiftWork,liveBoard}=require('../.test-build/champer-live-work');
const at=Date.parse('2026-11-20T10:00:00+07:00');
const target={date:'2026-11-20',shift:'1',line:'LINE_99',machine:'AUTO CHAMPER',part:'A',targetQty:100};
test('Jakarta production day changes at 07:30 and night shift starts at 19:30',()=>{
 for(const [iso,date,shift] of [['2026-11-20T07:29','2026-11-19',2],['2026-11-20T07:30','2026-11-20',1],['2026-11-20T19:30','2026-11-20',2],['2026-11-21T01:00','2026-11-20',2]]){
  assert.deepEqual(workShift(new Date(iso+':00+07:00')),{date,shift});
 }
});
test('current shift target includes all and only pilot parts, independent of the machine state',()=>{
 const period=workShift(new Date(at));
 const items=[{machine:'AUTO CHAMPER',part:'A',targetQty:80},{machine:'AUTO CHAMPER',part:'B',targetQty:20},{machine:'OTHER',part:'C',targetQty:90}];
 const data={...period,targets:[{line:'LINE_1',items},{line:'LINE_99',items}]};
 assert.deepEqual(shiftPlan(data,period),{...period,parts:[{part:'A',targetQty:80},{part:'B',targetQty:20}],total:100});
 assert.throws(()=>shiftPlan({...data,shift:2},period));
});
test('recorded zero before Start, completed OK once per job, current session projection omits identity',()=>{
 const jobs=[],commands=[],state={jobs,commands};
 assert.deepEqual(shiftWork(state,at),{date:target.date,shift:1,ok:0,completed:0,session:null,lastEnded:null});
 jobs.push({target,state:'COMPLETED_PILOT',quality:{ok:'9'}},{target:{...target,shift:'2'},state:'COMPLETED_PILOT',quality:{ok:'111'}},
 {id:'job',target,state:'ACTIVE',start:'cmd',operators:['PERSON']});
 commands.push({id:'cmd',purpose:'START',jobId:'job',status:'RECORDED',evidence:{result:{counter_raw:'18472',observed_at:new Date(at).toISOString(),collector_id:'R'}}});
 const output=shiftWork(state,at);assert.equal(output.ok,9);assert.equal(output.completed,1);
 assert.deepEqual(output.session,{id:'job',date:target.date,shift:target.shift,targetQty:100,endedAt:null,observedEnd:null,state:'ACTIVE',part:'A',baseline:{value:18472,observedAt:at,collector:'R'},endDelta:null});
});
function recorded(id,purpose,value,ms,sequence,reset='r1'){
 return {id,purpose,jobId:'job',status:'RECORDED',evidence:{result:{counter_raw:String(value),observed_at:new Date(ms).toISOString(),
  collector_id:'R',machine_id:'AUTO_CHAMPER',tag_id:'D100',sequence:String(sequence),reset_marker:reset}}};
}
const raw=(value,observedAt,eventId='R:sample')=>({reading:{value,observedAt,eventId}});
test('Start displays zero immediately, then tracks D100 while OK remains pending',()=>{
 const state={jobs:[{id:'job',state:'ACTIVE',target,start:'a'}],commands:[recorded('a','START',18472,at,1)]};
 const board=t=>liveBoard(state,t,at+10000);
 assert.deepEqual(board(raw(18470,at-100)).session.count,{value:0,at,source:'start'});
 assert.deepEqual(board(raw(18483,at+9000)).session.count,{value:11,at:at+9000,source:'reading'});
 assert.equal(board(raw(18471,at+100)).session.count.value,null);
 assert.equal(board(raw(18475,at+100,'OTHER:x')).session.count.value,null);
 assert.equal(board(raw(18483,at+9000)).ok,0);
 assert.equal(board({reading:null,shiftCounter:{collector:'R',lastAt:at+100,lastValue:18477}}).session.count.value,5);
 const overnight=liveBoard(state,null,at+14*3600000);
 assert.equal(overnight.shift,2);assert.equal(overnight.session.shift,'1');
});
test('captured End pins its count through completion, refresh and a new Start',()=>{
 const job={id:'job',state:'END_CAPTURED',target,start:'a',end:'b',delta:'11'};
 const state={jobs:[job],commands:[recorded('a','START',1000,at,1),recorded('b','END',1011,at+12000,2)]};
 const board=()=>liveBoard(state,raw(1250,at+30000),at+40000);
 assert.equal(board().session.count.value,11);assert.equal(board().lastEnded.endedAt,at+12000);
 job.state='COMPLETED_PILOT';job.quality={ok:'9'};
 assert.equal(board().session,null);assert.equal(board().lastEnded.endDelta,11);assert.equal(board().ok,9);
 state.jobs.push({id:'next',state:'ACTIVE',target,start:'c'});
 state.commands.push({...recorded('c','START',1250,at+31000,3),jobId:'next'});
 assert.equal(board().session.count.value,0);assert.equal(board().lastEnded.endDelta,11);
});
test('reviewed five-digit End is visibly provisional and never credits OK; reset has no delta',()=>{
 const job={id:'job',target,state:'REVIEW_REQUIRED',start:'a',end:'b',delta:null};
 const state={jobs:[job],commands:[recorded('a','START',18472,at,1),recorded('b','END',18483,at+12000,2)]};
 let b=liveBoard(state,null,at+15000);assert.deepEqual(b.session.count,{value:11,at:at+12000,source:'review'});assert.equal(b.ok,0);assert.equal(b.lastEnded.endDelta,null);assert.equal(b.lastEnded.observedEnd,11);
 state.commands[1]=recorded('b','END',18483,at+12000,2,'r2');
 b=liveBoard(state,null,at+15000);assert.equal(b.session.count.value,null);assert.equal(b.lastEnded.endDelta,null);
});
test('dashboard reads job state and live reading in one read-only Redis operation',async()=>{
 const {redisStore}=require('../.test-build/champer-store');const calls=[];
 const store=redisStore('https://test.upstash.io','test','jobs',async(_,opts)=>{
  calls.push(JSON.parse(opts.body));return Response.json({result:[null,null]});
 });
 const snapshot=await store.readBoard();assert.equal(snapshot.state.jobs.length,0);assert.equal(snapshot.telemetry,null);
 assert.deepEqual(calls,[['MGET','jobs','berlindo:champer:pilot:telemetry:v1']]);
});
