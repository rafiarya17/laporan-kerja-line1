'use strict';
// Separate revision editor: never enables or changes the Line 99 approval controls.
let webRevision=null,webRevisionEpoch=0;
const webRevisionDialog=document.createElement('dialog');
webRevisionDialog.id='webRevisionDialog';webRevisionDialog.style.width='min(760px,calc(100vw - 24px))';
webRevisionDialog.innerHTML='<div class="dialoghead"><h2>Revisi laporan</h2><button type="button" data-dismiss aria-label="Tutup revisi">Tutup</button></div><p data-context></p><p class="small">Simpan koreksi pada ID laporan yang sama. Pembaruan TF Slip diproses otomatis. Nama pengoreksi dan alasan dicatat.</p><form><fieldset data-fields class="fields"></fieldset><label>Alasan koreksi<textarea name="reason" required minlength="5" maxlength="500"></textarea></label><p data-feedback role="status" aria-live="polite"></p><button class="primary" type="submit">Simpan revisi</button></form>';
document.body.append(webRevisionDialog);
const webRevisionForm=webRevisionDialog.querySelector('form'),webRevisionFields=webRevisionDialog.querySelector('[data-fields]'),webRevisionFeedback=webRevisionDialog.querySelector('[data-feedback]');
webRevisionDialog.querySelector('[data-dismiss]').onclick=()=>webRevisionDialog.close();
webRevisionDialog.addEventListener('close',()=>{webRevisionEpoch++;webRevision=null;});
async function openWebRevision(id){
 const r=data?.reports.find(x=>x.id===id);if(!r||!data.revisionEnabled)return;
 try{actor();}catch(e){notify(e.message,true);return;}
 if(pendingReport(id)){notify('Masih ada permintaan untuk laporan ini. Muat ulang untuk melihat hasilnya.',true);return;}
 const epoch=++webRevisionEpoch;webRevision=null;
 webRevisionDialog.querySelector('[data-context]').textContent=r.line.replace('_',' ')+' · '+r.machine+' · '+r.part+' · '+r.id;
 webRevisionFields.replaceChildren();webRevisionFields.disabled=true;webRevisionForm.querySelector('[type=submit]').disabled=true;webRevisionForm.elements.reason.value='';webRevisionFeedback.textContent='Mengambil versi terbaru laporan…';
 webRevisionDialog.showModal();
 try{
 const response=await api({action:'revisionDetail',payload:{id:r.id,line:r.line}});
 if(epoch!==webRevisionEpoch||!webRevisionDialog.open)return;
 const detail=response.result;if(detail.id!==id||detail.line!==r.line||!Array.isArray(detail.fields))throw Error('Detail laporan tidak sesuai. Muat ulang.');
 webRevision=detail;
 detail.fields.forEach(f=>{
 const label=document.createElement('label');label.textContent=f.label;
 const control=document.createElement(f.type==='select'?'select':'input');control.name=f.key;
 if(f.type==='select'){
  const choices=[...new Set([f.value,...f.options])];choices.forEach(value=>control.add(new Option(value||'—',value)));
 }else{control.type=['number','date','time'].includes(f.type)?f.type:'text';if(f.type==='number'){control.min='0';control.max='999999999';control.step=r.line==='LINE_8'?'any':'1';}else if(f.type==='text')control.maxLength=1000;}
 control.value=f.value;
 if(['date','shift','operator','machine','part','start','end','ok','repair','reject'].includes(f.key))control.required=true;
 if(['machine','part'].includes(f.key)){
  const list=document.createElement('datalist');list.id='revision-'+f.key+'-options';
  [...new Set(data.catalog.filter(m=>m.line===r.line).map(m=>m[f.key]))].forEach(value=>{const o=document.createElement('option');o.value=value;list.append(o);});
  control.setAttribute('list',list.id);label.append(list);
 }
 label.append(control);webRevisionFields.append(label);
 });
 webRevisionFields.disabled=false;webRevisionForm.querySelector('[type=submit]').disabled=false;
 webRevisionFeedback.textContent='Periksa perubahan, lalu isi alasan koreksi. Tidak perlu input ulang sebagai laporan baru.';
 }catch(e){if(epoch===webRevisionEpoch)webRevisionFeedback.textContent=e.message;}
}
webRevisionForm.onsubmit=e=>{
 e.preventDefault();if(!webRevision||!webRevisionForm.reportValidity())return;
 const fields={};for(const f of webRevision.fields)fields[f.key]=webRevisionForm.elements.namedItem(f.key).value;
 const reason=webRevisionForm.elements.reason.value.trim();
 if(!confirm('Simpan revisi laporan ini?\n'+webRevision.id+'\nAlasan: '+reason+'\nTF Slip akan diperbarui pada laporan yang sama.'))return;
 startOperation('reviseProduction',{id:webRevision.id,line:webRevision.line,expectedHash:webRevision.hash,fields,reason});
};

const revisionStyle=document.createElement('style');revisionStyle.textContent='#webRevisionDialog{box-sizing:border-box;max-height:90dvh;overflow:auto}#webRevisionDialog .fields{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:14px;border:0;padding:0;min-width:0}#webRevisionDialog label{min-width:0}#webRevisionDialog input,#webRevisionDialog select,#webRevisionDialog textarea{box-sizing:border-box;max-width:100%;width:100%}#webRevisionDialog [data-context]{overflow-wrap:anywhere}@media(max-width:540px){#webRevisionDialog .fields{grid-template-columns:minmax(0,1fr)}}';document.head.append(revisionStyle);
