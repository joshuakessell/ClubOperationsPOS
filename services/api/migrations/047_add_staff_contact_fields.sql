-- Add SMS contact fields to staff

ALTER TABLE staff
  ADD COLUMN IF NOT EXISTS phone_e164 TEXT,
  ADD COLUMN IF NOT EXISTS sms_opt_in BOOLEAN NOT NULL DEFAULT false;

-- Ensure phone numbers follow E.164 when provided
ALTER TABLE staff
  ADD CONSTRAINT IF NOT EXISTS staff_phone_e164_format
    CHECK (phone_e164 IS NULL OR phone_e164 ~ '^\+[1-9]\d{1,14}$');

-- Unique phone numbers when present
CREATE UNIQUE INDEX IF NOT EXISTS staff_phone_e164_unique
  ON staff(phone_e164)
  WHERE phone_e164 IS NOT NULL;


