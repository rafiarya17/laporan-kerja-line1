/** Install with LkhIntakeCore.gs. The existing ed19LkhSubmit delegates here.
 * Pending intents contain source pointers only; no periodic source-sheet polling.
 */
function ed30VerifyActiveIntake(){
  if(String(ed19LkhSubmit).indexOf('ed30AcceptForm_')<0||String(ed19Worker).indexOf('ed30RecoverPendingIntake_')<0)throw Error('INTAKE_ENTRYPOINT_NOT_ACTIVE');
  var health=ed30IntakeHealth();if(!health.enabled)throw Error('INTAKE_DISABLED');
  ed29VerifyDirectMode();var worker=ed19Worker();
  console.log('ACTIVE_INTAKE_VERIFIED '+JSON.stringify({health:health,worker:worker,fixtureSubmissions:0}));
}
function ed30AcceptForm_(e){
  var sh=e.range.getSheet(),source=ed19Source_(e.source.getId());
  if(sh.getName()!==source.name)throw Error('LKH_RESPONSE_SHEET_MISMATCH');
  var row=lkhResolveSubmitRowOct8_(e),id=ed19EnsureSourceId_(sh,row);
  SpreadsheetApp.flush();
  var job={source:source.id,row:row,id:id};
  var key='ED30_INTAKE_'+ed19Hash_(source.id+'|'+id),p=ed19P_();
  // Persist before waiting for another submission: lock contention cannot drop it.
  p.setProperty(key,JSON.stringify(job));
  var lock=LockService.getScriptLock();
  if(!lock.tryLock(20000))return {state:'RECEIVED_PENDING',id:id};
  try{
    var request=lkhIntakeQueue_(ed19SS_().getSheetByName(ED19.queue),job);
    p.deleteProperty(key);
    return request;
  }finally{lock.releaseLock();}
}
function ed30RecoverPendingIntake_(){
  var lock=LockService.getScriptLock();if(!lock.tryLock(1))return {busy:true};
  try{
    var p=ed19P_(),all=p.getProperties(),keys=Object.keys(all).filter(function(k){return k.indexOf('ED30_INTAKE_')===0;}).slice(0,10),done=0,held=0;
    if(!keys.length)return {recovered:0,held:0};
    var queue=ed19SS_().getSheetByName(ED19.queue);
    keys.forEach(function(k){try{
      var j=JSON.parse(all[k]),s=ed19Source_(j.source),sh=SpreadsheetApp.openById(s.id).getSheetByName(s.name);
      // Find the same stable ID again: source rows may have moved since submission.
      var h=sh.getRange(1,1,1,sh.getLastColumn()).getDisplayValues()[0],c=h.indexOf(LKH_NEWEST_OCT6.header);
      if(c<0)throw Error('INTAKE_SOURCE_SCHEMA_CHANGED');
      var n=sh.getLastRow(),ids=n>1?sh.getRange(2,c+1,n-1,1).getValues():[],matches=[];
      ids.forEach(function(r,i){if(String(r[0])===j.id)matches.push(i+2);});
      if(matches.length!==1)throw Error('INTAKE_SOURCE_MISSING_OR_DUPLICATED');
      j.row=matches[0];lkhIntakeQueue_(queue,j);p.deleteProperty(k);done++;
    }catch(err){held++;console.error('INTAKE_RECOVERY_HELD '+String(err.message));}});
    return {recovered:done,held:held};
  }finally{lock.releaseLock();}
}
/** Read-only health check. Does not enqueue or publish anything. */
function ed30IntakeHealth(){
  var p=ed19P_().getProperties(),pending=Object.keys(p).filter(function(k){return k.indexOf('ED30_INTAKE_')===0;}).length;
  var result={pendingIntake:pending,enabled:p[ED19.enabled]==='1'};
  console.log('INTAKE_HEALTH '+JSON.stringify(result));return result;
}
/** Real Sheets integration test; queue is in a NEW workbook, never production. */
function ed30VerifyIsolatedIntake(){
  var ss=SpreadsheetApp.create('UJI INTAKE LKH - 30 OCT 2026'),q=ss.getSheets()[0];q.setName('ANTREAN_UJI');
  q.appendRow(['TEST_ONLY']);q.getRange(3,1,1,9).setValues([['ID','TYPE','CREATED','STATE','ATTEMPTS','ERROR','PAYLOAD','FINISHED','RESULT']]);
  function job(id){return {source:'ISOLATED_TEST_SOURCE',row:2,id:id};}
  function check(ok,label){if(!ok)throw Error('ISOLATED_TEST_FAILED: '+label);}
  var a=lkhIntakeQueue_(q,job('TEST_SAME_ID'));check(a===lkhIntakeQueue_(q,job('TEST_SAME_ID'))&&q.getLastRow()===4,'SAME_ID');
  var once=true,facade={getLastRow:function(){return q.getLastRow();},getRange:function(){return q.getRange.apply(q,arguments);},appendRow:function(r){q.appendRow(r);if(once){once=false;throw Error('SIMULATED_LOST_ACK');}}};
  lkhIntakeQueue_(facade,job('TEST_ACK_LOSS'));check(q.getLastRow()===5,'ACK_LOSS');
  var wake=true,wakeup={getLastRow:function(){return q.getLastRow();},appendRow:function(r){q.appendRow(r);},getRange:function(r){if(r==='A1'&&wake){wake=false;return {setValue:function(){throw Error('SIMULATED_WAKEUP_FAILURE');}};}return q.getRange.apply(q,arguments);}};
  lkhIntakeQueue_(wakeup,job('TEST_WAKEUP'));check(q.getLastRow()===6,'WAKEUP');
  q.appendRow(['LEGACY_TEST','STAGE',new Date(),'DONE',1,'',JSON.stringify(job('TEST_LEGACY')),'','']);
  check(lkhIntakeQueue_(q,job('TEST_LEGACY'))==='LEGACY_TEST'&&q.getLastRow()===7,'LEGACY');
  for(var i=0;i<10;i++)lkhIntakeQueue_(q,job('TEST_BURST_'+i));
  var rows=q.getRange(4,1,q.getLastRow()-3,7).getValues(),seen={};
  rows.forEach(function(r){var j=JSON.parse(r[6]);check(j.source==='ISOLATED_TEST_SOURCE','ISOLATION');check(!seen[j.id],'DUPLICATE');seen[j.id]=true;});
  check(rows.length===14,'BURST');
  var result={ok:true,checks:5,jobs:14,duplicates:0,productionWrites:0,url:ss.getUrl()};console.log('ISOLATED_INTAKE_VERIFIED '+JSON.stringify(result));return result;
}
