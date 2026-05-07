import type { APIRoute } from 'astro';
import { draftRecordSchema } from '@/lib/schemas/form';
import { validateApplyToken } from '@/lib/tokens/validate-apply-token';
import { setDraftFile } from '@/lib/db/queries';

export const prerender = false;

export const POST: APIRoute = async ({ request, locals }) => {
  const env = locals.runtime.env;
  let body: unknown;
  try { body = await request.json(); } catch { return j({ ok: false, error: 'invalid_json' }, 400); }
  const parsed = draftRecordSchema.safeParse(body);
  if (!parsed.success) return j({ ok: false, error: 'invalid_input' }, 400);

  const validation = await validateApplyToken(parsed.data.token, env.APPLY_TOKEN_SECRET, env.DB);
  if (!validation.ok) return j({ ok: false, error: 'invalid_token', reason: validation.reason }, 401);

  // Confirm the r2Key matches the active presign for this (applicationId, fileType)
  const expectedKey = await env.KV.get(`presign-active:${validation.applicationId}:${parsed.data.fileType}`);
  if (expectedKey !== parsed.data.r2Key) {
    return j({ ok: false, error: 'r2_key_mismatch' }, 400);
  }

  // Verify the object actually landed in R2
  const head = await env.MEDIA.head(parsed.data.r2Key);
  if (!head) return j({ ok: false, error: 'object_not_found_in_r2' }, 400);

  const field = parsed.data.fileType === 'headshot' ? 'headshot_r2_key' : 'video_r2_key';
  await setDraftFile(env.DB, validation.applicationId, field, parsed.data.r2Key);

  return j({ ok: true });
};

function j(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}
