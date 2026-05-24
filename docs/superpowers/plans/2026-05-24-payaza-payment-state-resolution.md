# Payaza Payment-State Resolution Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ensure every Payaza payment outcome resolves correctly — declined/abandoned cards never strand the applicant on "Still confirming", completed payments reconcile server-side (incl. closed-tab) and trigger the magic link, and paid records store the right amount + Payaza transaction id.

**Architecture:** Payaza's transaction-query API is the single source of truth; all paths (return page, webhook, retry) funnel through the existing `runPaymentVerification()`. We (1) correct the provider's field mapping, (2) make the pending view auto-poll then offer retry, and (3) add a token-guarded webhook that re-verifies and reconciles.

**Tech Stack:** Astro 5 (SSR on Cloudflare Workers), TypeScript, vitest, vanilla JS client scripts, D1, KV, Payaza SDK.

**Builds on:** commit `ec05176` (already live) which extracted `classifyPayazaVerifyResult` and fixed not-found → failed. This plan modifies that function further and adds new files.

---

## File Structure

- `src/lib/payment/payaza-provider.ts` — MODIFY: correct field names in `classifyPayazaVerifyResult` + extend `TransactionData`.
- `src/lib/payment/payaza-provider.test.ts` — MODIFY: add real-field-name + `Initialized` cases.
- `src/pages/apply/return.astro` — MODIFY: actionable pending view + load poll/retry scripts.
- `public/scripts/apply-pending.js` — CREATE: auto-poll verify, redirect on paid, reveal retry on exhaustion.
- `src/lib/payment/payaza-webhook.ts` — CREATE: pure helpers `extractMerchantReference` + `verifyWebhookToken`.
- `src/lib/payment/payaza-webhook.test.ts` — CREATE: unit tests for the helpers.
- `src/pages/api/webhooks/payaza.ts` — CREATE: thin POST handler (token → re-verify → 200).
- `src/env.d.ts` — MODIFY: add `PAYAZA_WEBHOOK_TOKEN` to `CloudflareEnv`.

---

## Task 1: Correct Payaza response field mapping

**Files:**
- Modify: `src/lib/payment/payaza-provider.ts`
- Test: `src/lib/payment/payaza-provider.test.ts`

- [ ] **Step 1: Write the failing test**

Add these two cases inside the existing `describe('classifyPayazaVerifyResult', …)` block in `src/lib/payment/payaza-provider.test.ts`:

```ts
  it('maps a real-field-name success (amount_received/transaction_reference) to paid', () => {
    const json = {
      message: 'Transaction data found',
      data: {
        transaction_status: 'Successful',
        amount_received: 25.99,
        currency: 'USD',
        transaction_reference: 'P-C-20260524-UR85J96FOB',
        merchant_transaction_reference: REF,
        current_status_date: '2026-05-24 20:12:00',
      },
    };
    const r = classifyPayazaVerifyResult(true, 200, json, REF);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.status).toBe('paid');
      expect(r.amountCents).toBe(2599);
      expect(r.providerTransactionId).toBe('P-C-20260524-UR85J96FOB');
      expect(r.paidAt).toBe('2026-05-24 20:12:00');
    }
  });

  it('maps "Initialized" (declined/abandoned, not yet advanced) to pending', () => {
    const json = { data: { transaction_status: 'Initialized', amount_received: 1.0 } };
    const r = classifyPayazaVerifyResult(true, 200, json, REF);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.status).toBe('pending');
  });
```

- [ ] **Step 2: Run the test to verify the success case fails**

Run: `npx vitest run src/lib/payment/payaza-provider.test.ts`
Expected: FAIL on "real-field-name success" — `amountCents` is `0` (reads absent `amount`) and `providerTransactionId` is `REF` (reads absent `transaction_id`). The `Initialized` case already passes.

- [ ] **Step 3: Extend the `TransactionData` type**

In `src/lib/payment/payaza-provider.ts`, replace the `TransactionData` type definition with:

```ts
type TransactionData = {
  transaction_id?: string | number;
  id?: string | number;
  transaction_reference?: string;
  merchant_transaction_reference?: string;
  transaction_status?: string;
  status?: string;
  amount?: number | string;
  amount_received?: number | string;
  currency?: string;
  transaction_date?: string;
  paid_at?: string;
  initiated_date?: string;
  current_status_date?: string;
  status_reason?: string;
  payment_channel?: string;
  channel?: string;
};
```

- [ ] **Step 4: Use the real field names in the paid/return mapping**

In `classifyPayazaVerifyResult`, replace the final `return { ok: true, status, … }` object with:

```ts
  return {
    ok: true,
    status,
    providerTransactionId: String(
      data.transaction_reference ?? data.transaction_id ?? data.id ?? reference,
    ),
    amountCents: Math.round(Number(data.amount_received ?? data.amount ?? 0) * 100),
    currency: ((data.currency ?? 'USD') as 'USD' | 'NGN' | 'GHS'),
    paidAt: data.current_status_date ?? data.transaction_date ?? data.paid_at ?? data.initiated_date,
    paymentMethod: data.payment_channel ?? data.channel,
    raw: json,
  };
```

- [ ] **Step 5: Run the full test file to verify all pass**

Run: `npx vitest run src/lib/payment/payaza-provider.test.ts`
Expected: PASS (13 tests).

- [ ] **Step 6: Commit**

```bash
git add src/lib/payment/payaza-provider.ts src/lib/payment/payaza-provider.test.ts
git commit -m "fix(payment): map Payaza amount_received/transaction_reference fields"
```

---

## Task 2: Actionable pending view (auto-poll + retry fallback)

**Files:**
- Create: `public/scripts/apply-pending.js`
- Modify: `src/pages/apply/return.astro`

- [ ] **Step 1: Create the polling script**

Create `public/scripts/apply-pending.js`:

```js
// Pending-state resolver for /apply/return. Polls the verify endpoint a few
// times so a slow-but-real payment resolves and redirects hands-free. If it
// never resolves, reveals the retry/recheck controls so the applicant is never
// stranded. Never auto-fails a pending payment (no double-charge risk).
const card = document.querySelector('[data-pending-card]');
if (card) {
  const reference = card.getAttribute('data-reference');
  const actions = document.getElementById('pending-actions');
  const heading = document.getElementById('pending-heading');
  const msg = document.getElementById('pending-msg');
  const recheckBtn = document.getElementById('recheck-btn');

  const MAX_ATTEMPTS = 6;
  const INTERVAL_MS = 4000;
  let attempts = 0;
  let polling = true;

  async function checkOnce() {
    try {
      const res = await fetch(
        `/api/checkout/verify?reference=${encodeURIComponent(reference)}&_cb=${Date.now()}`,
      );
      if (res.status === 429) return 'stop';
      const json = await res.json();
      if (json.ok && json.status === 'paid' && json.token) {
        window.location.href = `/apply/form?token=${encodeURIComponent(json.token)}`;
        return 'done';
      }
      if (json.ok && json.status === 'failed') return 'stop';
      return 'pending';
    } catch (e) {
      return 'stop';
    }
  }

  function reveal() {
    polling = false;
    if (heading) heading.textContent = "We couldn't confirm your payment yet.";
    if (msg) msg.style.display = 'none';
    if (actions) actions.style.display = 'block';
  }

  async function poll() {
    while (polling && attempts < MAX_ATTEMPTS) {
      attempts++;
      const result = await checkOnce();
      if (result === 'done') return;
      if (result === 'stop') { reveal(); return; }
      if (attempts >= MAX_ATTEMPTS) { reveal(); return; }
      await new Promise((r) => setTimeout(r, INTERVAL_MS));
    }
  }

  if (recheckBtn) {
    recheckBtn.addEventListener('click', async () => {
      recheckBtn.disabled = true;
      recheckBtn.textContent = 'Checking…';
      const result = await checkOnce();
      if (result !== 'done') {
        recheckBtn.disabled = false;
        recheckBtn.textContent = 'Check again';
      }
    });
  }

  poll();
}
```

- [ ] **Step 2: Replace the pending view markup in `return.astro`**

In `src/pages/apply/return.astro`, replace the entire `{view === 'pending' && ( … )}` block with:

```astro
    {view === 'pending' && (
      <div class="card" style="border-left:3px solid #FFD166" data-pending-card data-reference={reference}>
        <div class="label" style="color:#FFD166">Confirming your payment…</div>
        <h2 style="margin:8px 0" id="pending-heading">We're checking with the payment provider.</h2>
        <p class="muted" id="pending-msg">This only takes a few seconds — please keep this page open.</p>

        <!-- Revealed by apply-pending.js once auto-checks are exhausted without
             resolving. Reuses apply-retry.js via the data-retry-card hook. -->
        <div id="pending-actions" data-retry-card data-reference={reference} style="display:none;margin-top:16px">
          <p class="muted" style="margin-bottom:12px">We haven't received confirmation of your payment yet. If it didn't go through, you can try again — you won't be charged twice.</p>
          <button type="button" id="retry-btn" class="btn" style="width:100%">Retry payment</button>
          <button type="button" id="recheck-btn" class="btn-ghost" style="width:100%;margin-top:10px">Check again</button>
          <p id="retry-err" class="err" style="display:none;margin-top:10px"></p>
          <p class="muted" style="font-size:12px;margin-top:14px;text-align:center">Already paid? Use the <a href="/apply/recover" style="color:#F8B92F">recover form</a> with reference <code style="color:#F8B92F">{reference}</code>.</p>
        </div>
      </div>
    )}
```

- [ ] **Step 3: Load the scripts for the pending view**

In `src/pages/apply/return.astro`, replace the trailing script block:

```astro
  {view === 'failed' && (
    <script src="https://checkout-v2.payaza.africa/js/v1/bundle.js" defer></script>
    <script type="module" src="/scripts/apply-retry.js"></script>
  )}
```

with:

```astro
  {(view === 'failed' || view === 'pending') && (
    <script src="https://checkout-v2.payaza.africa/js/v1/bundle.js" defer></script>
    <script type="module" src="/scripts/apply-retry.js"></script>
  )}
  {view === 'pending' && (
    <script type="module" src="/scripts/apply-pending.js"></script>
  )}
```

- [ ] **Step 4: Type-check the change**

Run: `npx astro check 2>&1 | grep -i "return.astro" || echo "no return.astro type errors"`
Expected: `no return.astro type errors` (the pre-existing inline-`<script>` hint on the Payaza bundle line is acceptable and already present).

- [ ] **Step 5: Build to confirm it compiles**

Run: `npm run build 2>&1 | tail -3`
Expected: `[build] Complete!`

- [ ] **Step 6: Commit**

```bash
git add public/scripts/apply-pending.js src/pages/apply/return.astro
git commit -m "feat(apply): auto-poll + retry fallback on the payment pending view"
```

---

## Task 3: Payaza webhook helpers (pure, tested)

**Files:**
- Create: `src/lib/payment/payaza-webhook.ts`
- Test: `src/lib/payment/payaza-webhook.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/lib/payment/payaza-webhook.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { extractMerchantReference, verifyWebhookToken } from './payaza-webhook';

describe('extractMerchantReference', () => {
  it('reads top-level merchant_transaction_reference', () => {
    expect(extractMerchantReference({ merchant_transaction_reference: 'MDGH-2026-AAA' })).toBe('MDGH-2026-AAA');
  });
  it('reads nested data.merchant_transaction_reference', () => {
    expect(extractMerchantReference({ data: { merchant_transaction_reference: 'MDGH-2026-BBB' } })).toBe('MDGH-2026-BBB');
  });
  it('reads merchant_reference fallback', () => {
    expect(extractMerchantReference({ data: { merchant_reference: 'MDGH-2026-CCC' } })).toBe('MDGH-2026-CCC');
  });
  it('returns null when no reference present', () => {
    expect(extractMerchantReference({ message: 'hello' })).toBeNull();
    expect(extractMerchantReference(null)).toBeNull();
    expect(extractMerchantReference('nope')).toBeNull();
  });
});

describe('verifyWebhookToken', () => {
  it('accepts an exact match', () => {
    expect(verifyWebhookToken('s3cr3t-token', 's3cr3t-token')).toBe(true);
  });
  it('rejects mismatch, empty, and length differences', () => {
    expect(verifyWebhookToken('s3cr3t-token', 'wrong')).toBe(false);
    expect(verifyWebhookToken('', 's3cr3t-token')).toBe(false);
    expect(verifyWebhookToken('s3cr3t-token', '')).toBe(false);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/lib/payment/payaza-webhook.test.ts`
Expected: FAIL — `Failed to resolve import './payaza-webhook'`.

- [ ] **Step 3: Implement the helpers**

Create `src/lib/payment/payaza-webhook.ts`:

```ts
/**
 * Pure helpers for the Payaza collection webhook. Kept out of the route file so
 * they can be unit-tested without the Astro/Worker request harness.
 */

/** Extract our merchant reference (MDGH-YYYY-XXXXXXXX) from a webhook body. */
export function extractMerchantReference(body: unknown): string | null {
  if (typeof body !== 'object' || body === null) return null;
  const b = body as Record<string, unknown>;
  const data = (b.data && typeof b.data === 'object' ? (b.data as Record<string, unknown>) : {}) ?? {};
  const candidates = [
    b.merchant_transaction_reference,
    b.merchant_reference,
    data.merchant_transaction_reference,
    data.merchant_reference,
  ];
  for (const c of candidates) {
    if (typeof c === 'string' && c.length > 0) return c;
  }
  return null;
}

/** Constant-time token comparison. */
export function verifyWebhookToken(provided: string, expected: string): boolean {
  if (!expected || provided.length !== expected.length) return false;
  let mismatch = 0;
  for (let i = 0; i < expected.length; i++) {
    mismatch |= provided.charCodeAt(i) ^ expected.charCodeAt(i);
  }
  return mismatch === 0;
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/lib/payment/payaza-webhook.test.ts`
Expected: PASS (6 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/payment/payaza-webhook.ts src/lib/payment/payaza-webhook.test.ts
git commit -m "feat(payment): Payaza webhook helpers (reference extraction + token check)"
```

---

## Task 4: Webhook route + env type

**Files:**
- Modify: `src/env.d.ts`
- Create: `src/pages/api/webhooks/payaza.ts`

- [ ] **Step 1: Add the secret to the env type**

In `src/env.d.ts`, add this line inside `type CloudflareEnv = { … }` after the `PAYAZA_SECRET_KEY` line:

```ts
  PAYAZA_WEBHOOK_TOKEN: string;
```

- [ ] **Step 2: Create the webhook route**

Create `src/pages/api/webhooks/payaza.ts`:

```ts
import type { APIRoute } from 'astro';
import { runPaymentVerification } from '@/lib/payment/verify-flow';
import { extractMerchantReference, verifyWebhookToken } from '@/lib/payment/payaza-webhook';
import { hashIp } from '@/lib/crypto/hash';
import { checkRateLimit } from '@/lib/ratelimit/kv-limiter';

export const prerender = false;

// Payaza posts collection notifications here. We do NOT trust the payload:
// after extracting our merchant reference we re-query Payaza authoritatively via
// runPaymentVerification(), which marks paid/failed and sends the magic-link
// email idempotently. The URL token + IP rate-limit just stop strangers from
// triggering lookups. Always returns 200 (except auth) so Payaza doesn't
// retry-storm.
export const POST: APIRoute = async ({ request, locals, clientAddress }) => {
  const env = locals.runtime.env;
  const url = new URL(request.url);

  const token = url.searchParams.get('t') ?? '';
  if (!verifyWebhookToken(token, env.PAYAZA_WEBHOOK_TOKEN ?? '')) {
    return new Response('Unauthorized', { status: 401 });
  }

  const ipHash = await hashIp(clientAddress ?? 'unknown', env.IP_HASH_SALT);
  const rl = await checkRateLimit(env.KV, `rl:payaza-webhook:${ipHash}`, 120, 3600);
  if (!rl.allowed) return j({ ok: true, throttled: true });

  let body: unknown;
  try { body = await request.json(); } catch { return j({ ok: true, ignored: 'bad_json' }); }

  const reference = extractMerchantReference(body);
  if (!reference) return j({ ok: true, ignored: 'no_reference' });

  try {
    const outcome = await runPaymentVerification(env, reference, url.origin);
    return j({ ok: true, status: outcome.ok ? outcome.status : 'error' });
  } catch (e) {
    console.error('[payaza.webhook] verification error:', e instanceof Error ? e.message : String(e));
    return j({ ok: true, error: 'verification_failed' });
  }
};

function j(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}
```

- [ ] **Step 3: Type-check + build**

Run: `npx astro check 2>&1 | grep -iE "webhooks/payaza|payaza-webhook" || echo "no webhook type errors"`
Expected: `no webhook type errors`.

Run: `npm run build 2>&1 | tail -3`
Expected: `[build] Complete!`

- [ ] **Step 4: Run the whole unit suite (no regressions in payment files)**

Run: `npx vitest run src/lib/payment/ 2>&1 | tail -6`
Expected: all payment-suite tests pass (Task 1 + Task 3 files).

- [ ] **Step 5: Commit**

```bash
git add src/env.d.ts src/pages/api/webhooks/payaza.ts
git commit -m "feat(api): Payaza collection webhook (token-guarded, re-verifies, idempotent)"
```

---

## Task 5: Deploy + operator steps + live verification

**Files:** none (operational).

- [ ] **Step 1: Set the webhook secret (operator, own terminal)**

```
npx wrangler secret put PAYAZA_WEBHOOK_TOKEN --name mdgh-web-project
# paste a long random value (e.g. `openssl rand -hex 24`) at the hidden prompt
```

- [ ] **Step 2: Push to deploy**

```bash
git push origin main
```

Then watch the deploy: `gh run watch $(gh run list --workflow=deploy.yml --limit 1 --json databaseId -q '.[0].databaseId') --exit-status`
Expected: deploy succeeds.

- [ ] **Step 3: Register the webhook URL in Payaza**

Operator: Payaza dashboard → Collection → Live Webhook URL →
`https://apply.missdiasporagh.org/api/webhooks/payaza?t=<the-token-from-step-1>` → Update Webhooks.

- [ ] **Step 4: Smoke-test the webhook auth + reconcile path**

Wrong token must 401:
```
curl -s -o /dev/null -w "%{http_code}\n" -X POST "https://apply.missdiasporagh.org/api/webhooks/payaza?t=wrong" -H "Content-Type: application/json" -d "{}"
```
Expected: `401`.

Valid token, known reference (re-verifies via Payaza):
```
curl -s -X POST "https://apply.missdiasporagh.org/api/webhooks/payaza?t=<token>" -H "Content-Type: application/json" -d "{\"merchant_transaction_reference\":\"MDGH-2026-E8BT6FGY\"}"
```
Expected: `{"ok":true,"status":"pending"}` (that test txn is still `Initialized`).

- [ ] **Step 5: Restore the production fee**

```
npx wrangler d1 execute mdgh-applications-db --remote --command "UPDATE cycles SET application_fee_cents = 2599 WHERE id = 'MDGH-2026'; SELECT application_fee_cents FROM cycles WHERE id = 'MDGH-2026';"
```
Expected: `application_fee_cents: 2599`.

- [ ] **Step 6: Live retest (operator, funded card)**

Run the live apply flow with a card that has real headroom. Confirm: Payaza page shows **Live**, charge posts, `/apply/return` redirects to the form (or resolves via poll), magic-link email arrives. Then refund the charge from the Payaza dashboard.

- [ ] **Step 7: Update project memory**

Record in memory: Payaza status vocabulary (`Initialized` for incomplete card payments, `Successful`/`Failed` terminal), confirmed field names (`amount_received`, `transaction_reference`, `merchant_transaction_reference`), the webhook endpoint + token, and that the live fee was restored to $25.99.

---

## Self-Review

**Spec coverage:**
- Part 1 (webhook) → Tasks 3 + 4 (+ register/secret in Task 5). ✓
- Part 2 (actionable pending view) → Task 2. ✓
- Part 3 (field-name fix) → Task 1. ✓
- "we'll email you" made true → webhook calls `runPaymentVerification` which sends the magic link. ✓
- No auto-failure / no double-charge → pending view only reveals retry; never reclassifies. ✓
- Restore fee + live retest → Task 5 steps 5–6. ✓

**Placeholder scan:** `<token>` and `<the-token-from-step-1>` are intentional secret references (the operator supplies the real value via `wrangler secret put`); no code placeholders remain.

**Type consistency:** `classifyPayazaVerifyResult(httpOk, httpStatus, json, reference)` and `runPaymentVerification(env, reference, baseUrl)` signatures match their definitions; `extractMerchantReference`/`verifyWebhookToken` names match between `payaza-webhook.ts`, its test, and the route; `PAYAZA_WEBHOOK_TOKEN` added to `CloudflareEnv` matches its use in the route.

**Note on tests:** the repo has 6 pre-existing integration-test failures (stale mocks) unrelated to this work — do not treat them as regressions. Use the per-file `vitest run` commands above to validate this plan's tests.
