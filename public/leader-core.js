(function(root){
'use strict';
const key=r=>JSON.stringify([String(r.line||''),String(r.machine||r.machineId||'').trim().toUpperCase(),String(r.part||'').trim().toUpperCase()]);
function quantities(t,reports){const targetQty=Number.isSafeInteger(t.targetQty)&&t.targetQty>0?t.targetQty:null,actualOk=reports.reduce((n,r)=>{const qty=Number(r.input?.ok);return n+(Number.isFinite(qty)&&qty>=0?qty:0);},0);return {targetQty,actualOk,shortfall:targetQty===null?null:Math.max(0,targetQty-actualOk),qtyReached:targetQty===null?null:actualOk>=targetQty};}
function summarize(targets,reports){const unique=[...new Map(reports.map(r=>[r.id,r])).values()],map=new Map();for(const r of unique){const k=key(r);if(!map.has(k))map.set(k,[]);map.get(k).push(r);}const items=[...new Map(targets.flatMap(t=>t.items).map(t=>[key(t),t])).values()].map(t=>{const reports=map.get(key(t))||[];return {...t,reports,...quantities(t,reports)};});return {items,expected:items.length,received:items.filter(t=>t.reports.length).length,missing:items.filter(t=>!t.reports.length).length,submissions:unique.length,unplanned:unique.filter(r=>!items.some(t=>key(t)===key(r))).length};}
function targetSelection(items,catalog,line){
 const invalid=[],resolved=[];
 for(const item of items){
  const matches=catalog.filter(m=>m.line===line&&key(m)===key(item));
  const exact=matches.find(m=>m.machine===item.machine&&m.part===item.part);
  const match=exact||(matches.length===1?matches[0]:null);
  if(!match){invalid.push(item);continue;}
  resolved.push({line:match.line,machine:match.machine,part:match.part,targetQty:item.targetQty});
 }
 return {items:resolved,invalid};
}
const api={key,summarize,quantities,targetSelection};if(typeof module!=='undefined')module.exports=api;else root.LeaderCore=api;
})(typeof window==='undefined'?{}:window);
