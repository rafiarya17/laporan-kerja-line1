import {fail} from './champer-core';
import {workShift} from './welding-shift';
export const TELEMETRY_KEY='berlindo:champer:pilot:telemetry:v1';
export type Reading={eventId:string;value:number;observedAt:number};
export type ShiftCounter={date:string;shift:number;collector:string;firstAt:number;firstValue:number;lastAt:number;lastValue:number;review:boolean};
export type ShiftSignals={start:number;at:number;mtc:0|1|null;dandori:0|1|null;mtcMs:number;dandoriMs:number;mtcKnown:number;dandoriKnown:number;covered:number;down:number};
function shiftSignals(value:unknown,sentAt:number):ShiftSignals|null {
 if(value==null)return null;
 const v=value as ShiftSignals;
 if(typeof v!=='object'||!Number.isSafeInteger(v.at)||v.at<=0||v.at>sentAt+5000||
    v.start!==Math.floor((v.at-1800000)/43200000)*43200000+1800000||
    ![0,1,null].includes(v.mtc)||![0,1,null].includes(v.dandori)||
    [v.covered,v.down,v.mtcMs,v.dandoriMs,v.mtcKnown,v.dandoriKnown].some(n=>!Number.isSafeInteger(n)||n<0||n>v.at-v.start)||
    v.mtcMs>v.mtcKnown||v.dandoriMs>v.dandoriKnown||v.covered>Math.min(v.mtcKnown,v.dandoriKnown)||v.down>v.covered||v.down>v.mtcMs+v.dandoriMs)fail('TELEMETRY_INVALID',400);
 const {start,at,mtc,dandori,mtcMs,dandoriMs,mtcKnown,dandoriKnown,covered,down}=v;
 return {start,at,mtc,dandori,mtcMs,dandoriMs,mtcKnown,dandoriKnown,covered,down};
}
export type Telemetry={calls?:ShiftSignals|null;shiftCounter?:ShiftCounter|null;sentAt:number;receivedAt:number;readingReceivedAt:number|null;localReady:boolean;reading:Reading|null;status:string};
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
 return {calls:shiftSignals(b.calls,b.sentAt),sentAt:b.sentAt,receivedAt:now,readingReceivedAt:reading?now:null,localReady:b.localReady,reading,status:String(b.status)};
}
// Separate bounded key: never modifies jobs, snapshots, reports or transfer slips.
export const TELEMETRY_CAS = `
local old = redis.call('GET', KEYS[1])
local incoming = cjson.decode(ARGV[2])
local date, shift = ARGV[3], tonumber(ARGV[4])
local from, untilMs = tonumber(ARGV[5]), tonumber(ARGV[5]) + 43200000
local collector = ARGV[1]
local meter
local function observe(r)
  if type(r) ~= 'table' or r.observedAt < from or r.observedAt >= untilMs then return end
  if string.sub(r.eventId,1,#collector+1) ~= collector..':' then return end
  if not meter then
    meter = {date=date, shift=shift, collector=collector, firstAt=r.observedAt, firstValue=r.value, lastAt=r.observedAt, lastValue=r.value, review=false}
  elseif r.observedAt >= meter.lastAt then
    if r.value < meter.lastValue or (r.observedAt == meter.lastAt and r.value ~= meter.lastValue) then meter.review=true end
    meter.lastAt, meter.lastValue = r.observedAt, r.value
  end
end
if old then
  local previous = cjson.decode(old)
  if previous.sentAt >= incoming.sentAt then return 0 end
  local saved = previous.shiftCounter
  if type(saved) == 'table' and saved.date == date and saved.shift == shift and saved.collector == collector then meter=saved end
  observe(previous.reading)
  if type(previous.reading)=='table' and type(incoming.reading)=='table' and previous.reading.eventId==incoming.reading.eventId then
    incoming.readingReceivedAt=previous.readingReceivedAt
  end
end
observe(incoming.reading)
incoming.shiftCounter=meter
redis.call('SET',KEYS[1],cjson.encode(incoming))
return 1`;
export function telemetryStore(url:string,token:string,request:typeof fetch=fetch){
 const u=new URL(url);if(u.protocol!=='https:'||!u.hostname.endsWith('.upstash.io')||u.pathname!=='/'||u.search||u.username)fail('DATABASE_CONFIGURATION_INVALID',503);
 const key=TELEMETRY_KEY;
 async function command(args:unknown[]){const r=await request(url,{method:'POST',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},body:JSON.stringify(args),cache:'no-store',redirect:'error',signal:AbortSignal.timeout(8000)});if(!r.ok)fail('DATABASE_UNAVAILABLE',503);const b=await r.json();if(b.error)fail('DATABASE_UNAVAILABLE',503);return b.result;}
 return {async put(t:Telemetry,collector:string){const period=workShift(new Date(t.receivedAt));
   const from=Date.parse(period.date+(period.shift===1?'T07:30':'T19:30')+':00+07:00');
   return await command(['EVAL',TELEMETRY_CAS,1,key,collector,JSON.stringify(t),period.date,period.shift,from])===1;},async get():Promise<Telemetry|null>{const v=await command(['GET',key]);return v?JSON.parse(v):null;}};
}
