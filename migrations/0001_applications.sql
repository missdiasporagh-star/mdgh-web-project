-- migrations/0001_applications.sql
CREATE TABLE applications (
  id                       TEXT PRIMARY KEY,
  cycle_id                 TEXT NOT NULL,
  transaction_reference    TEXT NOT NULL UNIQUE,
  email                    TEXT NOT NULL,

  payment_status           TEXT NOT NULL DEFAULT 'pending'
    CHECK (payment_status IN ('pending','paid','failed','expired')),
  payment_amount_cents     INTEGER NOT NULL,
  payment_currency         TEXT NOT NULL DEFAULT 'USD',
  payaza_transaction_id    TEXT,
  payment_verified_at      TEXT,
  payment_failure_reason   TEXT,

  eligibility_age_band         TEXT,
  eligibility_is_woman         INTEGER,
  eligibility_african_descent  INTEGER,
  eligibility_outside_ghana    INTEGER,
  eligibility_valid_passport   INTEGER,

  consent_policy_version   TEXT NOT NULL,
  consent_recorded_at      TEXT NOT NULL,
  consent_media_use        INTEGER NOT NULL,
  consent_marketing        INTEGER NOT NULL,

  magic_link_sent_at       TEXT,
  apply_token_issued_at    TEXT,
  email_bounced_at         TEXT,

  full_name                TEXT,
  phone                    TEXT,
  date_of_birth            TEXT,
  country_of_residence     TEXT,
  current_city             TEXT,
  country_of_heritage      TEXT,
  bio                      TEXT,
  socials_json             TEXT,
  headshot_r2_key          TEXT,
  video_r2_key             TEXT,

  submitted_at             TEXT,
  status                   TEXT NOT NULL DEFAULT 'new'
    CHECK (status IN ('new','reviewing','shortlisted','rejected')),
  admin_notes              TEXT,

  created_at               TEXT NOT NULL,
  updated_at               TEXT NOT NULL,
  ip_hash                  TEXT,
  user_agent               TEXT
);

CREATE INDEX idx_app_email           ON applications(email);
CREATE INDEX idx_app_payment_status  ON applications(payment_status);
CREATE INDEX idx_app_status          ON applications(status);
CREATE INDEX idx_app_cycle           ON applications(cycle_id);
CREATE INDEX idx_app_submitted       ON applications(submitted_at);
