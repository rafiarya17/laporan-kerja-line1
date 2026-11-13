(function(){'use strict';
 const $=id=>document.getElementById(id),core=window.PortalPerformanceCore;
 let context=null,focus='',historyIndex=6;
 const labels={oee:'OEE',availability:'Availability',performance:'Performance',quality:'Quality',efficiency:'Efisiensi waktu',attainment:'Pencapaian target OK'};
 const descriptions={oee:'Availability × Performance × Quality',availability:'Waktu berjalan ÷ waktu produksi terencana',performance:'CT ideal × total bruto ÷ waktu berjalan',quality:'OK pertama kali ÷ total bruto',efficiency:'CT ideal × total bruto ÷ waktu terencana (A × P)',attainment:'OK terklasifikasi ÷ target OK leader'};
 const number=n=>n===null||n===undefined?'—':n.toLocaleString('id-ID',{maximumFractionDigits:1});
 const percent=n=>n===null?'—':number(n*100)+'%';
 const el=(tag,text,cls)=>{const n=document.createElement(tag);if(text!==undefined)n.textContent=text;if(cls)n.className=cls;return n;};
 const key=m=>m.line+'|'+m.name;
 const isPilot=m=>m&&m.line==='LINE_99'&&m.name==='AUTO CHAMPER';
 const line=m=>m.line.replace('LINE_','Line ')+(m.line==='LINE_99'?' · Uji':'');
 function datum(){return core.example(context.state,context.shift,$('perf-missing').value);}
 function setMachine(m,view){context.select(m,view);}
 function render(c){
  context=c;const list=c.machines;
  if(!list.some(m=>key(m)===focus))focus=key(list.find(isPilot)||list[0]||{line:'',name:''});
  $('perf-focus').replaceChildren();list.forEach(m=>$('perf-focus').add(new Option(m.name+' · '+line(m),key(m))));$('perf-focus').value=focus;
  const m=list.find(m=>key(m)===focus),p=isPilot(m),d=p?datum():null,r=p?core.calculate(d):null;
  $('perf-context').textContent=c.date+' · Shift '+c.shift+' · '+(m?m.name+' / '+line(m):'Tidak ada mesin sesuai filter');
  $('perf-coverage').textContent=(list.some(isPilot)?1:0)+' dari '+list.length+' mesin memiliki contoh metrik. Tidak dihitung sebagai OEE pabrik.';
  $('perf-live').disabled=!m;$('perf-live').onclick=()=>{if(m)setMachine(m,'monitor');};
  $('perf-missing').disabled=!p;
  $('perf-kpis').replaceChildren();Object.keys(labels).forEach(k=>{
   const card=el('article',undefined,'perf-kpi'+(k==='oee'?' main-kpi':''));card.dataset.metric=k;
   card.append(el('span',labels[k]),el('strong',r?percent(r[k]):'—'),el('small',descriptions[k]));$('perf-kpis').append(card);
  });
  $('perf-status').textContent=!m?'Ubah filter untuk memilih mesin.':!p?'Belum ada data waktu, CT ideal, dan kualitas untuk mesin ini.':r.reasons.length?r.reasons.join(' '):'Contoh data lengkap. Rumus dapat dihitung; angka ini bukan performa lapangan.';
  $('perf-status').classList.toggle('needs-data',!r||r.reasons.length>0);
  renderLoss(d,r);renderQuality(d,r);renderTrend(d,p);renderTable(list);renderInputs(d);
 }
 function renderLoss(d,r){
  $('perf-loss').replaceChildren();
  const entries=[['Waktu produktif ideal','productive','#197d72'],['Kehilangan kualitas','quality','#bd7966'],['Kehilangan kecepatan','speed','#c5a35c'],['Mesin berhenti','stop','#879fa4']];
  const complete=r&&entries.every(x=>r.losses[x[1]]!==null);
  $('perf-time-note').textContent=d?'Rencana '+number(d.planned)+' menit · Berjalan '+number(d.run)+' menit · CT ideal '+number(d.cycleSeconds)+' detik/pcs':'Waktu produksi belum tersedia.';
  entries.forEach(([label,k,color])=>{
   const value=r?r.losses[k]:null,row=el('div',undefined,'perf-bar-row');row.append(el('span',label));
   const track=el('div',undefined,'perf-track'),bar=el('i');bar.style.width=(value===null?0:value/d.planned*100)+'%';bar.style.background=color;track.append(bar);row.append(track,el('b',number(value)+(value===null?'':' menit')));$('perf-loss').append(row);
  });
  $('perf-loss-note').textContent=complete?'Keempat bagian menjumlah ke '+number(d.planned)+' menit terencana. Kehilangan kecepatan/kualitas adalah ekuivalen waktu ideal.':'Bagian yang datanya belum lengkap tidak diperkirakan sebagai nol.';
  $('perf-stops').textContent=r&&r.validTime?(String(context.shift)==='2'?'Contoh 480 menit tidak berjalan; alasan belum diurai.':'Contoh 80 menit berhenti: MTC 45 · dandori 25 · lainnya 10 menit. Interval contoh tidak tumpang tindih.'):'Rincian interval berhenti belum tersedia.';
 }
 function renderQuality(d,r){
  $('perf-quality').replaceChildren();
  [['OK pertama kali','good','#197d72'],['Repair','repair','#c5a35c'],['Reject','reject','#bd7966']].forEach(([label,k,color])=>{
   const n=d&&d.qualityVerified?d[k]:null,row=el('div',undefined,'perf-bar-row');row.append(el('span',label));const track=el('div',undefined,'perf-track'),bar=el('i');bar.style.width=(n===null||!d.total?0:n/d.total*100)+'%';bar.style.background=color;track.append(bar);row.append(track,el('b',number(n)+(n===null?'':' pcs')));$('perf-quality').append(row);
  });
  $('perf-quality-note').textContent=d?'Total bruto '+number(d.total)+' pcs · Belum terklasifikasi '+(d.qualityVerified?number(r.unclassified):'—')+' pcs. Repair tidak dihitung sebagai OK pertama kali.':'Kualitas diisi operator; D100 tidak membedakan OK, repair, dan reject.';
 }
 function history(d){
  const quantities=[[156,140],[168,148],[180,166],[174,160],[192,178],[186,170]];
  return quantities.map(([total,good],i)=>{
   const date=new Date(context.date+'T12:00:00Z');date.setUTCDate(date.getUTCDate()-6+i);
   const x={planned:480,run:420,total,good,repair:Math.floor((total-good)/2),reject:Math.ceil((total-good)/2),cycleSeconds:120,target:200,timeVerified:true,qualityVerified:true,cycleVerified:true,counterValid:true};
   return {date:date.toISOString().slice(0,10),d:x,r:core.calculate(x)};
  }).concat([{date:context.date,d,r:core.calculate(d)}]);
 }
 function renderTrend(d,p){
  $('perf-trend').replaceChildren();$('perf-trend-detail').textContent='';
  if(!p||!context.date){$('perf-trend').append(el('p','Histori performa mesin ini belum tersedia.','empty'));return;}
  const rows=history(d);
  rows.forEach((row,i)=>{
   const b=el('button',undefined,'perf-trend-bar'+(i===historyIndex?' selected':''));b.type='button';
   const value=row.r.oee,bars=el('div',undefined,'perf-trend-track'),fill=el('i');fill.style.height=(value===null?0:value*100)+'%';bars.append(fill);
   b.append(el('b',percent(value)),bars,el('span',row.date.slice(8)+'/'+row.date.slice(5,7)));b.setAttribute('aria-label',row.date+' OEE '+percent(value));b.setAttribute('aria-pressed',String(i===historyIndex));b.onclick=()=>{historyIndex=i;renderTrend(d,p);};$('perf-trend').append(b);
  });
  const x=rows[historyIndex];$('perf-trend-detail').textContent=x.date+' · Shift '+context.shift+' · A '+percent(x.r.availability)+' × P '+percent(x.r.performance)+' × Q '+percent(x.r.quality)+' = OEE '+percent(x.r.oee)+' · Bruto '+number(x.d.total)+' / OK '+number(x.d.good)+' pcs';
 }
 function renderTable(list){
  $('perf-table-body').replaceChildren();
  list.slice().sort((a,b)=>Number(isPilot(b))-Number(isPilot(a))).forEach(m=>{
   const p=isPilot(m),r=p?core.calculate(datum()):null,tr=el('tr');
   const machine=el('td'),b=el('button',m.name,'perf-machine-link');b.onclick=()=>{focus=key(m);render(context);$('perf-context').scrollIntoView({block:'center'});};machine.append(b,el('small',line(m)));tr.append(machine);
   ['oee','availability','performance','quality'].forEach(k=>tr.append(el('td',r?percent(r[k]):'—')));
   tr.append(el('td',p?(r.reasons.length?'Contoh · belum lengkap':'Contoh · lengkap'):'Belum terintegrasi'));$('perf-table-body').append(tr);
  });
 }
 function renderInputs(d){
  $('perf-inputs').replaceChildren();
  [['Total bruto','total','pcs'],['OK pertama kali','good','pcs'],['Repair','repair','pcs'],['Reject','reject','pcs'],['Rencana produksi','planned','menit'],['Mesin berjalan','run','menit'],['CT ideal','cycleSeconds','detik/pcs'],['Target OK','target','pcs']].forEach(([label,k,unit])=>{
   const row=el('div');row.append(el('dt',label),el('dd',d?number(d[k])+' '+unit:'Belum tersedia'));$('perf-inputs').append(row);
  });
 }
 $('perf-focus').onchange=()=>{focus=$('perf-focus').value;historyIndex=6;render(context);};
 $('perf-missing').onchange=()=>render(context);
 window.PortalPerformance={render};
})();
