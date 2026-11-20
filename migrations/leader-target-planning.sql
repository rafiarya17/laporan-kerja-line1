CREATE TABLE IF NOT EXISTS leader_cycle_catalog (
  singleton boolean PRIMARY KEY CHECK (singleton),
  source_date date NOT NULL,
  rates jsonb NOT NULL
);
CREATE TABLE IF NOT EXISTS leader_target_hours (
  production_date date NOT NULL,
  shift text NOT NULL,
  line text NOT NULL,
  version integer NOT NULL,
  items jsonb NOT NULL,
  PRIMARY KEY (production_date, shift, line, version)
);
