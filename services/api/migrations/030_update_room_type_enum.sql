-- Migration to update room_type enum from DELUXE/VIP to DOUBLE/SPECIAL
-- Note: PostgreSQL does not support renaming enum values directly.
-- This migration:
-- 1. Adds new enum values (DOUBLE, SPECIAL)
-- 2. Updates existing data to use new values
-- 3. Leaves old enum values in place (they will be unused)

-- Add new enum values
ALTER TYPE room_type ADD VALUE IF NOT EXISTS 'DOUBLE';
ALTER TYPE room_type ADD VALUE IF NOT EXISTS 'SPECIAL';

-- Update existing rooms: DELUXE -> DOUBLE, VIP -> SPECIAL
-- Note: This uses a temporary column approach since we can't directly update enum values
UPDATE rooms SET type = 'DOUBLE' WHERE type = 'DELUXE';
UPDATE rooms SET type = 'SPECIAL' WHERE type = 'VIP';

-- Update any checkin_blocks that reference old values
UPDATE checkin_blocks SET rental_type = 'DOUBLE' WHERE rental_type = 'DELUXE';
UPDATE checkin_blocks SET rental_type = 'SPECIAL' WHERE rental_type = 'VIP';

-- Update lane_sessions desired_rental_type, waitlist_desired_type, backup_rental_type
UPDATE lane_sessions SET desired_rental_type = 'DOUBLE' WHERE desired_rental_type = 'DELUXE';
UPDATE lane_sessions SET desired_rental_type = 'SPECIAL' WHERE desired_rental_type = 'VIP';
UPDATE lane_sessions SET waitlist_desired_type = 'DOUBLE' WHERE waitlist_desired_type = 'DELUXE';
UPDATE lane_sessions SET waitlist_desired_type = 'SPECIAL' WHERE waitlist_desired_type = 'VIP';
UPDATE lane_sessions SET backup_rental_type = 'DOUBLE' WHERE backup_rental_type = 'DELUXE';
UPDATE lane_sessions SET backup_rental_type = 'SPECIAL' WHERE backup_rental_type = 'VIP';

-- Update waitlist desired_tier
UPDATE waitlist SET desired_tier = 'DOUBLE' WHERE desired_tier = 'DELUXE';
UPDATE waitlist SET desired_tier = 'SPECIAL' WHERE desired_tier = 'VIP';

-- Note: Old enum values (DELUXE, VIP) remain in the enum type but should not be used.
-- They can be removed in a future migration if desired, but that requires recreating the enum type.

