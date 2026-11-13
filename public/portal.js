(function(){
 'use strict';
 const $=id=>document.getElementById(id),C=window.PortalCore;
 const titles={ringkasan:'Ringkasan Welding',monitor:'Monitor seluruh mesin',performa:'Performa & hasil',pekerjaan:'Pekerjaan operator',target:'Target leader',laporan:'Pemeriksaan & TF Slip',sesi:'Sesi Champer / tablet',live:'Monitor Live Champer',simulasi:'Latihan simulasi'};
 let catalog=[],catalogReady=false,snapshots=null,loadedPeriod='',current='ringkasan',page=0,loading=null,epoch=0,tv=false;
 const frames={};
 const fmt=n=>n===null?'—':Number(n).toLocaleString('id-ID');
 const lineName=l=>l.replace('_',' ')+(l==='LINE_99'?' · Uji':'');
 function el(tag,text,cls){const x=document.createElement(tag);if(text!==undefined)x.textContent=text;if(cls)x.className=cls;return x;}
 function link(text,href){const a=el('a',text);a.href=href;return a;}
 function notice(s){$('notice').textContent=s;$('notice').hidden=!s;}
 function periodKey(){return [$('start').value,$('end').value,$('shift').value].join('|');}
 function chosen(){return catalog.filter(m=>($('line').value?m.line===$('line').value:/^LINE_[1-8]$/.test(m.line))&&(!$('machine').value||m.machine===$('machine').value));}
 function context(){return new URLSearchParams({date:$('start').value,shift:$('shift').value==='all'?'1':$('shift').value,line:$('line').value||'LINE_1'});}
 function available(){return snapshots!==null&&loadedPeriod===periodKey();}
 function machines(){const old=$('machine').value;$('machine').replaceChildren(new Option('Semua mesin',''));const line=$('line').value;[...new Set(catalog.filter(m=>line?m.line===line:/^LINE_[1-8]$/.test(m.line)).map(m=>m.machine))].sort().forEach(m=>$('machine').add(new Option(m,m)));$('machine').value=[...$('machine').options].some(o=>o.value===old)?old:'';}
 async function master(){
  $('catalog-refresh').disabled=true;
  try{const r=await andonFetch('/api/master',{cache:'no-store'},30000);if(!r.ok)throw Error('Master belum dapat dimuat.');const b=await r.json();catalogReady=!!b.ready&&b.source==='live'&&!b.preview;catalog=Object.entries(b.mapping||{}).flatMap(([line,m])=>Object.keys(m.mesin_part_mapping||{}).map(machine=>({line,machine})));const old=$('line').value;$('line').replaceChildren(new Option('Welding · Line 1–8',''));[...new Set(catalog.map(m=>m.line))].sort((a,b)=>Number(a.split('_')[1])-Number(b.split('_')[1])).forEach(l=>$('line').add(new Option(lineName(l),l)));$('line').value=old;machines();$('catalog-state').textContent=catalogReady?'Master tersambung · '+catalog.length+' mesin.':'Katalog cadangan · sambungan master belum terverifikasi. Angka hasil tidak dimuat dari data contoh.';render();}
  catch(e){catalogReady=false;notice(e.message);}finally{$('catalog-refresh').disabled=false;}
 }
 async function snapshot(p,phase,signal){
  const r=await andonFetch('/api/leader',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'snapshot',phase,date:p.date,shift:p.shift,line:''}),cache:'no-store',signal},80000);
  const b=await r.json();if(!r.ok||!b.ok||b.preview||!b.data||b.data.date!==p.date||String(b.data.shift)!==p.shift||b.data.reportLine)throw Error('Hasil periode belum terkonfirmasi. Tidak memakai data contoh atau periode lain.');return b.data;
 }
 async function load(){
  if(loading)return;
  let ps;try{ps=C.periods($('start').value,$('end').value,$('shift').value);if(!catalogReady)throw Error('Muat ulang master sampai tersambung sebelum memuat hasil nyata.');}catch(e){notice(e.message);return;}
  const myEpoch=++epoch,requested=periodKey(),controller=new AbortController();loading=controller;snapshots=null;loadedPeriod='';notice('');render();$('load-results').disabled=true;$('cancel-load').hidden=false;
  try{const result=[];for(let i=0;i<ps.length;i++){
   $('load-state').textContent='Memuat '+(i+1)+' / '+ps.length+' tanggal–shift. Data ditampilkan setelah seluruh periode lengkap.';
   const first=await snapshot(ps[i],'targets',controller.signal);let s=first;
   if(first.reportsLoaded===false){const second=await snapshot(ps[i],'reports',controller.signal);if(second.reportsLoaded===false)throw Error('Laporan periode belum lengkap.');s={...second,targets:first.targets};}
   if(!Array.isArray(s.targets)||!Array.isArray(s.reports))throw Error('Data target/laporan belum lengkap.');result.push(s);
  }
  if(myEpoch!==epoch||requested!==periodKey())return;snapshots=result;loadedPeriod=requested;$('load-state').textContent='Dimuat '+new Date().toLocaleTimeString('id-ID')+' · '+ps.length+' tanggal–shift lengkap. Muat ulang untuk perubahan terbaru.';render();
  }catch(e){if(myEpoch===epoch){snapshots=null;$('load-state').textContent='Belum ada hasil periode lengkap.';notice(e.name==='AbortError'?'Pemuatan dibatalkan atau melewati batas waktu. Silakan coba lagi.':e.message);render();}}
  finally{if(loading===controller){loading=null;$('load-results').disabled=false;$('cancel-load').hidden=true;}}
 }
 function invalidate(){epoch++;if(loading)loading.abort();snapshots=null;loadedPeriod='';page=0;$('load-state').textContent='Periode berubah. Klik Muat hasil periode.';render();}
 function render(){
  const has=available(),rows=C.summarize(has?snapshots:[],catalog,$('line').value,$('machine').value),sum=k=>rows.reduce((n,r)=>n+r[k],0),invalid=sum('invalid'),partial=invalid?' · parsial (data perlu diperiksa)':'';
  $('total').textContent=rows.length;$('scope-note').textContent=$('line').value?lineName($('line').value):'Welding Line 1–8 · tidak termasuk Line 99';
  $('ok').textContent=has&&sum('reports')?fmt(sum('ok'))+partial:'—';$('target-total').textContent=has&&sum('targetItems')?fmt(sum('target'))+partial:'—';$('published').textContent=has?fmt(sum('publishedOk'))+partial:'—';
  $('board-context').textContent=$('start').value+' — '+$('end').value+' · '+($('shift').value==='all'?'Semua shift':'Shift '+$('shift').value)+' · '+$('scope-note').textContent;
  const pages=Math.max(1,Math.ceil(rows.length/6));page=Math.min(page,pages-1);$('page').textContent=(page+1)+' / '+pages;$('prev').disabled=$('next').disabled=pages===1;$('page-note').textContent=rows.length+' mesin · 6 per layar · '+(has?'hasil laporan tersimpan':'hasil periode belum dimuat');$('cards').replaceChildren();
  if(!rows.length)$('cards').append(el('p','Belum ada mesin sesuai filter.','empty'));
  rows.slice(page*6,page*6+6).forEach(m=>{
   const pilot=m.line==='LINE_99'&&m.machine==='AUTO CHAMPER',card=el('article',undefined,'production-card');
   const head=el('div',undefined,'production-head');head.append(el('span',lineName(m.line)),el('span',pilot?'Pilot PLC · Line 99 Uji':'Alur laporan existing','badge neutral'));card.append(head,el('h3',m.machine));
   const nums=el('div',undefined,'production-numbers');[['OK dilaporkan',has&&m.reports?m.ok:null],['Target OK',has&&m.targetItems?m.target:null]].forEach(([label,n])=>{const box=el('div');box.append(el('span',label),el('strong',fmt(n)),el('small','pcs'));nums.append(box);});card.append(nums);
   const percent=has&&m.reports&&m.targetItems&&m.target>0&&!m.invalid?Math.round(m.ok/m.target*100):null;
   card.append(el('p',percent===null?'Pencapaian —':percent+'% · OK dilaporkan / target OK','production-progress'));
   card.append(el('p',has?(m.invalid?'Data parsial · periksa laporan/target.':m.reports?('Repair '+fmt(m.repair)+' · Reject '+fmt(m.reject)+' · '+m.published+'/'+m.reports+' laporan terbit TF'):'Belum ada laporan pada periode ini.'):'Muat hasil periode untuk melihat angka.','production-quality'));
   card.append(el('small','Counter live / MTC / dandori: '+(pilot?'lihat detail; status yang belum tersedia bukan nol.':'belum terintegrasi.'),'production-raw'));
   const p=context();p.set('line',m.line);p.set('machine',m.machine);card.append(link('Pekerjaan mesin →','/pekerjaan.html?'+p));if(pilot)card.append(link('Counter live Champer →','/monitor-live.html'));$('cards').append(card);
  });
  $('line-rows').replaceChildren();const groups=new Map();rows.forEach(r=>{if(!groups.has(r.line))groups.set(r.line,[]);groups.get(r.line).push(r);});
  groups.forEach((rs,l)=>{const total=k=>rs.reduce((n,r)=>n+r[k],0),tr=el('tr'),td=el('td'),b=el('button',lineName(l),'table-link');b.onclick=()=>{$('line').value=l;machines();page=0;render();};td.append(b);tr.append(td);for(const k of ['ok','target','repair','reject'])tr.append(el('td',has?((k==='target'?total('targetItems'):total('reports'))?fmt(total(k))+(total('invalid')?' *':''):'—'):'—'));tr.append(el('td',has?total('reports')+' / '+total('published'):'—'));$('line-rows').append(tr);});
 }
 const keyFor=v=>['target','laporan'].includes(v)?'leader':v;
 function pathFor(v){const p=context();if(v==='target'||v==='laporan'){p.set('tab',v==='laporan'?'reports':'targets');return '/leader?'+p;}return ({pekerjaan:'/pekerjaan.html?'+p,sesi:'/champer-plc.html',live:'/monitor-live.html',simulasi:'/champer-simulasi.html'})[v];}
 function embed(frame){
  const doc=frame.contentDocument;if(!doc)return;
  const actual=C.classify(frame.contentWindow.location.href,location.origin);
  if(actual&&keyFor(actual.view)!==frame.dataset.key){delete frames[frame.dataset.key];frame.remove();navigate(actual.view,actual.path);return;}
  doc.documentElement.classList.add('portal-embedded');const style=doc.createElement('link');style.rel='stylesheet';style.href='/portal-embed.css';doc.head.append(style);
  doc.addEventListener('input',()=>{frame.dataset.dirty='true';});
  doc.addEventListener('click',intercept);
  if(frame.dataset.key==='leader'&&['target','laporan'].includes(current))doc.querySelector('[data-tab="'+(current==='laporan'?'reports':'targets')+'"]')?.click();
 }
 function intercept(e){
  const a=e.target.closest('a[href]');if(!a||e.defaultPrevented||e.button!==0||e.ctrlKey||e.metaKey||e.shiftKey||e.altKey||a.hasAttribute('download')||a.target==='_blank')return;
  const route=C.classify(a.href,location.origin);if(!route)return;e.preventDefault();if(route.view==='form'){window.location.assign(route.path);return;}navigate(route.view,route.path);
 }
 function navigate(v,path){
  if(!titles[v])v='ringkasan';const module=!['ringkasan','monitor','performa'].includes(v);let frame;
  if(module){const key=keyFor(v);frame=frames[key];if(frame&&path){
   const before=new URL(frame.contentWindow.location.href),after=new URL(path,location.origin);before.searchParams.delete('tab');after.searchParams.delete('tab');
   const targetChanged=key==='sesi'&&frame.dataset.target!==sessionStorage.getItem('champer-selected-target');
   if(before.pathname+before.search!==after.pathname+after.search||targetChanged){
    // Navigation between menu items preserves frames; only explicit new-context links may reload.
    if(frame.dataset.dirty==='true'&&!confirm('Halaman tujuan memiliki konteks berbeda. Buka ulang halaman ini? Isian yang belum disimpan dapat hilang.'))return;
    if(key==='sesi'&&frame.contentDocument?.getElementById('identity')?.textContent.trim()){notice('Sesi Champer yang sedang terbuka dipertahankan. Selesaikan atau tutup sesi melalui alurnya sebelum mengganti pekerjaan.');}
    else {frame.dataset.dirty='false';frame.dataset.target=sessionStorage.getItem('champer-selected-target')||'';frame.src=path;}
   }
  }
  if(!frame){frame=el('iframe');frame.title=titles[v];frame.dataset.key=key;frame.dataset.target=sessionStorage.getItem('champer-selected-target')||'';frame.setAttribute('sandbox','allow-scripts allow-same-origin allow-forms allow-modals allow-downloads allow-popups allow-popups-to-escape-sandbox allow-top-navigation-by-user-activation');frame.onload=()=>embed(frame);frames[key]=frame;$('frames').append(frame);frame.src=path||pathFor(v);}
  }
  current=v;setTV(false);$('dashboard').hidden=module;$('modules').hidden=!module;$('performance').hidden=v!=='performa';$('page-label').textContent=titles[v];$('heading').textContent=v==='performa'?'Performa berdasarkan bukti.':v==='monitor'?'Seluruh mesin, satu layar.':'Dari rencana ke hasil produksi.';
  document.querySelectorAll('[data-view]').forEach(a=>{a.classList.toggle('active',a.dataset.view===v);if(a.dataset.view===v)a.setAttribute('aria-current','page');else a.removeAttribute('aria-current');});
  Object.values(frames).forEach(f=>f.hidden=f!==frame);
  if(module){$('module-title').textContent=titles[v];$('standalone').href=path||frame.src;if(keyFor(v)==='leader')frame.contentDocument?.querySelector('[data-tab="'+(v==='laporan'?'reports':'targets')+'"]')?.click();}
  if(location.hash!=='#'+v)history.pushState(null,'','#'+v);if(!module)render();
 }
 function setTV(value){tv=value;document.body.classList.toggle('tv-mode',tv);$('tv').textContent=tv?'Keluar mode TV':'Mode TV';$('full').hidden=!tv;if(tv)$('rotate').checked=true;}
 const parts=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Jakarta',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date());$('start').value=$('end').value=['year','month','day'].map(k=>parts.find(p=>p.type===k).value).join('-');
 document.addEventListener('click',intercept);window.addEventListener('popstate',()=>navigate(location.hash.slice(1)));window.addEventListener('hashchange',()=>navigate(location.hash.slice(1)));
 for(const id of ['start','end','shift'])$(id).onchange=invalidate;$('line').onchange=()=>{machines();page=0;render();};$('machine').onchange=()=>{page=0;render();};$('catalog-refresh').onclick=master;$('load-results').onclick=load;$('cancel-load').onclick=()=>loading?.abort();
 function flip(n){const count=C.summarize(available()?snapshots:[],catalog,$('line').value,$('machine').value).length;page=(page+n+Math.max(1,Math.ceil(count/6)))%Math.max(1,Math.ceil(count/6));render();}
 $('prev').onclick=()=>flip(-1);$('next').onclick=()=>flip(1);$('tv').onclick=()=>setTV(!tv);$('full').onclick=()=>{if(document.documentElement.requestFullscreen)document.documentElement.requestFullscreen().catch(()=>notice('Gunakan F11 untuk layar penuh.'));else notice('Gunakan layar penuh browser.');};document.addEventListener('keydown',e=>{if(e.key==='Escape')setTV(false);});
 setInterval(()=>{if(!document.hidden&&$('rotate').checked&&!$('dashboard').hidden)flip(1);},15000);
 master();navigate(location.hash.slice(1)||'ringkasan');
})();
