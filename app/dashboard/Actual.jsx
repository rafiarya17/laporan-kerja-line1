import React,{useEffect,useMemo,useState} from 'react';
export {ActualLive} from './ActualLive.jsx';
import {fmt,labelLine,saved,save} from './metrics.js';

const attrs=[['plan','Rencana PPC'],['ok','OK'],['repair','Repair'],['reject','Reject'],['quality','Quality'],['performance','Performance'],['eff','Efficiency PPC'],['availability','Availability LKH'],['oee','OEE']];
const ratios=new Set(['quality','performance','eff','availability','oee']);
const defaultColumns=['plan','ok','repair','reject','quality'];
const quantityFields=['ok','repair','reject'];
const cells=(row,k)=>row[k]==null?'—':ratios.has(k)?fmt(row[k]*100)+'%':fmt(row[k]);
const displayDate=v=>new Date(v).toLocaleString('id-ID',{timeZone:'Asia/Jakarta'});
function summarizeScope(rows,grain){
 const groups=new Map();
 for(const row of rows){
  const label=grain==='department'?'Welding':grain==='machine-total'?labelLine(row.line)+' · '+row.machine:labelLine(row.line);
  const unit=row.unit??'Belum ditetapkan',key=label+'|'+unit;
  if(!groups.has(key))groups.set(key,{label,unit});
  const group=groups.get(key);
  for(const k of ['plan',...quantityFields]){
   if(Number.isFinite(row[k]))group[k]=(group[k]??0)+row[k];
  }
  if(row.reports>0&&!quantityFields.every(k=>Number.isFinite(row[k])))group.incompleteQuality=true;
 }
 return [...groups.values()].map(group=>{
  const produced=group.ok+group.repair+group.reject;
  const quality=group.unit!=='Belum ditetapkan'&&!group.incompleteQuality&&produced>0?group.ok/produced:null;
  return {...group,quality};
 });
}
function prepareMart(mart){
const unpack=row=>Object.fromEntries(mart.fields.map((field,i)=>[field,row[i]]));
const byMachine=mart.machines.map(unpack),byPart=mart.parts.map(unpack);
const lastReport=byMachine.reduce((last,r)=>r.reports>0&&r.date>last?r.date:last,'');
const planByMachine=new Map();
const key=r=>[r.date,r.shift,r.line,r.machine].join('|');
for(const r of byPart)if(r.plan!=null){
 const k=key(r),existing=planByMachine.get(k);
 planByMachine.set(k,{plan:(existing?.plan??0)+r.plan,unit:existing?.unit??r.unit});
}
const mergedMachines=byMachine.map(r=>{
 const plan=planByMachine.get(key(r));
 return {...r,unit:r.unit??plan?.unit??null,plan:plan?.plan??null};
});
const covered=new Set(mergedMachines.map(key));
for(const r of byPart){
 const k=key(r);
 if(!covered.has(k)&&planByMachine.has(k)){
  mergedMachines.push({date:r.date,shift:r.shift,line:r.line,machine:r.machine,...planByMachine.get(k)});
  covered.add(k);
 }
}
 return {byPart,mergedMachines,lastReport};
}
function MartMatrix({current,mart}){
 const {byPart,mergedMachines,lastReport}=useMemo(()=>prepareMart(mart),[mart]);
 const showLatest=Boolean(lastReport)&&(current.date<mart.start||current.date>mart.end);
 const initialDate=showLatest?lastReport:current.date;
 const [start,setStart]=useState(initialDate),[end,setEnd]=useState(initialDate),[shift,setShift]=useState(showLatest?'all':String(current.shift));
 const [line,setLine]=useState('all'),[machine,setMachine]=useState('all'),[view,setView]=useState('auto');
 const aggregateWindow=shift==='all'||Boolean(start&&end&&start<end);
 const grain=view==='auto'?(aggregateWindow?'machine-total':'machine'):view;
 const [cols,setCols]=useState(()=>{const x=saved('mart-columns',defaultColumns);return Array.isArray(x)&&x.some(k=>attrs.some(([a])=>a===k))?x:defaultColumns;});
 const source=grain==='part'?byPart:mergedMachines;
 const machines=[...new Set(source.filter(r=>line==='all'||r.line===Number(line)).map(r=>r.machine))].sort();
 const chosen=attrs.filter(([k])=>cols.includes(k));
 const rows=source.filter(r=>r.date>=start&&r.date<=end&&(shift==='all'||r.shift===Number(shift))&&(line==='all'||r.line===Number(line))&&(machine==='all'||machine===r.machine)).sort((a,b)=>b.date.localeCompare(a.date)||b.shift-a.shift||a.line-b.line||a.machine.localeCompare(b.machine));
 function period(d,s){setStart(d);setEnd(d);setShift(s);}
 const units=[...new Set(rows.filter(r=>r.ok!=null&&r.reports>0).map(r=>r.unit))];
 const pcsOK=rows.filter(r=>r.reports>0&&r.ok!=null&&['PCS','PCS_FINAL'].includes(r.unit));
 const reports=rows.reduce((n,r)=>n+(r.reports??0),0);
 const spanOK=start&&end&&start<=end&&start>=mart.start&&end<=mart.end;
 const overview=['department','line','machine-total'].includes(grain);
 const displayRows=overview?summarizeScope(rows,grain).sort((a,b)=>a.label.localeCompare(b.label)||a.unit.localeCompare(b.unit)):rows;
 return <section className="analytics"><div className="map-head"><div><small className="overline">WELDING · DATA MART PLANT 3</small><h1>Hasil produksi</h1><p>Salinan Data Mart {displayDate(mart.captured)} WIB · Line 1–8</p></div><div className="tools"><button onClick={()=>period(current.date,String(current.shift))}>Shift berjalan</button><button disabled={!lastReport} onClick={()=>{period(lastReport,'all');setLine('all');setMachine('all');}}>Tanggal laporan terakhir</button></div></div>
 <div className="filters"><label>Dari tanggal<input type="date" value={start} onChange={e=>setStart(e.target.value)}/></label><label>Sampai tanggal<input type="date" value={end} onChange={e=>setEnd(e.target.value)}/></label>
 <label>Shift<select aria-label="Shift" value={shift} onChange={e=>setShift(e.target.value)}><option value="all">Semua shift</option><option value="1">Shift 1</option><option value="2">Shift 2</option></select></label>
 <label>Line<select aria-label="Line" value={line} onChange={e=>{setLine(e.target.value);setMachine('all');}}><option value="all">Welding · Line 1–8</option>{[1,2,3,4,5,6,7,8].map(n=><option key={n} value={n}>{labelLine(n)}</option>)}</select></label>
 <label>Mesin<select aria-label="Mesin" value={machine} onChange={e=>setMachine(e.target.value)}><option value="all">Semua mesin</option>{machines.map(m=><option key={m}>{m}</option>)}</select></label></div>
 <p className="coverage">Cakupan salinan {mart.start} sampai {mart.end}. {start&&end&&start>end?'Tanggal mulai harus sama dengan atau sebelum tanggal akhir.':spanOK?(reports?'':'Belum ada laporan hasil pada pilihan ini.'):'Pilih periode di dalam cakupan salinan.'}</p>
 <div className="an-kpis"><article><small>Mesin dalam pilihan</small><strong>{spanOK?new Set(rows.map(r=>r.line+'|'+r.machine)).size:'—'}</strong></article><article><small>OK dilaporkan · pcs</small><strong>{spanOK&&pcsOK.length?fmt(pcsOK.reduce((n,r)=>n+r.ok,0)):'—'}</strong></article><article><small>Tanggal laporan terakhir di salinan</small><strong>{lastReport}</strong></article></div>
 <div className="matrix-panel"><div className="section-head"><h2>{overview?'Hasil periode':'Matriks pekerjaan'}</h2><div className="matrix-controls"><label>Baris <select aria-label="Baris" value={view} onChange={e=>setView(e.target.value)}><option value="auto">Otomatis · sesuai rentang</option><option value="machine-total">Mesin · total periode</option><option value="line">Line · total periode</option><option value="department">Welding · total periode</option><option value="machine">Rincian mesin per tanggal dan shift</option><option value="part">Rincian part per tanggal dan shift</option></select></label><details className="metric-menu"><summary>Atur metrik</summary><div>{attrs.map(([k,l])=><label key={k}><input type="checkbox" checked={cols.includes(k)} disabled={cols.length===1&&cols[0]===k} onChange={e=>{const next=e.target.checked?[...cols,k]:cols.filter(x=>x!==k);setCols(next);save('mart-columns',next);}}/>{l}</label>)}</div></details></div></div>
 <div className="table-clip"><table><thead><tr>{[...(overview?['Cakupan']:['Tanggal','Shift','Line','Mesin']),...(grain==='part'?['Part']:[]),'Satuan',...chosen.map(c=>c[1])].map(x=><th key={x}>{x}</th>)}</tr></thead>
 <tbody>{spanOK&&displayRows.map((r,i)=><tr key={i}>{overview?<th>{r.label}</th>:<><th>{r.date}</th><td>{r.shift}</td><td>{r.line}</td><td>{r.machine}</td></>}{grain==='part'&&<td>{r.part}</td>}<td>{r.unit??'—'}</td>{chosen.map(([k])=><td key={k}>{cells(r,k)}</td>)}</tr>)}</tbody>
 </table></div></div>
 <p className="coverage">{overview?'Jumlah dijumlahkan per satuan. Quality memakai total OK ÷ total hasil. Performance, Efficiency PPC, Availability dan OEE tersedia di rincian.':grain==='machine'?'Performance, Quality, Availability dan OEE mengikuti baris mesin–shift. Rencana PPC dijumlahkan dari baris part untuk mesin dan shift yang cocok.':'Performance PPC, Efficiency PPC dan Quality mengikuti baris PPC per part. OEE dan Availability tersedia pada tampilan mesin–shift.'} Tanda — berarti angka belum tersedia. {units.includes('BATANG_EQUIVALENT')?'Output batang ekuivalen tampil dalam satuan tersendiri.':''}</p>
 </section>;
}

function MartSource({current}){
 const [mart,setMart]=useState(null),[failed,setFailed]=useState(false),[refresh,setRefresh]=useState(0);
 useEffect(()=>{
  let active=true; const controller=new AbortController();
  async function load(){
   try {
    const r=await fetch('/api/dashboard/mart',{signal:controller.signal});
    if(!r.ok)throw new Error();
    const data=await r.json();
    if(!Array.isArray(data.machines)||!Array.isArray(data.parts)||!Array.isArray(data.fields))throw new Error();
    if(active){setMart(data);setFailed(false);}
   }catch{if(active)setFailed(true);}
  }
  load();
  return ()=>{active=false;controller.abort();};
 },[refresh]);
 return <>{failed&&<p role="alert">Salinan Data Mart belum dapat dimuat. <button onClick={()=>setRefresh(n=>n+1)}>Coba lagi</button></p>}
  {mart?<MartMatrix current={current} mart={mart}/>:!failed&&<p role="status">Memuat Data Mart…</p>}</>;
}
export const ActualAnalysis=React.memo(MartSource,(a,b)=>a.current.date===b.current.date&&a.current.shift===b.current.shift);
