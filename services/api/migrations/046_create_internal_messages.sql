-- Create enums or checks for internal message targeting and severity

CREATE TABLE IF NOT EXISTS internal_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  severity TEXT NOT NULL CHECK (severity IN ('INFO', 'WARNING', 'URGENT')),
  target_type TEXT NOT NULL CHECK (target_type IN ('ALL', 'ROLE', 'STAFF', 'DEVICE')),
  target_role staff_role,
  target_staff_id UUID REFERENCES staff(id) ON DELETE SET NULL,
  target_device_id TEXT,
  created_by UUID REFERENCES staff(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ,
  pinned BOOLEAN NOT NULL DEFAULT false
);

CREATE INDEX IF NOT EXISTS idx_internal_messages_target_type ON internal_messages(target_type);
CREATE INDEX IF NOT EXISTS idx_internal_messages_expires_at ON internal_messages(expires_at);
CREATE INDEX IF NOT EXISTS idx_internal_messages_pinned_created ON internal_messages(pinned DESC, created_at DESC);

CREATE TABLE IF NOT EXISTS internal_message_acks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id UUID NOT NULL REFERENCES internal_messages(id) ON DELETE CASCADE,
  staff_id UUID REFERENCES staff(id) ON DELETE SET NULL,
  device_id TEXT,
  acknowledged_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_internal_message_acks_message ON internal_message_acks(message_id);
CREATE UNIQUE INDEX IF NOT EXISTS internal_message_acks_staff_unique 
  ON internal_message_acks(message_id, staff_id) 
  WHERE staff_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS internal_message_acks_device_unique 
  ON internal_message_acks(message_id, device_id) 
  WHERE device_id IS NOT NULL;

-- Audit actions for messaging
ALTER TYPE audit_action ADD VALUE IF NOT EXISTS 'MESSAGE_CREATED';
ALTER TYPE audit_action ADD VALUE IF NOT EXISTS 'MESSAGE_ACKNOWLEDGED';


