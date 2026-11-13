# SQL intake for the existing LKH form

Status: prepared and locally tested; not enabled on the production site. Based on the production portal commit `292b62747df32af75ae66bf9f6b6da65eb1b3c87`.

The existing `/api/submissions` route gains a gated SQL intake path. `SQL_SAVED` confirms a committed PostgreSQL report. That same row is the durable delivery job. It does not confirm leader approval or TF Slip publication. The original payload and ID are forwarded unchanged to the existing signed Apps Script receiver. Existing production leader and TF Slip behavior continues after the receiver accepts the report.

## Activation gates

- Production requires `LKH_SQL_INTAKE=1`, `DATABASE_URL`, and the existing production receiver configuration.
- Preview requires an additional `LKH_SQL_PREVIEW=1` and an isolated database. It uses dummy Line 99 master data. The default worker cannot forward to production from Preview.
- `LKH_DELIVERY_SECRET` protects `/api/internal/lkh-delivery`. It must never be exposed to the browser or committed.
- Do not enable production intake until the scheduled retry function is deployed, authenticated, and observed successfully invoking the worker. Immediate `after()` delivery alone is not a durable scheduler.
- Vercel environment creation was rejected by automatic approval review during preparation. No new environment variables were applied, no production deployment was made, and no scheduler was activated.

## Persistence and retries

`migrations/003_lkh_production_intake.sql` creates `lkh_reports`, `lkh_master_cache`, and `lkh_delivery_worker`. It has been applied to the isolated trial project and the new production project. The latter has no operator data.

A report ID is unique. Same-ID/same-payload retries return the original receipt timestamp. A different payload with that ID returns `ID_PAYLOAD_CONFLICT` and retains the pending ID, including for older clients that unlock on 4xx. Previously accepted reports are resolved before validating current master data.

The Apps Script worker is serialized through a short SQL lease. Operator insertion never waits for that worker lease. The worker sends the original payload with the same ID. Only a matching production `QUEUED` receiver receipt marks `DELIVERED`. Timeouts are retried with exponential delay capped at 15 minutes. Conflicts, removed sources, cancellation, and invalid reports are retained as `NEEDS_REVIEW`. The protected GET endpoint exposes counts, oldest pending timestamps, and review IDs without returning report payloads.

`functions/lkhretry/index.mjs` is a scheduler handler. It accepts authenticated Neon schedule invocations and calls the protected Vercel worker. No trigger has been created. A free-plan trial can use a less frequent fallback (for example every 15 minutes), while immediate after-response delivery handles normal submissions. This fallback can delay recovery by that interval. A one-minute SQL poll keeps a Free-plan compute awake and can exhaust its monthly compute allowance. Final scheduling and quota verification remain deployment gates.

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

- `npm test` passes 143 tests including the current portal tests, including receipt identity checks, retryable failure classification and preservation of review failures.
- TypeScript and ESLint on changed files pass.
- `npm run build` completes. The existing preferredRegion deprecation warning remains.
- Full-repository lint still reports pre-existing CommonJS import errors in unrelated scripts.
- `scripts/sql-intake-integration.cjs` runs against only the isolated trial database. It covers 27 concurrent inserts, 27 retries of one ID, conflicting payload, invalid report, competing delivery workers, timeout recovery, review state and expired-lease recovery. Its fake downstream never contacts Apps Script. The first remote runs encountered a database HTTP timeout through the work environment proxy; a proxy-adjusted run uses a 120-second query deadline only inside the guarded integration harness. Production retains its 12-second deadline. These remote harness timings must not be presented as shopfloor or regional Vercel latency.
- The isolated integration run passed all listed assertions, including competing worker leases, timeout recovery, review state and expired-lease recovery. Its 27 concurrent inserts took 24.863–25.063 seconds across the remote proxy; this is not a production latency result.
- Preview deployment, browser flow, real receiver acknowledgement using a dummy Line 99 report, and a scheduled retry invocation still need verification before rollout.

## Rollback

For an intake rollback, deploy this SQL-compatible code with `LKH_SQL_INTAKE` disabled; the authenticated worker endpoint remains available with its database and secret. Keep the worker and database available while draining any accepted SQL jobs. Restore the prior application deployment only after reviewing pending and review rows. Switching the intake feature flag off must not be used to abandon already accepted SQL reports. Do not delete receipt rows to resolve retries.
