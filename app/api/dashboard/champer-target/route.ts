import {callReceiver,receiverMode,receiverReady} from '@/lib/receiver';
import {shiftPlan} from '@/lib/champer-live-work';
import {workShift} from '@/lib/welding-shift';

export const dynamic='force-dynamic';
export const maxDuration=90;

export async function GET() {
  try {
    if(receiverMode()!=='production'||!receiverReady())throw Error('RECEIVER_UNAVAILABLE');
    const period=workShift(new Date());
    const {workspace}=await callReceiver('leader',{
      action:'snapshot',phase:'targets',line:'LINE_99',date:period.date,shift:String(period.shift)
    },65000);
    if (!workspace?.ok) throw Error('TARGET_UNAVAILABLE');
    return Response.json(shiftPlan(workspace.data,period),{headers:{'Cache-Control':'public, max-age=0, s-maxage=25'}});
  } catch {
    return Response.json({error:'TARGET_UNAVAILABLE'},{status:503,headers:{'Cache-Control':'no-store'}});
  }
}
