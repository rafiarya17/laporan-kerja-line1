/** Shared intake queue contract for AndonScript and the standalone web receiver.
 * Callers serialize same-ID submissions with their own project's ScriptLock.
 * appendRow is used rather than getLastRow()+setValues so other projects can append.
 * This only accepts STAGE work; approval, revisions and publication stay downstream.
 */
function lkhIntakeQueue_(queue, job) {
  if (!queue || !job || !job.source || !job.id || !Number.isInteger(Number(job.row)) || Number(job.row)<2) throw Error('INTAKE_INVALID_JOB');
  var key=String(job.source)+'|'+String(job.id);
  var digest=Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256,key);
  var jobId='INTAKE-'+digest.map(function(b){return ('0'+((b+256)%256).toString(16)).slice(-2);}).join('');
  var payload=JSON.stringify({source:job.source,row:Number(job.row),id:job.id}),lastError;
  function find(){
    var n=queue.getLastRow(),rows=n>=4?queue.getRange(4,1,n-3,7).getValues():[],found=[],legacy=[];
    rows.forEach(function(r){
      if(r[0]===jobId){found.push(r);return;}
      if(r[1]!=='STAGE')return;
      try{var j=JSON.parse(r[6]);if(j.source===job.source&&j.id===job.id)legacy.push(r);}catch(ignore){}
    });
    if(found.length>1)throw Error('INTAKE_DUPLICATE_JOBS_REVIEW');
    // Revision STAGE jobs legitimately share a report ID. Prefer this intake's
    // exact deterministic ID; otherwise reuse the latest legacy request.
    if(!found.length&&!legacy.length)return null;
    var r=found.length?found[0]:legacy[legacy.length-1],j=JSON.parse(r[6]);
    if(r[1]!=='STAGE'||j.source!==job.source||j.id!==job.id)throw Error('INTAKE_JOB_CONFLICT');
    if(['PENDING','PROCESSING','RETRY','DONE'].indexOf(r[3])<0)throw Error('INTAKE_JOB_NEEDS_REVIEW');
    return String(r[0]);
  }
  for(var attempt=0;attempt<3;attempt++){
    try{
      var existing=find();
      if(!existing){queue.appendRow([jobId,'STAGE',new Date(),'PENDING',0,'',payload,'','']);SpreadsheetApp.flush();existing=find();}
      if(!existing)throw Error('INTAKE_QUEUE_WRITE_UNCONFIRMED');
      queue.getRange('A1').setValue(Utilities.getUuid());SpreadsheetApp.flush();
      return existing;
    }catch(err){
      lastError=err;
      if(/^INTAKE_(DUPLICATE|JOB_CONFLICT|JOB_NEEDS_REVIEW)/.test(String(err.message)))throw err;
    }
  }
  throw lastError || Error('INTAKE_QUEUE_UNCONFIRMED');
}
