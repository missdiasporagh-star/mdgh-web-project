import type { APIRoute } from 'astro';
import { verifyAdminSession } from '@/lib/tokens/admin-session';

export const prerender = false;

export const POST: APIRoute = async ({ request, locals }) => {
  const env = locals.runtime.env;
  const cookie = request.headers.get('cookie') ?? '';
  const match = /mdgh_admin=([^;]+)/.exec(cookie);
  if (match) {
    const v = await verifyAdminSession(match[1], env.ADMIN_SESSION_SECRET);
    if (v.ok) await env.KV.delete(`admin-session:${v.sessionId}`);
  }
  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      'Set-Cookie': 'mdgh_admin=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0',
    },
  });
};
