// Outbound HTTPS adapter. The sole local mutation is a read-only snapshot request.
import {readFileSync,writeFileSync,renameSync,existsSync,mkdirSync,openSync,fsyncSync,closeSync} from 'node:fs';
import {resolve,dirname,join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash,randomUUID,timingSafeEqual} from 'node:crypto';
import http from 'node:http';
const UUID=/^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/i;
export function validateCommand(c){
 if(!c||!UUID.test(c.id)||!UUID.test(c.lease)||c.readOnly!==true||c.machine!=='AUTO_CHAMPER'||c.tag!=='DXP|Device1|D100'||!['START','END'].includes(c.purpose)||c.localRequestKey!=='CLOUD-'+c.id||c.localTimeoutMs!==30000||!Number.isSafeInteger(c.expiresAt))throw Error('COMMAND_REJECTED');
 return c;
}
export function atomic(file,value){mkdirSync(dirname(file),{recursive:true});const tmp=file+'.tmp';const fd=openSync(tmp,'w',0o600);try{writeFileSync(fd,JSON.stringify(value,null,2));fsyncSync(fd);}finally{closeSync(fd);}renameSync(tmp,file);}
export function loadConfig(root){
 const config=JSON.parse(readFileSync(join(root,'bridge-config.json'),'utf8'));
 if(config.cloudOrigin!=='https://berlindo-lkh.vercel.app'||typeof config.deviceToken!=='string'||config.deviceToken.length<32||!UUID.test(config.sourceId))throw Error('CONFIG_INVALID');
 const local=JSON.parse(readFileSync(config.localConfigPath,'utf8'));
 const key=createHash('sha256').update(resolve(dirname(config.localConfigPath)).toLowerCase()).digest('hex');
 if(local.port!==4331||local.collectorId!==config.collectorId||key!==config.packageKey||typeof local.token!=='string'||local.token.length<32)throw Error('LOCAL_MAPPING_CHANGED');
 return {...config,localBase:'http://127.0.0.1:4331',localToken:local.token};
}
export function adapter({config,fetcher=fetch,journal={},save=()=>{},now=Date.now,instanceId=randomUUID()}){
 async function json(base,path,token,body){const r=await fetcher(base+path,{method:body===undefined?'GET':'POST',headers:{authorization:'Bearer '+token,'content-type':'application/json'},body:body===undefined?undefined:JSON.stringify(body),signal:AbortSignal.timeout(10000),redirect:'error',cache:'no-store'});if(!r.ok)throw Error('HTTP_'+r.status);return r.json();}
 const local=(path,body)=>json(config.localBase,path,config.localToken,body);
 const cloud=(path,body)=>json(config.cloudOrigin,'/api/champer/'+path,config.deviceToken,{...body,sourceId:config.sourceId});
 let busy=false;
 return {async tick(){
  if(busy)throw Error('TICK_ALREADY_RUNNING');busy=true;
  try{
   let ready=false;
   try{
    const health=await local('/health'),caps=await local('/api/v1/capabilities'),summary=await local('/api/v1/summary');
    ready=health.version==='0.5.0'&&health.package_key===config.packageKey&&health.ready===true&&caps.plc_writes===false&&caps.counter_mapping==='D100_ONLY'&&summary.bridge?.active===true&&summary.bridge?.collector_ready===true;
   }catch{}
   const response=await cloud('poll',{instanceId,ready});
   if(!Number.isFinite(response.serverTime)||Math.abs(response.serverTime-now())>5000)throw Error('CLOCK_DIFFERENCE_OVER_5_SECONDS');
   if(!response.command)return {state:ready?'READY':'LOCAL_NOT_READY',delay:15000};
   const c=validateCommand(response.command);
   if(c.expiresAt<=now())return {state:'EXPIRED_NO_READ',delay:5000};
   let item=journal[c.id];
   if(!item){
    if(!ready)return {state:'LOCAL_NOT_READY',delay:5000};
    if(c.expiresAt-now()<35000)return {state:'DEADLINE_TOO_CLOSE_NO_READ',delay:5000};
    item=journal[c.id]={purpose:c.purpose,expiresAt:c.expiresAt,requestKey:c.localRequestKey};save(journal);
   }
   if(item.purpose!==c.purpose||item.expiresAt!==c.expiresAt||item.requestKey!==c.localRequestKey)throw Error('COMMAND_CHANGED');
   if(!item.localId){
    if(!ready)return {state:'LOCAL_NOT_READY',delay:5000};
    if(c.expiresAt-now()<35000)return {state:'DEADLINE_TOO_CLOSE_NO_READ',delay:5000};
    // Retrying this POST returns the same persisted local snapshot, never a new key.
    const capture=await local('/api/v1/snapshot-requests',{request_key:c.localRequestKey,purpose:c.purpose,timeout_ms:30000});
    if(!UUID.test(capture.command_id)||capture.request_key!==c.localRequestKey)throw Error('LOCAL_COMMAND_MISMATCH');
    item.localId=capture.command_id;save(journal);
   }
   const e=item.evidence||await local('/api/v1/snapshot-requests/'+item.localId);
   if(e.command_id!==item.localId||e.request_key!==c.localRequestKey||e.purpose!==c.purpose||e.collector_id!==config.collectorId||e.machine_id!=='AUTO_CHAMPER'||e.tag_id!=='DXP|Device1|D100')throw Error('LOCAL_EVIDENCE_MISMATCH');
   if(e.status==='PENDING')return {state:'READ_PENDING',delay:3000};
   if(!['RECORDED','TIMED_OUT','FAILED','CANCELLED'].includes(e.status))throw Error('LOCAL_STATUS_INVALID');
   // Persist before upload: restart or lost ACK replays the same evidence.
   item.evidence=e;save(journal);
   const ack=await cloud('result',{commandId:c.id,lease:c.lease,evidence:e});
   item.ack=ack;save(journal);
   return {state:ack.accepted?'RESULT_ACKNOWLEDGED':'RESULT_CLOSED',delay:5000};
  }finally{busy=false;}
 }};
}
async function main(){
 const root=dirname(fileURLToPath(import.meta.url));const c=loadConfig(root);const stateFile=join(root,'private','journal.json');
 const journal=existsSync(stateFile)?JSON.parse(readFileSync(stateFile,'utf8')):{};
 let stopping=false,wait=null;
 const lock=http.createServer((req,res)=>{
  const supplied=Buffer.from(req.headers.authorization||''),expected=Buffer.from('Bearer '+c.deviceToken);
  if(req.headers.host!=='127.0.0.1:4349'||supplied.length!==expected.length||!timingSafeEqual(supplied,expected)){res.writeHead(403);return res.end();}
  if(req.method==='POST'&&req.url==='/stop'){stopping=true;if(wait)wait();res.end('STOPPING');}else{res.writeHead(404);res.end();}
 });
 await new Promise((yes,no)=>{lock.once('error',no);lock.listen(4349,'127.0.0.1',yes);});
 const client=adapter({config:c,journal,save:j=>atomic(stateFile,j)});
 process.on('SIGINT',()=>{stopping=true;if(wait)wait();});
 console.log('Penghubung cloud Champer aktif. Hanya baca D100 saat Start/End dari tablet terpasang.');
 let previous='';
 while(!stopping){let delay=15000;try{const r=await client.tick();delay=r.delay;if(r.state!==previous){console.log(new Date().toLocaleTimeString()+' '+r.state);previous=r.state;}}catch(e){const safe=/^[A-Z0-9_]+$/.test(e.message)?e.message:'CONNECTION_UNAVAILABLE';if(safe!==previous){console.log(safe+'; permintaan dan hasil tersimpan, coba lagi otomatis.');previous=safe;}}
  if(!stopping)await new Promise(r=>{const t=setTimeout(()=>{wait=null;r();},delay);wait=()=>{clearTimeout(t);wait=null;r();};});
 }
 await new Promise(r=>lock.close(r));console.log('Penghubung cloud berhenti. API lokal, VB dan Takebishi tetap seperti semula.');
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url))main().catch(e=>{console.error(e.code==='EADDRINUSE'?'Penghubung sudah berjalan atau port khusus sedang dipakai. Tidak membuka instance kedua.':e.message);process.exitCode=1;});
