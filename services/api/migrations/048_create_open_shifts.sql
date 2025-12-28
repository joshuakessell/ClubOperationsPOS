-- Open shift posting and claim tables

CREATE TYPE open_shift_status AS ENUM ('OPEN', 'CLAIMED', 'CANCELED', 'EXPIRED');
CREATE TYPE open_shift_offer_status AS ENUM ('SENT', 'CLAIMED', 'EXPIRED', 'CANCELED');

CREATE TABLE IF NOT EXISTS open_shifts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  starts_at TIMESTAMPTZ NOT NULL,
  ends_at TIMESTAMPTZ NOT NULL,
  shift_code TEXT NOT NULL CHECK (shift_code IN ('A', 'B', 'C')),
  role TEXT,
  status open_shift_status NOT NULL DEFAULT 'OPEN',
  created_by UUID REFERENCES staff(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  claimed_by UUID REFERENCES staff(id) ON DELETE SET NULL,
  claimed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_open_shifts_status ON open_shifts(status);
CREATE INDEX IF NOT EXISTS idx_open_shifts_times ON open_shifts(starts_at, ends_at);

CREATE TABLE IF NOT EXISTS open_shift_offers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  open_shift_id UUID NOT NULL REFERENCES open_shifts(id) ON DELETE CASCADE,
  staff_id UUID NOT NULL REFERENCES staff(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,
  sent_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  claimed_at TIMESTAMPTZ,
  status open_shift_offer_status NOT NULL DEFAULT 'SENT'
);

CREATE INDEX IF NOT EXISTS idx_open_shift_offers_shift ON open_shift_offers(open_shift_id);
CREATE INDEX IF NOT EXISTS idx_open_shift_offers_staff ON open_shift_offers(staff_id);

-- Audit actions for open shifts
ALTER TYPE audit_action ADD VALUE IF NOT EXISTS 'OPEN_SHIFT_CREATED';
ALTER TYPE audit_action ADD VALUE IF NOT EXISTS 'OPEN_SHIFT_OFFER_SENT';
ALTER TYPE audit_action ADD VALUE IF NOT EXISTS 'OPEN_SHIFT_CLAIMED';
ALTER TYPE audit_action ADD VALUE IF NOT EXISTS 'OPEN_SHIFT_CANCELED';


