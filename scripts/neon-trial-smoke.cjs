// Run npm test first. This creates 29 dummy Line 99 reports in the trial database.
const assert = require('node:assert/strict');
const {randomUUID} = require('node:crypto');
const {initialForm} = require('../.test-build/lkh.js');
(async () => {
 const access = {shareableUrl: process.env.NEON_TRIAL_PREVIEW_URL};
 assert.ok(access.shareableUrl, 'Set NEON_TRIAL_PREVIEW_URL to the protected trial share URL');
 const url = new URL(access.shareableUrl);
 const origin = url.origin;

 const cookies={};
 let destination=access.shareableUrl;
 for(let n=0;n<8;n++) {
  const response=await fetch(destination,{redirect:'manual',headers:{Cookie:Object.entries(cookies).map(([k,v])=>k+'='+v).join('; ')},signal:AbortSignal.timeout(20000)});
  for(const cookie of response.headers.getSetCookie()) {const pair=cookie.split(';')[0];const i=pair.indexOf('=');cookies[pair.slice(0,i)]=pair.slice(i+1);}
  const location=response.headers.get('location');
  if(!location) {console.log('Preview access',response.status); break;}
  destination=new URL(location,destination).href;
 }
 const browser={close:async()=>{}};
 const headers = {'Content-Type':'application/json', Origin:origin,Cookie:Object.entries(cookies).map(([k,v])=>k+'='+v).join('; ')};
 const make = () => ({id:'LKH99-'+randomUUID(),line:'LINE_99',form:{...initialForm,tanggal:new Date(Date.now()-86400000).toISOString().slice(0,10),shift:'1',operator:['OPERATOR TEST A','HELPER TEST B'],mesin:'PRESS DUMMY',part:'BODY_DUMMY-PN99001',jamMulaiProses:'07:30',jamSelesaiProses:'08:00',qtyOk:'100',qtyRepair:'0',qtyReject:'0',lembur:'No'}});
 async function send(p,extra={}) {
  const start=performance.now();
  const r=await fetch(origin+'/api/submissions',{method:'POST',headers:{...headers,...extra},body:JSON.stringify(p),signal:AbortSignal.timeout(30000)});
  let body;try{body=await r.json()}catch{throw Error('Non JSON '+r.status)}
  return {status:r.status,body,serverTiming:r.headers.get("server-timing"),ms:Math.round(performance.now()-start)};
 }
 const master=await fetch(origin+'/api/master',{headers});
 const config=await master.json();
 assert.equal(config.source,'trial');
 assert.deepEqual(Object.keys(config.mapping),['LINE_99']);
 const first=make();const result=await send(first);assert.equal(result.body.ok,true,JSON.stringify(result));
 const retry=await send(first,{'X-LKH-Retry':'1'});assert.deepEqual(retry.body.receipt,result.body.receipt);
 const conflict=await send({...first,form:{...first.form,qtyOk:'101'}});assert.equal(conflict.status,409);assert.equal(conflict.body.clearPending,false);
 const invalid=make();invalid.form.jamSelesaiProses='07:30';assert.equal((await send(invalid)).status,400);
 const production=make();production.line='LINE_1';assert.equal((await send(production)).status,400);
 const reports=Array.from({length:27},make);const burst=await Promise.all(reports.map(p=>send(p)));assert.equal(burst.filter(r=>r.body.ok).length,27);
 const duplicate=make();const duplicates=await Promise.all(Array.from({length:27},()=>send(duplicate)));duplicates.forEach(r=>assert.equal(r.body.ok,true));assert.equal(new Set(duplicates.map(r=>r.body.receipt.receivedAt)).size,1);
 const times=burst.map(r=>r.ms).sort((a,b)=>a-b);
 const results={firstMs:result.ms,firstServer:result.serverTiming,burstServer:burst.map(r=>r.serverTiming),retryMs:retry.ms,burst:{count:27,minMs:times[0],medianMs:times[13],p95Ms:times[25],maxMs:times[26]},sameIdConcurrent:27,expectedUniqueRows:29,ids:[first.id,...reports.map(r=>r.id),duplicate.id],rejectedIds:[invalid.id,production.id]};
 console.log(JSON.stringify({...results,ids:undefined,rejectedIds:undefined})); await browser.close();
})().catch(e=>{console.error(e.message.replace(/_vercel_share=[^&\s]+/g,"_vercel_share=[redacted]"));process.exit(1)});
