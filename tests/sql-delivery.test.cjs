const {test}=require('node:test');
const assert=require('node:assert/strict');
const {forwardSqlReport,deliveryNeedsReview}=require('../.test-build/sql-delivery.js');
const {ReceiverError}=require('../.test-build/receiver.js');
const p={id:'LKH-12345678-1234-1234-1234-123456789abc',line:'LINE_1',form:{}};
const valid={id:p.id,mode:'production',state:'QUEUED',receivedAt:'2026-11-13T01:00:00Z'};
test('forward preserves the original ID and payload and confirms only a matching receiver receipt',async()=>{
  assert.deepEqual(await forwardSqlReport(p,async(action,payload)=>{assert.equal(action,'submit');assert.equal(payload,p);return {receipt:valid};}),valid);
});
test('wrong ID, mode, state, or malformed time never marks delivery complete',async()=>{
  for(const patch of [{id:'another-id'},{mode:'test'},{state:'RECEIVED'},{receivedAt:'unknown'}]) {
    await assert.rejects(forwardSqlReport(p,async()=>({receipt:{...valid,...patch}})),e=>e.code==='INVALID_RECEIPT');
  }
});
test('timeout is retained as retryable; conflicts and removed source need review',async()=>{
  await assert.rejects(forwardSqlReport(p,async()=>{throw new ReceiverError('RECEIVER_TIMEOUT');}),e=>e.code==='RECEIVER_TIMEOUT');
  for(const code of ['RECEIVER_TIMEOUT','BUSY_RETRY_SAME_ID','RECEIVER_NETWORK_ERROR','INVALID_RECEIPT']) assert.equal(deliveryNeedsReview(code),false);
  for(const code of ['ID_PAYLOAD_CONFLICT','SOURCE_REMOVED_REQUIRES_REVIEW','INVALID_PROCESS_TIME','SUBMISSION_CANCELLED']) assert.equal(deliveryNeedsReview(code),true);
});
