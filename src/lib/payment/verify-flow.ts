import {
  getApplicationByReference, getCycle, markPaymentPaid, markPaymentFailed, setApplyTokenIssued,
} from '@/lib/db/queries';
import { getPaymentProvider } from '@/lib/payment';
import { signApplyToken } from '@/lib/tokens/apply-token';
import { getEmailProvider, renderMagicLinkEmail } from '@/lib/email';
import { notifyTeam } from '@/lib/email/notify-team';

export type VerifyOutcome =
  | { ok: true; status: 'paid'; applicationId: string; token?: string; emailSent?: boolean; alreadyPaid?: boolean }
  | { ok: true; status: 'pending' | 'failed'; applicationId: string }
  | { ok: false; error: string; code?: string; message?: string; httpStatus: number };

type Env = App.Locals['runtime']['env'];

export async function runPaymentVerification(
  env: Env,
  reference: string,
  baseUrl: string,
): Promise<VerifyOutcome> {
  const app = await getApplicationByReference(env.DB, reference);
  if (!app) return { ok: false, error: 'unknown_reference', httpStatus: 404 };

  if (app.payment_status === 'paid') {
    return { ok: true, status: 'paid', applicationId: app.id, alreadyPaid: true };
  }

  const provider = getPaymentProvider(env);
  const verify = await provider.verify(reference);
  if (!verify.ok) {
    return {
      ok: false,
      error: 'verify_failed',
      code: verify.errorCode,
      message: verify.errorMessage,
      httpStatus: 502,
    };
  }

  if (verify.status === 'failed') {
    await markPaymentFailed(env.DB, app.id, 'provider_reported_failed');
    return { ok: true, status: 'failed', applicationId: app.id };
  }

  if (verify.status === 'pending') {
    return { ok: true, status: 'pending', applicationId: app.id };
  }

  await markPaymentPaid(env.DB, app.id, verify.providerTransactionId, verify.paidAt ?? new Date().toISOString());

  const cycle = await getCycle(env.DB, app.cycle_id);
  if (!cycle) return { ok: false, error: 'cycle_missing', httpStatus: 500 };

  const cycleCloseUnix = Math.floor(new Date(cycle.applications_close_at).getTime() / 1000);
  const thirtyDays = Math.floor(Date.now() / 1000) + 30 * 24 * 3600;
  const expiry = Math.min(thirtyDays, cycleCloseUnix);
  const token = await signApplyToken(app.id, expiry, env.APPLY_TOKEN_SECRET);

  const sendKey = `magic-link-sent:${app.id}`;
  const alreadySent = await env.KV.get(sendKey);
  let emailSent = false;
  if (!alreadySent) {
    const email = getEmailProvider(env);
    const magicLink = new URL(`/apply/form?token=${encodeURIComponent(token)}`, baseUrl).toString();
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

  return { ok: true, status: 'paid', applicationId: app.id, token, emailSent };
}
