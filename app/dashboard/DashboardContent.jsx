import React,{useEffect,useRef,useState} from 'react';
import simulationData from './simulation.js';
import {Analysis} from './Analysis.jsx';
import {ActualAnalysis,ActualLive} from './Actual.jsx';
import {workShift,fmt,saved,save,labelLine} from './metrics.js';
import './welding.css';

const states={run:'Berjalan',down:'Breakdown',setup:'Dandori',off:'Off',stale:'Data terlambat'};
const order=[1,2,3,4,5,6,99,8,7];
const clockFmt=new Intl.DateTimeFormat('id-ID',{timeZone:'Asia/Jakarta',hour:'2-digit',minute:'2-digit',second:'2-digit',hour12:false});
const dateFmt=new Intl.DateTimeFormat('id-ID',{timeZone:'UTC',weekday:'short',day:'numeric',month:'short'});
function Dot({state}){return <i className={'signal '+state} aria-hidden="true"/>;}
function advance(list,step){
 return list.map((m,i)=>{
   let status=m.status;
   if(step%4===0 && i===Math.floor(step/4-1)%list.length && m.line!==99){
     const cycle={run:'setup',setup:'run',down:'run',off:'run',stale:'run'};
     status=cycle[status];
   }
   const actual=(m.status==='off'?0:m.actual)+(status==='run'?1:0);
   return {...m,status,actual,updated:status==='stale'?m.updated:Date.now()};
 });
}
function MachineDetail({machine,close}){
 const ref=useRef(null);
 useEffect(()=>{const d=ref.current; d.showModal(); return ()=>{if(d.open)d.close();};},[]);
 const m=machine;
 return <dialog className="machine-dialog" ref={ref} onCancel={close} onClick={e=>{if(e.target===ref.current)close();}}>
  <div className="detail-top"><small>{labelLine(m.line)} · SIMULASI</small><button aria-label="Tutup detail" onClick={close}>×</button></div>
  <h2>{m.name}</h2><p className="detail-state"><Dot state={m.status}/>{states[m.status]}</p>
  <p>Pembaruan simulasi {clockFmt.format(m.updated)} WIB</p>
  {m.status==='off'?<p>Belum ada sesi aktif.</p>:<><small>Part sesi</small><p>{m.parts[0]}</p>
  <div className="detail-num"><div><small>{m.status==='stale'?'Aktual terakhir':'Aktual sesi'}</small><strong>{fmt(m.actual)} <em>pcs</em></strong></div><div><small>Target sesi</small><strong>{fmt(m.target)} <em>pcs</em></strong></div></div>
  {m.line===99&&<p>D100 awal {fmt(m.base)} · D100 simulasi {fmt(m.base+m.actual)}</p>}
  {m.status==='stale'&&<p>Menampilkan bacaan terakhir. Status mesin saat ini belum diketahui.</p>}</>}
 </dialog>;
}
function Zone({line,items,select}){
 const pilot=line===99;
 return <section className={'zone '+(pilot?'pilot-zone':'')} aria-label={labelLine(line)}>
  <header><h3>{labelLine(line)}</h3><span>{pilot?'Pilot Champer':items.length+' mesin'}</span></header>
  {pilot?<button className="pilot" onClick={()=>select(items[0].id)}>
   <span className="pilot-label"><b>AUTO CHAMPER</b><span><Dot state={items[0].status}/>{states[items[0].status]}</span></span>
   <span className="pilot-count">{fmt(items[0].actual)} <small>/ {fmt(items[0].target)} pcs</small></span>
   <span className="track"><i style={{width:Math.min(100,100*items[0].actual/items[0].target)+'%'}}/></span>
   <span className="pilot-part">{items[0].parts[0]}</span>
  </button>:<div className={'tiles '+(items.length>6?'dense':items.length<=2?'sparse':'')}>{items.map(m=><button className={'tile '+m.status} key={m.id} onClick={()=>select(m.id)} title={m.name+' · '+states[m.status]} aria-label={m.name+', '+states[m.status]+', lihat detail'}>
   <span className="tile-name"><Dot state={m.status}/>{m.name}</span>
   <span className="tile-info">{m.status==='off'?'—':<>{fmt(m.actual)} <small>/ {fmt(m.target)}</small></>}</span>
   <small className="state-text">{states[m.status]}</small>
   {items.length<=2&&m.status!=='off'&&<span className="sparse-part">{m.parts[0]}</span>}
  </button>)}</div>}
 </section>;
}
export function DashboardContent(){
 const machines=simulationData.machines;
 const [tab,setTab]=useState(()=>location.hash==='#live'?'live':'analysis'),[theme,setTheme]=useState(()=>saved('theme','dark'));
 const [simulation,setSimulation]=useState(false);
 const initialMap=()=>machines.map(m=>({...m,updated:Date.now()-(m.status==='stale'?180000:0)}));
 const [now,setNow]=useState(()=>new Date()),[running,setRunning]=useState(true),[map,setMap]=useState(initialMap);
 const [detail,setDetail]=useState(null),[tv,setTV]=useState(false);
 const root=useRef(null),tick=useRef(0),previousShift=useRef('');
 const shift=workShift(now),key=shift.date+'-'+shift.shift;
 useEffect(()=>{const t=setInterval(()=>setNow(new Date()),1000);return ()=>clearInterval(t);},[]);
 useEffect(()=>{if(previousShift.current && previousShift.current!==key){tick.current=0;setMap(initialMap());}previousShift.current=key;},[key,machines]);
 useEffect(()=>{if(!simulation||!running||tab!=='live')return;const timer=setInterval(()=>{if(!document.hidden){const step=++tick.current;setMap(s=>advance(s,step));}},5000);return ()=>clearInterval(timer);},[simulation,running,tab]);
 useEffect(()=>{function changed(){setTV(!!document.fullscreenElement);}function escape(e){if(e.key==='Escape'&&!document.fullscreenElement)setTV(false);}document.addEventListener('fullscreenchange',changed);window.addEventListener('keydown',escape);return ()=>{document.removeEventListener('fullscreenchange',changed);window.removeEventListener('keydown',escape);};},[]);
 async function toggleTV(){if(tv){setTV(false);if(document.fullscreenElement)await document.exitFullscreen();}else{setTV(true);try{await root.current.requestFullscreen();}catch{/* In-window TV mode remains available. */}}}
 useEffect(()=>{const sync=()=>setTab(location.hash==='#live'?'live':'analysis');window.addEventListener('hashchange',sync);return ()=>window.removeEventListener('hashchange',sync);},[]);
 function chooseTab(value){location.hash=value==='live'?'live':'hasil';setTab(value);setDetail(null);}
 const chosen=map.find(m=>m.id===detail);
 return <div ref={root} className={'weld-app '+(tab==='live'?theme:'light')+(tv?' tv':'')}>
  <div className="weld-shell"><header className="weld-nav"><div className="brand"><span className="monogram">B</span><strong>BERLINDO <small>DIGITAL ANDON</small></strong></div>
  <nav aria-label="Dashboard"><button aria-pressed={tab==='analysis'} onClick={()=>chooseTab('analysis')}>Dashboard</button><button aria-pressed={tab==='live'} onClick={()=>chooseTab('live')}>Dashboard Live</button></nav>
  <nav aria-label="Sumber data"><button aria-pressed={!simulation} onClick={()=>{setSimulation(false);setDetail(null);}}>Aktual</button><button aria-pressed={simulation} onClick={()=>setSimulation(true)}>Simulasi</button></nav></header>
  <nav className="workflow-links" aria-label="Ruang kerja">
   <a href="/leader?tab=targets">Target leader</a><a href="/pekerjaan.html">Pekerjaan operator</a><a href="/leader?tab=reports">Pemeriksaan &amp; TF Slip</a><a href="/portal.html?rekap=1">Rekap target &amp; TF Slip</a><a href="/">Form LKH ↗</a>
  </nav>
  {tab==='live'?<>
  <div className="map-head"><div><small className="overline">{simulation?'SIMULASI':'AKTUAL'} · WELDING</small><h1>Monitor produksi</h1><p>{dateFmt.format(new Date(shift.date+'T12:00:00Z'))} · Shift {shift.shift} · {simulation?'Aktual / target sesi (pcs)':'Pilot PLC Line 99'}</p></div>
  <div className="tools"><b className="time">{clockFmt.format(now)} <small>WIB</small></b><button onClick={()=>{const t=theme==='dark'?'light':'dark';setTheme(t);save('theme',t);}}>{theme==='dark'?'☀ Terang':'☾ Gelap'}</button><button onClick={toggleTV}>{tv?'Keluar TV':'⛶ Mode TV'}</button></div></div>
  {simulation?<><div className="map-summary"><div className="legend">{Object.entries(states).map(([k,v])=><span key={k}><Dot state={k}/><b>{map.filter(m=>m.status===k).length}</b> {v}</span>)}</div>
  <button aria-pressed={!running} onClick={()=>setRunning(v=>!v)}>{running?'Ⅱ Jeda simulasi':'▷ Lanjutkan simulasi'}</button><span className="tv-sample">Data simulasi</span></div>
  <div className="floor" data-reviewed-rows>{order.map(line=><Zone key={line} line={line} items={map.filter(m=>m.line===line)} select={setDetail}/>)}</div>
  <div className="map-foot"><span>Pilih mesin untuk melihat sesi.</span><span>{map.length} mesin · 8 line produksi + 1 line uji</span></div>
  {chosen&&<MachineDetail machine={chosen} close={()=>setDetail(null)}/>}
  </>:<ActualLive/>}
  </>:simulation?<><span className="sample">Data simulasi</span><Analysis jobs={simulationData.jobs} machines={machines} current={shift}/></>:<ActualAnalysis current={shift}/>}
 </div></div>;
}
