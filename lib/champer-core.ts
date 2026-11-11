import {randomUUID, createHash} from 'node:crypto';

// One machine pilot. No PLC write vocabulary exists in this protocol.
export const MACHINE = 'AUTO_CHAMPER';
export const TAG = 'DXP|Device1|D100';
export class ChamperError extends Error {
  constructor(public status:number, message:string) { super(message); }
}
export function fail(code:string, status=409):never {throw new ChamperError(status,code);}
export type Target = {date:string;shift:string;line:string;machine:string;part:string;version:number;targetQty:number};
export type Evidence = {command_id:string;request_key:string;purpose:string;status:string;created_at:string;expires_at:string;after_sequence:string;collector_id:string;machine_id:string;tag_id:string;result:null|{command_id:string;event_id:string;sequence:string;observed_at:string;counter_raw:string;read_status:string;quality:string;collector_id:string;machine_id:string;tag_id:string;event_type:string;reset_marker:string;freshness:string;production_usable:boolean}};
export type Command = {id:string;jobId:string;purpose:'START'|'END';createdAt:number;expiresAt:number;status:'PENDING'|'RECORDED'|'TIMED_OUT'|'FAILED'|'CANCELLED';lease?:{owner:string;token:string;until:number};evidence?:Evidence;reason?:string;late?:{at:number;status:string}};
export type Quality = {ok:string;repair:string;reject:string;issue:string;classification:string;problem:string;action:string;pic:string};
export type Job = {id:string;revision:number;target:Target;operators:string[];state:string;createdAt:number;start?:string;end?:string;delta:string|null;quality?:Quality;closedReason?:string;production_usable:false;dataset:'PLC_PILOT';audit:{at:number;action:string}[]};
export type State = {schema:1;revision:number;jobs:Job[];commands:Command[];requests:Record<string,{hash:string;jobId:string}>;device?:{at:number;ready:boolean;sourceId:string}};
export const initialState = ():State => ({schema:1,revision:0,jobs:[],commands:[],requests:{}});
export const uuid = (s:unknown):s is string => typeof s==='string'&&/^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/i.test(s);
export function text(v:unknown,max=160) {if(typeof v!=='string'||!v.trim()||v.length>max||/[\x00-\x1f]/.test(v))fail('INVALID_TEXT',400);return v.trim();}
const qty=(v:unknown)=>{if(typeof v!=='string'||! /^(0|[1-9][0-9]{0,8})$/.test(v))fail('INVALID_QUANTITY',400);return v as string;};
const terminal=(j:Job)=>['COMPLETED_PILOT','CANCELLED','CLOSED_REVIEW'].includes(j.state);
export function expire(s:State,now:number) {
  for(const c of s.commands) if(c.status==='PENDING'&&now>=c.expiresAt){c.status='TIMED_OUT';c.reason='NO_RESULT_BEFORE_DEADLINE';const j=s.jobs.find(j=>j.id===c.jobId)!;j.state=c.purpose+'_FAILED';j.revision++;j.audit.push({at:now,action:c.purpose+'_TIMED_OUT'});}
}
function job(s:State,id:unknown){const j=s.jobs.find(j=>j.id===id);if(!j)fail('JOB_NOT_FOUND',404);return j!;}
function exactKeys(v:Record<string,unknown>, allowed:string[]){if(Object.keys(v).some(k=>!allowed.includes(k)))fail('UNEXPECTED_FIELD',400);}
export function validateTarget(t:Target){
 if(!t||t.machine!=='AUTO CHAMPER'||t.line!=='LINE_1')fail('ONLY_AUTO_CHAMPER_LINE_1',400);
 if(!/^\d{4}-\d{2}-\d{2}$/.test(t.date)||!['1','2'].includes(t.shift)||!Number.isSafeInteger(t.version)||t.version<1||!Number.isSafeInteger(t.targetQty)||t.targetQty<=0)fail('INVALID_TARGET',400);
 if(new Date(t.date+'T00:00:00Z').toISOString().slice(0,10)!==t.date)fail('INVALID_DATE',400);
 text(t.part,200);
}
export function operatorAction(s:State,input:Record<string,unknown>,now:number):Job {
 expire(s,now);
 const action=input.action;
 if(!['prepare','start','end','quality','complete','close'].includes(String(action)))fail('INVALID_ACTION',400);
 exactKeys(input,['action','requestId','jobId','revision','target','operators','quality','reason']);
 if(!uuid(input.requestId))fail('INVALID_REQUEST_ID',400);
 const fingerprint=createHash('sha256').update(JSON.stringify(input)).digest('hex');
 const previous=s.requests[input.requestId];
 if(previous){if(previous.hash!==fingerprint)fail('REQUEST_ID_CONFLICT');return job(s,previous.jobId);}
 // Fail closed at pilot capacity; never evict dedupe records or active work.
 if((Object.keys(s.requests).length>=10000&&!['quality','complete','close'].includes(String(action)))||(action==='prepare'&&s.jobs.length>=500)||(['start','end'].includes(String(action))&&s.commands.length>=2000))fail('PILOT_ARCHIVE_REQUIRED',503);
 let j:Job;
 if(action==='prepare'){
   const target=input.target as Target;validateTarget(target);
   const operators=input.operators;
   if(!Array.isArray(operators)||operators.length<1||operators.length>10||new Set(operators).size!==operators.length)fail('INVALID_OPERATORS',400);
   if(s.jobs.some(j=>!terminal(j)))fail('MACHINE_HAS_OPEN_JOB');
   j={id:randomUUID(),revision:1,target:structuredClone(target),operators:operators.map(o=>text(o,100)),state:'DRAFT',createdAt:now,delta:null,production_usable:false,dataset:'PLC_PILOT',audit:[]};s.jobs.push(j);
 }else{
   j=job(s,input.jobId);
   if(input.revision!==j.revision)fail('REVISION_CONFLICT');
   if(terminal(j))fail('JOB_CLOSED');
   if(action==='start'||action==='end'){
     const purpose=action==='start'?'START':'END';
     if(!(purpose==='START'?['DRAFT','START_FAILED']:['ACTIVE','END_FAILED']).includes(j.state))fail('INVALID_JOB_STATE');
     if(!s.device?.ready||now-s.device.at>45000)fail('LOCAL_COLLECTOR_NOT_READY',503);
     if(s.commands.some(c=>c.status==='PENDING'))fail('READ_ALREADY_PENDING');
     const c:Command={id:randomUUID(),jobId:j.id,purpose,createdAt:now,expiresAt:now+90000,status:'PENDING'};
     s.commands.push(c);j[purpose==='START'?'start':'end']=c.id;j.state=purpose+'_PENDING';
   }else if(action==='quality'){
     if(!['END_CAPTURED','REVIEW_REQUIRED'].includes(j.state))fail('END_REQUIRED');
     const q=input.quality as Quality;
     if(!q||typeof q!=='object')fail('INVALID_QUALITY',400);
     exactKeys(q as unknown as Record<string,unknown>,['ok','repair','reject','issue','classification','problem','action','pic']);
     const v:Quality={ok:qty(q.ok),repair:qty(q.repair),reject:qty(q.reject),issue:q.issue,classification:'',problem:'',action:'',pic:''};
     if(!['Ada','Tidak'].includes(v.issue))fail('INVALID_ISSUE',400);
     if((Number(v.repair)>0||Number(v.reject)>0)&&v.issue!=='Ada')fail('ISSUE_REQUIRED',400);
     if(v.issue==='Ada'){if(!['MANUSIA','MESIN','MATERIAL','METODE'].includes(q.classification))fail('INVALID_CLASSIFICATION',400);v.classification=q.classification;v.problem=text(q.problem,2000);v.action=text(q.action,2000);v.pic=text(q.pic,100);}
     // No assumption that D100 counts good pieces; operator quality is separate.
     j.quality=v;
   }else if(action==='complete'){
     if(j.state!=='END_CAPTURED'||!j.quality)fail('END_AND_QUALITY_REQUIRED');
     j.state='COMPLETED_PILOT';
   }else if(action==='close'){
     j.closedReason=text(input.reason,500);j.state=j.start?'CLOSED_REVIEW':'CANCELLED';
     for(const c of s.commands)if(c.jobId===j.id&&c.status==='PENDING')c.status='CANCELLED';
   }
   j.revision++;
 }
 j.audit.push({at:now,action:String(action)});s.requests[input.requestId]={hash:fingerprint,jobId:j.id};return j;
}
export function poll(s:State,owner:string,sourceId:string,ready:boolean,now:number){
 if(!uuid(owner))fail('INVALID_AGENT_INSTANCE',400);
 expire(s,now);s.device={at:now,ready,sourceId};
 const c=s.commands.find(c=>c.status==='PENDING');if(!c)return null;
 if(c.lease&&c.lease.until>now&&c.lease.owner!==owner)return null;
 if(!c.lease||c.lease.owner!==owner||c.lease.until<=now)c.lease={owner,token:randomUUID(),until:Math.min(now+30000,c.expiresAt)};
 else c.lease.until=Math.min(now+30000,c.expiresAt);
 return {id:c.id,purpose:c.purpose,lease:c.lease.token,expiresAt:c.expiresAt,remainingMs:c.expiresAt-now,machine:MACHINE,tag:TAG,readOnly:true,localRequestKey:'CLOUD-'+c.id,localTimeoutMs:30000};
}
export function result(s:State,v:{commandId:string;lease:string;evidence:Evidence},now:number,collectorId:string){
 expire(s,now);const c=s.commands.find(c=>c.id===v.commandId);if(!c)fail('COMMAND_NOT_FOUND',404);
 if(!c!.lease||c!.lease.token!==v.lease)fail('LEASE_CONFLICT');
 if(c!.status==='RECORDED'){
   if(JSON.stringify(c!.evidence)!==JSON.stringify(v.evidence))fail('RESULT_CONFLICT');
   return {accepted:true,duplicate:true};
 }
 if(c!.status!=='PENDING'){c!.late={at:now,status:String(v.evidence?.status).slice(0,40)};return {accepted:false,reason:'COMMAND_CLOSED'};}
 if(c!.lease.until<now)fail('LEASE_EXPIRED');
 const e=v.evidence,r=e?.result;
 if(!e||!uuid(e.command_id)||e.request_key!=='CLOUD-'+c!.id||e.purpose!==c!.purpose||e.collector_id!==collectorId||e.machine_id!==MACHINE||e.tag_id!==TAG)fail('EVIDENCE_MAPPING_MISMATCH',400);
 if(!['RECORDED','TIMED_OUT','FAILED','CANCELLED'].includes(e.status))fail('RESULT_NOT_FINAL',400);
 if(e.status==='RECORDED'){
   const created=Date.parse(e.created_at),observed=Date.parse(r?.observed_at||''),expiresAt=Date.parse(e.expires_at);
   if(!r||r.command_id!==e.command_id||r.collector_id!==collectorId||r.machine_id!==MACHINE||r.tag_id!==TAG||r.event_type!=='SNAPSHOT'||r.read_status!=='READ_OK'||!['GOOD','UNCERTAIN','UNKNOWN'].includes(r.quality)||typeof r.event_id!=='string'||r.event_id.length>200||typeof r.reset_marker!=='string'||r.reset_marker.length>200)fail('INVALID_READ_EVIDENCE',400);
   qty(r.counter_raw);
   if(!/^\d{1,20}$/.test(r.sequence)||!/^\d{1,20}$/.test(e.after_sequence)||BigInt(r.sequence)<=BigInt(e.after_sequence))fail('STALE_SEQUENCE',400);
   if(!Number.isFinite(created)||!Number.isFinite(observed)||!Number.isFinite(expiresAt)||created<c!.createdAt-5000||created>now+5000||observed<created||observed>expiresAt||observed>now+5000||observed>c!.expiresAt+5000)fail('EVIDENCE_TIME_INVALID',400);
   // Never promote DDE receipt to verified PLC freshness.
   r.freshness='UNVERIFIED';r.production_usable=false;
 }
 c!.evidence=structuredClone(e);c!.status=e.status==='RECORDED'?'RECORDED':'FAILED';
 const j=job(s,c!.jobId);j.state=c!.status==='RECORDED'?(c!.purpose==='START'?'ACTIVE':'END_CAPTURED'):c!.purpose+'_FAILED';
 if(j.state==='END_CAPTURED'){
   const start=s.commands.find(x=>x.id===j.start)?.evidence?.result, end=r!;
   if(!start||start.collector_id!==end.collector_id||start.reset_marker!==end.reset_marker||BigInt(end.sequence)<=BigInt(start.sequence)||Date.parse(end.observed_at)<Date.parse(start.observed_at)||BigInt(end.counter_raw)<BigInt(start.counter_raw)||Number(start.counter_raw)>9999||Number(end.counter_raw)>9999){j.state='REVIEW_REQUIRED';j.delta=null;}
   else j.delta=(BigInt(end.counter_raw)-BigInt(start.counter_raw)).toString();
 }
 j.revision++;j.audit.push({at:now,action:c!.purpose+'_'+c!.status});return {accepted:true,duplicate:false};
}
export function view(s:State,now:number){
 expire(s,now);
 const boundary=(id:string|undefined)=>{const c=s.commands.find(c=>c.id===id);return c?.status==='RECORDED'?c.evidence?.result||null:null;};
 const publicJobs=s.jobs.map(j=>({...j,startEvidence:boundary(j.start),endEvidence:boundary(j.end)}));
 return {dataset:'PLC_PILOT',production_usable:false,machine:MACHINE,deviceReady:!!s.device?.ready&&now-s.device.at<=45000,deviceLastSeen:s.device?.at||null,jobs:publicJobs.slice(-100).reverse()};
}
