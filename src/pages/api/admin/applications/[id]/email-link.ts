import type { APIRoute } from 'astro';
import { checkAdminAuth } from '@/middleware/admin-auth';
import { getApplicationById, getCycle, insertAdminAudit, setApplyTokenIssued } from '@/lib/db/queries';
import { getEmailProvider, renderRecoveryEmail } from '@/lib/email';
import { signApplyToken } from '@/lib/tokens/apply-token';
import { hashIp } from '@/lib/crypto/hash';
import { newUlid } from '@/lib/ids/ulid';

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
});

export const POST: APIRoute = async ({ request, locals, params, clientAddress }) => {
  const env = locals.runtime.env;
  const auth = await checkAdminAuth(request, env);
  if (!auth.ok) return json({ ok: false, error: 'unauthorized' }, 401);
  if (request.headers.get('origin') !== new URL(request.url).origin) return json({ ok: false, error: 'invalid_origin' }, 403);
  const app = await getApplicationById(env.DB, params.id ?? '');
  if (!app) return json({ ok: false, error: 'not_found' }, 404);
  if (app.payment_status !== 'paid') return json({ ok: false, error: 'not_paid' }, 409);
  if (app.submitted_at) return json({ ok: false, error: 'already_submitted' }, 409);
  const cycle = await getCycle(env.DB, app.cycle_id);
  if (!cycle || cycle.is_active !== 1 || Date.now() >= Date.parse(cycle.applications_close_at)) return json({ ok: false, error: 'cycle_closed' }, 409);
  if (env.MOCK_EMAIL !== 'true' && !env.RESEND_API_KEY) return json({ ok: false, error: 'email_unavailable' }, 503);
  const key = `admin-link-email:${app.id}:${Math.floor(Date.now() / 3600000)}`;
  const count = Number(await env.KV.get(key)) || 0;
  if (count >= 3) return json({ ok: false, error: 'rate_limited' }, 429);
  await env.KV.put(key, String(count + 1), { expirationTtl: 3600 });
  await insertAdminAudit(env.DB, {
    id: newUlid(), adminEmail: auth.adminEmail, action: 'signed_url_issued', targetApplicationId: app.id,
    detailsJson: JSON.stringify({ event: 'application_link_email_requested' }),
    ipHash: await hashIp(clientAddress ?? 'unknown', env.IP_HASH_SALT),
  });
  const expiry = Math.min(Math.floor(Date.now() / 1000) + 30 * 86400, Math.floor(Date.parse(cycle.applications_close_at) / 1000));
  const token = await signApplyToken(app.id, expiry, env.APPLY_TOKEN_SECRET);
  const magicLink = new URL(`/apply/form?token=${encodeURIComponent(token)}`, request.url).toString();
  try {
    const sent = await getEmailProvider(env).send({ to: app.email, ...renderRecoveryEmail({
      reference: app.transaction_reference, magicLink, cycleClose: cycle.applications_close_at.slice(0, 10),
    }) });
    if (!sent.ok) return json({ ok: false, error: 'email_send_failed' }, 502);
    await setApplyTokenIssued(env.DB, app.id, new Date().toISOString());
    return json({ ok: true, emailSent: true });
  } catch {
    return json({ ok: false, error: 'email_request_failed' }, 502);
  }
};
