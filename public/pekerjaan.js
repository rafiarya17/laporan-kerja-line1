'use strict';
const element = id => document.getElementById(id);
const params = new URLSearchParams(location.search);
const today = new Intl.DateTimeFormat('en-CA', {timeZone:'Asia/Jakarta', year:'numeric', month:'2-digit', day:'2-digit'}).format(new Date());
element('date').value = /^\d{4}-\d{2}-\d{2}$/.test(params.get('date') || '') ? params.get('date') : today;
element('shift').value = params.get('shift') === '2' ? '2' : '1';
element('source').value = params.get('source') === 'example' ? 'example' : 'leader';
let preferredLine = params.has('line') ? params.get('line') : 'LINE_99';
let preferredMachine = params.has('machine') ? params.get('machine') : 'AUTO CHAMPER';
element('search').value = params.get('part') || '';
let items = [], epoch = 0, controller, plcPilotReady = false;
fetch('/api/champer/capabilities',{cache:'no-store'}).then(r=>r.json()).then(c=>{plcPilotReady=c.enabled===true;render();}).catch(()=>{});
function text(parent, tag, value, className) {
  const node = document.createElement(tag);
  node.textContent = value;
  if (className) node.className = className;
  parent.append(node);
  return node;
}
function examples(date, shift) {
  return [
    ['LINE_99','AUTO CHAMPER','PIPE 1_BLS-E475A-0000-0305',100],
    ['LINE_99','AUTO CHAMPER','PIPE 1_BPA-E4742-0000-0335',60],
    ['LINE_1','PRESS 45 TON','PART-CONTOH-C',200],
    ['LINE_2','TIG WELD 300','PART-CONTOH-D',120],
    ['LINE_3','ROBOT PAN 11','PART-CONTOH-E',160]
  ].map(([line,machine,part,targetQty]) => ({date,shift,line,machine,part,targetQty,version:1,source:'CONTOH'}));
}
function options(id, values, label) {
  const select = element(id), selected = select.value;
  select.replaceChildren(new Option(label, ''));
  for (const value of [...new Set(values)].sort(undefined,{numeric:true})) select.add(new Option(value === 'LINE_99' ? 'Line 99 · Uji' : value.replace('LINE_','Line '), value));
  if (values.includes(selected)) select.value = selected;
}
function filterMachines() {
  options('machine',items.filter(item => !element('line').value || item.line === element('line').value).map(item => item.machine),'Semua mesin');
}
function render() {
  element('leader-link').href = '/leader?' + new URLSearchParams({date:element('date').value,shift:element('shift').value,line:element('line').value || preferredLine || ''});
  const query = element('search').value.trim().toLocaleLowerCase('id-ID');
  const visible = items.filter(item => (!element('line').value || item.line === element('line').value) && (!element('machine').value || item.machine === element('machine').value) && (item.part+' '+item.machine).toLocaleLowerCase('id-ID').includes(query));
  const cards = element('cards');
  cards.replaceChildren();
  element('count').textContent = visible.length + ' pekerjaan';
  element('context').textContent = element('date').value + ' · Shift ' + element('shift').value;
  if (!visible.length) text(cards,'p','Tidak ada target yang cocok. Periksa tanggal, shift, atau filter Anda.','empty');
  for (const item of visible) {
    const card = text(cards,'article','','panel job');
    text(card,'span',(item.line === 'LINE_99' ? 'Line 99 · Uji' : item.line.replace('LINE_','Line '))+' · Shift '+item.shift,'hint');
    text(card,'h3',item.machine);
    text(card,'p',item.part);
    const qty = text(card,'div',Number.isSafeInteger(item.targetQty) ? item.targetQty.toLocaleString('id-ID') : 'Belum diisi','quantity');
    text(qty,'small',' pcs · target OK');
    text(card,'p',(item.source === 'CONTOH' ? 'Contoh simulasi' : 'Target leader')+' · versi '+item.version,'hint');
    const champer = item.machine === 'AUTO CHAMPER' && item.line === 'LINE_99';
    if (champer && Number.isSafeInteger(item.targetQty) && item.targetQty > 0) {
      const link = text(card,'a','Pilih · sesi Champer simulasi','action');
      link.href = '/champer-simulasi.html?from=pekerjaan';
      link.onclick = event => {
        try { sessionStorage.setItem('champer-selected-target',JSON.stringify(item)); }
        catch { event.preventDefault(); element('notice').textContent = 'Pilihan belum dapat disimpan. Izinkan penyimpanan browser, lalu coba lagi.'; }
      };
      if (plcPilotReady && item.source === 'LIVE_READ_ONLY') {
        const live = text(card,'a','Pilih · baca PLC Champer (Line 99 Uji)','action');
        live.href='/champer-plc.html';
        live.onclick=event=>{try{sessionStorage.setItem('champer-selected-target',JSON.stringify(item));}catch{event.preventDefault();element('notice').textContent='Pilihan belum dapat disimpan pada browser.';}};
      }
    } else {
      text(card,'p','Catat hasil melalui form laporan. Pilih mesin dan part ini di dalam form.','hint');
      const link = text(card,'a','Buka form laporan','action');
      link.href = '/';
    }
  }
}
async function load() {
  const current = ++epoch;
  controller?.abort(); controller = new AbortController();
  items = []; options('line',[],'Semua line'); filterMachines(); render();
  element('notice').textContent = '';
  const date = element('date').value, shift = element('shift').value;
  if (!date) { element('notice').textContent = 'Pilih tanggal produksi.'; return; }
  const example = element('source').value === 'example';
  element('source-note').textContent = example ? 'Target contoh untuk mencoba alur beberapa line dan mesin.' : 'Membaca target yang disimpan leader untuk tanggal dan shift terpilih.';
  element('reload').disabled = true;
  try {
    if (example) items = examples(date,shift);
    else {
      element('notice').textContent = 'Memuat target leader…';
      const response = await fetch('/api/leader',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'snapshot',phase:'targets',date,shift,line:''}),signal:AbortSignal.any([controller.signal,AbortSignal.timeout(80000)])});
      const body = await response.json();
      if (current !== epoch) return;
      if (!response.ok || !body.ok) throw Error('Target leader belum dapat dibaca pada alamat ini. Preview dapat diuji melalui sumber Contoh simulasi.');
      if (body.data?.date !== date || String(body.data.shift) !== shift || !Array.isArray(body.data.targets)) throw Error('Konteks target berbeda. Muat ulang untuk membaca tanggal dan shift ini.');
      items = body.data.targets.flatMap(target => (target.items || []).map(item => ({date,shift,line:target.line,machine:item.machine,part:item.part,targetQty:item.targetQty,version:target.version,source:'LIVE_READ_ONLY'})));
      element('notice').textContent = 'Target leader berhasil dimuat.';
    }
    options('line',items.map(item => item.line),'Semua line');
    if (preferredLine) {
      if (![...element('line').options].some(option => option.value === preferredLine)) element('line').add(new Option(preferredLine.replace('LINE_','Line '),preferredLine));
      element('line').value = preferredLine;
    }
    filterMachines();
    if (preferredMachine) {
      if (![...element('machine').options].some(option => option.value === preferredMachine)) element('machine').add(new Option(preferredMachine,preferredMachine));
      element('machine').value = preferredMachine;
    }
    render();
  } catch(error) {
    if (current === epoch) element('notice').textContent = error.message || 'Target gagal dimuat.';
  } finally { if (current === epoch) element('reload').disabled = false; }
}
element('reload').onclick = load;
for (const id of ['date','shift','source']) element(id).onchange = load;
element('line').onchange = () => { preferredLine=element('line').value; preferredMachine=''; filterMachines(); render(); };
element('machine').onchange = () => { preferredMachine=element('machine').value; render(); };
element('search').oninput = render;
load();
