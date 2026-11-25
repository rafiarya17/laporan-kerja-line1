const {test}=require('node:test');
const assert=require('node:assert/strict');
const {reviewCt}=require('../.test-build/review-ct');
const {initialForm}=require('../.test-build/lkh');
const form={...initialForm,tanggal:'2026-11-24',shift:'1',jamMulaiProses:'08:00',jamSelesaiProses:'10:30',
  qtyOk:'870',qtyRepair:'2',qtyReject:'4'};
const check=(changes={},line='LINE_1',ct=20,spec={})=>reviewCt(line,{...form,...changes},ct,spec,'2026-11-20');
test('876 vs 450 gives 194.7%; exactly 150% has no alert and saved corrections can clear it',()=>{
 const r=check();assert.equal(r.status,'high');assert.equal(r.standard,450);assert.equal(r.percent.toFixed(1),'194.7');
 assert.equal(check({qtyOk:'669'}).status,'normal');
});
test('breaks and issue overlaps are counted once, including Friday and overnight overtime',()=>{
 const x={jamMulaiProses:'10:00',jamSelesaiProses:'14:00',kendala:'Ada',jamMulaiKendala:'10:30',jamSelesaiKendala:'12:30'};
 assert.equal(check(x).operatingMinutes,120);
 assert.equal(check({...x,tanggal:'2026-11-27'}).operatingMinutes,90);
 assert.equal(check({shift:'2',jamMulaiProses:'23:30',jamSelesaiProses:'06:30',kendala:'Ada',jamMulaiKendala:'23:45',jamSelesaiKendala:'01:15'}).operatingMinutes,300);
});
test('Long Pipe converts mm to equivalent rods; missing CT, invalid time and nonproduction stay separate',()=>{
 assert.equal(check({qtyOk:'10',qtyRepair:'3000',qtyReject:'6000'},'LINE_8',150,{lengthMm:6000}).actual,11.5);
 assert.equal(check({},'LINE_8').status,'unavailable');
 assert.equal(check({},'LINE_2',0).status,'unavailable');
 assert.equal(check({jamSelesaiProses:'08:00'}).status,'unavailable');
 assert.equal(check({jenisAktivitas:'DANDORI'}),null);assert.equal(check({},'LINE_99'),null);
 assert.equal(check({},'LINE_1',0,{helper:true}),null);
});
