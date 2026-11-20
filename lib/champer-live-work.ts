import type { State, Job, Evidence } from './champer-core';
import {workShift} from './welding-shift';

import type { Telemetry } from './champer-telemetry';

type Shift = ReturnType<typeof workShift>;
type PlanItem = {machine:string; part:string; targetQty:number};
type Workspace = {date:string; shift:string|number; targets:{line:string;items:PlanItem[]}[]};
export function shiftPlan(data:Workspace, period:Shift) {
  if (data?.date !== period.date || Number(data.shift) !== period.shift || !Array.isArray(data.targets)) throw Error('WRONG_SHIFT');
  const parts = data.targets.filter(t=>t.line==='LINE_99').flatMap(t=>t.items)
    .filter(i=>i.machine==='AUTO CHAMPER')
    .map(({part,targetQty})=>{
      if (typeof part!=='string' || !part.trim() || !Number.isSafeInteger(targetQty) || targetQty<0) throw Error('INVALID_TARGET');
      return {part,targetQty};
    });
  return {...period,parts,total:parts.reduce((n,p)=>n+p.targetQty,0)};
}

type Boundary = NonNullable<Evidence['result']>;
const closed = new Set(['COMPLETED_PILOT','CANCELLED','CLOSED_REVIEW']);
const inReview = (state:string) => state==='REVIEW_REQUIRED' || state==='CLOSED_REVIEW';

function displayEnd(job:Job, start?:Boundary, end?:Boundary) {
  if (!end) return null;
  if (job.delta != null && /^\d+$/.test(job.delta)) return Number(job.delta);
  // Five-digit readings are visible on this pilot monitor. The operator workflow still reviews them.
  if (!inReview(job.state) || !start || start.collector_id !== end.collector_id ||
      start.machine_id !== end.machine_id || start.tag_id !== end.tag_id ||
      start.reset_marker !== end.reset_marker || Date.parse(end.observed_at)<Date.parse(start.observed_at) ||
      !/^\d+$/.test(start.sequence) || !/^\d+$/.test(end.sequence) || BigInt(end.sequence)<=BigInt(start.sequence)) return null;
  const a=Number(start.counter_raw), b=Number(end.counter_raw);
  return Number.isSafeInteger(a) && Number.isSafeInteger(b) && a>=0 && b>=a && b>9999 ? b-a : null;
}

export function shiftWork(state:State, now:number) {
  const period=workShift(new Date(now));
  const jobs=state.jobs.filter(j=>j.target.line==='LINE_99' && j.target.machine==='AUTO CHAMPER');
  const completed=jobs.filter(j=>j.target.date===period.date && Number(j.target.shift)===period.shift && j.state==='COMPLETED_PILOT');
  const ok=completed.every(j=>j.quality && /^\d+$/.test(j.quality.ok))
    ? completed.reduce((n,j)=>n+Number(j.quality!.ok),0) : null;
  const commands=new Map(state.commands.filter(c=>c.status==='RECORDED').map(c=>[c.id,c]));
  function boundary(job:Job, purpose:'START'|'END') {
    const id=purpose==='START'?job.start:job.end;
    const c=id?commands.get(id):null;
    return c && c.jobId===job.id && c.purpose===purpose ? c.evidence?.result || undefined : undefined;
  }
  function describe(job:Job) {
    const start=boundary(job,'START'), end=boundary(job,'END');
    return {id:job.id,part:job.target.part,targetQty:job.target.targetQty,date:job.target.date,shift:job.target.shift,
      state:job.state,baseline:start?{value:Number(start.counter_raw),observedAt:Date.parse(start.observed_at),collector:start.collector_id}:null,
      endedAt:end?Date.parse(end.observed_at):null,endDelta:end && !inReview(job.state) ? displayEnd(job,start,end) : null,
      observedEnd:inReview(job.state) ? displayEnd(job,start,end) : null};
  }
  // The machine can still be working on the previous shift's job.
  const open=jobs.find(j=>!closed.has(j.state));
  let latest:Job|undefined, latestAt=-Infinity;
  for (const job of jobs) {
    const end=boundary(job,'END');
    if (!end) continue;
    const at=Date.parse(end.observed_at);
    if (at>=latestAt) {latest=job;latestAt=at;}
  }
  return {...period,ok,completed:completed.length,session:open?describe(open):null,lastEnded:latest?describe(latest):null};
}

type Session = NonNullable<ReturnType<typeof shiftWork>['session']>;
function sessionCount(job:Session, telemetry:Telemetry|null) {
  if (job.endedAt!==null) return {value:job.endDelta??job.observedEnd,at:job.endedAt,source:inReview(job.state)?'review':'end'};
  const start=job.baseline;
  if (!start || !['ACTIVE','END_PENDING','END_FAILED'].includes(job.state)) return {value:null,at:null,source:'waiting'};
  const meter=telemetry?.shiftCounter, r=telemetry?.reading;
  const uncertain={value:null,at:null,source:'review'};
  if (meter?.review && meter.lastAt>=start.observedAt) return uncertain;
  let at=start.observedAt, value=start.value;
  if (meter && meter.lastAt>=at) {
    if (meter.collector!==start.collector || meter.lastValue<start.value ||
        (meter.lastAt===at && meter.lastValue!==value)) return uncertain;
    at=meter.lastAt; value=meter.lastValue;
  }
  if (r && r.observedAt>=at) {
    if (!r.eventId.startsWith(start.collector+':') || r.value<value ||
        (r.observedAt===at && r.value!==value)) return uncertain;
    at=r.observedAt; value=r.value;
  }
  return {value:value-start.value,at,source:at===start.observedAt?'start':'reading'};
}

export function liveBoard(state:State, telemetry:Telemetry|null, now:number) {
  const work=shiftWork(state,now);
  return {...work,serverTime:now,machine:'AUTO_CHAMPER',line:'LINE_99',telemetry,
    session:work.session?{...work.session,count:sessionCount(work.session,telemetry)}:null};
}
