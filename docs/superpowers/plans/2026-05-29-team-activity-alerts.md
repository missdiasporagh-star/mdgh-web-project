# Team Activity Alerts + Email Taxonomy Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Email the team (`missdiasporagh@gmail.com` + `info@missdiasporagh.org`) on payment-success and application-submission, and give every outbound email a consistent machine tag (header + Resend tag) plus a visible subject tag on team-facing mail.

**Architecture:** A single `taxonomy.ts` is the source of truth for email categories. `EmailMessage` carries a required `category`; the Resend provider turns that into an `X-MDGH-Category` header + Resend `tags` on every send; templates apply visible subject prefixes for team-facing categories. A new `notifyTeam(env, event)` helper owns team recipient lists and the two alert sends, with a KV idempotency guard on payment alerts (which fire from both the return-page poller and the webhook).

**Tech Stack:** TypeScript (strict), Astro API routes on Cloudflare Workers, Resend email API, Cloudflare KV, Vitest.

**Test command:** `npx vitest run <file>` for one file; `npm test` for all. Tests are colocated next to source (e.g. `src/lib/email/taxonomy.test.ts`), matching `src/lib/payment/*.test.ts`.

---

### Task 1: Email taxonomy module

**Files:**
- Create: `src/lib/email/taxonomy.ts`
- Test: `src/lib/email/taxonomy.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// src/lib/email/taxonomy.test.ts
import { describe, it, expect } from 'vitest';
import { applySubjectTag, CATEGORY_META } from './taxonomy';

describe('applySubjectTag', () => {
  it('prefixes team-facing categories', () => {
    expect(applySubjectTag('payment_paid', 'New paid application — REF1'))
      .toBe('[MDGH 💰 Payment] New paid application — REF1');
    expect(applySubjectTag('contact_message', 'Hello'))
      .toBe('[MDGH ✉️ Contact] Hello');
  });

  it('leaves applicant-facing categories untouched', () => {
    expect(applySubjectTag('magic_link', 'Your MDGH application link'))
      .toBe('Your MDGH application link');
    expect(applySubjectTag('applicant_confirmation', "We've received your MDGH application"))
      .toBe("We've received your MDGH application");
  });

  it('marks team vs applicant audience correctly', () => {
    expect(CATEGORY_META.payment_paid.teamFacing).toBe(true);
    expect(CATEGORY_META.magic_link.teamFacing).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/email/taxonomy.test.ts`
Expected: FAIL — cannot find module `./taxonomy`.

- [ ] **Step 3: Write the implementation**

```ts
// src/lib/email/taxonomy.ts
export type EmailCategory =
  | 'payment_paid'
  | 'application_submitted'
  | 'contact_message'
  | 'magic_link'
  | 'applicant_confirmation'
  | 'application_recovery';

type CategoryMeta = { teamFacing: boolean; subjectTag: string | null };

export const CATEGORY_META: Record<EmailCategory, CategoryMeta> = {
  payment_paid:           { teamFacing: true,  subjectTag: '[MDGH 💰 Payment]' },
  application_submitted:  { teamFacing: true,  subjectTag: '[MDGH 📝 Application]' },
  contact_message:        { teamFacing: true,  subjectTag: '[MDGH ✉️ Contact]' },
  magic_link:             { teamFacing: false, subjectTag: null },
  applicant_confirmation: { teamFacing: false, subjectTag: null },
  application_recovery:   { teamFacing: false, subjectTag: null },
};

/** Prefix team-facing subjects with their tag; leave applicant subjects untouched. */
export function applySubjectTag(category: EmailCategory, subject: string): string {
  const tag = CATEGORY_META[category].subjectTag;
  return tag ? `${tag} ${subject}` : subject;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/email/taxonomy.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/email/taxonomy.ts src/lib/email/taxonomy.test.ts
git commit -m "feat(email): email category taxonomy + subject tagging"
```

---

### Task 2: Thread `category` + multi-recipient `to` through the email layer

This is one cohesive change ("introduce category across producers + provider") so the build stays green in one commit. Making `category` **required** forces every send site to set it — the compiler is the checklist.

**Files:**
- Modify: `src/lib/email/types.ts`
- Modify: `src/lib/email/resend-provider.ts`
- Modify: `src/lib/email/templates.ts`
- Modify: `src/lib/email/index.ts`
- Modify: `src/pages/api/contact.ts:48-55`
- Modify: `src/pages/api/applications/submit.ts:39` (interim: add category; replaced by notifyTeam in Task 4)
- Test: `src/lib/email/resend-provider.test.ts` (create)

- [ ] **Step 1: Write the failing provider test**

```ts
// src/lib/email/resend-provider.test.ts
import { describe, it, expect, vi, afterEach } from 'vitest';
import { ResendProvider } from './resend-provider';

afterEach(() => vi.unstubAllGlobals());

describe('ResendProvider.send', () => {
  it('sends array recipients, category header, and Resend tag', async () => {
    const fetchSpy = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ id: 'msg_1' }),
    });
    vi.stubGlobal('fetch', fetchSpy);

    const provider = new ResendProvider('key_123');
    const res = await provider.send({
      to: ['a@example.com', 'b@example.com'],
      subject: '[MDGH 💰 Payment] New paid application — REF1',
      html: '<p>hi</p>',
      text: 'hi',
      category: 'payment_paid',
    });

    expect(res.ok).toBe(true);
    const body = JSON.parse((fetchSpy.mock.calls[0][1] as RequestInit).body as string);
    expect(body.to).toEqual(['a@example.com', 'b@example.com']);
    expect(body.headers['X-MDGH-Category']).toBe('payment_paid');
    expect(body.tags).toEqual([{ name: 'category', value: 'payment_paid' }]);
  });

  it('wraps a single string recipient into an array', async () => {
    const fetchSpy = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ id: 'm' }) });
    vi.stubGlobal('fetch', fetchSpy);
    await new ResendProvider('k').send({
      to: 'solo@example.com', subject: 's', html: 'h', text: 't', category: 'magic_link',
    });
    const body = JSON.parse((fetchSpy.mock.calls[0][1] as RequestInit).body as string);
    expect(body.to).toEqual(['solo@example.com']);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/email/resend-provider.test.ts`
Expected: FAIL — type error / `category` not accepted, `headers`/`tags` absent from body.

- [ ] **Step 3: Update the `EmailMessage` type**

```ts
// src/lib/email/types.ts
import type { EmailCategory } from './taxonomy';

export type EmailMessage = {
  to: string | string[];
  from?: string;
  subject: string;
  html: string;
  text: string;
  category: EmailCategory;
};

export type EmailSendResult =
  | { ok: true; providerMessageId: string }
  | { ok: false; errorCode: string; errorMessage: string };

export interface EmailProvider {
  send(msg: EmailMessage): Promise<EmailSendResult>;
}
```

- [ ] **Step 4: Update the Resend provider** (`src/lib/email/resend-provider.ts`)

Replace the `body: JSON.stringify({...})` object with:

```ts
        body: JSON.stringify({
          from: msg.from ?? FROM_ADDRESS,
          to: Array.isArray(msg.to) ? msg.to : [msg.to],
          subject: msg.subject,
          html: msg.html,
          text: msg.text,
          headers: { 'X-MDGH-Category': msg.category },
          tags: [{ name: 'category', value: msg.category }],
        }),
```

- [ ] **Step 5: Add categories + subject tags to templates** (`src/lib/email/templates.ts`)

Add the import at the top (after the `FROM_DEFAULT` line is fine, but keep imports at top):

```ts
import { applySubjectTag } from './taxonomy';
```

Then set each template's `subject`/`category`. `renderMagicLinkEmail` return:

```ts
    category: 'magic_link' as const,
    subject: applySubjectTag('magic_link', 'Your MDGH application link'),
```

`renderApplicantConfirmation` return:

```ts
    category: 'applicant_confirmation' as const,
    subject: applySubjectTag('applicant_confirmation', "We've received your MDGH application"),
```

`renderAdminNotification` return (drop the old `[MDGH]` prefix — taxonomy supplies it):

```ts
    category: 'application_submitted' as const,
    subject: applySubjectTag('application_submitted', `New application: ${fullName} (${reference})`),
```

`renderRecoveryEmail` (override the spread category + subject):

```ts
export function renderRecoveryEmail(args: { reference: string; magicLink: string; cycleClose: string }) {
  const out = renderMagicLinkEmail(args);
  return {
    ...out,
    category: 'application_recovery' as const,
    subject: applySubjectTag('application_recovery', 'Your MDGH application link (resent)'),
  };
}
```

Also add the new payment-paid alert template at the end of the file (before `export const FROM_ADDRESS`):

```ts
export function renderPaymentPaidAlert(args: {
  reference: string; email: string; amountLabel: string; dashboardUrl: string;
}) {
  const { reference, email, amountLabel, dashboardUrl } = args;
  return {
    category: 'payment_paid' as const,
    subject: applySubjectTag('payment_paid', `New paid application — ${reference}`),
    text: [
      `A new application fee was paid.`,
      ``,
      `Reference: ${reference}`,
      `Applicant email: ${email}`,
      `Amount: ${amountLabel}`,
      ``,
      `Review: ${dashboardUrl}`,
    ].join('\n'),
    html: `<!doctype html><html><body style="font-family:Inter,Arial,sans-serif">
<h2>💰 New paid application</h2>
<p><strong>${escapeHtml(reference)}</strong></p>
<p>Applicant: ${escapeHtml(email)}<br>Amount: ${escapeHtml(amountLabel)}</p>
<p><a href="${escapeHtml(dashboardUrl)}">Open in admin dashboard</a></p>
</body></html>`,
  };
}
```

- [ ] **Step 6: Re-export the taxonomy** (`src/lib/email/index.ts`)

Add this line after `export * from './templates';`:

```ts
export * from './taxonomy';
```

- [ ] **Step 7: Set category on the inline contact send** (`src/pages/api/contact.ts`)

Change the import line 6 to:

```ts
import { getEmailProvider, applySubjectTag } from '@/lib/email';
```

Replace the `email.send({...})` call (lines 49-55) with:

```ts
  const sendResult = await email.send({
    to: 'info@missdiasporagh.org',
    from: 'MDGH Contact Form <applications@missdiasporagh.org>',
    subject: applySubjectTag('contact_message', `${subjectSafe} — from ${input.name}`),
    html: contactHtml(input),
    text: contactText(input),
    category: 'contact_message',
  });
```

- [ ] **Step 8: Keep submit.ts compiling (interim)** (`src/pages/api/applications/submit.ts:39`)

The admin-notification send spreads `renderAdminNotification(...)`, which now returns `category`, so it already type-checks. No edit needed in this task — Task 4 replaces it with `notifyTeam`. (Verify it still compiles in Step 9.)

- [ ] **Step 9: Run provider test + typecheck + full suite**

Run: `npx vitest run src/lib/email/resend-provider.test.ts`
Expected: PASS (2 tests).
Run: `npx astro check` (or `npx tsc --noEmit`)
Expected: no type errors — every `.send(...)` site now supplies `category`.
Run: `npm test`
Expected: all pass.

- [ ] **Step 10: Commit**

```bash
git add src/lib/email/ src/pages/api/contact.ts
git commit -m "feat(email): require category, multi-recipient to, machine tags on every send"
```

---

### Task 3: `notifyTeam` helper with KV idempotency

**Files:**
- Create: `src/lib/email/notify-team.ts`
- Test: `src/lib/email/notify-team.test.ts`

`notifyTeam` takes an optional injected provider for testability (production omits it and uses `getEmailProvider`).

- [ ] **Step 1: Write the failing test**

```ts
// src/lib/email/notify-team.test.ts
import { describe, it, expect } from 'vitest';
import { MockEmailProvider } from './mock-provider';
import { notifyTeam, TEAM_NOTIFY } from './notify-team';

function fakeKV() {
  const store = new Map<string, string>();
  return {
    store,
    get: async (k: string) => store.get(k) ?? null,
    put: async (k: string, v: string) => { store.set(k, v); },
  };
}

const baseEnv = { MOCK_EMAIL: 'true' as const };

describe('notifyTeam', () => {
  it('payment_paid: sends to the team list with payment_paid category', async () => {
    const provider = new MockEmailProvider();
    const kv = fakeKV();
    await notifyTeam({ ...baseEnv, KV: kv as any }, {
      kind: 'payment_paid', appId: 'app1', reference: 'REF1',
      email: 'x@y.com', amountLabel: '25.99 USD', dashboardUrl: 'https://d/app1',
    }, provider);

    expect(provider.sent).toHaveLength(1);
    expect(provider.sent[0].to).toEqual(TEAM_NOTIFY);
    expect(provider.sent[0].category).toBe('payment_paid');
    expect(provider.sent[0].subject).toContain('[MDGH 💰 Payment]');
  });

  it('payment_paid: second call for the same appId sends nothing (idempotent)', async () => {
    const provider = new MockEmailProvider();
    const kv = fakeKV();
    const env = { ...baseEnv, KV: kv as any };
    const event = {
      kind: 'payment_paid' as const, appId: 'app1', reference: 'REF1',
      email: 'x@y.com', amountLabel: '25.99 USD', dashboardUrl: 'https://d/app1',
    };
    await notifyTeam(env, event, provider);
    await notifyTeam(env, event, provider);
    expect(provider.sent).toHaveLength(1);
  });

  it('application_submitted: includes applications@ plus the team list', async () => {
    const provider = new MockEmailProvider();
    const kv = fakeKV();
    await notifyTeam({ ...baseEnv, KV: kv as any }, {
      kind: 'application_submitted', fullName: 'Ama Test',
      reference: 'REF2', dashboardUrl: 'https://d/app2',
    }, provider);

    expect(provider.sent).toHaveLength(1);
    expect(provider.sent[0].to).toEqual(
      ['applications@missdiasporagh.org', ...TEAM_NOTIFY],
    );
    expect(provider.sent[0].category).toBe('application_submitted');
    expect(provider.sent[0].subject).toContain('[MDGH 📝 Application]');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/email/notify-team.test.ts`
Expected: FAIL — cannot find module `./notify-team`.

- [ ] **Step 3: Write the implementation**

```ts
// src/lib/email/notify-team.ts
import type { EmailProvider } from './types';
import type { EmailEnv } from './index';
import { getEmailProvider } from './index';
import { renderAdminNotification, renderPaymentPaidAlert } from './templates';

/** Internal team inboxes that receive activity alerts. */
export const TEAM_NOTIFY = ['missdiasporagh@gmail.com', 'info@missdiasporagh.org'];

/** App-submitted also notifies the existing applications@ inbox. */
const APP_SUBMITTED_RECIPIENTS = ['applications@missdiasporagh.org', ...TEAM_NOTIFY];

export type TeamAlertEvent =
  | {
      kind: 'payment_paid';
      appId: string;
      reference: string;
      email: string;
      amountLabel: string;
      dashboardUrl: string;
    }
  | {
      kind: 'application_submitted';
      fullName: string;
      reference: string;
      dashboardUrl: string;
    };

type NotifyEnv = EmailEnv & { KV: KVNamespace };

/**
 * Send a team activity alert. `payment_paid` is guarded by a KV key so the
 * poller + webhook (both call runPaymentVerification) produce exactly one alert.
 * The guard is set only after a successful send, so a transient send failure can
 * still be retried by a later call. Provider is injectable for testing.
 */
export async function notifyTeam(
  env: NotifyEnv,
  event: TeamAlertEvent,
  provider: EmailProvider = getEmailProvider(env),
): Promise<void> {
  if (event.kind === 'payment_paid') {
    const guardKey = `team-notified-paid:${event.appId}`;
    if (await env.KV.get(guardKey)) return;
    const msg = renderPaymentPaidAlert({
      reference: event.reference,
      email: event.email,
      amountLabel: event.amountLabel,
      dashboardUrl: event.dashboardUrl,
    });
    const res = await provider.send({ to: TEAM_NOTIFY, ...msg });
    if (res.ok) await env.KV.put(guardKey, '1', { expirationTtl: 60 * 60 * 24 * 30 });
    return;
  }

  const msg = renderAdminNotification({
    fullName: event.fullName,
    reference: event.reference,
    dashboardUrl: event.dashboardUrl,
  });
  await provider.send({ to: APP_SUBMITTED_RECIPIENTS, ...msg });
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/email/notify-team.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/email/notify-team.ts src/lib/email/notify-team.test.ts
git commit -m "feat(email): notifyTeam helper with KV-idempotent payment alerts"
```

---

### Task 4: Hook the two events into the app flow

**Files:**
- Modify: `src/lib/payment/verify-flow.ts` (import + paid alert before final return)
- Modify: `src/pages/api/applications/submit.ts` (swap admin send → notifyTeam)

- [ ] **Step 1: Add the payment_paid alert in verify-flow**

In `src/lib/payment/verify-flow.ts`, change the import on line 6 to add `notifyTeam`:

```ts
import { getEmailProvider, renderMagicLinkEmail } from '@/lib/email';
import { notifyTeam } from '@/lib/email/notify-team';
```

Then, immediately before the final `return { ok: true, status: 'paid', applicationId: app.id, token, emailSent };` (currently line 77), insert:

```ts
  // Team activity alert — fire-and-forget, never block the applicant's result.
  // KV-guarded inside notifyTeam so poller + webhook yield exactly one alert.
  await notifyTeam(env, {
    kind: 'payment_paid',
    appId: app.id,
    reference: app.transaction_reference,
    email: app.email,
    amountLabel: `${(app.payment_amount_cents / 100).toFixed(2)} ${app.payment_currency}`,
    dashboardUrl: new URL(`/admin/applications/${app.id}`, baseUrl).toString(),
  }).catch(() => {});
```

- [ ] **Step 2: Swap the admin notification for notifyTeam in submit.ts**

In `src/pages/api/applications/submit.ts`, change the import on line 5 to drop `renderAdminNotification` and add the helper:

```ts
import { getEmailProvider, renderApplicantConfirmation } from '@/lib/email';
import { notifyTeam } from '@/lib/email/notify-team';
```

Replace the `await Promise.all([...])` block (lines 37-40) with:

```ts
  await Promise.all([
    email.send({ to: app.email, ...renderApplicantConfirmation({ fullName: parsed.data.fullName, reference: app.transaction_reference }) }).catch(() => null),
    notifyTeam(env, {
      kind: 'application_submitted',
      fullName: parsed.data.fullName,
      reference: app.transaction_reference,
      dashboardUrl,
    }).catch(() => null),
  ]);
```

- [ ] **Step 3: Typecheck + full suite**

Run: `npx astro check`
Expected: no type errors.
Run: `npm test`
Expected: all pass.

- [ ] **Step 4: Commit**

```bash
git add src/lib/payment/verify-flow.ts src/pages/api/applications/submit.ts
git commit -m "feat(email): alert team on paid application + application submitted"
```

---

### Task 5: Verification pass

**Files:** none (verification only)

- [ ] **Step 1: Confirm every send site sets a category**

Run: `grep -rn "\.send(" src --include=*.ts | grep -v "\.test\.ts"`
Expected sites and their category source:
- `verify-flow.ts` magic link → spreads `renderMagicLinkEmail` (`magic_link`) ✓
- `submit.ts` confirmation → spreads `renderApplicantConfirmation` (`applicant_confirmation`) ✓
- `recover.ts` → spreads `renderRecoveryEmail` (`application_recovery`) ✓
- `contact.ts` → inline `category: 'contact_message'` ✓
- `notify-team.ts` → `renderPaymentPaidAlert` / `renderAdminNotification` ✓
Confirm none are missing a category (the typecheck in Task 4 already enforces this; this is a human-readable double check).

- [ ] **Step 2: Full suite + typecheck green**

Run: `npm test && npx astro check`
Expected: all tests pass, no type errors.

- [ ] **Step 3: Manual smoke note (post-deploy, optional)**

After deploy, the cheapest live check is the **application_submitted** path (free): submit a test long-form application via a magic link and confirm an email tagged `[MDGH 📝 Application]` arrives at all three addresses with an `X-MDGH-Category: application_submitted` header (View Original in Gmail). The `payment_paid` path is exercised naturally by the next real paid application — no extra paid test needed.

---

## Notes / decisions baked in

- **`category` is required**, not optional — the compiler guarantees no email ships untagged.
- **Idempotency favors delivery:** the KV guard is set only after a successful send. Worst case under a rare poller/webhook race is a duplicate alert, never a missed one (a missed alert is worse for the team than a dupe).
- **`application_submitted` recipients** = `applications@` + the two team addresses, sent as **one** email (not two), replacing the old applications@-only send. This satisfies "keep applications@ and add the two" without duplicate mail.
- **Applicant emails stay clean:** `magic_link` / `applicant_confirmation` / `application_recovery` get the machine header + Resend tag but **no** visible subject prefix.
