/** Shared plain-text shift card model. No network, writes or credentials. */
function leaderCardModel(date,shift,targets,reports,s,entry){
 var seen={},unique=[];reports.forEach(function(r){if(!seen[r.id]){seen[r.id]=true;unique.push(r);}});
 var pilot=unique.filter(function(r){return !r.viewOnly&&r.line==='LINE_99';});
 function count(states){return pilot.filter(function(r){return states.indexOf(r.state)>=0;}).length;}
 var processing=count(['RECEIVED']),waiting=count(['WAITING_LEADER']),attention=pilot.filter(function(r){return !!r.validation||r.state==='HELD';}).length,publishing=count(['PUBLISH_QUEUED','WAITING_TF_SYNC']),published=count(['PUBLISHED']);
 var title=!targets.length?'📝 TARGET BELUM DIISI':!s.expected?'➖ TIDAK ADA ITEM TARGET':s.missing?'⚠️ LAPORAN BELUM LENGKAP':'✅ SEMUA ITEM TARGET SUDAH DILAPORKAN';
 var pct=s.expected?Math.round(s.received/s.expected*100):null;
 var text='BERLINDO · STATUS LAPORAN SHIFT\n'+date+' · SHIFT '+shift+'\n\n'+title+'\n';
 if(s.expected)text+='Kelengkapan: '+pct+'%\n';
 text+='🎯 Target laporan: '+s.expected+' item part–mesin\n📥 Sudah dilaporkan: '+s.received+'/'+s.expected+' item\n'+(s.missing?'⏳':s.expected?'✅':'▫️')+' Belum dilaporkan: '+s.missing+' item\n🧾 Submission masuk: '+s.submissions+' laporan';
 if(s.unplanned)text+='\n⚠️ Di luar target: '+s.unplanned+' laporan';
 function itemKey(x){return JSON.stringify([String(x.line||''),String(x.machine||x.machineId||'').trim().toUpperCase(),String(x.part||'').trim().toUpperCase()]);}
 var lines={};targets.forEach(function(t){lines[t.line]=true;});
 if(Object.keys(lines).length){text+='\n\nPER LINE';Object.keys(lines).sort(function(a,b){return Number(a.split('_')[1])-Number(b.split('_')[1]);}).forEach(function(line){var items={},got={};targets.filter(function(t){return t.line===line;}).forEach(function(t){t.items.forEach(function(x){items[itemKey(x)]=true;});});unique.filter(function(r){return r.line===line;}).forEach(function(r){var k=itemKey(r);if(items[k])got[k]=true;});var n=Object.keys(items).length,m=Object.keys(got).length;text+='\n'+(!n?'➖':m===n?'✅':'⚠️')+' '+line.replace('_',' ')+': '+m+'/'+n+' item';});}
 text+='\n\nVERIFIKASI & TF SLIP · UJI LINE 99\n'+(processing?'⏳':'▫️')+' Proses awal: '+processing+' laporan\n'+(waiting?'🟡':'▫️')+' Menunggu leader: '+waiting+' laporan\n'+(attention?'🔴':'✅')+' Perlu perhatian: '+attention+' laporan\n'+(publishing?'🔄':'▫️')+' Disetujui · antre/sinkron TF: '+publishing+' laporan\n'+(published?'✅':'▫️')+' Terbit TF Slip terverifikasi: '+published+' laporan';
 if(s.expected&&!s.missing&&(waiting||processing||publishing||attention))text+='\n\n📌 Laporan sudah lengkap; verifikasi/terbit TF masih berjalan.';
 text+='\n\nJumlah target dihitung per item part–mesin.\nOperator/helper tidak menambah target.\nPersetujuan uji: Line 99 · IS_TEST.\nRingkasan diperbarui pada pesan yang sama.';
 var base=entry+'?date='+encodeURIComponent(date)+'&shift='+encodeURIComponent(shift),buttons=[[{text:'📋 Verifikasi uji ('+(processing+waiting)+')',url:base+'&tab=reports&status=waiting&line=LINE_99'},{text:'🎯 Target shift',url:base+'&tab=targets'}]];
 if(attention||published){var row=[];if(attention)row.push({text:'🔴 Perlu perhatian ('+attention+')',url:base+'&tab=reports&status=attention&line=LINE_99'});if(published)row.push({text:'✅ Terbit TF ('+published+')',url:base+'&tab=reports&status=PUBLISHED&line=LINE_99'});buttons.push(row);}
 return {text:text,inline_keyboard:buttons};
}
