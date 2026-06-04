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
    // Don't leak whether reference exists; return generic success
    return j({ ok: true });
  }

  // If not yet paid, re-run verify
  if (app.payment_status !== 'paid') {
    const provider = getPaymentProvider(env);
    const v = await provider.verify(parsed.data.reference);
    if (!v.ok || v.status !== 'paid') return j({ ok: false, error: 'not_paid' }, 400);
    const paid = await markPaymentPaid(env.DB, app.id, v.providerTransactionId, v.paidAt ?? new Date().toISOString());
    if (!paid.ok) {
      // Another application for this email is already the paid one for the cycle;
      // the one-paid-per-cycle backstop parked this duplicate. The magic link for
      // the genuine paid application was already emailed at first payment.
      return j({ ok: false, error: 'duplicate_email_paid' }, 409);
    }
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
  const current = Number(await env.KV.get(rlKey)) || 0;
  if (current >= 3) return j({ ok: false, error: 'rate_limited' }, 429);
  await env.KV.put(rlKey, String(current + 1), { expirationTtl: 3600 });

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
