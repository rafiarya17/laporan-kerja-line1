'use strict';
const $=id=>document.getElementById(id),endpoint='/api/leader',core=window.LeaderCore;
const names={RECEIVED:'Diterima · proses awal',WAITING_LEADER:'Menunggu leader',HELD:'Ditahan',PUBLISH_QUEUED:'Disetujui · antre terbit',WAITING_TF_SYNC:'Disetujui · sinkron TF',PUBLISHED:'Terbit TF Slip',PRODUCTION_VIEW:'Produksi berjalan · lihat'};
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let data=null,tab='targets',selected=new Set(),loading=false,epoch=0,current=null,draft=[],targetVersion=0,operations=[],loadController=null,targetPreparing=false;
try{operations=JSON.parse(localStorage.getItem('berlindo-leader-requests-v1')||'[]');if(!Array.isArray(operations))operations=[];$('leader').value=window.PortalDraft?.get('leader-name')||localStorage.getItem('berlindo-leader-name')||'';}catch{}
const params=new URLSearchParams(location.search),today=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Jakarta',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
$('date').value=/^\d{4}-\d{2}-\d{2}$/.test(params.get('date')||'')?params.get('date'):today;$('shift').value=['1','2'].includes(params.get('shift'))?params.get('shift'):'all';
for(const id of ['line','targetLine'])for(const n of [1,2,3,4,5,6,7,8,99])$(id).add(new Option('Line '+n+(n===99?' · Uji':''),'LINE_'+n));$('line').value=/^LINE_(?:[1-8]|99)$/.test(params.get('line')||'')?params.get('line'):'';
function saveOperations(){localStorage.setItem('berlindo-leader-requests-v1',JSON.stringify(operations.slice(-60)));}
function operatorWorkUrl(line, machine = '', part = '', shift = $('shift').value) {
 return '/pekerjaan.html?' + new URLSearchParams({date:$('date').value,shift:shift==='all'?'':shift,line,machine,part});
}
function updateOperatorLinks() {
 $('operator-work').href=operatorWorkUrl($('line').value);
 $('champer-work').href=operatorWorkUrl('LINE_99','AUTO CHAMPER');
}
function addOperatorTargetLinks(items) {
 $('targetList').querySelectorAll('[data-target]').forEach(button=>{
  const item=items.find(target=>targetDisplayKey(target)===button.dataset.target);
  if(!item)return;
  const link=document.createElement('a');
  link.href=operatorWorkUrl(item.line,item.machine,item.part,item.workspaceShift);
  link.className='tgbutton';
  link.textContent=item.line==='LINE_99'&&item.machine==='AUTO CHAMPER'?'Pekerjaan / Start–End Champer':'Buka pekerjaan operator';
  button.parentElement.append(link);
 });
}
function notify(text,error=false,inDialogs=true){$('notice').textContent=text;$('notice').className=error?'error':'';if(inDialogs)document.querySelectorAll('dialog[open]').forEach(d=>{let e=d.querySelector('.feedback');if(!e){e=document.createElement('p');e.className='feedback';d.prepend(e);}e.textContent=text;});}
function actor(){const v=$('leader').value.trim();if(v.length<2)throw Error('Isi nama leader terlebih dahulu.');localStorage.setItem('berlindo-leader-name',v);return v;}
const messages={LINE4_INVALID_APPROVAL:'Gunakan Setujui pada laporan web produksi yang menunggu verifikasi.',LINE4_APPROVAL_NOT_FOUND:'Laporan ini tidak ada dalam antrean verifikasi web produksi.',LINE4_ALREADY_DECIDED:'Laporan sudah diproses. Muat ulang untuk melihat status terbaru.',LEADER_NAME_REQUIRED:'Isi nama leader yang valid.',TARGET_QTY_REQUIRED:'Isi target OK (pcs) untuk setiap item. Muat ulang halaman jika kolom qty belum muncul.',TARGET_QTY_INVALID:'Target OK harus bilangan bulat 1–999.999.999 pcs.',DUPLICATE_TARGET_QTY_CONFLICT:'Item yang sama memiliki target qty berbeda. Pilih satu target per mesin–part.',VERSION_CHANGED_REFRESH:'Data berubah di perangkat lain. Muat ulang dan periksa versi terbaru.',MASTER_SELECTION_INVALID:'Pilihan mesin/part sudah tidak sesuai master. Muat ulang master.',BUSY_RETRY_SAME_ID:'Penyimpanan sedang digunakan sebentar. Coba lagi dengan ID yang sama.',LEADER_DISABLED:'Dashboard belum diaktifkan pada penerima.',PILOT_ONLY:'Persetujuan produksi asli belum diaktifkan; pengujian hanya Line 99.',REASON_REQUIRED:'Isi alasan minimal 5 karakter.',REQUEST_ID_CONFLICT:'ID permintaan memiliki isi berbeda. Simpan ID dan minta pemeriksaan admin.',LEADER_UNCONFIRMED_RETRY_SAME_ID:'Konfirmasi belum diterima. Gunakan Coba lagi; ID permintaan tetap sama.'};
async function api(body,signal){const r=await andonFetch(endpoint,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body),signal,cache:'no-store'},80000);let b;try{b=await r.json();}catch{throw Error('Respons belum dapat dikonfirmasi.');}if(!r.ok||!b.ok){const e=Error(messages[b.error]||b.error||'Koneksi belum berhasil.');e.confirmed=r.status<500&&!['BUSY_RETRY_SAME_ID'].includes(b.error);throw e;}return b;}
function contextMatches(){return data&&data.date===$('date').value&&data.shift===$('shift').value&&(data.reportLine===undefined||!data.reportLine||data.reportLine===$('line').value);}
function view(){const line=$('line').value;return {reports:contextMatches()?data.reports.filter(r=>!line||r.line===line):[],targets:contextMatches()?data.targets.filter(t=>!line||t.line===line):[]};}
const targetDisplayKey=item=>JSON.stringify([item.workspaceShift,core.key(item)]);
const shiftLabel=shift=>shift==='all'?'Semua Shift':'Shift '+shift;
function summarizeView(v){
 const result={items:[],expected:0,received:0,missing:0,submissions:0};
 for(const shift of ['1','2']){
  const summary=core.summarize(v.targets.filter(t=>t.workspaceShift===shift),v.reports.filter(r=>r.workspaceShift===shift));
  result.items.push(...summary.items.map(item=>({...item,workspaceShift:shift})));
  for(const key of ['expected','received','missing','submissions'])result[key]+=summary[key];
 }
 return result;
}
function operationCommands(op){return op.body.action==='decideBatch'?op.body.payload.commands:[op.body.payload];}
function pendingReport(id){return operations.some(op=>['unknown','sending','accepted'].includes(op.state)&&operationCommands(op).some(c=>c.id===id&&!((op.results||[]).find(x=>x.id===id)?.rejected))&&!data?.requests.some(r=>r.id===id&&operationCommands(op).some(c=>c.requestId===r.requestId)&&['DONE','ERROR'].includes(r.state)));}
function pendingLabel(id){const op=operations.find(o=>['unknown','sending','accepted'].includes(o.state)&&operationCommands(o).some(c=>c.id===id));return op?.state==='sending'?'Mengirim permintaan…':op?.state==='unknown'?'Konfirmasi belum diterima':'Keputusan tersimpan · proses';}
function needsCurrentPart(r){
 if(r.reviewSource!=='LINE4_WEB')return false;
 const choices=(data?.catalog||[]).filter(item=>item.line===r.line&&item.machine===r.machine);
 return choices.length>0&&!choices.some(item=>item.part===r.part);
}
function eligible(r){return !needsCurrentPart(r)&&contextMatches()&&data.reportsLoaded!==false&&!r.viewOnly&&['WAITING_LEADER','HELD'].includes(r.state)&&!r.validation&&!!r.hash&&!pendingReport(r.id);}
function filteredReports(){const rows=view().reports,s=$('status').value;return rows.filter(r=>!s||(s==='waiting'?['RECEIVED','WAITING_LEADER'].includes(r.state):s==='attention'?!!r.validation||r.state==='HELD':r.state===s));}
function summaryCards(s){const values=[['Target laporan',s.expected,'item part–mesin'],['Sudah dilaporkan',s.received,'item sudah ada laporan'],['Belum dilaporkan',s.missing,'item belum ada laporan'],['Submission masuk',s.submissions,'laporan berbeda']];$('stats').innerHTML=values.map(v=>'<div><span>'+v[0]+'</span><b>'+v[1]+'</b><small>'+v[2]+'</small></div>').join('');}
function qtySummary(t){const hours=t.hours?'<small>'+esc(t.hours.toLocaleString('id-ID'))+' jam efektif'+(t.manualQty?' · Qty manual':'')+'</small>':'';if(data?.reportsLoaded===false)return '<div class="qtysummary">'+hours+'<span>Target OK: <strong>'+esc(t.targetQty??'Belum diisi')+' pcs</strong></span><small>Hasil produksi sedang dimuat…</small></div>';return '<div class="qtysummary">'+hours+'<span>Target OK: <strong>'+ (t.targetQty===null?'Belum diisi':esc(t.targetQty.toLocaleString('id-ID'))+' pcs')+'</strong></span><span>OK dilaporkan: <strong>'+esc(t.actualOk.toLocaleString('id-ID'))+' pcs</strong></span><small class="small">'+(t.targetQty===null?'Target lama belum memiliki qty':t.qtyReached?'Qty tercapai'+(t.actualOk>t.targetQty?' · lebih '+esc((t.actualOk-t.targetQty).toLocaleString('id-ID'))+' pcs':''):'Kurang '+esc(t.shortfall.toLocaleString('id-ID'))+' pcs')+'</small></div>'; }
function render(){updateOperatorLinks();const v=view(),s=summarizeView(v);summaryCards(s);if(!contextMatches()||data.reportsLoaded===false){$('stats').querySelectorAll('b').forEach((b,i)=>{if(i>0||!contextMatches())b.textContent='—';});}$('heroDate').textContent=$('date').value;$('heroShift').textContent=shiftLabel($('shift').value);$('reportCount').textContent=v.reports.length?'('+v.reports.length+')':'';
$('targetStatus').textContent=v.targets.length?v.targets.map(t=>shiftLabel(t.workspaceShift)+' · '+t.line.replace('_',' ')+' · v'+t.version+' · '+t.leader+(t.items.length?'':' · Tidak ada target')).join(' | '):'Target belum diisi untuk pilihan ini. Belum diisi berbeda dengan tidak ada target.';
$('targetList').innerHTML=!s.items.length?'<div class="empty"><strong>Belum ada item target.</strong><br>Atur daftar part dan mesin yang harus dilaporkan pada shift ini.</div>':s.items.map(t=>'<article class="card targetrow"><div><span class="small">'+esc(t.line.replace('_',' ')+' · '+shiftLabel(t.workspaceShift))+'</span><br><strong>'+esc(t.machine)+'</strong></div><div><span class="small">Part / proses</span><br><strong>'+esc(t.part)+'</strong>'+qtySummary(t)+'</div><div><span class="badge '+(t.reports.length?'good':'warn')+'">'+(data.reportsLoaded===false?'Hasil sedang dimuat…':t.reports.length?'Sudah dilaporkan':'Belum dilaporkan')+'</span><br><small class="small">'+(data.reportsLoaded===false?'—':t.reports.length)+' laporan terkait</small></div><div class="target-actions"><button type="button" class="primary" data-target-edit="'+esc(targetDisplayKey(t))+'">Revisi / hapus</button><button type="button" data-target="'+esc(targetDisplayKey(t))+'">Lihat laporan</button></div></article>').join('');
$('targetList').querySelectorAll('[data-target]').forEach(b=>b.onclick=()=>{showTab('reports');const item=s.items.find(t=>targetDisplayKey(t)===b.dataset.target);const changed=$('line').value!==item.line||$('shift').value!==item.workspaceShift;$('line').value=item.line;$('shift').value=item.workspaceShift;selected.clear();$('status').value='';if(changed){load();return;}render();$('reportList').querySelector('[data-report="'+CSS.escape(item.reports[0]?.id||'')+'"]')?.scrollIntoView({block:'center',behavior:'smooth'});});
$('targetList').querySelectorAll('[data-target-edit]').forEach(button=>{
 button.onclick=()=>openTargets(s.items.find(item=>targetDisplayKey(item)===button.dataset.targetEdit));
});
addOperatorTargetLinks(s.items);renderReports();renderPending();renderTelegram();$('editTargets').disabled=!contextMatches();document.dispatchEvent(new Event('portal:ready'));}
function renderReports(){const rows=filteredReports();$('reportList').className=reportView==='card'?'reportsgrid':'reportlist';$('reportList').innerHTML=rows.length?rows.map(r=>'<article class="card" data-report="'+esc(r.id)+'"><div class="reporthead">'+(eligible(r)?'<label class="check"><input data-select="'+esc(r.id)+'" type="checkbox" '+(selected.has(r.id)?'checked':'')+'>Pilih</label>':'<span class="badge '+(r.state==='PUBLISHED'?'good':r.validation?'warn':'')+'">'+esc(pendingReport(r.id)?pendingLabel(r.id):names[r.state]||r.state)+'</span>')+'<span class="small">'+esc(r.line.replace('_',' ')+' · '+shiftLabel(r.workspaceShift))+'</span></div><div class="reportidentity"><div class="part">'+esc(r.part)+'</div><p class="small">'+esc(r.machine)+'<br>'+esc(r.operator)+'</p></div><div class="reportmeta"><span>OK <strong>'+esc(r.input.ok)+'</strong></span><span>Repair '+esc(r.input.repair)+'</span><span>Reject '+esc(r.input.reject)+'</span></div>'+(r.validation?'<p class="reportwarning badge warn">'+esc(r.validation)+'</p>':'')+'<p class="reportstate small'+(!eligible(r)&&!r.viewOnly?' repeatstate':'')+'">'+esc(r.viewOnly?r.productionState:names[r.state])+'</p><small class="small" style="overflow-wrap:anywhere">'+esc(r.id)+'</small><div class="actions">'+(eligible(r)?'<button class="primary" data-approve="'+esc(r.id)+'">Setujui</button>':'')+(r.line==='LINE_99'&&r.state==='PUBLISHED'&&data.revisionEnabled?'<button data-web-revision="'+esc(r.id)+'">Uji revisi web</button>':'')+'<button data-detail="'+esc(r.id)+'">'+((r.reviewSource==='LINE4_WEB'?!(eligible(r)&&r.reviewFields):r.viewOnly&&!data.revisionEnabled)?'Periksa laporan':'Periksa / revisi')+'</button></div></article>').join(''):'<div class="empty">'+(data?.reportsLoaded===false?'Laporan sedang dimuat…':'Belum ada laporan untuk filter ini.')+'</div>';
$('reportList').querySelectorAll('[data-web-revision]').forEach(b=>b.onclick=()=>openWebRevision(b.dataset.webRevision));$('reportList').querySelectorAll('[data-approve]').forEach(b=>b.onclick=()=>approveCard(b.dataset.approve));$('reportList').querySelectorAll('[data-select]').forEach(b=>b.onchange=()=>{b.checked?selected.add(b.dataset.select):selected.delete(b.dataset.select);syncSelection();});$('reportList').querySelectorAll('[data-detail]').forEach(b=>b.onclick=()=>openDetail(b.dataset.detail));syncSelection();}
function syncSelection(){const visible=filteredReports().filter(eligible),n=visible.filter(r=>selected.has(r.id)).length;$('selectAll').checked=!!visible.length&&n===visible.length;$('selectAll').indeterminate=n>0&&n<visible.length;$('selectAll').disabled=!visible.length;$('bulk').textContent=n>20?'Setujui 20 dari '+n:'Setujui terpilih ('+n+')';$('bulk').disabled=!n;$('selectionInfo').textContent='Pilihan berlaku pada hasil filter. Maksimal 20 laporan per pengiriman; laporan bermasalah diperiksa lewat detail.';}
function renderTelegram(){const buttons=$('telegramButtons');if(!contextMatches()||data.reportsLoaded===false||data.reportLine){$('telegramText').textContent='Buka tab Ringkasan Telegram untuk memuat ringkasan seluruh line pada tanggal dan shift ini.';if(buttons)buttons.innerHTML='';return;}
 if(data.shift==='all'){$('telegramText').textContent='Pilih Shift 1 atau Shift 2 untuk melihat kartu Telegram shift tersebut.';if(buttons)buttons.innerHTML='';return;}
 const card=leaderCardModel(data.date,data.shift,data.targets,data.reports,core.summarize(data.targets,data.reports),location.origin+'/leader');$('telegramText').textContent=card.text;if(buttons)buttons.innerHTML=card.inline_keyboard.map(row=>row.map(b=>'<a class="tgbutton" href="'+esc(b.url)+'">'+esc(b.text)+'</a>').join('')).join('');
}
function renderPending(){const rows=operations.filter(op=>op.state!=='done').slice(-20);$('pendingPanel').hidden=!rows.length;$('pendingList').innerHTML=rows.map(op=>'<div class="pendingrow"><strong>'+esc(({target:'Simpan target',submit:'Input uji',decide:'Keputusan leader',decideBatch:'Persetujuan pilihan',reviseProduction:'Revisi laporan'})[op.body.action])+'</strong> · '+esc(op.state==='accepted'?'Permintaan tersimpan; muat ulang untuk status penerapan':op.state==='sending'?'Mengirim…':op.state==='rejected'?'Perlu diperiksa':'Belum terkonfirmasi')+'<br><small>'+esc(op.body.payload.requestId)+'</small>'+(op.error?'<p>'+esc(op.error)+'</p>':'')+(['unknown'].includes(op.state)?'<button data-retry="'+op.id+'">Coba lagi dengan ID yang sama</button>':'')+'</div>').join('');$('pendingList').querySelectorAll('[data-retry]').forEach(b=>b.onclick=()=>sendOperation(operations.find(o=>o.id===b.dataset.retry)));}
function cancelLoad(){epoch++;loadController?.abort();loading=false;$('refresh').disabled=false;$('refresh').textContent='Muat ulang';}
function reconcileOperations(){for(const op of operations){if(op.state!=='accepted')continue;const cs=operationCommands(op),jobs=data.requests.filter(j=>cs.some(c=>c.requestId===j.requestId));if(jobs.length===cs.length&&jobs.every(j=>j.state==='DONE'))op.state='done';else if(jobs.some(j=>j.state==='ERROR')){op.state='rejected';op.error=jobs.filter(j=>j.state==='ERROR').map(j=>j.error).join('; ');}}saveOperations();}
async function load(){
 cancelLoad();const date=$('date').value,shift=$('shift').value,line=tab==='telegram'?'':$('line').value;if(!date)return;
 const e=epoch,c=new AbortController();loadController=c;loading=true;$('refresh').disabled=true;$('refresh').textContent='Memuat…';notify('Mengambil target dan pilihan mesin–part…');render();
 try{
 const shifts=shift==='all'?['1','2']:[shift];
 const read=async (oneShift,phase)=>{
  const {data:snapshot}=await api({action:'snapshot',phase,date,shift:oneShift,line},c.signal);
  if(!snapshot||snapshot.date!==date||snapshot.shift!==oneShift)throw Error('Pilihan tanggal atau shift tidak cocok. Muat ulang.');
  return snapshot;
 };
 const combine=(snapshots,catalog)=>{
  const first=snapshots[0];
  const tagged=key=>snapshots.flatMap(snapshot=>snapshot[key].map(row=>({...row,workspaceShift:snapshot.shift})));
  return {...first,shift,catalog,targets:tagged('targets'),reports:tagged('reports'),
   requests:[...new Map(snapshots.flatMap(snapshot=>snapshot.requests).map(req=>[req.requestId,req])).values()],
   reportsLoaded:snapshots.every(snapshot=>snapshot.reportsLoaded!==false),
   checkedAt:snapshots.map(snapshot=>snapshot.checkedAt).sort().at(-1)};
 };
 const first=await Promise.all(shifts.map(oneShift=>read(oneShift,'targets')));if(e!==epoch)return;
 const catalog=[...new Map(first.flatMap(snapshot=>snapshot.catalog).map(item=>[core.key(item),item])).values()];
 data=combine(first,catalog);render();$('checked').textContent='Target dimuat '+new Date(data.checkedAt).toLocaleTimeString('id-ID',{timeZone:'Asia/Jakarta'});
 if(!data.reportsLoaded){
  notify('Target dimuat. Laporan dan status TF sedang dimuat…');
  const complete=await Promise.all(first.map(snapshot=>snapshot.reportsLoaded===false?read(snapshot.shift,'reports'):snapshot));if(e!==epoch)return;
  data=combine(complete,catalog);
 }
 reconcileOperations();selected=new Set([...selected].filter(id=>data.reports.some(r=>r.id===id&&eligible(r))));render();$('checked').textContent='Diperiksa '+new Date(data.checkedAt).toLocaleString('id-ID',{timeZone:'Asia/Jakarta'});notify('Data diperbarui.');
 }catch(error){if(e!==epoch||c.signal.aborted)return;notify(data?.reportsLoaded===false?'Target sudah siap. Laporan belum berhasil dimuat; tekan Muat ulang.':error.message,true);}
 finally{if(e===epoch){loading=false;$('refresh').disabled=false;$('refresh').textContent='Muat ulang';}}
}
function approveCard(id){const r=data?.reports.find(r=>r.id===id);if(!r||!eligible(r))return;try{actor();}catch(e){notify(e.message,true);return;}
 if(!confirm('Setujui laporan ini?\n'+data.date+' · '+shiftLabel(r.workspaceShift)+' · '+r.line.replace('_',' ')+'\n'+r.machine+' · '+r.part+'\n'+r.operator+'\nOK '+r.input.ok+' / Repair '+r.input.repair+' / Reject '+r.input.reject))return;
 startOperation('decide',{id:r.id,expectedHash:r.hash,decision:'approve',reason:'Pemeriksaan leader melalui tombol Setujui pada card laporan'});
}

async function startOperation(action,payload){try{const equivalent=v=>{const x={...v};delete x.id;delete x.requestId;return JSON.stringify(x);};const existing=operations.find(o=>['unknown','sending'].includes(o.state)&&o.body.action===action&&equivalent(o.body.payload)===equivalent(payload));if(existing){notify('Permintaan yang sama belum terkonfirmasi. Gunakan Coba lagi dengan ID '+existing.id,true);return;}const leader=actor(),requestId=payload.requestId||crypto.randomUUID(),op={id:requestId,state:'unknown',body:{action,leader,payload:{...payload,requestId}}};operations.push(op);saveOperations();await sendOperation(op);}catch(e){notify(e.message,true);}}
async function sendOperation(op){if(op?.body.action==='reviseProduction'&&document.getElementById('webRevisionDialog')?.open)document.getElementById('webRevisionDialog').close();if(!op||op.state==='sending')return;op.state='sending';saveOperations();if(op.body.action==='decide'&&$('detailDialog').open&&current?.id===op.body.payload.id){$('detailDialog').close();showTab('reports');notify('Keputusan sedang dikirim. Status proses dapat dilihat pada laporan dan daftar permintaan.',false,false);}renderPending();renderReports();cancelLoad();try{const r=await api(op.body);op.state='accepted';op.error='';
 const completedApprovals=(r.results||[r]).filter(x=>x.ok&&x.result?.state==='LINE4_APPROVED').map(x=>x.result.id);
 for(const report of data?.reports||[])if(report.reviewSource==='LINE4_WEB'&&completedApprovals.includes(report.id)){
  report.state='WAITING_TF_SYNC';
  const edits=op.body.payload.fields;
  if(edits){
   Object.assign(report.reviewFields,edits);
   const keys={qtyOk:'ok',qtyRepair:'repair',qtyReject:'reject',jamMulaiProses:'start',jamSelesaiProses:'end',lembur:'overtime',permasalahan:'problem',tindakan:'action'};
   for(const [key,value] of Object.entries(edits))if(keys[key])report.input[keys[key]]=value;
  }
 }
 if(r.results){op.results=r.results.map(x=>({id:x.id||x.result.id,rejected:!x.ok,error:x.error}));const failed=r.results.filter(x=>!x.ok);if(failed.length){op.error=failed.map(x=>x.id+': '+(messages[x.error]||x.error)).join('; ');op.state=failed.length===r.results.length?'rejected':'accepted';}}
if(op.body.action==='target'){op.state='done';const p=op.body.payload,k=targetDraftKey(p),saved=window.PortalDraft?.get(k);if(saved&&saved.version===p.expectedVersion&&JSON.stringify(saved.items)===JSON.stringify(p.items)&&saved.reason===p.reason)window.PortalDraft?.remove(k);if(contextMatches()&&data.date===p.date&&(data.shift===p.shift||data.shift==='all')&&(!data.reportLine||data.reportLine===p.line)){data.targets=data.targets.filter(t=>t.line!==p.line||t.workspaceShift!==p.shift);data.targets.push({date:p.date,shift:p.shift,workspaceShift:p.shift,line:p.line,version:r.result.version,items:p.items,leader:op.body.leader,reason:p.reason});}}
else if(op.body.action==='submit'){showTab('reports');}
else{operationCommands(op).forEach(c=>{selected.delete(c.id);window.PortalDraft?.remove('leader-revision:'+c.id);});}
notify(op.error?'Sebagian permintaan perlu diperiksa: '+op.error:'Tersimpan. '+(op.body.action==='target'?'Target shift diperbarui.':'Keputusan/input diterima untuk diproses. Tekan Muat ulang untuk melihat penerapan dan status TF Slip.')+' Pembaruan Telegram berjalan terpisah.'+(op.body.action==='decideBatch'&&selected.size?' Sisa terpilih pada filter ini: '+filteredReports().filter(r=>eligible(r)&&selected.has(r.id)).length+'.':''),!!op.error,false);
}catch(e){op.state=e.confirmed?'rejected':'unknown';op.error=e.message;notify(e.message+'\nID: '+op.id+'\nPermintaan lain tetap dapat digunakan.',true,false);}finally{saveOperations();render();}}
function showTab(name){tab=name;const u=new URL(location.href);u.searchParams.set('tab',name);history.replaceState(null,'',u.pathname+u.search);if(name==='telegram'&&data?.reportLine)load();document.querySelectorAll('.tab').forEach(e=>e.hidden=e.id!==name);document.querySelectorAll('[data-tab]').forEach(b=>b.classList.toggle('active',b.dataset.tab===name));document.dispatchEvent(new Event('portal:ready'));}
function openTargets(item){
 if(targetPreparing){notify('Target sedang diperiksa. Tunggu hasil pengiriman.',false,false);return;}
 if(!contextMatches())return;
 try{actor();}catch(e){notify(e.message,true);$('leader').focus();return;}
 $('targetLine').value=item?.line||$('line').value;
 const shiftSelect=$('targetShift');
 for(const option of shiftSelect.options)option.disabled=!!option.value&&data.shift!=='all'&&option.value!==data.shift;
 shiftSelect.value=item?.workspaceShift||(data.shift==='all'?'':data.shift);
 $('targetDialog').querySelector('.feedback')?.remove();
 setTargetLine();
 restoreTargetDraft();
 $('targetDialog').showModal();
 if(item){
  const row=[...$('draftList').children].find(row=>row.dataset.targetItem===core.key(item));
  (row?.querySelector('[data-qty]')||$('targetReason')).focus();
 }
}
const removedTargetParts=new Map();
function restorePart(m){return removedTargetParts.get(core.key(m))||{line:m.line,machine:m.machine,part:m.part};}
function setTargetLine(){
 removedTargetParts.clear();
 const line=$('targetLine').value,shift=$('targetShift').value;
 const target=data.targets.find(t=>t.line===line&&t.workspaceShift===shift);
 draft=target?target.items.map(item=>({...item})):[];
 targetVersion=target?.version||0;
 $('targetTitle').textContent=targetVersion?'Revisi target shift':'Atur target shift';
 $('targetContext').textContent=[data.date,shift&&shiftLabel(shift),line&&line.replace('_',' ')].filter(Boolean).join(' · ');
 $('targetReason').value='';
 $('targetReason').required=Boolean(targetVersion);
 $('zeroConfirm').checked=!!target&&!target.items.length;
 $('targetParts').open=!targetVersion;
 $('partSearch').value='';
 $('targetMachine').innerHTML=[...new Set(data.catalog.filter(m=>m.line===line).map(m=>m.machine))].map(m=>'<option>'+esc(m)+'</option>').join('');
 renderParts();
 renderDraft();
}
function partMatches(){const line=$('targetLine').value,machine=$('targetMachine').value,q=$('partSearch').value.toLowerCase();return data.catalog.filter(m=>m.line===line&&m.machine===machine&&m.part.toLowerCase().includes(q));}
function renderParts(){$('partOptions').innerHTML=partMatches().map(m=>'<label class="check"><input type="checkbox" data-part="'+esc(core.key(m))+'" '+(draft.some(d=>core.key(d)===core.key(m))?'checked':'')+'>'+esc(m.part)+'</label>').join('')||'<p class="small">Tidak ada part pada hasil pencarian.</p>';$('partOptions').querySelectorAll('[data-part]').forEach(b=>b.onchange=()=>{const m=data.catalog.find(m=>core.key(m)===b.dataset.part);const previous=draft.find(d=>core.key(d)===b.dataset.part);if(previous)removedTargetParts.set(b.dataset.part,previous);draft=draft.filter(d=>core.key(d)!==b.dataset.part);if(b.checked)draft.push(restorePart(m));renderDraft();});}
function renderDraft(){
 const root=$('draftList');
 $('draftCount').textContent=draft.length+' item target';
 $('clearTargetItems').hidden=!targetVersion||draft.length<2;
 $('zeroConfirmation').hidden=draft.length>0;
 if(draft.length)$('zeroConfirm').checked=false;
 $('saveTarget').textContent=targetVersion?'Simpan perubahan':'Simpan target';
 root.replaceChildren();
 draft.forEach((item,index)=>{
  const master=data.catalog.find(m=>core.key(m)===core.key(item));
  const ct=master?.ct||null;
  const row=document.createElement('div');row.className='draftchip planrow';
  row.dataset.targetItem=core.key(item);
  row.innerHTML='<span><strong>'+esc(item.part)+'</strong><br>'+esc(item.machine)+'<br><small>'+
   (ct?'CT '+esc(ct)+' detik/pcs · Master '+esc(master.ctDate):'CT belum tersedia · isi qty manual')+
   (master?'':' · Pilih ulang part di master terbaru')+'</small></span>'+
   '<label>Jam efektif<input type="number" min="0.01" step="0.01" inputmode="decimal" placeholder="Mis. 1,5" data-hours></label>'+
   '<label>Target OK (pcs)<input type="number" min="1" max="999999999" step="1" inputmode="numeric" required data-qty></label>'+
   '<button type="button" class="target-remove" data-remove aria-label="Hapus '+esc(item.part)+'">Hapus part</button>'+
   '<div class="calculation"><small data-info></small> <button type="button" data-auto>Gunakan hasil CT</button></div>';
  const hours=row.querySelector('[data-hours]'),qty=row.querySelector('[data-qty]'),auto=row.querySelector('[data-auto]');
  hours.value=item.hours??'';qty.value=item.targetQty??'';
  hours.required=item.hours!=null||item.targetQty==null;
  function refreshInfo(){
   const estimate=core.planQty(item.hours,ct);
   row.querySelector('[data-info]').textContent=(estimate!==null?'Hasil CT '+estimate.toLocaleString('id-ID')+' pcs':'')+(item.manualQty?' · Qty manual':'');
   auto.hidden=estimate===null||(!item.manualQty&&item.targetQty===estimate);
  }
  function calculate(){item.manualQty=false;item.plannedCt=ct;item.targetQty=core.planQty(item.hours,ct);qty.value=item.targetQty??'';}
  hours.oninput=()=>{item.hours=hours.value===''?null:Number(hours.value);if(ct&&!item.manualQty)calculate();refreshInfo();};
  qty.oninput=()=>{item.targetQty=qty.value===''?null:Number(qty.value);item.manualQty=true;item.plannedCt=ct;refreshInfo();};
  auto.onclick=()=>{calculate();refreshInfo();saveTargetDraft();};
  row.querySelector('[data-remove]').onclick=()=>{
   removedTargetParts.set(core.key(item),item);
   draft.splice(index,1);
   renderDraft();
   renderParts();
   saveTargetDraft();
   (root.children[Math.min(index,draft.length-1)]?.querySelector('[data-remove]')||$('zeroConfirm')).focus();
  };
  refreshInfo();root.append(row);
 });
}
function appendReviewEditor(report){
 const form=document.createElement('form');form.className='production-review';
 const heading=document.createElement('h3');heading.textContent='Periksa / revisi';
 const fields=document.createElement('div');fields.className='formgrid';
 const labels={qtyOk:'OK',qtyRepair:'Repair',qtyReject:'Reject',jamMulaiProses:'Jam mulai proses',jamSelesaiProses:'Jam selesai proses',lembur:'Lembur',kendala:'Ada kendala?',kendala4M:'Klasifikasi kendala',permasalahan:'Masalah',tindakan:'Tindakan',pic:'PIC',jamMulaiKendala:'Jam mulai kendala',jamSelesaiKendala:'Jam selesai kendala',tahapDandori:'Tahap dandori',hasilDandori:'Hasil dandori',catatanDandori:'Catatan dandori'};
 const choices={lembur:['Yes','No'],kendala:['Ada','Tidak'],kendala4M:['','MANUSIA','MESIN','MATERIAL','METODE',...(report.line==='LINE_8'?['DANDORY']:[])],tahapDandori:['MULAI BARU','LANJUTAN SHIFT SEBELUMNYA'],hasilDandori:['SELESAI - SIAP PRODUKSI','BELUM SELESAI - LANJUT SHIFT BERIKUTNYA']};
 for(const [key,value] of Object.entries(report.reviewFields)){
  const label=document.createElement('label');label.textContent=labels[key];
  const control=document.createElement(choices[key]?'select':'input');
  if(choices[key])for(const v of choices[key])control.add(new Option(v==='Yes'?'Ya':v==='No'?'Tidak':v||'—',v));
  else if(key.startsWith('qty')){control.type='number';control.min='0';control.max='100000000';control.step=report.line==='LINE_8'?'any':'1';control.required=true;}
  else if(key.startsWith('jam'))control.type='time';
  control.name=key;control.value=value??'';label.append(control);fields.append(label);
 }
 const label=document.createElement('label');label.textContent='Alasan koreksi';const reason=document.createElement('textarea');reason.required=true;reason.minLength=5;reason.maxLength=500;label.append(reason);
 const submit=document.createElement('button');submit.type='submit';submit.className='primary';submit.textContent='Simpan koreksi & setujui';
 const approve=document.createElement('button');approve.type='button';approve.className='primary';
 approve.textContent='Setujui dan teruskan ke TF Slip';
 function changes(){
  return Object.fromEntries(Object.entries(report.reviewFields)
   .map(([key,original])=>[key,form.elements.namedItem(key).value,String(original??'')])
   .filter(([,value,original])=>value!==original));
 }
 function updateActions(){
  const edited=Object.keys(changes()).length>0;
  label.hidden=!edited;reason.required=edited;submit.hidden=!edited;approve.hidden=edited;
 }
 approve.onclick=()=>{if(!Object.keys(changes()).length)approveCard(report.id);else updateActions();};
 form.append(heading,fields,label,approve,submit);$('detailBody').append(form);
 form.addEventListener('input',updateActions);form.addEventListener('change',updateActions);updateActions();
 form.onsubmit=e=>{e.preventDefault();const corrections=changes();
  if(!eligible(report)||!Object.keys(corrections).length)return;
  if(reason.value.trim().length<5){notify('Isi alasan koreksi minimal 5 karakter.',true);reason.focus();return;}
  if(confirm('Setujui dan teruskan hasil koreksi ini ke TF Slip?'))startOperation('decide',{id:report.id,expectedHash:report.hash,decision:'approve',fields:corrections,reason:reason.value.trim()});
 };
}
function openDetail(id){const report=data.reports.find(r=>r.id===id);if(!report)return;
 const pilotApprove=$('line4Approve');pilotApprove.hidden=true;
 if(report.reviewSource==='LINE4_WEB'){
  current=report;$('revisionForm').hidden=true;const input=report.input;
  $('detailBody').innerHTML='<p class="part">'+esc(report.part)+'</p><p>'+esc(report.date+' · '+shiftLabel(report.workspaceShift)+' · '+report.line.replace('_',' ')+' · '+report.machine)+'</p><p>'+esc(report.operator)+'</p><p>'+esc(input.start+'–'+input.end+' WIB · Lembur: '+(input.overtime==='Yes'?'Ya':'Tidak'))+'</p><p>'+esc('OK '+input.ok+' / Repair '+input.repair+' / Reject '+input.reject)+'</p><p class="badge">'+esc(names[report.state])+'</p>'+(input.problem?'<p>Kendala: '+esc(input.problem)+'</p>':'')+(input.action?'<p>Tindakan: '+esc(input.action)+'</p>':'')+(report.validation?'<p>'+esc(report.validation)+'</p>':'')+'<p class="small">'+esc(report.id)+'</p>';
  const options=(data.catalog||[]).filter(item=>item.line===report.line&&item.machine===report.machine);
  if(['WAITING_LEADER','HELD'].includes(report.state)&&options.length&&!options.some(item=>item.part===report.part)){
   const label=document.createElement('label');label.textContent='Part sudah berubah. Pilih part pengganti pada mesin ini.';
   const select=document.createElement('select');select.add(new Option('Pilih part',''));
   options.forEach(item=>select.add(new Option(item.part,item.part)));label.append(select);
   const save=document.createElement('button');save.textContent='Simpan pengganti untuk diperiksa';save.disabled=true;
   select.onchange=()=>{save.disabled=!select.value;};
   save.onclick=async()=>{try{const leader=actor();save.disabled=true;
    await api({action:'remapReviewPart',leader,payload:{id:report.id,expectedHash:report.hash,part:select.value}});
    $('detailDialog').close();$('refresh').click();
   }catch(e){notify(e.message,true);save.disabled=false;}};
   $('detailBody').append(label,save);
  }
  if(eligible(report)&&report.reviewFields)appendReviewEditor(report);
  pilotApprove.hidden=!eligible(report)||!!report.reviewFields;pilotApprove.onclick=()=>approveCard(id);$('detailDialog').showModal();return;
 }
if(report?.viewOnly&&data.revisionEnabled){openWebRevision(id);return;}current=data.reports.find(r=>r.id===id);$('detailBody').innerHTML='<p class="part">'+esc(current.part)+'</p><p>'+esc(current.machine)+' · '+esc(current.line)+'</p><p>'+esc(current.operator)+'</p><p class="badge">'+esc(names[current.state])+'</p>'+(current.validation?'<p class="badge warn">'+esc(current.validation)+'</p>':'')+'<p class="small">'+esc(current.id)+'</p>'+(current.note?'<p class="small">'+esc(current.note)+'</p>':'');$('reason').value='';const x=current.input,actionable=!current.viewOnly&&!!current.hash&&!pendingReport(current.id)&&['WAITING_LEADER','HELD','PUBLISHED'].includes(current.state);$('revisionForm').hidden=!actionable;$('approve').hidden=!eligible(current);$('hold').hidden=current.state==='PUBLISHED';$('revisionFields').innerHTML=actionable?'<label>Tanggal produksi<input name="date" type="date" value="'+esc(x.date)+'" required></label><label>Shift<select name="shift"><option value="1">1</option><option value="2">2</option></select></label><label class="full">Mesin & part<select name="catalog">'+data.catalog.filter(m=>m.line==='LINE_99').map((m,i)=>'<option value="'+i+'">'+esc(m.machine+' · '+m.part)+'</option>').join('')+'</select></label>'+['start','end','ok','repair','reject'].map(k=>'<label>'+({start:'Jam mulai',end:'Jam selesai',ok:'OK',repair:'Repair',reject:'Reject'})[k]+'<input name="'+k+'" type="'+(['start','end'].includes(k)?'time':'number')+'" min="0" value="'+esc(x[k])+'" required></label>').join(''):'';if(actionable){$('revisionFields').querySelector('[name=shift]').value=x.shift;$('revisionFields').querySelector('[name=catalog]').value=String(data.catalog.filter(m=>m.line==='LINE_99').findIndex(m=>m.machineId===x.machineId&&m.part===x.part));}restoreRevisionDraft();$('detailDialog').showModal();}
function readInput(form){const f=new FormData(form),shift=f.get('shift')||data.shift;if(!['1','2'].includes(shift))throw Error('Pilih Shift 1 atau Shift 2 untuk input uji.');const catalog=data.catalog.filter(m=>m.line==='LINE_99'),m=catalog[Number(f.get('catalog'))];if(!m)throw Error('Pilih part & mesin.');return {line:'LINE_99',isTest:true,machineId:m.machineId,part:m.part,date:f.get('date')||data.date,shift,start:f.get('start'),end:f.get('end'),ok:Number(f.get('ok')),repair:Number(f.get('repair')),reject:Number(f.get('reject'))};}
function decide(decision){if(!current||pendingReport(current.id))return;const reason=$('reason').value.trim()||(decision==='approve'?'Pemeriksaan leader melalui detail laporan':'');if(reason.length<5){notify('Isi alasan minimal 5 karakter.',true);return;}const p={id:current.id,expectedHash:current.hash,decision,reason};if(decision==='revise'){if(!$('revisionForm').reportValidity())return;p.fields=readInput($('revisionForm'));}startOperation('decide',p);}

function saveRevisionDraft(){
 if(!$('detailDialog').open||!current||$('revisionForm').hidden)return;
 const fields=Object.fromEntries(new FormData($('revisionForm'))),m=data.catalog.filter(m=>m.line==='LINE_99')[Number(fields.catalog)];delete fields.catalog;
 window.PortalDraft?.set('leader-revision:'+current.id,{hash:current.hash,fields,machine:m?core.key(m):null,reason:$('reason').value});
}
function restoreRevisionDraft(){
 const saved=window.PortalDraft?.get('leader-revision:'+current.id);if(!saved||saved.hash!==current.hash||$('revisionForm').hidden)return;
 for(const [name,value] of Object.entries(saved.fields)){$('revisionForm').elements.namedItem(name).value=value;}
 const index=data.catalog.filter(m=>m.line==='LINE_99').findIndex(m=>core.key(m)===saved.machine);if(index>=0)$('revisionForm').elements.namedItem('catalog').value=String(index);$('reason').value=saved.reason||'';
}
$('detailDialog').addEventListener('input',saveRevisionDraft);$('detailDialog').addEventListener('change',saveRevisionDraft);$('detailDialog').addEventListener('cancel',saveRevisionDraft);
window.addEventListener('pagehide',saveRevisionDraft);
function targetDraftKey(p){return 'leader-target:'+(p?[p.date,p.shift,p.line]:[$('date').value,$('targetShift').value,$('targetLine').value]).join('|');}
function saveTargetDraft(){if(!$('targetDialog').open||!$('targetShift').value||!$('targetLine').value)return;window.PortalDraft?.set(targetDraftKey(),{version:targetVersion,items:draft,reason:$('targetReason').value,zero:$('zeroConfirm').checked});}
function restoreTargetDraft(){const saved=window.PortalDraft?.get(targetDraftKey());if(!saved)return;if(saved.version!==targetVersion){notify('Ada draf lama, tetapi versi target di server telah berubah. Target terbaru digunakan; periksa kembali sebelum mengubah.',true,false);return;}draft=saved.items;$('targetReason').value=saved.reason||'';$('zeroConfirm').checked=!!saved.zero;renderParts();renderDraft();}
$('leader').addEventListener('input',()=>window.PortalDraft?.set('leader-name',$('leader').value));
$('targetDialog').addEventListener('input',e=>{if(!['targetShift','targetLine'].includes(e.target.id))saveTargetDraft();});
$('targetDialog').addEventListener('change',saveTargetDraft);
$('targetDialog').addEventListener('click',saveTargetDraft);
$('targetDialog').addEventListener('cancel',saveTargetDraft);
window.addEventListener('pagehide',()=>{saveTargetDraft();cancelLoad();});
document.querySelectorAll('[data-tab]').forEach(b=>b.onclick=()=>showTab(b.dataset.tab));document.querySelectorAll('[data-close]').forEach(b=>b.onclick=()=>{saveTargetDraft();saveRevisionDraft();$(b.dataset.close).close();});$('refresh').onclick=load;for(const id of ['date','shift','line'])$(id).onchange=()=>{selected.clear();load();};$('status').onchange=renderReports;
let reportView='card';
try{if(localStorage.getItem('leader-report-view')==='list')reportView='list';}catch{}
const viewButtons=document.querySelectorAll('[data-view]');
function updateViewButtons(){
 viewButtons.forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.view===reportView)));
}
updateViewButtons();
viewButtons.forEach(button=>button.onclick=()=>{
 reportView=button.dataset.view;
 try{localStorage.setItem('leader-report-view',reportView);}catch{}
 updateViewButtons();
 renderReports();
});
$('selectAll').onchange=()=>{filteredReports().filter(eligible).forEach(r=>$('selectAll').checked?selected.add(r.id):selected.delete(r.id));renderReports();};$('bulk').onclick=()=>{const rows=filteredReports().filter(r=>eligible(r)&&selected.has(r.id)).slice(0,20);if(!rows.length)return;const remaining=filteredReports().filter(r=>eligible(r)&&selected.has(r.id)).length-rows.length;if(!confirm('Setujui '+rows.length+' laporan terpilih? '+(remaining?remaining+' laporan lainnya tetap terpilih. ':'')+'Laporan yang disetujui akan diproses ke TF Slip.'))return;startOperation('decideBatch',{commands:rows.map(r=>({id:r.id,requestId:crypto.randomUUID(),expectedHash:r.hash,decision:'approve',reason:'Pemeriksaan massal leader melalui dashboard web'}))});};
$('editTargets').onclick=()=>openTargets();
$('clearTargetItems').onclick=()=>{
 for(const item of draft)removedTargetParts.set(core.key(item),item);
 draft=[];
 renderDraft();
 renderParts();
 saveTargetDraft();
 $('zeroConfirm').focus();
};
for(const id of ['targetLine','targetShift'])$(id).onchange=()=>{setTargetLine();restoreTargetDraft();};$('targetMachine').onchange=renderParts;$('partSearch').oninput=renderParts;$('addAll').onclick=()=>{for(const m of partMatches())if(!draft.some(d=>core.key(d)===core.key(m)))draft.push(restorePart(m));renderDraft();renderParts();};
$('targetForm').onsubmit=e=>{e.preventDefault();if(!$('targetForm').reportValidity())return;if(draft.some(m=>!Number.isSafeInteger(m.targetQty)||m.targetQty<1||m.targetQty>999999999)){notify('Isi target OK (pcs) untuk setiap item yang dipilih.',true);return;}if(!draft.length&&!$('zeroConfirm').checked){notify('Konfirmasikan jika line ini tidak memiliki target.',true);return;}const reason=$('targetReason').value.trim();if(targetVersion&&reason.length<5){notify('Isi alasan perubahan minimal 5 karakter.',true);return;}submitTarget({date:data.date,shift:$('targetShift').value,line:$('targetLine').value,expectedVersion:targetVersion,items:draft.map(x=>({...x})),reason});};
$('approve').onclick=()=>decide('approve');$('hold').onclick=()=>decide('hold');$('revisionForm').onsubmit=e=>{e.preventDefault();decide('revise');};
operations.forEach(op=>{if(op.state==='sending')op.state='unknown';});if(['waiting','attention','PUBLISHED'].includes(params.get('status')))$('status').value=params.get('status');showTab(['targets','reports','telegram'].includes(params.get('tab'))?params.get('tab'):'targets');renderPending();render();load();

// Revalidate a saved draft against the receiver catalog; never drop stale items silently.
async function submitTarget(payload){
 if(targetPreparing)return;
 try{actor();}catch(e){notify(e.message,true);return;}
 const pending=operations.find(o=>o.body.action==='target'&&['unknown','sending'].includes(o.state)&&['date','shift','line'].every(k=>o.body.payload[k]===payload[k]));
 saveTargetDraft();$('targetDialog').close();
 if(pending){notify('Target ini masih menunggu konfirmasi. Gunakan Coba lagi dengan ID '+pending.id,true,false);renderPending();return;}
 targetPreparing=true;cancelLoad();notify('Memeriksa master terbaru sebelum mengirim target…',false,false);
 try{
  const result=await api({action:'snapshot',phase:'targets',date:payload.date,shift:payload.shift,line:payload.line});
  const fresh=result.data;
  if(!fresh||fresh.date!==payload.date||fresh.shift!==payload.shift||!Array.isArray(fresh.catalog)||!Array.isArray(fresh.targets))throw Error('Master belum dapat diperiksa. Draf tetap tersimpan; silakan coba lagi.');
  if(contextMatches()&&data.date===payload.date&&(data.shift===payload.shift||data.shift==='all')&&(!data.reportLine||data.reportLine===payload.line)){
   data.targets=data.targets.filter(t=>t.workspaceShift!==payload.shift||t.line!==payload.line).concat(fresh.targets.filter(t=>t.line===payload.line).map(t=>({...t,workspaceShift:payload.shift})));
   render();
  }
  const savedTarget=fresh.targets.find(t=>t.line===payload.line);
  const version=savedTarget?.version||0;
  if(version!==payload.expectedVersion)throw Error(messages.VERSION_CHANGED_REFRESH+' Draf belum dikirim.');
  const selection=core.targetSelection(payload.items,fresh.catalog,payload.line);
  if(selection.invalid.length)throw Error('Target belum dikirim. Item tidak sesuai master: '+selection.invalid.map(m=>m.machine+' · '+m.part).join('; ')+'. Buka Atur target untuk memilih ulang. Draf dan qty tetap tersimpan.');
  const savedItems=new Map((savedTarget?.items||[]).map(item=>[core.key(item),item]));
  for(const item of selection.items){
   if(!item.hours||item.manualQty)continue;
   const key=core.key(item),previous=savedItems.get(key);
   const unchanged=previous&&!previous.manualQty&&previous.hours===item.hours&&previous.targetQty===item.targetQty&&previous.plannedCt===item.plannedCt;
   if(!unchanged&&core.planQty(item.hours,fresh.catalog.find(m=>core.key(m)===key)?.ct)!==item.targetQty){
    if(contextMatches()&&data.date===payload.date&&(!data.reportLine||data.reportLine===payload.line)){
     data.catalog=data.catalog.filter(m=>m.line!==payload.line).concat(fresh.catalog.filter(m=>m.line===payload.line));
    }
    throw Error('CT master berubah. Buka kembali Atur target dan periksa qty sebelum menyimpan.');
   }
  }
  payload.items=selection.items;
  window.PortalDraft?.set(targetDraftKey(payload),{version:payload.expectedVersion,items:payload.items,reason:payload.reason,zero:!payload.items.length});
  notify('Target sedang dikirim. Hasil berhasil atau gagal akan tampil di halaman ini.',false,false);
  await startOperation('target',payload);
 }catch(e){notify(e.message,true,false);}finally{targetPreparing=false;if(contextMatches()&&!data.reportsLoaded&&!loading)load();}
}

$('slipLink').addEventListener('click', function () {
 const filters = new URLSearchParams({date:$('date').value, line:$('line').value, shift:$('shift').value});
 this.href = '/tf-slip.html?' + filters;
});
