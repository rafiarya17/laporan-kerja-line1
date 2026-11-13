-- Production intake and its durable delivery job are one row / one commit.
CREATE TABLE IF NOT EXISTS lkh_reports (
  id text PRIMARY KEY CHECK (id ~* '^LKH(99)?-[0-9a-f-]{36}$'),
  payload jsonb NOT NULL CHECK (jsonb_typeof(payload) = 'object'),
  received_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  master_version text NOT NULL,
  delivery_state text NOT NULL DEFAULT 'PENDING' CHECK (delivery_state IN ('PENDING','DELIVERED','NEEDS_REVIEW')),
  attempts integer NOT NULL DEFAULT 0,
  next_attempt_at timestamptz NOT NULL DEFAULT now(),
  last_error text,
  downstream_receipt jsonb,
  delivered_at timestamptz
);
CREATE INDEX IF NOT EXISTS lkh_reports_pending ON lkh_reports(next_attempt_at,received_at) WHERE delivery_state='PENDING';
CREATE TABLE IF NOT EXISTS lkh_master_cache (
  id boolean PRIMARY KEY DEFAULT true CHECK(id),
  mapping jsonb NOT NULL,
  version text NOT NULL,
  refreshed_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
-- This lease serializes ONLY Apps Script delivery, never operator intake.
CREATE TABLE IF NOT EXISTS lkh_delivery_worker (
  id boolean PRIMARY KEY DEFAULT true CHECK(id),
  owner uuid,
  lease_until timestamptz NOT NULL DEFAULT '-infinity',
  last_run_at timestamptz,
  last_error text
);
INSERT INTO lkh_delivery_worker(id) VALUES(true) ON CONFLICT DO NOTHING;
