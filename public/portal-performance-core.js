(function(root){'use strict';
 const finite=n=>typeof n==='number'&&Number.isFinite(n)&&n>=0;
 const count=n=>Number.isSafeInteger(n)&&n>=0;
 function calculate(d){
  const reasons=[];
  const time=finite(d.planned)&&d.planned>0&&finite(d.run)&&d.run<=d.planned&&d.timeVerified===true;
  const qty=count(d.total)&&d.counterValid===true;
  const quality=qty&&['good','repair','reject'].every(k=>count(d[k]))&&d.good+d.repair+d.reject===d.total&&d.qualityVerified===true;
  const ideal=finite(d.cycleSeconds)&&d.cycleSeconds>0&&d.cycleVerified===true;
  const earned=qty&&ideal?d.total*d.cycleSeconds/60:null;
  const speedValid=earned!==null&&time&&earned<=d.run+1e-8;
  if(!time)reasons.push('Waktu rencana / berjalan belum lengkap atau belum terverifikasi.');
  if(!qty)reasons.push('Counter periode belum sah / pembaruan terputus.');
  if(!ideal)reasons.push('Cycle time ideal per part belum terverifikasi.');
  if(!quality)reasons.push('Klasifikasi kualitas belum lengkap atau tidak sesuai total.');
  if(earned!==null&&time&&!speedValid)reasons.push('Waktu ideal melebihi waktu berjalan: periksa CT, jumlah pcs per siklus, dan counter.');
  const a=time?d.run/d.planned:null,p=speedValid&&d.run>0?earned/d.run:null,q=quality&&d.total>0?d.good/d.total:null;
  const efficiency=speedValid?earned/d.planned:null;
  // A verified full planned period with zero running/output has OEE 0;
  // its speed and quality denominators remain undefined, not 100%.
  const oee=time&&speedValid&&quality?d.good*d.cycleSeconds/60/d.planned:null;
  return {availability:a,performance:p,quality:q,oee,efficiency,attainment:quality&&finite(d.target)&&d.target>0?d.good/d.target:null,
   reasons,unclassified:qty&&['good','repair','reject'].every(k=>count(d[k]))?d.total-d.good-d.repair-d.reject:null,
   losses:{stop:time?d.planned-d.run:null,speed:speedValid?d.run-earned:null,quality:speedValid&&quality?(d.total-d.good)*d.cycleSeconds/60:null,productive:oee===null?null:d.good*d.cycleSeconds/60},validTime:time,validQuality:quality};
 }
 function example(state,shift,missing){
  const r=root.PortalMonitor?root.PortalMonitor.result(state,'shift'):null;
  const total=r?r.actual:state.completed+state.raw-state.baseline;
  const second=String(shift)==='2';
  return {planned:480,run:second?0:400,total,good:second?0:80,repair:second?0:25,reject:second?0:15,target:state.shiftTarget,cycleSeconds:120,
   timeVerified:missing!=='time',cycleVerified:missing!=='cycle',qualityVerified:missing!=='quality',counterValid:state.available&&Number.isSafeInteger(total)&&total>=0};
 }
 const api={calculate,example};if(typeof module==='object'&&module.exports)module.exports=api;else root.PortalPerformanceCore=api;
})(typeof window==='object'?window:globalThis);
