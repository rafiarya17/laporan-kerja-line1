import React,{useEffect,useRef,useState} from 'react';
import simulationData, {startSimulatedFloor,advanceSimulatedFloor} from './simulation.js';
import {FloorPlan,MachineDialog,Dot,PilotOutput,simulationStates as states} from './LiveFloor';
import performanceCore from '../../public/portal-performance-core.js';
import {Analysis} from './Analysis.jsx';
import {ActualAnalysis,ActualLive} from './Actual.jsx';
import {workShift,fmt,saved,save} from './metrics.js';
import './welding.css';

const clockFmt=new Intl.DateTimeFormat('id-ID',{timeZone:'Asia/Jakarta',hour:'2-digit',minute:'2-digit',second:'2-digit',hour12:false});
const dateFmt=new Intl.DateTimeFormat('id-ID',{timeZone:'UTC',weekday:'short',day:'numeric',month:'short'});
function SimulationDetail({machine:m,close}){
 const kpis=performanceCore.calculate({planned:m.plannedSeconds/60,run:m.runSeconds/60,total:m.actual,
   cycleSeconds:m.ct,timeVerified:true,counterValid:true,cycleVerified:true});
 const note=m.status==='off'?'Belum ada sesi simulasi.':m.status==='stale'?'Metrik dari pembaruan simulasi terakhir.':'Dihitung dari durasi, waktu siklus, dan jumlah hasil sesi simulasi.';
 return <MachineDialog machine={m} close={close} simulation kpis={kpis} note={note}>
  {m.status!=='off'&&<><small>Part sesi</small><p>{m.parts[0]}</p>
    <div className="detail-num"><div><small>{m.status==='stale'?'Aktual terakhir':'Aktual sesi'}</small><strong>{fmt(m.actual)} <em>pcs</em></strong></div><div><small>Target sesi</small><strong>{fmt(m.target)} <em>pcs</em></strong></div></div>
    {m.line===99&&<p>D100 awal {fmt(m.base)} · D100 simulasi {fmt(m.base+m.actual)}</p>}</>}
  <small>Pembaruan simulasi {clockFmt.format(m.updated)} WIB</small>
 </MachineDialog>;
}
function SimulatedPilot({machine:m}){
 return <>
   <span className="pilot-label"><b>{m.name}</b><span><Dot state={m.status}/>{states[m.status]}</span></span>
   <PilotOutput actual={m.actual} target={m.target}/>
   <span className="pilot-part">{m.parts[0]}</span>
 </>;
}
export function DashboardContent({machines}){
 const [tab,setTab]=useState(()=>location.hash==='#live'?'live':'analysis'),[theme,setTheme]=useState(()=>saved('theme','dark'));
 const [simulation,setSimulation]=useState(false);
 const [now,setNow]=useState(()=>new Date()),[running,setRunning]=useState(true),[map,setMap]=useState(()=>startSimulatedFloor(machines));
 const [detail,setDetail]=useState(null),[tv,setTV]=useState(false);
 const root=useRef(null),tick=useRef(0),previousShift=useRef('');
 const shift=workShift(now),key=shift.date+'-'+shift.shift;
 useEffect(()=>{const t=setInterval(()=>setNow(new Date()),1000);return ()=>clearInterval(t);},[]);
 useEffect(()=>{if(previousShift.current && previousShift.current!==key){tick.current=0;setMap(startSimulatedFloor(machines));}previousShift.current=key;},[key,machines]);
 useEffect(()=>{if(!simulation||!running||tab!=='live')return;const timer=setInterval(()=>{if(!document.hidden){const step=++tick.current;setMap(s=>advanceSimulatedFloor(s,step));}},5000);return ()=>clearInterval(timer);},[simulation,running,tab]);
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
  <div className="map-head"><div><small className="overline">{simulation?'SIMULASI':'AKTUAL'} · WELDING</small><h1>Monitor produksi</h1><p>{dateFmt.format(new Date(shift.date+'T12:00:00Z'))} · Shift {shift.shift} · Aktual / target (pcs)</p></div>
  <div className="tools"><b className="time">{clockFmt.format(now)} <small>WIB</small></b><button onClick={()=>{const t=theme==='dark'?'light':'dark';setTheme(t);save('theme',t);}}>{theme==='dark'?'☀ Terang':'☾ Gelap'}</button><button onClick={toggleTV}>{tv?'Keluar TV':'⛶ Mode TV'}</button></div></div>
  {simulation?<><div className="map-summary"><div className="legend">{Object.entries(states).map(([k,v])=><span key={k}><Dot state={k}/><b>{map.filter(m=>m.status===k).length}</b> {v}</span>)}</div>
  <button aria-pressed={!running} onClick={()=>setRunning(v=>!v)}>{running?'Ⅱ Jeda simulasi':'▷ Lanjutkan simulasi'}</button><span className="tv-sample">Data simulasi</span></div>
  <FloorPlan machines={map} select={setDetail} pilotCard={<SimulatedPilot machine={map.find(m=>m.line===99)}/>}/>
  {chosen&&<SimulationDetail machine={chosen} close={()=>setDetail(null)}/>}
  </>:<ActualLive machines={machines} key={key} date={shift.date} shift={shift.shift}/>}
  </>:simulation?<><span className="sample">Data simulasi</span><Analysis jobs={simulationData.jobs} machines={simulationData.machines} current={shift}/></>:<ActualAnalysis current={shift}/>}
 </div></div>;
}
