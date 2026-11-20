-- Only the reviewed, public machine/shift and part KPI projection belongs here.
CREATE TABLE IF NOT EXISTS welding_dashboard_snapshot (
  captured_at timestamptz PRIMARY KEY,
  snapshot jsonb NOT NULL CHECK (
    jsonb_typeof(snapshot -> 'machines') = 'array' AND
    jsonb_typeof(snapshot -> 'parts') = 'array'
  )
);
