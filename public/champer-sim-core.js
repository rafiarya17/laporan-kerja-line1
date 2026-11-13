(function(root){
'use strict';
const MACHINE='AUTO CHAMPER', LINE='LINE_99', DATASET='CHAMPER_SIMULATION';
const copy=v=>JSON.parse(JSON.stringify(v));
const integer=(v)=>Number.isSafeInteger(v)&&v>=0&&v<=999999999;
function demand(ok,message){if(!ok)throw Error(message);}
function targets(snapshot,date,shift){
 demand(snapshot&&snapshot.date===date&&String(snapshot.shift)===shift,'Konteks target tidak cocok. Muat ulang.');
 return (snapshot.targets||[]).filter(t=>t.line===LINE).flatMap(t=>(t.items||[]).filter(i=>i.machine===MACHINE&&(!i.line||i.line===LINE)).map(i=>{
 demand(Number.isSafeInteger(t.version)&&t.version>0&&typeof i.part==='string'&&i.part.trim()&&integer(i.targetQty)&&i.targetQty>0,'Target Champer belum lengkap.');
 return {date,shift,line:LINE,machine:MACHINE,part:i.part,targetQty:i.targetQty,version:t.version,key:JSON.stringify([date,shift,LINE,MACHINE,i.part])};
 }));
}
function initial(date){return {schema:1,dataset:DATASET,revision:0,counter:1000,targets:targets({date,shift:'1',targets:[{line:LINE,version:1,items:[{machine:MACHINE,part:'PART-CONTOH-A',targetQty:100},{machine:MACHINE,part:'PART-CONTOH-B',targetQty:60}]}]},date,'1'),targetSource:'CONTOH',jobs:[]};}
function active(s){return s.jobs.find(j=>!['COMPLETED','CANCELLED'].includes(j.state));}
function apply(state,event){
 demand(state.dataset===DATASET&&state.schema===1,'Penyimpanan uji tidak dikenali.');
 demand(typeof event.id==='string'&&event.id.length>0,'ID tindakan diperlukan.');
 const s=copy(state),previous=s.jobs.flatMap(j=>j.actions).find(a=>a.id===event.id);
 const fingerprint=JSON.stringify(event);
 if(previous){demand(previous.fingerprint===fingerprint,'ID tindakan dipakai dengan isi berbeda.');return s;}
 if(event.expectedRevision!==undefined)demand(event.expectedRevision===s.revision,'Sesi berubah di tab lain. Periksa tampilan terbaru sebelum mencoba lagi.');
 let j=active(s);
 if(event.type==='TARGETS'){
  demand(!j,'Selesaikan atau batalkan sesi sebelum mengganti target.');
  demand(Array.isArray(event.targets)&&event.targets.every(t=>t.machine===MACHINE&&t.line===LINE&&integer(t.targetQty)&&t.targetQty>0),'Target simulasi hanya untuk AUTO CHAMPER LINE 99 Uji.');
  s.targets=copy(event.targets);s.targetSource=event.source;
 }else if(event.type==='CREATE'){
  demand(!j,'Masih ada sesi Champer yang belum ditutup.');
  const t=s.targets.find(t=>t.key===event.targetKey);demand(t,'Pilih target yang tersedia.');
  demand(event.operators?.length&&event.operators.every(o=>['Operator Contoh A','Operator Contoh B','Helper Contoh'].includes(o))&&new Set(event.operators).size===event.operators.length,'Pilih operator/helper contoh tanpa duplikasi.');
  demand(!s.jobs.some(x=>x.id===event.jobId),'ID sesi sudah ada.');
  j={id:event.jobId,dataset:DATASET,reportId:'SIM-LKH-'+event.jobId,target:copy(t),targetSource:s.targetSource,operators:copy(event.operators),state:'DRAFT',createdAt:event.at,start:null,end:null,delta:null,quality:null,actions:[]};s.jobs.push(j);
 }else{
  demand(j,'Tidak ada sesi aktif.');
  if(event.type==='START'){
   demand(['DRAFT','START_FAILED'].includes(j.state),'Sesi sudah dimulai.');
   if(event.fail){j.state='START_FAILED';j.error='Pembacaan awal simulasi timeout. Sesi belum aktif.';}
   else{j.start={value:s.counter,at:event.at,source:'SIMULATOR'};j.state='ACTIVE';j.error=null;}
  }else if(event.type==='ADD'){
   demand(j.state==='ACTIVE'&&integer(event.qty)&&event.qty>0&&integer(s.counter+event.qty),'Penambahan hanya saat pekerjaan aktif.');s.counter+=event.qty;
  }else if(event.type==='END'){
   demand(['ACTIVE','END_FAILED'].includes(j.state),'Sesi belum siap diakhiri.');
   if(event.fail){j.state='END_FAILED';j.error='Pembacaan akhir simulasi timeout. Nilai akhir belum tersedia.';}
   else{j.end={value:event.reset?0:s.counter,at:event.at,source:'SIMULATOR'};j.delta=j.end.value>=j.start.value?j.end.value-j.start.value:null;j.state=j.delta===null?'REVIEW_REQUIRED':'END_CAPTURED';j.error=j.delta===null?'Counter turun. Hasil perlu pemeriksaan; jangan pakai selisih negatif.':null;}
  }else if(event.type==='COMPLETE'){
   demand(j.state==='END_CAPTURED','Dua pembacaan yang sah diperlukan.');
   const q=event.quality;demand(q&&[q.ok,q.repair,q.reject].every(integer),'Isi hasil dengan bilangan bulat nonnegatif.');
   demand(q.ok+q.repair+q.reject===j.delta,'Untuk simulasi ini, OK + repair + reject harus sama dengan selisih counter.');
   demand(['Ada','Tidak'].includes(q.problem),'Pilih kondisi kendala.');
   demand(!(q.repair||q.reject)||q.problem==='Ada','Repair/reject memerlukan keterangan kendala.');
   if(q.problem==='Ada')demand(['MANUSIA','MESIN','MATERIAL','METODE'].includes(q.category)&&['detail','action','pic'].every(k=>typeof q[k]==='string'&&q[k].trim().length>0&&q[k].length<=1000),'Lengkapi klasifikasi, masalah, tindakan, dan PIC.');
   j.quality=copy(q);j.state='COMPLETED';j.completedAt=event.at;
  }else if(event.type==='CANCEL'){
   demand(typeof event.reason==='string'&&event.reason.trim().length>=5,'Isi alasan penutupan minimal 5 karakter.');j.state='CANCELLED';j.closeReason=event.reason;
  }else throw Error('Tindakan tidak dikenal.');
 }
 if(j)j.actions.push({id:event.id,type:event.type,at:event.at??null,fingerprint});
 s.revision++;return s;
}
const api={MACHINE,LINE,DATASET,initial,targets,active,apply};if(typeof module!=='undefined')module.exports=api;else root.ChamperSim=api;
})(typeof window==='undefined'?{}:window);
