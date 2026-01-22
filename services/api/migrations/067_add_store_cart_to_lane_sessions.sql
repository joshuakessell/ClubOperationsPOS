ALTER TABLE lane_sessions ADD COLUMN IF NOT EXISTS store_cart_json JSONB NOT NULL DEFAULT '{}'::jsonb;
