import type { APIRoute } from 'astro';
import { adminLoginSchema } from '@/lib/schemas/admin';
import { authenticateAdmin } from '@/lib/auth/authenticate-admin';
import { getAdminByEmail, insertAdminAudit } from '@/lib/db/queries';
import { signAdminSession } from '@/lib/tokens/admin-session';
import { newUlid } from '@/lib/ids/ulid';
import { hashIp } from '@/lib/crypto/hash';
import { checkRateLimit } from '@/lib/ratelimit/kv-limiter';

export const prerender = false;

const SESSION_TTL_SECONDS = 4 * 3600;

export const POST: APIRoute = async ({ request, locals, clientAddress }) => {
  const env = locals.runtime.env;

  // Rate limit: 10 attempts per IP per hour. pbkdf2 (200k iterations) already
  // slows brute-force, but a hard ceiling at the edge stops attackers from
  // burning Worker CPU on guesses.
  const ipHashForRl = await hashIp(clientAddress ?? 'unknown', env.IP_HASH_SALT);
  const rl = await checkRateLimit(env.KV, `rl:admin-login:${ipHashForRl}`, 10, 3600);
  if (!rl.allowed) return j({ ok: false, error: 'rate_limited', retryAfter: rl.retryAfterSeconds }, 429);

  let body: unknown;
  try { body = await request.json(); } catch { return j({ ok: false, error: 'invalid_json' }, 400); }
  const parsed = adminLoginSchema.safeParse(body);
  if (!parsed.success) return j({ ok: false, error: 'invalid_input' }, 400);

  // Admins live in D1 (table: admins). Unknown email, disabled account, and
  // wrong password all collapse to the same generic 401 (no enumeration).
  const candidate = await getAdminByEmail(env.DB, parsed.data.email);
  const admin = await authenticateAdmin(candidate, parsed.data.password);
  if (!admin) return j({ ok: false, error: 'invalid_credentials' }, 401);
  const adminEmail = admin.email;

  const sessionId = newUlid();
  const expiryUnix = Math.floor(Date.now() / 1000) + SESSION_TTL_SECONDS;
  const token = await signAdminSession(adminEmail, sessionId, expiryUnix, env.ADMIN_SESSION_SECRET);

  // Track session in KV (allows server-side invalidation)
  await env.KV.put(`admin-session:${sessionId}`, JSON.stringify({ email: adminEmail, expiresAt: expiryUnix }), { expirationTtl: SESSION_TTL_SECONDS });

  // Audit log (reuse the rate-limit IP hash to save a KDF call)
  await insertAdminAudit(env.DB, {
    id: newUlid(), adminEmail, action: 'login',
    targetApplicationId: null, detailsJson: null, ipHash: ipHashForRl,
  });

  // Set HttpOnly cookie. SameSite=Strict because the admin panel has no
  // cross-site nav flow; tighter than Lax with zero usability cost here.
  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      'Set-Cookie': `mdgh_admin=${token}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${SESSION_TTL_SECONDS}`,
    },
  });
};

function j(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}
