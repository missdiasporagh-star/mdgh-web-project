import { describe, it, expect, vi } from 'vitest';
import { POST } from '@/pages/api/upload/presign';
import { signApplyToken } from '@/lib/tokens/apply-token';

vi.mock('@/lib/r2/presign', () => ({
  presignR2Put: async () => 'https://r2.example/presigned-url',
}));

const SECRET = 'a'.repeat(64);
const FUTURE = Math.floor(Date.now() / 1000) + 3600;

function fakeEnv(rows: Record<string, unknown>) {
  const kv = new Map<string, string>();
  return {
    DB: {
      prepare(_: string) {
        return { bind(id: string) { return { async first() { return rows[id] ?? null; } }; } };
      },
    } as unknown as D1Database,
    SESSION: {
      get: async (k: string) => kv.get(k) ?? null,
      put: async (k: string, v: string) => { kv.set(k, v); },
      delete: async (k: string) => { kv.delete(k); },
    } as unknown as KVNamespace,
    APPLY_TOKEN_SECRET: SECRET,
    R2_ACCOUNT_ID: 'acc', R2_ACCESS_KEY_ID: 'k', R2_SECRET_ACCESS_KEY: 's',
    MOCK_PAYMENTS: 'true',
  } as unknown as CloudflareEnv;
}

function ctx(env: CloudflareEnv, body: unknown) {
  return {
    request: new Request('http://localhost/api/upload/presign', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
    }),
    locals: { runtime: { env } } as App.Locals,
    clientAddress: '1.2.3.4', cookies: {} as never, redirect: () => new Response(),
    params: {}, props: {}, site: undefined, generator: '',
    preferredLocale: undefined, preferredLocaleList: [], currentLocale: undefined,
    url: new URL('http://localhost/api/upload/presign'),
  } as unknown as Parameters<typeof POST>[0];
}

describe('POST /api/upload/presign', () => {
  it('returns uploadUrl + r2Key for valid token + valid file', async () => {
    const token = await signApplyToken('app1', FUTURE, SECRET);
    const env = fakeEnv({
      app1: { id: 'app1', payment_status: 'paid', submitted_at: null, cycle_id: 'C1' },
      C1: { id: 'C1', is_active: 1, applications_close_at: '2099-01-01T00:00:00Z' },
    });
    const res = await POST(ctx(env, {
      token, fileType: 'headshot', fileName: 'me.jpg',
      contentType: 'image/jpeg', sizeBytes: 500_000,
    }));
    expect(res.status).toBe(200);
    const j = await res.json() as { ok: boolean; uploadUrl: string; r2Key: string };
    expect(j.ok).toBe(true);
    expect(j.uploadUrl).toBe('https://r2.example/presigned-url');
    expect(j.r2Key).toMatch(/^cycles\/MDGH-2026\/app1\/headshot\.jpg$/);
  });

  it('rejects oversize file', async () => {
    const token = await signApplyToken('app1', FUTURE, SECRET);
    const env = fakeEnv({
      app1: { id: 'app1', payment_status: 'paid', submitted_at: null, cycle_id: 'C1' },
      C1: { id: 'C1', is_active: 1, applications_close_at: '2099-01-01T00:00:00Z' },
    });
    const res = await POST(ctx(env, {
      token, fileType: 'headshot', fileName: 'huge.jpg',
      contentType: 'image/jpeg', sizeBytes: 50_000_000,
    }));
    expect(res.status).toBe(400);
    const j = await res.json() as { error: string };
    expect(j.error).toBe('file_too_large');
  });

  it('rejects disallowed content type', async () => {
    const token = await signApplyToken('app1', FUTURE, SECRET);
    const env = fakeEnv({
      app1: { id: 'app1', payment_status: 'paid', submitted_at: null, cycle_id: 'C1' },
      C1: { id: 'C1', is_active: 1, applications_close_at: '2099-01-01T00:00:00Z' },
    });
    const res = await POST(ctx(env, {
      token, fileType: 'video', fileName: 'me.exe',
      contentType: 'application/octet-stream', sizeBytes: 1_000_000,
    }));
    expect(res.status).toBe(400);
    const j = await res.json() as { error: string };
    expect(j.error).toBe('content_type_not_allowed');
  });

  it('rejects unpaid token', async () => {
    const token = await signApplyToken('app2', FUTURE, SECRET);
    const env = fakeEnv({
      app2: { id: 'app2', payment_status: 'pending', submitted_at: null, cycle_id: 'C1' },
      C1: { id: 'C1', is_active: 1, applications_close_at: '2099-01-01T00:00:00Z' },
    });
    const res = await POST(ctx(env, {
      token, fileType: 'headshot', fileName: 'me.jpg',
      contentType: 'image/jpeg', sizeBytes: 500_000,
    }));
    expect(res.status).toBe(401);
  });
});
