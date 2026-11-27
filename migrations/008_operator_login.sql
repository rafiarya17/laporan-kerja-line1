BEGIN;
ALTER TABLE lkh_operator_login_settings ADD COLUMN lookup_salt text NOT NULL DEFAULT gen_random_uuid()::text;
CREATE TABLE lkh_operator_accounts (
  id text PRIMARY KEY, lookup_hash text UNIQUE NOT NULL, name text NOT NULL,
  lines text[] NOT NULL, enabled boolean NOT NULL DEFAULT true
);
CREATE TABLE lkh_operator_sessions (
  token_hash text PRIMARY KEY, account_id text NOT NULL REFERENCES lkh_operator_accounts,
  expires_at timestamptz NOT NULL, report_id text
);
CREATE INDEX ON lkh_operator_sessions(expires_at);
CREATE TABLE lkh_operator_login_attempts (
  client_hash text PRIMARY KEY, window_start timestamptz NOT NULL, attempts integer NOT NULL
);
ALTER TABLE lkh_operator_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE lkh_operator_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE lkh_operator_login_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE lkh_reports ADD COLUMN submitted_by_operator_id text;
COMMIT;
