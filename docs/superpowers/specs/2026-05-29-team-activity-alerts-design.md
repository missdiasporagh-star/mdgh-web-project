# Team Activity Alerts + Email Taxonomy — Design

**Date:** 2026-05-29
**Status:** Approved (updated 2026-05-29 to add email labeling/tagging)

## Goal

Email the MDGH team whenever a high-value site activity happens, so no paying
applicant goes unnoticed. Alerts go to **both**:

- `missdiasporagh@gmail.com`
- `info@missdiasporagh.org`

## Scope

### In scope — the two high-value events (neither currently alerts anyone)

1. **Payment succeeded** — an applicant completes the application-fee payment.
   Today this fires *no* alert to anyone.
2. **Long-form application submitted** — an applicant finishes the full
   application form. Today this emails `applications@missdiasporagh.org` only.

### Explicitly out of scope (deferred, easy to add later)

- Payment initiated / retry attempts (noisy — fires before money moves)
- Payment failed / abandoned (friction signal; can add to `notifyTeam` later)
- File/media uploads (several per applicant — noisy)
- Newsletter subscribe
- Admin/security events (login, CSV export, status change) — a separate
  security-log concern, not a business inbox
- Contact form (already emails `info@` today — left unchanged)

## Architecture

### Centralized helper: `notifyTeam(env, event)`

A single function in `src/lib/email/` is the one place that knows the team
recipient list and the alert templates. Both event points call it. Rationale:
two call sites today (more likely later) — centralizing avoids copy-pasted
`email.send(...)` and keeps recipients in one spot.

```
TEAM_NOTIFY = ['missdiasporagh@gmail.com', 'info@missdiasporagh.org']
```

A constant, matching how the codebase already hardcodes `info@` /
`applications@`. Trivially promotable to an env var later if recipients need to
change without a deploy.

`event` is a small discriminated union, e.g.:

```ts
type TeamAlertEvent =
  | { kind: 'payment_paid'; reference: string; email: string; amountLabel: string; dashboardUrl: string }
  | { kind: 'application_submitted'; fullName: string; reference: string; dashboardUrl: string };
```

### Hook points

- **Payment succeeded** → inside `runPaymentVerification()`
  (`src/lib/payment/verify-flow.ts`), immediately after `markPaymentPaid(...)`.
  This is the single choke point reached by **both** the return-page poller
  (`/apply/return`) and the Payaza webhook (`/api/webhooks/payaza`), so the
  alert fires exactly once regardless of which path confirms the payment.
- **Application submitted** → `src/pages/api/applications/submit.ts`, alongside
  the existing `applications@` admin notification, which is **kept**.

### Idempotency

`runPaymentVerification` can run multiple times for one payment (poller retries
+ webhook delivery). The alert is guarded by a KV key
`team-notified-paid:${app.id}` (mirroring the existing `magic-link-sent:${app.id}`
guard), so the team receives **exactly one** "paid" alert per applicant.

The `application_submitted` path fires once per submission and needs no extra
guard beyond the existing submission flow.

### Delivery & failure handling

- One email per event, with both addresses in the `to` array.
- Sent from the existing `applications@missdiasporagh.org` sender — no new
  domain/sender setup.
- **Fire-and-forget**: the `notifyTeam` call is `.catch(() => null)`-wrapped,
  exactly like the current admin notification. An alert failure must NEVER block
  a payment confirmation or an application submission.

### Required infra change

`EmailMessage.to` is currently typed `string`. Widen to `string | string[]` and
update the Resend provider to pass the value through as-is (Resend accepts a
`to` array). The mock provider records all recipients.

## Email taxonomy (labeling + tagging)

Every outbound email is classified by a single `EmailCategory`, giving the team
a consistent way to differentiate mail. Two layers:

1. **Machine-readable — on EVERY email** (team- and applicant-facing alike):
   - Custom header `X-MDGH-Category: <category>`
   - Resend tag `tags: [{ name: 'category', value: '<category>' }]`
   This powers Resend-dashboard analytics and lets the team build Gmail filters
   that auto-label/route, without affecting how the email reads.

2. **Visible subject tag — TEAM-facing emails only:**
   A prefix like `[MDGH 💰 Payment] …`. Applicant-facing emails (magic link,
   confirmation, recovery) keep clean, professional subjects (no bracket tag) —
   the team never receives those anyway, and bracket tags can hurt deliverability.

### Category map

| Category | Audience | Subject tag prefix |
|---|---|---|
| `payment_paid` | team | `[MDGH 💰 Payment]` |
| `application_submitted` | team | `[MDGH 📝 Application]` |
| `contact_message` | team | `[MDGH ✉️ Contact]` |
| `magic_link` | applicant | _(none)_ |
| `applicant_confirmation` | applicant | _(none)_ |
| `application_recovery` | applicant | _(none)_ |

### Single source of truth: `src/lib/email/taxonomy.ts`

```ts
export type EmailCategory =
  | 'payment_paid' | 'application_submitted' | 'contact_message'
  | 'magic_link' | 'applicant_confirmation' | 'application_recovery';

type CategoryMeta = { teamFacing: boolean; subjectTag: string | null };

export const CATEGORY_META: Record<EmailCategory, CategoryMeta> = {
  payment_paid:           { teamFacing: true,  subjectTag: '[MDGH 💰 Payment]' },
  application_submitted:  { teamFacing: true,  subjectTag: '[MDGH 📝 Application]' },
  contact_message:        { teamFacing: true,  subjectTag: '[MDGH ✉️ Contact]' },
  magic_link:             { teamFacing: false, subjectTag: null },
  applicant_confirmation: { teamFacing: false, subjectTag: null },
  application_recovery:   { teamFacing: false, subjectTag: null },
};

// Prefix team-facing subjects; leave applicant subjects untouched.
export function applySubjectTag(category: EmailCategory, subject: string): string {
  const tag = CATEGORY_META[category].subjectTag;
  return tag ? `${tag} ${subject}` : subject;
}
```

### How it threads through

- `EmailMessage` gains a required `category: EmailCategory` field (plus the
  `to: string | string[]` widening already noted above).
- Each `render*` template returns its `category`, and applies its own subject
  tag via `applySubjectTag` (so the tagged subject is what ships).
- The **Resend provider** reads `msg.category` and sets `headers` + `tags`
  generically — one place, every email covered.
- The **mock provider** records `category` and `to[]` for assertions.

This way "add a new email type" = add one entry to `CATEGORY_META` and set the
category on the message; tagging is automatic.

## Templates

Two short internal-facing templates (plain, dashboard-linked):

- **Payment paid:** subject `💰 New paid application — {reference}`; body shows
  email, amount, reference, and a dashboard link.
- **App submitted:** subject `📝 Application submitted — {fullName}`; body shows
  name, reference, and a dashboard link.

## Testing

- `applySubjectTag` unit test: team categories get prefixed; applicant
  categories returned unchanged.
- `notifyTeam` unit test: correct recipient list, correct category + tagged
  subject per `kind`.
- Idempotency unit test: second `payment_paid` call for the same `app.id` sends
  nothing (KV guard set).
- Provider test: `to: string[]` passed through; `X-MDGH-Category` header and
  `tags` set from `category` (Resend) / recorded (mock).

## Non-goals

- No queue/event-bus (YAGNI for two low-volume events).
- No digest batching (real-time per event; volume is low).
- No change to applicant-facing emails (magic link, confirmation).
