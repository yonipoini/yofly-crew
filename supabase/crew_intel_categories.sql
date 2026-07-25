-- Expands crew intel categories used by the alerts table.
-- Run this once in Supabase SQL editor for existing projects.

ALTER TABLE alerts DROP CONSTRAINT IF EXISTS alerts_type_check;

ALTER TABLE alerts
  ADD CONSTRAINT alerts_type_check
  CHECK (type IN (
    'SHUTTLE',
    'HOTEL',
    'SAFETY',
    'TSA_KCM',
    'GATE_TERMINAL',
    'CREW_ROOM',
    'MAINTENANCE',
    'CATERING',
    'BAGGAGE',
    'WEATHER',
    'SCHEDULING',
    'PARKING',
    'GENERAL'
  ));
