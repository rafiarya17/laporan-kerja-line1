import { cookie, endSession, sessionSeconds, sessionState, sameRequestOrigin, startSession } from "@/lib/operator-login";
function reply(data:unknown,status=200,setCookie?:string) {
  const headers=new Headers({"Cache-Control":"private, no-store"});
  if(setCookie)headers.set("Set-Cookie",setCookie);
  return Response.json(data,{status,headers});
}
export async function GET(req:Request) {
  try{return reply(await sessionState(req));}catch{return reply({error:"Status login belum tersedia. Coba lagi."},503);}
}
export async function POST(req:Request) {
  if(!sameRequestOrigin(req) || !req.headers.get("content-type")?.startsWith("application/json"))return reply({error:"Permintaan tidak valid."},403);
  try {
    const body=await req.json();
    if (body.action==="logout") {await endSession(req);return reply({ok:true},200,cookie("",0));}
    const nik=typeof body.nik==="string" ? body.nik.trim() : "";
    if(body.action!=="login" || !/^\d{6}(?:-?\d{2})?$/.test(nik))return reply({error:"Masukkan 6 angka pertama atau NIK lengkap sesuai kartu kerja."},400);
    if(process.env.VERCEL_ENV!=="production")return reply({error:"Login tidak aktif."},403);
    const result=await startSession(req,nik.replace(/^(\d{6})(\d{2})$/, "$1-$2"));
    return result.token ? reply({enabled:true,actor:result.actor},200,cookie(result.token,sessionSeconds)) : reply({error:result.error},result.status);
  } catch{return reply({error:"Layanan login belum tersedia. Coba lagi."},503);}
}
