import React,{useMemo,useState} from 'react';
import {aggregate,dayOffset,metrics,defaults,fmt,labelLine,saved,save} from './metrics.js';

const dimensions={line:'Line',machine:'Mesin',part:'Part',department:'Departemen'};
function metricValue(value,unit){return value==null?'—':fmt(value)+(unit==='%'?'%':'');}
function groupRows(rows,dimension,pilot){
 const groups=new Map();
 for(const row of rows){
  const label=dimension==='department'?(pilot?'Line 99 Uji':'Welding'):dimension==='line'?labelLine(row.line):dimension==='machine'?labelLine(row.line)+' · '+row.machine:row.part;
  if(!groups.has(label))groups.set(label,[]);
  groups.get(label).push(row);
 }
 return [...groups].sort(([a],[b])=>a.localeCompare(b,'id',{numeric:true})).map(([name,items])=>({name,...aggregate(items)}));
}
function Matrix({jobs,machines,current}){
 const [dateFrom,setFrom]=useState(current.date),[dateTo,setTo]=useState(current.date),[shift,setShift]=useState(String(current.shift)),[line,setLine]=useState('all'),[machine,setMachine]=useState('all'),[group,setGroup]=useState('line');
 const [cols,setCols]=useState(()=>{const val=saved('metrics',defaults);const keys=metrics.map(m=>m[0]).filter(k=>Array.isArray(val)&&val.includes(k));return keys.length?keys:defaults;});
 const pilot=line==='99',oldest=dayOffset(current.date,-13);
 const badDates=!dateFrom||!dateTo||dateFrom>dateTo||dateFrom<oldest||dateTo>current.date;
 const rows=useMemo(()=>badDates?[]:jobs.filter(r=>{
  const day=dayOffset(current.date,r.offset);
  return day>=dateFrom&&day<=dateTo&&(r.offset<0||r.shift<=current.shift)&&(shift==='all'||r.shift===Number(shift))&&(line==='all'?r.line!==99:r.line===Number(line))&&(machine==='all'||r.machine===machine);
 }),[jobs,current.date,current.shift,dateFrom,dateTo,badDates,shift,line,machine]);
 const groups=useMemo(()=>groupRows(rows,group,pilot),[rows,group,pilot]),totals=useMemo(()=>aggregate(rows),[rows]);
 const selected=metrics.filter(m=>cols.includes(m[0]));
 const labels=[...new Set(machines.filter(m=>line==='all'?m.line!==99:m.line===Number(line)).map(m=>m.name))].sort();
 function columns(next){setCols(next);save('metrics',next);}
 const lineRows=useMemo(()=>groupRows(rows,'line',pilot),[rows,pilot]);
 return <section className="analytics">
  <div className="map-head"><div><small className="overline">WELDING · PLANT 3</small><h1>Hasil produksi</h1><p>Matriks pekerjaan dan capaian target per periode.</p></div>
  <button onClick={()=>{setFrom(current.date);setTo(current.date);setShift(String(current.shift));}}>Shift berjalan</button></div>
  <div className="filters">{[['Dari tanggal',dateFrom,setFrom],['Sampai tanggal',dateTo,setTo]].map(([name,val,change])=><label key={name}>{name}<input type="date" value={val} min={oldest} max={current.date} onChange={e=>change(e.target.value)}/></label>)}
  <label>Shift<select aria-label="Shift" value={shift} onChange={e=>setShift(e.target.value)}><option value="all">Semua shift</option><option value="1">Shift 1</option><option value="2">Shift 2</option></select></label>
  <label>Line<select aria-label="Line" value={line} onChange={e=>{setLine(e.target.value);setMachine('all');}}><option value="all">Welding · Line 1–8</option>{[1,2,3,4,5,6,7,8,99].map(n=><option value={n} key={n}>{labelLine(n)}</option>)}</select></label>
  <label>Mesin<select aria-label="Mesin" value={machine} onChange={e=>setMachine(e.target.value)}><option value="all">Semua mesin</option>{labels.map(n=><option key={n}>{n}</option>)}</select></label></div>
  <p className="coverage">{badDates?'Periksa tanggal awal dan akhir. ':''}Riwayat simulasi {oldest} s/d {current.date} · {rows.length} catatan pekerjaan</p>
  <div className="an-kpis">{[['target','Target OK','pcs'],['ok','OK dilaporkan','pcs'],['attain','Pencapaian','%'],['quality','Quality','%']].map(([key,label,unit])=><article key={key}><small>{label}</small><strong>{rows.length?fmt(totals[key]):'—'} <em>{unit}</em></strong></article>)}</div>
  <div className="analysis-grid"><div className="matrix-panel">
   <div className="section-head"><h2>Matriks pekerjaan</h2><div className="matrix-controls"><label>Baris <select aria-label="Baris" value={group} onChange={e=>setGroup(e.target.value)}>{Object.entries(dimensions).map(([key,value])=><option key={key} value={key}>{value}</option>)}</select></label>
   <details className="metric-menu"><summary>Atur metrik</summary><div>{metrics.map(([key,label,unit,desc])=><label key={key} title={desc}><input type="checkbox" checked={cols.includes(key)} disabled={cols.length===1&&cols[0]===key} onChange={e=>columns(e.target.checked?[...cols,key]:cols.filter(c=>c!==key))}/>{label}</label>)}<button onClick={()=>columns(defaults)}>Pulihkan kolom awal</button></div></details></div></div>
   <div className="table-clip"><table><thead><tr><th>{dimensions[group]}</th>{selected.map(([k,label,,desc])=><th key={k} title={desc}>{label}</th>)}</tr></thead><tbody>{groups.map(r=><tr key={r.name}><th>{r.name}</th>{selected.map(([k,,u])=><td key={k}>{metricValue(r[k],u)}</td>)}</tr>)}</tbody>{rows.length>0&&<tfoot><tr><th>Total</th>{selected.map(([k,,u])=><td key={k}>{metricValue(totals[k],u)}</td>)}</tr></tfoot>}</table></div>
   {!rows.length&&<p className="empty" role="status">Belum ada pekerjaan dalam pilihan ini.</p>}
  </div><aside className="trend"><h2>Capaian per line</h2><small>OK dilaporkan / target OK</small>{lineRows.map(r=><div className="trend-row" key={r.name}><div><b>{r.name}</b><span>{fmt(r.attain)}%</span></div><div className="track"><i style={{width:Math.min(100,r.attain??0)+'%'}}/></div></div>)}</aside></div>
  <details className="definitions"><summary>Definisi metrik simulasi</summary><p>Waktu, volume dan hasil kualitas merupakan contoh. Jika cycle time part belum tersedia, metrik yang memerlukannya ditampilkan sebagai —, termasuk pada total yang mencakup part tersebut.</p><dl>{metrics.map(([k,label,,desc])=><React.Fragment key={k}><dt>{label}</dt><dd>{desc}</dd></React.Fragment>)}</dl></details>
  <details className="definitions"><summary>Rincian pekerjaan ({rows.length})</summary>{rows.slice(0,20).map((r,i)=><p key={i}>{dayOffset(current.date,r.offset)} · Shift {r.shift} · {labelLine(r.line)} · {r.machine} · {r.part} · OK {fmt(r.ok)} pcs</p>)}{rows.length>20&&<p>Menampilkan 20 contoh dari {rows.length} pekerjaan.</p>}</details>
 </section>;
}
export const Analysis=React.memo(Matrix,(a,b)=>a.jobs===b.jobs&&a.machines===b.machines&&a.current.date===b.current.date&&a.current.shift===b.current.shift);
