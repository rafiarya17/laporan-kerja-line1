# Web revisions deployment notes

Prepared against live AndonScript 13 Nov 2026 and receiver library version 11.
No production reports are changed during installation. Add `WebRevisionNov13.gs` to AndonScript.
In live `LeaderWorkspaceNov10.gs` apply these focused hooks (retain all other code):

- In `lw10Process_`, after LEADER_DISABLED check and before PILOT_ONLY check:
  `if(j && j.action === 'reviseProduction') return wr13Process_(j);`
- In `leaderWorkspaceApi`, after LEADER_DISABLED check, before action allowlist:
  `if(request && request.action === 'revisionDetail') return wr13Details_(request.payload);`
  `if(request && request.action === 'reviseProduction') return {ok:true,result:wr13Queue_(request.payload,lw10Actor_(request.leader))};`
- Both snapshot data objects add `revisionEnabled: ed19P_().getProperty('WEB_REVISION_ENABLED')==='1'`.
- `lw10Requests_` maps a DONE job whose result JSON has `state:REJECTED` to state ERROR and result.error, so conflicts are shown, not retried five times or displayed as success.

Create a new library version and pin receiver AndonPilot to that version; redeploy receiver preserving existing deployment URL. Run setupWebRevisionPilotNov13 first. Test dummy Line 99 only through this exact adapter. After successful TF update, run setupWebRevisionNov13 to allow production lines.

The source sheet is still authoritative for revisions; original SQL intake receipts stay immutable. Existing queue is the durable revision journal (before/after/request ID/actor/reason). No new trigger or additional queue. Existing source-sheet revision controls remain available. Snapshot revision fields are read live only when opened. Target management, PLC/Upstash and original submissions are unchanged.

Concurrency: web submissions use source hashes; the worker serializes writes using the existing lease. This is not an atomic spreadsheet transaction against simultaneous unrestricted manual sheet edits. Retaining legacy controls during rollout does not mean concurrent manual editing is recommended.

Limit: current report list contains PRODUKSI reports; separate DANDORI records are not included. No claim of SQL revision migration or a new SQL TF view is made. Existing TF publication and derived sync can still be delayed.

Deployment pending; do not treat repository presence as activation evidence.
