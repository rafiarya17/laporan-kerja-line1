(function(root){'use strict';
function initial(shift){return {raw:18392,baseline:shift==='2'?18392:18356,completed:shift==='2'?0:84,shiftTarget:shift==='2'?180:200,sessionTarget:100,confirmedOK:shift==='2'?0:80,session:1,available:true,mtc:0,dandori:0};}
function result(s,scope){
 const valid=Number.isSafeInteger(s.raw)&&Number.isSafeInteger(s.baseline)&&s.raw>=s.baseline;
 const delta=valid?s.raw-s.baseline:null;
 const historical=delta===null?null:(scope==='session'?delta:s.completed+delta);
 const actual=s.available?historical:null,target=scope==='session'?s.sessionTarget:s.shiftTarget;
 const ok=scope==='session'?null:s.confirmedOK;
 return {actual,historical,target,ok,raw:s.raw,invalid:!valid,indicativePercent:actual===null||target<=0?null:actual/target*100,okPercent:ok===null||target<=0?null:ok/target*100};
}
function increment(s,n){if(!Number.isSafeInteger(n)||n<0||!Number.isSafeInteger(s.raw+n))throw Error('Invalid example increment');return {...s,raw:s.raw+n,available:true};}
function nextSession(s){const r=result(s,'session');if(r.actual===null)throw Error('Contoh sesi baru memerlukan data yang tersedia.');return {...s,completed:s.completed+r.actual,baseline:s.raw,session:s.session+1};}
const api={initial,result,increment,nextSession};if(typeof module==='object'&&module.exports)module.exports=api;else root.PortalMonitor=api;
})(typeof window==='object'?window:globalThis);
