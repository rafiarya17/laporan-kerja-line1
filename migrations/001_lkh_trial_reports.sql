BEGIN;
CREATE TABLE IF NOT EXISTS public.lkh_trial_reports (
  id text PRIMARY KEY CHECK (id ~* '^LKH99-[0-9a-f-]{36}$'),
  payload jsonb NOT NULL,
  received_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  is_test boolean NOT NULL DEFAULT true CHECK (is_test),
  CHECK (payload->>'id' = id),
  CHECK (payload->>'line' = 'LINE_99')
);
GRANT SELECT, INSERT, UPDATE ON public.lkh_trial_reports TO lkh_vercel_trial;
COMMIT;
