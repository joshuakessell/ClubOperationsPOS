-- Allow register number 3 (not paired with a kiosk)
ALTER TABLE register_sessions DROP CONSTRAINT IF EXISTS register_sessions_register_number_check;
ALTER TABLE register_sessions ADD CONSTRAINT register_sessions_register_number_check CHECK (register_number IN (1,2,3));
