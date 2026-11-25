ALTER TABLE leader_cycle_catalog ADD COLUMN IF NOT EXISTS part_specs jsonb NOT NULL DEFAULT '{}'::jsonb;
