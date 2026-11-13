import {fail} from './champer-core';
export type Reading={eventId:string;value:number;observedAt:number};
export type Telemetry={sentAt:number;receivedAt:number;readingReceivedAt:number|null;localReady:boolean;reading:Reading|null;status:string};
export function validateTelemetry(b:Record<string,unknown>,collector:string,now:number):Telemetry {
 if(b.collectorId!==collector||b.machine!=='AUTO_CHAMPER'||b.tag!=='DXP|Device1|D100')fail('TELEMETRY_MAPPING_MISMATCH',400);
 if(typeof b.sentAt!=='number'||!Number.isSafeInteger(b.sentAt)||Math.abs(now-b.sentAt)>5000)fail('TELEMETRY_CLOCK_OR_DELAY',400);
 if(typeof b.localReady!=='boolean'||!['UNKNOWN','READ_OK','READ_ERROR','DISCONNECTED','LOCAL_UNAVAILABLE'].includes(String(b.status)))fail('TELEMETRY_INVALID',400);
 let reading:Reading|null=null;
 if(b.reading!==null){
  const r=b.reading as Reading;
  if(!r||typeof r.eventId!=='string'||!r.eventId.startsWith(collector+':')||r.eventId.length>180||!Number.isSafeInteger(r.value)||r.value<0||!Number.isSafeInteger(r.observedAt)||r.observedAt<1||r.observedAt>b.sentAt+5000)fail('TELEMETRY_READING_INVALID',400);
  reading={eventId:r.eventId,value:r.value,observedAt:r.observedAt};
 }
 return {sentAt:b.sentAt,receivedAt:now,readingReceivedAt:reading?now:null,localReady:b.localReady,reading,status:String(b.status)};
}
// Separate bounded key: never modifies jobs, snapshots, reports or transfer slips.
export const TELEMETRY_CAS="local x=redis.call('GET',KEYS[1]); local n=cjson.decode(ARGV[2]); if x then local p=cjson.decode(x); if p.sentAt>=tonumber(ARGV[1]) then return 0 end; if type(p.reading)=='table' and type(n.reading)=='table' and p.reading.eventId==n.reading.eventId then n.readingReceivedAt=p.readingReceivedAt end end; redis.call('SET',KEYS[1],cjson.encode(n)); return 1";
export function telemetryStore(url:string,token:string,request:typeof fetch=fetch){
 const u=new URL(url);if(u.protocol!=='https:'||!u.hostname.endsWith('.upstash.io')||u.pathname!=='/'||u.search||u.username)fail('DATABASE_CONFIGURATION_INVALID',503);
 const key='berlindo:champer:pilot:telemetry:v1';
 async function command(args:unknown[]){const r=await request(url,{method:'POST',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},body:JSON.stringify(args),cache:'no-store',redirect:'error',signal:AbortSignal.timeout(8000)});if(!r.ok)fail('DATABASE_UNAVAILABLE',503);const b=await r.json();if(b.error)fail('DATABASE_UNAVAILABLE',503);return b.result;}
 return {async put(t:Telemetry){return await command(['EVAL',TELEMETRY_CAS,1,key,t.sentAt,JSON.stringify(t)])===1;},async get():Promise<Telemetry|null>{const v=await command(['GET',key]);return v?JSON.parse(v):null;}};
}
