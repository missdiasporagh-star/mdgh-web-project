-- migrations/0002_cycles.sql
CREATE TABLE cycles (
  id                       TEXT PRIMARY KEY,
  display_name             TEXT NOT NULL,
  application_fee_cents    INTEGER NOT NULL,
  application_currency     TEXT NOT NULL CHECK (application_currency IN ('USD','NGN','GHS')),
  privacy_policy_version   TEXT NOT NULL,
  applications_open_at     TEXT NOT NULL,
  applications_close_at    TEXT NOT NULL,
  is_active                INTEGER NOT NULL DEFAULT 0 CHECK (is_active IN (0,1))
);
