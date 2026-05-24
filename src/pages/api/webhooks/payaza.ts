import type { APIRoute } from 'astro';
import { runPaymentVerification } from '@/lib/payment/verify-flow';
import { extractMerchantReference, verifyWebhookToken } from '@/lib/payment/payaza-webhook';
import { hashIp } from '@/lib/crypto/hash';
import { checkRateLimit } from '@/lib/ratelimit/kv-limiter';

export const prerender = false;

// Magic-link emails must use the canonical apply origin — NOT whatever origin
// Payaza happened to POST to (this Worker also answers on *.workers.dev and the
// apex). So we pass an explicit origin rather than inferring it from the
// inbound request. (Follow-up: promote to an APP_ORIGIN env var shared with
// verify-flow.)
const APP_ORIGIN = 'https://apply.missdiasporagh.org';

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

  // Defense-in-depth behind the URL token (the real gate). Keyed by IP so a
  // leaked-token abuser from another IP can't throttle Payaza's own deliveries;
  // the cap is generous because legitimate events can arrive in bursts
  // (multiple status transitions + retries per transaction).
  const ipHash = await hashIp(clientAddress ?? 'unknown', env.IP_HASH_SALT);
  const rl = await checkRateLimit(env.KV, `rl:payaza-webhook:${ipHash}`, 300, 3600);
  if (!rl.allowed) return j({ ok: true, throttled: true });

  let body: unknown;
  try { body = await request.json(); } catch { return j({ ok: true, ignored: 'bad_json' }); }

  const reference = extractMerchantReference(body);
  if (!reference) return j({ ok: true, ignored: 'no_reference' });

  try {
    const outcome = await runPaymentVerification(env, reference, APP_ORIGIN);
    return j({ ok: true, status: outcome.ok ? outcome.status : 'error' });
  } catch (e) {
    console.error('[payaza.webhook] verification error:', e instanceof Error ? e.message : String(e));
    return j({ ok: true, error: 'verification_failed' });
  }
};

function j(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}
