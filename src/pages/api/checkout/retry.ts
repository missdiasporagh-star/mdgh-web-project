import type { APIRoute } from 'astro';
import { z } from 'zod';
import { getActiveCycle, getApplicationByReference, resetApplicationForRetry } from '@/lib/db/queries';
import { newTransactionReference } from '@/lib/ids/reference';
import { hashIp } from '@/lib/crypto/hash';
import { getPaymentProvider } from '@/lib/payment';
import { checkRateLimit } from '@/lib/ratelimit/kv-limiter';

export const prerender = false;

const RETRY_CAP = 3;
const RETRY_TTL_SECONDS = 24 * 60 * 60;

const retrySchema = z.object({ reference: z.string().min(1).max(64) });

export const POST: APIRoute = async ({ request, locals, clientAddress }) => {
  const env = locals.runtime.env;

  let body: unknown;
  try { body = await request.json(); } catch { return j({ ok: false, error: 'invalid_json' }, 400); }
  const parsed = retrySchema.safeParse(body);
  if (!parsed.success) return j({ ok: false, error: 'invalid_input' }, 400);
  const { reference } = parsed.data;

  const ipHash = await hashIp(clientAddress ?? 'unknown', env.IP_HASH_SALT);
  const ipRl = await checkRateLimit(env.KV, `rl:checkout-retry:${ipHash}`, 20, 3600);
  if (!ipRl.allowed) return j({ ok: false, error: 'rate_limited', retryAfter: ipRl.retryAfterSeconds }, 429);

  const app = await getApplicationByReference(env.DB, reference);
  if (!app) return j({ ok: false, error: 'unknown_reference' }, 404);
  if (app.payment_status === 'paid') return j({ ok: false, error: 'already_paid' }, 409);
  if (app.payment_status !== 'failed') return j({ ok: false, error: 'not_retryable', status: app.payment_status }, 409);

  const retryKey = `retry-count:${app.id}`;
  const used = Number((await env.KV.get(retryKey)) ?? '0');
  if (used >= RETRY_CAP) return j({ ok: false, error: 'retry_cap_reached', cap: RETRY_CAP }, 429);
  await env.KV.put(retryKey, String(used + 1), { expirationTtl: RETRY_TTL_SECONDS });

  const cycle = await getActiveCycle(env.DB);
  if (!cycle || cycle.is_active !== 1) return j({ ok: false, error: 'cycle_not_active' }, 400);
  if (new Date() > new Date(cycle.applications_close_at)) return j({ ok: false, error: 'cycle_closed' }, 400);

  const newReference = newTransactionReference(cycle.id);
  const priorNote = `retry-replaced-prev-ref:${reference} (was: ${app.payment_failure_reason ?? 'failed'})`.slice(0, 500);
  await resetApplicationForRetry(env.DB, app.id, newReference, priorNote);

  const provider = getPaymentProvider(env);
  const callbackUrl = new URL('/apply/return', request.url).toString();
  const init = await provider.init({
    amountCents: cycle.application_fee_cents,
    currency: cycle.application_currency as 'USD' | 'NGN' | 'GHS',
    reference: newReference,
    customerEmail: app.email,
    callbackUrl,
    metadata: { cycle_id: cycle.id, application_id: app.id, retry_of: reference },
  });
  if (!init.ok) {
    return j({ ok: false, error: 'payment_init_failed', code: init.errorCode, message: init.errorMessage }, 502);
  }
  if (init.flow === 'sdk') {
    return j({ ok: true, flow: 'sdk', reference: newReference, sdkBootstrap: init.sdkBootstrap, retriesUsed: used + 1, retryCap: RETRY_CAP });
  }
  return j({ ok: true, flow: 'redirect', reference: newReference, checkoutUrl: init.checkoutUrl, retriesUsed: used + 1, retryCap: RETRY_CAP });
};

function j(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}
