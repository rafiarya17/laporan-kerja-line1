(function(root){
'use strict';
const key=r=>JSON.stringify([String(r.line||''),String(r.machine||r.machineId||'').trim().toUpperCase(),String(r.part||'').trim().toUpperCase()]);
function quantities(t,reports){const targetQty=Number.isSafeInteger(t.targetQty)&&t.targetQty>0?t.targetQty:null,actualOk=reports.reduce((n,r)=>{const qty=Number(r.input?.ok);return n+(Number.isFinite(qty)&&qty>=0?qty:0);},0);return {targetQty,actualOk,shortfall:targetQty===null?null:Math.max(0,targetQty-actualOk),qtyReached:targetQty===null?null:actualOk>=targetQty};}
function summarize(targets,reports){const unique=[...new Map(reports.map(r=>[r.id,r])).values()],map=new Map();for(const r of unique){const k=key(r);if(!map.has(k))map.set(k,[]);map.get(k).push(r);}const items=[...new Map(targets.flatMap(t=>t.items).map(t=>[key(t),t])).values()].map(t=>{const reports=map.get(key(t))||[];return {...t,reports,...quantities(t,reports)};});return {items,expected:items.length,received:items.filter(t=>t.reports.length).length,missing:items.filter(t=>!t.reports.length).length,submissions:unique.length,unplanned:unique.filter(r=>!items.some(t=>key(t)===key(r))).length};}
const api={key,summarize,quantities};if(typeof module!=='undefined')module.exports=api;else root.LeaderCore=api;
})(typeof window==='undefined'?{}:window);
