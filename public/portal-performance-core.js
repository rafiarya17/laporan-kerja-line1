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
 function datesBetween(start,end){
  const parse=value=>{const date=new Date(value+'T00:00:00Z');return /^\d{4}-\d{2}-\d{2}$/.test(value)&&Number.isFinite(date.getTime())&&date.toISOString().slice(0,10)===value?date:null;};
  const first=parse(start),last=parse(end);
  if(!first||!last||first>last)throw Error('Isi tanggal awal dan akhir yang sah. Tanggal akhir harus sama atau sesudah tanggal awal.');
  const dates=[];
  for(let day=first.getTime();day<=last.getTime();day+=86400000)dates.push(new Date(day).toISOString().slice(0,10));
  return dates;
 }
 function aggregate(rows){
  const results=rows.map(calculate);
  const sum=field=>rows.reduce((total,row)=>total+row[field],0);
  const complete=predicate=>rows.length>0&&rows.every(predicate);
  const time=results.length>0&&results.every(r=>r.validTime);
  const quality=results.length>0&&results.every(r=>r.validQuality);
  const speed=results.length>0&&results.every(r=>r.efficiency!==null);
  const counter=complete(row=>count(row.total)&&row.counterValid);
  const target=complete(row=>finite(row.target));
  const planned=time?sum('planned'):null,run=time?sum('run'):null;
  const earned=speed?rows.reduce((n,row)=>n+row.total*row.cycleSeconds/60,0):null;
  const productive=speed&&quality?rows.reduce((n,row)=>n+row.good*row.cycleSeconds/60,0):null;
  const total=counter?sum('total'):null,good=quality?sum('good'):null;
  const classified=complete(row=>row.qualityVerified===true&&['good','repair','reject'].every(k=>count(row[k])));
  const data={planned,run,total,good:classified?sum('good'):null,repair:classified?sum('repair'):null,reject:classified?sum('reject'):null,target:target?sum('target'):null,qualityVerified:classified,cycleSeconds:null};
  const reasons=[...new Set(results.flatMap(r=>r.reasons))];
  return {data,availability:time?run/planned:null,performance:speed&&run>0?earned/run:null,
   quality:quality&&total>0?good/total:null,oee:productive!==null?productive/planned:null,
   efficiency:speed?earned/planned:null,attainment:quality&&data.target>0?good/data.target:null,
   reasons,validTime:time,validQuality:quality,unclassified:counter&&complete(row=>['good','repair','reject'].every(k=>count(row[k])))?total-sum('good')-sum('repair')-sum('reject'):null,
   losses:{stop:time?planned-run:null,speed:speed?run-earned:null,quality:productive!==null?earned-productive:null,productive}};
 }
 const api={calculate,example,aggregate,datesBetween};if(typeof module==='object'&&module.exports)module.exports=api;else root.PortalPerformanceCore=api;
})(typeof window==='object'?window:globalThis);
