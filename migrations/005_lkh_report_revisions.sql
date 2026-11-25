CREATE TABLE IF NOT EXISTS lkh_report_revisions (
  request_id uuid PRIMARY KEY,
  report_id text NOT NULL REFERENCES lkh_reports(id),
  previous_version uuid NOT NULL,
  revised_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  actor text NOT NULL,
  reason text NOT NULL,
  previous_fields jsonb NOT NULL,
  fields jsonb NOT NULL,
  mirror_state text NOT NULL CHECK (mirror_state IN ('PENDING','APPLIED','REVIEW','TEST_ONLY')),
  next_attempt_at timestamptz NOT NULL DEFAULT now(),
  sheet_hash text,
  last_error text,
  UNIQUE(report_id, previous_version)
);
CREATE INDEX IF NOT EXISTS lkh_revision_delivery ON lkh_report_revisions(next_attempt_at) WHERE mirror_state='PENDING';
