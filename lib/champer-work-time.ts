import {initialForm, processInterval} from './lkh';

export type WorkTime = {start:string;end:string;overtime:'Yes'|'No';reason:string;confirmedAt:number};
type Context = {date:string;shift:string;startObserved:string;endObserved:string};
export const wibMinute=(iso:string)=>new Date(Date.parse(iso)+7*3600000).toISOString().slice(0,16);

// Actual work times never replace the immutable counter observation timestamps.
export function validateWorkTime(value:unknown, context:Context, now:number):WorkTime {
 const invalid=(code:string):never=>{throw new Error(code);};
 if(!value||typeof value!=='object'||Array.isArray(value))return invalid('WORK_TIME_REQUIRED');
 const v=value as Record<string,unknown>;
 if(Object.keys(v).some(k=>!['start','end','overtime','reason','confirmed'].includes(k)))return invalid('INVALID_WORK_TIME');
 if(v.confirmed!==true)return invalid('WORK_TIME_CONFIRM_REQUIRED');
 const pattern=/^\d{4}-\d{2}-\d{2}T(?:[01]\d|2[0-3]):[0-5]\d$/;
 if(typeof v.start!=='string'||typeof v.end!=='string'||!pattern.test(v.start)||!pattern.test(v.end))return invalid('INVALID_WORK_TIME');
 const a=Date.parse(v.start+':00+07:00'),b=Date.parse(v.end+':00+07:00');
 if(!Number.isFinite(a)||!Number.isFinite(b)||wibMinute(new Date(a).toISOString())!==v.start||wibMinute(new Date(b).toISOString())!==v.end||b<=a||b-a>16*3600000||b>now+300000)return invalid('INVALID_WORK_TIME');
 const interval=processInterval({...initialForm,tanggal:context.date,shift:context.shift,jamMulaiProses:v.start.slice(11),jamSelesaiProses:v.end.slice(11)});
 if(!interval||interval.start!==a||interval.end!==b)return invalid('WORK_TIME_PRODUCTION_DATE_MISMATCH');
 if(v.overtime!=='Yes'&&v.overtime!=='No')return invalid('OVERTIME_CONFIRM_REQUIRED');
 if(typeof v.reason!=='string'||v.reason.length>1000||/[\x00-\x1f]/.test(v.reason))return invalid('INVALID_WORK_TIME_REASON');
 const changed=v.start!==wibMinute(context.startObserved)||v.end!==wibMinute(context.endObserved);
 if(changed&&!v.reason.trim())return invalid('WORK_TIME_REASON_REQUIRED');
 return {start:v.start,end:v.end,overtime:v.overtime,reason:v.reason.trim(),confirmedAt:now};
}
