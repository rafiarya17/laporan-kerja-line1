import React, {useEffect, useRef} from 'react';
import {fmt, labelLine} from './metrics';

const lineOrder = [1, 2, 3, 4, 5, 6, 99, 8, 7];
export const simulationStates = {run:'Berjalan', down:'Breakdown', setup:'Dandori', off:'Off', stale:'Data terlambat'};
const labels = {...simulationStates, unlinked:'Belum terintegrasi', received:'Data diterima', waiting:'Menunggu data'};
const indicators = [
  ['availability','Availability','Waktu mesin berjalan ÷ waktu produksi terencana.'],
  ['performance','Performance','Waktu ideal untuk output sesi ÷ waktu mesin berjalan.'],
  ['efficiency','Efisiensi waktu','Waktu ideal untuk output sesi ÷ waktu produksi terencana.']
];

export function Dot({state}) {
  return <i className={'signal '+state} aria-hidden="true"/>;
}
export function FloorPlan({machines, select, pilotCard}) {
  return <>
    <div className="floor">{lineOrder.map(line => {
      const items = machines.filter(machine => machine.line === line);
      const pilot = line === 99;
      return <section key={line} className={'zone'+(pilot?' pilot-zone':'')} aria-label={labelLine(line)}>
        <header><h3>{labelLine(line)}</h3><span>{pilot?'Pilot Champer':items.length+' mesin'}</span></header>
        {pilot ? <button className="pilot" onClick={()=>select(items[0].id)}>{pilotCard}</button> :
          <div className={'tiles '+(items.length>6?'dense':items.length<=2?'sparse':'')}>{items.map(m=>
            <button className={'tile '+m.status} key={m.id} onClick={()=>select(m.id)}
              aria-label={m.name+', '+labels[m.status]+', lihat detail'} title={m.name+' · '+labels[m.status]}>
              <span className="tile-name"><Dot state={m.status}/>{m.name}</span>
              {m.status!=='unlinked'&&<span className="tile-info">{m.status==='off'?'—':<>{fmt(m.actual)} <small>/ {fmt(m.target)}</small></>}</span>}
              <small className="state-text">{labels[m.status]}</small>
              {items.length<=2 && m.parts && m.status!=='off' && <span className="sparse-part">{m.parts[0]}</span>}
            </button>)}</div>}
      </section>;
    })}</div>
    <div className="map-foot"><span>Pilih mesin untuk melihat metrik dan sesi.</span><span>{machines.length} mesin · 8 line produksi + 1 line uji</span></div>
  </>;
}
export function MachineDialog({machine, simulation=false, close, kpis, note, children, definitions=indicators}) {
  const ref = useRef(null);
  useEffect(()=>{
    const dialog=ref.current;
    const opener=document.activeElement;
    dialog.showModal();
    return ()=>{
      if(dialog.open)dialog.close();
      if(opener instanceof HTMLElement && opener.isConnected)opener.focus();
    };
  },[]);
  return <dialog className="machine-dialog" aria-labelledby="detail-machine-name" ref={ref} onCancel={e=>{e.preventDefault();close();}}
    onClick={e=>{if(e.target===ref.current)close();}}>
    <div className="detail-top"><small>{labelLine(machine.line)} · {simulation?'SIMULASI':'AKTUAL'}</small><button aria-label="Tutup detail" onClick={close}>×</button></div>
    <h2 id="detail-machine-name">{machine.name}</h2>
    <p className="detail-state"><Dot state={machine.status}/>{machine.statusLabel??labels[machine.status]}</p>
    <dl className="machine-kpis" aria-label="Tiga metrik sesi">{definitions.map(([key,label,definition])=>
      <div key={key}><dt>{label}</dt><dd><strong>{Number.isFinite(kpis?.[key])?(100*kpis[key]).toLocaleString('id-ID',{maximumFractionDigits:2})+'%':'—'}</strong><small>{definition}</small></dd></div>)}</dl>
    {note&&<p className="kpi-note">{note}</p>}
    {children}
  </dialog>;
}
