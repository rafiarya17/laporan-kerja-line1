// All API traffic is intercepted. No production targets are submitted.
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const assert=require('node:assert/strict');
const base=process.env.PORTAL_TEST_URL||'http://127.0.0.1:4357';
(async()=>{
 const browser=await chromium.launch({headless:true,channel:'msedge'});
 try{
  const page=await browser.newPage();let writes=[],mode='success',version=0,items=[],release;
  const catalog=[{line:'LINE_99',machine:'AUTO CHAMPER',part:'PIPE A'},{line:'LINE_99',machine:'PRESS DUMMY',part:'BODY_DUMMY-A'}];
  let currentCatalog=catalog;
  await page.route('**/api/**',async r=>{
   const req=r.request(),b=req.postDataJSON()||{};
   const reply=(x,status=200)=>r.fulfill({status,contentType:'application/json',body:JSON.stringify(x)});
   if(new URL(req.url()).pathname!='/api/leader')return reply({});
   if(b.action==='snapshot')return reply({ok:true,data:{date:b.date,shift:b.shift,reportLine:b.line,catalog:currentCatalog,targets:version?[{line:'LINE_99',version,items}]:[],reports:[],requests:[]}});
   assert.equal(b.action,'target');writes.push(b);
   await new Promise(resolve=>{release=resolve;});
   if(mode==='reject')return reply({ok:false,error:'MASTER_SELECTION_INVALID'},409);
   if(mode==='unknown')return reply({ok:false,error:'LEADER_UNCONFIRMED_RETRY_SAME_ID'},503);
   version++;items=b.payload.items;return reply({ok:true,result:{version}});
  });
  await page.goto(base+'/leader?line=LINE_99');await page.locator('#leader').fill('TEST');
  await page.waitForFunction(()=>!document.getElementById('editTargets').disabled);
  await page.locator('#editTargets').click();await page.locator('[data-part]').check();await page.locator('[data-qty]').fill('20');
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
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
