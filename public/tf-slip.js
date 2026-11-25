'use strict';

const el = id => document.getElementById(id);
const table = document.querySelector('table');
const columnGroup = table.querySelector('colgroup');
const params = new URLSearchParams(location.search);
const filters = ['date', 'to', 'shift', 'line'];
const alphabetical = new Intl.Collator('id-ID', { sensitivity: 'base', numeric: true });
const number = new Intl.NumberFormat('id-ID', { maximumFractionDigits: 12 });
const day = new Intl.DateTimeFormat('id-ID', { timeZone: 'UTC', day: '2-digit', month: 'short', year: 'numeric' });
const timestamp = new Intl.DateTimeFormat('id-ID', {
  timeZone: 'Asia/Jakarta', day: '2-digit', month: '2-digit', year: 'numeric',
  hour: '2-digit', minute: '2-digit', second: '2-digit'
});
const showDate = iso => day.format(new Date(iso + 'T00:00:00Z'));
const quantities = [['ok', 'OK'], ['repair', 'Repair'], ['reject', 'Reject']];
const formatQuantity = (row, key, value) =>
  number.format(value) + (row.line === 'LINE_8' ? (key === 'ok' ? ' batang' : ' mm') : ' pcs');

const columns = [
  ['date', 'Tanggal produksi', row => showDate(row.date)],
  ['line', 'Line', row => row.line.replace('_', ' ')],
  ['shift', 'Shift', row => row.shift],
  ['machine', 'Mesin', row => row.machine],
  ['part', 'Part', row => row.part],
  ...quantities.map(([key, label]) => [key, label, row => formatQuantity(row, key, row[key]), 'Total ' + label]),
  ['revised', 'Revisi', row => row.revised === true ? 'Ya' : row.revised === false ? 'Tidak' : '—'],
  ['approved', 'Disetujui (WIB)', row => timestamp.format(new Date(row.approved)), 'Terakhir disetujui (WIB)']
];
const shiftColumns = quantities.flatMap(([key, label]) => ['1', '2'].map(shift => [
  key + shift, label + ' Shift ' + shift, row => formatQuantity(row, key, row.byShift[shift]?.[key] ?? 0)
]));
const allColumns = [...columns.slice(0, -2), ...shiftColumns, ...columns.slice(-2)];
const defaultSelection = columns.map(([key]) => key);
const showingAllShifts = () => el('shift').value === '';
const metricGroups = new Map(quantities.flatMap(([key]) => [
  [key, 'total-metrics'], [key + '1', 'shift-one-metrics'], [key + '2', 'shift-two-metrics']
]));
const defaultWidths = { date: 118, line: 78, shift: 65, machine: 160, part: 230, revised: 77, approved: 164 };
const minWidth = 64, maxWidth = 720;
const widthPreference = 'berlindo.tf-slip.column-widths.v1';
const columnWidths = new Map();
try {
  const saved = JSON.parse(localStorage.getItem(widthPreference));
  for (const [key] of allColumns) {
    const width = saved?.[key];
    if (Number.isInteger(width) && width >= minWidth && width <= maxWidth) columnWidths.set(key, width);
  }
} catch { /* Browser storage is optional. */ }

function updateTableWidth() {
  const width = Array.from(columnGroup.children).reduce((sum, col) => sum + parseInt(col.style.width, 10), 0);
  table.style.setProperty('--table-width', width + 'px');
}

function addColumnResizer(th, col, key, label) {
  const defaultWidth = defaultWidths[key] ?? 98;
  const handle = document.createElement('div');
  handle.className = 'column-resizer screen-only';
  handle.tabIndex = 0;
  handle.setAttribute('role', 'separator');
  handle.setAttribute('aria-orientation', 'vertical');
  handle.setAttribute('aria-label', 'Lebar kolom ' + label);
  handle.setAttribute('aria-valuemin', minWidth);
  handle.setAttribute('aria-valuemax', maxWidth);
  handle.title = 'Seret untuk mengatur lebar. Klik dua kali untuk mengembalikan lebar awal.';
  function applyWidth(width) {
    const clamped = Math.min(maxWidth, Math.max(minWidth, Math.round(width)));
    col.style.width = clamped + 'px';
    handle.setAttribute('aria-valuenow', clamped);
    return clamped;
  }
  let width = applyWidth(columnWidths.get(key) ?? defaultWidth);
  function resize(next) {
    width = applyWidth(next);
    columnWidths.set(key, width);
    updateTableWidth();
  }
  function saveWidths() {
    try { localStorage.setItem(widthPreference, JSON.stringify(Object.fromEntries(columnWidths))); } catch { /* Optional. */ }
  }
  let drag;
  handle.addEventListener('pointerdown', event => {
    if (event.button !== 0 || !event.isPrimary) return;
    event.preventDefault();
    handle.focus({ preventScroll: true });
    handle.setPointerCapture(event.pointerId);
    drag = { id: event.pointerId, x: event.clientX, width };
    handle.dataset.dragging = '';
  });
  handle.addEventListener('pointermove', event => {
    if (drag?.id === event.pointerId) resize(drag.width + event.clientX - drag.x);
  });
  handle.addEventListener('lostpointercapture', () => {
    drag = null;
    delete handle.dataset.dragging;
    saveWidths();
  });
  handle.addEventListener('dblclick', () => { resize(defaultWidth); saveWidths(); });
  handle.addEventListener('keydown', event => {
    const widths = { ArrowLeft: width - 12, ArrowRight: width + 12, Home: defaultWidth };
    if (!Object.hasOwn(widths, event.key)) return;
    event.preventDefault();
    resize(widths[event.key]);
    saveWidths();
  });
  th.append(handle);
}

function summarizeShifts(reports) {
  const groups = new Map();
  for (const report of reports) {
    const id = JSON.stringify([report.date, report.line, report.machine, report.part]);
    if (!groups.has(id)) {
      groups.set(id, { ...report, ok: 0, repair: 0, reject: 0, byShift: {} });
    }
    const group = groups.get(id);
    const breakdown = group.byShift[report.shift] ??= { ok: 0, repair: 0, reject: 0 };
    for (const [key] of quantities) {
      const quantity = Number(report[key]);
      breakdown[key] += quantity;
      group[key] += quantity;
    }
    if (report.revised === true) group.revised = true;
    if (Date.parse(report.approved) > Date.parse(group.approved)) group.approved = report.approved;
  }
  return Array.from(groups.values(), group => ({ ...group, shift: Object.keys(group.byShift).join(' + ') }));
}
const preference = 'berlindo.tf-slip.columns.v2';
let selected = defaultSelection;
try {
  const currentPreference = localStorage.getItem(preference);
  const saved = currentPreference === null
    ? JSON.parse(localStorage.getItem('berlindo.tf-slip.columns.v1'))
    : JSON.parse(currentPreference);
  if (currentPreference === null && Array.isArray(saved)) saved.push('revised');
  const known = allColumns.map(([key]) => key).filter(key => Array.isArray(saved) && saved.includes(key));
  if (defaultSelection.some(key => known.includes(key))) selected = known;
} catch { /* Browser storage is optional. */ }
let rows = null;
let current;
let sort = null;

const shiftOrder = { '1': 1, '2': 2, '1 + 2': 3 };
const sortValues = {
  date: row => Date.parse(row.date),
  line: row => Number(row.line.split('_')[1]),
  shift: row => shiftOrder[row.shift],
  machine: row => row.machine,
  part: row => row.part,
  revised: row => row.revised == null ? null : Number(row.revised),
  approved: row => Date.parse(row.approved)
};
for (const [key] of quantities) {
  sortValues[key] = row => Number(row[key]);
  for (const shift of ['1', '2']) {
    sortValues[key + shift] = row => Number(row.byShift[shift]?.[key] ?? 0);
  }
}
const ascendingFirst = new Set(['line', 'shift', 'machine', 'part']);

function compareSortValues(first, second, direction) {
  const valid = value => typeof value === 'number' ? Number.isFinite(value) : Boolean(value);
  if (!valid(first) || !valid(second)) return Number(valid(second)) - Number(valid(first));
  const difference = typeof first === 'number' ? first - second : alphabetical.compare(first, second);
  return direction === 'ascending' ? difference : -difference;
}

function addSortButton(th, title, key, activeSort) {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'sort-column';
  button.textContent = title;
  button.dataset.sortKey = key;
  const next = activeSort?.key === key
    ? (activeSort.direction === 'ascending' ? 'descending' : 'ascending')
    : (ascendingFirst.has(key) ? 'ascending' : 'descending');
  button.title = 'Urutkan ' + title + (next === 'ascending' ? ' naik' : ' turun');
  button.onclick = () => {
    sort = { key, direction: next };
    renderTable();
    table.querySelector('[data-sort-key="' + key + '"]')?.focus({ preventScroll: true });
  };
  if (activeSort?.key === key) th.setAttribute('aria-sort', activeSort.direction);
  th.append(button);
}

let downloadingPdf = false;
function renderTable() {
  const terms = el('search').value.trim().toLowerCase().split(/\s+/).filter(Boolean);
  const matches = (rows ?? []).filter(row => {
    const text = [row.part, row.machine].join(' ').toLowerCase();
    return terms.every(term => text.includes(term));
  });
  const searchStatus = el('search-status');
  searchStatus.hidden = rows === null || !terms.length;
  searchStatus.textContent = searchStatus.hidden ? '' : matches.length
    ? matches.length + ' dari ' + rows.length + ' laporan cocok.'
    : 'Tidak ada part atau mesin yang cocok dalam filter ini.';
  el('print').disabled = downloadingPdf || !matches.length;
  const allShifts = showingAllShifts();
  const visible = (allShifts ? allColumns : columns).filter(([key]) => selected.includes(key));
  const activeSort = visible.some(([key]) => key === sort?.key) ? sort : null;
  table.tFoot.rows[0].cells[0].colSpan = visible.length;
  const heading = table.tHead.rows[0];
  heading.replaceChildren();
  columnGroup.replaceChildren();
  for (const [key, label, , totalLabel] of visible) {
    const col = document.createElement('col');
    col.dataset.key = key;
    columnGroup.append(col);
    const th = document.createElement('th');
    th.scope = 'col';
    const title = allShifts && totalLabel ? totalLabel : label;
    addSortButton(th, title, key, activeSort);
    addColumnResizer(th, col, key, title);
    heading.append(th);
  }
  updateTableWidth();
  const body = document.createElement('tbody');
  const result = allShifts ? summarizeShifts(matches) : matches;
  if (activeSort) {
    const getValue = sortValues[activeSort.key];
    result.sort((a, b) => compareSortValues(getValue(a), getValue(b), activeSort.direction));
  }
  for (const row of result) {
    const tr = body.insertRow();
    for (const [key, , display] of visible) {
      const cell = tr.insertCell();
      cell.dataset.key = key;
      cell.textContent = display(row);
    }
  }
  table.tBodies[0].replaceWith(body);
  table.hidden = !matches.length;
}

function syncChoices() {
  const allShifts = showingAllShifts();
  el('shift-one-metrics').hidden = !allShifts;
  el('shift-two-metrics').hidden = !allShifts;
  const selectedRegular = defaultSelection.filter(key => selected.includes(key)).length;
  for (const [key, name, , totalLabel] of allColumns) {
    const input = el('choices').querySelector('input[value="' + key + '"]');
    const regular = defaultSelection.includes(key);
    input.checked = selected.includes(key);
    input.disabled = regular && input.checked && selectedRegular === 1;
    input.parentElement.hidden = !regular && !allShifts;
    input.nextElementSibling.textContent = allShifts && totalLabel ? totalLabel : name;
  }
}
for (const [key] of allColumns) {
  const label = document.createElement('label');
  const input = document.createElement('input');
  input.type = 'checkbox';
  input.value = key;
  label.append(input, document.createElement('span'));
  el(metricGroups.get(key) ?? 'info-columns').append(label);
}
el('choices').addEventListener('change', () => {
  selected = Array.from(el('choices').querySelectorAll('input:checked'), input => input.value);
  syncChoices();
  try { localStorage.setItem(preference, JSON.stringify(selected)); } catch { /* Optional. */ }
  renderTable();
});
const menus = Array.from(el('choices').querySelectorAll('details'));
document.addEventListener('click', event => {
  for (const menu of menus) {
    if (!menu.contains(event.target)) menu.open = false;
  }
});
el('choices').addEventListener('keydown', event => {
  if (event.key !== 'Escape') return;
  const menu = event.target.closest('details[open]');
  if (!menu) return;
  event.preventDefault();
  menu.open = false;
  menu.querySelector('summary').focus();
});
for (let i = 1; i <= 8; i++) el('line').add(new Option('Line ' + i, 'LINE_' + i));
el('date').value = params.get('date') || new Date(Date.now() + 7 * 3600000).toISOString().slice(0, 10);
el('to').value = params.get('to') ?? el('date').value;
for (const key of ['line', 'shift']) {
  const value = params.get(key);
  if (Array.from(el(key).options).some(option => option.value === value)) el(key).value = value;
}

async function load() {
  current?.abort();
  const controller = new AbortController();
  current = controller;
  rows = null;
  syncChoices();
  renderTable();
  el('scope').textContent = '';
  el('timing').replaceChildren();
  const from = el('date').value, to = el('to').value;
  el('to').min = from;
  if (!from || !to || to < from) {
    el('summary').textContent = !from || !to ? 'Lengkapi kedua tanggal produksi.' : 'Tanggal akhir harus sama atau sesudah tanggal awal.';
    el('refresh').disabled = false;
    return;
  }
  const query = new URLSearchParams(filters.map(key => [key, el(key).value]));
  el('refresh').disabled = true;
  el('summary').textContent = 'Memuat TF Slip…';
  const start = performance.now();
  try {
    const response = await fetch('/api/tf-slip?' + query, { method: 'POST', cache: 'no-store', signal: controller.signal });
    const data = await response.json();
    if (current !== controller) return;
    if (!response.ok) throw Error(data.error);
    rows = data.rows;
    renderTable();
    const period = from === to ? showDate(from) : showDate(from) + ' – ' + showDate(to);
    el('scope').textContent = [period, el('shift').selectedOptions[0].text, el('line').selectedOptions[0].text].join(' · ');
    el('summary').textContent = (data.preview ? 'Pratinjau dengan data contoh · ' : '') + rows.length + ' laporan siap · ' +
      data.pending + ' menunggu leader · ' + data.waitingEnd + ' menunggu jam selesai' + (data.invalid ? ' · ' + data.invalid + ' perlu diperiksa' : '');
    const duration = document.createElement('span');
    duration.id = 'duration';
    duration.textContent = ' · Dimuat dalam ' + ((performance.now() - start) / 1000).toFixed(2) + ' detik';
    el('timing').append('Data per ' + timestamp.format(new Date(data.asOf)) + ' WIB', duration);
    history.replaceState(null, '', '?' + query);
  } catch (error) {
    if (current === controller) el('summary').textContent = error.message || 'Gagal memuat TF Slip.';
  } finally {
    if (current === controller) el('refresh').disabled = false;
  }
}
for (const key of filters) el(key).onchange = load;
el('refresh').onclick = load;
el('search').addEventListener('input', renderTable);
el('print').onclick = async () => {
  const button = el('print');
  if (button.disabled) return;
  downloadingPdf = button.disabled = true;
  el('pdf-error').hidden = true;
  try {
    const fields = Array.from(table.tHead.rows[0].cells, (cell, index) => ({
      label: cell.querySelector('button').textContent,
      key: columnGroup.children[index].dataset.key,
      width: Number.parseInt(columnGroup.children[index].style.width, 10)
    }));
    const rows = Array.from(table.tBodies[0].rows, row =>
      Array.from(row.cells, cell => cell.textContent));
    const filename = ['TF-Slip', ...new Set([el('date').value, el('to').value])].join('-') + '.pdf';
    const bytes = await buildTfSlipPdf(fields, rows, el('scope').textContent);
    const url = URL.createObjectURL(new Blob([bytes], { type: 'application/pdf' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.append(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 60000);
  } catch (error) {
    console.error('Gagal membuat PDF TF Slip', error);
    el('pdf-error').textContent = 'PDF gagal dibuat. Coba unduh lagi.';
    el('pdf-error').hidden = false;
  } finally {
    downloadingPdf = false;
    button.disabled = table.hidden;
  }
};
load();
