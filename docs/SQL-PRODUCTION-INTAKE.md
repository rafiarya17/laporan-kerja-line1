# SQL intake for the existing LKH form

Status, 13 November 2026: deployed to the production URL with SQL intake enabled for **Line 99 only** (`LKH_SQL_INTAKE=pilot`). Other lines retain the existing receiver path. Based on the latest audited native portal commit `70e2daf6ca7ea3baf0a00059ff5527941aef6390`; release code commit `981fe47f86e6310c49dd3c5a526f40137ccf7288`.

Production deployment: `dpl_Ew86F1CNiFnmBuCsyoaSmBxfs7oG`, https://berlindo-lkh.vercel.app/. Preview: `dpl_CYajYhHZsNeKAsS7iGCaAqQ55dEW`, isolated trial database. Source and review: https://github.com/rafiarya17/laporan-kerja-line1/pull/3.

The existing `/api/submissions` route gains a gated SQL intake path. `SQL_SAVED` confirms a committed PostgreSQL report. That same row is the durable delivery job. It does not confirm leader approval or TF Slip publication. The original payload and ID are forwarded unchanged to the existing signed Apps Script receiver. Existing production leader and TF Slip behavior continues after the receiver accepts the report.

## Activation gates

- Production supports `LKH_SQL_INTAKE=pilot` (Line 99 only) or `1` (all manual web-form lines), `DATABASE_URL`, and the existing production receiver configuration.
- Preview requires an additional `LKH_SQL_PREVIEW=1` and an isolated database. It uses dummy Line 99 master data. The default worker cannot forward to production from Preview.
- `LKH_DELIVERY_SECRET` protects `/api/internal/lkh-delivery`. It must never be exposed to the browser or committed.
- Do not enable production intake until the scheduled retry function is deployed, authenticated, and observed successfully invoking the worker. Immediate `after()` delivery alone is not a durable scheduler.
- Production and branch-scoped Preview environments have now been configured with separate database connections and worker secrets. The later attempt to change production from `pilot` to `1` was rejected by automatic approval review because all-line activation required more explicit authorization. Do not bypass this rejection. Production remains `pilot` until that authorization is supplied.

## Persistence and retries

`migrations/003_lkh_production_intake.sql` creates `lkh_reports`, `lkh_master_cache`, and `lkh_delivery_worker`. It has been applied to the isolated trial project and production project `sweet-wave-04798116`, database `berlindo_lkh`, branch `br-broad-shadow-azse90y0`. The production SQL project currently contains the Line 99 integration test, not a backfill of historical operator reports.

A report ID is unique. Same-ID/same-payload retries return the original receipt timestamp. A different payload with that ID returns `ID_PAYLOAD_CONFLICT` and retains the pending ID, including for older clients that unlock on 4xx. Previously accepted reports are resolved before validating current master data.

The Apps Script worker is serialized through a short SQL lease. Operator insertion never waits for that worker lease. The worker sends the original payload with the same ID. Only a matching production `QUEUED` receiver receipt marks `DELIVERED`. Timeouts are retried with exponential delay capped at 15 minutes. Conflicts, removed sources, cancellation, and invalid reports are retained as `NEEDS_REVIEW`. The protected GET endpoint exposes counts, oldest pending timestamps, and review IDs without returning report payloads.

`functions/lkhretry/index.mjs` is deployed as Neon Function `lkhretry`, deployment 1. It accepts authenticated Neon schedule invocations and calls the protected Vercel worker. Trigger `trigger-fbf6659e-10fa-4170-a0cb-5ebcb7b872ac` successfully invoked the worker with HTTP 200 at 08:37 UTC during a one-minute cadence test. Public requests and forged trigger headers returned HTTP 401.

The retained **pilot** schedule is `*/15 * * * *` UTC to limit idle compute use on the Free project. Immediate after-response delivery still runs for each accepted SQL submission. Recovery can therefore wait up to the scheduler interval, plus backoff and backlog. This pilot cadence is not a throughput promise for 27 live submissions: a serialized Apps Script backlog could require multiple runs. Before all-line activation, configure and validate a faster recovery cadence and its compute budget. Continuous one-minute SQL polling prevents idle suspension and consumes the Free allowance; an event-driven drain is a future optimization. No paid plan was activated.

Each SQL HTTP request has a fresh 12-second timeout. An uncertain commit never causes an automatic new ID. A crashed worker lease expires, and the unchanged ID is retried at the receiver.

## Master synchronization

The form refreshes its SQL master cache from the signed live master endpoint when the cached master is older than 60 seconds. Submission validation can use a cache up to 15 minutes old, to avoid making every operator wait for Apps Script after filling out the form. This is a bounded cache, not a full master-data migration. The receiver still validates new downstream submissions against its current rules; a removed part may therefore need admin review after SQL acceptance.

## Boundaries

- Existing Google Forms still use their existing spreadsheet path.
- Production leader targets, revisions, approval and TF Slip remain on the existing downstream workflow.
- Preview SQL intake data is separate from the earlier SQL trial leader tables. It does not automatically appear in that earlier trial dashboard.
- Existing spreadsheet history is not backfilled into SQL.
- No live Apps Script code, PLC logic or Upstash data is changed by this patch.

## Verification

- `npm test` passes 144 tests including current portal tests, SQL pilot/production/Preview gates, receipt identity checks, retryable failure classification and preservation of review failures.
- TypeScript and ESLint on changed files pass.
- `npm run build` completes. The existing preferredRegion deprecation warning remains.
- Full-repository lint still reports pre-existing CommonJS import errors in unrelated scripts.
- `scripts/sql-intake-integration.cjs` runs against only the isolated trial database. It covers 27 concurrent inserts, 27 retries of one ID, conflicting payload, invalid report, competing delivery workers, timeout recovery, review state and expired-lease recovery. Its fake downstream never contacts Apps Script. The first remote runs encountered a database HTTP timeout through the work environment proxy; a proxy-adjusted run uses a 120-second query deadline only inside the guarded integration harness. Production retains its 12-second deadline. These remote harness timings must not be presented as shopfloor or regional Vercel latency.
- The isolated integration run passed all listed assertions, including competing worker leases, timeout recovery, review state and expired-lease recovery. Its 27 concurrent inserts took 24.863–25.063 seconds across the remote proxy; this is not a production latency result.
- Private Preview browser test passed: `LKH99-0df8c5a2-8218-4270-8223-bd1c2be1d082`, BODY_DUMMY-PN99001, PRESS DUMMY, 137 OK, OPERATOR TEST A + HELPER TEST B. UI displayed SQL receipt and Neon held the matching payload. Preview intentionally did not forward it to production.
- Live pilot test passed: `LKH99-fb0d1195-e029-4dcc-bdf0-66ba0e694330`, same dummy data, 2026-11-13 shift 1. SQL committed at 08:36:46.902 UTC; receiver acknowledged QUEUED at 08:36:51.970; SQL recorded DELIVERED at 08:36:59.403. A same-ID retry returned the original receipt, with exactly one SQL row and one forwarding attempt.
- Production server processing measured 107 ms for the initial SQL acceptance and 54 ms for its retry. The remote client round trip was about 8.2 seconds, so these server timings must not be marketed as the operator's end-to-end latency or a load SLA.
- Existing leader snapshot found the same dummy ID at source row 21, then WAITING_LEADER with no validation error. Downstream approval and TF Slip publication remain distinct from SQL acceptance and delivery acknowledgement.
- End-to-end pilot completed: approval request `33aa3cb2-315a-44f0-a136-310bfc52b1ec` reached DONE. Existing leader snapshot reports PUBLISHED, TF row **3478**, matching published OK quantity **137**, with test note `UJI LINE 99` and result `TERBIT; KPI DIPERBARUI 15:42:22`. This confirms the existing read model found the dummy in TF Slip; no real operator output was approved by this test.

## Rollback

For an intake rollback, deploy this SQL-compatible code with `LKH_SQL_INTAKE` disabled; the authenticated worker endpoint remains available with its database and secret. Keep the worker and database available while draining any accepted SQL jobs. Restore the prior application deployment only after reviewing pending and review rows. Switching the intake feature flag off must not be used to abandon already accepted SQL reports. Do not delete receipt rows to resolve retries.
