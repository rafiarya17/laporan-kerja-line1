// Neon strips caller-supplied x-neon-* headers before invoking deployed Functions.
// Never accept a public request as a scheduler invocation.
const handler = {
  async fetch(request) {
    if(request.method!=='POST') return new Response('Method not allowed',{status:405});
    const invocation=request.headers.get('x-neon-trigger-invocation-id');
    let body;
    try {body=await request.json();} catch {return new Response('Invalid body',{status:400});}
    if(!invocation || body.invocation_id!==invocation || body.version!==1 || body.trigger?.type!=='schedule') return new Response('Unauthorized',{status:401});
    const url=process.env.LKH_DELIVERY_URL,secret=process.env.LKH_DELIVERY_SECRET;
    if(!url || !secret) return new Response('Not configured',{status:503});
    try {
      const result=await fetch(url,{method:'POST',headers:{authorization:'Bearer '+secret},signal:AbortSignal.timeout(85000)});
      console.log(JSON.stringify({event:'lkh_delivery_tick',status:result.status}));
      return Response.json({ok:result.ok},{status:result.ok?200:503});
    } catch {return Response.json({ok:false},{status:503});}
  }
};

export default handler;
