const {test}=require('node:test');
const assert=require('node:assert/strict');
const {publicWeldingMart}=require('../.test-build/welding-mart.js');
const fields='date shift line machine part unit reports ok repair reject plan quality performance eff availability oee'.split(' ');
const date='2026-11-20';
const row=[date,1,1,'PRESS',null,'PCS',0,null,null,null,200,null,null,null,null,null];
const sample={start:date,end:date,captured:date+'T04:00:00Z',fields,machines:[row],parts:[]};

test('Data Mart publishes approved measures and preserves unreported values',()=>{
  const result=publicWeldingMart({...sample,internal:'omitted'});
  assert.equal(result.machines[0][7],null);
  assert.equal(result.machines[0][10],200);
  assert.equal(result.internal,undefined);
});
test('Data Mart rejects schema drift and rows outside Welding',()=>{
  assert.throws(()=>publicWeldingMart({...sample,fields:[...fields,'operator']}));
  assert.throws(()=>publicWeldingMart({...sample,machines:[[...row,'operator']]}));
  const pilot=row.slice();pilot[2]=99;
  assert.throws(()=>publicWeldingMart({...sample,machines:[pilot]}));
});
