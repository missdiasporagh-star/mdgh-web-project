import type { APIRoute } from 'astro';
import { z } from 'zod';
import { checkAdminAuth } from '@/middleware/admin-auth';
import { getApplicationById, getCycle, insertAdminAudit, markPaymentPaid } from '@/lib/db/queries';
import { isManualReference } from '@/lib/payment/manual';
import { deliverPaidApplication } from '@/lib/payment/verify-flow';
import { newUlid } from '@/lib/ids/ulid';
import { hashIp } from '@/lib/crypto/hash';

const schema = z.object({
  transactionId: z.string().trim().min(3).max(80).regex(/^[A-Za-z0-9-]+$/).transform(v => v.toUpperCase()),
  receivedAmountGhs: z.number().positive().max(1000000).refine(v => Math.abs(v * 100 - Math.round(v * 100)) < 0.000001),
  confirmed: z.literal(true),
});
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });

export const POST: APIRoute = async ({ request, locals, params, clientAddress }) => {
  const env = locals.runtime.env;
  const auth = await checkAdminAuth(request, env);
  if (!auth.ok) return json({ ok: false, error: 'unauthorized' }, 401);
  if (request.headers.get('origin') !== new URL(request.url).origin) return json({ ok: false, error: 'invalid_origin' }, 403);
  let body: unknown;
  try { body = await request.json(); } catch { return json({ ok: false, error: 'invalid_json' }, 400); }
  const parsed = schema.safeParse(body);
  if (!parsed.success) return json({ ok: false, error: 'invalid_input' }, 400);
  const app = await getApplicationById(env.DB, params.id ?? '');
  if (!app || !isManualReference(app.transaction_reference)) return json({ ok: false, error: 'manual_application_not_found' }, 404);
  if (!['pending', 'paid'].includes(app.payment_status)) return json({ ok: false, error: 'not_confirmable' }, 409);
  const cycle = await getCycle(env.DB, app.cycle_id);
  if (!cycle || cycle.is_active !== 1 || Date.now() > Date.parse(cycle.applications_close_at)) return json({ ok: false, error: 'cycle_closed' }, 409);
  const receipt = `MOMO:${parsed.data.transactionId}`;
  if (app.payment_status === 'paid' && app.payaza_transaction_id !== receipt) return json({ ok: false, error: 'already_paid_different_receipt' }, 409);
  if (app.payment_currency === 'GHS' && Math.round(parsed.data.receivedAmountGhs * 100) !== app.payment_amount_cents) return json({ ok: false, error: 'amount_mismatch' }, 400);
  const existing = await env.DB.prepare("SELECT id FROM applications WHERE payaza_transaction_id = ? AND payment_status = 'paid' AND id != ?").bind(receipt, app.id).first();
  if (existing) return json({ ok: false, error: 'receipt_already_used' }, 409);
  // Preserve who authorized the receipt and the actual cedi amount before granting access.
  await insertAdminAudit(env.DB, {
    id: newUlid(), adminEmail: auth.adminEmail, action: 'status_change', targetApplicationId: app.id,
    detailsJson: JSON.stringify({ event: 'manual_momo_confirmation', receipt, receivedAmountGhs: parsed.data.receivedAmountGhs, feeCurrency: app.payment_currency, feeCents: app.payment_amount_cents }),
    ipHash: await hashIp(clientAddress ?? 'unknown', env.IP_HASH_SALT),
  });
  const paid = await markPaymentPaid(env.DB, app.id, receipt, new Date().toISOString());
  if (!paid.ok) return json({ ok: false, error: 'duplicate_payment_or_application' }, 409);
  const outcome = await deliverPaidApplication(env, app, new URL(request.url).origin);
  if (!outcome.ok) return json({ ok: false, error: outcome.error }, outcome.httpStatus);
  return json({ ok: true, emailSent: outcome.status === 'paid' && outcome.emailSent === true, emailAlreadySent: outcome.status === 'paid' && outcome.emailAlreadySent === true });
};
