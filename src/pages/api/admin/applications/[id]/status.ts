import type { APIRoute } from 'astro';
import { adminStatusUpdateSchema } from '@/lib/schemas/admin';
import { updateApplicationStatus, insertAdminAudit } from '@/lib/db/queries';
import { checkAdminAuth } from '@/middleware/admin-auth';
import { newUlid } from '@/lib/ids/ulid';
import { hashIp } from '@/lib/crypto/hash';

export const prerender = false;

export const PATCH: APIRoute = async ({ request, locals, params, clientAddress }) => {
  const env = locals.runtime.env;
  const auth = await checkAdminAuth(request, env);
  if (!auth.ok) return j({ ok: false, error: 'unauthorized' }, 401);

  const id = params.id;
  if (!id || typeof id !== 'string') return j({ ok: false, error: 'bad_id' }, 400);

  let body: unknown;
  try { body = await request.json(); } catch { return j({ ok: false, error: 'invalid_json' }, 400); }
  const parsed = adminStatusUpdateSchema.safeParse(body);
  if (!parsed.success) return j({ ok: false, error: 'invalid_input' }, 400);

  await updateApplicationStatus(env.DB, id, parsed.data.status, parsed.data.adminNotes ?? null);

  const ipHash = await hashIp(clientAddress ?? 'unknown', env.IP_HASH_SALT);
  await insertAdminAudit(env.DB, {
    id: newUlid(), adminEmail: auth.adminEmail, action: 'status_change',
    targetApplicationId: id,
    detailsJson: JSON.stringify({ status: parsed.data.status, hasNotes: !!parsed.data.adminNotes }),
    ipHash,
  });

  return j({ ok: true });
};

function j(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}
