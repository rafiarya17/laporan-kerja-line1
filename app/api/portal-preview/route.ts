import {portalPreview,previewHeaders,previewMaster,previewWorkspace} from '@/lib/portal-preview';
export const dynamic='force-dynamic';
export async function GET(r:Request){
  if(!portalPreview())return Response.json({enabled:false},{status:404,headers:previewHeaders});
  const q=new URL(r.url).searchParams;
  const date=q.get('date')||new Date().toISOString().slice(0,10),shift=q.get('shift')==='2'?'2':'1';
  return Response.json({enabled:true,...previewMaster(),workspace:previewWorkspace(date,shift).data},{headers:previewHeaders});
}
