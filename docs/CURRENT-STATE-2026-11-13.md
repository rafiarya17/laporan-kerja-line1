# CURRENT STATE REPORT — Berlindo Vercel / SQL intake

Audit and pilot release: 13 November 2026. This report covers the Vercel repository, deployment configuration and the tested manual-LKH integration. It is not a claim that every file and installed trigger of the separate live LINE 3 Apps Script project was audited. No live Apps Script source was edited.

## Baseline and ownership

- Repository: `rafiarya17/laporan-kerja-line1`.
- Vercel project: `berlindo-lkh`, region Singapore (`sin1`), Node 24.
- Runtime dependencies observed: Next.js 16.4.3, React 19.3.0, Neon serverless driver 1.2.0.
- Audited live baseline: `70e2daf6ca7ea3baf0a00059ff5527941aef6390`, branch `feat/portal-native-20261113`.
- SQL release code: `981fe47f86e6310c49dd3c5a526f40137ccf7288`, branch `sql-production-intake`. Production is deployed from this exact commit, with `LKH_SQL_INTAKE=pilot`.
- `main` is not the audited production baseline. Do not deploy `main` or an older portal branch assuming it contains the current release. Desktop work must merge the SQL release branch before its next production deployment, then recheck the live alias and preserve the environment gates.

## Current application map

| Surface | Endpoint / files | Current source of data |
|---|---|---|
| Portal and navigation | `/portal.html`, `public/portal-shell.js`, `public/portal-shell.css` | Native document navigation and protected session drafts; preserved from the desktop baseline |
| Operator manual LKH | `/`, `app/page.tsx`, `/api/submissions` | Line 99 commits to SQL first; all other lines still call the existing signed Apps Script receiver |
| Part, machine, operator master | `/api/master`, `lib/sql-intake.ts` | Existing signed live master, cached in SQL; production response preserves `source: live` required by portal readiness |
| Leader targets / review / revision | `/leader`, `/leader.html`, `/api/leader` | Existing Apps Script workspace; not migrated to SQL |
| Existing Telegram Line 99 gateway | `/api/line99` | Existing Telegram and Apps Script integration; unchanged |
| Champer / PLC / live monitor | `/pekerjaan.html`, `/champer-plc.html`, `/monitor-live.html`, `/api/champer/[...path]` | Existing PLC/Upstash bridge maintained by the desktop session; unchanged |
| Durable SQL intake | `lkh_reports`, `lkh_master_cache`, `lkh_delivery_worker` | Separate Neon production project; not the PLC store |
| Spreadsheet forwarding | `lib/sql-delivery.ts`, `/api/internal/lkh-delivery` | Original report ID and payload sent to existing Apps Script receiver, which owns downstream sheet processing |
| Recovery schedule | Neon Function `lkhretry` | Authenticated calls to the forwarding endpoint; 15-minute fallback during the current pilot |

## Verified behavior and limits

1. SQL acceptance is independent of the Apps Script delivery lease. The receipt means the report is durably stored, not that TF Slip is published.
2. Same report ID and payload can be retried without inserting another SQL row. Conflicting content retains the original ID for review.
3. Forwarding remains serialized because the destination is the existing spreadsheet system. It retries with the original ID, retains permanent validation failures for review, and recovers an expired worker lease.
4. Targets and leader revisions still belong to the old workflow. SQL currently stores the original intake payload, not an authoritative revised production view. Do not build the future TF Slip by assuming this raw payload already contains leader corrections.
5. Google Forms remain on their existing sheet path. There is no historical SQL backfill or automatic merger of GForm and SQL history in this release.
6. SQL master caching is bounded, not a new master-management system. A master removal between SQL validation and downstream validation can require manual review.
7. The current no-login leader endpoint uses origin checks as CSRF protection, not user identity. This existing choice was preserved; it should not be represented as authenticated leader authorization.
8. Current worker recovery cadence is appropriate for the limited pilot. Broad deployment needs a faster cadence and free-plan compute budgeting. Increasing polling consumes compute even when there are no reports.

## Verification evidence

- 144 automated tests passed, including the inherited portal tests and SQL activation gates. TypeScript, changed-file lint and Vercel build passed.
- Isolated database integration: 27 concurrent inserts, 27 retries of one ID, conflict rejection, invalid payload, competing workers, uncertain receiver response, review state and expired lease recovery passed. Downstream was a fake receiver for this load test; it is not a 27-operator live spreadsheet benchmark.
- Private Preview UI produced and persisted receipt `LKH99-0df8c5a2-8218-4270-8223-bd1c2be1d082`.
- Live production pilot receipt `LKH99-fb0d1195-e029-4dcc-bdf0-66ba0e694330` persisted once, was acknowledged by Apps Script, and appeared in existing leader review at source row 21.
- Dummy approval completed (request `33aa3cb2-315a-44f0-a136-310bfc52b1ec`, DONE). The existing leader read model reports PUBLISHED at TF Slip row **3478**, OK **137**, with a Line 99 test note. The live path from SQL intake through the existing leader approval to TF Slip was therefore exercised successfully.
- Scheduled worker invocation returned 200. Unauthenticated worker calls and a forged Neon trigger invocation returned 401.
- Full-repository lint has pre-existing CommonJS errors in unrelated scripts. No unrelated cleanup was included.

## Rollout status

The request to enable SQL intake for all production lines was rejected by automatic approval review because authorization was interpreted as covering the Line 99 pilot only. All-line activation has **not** happened. Keep the gate at `pilot` until explicit authorization is obtained. Do not route around that decision through a different environment API or code default.

Once authorized: recheck the production alias and desktop changes; merge any new baseline; configure the production retry cadence; deploy the reviewed code with `LKH_SQL_INTAKE=1`; verify master readiness and delivery health. Changing the Vercel environment alone does not change an already running deployment.

For rollback, disable new SQL intake in the same compatible code while retaining database and worker access to drain accepted reports. Do not delete SQL receipts or shut off the worker with pending jobs.

The next development phase is SQL-backed leader decisions with versioned revisions, followed by SQL-backed TF Slip and a version-aware spreadsheet mirror. Those are not part of this pilot release.
