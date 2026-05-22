import type { APIRoute } from 'astro';
import { getApplicationById, insertAdminAudit } from '@/lib/db/queries';
import { checkAdminAuth } from '@/middleware/admin-auth';
import { presignR2Get } from '@/lib/r2/presign-get';
import { newUlid } from '@/lib/ids/ulid';
import { hashIp } from '@/lib/crypto/hash';

export const prerender = false;

export const GET: APIRoute = async ({ request, locals, params, clientAddress }) => {
  const env = locals.runtime.env;
  const auth = await checkAdminAuth(request, env);
  if (!auth.ok) return j({ ok: false, error: 'unauthorized' }, 401);

  const id = params.id;
  if (!id || typeof id !== 'string') return j({ ok: false, error: 'bad_id' }, 400);

  const url = new URL(request.url);
  const which = url.searchParams.get('which');
  if (which !== 'headshot' && which !== 'video') return j({ ok: false, error: 'bad_which' }, 400);

  const row = await getApplicationById(env.DB, id);
  if (!row) return j({ ok: false, error: 'not_found' }, 404);

  const r2Key = which === 'headshot' ? row.headshot_r2_key : row.video_r2_key;
  if (!r2Key) return j({ ok: false, error: 'no_file' }, 404);

  const bucket = env.MOCK_PAYMENTS === 'true' ? 'mdgh-applications-staging' : 'mdgh-applications';
  const signedUrl = await presignR2Get({
    accountId: env.R2_ACCOUNT_ID,
    accessKeyId: env.R2_ACCESS_KEY_ID,
    secretAccessKey: env.R2_SECRET_ACCESS_KEY,
    bucket, key: r2Key, expiresInSeconds: 300,
  });

  const ipHash = await hashIp(clientAddress ?? 'unknown', env.IP_HASH_SALT);
  await insertAdminAudit(env.DB, {
    id: newUlid(), adminEmail: auth.adminEmail, action: 'signed_url_issued',
    targetApplicationId: id, detailsJson: JSON.stringify({ which }), ipHash,
  });

  return j({ ok: true, url: signedUrl, expiresInSeconds: 300 });
};

function j(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}
