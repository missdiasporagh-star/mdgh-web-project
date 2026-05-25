# Multi-Admin (D1-backed) — Design

**Date:** 2026-05-25
**Status:** Approved for planning

## Problem

The admin portal is single-admin: `login.ts` hardcodes `ADMIN_EMAIL = 'admin@missdiasporagh.org'` and checks the password against the single `ADMIN_PASSWORD_HASH` secret. The user wants to **replace** that admin with a new email/password and **manage several admins over time** without redeploys.

## Decision

Move admin credentials into a **D1 `admins` table**. The session/auth/audit layers already operate on a runtime `adminEmail` (`signAdminSession`, `checkAdminAuth`, `insertAdminAudit` all take it), so only `login.ts` changes plus a new table + query. Adding/removing/disabling an admin becomes a SQL operation — no code change or redeploy.

Rejected alternatives: a JSON `ADMIN_USERS` secret (every change re-uploads the whole secret; no soft-disable) and per-admin env secrets (doesn't scale; code change per admin).

## Schema

`migrations/0006_admins.sql`:
```sql
CREATE TABLE admins (
  email          TEXT PRIMARY KEY,          -- stored lowercase
  password_hash  TEXT NOT NULL,             -- pbkdf2$ITER$salt$hash (existing format)
  display_name   TEXT,
  created_at     TEXT NOT NULL,
  disabled       INTEGER NOT NULL DEFAULT 0  -- soft-remove without deleting
);
```

## Components

- **`getAdminByEmail(db, email)`** in `src/lib/db/queries.ts` — `SELECT * FROM admins WHERE email = ?` with the email lowercased; returns the row or `null`. Prepared statement.
- **`login.ts` change** — replace the hardcoded email match + `verifyPassword(password, env.ADMIN_PASSWORD_HASH)` with:
  1. lookup `getAdminByEmail(env.DB, parsed.data.email)`,
  2. reject (generic `invalid_credentials`, 401) if not found **or** `disabled === 1`,
  3. `verifyPassword(parsed.data.password, row.password_hash)`,
  4. on success, sign the session / write KV / audit using `row.email` (the matched email) instead of the constant.
  Rate-limit, schema validation, cookie behavior, and TTL all stay exactly as they are.
- **`scripts/hash-password.ts`** — a standalone script run via `npx tsx scripts/hash-password.ts` that prompts for / accepts a password and prints a `pbkdf2$…` hash using the project's existing `hashPassword` (`src/lib/crypto/pbkdf2.ts`). Lets the operator mint a credential **without the plaintext password entering chat, code, or logs**. Only the email + resulting hash go into D1.

## Data flow (login)

```
POST /api/admin/login {email, password}
  → rate-limit (unchanged)
  → zod validate (unchanged)
  → getAdminByEmail(DB, email.toLowerCase())
       ├─ null or disabled → 401 invalid_credentials
       └─ row → verifyPassword(password, row.password_hash)
                   ├─ false → 401 invalid_credentials
                   └─ true  → sign session(row.email) + KV + audit + Set-Cookie (unchanged)
```

## Replace flow & lockout safety (operational, ordered)

1. Apply migration `0006_admins.sql` to **remote** D1.
2. Operator runs `scripts/hash-password.ts` locally to hash the new admin's password.
3. Insert the new admin row into remote D1 (email + hash + created_at).
4. **Verify the row exists** (SELECT) before deploying.
5. Deploy the D1-reading `login.ts`.
6. Confirm by logging in as the new admin; confirm `admin@missdiasporagh.org` is now rejected.

The old `admin@missdiasporagh.org` is simply never inserted, so it can no longer authenticate. `ADMIN_PASSWORD_HASH` (secret) and the `ADMIN_EMAIL` constant become unused — left in place (harmless), noted for later cleanup.

## Error handling

- Unknown email, disabled admin, and wrong password all return the same generic `invalid_credentials` (401) — no account enumeration. Matches current behavior.
- Empty `admins` table → all logins fail closed (no lockout *bypass*). This is why the new admin must be seeded before deploy (step 3–4 above).

## Testing

- Unit: `getAdminByEmail` returns the row for a known email and `null` otherwise; the login decision logic rejects not-found/disabled and accepts a valid hash. (Pure-logic where possible; D1 binding mocked.)
- The pre-existing `tests/integration/admin-login.test.ts` is already failing on stale mocks (documented, out of scope) — do not treat as a regression, but update its env mock if trivially compatible.
- Definitive: live login as the new admin post-deploy + old admin rejected.

## Out of scope (YAGNI)

- In-portal "manage admins" UI (add/disable from the dashboard). Adding an admin is a one-line SQL insert for now; build the UI later if desired.
- Migrating the existing `admin@missdiasporagh.org` into the table (the user is replacing, not preserving).
