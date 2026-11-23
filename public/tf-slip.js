'use strict';

const el = id => document.getElementById(id);
const table = document.querySelector('table');
const params = new URLSearchParams(location.search);
const filters = ['date', 'to', 'shift', 'line'];
const number = new Intl.NumberFormat('id-ID', { maximumFractionDigits: 12 });
const day = new Intl.DateTimeFormat('id-ID', { timeZone: 'UTC', day: '2-digit', month: 'short', year: 'numeric' });
const timestamp = new Intl.DateTimeFormat('id-ID', {
  timeZone: 'Asia/Jakarta', day: '2-digit', month: '2-digit', year: 'numeric',
  hour: '2-digit', minute: '2-digit', second: '2-digit'
});
const showDate = iso => day.format(new Date(iso + 'T00:00:00Z'));
const columns = [
  ['date', 'Tanggal produksi', row => showDate(row.date)],
  ['line', 'Line', row => row.line.replace('_', ' ')],
  ['shift', 'Shift', row => row.shift],
  ['machine', 'Mesin', row => row.machine],
  ['part', 'Part', row => row.part],
  ...['ok', 'repair', 'reject'].map((key, i) => [
    key, ['OK', 'Repair', 'Reject'][i],
    row => number.format(row[key]) + (row.line === 'LINE_8' ? (key === 'ok' ? ' batang' : ' mm') : ' pcs')
  ]),
  ['revised', 'Revisi', row => row.revised === true ? 'Ya' : row.revised === false ? 'Tidak' : '—'],
  ['approved', 'Disetujui (WIB)', row => timestamp.format(new Date(row.approved))]
];
const preference = 'berlindo.tf-slip.columns.v2';
let selected = columns.map(([key]) => key);
try {
  const currentPreference = localStorage.getItem(preference);
  const saved = currentPreference === null
    ? JSON.parse(localStorage.getItem('berlindo.tf-slip.columns.v1'))
    : JSON.parse(currentPreference);
  if (currentPreference === null && Array.isArray(saved)) saved.push('revised');
  const known = selected.filter(key => Array.isArray(saved) && saved.includes(key));
  if (known.length) selected = known;
} catch { /* Browser storage is optional. */ }
let rows = null;
let current;

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
  el('print').disabled = !matches.length;
  const visible = columns.filter(([key]) => selected.includes(key));
  const heading = table.tHead.rows[0];
  heading.replaceChildren();
  for (const [, label] of visible) {
    const th = document.createElement('th');
    th.scope = 'col';
    th.textContent = label;
    heading.append(th);
  }
  const body = document.createElement('tbody');
  for (const row of matches) {
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
  for (const input of el('choices').querySelectorAll('input')) {
    input.checked = selected.includes(input.value);
    input.disabled = input.checked && selected.length === 1;
  }
}
for (const [key, name] of columns) {
  const label = document.createElement('label');
  const input = document.createElement('input');
  input.type = 'checkbox';
  input.value = key;
  label.append(input, name);
  el('choices').append(label);
}
syncChoices();
el('choices').addEventListener('change', () => {
  selected = Array.from(el('choices').querySelectorAll('input:checked'), input => input.value);
  syncChoices();
  try { localStorage.setItem(preference, JSON.stringify(selected)); } catch { /* Optional. */ }
  renderTable();
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
el('print').onclick = () => window.print();
load();
