export const dayMs=86400000;
export function workShift(now){
  const local=new Date(now.getTime()+7*3600000);
  const minute=local.getUTCHours()*60+local.getUTCMinutes();
  const date=new Date(local.getTime()-(minute<450?dayMs:0)).toISOString().slice(0,10);
  return {date,shift:minute>=450 && minute<1170?1:2};
}
export function dayOffset(date,offset){return new Date(Date.parse(date+'T00:00:00Z')+offset*dayMs).toISOString().slice(0,10);}
export const fmt=n=>n==null?'—':n.toLocaleString('id-ID',{maximumFractionDigits:1});
export const metrics=[
 ['target','Target','pcs','Jumlah target OK simulasi.'],['ok','OK','pcs','Jumlah hasil OK yang dilaporkan.'],
 ['attain','Pencapaian','%','OK dibagi target OK.'],['repair','Repair','pcs','Jumlah yang masuk repair.'],
 ['reject','Reject','pcs','Jumlah yang ditolak.'],['quality','Quality','%','OK dibagi seluruh hasil (OK + repair + reject).'],
 ['eff','Efisiensi tenaga kerja','%','Waktu standar untuk seluruh hasil dibagi total waktu kerja operator. Contoh definisi.'],
 ['availability','Availability','%','Waktu berjalan dibagi waktu produksi terencana.'],
 ['performance','Performance','%','Total waktu ideal untuk seluruh hasil dibagi waktu berjalan.'],
 ['oee','OEE','%','Availability × Performance × Quality. Semua waktu dan hasil di sini simulasi.']
];
export const defaults=metrics.slice(0,5).map(x=>x[0]);
function ratio(n,d){return d>0?100*n/d:null;}
export function aggregate(rows){
 const total={ok:0,target:0,repair:0,reject:0,planned:0,run:0,ideal:0,labor:0};
 let validCT=rows.length>0;
 for(const r of rows){for(const k of Object.keys(total))total[k]+=r[k]??0;if(r.ideal==null)validCT=false;}
 const qty=total.ok+total.repair+total.reject;
 const quality=ratio(total.ok,qty),availability=ratio(total.run,total.planned),performance=validCT?ratio(total.ideal,total.run):null;
 return {...total,attain:ratio(total.ok,total.target),quality,availability,performance,eff:validCT?ratio(total.ideal,total.labor):null,oee:[availability,performance,quality].every(x=>x!=null)?availability*performance*quality/10000:null};
}
export function labelLine(n){return n===99?'Line 99 Uji':'Line '+n;}
export function saved(key,fallback){try{return JSON.parse(localStorage.getItem('andon-layout-v1:'+key))??fallback;}catch{return fallback;}}
export function save(key,value){try{localStorage.setItem('andon-layout-v1:'+key,JSON.stringify(value));}catch{}}
