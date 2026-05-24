# Payaza Payment-State Resolution — Design

**Date:** 2026-05-24
**Status:** Approved for planning
**Author:** Claude (Opus 4.7) with ohwpstudios@gmail.com

## Problem

Live testing surfaced that a declined/abandoned card leaves the Payaza
transaction stuck at status `"Initialized"` (confirmed from a live
transaction-query capture — Payaza creates the transaction when checkout opens
but never advances it to `Successful`/`Failed` if the card payment doesn't
complete). Our provider correctly classifies `"Initialized"` as in-flight →
`pending`, but three gaps follow:

1. **Dead-end pending view.** `src/pages/apply/return.astro` renders a static
   "Still confirming… up to 5 minutes. We'll email you the moment it confirms"
   screen for `pending`, with no polling and no escape hatch. A declined card
   that never advances strands the applicant forever, and the "we'll email you"
   promise is currently empty (nothing reconciles server-side).

2. **No server-side reconciliation.** Verification only runs when the applicant
   lands on `/apply/return`. If they close the tab after paying — or the payment
   completes asynchronously — nothing updates the row or sends the magic link.

3. **Field-name mismatch.** The parser in `src/lib/payment/payaza-provider.ts`
   reads `amount`/`transaction_id`, but Payaza's real response uses
   `amount_received`/`transaction_reference`. Paid records therefore store
   `amountCents: 0` and fall back to our own reference instead of Payaza's
   transaction id.

### Confirmed Payaza transaction-query response shape (live, 2026-05-24)

```json
{
  "message": "Transaction data found",
  "data": {
    "transaction_reference": "P-C-20260524-UR85J96FOB",
    "amount_received": 1.00,
    "transaction_fee": 0.00,
    "transaction_status": "Initialized",
    "sender_name": null,
    "sender_account_number": null,
    "source_bank_name": "NA",
    "initiated_date": "2026-05-24 20:10:44.371022",
    "current_status_date": null,
    "currency": "USD",
    "session_id": "",
    "merchant_transaction_reference": "MDGH-2026-E8BT6FGY",
    "transaction_type": null,
    "virtual_account_number": null,
    "status_reason": null
  },
  "success": true
}
```

## Goals

- A declined/abandoned payment never strands the applicant on "Still confirming".
- A payment that completes (synchronously, slowly, or after the tab closes) is
  reconciled server-side and triggers the magic-link email.
- Paid records store the correct amount and Payaza transaction id.
- No double-charge risk: never auto-reclassify an in-flight status as failed;
  the applicant explicitly chooses to retry.

## Non-goals

- Reworking the SDK init / checkout flow (it works).
- Mobile-money / multi-currency (production stays USD/card).
- Implementing Payaza's documented webhook signature scheme (undocumented;
  re-verification makes the payload untrusted, so a URL secret + rate limit is
  sufficient — revisit if Payaza publishes a signature scheme).
- Cleaning up the pre-existing broken integration tests / `astro check` errors
  (tracked separately).

## Unifying principle

Payaza's transaction-query API is the single source of truth. Every entry point
(return page, webhook, retry) funnels through the existing
`runPaymentVerification(env, reference, baseUrl)` in
`src/lib/payment/verify-flow.ts`, which re-queries Payaza, marks paid/failed,
and sends the magic link idempotently (KV guard `magic-link-sent:{id}` + the
SQL guard on `markPaymentPaid`). Nothing trusts a webhook body or a client.

---

## Part 1 — Webhook handler

**New file:** `src/pages/api/webhooks/payaza.ts` (POST, `prerender = false`).

**Flow:**
1. Validate a secret token in the request URL (`?t=<token>`) against a new
   `PAYAZA_WEBHOOK_TOKEN` Worker secret using a constant-time comparison.
   Reject with 401 on mismatch.
2. Parse the JSON body; defensively extract the merchant reference from the
   likely fields (`merchant_transaction_reference`, `data.merchant_transaction_reference`,
   `merchant_reference`, `data.merchant_reference`). If none found → 200
   `{ ok: true, ignored: true }`.
3. Call `runPaymentVerification(env, reference, baseUrl)` where `baseUrl` is the
   public site origin (`https://apply.missdiasporagh.org`) so the magic link is
   absolute and correct.
4. Always return **200** (even for unknown refs or non-terminal statuses) so
   Payaza does not retry-storm. Log anomalies for observability.

**Auth rationale:** the payload is untrusted because step 3 re-queries Payaza
authoritatively — a forged call cannot fake `paid`. The URL token + the existing
KV rate-limit helper guard against strangers triggering lookups.

**Idempotency:** `runPaymentVerification` short-circuits when the row is already
`paid`; `markPaymentPaid` is SQL-guarded (`WHERE payment_status != 'paid'`); the
magic-link send is KV-guarded. Duplicate Payaza deliveries are safe.

**Email-on-confirm:** because reconciliation runs through
`runPaymentVerification`, a webhook that confirms a payment **sends the
magic-link email** (idempotent with any return-page send). This is the point of
the feature — the closed-tab applicant still receives their link.

**Manual steps (operator):**
- Mint the token and set it: `wrangler secret put PAYAZA_WEBHOOK_TOKEN --name mdgh-web-project`.
- Register `https://apply.missdiasporagh.org/api/webhooks/payaza?t=<token>` in
  Payaza dashboard → Collection → Live Webhook URL.

## Part 2 — Actionable pending view

**Files:** `src/pages/apply/return.astro`, new `public/scripts/apply-pending.js`.

**Behavior:**
- When the SSR verification returns `pending`, render the pending card AND load
  a client script that polls `GET /api/checkout/verify?reference=<ref>` every
  **4 seconds, up to 6 attempts** (~24s total, within the 30/IP/hr verify cap).
- On a poll returning `status: 'paid'` with a token → redirect to
  `/apply/form?token=<token>`. (The verify endpoint already returns the token on
  paid; confirm it is included in the JSON for the polled response.)
- After attempts exhaust without resolution, reveal **actionable controls**:
  "Retry payment" (reuse the existing `public/scripts/apply-retry.js` flow,
  loading the Payaza bundle) and a manual "Check again" button.
- Copy updates: while polling, "Confirming your payment…"; on exhaustion,
  "We haven't received confirmation yet" + the retry/check-again actions +
  the recover-form link with the reference.

**No auto-failure:** the view never reclassifies `pending` as failed; the
applicant decides to retry → no double-charge.

## Part 3 — Field-name correctness

**Files:** `src/lib/payment/payaza-provider.ts`, `src/lib/payment/payaza-provider.test.ts`.

In `classifyPayazaVerifyResult` (and `TransactionData`):
- `providerTransactionId` ← `transaction_reference` (fallback `transaction_id`,
  `id`, then our `reference`).
- `amountCents` ← `Math.round(Number(amount_received ?? amount ?? 0) * 100)`.
- `paidAt` ← `current_status_date ?? transaction_date ?? paid_at ?? initiated_date`.
- failure reason surfaced from `status_reason` where available.
- Status mapping unchanged in spirit: `includes('success')` → paid (covers
  `Successful`); broadened failure substrings → failed; `Initialized` /
  `Processing` / `Pending` / empty-with-data handled as today
  (`Initialized`/`Processing`/`Pending` → pending; empty status with a present
  txn object → failed). Add explicit tests using the real field names and the
  `Initialized` value.

---

## Data flow

```
Applicant pays ──> Payaza checkout page ──┬─ completes ─> SDK callback ─> /apply/return (SSR verify)
                                          │                                   │ pending? -> client poll (Part 2)
                                          │                                   │ paid?    -> redirect to form
                                          └─ tab closed / async ─> Payaza ─POST─> /api/webhooks/payaza (Part 1)
                                                                                    │ token ok -> runPaymentVerification
                                                                                    │ paid -> mark + email magic link
```

## Error handling

- Webhook: malformed body or missing ref → 200 ignored. `runPaymentVerification`
  error → still 200 (logged); Payaza may redeliver, which is safe.
- Pending poll: network error or 429 → stop polling, reveal manual controls.
- Verify provider network error → existing `ok:false` path → return page `error`
  view (unchanged).

## Testing

- Unit (`payaza-provider.test.ts`): real-field-name success → paid with correct
  `amountCents`/`providerTransactionId`; `Initialized`/`Processing` → pending;
  failure statuses → failed; not-found shapes → failed; http error → error.
- Webhook handler: token mismatch → 401; valid token + ref → invokes
  verification and returns 200; missing ref → 200 ignored. (Pure extraction of
  the reference-parsing + a thin handler test; reuse the project's vitest setup.)
- Manual: live retest with a funded card → confirm paid → magic link → form;
  simulate a webhook POST with the token → confirm reconciliation + email.

## Security

- `PAYAZA_WEBHOOK_TOKEN` is a secret, only in the registered URL (never logged).
- Constant-time token comparison.
- Webhook reuses the KV rate-limiter keyed by IP hash.
- Re-verification means no payload field is trusted for money decisions.

## Rollout

1. Land Part 3 (provider field fix + tests) — pure, low-risk.
2. Land Part 2 (pending poll + retry fallback).
3. Land Part 1 (webhook), set `PAYAZA_WEBHOOK_TOKEN`, register the URL.
4. Restore the live cycle fee from $1.00 back to $25.99 once testing concludes.
5. Live retest with a funded card.

## Open follow-ups (not in this scope)

- Repair the stale integration tests + `astro check` errors.
- Add Payaza's documented webhook signature verification if/when published.
- Resend bounce webhook Svix verification (separate parked item).
