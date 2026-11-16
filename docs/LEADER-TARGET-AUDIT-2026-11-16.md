# Leader target master audit, 16 November 2026

Production was verified at `d28209f34c0db931c1c4a06b2aa084f38c4a694c`
(`fix/revision-search-nov16`, deployment `dpl_H57JX4UjPdNPshzXGEFQ8s1MBKbB`).
The Desktop branch was fast-forwarded to that commit before this change. SQL
manual intake, production revisions, operator form navigation changes, and
Champer cloud integration are preserved.

## Read-only findings

- All 184 active Line 1–8 machine/part combinations from MASTER_CT match the
  production leader snapshot exactly.
- All six Line 99 items match LINE99_MASTER: three AUTO CHAMPER parts and
  ASSY/PRESS/WELD dummy items. No master rows were modified.
- Request `ae5c266d-5043-4934-9cd9-e5035b991747` is absent from
  LEADER_TARGETS_V1 in the receiver workbook (bounded A1:J1000 search).
- Receiver editor and library source were inspected read-only: target validation
  compares exact line, machine and part. Snapshot master is cached for up to
  120 seconds; target validation reads master again. Line 99 is built from its
  pilot master for both paths.
- The original failed payload was unavailable, so the exact trigger for that
  request remains unconfirmed. A stale draft is possible, not a proven diagnosis.

## Changes

Valid submission closes the target dialog immediately and shows checking,
pending and final results on the page. A fresh snapshot checks target version
and catalog before sending. Unique same-line case/trim variants are resolved
to the authoritative spelling. Removed or ambiguous selections are listed for
manual correction; no rows or quantities are silently discarded.

Failures preserve the draft. Unconfirmed requests retain their original ID and
payload; a second save for the same date/shift/line is blocked until confirmation.
Successful replies clear only the corresponding unchanged draft, not another
date or line's draft. Existing receiver validation and version checks remain.

## Validation

- TypeScript compilation and 156 tests passed.
- Dedicated mocked-browser checks cover immediate close while pending,
  success/rejection, restored quantities, stale master, duplicate blocking and
  same-ID retry.
- All 11 native portal browser checks passed, including simulated Champer
  Start/End, quality, leader review, live monitoring, and separate manual form.
- No production target/report was submitted by these tests. No VB, Takebishi,
  PLC, collector or bridge change was made.
