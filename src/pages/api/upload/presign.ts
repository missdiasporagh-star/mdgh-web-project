import type { APIRoute } from 'astro';
import { draftFileSchema, FILE_LIMITS } from '@/lib/schemas/form';
import { validateApplyToken } from '@/lib/tokens/validate-apply-token';
import { presignR2Put } from '@/lib/r2/presign';
import { checkRateLimit } from '@/lib/ratelimit/kv-limiter';

export const prerender = false;

const BUCKET_NAME_FROM_ENV = (env: CloudflareEnv): string => {
  // Local dev / preview uses staging bucket; production uses prod bucket.
  // MOCK_PAYMENTS=true is the local-dev signal.
  return env.MOCK_PAYMENTS === 'true' ? 'mdgh-applications-staging' : 'mdgh-applications';
};

export const POST: APIRoute = async ({ request, locals }) => {
  const env = locals.runtime.env;
  let body: unknown;
  try { body = await request.json(); } catch { return j({ ok: false, error: 'invalid_json' }, 400); }

  const parsed = draftFileSchema.safeParse(body);
  if (!parsed.success) return j({ ok: false, error: 'invalid_input', details: parsed.error.flatten() }, 400);
  const input = parsed.data;

  const limits = FILE_LIMITS[input.fileType];
  if (input.sizeBytes > limits.maxBytes) {
    return j({ ok: false, error: 'file_too_large', maxBytes: limits.maxBytes }, 400);
  }
  if (!limits.contentTypes.includes(input.contentType as (typeof limits.contentTypes)[number])) {
    return j({ ok: false, error: 'content_type_not_allowed', allowed: limits.contentTypes }, 400);
  }

  const validation = await validateApplyToken(input.token, env.APPLY_TOKEN_SECRET, env.DB);
  if (!validation.ok) return j({ ok: false, error: 'invalid_token', reason: validation.reason }, 401);

  const rl = await checkRateLimit(env.KV, `rl:upload-presign:${validation.applicationId}`, 20, 3600);
  if (!rl.allowed) return j({ ok: false, error: 'rate_limited', retryAfter: rl.retryAfterSeconds }, 429);

  const ext = extensionFor(input.contentType);
  const r2Key = `cycles/MDGH-2026/${validation.applicationId}/${input.fileType === 'headshot' ? 'headshot' : 'intro-video'}.${ext}`;

  // Fail loudly (in logs) but cleanly (to the client) if R2 S3 credentials
  // aren't configured — otherwise getSignedUrl throws and the route returns a
  // bare 500 the client can't parse, so uploads fail with no message.
  if (!env.R2_ACCOUNT_ID || !env.R2_ACCESS_KEY_ID || !env.R2_SECRET_ACCESS_KEY) {
    console.error('[upload.presign] R2 credentials missing: set R2_ACCESS_KEY_ID and R2_SECRET_ACCESS_KEY (and R2_ACCOUNT_ID) on the Worker');
    return j({ ok: false, error: 'upload_unavailable' }, 503);
  }

  const bucket = BUCKET_NAME_FROM_ENV(env);
  let uploadUrl: string;
  try {
    uploadUrl = await presignR2Put({
      accountId: env.R2_ACCOUNT_ID,
      accessKeyId: env.R2_ACCESS_KEY_ID,
      secretAccessKey: env.R2_SECRET_ACCESS_KEY,
      bucket,
      key: r2Key,
      contentType: input.contentType,
      expiresInSeconds: 900, // 15 min
    });
  } catch (e) {
    console.error('[upload.presign] presign failed:', e instanceof Error ? e.message : String(e));
    return j({ ok: false, error: 'upload_unavailable' }, 502);
  }

  // Track active presign in KV (one per (token, fileType))
  await env.KV.put(
    `presign-active:${validation.applicationId}:${input.fileType}`,
    r2Key,
    { expirationTtl: 900 }
  );

  return j({ ok: true, uploadUrl, r2Key });
};

function extensionFor(ct: string): string {
  const map: Record<string, string> = {
    'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp',
    'video/mp4': 'mp4', 'video/quicktime': 'mov', 'video/webm': 'webm',
  };
  return map[ct] ?? 'bin';
}

function j(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}
