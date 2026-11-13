(function(root){
 'use strict';
 const qty=v=>v!==null&&v!==undefined&&String(v).trim()!==''&&Number.isSafeInteger(Number(v))&&Number(v)>=0?Number(v):null;
 const machine=r=>String(r.machine||r.machineId||'').trim().toUpperCase();
 const key=r=>JSON.stringify([r.line,machine(r)]);
 function periods(start,end,shift){
  const valid=s=>/^\d{4}-\d{2}-\d{2}$/.test(s)&&Number.isFinite(Date.parse(s))&&new Date(s).toISOString().slice(0,10)===s;
  if(!valid(start)||!valid(end)||end<start)throw Error('Pilih rentang tanggal yang benar.');
  const days=(Date.parse(end)-Date.parse(start))/86400000+1;
  if(days>31)throw Error('Maksimal 31 hari per pemuatan. Pecah rentang yang lebih panjang agar penerima tetap ringan.');
  if(!['1','2','all'].includes(shift))throw Error('Shift tidak valid.');
  return Array.from({length:days},(_,i)=>new Date(Date.parse(start)+i*86400000).toISOString().slice(0,10)).flatMap(date=>(shift==='all'?['1','2']:[shift]).map(s=>({date,shift:s})));
 }
 function summarize(snapshots,catalog,line,selectedMachine){
  const allowed=r=>(line?r.line===line:/^LINE_[1-8]$/.test(r.line))&&(!selectedMachine||machine(r)===selectedMachine);
  const rows=new Map();
  function row(r){const k=key(r);if(!rows.has(k))rows.set(k,{line:r.line,machine:machine(r),ok:0,repair:0,reject:0,target:0,reports:0,published:0,publishedOk:0,targetItems:0,invalid:0});return rows.get(k);}
  catalog.filter(allowed).forEach(row);
  for(const s of snapshots){
   const targets=new Map();
   for(const t of s.targets||[])for(const i of t.items||[]){const r={...i,line:i.line||t.line};if(allowed(r))targets.set(JSON.stringify([key(r),String(r.part||'').trim().toUpperCase()]),r);}
   for(const t of targets.values()){const r=row(t),n=qty(t.targetQty);r.targetItems++;if(n===null)r.invalid++;else r.target+=n;}
   const reports=new Map((s.reports||[]).filter(allowed).map(r=>[r.id,r]));
   for(const v of reports.values()){
    const r=row(v);r.reports++;if(!v.id){r.invalid++;continue;}
    for(const k of ['ok','repair','reject']){const n=qty(v.input&&v.input[k]);if(n===null)r.invalid++;else r[k]+=n;}
    if(v.state==='PUBLISHED'){r.published++;const n=qty(v.input&&v.input.ok);if(n!==null)r.publishedOk+=n;}
   }
  }
  return [...rows.values()].sort((a,b)=>Number(a.line.split('_')[1])-Number(b.line.split('_')[1])||a.machine.localeCompare(b.machine));
 }
 function classify(url,origin){
  const u=new URL(url,origin);if(u.origin!==origin)return null;
  const p=u.pathname;
  if(p==='/')return {view:'form',path:p+u.search};
  if(p==='/portal.html')return {view:u.hash.slice(1)||'ringkasan'};
  const view=({'/leader':'target','/leader.html':'target','/pekerjaan.html':'pekerjaan','/champer-plc.html':'sesi','/champer-simulasi.html':'simulasi','/monitor-live.html':'live'})[p];
  if(!view)return null;
  return {view:view==='target'&&u.searchParams.get('tab')==='reports'?'laporan':view,path:p+u.search};
 }
 const api={qty,machine,key,periods,summarize,classify};if(typeof module!=='undefined')module.exports=api;else root.PortalCore=api;
})(typeof window==='undefined'?{}:window);
