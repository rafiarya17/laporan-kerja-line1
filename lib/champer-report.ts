import {State,fail,uuid} from './champer-core';
import {initialForm,Submission,Receipt} from './lkh';

export type ReportInput={jobId:string;revision:number;lembur:string;jamMulaiKendala:string;jamSelesaiKendala:string};
export type PilotReport={payload:Submission;state:'PENDING'|'QUEUED';receipt?:Receipt};
const local=(iso:string)=>new Date(Date.parse(iso)+7*3600000).toISOString();
// Build identity and quantities from the frozen cloud session, never from a tablet-supplied report.
export function prepareReport(s:State,input:ReportInput):Submission {
 if(!uuid(input.jobId))fail('INVALID_JOB_ID',400);
 const j=s.jobs.find(j=>j.id===input.jobId);if(!j)fail('JOB_NOT_FOUND',404);
 if(j.report)return j.report.payload;
 if(j.revision!==input.revision)fail('REVISION_CONFLICT');
 if(j.state!=='COMPLETED_PILOT'||!j.quality||j.target.line!=='LINE_99'||j.delta===null)fail('REPORT_NOT_READY');
 const a=s.commands.find(c=>c.id===j.start)?.evidence?.result,b=s.commands.find(c=>c.id===j.end)?.evidence?.result;
 if(!a||!b)fail('REPORT_EVIDENCE_REQUIRED');
 const start=local(a.observed_at),end=local(b.observed_at),q=j.quality;
 // Retain receiver's shift/date semantics; do not silently assign observations to another day.
 const productionDay=(v:string)=>j.target.shift==='2'&&Number(v.slice(11,13))<12?new Date(Date.parse(v.slice(0,10)+'T00:00:00Z')-86400000).toISOString().slice(0,10):v.slice(0,10);
 if(productionDay(start)!==j.target.date||productionDay(end)!==j.target.date)fail('REPORT_DATE_REQUIRES_REVIEW');
 return {id:'LKH99-'+j.id,line:'LINE_99',form:{...initialForm,tanggal:j.target.date,shift:j.target.shift,operator:[...j.operators],mesin:j.target.machine,part:j.target.part,
 jamMulaiProses:start.slice(11,16),jamSelesaiProses:end.slice(11,16),qtyOk:q.ok,qtyRepair:q.repair,qtyReject:q.reject,
 lembur:input.lembur,kendala:q.issue,kendala4M:q.classification,permasalahan:q.problem,tindakan:q.action,pic:q.pic,
 jamMulaiKendala:q.issue==='Ada'?input.jamMulaiKendala:'',jamSelesaiKendala:q.issue==='Ada'?input.jamSelesaiKendala:''}};
}
export function reserveReport(s:State,input:ReportInput,payload:Submission){
 const current=prepareReport(s,input),j=s.jobs.find(j=>j.id===input.jobId)!;
 if(JSON.stringify(current)!==JSON.stringify(payload))fail('REPORT_CHANGED');
 if(!j.report){j.report={payload:structuredClone(payload),state:'PENDING'};j.revision++;}
 return j.report;
}
export function confirmReport(s:State,jobId:string,receipt:Receipt){
 const j=s.jobs.find(j=>j.id===jobId);
 if(!j?.report||receipt.id!==j.report.payload.id||receipt.state!=='QUEUED'||receipt.mode!=='production'||!Number.isFinite(Date.parse(receipt.receivedAt)))fail('INVALID_REPORT_RECEIPT');
 if(j.report.state!=='QUEUED'){j.report.state='QUEUED';j.report.receipt=receipt;j.revision++;}
 return j.report;
}
