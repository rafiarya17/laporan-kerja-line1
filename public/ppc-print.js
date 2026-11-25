'use strict';

const $ = id => document.getElementById(id);
const dates = new Intl.DateTimeFormat('id-ID', {dateStyle:'long', timeZone:'Asia/Jakarta'});
const numbers = new Intl.NumberFormat('id-ID', {maximumFractionDigits:2});

// Example plans only. The production reader will supply one snapshot per Work Order revision.
const sampleDay = '2026-11-25';
const exampleRows = [
  {line:'1', machine:'ROLL SAKTI', part:'BODY 2-2_CONTOH-01', activity:'PRODUKSI', normal:4, overtime:2.5, operators:1, qty:2600, notes:''},
  {line:'2', machine:'TIG WELD 300', part:'BODY 1-4_CONTOH-02', activity:'PRODUKSI', normal:6, overtime:1, operators:2, qty:630, notes:'Utamakan batch pertama.'},
  {line:'3', machine:'ROBOT PANASONIC 1', part:'STAY MUFFLER_CONTOH-03', activity:'PRODUKSI', normal:8, overtime:2.5, operators:1, qty:1800, notes:''},
  {line:'4', machine:'ROBOT 5 OTC', part:'BODY 3-1_CONTOH-04', activity:'REPAIR', normal:1.5, operators:1, notes:'Periksa titik las.'},
  {line:'5', machine:'BUFFING', part:'PLATE_CONTOH-05', activity:'PRODUKSI', normal:7, overtime:2, operators:1, qty:540, notes:''},
  {line:'8', machine:'LONG PIPE', part:'PIPE 1_CONTOH-06', activity:'DANDORI', notes:'Siapkan jig shift berikutnya.'},
  {line:'', machine:'Di luar produksi', part:'', activity:'FABRIKASI', normal:2, operators:1, notes:'Perbaikan rak WIP.'},
];
const snapshots = [
  {date:sampleDay, shift:'1', revision:1, rows:[{...exampleRows[0], part:'BODY_CONTOH_REVISI_LAMA'}]},
  {date:sampleDay, shift:'1', revision:2, rows:[...exampleRows.slice(0,4), exampleRows[6]]},
  {date:sampleDay, shift:'2', revision:1, rows:[exampleRows[2], ...exampleRows.slice(4,6)]},
  {date:'2026-11-24', shift:'2', revision:1, rows:exampleRows.slice(0,3)},
];

const columns = [
  {key:'line', label:'Line', fixed:true, kind:'minor'},
  {key:'machine', label:'Mesin / pekerjaan', fixed:true},
  {key:'part', label:'Part', fixed:true},
  {key:'activity', label:'Aktivitas'},
  {key:'normal', label:'Jam normal', kind:'number'},
  {key:'overtime', label:'Jam lembur', kind:'number'},
  {key:'operators', label:'Operator PPC', kind:'number'},
  {key:'qty', label:'Qty ideal', kind:'number'},
  {key:'notes', label:'Catatan PPC'},
];

const visible = new Set(columns.map(c=>c.key));
const lineLabel = value => value==='non-production'?'Di luar produksi':'Line '+value;
const append = (parent, tag, value, className) => {
  const node = document.createElement(tag);
  if (value !== undefined) node.textContent = value;
  if (className) node.className = className;
  parent.append(node);
  return node;
};

function setup() {
  $('date').value = sampleDay;
  for (const value of [...Array.from({length:8}, (_,i)=>String(i+1)), 'non-production']) {
    $('line').add(new Option(lineLabel(value), value));
  }
  for (const column of columns.filter(c=>!c.fixed)) {
    const label = append($('column-list'), 'label', undefined, 'check');
    const input = append(label, 'input');
    input.type = 'checkbox';
    input.checked = true;
    label.append(column.label);
    input.onchange = () => {
      if (input.checked) visible.add(column.key);
      else visible.delete(column.key);
      render();
    };
  }
  for (const id of ['date','shift','line','search']) $(id).addEventListener('input',render);
  $('print').addEventListener('click',()=>window.print());
}

function latestOrders(date, shift) {
  const latest = new Map();
  for (const plan of snapshots) {
    if (plan.date!==date || (shift && plan.shift!==shift)) continue;
    if ((latest.get(plan.shift)?.revision??0)<plan.revision) latest.set(plan.shift,plan);
  }
  return [...latest.values()].sort((a,b)=>Number(a.shift)-Number(b.shift));
}

function cellValue(row, column) {
  const value = row[column.key];
  if (value===undefined || value==='') return '—';
  if (column.key==='line') return lineLabel(value);
  return typeof value==='number'?numbers.format(value):value;
}

function orderTable(order, fields) {
  const section=append($('orders'),'section',undefined,'order');
  const table=append(append(section,'div',undefined,'table-wrap'),'table');
  table.setAttribute('aria-label','Work Order '+order.shift);
  const head=append(table,'thead');
  const title=append(append(head,'tr'),'th','Work Order '+order.shift+' · Shift '+order.shift,'order-title');
  title.colSpan=fields.length;
  append(title,'small','Revisi '+order.revision);
  const labels=append(head,'tr');
  for (const column of fields) {
    append(labels,'th',column.label,column.kind).scope='col';
  }
  const body=append(table,'tbody');
  for (const row of order.rows) {
    const tr=append(body,'tr');
    for (const column of fields) append(tr,'td',cellValue(row,column),column.kind);
  }
  const gap=append(append(append(table,'tfoot',undefined,'print-only'),'tr'),'td');
  gap.colSpan=fields.length;
  gap.setAttribute('aria-hidden','true');
}

function render() {
  const date=$('date').value, shift=$('shift').value, line=$('line').value;
  const query=$('search').value.trim().toLocaleLowerCase('id-ID');
  const fields=columns.filter(c=>visible.has(c.key));
  const plans=latestOrders(date,shift);
  const orders=plans.map(plan=>({...plan,rows:plan.rows.filter(row=>
    (!line || (row.line || 'non-production')===line) &&
    (!query || [row.machine,row.part].some(value=>value.toLocaleLowerCase('id-ID').includes(query)))
  )})).filter(plan=>plan.rows.length);
  $('orders').replaceChildren();
  for (const plan of orders) orderTable(plan,fields);
  const scope=[date?dates.format(new Date(date+'T12:00:00+07:00')):'', shift?'Shift '+shift:'Semua shift', line?lineLabel(line):'Semua line'];
  if (query) scope.push('Pencarian “'+$('search').value.trim()+'”');
  $('print-scope').textContent=scope.filter(Boolean).join(' · ')+' · Data contoh';
  $('print').disabled=!orders.length;
  $('status').textContent=orders.length?orders.reduce((sum,order)=>sum+order.rows.length,0)+' baris pada revisi tersimpan terakhir.'
    :plans.length?'Tidak ada pekerjaan yang cocok dengan filter.':'Belum ada contoh Work Order tersimpan untuk tanggal dan shift ini.';
}

setup();
render();
