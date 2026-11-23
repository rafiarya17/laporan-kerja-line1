'use strict';
const el = id => document.getElementById(id);
const params = new URLSearchParams(location.search);
const filters = ['date','shift','line'];
for (let i=1;i<=8;i++) el('line').add(new Option('Line '+i,'LINE_'+i));
el('date').value = params.get('date') || new Date(Date.now()+7*3600000).toISOString().slice(0,10);
for (const key of ['line','shift']) {
  const value = params.get(key);
  if ([...el(key).options].some(option=>option.value===value)) el(key).value=value;
}
const wib = new Intl.DateTimeFormat('id-ID',{timeZone:'Asia/Jakarta',day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit'});
const qty = new Intl.NumberFormat('id-ID',{maximumFractionDigits:12});
let current;
async function load(){
  current?.abort();
  const controller = new AbortController();
  current = controller;
  const table = document.querySelector('table'), body = table.tBodies[0];
  table.hidden = true;
  body.replaceChildren();
  el('timing').textContent='';
  if (!el('date').value) { el('summary').textContent='Pilih tanggal produksi.'; el('refresh').disabled=false; return; }
  const query = new URLSearchParams(filters.map(key=>[key,el(key).value]));
  el('refresh').disabled=true;
  el('summary').textContent='Memuat TF Slip…';
  const start=performance.now();
  try {
    const response=await fetch('/api/tf-slip?'+query,{method:'POST',cache:'no-store',signal:controller.signal});
    const data=await response.json();
    if (current!==controller) return;
    if (!response.ok) throw Error(data.error);
    for (const row of data.rows) {
      const tr=body.insertRow(), pipe=row.line==='LINE_8';
      for (const value of [row.line.replace('_',' '),row.shift,row.machine,row.part,
        qty.format(row.ok)+(pipe?' batang':' pcs'),qty.format(row.repair)+(pipe?' mm':' pcs'),
        qty.format(row.reject)+(pipe?' mm':' pcs'),wib.format(new Date(row.approved))]) tr.insertCell().textContent=value;
    }
    table.hidden=!data.rows.length;
    el('summary').textContent=(data.preview?'Pratinjau dengan data contoh · ':'')+data.rows.length+' laporan siap · '+data.pending+' menunggu leader · '+data.waitingEnd+' menunggu jam selesai'+(data.invalid?' · '+data.invalid+' perlu diperiksa':'');
    el('timing').textContent='Data per '+wib.format(new Date(data.asOf))+' WIB · Dimuat dalam '+((performance.now()-start)/1000).toFixed(2)+' detik';
    history.replaceState(null,'','?'+query);
  } catch(e){ if(current===controller) el('summary').textContent=e.message||'Gagal memuat TF Slip.'; }
  finally{ if(current===controller) el('refresh').disabled=false; }
}
for (const key of filters) el(key).onchange=load;
el('refresh').onclick=load;
load();
