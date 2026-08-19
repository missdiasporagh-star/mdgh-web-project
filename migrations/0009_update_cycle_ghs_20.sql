-- migrations/0009_update_cycle_ghs_20.sql
-- Revise the MDGH-2026 cycle application fee from GHS 50.00 to GHS 20.00.
-- Keeps the cycle active; close date unchanged (still 2026-12-31).
UPDATE cycles
SET
  application_fee_cents = 2000,
  application_currency = 'GHS',
  is_active = 1
WHERE id = 'MDGH-2026';
