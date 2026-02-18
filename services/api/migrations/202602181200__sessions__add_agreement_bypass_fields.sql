-- Add agreement bypass fields to lane_sessions.
-- These columns were archived in _archive/067_add_agreement_bypass_fields.sql
-- but never promoted to the active migration set after the baseline was created.
-- up migration
ALTER TABLE lane_sessions
  ADD COLUMN IF NOT EXISTS agreement_bypass_pending BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS agreement_signed_method VARCHAR(16);
-- down migration
ALTER TABLE lane_sessions
  DROP COLUMN IF EXISTS agreement_signed_method,
  DROP COLUMN IF EXISTS agreement_bypass_pending;
