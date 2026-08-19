-- migrations/0010_update_cycle_usd_20.sql
-- Revise the MDGH-2026 cycle fee to USD 20.00 (was set to GHS 20.00 by 0009;
-- the requested price was $20.00 in USD). Amount in cents is unchanged (2000);
-- only the currency changes. Cycle stays active, close date unchanged.
UPDATE cycles
SET
  application_currency = 'USD',
  application_fee_cents = 2000,
  is_active = 1
WHERE id = 'MDGH-2026';
