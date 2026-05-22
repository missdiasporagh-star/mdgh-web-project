-- migrations/0003_cycle_notifications.sql
CREATE TABLE cycle_notifications (
  id                       TEXT PRIMARY KEY,
  email                    TEXT NOT NULL UNIQUE,
  source                   TEXT NOT NULL CHECK (source IN ('eligibility_disqualified','cycle_closed','manual')),
  disqualifying_rule       TEXT CHECK (disqualifying_rule IS NULL OR disqualifying_rule IN ('age','gender','heritage','residency','passport')),
  consent_recorded_at      TEXT NOT NULL,
  unsubscribed_at          TEXT,
  created_at               TEXT NOT NULL
);

CREATE INDEX idx_notif_source ON cycle_notifications(source);
