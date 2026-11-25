const {test}=require('node:test');
const assert=require('node:assert/strict');
const {mirrorRevision}=require('../.test-build/revision-delivery');
const {isLine4Decision}=require('../.test-build/line4-review');
const job={request_id:'test-request',report_id:'test-id',line:'LINE_3',actor:'Leader',reason:'Hitung kembali',
  previous_fields:{qtyOk:'330',lembur:'No'},fields:{qtyOk:'329',lembur:'Yes'},sheet_hash:null};
const detail=(ok='330')=>({workspace:{ok:true,result:{id:job.report_id,line:'LINE_3',hash:'a'.repeat(64),
  fields:[{key:'ok',value:ok},{key:'overtime',value:'No'}]}}});
test('revision mirror pins the source version before sending and reuses the same command after a lost response',async()=>{
  let pinned,previous;
  const call=async(_,body)=>{
    if(body.action==='revisionDetail')return detail();
    assert.equal(pinned,body.payload.expectedHash);
    assert.deepEqual(body.payload.fields,{ok:'329',overtime:'Ya'});
    if(!previous){previous=body;throw Error('timeout');}
    assert.deepEqual(body,previous);
    return {workspace:{ok:true,result:{id:job.report_id,requestId:job.request_id,state:'REQUEST_DONE'}}};
  };
  await assert.rejects(mirrorRevision(job,async x=>{pinned=x;},call),/timeout/);
  assert.equal(await mirrorRevision({...job,sheet_hash:pinned},()=>assert.fail(),call),'APPLIED');
});
test('sheet conflict stops before queuing, queued jobs are distinct from applied jobs',async()=>{
  await assert.rejects(mirrorRevision(job,()=>assert.fail(),async()=>detail('350')),/VERSION_CHANGED/);
  assert.equal(await mirrorRevision({...job,sheet_hash:'a'.repeat(64)},()=>assert.fail(),async()=>({
    workspace:{ok:true,result:{id:job.report_id,requestId:job.request_id,state:'REQUEST_SAVED'}}})),'PENDING');
});
test('pilot decisions require explicit Web App ownership so archived workflows keep their receiver',()=>{
  const id='LKH99-12345678-1234-1234-1234-123456789abc';
  assert.equal(isLine4Decision({id}),false);
  assert.equal(isLine4Decision({id,webPilot:true}),true);
});
