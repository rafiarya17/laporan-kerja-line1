import React, { useEffect, useMemo, useState } from 'react';
import { fmt } from './metrics';
import {Dot, FloorPlan, MachineDialog, PilotOutput} from './LiveFloor';

import {champerSessionKpis} from './champer-session-kpis.mjs';

const pilotIndicators=[
  ['availability','Availability · shift terpantau','Persentase waktu kedua sinyal terpantau dengan MTC dan dandori sama-sama nonaktif.'],
  ['performance','Performance sesi','Waktu standar output bruto ÷ (durasi sesi − downtime MTC/dandori tercatat pada sesi).'],
  ['efficiency','Efisiensi rencana berjalan','Pcs bruto ÷ target sampai saat ini berdasarkan alokasi jam leader.']
];
const time = new Intl.DateTimeFormat('id-ID', {timeZone:'Asia/Jakarta',dateStyle:'medium',timeStyle:'short'});
const hour = new Intl.DateTimeFormat('id-ID', {timeZone:'Asia/Jakarta',hour:'2-digit',minute:'2-digit'});

function useFeed(path,interval,deadline) {
  const [result,setResult]=useState({data:null,status:'loading'});
  useEffect(()=>{
    if(!path)return;
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
function sessionSummary(output,paired,failed,now){
  const session=output?.session,previous=output?.lastEnded;
  const job=session??previous;
  const ended=job?.endedAt!=null;
  const state=ended?endedLabel(job,now):(sessionLabels[job?.state]??(paired?'Perlu pemasangan browser':output?'Menunggu Mulai pekerjaan':'Menunggu data sesi'));
  const count=ended?(job.endDelta??job.observedEnd):job?.count?.value;
  const phase=failed&&job?'Status terakhir · '+state:state;
  return {session,previous,job,ended,phase,count};
}
function SessionResult({summary,output,paired,failed,now}){
  const {session,previous,job,ended,phase,count}=summary;
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
      <b className="champer-phase" data-tone={failed?'waiting':ended?(job.state.includes('REVIEW')?'review':'ended'):job?.state==='ACTIVE'?'active':'waiting'}>{phase}</b></div>
    <strong className="champer-session-count">{fmt(count)} {count!=null&&<small>hitungan</small>}</strong>
    {job&&<p><b>{job.part}</b> · Target pekerjaan {fmt(job.targetQty)} pcs OK · Shift {job.shift} · {job.date}</p>}
    <p>{note}</p>
    {previous&&session&&previous.id!==session.id&&<p className="previous-job">{endedLabel(previous,now)} · {previous.part} · {fmt(previous.endDelta??previous.observedEnd)} hitungan · {time.format(previous.endedAt)} WIB</p>}
  </div>;
}

function Metric({label,value,unit,note}){
  return <div className="champer-metric"><span>{label}</span><strong>{fmt(value)} {value!=null&&<small>{unit}</small>}</strong><p>{note}</p></div>;
}

export function ActualLive({date,shift,machines}){
  const [selected,setSelected]=useState(null);
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
  const shiftFrom=Date.parse(date+(shift===1?'T07:30':'T19:30')+':00+07:00');
  const calls=telemetry?.calls?.start===shiftFrom?telemetry.calls:null;
  const signalFresh=calls&&board.status==='ready'&&cloud.serverTime-calls.at<30000;
  const activeMtc=signalFresh&&calls.mtc===1,activeDandori=signalFresh&&calls.dandori===1;
  const status=activeMtc?'down':activeDandori?'setup':fresh?'received':pair||!reading?'waiting':'stale';
  const statusLabel=activeMtc?(activeDandori?'MTC + dandori':'MTC aktif'):activeDandori?'Dandori aktif':fresh?'Data D100 diterima':pair?'Perlu pemasangan':status==='stale'?'Data terakhir':'Menunggu data';
  const signalText=bit=>!signalFresh||bit==null?'Belum terpantau':bit===1?'Aktif':'Nonaktif';
  const duration=ms=>ms==null?'—':Math.floor(ms/3600000)+'j '+Math.floor(ms/60000)%60+'m '+Math.floor(ms/1000)%60+'d';
  const floor=useMemo(()=>machines.map(m=>m.line===99?{...m,status,statusLabel}:{...m,status:'unlinked'}),[machines,status,statusLabel]);
  const chosen=floor.find(m=>m.id===selected);
  const now=cloud?.serverTime??Date.now();
  const summary=sessionSummary(output,pair,board.status==='error',now);
  const {job,ended,phase,count}=summary;
  const sessionPlan=useFeed(job?.id?'/api/champer/session-plan?job='+encodeURIComponent(job.id):null,60000,12000);
  const hours=sessionPlan.data?.jobId===job?.id?sessionPlan.data?.hours:null;
  const asOf=cloud?.asOf;
  const kpis=champerSessionKpis(job,count,asOf,hours,cloud?.sessionTime);
  kpis.availability=calls?.covered>0?1-calls.down/calls.covered:null;
  const part=job?.part??(plan?.parts.length?plan.parts.map(p=>p.part).join(' · '):planNote);
  return <>
    <div className="map-summary"><div className="legend"><span><Dot state="received"/><b>1</b> mesin dengan integrasi PLC</span>
      <span><Dot state="unlinked"/><b>{floor.length-1}</b> belum terintegrasi</span></div></div>
    <FloorPlan machines={floor} select={setSelected} pilotCard={<>
      <span className="pilot-label"><b>AUTO CHAMPER</b><span className={'pilot-signal '+status}><Dot state={status}/>{statusLabel}</span></span>
      <span className="pilot-phase">{phase}{ended&&' · '+time.format(job.endedAt)+' WIB'}</span>
      <PilotOutput actual={kpis.pcs} target={job?job.targetQty:plan?.parts.length?plan.total:null}/>
      <span className="pilot-part">{job?'Aktual bruto / target OK sesi':'Aktual belum tersedia / target OK shift'}{job&&(job.date!==date||Number(job.shift)!==shift)&&' · '+job.date+' · Shift '+job.shift}</span>
      <span className="pilot-part" title={part}>{part}</span>
    </>}/>
    {chosen&&<MachineDialog machine={chosen} definitions={chosen.line===99?pilotIndicators:undefined} kpis={chosen.line===99?kpis:undefined} close={()=>setSelected(null)} note={chosen.line===99?
      (kpis.pcs!=null?fmt(count)+' hitungan × '+kpis.pcsPerCount+' pcs = '+fmt(kpis.pcs)+' pcs bruto. MASTER_CT '+kpis.cycleSeconds+' detik/pcs. Dihitung hingga '+hour.format(asOf)+' WIB. ':'Menunggu part dengan konversi dan pembacaan sesi yang valid. ')+'Availability memakai waktu yang terpantau pada shift ini. MTC dan dandori yang bersamaan dihitung satu kali.':
      'Mesin ini belum mengirim data ke Monitor Live. Metrik sesi tersedia setelah durasi mesin dan hasil produksi dapat diukur.'}>
    {chosen.line===99?<div className="champer-detail">
    <div className="champer-metrics">
      <div className="champer-metric"><span>D102 · MTC</span><p>{signalText(calls?.mtc)}</p><b>{duration(calls?.mtcKnown?calls.mtcMs:null)}</b></div>
      <div className="champer-metric"><span>D104 · Dandori</span><p>{signalText(calls?.dandori)}</p><b>{duration(calls?.dandoriKnown?calls.dandoriMs:null)}</b></div>
      <div className="champer-metric"><span>Cakupan shift</span><p>Terpantau {duration(calls?.covered)}</p><p>Belum terpantau {duration(Math.max(0,now-shiftFrom-(calls?.covered??0)))}</p><p>Downtime dalam cakupan {duration(calls?.covered?calls.down:null)}</p>{calls&&<p>Sampel terakhir {hour.format(calls.at)} WIB</p>}</div>
    </div>
    {job&&<div className="champer-metrics">
      <Metric label="Progres target akhir" value={kpis.progress==null?null:kpis.progress*100} unit="%" note={fmt(kpis.pcs)+' pcs bruto / '+fmt(job.targetQty)+' pcs target'}/>
      <Metric label="Target sampai saat ini" value={kpis.plannedQty} unit="pcs" note={hours?'Alokasi leader '+fmt(hours)+' jam sejak Mulai':sessionPlan.status==='loading'?'Memuat alokasi jam leader':'Alokasi jam untuk versi target ini belum tersedia'}/>
      <div className="champer-metric"><span>Waktu sesi setelah downtime</span><p>{duration(kpis.runMs)}</p><p>MTC/dandori tercatat dalam sesi {duration(cloud?.sessionTime?.down)}</p><p>{kpis.partial?'Cakupan sinyal sebagian · Performance sementara':kpis.runMs==null?'Menunggu bukti waktu sesi':''}</p></div>
    </div>}
    <SessionResult summary={summary} output={output} paired={pair} failed={board.status==='error'} now={now}/>
    <div className="champer-metrics">
      <Metric label="Target OK leader · shift" value={plan?.parts.length?plan.total:null} unit="pcs" note={planNote}/>
      <Metric label="OK dilaporkan operator · shift" value={output?.ok} unit="pcs" note={outputNote}/>
      <Metric label="Kenaikan D100 terpantau · shift" value={observed} unit="hitungan" note={meter?(meter.review?'Counter turun atau bacaan berkonflik · perlu pemeriksaan':'Dari '+hour.format(meter.firstAt)+' hingga '+hour.format(meter.lastAt)+' WIB'):pair?'Perlu pemasangan browser':'Menunggu D100 pertama pada shift ini'}/>
    </div>
    {plan?.parts.length>0&&<ul className="champer-plan">{plan.parts.map((p,i)=><li key={p.part+i}><span>{p.part}</span><b>{fmt(p.targetQty)} pcs OK</b></li>)}</ul>}
    <p><b>Counter D100 terakhir</b> · {fmt(reading?.value)}{reading&&' · '+time.format(reading.observedAt)+' WIB'}</p>
    <p role="status">{signalLabel}</p>
    <a href="/monitor-live.html">Buka Monitor Live Champer dan pemasangan browser ↗</a>
    </div>:<a href="/dashboard#hasil" onClick={()=>setSelected(null)}>Lihat hasil produksi yang sudah dilaporkan ↗</a>}
    </MachineDialog>}
  </>;
}
