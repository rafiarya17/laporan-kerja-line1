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
 label.append(control);webRevisionFields.append(label);
 });
 installRevisionChoices(r,detail);
 webRevisionFields.disabled=false;webRevisionForm.querySelector('[type=submit]').disabled=false;
 webRevisionFeedback.textContent='Periksa perubahan, lalu isi alasan koreksi. Tidak perlu input ulang sebagai laporan baru.';
 }catch(e){if(epoch===webRevisionEpoch)webRevisionFeedback.textContent=e.message;}
}
webRevisionForm.onsubmit=e=>{
 e.preventDefault();if(!webRevision||!webRevisionForm.reportValidity())return;
 const chosenMachine=webRevisionForm.elements.namedItem('machine'),chosenPart=webRevisionForm.elements.namedItem('part');if(!chosenMachine?.value||!chosenPart?.value){webRevisionFeedback.textContent='Pilih mesin dan part terlebih dahulu.';return;}
 const fields={};for(const f of webRevision.fields)fields[f.key]=webRevisionForm.elements.namedItem(f.key).value;
 const reason=webRevisionForm.elements.reason.value.trim();
 if(!confirm('Simpan revisi laporan ini?\n'+webRevision.id+'\nAlasan: '+reason+'\nTF Slip akan diperbarui pada laporan yang sama.'))return;
 startOperation('reviseProduction',{id:webRevision.id,line:webRevision.line,expectedHash:webRevision.hash,fields,reason});
};

const revisionStyle=document.createElement('style');revisionStyle.textContent='#webRevisionDialog{box-sizing:border-box;max-height:90dvh;overflow:auto}#webRevisionDialog .fields{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:14px;border:0;padding:0;min-width:0}#webRevisionDialog label{min-width:0}#webRevisionDialog input,#webRevisionDialog select,#webRevisionDialog textarea{box-sizing:border-box;max-width:100%;width:100%}#webRevisionDialog [data-context]{overflow-wrap:anywhere}@media(max-width:540px){#webRevisionDialog .fields{grid-template-columns:minmax(0,1fr)}}';document.head.append(revisionStyle);

// Explicit searchable menus work inside a modal on desktop and mobile.
function installRevisionChoices(report,detail){
 const original=Object.fromEntries(detail.fields.map(f=>[f.key,f.value]));
 const catalog=(data.catalog||[]).filter(m=>m.line===report.line);
 const machine=webRevisionForm.elements.namedItem('machine'),part=webRevisionForm.elements.namedItem('part');
 if(!machine||!part)return;
 const unique=values=>[...new Set(values.filter(Boolean))].sort((a,b)=>a.localeCompare(b,'id',{numeric:true}));
 const machines=()=>unique([original.machine,...catalog.map(m=>m.machine)]);
 const parts=()=>unique([...(machine.value===original.machine?[original.part]:[]),...catalog.filter(m=>m.machine===machine.value).map(m=>m.part)]);
 const partMenu=revisionChoice(part,'Nama Part',parts);
 revisionChoice(machine,'Nama Mesin',machines,()=>{
  if(!parts().includes(part.value))part.value='';
  partMenu.close();
  webRevisionFeedback.textContent='Mesin dipilih. Periksa dan pilih part yang sesuai sebelum menyimpan.';
 });
}
function revisionChoice(control,title,values,onSelect){
 control.readOnly=true;control.placeholder='Pilih '+title.toLowerCase();
 const wrap=document.createElement('div');wrap.className='revision-choice';control.replaceWith(wrap);wrap.append(control);
 const toggle=document.createElement('button');toggle.type='button';toggle.textContent='Pilih / cari ▾';toggle.setAttribute('aria-label','Pilih atau cari '+title.toLowerCase());toggle.setAttribute('aria-expanded','false');wrap.append(toggle);
 const panel=document.createElement('div');panel.className='revision-choice-panel';panel.hidden=true;
 const search=document.createElement('input');search.type='search';search.placeholder='Ketik untuk mencari '+title.toLowerCase();search.setAttribute('aria-label','Cari '+title.toLowerCase());
 const list=document.createElement('div');list.className='revision-choice-results';
 panel.append(search,list);wrap.append(panel);
 function close(){panel.hidden=true;toggle.setAttribute('aria-expanded','false');}
 function draw(){list.replaceChildren();const query=search.value.trim().toLocaleLowerCase('id');const matches=values().filter(v=>v.toLocaleLowerCase('id').includes(query));
  if(!matches.length){const empty=document.createElement('p');empty.textContent='Tidak ada pilihan yang cocok.';empty.setAttribute('role','status');list.append(empty);}
  matches.forEach(value=>{const item=document.createElement('button');item.type='button';item.textContent=value;item.setAttribute('aria-pressed',String(control.value===value));item.onclick=()=>{control.value=value;control.setCustomValidity('');close();if(onSelect)onSelect(value);control.dispatchEvent(new Event('change',{bubbles:true}));toggle.focus();};list.append(item);});
 }
 function open(){webRevisionFields.querySelectorAll('.revision-choice-panel').forEach(p=>{p.hidden=true;p.parentElement.querySelector('button').setAttribute('aria-expanded','false');});panel.hidden=false;toggle.setAttribute('aria-expanded','true');search.value='';draw();search.focus();}
 toggle.onclick=()=>panel.hidden?open():close();control.onclick=open;search.oninput=draw;
 search.onkeydown=e=>{if(e.key==='ArrowDown'){e.preventDefault();list.querySelector('button')?.focus();}if(e.key==='Enter'){e.preventDefault();list.querySelector('button')?.click();}};
 wrap.addEventListener('keydown',e=>{if(e.key==='Escape'&&!panel.hidden){e.preventDefault();e.stopPropagation();close();toggle.focus();}});
 wrap.addEventListener('focusout',e=>{if(!wrap.contains(e.relatedTarget))close();});
 return {close};
}
revisionStyle.textContent+=`.revision-choice{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:6px;min-width:0}.revision-choice>button{white-space:nowrap;min-height:44px}.revision-choice-panel{grid-column:1/-1;background:#fff;border:1px solid #aabfbd;border-radius:10px;padding:8px;min-width:0}.revision-choice-panel[hidden]{display:none}.revision-choice-results{max-height:230px;overflow-y:auto;overscroll-behavior:contain}.revision-choice-results button{display:block;text-align:left;width:100%;white-space:normal;overflow-wrap:anywhere;min-height:44px;margin-top:4px}.revision-choice-results button[aria-pressed=true]{background:#d9eeea}.revision-choice-results button:focus-visible{outline:3px solid #087f8c;outline-offset:-3px}`;
