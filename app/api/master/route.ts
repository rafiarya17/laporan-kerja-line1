import { sqlIntakeEnabled, intakeMaster } from "@/lib/sql-intake";
import snapshot from "@/constants/formMapping.json";
import {portalPreview,previewMaster,previewHeaders} from '@/lib/portal-preview';
import type { Master } from "@/lib/lkh";
import { callReceiver, receiverMode, receiverReady } from "@/lib/receiver";

export async function GET() {
  if (sqlIntakeEnabled()) {
    try { return Response.json({...await intakeMaster(), mode: process.env.VERCEL_ENV === "preview" ? "test" : "production", ready: true, source: process.env.VERCEL_ENV === "preview" ? "sql-preview" : "sql-master"}, {headers:{"Cache-Control":"no-store"}}); }
    catch { return Response.json({ready:false, mode:"production", source:"offline", mapping:{}, version:"unavailable"}, {status:503,headers:{"Cache-Control":"no-store"}}); }
  }
  if(portalPreview())return Response.json(previewMaster(),{headers:previewHeaders});
  if (receiverReady()) {
    try {
      const result = await callReceiver("master", {});
      if (!result.mapping || !Object.keys(result.mapping).length || typeof result.version !== "string") throw new Error("INVALID_MASTER");
      return Response.json({ mapping: result.mapping, version: result.version, mode: receiverMode(), ready: true, source: "live" }, { headers: { "Cache-Control": "no-store" } });
    } catch {
      // Keep the screen usable, but never submit against a stale master.
    }
  }
  const mapping: Master = Object.fromEntries(Object.entries(snapshot).map(([line, config]) => [line, { operators: config.operators, mesin_part_mapping: Object.fromEntries(Object.entries(config.mesin_part_mapping).map(([machine, v]) => [machine, { options: v.options }])) }]));
  return Response.json({ mapping, version: "snapshot-2026-10-29", mode: receiverMode(), ready: false, source: "snapshot" }, { headers: { "Cache-Control": "no-store" } });
}
