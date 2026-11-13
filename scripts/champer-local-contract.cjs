// Uses the shipped v0.5 store in memory only. No running API or collector touched.
const {pathToFileURL}=require('node:url');const path=require('node:path');const {randomUUID}=require('node:crypto');const assert=require('node:assert/strict');const fs=require('node:fs');const core=require('../.test-build/champer-core.js');
(async()=>{
 const source=process.argv[2];if(!source)throw Error('Pass path to the v0.5 core.mjs');
 const {openStore}=await import(pathToFileURL(path.resolve(source)));let now=Date.now();const collector='ISOLATED-CONTRACT';const store=openStore(':memory:',{collectorId:collector,now:()=>now});
 try{const s=core.initialState();const j=core.operatorAction(s,{action:'prepare',requestId:randomUUID(),target:{date:'2026-11-11',shift:'1',line:'LINE_99',machine:'AUTO CHAMPER',part:'TEST',version:1,targetQty:100},operators:['Example']},now);const owner=randomUUID();let sequence=0;
 for(const [action,value] of [['start','7229'],['end','7234']]){
 core.poll(s,owner,'test',true,now);core.operatorAction(s,{action,requestId:randomUUID(),jobId:j.id,revision:j.revision},now);const c=core.poll(s,owner,'test',true,now);
 const input={request_key:c.localRequestKey,purpose:c.purpose,timeout_ms:c.localTimeoutMs};const local=store.createSnapshot(input);assert.equal(store.createSnapshot(input).command_id,local.command_id);now+=1000;sequence++;
 store.accept({schema_version:'plc-counter-v1',event_id:collector+':'+sequence,collector_id:collector,sequence:String(sequence),machine_id:'AUTO_CHAMPER',tag_id:'DXP|Device1|D100',event_type:'SNAPSHOT',observed_at:new Date(now).toISOString(),counter_raw:value,read_status:'READ_OK',quality:'UNKNOWN',source_timestamp:'',reset_marker:'',command_id:local.command_id});
 const e=store.getSnapshot(local.command_id);assert.equal(e.status,'RECORDED');assert.equal(core.result(s,{commandId:c.id,lease:c.lease,evidence:e},now,collector).accepted,true);now+=1000;
 }
 assert.equal(j.delta,'5');assert.equal(j.state,'END_CAPTURED');assert.equal(j.production_usable,false);
 const evidence={passed:true,localStore:'API v0.5, in-memory SQLite',counterStart:'7229',counterEnd:'7234',candidateDelta:'5',PLC:false,network:false,sourceFreshness:'UNVERIFIED'};fs.writeFileSync(path.join(__dirname,'../verification/champer-local-contract.json'),JSON.stringify(evidence,null,2));console.log(JSON.stringify(evidence));
 }finally{store.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
