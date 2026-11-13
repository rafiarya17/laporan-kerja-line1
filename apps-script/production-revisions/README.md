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

## Verified deployment — 13 November 2026

- AndonScript library version 12; receiver version 18 pins AndonPilot 12, preserving its existing deployment URL and access settings.
- Vercel production code: `237f66d6415e1382638b4614c5f458d4519992b1`, deployment `dpl_8NrR4EXYFU33LMS2H1NUDEvMRYmc`.
- `setupWebRevisionNov13` completed at 16:58:00 WIB: WEB_REVISION_ENABLED=1; WEB_REVISION_LINES=LINE_1 through LINE_8 plus LINE_99.
- Live dummy restoration through the web alone: report `LKH99-fb0d1195-e029-4dcc-bdf0-66ba0e694330`, request `1bf17ba0-ba2b-48a3-9a44-1d97cdc384e6`, OK 138 to 137. TF DATA PRODUKSI row 3478 retained the same ID and IS_TEST=TRUE, showed 137 at 16:54; worker log confirmed ED19_JOB_DONE LEADER_ACTION at 16:54:49. Acceptance was 16:51:22; this single-test timing is not an SLA.
- 153 tests passed, changed-file lint and TypeScript passed, Vercel production build READY. No real production report was modified in testing.
- A Unicode request exposed HMAC/decoding mismatch. Vercel now serializes non-ASCII characters as JSON Unicode escapes before signing, with explicit UTF-8 content type; parsed business data is unchanged.
- Existing source-sheet correction controls are retained as fallback. Use one revision surface per report at a time. The no-login page records a self-declared leader name, not authenticated identity.

Rollback of this adapter: set WEB_REVISION_ENABLED=0 (after checking/draining accepted LEADER_ACTION revisions); leave original intake, source sheets and existing worker intact. Do not delete accepted revision jobs.

