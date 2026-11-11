import {State,initialState,fail} from './champer-core';

// One bounded pilot aggregate, atomically replaced with Redis compare-and-swap.
// No TTL or eviction is applied. At capacity the core requires an explicit archive.
export const CAS = "local x=redis.call('GET',KEYS[1]); if (x or '')~=ARGV[1] then return 0 end; redis.call('SET',KEYS[1],ARGV[2]); return 1";
export type Store = {transaction<T>(fn:(s:State)=>T):Promise<T>};
export function redisStore(url:string,token:string,key:string,request:typeof fetch=fetch):Store {
 const parsed=new URL(url);
 if(parsed.protocol!=='https:'||!parsed.hostname.endsWith('.upstash.io')||parsed.pathname!=='/'||parsed.search||parsed.username)fail('DATABASE_CONFIGURATION_INVALID',503);
 async function command(args:unknown[]){const r=await request(url,{method:'POST',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},body:JSON.stringify(args),cache:'no-store',redirect:'error',signal:AbortSignal.timeout(8000)});if(!r.ok)fail('DATABASE_UNAVAILABLE',503);const b=await r.json();if(b.error)fail('DATABASE_UNAVAILABLE',503);return b.result;}
 return {async transaction<T>(fn:(s:State)=>T){for(let i=0;i<6;i++){
   const previous=await command(['GET',key]);const s:State=previous?JSON.parse(previous):initialState();if(s.schema!==1)fail('DATABASE_SCHEMA_MISMATCH',503);
   const answer=fn(s);const data=JSON.stringify(s);
   if(data===previous||(!previous&&data===JSON.stringify(initialState())))return answer;
   s.revision++;const next=JSON.stringify(s);if(Buffer.byteLength(next)>4000000)fail('PILOT_ARCHIVE_REQUIRED',503);
   if(await command(['EVAL',CAS,1,key,previous||'',next])===1)return answer;
 }return fail('BUSY_RETRY_SAME_ID',409);}};
}
