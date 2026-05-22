import { verifyAdminSession } from '@/lib/tokens/admin-session';

export type AdminCheckResult =
  | { ok: true; adminEmail: string; sessionId: string }
  | { ok: false; reason: string };

export async function checkAdminAuth(
  request: Request, env: { ADMIN_SESSION_SECRET: string; KV: KVNamespace }
): Promise<AdminCheckResult> {
  const cookie = request.headers.get('cookie') ?? '';
  const match = /mdgh_admin=([^;]+)/.exec(cookie);
  if (!match) return { ok: false, reason: 'no_cookie' };
  const v = await verifyAdminSession(match[1], env.ADMIN_SESSION_SECRET);
  if (!v.ok) return { ok: false, reason: v.reason };
  const kv = await env.KV.get(`admin-session:${v.sessionId}`);
  if (!kv) return { ok: false, reason: 'session_revoked' };
  return { ok: true, adminEmail: v.adminEmail, sessionId: v.sessionId };
}
