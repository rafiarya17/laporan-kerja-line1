'use strict';
const el=id=>document.getElementById(id),pendingKey='champer-cloud-pending-v1';
let snapshot=null,selected=null,current=null,pending=null,busy=false,timer=null,masterReady=false,qualityJob=null,reportEnabled=false;
const reportDrafts=new Map();
try{const t=JSON.parse(sessionStorage.getItem('champer-selected-target')||'null');if(t?.source==='LIVE_READ_ONLY')selected=t;pending=JSON.parse(localStorage.getItem(pendingKey)||'null');}catch{}
const messages={TABLET_PAIRING_REQUIRED:'Pasangkan tablet sebelum menggunakan pembacaan PLC.',CLOUD_BRIDGE_NOT_CONFIGURED:'Penghubung cloud belum diaktifkan. Ikuti pemasangan database dan PC terlebih dahulu.',LOCAL_COLLECTOR_NOT_READY:'Kolektor lokal belum siap. Buka API lokal dan sambungkan D100 di kolektor.',MACHINE_HAS_OPEN_JOB:'Champer sudah mempunyai sesi terbuka. Muat ulang untuk melanjutkannya.',TARGET_CHANGED_RELOAD:'Target leader telah berubah. Pilih kembali dari daftar pekerjaan.',REVISION_CONFLICT:'Sesi berubah pada perangkat lain. Muat ulang sebelum melanjutkan.',BUSY_RETRY_SAME_ID:'Permintaan bersamaan. Gunakan Kirim ulang permintaan yang sama.',ISSUE_REQUIRED:'Repair/reject memerlukan penjelasan kendala.',INVALID_QUANTITY:'Isi OK, Repair, dan Reject dengan bilangan bulat 0 atau lebih.',PAIRING_CODE_INVALID:'Kode pemasangan tidak cocok.'};
const states={DRAFT:'Siap dimulai',START_PENDING:'Menunggu counter awal',START_FAILED:'Counter awal belum diterima',ACTIVE:'Pekerjaan aktif',END_PENDING:'Menunggu counter akhir',END_FAILED:'Counter akhir belum diterima',END_CAPTURED:'Lengkapi hasil',REVIEW_REQUIRED:'Perlu pemeriksaan',COMPLETED_PILOT:'Selesai · pilot',CANCELLED:'Dibatalkan',CLOSED_REVIEW:'Ditutup untuk pemeriksaan'};
const closed=j=>['COMPLETED_PILOT','CANCELLED','CLOSED_REVIEW'].includes(j.state);
function notice(s){el('notice').textContent=s;}
function reportControls(j){
 const box=document.createElement('div');box.className='panel';
 const title=document.createElement('p');title.textContent='Laporan Line 99 Uji · LKH99-'+j.id;box.append(title);
 if(j.report?.state==='QUEUED'){
  const status=document.createElement('p');status.textContent='Diterima untuk pemeriksaan leader. Persetujuan, revisi dan TF Slip mengikuti alur Line 99 yang sudah ada.';box.append(status);
  const link=document.createElement('a');link.href='/leader?'+new URLSearchParams({date:j.target.date,shift:j.target.shift,line:'LINE_99'});link.textContent='Buka pemeriksaan leader';box.append(link);
 }else{
  const controls={};
  for(const [key,label,type] of [['lembur','Lembur?','select'],['jamMulaiKendala','Jam mulai kendala','time'],['jamSelesaiKendala','Jam selesai kendala','time']]){
   if(key!=='lembur'&&j.quality.issue!=='Ada')continue;
   const wrap=document.createElement('label');wrap.textContent=label;const input=document.createElement(type==='select'?'select':'input');
   if(type==='select'){for(const [v,t] of [['','Pilih'],['No','Tidak'],['Yes','Ya']])input.add(new Option(t,v));}else input.type=type;
   input.disabled=!!j.report;input.value=j.report?.payload.form[key]??reportDrafts.get(j.id)?.[key]??'';
   input.oninput=()=>reportDrafts.set(j.id,{...reportDrafts.get(j.id),[key]:input.value});
   wrap.append(input);box.append(wrap);controls[key]=input;
  }
  const note=document.createElement('p');note.textContent='Kirim sebagai laporan UJI, bukan pengesahan produksi. Jumlah OK/Repair/Reject berasal dari input operator; bukti counter tetap tersimpan di sesi cloud.';box.append(note);
  const button=document.createElement('button');button.textContent=j.report?'Periksa / kirim ulang ID yang sama':'Kirim laporan uji ke leader';button.disabled=busy;
  button.onclick=async()=>{if(busy)return;busy=true;button.disabled=true;try{await call('report',{jobId:j.id,revision:j.revision,lembur:controls.lembur.value,jamMulaiKendala:controls.jamMulaiKendala?.value||'',jamSelesaiKendala:controls.jamSelesaiKendala?.value||''});notice('Laporan uji diterima untuk pemeriksaan leader.');}catch(e){notice(e.message);}finally{busy=false;await refresh();}};box.append(button);
 }
 el('history').append(box);
}
async function call(path,body){const r=await andonFetch('/api/champer/'+path,{method:body===undefined?'GET':'POST',headers:{'content-type':'application/json'},body:body===undefined?undefined:JSON.stringify(body),cache:'no-store'});const b=await r.json();if(!r.ok){const e=Error(messages[b.error]||b.error||'Permintaan belum terkonfirmasi.');e.status=r.status;e.code=b.error;throw e;}return b;}
function display(){
 current=snapshot?.jobs.find(j=>!closed(j))||null;
 el('retry').hidden=!pending;
 el('connection').textContent=snapshot?.deviceReady?'PC penghubung siap menerima permintaan baca.':'PC penghubung belum siap / belum ada kabar terbaru. Data lama tidak menggantikan pembacaan baru.';
 const t=current?.target||selected;
 el('target').textContent=t?`${t.part} · ${t.date} · Shift ${t.shift} · target ${t.targetQty} pcs · versi ${t.version}`:'Pilih target leader dari Daftar pekerjaan.';
 el('prepare').disabled=busy||!!pending||!!current||!selected||!masterReady;
 const st=current?.state;el('state').textContent=states[st]||'Belum ada sesi aktif';el('identity').textContent=current?current.operators.join(', ')+' · '+current.id:'';
 for(const [id,value] of [['start',current?.startEvidence?.counter_raw],['end',current?.endEvidence?.counter_raw],['delta',current?.delta]])el(id).textContent=value==null?'—':Number(value).toLocaleString('id-ID');
 el('begin').disabled=busy||!!pending||!snapshot?.deviceReady||!['DRAFT','START_FAILED'].includes(st);
 el('begin').textContent=st==='START_FAILED'?'Coba baca awal lagi':'Mulai pekerjaan';
 el('finish').disabled=busy||!!pending||!snapshot?.deviceReady||!['ACTIVE','END_FAILED'].includes(st);
 el('finish').textContent=st==='END_FAILED'?'Coba baca akhir lagi':'Akhiri pekerjaan';
 el('close').disabled=busy||!!pending||!current;
 el('explain').textContent=st==='REVIEW_REQUIRED'?'Counter turun, rentang, atau urutan bukti tidak sesuai. Selisih tidak dihitung. Tutup dengan alasan untuk pemeriksaan.':st?.endsWith('FAILED')?'Batas waktu habis atau pembacaan gagal. Coba ulang setelah koneksi siap; counter tidak diganti dengan 0.':st?.endsWith('PENDING')?'Permintaan tersimpan. Tunggu hasil dari PC; halaman boleh dimuat ulang.':'';
 el('quality').hidden=!['END_CAPTURED','REVIEW_REQUIRED'].includes(st);
 if(current&&qualityJob!==current.id){qualityJob=current.id;const defaults={ok:'',repair:'0',reject:'0',issue:'Tidak',classification:'MANUSIA',problem:'',action:'',pic:''};for(const id of Object.keys(defaults))el(id).value=current.quality?.[id]??defaults[id];}
 el('save-quality').disabled=busy||!!pending;
 el('complete').disabled=busy||!!pending||st!=='END_CAPTURED'||!current?.quality;
 el('issue-fields').hidden=el('issue').value!=='Ada';
 el('history').replaceChildren();for(const j of snapshot?.jobs||[]){const p=document.createElement('p');p.className='history-item';p.textContent=`${j.target.part} · ${j.target.date} / shift ${j.target.shift} · ${states[j.state]||j.state} | Awal ${j.startEvidence?.counter_raw??'—'} → akhir ${j.endEvidence?.counter_raw??'—'} | selisih ${j.delta??'—'}${j.quality?` | OK ${j.quality.ok}, Repair ${j.quality.repair}, Reject ${j.quality.reject}`:''} | ID ${j.id}`;el('history').append(p);if(reportEnabled&&j.state==='COMPLETED_PILOT')reportControls(j);}
}
async function refresh(){clearTimeout(timer);try{const caps=await call('capabilities');reportEnabled=caps.reportsEnabled===true;if(!caps.enabled){el('workspace').hidden=true;notice(messages.CLOUD_BRIDGE_NOT_CONFIGURED);return;}snapshot=await call('state');el('pair-panel').hidden=true;el('workspace').hidden=false;display();timer=setTimeout(refresh,snapshot.jobs.some(j=>j.state.endsWith('PENDING'))?4000:20000);}catch(e){if(e.status===401){el('pair-panel').hidden=false;el('workspace').hidden=true;}notice(e.message);}}
async function send(body){if(busy)return;busy=true;try{if(!pending){pending=body;localStorage.setItem(pendingKey,JSON.stringify(pending));}display();await call('operator',pending);localStorage.removeItem(pendingKey);pending=null;notice('Tersimpan pada cloud.');}catch(e){notice(e.message);if(e.status>=400&&e.status<500&&e.code!=='BUSY_RETRY_SAME_ID'){localStorage.removeItem(pendingKey);pending=null;}}finally{busy=false;await refresh();}}
function act(action,extra={}){return send({action,requestId:crypto.randomUUID(),jobId:current?.id,revision:current?.revision,...extra});}
el('refresh').onclick=refresh;el('retry').onclick=()=>send(pending);
el('pair').onclick=async()=>{try{await call('pair',{code:el('pair-code').value.trim()});el('pair-code').value='';notice('Tablet terpasang.');await refresh();}catch(e){notice(e.message);}};
el('prepare').onclick=()=>{const operators=[...document.querySelectorAll('#operators input:checked')].map(x=>x.value);const {date,shift,line,machine,part,version,targetQty}=selected;send({action:'prepare',requestId:crypto.randomUUID(),target:{date,shift,line,machine,part,version,targetQty},operators});};
el('begin').onclick=()=>act('start');el('finish').onclick=()=>act('end');el('complete').onclick=()=>act('complete');
el('close').onclick=()=>{const reason=prompt('Alasan menutup sesi untuk pemeriksaan:');if(reason?.trim())act('close',{reason:reason.trim()});};
el('save-quality').onclick=()=>act('quality',{quality:Object.fromEntries(['ok','repair','reject','issue','classification','problem','action','pic'].map(k=>[k,el(k).value.trim()]))});
el('issue').onchange=()=>{el('issue-fields').hidden=el('issue').value!=='Ada';};
el('export').onclick=()=>{const url=URL.createObjectURL(new Blob([JSON.stringify(snapshot,null,2)],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download='champer-cloud-pilot.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),5000);};
(async()=>{try{const r=await andonFetch('/api/master',{cache:'no-store'}),m=await r.json();if(m.ready&&m.source==='live'){for(const name of m.mapping.LINE_99.operators.filter(x=>x!=='__other_option__')){const label=document.createElement('label');label.className='check';const input=document.createElement('input');input.type='checkbox';input.value=name;label.append(input,document.createTextNode(name));el('operators').append(label);}masterReady=true;}}catch{}await refresh();})();
