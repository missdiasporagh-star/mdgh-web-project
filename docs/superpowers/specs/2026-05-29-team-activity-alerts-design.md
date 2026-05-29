# Team Activity Alerts — Design

**Date:** 2026-05-29
**Status:** Approved (pending spec review)

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

## Templates

Two short internal-facing templates (plain, dashboard-linked):

- **Payment paid:** subject `💰 New paid application — {reference}`; body shows
  email, amount, reference, and a dashboard link.
- **App submitted:** subject `📝 Application submitted — {fullName}`; body shows
  name, reference, and a dashboard link.

## Testing

- `notifyTeam` unit test: correct recipient list, correct template per `kind`.
- Idempotency unit test: second `payment_paid` call for the same `app.id` sends
  nothing (KV guard set).
- Provider test: `to: string[]` is passed through to Resend / recorded by mock.

## Non-goals

- No queue/event-bus (YAGNI for two low-volume events).
- No digest batching (real-time per event; volume is low).
- No change to applicant-facing emails (magic link, confirmation).
