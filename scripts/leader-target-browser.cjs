// All API traffic is intercepted. No production targets are submitted.
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const assert=require('node:assert/strict');
const base=process.env.PORTAL_TEST_URL||'http://127.0.0.1:4357';
(async()=>{
 const browser=await chromium.launch({headless:true,...(process.env.CHROMIUM_PATH?{executablePath:process.env.CHROMIUM_PATH}:{channel:'msedge'})});
 try{
  const page=await browser.newPage();let writes=[],mode='success',version=0,items=[],release;
  const catalog=[{line:'LINE_99',machine:'AUTO CHAMPER',part:'PIPE A'},{line:'LINE_99',machine:'PRESS DUMMY',part:'BODY_DUMMY-A',ct:30}];
  const shift2={version:7,items:[{...catalog[0],targetQty:35},{...catalog[1],targetQty:60,hours:1,plannedCt:60,manualQty:false}]};
  const report={...catalog[0],id:'TEST-LKH',operator:'Operator Uji',state:'PUBLISHED',input:{ok:25,repair:0,reject:0}};
  let currentCatalog=catalog;
  await page.route('**/api/**',async r=>{
   const req=r.request(),b=req.postDataJSON()||{};
   const reply=(x,status=200)=>r.fulfill({status,contentType:'application/json',body:JSON.stringify(x)});
   if(new URL(req.url()).pathname!='/api/leader')return reply({});
   if(b.action==='snapshot'){
    const target=b.shift==='2'?shift2:{version,items};
    return reply({ok:true,data:{date:b.date,shift:b.shift,reportLine:b.line,catalog:currentCatalog,targets:target.version?[{line:'LINE_99',...target}]:[],reports:b.shift==='2'?[report]:[],requests:[]}});
   }
   assert.equal(b.action,'target');writes.push(b);
   await new Promise(resolve=>{release=resolve;});
   if(mode==='reject')return reply({ok:false,error:'MASTER_SELECTION_INVALID'},409);
   if(mode==='unknown')return reply({ok:false,error:'LEADER_UNCONFIRMED_RETRY_SAME_ID'},503);
   if(b.payload.shift==='2'){
    assert.equal(b.payload.expectedVersion,shift2.version);
    shift2.items=b.payload.items;
    return reply({ok:true,result:{version:++shift2.version}});
   }
   assert.equal(b.payload.expectedVersion,version);
   version++;items=b.payload.items;return reply({ok:true,result:{version}});
  });
  await page.goto(base+'/leader?line=LINE_99&shift=1');await page.locator('#leader').fill('TEST');
  await page.waitForFunction(()=>!document.getElementById('editTargets').disabled);
  await page.locator('#editTargets').click();assert.equal(await page.locator('#targetScope').isVisible(),true);await page.locator('[data-part]').check();await page.locator('[data-qty]').fill('20');
  await page.locator('#targetForm button[type=submit]').click();
  await page.waitForFunction(()=>!document.getElementById('targetDialog').open);
  while(!release)await new Promise(r=>setTimeout(r,20));
  assert.match(await page.locator('#pendingList').textContent(),/Mengirim/);release();release=null;
  await page.waitForFunction(()=>document.getElementById('notice').textContent.includes('Tersimpan.'));
  assert.equal(writes.length,1);
  mode='reject';await page.locator('#editTargets').click();await page.locator('[data-qty]').fill('25');await page.locator('#targetReason').fill('Perubahan uji');
  await page.locator('#targetForm button[type=submit]').click();while(!release)await new Promise(r=>setTimeout(r,20));
  assert.equal(await page.locator('#targetDialog').isVisible(),false);release();release=null;
  await page.waitForFunction(()=>document.getElementById('notice').textContent.includes('tidak sesuai master'));
  await page.locator('#editTargets').click();assert.equal(await page.locator('[data-qty]').inputValue(),'25');
  currentCatalog=[catalog[1]];await page.locator('#targetForm button[type=submit]').click();
  await page.waitForFunction(()=>document.getElementById('notice').textContent.includes('Item tidak sesuai master: AUTO CHAMPER'));
  assert.equal(writes.length,2);assert.equal(await page.locator('#targetDialog').isVisible(),false);
  currentCatalog=catalog;mode='unknown';await page.locator('#editTargets').click();await page.locator('#targetForm button[type=submit]').click();while(!release)await new Promise(r=>setTimeout(r,20));release();release=null;
  await page.locator('[data-retry]').waitFor();const unknownId=writes.at(-1).payload.requestId;
  await page.locator('#editTargets').click();await page.locator('#targetForm button[type=submit]').click();
  assert.equal(writes.length,3);assert.equal(await page.locator('#targetDialog').isVisible(),false);
  mode='success';await page.locator('[data-retry]').click();while(!release)await new Promise(r=>setTimeout(r,20));assert.equal(writes.at(-1).payload.requestId,unknownId);release();
  await page.waitForFunction(()=>document.getElementById('notice').textContent.includes('Tersimpan.'));
  console.log('PASS: immediate close, visible pending/success/rejection, retained draft, removed-part guard, unknown request duplicate guard and same-ID retry');

  await page.setViewportSize({width:375,height:812});
  await page.goto(base+'/leader?line=LINE_99');
  const cards=page.locator('#targetList .targetrow');
  const shift2Pipe=cards.filter({hasText:'Shift 2'}).filter({hasText:'PIPE A'});
  const edit=shift2Pipe.getByRole('button',{name:'Revisi / hapus'});
  const dialog=page.getByRole('dialog',{name:'Revisi target shift'});
  await page.evaluate(()=>{
   const date=document.getElementById('date').value;
   window.PortalDraft.set('leader-target:'+date+'|2|LINE_99',{version:7,items:[],reason:'Draf lama yang dibatalkan',zero:true});
  });
  await edit.click();
  assert.ok((await edit.boundingBox()).height>=44);
  assert.equal(await page.locator('#targetShift').inputValue(),'2');
  assert.equal(await page.locator('#targetLine').inputValue(),'LINE_99');
  assert.equal(await dialog.locator('#targetScope').isVisible(),false);
  assert.equal(await dialog.locator('#targetContext').textContent().then(s=>s.endsWith('Shift 2 · LINE 99')),true);
  assert.equal(await dialog.locator('[data-qty]').count(),2);
  const beforeCancel=writes.length;
  for(const close of [
   async()=>dialog.getByRole('button',{name:'Batal',exact:true}).click(),
   async()=>dialog.getByRole('button',{name:'Tutup',exact:true}).click(),
   async()=>page.keyboard.press('Escape'),
  ]){
   await dialog.locator('#clearTargetItems').click();
   await dialog.locator('#targetReason').fill('Perubahan dibatalkan');
   await close();
   await dialog.waitFor({state:'hidden'});
   await edit.click();
   assert.equal(await dialog.locator('[data-qty]').count(),2);
   assert.equal(await dialog.locator('#targetReason').inputValue(),'');
  }
  await dialog.getByRole('button',{name:'Hapus PIPE A'}).click();
  await dialog.getByRole('button',{name:'Batal',exact:true}).click();
  await edit.click();
  assert.equal(await dialog.locator('[data-qty]').count(),2);
  assert.equal(writes.length,beforeCancel);
  const focused=dialog.locator('[data-target-item]:focus [data-qty]');
  assert.equal(await focused.inputValue(),'35');
  await focused.fill('40');
  await dialog.locator('#targetReason').fill('Revisi quantity uji');
  await dialog.locator('#saveTarget').click();
  while(!release)await new Promise(r=>setTimeout(r,20));
  release();release=null;
  await page.waitForFunction(()=>document.getElementById('notice').textContent.includes('Tersimpan.'));
  assert.equal(shift2.items.find(i=>i.part==='PIPE A').targetQty,40);

  await edit.click();
  await dialog.getByRole('button',{name:'Hapus PIPE A'}).click();
  assert.equal(await dialog.locator('[data-qty]').count(),1);
  await dialog.locator('#targetReason').fill('Part batal diproduksi');
  await dialog.locator('#saveTarget').click();
  while(!release)await new Promise(r=>setTimeout(r,20));
  release();release=null;
  await page.waitForFunction(()=>document.getElementById('notice').textContent.includes('Tersimpan.'));
  assert.deepEqual(shift2.items.map(i=>[i.part,i.targetQty,i.plannedCt]),[['BODY_DUMMY-A',60,60]]);
  await shift2Pipe.waitFor({state:'detached'});

  await cards.filter({hasText:'Shift 2'}).getByRole('button',{name:'Revisi / hapus'}).click();
  await dialog.getByRole('button',{name:'Hapus BODY_DUMMY-A'}).click();
  await dialog.locator('#targetReason').fill('Rencana shift dibatalkan');
  const beforeClear=writes.length;
  await dialog.locator('#saveTarget').click();
  assert.equal(writes.length,beforeClear);
  assert.equal(await dialog.isVisible(),true);
  await dialog.locator('#zeroConfirm').check();
  await dialog.locator('#saveTarget').click();
  while(!release)await new Promise(r=>setTimeout(r,20));
  release();
  await page.waitForFunction(()=>document.getElementById('notice').textContent.includes('Tersimpan.'));
  assert.deepEqual(shift2.items,[]);
  assert.equal(items[0].targetQty,25);
  await page.reload();
  await page.getByText(/Shift 2 · LINE 99 · v10.*Tidak ada target/).waitFor();
  await page.locator('[data-tab="reports"]').click();
  assert.match(await page.locator('#reportList').textContent(),/TEST-LKH/);
  console.log('PASS: mobile target editing from both shifts, correct scope, item removal, retained saved CT, confirmation for final removal and retained production report');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
