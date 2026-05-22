import type { APIRoute } from 'astro';
import { getApplicationById } from '@/lib/db/queries';
import { checkAdminAuth } from '@/middleware/admin-auth';

export const prerender = false;

export const GET: APIRoute = async ({ request, locals, params }) => {
  const env = locals.runtime.env;
  const auth = await checkAdminAuth(request, env);
  if (!auth.ok) return j({ ok: false, error: 'unauthorized' }, 401);
  const id = params.id;
  if (!id || typeof id !== 'string') return j({ ok: false, error: 'bad_id' }, 400);
  const row = await getApplicationById(env.DB, id);
  if (!row) return j({ ok: false, error: 'not_found' }, 404);
  return j({ ok: true, application: row });
};

function j(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}
