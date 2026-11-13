# Neon LKH trial

The branch neon-lkh-trial stores Line 99 dummy reports in Neon through the existing form and POST /api/submissions. Preview deployments with DATABASE_URL use a dedicated dummy master. The database project is berlindo-lkh-trial in Singapore, with database berlindo_lkh and branch trial. DATABASE_URL is a sensitive Vercel variable scoped to this Git branch in Preview.

Apply migrations/001_lkh_trial_reports.sql using the database owner. Application role lkh_vercel_trial has access to the report table. A primary key resolves concurrent retries. An identical payload returns the original receipt and receivedAt. A changed payload with an existing ID returns HTTP 409 with clearPending=false. TEST_SAVED is returned after the SQL statement completes.

## Verification on 13 November 2026

- Existing repository suite passed 121 tests. TypeScript and lint passed for changed files.
- Three rounds of 27 different concurrent submissions succeeded.
- Each round also sent one ID concurrently 27 times and checked identical receipts.
- Each round verified an ordinary retry, a conflicting payload, invalid duration, and a production line rejection.
- Database reconciliation confirmed 29 unique rows for each inspected test run.
- A browser form submission with 123 OK pieces and OPERATOR TEST A plus HELPER TEST B produced ID LKH99-150996bb-2b97-466e-b27f-e29e4189efde. Its payload was verified in SQL.
- Latest measured burst took 6.773–7.624 seconds from the remote test client, with P95 7.620 seconds. Server-Timing reported 8–79 milliseconds inside the submission service. These measurements do not establish shopfloor device latency or cold-start latency after scale-to-zero.

Run npm test, then set NEON_TRIAL_PREVIEW_URL to an authorized Vercel preview share URL and run node scripts/neon-trial-smoke.cjs. This writes 29 dummy reports. Credentials and share URLs belong in environment variables.

## Remaining integration

The trial uses its own dummy master. Master sheet synchronization, production LKH intake, leader verification/revisions, and TF Slip delivery still use the existing system. The current leader gateway requires a production receiver and rejects Preview origins. End-to-end Neon approval and TF Slip delivery therefore require a dedicated bridge and tested report/version mapping. Build that bridge with durable delivery state, stable report IDs, and retry reconciliation before production cutover. Google Forms also need an ingestion path if both form channels are to share Neon.
