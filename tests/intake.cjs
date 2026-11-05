const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const crypto=require('node:crypto');
function setup(){
 const props={},queueRows=[['token'],[],['ID','TYPE','DATE','STATE','ATTEMPTS','ERROR','PAYLOAD']],sourceRows=[['Cap waktu','ID'],[new Date(),'FORM|1|fixed']],settings={busy:false,fail:false};
 const propsApi={getProperty:k=>props[k],setProperty:(k,v)=>{props[k]=v;},deleteProperty:k=>{delete props[k];},getProperties:()=>({...props})};
 function sheet(rows){return {getName:()=> 'responses',getLastRow:()=>rows.length,getLastColumn:()=>rows[0].length,appendRow:r=>{if(settings.fail)throw Error('storage unavailable');rows.push(r);},getRange:(r,c,n=1,w=1)=>({getValues:()=>rows.slice(r-1,r-1+n).map(a=>Array.from({length:w},(_,i)=>a[c-1+i]??'')),getDisplayValues:()=>[rows[0]],setValue:v=>{if(r==='A1')rows[0][0]=v;else rows[r-1][c-1]=v;}})}}
 const queue=sheet(queueRows),source=sheet(sourceRows),ctx={console,Date,JSON,Number,ED19:{queue:'queue'},LKH_NEWEST_OCT6:{header:'ID'},ed19P_:()=>propsApi,ed19SS_:()=>({getSheetByName:()=>queue}),ed19Hash_:s=>crypto.createHash('sha256').update(s).digest('hex'),ed19Source_:()=>({id:'source',name:'responses'}),lkhResolveSubmitRowOct8_:()=>2,ed19EnsureSourceId_:()=>sourceRows[1][1],LockService:{getScriptLock:()=>({tryLock:()=>!settings.busy,releaseLock:()=>{}})},SpreadsheetApp:{flush:()=>{},openById:()=>({getSheetByName:()=>source})},Utilities:{DigestAlgorithm:{SHA_256:'sha256'},computeDigest:(_,s)=>[...crypto.createHash('sha256').update(s).digest()],getUuid:()=>crypto.randomUUID()}};
 vm.createContext(ctx);['LkhIntakeCore.gs','AndonIntakeOct30.gs'].forEach(f=>vm.runInContext(fs.readFileSync('apps-script/'+f,'utf8'),ctx));
 return {ctx,settings,props,queueRows,sourceRows,e:{source:{getId:()=> 'source'},range:{getSheet:()=>source}}};
}
test('Google Form accepts a response exactly once and clears its durable intent',()=>{const f=setup();f.ctx.ed30AcceptForm_(f.e);f.ctx.ed30AcceptForm_(f.e);assert.equal(f.queueRows.length,4);assert.equal(Object.keys(f.props).length,0);});
test('Google Form lock contention retains intent for the worker',()=>{const f=setup();f.settings.busy=true;assert.equal(f.ctx.ed30AcceptForm_(f.e).state,'RECEIVED_PENDING');assert.equal(Object.keys(f.props).length,1);f.settings.busy=false;assert.equal(f.ctx.ed30RecoverPendingIntake_().recovered,1);assert.equal(f.queueRows.length,4);assert.equal(Object.keys(f.props).length,0);});
test('Google Form queue outage is recovered without another response submission',()=>{const f=setup();f.settings.fail=true;assert.throws(()=>f.ctx.ed30AcceptForm_(f.e));assert.equal(Object.keys(f.props).length,1);f.settings.fail=false;assert.equal(f.ctx.ed30RecoverPendingIntake_().recovered,1);assert.equal(f.queueRows.length,4);});
test('recovery follows a stable ID after the source row moves',()=>{const f=setup();f.settings.busy=true;f.ctx.ed30AcceptForm_(f.e);f.settings.busy=false;f.sourceRows.splice(1,0,[new Date(),'other']);assert.equal(f.ctx.ed30RecoverPendingIntake_().recovered,1);assert.equal(JSON.parse(f.queueRows[3][6]).row,3);});
test('removed source is held without inventing or publishing a report',()=>{const f=setup();f.settings.busy=true;f.ctx.ed30AcceptForm_(f.e);f.settings.busy=false;f.sourceRows.pop();assert.equal(f.ctx.ed30RecoverPendingIntake_().held,1);assert.equal(f.queueRows.length,3);assert.equal(Object.keys(f.props).length,1);});
