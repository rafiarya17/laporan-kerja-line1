// Pilot of the physical AUTO CHAMPER, MASTER_CT row 10 (checked 2026-11-23).
const parts = new Map([
  ['PIPE 1_BLS-E475A-0000-0305', {pcsPerCount:1, cycleSeconds:6}]
]);

export function champerSessionKpis(job,count,asOf) {
  const rule=parts.get(job?.part);
  if(!rule || !Number.isSafeInteger(count) || count<0 || !job.baseline ||
      job.state.includes('REVIEW') || job.count?.source==='review')return {};
  const pcs=count*rule.pcsPerCount;
  const elapsed=(asOf-job.baseline.observedAt)/1000;
  return {pcs, efficiency:job.targetQty>0?pcs/job.targetQty:null,
    performance:Number.isFinite(asOf)&&elapsed>0?pcs*rule.cycleSeconds/elapsed:null,
    cycleSeconds:rule.cycleSeconds,pcsPerCount:rule.pcsPerCount};
}
