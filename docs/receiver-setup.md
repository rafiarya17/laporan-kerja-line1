# Deployment and acceptance

1. Create a NEW standalone Apps Script project and paste `apps-script/LkhIntakeCore.gs` followed by `apps-script/LkhReceiver.gs` into Code.gs. Do not replace AndonScript.
2. Set MASTER_SPREADSHEET_ID privately in Script Properties, then run `setupLkhTestReceiver` once. Google may require the account owner to authorize spreadsheet access. This creates a dedicated test ledger and random signing secret in Script Properties; production stays disabled.
3. Deploy as a Web app executing as its owner. The Vercel server must call it without an interactive Google login. Every operation, including master reads, requires an HMAC signature. The owner must review deployment permissions.
4. Configure the resulting `/exec` URL as `LKH_TEST_URL` and the matching Script Property `RECEIVER_SECRET` as server-only `LKH_TEST_SECRET` in Vercel. Never use a NEXT_PUBLIC prefix. Redeploy.
5. Verify `/api/master` returns `ready:true`, `mode:test`, `source:live`. Submit a completed test report and confirm exactly one test-ledger receipt with no production LKH/PPC row. Test same-ID retry, midnight shift 2, Line 8 dandori and mobile layout.

## Production cutover after acceptance

Use a SECOND receiver project, separate secret and separate receipt workbook. Set RECEIVER_MODE=production, MASTER_SPREADSHEET_ID, RECEIPT_SPREADSHEET_ID and reviewed SOURCES_JSON configured privately as an object mapping LINE_1 through LINE_8 to {id, sheet}.

Verify each source sheet still contains the exact `Nama Part — <canonical machine>` and `ID LKH (otomatis)` columns. Inspect the live source manifest privately before activation; do not commit operational workbook IDs. Verify `_ANTREAN_ANDON` layout and worker registration before setting PPC_SPREADSHEET_ID. The receiver writes STAGE explicitly because programmatic Sheets writes do not fire Form submit triggers.

Verify normalization and stable IDs in a copy before setting PRODUCTION_ENABLED=1. Preserve source rows because downstream publication rechecks them. Then configure LKH_PRODUCTION_URL, LKH_PRODUCTION_SECRET and LKH_MODE=production in Vercel Production only. Preview remains test-only. Do not share secrets or ledgers across receiver projects.

QUEUED confirms source/queue writes, not publication or TF Slip refresh. Monitor worker results separately. Roll back by switching LKH_MODE=test or removing production variables and redeploying. Keep accepted source/ledger rows for audit, and preserve pending IDs when retrying.

## Limits

## Google Form intake hardening (30 October)

Install `LkhIntakeCore.gs` and `AndonIntakeOct30.gs` in AndonScript. Preserve a data-only snapshot of EventDrivenOct19.gs before changing its two entry points:

- Keep the disabled-mode fallback in `ed19LkhSubmit`; replace only the enabled path with `return ed30AcceptForm_(e);`.
- In `ed19Worker`, call `ed30RecoverPendingIntake_()` immediately after the enabled guard, before the existing worker lease.

The handler retains the source's stable ID and saves a pending source pointer before waiting for ScriptLock. Verified enqueue clears that intent. The existing worker retries up to ten retained intents per invocation; it does not scan all response sheets. Missing/duplicate source IDs remain held. The shared helper verifies STAGE payload/state and wakes the existing queue, retries interrupted writes, and reuses legacy jobs. Revision submission, approval policy, KPI, Telegram, packing and TF Slip code are unchanged.

Run `ed30VerifyIsolatedIntake` before routing live submissions through it. It creates a separate test workbook and tests real Sheets duplicate prevention, lost acknowledgement, wakeup failure, legacy jobs and a ten-report burst. It never writes to the production queue. Run `ed30IntakeHealth`, existing direct-mode diagnostics, and the worker after activation. Keep the web deployment in test mode until its production source/normalization acceptance is complete.

Rollback: restore the backed-up EventDrivenOct19.gs. Leave retained `ED30_INTAKE_` source pointers intact for review. The added helper files alone do not change handlers or triggers.

Idempotency applies to the same ID and payload, not independently created reports describing identical work. Local drafts/outbox are browser-specific; clearing browser data removes recovery. The signing secret authenticates the Vercel server, not individual operators. Keep the new deployment protected during acceptance. Never remove production test rows as cleanup; use the isolated test receiver.
