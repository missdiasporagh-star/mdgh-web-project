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
  if (!reference) return j({ ok: false, error: 'missing_reference' }, 400);

  const app = await getApplicationByReference(env.DB, reference);
  if (!app) return j({ ok: false, error: 'unknown_reference' }, 404);

  if (app.payment_status === 'paid') {
    return j({ ok: true, status: 'paid', applicationId: app.id, alreadyPaid: true });
  }

  const provider = getPaymentProvider(env);
  const verify = await provider.verify(reference);
  if (!verify.ok) {
    return j({ ok: false, error: 'verify_failed', code: verify.errorCode, message: verify.errorMessage }, 502);
  }

  if (verify.status === 'failed') {
    await markPaymentFailed(env.DB, app.id, 'provider_reported_failed');
    return j({ ok: true, status: 'failed', applicationId: app.id });
  }

  if (verify.status === 'pending') {
    return j({ ok: true, status: 'pending', applicationId: app.id });
  }

  // Status is 'paid'. Mark and issue token.
  await markPaymentPaid(env.DB, app.id, verify.providerTransactionId, verify.paidAt ?? new Date().toISOString());

  const cycle = await getCycle(env.DB, app.cycle_id);
  if (!cycle) return j({ ok: false, error: 'cycle_missing' }, 500);

  const cycleCloseUnix = Math.floor(new Date(cycle.applications_close_at).getTime() / 1000);
  const thirtyDays = Math.floor(Date.now() / 1000) + 30 * 24 * 3600;
  const expiry = Math.min(thirtyDays, cycleCloseUnix);
  const token = await signApplyToken(app.id, expiry, env.APPLY_TOKEN_SECRET);

  // Rate-limit magic-link sends (24 hr per application_id)
  const sendKey = `magic-link-sent:${app.id}`;
  const alreadySent = await env.KV.get(sendKey);
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
      await env.KV.put(sendKey, '1', { expirationTtl: 86400 });
    }
  }
  await setApplyTokenIssued(env.DB, app.id, new Date().toISOString());

  return j({ ok: true, status: 'paid', applicationId: app.id, token, emailSent });
};

function j(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}
