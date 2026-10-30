# LKH Berlindo — reliable submission

Improves the original eight-line Next.js form. Production submission is off by default. Without a configured receiver, the form is labelled preview and sending stays disabled.

- Reset production details on line/machine changes; require an explicit shift.
- Validate active master selections, quantities, repair/reject explanations and completed times. Shift 2 midnight rollover uses Asia/Jakarta.
- Persist a pending report ID and exact payload before sending. Retry the same ID after network failure.
- Display a receipt only after confirmed storage. QUEUED is distinct from publication in TF Slip.
- Read machines, parts, categories and active operators through an authenticated server-side receiver. Default-line operators sort first; all active operators support cross-line work.
- Production credentials are scoped to Production only. Vercel previews always select test mode and cannot use production credentials. See the receiver setup notes for the authorized operational cutover and retained test ledger.
- Keep the original Google Forms mapping for migration reference; the new client no longer posts to formResponse or guesses pageHistory.

## Run and verify

```sh
npm ci
npm test
npm run lint
npm run build
npm run dev
```

Copy `.env.example` to `.env.local` for local configuration. Never commit secrets. See [receiver setup](docs/receiver-setup.md) for Vercel environment variables and Google authorization.

The receiver persists an immutable payload/hash before writing a source response row and deterministic STAGE job. It resumes interrupted writes by ID. Existing worker approval/auto-approval rules control publication. Submission does not promise immediate TF Slip publication.

Simulated integration tests cover validation, signing, test isolation, same-ID retries, payload conflicts and source/queue write interruptions. They do not establish live production compatibility. Verify source schemas, normalization, worker contract and Line 8 units/dandori in an isolated copy before enabling production.
