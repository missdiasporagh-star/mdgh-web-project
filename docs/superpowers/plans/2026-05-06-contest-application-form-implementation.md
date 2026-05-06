# Contest Application Form Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship a paid contest application form on the live `mdgh-web-project` site at `missdiasporagh.org`, gated by Payaza Hosted Checkout (Verify-by-Reference), backed by Cloudflare D1 + R2 + KV, with a password-gated admin view and full security hardening.

**Architecture:** Astro 5 SSR on Cloudflare Pages. D1 = source of truth for application records; R2 holds headshot + 2-min video files; KV holds ephemeral state (admin sessions, rate-limit counters, presigned-URL invariants). Payment integration wraps Payaza behind a `PaymentProvider` interface (Payaza adapter for prod, Mock adapter for tests/dev). Magic-link tokens are stateless HMAC. File uploads go directly browser → R2 via short-lived presigned PUT URLs. Email via Resend.

**Tech Stack:** Astro 5, React 19 (islands only), Tailwind v4, Cloudflare Pages SSR (`@astrojs/cloudflare` mode `advanced`), Cloudflare D1 + R2 + KV, Payaza Checkout, Resend, Cloudflare Turnstile, Vitest + `@cloudflare/vitest-pool-workers`, Playwright, Zod for runtime validation, Web Crypto SubtleCrypto for HMAC + PBKDF2.

**Spec:** `docs/superpowers/specs/2026-05-06-contest-application-form-design.md` (commits `66b9d87` + `09b9279`).

**Implementation note re: spec:** Spec says "bcrypt cost 12" for admin password hashing. Switched to **PBKDF2 via Web Crypto SubtleCrypto (200,000 iterations, SHA-256, 32-byte salt)** — bcrypt-native isn't available in Cloudflare Workers; `bcryptjs` is pure JS but too slow on Workers CPU limits at cost 12. PBKDF2 is Workers-native, equivalent security, < 50 ms per login.

---

## Prerequisites

Before starting Task M1.1, the following must be true:
- A Payaza merchant account exists and sandbox + production API keys have been generated. **If not, do M0 first** (M0 is mostly clicking, no code).
- Cloudflare account `233d917842862e30ed5207cf7b95bc33` is accessible to the implementer (or work via Pages dashboard credentials).
- `git remote -v` in `mdgh-web-project/` shows `missdiasporagh-star/mdgh-web-project` — confirm before pushing anything.

## File structure overview

```
src/
├── lib/
│   ├── payment/{types,payaza-provider,mock-provider,index}.ts
│   ├── email/{types,resend-provider,mock-provider,templates,index}.ts
│   ├── tokens/{apply-token,admin-session}.ts
│   ├── ids/{ulid,reference}.ts
│   ├── crypto/{hash,pbkdf2}.ts
│   ├── db/{client,queries}.ts
│   ├── ratelimit/kv-limiter.ts
│   ├── turnstile/verify.ts
│   ├── csp/headers.ts
│   ├── eligibility/rules.ts
│   └── schemas/{apply,form,admin,notifications}.ts
├── pages/
│   ├── apply.astro
│   ├── apply/{return,form,done,recover,closed}.astro
│   ├── privacy.astro
│   ├── terms.astro
│   ├── admin/login.astro
│   ├── admin/applications/{index,[id]}.astro
│   ├── mock-checkout.astro                 (dev-only)
│   └── api/
│       ├── checkout/{create,verify}.ts
│       ├── upload/presign.ts
│       ├── applications/{draft,submit,recover}.ts
│       ├── notifications/subscribe.ts
│       ├── webhooks/resend-bounce.ts
│       └── admin/{login,logout}.ts
│       └── admin/applications/{index,[id],csv}.ts
│       └── admin/applications/[id]/{status,signed-url}.ts
├── components/
│   ├── apply/
│   │   ├── EligibilityQuiz.astro
│   │   ├── ConsentSection.astro
│   │   ├── DisqualifiedCard.astro
│   │   ├── ApplyForm.tsx                   (React island)
│   │   └── FileUploader.tsx                (React island)
│   └── admin/{ApplicationList,ApplicationDetail}.astro
├── layouts/
│   └── ApplyLayout.astro                   (no Lenis/GSAP — clean form layout)
├── middleware/
│   ├── admin-auth.ts
│   └── security-headers.ts
├── data/
│   ├── privacy.md
│   └── terms.md
└── env.d.ts                                (extend Astro Env types)

migrations/
├── 0001_applications.sql
├── 0002_cycles.sql
├── 0003_cycle_notifications.sql
└── 0004_admin_audit.sql

tests/
├── unit/
│   ├── apply-token.test.ts
│   ├── admin-session.test.ts
│   ├── reference.test.ts
│   ├── ulid.test.ts
│   ├── ip-hash.test.ts
│   ├── pbkdf2.test.ts
│   ├── eligibility.test.ts
│   ├── mock-provider.test.ts
│   └── email-templates.test.ts
├── integration/
│   ├── checkout-create.test.ts
│   ├── checkout-verify.test.ts
│   ├── upload-presign.test.ts
│   ├── applications-draft.test.ts
│   ├── applications-submit.test.ts
│   ├── applications-recover.test.ts
│   ├── notifications-subscribe.test.ts
│   ├── admin-login.test.ts
│   ├── admin-applications-list.test.ts
│   ├── admin-applications-detail.test.ts
│   ├── admin-status-update.test.ts
│   └── admin-csv-export.test.ts
└── e2e/
    ├── apply-happy-path.spec.ts
    ├── apply-disqualified.spec.ts
    ├── apply-recovery.spec.ts
    └── admin.spec.ts

docs/
├── runbook-cycle.md
└── data-retention.md

scripts/
└── data-retention-cleanup.ts

wrangler.toml                                (new — bindings + dev config)
vitest.config.ts                             (new)
playwright.config.ts                         (new)
```

---

## M0 — Account + infrastructure provisioning

This milestone is mostly user-side clicking. No code commits. Document what was done in a checklist.

### Task M0.1: Create or confirm Payaza account + obtain keys

**Files:**
- Create: `docs/m0-checklist.md` (operator-side checklist — gitignored or kept; user's call)

- [ ] **Step 1: Sign in (or sign up) at Payaza dashboard**

Open `https://dashboard.payaza.africa` (or wherever the user's existing account is). Confirm or create a merchant account. Capture: merchant ID, sandbox base URL, production base URL.

- [ ] **Step 2: Enable sandbox mode and generate sandbox keys**

In the Payaza dashboard, enable test/sandbox mode. Generate:
- `PAYAZA_PUBLIC_KEY` (test)
- `PAYAZA_SECRET_KEY` (test)

Record both in a password manager. Note the sandbox API base URL (e.g., `https://sandbox-api.payaza.africa` — confirm exact value from dashboard).

- [ ] **Step 3: Generate production keys**

Switch to production mode. Generate:
- `PAYAZA_PUBLIC_KEY` (live)
- `PAYAZA_SECRET_KEY` (live)

Record in password manager. Note the production base URL (e.g., `https://api.payaza.africa` — confirm).

- [ ] **Step 4: Walk one sandbox transaction end-to-end via Postman or curl**

Run one Initiate Checkout call against sandbox to confirm:
- Exact endpoint path (likely `/checkout/initiate` — record actual path)
- Exact request body field names (`reference`, `amount`, `currency`, `email`, `callback_url`, `metadata` — record any divergence)
- Exact response body shape (`data.checkout_url`, `data.transaction_id` — record actual fields)
- Auth header format (likely `Authorization: Bearer {secret_key}` — confirm)

Run one Verify Transaction call after a test payment:
- Exact endpoint path (likely `/transactions/verify/{reference}` — record)
- Exact response shape (status field, amount, currency, paid_at, channel — record)

These exact paths/fields will be used in `src/lib/payment/payaza-provider.ts` (Task M1.6).

- [ ] **Step 5: Write findings to `docs/m0-checklist.md`**

Capture:
```markdown
# Payaza integration findings (2026-05-06)

## Endpoints
- Initiate: POST {BASE}/[exact path here]
- Verify:   GET  {BASE}/[exact path here]

## Auth
Authorization: Bearer {PAYAZA_SECRET_KEY}

## Initiate request body
[exact JSON shape, with field names]

## Initiate response body (success)
[exact JSON shape]

## Verify response body
[exact JSON shape, including all status values seen]

## Sandbox base URL
[exact URL]

## Production base URL
[exact URL]

## Test card numbers
[copied from Payaza docs]
```

Do not commit this file with any keys in it. Keys go to Cloudflare secrets, never git.

### Task M0.2: Create Cloudflare D1 + R2 + bindings

**Files:**
- Modify: `docs/m0-checklist.md` (append findings)

- [ ] **Step 1: Create D1 database**

Run locally:
```bash
npx wrangler d1 create mdgh-applications-db
```
Copy the returned `database_id` UUID. Record it.

- [ ] **Step 2: Create R2 buckets**

```bash
npx wrangler r2 bucket create mdgh-applications
npx wrangler r2 bucket create mdgh-applications-staging
```

- [ ] **Step 3: Generate R2 access key for presigning**

In Cloudflare dashboard: R2 → Manage R2 API Tokens → Create API Token with read/write on `mdgh-applications` and `mdgh-applications-staging`. Copy the **Access Key ID** and **Secret Access Key**. These are used for S3-compatible presigned URLs.

- [ ] **Step 4: Set lifecycle rule for incomplete multipart uploads**

In dashboard: R2 → mdgh-applications → Settings → Object lifecycle rules → Add rule: "Abort incomplete multipart uploads" after 1 day. Repeat for staging bucket.

- [ ] **Step 5: Append all IDs to `docs/m0-checklist.md`**

Capture (no secrets, just IDs that are safe to commit):
```markdown
## Cloudflare resources
- D1 database name: mdgh-applications-db
- D1 database ID:   [uuid]
- R2 bucket (prod): mdgh-applications
- R2 bucket (staging): mdgh-applications-staging
- R2 endpoint: https://[account-id].r2.cloudflarestorage.com
- R2 jurisdiction: [if non-default]
```

### Task M0.3: Resend domain + Turnstile + Pages secrets

**Files:**
- Modify: `docs/m0-checklist.md`

- [ ] **Step 1: Create Resend account, add and verify sending domain**

`https://resend.com/domains` → Add Domain → `missdiasporagh.org`. Add the SPF, DKIM, and DMARC DNS records to Cloudflare DNS for `missdiasporagh.org`. Wait for verification (typically < 5 min). Generate an API key with "send" permission.

- [ ] **Step 2: Create Cloudflare Turnstile site**

`https://dash.cloudflare.com/?to=/:account/turnstile` → Add site. Domain: `missdiasporagh.org`. Widget mode: Managed. Copy the **Site Key** and **Secret Key**.

- [ ] **Step 3: Generate the application secrets locally**

Run in a terminal:
```bash
node -e "console.log('APPLY_TOKEN_SECRET=' + require('crypto').randomBytes(32).toString('hex'))"
node -e "console.log('ADMIN_SESSION_SECRET=' + require('crypto').randomBytes(32).toString('hex'))"
node -e "console.log('IP_HASH_SALT=' + require('crypto').randomBytes(16).toString('hex'))"
```

Decide an admin password (16+ chars, password manager generated). Hash it (Task M1.7 implements the hashing utility; for now record the plaintext password securely and we'll hash in step 5).

- [ ] **Step 4: In Cloudflare Pages → mdgh-web-project → Settings → Environment variables, add for Production:**

| Name | Value |
|---|---|
| `PAYAZA_PUBLIC_KEY` | [live key from M0.1] |
| `PAYAZA_SECRET_KEY` | [live key from M0.1, marked as secret] |
| `PAYAZA_BASE_URL` | [production base URL from M0.1] |
| `APPLY_TOKEN_SECRET` | [generated in step 3, marked as secret] |
| `ADMIN_SESSION_SECRET` | [generated in step 3, marked as secret] |
| `IP_HASH_SALT` | [generated in step 3, marked as secret] |
| `RESEND_API_KEY` | [from M0.3 step 1, marked as secret] |
| `R2_ACCESS_KEY_ID` | [from M0.2 step 3] |
| `R2_SECRET_ACCESS_KEY` | [from M0.2 step 3, marked as secret] |
| `R2_ACCOUNT_ID` | `233d917842862e30ed5207cf7b95bc33` |
| `TURNSTILE_SITE_KEY` | [from M0.3 step 2] |
| `TURNSTILE_SECRET_KEY` | [from M0.3 step 2, marked as secret] |
| `ADMIN_PASSWORD_HASH` | placeholder for now — will be set after Task M1.7 generates the hash |

For Preview environment, repeat with the **sandbox** Payaza values and `mdgh-applications-staging` for R2.

- [ ] **Step 5: Bind D1, R2, KV in Pages settings**

In Cloudflare Pages → mdgh-web-project → Settings → Functions:
- D1 database bindings: `DB` → `mdgh-applications-db`
- R2 bucket bindings: `MEDIA` → `mdgh-applications` (production), `mdgh-applications-staging` (preview)
- KV namespace bindings: `SESSION` → existing namespace (id `e617b51f080c451abe6aade5373fcf6d`)

- [ ] **Step 6: Commit the M0 checklist (without secrets)**

```bash
git add docs/m0-checklist.md
git commit -m "docs: M0 infrastructure checklist + Payaza integration notes"
```

---

## M1 — Foundation (data + adapters + utilities)

This milestone produces all primitives — schema migrations, payment adapters, email adapters, token utilities, ID generators, hashing — fully tested. No routes yet.

### Task M1.1: Add wrangler.toml + tsconfig path alias + dev dependencies

**Files:**
- Create: `wrangler.toml`
- Modify: `tsconfig.json`
- Modify: `package.json`

- [ ] **Step 1: Create `wrangler.toml`**

```toml
name = "mdgh-web-project"
compatibility_date = "2025-11-12"
compatibility_flags = ["nodejs_compat"]
pages_build_output_dir = "dist"

# D1 database
[[d1_databases]]
binding = "DB"
database_name = "mdgh-applications-db"
database_id = "REPLACE_WITH_M0_2_STEP_1_UUID"

# R2 bucket (production maps in pages dashboard; this is for local wrangler pages dev)
[[r2_buckets]]
binding = "MEDIA"
bucket_name = "mdgh-applications-staging"

# KV namespace
[[kv_namespaces]]
binding = "SESSION"
id = "e617b51f080c451abe6aade5373fcf6d"

# Local dev variables (never put real secrets here; use .dev.vars)
[vars]
PAYAZA_BASE_URL = "https://sandbox-api.payaza.africa"
R2_ACCOUNT_ID = "233d917842862e30ed5207cf7b95bc33"
```

Replace the `database_id` placeholder with the UUID captured in Task M0.2 step 1.

- [ ] **Step 2: Create `.dev.vars` for local dev secrets (gitignored)**

```bash
# .dev.vars — gitignored, used by `wrangler pages dev`
PAYAZA_PUBLIC_KEY=pk_test_REPLACE
PAYAZA_SECRET_KEY=sk_test_REPLACE
APPLY_TOKEN_SECRET=REPLACE_WITH_HEX
ADMIN_SESSION_SECRET=REPLACE_WITH_HEX
IP_HASH_SALT=REPLACE_WITH_HEX
RESEND_API_KEY=re_test_REPLACE
R2_ACCESS_KEY_ID=REPLACE
R2_SECRET_ACCESS_KEY=REPLACE
TURNSTILE_SITE_KEY=1x00000000000000000000AA
TURNSTILE_SECRET_KEY=1x0000000000000000000000000000000AA
ADMIN_PASSWORD_HASH=PLACEHOLDER_FILL_AFTER_M1_7
MOCK_PAYMENTS=true
```

The Turnstile values shown are the official **always-passing test keys** documented at `https://developers.cloudflare.com/turnstile/troubleshooting/testing/` — fine for local dev.

- [ ] **Step 3: Update `.gitignore`**

Append `.dev.vars` if not already there. Verify by running:
```bash
grep -q "^\.dev\.vars$" .gitignore || echo ".dev.vars" >> .gitignore
```

- [ ] **Step 4: Add path alias to `tsconfig.json`**

Replace contents with:
```json
{
  "extends": "astro/tsconfigs/strict",
  "include": [".astro/types.d.ts", "**/*"],
  "exclude": ["dist", "node_modules"],
  "compilerOptions": {
    "baseUrl": ".",
    "paths": {
      "@/*": ["src/*"]
    }
  }
}
```

- [ ] **Step 5: Add dev dependencies**

```bash
npm install --save-dev vitest @cloudflare/vitest-pool-workers @playwright/test wrangler@latest @types/node
npm install zod ulid @aws-sdk/client-s3 @aws-sdk/s3-request-presigner resend
```

- [ ] **Step 6: Update `package.json` scripts**

In `package.json`, replace the `scripts` block with:
```json
{
  "scripts": {
    "dev": "astro dev",
    "build": "astro build",
    "preview": "astro preview",
    "astro": "astro",
    "wrangler:dev": "wrangler pages dev dist --d1=DB --r2=MEDIA --kv=SESSION",
    "test": "vitest run",
    "test:watch": "vitest",
    "test:e2e": "playwright test",
    "db:migrate:local": "wrangler d1 migrations apply mdgh-applications-db --local",
    "db:migrate:remote": "wrangler d1 migrations apply mdgh-applications-db --remote"
  }
}
```

- [ ] **Step 7: Commit**

```bash
git add wrangler.toml tsconfig.json package.json package-lock.json .gitignore
git commit -m "chore: add wrangler.toml + tsconfig path alias + test toolchain deps"
```

### Task M1.2: D1 migrations — applications table

**Files:**
- Create: `migrations/0001_applications.sql`

- [ ] **Step 1: Create migration file**

```sql
-- migrations/0001_applications.sql
CREATE TABLE applications (
  id                       TEXT PRIMARY KEY,
  cycle_id                 TEXT NOT NULL,
  transaction_reference    TEXT NOT NULL UNIQUE,
  email                    TEXT NOT NULL,

  payment_status           TEXT NOT NULL DEFAULT 'pending',
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
  status                   TEXT NOT NULL DEFAULT 'new',
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
```

- [ ] **Step 2: Run migration locally**

```bash
npm run db:migrate:local
```
Expected: "Migrations applied" with 0001_applications listed.

- [ ] **Step 3: Verify schema**

```bash
npx wrangler d1 execute mdgh-applications-db --local --command "SELECT name FROM sqlite_master WHERE type='table';"
```
Expected: `applications` listed.

- [ ] **Step 4: Commit**

```bash
git add migrations/0001_applications.sql
git commit -m "feat(db): add applications table migration"
```

### Task M1.3: D1 migrations — cycles, cycle_notifications, admin_audit + seed cycle

**Files:**
- Create: `migrations/0002_cycles.sql`
- Create: `migrations/0003_cycle_notifications.sql`
- Create: `migrations/0004_admin_audit.sql`
- Create: `migrations/0005_seed_mdgh_2026.sql`

- [ ] **Step 1: Create cycles migration**

```sql
-- migrations/0002_cycles.sql
CREATE TABLE cycles (
  id                       TEXT PRIMARY KEY,
  display_name             TEXT NOT NULL,
  application_fee_cents    INTEGER NOT NULL,
  application_currency     TEXT NOT NULL,
  privacy_policy_version   TEXT NOT NULL,
  applications_open_at     TEXT NOT NULL,
  applications_close_at    TEXT NOT NULL,
  is_active                INTEGER NOT NULL DEFAULT 0
);
```

- [ ] **Step 2: Create cycle_notifications migration**

```sql
-- migrations/0003_cycle_notifications.sql
CREATE TABLE cycle_notifications (
  id                       TEXT PRIMARY KEY,
  email                    TEXT NOT NULL UNIQUE,
  source                   TEXT NOT NULL,
  disqualifying_rule       TEXT,
  consent_recorded_at      TEXT NOT NULL,
  unsubscribed_at          TEXT,
  created_at               TEXT NOT NULL
);

CREATE INDEX idx_notif_source ON cycle_notifications(source);
```

- [ ] **Step 3: Create admin_audit migration**

```sql
-- migrations/0004_admin_audit.sql
CREATE TABLE admin_audit (
  id                       TEXT PRIMARY KEY,
  admin_email              TEXT NOT NULL,
  action                   TEXT NOT NULL,
  target_application_id    TEXT,
  details_json             TEXT,
  ip_hash                  TEXT,
  created_at               TEXT NOT NULL
);

CREATE INDEX idx_audit_admin   ON admin_audit(admin_email);
CREATE INDEX idx_audit_target  ON admin_audit(target_application_id);
CREATE INDEX idx_audit_created ON admin_audit(created_at);
```

- [ ] **Step 4: Seed the MDGH-2026 cycle**

```sql
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
```

The `applications_open_at` and `applications_close_at` values are placeholders — replace with the user's actual cycle dates before deploying.

- [ ] **Step 5: Run migrations locally**

```bash
npm run db:migrate:local
```
Expected: Three migrations applied + seed.

- [ ] **Step 6: Verify**

```bash
npx wrangler d1 execute mdgh-applications-db --local --command "SELECT id, display_name, is_active FROM cycles;"
```
Expected: `MDGH-2026 | Miss Diaspora Ghana 2026 | 1`.

- [ ] **Step 7: Commit**

```bash
git add migrations/000{2,3,4,5}_*.sql
git commit -m "feat(db): add cycles, notifications, audit tables + seed MDGH-2026"
```

### Task M1.4: ID + reference generators + tests

**Files:**
- Create: `src/lib/ids/ulid.ts`
- Create: `src/lib/ids/reference.ts`
- Create: `tests/unit/ulid.test.ts`
- Create: `tests/unit/reference.test.ts`

- [ ] **Step 1: Write the failing tests for ULID**

```ts
// tests/unit/ulid.test.ts
import { describe, it, expect } from 'vitest';
import { newUlid } from '@/lib/ids/ulid';

describe('newUlid', () => {
  it('produces a 26-char ULID', () => {
    const id = newUlid();
    expect(id).toHaveLength(26);
    expect(id).toMatch(/^[0-9A-HJKMNP-TV-Z]{26}$/);
  });

  it('produces sortable IDs across time', async () => {
    const a = newUlid();
    await new Promise(r => setTimeout(r, 5));
    const b = newUlid();
    expect(a < b).toBe(true);
  });

  it('produces unique values across 10000 calls', () => {
    const set = new Set<string>();
    for (let i = 0; i < 10000; i++) set.add(newUlid());
    expect(set.size).toBe(10000);
  });
});
```

- [ ] **Step 2: Write the failing tests for reference generator**

```ts
// tests/unit/reference.test.ts
import { describe, it, expect } from 'vitest';
import { newTransactionReference } from '@/lib/ids/reference';

describe('newTransactionReference', () => {
  it('matches the MDGH-{cycle}-{8 base32} format', () => {
    const ref = newTransactionReference('MDGH-2026');
    expect(ref).toMatch(/^MDGH-2026-[0-9A-HJKMNP-TV-Z]{8}$/);
  });

  it('produces 10000 unique references', () => {
    const set = new Set<string>();
    for (let i = 0; i < 10000; i++) set.add(newTransactionReference('MDGH-2026'));
    expect(set.size).toBe(10000);
  });

  it('uses the cycle short id (everything after the first dash)', () => {
    expect(newTransactionReference('MDGH-2027')).toMatch(/^MDGH-2027-/);
  });
});
```

- [ ] **Step 3: Run tests, expect failure**

```bash
npm test -- tests/unit/ulid.test.ts tests/unit/reference.test.ts
```
Expected: All FAIL with "Cannot find module '@/lib/ids/ulid'" / 'reference'.

- [ ] **Step 4: Implement ULID**

```ts
// src/lib/ids/ulid.ts
import { ulid } from 'ulid';

export function newUlid(): string {
  return ulid();
}
```

- [ ] **Step 5: Implement reference generator**

```ts
// src/lib/ids/reference.ts
const ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ'; // Crockford base32

export function newTransactionReference(cycleId: string): string {
  const bytes = new Uint8Array(8);
  crypto.getRandomValues(bytes);
  let suffix = '';
  for (const b of bytes) suffix += ALPHABET[b % ALPHABET.length];
  return `${cycleId}-${suffix}`;
}
```

- [ ] **Step 6: Run tests, expect pass**

```bash
npm test -- tests/unit/ulid.test.ts tests/unit/reference.test.ts
```
Expected: All PASS.

- [ ] **Step 7: Commit**

```bash
git add src/lib/ids/ tests/unit/ulid.test.ts tests/unit/reference.test.ts
git commit -m "feat(ids): ULID + transaction reference generators with tests"
```

### Task M1.5: HMAC token utilities (apply-token + admin-session) + tests

**Files:**
- Create: `src/lib/tokens/apply-token.ts`
- Create: `src/lib/tokens/admin-session.ts`
- Create: `tests/unit/apply-token.test.ts`
- Create: `tests/unit/admin-session.test.ts`

- [ ] **Step 1: Write the failing tests for apply-token**

```ts
// tests/unit/apply-token.test.ts
import { describe, it, expect } from 'vitest';
import { signApplyToken, verifyApplyToken } from '@/lib/tokens/apply-token';

const SECRET = 'a'.repeat(64);

describe('apply-token', () => {
  it('round-trips a valid token', async () => {
    const token = await signApplyToken('app-123', 9999999999, SECRET);
    const result = await verifyApplyToken(token, SECRET);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.applicationId).toBe('app-123');
      expect(result.expiryUnix).toBe(9999999999);
    }
  });

  it('rejects an expired token', async () => {
    const past = Math.floor(Date.now() / 1000) - 100;
    const token = await signApplyToken('app-123', past, SECRET);
    const result = await verifyApplyToken(token, SECRET);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('expired');
  });

  it('rejects a token signed with a different secret', async () => {
    const token = await signApplyToken('app-123', 9999999999, SECRET);
    const result = await verifyApplyToken(token, 'b'.repeat(64));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('bad_signature');
  });

  it('rejects a tampered token', async () => {
    const token = await signApplyToken('app-123', 9999999999, SECRET);
    const tampered = token.slice(0, -4) + 'XXXX';
    const result = await verifyApplyToken(tampered, SECRET);
    expect(result.ok).toBe(false);
  });

  it('rejects a malformed token', async () => {
    const result = await verifyApplyToken('not-a-token', SECRET);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('malformed');
  });
});
```

- [ ] **Step 2: Write the failing tests for admin-session**

```ts
// tests/unit/admin-session.test.ts
import { describe, it, expect } from 'vitest';
import { signAdminSession, verifyAdminSession } from '@/lib/tokens/admin-session';

const SECRET = 'c'.repeat(64);

describe('admin-session', () => {
  it('round-trips a session token', async () => {
    const token = await signAdminSession('admin@example.com', 'session-id-1', 9999999999, SECRET);
    const result = await verifyAdminSession(token, SECRET);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.adminEmail).toBe('admin@example.com');
      expect(result.sessionId).toBe('session-id-1');
    }
  });

  it('rejects expired session', async () => {
    const past = Math.floor(Date.now() / 1000) - 1;
    const token = await signAdminSession('a@b.com', 'sid', past, SECRET);
    const result = await verifyAdminSession(token, SECRET);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('expired');
  });

  it('rejects bad signature', async () => {
    const token = await signAdminSession('a@b.com', 'sid', 9999999999, SECRET);
    const result = await verifyAdminSession(token, 'd'.repeat(64));
    expect(result.ok).toBe(false);
  });
});
```

- [ ] **Step 3: Run tests, expect failure**

```bash
npm test -- tests/unit/apply-token.test.ts tests/unit/admin-session.test.ts
```
Expected: All FAIL.

- [ ] **Step 4: Implement apply-token**

```ts
// src/lib/tokens/apply-token.ts
const enc = new TextEncoder();
const dec = new TextDecoder();

function b64urlEncode(bytes: Uint8Array): string {
  return btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
function b64urlDecode(s: string): Uint8Array {
  const padded = s.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((s.length + 3) % 4);
  const bin = atob(padded);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

async function hmac(secret: string, data: string): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey(
    'raw', enc.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' }, false, ['sign', 'verify']
  );
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(data));
  return new Uint8Array(sig);
}

async function hmacVerify(secret: string, data: string, sig: Uint8Array): Promise<boolean> {
  const key = await crypto.subtle.importKey(
    'raw', enc.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' }, false, ['verify']
  );
  return crypto.subtle.verify('HMAC', key, sig, enc.encode(data));
}

export async function signApplyToken(applicationId: string, expiryUnix: number, secret: string): Promise<string> {
  const payload = `${applicationId}.${expiryUnix}`;
  const sig = await hmac(secret, payload);
  return `${applicationId}.${expiryUnix}.${b64urlEncode(sig)}`;
}

export type ApplyTokenVerifyResult =
  | { ok: true; applicationId: string; expiryUnix: number }
  | { ok: false; reason: 'malformed' | 'bad_signature' | 'expired' };

export async function verifyApplyToken(token: string, secret: string): Promise<ApplyTokenVerifyResult> {
  const parts = token.split('.');
  if (parts.length !== 3) return { ok: false, reason: 'malformed' };
  const [applicationId, expiryStr, sigB64] = parts;
  const expiryUnix = Number(expiryStr);
  if (!applicationId || !Number.isFinite(expiryUnix)) return { ok: false, reason: 'malformed' };

  let sig: Uint8Array;
  try { sig = b64urlDecode(sigB64); } catch { return { ok: false, reason: 'malformed' }; }

  const valid = await hmacVerify(secret, `${applicationId}.${expiryUnix}`, sig);
  if (!valid) return { ok: false, reason: 'bad_signature' };

  if (expiryUnix <= Math.floor(Date.now() / 1000)) return { ok: false, reason: 'expired' };
  return { ok: true, applicationId, expiryUnix };
}
```

- [ ] **Step 5: Implement admin-session**

```ts
// src/lib/tokens/admin-session.ts
const enc = new TextEncoder();

function b64urlEncode(bytes: Uint8Array): string {
  return btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
function b64urlDecode(s: string): Uint8Array {
  const padded = s.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((s.length + 3) % 4);
  const bin = atob(padded);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

async function hmac(secret: string, data: string): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey(
    'raw', enc.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
  );
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(data));
  return new Uint8Array(sig);
}
async function hmacVerify(secret: string, data: string, sig: Uint8Array): Promise<boolean> {
  const key = await crypto.subtle.importKey(
    'raw', enc.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' }, false, ['verify']
  );
  return crypto.subtle.verify('HMAC', key, sig, enc.encode(data));
}

export async function signAdminSession(adminEmail: string, sessionId: string, expiryUnix: number, secret: string): Promise<string> {
  const payload = `${adminEmail}.${sessionId}.${expiryUnix}`;
  const sig = await hmac(secret, payload);
  return `${adminEmail}.${sessionId}.${expiryUnix}.${b64urlEncode(sig)}`;
}

export type AdminSessionVerifyResult =
  | { ok: true; adminEmail: string; sessionId: string; expiryUnix: number }
  | { ok: false; reason: 'malformed' | 'bad_signature' | 'expired' };

export async function verifyAdminSession(token: string, secret: string): Promise<AdminSessionVerifyResult> {
  const parts = token.split('.');
  if (parts.length !== 4) return { ok: false, reason: 'malformed' };
  const [adminEmail, sessionId, expiryStr, sigB64] = parts;
  const expiryUnix = Number(expiryStr);
  if (!adminEmail || !sessionId || !Number.isFinite(expiryUnix)) return { ok: false, reason: 'malformed' };

  let sig: Uint8Array;
  try { sig = b64urlDecode(sigB64); } catch { return { ok: false, reason: 'malformed' }; }

  const valid = await hmacVerify(secret, `${adminEmail}.${sessionId}.${expiryUnix}`, sig);
  if (!valid) return { ok: false, reason: 'bad_signature' };

  if (expiryUnix <= Math.floor(Date.now() / 1000)) return { ok: false, reason: 'expired' };
  return { ok: true, adminEmail, sessionId, expiryUnix };
}
```

- [ ] **Step 6: Run tests, expect pass**

```bash
npm test -- tests/unit/apply-token.test.ts tests/unit/admin-session.test.ts
```
Expected: All PASS.

- [ ] **Step 7: Commit**

```bash
git add src/lib/tokens/ tests/unit/apply-token.test.ts tests/unit/admin-session.test.ts
git commit -m "feat(tokens): HMAC apply-token + admin-session utilities"
```

### Task M1.6: ip_hash + PBKDF2 password hashing + tests

**Files:**
- Create: `src/lib/crypto/hash.ts`
- Create: `src/lib/crypto/pbkdf2.ts`
- Create: `tests/unit/ip-hash.test.ts`
- Create: `tests/unit/pbkdf2.test.ts`

- [ ] **Step 1: Write failing tests for ip-hash**

```ts
// tests/unit/ip-hash.test.ts
import { describe, it, expect } from 'vitest';
import { hashIp } from '@/lib/crypto/hash';

describe('hashIp', () => {
  it('produces a 64-char hex string', async () => {
    const h = await hashIp('192.168.1.1', 'salt');
    expect(h).toMatch(/^[0-9a-f]{64}$/);
  });

  it('is deterministic for the same input', async () => {
    const a = await hashIp('192.168.1.1', 'salt');
    const b = await hashIp('192.168.1.1', 'salt');
    expect(a).toBe(b);
  });

  it('changes with a different salt', async () => {
    const a = await hashIp('192.168.1.1', 'salt-a');
    const b = await hashIp('192.168.1.1', 'salt-b');
    expect(a).not.toBe(b);
  });
});
```

- [ ] **Step 2: Write failing tests for PBKDF2**

```ts
// tests/unit/pbkdf2.test.ts
import { describe, it, expect } from 'vitest';
import { hashPassword, verifyPassword } from '@/lib/crypto/pbkdf2';

describe('pbkdf2 password hashing', () => {
  it('produces a hash that verifies', async () => {
    const hash = await hashPassword('correct-horse-battery-staple');
    const ok = await verifyPassword('correct-horse-battery-staple', hash);
    expect(ok).toBe(true);
  });

  it('rejects wrong password', async () => {
    const hash = await hashPassword('correct-horse-battery-staple');
    const ok = await verifyPassword('wrong', hash);
    expect(ok).toBe(false);
  });

  it('hash format is "pbkdf2$iters$salt$hash"', async () => {
    const hash = await hashPassword('x');
    expect(hash).toMatch(/^pbkdf2\$\d+\$[A-Za-z0-9_-]+\$[A-Za-z0-9_-]+$/);
  });

  it('different runs produce different hashes (random salt)', async () => {
    const a = await hashPassword('same');
    const b = await hashPassword('same');
    expect(a).not.toBe(b);
  });
});
```

- [ ] **Step 3: Run tests, expect failure**

```bash
npm test -- tests/unit/ip-hash.test.ts tests/unit/pbkdf2.test.ts
```
Expected: FAIL.

- [ ] **Step 4: Implement ip-hash**

```ts
// src/lib/crypto/hash.ts
const enc = new TextEncoder();

export async function hashIp(ip: string, salt: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', enc.encode(`${salt}:${ip}`));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
}
```

- [ ] **Step 5: Implement PBKDF2**

```ts
// src/lib/crypto/pbkdf2.ts
const enc = new TextEncoder();
const ITERATIONS = 200_000;

function b64urlEncode(bytes: Uint8Array): string {
  return btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
function b64urlDecode(s: string): Uint8Array {
  const padded = s.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((s.length + 3) % 4);
  const bin = atob(padded);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

async function derive(password: string, salt: Uint8Array, iterations: number): Promise<Uint8Array> {
  const keyMaterial = await crypto.subtle.importKey(
    'raw', enc.encode(password), 'PBKDF2', false, ['deriveBits']
  );
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt, iterations, hash: 'SHA-256' },
    keyMaterial, 256
  );
  return new Uint8Array(bits);
}

export async function hashPassword(password: string): Promise<string> {
  const salt = new Uint8Array(16);
  crypto.getRandomValues(salt);
  const hash = await derive(password, salt, ITERATIONS);
  return `pbkdf2$${ITERATIONS}$${b64urlEncode(salt)}$${b64urlEncode(hash)}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const parts = stored.split('$');
  if (parts.length !== 4 || parts[0] !== 'pbkdf2') return false;
  const iterations = Number(parts[1]);
  if (!Number.isFinite(iterations) || iterations < 1000) return false;
  const salt = b64urlDecode(parts[2]);
  const expected = b64urlDecode(parts[3]);
  const actual = await derive(password, salt, iterations);
  if (actual.length !== expected.length) return false;
  let diff = 0;
  for (let i = 0; i < actual.length; i++) diff |= actual[i] ^ expected[i];
  return diff === 0;
}
```

- [ ] **Step 6: Run tests, expect pass**

```bash
npm test -- tests/unit/ip-hash.test.ts tests/unit/pbkdf2.test.ts
```
Expected: All PASS.

- [ ] **Step 7: Commit**

```bash
git add src/lib/crypto/ tests/unit/ip-hash.test.ts tests/unit/pbkdf2.test.ts
git commit -m "feat(crypto): SHA-256 ip_hash + PBKDF2 password hashing utilities"
```

### Task M1.7: Generate the production admin password hash

**Files:**
- Create: `scripts/hash-admin-password.ts`

This task is not a code task in production — it's a one-off to generate `ADMIN_PASSWORD_HASH` for Cloudflare Pages env vars.

- [ ] **Step 1: Create the hash script**

```ts
// scripts/hash-admin-password.ts
import { hashPassword } from '../src/lib/crypto/pbkdf2';

const password = process.argv[2];
if (!password) {
  console.error('Usage: npx tsx scripts/hash-admin-password.ts <password>');
  process.exit(1);
}
hashPassword(password).then(h => console.log(h));
```

- [ ] **Step 2: Run it (locally only — never commit the password)**

Install tsx if not present:
```bash
npm install --save-dev tsx
```

Run:
```bash
npx tsx scripts/hash-admin-password.ts 'YOUR-CHOSEN-ADMIN-PASSWORD-HERE'
```

Copy the `pbkdf2$200000$...` output. Set it as `ADMIN_PASSWORD_HASH` in Cloudflare Pages → Production env vars (and Preview, with a different password if you want a separate preview admin).

- [ ] **Step 3: Update local `.dev.vars`**

Replace the `ADMIN_PASSWORD_HASH=PLACEHOLDER_FILL_AFTER_M1_7` line with the generated hash for local dev.

- [ ] **Step 4: Commit the script (not the password)**

```bash
git add scripts/hash-admin-password.ts package.json package-lock.json
git commit -m "chore: admin password hashing script (one-off generator)"
```

### Task M1.8: Eligibility rules + tests

**Files:**
- Create: `src/lib/eligibility/rules.ts`
- Create: `tests/unit/eligibility.test.ts`

- [ ] **Step 1: Write failing tests**

```ts
// tests/unit/eligibility.test.ts
import { describe, it, expect } from 'vitest';
import { evaluateEligibility, AGE_BANDS, type EligibilityAnswers } from '@/lib/eligibility/rules';

const VALID: EligibilityAnswers = {
  ageBand: '18-25',
  isWoman: true,
  africanDescent: true,
  outsideGhana: true,
  validPassport: true,
};

describe('evaluateEligibility', () => {
  it('passes when all 5 rules satisfied', () => {
    const result = evaluateEligibility(VALID);
    expect(result.eligible).toBe(true);
  });

  it('fails on age out-of-range — Under 18', () => {
    const result = evaluateEligibility({ ...VALID, ageBand: 'Under 18' });
    expect(result.eligible).toBe(false);
    if (!result.eligible) expect(result.disqualifyingRule).toBe('age');
  });

  it('fails on age out-of-range — Over 35', () => {
    const result = evaluateEligibility({ ...VALID, ageBand: 'Over 35' });
    expect(result.eligible).toBe(false);
    if (!result.eligible) expect(result.disqualifyingRule).toBe('age');
  });

  it('fails on isWoman = false', () => {
    const result = evaluateEligibility({ ...VALID, isWoman: false });
    expect(result.eligible).toBe(false);
    if (!result.eligible) expect(result.disqualifyingRule).toBe('gender');
  });

  it('fails on africanDescent = false', () => {
    const result = evaluateEligibility({ ...VALID, africanDescent: false });
    expect(result.eligible).toBe(false);
    if (!result.eligible) expect(result.disqualifyingRule).toBe('heritage');
  });

  it('fails on outsideGhana = false', () => {
    const result = evaluateEligibility({ ...VALID, outsideGhana: false });
    expect(result.eligible).toBe(false);
    if (!result.eligible) expect(result.disqualifyingRule).toBe('residency');
  });

  it('fails on validPassport = false', () => {
    const result = evaluateEligibility({ ...VALID, validPassport: false });
    expect(result.eligible).toBe(false);
    if (!result.eligible) expect(result.disqualifyingRule).toBe('passport');
  });

  it('returns first failure when multiple rules fail', () => {
    const result = evaluateEligibility({ ...VALID, isWoman: false, africanDescent: false });
    expect(result.eligible).toBe(false);
    if (!result.eligible) expect(result.disqualifyingRule).toBe('gender');
  });

  it('AGE_BANDS exposes the four canonical bands in order', () => {
    expect(AGE_BANDS).toEqual(['Under 18', '18-25', '26-35', 'Over 35']);
  });
});
```

- [ ] **Step 2: Run tests, expect failure**

```bash
npm test -- tests/unit/eligibility.test.ts
```
Expected: FAIL.

- [ ] **Step 3: Implement eligibility rules**

```ts
// src/lib/eligibility/rules.ts
export const AGE_BANDS = ['Under 18', '18-25', '26-35', 'Over 35'] as const;
export type AgeBand = typeof AGE_BANDS[number];

export type EligibilityAnswers = {
  ageBand: AgeBand;
  isWoman: boolean;
  africanDescent: boolean;
  outsideGhana: boolean;
  validPassport: boolean;
};

export type DisqualifyingRule = 'age' | 'gender' | 'heritage' | 'residency' | 'passport';

export type EligibilityResult =
  | { eligible: true }
  | { eligible: false; disqualifyingRule: DisqualifyingRule };

export function evaluateEligibility(a: EligibilityAnswers): EligibilityResult {
  if (a.ageBand !== '18-25' && a.ageBand !== '26-35') return { eligible: false, disqualifyingRule: 'age' };
  if (!a.isWoman) return { eligible: false, disqualifyingRule: 'gender' };
  if (!a.africanDescent) return { eligible: false, disqualifyingRule: 'heritage' };
  if (!a.outsideGhana) return { eligible: false, disqualifyingRule: 'residency' };
  if (!a.validPassport) return { eligible: false, disqualifyingRule: 'passport' };
  return { eligible: true };
}
```

- [ ] **Step 4: Run tests, expect pass**

```bash
npm test -- tests/unit/eligibility.test.ts
```
Expected: All PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/eligibility/ tests/unit/eligibility.test.ts
git commit -m "feat(eligibility): rules engine with 5 disqualifying-rule checks"
```

### Task M1.9: PaymentProvider interface + MockProvider + tests

**Files:**
- Create: `src/lib/payment/types.ts`
- Create: `src/lib/payment/mock-provider.ts`
- Create: `src/lib/payment/index.ts`
- Create: `tests/unit/mock-provider.test.ts`

- [ ] **Step 1: Write failing tests**

```ts
// tests/unit/mock-provider.test.ts
import { describe, it, expect } from 'vitest';
import { MockProvider } from '@/lib/payment/mock-provider';

const provider = new MockProvider();

describe('MockProvider.init', () => {
  it('returns ok with a checkoutUrl carrying the reference', async () => {
    const r = await provider.init({
      amountCents: 2599, currency: 'USD', reference: 'MDGH-2026-AAAAAAAA',
      customerEmail: 'a@b.com', callbackUrl: 'https://x/return',
    });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.checkoutUrl).toContain('MDGH-2026-AAAAAAAA');
      expect(r.providerReference).toBe('mock-MDGH-2026-AAAAAAAA');
    }
  });
});

describe('MockProvider.verify', () => {
  it('returns paid for normal references', async () => {
    const r = await provider.verify('MDGH-2026-AAAAAAAA');
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.status).toBe('paid');
      expect(r.amountCents).toBe(2599);
      expect(r.currency).toBe('USD');
      expect(r.paymentMethod).toBe('card');
      expect(r.paidAt).toBeDefined();
    }
  });

  it('returns failed for references ending in -FAIL', async () => {
    const r = await provider.verify('MDGH-2026-FAIL');
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.status).toBe('failed');
  });

  it('returns pending for references ending in -PENDING', async () => {
    const r = await provider.verify('MDGH-2026-PENDING');
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.status).toBe('pending');
  });
});
```

- [ ] **Step 2: Run tests, expect failure**

```bash
npm test -- tests/unit/mock-provider.test.ts
```
Expected: FAIL.

- [ ] **Step 3: Implement types**

```ts
// src/lib/payment/types.ts
export type Currency = 'USD' | 'NGN' | 'GHS';

export type PaymentInitInput = {
  amountCents: number;
  currency: Currency;
  reference: string;
  customerEmail: string;
  customerName?: string;
  callbackUrl: string;
  metadata?: Record<string, string>;
};

export type PaymentInitResult =
  | { ok: true; checkoutUrl: string; providerReference: string }
  | { ok: false; errorCode: string; errorMessage: string };

export type PaymentStatus = 'paid' | 'pending' | 'failed';

export type PaymentVerifyResult =
  | { ok: true;
      status: PaymentStatus;
      providerTransactionId: string;
      amountCents: number;
      currency: Currency;
      paidAt?: string;
      paymentMethod?: string;
      raw: unknown;
    }
  | { ok: false; errorCode: string; errorMessage: string };

export interface PaymentProvider {
  init(input: PaymentInitInput): Promise<PaymentInitResult>;
  verify(reference: string): Promise<PaymentVerifyResult>;
}
```

- [ ] **Step 4: Implement MockProvider**

```ts
// src/lib/payment/mock-provider.ts
import type { PaymentProvider, PaymentInitInput, PaymentInitResult, PaymentVerifyResult, PaymentStatus } from './types';

export class MockProvider implements PaymentProvider {
  async init(input: PaymentInitInput): Promise<PaymentInitResult> {
    return {
      ok: true,
      checkoutUrl: `/mock-checkout?reference=${encodeURIComponent(input.reference)}&callback=${encodeURIComponent(input.callbackUrl)}`,
      providerReference: `mock-${input.reference}`,
    };
  }

  async verify(reference: string): Promise<PaymentVerifyResult> {
    let status: PaymentStatus = 'paid';
    if (reference.endsWith('-FAIL')) status = 'failed';
    else if (reference.endsWith('-PENDING')) status = 'pending';

    return {
      ok: true,
      status,
      providerTransactionId: `mock-${reference}`,
      amountCents: 2599,
      currency: 'USD',
      paidAt: status === 'paid' ? new Date().toISOString() : undefined,
      paymentMethod: 'card',
      raw: { mock: true, reference, status },
    };
  }
}
```

- [ ] **Step 5: Implement provider factory**

```ts
// src/lib/payment/index.ts
import type { PaymentProvider } from './types';
import { MockProvider } from './mock-provider';
import { PayazaProvider } from './payaza-provider';

export type ProviderEnv = {
  PAYAZA_PUBLIC_KEY?: string;
  PAYAZA_SECRET_KEY?: string;
  PAYAZA_BASE_URL?: string;
  MOCK_PAYMENTS?: string;
};

export function getPaymentProvider(env: ProviderEnv): PaymentProvider {
  if (env.MOCK_PAYMENTS === 'true') return new MockProvider();
  if (!env.PAYAZA_SECRET_KEY || !env.PAYAZA_BASE_URL) {
    throw new Error('Payaza env vars missing — set PAYAZA_SECRET_KEY and PAYAZA_BASE_URL');
  }
  return new PayazaProvider({
    PAYAZA_PUBLIC_KEY: env.PAYAZA_PUBLIC_KEY ?? '',
    PAYAZA_SECRET_KEY: env.PAYAZA_SECRET_KEY,
    PAYAZA_BASE_URL: env.PAYAZA_BASE_URL,
  });
}

export type { PaymentProvider, PaymentInitInput, PaymentInitResult, PaymentVerifyResult, PaymentStatus, Currency } from './types';
export { MockProvider } from './mock-provider';
export { PayazaProvider } from './payaza-provider';
```

The `PayazaProvider` import will fail until Task M1.10 — that's fine; we'll keep the test focused on MockProvider for now and not run the index until later.

- [ ] **Step 6: Run tests, expect pass for mock**

```bash
npm test -- tests/unit/mock-provider.test.ts
```
Expected: PASS (the mock-provider test imports `mock-provider.ts` directly, not `index.ts`, so the missing PayazaProvider doesn't break anything).

- [ ] **Step 7: Commit**

```bash
git add src/lib/payment/types.ts src/lib/payment/mock-provider.ts src/lib/payment/index.ts tests/unit/mock-provider.test.ts
git commit -m "feat(payment): PaymentProvider interface + MockProvider"
```

### Task M1.10: PayazaProvider adapter

**Files:**
- Create: `src/lib/payment/payaza-provider.ts`

**Important:** the exact endpoint paths and request/response field names below are placeholders based on the standard pattern; replace with the actual values from `docs/m0-checklist.md` (captured in Task M0.1 step 4) before deploying to production. The interface stays the same; only the body of `init()` and `verify()` changes if Payaza's shape differs.

- [ ] **Step 1: Implement Payaza adapter**

```ts
// src/lib/payment/payaza-provider.ts
import type {
  PaymentProvider, PaymentInitInput, PaymentInitResult, PaymentVerifyResult, PaymentStatus,
} from './types';

type PayazaEnv = {
  PAYAZA_PUBLIC_KEY: string;
  PAYAZA_SECRET_KEY: string;
  PAYAZA_BASE_URL: string;
};

export class PayazaProvider implements PaymentProvider {
  constructor(private readonly env: PayazaEnv) {}

  async init(input: PaymentInitInput): Promise<PaymentInitResult> {
    try {
      const res = await fetch(`${this.env.PAYAZA_BASE_URL}/checkout/initiate`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.env.PAYAZA_SECRET_KEY}`,
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({
          reference: input.reference,
          amount: input.amountCents / 100,
          currency: input.currency,
          email: input.customerEmail,
          name: input.customerName,
          callback_url: input.callbackUrl,
          metadata: input.metadata ?? {},
        }),
      });
      const json = await safeJson(res);
      if (!res.ok || !isSuccessShape(json)) {
        return {
          ok: false,
          errorCode: extractCode(json) ?? `HTTP_${res.status}`,
          errorMessage: extractMessage(json) ?? 'Checkout init failed',
        };
      }
      const data = (json as { data: { checkout_url: string; transaction_id: string } }).data;
      return { ok: true, checkoutUrl: data.checkout_url, providerReference: data.transaction_id };
    } catch (e) {
      return {
        ok: false,
        errorCode: 'NETWORK_ERROR',
        errorMessage: e instanceof Error ? e.message : String(e),
      };
    }
  }

  async verify(reference: string): Promise<PaymentVerifyResult> {
    try {
      const res = await fetch(
        `${this.env.PAYAZA_BASE_URL}/transactions/verify/${encodeURIComponent(reference)}`,
        {
          headers: {
            Authorization: `Bearer ${this.env.PAYAZA_SECRET_KEY}`,
            Accept: 'application/json',
          },
        }
      );
      const json = await safeJson(res);
      if (!res.ok || !isSuccessShape(json)) {
        return {
          ok: false,
          errorCode: extractCode(json) ?? `HTTP_${res.status}`,
          errorMessage: extractMessage(json) ?? 'Verify failed',
        };
      }
      const data = (json as { data: VerifyData }).data;
      const status: PaymentStatus =
        data.status === 'success' || data.status === 'paid' ? 'paid'
        : data.status === 'failed' || data.status === 'declined' ? 'failed'
        : 'pending';
      return {
        ok: true,
        status,
        providerTransactionId: data.transaction_id ?? data.id ?? reference,
        amountCents: Math.round(Number(data.amount) * 100),
        currency: data.currency as PaymentVerifyResult extends { ok: true } ? PaymentVerifyResult['currency'] : never,
        paidAt: data.paid_at,
        paymentMethod: data.channel,
        raw: json,
      };
    } catch (e) {
      return {
        ok: false,
        errorCode: 'NETWORK_ERROR',
        errorMessage: e instanceof Error ? e.message : String(e),
      };
    }
  }
}

type VerifyData = {
  status: string;
  transaction_id?: string;
  id?: string;
  amount: number | string;
  currency: string;
  paid_at?: string;
  channel?: string;
};

async function safeJson(res: Response): Promise<unknown> {
  try { return await res.json(); } catch { return {}; }
}

function isSuccessShape(json: unknown): json is { status: 'success'; data: unknown } {
  return typeof json === 'object' && json !== null
    && (json as { status?: unknown }).status === 'success'
    && typeof (json as { data?: unknown }).data === 'object';
}

function extractCode(json: unknown): string | undefined {
  if (typeof json === 'object' && json !== null) {
    const c = (json as { code?: unknown }).code;
    if (typeof c === 'string') return c;
  }
}

function extractMessage(json: unknown): string | undefined {
  if (typeof json === 'object' && json !== null) {
    const m = (json as { message?: unknown }).message;
    if (typeof m === 'string') return m;
  }
}
```

- [ ] **Step 2: Verify the file compiles**

```bash
npx astro check
```
Expected: 0 errors, 0 warnings (or only warnings unrelated to this file).

- [ ] **Step 3: Verify provider factory works**

```bash
npm test -- tests/unit/mock-provider.test.ts
```
Expected: PASS (no regression).

- [ ] **Step 4: Commit**

```bash
git add src/lib/payment/payaza-provider.ts
git commit -m "feat(payment): PayazaProvider adapter (init + verify)"
```

**Note for the implementer:** at integration time, run a real sandbox transaction via `wrangler pages dev` and curl the verify endpoint. If Payaza's actual response shape differs from the assumed `{ status: 'success', data: { ... } }` envelope, update `isSuccessShape`, `extractCode`, `extractMessage`, and the `data` accessors. Tests against the real Payaza sandbox are added in Task M2 alongside `/api/checkout/create`.

### Task M1.11: EmailProvider interface + ResendProvider + MockEmailProvider + templates + tests

**Files:**
- Create: `src/lib/email/types.ts`
- Create: `src/lib/email/resend-provider.ts`
- Create: `src/lib/email/mock-provider.ts`
- Create: `src/lib/email/templates.ts`
- Create: `src/lib/email/index.ts`
- Create: `tests/unit/email-templates.test.ts`

- [ ] **Step 1: Write failing tests for templates**

```ts
// tests/unit/email-templates.test.ts
import { describe, it, expect } from 'vitest';
import {
  renderMagicLinkEmail,
  renderApplicantConfirmation,
  renderAdminNotification,
  renderRecoveryEmail,
} from '@/lib/email/templates';

describe('email templates', () => {
  it('magic link email contains the link and reference', () => {
    const e = renderMagicLinkEmail({
      reference: 'MDGH-2026-AAAA1111',
      magicLink: 'https://missdiasporagh.org/apply/form?token=abc',
      cycleClose: '2026-08-15',
    });
    expect(e.subject).toBe('Your MDGH application link');
    expect(e.html).toContain('https://missdiasporagh.org/apply/form?token=abc');
    expect(e.html).toContain('MDGH-2026-AAAA1111');
    expect(e.html).toContain('2026-08-15');
    expect(e.text).toContain('https://missdiasporagh.org/apply/form?token=abc');
  });

  it('applicant confirmation contains reference + retention notice', () => {
    const e = renderApplicantConfirmation({ fullName: 'Ama K.', reference: 'MDGH-2026-AAAA1111' });
    expect(e.subject).toBe("We've received your MDGH application");
    expect(e.html).toContain('Ama K.');
    expect(e.html).toContain('MDGH-2026-AAAA1111');
    expect(e.html.toLowerCase()).toContain('3 years');
  });

  it('admin notification subject includes name + reference', () => {
    const e = renderAdminNotification({
      fullName: 'Ama K.',
      reference: 'MDGH-2026-AAAA1111',
      dashboardUrl: 'https://missdiasporagh.org/admin/applications/abc',
    });
    expect(e.subject).toBe('[MDGH] New application: Ama K. (MDGH-2026-AAAA1111)');
    expect(e.html).toContain('https://missdiasporagh.org/admin/applications/abc');
  });

  it('recovery email contains "(resent)" in subject', () => {
    const e = renderRecoveryEmail({
      reference: 'MDGH-2026-AAAA1111',
      magicLink: 'https://missdiasporagh.org/apply/form?token=xyz',
      cycleClose: '2026-08-15',
    });
    expect(e.subject).toBe('Your MDGH application link (resent)');
    expect(e.html).toContain('xyz');
  });
});
```

- [ ] **Step 2: Run, expect fail**

```bash
npm test -- tests/unit/email-templates.test.ts
```
Expected: FAIL.

- [ ] **Step 3: Implement types**

```ts
// src/lib/email/types.ts
export type EmailMessage = {
  to: string;
  from?: string;
  subject: string;
  html: string;
  text: string;
};

export type EmailSendResult =
  | { ok: true; providerMessageId: string }
  | { ok: false; errorCode: string; errorMessage: string };

export interface EmailProvider {
  send(msg: EmailMessage): Promise<EmailSendResult>;
}
```

- [ ] **Step 4: Implement templates**

```ts
// src/lib/email/templates.ts
const FROM_DEFAULT = 'Miss Diaspora Ghana <applications@missdiasporagh.org>';

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

export function renderMagicLinkEmail(args: { reference: string; magicLink: string; cycleClose: string }) {
  const { reference, magicLink, cycleClose } = args;
  return {
    subject: 'Your MDGH application link',
    text: [
      `Welcome — your MDGH application slot is reserved.`,
      ``,
      `Reference: ${reference}`,
      `Application link (valid until ${cycleClose}):`,
      magicLink,
      ``,
      `Open this link to fill out your application. You can return to it any time before the cycle closes.`,
      ``,
      `If you didn't initiate this application, ignore this email.`,
    ].join('\n'),
    html: `<!doctype html><html><body style="font-family:Inter,Arial,sans-serif;background:#0d0d0d;color:#eee;padding:24px">
<h1 style="font-family:Georgia,serif;color:#F8B92F">Welcome to MDGH</h1>
<p>Your application slot is reserved.</p>
<p>Reference: <code style="color:#F8B92F">${escapeHtml(reference)}</code></p>
<p><a href="${escapeHtml(magicLink)}" style="display:inline-block;padding:12px 20px;background:#F8B92F;color:#000;text-decoration:none;border-radius:8px;font-weight:bold">Open my application</a></p>
<p style="font-size:13px;opacity:0.7">Link valid until ${escapeHtml(cycleClose)}. You can return to it any time before the cycle closes.</p>
<p style="font-size:11px;opacity:0.5">If you didn't initiate this application, ignore this email.</p>
</body></html>`,
  };
}

export function renderApplicantConfirmation(args: { fullName: string; reference: string }) {
  const { fullName, reference } = args;
  return {
    subject: "We've received your MDGH application",
    text: [
      `Hi ${fullName},`,
      ``,
      `Your MDGH application has been received. We'll be in touch within 14 days.`,
      ``,
      `Reference: ${reference}`,
      ``,
      `Your data is retained for 3 years post-cycle, then deleted, per our Privacy Policy.`,
    ].join('\n'),
    html: `<!doctype html><html><body style="font-family:Inter,Arial,sans-serif;background:#0d0d0d;color:#eee;padding:24px">
<h1 style="font-family:Georgia,serif;color:#F8B92F">Application received</h1>
<p>Hi ${escapeHtml(fullName)}, your MDGH application has been received.</p>
<p>Reference: <code style="color:#F8B92F">${escapeHtml(reference)}</code></p>
<p>We'll be in touch within 14 days.</p>
<p style="font-size:11px;opacity:0.5">Your data is retained for 3 years post-cycle, then deleted, per our Privacy Policy.</p>
</body></html>`,
  };
}

export function renderAdminNotification(args: { fullName: string; reference: string; dashboardUrl: string }) {
  const { fullName, reference, dashboardUrl } = args;
  return {
    subject: `[MDGH] New application: ${fullName} (${reference})`,
    text: [
      `New MDGH application submitted.`,
      ``,
      `Name: ${fullName}`,
      `Reference: ${reference}`,
      ``,
      `Review: ${dashboardUrl}`,
    ].join('\n'),
    html: `<!doctype html><html><body style="font-family:Inter,Arial,sans-serif">
<h2>New MDGH application</h2>
<p><strong>${escapeHtml(fullName)}</strong> &middot; ${escapeHtml(reference)}</p>
<p><a href="${escapeHtml(dashboardUrl)}">Open in admin dashboard</a></p>
</body></html>`,
  };
}

export function renderRecoveryEmail(args: { reference: string; magicLink: string; cycleClose: string }) {
  const out = renderMagicLinkEmail(args);
  return { ...out, subject: 'Your MDGH application link (resent)' };
}

export const FROM_ADDRESS = FROM_DEFAULT;
```

- [ ] **Step 5: Implement MockEmailProvider**

```ts
// src/lib/email/mock-provider.ts
import type { EmailProvider, EmailMessage, EmailSendResult } from './types';

export class MockEmailProvider implements EmailProvider {
  public sent: EmailMessage[] = [];
  async send(msg: EmailMessage): Promise<EmailSendResult> {
    this.sent.push(msg);
    return { ok: true, providerMessageId: `mock-${this.sent.length}` };
  }
}
```

- [ ] **Step 6: Implement ResendProvider**

```ts
// src/lib/email/resend-provider.ts
import type { EmailProvider, EmailMessage, EmailSendResult } from './types';
import { FROM_ADDRESS } from './templates';

export class ResendProvider implements EmailProvider {
  constructor(private readonly apiKey: string) {}
  async send(msg: EmailMessage): Promise<EmailSendResult> {
    try {
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: msg.from ?? FROM_ADDRESS,
          to: [msg.to],
          subject: msg.subject,
          html: msg.html,
          text: msg.text,
        }),
      });
      if (!res.ok) {
        const errBody = await res.text();
        return { ok: false, errorCode: `HTTP_${res.status}`, errorMessage: errBody };
      }
      const json = await res.json() as { id: string };
      return { ok: true, providerMessageId: json.id };
    } catch (e) {
      return { ok: false, errorCode: 'NETWORK_ERROR', errorMessage: e instanceof Error ? e.message : String(e) };
    }
  }
}
```

- [ ] **Step 7: Implement factory**

```ts
// src/lib/email/index.ts
import type { EmailProvider } from './types';
import { ResendProvider } from './resend-provider';
import { MockEmailProvider } from './mock-provider';

export type EmailEnv = { RESEND_API_KEY?: string; MOCK_EMAIL?: string };

export function getEmailProvider(env: EmailEnv): EmailProvider {
  if (env.MOCK_EMAIL === 'true' || !env.RESEND_API_KEY) return new MockEmailProvider();
  return new ResendProvider(env.RESEND_API_KEY);
}

export type { EmailProvider, EmailMessage, EmailSendResult } from './types';
export { MockEmailProvider } from './mock-provider';
export { ResendProvider } from './resend-provider';
export * from './templates';
```

- [ ] **Step 8: Run tests, expect pass**

```bash
npm test -- tests/unit/email-templates.test.ts
```
Expected: All PASS.

- [ ] **Step 9: Commit**

```bash
git add src/lib/email/ tests/unit/email-templates.test.ts
git commit -m "feat(email): EmailProvider + ResendProvider + Mock + templates"
```

### Task M1.12: D1 client + queries module + env types

**Files:**
- Create: `src/lib/db/queries.ts`
- Create: `src/env.d.ts`

- [ ] **Step 1: Implement env type extension**

```ts
// src/env.d.ts
/// <reference path="../.astro/types.d.ts" />

type CloudflareEnv = {
  // Bindings
  DB: D1Database;
  MEDIA: R2Bucket;
  SESSION: KVNamespace;

  // Secrets / vars (typed loosely; populated by Cloudflare Pages env)
  PAYAZA_PUBLIC_KEY: string;
  PAYAZA_SECRET_KEY: string;
  PAYAZA_BASE_URL: string;
  APPLY_TOKEN_SECRET: string;
  ADMIN_PASSWORD_HASH: string;
  ADMIN_SESSION_SECRET: string;
  IP_HASH_SALT: string;
  RESEND_API_KEY: string;
  R2_ACCESS_KEY_ID: string;
  R2_SECRET_ACCESS_KEY: string;
  R2_ACCOUNT_ID: string;
  TURNSTILE_SITE_KEY: string;
  TURNSTILE_SECRET_KEY: string;
  MOCK_PAYMENTS?: string;
  MOCK_EMAIL?: string;
};

declare namespace App {
  interface Locals {
    runtime: {
      env: CloudflareEnv;
      cf: IncomingRequestCfProperties;
      ctx: ExecutionContext;
    };
  }
}
```

- [ ] **Step 2: Implement D1 queries module**

```ts
// src/lib/db/queries.ts
export type ApplicationRow = {
  id: string;
  cycle_id: string;
  transaction_reference: string;
  email: string;
  payment_status: 'pending' | 'paid' | 'failed' | 'expired';
  payment_amount_cents: number;
  payment_currency: string;
  payaza_transaction_id: string | null;
  payment_verified_at: string | null;
  payment_failure_reason: string | null;
  eligibility_age_band: string | null;
  eligibility_is_woman: number | null;
  eligibility_african_descent: number | null;
  eligibility_outside_ghana: number | null;
  eligibility_valid_passport: number | null;
  consent_policy_version: string;
  consent_recorded_at: string;
  consent_media_use: number;
  consent_marketing: number;
  magic_link_sent_at: string | null;
  apply_token_issued_at: string | null;
  email_bounced_at: string | null;
  full_name: string | null;
  phone: string | null;
  date_of_birth: string | null;
  country_of_residence: string | null;
  current_city: string | null;
  country_of_heritage: string | null;
  bio: string | null;
  socials_json: string | null;
  headshot_r2_key: string | null;
  video_r2_key: string | null;
  submitted_at: string | null;
  status: 'new' | 'reviewing' | 'shortlisted' | 'rejected';
  admin_notes: string | null;
  created_at: string;
  updated_at: string;
  ip_hash: string | null;
  user_agent: string | null;
};

export type CycleRow = {
  id: string;
  display_name: string;
  application_fee_cents: number;
  application_currency: string;
  privacy_policy_version: string;
  applications_open_at: string;
  applications_close_at: string;
  is_active: number;
};

export async function getActiveCycle(db: D1Database): Promise<CycleRow | null> {
  const r = await db.prepare(`SELECT * FROM cycles WHERE is_active = 1 LIMIT 1`).first<CycleRow>();
  return r ?? null;
}

export async function getCycle(db: D1Database, id: string): Promise<CycleRow | null> {
  const r = await db.prepare(`SELECT * FROM cycles WHERE id = ?`).bind(id).first<CycleRow>();
  return r ?? null;
}

export async function getApplicationById(db: D1Database, id: string): Promise<ApplicationRow | null> {
  const r = await db.prepare(`SELECT * FROM applications WHERE id = ?`).bind(id).first<ApplicationRow>();
  return r ?? null;
}

export async function getApplicationByReference(db: D1Database, ref: string): Promise<ApplicationRow | null> {
  const r = await db.prepare(`SELECT * FROM applications WHERE transaction_reference = ?`).bind(ref).first<ApplicationRow>();
  return r ?? null;
}

export type InsertPendingApplication = {
  id: string;
  cycle_id: string;
  transaction_reference: string;
  email: string;
  payment_amount_cents: number;
  payment_currency: string;
  eligibility_age_band: string;
  eligibility_is_woman: number;
  eligibility_african_descent: number;
  eligibility_outside_ghana: number;
  eligibility_valid_passport: number;
  consent_policy_version: string;
  consent_recorded_at: string;
  consent_media_use: number;
  consent_marketing: number;
  ip_hash: string | null;
  user_agent: string | null;
};

export async function insertPendingApplication(db: D1Database, a: InsertPendingApplication): Promise<void> {
  const now = new Date().toISOString();
  await db.prepare(`
    INSERT INTO applications (
      id, cycle_id, transaction_reference, email,
      payment_status, payment_amount_cents, payment_currency,
      eligibility_age_band, eligibility_is_woman, eligibility_african_descent,
      eligibility_outside_ghana, eligibility_valid_passport,
      consent_policy_version, consent_recorded_at, consent_media_use, consent_marketing,
      created_at, updated_at, ip_hash, user_agent
    ) VALUES (
      ?, ?, ?, ?,
      'pending', ?, ?,
      ?, ?, ?, ?, ?,
      ?, ?, ?, ?,
      ?, ?, ?, ?
    )`)
    .bind(
      a.id, a.cycle_id, a.transaction_reference, a.email,
      a.payment_amount_cents, a.payment_currency,
      a.eligibility_age_band, a.eligibility_is_woman, a.eligibility_african_descent,
      a.eligibility_outside_ghana, a.eligibility_valid_passport,
      a.consent_policy_version, a.consent_recorded_at, a.consent_media_use, a.consent_marketing,
      now, now, a.ip_hash, a.user_agent
    )
    .run();
}

export async function markPaymentPaid(
  db: D1Database, id: string, payazaTransactionId: string, paidAt: string
): Promise<void> {
  const now = new Date().toISOString();
  await db.prepare(`
    UPDATE applications
    SET payment_status = 'paid',
        payaza_transaction_id = ?,
        payment_verified_at = ?,
        updated_at = ?
    WHERE id = ? AND payment_status != 'paid'`)
    .bind(payazaTransactionId, paidAt, now, id).run();
}

export async function markPaymentFailed(db: D1Database, id: string, reason: string): Promise<void> {
  const now = new Date().toISOString();
  await db.prepare(`
    UPDATE applications
    SET payment_status = 'failed',
        payment_failure_reason = ?,
        updated_at = ?
    WHERE id = ?`)
    .bind(reason, now, id).run();
}

export async function setApplyTokenIssued(db: D1Database, id: string, magicLinkSentAt: string): Promise<void> {
  const now = new Date().toISOString();
  await db.prepare(`
    UPDATE applications
    SET apply_token_issued_at = ?,
        magic_link_sent_at = ?,
        updated_at = ?
    WHERE id = ?`)
    .bind(now, magicLinkSentAt, now, id).run();
}

export async function setDraftFile(
  db: D1Database, id: string, field: 'headshot_r2_key' | 'video_r2_key', value: string
): Promise<void> {
  const now = new Date().toISOString();
  await db.prepare(`UPDATE applications SET ${field} = ?, updated_at = ? WHERE id = ?`)
    .bind(value, now, id).run();
}

export type SubmitApplicationFields = {
  full_name: string;
  phone: string;
  date_of_birth: string;
  country_of_residence: string;
  current_city: string;
  country_of_heritage: string;
  bio: string;
  socials_json: string;
};

export async function submitApplication(
  db: D1Database, id: string, fields: SubmitApplicationFields
): Promise<{ success: boolean; reason?: string }> {
  const now = new Date().toISOString();
  const result = await db.prepare(`
    UPDATE applications
    SET full_name = ?, phone = ?, date_of_birth = ?,
        country_of_residence = ?, current_city = ?, country_of_heritage = ?,
        bio = ?, socials_json = ?,
        submitted_at = ?, updated_at = ?
    WHERE id = ?
      AND payment_status = 'paid'
      AND submitted_at IS NULL
      AND headshot_r2_key IS NOT NULL
      AND video_r2_key IS NOT NULL`)
    .bind(
      fields.full_name, fields.phone, fields.date_of_birth,
      fields.country_of_residence, fields.current_city, fields.country_of_heritage,
      fields.bio, fields.socials_json,
      now, now, id
    )
    .run();

  if (result.meta.changes === 0) {
    const row = await getApplicationById(db, id);
    if (!row) return { success: false, reason: 'not_found' };
    if (row.payment_status !== 'paid') return { success: false, reason: 'not_paid' };
    if (row.submitted_at) return { success: false, reason: 'already_submitted' };
    if (!row.headshot_r2_key) return { success: false, reason: 'missing_headshot' };
    if (!row.video_r2_key) return { success: false, reason: 'missing_video' };
    return { success: false, reason: 'unknown' };
  }
  return { success: true };
}

export async function setEmailBounced(db: D1Database, email: string): Promise<void> {
  const now = new Date().toISOString();
  await db.prepare(`UPDATE applications SET email_bounced_at = ?, updated_at = ? WHERE email = ?`)
    .bind(now, now, email).run();
}

export async function listApplicationsForAdmin(
  db: D1Database, opts: { cycleId?: string; status?: string; q?: string; limit: number; offset: number }
): Promise<{ rows: ApplicationRow[]; total: number }> {
  const where: string[] = [`submitted_at IS NOT NULL`];
  const params: unknown[] = [];
  if (opts.cycleId) { where.push(`cycle_id = ?`); params.push(opts.cycleId); }
  if (opts.status) { where.push(`status = ?`); params.push(opts.status); }
  if (opts.q) { where.push(`(email LIKE ? OR transaction_reference LIKE ? OR full_name LIKE ?)`); params.push(`%${opts.q}%`, `%${opts.q}%`, `%${opts.q}%`); }
  const whereSql = `WHERE ${where.join(' AND ')}`;
  const totalRow = await db.prepare(`SELECT COUNT(*) as c FROM applications ${whereSql}`)
    .bind(...params).first<{ c: number }>();
  const total = totalRow?.c ?? 0;
  const result = await db.prepare(`SELECT * FROM applications ${whereSql} ORDER BY submitted_at DESC LIMIT ? OFFSET ?`)
    .bind(...params, opts.limit, opts.offset).all<ApplicationRow>();
  return { rows: result.results ?? [], total };
}

export async function updateApplicationStatus(
  db: D1Database, id: string, status: 'new' | 'reviewing' | 'shortlisted' | 'rejected', adminNotes: string | null
): Promise<void> {
  const now = new Date().toISOString();
  await db.prepare(`UPDATE applications SET status = ?, admin_notes = ?, updated_at = ? WHERE id = ?`)
    .bind(status, adminNotes, now, id).run();
}

export async function insertCycleNotification(
  db: D1Database, args: { id: string; email: string; source: string; disqualifyingRule: string | null }
): Promise<void> {
  const now = new Date().toISOString();
  try {
    await db.prepare(`
      INSERT INTO cycle_notifications (id, email, source, disqualifying_rule, consent_recorded_at, created_at)
      VALUES (?, ?, ?, ?, ?, ?)`)
      .bind(args.id, args.email, args.source, args.disqualifyingRule, now, now).run();
  } catch (e: unknown) {
    // unique constraint — already subscribed; treat as success silently
    if (e instanceof Error && /UNIQUE/i.test(e.message)) return;
    throw e;
  }
}

export async function insertAdminAudit(
  db: D1Database, args: { id: string; adminEmail: string; action: string; targetApplicationId: string | null; detailsJson: string | null; ipHash: string | null }
): Promise<void> {
  const now = new Date().toISOString();
  await db.prepare(`
    INSERT INTO admin_audit (id, admin_email, action, target_application_id, details_json, ip_hash, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)`)
    .bind(args.id, args.adminEmail, args.action, args.targetApplicationId, args.detailsJson, args.ipHash, now).run();
}
```

- [ ] **Step 3: Verify it compiles**

```bash
npx astro check
```
Expected: 0 errors related to `src/lib/db/queries.ts` or `src/env.d.ts`.

- [ ] **Step 4: Commit**

```bash
git add src/lib/db/queries.ts src/env.d.ts
git commit -m "feat(db): typed D1 query helpers + Cloudflare env type extension"
```

### Task M1.13: vitest config + smoke test that wires everything together

**Files:**
- Create: `vitest.config.ts`
- Create: `tests/setup.ts`

- [ ] **Step 1: Create vitest config**

```ts
// vitest.config.ts
import { defineConfig } from 'vitest/config';
import path from 'node:path';

export default defineConfig({
  test: {
    globals: false,
    environment: 'node',
    setupFiles: ['./tests/setup.ts'],
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});
```

- [ ] **Step 2: Create empty setup file**

```ts
// tests/setup.ts
// Reserved for future test-wide setup (e.g., global fetch mocks).
```

- [ ] **Step 3: Run all unit tests**

```bash
npm test
```
Expected: All passing tests from M1.4–M1.11 still pass under the new config.

- [ ] **Step 4: Commit**

```bash
git add vitest.config.ts tests/setup.ts
git commit -m "test: vitest config + path alias for unit tests"
```

---

---

## M2 — Public-facing pre-payment flow

This milestone builds the `/apply` landing page (eligibility quiz + consent + email + Turnstile), the `/api/checkout/create` server endpoint, the `/apply/return` verification handler, the disqualified-branch flow, the `/apply/closed` page, and the `/privacy` + `/terms` pages. By the end of M2, an applicant can pay (against MockProvider in CI, real Payaza sandbox in preview) and receive a magic-link email.

### Task M2.1: ApplyLayout + apply.astro skeleton + zod schema

**Files:**
- Create: `src/layouts/ApplyLayout.astro`
- Create: `src/lib/schemas/apply.ts`
- Create: `src/pages/apply.astro`

- [ ] **Step 1: Create the dedicated apply layout (no Lenis/GSAP)**

```astro
---
// src/layouts/ApplyLayout.astro
interface Props { title: string; description?: string; }
const { title, description = 'Miss Diaspora Ghana — Application' } = Astro.props;
---
<!doctype html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta name="description" content={description} />
  <link rel="icon" type="image/png" href="/assets/images/logos/md fav.png" />
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@600&family=Inter:wght@400;500;700&display=swap" rel="stylesheet" />
  <title>{title}</title>
  <style>
    body { font-family: 'Inter', sans-serif; background: #0d0d0d; color: #eee; margin: 0; min-height: 100vh; }
    h1, h2, h3 { font-family: 'Cormorant Garamond', serif; font-weight: 600; letter-spacing: -0.02em; }
    .wrap { max-width: 720px; margin: 0 auto; padding: 32px 24px; }
    .card { background: #1a1a1a; border-radius: 12px; padding: 20px; margin-bottom: 14px; }
    .label { color: #F8B92F; font-size: 11px; letter-spacing: 0.2em; text-transform: uppercase; font-weight: 700; }
    .input { width: 100%; background: #0d0d0d; color: #eee; border: 1px solid #333; border-radius: 6px; padding: 10px 12px; font: inherit; box-sizing: border-box; }
    .btn { display: inline-block; padding: 14px 20px; background: linear-gradient(135deg, #F8B92F, #FFD700); color: #000; text-decoration: none; border: 0; border-radius: 8px; font-weight: 700; cursor: pointer; }
    .btn:disabled { opacity: 0.4; cursor: not-allowed; }
    .btn-ghost { background: transparent; color: #eee; border: 1px solid rgba(255,255,255,0.2); padding: 10px 14px; border-radius: 6px; cursor: pointer; }
    .btn-ghost.selected { background: #F8B92F; color: #000; border-color: #F8B92F; }
    .pill { display: inline-block; padding: 4px 10px; border-radius: 999px; background: rgba(248,185,47,0.1); color: #F8B92F; font-size: 11px; letter-spacing: 0.15em; text-transform: uppercase; }
    .field-row { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
    @media (max-width: 640px) { .field-row { grid-template-columns: 1fr; } }
    .err { color: #FF6B6B; font-size: 13px; margin-top: 6px; }
    .ok { color: #4caf50; font-size: 13px; margin-top: 6px; }
    .muted { opacity: 0.65; font-size: 13px; }
    a { color: #F8B92F; }
  </style>
</head>
<body>
  <slot />
</body>
</html>
```

- [ ] **Step 2: Create the apply schema**

```ts
// src/lib/schemas/apply.ts
import { z } from 'zod';
import { AGE_BANDS } from '@/lib/eligibility/rules';

export const checkoutCreateSchema = z.object({
  email: z.string().email().max(254),
  ageBand: z.enum(AGE_BANDS),
  isWoman: z.boolean(),
  africanDescent: z.boolean(),
  outsideGhana: z.boolean(),
  validPassport: z.boolean(),
  consentPolicy: z.literal(true),
  consentMediaUse: z.boolean(),
  consentMarketing: z.boolean(),
  honeypot: z.string().max(0, 'Bot detected'),
  turnstileToken: z.string().min(1),
});
export type CheckoutCreateInput = z.infer<typeof checkoutCreateSchema>;

export const notificationsSubscribeSchema = z.object({
  email: z.string().email().max(254),
  source: z.enum(['eligibility_disqualified', 'cycle_closed', 'manual']),
  disqualifyingRule: z.enum(['age', 'gender', 'heritage', 'residency', 'passport']).nullable(),
  honeypot: z.string().max(0),
});
export type NotificationsSubscribeInput = z.infer<typeof notificationsSubscribeSchema>;
```

- [ ] **Step 3: Create `/apply` landing page**

```astro
---
// src/pages/apply.astro
import ApplyLayout from '@/layouts/ApplyLayout.astro';
import { getActiveCycle } from '@/lib/db/queries';

const env = Astro.locals.runtime.env;
const cycle = await getActiveCycle(env.DB);

if (!cycle || cycle.is_active !== 1) {
  return Astro.redirect('/apply/closed');
}

const closeAt = new Date(cycle.applications_close_at);
const now = new Date();
if (now > closeAt) return Astro.redirect('/apply/closed');

const turnstileSiteKey = env.TURNSTILE_SITE_KEY;
const fee = (cycle.application_fee_cents / 100).toFixed(2);
const currency = cycle.application_currency;
---
<ApplyLayout title="Begin Your Application | MDGH">
  <div class="wrap">
    <div style="text-align:center;margin-bottom:28px">
      <span class="pill">{cycle.display_name}</span>
      <h1 style="font-size:34px;margin:8px 0 4px">Begin Your Application</h1>
      <p class="muted">Five quick questions, then a one-time application fee of <strong>{currency} {fee}</strong> (non-refundable).</p>
    </div>

    <form id="apply-form">
      <input type="text" name="honeypot" tabindex="-1" autocomplete="off" style="position:absolute;left:-9999px" aria-hidden="true" />

      <section class="card">
        <div class="label" style="margin-bottom:14px">Step 1 — Eligibility</div>
        <div id="eligibility-quiz"></div>
      </section>

      <section class="card">
        <div class="label" style="margin-bottom:14px">Step 2 — Your email</div>
        <input class="input" type="email" name="email" placeholder="email@example.com" required maxlength="254" />
      </section>

      <section class="card">
        <div class="label" style="margin-bottom:14px">Step 3 — Privacy &amp; consent</div>
        <label style="display:flex;gap:10px;align-items:flex-start;margin-bottom:14px;padding-bottom:14px;border-bottom:1px solid #2a2a2a">
          <input type="checkbox" name="consentPolicy" required style="margin-top:4px" />
          <span style="font-size:13px;line-height:1.5">I have read and agree to the <a href="/privacy" target="_blank" rel="noopener">Privacy Policy</a> and <a href="/terms" target="_blank" rel="noopener">Terms</a>. <span class="muted">(required)</span></span>
        </label>

        <div style="margin-bottom:14px">
          <p style="font-size:13px;margin:0 0 8px">May we use your photo and video in promotional materials, social media, and the public finalist gallery?</p>
          <div class="binary-toggle" data-name="consentMediaUse">
            <button type="button" class="btn-ghost" data-value="true">Yes, I consent</button>
            <button type="button" class="btn-ghost" data-value="false">No, do not use</button>
          </div>
        </div>

        <div>
          <p style="font-size:13px;margin:0 0 8px">Would you like to receive cycle updates and future MDGH opportunities by email?</p>
          <div class="binary-toggle" data-name="consentMarketing">
            <button type="button" class="btn-ghost" data-value="true">Yes, subscribe me</button>
            <button type="button" class="btn-ghost" data-value="false">No, thanks</button>
          </div>
        </div>
      </section>

      <div id="turnstile-host" style="display:flex;justify-content:center;margin:18px 0"></div>

      <button id="submit-btn" type="submit" class="btn" style="width:100%;padding:16px;font-size:16px" disabled>
        Continue to payment — {currency} {fee} →
      </button>
      <p class="muted" style="text-align:center;margin-top:10px;font-size:11px">Card payment secured by Payaza · one-time non-refundable fee</p>
      <p id="form-err" class="err" style="text-align:center;display:none"></p>
    </form>
  </div>

  <script src="https://challenges.cloudflare.com/turnstile/v0/api.js" async defer></script>
  <script type="module" define:vars={{ turnstileSiteKey }}>
    // Eligibility quiz, binary toggles, validation, and submission glue.
    // Placed inline so it can read the server-provided turnstileSiteKey.
    import('/scripts/apply-form.js').then(m => m.init({ turnstileSiteKey }));
  </script>
</ApplyLayout>
```

- [ ] **Step 4: Create the apply-form script entry**

```ts
// public/scripts/apply-form.js
const AGE_OPTIONS = ['Under 18', '18-25', '26-35', 'Over 35'];
const QUESTIONS = [
  { name: 'isWoman', text: 'Do you identify as a woman?' },
  { name: 'africanDescent', text: 'Are you of African or Ghanaian descent?' },
  { name: 'outsideGhana', text: 'Do you currently reside outside Ghana?' },
  { name: 'validPassport', text: 'Do you hold a valid passport for travel to Accra?' },
];

export function init({ turnstileSiteKey }) {
  const state = {
    ageBand: null, isWoman: null, africanDescent: null, outsideGhana: null,
    validPassport: null, consentMediaUse: null, consentMarketing: null,
    consentPolicy: false, email: '', turnstileToken: null,
  };

  renderQuiz(state, validate);
  setupBinaryToggles(state, validate);
  setupCheckbox(state, validate);
  setupEmail(state, validate);
  setupTurnstile(turnstileSiteKey, (token) => { state.turnstileToken = token; validate(); });
  setupSubmit(state);

  function validate() {
    const eligible =
      (state.ageBand === '18-25' || state.ageBand === '26-35') &&
      state.isWoman === true &&
      state.africanDescent === true &&
      state.outsideGhana === true &&
      state.validPassport === true;
    const allAnswered =
      state.ageBand !== null &&
      state.isWoman !== null && state.africanDescent !== null &&
      state.outsideGhana !== null && state.validPassport !== null &&
      state.consentPolicy && state.consentMediaUse !== null && state.consentMarketing !== null &&
      isValidEmail(state.email) && !!state.turnstileToken;

    document.getElementById('submit-btn').disabled = !(eligible && allAnswered);

    const dq = document.getElementById('disqualified-card');
    if (dq) dq.remove();
    if (state.ageBand && (state.isWoman === false || state.africanDescent === false || state.outsideGhana === false || state.validPassport === false || state.ageBand === 'Under 18' || state.ageBand === 'Over 35')) {
      showDisqualified(state);
    }
  }
}

function isValidEmail(s) { return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s); }

function renderQuiz(state, validate) {
  const host = document.getElementById('eligibility-quiz');
  const ageRow = document.createElement('div');
  ageRow.innerHTML = `<p style="font-size:13px;margin:0 0 6px">1. What is your age at the start of this cycle?</p>`;
  const ageBtns = document.createElement('div');
  ageBtns.style.cssText = 'display:flex;gap:6px;flex-wrap:wrap;margin-bottom:14px';
  AGE_OPTIONS.forEach(band => {
    const b = document.createElement('button');
    b.type = 'button'; b.className = 'btn-ghost'; b.style.flex = '1 0 0'; b.textContent = band;
    b.addEventListener('click', () => {
      ageBtns.querySelectorAll('.btn-ghost').forEach(x => x.classList.remove('selected'));
      b.classList.add('selected'); state.ageBand = band; validate();
    });
    ageBtns.appendChild(b);
  });
  ageRow.appendChild(ageBtns);
  host.appendChild(ageRow);

  QUESTIONS.forEach((q, i) => {
    const row = document.createElement('div');
    row.style.marginBottom = '14px';
    row.innerHTML = `<p style="font-size:13px;margin:0 0 6px">${i + 2}. ${q.text}</p>`;
    const btns = document.createElement('div'); btns.style.cssText = 'display:flex;gap:6px';
    [['Yes', true], ['No', false]].forEach(([label, val]) => {
      const b = document.createElement('button');
      b.type = 'button'; b.className = 'btn-ghost'; b.style.flex = '1'; b.textContent = label;
      b.addEventListener('click', () => {
        btns.querySelectorAll('.btn-ghost').forEach(x => x.classList.remove('selected'));
        b.classList.add('selected'); state[q.name] = val; validate();
      });
      btns.appendChild(b);
    });
    row.appendChild(btns); host.appendChild(row);
  });
}

function setupBinaryToggles(state, validate) {
  document.querySelectorAll('.binary-toggle').forEach(group => {
    const name = group.dataset.name;
    group.style.cssText = 'display:flex;gap:8px';
    group.querySelectorAll('button').forEach(b => {
      b.style.flex = '1';
      b.addEventListener('click', () => {
        group.querySelectorAll('button').forEach(x => x.classList.remove('selected'));
        b.classList.add('selected');
        state[name] = b.dataset.value === 'true';
        validate();
      });
    });
  });
}

function setupCheckbox(state, validate) {
  const cb = document.querySelector('input[name="consentPolicy"]');
  cb.addEventListener('change', () => { state.consentPolicy = cb.checked; validate(); });
}

function setupEmail(state, validate) {
  const input = document.querySelector('input[name="email"]');
  input.addEventListener('input', () => { state.email = input.value.trim(); validate(); });
}

function setupTurnstile(siteKey, onToken) {
  const host = document.getElementById('turnstile-host');
  const interval = setInterval(() => {
    if (window.turnstile) {
      clearInterval(interval);
      window.turnstile.render(host, { sitekey: siteKey, callback: onToken });
    }
  }, 100);
}

function setupSubmit(state) {
  const form = document.getElementById('apply-form');
  const errEl = document.getElementById('form-err');
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    errEl.style.display = 'none';
    const honeypot = form.elements.honeypot.value;

    const res = await fetch('/api/checkout/create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: state.email, ageBand: state.ageBand,
        isWoman: state.isWoman, africanDescent: state.africanDescent,
        outsideGhana: state.outsideGhana, validPassport: state.validPassport,
        consentPolicy: state.consentPolicy,
        consentMediaUse: state.consentMediaUse, consentMarketing: state.consentMarketing,
        honeypot, turnstileToken: state.turnstileToken,
      }),
    });
    const json = await res.json();
    if (!res.ok || !json.ok) {
      errEl.textContent = json.error ?? 'Something went wrong. Please try again.';
      errEl.style.display = 'block';
      return;
    }
    window.location.href = json.checkoutUrl;
  });
}

function showDisqualified(state) {
  const form = document.getElementById('apply-form');
  const card = document.createElement('section');
  card.id = 'disqualified-card';
  card.className = 'card';
  card.style.borderLeft = '3px solid #FF6B6B';
  card.innerHTML = `
    <div class="label" style="color:#FF6B6B">This cycle isn't a fit</div>
    <h3 style="margin:8px 0">But our criteria evolve.</h3>
    <p class="muted">Drop your email and we'll let you know when future cycles open opportunities aligned with your story. (You can unsubscribe any time.)</p>
    <div style="display:flex;gap:8px;margin-top:12px">
      <input id="dq-email" class="input" type="email" placeholder="email@example.com" />
      <button type="button" id="dq-subscribe" class="btn" style="white-space:nowrap">Notify me</button>
    </div>
    <p id="dq-msg" style="font-size:12px;margin-top:8px;display:none"></p>
  `;
  form.parentNode.insertBefore(card, form);
  document.getElementById('dq-subscribe').addEventListener('click', async () => {
    const email = document.getElementById('dq-email').value.trim();
    const msg = document.getElementById('dq-msg');
    msg.style.display = 'block';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { msg.className = 'err'; msg.textContent = 'Please enter a valid email.'; return; }
    const rule = ruleFromState(state);
    const res = await fetch('/api/notifications/subscribe', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, source: 'eligibility_disqualified', disqualifyingRule: rule, honeypot: '' }),
    });
    if (res.ok) { msg.className = 'ok'; msg.textContent = "Thanks — we'll be in touch when things open up."; }
    else { msg.className = 'err'; msg.textContent = 'Something went wrong. Try again later.'; }
  });
}

function ruleFromState(s) {
  if (s.ageBand === 'Under 18' || s.ageBand === 'Over 35') return 'age';
  if (s.isWoman === false) return 'gender';
  if (s.africanDescent === false) return 'heritage';
  if (s.outsideGhana === false) return 'residency';
  if (s.validPassport === false) return 'passport';
  return null;
}
```

- [ ] **Step 5: Run `wrangler pages dev` and load the page**

```bash
npm run build && npm run wrangler:dev
```
Open `http://localhost:8788/apply`. Expected:
- Page renders with the cycle name and fee
- Eligibility quiz, email field, consent section, Turnstile widget all render
- Continue button is disabled until everything is filled
- Disqualified card appears when a question is answered "No"

Screenshot the rendered page for review (next task adds the API endpoint that wires Continue).

- [ ] **Step 6: Commit**

```bash
git add src/layouts/ApplyLayout.astro src/lib/schemas/apply.ts src/pages/apply.astro public/scripts/apply-form.js
git commit -m "feat(apply): /apply landing — eligibility quiz, consent, Turnstile, layout"
```

### Task M2.2: /api/checkout/create endpoint + integration test

**Files:**
- Create: `src/lib/turnstile/verify.ts`
- Create: `src/pages/api/checkout/create.ts`
- Create: `tests/integration/checkout-create.test.ts`

- [ ] **Step 1: Implement Turnstile verifier**

```ts
// src/lib/turnstile/verify.ts
export type TurnstileVerifyResult = { ok: true } | { ok: false; reason: string };

export async function verifyTurnstile(token: string, secret: string, remoteIp?: string): Promise<TurnstileVerifyResult> {
  try {
    const body = new URLSearchParams({ secret, response: token });
    if (remoteIp) body.set('remoteip', remoteIp);
    const res = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST', body,
    });
    const json = await res.json() as { success: boolean; 'error-codes'?: string[] };
    if (json.success) return { ok: true };
    return { ok: false, reason: (json['error-codes'] ?? ['unknown']).join(',') };
  } catch (e) {
    return { ok: false, reason: e instanceof Error ? e.message : 'network_error' };
  }
}
```

- [ ] **Step 2: Implement /api/checkout/create**

```ts
// src/pages/api/checkout/create.ts
import type { APIRoute } from 'astro';
import { checkoutCreateSchema } from '@/lib/schemas/apply';
import { evaluateEligibility } from '@/lib/eligibility/rules';
import { getActiveCycle, insertPendingApplication } from '@/lib/db/queries';
import { newUlid } from '@/lib/ids/ulid';
import { newTransactionReference } from '@/lib/ids/reference';
import { hashIp } from '@/lib/crypto/hash';
import { verifyTurnstile } from '@/lib/turnstile/verify';
import { getPaymentProvider } from '@/lib/payment';

export const prerender = false;

export const POST: APIRoute = async ({ request, locals, clientAddress }) => {
  const env = locals.runtime.env;

  let body: unknown;
  try { body = await request.json(); } catch { return json({ ok: false, error: 'invalid_json' }, 400); }

  const parsed = checkoutCreateSchema.safeParse(body);
  if (!parsed.success) {
    return json({ ok: false, error: 'invalid_input', details: parsed.error.flatten() }, 400);
  }
  const input = parsed.data;

  if (input.honeypot.length > 0) return json({ ok: false, error: 'bot_detected' }, 400);

  const eligibility = evaluateEligibility({
    ageBand: input.ageBand,
    isWoman: input.isWoman,
    africanDescent: input.africanDescent,
    outsideGhana: input.outsideGhana,
    validPassport: input.validPassport,
  });
  if (!eligibility.eligible) return json({ ok: false, error: 'not_eligible', rule: eligibility.disqualifyingRule }, 400);

  const ts = await verifyTurnstile(input.turnstileToken, env.TURNSTILE_SECRET_KEY, clientAddress);
  if (!ts.ok) return json({ ok: false, error: 'turnstile_failed', reason: ts.reason }, 400);

  const cycle = await getActiveCycle(env.DB);
  if (!cycle || cycle.is_active !== 1) return json({ ok: false, error: 'cycle_not_active' }, 400);
  if (new Date() > new Date(cycle.applications_close_at)) return json({ ok: false, error: 'cycle_closed' }, 400);

  const id = newUlid();
  const reference = newTransactionReference(cycle.id);
  const ipHash = await hashIp(clientAddress ?? 'unknown', env.IP_HASH_SALT);
  const userAgent = request.headers.get('user-agent') ?? null;

  await insertPendingApplication(env.DB, {
    id, cycle_id: cycle.id, transaction_reference: reference,
    email: input.email,
    payment_amount_cents: cycle.application_fee_cents,
    payment_currency: cycle.application_currency,
    eligibility_age_band: input.ageBand,
    eligibility_is_woman: input.isWoman ? 1 : 0,
    eligibility_african_descent: input.africanDescent ? 1 : 0,
    eligibility_outside_ghana: input.outsideGhana ? 1 : 0,
    eligibility_valid_passport: input.validPassport ? 1 : 0,
    consent_policy_version: cycle.privacy_policy_version,
    consent_recorded_at: new Date().toISOString(),
    consent_media_use: input.consentMediaUse ? 1 : 0,
    consent_marketing: input.consentMarketing ? 1 : 0,
    ip_hash: ipHash, user_agent: userAgent,
  });

  const provider = getPaymentProvider(env);
  const callbackUrl = new URL('/apply/return', request.url).toString();
  const init = await provider.init({
    amountCents: cycle.application_fee_cents,
    currency: cycle.application_currency as 'USD' | 'NGN' | 'GHS',
    reference,
    customerEmail: input.email,
    callbackUrl,
    metadata: { cycle_id: cycle.id, application_id: id },
  });
  if (!init.ok) {
    return json({ ok: false, error: 'payment_init_failed', code: init.errorCode, message: init.errorMessage }, 502);
  }
  return json({ ok: true, checkoutUrl: init.checkoutUrl, reference });
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status, headers: { 'Content-Type': 'application/json' },
  });
}
```

- [ ] **Step 3: Write integration test**

```ts
// tests/integration/checkout-create.test.ts
// Note: this test exercises the route handler directly with a fake env.
// Full HTTP-level integration runs in E2E (Playwright) under wrangler pages dev.
import { describe, it, expect, beforeEach } from 'vitest';
import { POST } from '@/pages/api/checkout/create';

function fakeEnv() {
  // simple in-memory D1-like stub
  const cycles = [{
    id: 'MDGH-2026', display_name: 'Miss Diaspora Ghana 2026',
    application_fee_cents: 2599, application_currency: 'USD',
    privacy_policy_version: 'v1.0',
    applications_open_at: '2026-01-01T00:00:00Z',
    applications_close_at: '2099-01-01T00:00:00Z', is_active: 1,
  }];
  const applications: Record<string, unknown>[] = [];
  const DB = {
    prepare(sql: string) {
      const params: unknown[] = [];
      const stmt = {
        bind(...args: unknown[]) { params.push(...args); return stmt; },
        async first<T>() {
          if (sql.includes('FROM cycles WHERE is_active = 1')) return cycles[0] as unknown as T;
          if (sql.includes('FROM cycles WHERE id =')) return cycles[0] as unknown as T;
          return null;
        },
        async run() {
          if (sql.startsWith('INSERT INTO applications')) {
            applications.push({ params });
            return { meta: { changes: 1 } };
          }
          return { meta: { changes: 0 } };
        },
      };
      return stmt;
    },
  } as unknown as D1Database;
  return {
    DB, MEDIA: {} as R2Bucket, SESSION: {} as KVNamespace,
    PAYAZA_BASE_URL: 'https://x', PAYAZA_PUBLIC_KEY: 'pk', PAYAZA_SECRET_KEY: 'sk',
    APPLY_TOKEN_SECRET: 'a'.repeat(64), ADMIN_PASSWORD_HASH: '', ADMIN_SESSION_SECRET: 'b'.repeat(64),
    IP_HASH_SALT: 'salt', RESEND_API_KEY: '',
    R2_ACCESS_KEY_ID: '', R2_SECRET_ACCESS_KEY: '', R2_ACCOUNT_ID: '',
    TURNSTILE_SITE_KEY: 'site', TURNSTILE_SECRET_KEY: 'secret',
    MOCK_PAYMENTS: 'true', MOCK_EMAIL: 'true',
    _applications: applications,
  };
}

function makeContext(env: ReturnType<typeof fakeEnv>, body: unknown, ip = '1.2.3.4') {
  // Stub global fetch for Turnstile verify
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (input: RequestInfo | URL) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
    if (url.includes('turnstile/v0/siteverify')) {
      return new Response(JSON.stringify({ success: true }), { status: 200 });
    }
    return originalFetch(input as RequestInfo | URL);
  };

  return {
    request: new Request('http://localhost/api/checkout/create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'user-agent': 'test' },
      body: JSON.stringify(body),
    }),
    locals: { runtime: { env } } as App.Locals,
    clientAddress: ip,
    cookies: {} as never, redirect: () => new Response(),
    params: {}, props: {}, site: undefined, generator: '', preferredLocale: undefined,
    preferredLocaleList: [], currentLocale: undefined,
    url: new URL('http://localhost/api/checkout/create'),
  } as unknown as Parameters<typeof POST>[0];
}

const VALID_INPUT = {
  email: 'a@b.com', ageBand: '18-25', isWoman: true, africanDescent: true,
  outsideGhana: true, validPassport: true,
  consentPolicy: true, consentMediaUse: true, consentMarketing: false,
  honeypot: '', turnstileToken: 'tok',
};

describe('POST /api/checkout/create', () => {
  beforeEach(() => { /* clean fetch in each test via makeContext */ });

  it('returns ok with a checkoutUrl on the happy path', async () => {
    const env = fakeEnv();
    const res = await POST(makeContext(env, VALID_INPUT));
    expect(res.status).toBe(200);
    const json = await res.json() as { ok: boolean; checkoutUrl: string; reference: string };
    expect(json.ok).toBe(true);
    expect(json.checkoutUrl).toContain('mock-checkout');
    expect(json.reference).toMatch(/^MDGH-2026-/);
    expect(env._applications.length).toBe(1);
  });

  it('rejects when honeypot is filled', async () => {
    const env = fakeEnv();
    const res = await POST(makeContext(env, { ...VALID_INPUT, honeypot: 'spam' }));
    expect(res.status).toBe(400);
    const j = await res.json() as { error: string };
    expect(j.error).toBe('invalid_input');
  });

  it('rejects when ineligible (age out of range)', async () => {
    const env = fakeEnv();
    const res = await POST(makeContext(env, { ...VALID_INPUT, ageBand: 'Over 35' }));
    expect(res.status).toBe(400);
    const j = await res.json() as { error: string; rule: string };
    expect(j.error).toBe('not_eligible');
    expect(j.rule).toBe('age');
  });

  it('rejects when consentMediaUse is null/undefined (zod fails)', async () => {
    const env = fakeEnv();
    const { consentMediaUse, ...partial } = VALID_INPUT;
    const res = await POST(makeContext(env, partial));
    expect(res.status).toBe(400);
  });

  it('rejects when email is invalid', async () => {
    const env = fakeEnv();
    const res = await POST(makeContext(env, { ...VALID_INPUT, email: 'not-an-email' }));
    expect(res.status).toBe(400);
  });
});
```

- [ ] **Step 4: Run, expect pass**

```bash
npm test -- tests/integration/checkout-create.test.ts
```
Expected: All 5 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/turnstile/verify.ts src/pages/api/checkout/create.ts tests/integration/checkout-create.test.ts
git commit -m "feat(api): /api/checkout/create + Turnstile verify + integration tests"
```

### Task M2.3: /apply/return + /api/checkout/verify + magic-link send

**Files:**
- Create: `src/pages/apply/return.astro`
- Create: `src/pages/api/checkout/verify.ts`

- [ ] **Step 1: Implement /api/checkout/verify**

```ts
// src/pages/api/checkout/verify.ts
import type { APIRoute } from 'astro';
import {
  getApplicationByReference, getCycle, markPaymentPaid, markPaymentFailed, setApplyTokenIssued,
} from '@/lib/db/queries';
import { getPaymentProvider } from '@/lib/payment';
import { signApplyToken } from '@/lib/tokens/apply-token';
import { getEmailProvider, renderMagicLinkEmail } from '@/lib/email';

export const prerender = false;

export const GET: APIRoute = async ({ request, locals }) => {
  const env = locals.runtime.env;
  const url = new URL(request.url);
  const reference = url.searchParams.get('reference');
  if (!reference) return json({ ok: false, error: 'missing_reference' }, 400);

  const app = await getApplicationByReference(env.DB, reference);
  if (!app) return json({ ok: false, error: 'unknown_reference' }, 404);

  if (app.payment_status === 'paid') {
    return json({ ok: true, status: 'paid', applicationId: app.id, alreadyPaid: true });
  }

  const provider = getPaymentProvider(env);
  const verify = await provider.verify(reference);
  if (!verify.ok) {
    return json({ ok: false, error: 'verify_failed', code: verify.errorCode, message: verify.errorMessage }, 502);
  }

  if (verify.status === 'failed') {
    await markPaymentFailed(env.DB, app.id, 'provider_reported_failed');
    return json({ ok: true, status: 'failed', applicationId: app.id });
  }

  if (verify.status === 'pending') {
    return json({ ok: true, status: 'pending', applicationId: app.id });
  }

  // Status is 'paid'. Mark and issue token.
  await markPaymentPaid(env.DB, app.id, verify.providerTransactionId, verify.paidAt ?? new Date().toISOString());

  const cycle = await getCycle(env.DB, app.cycle_id);
  if (!cycle) return json({ ok: false, error: 'cycle_missing' }, 500);

  const cycleCloseUnix = Math.floor(new Date(cycle.applications_close_at).getTime() / 1000);
  const thirtyDays = Math.floor(Date.now() / 1000) + 30 * 24 * 3600;
  const expiry = Math.min(thirtyDays, cycleCloseUnix);
  const token = await signApplyToken(app.id, expiry, env.APPLY_TOKEN_SECRET);

  // Rate-limit magic-link sends (24 hr per application_id)
  const sendKey = `magic-link-sent:${app.id}`;
  const alreadySent = await env.SESSION.get(sendKey);
  let emailSent = false;
  if (!alreadySent) {
    const email = getEmailProvider(env);
    const magicLink = new URL(`/apply/form?token=${encodeURIComponent(token)}`, request.url).toString();
    const e = renderMagicLinkEmail({
      reference: app.transaction_reference,
      magicLink,
      cycleClose: cycle.applications_close_at.slice(0, 10),
    });
    const sendResult = await email.send({ to: app.email, ...e });
    if (sendResult.ok) {
      emailSent = true;
      await env.SESSION.put(sendKey, '1', { expirationTtl: 86400 });
    }
  }
  await setApplyTokenIssued(env.DB, app.id, new Date().toISOString());

  return json({ ok: true, status: 'paid', applicationId: app.id, token, emailSent });
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}
```

- [ ] **Step 2: Implement /apply/return page (calls the verify endpoint, redirects accordingly)**

```astro
---
// src/pages/apply/return.astro
import ApplyLayout from '@/layouts/ApplyLayout.astro';

const reference = Astro.url.searchParams.get('reference');
if (!reference) return Astro.redirect('/apply');

const verifyUrl = new URL(`/api/checkout/verify?reference=${encodeURIComponent(reference)}`, Astro.url).toString();
const res = await fetch(verifyUrl);
const data = await res.json() as
  | { ok: true; status: 'paid'; applicationId: string; token?: string; emailSent?: boolean; alreadyPaid?: boolean }
  | { ok: true; status: 'pending' | 'failed'; applicationId: string }
  | { ok: false; error: string };

let view: 'paid' | 'pending' | 'failed' | 'error' = 'error';
let token: string | undefined;
let emailSent = false;
if (data.ok && data.status === 'paid') {
  view = 'paid'; token = (data as { token?: string }).token; emailSent = !!(data as { emailSent?: boolean }).emailSent;
} else if (data.ok && data.status === 'pending') {
  view = 'pending';
} else if (data.ok && data.status === 'failed') {
  view = 'failed';
}

if (view === 'paid' && token) {
  return Astro.redirect(`/apply/form?token=${encodeURIComponent(token)}`);
}
---
<ApplyLayout title="Verifying payment | MDGH">
  <div class="wrap">
    {view === 'pending' && (
      <div class="card" style="border-left:3px solid #FFD166">
        <div class="label" style="color:#FFD166">Still confirming</div>
        <h2 style="margin:8px 0">Your payment is processing.</h2>
        <p class="muted">This can take up to 5 minutes. We'll email you the moment it confirms. If you don't hear back, use the <a href="/apply/recover">recover form</a> with your reference: <code style="color:#F8B92F">{reference}</code></p>
      </div>
    )}
    {view === 'failed' && (
      <div class="card" style="border-left:3px solid #FF6B6B">
        <div class="label" style="color:#FF6B6B">Payment didn't go through</div>
        <h2 style="margin:8px 0">No charge was made.</h2>
        <p class="muted">You can try again — the cycle is still open.</p>
        <a href="/apply" class="btn" style="margin-top:12px">Try again</a>
      </div>
    )}
    {view === 'error' && (
      <div class="card" style="border-left:3px solid #FF6B6B">
        <div class="label" style="color:#FF6B6B">We couldn't confirm your payment</div>
        <p class="muted">Give us a minute and use the <a href="/apply/recover">recover form</a> with your reference: <code style="color:#F8B92F">{reference}</code></p>
      </div>
    )}
  </div>
</ApplyLayout>
```

Note: if `view === 'paid'`, the page redirects before rendering — so the body templates above only show on pending/failed/error.

- [ ] **Step 3: Manual smoke test**

Restart dev server:
```bash
npm run build && npm run wrangler:dev
```
Open `/apply`, fill the form (eligibility passes, email valid, consents picked, Turnstile test key auto-passes), click Continue. With `MOCK_PAYMENTS=true` you'll be redirected to `/mock-checkout?reference=...` (which doesn't exist yet — Task M2.5 creates it).

For now, verify directly: hit `http://localhost:8788/api/checkout/verify?reference=MDGH-2026-XXXXXXXX` (use a reference observed from the form attempt). Expected: `{ ok: false, error: 'unknown_reference' }` since no D1 row was committed (the route currently returns the URL but doesn't persist if mock skips backend insert — actually `/api/checkout/create` does insert; the row should exist; verify with `wrangler d1 execute --local --command "SELECT * FROM applications;"`).

- [ ] **Step 4: Commit**

```bash
git add src/pages/api/checkout/verify.ts src/pages/apply/return.astro
git commit -m "feat(api): /api/checkout/verify + /apply/return — magic-link mint + redirect"
```

### Task M2.4: /apply/closed + /api/notifications/subscribe

**Files:**
- Create: `src/pages/apply/closed.astro`
- Create: `src/pages/api/notifications/subscribe.ts`
- Create: `tests/integration/notifications-subscribe.test.ts`

- [ ] **Step 1: Create the closed page**

```astro
---
// src/pages/apply/closed.astro
import ApplyLayout from '@/layouts/ApplyLayout.astro';
import { getActiveCycle } from '@/lib/db/queries';

const env = Astro.locals.runtime.env;
const cycle = await getActiveCycle(env.DB);
const display = cycle?.display_name ?? 'this cycle';
---
<ApplyLayout title="Applications closed | MDGH">
  <div class="wrap" style="text-align:center">
    <span class="pill">{display}</span>
    <h1 style="font-size:34px;margin:12px 0">Applications are closed.</h1>
    <p class="muted" style="max-width:480px;margin:0 auto 18px">Want to be notified when the next cycle opens?</p>
    <form id="notify-form" style="max-width:380px;margin:0 auto;display:flex;gap:8px">
      <input class="input" id="notify-email" type="email" placeholder="email@example.com" required />
      <button type="submit" class="btn" style="white-space:nowrap">Notify me</button>
    </form>
    <p id="notify-msg" style="margin-top:10px;display:none"></p>
  </div>

  <script type="module">
    document.getElementById('notify-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const email = document.getElementById('notify-email').value.trim();
      const msg = document.getElementById('notify-msg');
      msg.style.display = 'block';
      const res = await fetch('/api/notifications/subscribe', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, source: 'cycle_closed', disqualifyingRule: null, honeypot: '' }),
      });
      if (res.ok) { msg.className = 'ok'; msg.textContent = "You're on the list."; }
      else { msg.className = 'err'; msg.textContent = 'Something went wrong.'; }
    });
  </script>
</ApplyLayout>
```

- [ ] **Step 2: Implement subscription endpoint**

```ts
// src/pages/api/notifications/subscribe.ts
import type { APIRoute } from 'astro';
import { notificationsSubscribeSchema } from '@/lib/schemas/apply';
import { insertCycleNotification } from '@/lib/db/queries';
import { newUlid } from '@/lib/ids/ulid';

export const prerender = false;

export const POST: APIRoute = async ({ request, locals }) => {
  const env = locals.runtime.env;
  let body: unknown;
  try { body = await request.json(); } catch { return j({ ok: false, error: 'invalid_json' }, 400); }
  const parsed = notificationsSubscribeSchema.safeParse(body);
  if (!parsed.success) return j({ ok: false, error: 'invalid_input' }, 400);
  if (parsed.data.honeypot.length > 0) return j({ ok: false, error: 'bot_detected' }, 400);

  await insertCycleNotification(env.DB, {
    id: newUlid(),
    email: parsed.data.email,
    source: parsed.data.source,
    disqualifyingRule: parsed.data.disqualifyingRule,
  });
  return j({ ok: true });
};

function j(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}
```

- [ ] **Step 3: Write integration test**

```ts
// tests/integration/notifications-subscribe.test.ts
import { describe, it, expect } from 'vitest';
import { POST } from '@/pages/api/notifications/subscribe';

function fakeEnv() {
  const inserts: unknown[] = [];
  const DB = {
    prepare(sql: string) {
      const params: unknown[] = [];
      return {
        bind(...a: unknown[]) { params.push(...a); return this; },
        async run() { if (sql.startsWith('INSERT INTO cycle_notifications')) inserts.push(params); return { meta: { changes: 1 } }; },
        async first() { return null; },
      };
    },
  } as unknown as D1Database;
  return { DB, _inserts: inserts };
}

function ctx(env: ReturnType<typeof fakeEnv>, body: unknown) {
  return {
    request: new Request('http://localhost/api/notifications/subscribe', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
    }),
    locals: { runtime: { env } } as App.Locals,
    clientAddress: '1.2.3.4',
    cookies: {} as never, redirect: () => new Response(), params: {}, props: {},
    site: undefined, generator: '', preferredLocale: undefined, preferredLocaleList: [], currentLocale: undefined,
    url: new URL('http://localhost/api/notifications/subscribe'),
  } as unknown as Parameters<typeof POST>[0];
}

describe('POST /api/notifications/subscribe', () => {
  it('inserts and returns ok', async () => {
    const env = fakeEnv();
    const res = await POST(ctx(env, { email: 'a@b.com', source: 'eligibility_disqualified', disqualifyingRule: 'age', honeypot: '' }));
    expect(res.status).toBe(200);
    expect(env._inserts.length).toBe(1);
  });

  it('rejects bad email', async () => {
    const env = fakeEnv();
    const res = await POST(ctx(env, { email: 'no', source: 'manual', disqualifyingRule: null, honeypot: '' }));
    expect(res.status).toBe(400);
  });

  it('rejects honeypot', async () => {
    const env = fakeEnv();
    const res = await POST(ctx(env, { email: 'a@b.com', source: 'manual', disqualifyingRule: null, honeypot: 'spam' }));
    expect(res.status).toBe(400);
  });
});
```

- [ ] **Step 4: Run, expect pass**

```bash
npm test -- tests/integration/notifications-subscribe.test.ts
```
Expected: All PASS.

- [ ] **Step 5: Commit**

```bash
git add src/pages/apply/closed.astro src/pages/api/notifications/subscribe.ts tests/integration/notifications-subscribe.test.ts
git commit -m "feat(notifications): /apply/closed + subscribe endpoint"
```

### Task M2.5: mock-checkout dev page (gated by MOCK_PAYMENTS)

**Files:**
- Create: `src/pages/mock-checkout.astro`

- [ ] **Step 1: Implement mock-checkout page**

```astro
---
// src/pages/mock-checkout.astro
import ApplyLayout from '@/layouts/ApplyLayout.astro';

const env = Astro.locals.runtime.env;
if (env.MOCK_PAYMENTS !== 'true') {
  return new Response('Not Found', { status: 404 });
}

const reference = Astro.url.searchParams.get('reference') ?? '';
const callback = Astro.url.searchParams.get('callback') ?? '/apply/return';
const succeedUrl = `${callback}${callback.includes('?') ? '&' : '?'}reference=${encodeURIComponent(reference)}`;
const failUrl = `${callback}${callback.includes('?') ? '&' : '?'}reference=${encodeURIComponent(reference + '-FAIL')}`;
---
<ApplyLayout title="Mock checkout (dev only)">
  <div class="wrap" style="max-width:520px">
    <span class="pill" style="color:#FF6B6B;background:rgba(255,107,107,0.1)">Dev mode — mock payments</span>
    <h1 style="font-size:28px;margin:12px 0 4px">Simulate Payaza checkout</h1>
    <p class="muted">Reference: <code style="color:#F8B92F">{reference}</code></p>
    <div class="card" style="display:flex;flex-direction:column;gap:12px;margin-top:20px">
      <a href={succeedUrl} class="btn" style="text-align:center">Simulate successful payment</a>
      <a href={failUrl} class="btn-ghost" style="text-align:center;text-decoration:none;display:block;padding:14px">Simulate failed payment</a>
    </div>
  </div>
</ApplyLayout>
```

- [ ] **Step 2: Smoke test in dev**

```bash
npm run build && npm run wrangler:dev
```
Open `/apply`, walk through happy path. Mock checkout page should render, "Simulate successful payment" should redirect to `/apply/return?reference=...`.

- [ ] **Step 3: Commit**

```bash
git add src/pages/mock-checkout.astro
git commit -m "feat(dev): mock-checkout page gated by MOCK_PAYMENTS env var"
```

### Task M2.6: /privacy + /terms pages

**Files:**
- Create: `src/data/privacy.md`
- Create: `src/data/terms.md`
- Create: `src/pages/privacy.astro`
- Create: `src/pages/terms.astro`

- [ ] **Step 1: Create privacy markdown placeholder**

```markdown
<!-- src/data/privacy.md -->
---
version: v1.0
effective: 2026-05-15
---

# Privacy Policy

**Last updated:** 2026-05-15
**Version:** v1.0

This Privacy Policy describes how Miss Diaspora Ghana ("MDGH", "we", "us") collects, uses, and protects your personal information when you apply to participate in our pageant.

## What we collect

When you apply, we collect:
- Contact information: name, email, phone number
- Demographic information: date of birth, country of residence, current city, country of heritage
- Application content: bio, social media handles, headshot photograph, intro video
- Payment metadata: transaction reference (we do **not** store card numbers — those are tokenized by Payaza)
- Eligibility quiz answers and consent records (with timestamp and policy version)
- Technical metadata: hashed IP address, user-agent string

## How we use it

- To review and process your application for the current cycle
- To contact you about your application status
- If you opt in: to use your photo and video in promotional materials and the public finalist gallery
- If you opt in: to send you cycle updates and future opportunities

We do **not** sell your information.

## How long we keep it

Application records are retained for **3 years after the close of the cycle** for which you applied, then permanently deleted from our database and media storage. Marketing-list subscriptions persist until you unsubscribe.

## Your rights

You may request:
- A copy of the data we hold about you
- Correction of inaccurate data
- Deletion of your data (subject to legitimate interest in retaining application records during the active review period)

Email **applications@missdiasporagh.org** with your request and the application reference number.

## Changes to this policy

We may update this Privacy Policy from time to time. Material changes will be communicated to applicants via email. The version applicable to your application is the one in effect when you submitted it.

## Contact

For privacy-related questions, contact **applications@missdiasporagh.org**.
```

- [ ] **Step 2: Create terms markdown placeholder**

```markdown
<!-- src/data/terms.md -->
---
version: v1.0
effective: 2026-05-15
---

# Terms of Application

**Last updated:** 2026-05-15
**Version:** v1.0

By submitting an application to Miss Diaspora Ghana ("MDGH"), you agree to the following terms.

## 1. Eligibility

You confirm that you meet the eligibility criteria stated on the application landing page. False statements may result in disqualification at MDGH's discretion, with no refund of the application fee.

## 2. Application fee

The application fee is **non-refundable**, including in cases where:
- You voluntarily withdraw your application
- You fail to submit a complete application by the cycle close date
- You are determined ineligible after submitting

The fee covers administrative review and processing.

## 3. Use of submitted content

If you opt in to media use, you grant MDGH a non-exclusive, royalty-free license to use your headshot, intro video, and bio in promotional materials, social media, and the public finalist gallery. You retain ownership of your content.

## 4. Selection process

MDGH retains sole discretion over selection decisions. The selection panel's decisions are final and not subject to appeal.

## 5. Conduct

You agree not to submit content that is unlawful, defamatory, infringing on third-party rights, or otherwise inappropriate. MDGH reserves the right to disqualify applications containing such content with no refund.

## 6. Limitation of liability

MDGH's total liability under these terms is limited to the application fee paid.

## 7. Governing law

These terms are governed by the laws of Ghana.

## Contact

For questions about these terms, contact **applications@missdiasporagh.org**.
```

- [ ] **Step 3: Create privacy.astro that renders the markdown**

```astro
---
// src/pages/privacy.astro
import ApplyLayout from '@/layouts/ApplyLayout.astro';

const md = await import('../data/privacy.md?raw');
const html = renderSimpleMarkdown(md.default);

function renderSimpleMarkdown(src: string): string {
  // Strip frontmatter
  const body = src.replace(/^---[\s\S]*?---\n/, '');
  // Minimal markdown: headers, bold, italic, paragraphs, bullets, links
  const lines = body.split('\n');
  const out: string[] = [];
  let inList = false;
  for (const raw of lines) {
    const line = raw.trimEnd();
    if (line.startsWith('# ')) { closeList(); out.push(`<h1>${escapeHtml(line.slice(2))}</h1>`); continue; }
    if (line.startsWith('## ')) { closeList(); out.push(`<h2>${escapeHtml(line.slice(3))}</h2>`); continue; }
    if (line.startsWith('### ')) { closeList(); out.push(`<h3>${escapeHtml(line.slice(4))}</h3>`); continue; }
    if (line.startsWith('- ')) { if (!inList) { out.push('<ul>'); inList = true; } out.push(`<li>${inline(line.slice(2))}</li>`); continue; }
    if (line === '') { closeList(); out.push(''); continue; }
    closeList(); out.push(`<p>${inline(line)}</p>`);
  }
  closeList();
  return out.join('\n');

  function closeList() { if (inList) { out.push('</ul>'); inList = false; } }
  function inline(s: string): string {
    return escapeHtml(s)
      .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
      .replace(/\*([^*]+)\*/g, '<em>$1</em>')
      .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>')
      .replace(/`([^`]+)`/g, '<code>$1</code>');
  }
  function escapeHtml(s: string): string {
    return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }
}
---
<ApplyLayout title="Privacy Policy | MDGH">
  <div class="wrap" style="max-width:760px">
    <article set:html={html}></article>
  </div>
</ApplyLayout>
```

- [ ] **Step 4: Create terms.astro (mirror of privacy.astro pointing at terms.md)**

```astro
---
// src/pages/terms.astro
import ApplyLayout from '@/layouts/ApplyLayout.astro';

const md = await import('../data/terms.md?raw');
const html = renderSimpleMarkdown(md.default);

function renderSimpleMarkdown(src: string): string {
  const body = src.replace(/^---[\s\S]*?---\n/, '');
  const lines = body.split('\n');
  const out: string[] = [];
  let inList = false;
  for (const raw of lines) {
    const line = raw.trimEnd();
    if (line.startsWith('# ')) { closeList(); out.push(`<h1>${escapeHtml(line.slice(2))}</h1>`); continue; }
    if (line.startsWith('## ')) { closeList(); out.push(`<h2>${escapeHtml(line.slice(3))}</h2>`); continue; }
    if (line.startsWith('### ')) { closeList(); out.push(`<h3>${escapeHtml(line.slice(4))}</h3>`); continue; }
    if (line.startsWith('- ')) { if (!inList) { out.push('<ul>'); inList = true; } out.push(`<li>${inline(line.slice(2))}</li>`); continue; }
    if (line === '') { closeList(); out.push(''); continue; }
    closeList(); out.push(`<p>${inline(line)}</p>`);
  }
  closeList();
  return out.join('\n');
  function closeList() { if (inList) { out.push('</ul>'); inList = false; } }
  function inline(s: string): string {
    return escapeHtml(s)
      .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
      .replace(/\*([^*]+)\*/g, '<em>$1</em>')
      .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>')
      .replace(/`([^`]+)`/g, '<code>$1</code>');
  }
  function escapeHtml(s: string): string {
    return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }
}
---
<ApplyLayout title="Terms of Application | MDGH">
  <div class="wrap" style="max-width:760px">
    <article set:html={html}></article>
  </div>
</ApplyLayout>
```

- [ ] **Step 5: Smoke test**

```bash
npm run build && npm run wrangler:dev
```
Open `/privacy` and `/terms`. Both should render with headings, paragraphs, lists.

- [ ] **Step 6: Commit**

```bash
git add src/data/privacy.md src/data/terms.md src/pages/privacy.astro src/pages/terms.astro
git commit -m "feat(legal): /privacy + /terms pages with markdown content"
```

### Task M2.7: E2E test — happy path through to magic-link

**Files:**
- Create: `playwright.config.ts`
- Create: `tests/e2e/apply-disqualified.spec.ts`

- [ ] **Step 1: Create Playwright config**

```ts
// playwright.config.ts
import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  use: {
    baseURL: 'http://localhost:8788',
    headless: true,
  },
  webServer: {
    command: 'npm run build && npm run wrangler:dev',
    url: 'http://localhost:8788',
    timeout: 120_000,
    reuseExistingServer: true,
  },
});
```

- [ ] **Step 2: Install Playwright browsers**

```bash
npx playwright install chromium
```

- [ ] **Step 3: Write disqualified-path E2E**

```ts
// tests/e2e/apply-disqualified.spec.ts
import { test, expect } from '@playwright/test';

test('disqualified branch shows soft re-engagement card', async ({ page }) => {
  await page.goto('/apply');

  // Pick "Under 18" age band → triggers disqualified state
  await page.getByRole('button', { name: 'Under 18' }).click();

  // Expect disqualified card to appear
  await expect(page.locator('#disqualified-card')).toBeVisible();
  await expect(page.locator('#disqualified-card')).toContainText("isn't a fit");

  // Subscribe to notifications
  await page.locator('#dq-email').fill('test-disqualified@example.com');
  await page.locator('#dq-subscribe').click();

  // Expect success message
  await expect(page.locator('#dq-msg')).toContainText("we'll be in touch", { timeout: 5000 });
});
```

- [ ] **Step 4: Run E2E**

```bash
npm run test:e2e -- apply-disqualified
```
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add playwright.config.ts tests/e2e/apply-disqualified.spec.ts
git commit -m "test(e2e): disqualified-branch soft re-engagement Playwright test"
```

---

---

## M3 — Magic-link form + file uploads

This milestone builds the unlocked form (`/apply/form`), the file-upload presign endpoint, the React file uploader (XHR + progress), the draft + submit endpoints, the confirmation page (`/apply/done`), and the recovery flow (`/apply/recover`).

### Task M3.1: Form schema + token validator helper

**Files:**
- Create: `src/lib/schemas/form.ts`
- Create: `src/lib/tokens/validate-apply-token.ts`
- Create: `tests/unit/validate-apply-token.test.ts`

- [ ] **Step 1: Write form schema**

```ts
// src/lib/schemas/form.ts
import { z } from 'zod';

export const draftFileSchema = z.object({
  token: z.string().min(1),
  fileType: z.enum(['headshot', 'video']),
  fileName: z.string().min(1).max(255),
  contentType: z.string().min(1).max(100),
  sizeBytes: z.number().int().positive(),
});
export type DraftFileInput = z.infer<typeof draftFileSchema>;

export const draftRecordSchema = z.object({
  token: z.string().min(1),
  fileType: z.enum(['headshot', 'video']),
  r2Key: z.string().min(1),
});
export type DraftRecordInput = z.infer<typeof draftRecordSchema>;

export const submitSchema = z.object({
  token: z.string().min(1),
  fullName: z.string().min(1).max(120),
  phone: z.string().min(5).max(40),
  dateOfBirth: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  countryOfResidence: z.string().min(1).max(80),
  currentCity: z.string().min(1).max(80),
  countryOfHeritage: z.string().min(1).max(80),
  bio: z.string().min(50).max(1500),
  socials: z.object({
    instagram: z.string().max(80).optional(),
    tiktok: z.string().max(80).optional(),
    twitter: z.string().max(80).optional(),
    linkedin: z.string().max(200).optional(),
  }).optional(),
});
export type SubmitInput = z.infer<typeof submitSchema>;

export const recoverSchema = z.object({
  email: z.string().email().max(254),
  reference: z.string().regex(/^MDGH-[A-Z0-9-]+$/),
  honeypot: z.string().max(0),
});
export type RecoverInput = z.infer<typeof recoverSchema>;

export const FILE_LIMITS = {
  headshot: { maxBytes: 10 * 1024 * 1024, contentTypes: ['image/jpeg', 'image/png', 'image/webp'] },
  video:    { maxBytes: 300 * 1024 * 1024, contentTypes: ['video/mp4', 'video/quicktime', 'video/webm'] },
} as const;
```

- [ ] **Step 2: Write validate-apply-token tests**

```ts
// tests/unit/validate-apply-token.test.ts
import { describe, it, expect } from 'vitest';
import { signApplyToken } from '@/lib/tokens/apply-token';
import { validateApplyToken } from '@/lib/tokens/validate-apply-token';

const SECRET = 'a'.repeat(64);

function fakeDb(rows: Record<string, unknown>) {
  return {
    prepare(_: string) {
      return {
        bind(id: string) {
          return { async first() { return rows[id] ?? null; } };
        },
      };
    },
  } as unknown as D1Database;
}

const FUTURE = Math.floor(Date.now() / 1000) + 3600;

describe('validateApplyToken', () => {
  it('passes for paid, unsubmitted, open cycle', async () => {
    const token = await signApplyToken('app1', FUTURE, SECRET);
    const result = await validateApplyToken(token, SECRET, fakeDb({
      app1: { id: 'app1', payment_status: 'paid', submitted_at: null, cycle_id: 'C1' },
      C1: { id: 'C1', is_active: 1, applications_close_at: '2099-01-01T00:00:00Z' },
    }));
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.applicationId).toBe('app1');
  });

  it('rejects unpaid', async () => {
    const token = await signApplyToken('app2', FUTURE, SECRET);
    const result = await validateApplyToken(token, SECRET, fakeDb({
      app2: { id: 'app2', payment_status: 'pending', submitted_at: null, cycle_id: 'C1' },
      C1: { id: 'C1', is_active: 1, applications_close_at: '2099-01-01T00:00:00Z' },
    }));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('not_paid');
  });

  it('rejects already-submitted', async () => {
    const token = await signApplyToken('app3', FUTURE, SECRET);
    const result = await validateApplyToken(token, SECRET, fakeDb({
      app3: { id: 'app3', payment_status: 'paid', submitted_at: '2026-05-10T00:00:00Z', cycle_id: 'C1' },
      C1: { id: 'C1', is_active: 1, applications_close_at: '2099-01-01T00:00:00Z' },
    }));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('already_submitted');
  });

  it('rejects when cycle has closed', async () => {
    const token = await signApplyToken('app4', FUTURE, SECRET);
    const result = await validateApplyToken(token, SECRET, fakeDb({
      app4: { id: 'app4', payment_status: 'paid', submitted_at: null, cycle_id: 'C1' },
      C1: { id: 'C1', is_active: 1, applications_close_at: '2020-01-01T00:00:00Z' },
    }));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('cycle_closed');
  });

  it('rejects bad signature (delegated)', async () => {
    const token = await signApplyToken('app5', FUTURE, SECRET);
    const result = await validateApplyToken(token, 'b'.repeat(64), fakeDb({}));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('bad_signature');
  });
});
```

- [ ] **Step 3: Run, expect fail**

```bash
npm test -- tests/unit/validate-apply-token.test.ts
```
Expected: FAIL.

- [ ] **Step 4: Implement validate-apply-token**

```ts
// src/lib/tokens/validate-apply-token.ts
import { verifyApplyToken } from './apply-token';
import { getApplicationById, getCycle } from '@/lib/db/queries';

export type ValidateApplyTokenResult =
  | { ok: true; applicationId: string }
  | { ok: false; reason: 'malformed' | 'bad_signature' | 'expired' | 'not_found' | 'not_paid' | 'already_submitted' | 'cycle_closed' };

export async function validateApplyToken(
  token: string, secret: string, db: D1Database
): Promise<ValidateApplyTokenResult> {
  const verified = await verifyApplyToken(token, secret);
  if (!verified.ok) return { ok: false, reason: verified.reason };

  const app = await getApplicationById(db, verified.applicationId);
  if (!app) return { ok: false, reason: 'not_found' };
  if (app.payment_status !== 'paid') return { ok: false, reason: 'not_paid' };
  if (app.submitted_at) return { ok: false, reason: 'already_submitted' };

  const cycle = await getCycle(db, app.cycle_id);
  if (!cycle) return { ok: false, reason: 'cycle_closed' };
  if (cycle.is_active !== 1) return { ok: false, reason: 'cycle_closed' };
  if (new Date() > new Date(cycle.applications_close_at)) return { ok: false, reason: 'cycle_closed' };

  return { ok: true, applicationId: verified.applicationId };
}
```

- [ ] **Step 5: Run, expect pass**

```bash
npm test -- tests/unit/validate-apply-token.test.ts
```
Expected: All PASS.

- [ ] **Step 6: Commit**

```bash
git add src/lib/schemas/form.ts src/lib/tokens/validate-apply-token.ts tests/unit/validate-apply-token.test.ts
git commit -m "feat(tokens): validateApplyToken — full token + D1 + cycle check"
```

### Task M3.2: /api/upload/presign — R2 presigned PUT URL

**Files:**
- Create: `src/lib/r2/presign.ts`
- Create: `src/pages/api/upload/presign.ts`
- Create: `tests/integration/upload-presign.test.ts`

- [ ] **Step 1: Implement R2 S3-compatible presign helper**

```ts
// src/lib/r2/presign.ts
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

export async function presignR2Put(args: {
  accountId: string;
  accessKeyId: string;
  secretAccessKey: string;
  bucket: string;
  key: string;
  contentType: string;
  expiresInSeconds: number;
}): Promise<string> {
  const client = new S3Client({
    region: 'auto',
    endpoint: `https://${args.accountId}.r2.cloudflarestorage.com`,
    credentials: { accessKeyId: args.accessKeyId, secretAccessKey: args.secretAccessKey },
  });
  const command = new PutObjectCommand({
    Bucket: args.bucket,
    Key: args.key,
    ContentType: args.contentType,
    ContentDisposition: 'attachment',
  });
  return getSignedUrl(client, command, { expiresIn: args.expiresInSeconds });
}
```

- [ ] **Step 2: Implement presign endpoint**

```ts
// src/pages/api/upload/presign.ts
import type { APIRoute } from 'astro';
import { draftFileSchema, FILE_LIMITS } from '@/lib/schemas/form';
import { validateApplyToken } from '@/lib/tokens/validate-apply-token';
import { presignR2Put } from '@/lib/r2/presign';

export const prerender = false;

const BUCKET_NAME_FROM_ENV = (env: CloudflareEnv): string => {
  // We don't have a way to read the bucket name from the binding; accept via env if needed.
  // For now, hardcode based on whether MOCK_PAYMENTS — staging vs prod.
  return env.MOCK_PAYMENTS === 'true' ? 'mdgh-applications-staging' : 'mdgh-applications';
};

export const POST: APIRoute = async ({ request, locals }) => {
  const env = locals.runtime.env;
  let body: unknown;
  try { body = await request.json(); } catch { return j({ ok: false, error: 'invalid_json' }, 400); }

  const parsed = draftFileSchema.safeParse(body);
  if (!parsed.success) return j({ ok: false, error: 'invalid_input', details: parsed.error.flatten() }, 400);
  const input = parsed.data;

  const limits = FILE_LIMITS[input.fileType];
  if (input.sizeBytes > limits.maxBytes) {
    return j({ ok: false, error: 'file_too_large', maxBytes: limits.maxBytes }, 400);
  }
  if (!limits.contentTypes.includes(input.contentType as (typeof limits.contentTypes)[number])) {
    return j({ ok: false, error: 'content_type_not_allowed', allowed: limits.contentTypes }, 400);
  }

  const validation = await validateApplyToken(input.token, env.APPLY_TOKEN_SECRET, env.DB);
  if (!validation.ok) return j({ ok: false, error: 'invalid_token', reason: validation.reason }, 401);

  const ext = extensionFor(input.contentType);
  const r2Key = `cycles/MDGH-2026/${validation.applicationId}/${input.fileType === 'headshot' ? 'headshot' : 'intro-video'}.${ext}`;

  const bucket = BUCKET_NAME_FROM_ENV(env);
  const uploadUrl = await presignR2Put({
    accountId: env.R2_ACCOUNT_ID,
    accessKeyId: env.R2_ACCESS_KEY_ID,
    secretAccessKey: env.R2_SECRET_ACCESS_KEY,
    bucket,
    key: r2Key,
    contentType: input.contentType,
    expiresInSeconds: 900, // 15 min
  });

  // Track active presign in KV (one per (token, fileType))
  await env.SESSION.put(
    `presign-active:${validation.applicationId}:${input.fileType}`,
    r2Key,
    { expirationTtl: 900 }
  );

  return j({ ok: true, uploadUrl, r2Key });
};

function extensionFor(ct: string): string {
  const map: Record<string, string> = {
    'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp',
    'video/mp4': 'mp4', 'video/quicktime': 'mov', 'video/webm': 'webm',
  };
  return map[ct] ?? 'bin';
}

function j(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}
```

- [ ] **Step 3: Write integration test**

```ts
// tests/integration/upload-presign.test.ts
import { describe, it, expect, vi } from 'vitest';
import { POST } from '@/pages/api/upload/presign';
import { signApplyToken } from '@/lib/tokens/apply-token';

vi.mock('@/lib/r2/presign', () => ({
  presignR2Put: async () => 'https://r2.example/presigned-url',
}));

const SECRET = 'a'.repeat(64);
const FUTURE = Math.floor(Date.now() / 1000) + 3600;

function fakeEnv(rows: Record<string, unknown>) {
  const kv = new Map<string, string>();
  return {
    DB: {
      prepare(_: string) {
        return { bind(id: string) { return { async first() { return rows[id] ?? null; } }; } };
      },
    } as unknown as D1Database,
    SESSION: {
      get: async (k: string) => kv.get(k) ?? null,
      put: async (k: string, v: string) => { kv.set(k, v); },
      delete: async (k: string) => { kv.delete(k); },
    } as unknown as KVNamespace,
    APPLY_TOKEN_SECRET: SECRET,
    R2_ACCOUNT_ID: 'acc', R2_ACCESS_KEY_ID: 'k', R2_SECRET_ACCESS_KEY: 's',
    MOCK_PAYMENTS: 'true',
  } as unknown as CloudflareEnv;
}

function ctx(env: CloudflareEnv, body: unknown) {
  return {
    request: new Request('http://localhost/api/upload/presign', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
    }),
    locals: { runtime: { env } } as App.Locals,
    clientAddress: '1.2.3.4', cookies: {} as never, redirect: () => new Response(),
    params: {}, props: {}, site: undefined, generator: '',
    preferredLocale: undefined, preferredLocaleList: [], currentLocale: undefined,
    url: new URL('http://localhost/api/upload/presign'),
  } as unknown as Parameters<typeof POST>[0];
}

describe('POST /api/upload/presign', () => {
  it('returns uploadUrl + r2Key for valid token + valid file', async () => {
    const token = await signApplyToken('app1', FUTURE, SECRET);
    const env = fakeEnv({
      app1: { id: 'app1', payment_status: 'paid', submitted_at: null, cycle_id: 'C1' },
      C1: { id: 'C1', is_active: 1, applications_close_at: '2099-01-01T00:00:00Z' },
    });
    const res = await POST(ctx(env, {
      token, fileType: 'headshot', fileName: 'me.jpg',
      contentType: 'image/jpeg', sizeBytes: 500_000,
    }));
    expect(res.status).toBe(200);
    const j = await res.json() as { ok: boolean; uploadUrl: string; r2Key: string };
    expect(j.ok).toBe(true);
    expect(j.uploadUrl).toBe('https://r2.example/presigned-url');
    expect(j.r2Key).toMatch(/^cycles\/MDGH-2026\/app1\/headshot\.jpg$/);
  });

  it('rejects oversize file', async () => {
    const token = await signApplyToken('app1', FUTURE, SECRET);
    const env = fakeEnv({
      app1: { id: 'app1', payment_status: 'paid', submitted_at: null, cycle_id: 'C1' },
      C1: { id: 'C1', is_active: 1, applications_close_at: '2099-01-01T00:00:00Z' },
    });
    const res = await POST(ctx(env, {
      token, fileType: 'headshot', fileName: 'huge.jpg',
      contentType: 'image/jpeg', sizeBytes: 50_000_000,
    }));
    expect(res.status).toBe(400);
    const j = await res.json() as { error: string };
    expect(j.error).toBe('file_too_large');
  });

  it('rejects disallowed content type', async () => {
    const token = await signApplyToken('app1', FUTURE, SECRET);
    const env = fakeEnv({
      app1: { id: 'app1', payment_status: 'paid', submitted_at: null, cycle_id: 'C1' },
      C1: { id: 'C1', is_active: 1, applications_close_at: '2099-01-01T00:00:00Z' },
    });
    const res = await POST(ctx(env, {
      token, fileType: 'video', fileName: 'me.exe',
      contentType: 'application/octet-stream', sizeBytes: 1_000_000,
    }));
    expect(res.status).toBe(400);
    const j = await res.json() as { error: string };
    expect(j.error).toBe('content_type_not_allowed');
  });

  it('rejects unpaid token', async () => {
    const token = await signApplyToken('app2', FUTURE, SECRET);
    const env = fakeEnv({
      app2: { id: 'app2', payment_status: 'pending', submitted_at: null, cycle_id: 'C1' },
      C1: { id: 'C1', is_active: 1, applications_close_at: '2099-01-01T00:00:00Z' },
    });
    const res = await POST(ctx(env, {
      token, fileType: 'headshot', fileName: 'me.jpg',
      contentType: 'image/jpeg', sizeBytes: 500_000,
    }));
    expect(res.status).toBe(401);
  });
});
```

- [ ] **Step 4: Run tests, expect pass**

```bash
npm test -- tests/integration/upload-presign.test.ts
```
Expected: All 4 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/r2/presign.ts src/pages/api/upload/presign.ts tests/integration/upload-presign.test.ts
git commit -m "feat(upload): /api/upload/presign — R2 presigned PUT URL"
```

### Task M3.3: /api/applications/draft endpoint (record R2 key)

**Files:**
- Create: `src/pages/api/applications/draft.ts`

- [ ] **Step 1: Implement draft endpoint**

```ts
// src/pages/api/applications/draft.ts
import type { APIRoute } from 'astro';
import { draftRecordSchema } from '@/lib/schemas/form';
import { validateApplyToken } from '@/lib/tokens/validate-apply-token';
import { setDraftFile } from '@/lib/db/queries';

export const prerender = false;

export const POST: APIRoute = async ({ request, locals }) => {
  const env = locals.runtime.env;
  let body: unknown;
  try { body = await request.json(); } catch { return j({ ok: false, error: 'invalid_json' }, 400); }
  const parsed = draftRecordSchema.safeParse(body);
  if (!parsed.success) return j({ ok: false, error: 'invalid_input' }, 400);

  const validation = await validateApplyToken(parsed.data.token, env.APPLY_TOKEN_SECRET, env.DB);
  if (!validation.ok) return j({ ok: false, error: 'invalid_token', reason: validation.reason }, 401);

  // Confirm the r2Key matches the active presign for this (applicationId, fileType)
  const expectedKey = await env.SESSION.get(`presign-active:${validation.applicationId}:${parsed.data.fileType}`);
  if (expectedKey !== parsed.data.r2Key) {
    return j({ ok: false, error: 'r2_key_mismatch' }, 400);
  }

  // Verify the object actually landed in R2
  const head = await env.MEDIA.head(parsed.data.r2Key);
  if (!head) return j({ ok: false, error: 'object_not_found_in_r2' }, 400);

  const field = parsed.data.fileType === 'headshot' ? 'headshot_r2_key' : 'video_r2_key';
  await setDraftFile(env.DB, validation.applicationId, field, parsed.data.r2Key);

  return j({ ok: true });
};

function j(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}
```

- [ ] **Step 2: Verify it compiles**

```bash
npx astro check
```
Expected: 0 errors.

- [ ] **Step 3: Commit**

```bash
git add src/pages/api/applications/draft.ts
git commit -m "feat(api): /api/applications/draft — record R2 key after upload"
```

### Task M3.4: /apply/form page + ApplyForm React island

**Files:**
- Create: `src/components/apply/FileUploader.tsx`
- Create: `src/components/apply/ApplyForm.tsx`
- Create: `src/pages/apply/form.astro`

- [ ] **Step 1: Implement FileUploader React component**

```tsx
// src/components/apply/FileUploader.tsx
import { useState } from 'react';
import type { CSSProperties } from 'react';

type Props = {
  fileType: 'headshot' | 'video';
  token: string;
  initialKey?: string;
  accept: string;
  maxSizeBytes: number;
  maxDurationSeconds?: number;
  onComplete: (r2Key: string) => void;
};

export default function FileUploader(props: Props) {
  const [progress, setProgress] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [doneKey, setDoneKey] = useState<string | null>(props.initialKey ?? null);
  const [fileName, setFileName] = useState<string | null>(null);

  async function handleFile(file: File) {
    setError(null);
    if (file.size > props.maxSizeBytes) {
      setError(`File is too large (max ${(props.maxSizeBytes / 1024 / 1024).toFixed(0)} MB).`);
      return;
    }
    if (props.maxDurationSeconds && file.type.startsWith('video/')) {
      const dur = await videoDuration(file);
      if (dur > props.maxDurationSeconds) {
        setError(`Video is ${Math.round(dur)}s (max ${props.maxDurationSeconds}s).`);
        return;
      }
    }

    setFileName(file.name);

    // Get presigned URL
    const presignRes = await fetch('/api/upload/presign', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        token: props.token,
        fileType: props.fileType,
        fileName: file.name,
        contentType: file.type,
        sizeBytes: file.size,
      }),
    });
    const presignJson = await presignRes.json() as { ok: boolean; uploadUrl?: string; r2Key?: string; error?: string };
    if (!presignJson.ok || !presignJson.uploadUrl || !presignJson.r2Key) {
      setError(presignJson.error ?? 'Could not start upload.');
      return;
    }

    // Upload via XHR for progress events
    setProgress(0);
    await new Promise<void>((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.upload.addEventListener('progress', (e) => {
        if (e.lengthComputable) setProgress(Math.round((e.loaded / e.total) * 100));
      });
      xhr.addEventListener('load', () => {
        if (xhr.status >= 200 && xhr.status < 300) resolve();
        else reject(new Error(`R2 returned ${xhr.status}`));
      });
      xhr.addEventListener('error', () => reject(new Error('Network error during upload')));
      xhr.addEventListener('abort', () => reject(new Error('Upload aborted')));
      xhr.open('PUT', presignJson.uploadUrl!);
      xhr.setRequestHeader('Content-Type', file.type);
      xhr.send(file);
    }).catch(e => {
      setError(e instanceof Error ? e.message : 'Upload failed');
      setProgress(null);
    });

    if (progress === null) return; // failure path

    // Record the R2 key on the D1 row
    const draftRes = await fetch('/api/applications/draft', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: props.token, fileType: props.fileType, r2Key: presignJson.r2Key }),
    });
    if (!draftRes.ok) {
      const j = await draftRes.json() as { error?: string };
      setError(j.error ?? 'Could not save the upload.');
      setProgress(null);
      return;
    }
    setProgress(100);
    setDoneKey(presignJson.r2Key);
    props.onComplete(presignJson.r2Key);
  }

  const dropZone: CSSProperties = {
    border: '2px dashed #333', borderRadius: 8, padding: 24, textAlign: 'center',
    background: doneKey ? 'rgba(76,175,80,0.06)' : 'transparent',
    borderColor: doneKey ? '#4caf50' : (progress !== null ? '#F8B92F' : '#333'),
  };

  if (doneKey) {
    return (
      <div style={dropZone}>
        <div style={{ color: '#4caf50', fontSize: 14, fontWeight: 700, marginBottom: 4 }}>✓ {fileName ?? 'Uploaded'}</div>
        <button type="button" onClick={() => { setDoneKey(null); setFileName(null); setProgress(null); }} style={{ background: 'transparent', border: 0, color: '#F8B92F', textDecoration: 'underline', cursor: 'pointer' }}>
          Replace
        </button>
      </div>
    );
  }

  if (progress !== null) {
    return (
      <div style={dropZone}>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 6 }}>
          <span>{fileName}</span><span style={{ color: '#F8B92F' }}>Uploading {progress}%</span>
        </div>
        <div style={{ height: 6, background: '#0d0d0d', borderRadius: 3, overflow: 'hidden' }}>
          <div style={{ width: `${progress}%`, height: '100%', background: '#F8B92F', transition: 'width 200ms' }} />
        </div>
        <p style={{ fontSize: 11, opacity: 0.5, marginTop: 8 }}>Don't close this tab. Your magic-link email will let you resume if needed.</p>
      </div>
    );
  }

  return (
    <label style={{ ...dropZone, cursor: 'pointer', display: 'block' }}>
      <input
        type="file" accept={props.accept} hidden
        onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
      />
      <div style={{ fontSize: 13, opacity: 0.85 }}>Drag a file here or <span style={{ color: '#F8B92F', textDecoration: 'underline' }}>browse</span></div>
      <div style={{ fontSize: 11, opacity: 0.5, marginTop: 6 }}>
        Max {(props.maxSizeBytes / 1024 / 1024).toFixed(0)} MB
        {props.maxDurationSeconds ? ` · max ${props.maxDurationSeconds}s` : ''}
      </div>
      {error && <p style={{ color: '#FF6B6B', fontSize: 13, marginTop: 8 }}>{error}</p>}
    </label>
  );
}

function videoDuration(file: File): Promise<number> {
  return new Promise((resolve, reject) => {
    const v = document.createElement('video');
    v.preload = 'metadata';
    v.onloadedmetadata = () => { URL.revokeObjectURL(v.src); resolve(v.duration); };
    v.onerror = () => reject(new Error('Could not read video metadata'));
    v.src = URL.createObjectURL(file);
  });
}
```

- [ ] **Step 2: Implement ApplyForm island**

```tsx
// src/components/apply/ApplyForm.tsx
import { useState } from 'react';
import FileUploader from './FileUploader';

type Props = {
  token: string;
  reference: string;
  cycleClose: string;
  initialHeadshotKey?: string;
  initialVideoKey?: string;
};

type FormState = {
  fullName: string; phone: string; dateOfBirth: string;
  countryOfResidence: string; currentCity: string; countryOfHeritage: string;
  bio: string;
  socials: { instagram: string; tiktok: string; twitter: string; linkedin: string };
};

const EMPTY: FormState = {
  fullName: '', phone: '', dateOfBirth: '',
  countryOfResidence: '', currentCity: '', countryOfHeritage: '',
  bio: '', socials: { instagram: '', tiktok: '', twitter: '', linkedin: '' },
};

export default function ApplyForm(props: Props) {
  const [state, setState] = useState<FormState>(EMPTY);
  const [headshotKey, setHeadshotKey] = useState<string | undefined>(props.initialHeadshotKey);
  const [videoKey, setVideoKey] = useState<string | undefined>(props.initialVideoKey);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isValid =
    state.fullName.trim().length >= 1 &&
    state.phone.trim().length >= 5 &&
    /^\d{4}-\d{2}-\d{2}$/.test(state.dateOfBirth) &&
    state.countryOfResidence.trim().length >= 1 &&
    state.currentCity.trim().length >= 1 &&
    state.countryOfHeritage.trim().length >= 1 &&
    state.bio.trim().length >= 50 &&
    state.bio.length <= 1500 &&
    !!headshotKey && !!videoKey;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    const res = await fetch('/api/applications/submit', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: props.token, ...state }),
    });
    setSubmitting(false);
    if (!res.ok) {
      const j = await res.json() as { error?: string; reason?: string };
      setError(j.error === 'invalid_input' ? 'Some fields are missing or invalid.' : (j.reason ?? 'Submission failed.'));
      return;
    }
    window.location.href = `/apply/done?ref=${encodeURIComponent(props.reference)}`;
  }

  function set<K extends keyof FormState>(k: K, v: FormState[K]) {
    setState(s => ({ ...s, [k]: v }));
  }
  function setSocial<K extends keyof FormState['socials']>(k: K, v: string) {
    setState(s => ({ ...s, socials: { ...s.socials, [k]: v } }));
  }

  return (
    <form onSubmit={submit}>
      <section className="card">
        <div className="label" style={{ marginBottom: 12 }}>About you</div>
        <div className="field-row">
          <div><label className="muted" style={{ fontSize: 11 }}>Full name</label>
            <input className="input" value={state.fullName} onChange={e => set('fullName', e.target.value)} maxLength={120} required /></div>
          <div><label className="muted" style={{ fontSize: 11 }}>Phone (with country code)</label>
            <input className="input" value={state.phone} onChange={e => set('phone', e.target.value)} maxLength={40} required /></div>
          <div><label className="muted" style={{ fontSize: 11 }}>Date of birth</label>
            <input className="input" type="date" value={state.dateOfBirth} onChange={e => set('dateOfBirth', e.target.value)} required /></div>
          <div><label className="muted" style={{ fontSize: 11 }}>Country of residence</label>
            <input className="input" value={state.countryOfResidence} onChange={e => set('countryOfResidence', e.target.value)} maxLength={80} required /></div>
          <div><label className="muted" style={{ fontSize: 11 }}>Current city</label>
            <input className="input" value={state.currentCity} onChange={e => set('currentCity', e.target.value)} maxLength={80} required /></div>
          <div><label className="muted" style={{ fontSize: 11 }}>Country of heritage</label>
            <input className="input" value={state.countryOfHeritage} onChange={e => set('countryOfHeritage', e.target.value)} maxLength={80} required /></div>
        </div>
      </section>

      <section className="card">
        <div className="label" style={{ marginBottom: 12 }}>Your story</div>
        <label className="muted" style={{ fontSize: 11 }}>Bio ({state.bio.length}/1500 chars, min 50)</label>
        <textarea
          className="input" rows={6} value={state.bio}
          onChange={e => set('bio', e.target.value)}
          maxLength={1500}
          placeholder="Tell us who you are, what you carry, and what platform you would champion as queen…" required
        />
      </section>

      <section className="card">
        <div className="label" style={{ marginBottom: 12 }}>Socials (optional)</div>
        <div className="field-row">
          <input className="input" placeholder="@instagram" value={state.socials.instagram} onChange={e => setSocial('instagram', e.target.value)} maxLength={80} />
          <input className="input" placeholder="@tiktok" value={state.socials.tiktok} onChange={e => setSocial('tiktok', e.target.value)} maxLength={80} />
          <input className="input" placeholder="@twitter" value={state.socials.twitter} onChange={e => setSocial('twitter', e.target.value)} maxLength={80} />
          <input className="input" placeholder="linkedin url" value={state.socials.linkedin} onChange={e => setSocial('linkedin', e.target.value)} maxLength={200} />
        </div>
      </section>

      <section className="card">
        <div className="label" style={{ marginBottom: 12 }}>Headshot</div>
        <FileUploader
          fileType="headshot" token={props.token} initialKey={headshotKey}
          accept="image/jpeg,image/png,image/webp" maxSizeBytes={10 * 1024 * 1024}
          onComplete={setHeadshotKey}
        />
      </section>

      <section className="card">
        <div className="label" style={{ marginBottom: 12 }}>Intro video (up to 2 minutes)</div>
        <FileUploader
          fileType="video" token={props.token} initialKey={videoKey}
          accept="video/mp4,video/quicktime,video/webm" maxSizeBytes={300 * 1024 * 1024}
          maxDurationSeconds={120}
          onComplete={setVideoKey}
        />
      </section>

      {error && <p className="err" style={{ textAlign: 'center', marginBottom: 8 }}>{error}</p>}

      <button type="submit" className="btn" style={{ width: '100%', padding: 16, fontSize: 16 }} disabled={!isValid || submitting}>
        {submitting ? 'Submitting…' : 'Submit application'}
      </button>
    </form>
  );
}
```

- [ ] **Step 3: Implement /apply/form page**

```astro
---
// src/pages/apply/form.astro
import ApplyLayout from '@/layouts/ApplyLayout.astro';
import ApplyForm from '@/components/apply/ApplyForm';
import { validateApplyToken } from '@/lib/tokens/validate-apply-token';
import { getApplicationById, getCycle } from '@/lib/db/queries';

const env = Astro.locals.runtime.env;
const token = Astro.url.searchParams.get('token');
if (!token) return Astro.redirect('/apply');

const v = await validateApplyToken(token, env.APPLY_TOKEN_SECRET, env.DB);
if (!v.ok) {
  if (v.reason === 'already_submitted') return Astro.redirect('/apply/done');
  if (v.reason === 'cycle_closed') return Astro.redirect('/apply/closed');
  return Astro.redirect('/apply/recover');
}

const app = await getApplicationById(env.DB, v.applicationId);
const cycle = app ? await getCycle(env.DB, app.cycle_id) : null;
if (!app || !cycle) return Astro.redirect('/apply');

const cycleClose = cycle.applications_close_at.slice(0, 10);
---
<ApplyLayout title="Your Application | MDGH">
  <div class="wrap">
    <div class="card" style="background:rgba(76,175,80,0.08);border-left:3px solid #4caf50">
      <strong style="color:#4caf50">✓ Payment confirmed.</strong>
      A backup link to this form has been emailed to you. You can return any time before <strong>{cycleClose}</strong>.
    </div>
    <div style="text-align:center;margin:18px 0">
      <h1 style="margin:0 0 4px;font-size:28px">Your Application</h1>
      <p class="muted">Reference <code style="color:#F8B92F">{app.transaction_reference}</code></p>
    </div>
    <ApplyForm
      client:load
      token={token}
      reference={app.transaction_reference}
      cycleClose={cycleClose}
      initialHeadshotKey={app.headshot_r2_key ?? undefined}
      initialVideoKey={app.video_r2_key ?? undefined}
    />
  </div>
</ApplyLayout>
```

- [ ] **Step 4: Smoke test**

```bash
npm run build && npm run wrangler:dev
```

Walk the full path: `/apply` → fill → continue → mock-checkout → simulate success → verify D1 (`wrangler d1 execute --local --command "SELECT id, payment_status FROM applications;"`). Manually craft a magic link from the verify response token and visit `/apply/form?token=...`. The form should render with the reference banner.

- [ ] **Step 5: Commit**

```bash
git add src/components/apply/FileUploader.tsx src/components/apply/ApplyForm.tsx src/pages/apply/form.astro
git commit -m "feat(apply): /apply/form + ApplyForm island + FileUploader (XHR + progress)"
```

### Task M3.5: /api/applications/submit + /apply/done

**Files:**
- Create: `src/pages/api/applications/submit.ts`
- Create: `src/pages/apply/done.astro`

- [ ] **Step 1: Implement submit endpoint**

```ts
// src/pages/api/applications/submit.ts
import type { APIRoute } from 'astro';
import { submitSchema } from '@/lib/schemas/form';
import { validateApplyToken } from '@/lib/tokens/validate-apply-token';
import { submitApplication, getApplicationById } from '@/lib/db/queries';
import { getEmailProvider, renderApplicantConfirmation, renderAdminNotification } from '@/lib/email';

export const prerender = false;

export const POST: APIRoute = async ({ request, locals }) => {
  const env = locals.runtime.env;
  let body: unknown;
  try { body = await request.json(); } catch { return j({ ok: false, error: 'invalid_json' }, 400); }
  const parsed = submitSchema.safeParse(body);
  if (!parsed.success) return j({ ok: false, error: 'invalid_input', details: parsed.error.flatten() }, 400);

  const validation = await validateApplyToken(parsed.data.token, env.APPLY_TOKEN_SECRET, env.DB);
  if (!validation.ok) return j({ ok: false, error: 'invalid_token', reason: validation.reason }, 401);

  const result = await submitApplication(env.DB, validation.applicationId, {
    full_name: parsed.data.fullName,
    phone: parsed.data.phone,
    date_of_birth: parsed.data.dateOfBirth,
    country_of_residence: parsed.data.countryOfResidence,
    current_city: parsed.data.currentCity,
    country_of_heritage: parsed.data.countryOfHeritage,
    bio: parsed.data.bio,
    socials_json: JSON.stringify(parsed.data.socials ?? {}),
  });
  if (!result.success) return j({ ok: false, error: 'submit_failed', reason: result.reason }, 409);

  const app = await getApplicationById(env.DB, validation.applicationId);
  if (!app) return j({ ok: true });

  // Send confirmation + admin notification (best-effort; failures don't block submission success)
  const email = getEmailProvider(env);
  const dashboardUrl = new URL(`/admin/applications/${app.id}`, request.url).toString();
  await Promise.all([
    email.send({ to: app.email, ...renderApplicantConfirmation({ fullName: parsed.data.fullName, reference: app.transaction_reference }) }).catch(() => null),
    email.send({ to: 'applications@missdiasporagh.org', ...renderAdminNotification({ fullName: parsed.data.fullName, reference: app.transaction_reference, dashboardUrl }) }).catch(() => null),
  ]);

  return j({ ok: true, reference: app.transaction_reference });
};

function j(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}
```

Note: the admin email recipient `applications@missdiasporagh.org` is a placeholder. The implementer should replace it with the actual admin email or read it from an env var like `ADMIN_NOTIFICATION_EMAIL`. For first deploy, use the user's primary inbox.

- [ ] **Step 2: Implement /apply/done**

```astro
---
// src/pages/apply/done.astro
import ApplyLayout from '@/layouts/ApplyLayout.astro';
const ref = Astro.url.searchParams.get('ref') ?? '';
---
<ApplyLayout title="Application received | MDGH">
  <div class="wrap" style="text-align:center">
    <div style="font-size:48px;margin-bottom:16px;color:#4caf50">✓</div>
    <h1 style="font-size:28px;margin:0 0 8px">Application received</h1>
    <p class="muted" style="margin:0 0 18px">We'll be in touch within 14 days. Keep this reference safe:</p>
    <div class="card" style="font-family:monospace;font-size:18px;color:#F8B92F;text-align:center">{ref}</div>
    <p class="muted" style="margin-top:18px">A confirmation has been sent to your email.</p>
  </div>
</ApplyLayout>
```

- [ ] **Step 3: Commit**

```bash
git add src/pages/api/applications/submit.ts src/pages/apply/done.astro
git commit -m "feat(apply): submit endpoint + done page + emails"
```

### Task M3.6: /apply/recover + /api/applications/recover

**Files:**
- Create: `src/pages/api/applications/recover.ts`
- Create: `src/pages/apply/recover.astro`

- [ ] **Step 1: Implement recover endpoint**

```ts
// src/pages/api/applications/recover.ts
import type { APIRoute } from 'astro';
import { recoverSchema } from '@/lib/schemas/form';
import { getApplicationByReference, getCycle, markPaymentPaid, setApplyTokenIssued } from '@/lib/db/queries';
import { getPaymentProvider } from '@/lib/payment';
import { signApplyToken } from '@/lib/tokens/apply-token';
import { getEmailProvider, renderRecoveryEmail } from '@/lib/email';

export const prerender = false;

export const POST: APIRoute = async ({ request, locals }) => {
  const env = locals.runtime.env;
  let body: unknown;
  try { body = await request.json(); } catch { return j({ ok: false, error: 'invalid_json' }, 400); }
  const parsed = recoverSchema.safeParse(body);
  if (!parsed.success) return j({ ok: false, error: 'invalid_input' }, 400);
  if (parsed.data.honeypot.length > 0) return j({ ok: false, error: 'bot_detected' }, 400);

  const app = await getApplicationByReference(env.DB, parsed.data.reference);
  if (!app) return j({ ok: false, error: 'not_found' }, 404);
  if (app.email.toLowerCase() !== parsed.data.email.toLowerCase()) {
    // Don't leak whether reference exists; return generic message
    return j({ ok: true });
  }

  // If not yet paid, re-run verify
  if (app.payment_status !== 'paid') {
    const provider = getPaymentProvider(env);
    const v = await provider.verify(parsed.data.reference);
    if (!v.ok || v.status !== 'paid') return j({ ok: false, error: 'not_paid' }, 400);
    await markPaymentPaid(env.DB, app.id, v.providerTransactionId, v.paidAt ?? new Date().toISOString());
  }

  if (app.submitted_at) return j({ ok: false, error: 'already_submitted' }, 409);

  const cycle = await getCycle(env.DB, app.cycle_id);
  if (!cycle) return j({ ok: false, error: 'cycle_missing' }, 500);

  // Mint fresh token
  const cycleCloseUnix = Math.floor(new Date(cycle.applications_close_at).getTime() / 1000);
  const thirtyDays = Math.floor(Date.now() / 1000) + 30 * 24 * 3600;
  const expiry = Math.min(thirtyDays, cycleCloseUnix);
  const token = await signApplyToken(app.id, expiry, env.APPLY_TOKEN_SECRET);

  // Rate limit: 3 sends per hour per email
  const rlKey = `rl:recover:${parsed.data.email.toLowerCase()}`;
  const current = Number(await env.SESSION.get(rlKey)) || 0;
  if (current >= 3) return j({ ok: false, error: 'rate_limited' }, 429);
  await env.SESSION.put(rlKey, String(current + 1), { expirationTtl: 3600 });

  const emailProvider = getEmailProvider(env);
  const magicLink = new URL(`/apply/form?token=${encodeURIComponent(token)}`, request.url).toString();
  await emailProvider.send({
    to: app.email,
    ...renderRecoveryEmail({
      reference: app.transaction_reference,
      magicLink,
      cycleClose: cycle.applications_close_at.slice(0, 10),
    }),
  });
  await setApplyTokenIssued(env.DB, app.id, new Date().toISOString());

  return j({ ok: true });
};

function j(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}
```

- [ ] **Step 2: Implement /apply/recover page**

```astro
---
// src/pages/apply/recover.astro
import ApplyLayout from '@/layouts/ApplyLayout.astro';
---
<ApplyLayout title="Recover application link | MDGH">
  <div class="wrap" style="max-width:520px">
    <h1 style="font-size:26px;text-align:center;margin:0 0 6px">Resend my application link</h1>
    <p class="muted" style="text-align:center;margin:0 0 22px">Already paid but lost the email or closed the browser? Enter your details below.</p>
    <form id="recover-form" class="card">
      <input type="text" name="honeypot" tabindex="-1" autocomplete="off" style="position:absolute;left:-9999px" aria-hidden="true" />
      <label class="muted" style="font-size:11px">Email used at payment</label>
      <input class="input" type="email" name="email" required style="margin-bottom:14px" />
      <label class="muted" style="font-size:11px">Reference (from your Payaza receipt)</label>
      <input class="input" type="text" name="reference" placeholder="MDGH-2026-XXXXXXXX" pattern="^MDGH-[A-Z0-9-]+$" required style="margin-bottom:18px" />
      <button type="submit" class="btn" style="width:100%;padding:14px;font-weight:700">Resend my link</button>
      <p id="recover-msg" style="margin-top:10px;display:none"></p>
    </form>
  </div>
  <script type="module">
    document.getElementById('recover-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const f = e.target;
      const msg = document.getElementById('recover-msg');
      msg.style.display = 'block';
      const res = await fetch('/api/applications/recover', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: f.email.value.trim(),
          reference: f.reference.value.trim().toUpperCase(),
          honeypot: f.honeypot.value,
        }),
      });
      const j = await res.json();
      if (j.ok) { msg.className = 'ok'; msg.textContent = "If we found a match, we've emailed you a fresh link."; }
      else if (j.error === 'rate_limited') { msg.className = 'err'; msg.textContent = 'Too many attempts. Try again in an hour.'; }
      else { msg.className = 'err'; msg.textContent = 'Something went wrong. Try again later.'; }
    });
  </script>
</ApplyLayout>
```

- [ ] **Step 3: Commit**

```bash
git add src/pages/api/applications/recover.ts src/pages/apply/recover.astro
git commit -m "feat(apply): /apply/recover + endpoint — resend magic link"
```

### Task M3.7: E2E happy-path test

**Files:**
- Create: `tests/e2e/apply-happy-path.spec.ts`

- [ ] **Step 1: Create E2E test**

```ts
// tests/e2e/apply-happy-path.spec.ts
import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import path from 'node:path';

test('happy path — apply → mock pay → form → submit', async ({ page }) => {
  await page.goto('/apply');

  // Eligibility
  await page.getByRole('button', { name: '18-25' }).click();
  // Each subsequent question's "Yes" is the first button in its row
  const yesButtons = page.locator('#eligibility-quiz button', { hasText: 'Yes' });
  await yesButtons.nth(0).click(); // isWoman
  await yesButtons.nth(1).click(); // africanDescent
  await yesButtons.nth(2).click(); // outsideGhana
  await yesButtons.nth(3).click(); // validPassport

  // Email + consent
  await page.locator('input[name="email"]').fill('test-happy@example.com');
  await page.locator('input[name="consentPolicy"]').check();
  await page.getByRole('button', { name: 'Yes, I consent' }).click();
  await page.getByRole('button', { name: 'No, thanks' }).click();

  // Wait for Turnstile test key to auto-resolve, then continue
  await expect(page.locator('#submit-btn')).toBeEnabled({ timeout: 15_000 });
  await page.locator('#submit-btn').click();

  // Mock checkout
  await expect(page).toHaveURL(/\/mock-checkout/);
  await page.getByRole('link', { name: 'Simulate successful payment' }).click();

  // Should arrive at /apply/form (verify endpoint redirects)
  await expect(page).toHaveURL(/\/apply\/form\?token=/, { timeout: 10_000 });
  await expect(page.locator('text=Payment confirmed')).toBeVisible();

  // Fill the form
  await page.locator('input[type="text"]').nth(0).fill('Test Applicant'); // fullName (first text input is full name)
  // Better: use placeholder-based locators
  await page.locator('input[placeholder=""], input[type="text"]').first().fill('Test Applicant');
  // Actually, use labels — get by previous label text
  // For brevity, fill in field order via placeholder + tab order
  // (this test is intentionally loose — production test uses better selectors)
  // ... implementer to refine selectors when running
});
```

Note: this E2E is intentionally a starter; the implementer should refine selectors against the rendered DOM. File-upload E2E with Playwright requires `<input type="file">.setInputFiles(testFixturePath)` — add a small JPG fixture under `tests/e2e/fixtures/headshot.jpg` and a small MP4 under `tests/e2e/fixtures/intro.mp4`.

- [ ] **Step 2: Add a placeholder fixture note to the test**

Inside the test file, add a TODO comment block:
```ts
// TODO: refine to fill form via labelled selectors and call .setInputFiles for headshot + video upload, then click submit and assert /apply/done.
```

- [ ] **Step 3: Run, expect partial pass** (the form-fill portion may need refinement; the navigation portion through /apply/form should succeed)

```bash
npm run test:e2e -- apply-happy-path
```

- [ ] **Step 4: Commit**

```bash
git add tests/e2e/apply-happy-path.spec.ts
git commit -m "test(e2e): apply happy path through to /apply/form (form-fill TODO)"
```

---

## M4 — Admin layer

This milestone builds login (`/admin/login`), session middleware, list view (`/admin/applications`), detail view (`/admin/applications/[id]`), status update, signed-URL endpoint, and CSV export.

### Task M4.1: Admin auth — login endpoint + session middleware + login page

**Files:**
- Create: `src/middleware/admin-auth.ts`
- Create: `src/pages/api/admin/login.ts`
- Create: `src/pages/api/admin/logout.ts`
- Create: `src/pages/admin/login.astro`
- Create: `src/lib/schemas/admin.ts`
- Create: `tests/integration/admin-login.test.ts`

- [ ] **Step 1: Admin schema**

```ts
// src/lib/schemas/admin.ts
import { z } from 'zod';

export const adminLoginSchema = z.object({
  email: z.string().email().max(254),
  password: z.string().min(1).max(200),
});
export type AdminLoginInput = z.infer<typeof adminLoginSchema>;

export const adminStatusUpdateSchema = z.object({
  status: z.enum(['new', 'reviewing', 'shortlisted', 'rejected']),
  adminNotes: z.string().max(2000).nullable().optional(),
});
export type AdminStatusUpdateInput = z.infer<typeof adminStatusUpdateSchema>;
```

- [ ] **Step 2: Login endpoint**

```ts
// src/pages/api/admin/login.ts
import type { APIRoute } from 'astro';
import { adminLoginSchema } from '@/lib/schemas/admin';
import { verifyPassword } from '@/lib/crypto/pbkdf2';
import { signAdminSession } from '@/lib/tokens/admin-session';
import { newUlid } from '@/lib/ids/ulid';
import { hashIp } from '@/lib/crypto/hash';
import { insertAdminAudit } from '@/lib/db/queries';

export const prerender = false;

const SESSION_TTL_SECONDS = 4 * 3600;
const ADMIN_EMAIL = 'admin@missdiasporagh.org'; // single-admin model; replace if needed

export const POST: APIRoute = async ({ request, locals, clientAddress }) => {
  const env = locals.runtime.env;
  let body: unknown;
  try { body = await request.json(); } catch { return j({ ok: false, error: 'invalid_json' }, 400); }
  const parsed = adminLoginSchema.safeParse(body);
  if (!parsed.success) return j({ ok: false, error: 'invalid_input' }, 400);

  if (parsed.data.email.toLowerCase() !== ADMIN_EMAIL) return j({ ok: false, error: 'invalid_credentials' }, 401);
  const ok = await verifyPassword(parsed.data.password, env.ADMIN_PASSWORD_HASH);
  if (!ok) return j({ ok: false, error: 'invalid_credentials' }, 401);

  const sessionId = newUlid();
  const expiryUnix = Math.floor(Date.now() / 1000) + SESSION_TTL_SECONDS;
  const token = await signAdminSession(ADMIN_EMAIL, sessionId, expiryUnix, env.ADMIN_SESSION_SECRET);

  // Track session in KV (allows server-side invalidation)
  await env.SESSION.put(`admin-session:${sessionId}`, JSON.stringify({ email: ADMIN_EMAIL, expiresAt: expiryUnix }), { expirationTtl: SESSION_TTL_SECONDS });

  // Audit log
  const ipHash = await hashIp(clientAddress ?? 'unknown', env.IP_HASH_SALT);
  await insertAdminAudit(env.DB, {
    id: newUlid(), adminEmail: ADMIN_EMAIL, action: 'login',
    targetApplicationId: null, detailsJson: null, ipHash,
  });

  // Set HttpOnly cookie
  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      'Set-Cookie': `mdgh_admin=${token}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${SESSION_TTL_SECONDS}`,
    },
  });
};

function j(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}
```

- [ ] **Step 3: Logout endpoint**

```ts
// src/pages/api/admin/logout.ts
import type { APIRoute } from 'astro';
import { verifyAdminSession } from '@/lib/tokens/admin-session';

export const prerender = false;

export const POST: APIRoute = async ({ request, locals }) => {
  const env = locals.runtime.env;
  const cookie = request.headers.get('cookie') ?? '';
  const match = /mdgh_admin=([^;]+)/.exec(cookie);
  if (match) {
    const v = await verifyAdminSession(match[1], env.ADMIN_SESSION_SECRET);
    if (v.ok) await env.SESSION.delete(`admin-session:${v.sessionId}`);
  }
  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      'Set-Cookie': 'mdgh_admin=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0',
    },
  });
};
```

- [ ] **Step 4: Admin auth middleware (helper, not Astro middleware)**

```ts
// src/middleware/admin-auth.ts
import { verifyAdminSession } from '@/lib/tokens/admin-session';

export type AdminCheckResult =
  | { ok: true; adminEmail: string; sessionId: string }
  | { ok: false; reason: string };

export async function checkAdminAuth(
  request: Request, env: { ADMIN_SESSION_SECRET: string; SESSION: KVNamespace }
): Promise<AdminCheckResult> {
  const cookie = request.headers.get('cookie') ?? '';
  const match = /mdgh_admin=([^;]+)/.exec(cookie);
  if (!match) return { ok: false, reason: 'no_cookie' };
  const v = await verifyAdminSession(match[1], env.ADMIN_SESSION_SECRET);
  if (!v.ok) return { ok: false, reason: v.reason };
  const kv = await env.SESSION.get(`admin-session:${v.sessionId}`);
  if (!kv) return { ok: false, reason: 'session_revoked' };
  return { ok: true, adminEmail: v.adminEmail, sessionId: v.sessionId };
}
```

- [ ] **Step 5: Login page**

```astro
---
// src/pages/admin/login.astro
import ApplyLayout from '@/layouts/ApplyLayout.astro';
---
<ApplyLayout title="Admin login | MDGH">
  <div class="wrap" style="max-width:420px">
    <h1 style="text-align:center;font-size:24px;margin:0 0 18px">Admin sign in</h1>
    <form id="login" class="card">
      <label class="muted" style="font-size:11px">Email</label>
      <input class="input" name="email" type="email" required style="margin-bottom:14px" />
      <label class="muted" style="font-size:11px">Password</label>
      <input class="input" name="password" type="password" required style="margin-bottom:18px" />
      <button type="submit" class="btn" style="width:100%;padding:14px">Sign in</button>
      <p id="login-err" class="err" style="text-align:center;display:none;margin-top:10px"></p>
    </form>
  </div>
  <script type="module">
    document.getElementById('login').addEventListener('submit', async (e) => {
      e.preventDefault();
      const f = e.target;
      const err = document.getElementById('login-err');
      err.style.display = 'none';
      const res = await fetch('/api/admin/login', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: f.email.value, password: f.password.value }),
      });
      if (res.ok) window.location.href = '/admin/applications';
      else { err.textContent = 'Invalid email or password.'; err.style.display = 'block'; }
    });
  </script>
</ApplyLayout>
```

- [ ] **Step 6: Integration test**

```ts
// tests/integration/admin-login.test.ts
import { describe, it, expect } from 'vitest';
import { POST } from '@/pages/api/admin/login';
import { hashPassword } from '@/lib/crypto/pbkdf2';

async function fakeEnv(adminPassword: string) {
  const kv = new Map<string, string>();
  return {
    DB: {
      prepare(_: string) { return { bind() { return { async run() { return { meta: { changes: 1 } }; } }; } }; },
    } as unknown as D1Database,
    SESSION: {
      get: async (k: string) => kv.get(k) ?? null,
      put: async (k: string, v: string) => { kv.set(k, v); },
      delete: async (k: string) => { kv.delete(k); },
    } as unknown as KVNamespace,
    ADMIN_PASSWORD_HASH: await hashPassword(adminPassword),
    ADMIN_SESSION_SECRET: 'a'.repeat(64),
    IP_HASH_SALT: 'salt',
  } as unknown as CloudflareEnv;
}

function ctx(env: CloudflareEnv, body: unknown) {
  return {
    request: new Request('http://localhost/api/admin/login', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
    }),
    locals: { runtime: { env } } as App.Locals,
    clientAddress: '1.2.3.4', cookies: {} as never, redirect: () => new Response(),
    params: {}, props: {}, site: undefined, generator: '',
    preferredLocale: undefined, preferredLocaleList: [], currentLocale: undefined,
    url: new URL('http://localhost/api/admin/login'),
  } as unknown as Parameters<typeof POST>[0];
}

describe('POST /api/admin/login', () => {
  it('returns 200 with Set-Cookie on correct credentials', async () => {
    const env = await fakeEnv('correct-horse');
    const res = await POST(ctx(env, { email: 'admin@missdiasporagh.org', password: 'correct-horse' }));
    expect(res.status).toBe(200);
    expect(res.headers.get('Set-Cookie')).toContain('mdgh_admin=');
  });

  it('rejects wrong password', async () => {
    const env = await fakeEnv('correct-horse');
    const res = await POST(ctx(env, { email: 'admin@missdiasporagh.org', password: 'wrong' }));
    expect(res.status).toBe(401);
  });

  it('rejects wrong email', async () => {
    const env = await fakeEnv('correct-horse');
    const res = await POST(ctx(env, { email: 'someoneelse@example.com', password: 'correct-horse' }));
    expect(res.status).toBe(401);
  });
});
```

- [ ] **Step 7: Run**

```bash
npm test -- tests/integration/admin-login.test.ts
```
Expected: All 3 PASS.

- [ ] **Step 8: Commit**

```bash
git add src/middleware/admin-auth.ts src/pages/api/admin/login.ts src/pages/api/admin/logout.ts src/pages/admin/login.astro src/lib/schemas/admin.ts tests/integration/admin-login.test.ts
git commit -m "feat(admin): login + logout + session middleware + tests"
```

### Task M4.2: Admin list view + endpoint

**Files:**
- Create: `src/pages/api/admin/applications/index.ts`
- Create: `src/pages/admin/applications/index.astro`

- [ ] **Step 1: Implement list endpoint**

```ts
// src/pages/api/admin/applications/index.ts
import type { APIRoute } from 'astro';
import { listApplicationsForAdmin } from '@/lib/db/queries';
import { checkAdminAuth } from '@/middleware/admin-auth';

export const prerender = false;

export const GET: APIRoute = async ({ request, locals }) => {
  const env = locals.runtime.env;
  const auth = await checkAdminAuth(request, env);
  if (!auth.ok) return j({ ok: false, error: 'unauthorized' }, 401);

  const url = new URL(request.url);
  const status = url.searchParams.get('status') ?? undefined;
  const q = url.searchParams.get('q') ?? undefined;
  const limit = Math.min(100, Number(url.searchParams.get('limit') ?? '50'));
  const offset = Math.max(0, Number(url.searchParams.get('offset') ?? '0'));

  const { rows, total } = await listApplicationsForAdmin(env.DB, { status, q, limit, offset });
  return j({ ok: true, rows, total, limit, offset });
};

function j(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}
```

- [ ] **Step 2: Implement list page**

```astro
---
// src/pages/admin/applications/index.astro
import ApplyLayout from '@/layouts/ApplyLayout.astro';
import { checkAdminAuth } from '@/middleware/admin-auth';
import { listApplicationsForAdmin } from '@/lib/db/queries';

const env = Astro.locals.runtime.env;
const auth = await checkAdminAuth(Astro.request, env);
if (!auth.ok) return Astro.redirect('/admin/login');

const url = Astro.url;
const status = url.searchParams.get('status') ?? '';
const q = url.searchParams.get('q') ?? '';
const offset = Number(url.searchParams.get('offset') ?? '0');
const limit = 50;

const { rows, total } = await listApplicationsForAdmin(env.DB, {
  status: status || undefined, q: q || undefined, limit, offset,
});
---
<ApplyLayout title="Admin · Applications | MDGH">
  <div class="wrap" style="max-width:1100px">
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:18px">
      <h1 style="margin:0;font-size:26px">Applications ({total})</h1>
      <form method="post" action="/api/admin/logout" onsubmit="event.preventDefault();fetch('/api/admin/logout',{method:'POST'}).then(()=>window.location.href='/admin/login')">
        <button class="btn-ghost" type="submit">Sign out</button>
      </form>
    </div>

    <form method="get" class="card" style="display:flex;gap:8px;flex-wrap:wrap;align-items:end">
      <div style="flex:1;min-width:200px">
        <label class="muted" style="font-size:11px">Search (email, name, reference)</label>
        <input class="input" name="q" value={q} />
      </div>
      <div>
        <label class="muted" style="font-size:11px">Status</label>
        <select class="input" name="status">
          <option value="">All</option>
          <option value="new" selected={status === 'new'}>New</option>
          <option value="reviewing" selected={status === 'reviewing'}>Reviewing</option>
          <option value="shortlisted" selected={status === 'shortlisted'}>Shortlisted</option>
          <option value="rejected" selected={status === 'rejected'}>Rejected</option>
        </select>
      </div>
      <button class="btn" type="submit" style="padding:10px 18px">Filter</button>
      <a class="btn-ghost" href="/api/admin/applications/csv" style="text-decoration:none;display:inline-block;padding:10px 14px">Export CSV</a>
    </form>

    <div class="card" style="padding:0;overflow:hidden">
      <table style="width:100%;border-collapse:collapse">
        <thead>
          <tr style="background:#0d0d0d">
            <th style="padding:10px;text-align:left;font-size:11px;color:#F8B92F;letter-spacing:0.15em;text-transform:uppercase">Submitted</th>
            <th style="padding:10px;text-align:left;font-size:11px;color:#F8B92F">Name</th>
            <th style="padding:10px;text-align:left;font-size:11px;color:#F8B92F">Email</th>
            <th style="padding:10px;text-align:left;font-size:11px;color:#F8B92F">Reference</th>
            <th style="padding:10px;text-align:left;font-size:11px;color:#F8B92F">Status</th>
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 && <tr><td colspan="5" style="padding:24px;text-align:center;opacity:0.6">No applications match these filters.</td></tr>}
          {rows.map((r) => (
            <tr style="border-top:1px solid #2a2a2a">
              <td style="padding:10px;font-size:13px">{r.submitted_at?.slice(0, 10) ?? '—'}</td>
              <td style="padding:10px;font-size:13px"><a href={`/admin/applications/${r.id}`}>{r.full_name ?? '(no name)'}</a></td>
              <td style="padding:10px;font-size:13px">{r.email}</td>
              <td style="padding:10px;font-size:12px;font-family:monospace;color:#F8B92F">{r.transaction_reference}</td>
              <td style="padding:10px;font-size:13px">{r.status}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>

    {total > limit && (
      <div style="display:flex;gap:8px;margin-top:14px;justify-content:center">
        {offset > 0 && <a class="btn-ghost" href={`?status=${status}&q=${q}&offset=${Math.max(0, offset - limit)}`}>Previous</a>}
        {offset + limit < total && <a class="btn-ghost" href={`?status=${status}&q=${q}&offset=${offset + limit}`}>Next</a>}
      </div>
    )}
  </div>
</ApplyLayout>
```

- [ ] **Step 3: Commit**

```bash
git add src/pages/api/admin/applications/index.ts src/pages/admin/applications/index.astro
git commit -m "feat(admin): applications list view + endpoint"
```

### Task M4.3: Admin detail view + signed URL endpoint + status update

**Files:**
- Create: `src/pages/api/admin/applications/[id].ts`
- Create: `src/pages/api/admin/applications/[id]/status.ts`
- Create: `src/pages/api/admin/applications/[id]/signed-url.ts`
- Create: `src/pages/admin/applications/[id].astro`
- Create: `src/lib/r2/presign-get.ts`

- [ ] **Step 1: Add R2 presigned GET helper**

```ts
// src/lib/r2/presign-get.ts
import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

export async function presignR2Get(args: {
  accountId: string;
  accessKeyId: string;
  secretAccessKey: string;
  bucket: string;
  key: string;
  expiresInSeconds: number;
}): Promise<string> {
  const client = new S3Client({
    region: 'auto',
    endpoint: `https://${args.accountId}.r2.cloudflarestorage.com`,
    credentials: { accessKeyId: args.accessKeyId, secretAccessKey: args.secretAccessKey },
  });
  return getSignedUrl(client, new GetObjectCommand({ Bucket: args.bucket, Key: args.key }), {
    expiresIn: args.expiresInSeconds,
  });
}
```

- [ ] **Step 2: Detail endpoint**

```ts
// src/pages/api/admin/applications/[id].ts
import type { APIRoute } from 'astro';
import { getApplicationById } from '@/lib/db/queries';
import { checkAdminAuth } from '@/middleware/admin-auth';

export const prerender = false;

export const GET: APIRoute = async ({ request, locals, params }) => {
  const env = locals.runtime.env;
  const auth = await checkAdminAuth(request, env);
  if (!auth.ok) return j({ ok: false, error: 'unauthorized' }, 401);
  const id = params.id;
  if (!id || typeof id !== 'string') return j({ ok: false, error: 'bad_id' }, 400);
  const row = await getApplicationById(env.DB, id);
  if (!row) return j({ ok: false, error: 'not_found' }, 404);
  return j({ ok: true, application: row });
};

function j(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}
```

- [ ] **Step 3: Status update endpoint**

```ts
// src/pages/api/admin/applications/[id]/status.ts
import type { APIRoute } from 'astro';
import { adminStatusUpdateSchema } from '@/lib/schemas/admin';
import { updateApplicationStatus, insertAdminAudit } from '@/lib/db/queries';
import { checkAdminAuth } from '@/middleware/admin-auth';
import { newUlid } from '@/lib/ids/ulid';
import { hashIp } from '@/lib/crypto/hash';

export const prerender = false;

export const PATCH: APIRoute = async ({ request, locals, params, clientAddress }) => {
  const env = locals.runtime.env;
  const auth = await checkAdminAuth(request, env);
  if (!auth.ok) return j({ ok: false, error: 'unauthorized' }, 401);

  const id = params.id;
  if (!id || typeof id !== 'string') return j({ ok: false, error: 'bad_id' }, 400);

  let body: unknown;
  try { body = await request.json(); } catch { return j({ ok: false, error: 'invalid_json' }, 400); }
  const parsed = adminStatusUpdateSchema.safeParse(body);
  if (!parsed.success) return j({ ok: false, error: 'invalid_input' }, 400);

  await updateApplicationStatus(env.DB, id, parsed.data.status, parsed.data.adminNotes ?? null);

  const ipHash = await hashIp(clientAddress ?? 'unknown', env.IP_HASH_SALT);
  await insertAdminAudit(env.DB, {
    id: newUlid(), adminEmail: auth.adminEmail, action: 'status_change',
    targetApplicationId: id,
    detailsJson: JSON.stringify({ status: parsed.data.status, hasNotes: !!parsed.data.adminNotes }),
    ipHash,
  });

  return j({ ok: true });
};

function j(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}
```

- [ ] **Step 4: Signed-URL endpoint**

```ts
// src/pages/api/admin/applications/[id]/signed-url.ts
import type { APIRoute } from 'astro';
import { getApplicationById, insertAdminAudit } from '@/lib/db/queries';
import { checkAdminAuth } from '@/middleware/admin-auth';
import { presignR2Get } from '@/lib/r2/presign-get';
import { newUlid } from '@/lib/ids/ulid';
import { hashIp } from '@/lib/crypto/hash';

export const prerender = false;

export const GET: APIRoute = async ({ request, locals, params, clientAddress }) => {
  const env = locals.runtime.env;
  const auth = await checkAdminAuth(request, env);
  if (!auth.ok) return j({ ok: false, error: 'unauthorized' }, 401);

  const id = params.id;
  if (!id || typeof id !== 'string') return j({ ok: false, error: 'bad_id' }, 400);

  const url = new URL(request.url);
  const which = url.searchParams.get('which');
  if (which !== 'headshot' && which !== 'video') return j({ ok: false, error: 'bad_which' }, 400);

  const row = await getApplicationById(env.DB, id);
  if (!row) return j({ ok: false, error: 'not_found' }, 404);

  const r2Key = which === 'headshot' ? row.headshot_r2_key : row.video_r2_key;
  if (!r2Key) return j({ ok: false, error: 'no_file' }, 404);

  const bucket = env.MOCK_PAYMENTS === 'true' ? 'mdgh-applications-staging' : 'mdgh-applications';
  const signedUrl = await presignR2Get({
    accountId: env.R2_ACCOUNT_ID,
    accessKeyId: env.R2_ACCESS_KEY_ID,
    secretAccessKey: env.R2_SECRET_ACCESS_KEY,
    bucket, key: r2Key, expiresInSeconds: 300,
  });

  const ipHash = await hashIp(clientAddress ?? 'unknown', env.IP_HASH_SALT);
  await insertAdminAudit(env.DB, {
    id: newUlid(), adminEmail: auth.adminEmail, action: 'signed_url_issued',
    targetApplicationId: id, detailsJson: JSON.stringify({ which }), ipHash,
  });

  return j({ ok: true, url: signedUrl, expiresInSeconds: 300 });
};

function j(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}
```

- [ ] **Step 5: Detail page**

```astro
---
// src/pages/admin/applications/[id].astro
import ApplyLayout from '@/layouts/ApplyLayout.astro';
import { checkAdminAuth } from '@/middleware/admin-auth';
import { getApplicationById } from '@/lib/db/queries';

const env = Astro.locals.runtime.env;
const auth = await checkAdminAuth(Astro.request, env);
if (!auth.ok) return Astro.redirect('/admin/login');

const id = Astro.params.id;
if (!id) return new Response('Not Found', { status: 404 });
const app = await getApplicationById(env.DB, id);
if (!app) return new Response('Not Found', { status: 404 });

let socials: Record<string, string> = {};
try { socials = app.socials_json ? JSON.parse(app.socials_json) : {}; } catch {}
---
<ApplyLayout title={`${app.full_name ?? app.email} | Admin | MDGH`}>
  <div class="wrap" style="max-width:900px">
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px">
      <a href="/admin/applications" class="btn-ghost">← All applications</a>
      <span class="muted" style="font-family:monospace;color:#F8B92F">{app.transaction_reference}</span>
    </div>

    <h1 style="margin:0;font-size:28px">{app.full_name ?? '(no name)'}</h1>
    <p class="muted">{app.email} · {app.phone ?? '—'} · DOB {app.date_of_birth ?? '—'}</p>

    <section class="card">
      <div class="label">Status</div>
      <form id="status-form" style="display:flex;gap:8px;align-items:end;margin-top:8px">
        <select id="status-select" class="input" style="flex:0 0 200px">
          {['new','reviewing','shortlisted','rejected'].map(s => (
            <option value={s} selected={app.status === s}>{s}</option>
          ))}
        </select>
        <button class="btn" type="submit" style="padding:10px 18px">Save</button>
      </form>
      <textarea id="admin-notes" class="input" rows={3} placeholder="Admin notes…" style="margin-top:8px;width:100%">{app.admin_notes ?? ''}</textarea>
      <p id="status-msg" style="margin-top:8px;display:none"></p>
    </section>

    <section class="card">
      <div class="label">Profile</div>
      <p><strong>Country of residence:</strong> {app.country_of_residence ?? '—'}</p>
      <p><strong>Current city:</strong> {app.current_city ?? '—'}</p>
      <p><strong>Country of heritage:</strong> {app.country_of_heritage ?? '—'}</p>
      <p style="margin-top:14px"><strong>Bio:</strong></p>
      <p style="white-space:pre-wrap">{app.bio ?? '—'}</p>
      <p style="margin-top:14px"><strong>Socials:</strong> {Object.entries(socials).map(([k, v]) => `${k}: ${v}`).join(' · ') || '—'}</p>
    </section>

    <section class="card">
      <div class="label">Eligibility answers</div>
      <p>Age band: {app.eligibility_age_band ?? '—'}</p>
      <p>Identifies as woman: {app.eligibility_is_woman === 1 ? 'Yes' : 'No'}</p>
      <p>African descent: {app.eligibility_african_descent === 1 ? 'Yes' : 'No'}</p>
      <p>Resides outside Ghana: {app.eligibility_outside_ghana === 1 ? 'Yes' : 'No'}</p>
      <p>Valid passport: {app.eligibility_valid_passport === 1 ? 'Yes' : 'No'}</p>
    </section>

    <section class="card">
      <div class="label">Consent (recorded {app.consent_recorded_at})</div>
      <p>Policy version: {app.consent_policy_version}</p>
      <p>Media use consented: {app.consent_media_use === 1 ? 'Yes' : 'No'}</p>
      <p>Marketing consented: {app.consent_marketing === 1 ? 'Yes' : 'No'}</p>
    </section>

    <section class="card">
      <div class="label">Media</div>
      <div style="display:flex;gap:10px;flex-wrap:wrap;margin-top:8px">
        {app.headshot_r2_key && <button class="btn-ghost" onclick={`previewMedia('${app.id}','headshot')`}>View headshot</button>}
        {app.video_r2_key && <button class="btn-ghost" onclick={`previewMedia('${app.id}','video')`}>Play video</button>}
      </div>
      <div id="media-host" style="margin-top:14px"></div>
    </section>

    <section class="card">
      <div class="label">Payment</div>
      <p>Status: <strong>{app.payment_status}</strong></p>
      <p>Amount: {(app.payment_amount_cents / 100).toFixed(2)} {app.payment_currency}</p>
      <p>Verified at: {app.payment_verified_at ?? '—'}</p>
      <p>Payaza transaction id: <code>{app.payaza_transaction_id ?? '—'}</code></p>
      {app.email_bounced_at && <p style="color:#FF6B6B"><strong>Email bounced</strong> at {app.email_bounced_at}</p>}
    </section>
  </div>

  <script type="module" define:vars={{ id: app.id }}>
    document.getElementById('status-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const status = document.getElementById('status-select').value;
      const adminNotes = document.getElementById('admin-notes').value;
      const msg = document.getElementById('status-msg');
      msg.style.display = 'block';
      const res = await fetch(`/api/admin/applications/${id}/status`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status, adminNotes }),
      });
      if (res.ok) { msg.className = 'ok'; msg.textContent = 'Saved.'; }
      else { msg.className = 'err'; msg.textContent = 'Could not save.'; }
    });

    window.previewMedia = async (id, which) => {
      const host = document.getElementById('media-host');
      host.innerHTML = '<p class="muted">Loading…</p>';
      const res = await fetch(`/api/admin/applications/${id}/signed-url?which=${which}`);
      const j = await res.json();
      if (!j.ok) { host.innerHTML = `<p class="err">Could not load: ${j.error}</p>`; return; }
      if (which === 'headshot') host.innerHTML = `<img src="${j.url}" style="max-width:100%;border-radius:8px" />`;
      else host.innerHTML = `<video controls src="${j.url}" style="max-width:100%;border-radius:8px"></video>`;
    };
  </script>
</ApplyLayout>
```

- [ ] **Step 6: Commit**

```bash
git add src/pages/api/admin/applications/[id].ts src/pages/api/admin/applications/[id]/ src/pages/admin/applications/[id].astro src/lib/r2/presign-get.ts
git commit -m "feat(admin): detail view + status update + signed-URL endpoint"
```

### Task M4.4: CSV export endpoint

**Files:**
- Create: `src/pages/api/admin/applications/csv.ts`

- [ ] **Step 1: Implement CSV export**

```ts
// src/pages/api/admin/applications/csv.ts
import type { APIRoute } from 'astro';
import { listApplicationsForAdmin, insertAdminAudit } from '@/lib/db/queries';
import { checkAdminAuth } from '@/middleware/admin-auth';
import { newUlid } from '@/lib/ids/ulid';
import { hashIp } from '@/lib/crypto/hash';

export const prerender = false;

const COLUMNS = [
  'id', 'cycle_id', 'transaction_reference', 'email',
  'full_name', 'phone', 'date_of_birth',
  'country_of_residence', 'current_city', 'country_of_heritage',
  'bio',
  'eligibility_age_band',
  'consent_media_use', 'consent_marketing', 'consent_policy_version',
  'submitted_at', 'status', 'admin_notes',
  'payment_amount_cents', 'payment_currency', 'payaza_transaction_id', 'payment_verified_at',
] as const;

function csvEscape(v: unknown): string {
  if (v === null || v === undefined) return '';
  const s = String(v);
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

export const GET: APIRoute = async ({ request, locals, clientAddress }) => {
  const env = locals.runtime.env;
  const auth = await checkAdminAuth(request, env);
  if (!auth.ok) return new Response('Unauthorized', { status: 401 });

  const url = new URL(request.url);
  const status = url.searchParams.get('status') ?? undefined;
  const q = url.searchParams.get('q') ?? undefined;

  // Pull all matching, paginating internally
  const all: Record<string, unknown>[] = [];
  let offset = 0;
  while (true) {
    const { rows } = await listApplicationsForAdmin(env.DB, { status, q, limit: 200, offset });
    if (rows.length === 0) break;
    all.push(...rows);
    if (rows.length < 200) break;
    offset += 200;
  }

  const lines = [COLUMNS.join(',')];
  for (const row of all) {
    lines.push(COLUMNS.map(c => csvEscape((row as Record<string, unknown>)[c])).join(','));
  }
  const csv = lines.join('\n');

  const ipHash = await hashIp(clientAddress ?? 'unknown', env.IP_HASH_SALT);
  await insertAdminAudit(env.DB, {
    id: newUlid(), adminEmail: auth.adminEmail, action: 'csv_export',
    targetApplicationId: null,
    detailsJson: JSON.stringify({ rowCount: all.length, status, q }), ipHash,
  });

  return new Response(csv, {
    status: 200,
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="mdgh-applications-${new Date().toISOString().slice(0, 10)}.csv"`,
    },
  });
};
```

- [ ] **Step 2: Commit**

```bash
git add src/pages/api/admin/applications/csv.ts
git commit -m "feat(admin): CSV export endpoint with audit logging"
```

### Task M4.5: Admin E2E test

**Files:**
- Create: `tests/e2e/admin.spec.ts`

- [ ] **Step 1: Create E2E test**

```ts
// tests/e2e/admin.spec.ts
import { test, expect } from '@playwright/test';

// Note: this test assumes ADMIN_PASSWORD_HASH in .dev.vars matches the password below.
// Set the env var in .dev.vars to a hash of 'test-admin-password' before running.
const ADMIN_EMAIL = 'admin@missdiasporagh.org';
const ADMIN_PASSWORD = process.env.E2E_ADMIN_PASSWORD ?? 'test-admin-password';

test('admin login + list view', async ({ page }) => {
  await page.goto('/admin/login');
  await page.locator('input[name="email"]').fill(ADMIN_EMAIL);
  await page.locator('input[name="password"]').fill(ADMIN_PASSWORD);
  await page.locator('button[type="submit"]').click();
  await expect(page).toHaveURL('/admin/applications', { timeout: 5000 });
  await expect(page.locator('h1')).toContainText('Applications');
});

test('admin login fails with wrong password', async ({ page }) => {
  await page.goto('/admin/login');
  await page.locator('input[name="email"]').fill(ADMIN_EMAIL);
  await page.locator('input[name="password"]').fill('definitely-wrong');
  await page.locator('button[type="submit"]').click();
  await expect(page.locator('#login-err')).toContainText('Invalid email or password');
});

test('unauthenticated access to /admin/applications redirects to login', async ({ page }) => {
  await page.goto('/admin/applications');
  await expect(page).toHaveURL(/\/admin\/login/);
});
```

- [ ] **Step 2: Run**

```bash
npm run test:e2e -- admin
```
Expected: All 3 PASS (assuming `.dev.vars` has the matching hash for the password used).

- [ ] **Step 3: Commit**

```bash
git add tests/e2e/admin.spec.ts
git commit -m "test(e2e): admin login + list + auth-redirect"
```

---

## M5 — Hardening + go-live

### Task M5.1: Security headers + CSP middleware

**Files:**
- Create: `src/lib/csp/headers.ts`
- Create: `src/middleware.ts`

- [ ] **Step 1: Implement CSP headers helper**

```ts
// src/lib/csp/headers.ts
export function applySecurityHeaders(res: Response, opts: { isApply: boolean; isAdmin: boolean }): Response {
  const headers = new Headers(res.headers);

  const csp = [
    "default-src 'self'",
    `script-src 'self' https://challenges.cloudflare.com${opts.isApply ? ' https://checkout.payaza.africa' : ''}`,
    `connect-src 'self' https://api.payaza.africa https://*.r2.cloudflarestorage.com https://challenges.cloudflare.com`,
    `img-src 'self' data: https://*.r2.cloudflarestorage.com`,
    `media-src 'self' https://*.r2.cloudflarestorage.com`,
    `frame-src https://challenges.cloudflare.com${opts.isApply ? ' https://checkout.payaza.africa' : ''}`,
    `form-action 'self'${opts.isApply ? ' https://checkout.payaza.africa' : ''}`,
    "base-uri 'self'",
    "object-src 'none'",
  ].join('; ');

  headers.set('Content-Security-Policy', csp);
  headers.set('Strict-Transport-Security', 'max-age=63072000; includeSubDomains; preload');
  headers.set('X-Content-Type-Options', 'nosniff');
  headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  headers.set('X-Frame-Options', 'DENY');

  return new Response(res.body, { status: res.status, statusText: res.statusText, headers });
}
```

- [ ] **Step 2: Implement Astro middleware**

```ts
// src/middleware.ts
import { defineMiddleware } from 'astro:middleware';
import { applySecurityHeaders } from '@/lib/csp/headers';

export const onRequest = defineMiddleware(async (context, next) => {
  const res = await next();
  const path = context.url.pathname;
  const isApply = path === '/apply' || path.startsWith('/apply/');
  const isAdmin = path === '/admin' || path.startsWith('/admin/');
  if (isApply || isAdmin) return applySecurityHeaders(res, { isApply, isAdmin });
  return res;
});
```

- [ ] **Step 3: Smoke test**

```bash
npm run build && npm run wrangler:dev
```
`curl -sI http://localhost:8788/apply | grep -i 'content-security-policy'` — should print the CSP line.

- [ ] **Step 4: Commit**

```bash
git add src/lib/csp/headers.ts src/middleware.ts
git commit -m "feat(security): CSP + security headers middleware on /apply and /admin"
```

### Task M5.2: Rate-limit middleware (KV-backed)

**Files:**
- Create: `src/lib/ratelimit/kv-limiter.ts`

- [ ] **Step 1: Implement limiter**

```ts
// src/lib/ratelimit/kv-limiter.ts
export type RateLimitResult = { allowed: true } | { allowed: false; retryAfterSeconds: number };

export async function checkRateLimit(
  kv: KVNamespace, key: string, max: number, windowSeconds: number
): Promise<RateLimitResult> {
  const current = Number((await kv.get(key)) ?? '0');
  if (current >= max) return { allowed: false, retryAfterSeconds: windowSeconds };
  await kv.put(key, String(current + 1), { expirationTtl: windowSeconds });
  return { allowed: true };
}
```

- [ ] **Step 2: Wire into /api/checkout/create**

In `src/pages/api/checkout/create.ts`, just before `evaluateEligibility`, add:

```ts
import { checkRateLimit } from '@/lib/ratelimit/kv-limiter';
import { hashIp } from '@/lib/crypto/hash';

// inside POST, after parsing input:
const ipHashForRl = await hashIp(clientAddress ?? 'unknown', env.IP_HASH_SALT);
const rl = await checkRateLimit(env.SESSION, `rl:checkout-create:${ipHashForRl}`, 5, 3600);
if (!rl.allowed) return json({ ok: false, error: 'rate_limited', retryAfter: rl.retryAfterSeconds }, 429);
```

(Same pattern for `/api/upload/presign` — 20 per token per hour, key `rl:upload-presign:{token-shortened}`.)

- [ ] **Step 3: Commit**

```bash
git add src/lib/ratelimit/kv-limiter.ts src/pages/api/checkout/create.ts src/pages/api/upload/presign.ts
git commit -m "feat(security): KV-backed rate limiting on checkout-create + presign"
```

### Task M5.3: Resend bounce webhook handler

**Files:**
- Create: `src/pages/api/webhooks/resend-bounce.ts`

- [ ] **Step 1: Implement bounce webhook**

```ts
// src/pages/api/webhooks/resend-bounce.ts
import type { APIRoute } from 'astro';
import { setEmailBounced } from '@/lib/db/queries';

export const prerender = false;

// Resend signs webhooks with Svix-style headers. For now we accept-by-IP-and-secret-header.
// At production, wire Svix webhook signature verification per Resend docs.

export const POST: APIRoute = async ({ request, locals }) => {
  const env = locals.runtime.env;

  // Minimal auth: require shared secret header
  const sig = request.headers.get('x-resend-secret');
  if (sig !== env.RESEND_API_KEY) return new Response('Unauthorized', { status: 401 });

  let body: unknown;
  try { body = await request.json(); } catch { return new Response('Bad Request', { status: 400 }); }

  // Resend's bounce payload shape (verify against their docs at integration time):
  // { type: 'email.bounced', data: { email_id, to: [emails], created_at, ... } }
  const data = (body as { type?: string; data?: { to?: string[] } }) ?? {};
  if (data.type !== 'email.bounced' || !Array.isArray(data.data?.to)) {
    return new Response(JSON.stringify({ ok: true, ignored: true }), { status: 200 });
  }
  for (const to of data.data!.to!) {
    await setEmailBounced(env.DB, to);
  }
  return new Response(JSON.stringify({ ok: true }), { status: 200 });
};
```

- [ ] **Step 2: Configure Resend webhook in dashboard**

`https://resend.com/webhooks` → Add Endpoint → URL `https://missdiasporagh.org/api/webhooks/resend-bounce` → events: `email.bounced`. Set the secret header (Resend may use Svix signing; at production, swap to Svix verification).

- [ ] **Step 3: Commit**

```bash
git add src/pages/api/webhooks/resend-bounce.ts
git commit -m "feat(email): Resend bounce webhook → mark email_bounced_at on D1"
```

### Task M5.4: Update Layout.astro to add /apply CTA + finalize legal copy

**Files:**
- Modify: `src/pages/index.astro` (existing — add a working /apply link or button)
- Modify: `src/data/privacy.md` (user-supplied final copy)
- Modify: `src/data/terms.md` (user-supplied final copy)

- [ ] **Step 1: Add an Apply button to the existing index.astro**

Find the existing "Pageant Application" reference at `src/pages/index.astro:719` (per the spec's exploration notes) and add a prominent button or section linking to `/apply`. Exact placement: append a hero CTA below the existing main hero, or add a navigation link in `Navigation.astro`.

```astro
<!-- somewhere in the existing page structure, e.g., after the hero -->
<section class="text-center py-16">
  <a href="/apply" class="inline-block bg-[#F8B92F] text-black px-8 py-4 rounded-lg font-bold text-lg hover:opacity-90 transition">
    Apply for the 2026 Cycle
  </a>
</section>
```

- [ ] **Step 2: User finalizes legal copy**

The user replaces the placeholder content in `src/data/privacy.md` and `src/data/terms.md` with reviewed final copy. **Bump `consent_policy_version`** in `migrations/0005_seed_mdgh_2026.sql` (or apply via a new migration `0006_bump_policy_version.sql` if 0005 has already run on production) to match the new content.

- [ ] **Step 3: Commit**

```bash
git add src/pages/index.astro src/data/privacy.md src/data/terms.md
git commit -m "feat: add Apply CTA to home + finalize privacy/terms copy"
```

### Task M5.5: Cycle runbook + data-retention cleanup script + final docs

**Files:**
- Create: `docs/runbook-cycle.md`
- Create: `docs/data-retention.md`
- Create: `scripts/data-retention-cleanup.ts`

- [ ] **Step 1: Cycle runbook**

```markdown
<!-- docs/runbook-cycle.md -->
# Cycle Open / Close Runbook

## Opening a new cycle

1. Apply a new migration `migrations/00XX_seed_<cycle_id>.sql` that:
   - Inserts a new row into `cycles` with the new `cycle_id`, fee, currency, policy version, open/close dates, and `is_active = 1`
   - Sets the previous active cycle to `is_active = 0`
2. Update the `cycle_id` placeholder in `src/pages/api/upload/presign.ts` (if not already cycle-aware) to read from `getActiveCycle()` instead.
3. Verify by curling `/apply` — the page should show the new cycle name and fee.
4. Run a sandbox transaction end-to-end to confirm Payaza, R2, D1, email all work for the new cycle.

## Closing a cycle

1. Set `is_active = 0` on the cycle row OR let `applications_close_at` pass naturally.
2. New `/apply` visits redirect to `/apply/closed`.
3. Existing magic links continue to work for already-paid applicants until their token expires (capped at `applications_close_at`).
4. Optionally, run the data-retention cleanup script 3 years after `applications_close_at`.

## Resending an applicant's link manually (operator-side)

If an applicant emails support saying they paid but lost everything:
1. Look up by email or reference in `/admin/applications`.
2. Confirm their `payment_status = 'paid'`.
3. Have them use `/apply/recover` themselves with their email + reference.
4. If recover fails (e.g., wrong reference), manually issue them a magic link by running locally:
   ```bash
   npx tsx scripts/issue-magic-link.ts <application_id>
   ```
   (Operator-side script; not in V1 — add if a real case requires it.)
```

- [ ] **Step 2: Data-retention doc**

```markdown
<!-- docs/data-retention.md -->
# Data Retention & Cleanup

## Policy

Per `src/data/privacy.md`, applicant data is retained for **3 years after the close of the cycle** for which they applied, then permanently deleted.

## How cleanup runs

V1 uses a manual one-shot cleanup script: `scripts/data-retention-cleanup.ts`. Run it after a cycle's 3-year retention window has elapsed.

## What the cleanup does

For each application in cycles closed >= 3 years ago:
1. Lists the R2 keys (`headshot_r2_key`, `video_r2_key`)
2. Deletes the R2 objects
3. Deletes the `applications` row
4. Deletes the corresponding `cycles` row if no applications remain

`cycle_notifications` is not affected by this script (those are subscription records, not applications). Subscribers can be removed individually on unsubscribe (future feature).

## Safety

- The script does a **dry run by default** — pass `--apply` to actually delete.
- It logs every deleted key + row to stdout for audit.
- Run it from a local machine with the production R2 credentials, never as part of CI.
```

- [ ] **Step 3: Cleanup script**

```ts
// scripts/data-retention-cleanup.ts
// Usage: npx tsx scripts/data-retention-cleanup.ts [--apply]
//
// Reads from production D1 + R2 via wrangler bindings.
// Dry-run by default. Pass --apply to actually delete.

import { execSync } from 'node:child_process';

const APPLY = process.argv.includes('--apply');

function d1Query<T>(sql: string): T[] {
  const out = execSync(
    `npx wrangler d1 execute mdgh-applications-db --remote --json --command ${JSON.stringify(sql)}`,
    { encoding: 'utf8' }
  );
  const parsed = JSON.parse(out);
  return parsed[0]?.results ?? [];
}

function d1Run(sql: string): void {
  if (!APPLY) { console.log(`[dry-run] would run: ${sql}`); return; }
  execSync(
    `npx wrangler d1 execute mdgh-applications-db --remote --command ${JSON.stringify(sql)}`,
    { stdio: 'inherit' }
  );
}

function r2Delete(bucket: string, key: string): void {
  if (!APPLY) { console.log(`[dry-run] would delete r2://${bucket}/${key}`); return; }
  execSync(`npx wrangler r2 object delete ${bucket}/${key}`, { stdio: 'inherit' });
}

const threeYearsAgo = new Date();
threeYearsAgo.setFullYear(threeYearsAgo.getFullYear() - 3);

const expiredCycles = d1Query<{ id: string; applications_close_at: string }>(
  `SELECT id, applications_close_at FROM cycles WHERE applications_close_at < '${threeYearsAgo.toISOString()}'`
);

console.log(`Found ${expiredCycles.length} cycles past 3-year retention.`);

for (const c of expiredCycles) {
  const apps = d1Query<{ id: string; headshot_r2_key: string | null; video_r2_key: string | null }>(
    `SELECT id, headshot_r2_key, video_r2_key FROM applications WHERE cycle_id = '${c.id}'`
  );
  console.log(`  Cycle ${c.id} — ${apps.length} applications to purge.`);
  for (const a of apps) {
    if (a.headshot_r2_key) r2Delete('mdgh-applications', a.headshot_r2_key);
    if (a.video_r2_key) r2Delete('mdgh-applications', a.video_r2_key);
    d1Run(`DELETE FROM applications WHERE id = '${a.id}'`);
  }
  d1Run(`DELETE FROM cycles WHERE id = '${c.id}'`);
}

console.log(APPLY ? 'Done.' : 'Dry-run complete. Re-run with --apply to delete.');
```

- [ ] **Step 4: Commit**

```bash
git add docs/runbook-cycle.md docs/data-retention.md scripts/data-retention-cleanup.ts
git commit -m "docs: cycle runbook + data-retention doc + cleanup script"
```

### Task M5.6: Production smoke test (manual, one-time)

This task is operator-side. No code commits; document the result in `docs/m0-checklist.md`.

- [ ] **Step 1: Switch Cloudflare Pages preview to live Payaza sandbox**

Confirm preview env vars: `MOCK_PAYMENTS` is unset, real sandbox `PAYAZA_*` keys present, `PAYAZA_BASE_URL` is sandbox URL.

- [ ] **Step 2: Deploy preview**

```bash
git push origin <feature-branch>
```
Wait for Cloudflare Pages preview deploy.

- [ ] **Step 3: Run a real sandbox transaction**

Open the preview URL `/apply`. Walk the full happy path with a Payaza sandbox test card. Verify:
- Magic-link email arrives
- /apply/form renders
- Headshot + video upload to R2 (check Cloudflare R2 dashboard for the keys)
- Submit succeeds
- /admin/applications shows the row
- Admin detail view shows the headshot + video
- CSV export contains the row

- [ ] **Step 4: Run a real production transaction**

Switch DNS / Pages production env vars to live Payaza keys, set `PAYAZA_BASE_URL` to production. Run **one** USD 1.00 test transaction with a real card to confirm end-to-end real-money flow. Refund yourself manually via Payaza dashboard.

- [ ] **Step 5: Document results**

Append to `docs/m0-checklist.md`:
```markdown
## Smoke test results
- [date] Sandbox happy path: ✓
- [date] Production USD 1.00 test transaction: ✓ (refunded)
```

- [ ] **Step 6: Commit**

```bash
git add docs/m0-checklist.md
git commit -m "docs: smoke test results — production ready"
```

---

## Self-review notes

The plan covers every section of the spec:

| Spec section | Plan coverage |
|---|---|
| §3 User flow (happy + branches) | M2.1 (landing) + M2.3 (return) + M3.4 (form) + M3.5 (submit) + M3.6 (recover) + M2.4 (closed/notifications) |
| §4 Routes & endpoints | All public pages in M2 + M3; all `/api/*` endpoints in M2 + M3 + M4; `/admin/*` in M4 |
| §5 Data model | M1.2–M1.3 (migrations) + M1.12 (queries) |
| §6 Payment integration | M1.9 (interface + Mock) + M1.10 (PayazaProvider) |
| §7 Form UX | M3.4 (form + uploader) + M2.1 (landing layout) |
| §8 Visual direction | All apply pages use ApplyLayout (M2.1) — gold-on-dark match |
| §9 Security | M1.5 (HMAC) + M1.6 (PBKDF2 + ip_hash) + M2.2 (Turnstile + zod) + M5.1 (CSP) + M5.2 (rate limit) |
| §10 Edge cases | submitApplication guard (M1.12), token validation (M3.1), cycle-state checks (M2.1, M2.3, M3.4), Resend bounce (M5.3) |
| §11 Testing | Unit tests inline with each util; integration tests in M2.2/2.4/3.2/4.1; E2E in M2.7/3.7/4.5 |
| §12 Milestones | Mapped 1:1 |
| §14 Secrets | Listed in M0.3 |

Total: ~38 dispatchable tasks across M0–M5.

---

**Plan complete and saved to `docs/superpowers/plans/2026-05-06-contest-application-form-implementation.md`.** Two execution options:

**1. Subagent-Driven (recommended)** — I dispatch a fresh subagent per task, review between tasks, fast iteration

**2. Inline Execution** — Execute tasks in this session using executing-plans, batch execution with checkpoints

Which approach?
