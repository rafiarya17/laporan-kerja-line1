/** Standalone receiver. Deploy separately from AndonScript; production is disabled by default.
 * Script properties: RECEIVER_SECRET, RECEIVER_MODE=test|production,
 * MASTER_SPREADSHEET_ID, RECEIPT_SPREADSHEET_ID.
 * Production additionally requires PRODUCTION_ENABLED=1, SOURCES_JSON, PPC_SPREADSHEET_ID.
 * Never delete ledger/source rows to cancel a report; use the existing revision workflow.
 */
function doPost(e) {
  try {
    if (!e || !e.postData || e.postData.contents.length > 30000) throw Error('INVALID_REQUEST');
    var envelope = JSON.parse(e.postData.contents), props = PropertiesService.getScriptProperties();
    var secret = props.getProperty('RECEIVER_SECRET');
    if (!secret || typeof envelope.body !== 'string' || typeof envelope.signature !== 'string') throw Error('UNAUTHORIZED');
    var expected = lkhWebHex_(Utilities.computeHmacSha256Signature(envelope.body, secret));
    var mismatch = expected.length ^ envelope.signature.length;
    for (var i = 0; i < expected.length; i++) mismatch |= expected.charCodeAt(i) ^ (envelope.signature.charCodeAt(i) || 0);
    if (mismatch) throw Error('UNAUTHORIZED');
    var req = JSON.parse(envelope.body), mode = props.getProperty('RECEIVER_MODE') || 'test';
    if (req.mode !== mode || typeof req.timestamp !== 'number' || Math.abs(Date.now() - req.timestamp) > 300000) throw Error('INVALID_ENVELOPE');
    if (req.action === 'master') return lkhWebJson_({ok:true, mode:mode, mapping:lkhWebMaster_(), version:new Date().toISOString()});
    if (req.action === 'lookup') return lkhWebJson_({ok:true, mode:mode, exists:lkhWebLookup_(req.payload,mode)});
    if (req.action !== 'submit') throw Error('UNKNOWN_ACTION');
    var lock = LockService.getScriptLock();
    if (!lock.tryLock(10000)) throw Error('BUSY_RETRY_SAME_ID');
    try { return lkhWebJson_({ok:true, mode:mode, receipt:lkhWebSubmit_(req.payload, mode)}); }
    finally { lock.releaseLock(); }
  } catch (error) {
    // Do not expose workbook contents, payloads, or secrets in errors/logs.
    return lkhWebJson_({ok:false, error:String(error.message || 'REJECTED')});
  }
}
function lkhWebJson_(value) { return ContentService.createTextOutput(JSON.stringify(value)).setMimeType(ContentService.MimeType.JSON); }
function lkhWebHex_(bytes) { return bytes.map(function(b){return ('0'+((b+256)%256).toString(16)).slice(-2);}).join(''); }
function lkhWebActive_(v) { return v === true || String(v).toUpperCase() === 'TRUE'; }
function lkhWebMaster_() {
  var id = PropertiesService.getScriptProperties().getProperty('MASTER_SPREADSHEET_ID');
  if (!id) throw Error('MASTER_NOT_CONFIGURED');
  var ss = SpreadsheetApp.openById(id), ct = ss.getSheetByName('MASTER_CT'), operators = ss.getSheetByName('MASTER_OPERATOR');
  if (!ct || !operators) throw Error('MASTER_SCHEMA_CHANGED');
  var rows = ct.getDataRange().getValues(), h = rows.shift();
  ['ACTIVE','LINE_ID','MACHINE_NAME','PART_NAME_STANDARD','PART_CATEGORY'].forEach(function(k){if(h.indexOf(k)<0)throw Error('MASTER_SCHEMA_CHANGED');});
  var out = {};
  rows.forEach(function(r){
    if (!lkhWebActive_(r[h.indexOf('ACTIVE')])) return;
    var line = String(r[h.indexOf('LINE_ID')]), machine = String(r[h.indexOf('MACHINE_NAME')]).trim(), part = String(r[h.indexOf('PART_NAME_STANDARD')]).trim();
    if (!/^LINE_[1-8]$/.test(line) || !machine || !part) return;
    if (!out[line]) out[line] = {operators:[],mesin_part_mapping:{}};
    if (!out[line].mesin_part_mapping[machine]) out[line].mesin_part_mapping[machine] = {options:[], categories:{}};
    var m = out[line].mesin_part_mapping[machine];
    if (m.options.indexOf(part)<0) m.options.push(part);
    m.categories[part] = String(r[h.indexOf('PART_CATEGORY')] || 'BELUM DIKLASIFIKASI');
  });
  var op = operators.getDataRange().getValues(), oh = op.shift();
  ['AKTIF','NAMA_OPERATOR','LINE_DEFAULT'].forEach(function(k){if(oh.indexOf(k)<0)throw Error('OPERATOR_SCHEMA_CHANGED');});
  var active = op.filter(function(r){return lkhWebActive_(r[oh.indexOf('AKTIF')]) && String(r[oh.indexOf('NAMA_OPERATOR')]).trim();});
  Object.keys(out).forEach(function(line){
    // Default placement sorts first; all active operators remain selectable for cross-line work.
    var sorted = active.slice().sort(function(a,b){return Number(String(b[oh.indexOf('LINE_DEFAULT')]).indexOf(line)>=0)-Number(String(a[oh.indexOf('LINE_DEFAULT')]).indexOf(line)>=0);});
    out[line].operators = sorted.map(function(r){return String(r[oh.indexOf('NAMA_OPERATOR')]).trim();}).filter(function(v,i,a){return a.indexOf(v)===i;});
  });
  if (Object.keys(out).length !== 8) throw Error('MASTER_INCOMPLETE');
  return out;
}
function lkhWebValidate_(p, master) {
  if (!p || !/^LKH-[0-9a-f-]{36}$/i.test(p.id || '') || !Object.prototype.hasOwnProperty.call(master,p.line)) throw Error('INVALID_SUBMISSION');
  var f = p.form, m = f && master[p.line].mesin_part_mapping[f.mesin];
  if (!f || !m || m.options.indexOf(f.part)<0 || !Array.isArray(f.operator) || !f.operator.length) throw Error('INVALID_MASTER_SELECTION');
  if (f.operator.some(function(o){return master[p.line].operators.indexOf(o)<0;}) || f.operator.length!==f.operator.filter(function(o,i,a){return a.indexOf(o)===i;}).length) throw Error('INVALID_OPERATOR');
  Object.keys(f).forEach(function(k){if(k!=='operator' && (typeof f[k]!=='string' || f[k].length>3000))throw Error('INVALID_FIELD');});
  if (!/^\d{4}-\d{2}-\d{2}$/.test(f.tanggal) || ['1','2'].indexOf(f.shift)<0) throw Error('INVALID_DATE_SHIFT');
  var day = Date.parse(f.tanggal+'T00:00:00+07:00');
  if (!isFinite(day) || Utilities.formatDate(new Date(day),'Asia/Jakarta','yyyy-MM-dd')!==f.tanggal || day>Date.now()) throw Error('INVALID_REPORT_DATE');
  if (p.line==='LINE_8' && ['PRODUKSI','DANDORI'].indexOf(f.jenisAktivitas)<0) throw Error('INVALID_ACTIVITY');
  var time = function(t){if(!/^([01]\d|2[0-3]):[0-5]\d$/.test(t||''))throw Error('INVALID_TIME');return Number(t.slice(0,2))*60+Number(t.slice(3));};
  if (p.line==='LINE_8' && f.jenisAktivitas==='DANDORI') {
    time(f.jamMulaiDandori);time(f.jamSelesaiDandori);
    var ds=Date.parse(f.tanggalMulaiDandori+'T'+f.jamMulaiDandori+':00+07:00'),de=Date.parse(f.tanggalSelesaiDandori+'T'+f.jamSelesaiDandori+':00+07:00');
    if (!isFinite(ds)||!isFinite(de)||de<=ds||de>Date.now()+300000||['MULAI BARU','LANJUTAN SHIFT SEBELUMNYA'].indexOf(f.tahapDandori)<0||['SELESAI - SIAP PRODUKSI','BELUM SELESAI - LANJUT SHIFT BERIKUTNYA'].indexOf(f.hasilDandori)<0||!f.catatanDandori.trim()) throw Error('INVALID_DANDORI');
  } else {
    var s=time(f.jamMulaiProses),e=time(f.jamSelesaiProses);
    var start=day+(s+(f.shift==='2'&&s<720?1440:0))*60000,end=day+(e+(f.shift==='2'&&e<720?1440:0))*60000;
    if(end<start&&f.shift==='2')end+=86400000;
    if(end<=start||end-start>57600000||end>Date.now()+300000)throw Error('INVALID_PROCESS_TIME');
    ['qtyOk','qtyRepair','qtyReject'].forEach(function(k){if(!/^\d+(\.\d+)?$/.test(f[k])||Number(f[k])>100000000||(p.line!=='LINE_8'&&Number(f[k])%1!==0))throw Error('INVALID_QTY');});
    if(['Yes','No'].indexOf(f.lembur)<0||['Ada','Tidak'].indexOf(f.kendala)<0)throw Error('INVALID_STATUS');
    if((Number(f.qtyRepair)>0||Number(f.qtyReject)>0)&&f.kendala!=='Ada')throw Error('REPAIR_REJECT_NEEDS_ISSUE');
    if(f.kendala==='Ada'){
      if(['MANUSIA','MESIN','MATERIAL','METODE'].concat(p.line==='LINE_8'?['DANDORY']:[]).indexOf(f.kendala4M)<0||!f.permasalahan.trim()||!f.tindakan.trim()||!f.pic.trim())throw Error('INCOMPLETE_ISSUE');
      var ks=time(f.jamMulaiKendala),ke=time(f.jamSelesaiKendala),delta=(ke-ks+1440)%1440;
      var issueStart=day+ks*60000;while(issueStart<start)issueStart+=86400000;
      if(!delta||issueStart+delta*60000>end)throw Error('INVALID_ISSUE_TIME');
    }
  }
}
function lkhWebFind_(sheet, column, id) {
  if(sheet.getLastRow()<2)return 0;
  var values=sheet.getRange(2,column,sheet.getLastRow()-1,1).getValues(),found=[];
  values.forEach(function(r,i){if(String(r[0])===id)found.push(i+2);});
  if(found.length>1)throw Error('DUPLICATE_ID_REQUIRES_REVIEW');
  return found[0]||0;
}
function lkhWebText_(value) { var s=String(value || ''); return /^[=+\-@\t\r]/.test(s)?"'"+s:s; }
function lkhWebSubmit_(p, mode) {
  var props=PropertiesService.getScriptProperties();
  if(!p||!/^LKH-[0-9a-f-]{36}$/i.test(p.id||'')||!p.form)throw Error('INVALID_SUBMISSION');
  if(mode==='production'&&props.getProperty('PRODUCTION_ENABLED')!=='1')throw Error('PRODUCTION_DISABLED');
  var ledgerId=props.getProperty('RECEIPT_SPREADSHEET_ID');if(!ledgerId)throw Error('LEDGER_NOT_CONFIGURED');
  var ledger=SpreadsheetApp.openById(ledgerId).getSheetByName('WEB_LKH_RECEIPTS');if(!ledger)throw Error('LEDGER_SCHEMA_MISSING');
  // Canonical fixed field order makes retries independent of JSON property ordering.
  var form={};Object.keys(p.form).sort().forEach(function(k){form[k]=p.form[k];});
  var packed=JSON.stringify({line:p.line,form:form}),hash=lkhWebHex_(Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256,packed));
  var row=lkhWebFind_(ledger,1,p.id),saved;
  if(row){saved=ledger.getRange(row,1,1,6).getValues()[0];if(saved[1]!==hash||saved[5]!==mode)throw Error('ID_PAYLOAD_CONFLICT');}
  else{lkhWebValidate_(p,lkhWebMaster_());ledger.appendRow([p.id,hash,packed,'RECEIVED',new Date().toISOString(),mode]);SpreadsheetApp.flush();row=lkhWebFind_(ledger,1,p.id);saved=ledger.getRange(row,1,1,6).getValues()[0];}
  if(mode==='test'){ledger.getRange(row,4).setValue('TEST_SAVED');SpreadsheetApp.flush();return {id:p.id,state:'TEST_SAVED',mode:mode,receivedAt:String(saved[4])};}
  if(saved[3]!=='QUEUED'){
    var sourceMap=JSON.parse(props.getProperty('SOURCES_JSON')||'{}'),source=sourceMap[p.line],ppc=props.getProperty('PPC_SPREADSHEET_ID');
    if(!source||!ppc||source.id===ledgerId||ppc===ledgerId)throw Error('PRODUCTION_CONFIGURATION_INVALID');
    var sh=SpreadsheetApp.openById(source.id).getSheetByName(source.sheet),headers=sh.getRange(1,1,1,sh.getLastColumn()).getDisplayValues()[0],idCol=headers.indexOf('ID LKH (otomatis)')+1;
    if(!idCol)throw Error('SOURCE_ID_COLUMN_MISSING');
    var sourceRow=lkhWebFind_(sh,idCol,p.id);
    if(!sourceRow){
      var values=lkhWebSourceValues_(p,headers);sh.appendRow(values);SpreadsheetApp.flush();sourceRow=lkhWebFind_(sh,idCol,p.id);if(!sourceRow)throw Error('SOURCE_WRITE_UNCONFIRMED');
    }
    var queue=SpreadsheetApp.openById(ppc).getSheetByName('_ANTREAN_ANDON');if(!queue)throw Error('QUEUE_MISSING');
    var jobId='WEB-'+p.id;
    if(!lkhWebFind_(queue,1,jobId))queue.appendRow([jobId,'STAGE',new Date(),'PENDING',0,'',JSON.stringify({source:source.id,row:sourceRow,id:p.id}),'','']);
    queue.getRange('A1').setValue(Utilities.getUuid());SpreadsheetApp.flush();
    ledger.getRange(row,4).setValue('QUEUED');SpreadsheetApp.flush();
  }
  return {id:p.id,state:'QUEUED',mode:mode,receivedAt:String(saved[4])};
}
function lkhWebLookup_(p,mode){
  if(!p||!/^LKH-[0-9a-f-]{36}$/i.test(p.id||'')||!p.form)throw Error('INVALID_SUBMISSION');
  var id=PropertiesService.getScriptProperties().getProperty('RECEIPT_SPREADSHEET_ID');if(!id)throw Error('LEDGER_NOT_CONFIGURED');
  var sh=SpreadsheetApp.openById(id).getSheetByName('WEB_LKH_RECEIPTS'),row=lkhWebFind_(sh,1,p.id);if(!row)return false;
  var form={};Object.keys(p.form).sort().forEach(function(k){form[k]=p.form[k];});
  var hash=lkhWebHex_(Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256,JSON.stringify({line:p.line,form:form}))),saved=sh.getRange(row,1,1,6).getValues()[0];
  if(saved[1]!==hash||saved[5]!==mode)throw Error('ID_PAYLOAD_CONFLICT');return true;
}
function lkhWebSourceValues_(p,headers){
  var f=p.form,fields={'Cap waktu':new Date(),'Tanggal Laporan':new Date(f.tanggal+'T00:00:00+07:00'),'Shift':f.shift,'Nama Operator':f.operator.join(', '),'Nama Mesin':f.mesin,'ID LKH (otomatis)':p.id};
  var aliases={jamMulaiProses:'Jam Mulai Proses',jamSelesaiProses:'Jam Selesai Proses',qtyOk:'Qty Produksi OK',qtyRepair:'Qty Repair',qtyReject:'Qty Reject',kendala:'Ada kendala ?',kendala4M:'Kendala 4M',permasalahan:'Permasalahan',tindakan:'Tindakan',pic:'PIC',jamMulaiKendala:'Jam Mulai Kendala',jamSelesaiKendala:'Jam Selesai Kendala',lembur:'Apakah laporan ini mencakup lembur?',jenisAktivitas:'Jenis Aktivitas',tanggalMulaiDandori:'Tanggal Mulai Dandori',tanggalSelesaiDandori:'Tanggal Selesai Dandori',jamMulaiDandori:'Jam Mulai Dandori',jamSelesaiDandori:'Jam Selesai Dandori',tahapDandori:'Tahap Dandori',hasilDandori:'Hasil Dandori',catatanDandori:'Catatan Dandori'};
  Object.keys(aliases).forEach(function(k){fields[aliases[k]]=f[k]||'';});
  ['qtyOk','qtyRepair','qtyReject'].forEach(function(k){fields[aliases[k]]=f[k]===''?'':Number(f[k]);});
  ['tanggalMulaiDandori','tanggalSelesaiDandori'].forEach(function(k){if(f[k])fields[aliases[k]]=new Date(f[k]+'T00:00:00+07:00');});
  fields['Jumlah Sambungan']=f.jumlahSambungan==='__other_option__'?f.jumlahSambunganLainnya:f.jumlahSambungan;
  var partHeader='Nama Part — '+f.mesin;
  if(headers.indexOf(partHeader)<0)throw Error('PART_COLUMN_MISSING');fields[partHeader]=f.part;
  ['Cap waktu','Tanggal Laporan','Shift','Nama Operator','Nama Mesin','ID LKH (otomatis)',partHeader].forEach(function(k){if(headers.indexOf(k)<0)throw Error('SOURCE_SCHEMA_CHANGED');});
  return headers.map(function(h){var v=Object.prototype.hasOwnProperty.call(fields,h)?fields[h]:'';return typeof v==='string'?lkhWebText_(v):v;});
}
/** Run once in a NEW standalone project. Creates an isolated test ledger; never enables production. */
function setupLkhTestReceiver(){
  var p=PropertiesService.getScriptProperties();
  if(p.getProperty('RECEIVER_MODE')==='production')throw Error('USE_NEW_PROJECT_FOR_TEST');
  if(!p.getProperty('RECEIVER_SECRET'))p.setProperty('RECEIVER_SECRET',Utilities.getUuid()+Utilities.getUuid());
  p.setProperty('RECEIVER_MODE','test');
  if(!p.getProperty('MASTER_SPREADSHEET_ID'))throw Error('SET_MASTER_SPREADSHEET_ID_IN_SCRIPT_PROPERTIES');
  if(!p.getProperty('RECEIPT_SPREADSHEET_ID')){
    var ss=SpreadsheetApp.create('LKH WEB — PENERIMA UJI'),sh=ss.getSheets()[0];sh.setName('WEB_LKH_RECEIPTS');
    sh.appendRow(['ID','PAYLOAD_HASH','PAYLOAD_JSON','STATE','RECEIVED_AT','MODE']);sh.setFrozenRows(1);ss.setSpreadsheetTimeZone('Asia/Jakarta');p.setProperty('RECEIPT_SPREADSHEET_ID',ss.getId());
  }
  console.log('TEST_RECEIVER_READY; secret remains in Script Properties.');
}
