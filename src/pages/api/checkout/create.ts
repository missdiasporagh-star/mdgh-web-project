import type { APIRoute } from 'astro';
import { checkoutCreateSchema } from '@/lib/schemas/apply';
import { evaluateEligibility } from '@/lib/eligibility/rules';
import { getActiveCycle, insertPendingApplication } from '@/lib/db/queries';
import { newUlid } from '@/lib/ids/ulid';
import { newTransactionReference } from '@/lib/ids/reference';
import { hashIp } from '@/lib/crypto/hash';
import { verifyTurnstile } from '@/lib/turnstile/verify';
import { getPaymentProvider } from '@/lib/payment';
import { checkRateLimit } from '@/lib/ratelimit/kv-limiter';

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

  const ipHashForRl = await hashIp(clientAddress ?? 'unknown', env.IP_HASH_SALT);
  const rl = await checkRateLimit(env.KV, `rl:checkout-create:${ipHashForRl}`, 5, 3600);
  if (!rl.allowed) return json({ ok: false, error: 'rate_limited', retryAfter: rl.retryAfterSeconds }, 429);

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
  if (init.flow === 'sdk') {
    return json({ ok: true, flow: 'sdk', reference, sdkBootstrap: init.sdkBootstrap });
  }
  return json({ ok: true, flow: 'redirect', reference, checkoutUrl: init.checkoutUrl });
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status, headers: { 'Content-Type': 'application/json' },
  });
}
