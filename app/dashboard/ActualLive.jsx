import React, { useEffect, useState } from 'react';
import { fmt } from './metrics';

const time = new Intl.DateTimeFormat('id-ID', {timeZone:'Asia/Jakarta',dateStyle:'medium',timeStyle:'short'});
const hour = new Intl.DateTimeFormat('id-ID', {timeZone:'Asia/Jakarta',hour:'2-digit',minute:'2-digit'});

function useFeed(path,interval,deadline) {
  const [result,setResult]=useState({data:null,status:'loading'});
  useEffect(()=>{
    let active=true, pending=false, controller, timeout;
    async function refresh(){
      if(document.hidden||pending)return;
      pending=true;
      controller=new AbortController();
      timeout=setTimeout(()=>controller.abort(),deadline);
      try{
        const response=await fetch(path,{signal:controller.signal});
        if(!active)return;
        if(response.status===401){setResult({data:null,status:'pair'});return;}
        if(!response.ok)throw Error();
        const data=await response.json();
        if(active)setResult({data,status:'ready'});
      }catch{
        if(active)setResult(old=>({...old,status:'error'}));
      }finally{clearTimeout(timeout);pending=false;}
    }
    refresh();
    const timer=setInterval(refresh,interval);
    document.addEventListener('visibilitychange',refresh);
    return ()=>{active=false;clearInterval(timer);clearTimeout(timeout);controller?.abort();document.removeEventListener('visibilitychange',refresh);};
  },[path,interval,deadline]);
  return result;
}

const sessionLabels={DRAFT:'Disiapkan',START_PENDING:'Menunggu counter awal',START_FAILED:'Counter awal belum tersedia',
  ACTIVE:'Aktif',END_PENDING:'Menunggu counter akhir',END_FAILED:'Counter akhir belum tersedia',
  END_CAPTURED:'Counter akhir diterima',REVIEW_REQUIRED:'Perlu pemeriksaan'};

function observedSession(session,reading,meter) {
  if(!session)return null;
  if(session.state==='END_CAPTURED')return session.endDelta;
  const start=session.baseline;
  if(!['ACTIVE','END_PENDING','END_FAILED'].includes(session.state)||!start||!reading||meter?.review||
    !reading.eventId.startsWith(start.collector+':')||reading.observedAt<start.observedAt||reading.value<start.value)return null;
  return reading.value-start.value;
}

function Metric({label,value,unit,note}){
  return <div className="champer-metric"><span>{label}</span><strong>{fmt(value)} {value!=null&&<small>{unit}</small>}</strong><p>{note}</p></div>;
}

export function ActualLive({date,shift}){
  const targets=useFeed('/api/dashboard/champer-target',60000,72000);
  const work=useFeed('/api/champer/live-work',30000,12000);
  const signal=useFeed('/api/champer/telemetry',5000,10000);
  const inPeriod=x=>x?.date===date&&x.shift===shift;
  const plan=inPeriod(targets.data)?targets.data:null;
  const output=inPeriod(work.data)?work.data:null;
  const cloud=signal.data?.machine==='AUTO_CHAMPER'&&signal.data.line==='LINE_99'?signal.data:null;
  const telemetry=cloud?.telemetry;
  const reading=telemetry?.reading;
  const meter=inPeriod(telemetry?.shiftCounter)?telemetry.shiftCounter:null;
  const age=cloud?.serverTime-reading?.observedAt;
  const fresh=signal.status==='ready'&&reading&&cloud.serverTime-telemetry.receivedAt<30000&&
    telemetry.localReady&&telemetry.status==='READ_OK'&&age>=-5000&&age<15000;
  const pair=signal.status==='pair'||work.status==='pair';
  const signalLabel=pair?'Pasangkan browser ini untuk melihat pembacaan Champer.':
    signal.status==='error'?'Penghubung cloud belum dapat diperiksa.':
    signal.status==='loading'?'Memeriksa penghubung cloud…':
    fresh?'Pembacaan DDE baru diterima · Kesegaran PLC belum terverifikasi':'Menunggu pembacaan baru';
  const session=output?.session;
  const observed=meter&&!meter.review?meter.lastValue-meter.firstValue:null;
  const planNote=targets.status==='error'?(plan?'Target terakhir · gagal memperbarui':'Target belum dapat dimuat'):
    plan?(plan.parts.length?plan.parts.length+' part ditargetkan':'Belum ada target leader'):'Memuat target leader…';
  const outputNote=work.status==='error'?(output?'Hasil terakhir · gagal memperbarui':'Hasil sesi belum dapat dimuat'):
    output?(output.completed?output.completed+' sesi selesai':'Belum ada sesi selesai'):pair?'Perlu pemasangan browser':'Memuat hasil sesi…';
  return <div className="field-live"><section className="zone pilot-zone">
    <header><h3>Line 99 Uji</h3><span>Shift {shift} · {date}</span></header>
    <h2>AUTO CHAMPER</h2>
    <div className="champer-metrics">
      <Metric label="Target OK leader" value={plan?.parts.length?plan.total:null} unit="pcs" note={planNote}/>
      <Metric label="Aktual OK tercatat" value={output?.ok} unit="pcs" note={outputNote}/>
      <Metric label="Kenaikan D100 terpantau" value={observed} unit="hitungan" note={meter?(meter.review?'Counter turun atau bacaan berkonflik · perlu pemeriksaan':'Dari '+hour.format(meter.firstAt)+' hingga '+hour.format(meter.lastAt)+' WIB'):pair?'Perlu pemasangan browser':'Menunggu D100 pertama pada shift ini'}/>
    </div>
    {plan?.parts.length>0&&<ul className="champer-plan">{plan.parts.map((p,i)=><li key={p.part+i}><span>{p.part}</span><b>{fmt(p.targetQty)} pcs OK</b></li>)}</ul>}
    {session?<p><b>Sesi {sessionLabels[session.state]??session.state}</b> · {session.part} · Selisih D100 sesi {fmt(observedSession(session,reading,meter))} hitungan</p>:output&&<p>Belum ada sesi terbuka pada shift ini.</p>}
    <p><b>Counter D100 terakhir</b> · {fmt(reading?.value)}{reading&&' · '+time.format(reading.observedAt)+' WIB'}</p>
    <p role="status">{signalLabel}</p>
    <a href="/monitor-live.html">Buka Monitor Live Champer dan pemasangan browser ↗</a>
  </section></div>;
}
