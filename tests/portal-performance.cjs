const {test}=require('node:test'),assert=require('node:assert/strict'),{calculate}=require('../public/portal-performance-core.js');
const base={planned:480,run:400,total:120,good:80,repair:25,reject:15,target:200,cycleSeconds:120,timeVerified:true,qualityVerified:true,cycleVerified:true,counterValid:true};
test('OEE decomposes independently and losses reconcile to planned time',()=>{const r=calculate(base);assert.equal(r.oee,1/3);assert.equal(r.availability,5/6);assert.equal(r.performance,.6);assert.equal(r.quality,2/3);assert.equal(r.efficiency,.5);assert.equal(r.attainment,.4);assert(Math.abs(r.oee-r.availability*r.performance*r.quality)<1e-12);assert.equal(Object.values(r.losses).reduce((a,b)=>a+b),480);assert.deepEqual(r.losses,{stop:80,speed:160,quality:80,productive:160});});
test('missing time or CT does not suppress independent quality, but blocks OEE',()=>{for(const field of ['timeVerified','cycleVerified']){const r=calculate({...base,[field]:false});assert.equal(r.oee,null);assert.equal(r.quality,2/3);assert.equal(r.performance,null);}assert.equal(calculate({...base,timeVerified:false}).availability,null);});
test('unclassified, invalid and disconnected counts are not silently counted as zero',()=>{for(const change of [{total:132},{qualityVerified:false},{counterValid:false},{total:-1}]){const r=calculate({...base,...change});assert.equal(r.oee,null);assert.equal(r.quality,null);}assert.equal(calculate({...base,total:132}).unclassified,12);});
test('zero production and no planned time have different meanings',()=>{let r=calculate({...base,run:0,total:0,good:0,repair:0,reject:0});assert.equal(r.oee,0);assert.equal(r.performance,null);assert.equal(r.quality,null);assert.equal(r.availability,0);assert.equal(calculate({...base,planned:0}).oee,null);assert.equal(calculate({...base,target:0}).attainment,null);});
test('impossible performance is flagged rather than capped',()=>{const r=calculate({...base,cycleSeconds:300});assert.equal(r.performance,null);assert.equal(r.oee,null);assert(r.reasons.some(x=>x.includes('melebihi')));});

const {aggregate,datesBetween}=require('../public/portal-performance-core.js');
test('inclusive range validates dates across month and leap boundaries',()=>{
 assert.deepEqual(datesBetween('2024-02-28','2024-03-01'),['2024-02-28','2024-02-29','2024-03-01']);
 assert.throws(()=>datesBetween('2026-02-29','2026-03-01'));assert.throws(()=>datesBetween('2026-11-13','2026-11-12'));
});
test('aggregate uses per-part ideal time and quantity-weighted quality',()=>{
 const other={...base,planned:240,run:200,total:100,good:90,repair:5,reject:5,cycleSeconds:60,target:100};
 const r=aggregate([base,other]);
 assert.equal(r.oee,250/720);assert.equal(r.availability,600/720);assert.equal(r.performance,340/600);
 assert.equal(r.quality,170/220);assert.equal(r.attainment,170/300);
 assert.equal(Object.values(r.losses).reduce((a,b)=>a+b),720);
 assert.notEqual(r.oee,(calculate(base).oee+calculate(other).oee)/2);
});
test('all shifts include zero-output planned time and missing periods invalidate dependent metrics',()=>{
 const zero={...base,run:0,total:0,good:0,repair:0,reject:0,target:180};
 const r=aggregate([base,zero]);assert.equal(r.oee,1/6);assert.equal(r.data.target,380);assert.equal(r.quality,2/3);
 assert.equal(aggregate([base,{...base,counterValid:false}]).oee,null);
 assert.equal(aggregate([base,{...base,qualityVerified:false}]).performance,.6);
 assert.equal(aggregate([]).oee,null);assert.equal(aggregate([]).availability,null);
});
