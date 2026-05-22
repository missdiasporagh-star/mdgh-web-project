-- migrations/0004_admin_audit.sql
CREATE TABLE admin_audit (
  id                       TEXT PRIMARY KEY,
  admin_email              TEXT NOT NULL,
  action                   TEXT NOT NULL CHECK (action IN ('login','logout','status_change','csv_export','signed_url_issued')),
  target_application_id    TEXT,
  details_json             TEXT,
  ip_hash                  TEXT,
  created_at               TEXT NOT NULL
);

CREATE INDEX idx_audit_admin   ON admin_audit(admin_email);
CREATE INDEX idx_audit_target  ON admin_audit(target_application_id);
CREATE INDEX idx_audit_created ON admin_audit(created_at);
