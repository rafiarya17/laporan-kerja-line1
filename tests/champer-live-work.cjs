const {test}=require('node:test');
const assert=require('node:assert/strict');
const {workShift}=require('../.test-build/welding-shift');
const {shiftPlan,shiftWork}=require('../.test-build/champer-live-work');
const at=Date.parse('2026-11-20T10:00:00+07:00');
const target={date:'2026-11-20',shift:'1',line:'LINE_99',machine:'AUTO CHAMPER',part:'A'};
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
 assert.deepEqual(shiftWork(state,at),{date:target.date,shift:1,ok:0,completed:0,session:null});
 jobs.push({target,state:'COMPLETED_PILOT',quality:{ok:'9'}},{target:{...target,shift:'2'},state:'COMPLETED_PILOT',quality:{ok:'111'}},
 {id:'job',target,state:'ACTIVE',start:'cmd',operators:['PERSON']});
 commands.push({id:'cmd',purpose:'START',jobId:'job',status:'RECORDED',evidence:{result:{counter_raw:'18472',observed_at:new Date(at).toISOString(),collector_id:'R'}}});
 const output=shiftWork(state,at);assert.equal(output.ok,9);assert.equal(output.completed,1);
 assert.deepEqual(output.session,{state:'ACTIVE',part:'A',baseline:{value:18472,observedAt:at,collector:'R'},endDelta:null});
});
