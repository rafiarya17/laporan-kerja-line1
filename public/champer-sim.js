'use strict';
const C=window.ChamperSim,$=id=>document.getElementById(id),KEY='berlindo-champer-line99-simulation-v1',LOCK=KEY+'-lock';
const today=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Jakarta',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
const labels={DRAFT:'Siap dimulai',START_FAILED:'Counter awal belum diterima',ACTIVE:'Pekerjaan aktif',END_FAILED:'Counter akhir belum diterima',END_CAPTURED:'Lengkapi hasil',REVIEW_REQUIRED:'Perlu pemeriksaan',COMPLETED:'Selesai · simulasi',CANCELLED:'Ditutup · simulasi'};
let state,selection=null,busy=false,storageOK=true,qualityJob=null;
function notice(text,error=false){$('notice').textContent=text;$('notice').className=error?'error':'';}
function read(){const raw=localStorage.getItem(KEY);const s=raw?JSON.parse(raw):C.initial(today);if(s.schema!==1||s.dataset!==C.DATASET||!Array.isArray(s.jobs)||!Array.isArray(s.targets)||!Number.isSafeInteger(s.revision))throw Error('Penyimpanan uji tidak dapat dibaca. Jangan mulai sesi baru; simpan bukti untuk pemeriksaan.');return s;}
try{state=read();localStorage.setItem(KEY,JSON.stringify(state));}catch(e){storageOK=false;state=C.initial(today);notice(e.message,true);}
$('date').value=state.targets[0]?.date||today;$('shift').value=state.targets[0]?.shift||'1';
function visibleTargets(){return state.targets.filter(t=>t.date===$('date').value&&t.shift===$('shift').value);}
function addText(parent,tag,text,className){const el=document.createElement(tag);el.textContent=text;if(className)el.className=className;parent.append(el);return el;}
function fmt(n){return n===null||n===undefined?'—':n.toLocaleString('id-ID');}
function render(){
 const current=C.active(state),j=current||state.jobs.at(-1),blocked=busy||!storageOK||!navigator.locks;
 const list=visibleTargets();if(!list.some(t=>t.key===selection))selection=list[0]?.key||null;
 $('source').textContent=(state.targetSource==='LIVE_READ_ONLY'?'Salinan target leader · hanya baca':'Target contoh · disimpan di browser')+' · '+list.length+' pekerjaan Champer';
 $('targets').replaceChildren();if(!list.length)addText($('targets'),'p','Belum ada target untuk tanggal dan shift ini. Muat target contoh atau baca target leader.','hint');
 for(const t of list){const b=document.createElement('button');b.type='button';b.className=t.key===selection?'selected':'';b.disabled=blocked||!!current;b.setAttribute('aria-pressed',String(t.key===selection));addText(b,'strong',t.part);addText(b,'small',t.machine+' · Target OK '+fmt(t.targetQty)+' pcs · versi '+t.version);b.onclick=()=>{selection=t.key;render();};$('targets').append(b);}
 for(const id of ['examples','live','date','shift','part','target-qty','prepare'])$(id).disabled=blocked||!!current||(id==='prepare'&&!selection);
 $('target-form').querySelector('button').disabled=blocked||!!current;$('operators').disabled=blocked||!!current;
 $('state').textContent=j?labels[j.state]:'Belum dipilih';$('identity').textContent=j?j.target.part+' · '+j.target.date+' · Shift '+j.target.shift+' · Target versi '+j.target.version+' · '+j.operators.join(', '):'Pilih satu target untuk memulai.';
 $('start').textContent=fmt(j?.start?.value);$('end').textContent=fmt(j?.end?.value);$('delta').textContent=fmt(j?.delta);$('counter').textContent=fmt(state.counter);
 $('message').textContent=j?.error||(j?.state==='COMPLETED'?'Sesi simulasi tersimpan. Tidak ada laporan yang dikirim ke produksi.':j?.state==='ACTIVE'?'Tambah hasil contoh, lalu Akhiri. Mesin nyata tidak terhubung.':'Counter awal contoh 1.000 adalah akumulasi; hasil sesi dihitung dari selisih.');
 $('start-btn').disabled=blocked||!current||!['DRAFT','START_FAILED'].includes(current.state);$('start-btn').textContent=current?.state==='START_FAILED'?'Coba baca awal lagi':'Mulai pekerjaan';
 $('end-btn').disabled=blocked||!current||!['ACTIVE','END_FAILED'].includes(current.state);$('end-btn').textContent=current?.state==='END_FAILED'?'Coba baca akhir lagi':'Akhiri pekerjaan';
 $('add').disabled=blocked||current?.state!=='ACTIVE';$('cancel').disabled=blocked||!current;
 $('quality-fields').disabled=blocked||current?.state!=='END_CAPTURED';
 if(qualityJob!==j?.id){$('quality-form').reset();qualityJob=j?.id;if(j?.quality)for(const key of ['ok','repair','reject','problem','category','detail','action','pic'])$(key).value=j.quality[key]??'';}
 $('problem-fields').hidden=$('problem').value!=='Ada';
 $('history').replaceChildren();for(const h of [...state.jobs].reverse()){const row=document.createElement('article');row.className='history-item';addText(row,'strong',h.target.part+' · '+labels[h.state]);addText(row,'p',h.target.date+' / shift '+h.target.shift+' / target v'+h.target.version+' / '+h.operators.join(', '));addText(row,'p','Awal '+fmt(h.start?.value)+' → akhir '+fmt(h.end?.value)+' · selisih '+fmt(h.delta));if(h.quality)addText(row,'p','OK '+h.quality.ok+' / repair '+h.quality.repair+' / reject '+h.quality.reject+' · Kendala: '+h.quality.problem);addText(row,'small',h.reportId);$('history').append(row);}
 if(!state.jobs.length)addText($('history'),'p','Belum ada sesi simulasi.','hint');
}
async function mutate(event){
 if(busy||!storageOK)return;if(!navigator.locks){notice('Browser perlu mendukung penguncian tab. Buka melalui HTTPS dengan browser terbaru.',true);return;}
 const full={...event,id:crypto.randomUUID(),at:new Date().toISOString(),expectedRevision:state.revision};busy=true;render();
 try{await navigator.locks.request(LOCK,()=>{const latest=read(),next=C.apply(latest,full);localStorage.setItem(KEY,JSON.stringify(next));state=next;});notice('Tersimpan sebagai simulasi pada browser ini.');}
 catch(e){notice(e.message,true);try{state=read();}catch{storageOK=false;}}
 finally{busy=false;render();}
}
function sample(part,qty){const date=$('date').value,shift=$('shift').value;if(!date)throw Error('Pilih tanggal produksi.');const version=Math.max(0,...state.targets.filter(t=>t.date===date&&t.shift===shift).map(t=>t.version))+1;return C.targets({date,shift,targets:[{line:C.LINE,version,items:[{machine:C.MACHINE,part,targetQty:qty}]}]},date,shift);}
$('examples').onclick=()=>{try{mutate({type:'TARGETS',source:'CONTOH',targets:sample('PIPE 1_BLS-E475A-0000-0305',100)});}catch(e){notice(e.message,true);}};
$('target-form').onsubmit=e=>{e.preventDefault();try{mutate({type:'TARGETS',source:'CONTOH',targets:sample($('part').value.trim(),Number($('target-qty').value))});}catch(err){notice(err.message,true);}};
for(const id of ['date','shift'])$(id).onchange=()=>{selection=null;render();};
$('live').onclick=async()=>{
 if(busy||C.active(state))return;const date=$('date').value,shift=$('shift').value;busy=true;render();notice('Membaca target leader. Tidak menyimpan perubahan ke sistem produksi.');
 try{const response=await andonFetch('/api/leader',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'snapshot',phase:'targets',date,shift,line:C.LINE})});const body=await response.json();if(!response.ok||!body.ok)throw Error('Target leader belum tersedia pada host ini. Gunakan target contoh; akses produksi tidak diaktifkan untuk preview.');const items=C.targets(body.data,date,shift);busy=false;await mutate({type:'TARGETS',source:'LIVE_READ_ONLY',targets:items});}
 catch(e){notice(e.message||'Target gagal dimuat. Target lama tidak diganti.',true);}finally{busy=false;render();}
};
$('prepare').onclick=()=>mutate({type:'CREATE',targetKey:selection,operators:[...$('operators').querySelectorAll('input:checked')].map(i=>i.value),jobId:crypto.randomUUID()});
$('start-btn').onclick=()=>mutate({type:'START',fail:$('scenario').value==='timeout'});
$('end-btn').onclick=()=>mutate({type:'END',fail:$('scenario').value==='timeout',reset:$('scenario').value==='reset'});
$('add').onclick=()=>mutate({type:'ADD',qty:12});
$('cancel').onclick=()=>{const reason=prompt('Alasan menutup sesi uji tanpa laporan (minimal 5 karakter):');if(reason)mutate({type:'CANCEL',reason});};
$('problem').onchange=()=>{$('problem-fields').hidden=$('problem').value!=='Ada';};
$('quality-form').onsubmit=e=>{e.preventDefault();mutate({type:'COMPLETE',quality:{ok:Number($('ok').value),repair:Number($('repair').value),reject:Number($('reject').value),problem:$('problem').value,category:$('category').value,detail:$('detail').value.trim(),action:$('action').value.trim(),pic:$('pic').value.trim()}});};
$('export').onclick=()=>{const blob=new Blob([JSON.stringify(state,null,2)],{type:'application/json'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='champer-simulasi-'+today+'.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);};
window.addEventListener('storage',e=>{if(e.key===KEY){try{state=read();render();}catch(err){storageOK=false;notice(err.message,true);render();}}});
if(!navigator.locks)notice('Buka melalui HTTPS atau localhost pada browser terbaru agar satu sesi tidak dibuat dua tab bersamaan.',true);
render();
async function acceptSelectedTarget() {
 if(new URLSearchParams(location.search).get('from')!=='pekerjaan')return;
 try {
  const raw=sessionStorage.getItem('champer-selected-target');
  if(!raw)return;
  const chosen=JSON.parse(raw);
  if(C.active(state)){notice('Selesaikan atau tutup sesi yang masih terbuka sebelum memilih pekerjaan lain.',true);return;}
  if(chosen.line!==C.LINE||chosen.machine!==C.MACHINE||!/^\d{4}-\d{2}-\d{2}$/.test(chosen.date)||!['1','2'].includes(chosen.shift))throw Error('Pilihan pekerjaan tidak sesuai untuk Champer.');
  const targets=C.targets({date:chosen.date,shift:chosen.shift,targets:[{line:chosen.line,version:chosen.version,items:[chosen]}]},chosen.date,chosen.shift);
  await mutate({type:'TARGETS',source:chosen.source==='LIVE_READ_ONLY'?'LIVE_READ_ONLY':'CONTOH',targets});
  if(state.targets.some(target=>target.key===targets[0].key)){
   $('date').value=chosen.date;$('shift').value=chosen.shift;selection=targets[0].key;
   sessionStorage.removeItem('champer-selected-target');render();
  }
 }catch(error){notice(error.message,true);}
}
acceptSelectedTarget();
