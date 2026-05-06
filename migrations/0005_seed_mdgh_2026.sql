-- migrations/0005_seed_mdgh_2026.sql
INSERT INTO cycles (
  id, display_name, application_fee_cents, application_currency,
  privacy_policy_version, applications_open_at, applications_close_at, is_active
) VALUES (
  'MDGH-2026',
  'Miss Diaspora Ghana 2026',
  2599,
  'USD',
  'v1.0',
  '2026-05-15T00:00:00.000Z',
  '2026-08-15T23:59:59.999Z',
  1
);
