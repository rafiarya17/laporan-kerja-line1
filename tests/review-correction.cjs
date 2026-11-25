const {test}=require('node:test');
const assert=require('node:assert/strict');
const intake=require('../.test-build/sql-intake');
const {initialForm}=require('../.test-build/lkh');
const {approveLine4,webReviewWorkspace}=require('../.test-build/line4-review');
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

test('Web App reports and TF Web readiness come from Neon independently of Sheets delivery',async t=>{
  const form={...initialForm,tanggal:'2026-01-15',shift:'1',operator:['A'],mesin:'M',part:'P',
    jamMulaiProses:'08:00',jamSelesaiProses:'09:00',qtyOk:'10'};
  const received=(id,review,delivery_state,fields={})=>({id,review,delivery_state,hash:'test',payload:{line:'LINE_6',form:{...form,...fields}}});
  const approved={approvedAt:'2026-01-15T02:00:00Z',requestId:'request'};
  const rows=[
    received('waiting',{},'PENDING'),
    received('ready',{...approved,corrected:{qtyOk:'9'}},'PENDING'),
    received('failed-forward',approved,'NEEDS_REVIEW'),
    received('ends-later',approved,'DELIVERED',{tanggal:'2099-01-15'}),
    received('dandori',approved,'DELIVERED',{jenisAktivitas:'DANDORI'}),
    received('bad-time',approved,'DELIVERED',{jamMulaiProses:''}),
  ];
  t.mock.method(intake,'intakeMaster',()=>{throw Error('Must use the cached Neon master');});
  const scopes=[];
  t.mock.method(intake,'sqlDatabase',()=>async (strings,...values)=>{
    if(strings.join('').includes('FROM lkh_master_cache'))return [{mapping:{
      LINE_6:{mesin_part_mapping:{M:{options:['P','__other_option__']}}},
      LINE_99:{mesin_part_mapping:{M:{options:['Test']}}},
    }}];
    scopes.push(values);
    return rows;
  });
  const work=await webReviewWorkspace('2026-01-15','1','LINE_6');
  assert.deepEqual(scopes,[['LINE_6','LINE_6','2026-01-15','1']]);
  assert.deepEqual(work.catalog,[{line:'LINE_6',machine:'M',part:'P'}]);
  assert.deepEqual(work.reports.map(report=>report.state),[
    'WAITING_LEADER','TF_WEB_READY','TF_WEB_READY','WAITING_PROCESS_END','APPROVED','APPROVED',
  ]);
  assert.equal(work.reports[1].input.ok,9);
  assert.equal(work.reports[1].sheetDelivery,'PENDING');
  assert.match(work.reports[2].validation,/Google Sheets/);
  assert.match(work.reports[5].validation,/Jam proses/);
});
