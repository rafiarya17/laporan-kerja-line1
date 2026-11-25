import {minutes,processInterval,type LkhForm} from './lkh';

export type CtPartSpec={helper?:boolean;lengthMm?:number};
export type CtCheck={status:'normal'|'high'|'unavailable';day:string|null;note?:string;
  seconds?:number;actual?:number;standard?:number;percent?:number;operatingMinutes?:number;unit?:string};

export function reviewCt(line:string,form:LkhForm,seconds:number|undefined,spec:CtPartSpec|undefined,day:string|null):CtCheck|null {
  if(!/^LINE_[1-8]$/.test(line)||form.jenisAktivitas==='DANDORI'||spec?.helper)return null;
  const unavailable=(note:string):CtCheck=>({status:'unavailable',day,note});
  if(!Number.isFinite(seconds)||!seconds||seconds<=0)return unavailable('CT mesin–part belum tersedia.');
  const pipe=line==='LINE_8',length=spec?.lengthMm;
  if(pipe&&(!length||!Number.isFinite(length)||length<=0))return unavailable('Panjang per batang belum tersedia.');
  const interval=processInterval(form);
  if(!interval)return unavailable('Periksa tanggal dan jam proses.');
  const midnight=Date.parse(form.tanggal+'T00:00:00+07:00');
  const friday=new Date(form.tanggal+'T00:00:00Z').getUTCDay()===5;
  const night=form.shift==='2';
  // CONFIG_SHIFT in WIB, expressed in minutes since midnight of the production date.
  const breaks=night?[[1440,1500],[1770,1800]]:[friday?[690,780]:[660,720],[1050,1080]];
  const start=Math.max((interval.start-midnight)/60000,night?1170:450);
  const end=Math.min((interval.end-midnight)/60000,night?1890:1170);
  const effective=(s:number,e:number)=>Math.max(0,e-s-breaks.reduce((n,[a,b])=>n+Math.max(0,Math.min(e,b)-Math.max(s,a)),0));
  let operatingMinutes=effective(start,end);
  if(form.kendala==='Ada'){
    const a=minutes(form.jamMulaiKendala),b=minutes(form.jamSelesaiKendala);
    if(a===null||b===null)return unavailable('Jam kendala belum lengkap.');
    const issueStart=a+(night&&a<720?1440:0),issueEnd=b+(night&&b<720?1440:0);
    if(issueEnd<=issueStart||issueStart<start||issueEnd>end)return unavailable('Periksa jam kendala dan jam proses.');
    operatingMinutes-=effective(issueStart,issueEnd);
  }
  if(operatingMinutes<=0)return unavailable('Waktu operasional efektif belum tersedia.');
  const quantities=[form.qtyOk,form.qtyRepair,form.qtyReject];
  if(quantities.some(v=>typeof v!=='string'||!v.trim()||!Number.isFinite(Number(v))||Number(v)<0))return unavailable('Qty laporan belum lengkap.');
  const [ok,repair,reject]=quantities.map(Number);
  const actual=pipe?ok+(repair+reject)/length!:ok+repair+reject;
  const standard=operatingMinutes*60/seconds,percent=actual/standard*100;
  return {status:actual*seconds>1.5*operatingMinutes*60?'high':'normal',day,seconds,actual,standard,percent,operatingMinutes,unit:pipe?'batang ekuivalen':'pcs'};
}
