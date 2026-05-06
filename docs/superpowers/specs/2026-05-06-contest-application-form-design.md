# Design — Contest application form (Payaza-gated)

**Date:** 2026-05-06
**Project:** `mdgh-web-project` (live main site, missdiasporagh.org)
**Status:** Design approved; awaiting implementation plan

---

## 1. Overview

A paid online application form for Miss Diaspora Ghana contestants, integrated into the live main site. An applicant pays a non-refundable USD 25.99 fee via Payaza Hosted Checkout; on successful verification, a signed magic-link is emailed and the form unlocks for them to submit personal details, a headshot, a 250-word bio, and a 2-minute intro video. Application data lives in Cloudflare D1; media files in Cloudflare R2; admin review through a password-gated `/admin/applications` view.

The design is scoped to ship for the upcoming cycle ("MDGH-2026") *and* to be reusable for future cycles without rework. The live site keeps its existing gold-on-dark theme; the form matches it.

## 2. Goals & non-goals

### Goals
1. Collect paid contest applications end-to-end on missdiasporagh.org
2. Block ineligible candidates *before* payment (5-rule eligibility quiz)
3. Keep applications retrievable across devices via emailed magic-link
4. Capture explicit, granular privacy + media + marketing consent
5. Give the operator a working admin view (list, filter, detail, status, CSV export)
6. Survive a single Payaza or email outage without lost applications
7. Be reusable for future cycles via a `cycle_id` column on every record

### Non-goals (V1)
- Multi-currency or non-card payment methods (USD card-only)
- Webhook listening (verify-by-reference only; Approach C is a future option)
- Multi-reviewer judging workflows (single shared admin password)
- Self-service applicant data export/deletion (manual on request)
- Webhook-driven async settlement reconciliation
- Multi-language UI
- Mobile native app

## 3. User flow

### Happy path
1. Applicant lands on `/apply`
2. Answers 5 eligibility questions; provides email; ticks privacy consent; explicitly answers two binary opt-ins (media use, marketing)
3. Solves a Cloudflare Turnstile challenge; clicks **Continue to payment**
4. Server inserts a `pending` D1 row, mints a `transaction_reference`, calls Payaza Initiate Checkout, redirects browser to the returned hosted checkout URL
5. Applicant pays on Payaza's hosted page (card details, 3DS handled by Payaza)
6. Payaza redirects to `/apply/return?reference=...`
7. Server calls Payaza Verify Transaction; on `paid`, marks D1 `paid`, mints HMAC magic-link token, sends magic-link email, redirects to `/apply/form?token=...`
8. Form renders; applicant fills text fields; uploads headshot direct-to-R2 via presigned PUT URL; uploads 2-min video the same way (with progress bar)
9. Applicant clicks **Submit application**; server validates required fields, sets `submitted_at`, sends confirmation email + admin notification email
10. `/apply/done` page shows the reference number

### Disqualified branch
Quiz disqualifies → page shows "this cycle isn't a fit, but our criteria evolve" + a single optional email field. Submission writes to `cycle_notifications` table (no payment, no application). Used to email when future cycles open.

### Recovery branch
If the applicant closes the browser before the magic-link email arrives or loses the email, they go to `/apply/recover`, enter email + reference, server re-runs Payaza Verify; if the row is `paid`, resends the magic-link email.

### Failure branches
| Failure | Behavior |
|---|---|
| Payment fails on Payaza | Verify returns `failed`; D1 row marked `failed`; user shown retry CTA |
| Payment pending | One auto-retry verify in 60s; if still pending, user told to use `/apply/recover` |
| Payaza outage during init | Init returns error; user shown "service temporarily unavailable, slot reserved 30 min" message; D1 row stays `pending` |
| Cycle closes mid-form | Token validation fails on cycle close; submit rejected; admin can manually accept |
| Two browsers, same magic link | First submit wins (D1 `WHERE submitted_at IS NULL` guard); second sees 409 |

## 4. Routes & endpoints

### Public pages
| Path | Purpose |
|---|---|
| `/apply` | Eligibility quiz + email + consent + Turnstile + Continue CTA |
| `/apply/return?reference=X` | Server: verify with Payaza, mark paid, send magic link, redirect |
| `/apply/form?token=Y` | Unlocked form: fields + headshot + 2-min video |
| `/apply/done` | Submission confirmation with reference number |
| `/apply/recover` | Email + reference → re-verify → resend magic link |
| `/apply/closed` | Shown when cycle is closed |
| `/privacy` | Privacy Policy (markdown-backed; frontmatter version captured into D1 on consent) |
| `/terms` | Terms (markdown-backed) |
| `/admin/login` | Admin login form |
| `/admin/applications` | Admin list view |
| `/admin/applications/[id]` | Admin detail view |

### API endpoints (Astro `/api/*` server endpoints)
| Endpoint | Method | Auth | Purpose |
|---|---|---|---|
| `/api/checkout/create` | POST | Turnstile + rate limit | Insert `pending` D1 row, call Payaza Init, return checkout URL |
| `/api/checkout/verify` | GET | reference param | Used by `/apply/return` to verify by reference |
| `/api/upload/presign` | POST | Token | Returns presigned R2 PUT URL for headshot or video |
| `/api/applications/draft` | PATCH | Token | Records R2 key on D1 row after each upload |
| `/api/applications/submit` | POST | Token | Final validation, sets `submitted_at`, fires emails |
| `/api/applications/recover` | POST | Rate limit | Email + reference → re-verify → resend magic link |
| `/api/notifications/subscribe` | POST | Rate limit | Disqualified-branch email signup |
| `/api/admin/login` | POST | Password | Mints session cookie + KV session entry |
| `/api/admin/applications` | GET | Session | Paginated list with filters |
| `/api/admin/applications/[id]` | GET | Session | Detail view payload |
| `/api/admin/applications/[id]/status` | PATCH | Session + CSRF | Status update + audit log |
| `/api/admin/applications/[id]/signed-url` | GET | Session | 5-min signed R2 URL for media preview |
| `/api/admin/applications/csv` | GET | Session | Filtered CSV export |

### Source-of-truth principle
**D1 is the single source of truth.** R2 keys live in D1. Apply tokens are stateless HMAC-signed and validated against the D1 row's payment status on every gated request. KV is purely ephemeral (sessions, rate-limit counters).

## 5. Data model

### D1 schema

```sql
CREATE TABLE applications (
  id                       TEXT PRIMARY KEY,                 -- ULID, sortable
  cycle_id                 TEXT NOT NULL,                    -- 'MDGH-2026'
  transaction_reference    TEXT NOT NULL UNIQUE,             -- 'MDGH-2026-XXXXXXXX'
  email                    TEXT NOT NULL,

  -- payment
  payment_status           TEXT NOT NULL DEFAULT 'pending',  -- pending | paid | failed | expired
  payment_amount_cents     INTEGER NOT NULL,                 -- 2599
  payment_currency         TEXT NOT NULL DEFAULT 'USD',
  payaza_transaction_id    TEXT,
  payment_verified_at      TEXT,
  payment_failure_reason   TEXT,

  -- eligibility (audit trail)
  eligibility_age_band         TEXT,                         -- '18-25' | '26-35'
  eligibility_is_woman         INTEGER,                      -- 0/1
  eligibility_african_descent  INTEGER,
  eligibility_outside_ghana    INTEGER,
  eligibility_valid_passport   INTEGER,

  -- consent (with policy version)
  consent_policy_version   TEXT NOT NULL,                    -- 'v1.0'
  consent_recorded_at      TEXT NOT NULL,
  consent_media_use        INTEGER NOT NULL,                 -- explicit 0 or 1
  consent_marketing        INTEGER NOT NULL,                 -- explicit 0 or 1

  -- gating audit
  magic_link_sent_at       TEXT,
  apply_token_issued_at    TEXT,
  email_bounced_at         TEXT,                             -- set by Resend bounce webhook

  -- form data (post-payment)
  full_name                TEXT,
  phone                    TEXT,
  date_of_birth            TEXT,
  country_of_residence     TEXT,
  current_city             TEXT,
  country_of_heritage      TEXT,
  bio                      TEXT,                             -- ≤ 1500 chars (~250 words)
  socials_json             TEXT,                             -- JSON {instagram,tiktok,twitter,linkedin}
  headshot_r2_key          TEXT,
  video_r2_key             TEXT,

  -- submission state
  submitted_at             TEXT,
  status                   TEXT NOT NULL DEFAULT 'new',      -- new | reviewing | shortlisted | rejected
  admin_notes              TEXT,

  -- audit
  created_at               TEXT NOT NULL,
  updated_at               TEXT NOT NULL,
  ip_hash                  TEXT,                             -- SHA-256(ip + IP_HASH_SALT)
  user_agent               TEXT
);

CREATE INDEX idx_app_email           ON applications(email);
CREATE INDEX idx_app_payment_status  ON applications(payment_status);
CREATE INDEX idx_app_status          ON applications(status);
CREATE INDEX idx_app_cycle           ON applications(cycle_id);
CREATE INDEX idx_app_submitted       ON applications(submitted_at);

CREATE TABLE cycles (
  id                       TEXT PRIMARY KEY,                 -- 'MDGH-2026'
  display_name             TEXT NOT NULL,
  application_fee_cents    INTEGER NOT NULL,                 -- 2599
  application_currency     TEXT NOT NULL,                    -- 'USD'
  privacy_policy_version   TEXT NOT NULL,
  applications_open_at     TEXT NOT NULL,
  applications_close_at    TEXT NOT NULL,
  is_active                INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE cycle_notifications (
  id                       TEXT PRIMARY KEY,
  email                    TEXT NOT NULL UNIQUE,
  source                   TEXT NOT NULL,                    -- 'eligibility_disqualified' | 'cycle_closed' | 'manual'
  disqualifying_rule       TEXT,
  consent_recorded_at      TEXT NOT NULL,
  unsubscribed_at          TEXT,
  created_at               TEXT NOT NULL
);

CREATE TABLE admin_audit (
  id                       TEXT PRIMARY KEY,
  admin_email              TEXT NOT NULL,
  action                   TEXT NOT NULL,                    -- 'login' | 'status_change' | 'csv_export' | 'signed_url_issued'
  target_application_id    TEXT,
  details_json             TEXT,
  ip_hash                  TEXT,
  created_at               TEXT NOT NULL
);
```

### R2 layout

Bucket: `mdgh-applications` (production), `mdgh-applications-staging` (preview).

```
cycles/{cycle_id}/{application_id}/headshot.{jpg|png|webp}
cycles/{cycle_id}/{application_id}/intro-video.{mp4|mov|webm}
```

R2 lifecycle policy: incomplete multipart uploads abort after 24 hours.

### KV usage (existing `SESSION` namespace)

| Key pattern | Value | TTL | Purpose |
|---|---|---|---|
| `admin-session:{token}` | `{email, expires_at}` | 4 hr | Admin session |
| `rl:checkout-create:{ip_hash}` | counter | 1 hr | 5/hr/IP |
| `rl:recover:{email_hash}` | counter | 1 hr | 3/hr/email |
| `rl:upload-presign:{token_id}` | counter | 1 hr | 20/hr/token |
| `presign-active:{token}:{file_type}` | r2_key | 15 min | One presign per (token, file_type) at a time |
| `magic-link-sent:{application_id}` | `1` | 24 hr | Prevents duplicate sends |
| `payment_reconciliation_queue:{ref}` | error_payload | 7 d | Failed D1 writes for manual reconciliation |

### Apply token

```
<application_id>.<expiry_unix>.<HMAC-SHA256(APPLY_TOKEN_SECRET, "{application_id}.{expiry_unix}")>
```
base64url-encoded. TTL: 30 days. Stateless validation:
1. Decode + verify HMAC (constant-time)
2. `expiry_unix > now`
3. `application_id` exists in D1 with `payment_status = 'paid'`
4. `submitted_at IS NULL`
5. Cycle is open

## 6. Payment integration

### Approach: Verify-by-Reference (no webhook)

After Payaza redirects post-payment, the server calls Payaza Verify Transaction by reference. No webhook endpoint. Recovery flow handles cases where the redirect doesn't fire. Future upgrade path to webhook + verify (Approach C) preserves the same idempotent D1 schema.

### `PaymentProvider` interface

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

### `PayazaProvider` adapter

Concrete implementation in `src/lib/payment/payaza-provider.ts` calls `${PAYAZA_BASE_URL}/checkout/initiate` and `${PAYAZA_BASE_URL}/transactions/verify/{reference}` with `Authorization: Bearer {PAYAZA_SECRET_KEY}`. **Exact endpoint paths and request/response shapes are TBC against the live Payaza docs at implementation time** — the adapter wraps these so any divergence stays in one file. Implementation reference shape is in Section 3 of the brainstorm conversation.

### `MockProvider` (tests + local dev)

Returns canned `paid` for any reference; references ending in `-FAIL` return `failed`. Local dev exposes `/mock-checkout?reference=X` page that simulates payment and redirects to `/apply/return`.

### `transaction_reference` contract

- Format: `MDGH-{cycle_id_short}-{8 random base32 chars}` → e.g., `MDGH-2026-K7B3D9XQ`
- Generated server-side in `/api/checkout/create` before calling `provider.init()`
- D1 `UNIQUE` constraint; re-roll on collision (32^8 ≈ 1 trillion combinations)
- Sent to Payaza as `reference`; Payaza echoes it on verify; Payaza's own ID lands in `payaza_transaction_id`

### Verify retry rhythm

Cards usually settle synchronously. If verify returns `pending`:
1. Server-side auto-retry once after 60s
2. After two pending responses, user told to use `/apply/recover` later
3. No background polling; `/apply/recover` is the manual path

## 7. Form UX

### `/apply` landing layout

Three sections on a single page:

1. **Eligibility (5 questions):** age band (Under 18 / 18–25 / 26–35 / Over 35), identifies as woman (Yes/No), African or Ghanaian descent (Yes/No), resides outside Ghana (Yes/No), valid passport (Yes/No). Tap-target buttons. Disqualifying answers reveal the soft-rejection branch.
2. **Email:** single field, validated client + server.
3. **Privacy + consent:**
   - Mandatory checkbox: "I have read and agree to the Privacy Policy and Terms" (Privacy/Terms link in new tab)
   - Explicit binary: "May we use your photo and video in promotional materials, social media, and the public finalist gallery?" — Yes / No must be picked
   - Explicit binary: "Would you like to receive cycle updates and future MDGH opportunities by email?" — Yes / No must be picked

**Continue button** disabled until all eligibility questions answered with passing values, valid email, mandatory consent ticked, both opt-ins answered, Turnstile solved. Hover/focus shows the disabling reason.

### `/apply/form` layout (post-payment)

Single scroll page, sectioned cards:
- **About you** (2-col on ≥768px, 1-col below): full name, phone (country code), DOB, country of residence, current city, country of heritage
- **Your story:** bio textarea with character counter `/1500`
- **Socials (optional):** Instagram, TikTok, Twitter, LinkedIn URL
- **Headshot:** drag-drop or browse; JPG/PNG/WEBP; max 10 MB
- **Intro video (up to 2 min):** drag-drop or browse; MP4/MOV/WEBM; max 300 MB; client-side duration check before upload
- **Submit application** button — disabled until required text fields filled and both files uploaded

Top of page shows a green "Payment confirmed; backup link emailed" banner with reference number and cycle close date.

### File upload mechanics

1. User picks/drops file
2. Client-side validation: size limit, MIME type, video duration via `<video>.preload='metadata'`
3. Browser POSTs `/api/upload/presign` with `{ token, fileType, fileName, contentType, sizeBytes }`
4. Server validates token, file constraints, single-presign-per-pair invariant; returns `{ uploadUrl, r2Key }` (15-min TTL)
5. Browser PUTs file directly to R2 via XHR (for upload progress events) — fetch doesn't expose `upload.onprogress` as of 2026-05
6. On 200, browser PATCHes `/api/applications/draft` with `{ token, headshot_r2_key }` or `{ token, video_r2_key }`
7. UI shows green checkmark + filename + Replace button
8. Server schedules an R2 HEAD post-upload to verify size + content-type + magic bytes; mismatches mark the row invalid and prompt re-upload

Resume after browser close: D1-stored R2 keys re-render as "uploaded — replace?" when the user reopens via magic link.

### Email triggers (Resend)

| Trigger | To | Subject | Content |
|---|---|---|---|
| Payment verified `paid` | Applicant | "Your MDGH application link" | Magic link, reference, valid-until date |
| Submission complete | Applicant | "We've received your MDGH application" | Reference, what to expect, retention notice |
| Submission complete | Admin | `[MDGH] New application: {name} ({reference})` | Field summary + R2 link + admin dashboard link |
| Recover requested + verified | Applicant | "Your MDGH application link (resent)" | Same as original magic-link email |

Sender: `applications@missdiasporagh.org`. Verified domain via Resend (SPF, DKIM, DMARC).

## 8. Visual design direction

**Match the live site's existing gold-on-dark theme.** Reuse:

- Tailwind v4 utilities already configured
- Existing global.css patterns (gold `#F8B92F` / `#FFD700`, dark `#1a1a1a` / `#2a2520`, gradient text classes)
- Georgia/serif headlines for display text (`text-heading` class pattern)
- lucide-astro icons (`Sparkles`, `Crown`, `Check`, etc.)
- Glass cards (subtle borders, rgba backgrounds, backdrop-blur)
- Gold gradient buttons with shadow on hover

The form is a self-contained funnel — no need to introduce new fonts or a separate stylesheet. New components live in `src/components/apply/*` and `src/components/admin/*`.

## 9. Security

### Input validation
- Zod (or valibot) schemas at every API endpoint
- Email format + RFC 5321 max length (254)
- Free-text length caps (bio 1500, name 120, etc.)
- Reject control chars, Unicode bidi-overrides, null bytes
- File MIME validation client + server + magic-byte sniff post-upload

### CSP headers (`/apply/*` and `/admin/*`)

```
default-src 'self';
script-src 'self' https://checkout.payaza.africa https://challenges.cloudflare.com;
connect-src 'self' https://api.payaza.africa https://*.r2.cloudflarestorage.com;
img-src 'self' data: https://*.r2.cloudflarestorage.com;
frame-src https://checkout.payaza.africa https://challenges.cloudflare.com;
form-action 'self' https://checkout.payaza.africa;
base-uri 'self';
```
Exact Payaza domains TBC against live docs. Turnstile domain `challenges.cloudflare.com` is fixed.

### Other headers
- `Strict-Transport-Security: max-age=63072000; includeSubDomains; preload`
- `X-Content-Type-Options: nosniff`
- `Referrer-Policy: strict-origin-when-cross-origin`
- `Permissions-Policy: camera=(), microphone=(), geolocation=()`

### CSRF / cross-origin
- State-changing endpoints check `Origin` against production origin OR validate token (magic-link flow)
- SameSite=Lax cookies for admin sessions
- Admin POSTs include CSRF token (KV-stored per session, validated)

### HMAC discipline
- `APPLY_TOKEN_SECRET` and `ADMIN_SESSION_SECRET` are distinct, ≥32-byte random
- Constant-time comparison via `crypto.subtle.verify`
- Tokens never logged (only application_id portion if necessary)

### Bot abuse on `/apply`
- Hidden honeypot field (`name="website"`, tabindex=-1, autocomplete=off); non-empty submissions rejected
- Cloudflare Turnstile on the Continue button; server validates the response token
- KV-backed rate limits: 5 checkout-creates/hr/IP, 3 recovers/hr/email, 20 presigns/hr/token

### Admin auth
- Single shared admin password, bcrypt cost 12, stored in `ADMIN_PASSWORD_HASH` env var
- Session cookie HMAC-signed + KV session entry, 4 hr TTL
- All admin actions logged to `admin_audit`

### File-upload safety
- Presigned PUT TTL: 15 min
- One presign per `(token, file_type)` pair; new presign overwrites previous in KV
- Server-side post-upload R2 HEAD for size + content-type
- R2 objects stored with `content-disposition: attachment` to prevent inline rendering of malicious content

### Privacy/PII
- IPs SHA-256-salted into `ip_hash`; raw IPs never written
- User-agent stored verbatim (low risk)
- Headshot/video R2 URLs never publicly accessible; admin views generate short-lived (5-min) signed URLs
- Logs scrub email + token contents
- Data retention: applications deleted from D1 + R2 3 years post-cycle (manual cleanup script)

## 10. Edge cases (handled by design)

| Case | Behavior |
|---|---|
| Two browsers, same magic link | First submit wins; D1 `WHERE submitted_at IS NULL` guard; second sees 409 |
| Refresh `/apply/return` mid-verify | Verify is idempotent on Payaza side; D1 update is a no-op if already paid; magic-link email rate-limited per `application_id` (24 hr KV) |
| Same email, twice in cycle | Allowed; admin view flags duplicate emails for review |
| Cycle closes mid-form | Token validation checks cycle state; submit rejected; uploads retained for manual override |
| Partial submission (no video) | Submit disabled client-side; server validates required R2 keys; returns 400 |
| Wrong reference attempt | Reference alone insufficient — magic-link token (HMAC-signed) + email both required |
| Payaza outage during init | User shown reservation message; D1 stays `pending`; sweep marks `expired` after 30 min |
| Payaza outage during verify | User shown recovery instructions; `/apply/recover` is the path back |
| R2 upload fails mid-video | Browser retries whole file (no client-side chunking V1); R2 multipart fragments auto-abort after 24 hr |
| Email bounce | Resend bounce webhook sets `email_bounced_at`; admin can manually update + resend |
| D1 write fails during verify | User still gets success; failure pushed to `payment_reconciliation_queue` KV; admin email alert; manual reconciliation |
| Slow mobile data | Pre-upload warning if file > 50 MB |

## 11. Testing strategy

### Unit (vitest)
- HMAC token sign/verify (positive, negative, tampered, expired)
- Eligibility logic — every combination of 5 answers
- `transaction_reference` uniqueness over 10k iterations + format regex
- `MockProvider` covers all branches
- Email template snapshots

### Integration (vitest + miniflare local D1/R2/KV)
- All `/api/*` endpoints, happy + sad paths
- Rate limit behavior
- Token validation edge cases

### E2E (Playwright against `wrangler pages dev`)
- Full happy path, including real file uploads against MockProvider + miniflare R2
- Disqualified path → soft re-engagement signup
- Payment failure → retry → succeed
- Recovery flow
- Admin login → list → detail → status change → CSV export

### Manual one-time live test
- One real USD 1.00 production transaction before cycle opens to validate end-to-end real-money flow

## 12. Implementation milestones

### M0 — Account + infrastructure provisioning (~2–3 tasks)
Payaza account + sandbox keys; Cloudflare D1 + R2 + KV bindings; Resend domain verification; Turnstile keys; all Pages secrets set.

### M1 — Foundation (~8–10 tasks)
D1 migrations; cycle seed; PaymentProvider + PayazaProvider + MockProvider; EmailProvider + ResendProvider + MockEmailProvider; HMAC utils; reference + ULID + ip_hash utils; Zod schemas; unit tests.

### M2 — Public-facing pre-payment flow (~7–9 tasks)
`/apply` landing; `/api/checkout/create`; `/apply/return` + `/api/checkout/verify`; `/apply/closed`; disqualified branch + `/api/notifications/subscribe`; `/privacy` + `/terms` markdown pages; E2E happy + disqualified paths; gold-on-dark styling.

### M3 — Magic-link form + uploads (~8–10 tasks)
`/apply/form` rendering; `/api/upload/presign`; React island uploader; `/api/applications/draft`; `/api/applications/submit`; `/apply/done`; `/apply/recover` + `/api/applications/recover`; server-side post-upload validation; full happy-path E2E with real uploads.

### M4 — Admin layer (~6–7 tasks)
`/admin/login` + `/api/admin/login`; session middleware; `/admin/applications` list; `/admin/applications/[id]` detail; signed-URL endpoint; status update + audit; CSV export; admin E2E.

### M5 — Hardening + go-live (~6–7 tasks)
CSP + security headers; honeypot; rate-limit middleware; Resend bounce webhook; reconciliation queue alerts; finalize legal copy; manual USD 1.00 production test; runbook; data retention cleanup script; production smoke test.

### Dependency graph
```
M0 ──▶ M1 ──┬──▶ M2 ──▶ M3 ──▶ M4 ──┬──▶ M5
            │                       │
            └───────────────────────┘
```

**Total scope:** ~34–46 tasks. M3 and M4 partially parallelizable.

## 13. Open questions / TBC items

1. **Exact Payaza endpoint paths and request/response shapes** — the docs site is JS-rendered and not crawlable; will be confirmed against live docs and one Postman/curl call against sandbox during M0–M1
2. **Does the user already have a Payaza account?** — assumed no until told otherwise; M0 includes account creation
3. **Cycle open/close dates** — to be set in the `cycles` row; user provides during M1
4. **Privacy Policy and Terms content** — placeholder during M0–M1; finalized text supplied by user (with optional legal review) before M5

## 14. Secrets list (Cloudflare Pages env vars)

| Name | Purpose |
|---|---|
| `PAYAZA_PUBLIC_KEY` | Used in checkout init and (if exposed) browser SDK |
| `PAYAZA_SECRET_KEY` | Server-side; auth for Payaza API |
| `PAYAZA_BASE_URL` | `https://api.payaza.africa` (prod) / sandbox URL (preview) |
| `APPLY_TOKEN_SECRET` | HMAC key for magic-link tokens |
| `ADMIN_PASSWORD_HASH` | bcrypt-hashed admin password |
| `ADMIN_SESSION_SECRET` | HMAC key for admin session cookies |
| `IP_HASH_SALT` | Salt for `ip_hash` |
| `RESEND_API_KEY` | Transactional email |
| `R2_ACCESS_KEY_ID` | R2 presigned URL generation |
| `R2_SECRET_ACCESS_KEY` | R2 presigned URL generation |
| `TURNSTILE_SITE_KEY` | Turnstile widget |
| `TURNSTILE_SECRET_KEY` | Turnstile server-side validation |

Plus existing `SESSION` KV binding and to-be-created D1 + R2 bindings.

---

**End of design.** The implementation plan (task-by-task expansion of M0–M5) is the next document, produced via the writing-plans skill.
