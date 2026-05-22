import type { APIRoute } from 'astro';
import { runPaymentVerification } from '@/lib/payment/verify-flow';
import { hashIp } from '@/lib/crypto/hash';
import { checkRateLimit } from '@/lib/ratelimit/kv-limiter';

export const prerender = false;

export const GET: APIRoute = async ({ request, locals, clientAddress }) => {
  const env = locals.runtime.env;

  // Rate limit: 30 verify calls per IP per hour. /apply/return triggers one
  // legitimate call per finished payment; the cap blocks reference enumeration
  // attacks (an attacker brute-forcing MDGH-YYYY-XXXXXXXX would otherwise be
  // able to probe Payaza via our Worker and infer transaction status from the
  // response).
  const ipHash = await hashIp(clientAddress ?? 'unknown', env.IP_HASH_SALT);
  const rl = await checkRateLimit(env.KV, `rl:checkout-verify:${ipHash}`, 30, 3600);
  if (!rl.allowed) return j({ ok: false, error: 'rate_limited', retryAfter: rl.retryAfterSeconds }, 429);

  const url = new URL(request.url);
  const reference = url.searchParams.get('reference');
  if (!reference) return j({ ok: false, error: 'missing_reference' }, 400);

  const outcome = await runPaymentVerification(env, reference, request.url);
  if (!outcome.ok) {
    return j(outcome, outcome.httpStatus);
  }
  const { ...rest } = outcome;
  return j(rest, 200);
};

function j(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}
