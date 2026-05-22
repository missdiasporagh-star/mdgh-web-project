import type { APIRoute } from 'astro';
import { listApplicationsForAdmin } from '@/lib/db/queries';
import { checkAdminAuth } from '@/middleware/admin-auth';

export const prerender = false;

export const GET: APIRoute = async ({ request, locals }) => {
  const env = locals.runtime.env;
  const auth = await checkAdminAuth(request, env);
  if (!auth.ok) return j({ ok: false, error: 'unauthorized' }, 401);

  const url = new URL(request.url);
  const status = url.searchParams.get('status') ?? undefined;
  const q = url.searchParams.get('q') ?? undefined;
  const limit = Math.min(100, Number(url.searchParams.get('limit') ?? '50'));
  const offset = Math.max(0, Number(url.searchParams.get('offset') ?? '0'));

  const { rows, total } = await listApplicationsForAdmin(env.DB, { status, q, limit, offset });
  return j({ ok: true, rows, total, limit, offset });
};

function j(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}
