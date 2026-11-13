const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const assert=require('node:assert/strict'),fs=require('node:fs');
const base=process.env.PORTAL_TEST_URL||'http://127.0.0.1:4357';
(async()=>{
 const browser=await chromium.launch({headless:true,channel:'msedge'});
 try {
  const page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[],checks=[],writes=[];
  page.on('pageerror',e=>errors.push(e.message));
  const mapping={LINE_1:{operators:['OP Contoh'],mesin_part_mapping:{}},LINE_99:{operators:['OP Uji'],mesin_part_mapping:{'AUTO CHAMPER':{options:['PIPE-UJI']}}}};
  for(let i=1;i<=8;i++)mapping.LINE_1.mesin_part_mapping['MESIN '+i]={options:['PART-A']};
  let jobs=[],paired=false,failPeriod=false,version=1,quantity=100,telemetryCalls=0,reportState='WAITING_LEADER',loseStart=false;
  const catalog=[{line:'LINE_99',machine:'AUTO CHAMPER',machineId:'CHAMPER_UJI',part:'PIPE-UJI'},{line:'LINE_1',machine:'MESIN 1',machineId:'PRESS',part:'PART-A'}];
  await page.route('**/api/**',async route=>{
   const req=route.request(),p=new URL(req.url()).pathname,b=req.method()==='POST'?req.postDataJSON():{},reply=(d,status=200)=>route.fulfill({status,contentType:'application/json',body:JSON.stringify(d)});
   if(p==='/api/master')return reply({mapping,ready:true,source:'live',version:'TEST'});
   if(p==='/api/leader'){
    if(b.action==='target'){writes.push(b);version++;quantity=b.payload.items[0].targetQty;return reply({ok:true,result:{version}});}
    if(['decide','decideBatch'].includes(b.action)){writes.push(b);reportState=b.payload.decision==='hold'?'HELD':'PUBLISHED';return reply({ok:true,result:{id:b.payload.id}});}
    if(b.action!=='snapshot')throw Error('Unexpected leader mutation '+b.action);
    if(failPeriod&&b.shift==='2')return reply({ok:false},503);
    const target={date:b.date,shift:b.shift,line:'LINE_99',version,leader:'TEST',items:[{...catalog[0],targetQty:quantity}]};
    const reports=[{id:'LKH-T',line:'LINE_1',machine:'MESIN 1',part:'PART-A',operator:'OP Contoh',state:'PUBLISHED',viewOnly:true,input:{ok:12,repair:1,reject:0}},{id:'LKH99-TEST-JOB',...catalog[0],operator:'OP Uji',state:reportState,hash:'HASH-1',input:{date:b.date,shift:b.shift,machineId:'CHAMPER_UJI',part:'PIPE-UJI',start:'07:30',end:'08:30',ok:10,repair:1,reject:0}}];
    return reply({ok:true,data:{date:b.date,shift:b.shift,reportLine:b.line,checkedAt:new Date().toISOString(),catalog,targets:[target,{...target,line:'LINE_1',items:[{...catalog[1],targetQty:20}]}],reports:b.phase==='targets'?[]:reports,reportsLoaded:b.phase!=='targets',requests:[]}});
   }
   if(p==='/api/champer/capabilities')return reply({enabled:true,reportsEnabled:true});
   if(p==='/api/champer/state')return paired?reply({jobs,deviceReady:true}):reply({error:'TABLET_PAIRING_REQUIRED'},401);
   if(p==='/api/champer/pair'){writes.push({path:p,...b});paired=true;return reply({ok:true});}
   if(p==='/api/champer/operator'){
    writes.push(b);
    if(b.action==='prepare')jobs=[{id:'TEST-JOB',revision:1,state:'DRAFT',target:b.target,operators:b.operators,createdAt:new Date().toISOString()}];
    else if(b.action==='start'){if(loseStart){loseStart=false;return reply({error:'SIMULATED_LOST_REPLY'},503);}Object.assign(jobs[0],{revision:2,state:'ACTIVE',startEvidence:{counter_raw:7868,observed_at:new Date(Date.now()-600000).toISOString()}});}
    else if(b.action==='end')Object.assign(jobs[0],{revision:3,state:'END_CAPTURED',endEvidence:{counter_raw:7879,observed_at:new Date().toISOString()},delta:11});
    else if(b.action==='timing'){jobs[0].workTime=b.workTime;jobs[0].revision++;}
    else if(b.action==='quality'){jobs[0].quality=b.quality;jobs[0].revision++;}
    else if(b.action==='complete'){jobs[0].state='COMPLETED_PILOT';jobs[0].revision++;}
    else throw Error('Unexpected operator action '+b.action);
    return reply({ok:true});
   }
   if(p==='/api/champer/report'){writes.push({path:p,...b});jobs[0].report={state:'QUEUED'};jobs[0].revision++;return reply({ok:true});}
   if(p==='/api/champer/telemetry'){telemetryCalls++;const now=Date.now();return reply({serverTime:now,telemetry:{receivedAt:now,localReady:true,status:'READ_OK',readingReceivedAt:now-500,reading:{eventId:'EV-'+telemetryCalls,value:18392+telemetryCalls,observedAt:now-1000}}});}
   return reply({error:'BLOCKED_BY_ISOLATED_TEST'},403);
  });
  const nav=async view=>{const selector=await page.locator('.portal-nav').count()?'[data-portal-nav="'+view+'"]':'[data-view="'+view+'"]';await page.locator(selector).click();await page.waitForLoadState('domcontentloaded');assert.equal(await page.locator('iframe').count(),0);};
  await page.goto(base+'/portal.html');await page.waitForFunction(()=>document.getElementById('total').textContent==='8');
  assert.equal(await page.locator('#ok').textContent(),'—');assert.equal(writes.length,0);
  await page.locator('#load-results').click();await page.waitForFunction(()=>document.getElementById('ok').textContent==='12');assert.equal(await page.locator('#target-total').textContent(),'20');assert.equal(await page.locator('#published').textContent(),'12');
  checks.push('catalogue and complete-period aggregation; Line99 excluded from Welding; no automatic writes');
  await page.locator('#line').selectOption('LINE_99');assert.equal(await page.locator('#ok').textContent(),'10');await nav('performa');assert(await page.locator('#performance').isVisible());assert.match(await page.locator('#performance').textContent(),/belum tersedia/);
  await page.locator('#shift').selectOption('all');await page.locator('#load-results').click();await page.waitForFunction(()=>document.getElementById('ok').textContent==='20');
  failPeriod=true;await page.locator('#load-results').click();await page.waitForFunction(()=>!document.getElementById('load-results').disabled);assert.equal(await page.locator('#ok').textContent(),'—');failPeriod=false;
  checks.push('all shifts, pilot separation and incomplete-period guard preserved');
  await page.locator('#shift').selectOption('1');await nav('target');await page.locator('#leader').fill('Draft Leader');await page.locator('#editTargets').click();await page.locator('[data-qty]').fill('120');await page.locator('#targetReason').fill('Perubahan target uji');await page.locator('[data-close=targetDialog]').first().click();
  await nav('pekerjaan');await nav('target');assert.equal(await page.locator('#leader').inputValue(),'Draft Leader');await page.locator('#editTargets').click();assert.equal(await page.locator('[data-qty]').inputValue(),'120');assert.equal(await page.locator('#targetReason').inputValue(),'Perubahan target uji');await page.locator('#targetForm button[type=submit]').click();await page.waitForFunction(()=>!document.getElementById('targetDialog').open);
  const targetWrite=writes.find(b=>b.action==='target');assert.equal(targetWrite.payload.expectedVersion,1);assert(targetWrite.payload.requestId);assert.equal(targetWrite.payload.items[0].targetQty,120);
  checks.push('target draft and leader name survive real page navigation; save preserves version and request ID');
  await page.locator('#editTargets').click();await page.locator('[data-qty]').fill('140');await page.locator('[data-close=targetDialog]').first().click();version++;await nav('pekerjaan');await nav('target');await page.locator('#editTargets').click();assert.equal(await page.locator('[data-qty]').inputValue(),'120');assert.match(await page.locator('#notice').textContent(),/versi target di server telah berubah/);await page.locator('[data-close=targetDialog]').first().click();checks.push('stale target draft cannot overwrite a newer server version');
  await nav('pekerjaan');await page.locator('#cards a[href="/champer-plc.html"]').click();await page.locator('#pair-code').fill('TEST');await page.locator('#pair').click();await page.locator('#operators input').check();await page.locator('#prepare').click();await page.locator('#begin').waitFor({state:'visible'});
  loseStart=true;await page.locator('#begin').click();await page.locator('#retry').waitFor({state:'visible'});await nav('live');await nav('sesi');await page.locator('#retry').click();await page.waitForFunction(()=>document.getElementById('start').textContent==='7.868');
  const starts=writes.filter(b=>b.action==='start');assert.equal(starts.length,2);assert.deepEqual(starts[0],starts[1]);
  checks.push('unconfirmed Start uses the identical persisted request after navigation; no duplicate new request');
  await page.locator('#finish').click();await page.waitForFunction(()=>document.getElementById('delta').textContent==='11');await page.locator('#ok').fill('10');await page.locator('#repair').fill('1');await page.locator('[data-time-field=overtime]').selectOption('No');await page.locator('[data-time-field=reason]').fill('Catatan jam uji');
  await nav('live');await page.waitForFunction(()=>document.getElementById('counter').textContent!=='—');await nav('sesi');await page.locator('#quality').waitFor({state:'visible'});assert.equal(await page.locator('#ok').inputValue(),'10');assert.equal(await page.locator('#repair').inputValue(),'1');assert.equal(await page.locator('[data-time-field=reason]').inputValue(),'Catatan jam uji');
  await page.locator('[data-time-field=confirmed]').check();await page.locator('[data-save-timing]').click();await page.waitForFunction(()=>!document.querySelector('[data-save-timing]').disabled);
  await page.locator('#save-quality').click();await page.waitForFunction(()=>!document.getElementById('complete').disabled);await page.locator('#complete').click();await page.getByRole('button',{name:'Kirim laporan uji ke leader',exact:true}).click();await page.locator('#history-table a').filter({hasText:'Pemeriksaan leader'}).click();
  assert.equal(writes.find(b=>b.path==='/api/champer/report').jobId,'TEST-JOB');assert(writes.filter(b=>b.action&&b.action!=='target').every(b=>b.requestId));
  checks.push('mocked target → pairing → Start/End → actual time → quality → report, with quality/time drafts retained');
  await page.locator('[data-tab=reports]').click();await page.locator('[data-detail="LKH99-TEST-JOB"]').click();await page.locator('#reason').fill('Pemeriksaan revisi uji');await page.locator('#revisionFields [name=ok]').fill('9');await page.locator('[data-close=detailDialog]').click();await nav('live');await nav('laporan');await page.locator('[data-detail="LKH99-TEST-JOB"]').click();assert.equal(await page.locator('#revisionFields [name=ok]').inputValue(),'9');assert.equal(await page.locator('#reason').inputValue(),'Pemeriksaan revisi uji');await page.locator('#revisionForm button[type=submit]').click();await page.locator('#refresh').click();await page.waitForFunction(()=>document.getElementById('reportList').textContent.includes('Terbit TF Slip'));
  const decision=writes.find(b=>b.action==='decide');assert.equal(decision.payload.id,'LKH99-TEST-JOB');assert.equal(decision.payload.expectedHash,'HASH-1');assert.equal(decision.payload.decision,'revise');assert.equal(decision.payload.fields.ok,9);
  checks.push('leader revision retains report ID and expected hash; published TF state shown from mock response');
  await nav('live');await page.waitForFunction(()=>document.getElementById('counter').textContent!=='—');await page.waitForTimeout(5200);assert(await page.locator('#events tr').count());await nav('target');const calls=telemetryCalls;await page.waitForTimeout(5500);assert.equal(telemetryCalls,calls);
  checks.push('live values update and latency event captured; leaving live stops its network polling');
  await nav('sesi');await page.waitForFunction(()=>!document.getElementById('workspace').hidden);const countBeforeHide=await page.evaluate(()=>{window.__polls=0;const orig=window.andonFetch;window.andonFetch=(...a)=>{window.__polls++;return orig(...a);};Object.defineProperty(document,'hidden',{configurable:true,get:()=>true});document.dispatchEvent(new Event('visibilitychange'));return window.__polls;});await page.locator('#refresh').click();assert.equal(await page.evaluate(()=>window.__polls),countBeforeHide);await page.evaluate(()=>{Object.defineProperty(document,'hidden',{configurable:true,get:()=>false});document.dispatchEvent(new Event('visibilitychange'));});await page.waitForFunction(()=>window.__polls>0);checks.push('hidden session tab pauses state reads and resumes on visibility without issuing Start/End');await nav('target');
  await page.screenshot({path:'verification/portal-native-leader.png'});await page.setViewportSize({width:390,height:844});assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));await page.locator('#portal-menu-toggle').click();await nav('pekerjaan');assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));await page.screenshot({path:'verification/portal-native-phone.png'});
  await page.setViewportSize({width:1440,height:1000});await nav('sesi');await page.waitForFunction(()=>!document.getElementById('workspace').hidden);assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));await page.screenshot({path:'verification/portal-native-session.png'});
  await nav('monitor');await page.waitForFunction(()=>document.getElementById('total').textContent!=='—');await page.locator('#line').selectOption('LINE_1');await page.locator('#tv').click();await page.locator('#rotate').uncheck();await page.setViewportSize({width:1366,height:768});assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1&&document.documentElement.scrollHeight<=innerHeight+1));await page.screenshot({path:'verification/portal-native-tv.png'});await page.keyboard.press('Escape');
  checks.push('phone navigation, desktop session and landscape TV fit screen without frames');
  await page.locator('.topbar a[href="/"]').click();await page.waitForURL(base+'/');assert.equal(await page.locator('.portal-nav').count(),0);assert(await page.locator('form').count());checks.push('original manual LKH stays a separate page');
  assert.deepEqual(errors,[]);fs.writeFileSync('verification/portal-native-browser.json',JSON.stringify({passed:checks.length,checks,errors,isolated:true,mutations:writes.map(b=>b.action||b.path)},null,2));console.log(JSON.stringify({passed:checks.length,checks},null,2));
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
