import type { APIRoute } from 'astro';
import { z } from 'zod';
import { checkAdminAuth } from '@/middleware/admin-auth';
import { getApplicationById, getCycle } from '@/lib/db/queries';
import { deliverPaidApplication } from '@/lib/payment/verify-flow';
import { newUlid } from '@/lib/ids/ulid';
import { hashIp } from '@/lib/crypto/hash';
const schema = z.object({ note: z.string().trim().min(10).max(1000), confirmed: z.literal(true) });
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });
export const POST: APIRoute = async ({ request, locals, params, clientAddress }) => {
  const env = locals.runtime.env;
  const auth = await checkAdminAuth(request, env);
  if (!auth.ok) return json({ ok: false, error: 'unauthorized' }, 401);
  if (request.headers.get('origin') !== new URL(request.url).origin) return json({ ok: false, error: 'invalid_origin' }, 403);
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return json({ ok: false, error: 'confirmation_and_note_required' }, 400);
  const app = await getApplicationById(env.DB, params.id ?? '');
  if (!app) return json({ ok: false, error: 'not_found' }, 404);
  if (app.submitted_at || !['pending', 'failed', 'paid'].includes(app.payment_status)) return json({ ok: false, error: 'not_confirmable' }, 409);
  const cycle = await getCycle(env.DB, app.cycle_id);
  if (!cycle || cycle.is_active !== 1 || Date.now() >= Date.parse(cycle.applications_close_at)) return json({ ok: false, error: 'cycle_closed' }, 409);
  if (app.payment_status !== 'paid') {
    const now = new Date().toISOString();
    // Atomic audit + status update. Preserve actual provider IDs; never invent a receipt.
    const details = JSON.stringify({ event: 'staff_gateway_payment_confirmation', note: parsed.data.note, verificationSource: 'staff_attestation', providerVerified: false });
    try {
      await env.DB.batch([
        env.DB.prepare("INSERT INTO admin_audit (id, admin_email, action, target_application_id, details_json, ip_hash, created_at) VALUES (?, ?, 'status_change', ?, ?, ?, ?)")
          .bind(newUlid(), auth.adminEmail, app.id, details, await hashIp(clientAddress ?? 'unknown', env.IP_HASH_SALT), now),
        env.DB.prepare("UPDATE applications SET payment_status = 'paid', payment_verified_at = ?, updated_at = ? WHERE id = ? AND payment_status IN ('pending', 'failed')")
          .bind(now, now, app.id),
      ]);
    } catch (error) {
      return json({ ok: false, error: error instanceof Error && /UNIQUE/i.test(error.message) ? 'another_paid_application_exists' : 'confirmation_failed' }, 409);
    }
  }
  const updated = await getApplicationById(env.DB, app.id);
  if (!updated || updated.payment_status !== 'paid') return json({ ok: false, error: 'not_confirmable' }, 409);
  const outcome = await deliverPaidApplication(env, updated, new URL(request.url).origin);
  if (!outcome.ok) return json({ ok: false, error: outcome.error }, outcome.httpStatus);
  return json({ ok: true, emailSent: outcome.status === 'paid' && outcome.emailSent === true, emailAlreadySent: outcome.status === 'paid' && outcome.emailAlreadySent === true });
};
