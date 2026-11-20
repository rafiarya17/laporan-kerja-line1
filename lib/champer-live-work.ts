import type { State } from './champer-core';
import {workShift} from './welding-shift';

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

export function shiftWork(state: State, now: number) {
  const period = workShift(new Date(now));
  const jobs = state.jobs.filter(j=>j.target.line==='LINE_99' && j.target.machine==='AUTO CHAMPER' &&
    j.target.date===period.date && Number(j.target.shift)===period.shift);
  const completed = jobs.filter(j=>j.state==='COMPLETED_PILOT');
  const ok = completed.every(j=>j.quality && /^\d+$/.test(j.quality.ok))
    ? completed.reduce((n,j)=>n+Number(j.quality!.ok),0) : null;
  const open = jobs.find(j=>!['COMPLETED_PILOT','CANCELLED','CLOSED_REVIEW'].includes(j.state));
  const start = open?.start && state.commands.find(c=>c.id===open.start && c.jobId===open.id &&
    c.purpose==='START' && c.status==='RECORDED')?.evidence?.result;
  return {...period, ok, completed:completed.length,
    session:open?{part:open.target.part,state:open.state,
      baseline:start?{value:Number(start.counter_raw),observedAt:Date.parse(start.observed_at),collector:start.collector_id}:null,
      endDelta:open.state==='END_CAPTURED' && open.delta!==null?Number(open.delta):null}:null};
}
