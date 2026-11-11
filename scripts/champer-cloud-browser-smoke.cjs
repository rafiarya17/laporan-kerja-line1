// Isolated UI verification: loopback mock server, no real API, cloud or PLC.
const assert=require('node:assert/strict');
const http=require('node:http');
const fs=require('node:fs');
const path=require('node:path');
const {randomUUID}=require('node:crypto');
const serveOnly=process.argv.includes('--serve-only');
const {chromium}=serveOnly?{}:require(process.env.PLAYWRIGHT_MODULE||'playwright');
const core=require('../.test-build/champer-core.js');
const report=require('../.test-build/champer-report.js');
const target={date:'2026-11-11',shift:'1',line:'LINE_99',machine:'AUTO CHAMPER',part:'PART-TEST',version:1,targetQty:100,source:'LIVE_READ_ONLY'};
let state=core.initialState(),enabled=true,paired=false,seq=0;
const actor=randomUUID();
function heartbeat(){core.poll(state,actor,'test-source',true,Date.now());}
function capture(value){const now=Date.now();const c=core.poll(state,actor,'test-source',true,now);assert(c);const id=randomUUID();const e={command_id:id,request_key:c.localRequestKey,purpose:c.purpose,status:'RECORDED',created_at:new Date(now).toISOString(),expires_at:new Date(now+30000).toISOString(),after_sequence:String(seq),collector_id:'TEST',machine_id:core.MACHINE,tag_id:core.TAG,result:{command_id:id,event_id:'TEST:'+ ++seq,sequence:String(seq),observed_at:new Date(now).toISOString(),counter_raw:String(value),read_status:'READ_OK',quality:'UNKNOWN',collector_id:'TEST',machine_id:core.MACHINE,tag_id:core.TAG,event_type:'SNAPSHOT',reset_marker:'',freshness:'UNVERIFIED',production_usable:false}};core.result(state,{commandId:c.id,lease:c.lease,evidence:e},now,'TEST');}
const server=http.createServer(async(req,res)=>{try{let body='';for await(const b of req)body+=b;const input=body?JSON.parse(body):null;const send=(v,status=200)=>{res.writeHead(status,{'content-type':'application/json'});res.end(JSON.stringify(v));};
 if(req.url==='/test'&&serveOnly){res.setHeader('content-type','text/html');return res.end(`<h1>Isolated browser fixture</h1><button onclick='sessionStorage.setItem("champer-selected-target",JSON.stringify(${JSON.stringify(target)}));location.href="/champer-plc.html"'>Pilih target uji</button>`);}
 if(req.url==='/api/master')return send({ready:true,source:'live',mapping:{LINE_99:{operators:['Operator Contoh']}}});
 if(req.url==='/api/champer/capabilities')return send({enabled,reportsEnabled:true});
 if(req.url==='/api/champer/pair'){paired=input.code==='test-code';return send(paired?{ok:true}:{error:'PAIRING_CODE_INVALID'},paired?200:401);}
 if(req.url==='/api/champer/state'){if(!paired)return send({error:'TABLET_PAIRING_REQUIRED'},401);heartbeat();return send(core.view(state,Date.now()));}
 if(req.url==='/api/champer/operator')return send({ok:true,job:core.operatorAction(state,input,Date.now())});
 if(req.url==='/api/champer/report'){const p=report.prepareReport(state,input);report.reserveReport(state,input,p);return send({ok:true,report:report.confirmReport(state,input.jobId,{id:p.id,state:'QUEUED',mode:'production',receivedAt:new Date().toISOString()})});}
 if(req.url==='/test/capture'&&serveOnly){capture(input.value);return send({ok:true});}
 if(req.url==='/test/expire'&&serveOnly){core.expire(state,Date.now()+91000);return send({ok:true});}
 const name=req.url.split('?')[0];if(!/^\/(champer-plc\.(html|js)|champer-sim\.css)$/.test(name)){res.writeHead(404);return res.end();}
 res.setHeader('content-type',name.endsWith('.js')?'text/javascript':name.endsWith('.css')?'text/css':'text/html');res.end(fs.readFileSync(path.join(__dirname,'../public',name)));
 }catch(e){res.writeHead(e.status||500,{'content-type':'application/json'});res.end(JSON.stringify({error:e.message}));}});
(async()=>{await new Promise(r=>server.listen(0,'127.0.0.1',r));if(serveOnly){console.log('ISOLATED_UI_URL=http://127.0.0.1:'+server.address().port+'/champer-plc.html');return;}let browser;const checks=[];try{
 browser=await chromium.launch({headless:true,...(process.env.PLAYWRIGHT_CHANNEL?{channel:process.env.PLAYWRIGHT_CHANNEL}:{})});const ctx=await browser.newContext({viewport:{width:1100,height:850}});const page=await ctx.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.addInitScript(t=>sessionStorage.setItem('champer-selected-target',JSON.stringify(t)),target);
 await page.goto('http://127.0.0.1:'+server.address().port+'/champer-plc.html');
 await page.locator('#pair-panel').waitFor({state:'visible'});await page.locator('#pair-code').fill('test-code');await page.locator('#pair').click();await page.locator('#workspace').waitFor({state:'visible'});checks.push('pairing');
 await page.locator('#operators input').check();await page.locator('#prepare').click();await page.waitForFunction(()=>document.getElementById('state').textContent==='Siap dimulai');
 await page.locator('#begin').click();await page.waitForFunction(()=>document.getElementById('state').textContent==='Menunggu counter awal');await page.reload();await page.waitForFunction(()=>document.getElementById('state').textContent==='Menunggu counter awal');assert.equal(await page.locator('#start').textContent(),'—');checks.push('pending-refresh-no-zero');
 capture(100);await page.locator('#refresh').click();await page.waitForFunction(()=>document.getElementById('start').textContent==='100');
 await page.locator('#finish').click();await page.waitForFunction(()=>document.getElementById('state').textContent==='Menunggu counter akhir');capture(112);await page.locator('#refresh').click();await page.waitForFunction(()=>document.getElementById('delta').textContent==='12');checks.push('start-end');
 await page.locator('#ok').fill('10');await page.locator('#repair').fill('1');await page.locator('#reject').fill('1');await page.locator('#issue').selectOption('Ada');await page.locator('#problem').fill('uji');await page.locator('#action').fill('uji');await page.locator('#pic').fill('Contoh');await page.locator('#save-quality').click();await page.waitForFunction(()=>!document.getElementById('complete').disabled);await page.locator('#complete').click();await page.waitForFunction(()=>document.getElementById('state').textContent==='Belum ada sesi aktif');assert.match(await page.locator('#history').textContent(),/Selesai · pilot/);checks.push('quality-complete');
 await page.reload();await page.locator('#workspace').waitFor({state:'visible'});assert.match(await page.locator('#history').textContent(),/OK 10, Repair 1, Reject 1/);await page.locator('#operators input').check();await page.locator('#prepare').click();await page.waitForFunction(()=>document.getElementById('state').textContent==='Siap dimulai');assert.equal(await page.locator('#repair').inputValue(),'0');assert.equal(await page.locator('#issue').inputValue(),'Tidak');checks.push('history-and-new-quality-reset');
 await page.setViewportSize({width:390,height:844});await page.screenshot({path:path.join(__dirname,'../verification/champer-mobile.png'),fullPage:true});assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));checks.push('mobile-no-horizontal-overflow');
 enabled=false;await page.locator('#refresh').click();await page.locator('#workspace').waitFor({state:'hidden'});assert.match(await page.locator('#notice').textContent(),/belum diaktifkan/);checks.push('disabled-before-configuration');assert.deepEqual(errors,[]);
 fs.writeFileSync(path.join(__dirname,'../verification/champer-browser.json'),JSON.stringify({passed:checks.length,checks,network:'loopback mocks only',plc:false},null,2));console.log(JSON.stringify({passed:checks.length,checks}));
 }finally{if(browser)await browser.close();await new Promise(r=>server.close(r));}})().catch(e=>{console.error(e);process.exitCode=1;});
