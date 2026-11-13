# Neon LKH trial

The neon-lkh-trial branch runs on protected Vercel Preview with a branch-scoped DATABASE_URL. Neon project berlindo-lkh-trial, database berlindo_lkh, branch trial, Singapore. Production cutover is pending.

## Trial workflow

1. Open /leader, select Line 99, production date and shift, and enter a leader name.
2. Save a machine/part target with target OK quantity.
3. Open the operator form at / and submit the same date, shift, machine and part.
4. Reload leader reports, inspect, revise with a reason, and approve individually or in bulk.
5. Approved reports show APPROVED_TEST. TF Slip delivery and Telegram updates remain pending.

Targets monitor item completeness and do not block report intake. Two different reports for the same machine/part count as two submissions and one reported target item. A multi-operator report counts once. Revisions preserve the original payload and record the effective payload, actor, reason, command ID and resulting version. Current trial revisions are available before approval.

## Schema and integrity

Apply migrations/001_lkh_trial_reports.sql then 002_lkh_trial_leader.sql using the database owner. Runtime role lkh_vercel_trial has the grants in those migrations. IDs deduplicate submission retries. Targets use expectedVersion and decisions use expectedHash to reject stale changes. Each leader mutation and its request receipt commit in one PostgreSQL transaction. Locks apply to a specific request, target, or report. Identical retries return their prior result.

## Verification on 13 November 2026

121 existing tests, TypeScript and changed-file lint passed. Three rounds of 27 submissions succeeded, including simultaneous same-ID retries and SQL reconciliation. A browser form submission with two operators and 123 OK pieces was verified in SQL. Latest measured submission service time was 8–79 ms, with remote client time 6.773–7.624 s. Shopfloor and scale-to-zero latency need measurement.

Leader API tests passed target save/retry, conflicting request rejection, two reports matching one target, multi-operator submission, revision/retry, stale version rejection and bulk approval. Browser verification showed one target item reported, two submissions, total OK 220 against target 300, and both reports approved. SQL retained original OK 100 and effective OK 120 for the revised report.

Run npm test, set NEON_TRIAL_PREVIEW_URL to an authorized Preview share URL, then run node scripts/neon-trial-smoke.cjs or node scripts/neon-leader-smoke.cjs. The submission test creates 29 dummy reports. The leader test creates a Line 99 target and two reports on 10 November 2026, Shift 1.

## Remaining work

Master-sheet synchronization, production Google Forms ingestion, durable TF Slip publishing, Telegram status delivery, and operational cutover require further integration and testing. Future deployment can use the current production web-form address. Current trial is isolated to its Preview URL and dummy master.
