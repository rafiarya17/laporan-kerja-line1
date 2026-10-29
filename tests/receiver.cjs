const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const crypto = require('node:crypto');
const {initialForm} = require('../.test-build/lkh.js');
class Sheet {
  constructor(rows){this.rows=rows;this.failAppend=false;}
  getLastRow(){return this.rows.length;}
  getLastColumn(){return this.rows[0].length;}
  getRange(row,col,n=1,w=1){
    if(typeof row==='string'){assert.equal(row,'A1');row=1;col=1;}
    return {getValues:()=>Array.from({length:n},(_,i)=>Array.from({length:w},(_,j)=>this.rows[row+i-1]?.[col+j-1]??'')),getDisplayValues:()=>Array.from({length:n},(_,i)=>Array.from({length:w},(_,j)=>String(this.rows[row+i-1]?.[col+j-1]??''))),setValue:v=>{this.rows[row-1]??=[];this.rows[row-1][col-1]=v;}};
  }
  appendRow(r){if(this.failAppend)throw Error('simulated write failure');this.rows.push(r);}
}
function fixture(mode='test'){
  const props={RECEIVER_SECRET:'test-only-key',RECEIVER_MODE:mode,RECEIPT_SPREADSHEET_ID:'ledger',PRODUCTION_ENABLED:'1',SOURCES_JSON:JSON.stringify({LINE_1:{id:'source',sheet:'responses'}}),PPC_SPREADSHEET_ID:'ppc'};
  const ledger=new Sheet([['ID','HASH','PAYLOAD','STATE','AT','MODE']]);
  const source=new Sheet([['Cap waktu','Tanggal Laporan','Shift','Nama Operator','Nama Mesin','ID LKH (otomatis)','Nama Part — PRESS','Qty Produksi OK','Jam Mulai Proses','Jam Selesai Proses']]);
  const queue=new Sheet([['token'],[''],['ID','TYPE','AT','STATE','ATTEMPTS','ERROR','PAYLOAD']]);
  const opened=[];
  const ctx={console,Date,JSON,PropertiesService:{getScriptProperties:()=>({getProperty:k=>props[k]??null})},SpreadsheetApp:{openById:id=>{opened.push(id);return {getSheetByName:()=>({ledger,source,ppc:queue}[id])};},flush:()=>{}},Utilities:{computeHmacSha256Signature:(body,key)=>[...crypto.createHmac('sha256',key).update(body).digest()],computeDigest:(_,s)=>[...crypto.createHash('sha256').update(s).digest()],DigestAlgorithm:{SHA_256:'sha256'},getUuid:()=>crypto.randomUUID(),formatDate:d=>new Date(+d+7*3600000).toISOString().slice(0,10)},ContentService:{MimeType:{JSON:'application/json'},createTextOutput:s=>({setMimeType:()=>JSON.parse(s)})},LockService:{getScriptLock:()=>({tryLock:()=>true,releaseLock:()=>{}})}};
  vm.createContext(ctx);vm.runInContext(fs.readFileSync('apps-script/LkhReceiver.gs','utf8'),ctx);
  ctx.lkhWebMaster_=()=>({LINE_1:{operators:['Operator A'],mesin_part_mapping:{PRESS:{options:['PART A']}}}});
  const payload={id:'LKH-12345678-1234-1234-1234-123456789abc',line:'LINE_1',form:{...initialForm,tanggal:'2020-01-01',shift:'1',mesin:'PRESS',part:'PART A',operator:['Operator A'],jamMulaiProses:'07:30',jamSelesaiProses:'16:30',qtyOk:'123',qtyRepair:'0',qtyReject:'0',lembur:'No'}};
  const request=(action,p=payload,sign=true)=>{const body=JSON.stringify({action,payload:p,mode,timestamp:Date.now()});return ctx.doPost({postData:{contents:JSON.stringify({body,signature:sign?crypto.createHmac('sha256',props.RECEIVER_SECRET).update(body).digest('hex'):'wrong'})}});};
  return {ctx,props,ledger,source,queue,opened,payload,request};
}
test('unsigned requests cannot read master or write ledger',()=>{const f=fixture();assert.equal(f.request('submit',f.payload,false).ok,false);assert.equal(f.opened.length,0);});
test('test submissions have durable receipts and never open source or PPC',()=>{const f=fixture();const r=f.request('submit');assert.equal(r.ok,true);assert.equal(r.receipt.state,'TEST_SAVED');assert.equal(f.ledger.rows.length,2);assert.deepEqual([...new Set(f.opened)],['ledger']);});
test('repeated same ID returns same receipt without appending; altered payload conflicts',()=>{const f=fixture();const a=f.request('submit');const b=f.request('submit');assert.deepEqual(a,b);assert.equal(f.ledger.rows.length,2);f.payload.form.qtyOk='124';assert.equal(f.request('submit').ok,false);assert.equal(f.ledger.rows.length,2);});
test('production creates one source and one queue job across repeated submissions',()=>{const f=fixture('production');assert.equal(f.request('submit').receipt.state,'QUEUED');assert.equal(f.request('submit').receipt.state,'QUEUED');assert.equal(f.source.rows.length,2);assert.equal(f.queue.rows.length,4);const job=JSON.parse(f.queue.rows[3][6]);assert.equal(job.id,f.payload.id);assert.equal(job.row,2);});
test('partial failure after source write resumes without duplicating source',()=>{const f=fixture('production');f.queue.failAppend=true;assert.equal(f.request('submit').ok,false);assert.equal(f.source.rows.length,2);f.queue.failAppend=false;assert.equal(f.request('submit').receipt.state,'QUEUED');assert.equal(f.source.rows.length,2);assert.equal(f.queue.rows.length,4);});
test('committed receipt survives master changes and lost acknowledgement',()=>{const f=fixture('production');const first=f.request('submit');f.ctx.lkhWebMaster_=()=>{throw Error('master unavailable');};assert.equal(f.request('lookup').exists,true);assert.deepEqual(f.request('submit'),first);});
test('production is blocked unless explicitly enabled',()=>{const f=fixture('production');delete f.props.PRODUCTION_ENABLED;assert.equal(f.request('submit').ok,false);assert.equal(f.source.rows.length,1);assert.equal(f.queue.rows.length,3);});
test('spreadsheet free-text cannot execute as formula',()=>{const f=fixture();assert.equal(f.ctx.lkhWebText_('=IMPORTXML("url")'),"'=IMPORTXML(\"url\")");});
