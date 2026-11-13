/** Web corrections reuse LEADER_ACTION and the existing central writer lease.
 * Original intake receipts/IDs are immutable. No second worker or polling trigger.
 */
var WR13_FIELDS=[
 ['date','Tanggal Laporan','date'],['shift','Shift','select',['1','2']],
 ['operator','Nama Operator','text'],['machine','Nama Mesin','text'],
 ['start','Jam Mulai Proses','time'],['end','Jam Selesai Proses','time'],
 ['ok','Qty Produksi OK','number'],['repair','Qty Repair','number'],['reject','Qty Reject','number'],
 ['overtime','Apakah laporan ini mencakup lembur?','select',['Ya','Tidak']],
 ['hasIssue','Ada kendala ?','select',['Ya','Tidak']],['issue4m','Kendala 4M','text'],
 ['problem','Permasalahan','text'],['action','Tindakan','text'],['pic','PIC','text'],
 ['issueStart','Jam Mulai Kendala','time'],['issueEnd','Jam Selesai Kendala','time'],
 ['jointCount','Jumlah Sambungan','number']
];
function wr13Enabled_(){if(ed19P_().getProperty('WEB_REVISION_ENABLED')!=='1')throw Error('WEB_REVISION_DISABLED');}
function wr13Hash_(h,v){return ed19Hash_(ed19Pack_([h,v]));}
function wr13Load_(p){
 if(!p||!/^LINE_(?:[1-8]|99)$/.test(p.line||'')||typeof p.id!=='string'||p.id.length>240)throw Error('REVISION_ID_INVALID');
 var allowed=String(ed19P_().getProperty('WEB_REVISION_LINES')||'LINE_99').split(',');if(allowed.indexOf(p.line)<0)throw Error('REVISION_LINE_DISABLED');var s;if(p.line===LINE99.line){s=line99Source_();}else{
 var review=ed19SS_().getSheetByName(ED19.review),ri=lw10Find_(review,20,p.id,7);if(!ri)throw Error('REPORT_NOT_READY');
 var rr=review.getRange(ri,1,1,24).getValues()[0];if(String(rr[3]).replace(/\s+/g,'_')!==p.line||rr[7]!=='PRODUKSI')throw Error('REVISION_SCOPE_INVALID');s=ed19Source_(rr[21]);
 if(s.line!==p.line)throw Error('REVISION_SCOPE_INVALID');
 }
 var sh=SpreadsheetApp.openById(s.id).getSheetByName(s.name),h=sh.getRange(1,1,1,sh.getLastColumn()).getDisplayValues()[0],col=h.indexOf(LKH_NEWEST_OCT6.header);
 if(col<0)throw Error('SOURCE_ID_COLUMN_MISSING');var row=lw10Find_(sh,col+1,p.id);if(!row)throw Error('SOURCE_REMOVED_REQUIRES_REVIEW');
 var v=sh.getRange(row,1,1,h.length).getValues()[0];if(!v[0])throw Error('SOURCE_REMOVED_REQUIRES_REVIEW');
 return {source:s.id,sheet:sh,h:h,v:v,row:row,id:p.id,line:p.line,hash:wr13Hash_(h,v)};
}
function wr13Value_(v,type){if(v instanceof Date)return Utilities.formatDate(v,'Asia/Jakarta',type==='date'?'yyyy-MM-dd':type==='time'?'HH:mm':'yyyy-MM-dd HH:mm:ss');return String(v==null?'':v);}
function wr13Details_(p){
 wr13Enabled_();var x=wr13Load_(p),fields=WR13_FIELDS.filter(function(f){return x.h.indexOf(f[1])>=0;}).map(function(f){var value=wr13Value_(x.v[x.h.indexOf(f[1])],f[2]);if(f[0]==='shift')value=value.replace('SHIFT ','');return {key:f[0],label:f[1],type:f[2],options:f[3]||[],value:value};});
 var parts=x.h.map(function(h,i){return /^Nama Part(?:$|\s)/i.test(h)&&x.v[i]?String(x.v[i]):'';}).filter(Boolean);
 fields.push({key:'part',label:'Nama Part',type:'text',value:parts.join(' | '),options:[]});
 return {ok:true,result:{id:p.id,line:p.line,hash:x.hash,fields:fields}};
}
function wr13Candidate_(x,fields,actor,reason){
 if(!fields||typeof fields!=='object'||Array.isArray(fields))throw Error('REVISION_FIELDS_INVALID');
 var v=x.v.slice(),allowed={part:true},changes=0;
 WR13_FIELDS.forEach(function(f){allowed[f[0]]=true;if(!Object.prototype.hasOwnProperty.call(fields,f[0]))return;var i=x.h.indexOf(f[1]);if(i<0)throw Error('REVISION_SCHEMA_CHANGED');var value=String(fields[f[0]]==null?'':fields[f[0]]).trim();
 if(value.length>1000||/[\x00-\x08\x0b\x0c\x0e-\x1f]/.test(value)||/^[=+@]/.test(value))throw Error('REVISION_TEXT_INVALID');
 // Preserve untouched legacy values (including typed dates/times) exactly.
 var old=wr13Value_(v[i],f[2]);if(f[0]==='shift')old=old.replace('SHIFT ','');if(value===old)return;
 if(f[2]==='date'){lw10ValidateDay_(value,'1');if(value>lw10Day_(new Date()))throw Error('INVALID_PROCESS_TIME');value=new Date(value+'T00:00:00+07:00');}
 if(f[2]==='time'&&value&&!/^([01]\d|2[0-3]):[0-5]\d$/.test(value))throw Error('INVALID_PROCESS_TIME');
 if(f[2]==='number'){if(value===''||!isFinite(Number(value))||Number(value)<0||Number(value)>999999999||x.line!=='LINE_8'&&!Number.isInteger(Number(value)))throw Error('INVALID_QTY');value=Number(value);}
 if(f[2]==='select'&&f[3].indexOf(value)<0)throw Error('REVISION_SELECTION_INVALID');
 v[i]=value;changes++;
 });
 Object.keys(fields).forEach(function(k){if(!allowed[k])throw Error('REVISION_FIELDS_INVALID');});
 var partIndexes=[];x.h.forEach(function(h,i){if(/^Nama Part(?:$|\s)/i.test(h))partIndexes.push(i);});
 if(Object.prototype.hasOwnProperty.call(fields,'part')){var part=String(fields.part).trim(),oldParts=partIndexes.filter(function(i){return !!x.v[i];}).map(function(i){return String(x.v[i]);}).join(' | ');
 if(part!==oldParts){if(!part||part.length>250||/^[=+@-]/.test(part))throw Error('MASTER_SELECTION_INVALID');var machine=String(v[x.h.indexOf('Nama Mesin')]),index=x.h.indexOf('Nama Part — '+machine);if(index<0)index=x.h.indexOf('Nama Part');if(index<0)throw Error('REVISION_PART_COLUMN_MISSING');partIndexes.forEach(function(i){v[i]='';});v[index]=part;changes++;}}
 if(!changes)throw Error('NO_CHANGES');
 var master=lkhNormalizationMasterOct19_();if(x.line===LINE99.line)line99Master_().forEach(function(item){var m={active:true,lineId:LINE99.line,id:item.machineId,name:item.machine};master.machineById[m.id]=m;master.machineByName[lkhV1Key_(m.name)]=m;master.partByKey[m.id+'|'+lkhV1Key_(item.part)]={machineId:m.id,standard:item.part,category:item.category,cycleSeconds:item.ct};});
 var raw=lkhV3RawFromRow_(x.sheet,x.row,v,x.h,master,x.line),record=lkhV1NormalizeRecord_(raw,master);
 if(record[0]!==x.id||record[9]!==x.line||!master.machineById[record[10]]||master.machineById[record[10]].lineId!==x.line)throw Error('REVISION_SCOPE_INVALID');
 if(!raw.operatorName||String(raw.operatorName).length>500||!raw.partName||!lkhV1ResolvePart_(master,record[10],raw.partName))throw Error('MASTER_SELECTION_INVALID');
 if(String(record[40]).split('|').some(function(flag){return flag!=='OK'&&!(x.line===LINE99.line&&flag==='TEST_RECORD');}))throw Error('REVISION_VALIDATION: '+record[40]);
 if(!(record[15] instanceof Date)||!(record[16] instanceof Date)||record[16]<=record[15]||record[16]-record[15]>16*3600000||record[16].getTime()>Date.now()+300000)throw Error('INVALID_PROCESS_TIME');
 if(record[21]+record[22]>0&&!String(raw.problem||'').trim())throw Error('REPAIR_REJECT_NEEDS_ISSUE');
 if(x.line===LINE99.line&&!line99Candidate_({kind:'PRODUKSI',record:record,source:x.source}))throw Error('LINE99_RECORD_BOUNDARY');
 ['Dikoreksi oleh','Alasan koreksi'].forEach(function(name,i){var c=x.h.indexOf(name);if(c>=0)v[c]=i?reason:actor.name;});
 return {values:v,hash:wr13Hash_(x.h,v)};
}
function wr13Queue_(p,actor){
 wr13Enabled_();if(!p||!/^[0-9a-f-]{36}$/i.test(p.requestId||'')||!/^[a-f0-9]{64}$/i.test(p.expectedHash||''))throw Error('INVALID_REQUEST_ID');
 var reason=String(p.reason||'').trim();if(reason.length<5||reason.length>500||/^[=+@-]/.test(reason))throw Error('REASON_REQUIRED');
 var clean={id:p.id,line:p.line,requestId:p.requestId,expectedHash:p.expectedHash,reason:reason,fields:p.fields},requestHash=ed19Hash_({input:clean,actor:actor}),jobId='LEADER-'+p.requestId;
 var lock=LockService.getUserLock();if(!lock.tryLock(1500))throw Error('BUSY_RETRY_SAME_ID');
 try{var q=ed19SS_().getSheetByName(ED19.queue),at=lw10Find_(q,1,jobId,4);if(at){var saved=q.getRange(at,1,1,9).getValues()[0],old=ed19Unpack_(saved[6]);if(old.requestHash!==requestHash)throw Error('REQUEST_ID_CONFLICT');if(saved[3]==='DONE'&&saved[8]){var outcome=JSON.parse(saved[8]);if(outcome.state==='REJECTED')throw Error(outcome.error);}return {state:saved[3]==='DONE'?'REQUEST_DONE':'REQUEST_SAVED',id:p.id,requestId:p.requestId,jobId:jobId};}
 var jobs=lw10Requests_();if(jobs.some(function(j){return j.id===p.id&&['PENDING','RETRY','PROCESSING'].indexOf(j.state)>=0;}))throw Error('REVISION_PENDING');
 if(p.line!==LINE99.line&&!ed29Policy_().hold)throw Error('AUTO_PUBLICATION_DISABLED');var x=wr13Load_(p);if(x.hash!==p.expectedHash)throw Error('VERSION_CHANGED_REFRESH');var next=wr13Candidate_(x,p.fields,actor,reason);
 var job={action:'reviseProduction',input:clean,actor:actor,requestHash:requestHash,jobId:jobId,source:x.source,headers:x.h,before:x.v,after:next.values,afterHash:next.hash};
 if(ed19Pack_(job).length>45000)throw Error('REVISION_TOO_LARGE');
 ed19Append_(q,[jobId,'LEADER_ACTION',new Date(),'PENDING',0,'',ed19Pack_(job),'','']);q.getRange('A1').setValue(Utilities.getUuid());SpreadsheetApp.flush();return {state:'REQUEST_SAVED',id:p.id,requestId:p.requestId,jobId:jobId};
 }finally{lock.releaseLock();}
}
function wr13Process_(j){
 wr13Enabled_();var x=wr13Load_(j.input);
 if(x.hash!==j.input.expectedHash&&x.hash!==j.afterHash)return {state:'REJECTED',error:'VERSION_CHANGED_REFRESH',id:j.input.id};
 if(x.hash!==j.afterHash){
 // Revalidate against current master before any mutation; retries never overwrite a newer source.
 var next;try{next=wr13Candidate_(x,j.input.fields,j.actor,j.input.reason);}catch(e){return {state:'REJECTED',error:String(e.message),id:j.input.id};}
 if(next.hash!==j.afterHash)return {state:'REJECTED',error:'REVISION_SCHEMA_CHANGED',id:j.input.id};
 var latest=x.sheet.getRange(x.row,1,1,x.h.length).getValues()[0];if(wr13Hash_(x.h,latest)!==x.hash)return {state:'REJECTED',error:'VERSION_CHANGED_REFRESH',id:j.input.id};
 x.sheet.getRange(x.row,1,1,x.h.length).setValues([j.after]);SpreadsheetApp.flush();
 }
 var request={id:j.input.id,source:x.source,row:x.row,actor:j.actor.name,reason:j.input.reason};
 ed19Stage_(request);var stage=ed19Central_().getSheetByName(ED19.stage),at=ed19Find_(stage,j.input.id);if(!at)throw Error('REPORT_NOT_READY');var candidate=ed19Unpack_(stage.getRange(at,2).getValue());
 var live=ed19Read_(request);if(live.hash!==candidate.hash)throw Error('VERSION_CHANGED_REFRESH');
 if(x.line===LINE99.line){var review=ed19SS_().getSheetByName(ED19.review),ri=ed19FindReview_(review,x.id);review.getRange(ri,16,1,3).setValues([['SETUJUI',j.actor.name,j.input.reason]]);}
 else if(!ed29DirectMatch_(candidate))throw Error('AUTO_PUBLICATION_DISABLED');
 ed19Publish_({id:x.id,hash:candidate.hash,requestedAt:new Date()});
 return {state:'REVISION_APPLIED',id:x.id,hash:candidate.hash};
}
function setupWebRevisionPilotNov13(){ed19P_().setProperty('WEB_REVISION_LINES','LINE_99');ed19P_().setProperty('WEB_REVISION_ENABLED','1');console.log('Web revision adapter enabled for dummy Line 99 test only.');}
function setupWebRevisionNov13(){ed19P_().setProperty('WEB_REVISION_LINES','LINE_1,LINE_2,LINE_3,LINE_4,LINE_5,LINE_6,LINE_7,LINE_8,LINE_99');ed19P_().setProperty('WEB_REVISION_ENABLED','1');console.log('Web revisions enabled; existing worker reused; no intake or PLC change.');}
