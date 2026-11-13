import {callReceiver, receiverMode, receiverReady} from '@/lib/receiver';
import {portalPreview,previewWorkspace,previewBlocked,previewHeaders} from '@/lib/portal-preview';
export const maxDuration=120;
const origins=new Set(['https://berlindo-miniapp-lab.smartboy1.chatgpt.site','https://berlindo-miniapp-lab.ardentacorn21.chatgpt.site','https://berlindo-lkh.vercel.app']);
function headers(r:Request){const h=new Headers({'Cache-Control':'no-store','Vary':'Origin'}),o=r.headers.get('origin');if(o&&origins.has(o)){h.set('Access-Control-Allow-Origin',o);h.set('Access-Control-Allow-Methods','POST, OPTIONS');h.set('Access-Control-Allow-Headers','Content-Type');}return h;}
export async function OPTIONS(r:Request){return new Response(null,{status:origins.has(r.headers.get('origin')||'')?204:403,headers:headers(r)});}
// Owner-requested no-login workspace. Origin checks are CSRF defense, not identity authentication.
// The receiver enforces Line 99 approval boundaries independently of this public gateway.
export async function POST(r:Request){
 if(portalPreview()){
  try{const b=await r.json();if(b.action!=='snapshot')return previewBlocked();return Response.json(previewWorkspace(String(b.date||''),String(b.shift||'1'),String(b.line||'')),{headers:previewHeaders});}
  catch{return Response.json({ok:false,error:'INVALID_JSON'},{status:400});}
 }
 const h=headers(r),reply=(x:unknown,status=200)=>Response.json(x,{status,headers:h});
 if(!origins.has(r.headers.get('origin')||''))return reply({ok:false,error:'ORIGIN_NOT_ALLOWED'},403);
 if(!receiverReady()||receiverMode()!=='production')return reply({ok:false,error:'LEADER_NOT_CONFIGURED'},503);
 try{
 if(Number(r.headers.get('content-length')||0)>26000)return reply({ok:false,error:'REQUEST_TOO_LARGE'},413);
 const text=await r.text();if(Buffer.byteLength(text)>26000)return reply({ok:false,error:'REQUEST_TOO_LARGE'},413);
 let body;try{body=JSON.parse(text);}catch{return reply({ok:false,error:'INVALID_JSON'},400);}
 if(!['snapshot','target','submit','decide','decideBatch'].includes(body?.action))return reply({ok:false,error:'INVALID_ACTION'},400);
 const result=await callReceiver('leader',body,65000);
 if(typeof result.workspace?.ok!=='boolean')return reply({ok:false,error:'LEADER_UNCONFIRMED'},503);
 return reply(result.workspace,result.workspace.ok?200:409);
 }catch{return reply({ok:false,error:'LEADER_UNCONFIRMED_RETRY_SAME_ID'},503);}
}
