(function () {
  'use strict';
  // Each destination is a real document. No retained iframe or background module.
  const key = 'berlindo-portal-drafts-v1';
  let drafts = {};
  try { const saved=JSON.parse(sessionStorage.getItem(key) || '{}'); if(saved && typeof saved==='object' && !Array.isArray(saved)) drafts=saved; } catch {}
  function persist() {
    try { sessionStorage.setItem(key, JSON.stringify(drafts)); return true; }
    catch {
      const notice=document.getElementById('notice');
      if(notice){notice.hidden=false;notice.textContent='Draf belum dapat disimpan di browser. Selesaikan penyimpanan sebelum berpindah halaman.';}
      return false;
    }
  }
  window.PortalDraft = {
    get: name => drafts[name],
    set: (name, value) => { drafts[name] = value; return persist(); },
    remove: name => { delete drafts[name]; return persist(); }
  };
  const page = document.body.dataset.portalPage;
  const titles = {dashboard:'Ringkasan Welding', target:'Target leader', laporan:'Pemeriksaan & TF Slip', pekerjaan:'Pekerjaan operator', sesi:'Sesi Champer / tablet', live:'Monitor Live Champer', simulasi:'Latihan simulasi', monitor:'Monitor seluruh mesin', performa:'Performa & hasil'};
  function active() {
    const view = page === 'dashboard' ? (location.hash.slice(1) || 'ringkasan') : page === 'leader' ? (document.querySelector('[data-tab].active')?.dataset.tab === 'reports' ? 'laporan' : 'target') : page;
    document.querySelectorAll('[data-portal-nav]').forEach(a => {
      if (a.dataset.portalNav === view) a.setAttribute('aria-current', 'page');
      else a.removeAttribute('aria-current');
    });
    const label = document.getElementById('portal-page-title');
    if (label) label.textContent = titles[view] || 'Ringkasan Welding';
  }
  function contextLinks() {
    const date = document.getElementById(page === 'dashboard' ? 'start' : 'date');
    const shift = document.getElementById('shift'), line = document.getElementById('line');
    let context={};
    try{context=JSON.parse(sessionStorage.getItem('portal-nav-context')||'{}');if(page==='sesi')context=JSON.parse(sessionStorage.getItem('champer-selected-target')||'null')||context;}catch{}
    if(date?.value)context.date=date.value;
    if(shift?.value && shift.value!=='all')context.shift=shift.value;
    if(line?.value)context.line=line.value;
    try{sessionStorage.setItem('portal-nav-context',JSON.stringify({date:context.date,shift:context.shift,line:context.line}));}catch{}
    document.querySelectorAll('[data-portal-nav="target"],[data-portal-nav="laporan"],[data-portal-nav="pekerjaan"]').forEach(a => {
      const u = new URL(a.href);
      for(const name of ['date','shift','line'])if(context[name])u.searchParams.set(name,context[name]);
      a.href = u.pathname + u.search;
    });
  }
  const button = document.getElementById('portal-menu-toggle');
  button?.addEventListener('click', () => {
    const open = button.getAttribute('aria-expanded') !== 'true';
    button.setAttribute('aria-expanded', String(open));
    document.body.classList.toggle('portal-menu-open', open);
  });
  document.addEventListener('keydown', e => { if (e.key === 'Escape') { document.body.classList.remove('portal-menu-open'); button?.setAttribute('aria-expanded','false'); } });
  document.addEventListener('change', contextLinks);
  document.addEventListener('click', e => { if (e.target.closest('[data-tab]')) active(); });
  window.addEventListener('hashchange', active);
  window.addEventListener('pageshow', () => { active(); contextLinks(); });
  document.addEventListener('portal:ready', () => { active(); contextLinks(); });
  active();
})();
