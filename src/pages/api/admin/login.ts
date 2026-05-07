import type { APIRoute } from 'astro';
import { adminLoginSchema } from '@/lib/schemas/admin';
import { verifyPassword } from '@/lib/crypto/pbkdf2';
import { signAdminSession } from '@/lib/tokens/admin-session';
import { newUlid } from '@/lib/ids/ulid';
import { hashIp } from '@/lib/crypto/hash';
import { insertAdminAudit } from '@/lib/db/queries';

export const prerender = false;

const SESSION_TTL_SECONDS = 4 * 3600;
const ADMIN_EMAIL = 'admin@missdiasporagh.org'; // single-admin model

export const POST: APIRoute = async ({ request, locals, clientAddress }) => {
  const env = locals.runtime.env;
  let body: unknown;
  try { body = await request.json(); } catch { return j({ ok: false, error: 'invalid_json' }, 400); }
  const parsed = adminLoginSchema.safeParse(body);
  if (!parsed.success) return j({ ok: false, error: 'invalid_input' }, 400);

  if (parsed.data.email.toLowerCase() !== ADMIN_EMAIL) return j({ ok: false, error: 'invalid_credentials' }, 401);
  const ok = await verifyPassword(parsed.data.password, env.ADMIN_PASSWORD_HASH);
  if (!ok) return j({ ok: false, error: 'invalid_credentials' }, 401);

  const sessionId = newUlid();
  const expiryUnix = Math.floor(Date.now() / 1000) + SESSION_TTL_SECONDS;
  const token = await signAdminSession(ADMIN_EMAIL, sessionId, expiryUnix, env.ADMIN_SESSION_SECRET);

  // Track session in KV (allows server-side invalidation)
  await env.SESSION.put(`admin-session:${sessionId}`, JSON.stringify({ email: ADMIN_EMAIL, expiresAt: expiryUnix }), { expirationTtl: SESSION_TTL_SECONDS });

  // Audit log
  const ipHash = await hashIp(clientAddress ?? 'unknown', env.IP_HASH_SALT);
  await insertAdminAudit(env.DB, {
    id: newUlid(), adminEmail: ADMIN_EMAIL, action: 'login',
    targetApplicationId: null, detailsJson: null, ipHash,
  });

  // Set HttpOnly cookie
  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      'Set-Cookie': `mdgh_admin=${token}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${SESSION_TTL_SECONDS}`,
    },
  });
};

function j(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}
