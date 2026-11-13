(function(){'use strict';
var $=id=>document.getElementById(id),data=null,machines=[],kind='all',frames={},current='ringkasan',detailMachine=null,epoch=0;
var periods={},boardPage=0,tv=false,rotateTimer=null,monitor=window.PortalMonitor;
var example={value:18392,status:'sample',mtc:0,dandori:0},titles={ringkasan:'Ringkasan pabrik',monitor:'Monitor Live',performa:'Performa mesin',pekerjaan:'Pekerjaan operator',target:'Target leader',laporan:'Hasil & pemeriksaan',riwayat:'Riwayat sesi uji',form:'Form produksi',sesi:'Sesi Champer · simulasi'};
var notes={pekerjaan:'Pilih tanggal, shift, line, dan mesin. Start/End pada pratinjau hanya simulasi Champer Line 99.',target:'Tampilan target menggunakan data contoh. Penyimpanan target dinonaktifkan pada pratinjau.',laporan:'Lihat contoh hasil OK, repair, reject, dan status laporan. Persetujuan / TF Slip tidak dijalankan.',riwayat:'Riwayat sesi latihan pada browser ini; terpisah dari laporan produksi.',form:'Form yang sekarang digunakan tetap tersedia. Tampilan dipertahankan; pengiriman dinonaktifkan pada pratinjau.',sesi:'Latihan Start/End disimpan hanya di browser ini. Tidak membaca atau mengendalikan PLC.'};
function node(tag,value,cls){var e=document.createElement(tag);if(value!==undefined)e.textContent=value;if(cls)e.className=cls;return e;}
function lineName(line){return line==='LINE_99'?'Line 99 · Uji':line.replace('LINE_','Line ');}
function pilot(m){return m.line==='LINE_99'&&m.name==='AUTO CHAMPER';}
function fmt(n){return Number(n).toLocaleString('id-ID');}
function option(select,value,label){select.add(new Option(label,value));}
function query(){return new URLSearchParams({date:$('date').value,shift:$('shift').value,line:$('line').value});}
function selected(){var search=$('search').value.trim().toLowerCase();return machines.filter(m=>(!$('line').value||m.line===$('line').value)&&(!$('machine').value||m.name===$('machine').value)&&(!search||m.name.toLowerCase().includes(search))&&(kind==='all'||(kind==='pilot')===pilot(m)));}
function machineOptions(){var old=$('machine').value;$('machine').replaceChildren(new Option('Semua mesin',''));[...new Set(machines.filter(m=>!$('line').value||m.line===$('line').value).map(m=>m.name))].sort().forEach(m=>option($('machine'),m,m));if([...$('machine').options].some(o=>o.value===old))$('machine').value=old;}
function action(label,fn,cls){var b=node('button',label,cls||'secondary');b.type='button';b.onclick=fn;return b;}
function matching(row,list){return list.some(m=>m.line===row.line&&m.name===row.machine);}
function render(){if(!data)return;var list=selected(),p=list.filter(pilot).length;
 $('total').textContent=list.length;$('pilot').textContent=p;$('future').textContent=list.length-p;
 $('total-note').textContent=new Set(list.map(m=>m.line)).size+' line sesuai filter';
 var reports=data.workspace.reports.filter(r=>matching(r,list)),targets=data.workspace.targets.flatMap(t=>t.items).filter(t=>matching(t,list));
 $('output').textContent=targets.length?fmt(reports.reduce((s,r)=>s+r.input.ok,0))+' / '+fmt(targets.reduce((s,t)=>s+t.targetQty,0)):'—';
 $('output-note').textContent=targets.length?'Contoh · bukan counter kumulatif':'Belum ada target contoh untuk filter ini';
 $('machine-heading').textContent=list.length+' mesin'+($('line').value?' · '+lineName($('line').value):'');
 $('catalog-note').textContent='Nama mesin dari snapshot master 29 Oktober 2026. Champer Line 1 tetap alur manual; pilot berada di Line 99. Katalog belum disinkronkan ulang.';
 $('lines').replaceChildren();[...new Set(machines.map(m=>m.line))].sort((a,b)=>Number(a.split('_')[1])-Number(b.split('_')[1])).forEach(l=>{
  var ms=machines.filter(m=>m.line===l),count=ms.filter(pilot).length,b=action('',()=>{$('line').value=l;$('machine').value='';machineOptions();render();},'line-card'+($('line').value===l?' selected':''));
  b.setAttribute('aria-label',lineName(l)+', '+ms.length+' mesin');b.append(node('strong',lineName(l)),node('small',ms.length+' mesin · '+count+' pilot'));
  var bar=node('div',undefined,'coverage'),fill=node('i');fill.style.width=(count/ms.length*100)+'%';bar.append(fill);b.append(bar);$('lines').append(b);
 });
 $('machines').replaceChildren();if(!list.length)$('machines').append(node('p','Tidak ada mesin yang cocok. Ubah filter atau kata pencarian.','empty'));
 list.forEach(m=>{var isPilot=pilot(m),card=node('article',undefined,'machine-card'+(isPilot?' featured':''));card.dataset.machine=m.line+'|'+m.name;
  var top=node('div',undefined,'cardtop');top.append(node('span',lineName(m.line)),node('span',isPilot?'Pilot PLC · contoh':'Belum terintegrasi','badge '+(isPilot?'pilot':'neutral')));
  card.append(top,node('h3',m.name),node('small',isPilot?'Nilai mentah D100 · simulasi':'Counter mesin', 'subtle'),node('div',isPilot?fmt(example.value):'—','cardnumber'));
  card.append(node('p',isPilot?(example.status==='timeout'?'Histori contoh · pembaruan terputus':'Angka contoh untuk pratinjau dashboard'):'Data PLC belum tersedia. Bukan berarti mesin berhenti.'));
  var status=node('div',undefined,'status-row');status.append(node('span','MTC '+(isPilot&&example.status!=='timeout'?example.mtc+' · contoh':'—')),node('span','Dandori '+(isPilot&&example.status!=='timeout'?example.dandori+' · contoh':'—')));card.append(status);
  var actions=node('div',undefined,'cardactions');actions.append(action('Detail mesin',()=>openDetail(m)),action(isPilot?'Pekerjaan uji':'Form laporan',()=>openModule(isPilot?'pekerjaan':'form',isPilot?'/pekerjaan.html?'+new URLSearchParams({date:$('date').value,shift:$('shift').value,line:m.line,machine:m.name,source:'example'}):'/?portal=1'),'primary'));card.append(actions);$('machines').append(card);
 });
 renderBoard();
 renderPerformance();
}
function selectPerformanceMachine(m,name){$('line').value=m.line;$('machine').value='';machineOptions();$('machine').value=m.name;kind='all';document.querySelectorAll('[data-filter]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.filter==='all')));$('search').value='';navigate(name);window.scrollTo(0,0);}
function renderPerformance(){if(data)window.PortalPerformance.render({machines:selected(),date:$('date').value,shift:$('shift').value,line:$('line').value,stateAt:function(date,shift){var key=date+'|'+shift;return periods[key]||(periods[key]=monitor.initial(shift));},select:selectPerformanceMachine,selectLine:function(line){$('line').value=line;$('machine').value='';machineOptions();render();},openMonitor:function(m,date,shift){$('date').value=date;$('shift').value=shift;selectPerformanceMachine(m,'monitor');}});}
function periodKey(){return $('date').value+'|'+$('shift').value;}
function periodState(){var key=periodKey();return periods[key]||(periods[key]=monitor.initial($('shift').value));}
function monitorMachines(){return selected().slice().sort((a,b)=>Number(pilot(b))-Number(pilot(a)));}
function renderBoard(){if(!data)return;var list=monitorMachines(),pages=Math.max(1,Math.ceil(list.length/6));boardPage=Math.min(boardPage,pages-1);var scope=$('period').value,s=periodState(),r=monitor.result(s,scope);
 $('board-context').textContent=$('date').value+' · Shift '+$('shift').value+' · '+($('line').value?lineName($('line').value):'Semua line')+' · '+(scope==='session'?'Sesi berjalan':'Akumulasi sesi pada shift');
 $('board-cards').replaceChildren();$('board-cards').classList.toggle('single',list.length===1);if(!list.length)$('board-cards').append(node('p','Tidak ada mesin sesuai filter.','empty'));
 list.slice(boardPage*6,boardPage*6+6).forEach(m=>{var p=pilot(m),card=node('article',undefined,'production-card'+(p?' has-example':' not-integrated'));card.dataset.pilot=String(p);
  var head=node('div',undefined,'production-head');head.append(node('span',lineName(m.line)),node('span',p?(r.invalid?'Perlu pemeriksaan':s.available?'Data contoh':'Data terputus · contoh'):'Belum terintegrasi','badge '+(p?'amber':'neutral')));var title=node('h3');title.append(action(m.name,()=>selectPerformanceMachine(m,'performa'),'perf-machine-link'));card.append(head,title);
  card.append(node('p',p?('Sesi contoh '+s.session+' · '+(m.parts[0]||'Part contoh')):'Alur form LKH · data live belum tersedia','production-part'));
  var numbers=node('div',undefined,'production-numbers');[['Aktual live · bruto',p?r.actual:null,'actual'],['Target OK',p?r.target:null,'target']].forEach(([label,value,cls])=>{var box=node('div');box.append(node('span',label),node('strong',value===null?'—':fmt(value),cls),node('small','pcs'));numbers.append(box);});card.append(numbers);
  var progress=node('div',undefined,'production-progress'),percent=p?r.indicativePercent:null;
  progress.append(node('span',percent===null?'Progres belum tersedia':Math.round(percent)+'% · bruto / target OK (indikatif)'));
  var track=node('div',undefined,'production-track'),fill=node('i');fill.style.width=(percent===null?0:Math.min(100,percent))+'%';track.append(fill);progress.append(track);card.append(progress);
  card.append(node('p',p?(r.invalid?'Counter turun / tidak valid; selisih tidak dihitung.':!s.available?'Histori bruto: '+(r.historical===null?'—':fmt(r.historical))+' pcs · bukan nilai terkini':r.ok===null?'OK sesi belum dilaporkan':('OK dilaporkan '+fmt(r.ok)+' pcs · '+(r.okPercent===null?'—':Math.round(r.okPercent)+'%')+' target')):'— Tidak ada pembacaan; bukan berarti mesin berhenti.','production-quality'));
  var signals=node('div',undefined,'production-signals');signals.append(node('span','MTC '+(p&&s.available?(s.mtc?'AKTIF':'0'):'—')),node('span','DANDORI '+(p&&s.available?(s.dandori?'AKTIF':'0'):'—')));card.append(signals,node('small',p?'D100 kumulatif '+fmt(r.raw)+' · contoh · tidak direset':'PLC belum terpasang / belum dipetakan','production-raw'));$('board-cards').append(card);
 });
 $('board-page').textContent=(boardPage+1)+' / '+pages;$('board-prev').disabled=pages<=1;$('board-next').disabled=pages<=1;
 $('board-note').textContent=list.length+' mesin · Maks. 6 per layar · Data contoh, bukan produksi aktual';$('demo-outage').textContent=s.available?'Simulasikan putus data':'Pulihkan contoh';
}
function flipPage(step){var pages=Math.max(1,Math.ceil(monitorMachines().length/6));boardPage=(boardPage+step+pages)%pages;renderBoard();}
function updateRotation(){clearInterval(rotateTimer);if(current==='monitor'&&$('board-rotate').checked)rotateTimer=setInterval(()=>{if(!document.hidden)flipPage(1);},15000);}
function setTV(enabled){tv=enabled;document.body.classList.toggle('tv-mode',tv);$('tv-toggle').textContent=tv?'Keluar mode TV':'Mode TV';$('fullscreen').hidden=!tv;if(tv){$('board-rotate').checked=true;window.scrollTo(0,0);}else if(document.fullscreenElement)document.exitFullscreen().catch(()=>{});updateRotation();}
function openDetail(m){detailMachine=m;drawDetail();$('detail').showModal();}
function drawDetail(){var m=detailMachine,p=pilot(m),body=$('detail-body');$('detail-name').textContent=m.name;$('detail-line').textContent=lineName(m.line);body.replaceChildren();
 if(p){var box=node('div',undefined,'detail-reading');box.append(node('span','D100 · data simulasi', 'badge amber'),node('strong',fmt(example.value)),node('p',example.status==='timeout'?'Histori contoh; belum ada pembacaan baru.':'Contoh pembaruan diterima. Bukan pembacaan PLC.'));body.append(box);
  body.append(node('p','MTC '+(example.status==='timeout'?'tidak diketahui':example.mtc+' (contoh)')+' · Dandori '+(example.status==='timeout'?'tidak diketahui':example.dandori+' (contoh)'),'detail-note'));
  var controls=node('div',undefined,'detail-actions');controls.append(action('+12 hitungan contoh',()=>{example.value+=12;example.status='sample';render();drawDetail();},'primary'),action(example.status==='timeout'?'Pulihkan contoh':'Simulasikan putus data',()=>{example.status=example.status==='timeout'?'sample':'timeout';render();drawDetail();}),action('Ubah MTC contoh',()=>{example.mtc=example.mtc?0:1;render();drawDetail();}),action('Ubah dandori contoh',()=>{example.dandori=example.dandori?0:1;render();drawDetail();}));body.append(controls);
  body.append(node('p','Counter kumulatif bukan jumlah OK atau hasil per pekerjaan. Saat data terputus, angka terakhir tetap ditandai histori. Jeda sensor / PLC tidak diukur dalam pratinjau.','detail-note'));
 }else{body.append(node('div','Belum terintegrasi PLC','detail-reading'),node('p','Mesin ini tetap mengikuti form produksi yang sudah digunakan. Integrasi mendatang dapat menambahkan counter dan sinyal mesin setelah alamat serta maknanya diverifikasi. Tidak ada angka atau status operasional yang dibuat-buat.','detail-note'));}
 var section=node('div');section.append(node('h3','Part dalam snapshot katalog'));m.parts.filter(x=>x!=='__other_option__').slice(0,6).forEach(part=>section.append(node('p',part,'detail-note')));if(m.parts.length>6)section.append(node('p','+'+(m.parts.length-6)+' pilihan lainnya','subtle'));body.append(section);
 body.append(action(p?'Buka pekerjaan Champer uji':'Buka form produksi',()=>{$('detail').close();openModule(p?'pekerjaan':'form',p?'/pekerjaan.html?'+new URLSearchParams({date:$('date').value,shift:$('shift').value,line:m.line,machine:m.name,source:'example'}):'/');},'primary'));
}
function view(name){document.body.classList.toggle('performance-view',name==='performa');current=titles[name]?name:'ringkasan';if(current!=='monitor'&&tv)setTV(false);$('live-board').hidden=current!=='monitor';$('performance-board').hidden=current!=='performa';$('catalog-section').hidden=current!=='ringkasan';document.querySelector('.metrics').hidden=current!=='ringkasan';updateRotation();$('page-label').textContent=titles[current];document.title=titles[current]+' · Portal pratinjau Berlindo';document.querySelectorAll('[data-view]').forEach(a=>{if(a.dataset.view===current)a.setAttribute('aria-current','page');else a.removeAttribute('aria-current');});var dash=['ringkasan','monitor','performa'].includes(current);$('dashboard').hidden=!dash;$('modules').hidden=dash;
 $('overview').hidden=current!=='ringkasan';$('heading').textContent=current==='monitor'?'Mesin hari ini, dalam satu layar.':'Satu pabrik. Satu pandangan.';$('subtitle').textContent=current==='monitor'?'Pratinjau pemantauan semua mesin. Hanya Champer Line 99 memiliki contoh pembacaan PLC.':'Lihat kesiapan integrasi setiap line, lalu masuk ke pekerjaan yang Anda perlukan.';
 if(current==='performa') { $('heading').textContent='Pahami hasil. Temukan kehilangan.'; $('subtitle').textContent='OEE, kualitas, efisiensi waktu dan pencapaian target per mesin.'; }
 if(!dash){$('module-title').textContent=titles[current];$('module-note').textContent=notes[current];}
}
function pathFor(name){var q=query();if(name==='target'||name==='laporan'){q.set('tab',name==='laporan'?'reports':'targets');return '/leader.html?'+q;}if(name==='form')return '/';if(name==='sesi'||name==='riwayat')return '/champer-simulasi.html';q.set('source','example');q.set('machine','');return '/pekerjaan.html?'+q;}
function keyFor(name){return ['target','laporan'].includes(name)?'leader':['sesi','riwayat'].includes(name)?'simulation':name;}
function embedded(frame){var doc=frame.contentDocument;if(!doc)return;
 // Keep the React form DOM intact; the surrounding portal already labels preview mode.
 if(frame.dataset.key!=='form'){var style=doc.createElement('link');style.rel='stylesheet';style.href='/portal-embed.css';doc.head.append(style);doc.documentElement.classList.add('portal-embedded');
 var banner=node('div','PRATINJAU · Data contoh. Penyimpanan produksi tidak tersedia.','portal-embed-note');doc.body.prepend(banner);}
 if(frame.dataset.key==='leader'){
  doc.querySelectorAll('#editTargets,#bulk,#testForm button,[data-tab="test"],[data-tab="telegram"],#selectAll').forEach(b=>{b.disabled=true;b.title='Tidak tersedia di pratinjau';});
 }
 // Handle ordinary navigation inside the portal after original target-selection handlers.
 doc.addEventListener('click',function(e){var a=e.target.closest('a[href]');if(!a||e.defaultPrevented||a.hasAttribute('download'))return;var u=new URL(a.href);if(u.origin!==location.origin){e.preventDefault();return;}var p=u.pathname,name=p==='/'?'form':p.includes('leader')?(u.searchParams.get('tab')==='reports'?'laporan':'target'):p.includes('pekerjaan')?'pekerjaan':p.includes('monitor-live')?'monitor':p.includes('champer-')?'sesi':null;if(!name)return;e.preventDefault();if(name==='sesi'){u.pathname='/champer-simulasi.html';u.searchParams.set('from','pekerjaan');}if(name==='pekerjaan')u.searchParams.set('source','example');if(name==='monitor')navigate(name);else openModule(name,u.pathname+u.search);});
 if(current==='riwayat')doc.getElementById('history')?.scrollIntoView();
}
function openModule(name,path){if(name==='form'){window.location.assign('/');return;}view(name);if(location.hash!=='#'+name)history.pushState(null,'','#'+name);var key=keyFor(name),frame=frames[key];Object.values(frames).forEach(f=>f.hidden=true);
 if(!frame){frame=node('iframe');frame.title=titles[name];frame.dataset.key=key;frame.setAttribute('sandbox','allow-scripts allow-same-origin allow-forms allow-modals allow-downloads');frame.onload=()=>embedded(frame);$('frames').append(frame);frames[key]=frame;frame.src=path||pathFor(name);}
 else if(path&&new URL(frame.src).pathname+new URL(frame.src).search!==path){
  // Do not abandon a prepared/active simulated job when navigating back to it.
  var active=false;if(key==='simulation'){try{var s=JSON.parse(localStorage.getItem('berlindo-champer-line99-simulation-v1')||'null');active=!!s?.jobs?.some(j=>!['COMPLETED','CANCELLED'].includes(j.state));}catch{}}
  if(!active)frame.src=path;
 }
 frame.hidden=false;
 if(key==='leader'&&frame.contentDocument){frame.contentDocument.querySelector('[data-tab="'+(name==='laporan'?'reports':'targets')+'"]')?.click();}
 if(name==='riwayat')frame.contentDocument?.getElementById('history')?.scrollIntoView();
}
function navigate(name){if(['ringkasan','monitor','performa'].includes(name)){view(name);if(location.hash!=='#'+name)history.pushState(null,'','#'+name);render();}else openModule(name);}
async function load(){var id=++epoch;$('refresh').disabled=true;try{var r=await andonFetch('/api/portal-preview?'+query(),{cache:'no-store'});if(!r.ok)throw Error('Portal ini hanya tersedia pada lingkungan pratinjau.');var b=await r.json();if(!b.enabled)throw Error('Pratinjau belum tersedia.');if(id!==epoch)return;data=b;machines=Object.entries(b.mapping).flatMap(([line,v])=>Object.entries(v.mesin_part_mapping).map(([name,m])=>({line,name,parts:m.options})));var old=$('line').value;$('line').replaceChildren(new Option('Semua line',''));[...new Set(machines.map(m=>m.line))].sort((a,b)=>Number(a.split('_')[1])-Number(b.split('_')[1])).forEach(l=>option($('line'),l,lineName(l)));$('line').value=old;machineOptions();$('error').hidden=true;render();}catch(e){$('error').textContent=e.message;$('error').hidden=false;}finally{if(id===epoch)$('refresh').disabled=false;}}
var d=new Date(),parts=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Jakarta',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(d);$('date').value=['year','month','day'].map(k=>parts.find(p=>p.type===k).value).join('-');
document.querySelectorAll('[data-view]').forEach(a=>a.onclick=e=>{e.preventDefault();navigate(a.dataset.view);});window.addEventListener('popstate',()=>navigate(location.hash.slice(1)||'ringkasan'));window.addEventListener('hashchange',()=>navigate(location.hash.slice(1)||'ringkasan'));
for(var id of ['date','shift'])$(id).onchange=()=>{boardPage=0;load();};$('line').onchange=()=>{boardPage=0;machineOptions();render();};$('machine').onchange=()=>{boardPage=0;render();};$('search').oninput=()=>{boardPage=0;render();};$('refresh').onclick=load;
 $('period').onchange=renderBoard;$('board-prev').onclick=()=>flipPage(-1);$('board-next').onclick=()=>flipPage(1);$('board-rotate').onchange=updateRotation;$('tv-toggle').onclick=()=>setTV(!tv);
 $('fullscreen').onclick=()=>{if(document.documentElement.requestFullscreen)document.documentElement.requestFullscreen().catch(()=>{$('tv-message').textContent='Gunakan F11 / layar penuh browser jika diperlukan.';});else $('tv-message').textContent='Gunakan F11 / layar penuh browser.';};
 document.addEventListener('keydown',e=>{if(e.key==='Escape'&&tv)setTV(false);});
 $('demo-add').onclick=()=>{periods[periodKey()]=monitor.increment(periodState(),12);renderBoard();};$('demo-outage').onclick=()=>{periodState().available=!periodState().available;renderBoard();};$('demo-session').onclick=()=>{try{periods[periodKey()]=monitor.nextSession(periodState());$('tv-message').textContent='Sesi contoh baru. Hitungan sesi nol; akumulasi shift dan D100 dipertahankan.';renderBoard();}catch(e){$('tv-message').textContent=e.message;}};
document.querySelectorAll('[data-filter]').forEach(b=>b.onclick=()=>{kind=b.dataset.filter;document.querySelectorAll('[data-filter]').forEach(x=>x.setAttribute('aria-pressed',String(x===b)));render();});$('close-detail').onclick=()=>$('detail').close();
load();navigate(location.hash.slice(1)||'ringkasan');
})();
