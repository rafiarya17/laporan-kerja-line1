import snapshot from '../constants/formMapping.json';

// Preview has no external reads or writes, even if credentials are inherited.
export function portalPreview() {
  return process.env.VERCEL_ENV !== 'production' &&
    (process.env.VERCEL_ENV === 'preview' || process.env.ANDON_PORTAL_PREVIEW === '1');
}
export const previewHeaders = {'Cache-Control':'no-store'};
export function previewBlocked() {
  return Response.json({ok:false,error:'Pratinjau saja: perubahan tidak dikirim ke produksi.'},{status:403,headers:previewHeaders});
}
export function previewMaster() {
  const mapping = Object.fromEntries(Object.entries(snapshot).map(([line,v])=>[line,{
    operators:['Operator Contoh A','Operator Contoh B'],
    mesin_part_mapping:Object.fromEntries(Object.entries(v.mesin_part_mapping).map(([machine,m])=>[machine,{options:m.options}]))
  }]));
  mapping.LINE_99={operators:['Operator Contoh A','Operator Contoh B'],mesin_part_mapping:{'AUTO CHAMPER':{options:[...snapshot.LINE_1.mesin_part_mapping['AUTO CHAMPER'].options]}}};
  return {mapping,version:'portal-preview-snapshot-2026-10-29',mode:'test',ready:false,source:'snapshot',preview:true};
}
export function previewWorkspace(date:string,shift:string,line='') {
  const {mapping}=previewMaster();
  const catalog=Object.entries(mapping).flatMap(([line,v])=>Object.entries(v.mesin_part_mapping).flatMap(([machine,m])=>m.options.filter(p=>p!=='__other_option__').map(part=>({line,machine,machineId:machine,part}))));
  const examples=['LINE_1','LINE_2','LINE_3','LINE_99'].map(l=>catalog.find(c=>c.line===l)!).filter(Boolean);
  const targets=examples.map((m,i)=>({date,shift,line:m.line,version:1,leader:'Leader Contoh',items:[{...m,targetQty:i===3?100:200}]}));
  const reports=examples.filter((_,i)=>i===0||i===3).map((m,i)=>({
    ...m,id:'PREVIEW-LKH-'+i,date,shift,operator:'Operator Contoh A',viewOnly:true,
    state:i===1?'PUBLISHED':'WAITING_LEADER',productionState:'Contoh laporan · tidak terbit nyata',
    input:{date,shift,start:'07:30',end:'09:00',ok:i===1?55:80,repair:i===1?3:0,reject:i===1?2:0},
    note:'Data contoh pratinjau. Tidak tersimpan pada laporan produksi.'
  }));
  return {ok:true,preview:true,data:{date,shift,reportLine:line,checkedAt:new Date().toISOString(),catalog,targets,reports,requests:[],reportsLoaded:true}};
}
