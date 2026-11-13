// Read-only production smoke: no pairing, Start/End, target or report writes.
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const fs=require('node:fs'),assert=require('node:assert/strict');
const base=process.env.PORTAL_TEST_URL||'https://berlindo-lkh.vercel.app';
(async()=>{
 const browser=await chromium.launch({headless:true,channel:'msedge'});
 try {
  const page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[],blocked=[],checks=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.route('**/api/**',r=>{
   const q=r.request();let body={};try{body=q.postDataJSON()||{};}catch{}
   if(!['GET','HEAD'].includes(q.method())&&!(new URL(q.url()).pathname==='/api/leader'&&body.action==='snapshot')){blocked.push(new URL(q.url()).pathname);return r.abort();}
   return r.continue();
  });
  await page.goto(base+'/portal.html',{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>document.getElementById('catalog-state').textContent.includes('Master tersambung'),null,{timeout:60000});
  await page.locator('#line').selectOption('LINE_99');await page.locator('#load-results').click();
  await page.waitForFunction(()=>!document.getElementById('load-results').disabled,null,{timeout:180000});
  assert.match(await page.locator('#load-state').textContent(),/lengkap/);checks.push('live master and complete Line99 report period');
  await page.screenshot({path:'verification/portal-native-online.png'});
  for(const [nav,path,selector] of [['target','/leader','#targetList'],['laporan','/leader','#reportList'],['pekerjaan','/pekerjaan.html','#cards'],['sesi','/champer-plc.html','#pair-panel'],['live','/monitor-live.html','main']]){
   await page.locator('[data-portal-nav="'+nav+'"]').click();await page.waitForURL(u=>u.pathname===path);await page.locator(selector).waitFor({state:'attached'});
   assert.equal(await page.locator('iframe').count(),0);assert.equal(page.frames().length,1);checks.push(nav+' direct document');
  }
  await page.goto(base+'/champer-simulasi.html');assert.equal(await page.locator('.portal-nav').count(),1);assert.equal(await page.locator('iframe').count(),0);checks.push('simulation separate and shares navigation');
  await page.goto(base+'/');await page.locator('form').waitFor();checks.push('manual LKH separate');
  assert.deepEqual(blocked,[]);assert.deepEqual(errors,[]);
  fs.writeFileSync('verification/portal-native-online.json',JSON.stringify({passed:true,checkedAt:new Date().toISOString(),checks,blocked,errors,readOnly:true},null,2));
  console.log(JSON.stringify({passed:true,checks,blocked,errors,readOnly:true},null,2));
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
