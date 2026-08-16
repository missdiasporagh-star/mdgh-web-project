-- migrations/0008_update_cycle_ghs_50_and_extend_close.sql
-- Update the existing MDGH-2026 cycle to GHS 50.00, keep it active,
-- and extend the close date so the application window stays open.
UPDATE cycles
SET
  application_fee_cents = 5000,
  application_currency = 'GHS',
  is_active = 1,
  applications_close_at = '2026-12-31T23:59:59.999Z'
WHERE id = 'MDGH-2026';
