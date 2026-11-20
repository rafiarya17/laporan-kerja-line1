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

const sessionLabels={DRAFT:'Pekerjaan disiapkan',START_PENDING:'Membaca counter awal',START_FAILED:'Pembacaan awal gagal',
  ACTIVE:'Pekerjaan berjalan',END_PENDING:'Membaca counter akhir',END_FAILED:'Pembacaan akhir gagal'};

function endedLabel(job,now){
  if(job.state==='REVIEW_REQUIRED'||job.state==='CLOSED_REVIEW')return 'Pekerjaan berakhir · perlu pemeriksaan';
  const age=now-job.endedAt;
  return age>=0&&age<=600000?'Pekerjaan baru selesai':'Pekerjaan selesai';
}
function SessionResult({output,paired,failed,now}){
  const session=output?.session,previous=output?.lastEnded;
  const job=session??previous;
  const ended=job?.endedAt!=null;
  const state=ended?endedLabel(job,now):(sessionLabels[job?.state]??(paired?'Perlu pemasangan browser':output?'Menunggu Mulai pekerjaan':'Menunggu data sesi'));
  const count=ended?(job.endDelta??job.observedEnd):job?.count?.value;
  let note='Counter awal akan dicatat saat operator memulai pekerjaan.';
  if(ended){
    note='Diakhiri '+time.format(job.endedAt)+' WIB';
    if(job.state==='END_CAPTURED')note+=' · menunggu penyelesaian catatan operator';
    if(job.state==='COMPLETED_PILOT')note+=' · catatan operator selesai';
    if(['REVIEW_REQUIRED','CLOSED_REVIEW'].includes(job.state))note+=count!=null?' · selisih teramati menunggu pemeriksaan':' · selisih belum dapat ditetapkan';
  }else if(job?.count?.source==='review')note='Pembacaan counter perlu pemeriksaan.';
  else if(job?.baseline){
    note='D100 awal '+fmt(job.baseline.value)+' · mulai '+hour.format(job.baseline.observedAt)+' WIB';
    if(job.count?.source==='start')note+=' · menunggu pembacaan setelah Mulai';
    if(job.count?.source==='reading')note+=' · pembacaan '+hour.format(job.count.at)+' WIB';
  }else if(!output)note=paired?'Pasangkan browser untuk melihat aktual pekerjaan.':failed?'Data sesi belum dapat dimuat.':'Memuat sesi pekerjaan…';
  return <div className="champer-session" aria-label="Hasil pekerjaan Champer">
    <div className="champer-session-heading"><span>{ended?'Hasil akhir pekerjaan':'Aktual pekerjaan sejak Mulai'}</span>
      <b className="champer-phase" data-tone={failed?'waiting':ended?(job.state.includes('REVIEW')?'review':'ended'):job?.state==='ACTIVE'?'active':'waiting'}>{failed && job?'Status terakhir · ':''}{state}</b></div>
    <strong className="champer-session-count">{fmt(count)} {count!=null&&<small>hitungan</small>}</strong>
    {job&&<p><b>{job.part}</b> · Target pekerjaan {fmt(job.targetQty)} pcs OK · Shift {job.shift} · {job.date}</p>}
    <p>{note}</p>
    {previous&&session&&previous.id!==session.id&&<p className="previous-job">{endedLabel(previous,now)} · {previous.part} · {fmt(previous.endDelta??previous.observedEnd)} hitungan · {time.format(previous.endedAt)} WIB</p>}
  </div>;
}

function Metric({label,value,unit,note}){
  return <div className="champer-metric"><span>{label}</span><strong>{fmt(value)} {value!=null&&<small>{unit}</small>}</strong><p>{note}</p></div>;
}

export function ActualLive({date,shift}){
  const targets=useFeed('/api/dashboard/champer-target',60000,72000);
  const board=useFeed('/api/champer/live-board',5000,10000);
  const inPeriod=x=>x?.date===date&&x.shift===shift;
  const plan=inPeriod(targets.data)?targets.data:null;
  const cloud=board.data?.machine==='AUTO_CHAMPER'&&board.data.line==='LINE_99'?board.data:null;
  const output=inPeriod(cloud)?cloud:null;
  const telemetry=cloud?.telemetry;
  const reading=telemetry?.reading;
  const meter=inPeriod(telemetry?.shiftCounter)?telemetry.shiftCounter:null;
  const age=cloud?.serverTime-reading?.observedAt;
  const fresh=board.status==='ready'&&reading&&cloud.serverTime-telemetry.receivedAt<30000&&
    telemetry.localReady&&telemetry.status==='READ_OK'&&age>=-5000&&age<15000;
  const pair=board.status==='pair';
  const signalLabel=pair?'Pasangkan browser ini untuk melihat pembacaan Champer.':
    board.status==='error'?'Penghubung cloud belum dapat diperiksa.':
    board.status==='loading'?'Memeriksa penghubung cloud…':
    fresh?'Pembacaan DDE baru diterima · Kesegaran PLC belum terverifikasi':'Menunggu pembacaan baru';
  const observed=meter&&!meter.review?meter.lastValue-meter.firstValue:null;
  const planNote=targets.status==='error'?(plan?'Target terakhir · gagal memperbarui':'Target belum dapat dimuat'):
    plan?(plan.parts.length?plan.parts.length+' part ditargetkan':'Belum ada target leader'):'Memuat target leader…';
  const outputNote=board.status==='error'?(output?'Hasil terakhir · gagal memperbarui':'Hasil sesi belum dapat dimuat'):
    output?(output.completed?output.completed+' sesi selesai':'Belum ada sesi selesai'):pair?'Perlu pemasangan browser':'Memuat hasil sesi…';
  return <div className="field-live"><section className="zone pilot-zone">
    <header><h3>Line 99 Uji</h3><span>Shift {shift} · {date}</span></header>
    <h2>AUTO CHAMPER</h2>
    <SessionResult output={output} paired={pair} failed={board.status==='error'} now={cloud?.serverTime??Date.now()}/>
    <div className="champer-metrics">
      <Metric label="Target OK leader · shift" value={plan?.parts.length?plan.total:null} unit="pcs" note={planNote}/>
      <Metric label="OK dilaporkan operator · shift" value={output?.ok} unit="pcs" note={outputNote}/>
      <Metric label="Kenaikan D100 terpantau · shift" value={observed} unit="hitungan" note={meter?(meter.review?'Counter turun atau bacaan berkonflik · perlu pemeriksaan':'Dari '+hour.format(meter.firstAt)+' hingga '+hour.format(meter.lastAt)+' WIB'):pair?'Perlu pemasangan browser':'Menunggu D100 pertama pada shift ini'}/>
    </div>
    {plan?.parts.length>0&&<ul className="champer-plan">{plan.parts.map((p,i)=><li key={p.part+i}><span>{p.part}</span><b>{fmt(p.targetQty)} pcs OK</b></li>)}</ul>}
    <p><b>Counter D100 terakhir</b> · {fmt(reading?.value)}{reading&&' · '+time.format(reading.observedAt)+' WIB'}</p>
    <p role="status">{signalLabel}</p>
    <a href="/monitor-live.html">Buka Monitor Live Champer dan pemasangan browser ↗</a>
  </section></div>;
}
