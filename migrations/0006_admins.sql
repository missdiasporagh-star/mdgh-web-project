-- migrations/0006_admins.sql
CREATE TABLE admins (
  email          TEXT PRIMARY KEY,           -- stored lowercase
  password_hash  TEXT NOT NULL,              -- pbkdf2$ITER$salt$hash (see src/lib/crypto/pbkdf2.ts)
  display_name   TEXT,
  created_at     TEXT NOT NULL,
  disabled       INTEGER NOT NULL DEFAULT 0  -- 1 = soft-removed, cannot log in
);
