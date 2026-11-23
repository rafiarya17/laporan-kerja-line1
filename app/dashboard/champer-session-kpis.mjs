// Cycle times are from MASTER_CT rows 9–10, checked 2026-11-23.
// A cycle time in seconds per piece does not establish how D100 counts pieces.
const parts = new Map([
  ['PIPE 1_BPA-E4742-0000-0335', {pcsPerCount:1, cycleSeconds:6, provisional:true}],
  ['PIPE 1_BLS-E475A-0000-0305', {pcsPerCount:1, cycleSeconds:6}]
]);

export function champerSessionKpis(job,count,asOf,hours,sessionTime) {
  if(!job?.baseline || job.state.includes('REVIEW') || job.count?.source==='review')return {};
  const rule=parts.get(job.part);
  const validCount=Number.isSafeInteger(count)&&count>=0;
  const pcs=validCount&&rule?.pcsPerCount>0?count*rule.pcsPerCount:null;
  const elapsed=Number.isFinite(asOf)?asOf-job.baseline.observedAt:0;
  const target=job.targetQty;
  const plannedQty=hours>0 && Number.isFinite(hours) && target>0 && elapsed>0
    ?target*Math.min(1,elapsed/(hours*3600000)):null;
  const measured=sessionTime && sessionTime.from>=job.baseline.observedAt && sessionTime.to<=asOf &&
    sessionTime.covered>0 && sessionTime.covered<=elapsed && sessionTime.down>=0 && sessionTime.down<=sessionTime.covered;
  const runMs=measured?elapsed-sessionTime.down:null;
  return {pcs,progress:pcs!=null&&target>0?pcs/target:null,plannedQty,
    efficiency:pcs!=null&&plannedQty>0?pcs/plannedQty:null,
    performance:pcs!=null&&rule.cycleSeconds>0&&runMs>0?pcs*rule.cycleSeconds*1000/runMs:null,
    runMs,partial:measured&&elapsed-sessionTime.covered>15000,
    cycleSeconds:rule?.cycleSeconds,pcsPerCount:rule?.pcsPerCount,
    awaitingConversion:validCount&&pcs==null,provisional:pcs!=null&&rule.provisional===true};
}
