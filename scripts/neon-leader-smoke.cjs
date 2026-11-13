// Run npm test first. Creates a test target and two Line 99 reports.
const assert=require('node:assert/strict'),{randomUUID}=require('node:crypto');
const {initialForm}=require('../.test-build/lkh.js');
(async()=>{
const access={shareableUrl:process.env.NEON_TRIAL_PREVIEW_URL},url=new URL(access.shareableUrl),origin=url.origin,cookies={};
let next=access.shareableUrl;
for(let n=0;n<8;n++){const r=await fetch(next,{redirect:'manual',signal:AbortSignal.timeout(25000),headers:{Cookie:Object.entries(cookies).map(([k,v])=>k+'='+v).join('; ')}});for(const c of r.headers.getSetCookie()){let pair=c.split(';')[0],i=pair.indexOf('=');cookies[pair.slice(0,i)]=pair.slice(i+1);}const l=r.headers.get('location');if(!l)break;next=new URL(l,next).href;}
const headers={Origin:origin,'Content-Type':'application/json',Cookie:Object.entries(cookies).map(([k,v])=>k+'='+v).join('; ')};
async function post(body,path='/api/leader'){const r=await fetch(origin+path,{method:'POST',headers,body:JSON.stringify(body),signal:AbortSignal.timeout(30000)});const b=await r.json();return {status:r.status,...b};}
const date='2026-11-10',shift='1';
const snapshot=()=>post({action:'snapshot',date,shift,line:'LINE_99'});
let s=await snapshot();assert.equal(s.ok,true,JSON.stringify(s));assert.equal(s.data.trial,true);
const target={action:'target',leader:'LEADER TEST SQL',payload:{requestId:randomUUID(),date,shift,line:'LINE_99',expectedVersion:s.data.targets[0]?.version||0,items:[{line:'LINE_99',machine:'PRESS DUMMY',part:'BODY_DUMMY-PN99001',targetQty:300}],reason:'Pengujian target leader SQL'}};
const t=await post(target);assert.equal(t.ok,true,JSON.stringify(t));assert.deepEqual((await post(target)).result,t.result);
assert.equal((await post({...target,payload:{...target.payload,reason:'Isi target diubah dengan ID sama'}})).error,'REQUEST_ID_CONFLICT');
const make=operators=>({id:'LKH99-'+randomUUID(),line:'LINE_99',form:{...initialForm,tanggal:date,shift,operator:operators,mesin:'PRESS DUMMY',part:'BODY_DUMMY-PN99001',jamMulaiProses:'07:30',jamSelesaiProses:'08:00',qtyOk:'100',qtyRepair:'0',qtyReject:'0',lembur:'No'}});
const a=make(['OPERATOR TEST A','HELPER TEST B']),b=make(['OPERATOR TEST B']);
for(const r of await Promise.all([post(a,'/api/submissions'),post(b,'/api/submissions')]))assert.equal(r.ok,true,JSON.stringify(r));
s=await snapshot();let report=s.data.reports.find(r=>r.id===a.id);assert.equal(report.state,'WAITING_LEADER');
const revise={action:'decide',leader:'LEADER TEST SQL',payload:{requestId:randomUUID(),id:a.id,expectedHash:report.hash,decision:'revise',reason:'Koreksi hitungan hasil menjadi 120',fields:{line:'LINE_99',isTest:true,date,shift,machineId:'PRESS DUMMY',part:'BODY_DUMMY-PN99001',start:'07:30',end:'08:00',ok:120,repair:0,reject:0}}};
const revised=await post(revise);assert.equal(revised.ok,true,JSON.stringify(revised));assert.deepEqual((await post(revise)).result,revised.result);
const stale=await post({action:'decide',leader:'LEADER TEST SQL',payload:{id:a.id,requestId:randomUUID(),expectedHash:report.hash,decision:'approve',reason:'Uji versi lama tidak boleh masuk'}});assert.equal(stale.error,'VERSION_CHANGED_REFRESH',JSON.stringify(stale));
s=await snapshot();report=s.data.reports.find(r=>r.id===a.id);assert.equal(report.input.ok,120);assert.equal(report.state,'WAITING_LEADER');
const commands=[a,b].map(p=>({id:p.id,requestId:randomUUID(),expectedHash:s.data.reports.find(r=>r.id===p.id).hash,decision:'approve',reason:'Persetujuan uji SQL selesai diperiksa'}));
const approved=await post({action:'decideBatch',leader:'LEADER TEST SQL',payload:{requestId:randomUUID(),commands}});assert.equal(approved.ok,true);assert.equal(approved.results.filter(r=>r.ok).length,2,JSON.stringify(approved));
s=await snapshot();for(const id of [a.id,b.id])assert.equal(s.data.reports.find(r=>r.id===id).state,'APPROVED_TEST');
const result={passed:true,date,shift,ids:[a.id,b.id],targetVersion:t.result.version,checks:['target and retry','target ID conflict','two reports for one target','two operators in one report','revision and retry','stale version rejected','bulk approval','approved status']};console.log(JSON.stringify(result));
})().catch(e=>{console.error(e.message.replace(/_vercel_share=[^&\s]+/g,'_vercel_share=[redacted]'));process.exit(1)});
