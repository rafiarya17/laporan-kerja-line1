const {test}=require('node:test');
const assert=require('node:assert/strict');
const intake=require('../.test-build/sql-intake');
const {initialForm}=require('../.test-build/lkh');
const {approveLine4}=require('../.test-build/line4-review');
const {drainSqlDelivery}=require('../.test-build/sql-delivery');

test('a leader correction releases only the corrected report, with safe retries',async t=>{
  const id='LKH-12345678-1234-1234-1234-123456789abc';
  const form={...initialForm,tanggal:'2026-01-15',shift:'1',operator:['A'],mesin:'M',part:'P',
    jamMulaiProses:'08:00',jamSelesaiProses:'09:00',qtyOk:'10',qtyRepair:'0',qtyReject:'0',lembur:'No'};
  const payload={id,line:'LINE_6',form};
  const cmd={id,decision:'approve',reason:'Hitung ulang',requestId:id.slice(4),expectedHash:'a'.repeat(64),fields:{qtyOk:'9'}};
  let review={},delivered=false;
  t.mock.method(intake,'intakeMaster',async()=>({mapping:{LINE_6:{operators:['A'],mesin_part_mapping:{M:{options:['P']}}}}}));
  t.mock.method(intake,'sqlDatabase',()=>async (strings,...values)=>{
    const sql=strings.join('?');
    if(sql.includes('SELECT payload,leader_review'))return [{payload,review}];
    if(sql.includes('SET leader_review=')){
      if(review.approvedAt)return [];
      review={...JSON.parse(values[0]),approvedAt:'now'};return [{id}];
    }
    if(sql.includes('SELECT leader_review AS review'))return [{review,hash:cmd.expectedHash}];
    if(sql.includes('RETURNING id'))return [{id}];
    if(sql.includes('SELECT id,payload,leader_review'))return delivered?[]:[{id,payload,leader_review:review}];
    if(sql.includes("SET delivery_state='DELIVERED'"))delivered=true;
    return [];
  });
  assert.equal((await approveLine4({...cmd,fields:{qtyOk:'-3'}},'Leader')).ok,false);
  assert.equal(review.approvedAt,undefined);
  assert.equal((await approveLine4(cmd,'Leader')).ok,true);
  assert.equal((await approveLine4(cmd,'Leader')).ok,true);
  assert.equal((await approveLine4({...cmd,fields:{qtyOk:'99'}},'Leader')).error,'REQUEST_ID_CONFLICT');
  const sent=[];
  await drainSqlDelivery(55000,async(action,body)=>{
    sent.push(body);return {receipt:{id,mode:'production',state:'QUEUED',receivedAt:new Date().toISOString()}};
  });
  assert.equal(form.qtyOk,'10');
  assert.deepEqual(sent,[{id,line:'LINE_6',form:{...form,qtyOk:'9'}}]);
});
