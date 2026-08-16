import type { APIRoute } from 'astro';
import { cycleUpdateSchema } from '@/lib/schemas/admin';
import { listCycles, updateCycle } from '@/lib/db/queries';
import { checkAdminAuth } from '@/middleware/admin-auth';
import { newUlid } from '@/lib/ids/ulid';
import { hashIp } from '@/lib/crypto/hash';
import { insertAdminAudit } from '@/lib/db/queries';

export const prerender = false;

export const GET: APIRoute = async ({ request, locals }) => {
  const env = locals.runtime.env;
  const auth = await checkAdminAuth(request, env);
  if (!auth.ok) return j({ ok: false, error: 'unauthorized' }, 401);

  const cycles = await listCycles(env.DB);
  return j({ ok: true, cycles });
};

export const PATCH: APIRoute = async ({ request, locals, clientAddress }) => {
  const env = locals.runtime.env;
  const auth = await checkAdminAuth(request, env);
  if (!auth.ok) return j({ ok: false, error: 'unauthorized' }, 401);

  let body: unknown;
  try { body = await request.json(); } catch { return j({ ok: false, error: 'invalid_json' }, 400); }
  const parsed = cycleUpdateSchema.safeParse(body);
  if (!parsed.success) return j({ ok: false, error: 'invalid_input' }, 400);

  const { id, isActive, applicationFeeCents, applicationCurrency, applicationsCloseAt } = parsed.data;

  const fields: Parameters<typeof updateCycle>[2] = {};
  if (isActive !== undefined) fields.is_active = isActive ? 1 : 0;
  if (applicationFeeCents !== undefined) fields.application_fee_cents = applicationFeeCents;
  if (applicationCurrency !== undefined) fields.application_currency = applicationCurrency;
  if (applicationsCloseAt !== undefined) fields.applications_close_at = applicationsCloseAt;

  await updateCycle(env.DB, id, fields);

  const ipHash = await hashIp(clientAddress ?? 'unknown', env.IP_HASH_SALT);
  await insertAdminAudit(env.DB, {
    id: newUlid(),
    adminEmail: auth.adminEmail,
    action: 'cycle_update',
    targetApplicationId: null,
    detailsJson: JSON.stringify({ cycleId: id, ...fields }),
    ipHash,
  });

  return j({ ok: true });
};

function j(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}
