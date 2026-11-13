const {test}=require('node:test');
const assert=require('node:assert/strict');
const vm=require('node:vm');
const fs=require('node:fs');
const source=fs.readFileSync('public/andon-fetch.js','utf8');
function setup(fetch){const timers=new Set();const c={window:{},AbortController,AbortSignal:{},fetch,setTimeout(fn,ms){const t=setTimeout(fn,ms);timers.add(t);return t;},clearTimeout(t){timers.delete(t);clearTimeout(t);}};vm.runInNewContext(source,c);return {run:c.window.andonFetch,timers};}
test('old tablet without static AbortSignal methods preserves POST and clears timer',async()=>{const x=setup(async(url,o)=>{assert.equal(url,'/pair');assert.equal(o.method,'POST');assert.equal(o.body,'{}');return {ok:true};});assert.equal((await x.run('/pair',{method:'POST',body:'{}'},50)).ok,true);assert.equal(x.timers.size,0);});
test('deadline still aborts hanging request',async()=>{const x=setup((u,o)=>new Promise((resolve,reject)=>o.signal.addEventListener('abort',()=>reject(Error('aborted')))));await assert.rejects(x.run('/test',{},5),/aborted/);assert.equal(x.timers.size,0);});
test('selection changes cancel prior target request',async()=>{const x=setup((u,o)=>new Promise((resolve,reject)=>o.signal.addEventListener('abort',()=>reject(Error('aborted')))));const c=new AbortController();const p=x.run('/targets',{signal:c.signal},500);c.abort();await assert.rejects(p,/aborted/);assert.equal(x.timers.size,0);});
test('already aborted caller remains aborted',async()=>{const x=setup(async(u,o)=>{assert.equal(o.signal.aborted,true);throw Error('aborted');});const c=new AbortController();c.abort();await assert.rejects(x.run('/targets',{signal:c.signal}),/aborted/);assert.equal(x.timers.size,0);});
test('network error retains failure and clears timer',async()=>{const x=setup(async()=>{throw Error('network');});await assert.rejects(x.run('/test',{}),/network/);assert.equal(x.timers.size,0);});
test('all Champer entry pages load compatibility helper first',()=>{for(const [html,js] of [['champer-plc.html','champer-plc.js'],['champer-simulasi.html','champer-sim.js'],['pekerjaan.html','pekerjaan.js']]){const h=fs.readFileSync('public/'+html,'utf8'),s=fs.readFileSync('public/'+js,'utf8');assert.ok(h.indexOf('/andon-fetch.js')<h.indexOf('/'+js));assert.doesNotMatch(s,/AbortSignal\.(timeout|any)/);new vm.Script(s);}});
