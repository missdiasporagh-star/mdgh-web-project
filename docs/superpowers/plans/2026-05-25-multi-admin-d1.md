# Multi-Admin (D1-backed) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the single hardcoded admin with a D1-backed `admins` table so admins can be added/removed/disabled over time without a code change.

**Architecture:** Add an `admins` table + `getAdminByEmail` query; extract a pure `authenticateAdmin(row, password)` decision; rewrite `login.ts` to look the email up in D1 instead of comparing to a hardcoded constant + single secret. Session/audit/KV layers are unchanged (they already take a runtime `adminEmail`).

**Tech Stack:** Astro 5 on Cloudflare Workers, TypeScript, D1, vitest, `tsx` (for a local credential-hashing script), existing `pbkdf2.ts` (`hashPassword`/`verifyPassword`).

---

## File Structure

- `migrations/0006_admins.sql` — CREATE: the `admins` table.
- `src/lib/db/queries.ts` — MODIFY: add `AdminRow` type + `getAdminByEmail`.
- `src/lib/auth/authenticate-admin.ts` — CREATE: pure `authenticateAdmin(row, password)` decision.
- `src/lib/auth/authenticate-admin.test.ts` — CREATE: unit tests for the decision.
- `src/pages/api/admin/login.ts` — MODIFY: use the D1 lookup + `authenticateAdmin`; drop the hardcoded `ADMIN_EMAIL` + `ADMIN_PASSWORD_HASH` usage.
- `scripts/hash-password.ts` — CREATE: local CLI to mint a `pbkdf2$…` hash without the plaintext touching chat/logs.

---

## Task 1: `admins` table migration + `getAdminByEmail` query

**Files:**
- Create: `migrations/0006_admins.sql`
- Modify: `src/lib/db/queries.ts`

- [ ] **Step 1: Create the migration**

Create `migrations/0006_admins.sql`:

```sql
-- migrations/0006_admins.sql
CREATE TABLE admins (
  email          TEXT PRIMARY KEY,           -- stored lowercase
  password_hash  TEXT NOT NULL,              -- pbkdf2$ITER$salt$hash (see src/lib/crypto/pbkdf2.ts)
  display_name   TEXT,
  created_at     TEXT NOT NULL,
  disabled       INTEGER NOT NULL DEFAULT 0  -- 1 = soft-removed, cannot log in
);
```

- [ ] **Step 2: Add the type + query**

Append to the end of `src/lib/db/queries.ts`:

```ts
export type AdminRow = {
  email: string;
  password_hash: string;
  display_name: string | null;
  created_at: string;
  disabled: number;
};

export async function getAdminByEmail(db: D1Database, email: string): Promise<AdminRow | null> {
  const r = await db
    .prepare(`SELECT * FROM admins WHERE email = ?`)
    .bind(email.toLowerCase())
    .first<AdminRow>();
  return r ?? null;
}
```

- [ ] **Step 3: Type-check**

Run: `npx astro check 2>&1 | grep -iE "queries.ts" || echo "no queries.ts type errors"`
Expected: `no queries.ts type errors`.

- [ ] **Step 4: Commit**

```bash
git add migrations/0006_admins.sql src/lib/db/queries.ts
git commit -m "feat(admin): admins table + getAdminByEmail query"
```

---

## Task 2: `authenticateAdmin` decision (TDD)

**Files:**
- Create: `src/lib/auth/authenticate-admin.ts`
- Test: `src/lib/auth/authenticate-admin.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/lib/auth/authenticate-admin.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { hashPassword } from '@/lib/crypto/pbkdf2';
import { authenticateAdmin } from './authenticate-admin';
import type { AdminRow } from '@/lib/db/queries';

function makeRow(overrides: Partial<AdminRow> = {}): AdminRow {
  return {
    email: 'admin2@example.com',
    password_hash: 'unset',
    display_name: null,
    created_at: '2026-05-25T00:00:00.000Z',
    disabled: 0,
    ...overrides,
  };
}

describe('authenticateAdmin', () => {
  it('returns null when the admin does not exist', async () => {
    expect(await authenticateAdmin(null, 'whatever')).toBeNull();
  });

  it('returns null for a disabled admin even with the correct password', async () => {
    const password_hash = await hashPassword('correct-horse-battery');
    expect(await authenticateAdmin(makeRow({ password_hash, disabled: 1 }), 'correct-horse-battery')).toBeNull();
  });

  it('returns null for a wrong password', async () => {
    const password_hash = await hashPassword('correct-horse-battery');
    expect(await authenticateAdmin(makeRow({ password_hash }), 'wrong-password')).toBeNull();
  });

  it('returns the row for a valid email + password', async () => {
    const password_hash = await hashPassword('correct-horse-battery');
    const row = makeRow({ email: 'admin2@example.com', password_hash });
    expect(await authenticateAdmin(row, 'correct-horse-battery')).toEqual(row);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/lib/auth/authenticate-admin.test.ts`
Expected: FAIL — `Failed to resolve import './authenticate-admin'`.

- [ ] **Step 3: Implement**

Create `src/lib/auth/authenticate-admin.ts`:

```ts
import { verifyPassword } from '@/lib/crypto/pbkdf2';
import type { AdminRow } from '@/lib/db/queries';

/**
 * Decide whether an admin login attempt succeeds.
 *
 * Returns the matched admin row on success, or null for: unknown email
 * (row === null), a disabled account, or a wrong password. Callers MUST treat
 * all null results identically (generic "invalid_credentials") so the response
 * can't be used to enumerate which emails are admins.
 */
export async function authenticateAdmin(row: AdminRow | null, password: string): Promise<AdminRow | null> {
  if (!row || row.disabled === 1) return null;
  const ok = await verifyPassword(password, row.password_hash);
  return ok ? row : null;
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/lib/auth/authenticate-admin.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/auth/authenticate-admin.ts src/lib/auth/authenticate-admin.test.ts
git commit -m "feat(admin): authenticateAdmin decision (rejects unknown/disabled/wrong-password)"
```

---

## Task 3: Wire `login.ts` to D1

**Files:**
- Modify: `src/pages/api/admin/login.ts`

- [ ] **Step 1: Replace the file contents**

Replace the entire contents of `src/pages/api/admin/login.ts` with:

```ts
import type { APIRoute } from 'astro';
import { adminLoginSchema } from '@/lib/schemas/admin';
import { authenticateAdmin } from '@/lib/auth/authenticate-admin';
import { getAdminByEmail, insertAdminAudit } from '@/lib/db/queries';
import { signAdminSession } from '@/lib/tokens/admin-session';
import { newUlid } from '@/lib/ids/ulid';
import { hashIp } from '@/lib/crypto/hash';
import { checkRateLimit } from '@/lib/ratelimit/kv-limiter';

export const prerender = false;

const SESSION_TTL_SECONDS = 4 * 3600;

export const POST: APIRoute = async ({ request, locals, clientAddress }) => {
  const env = locals.runtime.env;

  // Rate limit: 10 attempts per IP per hour. pbkdf2 (200k iterations) already
  // slows brute-force, but a hard ceiling at the edge stops attackers from
  // burning Worker CPU on guesses.
  const ipHashForRl = await hashIp(clientAddress ?? 'unknown', env.IP_HASH_SALT);
  const rl = await checkRateLimit(env.KV, `rl:admin-login:${ipHashForRl}`, 10, 3600);
  if (!rl.allowed) return j({ ok: false, error: 'rate_limited', retryAfter: rl.retryAfterSeconds }, 429);

  let body: unknown;
  try { body = await request.json(); } catch { return j({ ok: false, error: 'invalid_json' }, 400); }
  const parsed = adminLoginSchema.safeParse(body);
  if (!parsed.success) return j({ ok: false, error: 'invalid_input' }, 400);

  // Admins live in D1 (table: admins). Unknown email, disabled account, and
  // wrong password all collapse to the same generic 401 (no enumeration).
  const candidate = await getAdminByEmail(env.DB, parsed.data.email);
  const admin = await authenticateAdmin(candidate, parsed.data.password);
  if (!admin) return j({ ok: false, error: 'invalid_credentials' }, 401);
  const adminEmail = admin.email;

  const sessionId = newUlid();
  const expiryUnix = Math.floor(Date.now() / 1000) + SESSION_TTL_SECONDS;
  const token = await signAdminSession(adminEmail, sessionId, expiryUnix, env.ADMIN_SESSION_SECRET);

  // Track session in KV (allows server-side invalidation)
  await env.KV.put(`admin-session:${sessionId}`, JSON.stringify({ email: adminEmail, expiresAt: expiryUnix }), { expirationTtl: SESSION_TTL_SECONDS });

  // Audit log (reuse the rate-limit IP hash to save a KDF call)
  await insertAdminAudit(env.DB, {
    id: newUlid(), adminEmail, action: 'login',
    targetApplicationId: null, detailsJson: null, ipHash: ipHashForRl,
  });

  // Set HttpOnly cookie. SameSite=Strict because the admin panel has no
  // cross-site nav flow; tighter than Lax with zero usability cost here.
  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      'Set-Cookie': `mdgh_admin=${token}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${SESSION_TTL_SECONDS}`,
    },
  });
};

function j(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}
```

(Changes vs before: removed the `ADMIN_EMAIL` constant and the `verifyPassword`/`env.ADMIN_PASSWORD_HASH` import+check; added the `getAdminByEmail` + `authenticateAdmin` lookup; everything downstream now uses the matched `admin.email`.)

- [ ] **Step 2: Type-check**

Run: `npx astro check 2>&1 | grep -iE "admin/login" || echo "no login.ts type errors"`
Expected: `no login.ts type errors`.

- [ ] **Step 3: Build + run the auth unit tests (no regressions)**

Run: `npm run build 2>&1 | tail -3`
Expected: `[build] Complete!`

Run: `npx vitest run src/lib/auth/ src/lib/payment/ 2>&1 | tail -4`
Expected: all pass (the 4 auth tests + the existing payment-suite tests).

- [ ] **Step 4: Commit**

```bash
git add src/pages/api/admin/login.ts
git commit -m "feat(admin): authenticate logins against the D1 admins table"
```

---

## Task 4: Credential-hashing script

**Files:**
- Create: `scripts/hash-password.ts`

- [ ] **Step 1: Create the script**

Create `scripts/hash-password.ts`:

```ts
// scripts/hash-password.ts
// Generate a pbkdf2 password hash (SAME algorithm as the app — see
// src/lib/crypto/pbkdf2.ts) for a new admin. Run:
//   npx tsx scripts/hash-password.ts
// then type the password at the prompt. The plaintext is never stored or
// logged; the prompt reads from stdin so it stays out of shell history. Only
// the printed hash (stdout) goes into the admins.password_hash column.
import { createInterface } from 'node:readline/promises';
import process from 'node:process';
import { hashPassword } from '../src/lib/crypto/pbkdf2';

const rl = createInterface({ input: process.stdin, output: process.stderr });
const password = (await rl.question('New admin password: ')).trim();
rl.close();
if (!password) {
  console.error('No password entered — aborting.');
  process.exit(1);
}
const hash = await hashPassword(password);
process.stderr.write('\nHash (put this in admins.password_hash; do NOT share the plaintext):\n');
console.log(hash);
```

- [ ] **Step 2: Verify it produces a valid hash**

Run: `echo "test-password-123" | npx tsx scripts/hash-password.ts`
Expected: stdout is a single line beginning with `pbkdf2$200000$` (the prompt text appears on stderr).

- [ ] **Step 3: Commit**

```bash
git add scripts/hash-password.ts
git commit -m "chore(admin): script to hash an admin password locally (keeps plaintext out of chat/logs)"
```

---

## Task 5: Provision the new admin + deploy (operator-assisted, ORDER MATTERS)

**Files:** none (operational). **Do these in order — the deploy must be last to avoid an admin lockout.**

- [ ] **Step 1: Create the `admins` table on remote D1**

Run: `npx wrangler d1 execute mdgh-applications-db --remote --file=./migrations/0006_admins.sql`
Expected: success (table created). If it reports "table admins already exists", it's already there — continue.

- [ ] **Step 2: Operator hashes the new password (own terminal)**

```
npx tsx scripts/hash-password.ts
# type the new admin password at the prompt; copy the printed pbkdf2$… hash
```
The plaintext password is never shared; only the hash leaves this step.

- [ ] **Step 3: Operator inserts the new admin (own terminal — keeps the hash out of chat)**

```
npx wrangler d1 execute mdgh-applications-db --remote --command "INSERT INTO admins (email, password_hash, display_name, created_at, disabled) VALUES ('NEW_EMAIL_LOWERCASE', 'PASTE_HASH_HERE', 'Display Name', '2026-05-25T00:00:00.000Z', 0);"
```
Replace `NEW_EMAIL_LOWERCASE` (the new admin's email, lowercase), `PASTE_HASH_HERE` (the hash from Step 2), and the display name.

- [ ] **Step 4: Verify the row exists (no secrets shown)**

Run: `npx wrangler d1 execute mdgh-applications-db --remote --command "SELECT email, display_name, disabled, created_at FROM admins;"`
Expected: the new admin row is listed (`disabled` = 0). Do NOT proceed until this is confirmed.

- [ ] **Step 5: Deploy**

```bash
git push origin main
```
Then watch: `gh run watch $(gh run list --workflow=deploy.yml --limit 1 --json databaseId -q '.[0].databaseId') --exit-status`
Expected: deploy succeeds.

- [ ] **Step 6: Verify login behavior**

- Operator logs in at `https://apply.missdiasporagh.org/admin/login` with the **new** email + password → reaches `/admin/applications`.
- Operator confirms the **old** `admin@missdiasporagh.org` + its old password is now rejected (401).

- [ ] **Step 7: Retire the old single-admin config (optional cleanup)**

- The `ADMIN_PASSWORD_HASH` secret and the `ADMIN_EMAIL` constant are no longer read. Optionally remove the secret: `npx wrangler secret delete ADMIN_PASSWORD_HASH --name mdgh-web-project` (operator). Leaving it is harmless. (Its type entry in `src/env.d.ts` can stay or be removed later.)
- To add more admins in future: repeat Steps 2–3 (hash + insert). To disable one: `UPDATE admins SET disabled = 1 WHERE email = '…';`.

---

## Self-Review

**Spec coverage:**
- D1 `admins` table → Task 1. ✓
- `getAdminByEmail` (lowercased lookup) → Task 1. ✓
- `authenticateAdmin` rejecting not-found/disabled/wrong-password (no enumeration) → Task 2 + tests. ✓
- `login.ts` rewrite using the lookup, downstream unchanged → Task 3. ✓
- Credential script (password never in chat/logs) → Task 4. ✓
- Replace flow + lockout-safe ordering (table + row before deploy) → Task 5 (Steps 1–5 ordered, deploy last). ✓
- Old admin retired; `ADMIN_PASSWORD_HASH`/`ADMIN_EMAIL` unused → Task 5 Step 7. ✓
- Future add/disable via SQL → Task 5 Step 7. ✓

**Placeholder scan:** `NEW_EMAIL_LOWERCASE` / `PASTE_HASH_HERE` / `Display Name` in Task 5 Step 3 are intentional operator fill-ins (the email/password are the user's to choose; the hash is generated in Step 2 and kept out of chat). No code placeholders.

**Type consistency:** `AdminRow` (Task 1) is imported by `authenticate-admin.ts` + its test (Task 2) and used in `login.ts` via `getAdminByEmail` (Task 3). `authenticateAdmin(row: AdminRow | null, password: string): Promise<AdminRow | null>` signature matches between definition, test, and the `login.ts` call site. `getAdminByEmail(db, email)` matches its call in `login.ts`.

**Note:** the pre-existing `tests/integration/admin-login.test.ts` failure (stale env mock, documented out of scope) is NOT addressed here and is not a regression; the new `authenticateAdmin` unit tests + the live login check in Task 5 cover correctness.
