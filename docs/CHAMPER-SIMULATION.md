# Target-to-session Champer simulation

Base: `feat/leader-workspace-vercel-20261111` at `2aabf0ca0e26f334353736479d6d15900e168621`.

Open `/champer-simulasi.html`. This is a browser-only UX/state-machine pilot in the existing leader repository, not a cloud session backend. It never calls submissions, PLC, Takebishi, or the local collector. The only network request in the new client is an explicitly requested read-only leader target snapshot. Preview origins remain subject to the existing gateway restrictions; no production secrets or origin allowlist changes are needed.

Sample targets work without the backend. A sample leader editor persists versioned machine/part targets locally. Live target snapshots, when the host is authorized by the existing gateway, are copied read-only and filtered to exactly AUTO CHAMPER on LINE_1. No fuzzy machine match. This is not confirmation of physical PLC mapping.

The session captures the target version/context and supports multiple example operators without multiplying quantity. Each action has an ID, stale-tab revision checks, and browser Web Locks; at most one unfinished Champer session is allowed per browser storage. This does NOT lock machines across tablets. Data remains on this browser/origin, and private mode/storage clearing can remove it. Export JSON evidence before deleting browser data. Existing production localStorage keys are untouched.

## First guided test

1. Open the simulation page. Leave Takebishi and VB unchanged; neither is required.
2. Select PART-CONTOH-A and Operator Contoh A, then Siapkan pekerjaan.
3. Mulai pekerjaan: initial cumulative example counter is 1000.
4. Tambah 12 pcs contoh, then Akhiri pekerjaan: end 1012, delta 12.
5. Enter OK 12, repair 0, reject 0, Kendala Tidak. Save the simulation.
6. Reload: the completed session and stable SIM-LKH ID remain in history.

Additional scenarios: timeout on start/end keeps values absent until retry; counter decrease blocks completion; repair/reject require problem details; two tabs cannot overwrite the same revision; target edits do not rewrite completed sessions; a second session can use the same target after completion. Sample quality assumes exclusive OK/repair/reject buckets summing to delta. This assumption is for simulation only and must not determine production OK from the real PLC.

## Before real integration

Implement authenticated durable cloud sessions, per-machine locks across devices, outbound PC command/result bridge, stable target-item identity/version and report-ID mapping, full LKH problem-time fields/validation, live master/operator mapping and shift-date handling. Confirm counter units, BCD/reset/overflow and repair policy. Preserve receipt/revision/TF pipeline; a simulator completion must never be published. Current form, leader targets, approvals and TF pipeline remain unchanged.

Test core independently with `node --test tests/champer-simulation.cjs`; existing `npm test` also discovers it. UI requires HTTPS or localhost with Web Locks support. Test sample path without enabling any live data mutation.
