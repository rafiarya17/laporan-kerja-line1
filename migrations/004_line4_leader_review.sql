-- A non-null value marks a Line 4 web submission enrolled in leader review.
-- Pending approval uses next_attempt_at = infinity; old workers also skip it.
ALTER TABLE lkh_reports ADD COLUMN IF NOT EXISTS leader_review jsonb;
