// Reads the local journal only; no DDE, PLC, snapshot command or job dependency.
export function telemetryAdapter({config,fetcher=fetch,now=Date.now}){
 let busy=false,lastSignature='',lastSent=0;
 async function get(path){const r=await fetcher(config.localBase+path,{headers:{authorization:'Bearer '+config.localToken},cache:'no-store',redirect:'error',signal:AbortSignal.timeout(4000)});if(!r.ok)throw Error('LOCAL_UNAVAILABLE');return r.json();}
 return {async tick(){
  if(busy)return;busy=true;
  try{
   let reading=null,localReady=false,status='LOCAL_UNAVAILABLE';
   try{
    const h=await get('/health'),s=await get('/api/v1/summary');
    if(h.version!=='0.5.0'||h.package_key!==config.packageKey||s.machine!=='AUTO_CHAMPER'||s.analysis_policy!=='D100_ONLY_NO_D101_MERGE')throw Error('LOCAL_MAPPING_CHANGED');
    localReady=h.ready===true&&s.bridge?.active===true&&s.bridge?.collector_ready===true;
    const c=s.latest?.counter,r=c?.last_reading;
    status=['READ_OK','READ_ERROR','DISCONNECTED'].includes(c?.read_status)?c.read_status:'UNKNOWN';
    if(r&&r.communication_quality!=='BAD'&&/^\d{1,4}$/.test(String(r.value))&&r.event_id?.startsWith(config.collectorId+':')&&Number.isFinite(Date.parse(r.observed_at)))reading={eventId:r.event_id,value:Number(r.value),observedAt:Date.parse(r.observed_at)};
   }catch{}
   const signature=JSON.stringify({reading,localReady,status});
   if(signature===lastSignature&&now()-lastSent<15000)return {state:'UNCHANGED'};
   const sentAt=now();
   const r=await fetcher(config.cloudOrigin+'/api/champer/telemetry',{method:'POST',headers:{authorization:'Bearer '+config.deviceToken,'content-type':'application/json'},body:JSON.stringify({sourceId:config.sourceId,collectorId:config.collectorId,machine:'AUTO_CHAMPER',tag:'DXP|Device1|D100',sentAt,localReady,status,reading}),cache:'no-store',redirect:'error',signal:AbortSignal.timeout(10000)});
   if(!r.ok)throw Error('TELEMETRY_HTTP_'+r.status);
   lastSignature=signature;lastSent=sentAt;
   return {state:'TELEMETRY_SENT',eventId:reading?.eventId||null};
  }finally{busy=false;}
 }};
}
