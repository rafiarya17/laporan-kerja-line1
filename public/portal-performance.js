(function(){'use strict';
 const $=id=>document.getElementById(id),core=window.PortalPerformanceCore;
 let context=null,focus='',historyIndex=0,previousPeriod='',periodRows=[],periodDates=[],periodError='';
 const labels={oee:'OEE',availability:'Availability',performance:'Performance',quality:'Quality',efficiency:'Efisiensi waktu',attainment:'Pencapaian target OK'};
 const descriptions={oee:'Σ waktu ideal hasil OK ÷ Σ waktu terencana',availability:'Waktu berjalan ÷ waktu produksi terencana',performance:'CT ideal × total bruto ÷ waktu berjalan',quality:'OK pertama kali ÷ total bruto',efficiency:'CT ideal × total bruto ÷ waktu terencana (A × P)',attainment:'OK terklasifikasi ÷ target OK leader'};
 const number=n=>n===null||n===undefined?'—':n.toLocaleString('id-ID',{maximumFractionDigits:1});
 const percent=n=>n===null?'—':number(n*100)+'%';
 const el=(tag,text,cls)=>{const n=document.createElement(tag);if(text!==undefined)n.textContent=text;if(cls)n.className=cls;return n;};
 const key=m=>m.line+'|'+m.name;
 const isPilot=m=>m&&m.line==='LINE_99'&&m.name==='AUTO CHAMPER';
 const line=m=>m.line.replace('LINE_','Line ')+(m.line==='LINE_99'?' · Uji':'');

 function selectedMachines(){
  return focus?context.machines.filter(machine=>key(machine)===focus):context.machines;
 }
 function scopeLabel(){
  const machine=context.machines.find(machine=>key(machine)===focus);
  if(machine)return machine.name+' / '+line(machine);
  return context.line?context.line.replace('LINE_','Line ')+(context.line==='LINE_99'?' · Uji':''):'Welding · seluruh hasil filter';
 }
 function preparePeriod(){
  periodRows=[];periodDates=[];periodError='';
  try{periodDates=core.datesBetween($('perf-start').value,$('perf-end').value);}
  catch(error){periodError=error.message;return;}
  const shifts=$('perf-shift').value==='all'?['1','2']:[$('perf-shift').value];
  if(!context.machines.some(isPilot))return;
  for(const date of periodDates){
   for(const shift of shifts){
    periodRows.push({...core.example(context.stateAt(date,shift),shift,$('perf-missing').value),date,shift});
   }
  }
 }
 function resultFor(machines){return core.aggregate(machines.some(isPilot)?periodRows:[]);}
 function render(c){
  const incoming=c.date+'|'+c.shift;
  context=c;
  if(incoming!==previousPeriod){
   $('perf-start').value=c.date;$('perf-end').value=c.date;$('perf-shift').value=c.shift;
   previousPeriod=incoming;historyIndex=0;
  }
  if(!c.machines.some(machine=>key(machine)===focus))focus='';
  $('perf-focus').replaceChildren(new Option('Gabungan hasil filter',''));
  c.machines.forEach(machine=>$('perf-focus').add(new Option(machine.name+' · '+line(machine),key(machine))));
  $('perf-focus').value=focus;
  preparePeriod();
  const list=selectedMachines(),r=resultFor(list),hasData=list.some(isPilot)&&periodRows.length>0;
  const d=hasData?r.data:null;
  const shifts=$('perf-shift').value==='all'?'Semua shift':'Shift '+$('perf-shift').value;
  $('perf-context').textContent=scopeLabel()+' · '+$('perf-start').value+' – '+$('perf-end').value+' · '+shifts;
  $('perf-period-error').hidden=!periodError;$('perf-period-error').textContent=periodError;
  const available=hasData?1:0;
  $('perf-coverage').textContent=available+' dari '+list.length+' mesin memiliki data contoh · '+periodDates.length+' hari · '+(hasData?periodRows.length:0)+' catatan mesin–tanggal–shift.'+(available<list.length?' Ringkasan parsial pada cakupan terpilih.':'');
  const machine=list.find(isPilot)||list[0];
  $('perf-live').disabled=!machine||!!periodError;
  $('perf-live').textContent='Monitor Live · tanggal awal / Shift '+($('perf-shift').value==='all'?'1':$('perf-shift').value)+' →';
  $('perf-live').onclick=()=>context.openMonitor(machine,$('perf-start').value,$('perf-shift').value==='all'?'1':$('perf-shift').value);
  $('perf-missing').disabled=!list.some(isPilot);
  $('perf-kpis').replaceChildren();
  Object.keys(labels).forEach(metric=>{
   const card=el('article',undefined,'perf-kpi'+(metric==='oee'?' main-kpi':''));card.dataset.metric=metric;
   card.append(el('span',labels[metric]),el('strong',percent(r[metric])),el('small',descriptions[metric]));$('perf-kpis').append(card);
  });
  $('perf-status').textContent=periodError||(!hasData?'Belum ada data waktu, CT ideal, dan kualitas pada cakupan ini.':r.reasons.length?r.reasons.join(' '):available<list.length?'Hasil parsial dari mesin dengan data contoh. Performa mesin lainnya belum tersedia.':'Data contoh lengkap untuk periode dan cakupan terpilih.');
  $('perf-status').classList.toggle('needs-data',!hasData||r.reasons.length>0||available<list.length);
  renderLoss(d,hasData?r:null);renderQuality(d,hasData?r:null);renderTrend(list);renderTable(c.machines);renderInputs(d);renderLines(c.machines);
 }
 function renderLoss(d,r){
  $('perf-loss').replaceChildren();
  const entries=[['Waktu produktif ideal','productive','#197d72'],['Kehilangan kualitas','quality','#bd7966'],['Kehilangan kecepatan','speed','#c5a35c'],['Mesin berhenti','stop','#879fa4']];
  const complete=r&&entries.every(x=>r.losses[x[1]]!==null);
  $('perf-time-note').textContent=d?'Rencana '+number(d.planned)+' menit · Berjalan '+number(d.run)+' menit · Waktu ideal dihitung per catatan part':'Waktu produksi belum tersedia.';
  entries.forEach(([label,k,color])=>{
   const value=r?r.losses[k]:null,row=el('div',undefined,'perf-bar-row');row.append(el('span',label));
   const track=el('div',undefined,'perf-track'),bar=el('i');bar.style.width=(value===null?0:value/d.planned*100)+'%';bar.style.background=color;track.append(bar);row.append(track,el('b',number(value)+(value===null?'':' menit')));$('perf-loss').append(row);
  });
  $('perf-loss-note').textContent=complete?'Keempat bagian menjumlah ke '+number(d.planned)+' menit terencana. Kehilangan kecepatan/kualitas adalah ekuivalen waktu ideal.':'Bagian yang datanya belum lengkap tidak diperkirakan sebagai nol.';
  $('perf-stops').textContent='Rincian alasan berhenti per rentang memerlukan interval yang terverifikasi.';
 }
 function renderQuality(d,r){
  $('perf-quality').replaceChildren();
  [['OK pertama kali','good','#197d72'],['Repair','repair','#c5a35c'],['Reject','reject','#bd7966']].forEach(([label,k,color])=>{
   const n=d&&d.qualityVerified?d[k]:null,row=el('div',undefined,'perf-bar-row');row.append(el('span',label));const track=el('div',undefined,'perf-track'),bar=el('i');bar.style.width=(n===null||!d.total?0:n/d.total*100)+'%';bar.style.background=color;track.append(bar);row.append(track,el('b',number(n)+(n===null?'':' pcs')));$('perf-quality').append(row);
  });
  $('perf-quality-note').textContent=d?'Total bruto '+number(d.total)+' pcs · Belum terklasifikasi '+(d.qualityVerified?number(r.unclassified):'—')+' pcs. Repair tidak dihitung sebagai OK pertama kali.':'Kualitas diisi operator; D100 tidak membedakan OK, repair, dan reject.';
 }

 function renderTrend(list){
  $('perf-trend').replaceChildren();$('perf-trend-detail').textContent='';
  if(!list.some(isPilot)||!periodRows.length){$('perf-trend').append(el('p','Histori pada cakupan ini belum tersedia.','empty'));return;}
  const monthly=periodDates.length>31,groups=new Map();
  for(const row of periodRows){
   const period=monthly?row.date.slice(0,7):row.date;
   if(!groups.has(period))groups.set(period,[]);
   groups.get(period).push(row);
  }
  const rows=Array.from(groups,([date,records])=>({date,r:core.aggregate(records)}));
  historyIndex=Math.min(historyIndex,rows.length-1);
  $('perf-trend').style.gridTemplateColumns='repeat('+rows.length+',minmax(64px,1fr))';
  rows.forEach((row,index)=>{
   const button=el('button',undefined,'perf-trend-bar'+(index===historyIndex?' selected':''));button.type='button';
   const value=row.r.oee,track=el('div',undefined,'perf-trend-track'),bar=el('i');
   bar.style.height=(value===null?0:value*100)+'%';track.append(bar);
   button.append(el('b',percent(value)),track,el('span',monthly?row.date:row.date.slice(8)+'/'+row.date.slice(5,7)));
   button.setAttribute('aria-label',row.date+' OEE '+percent(value));button.setAttribute('aria-pressed',String(index===historyIndex));
   button.onclick=()=>{historyIndex=index;renderTrend(list);};$('perf-trend').append(button);
  });
  const row=rows[historyIndex];
  $('perf-trend-detail').textContent=row.date+' · OEE '+percent(row.r.oee)+' · A '+percent(row.r.availability)+' · P '+percent(row.r.performance)+' · Quality '+percent(row.r.quality)+' · Bruto '+number(row.r.data.total)+' / OK '+number(row.r.data.good)+' pcs';
 }
 function appendMetrics(row,result){
  ['oee','availability','performance','quality'].forEach(metric=>row.append(el('td',percent(result[metric]))));
 }
 function renderTable(list){
  $('perf-table-body').replaceChildren();
  list.slice().sort((a,b)=>Number(isPilot(b))-Number(isPilot(a))).forEach(machine=>{
   const result=resultFor([machine]),row=el('tr'),cell=el('td'),button=el('button',machine.name,'perf-machine-link');
   button.onclick=()=>{focus=key(machine);render(context);$('perf-context').scrollIntoView({block:'center'});};
   cell.append(button,el('small',line(machine)));row.append(cell);appendMetrics(row,result);
   row.append(el('td',isPilot(machine)&&periodRows.length?(result.reasons.length?'Contoh · belum lengkap':'Contoh · lengkap'):'Belum ada data'));
   $('perf-table-body').append(row);
  });
 }
 function renderLines(list){
  $('perf-line-body').replaceChildren();
  const groups=[['Welding · cakupan filter',list,null],...Array.from(new Set(list.map(machine=>machine.line)),lineId=>[lineId.replace('LINE_','Line ')+(lineId==='LINE_99'?' · Uji':''),list.filter(machine=>machine.line===lineId),lineId])];
  groups.forEach(([label,machines,lineId])=>{
   const row=el('tr'),cell=el('td'),button=el('button',label,'perf-machine-link');
   button.onclick=()=>{focus='';if(lineId)context.selectLine(lineId);else render(context);};
   cell.append(button);row.append(cell);appendMetrics(row,resultFor(machines));
   const count=machines.some(isPilot)&&periodRows.length?1:0;
   row.append(el('td',count+' / '+machines.length+(count<machines.length?' · parsial':' · contoh')));$('perf-line-body').append(row);
  });
 }
 function renderInputs(d){
  $('perf-inputs').replaceChildren();
  [['Total bruto','total','pcs'],['OK pertama kali','good','pcs'],['Repair','repair','pcs'],['Reject','reject','pcs'],['Rencana produksi','planned','menit'],['Mesin berjalan','run','menit'],['Target OK','target','pcs']].forEach(([label,k,unit])=>{
   const row=el('div');row.append(el('dt',label),el('dd',d?number(d[k])+' '+unit:'Belum tersedia'));$('perf-inputs').append(row);
  });
 }
 $('perf-focus').onchange=()=>{focus=$('perf-focus').value;historyIndex=0;render(context);};
 $('perf-missing').onchange=()=>render(context);
 ['perf-start','perf-end','perf-shift'].forEach(id=>$(id).onchange=()=>{historyIndex=0;render(context);});
 window.PortalPerformance={render};
})();
