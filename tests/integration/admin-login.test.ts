import { describe, it, expect } from 'vitest';
import { POST } from '@/pages/api/admin/login';
import { hashPassword } from '@/lib/crypto/pbkdf2';

async function fakeEnv(adminPassword: string) {
  const kv = new Map<string, string>();
  return {
    DB: {
      prepare(_: string) { return { bind() { return { async run() { return { meta: { changes: 1 } }; } }; } }; },
    } as unknown as D1Database,
    SESSION: {
      get: async (k: string) => kv.get(k) ?? null,
      put: async (k: string, v: string) => { kv.set(k, v); },
      delete: async (k: string) => { kv.delete(k); },
    } as unknown as KVNamespace,
    ADMIN_PASSWORD_HASH: await hashPassword(adminPassword),
    ADMIN_SESSION_SECRET: 'a'.repeat(64),
    IP_HASH_SALT: 'salt',
  } as unknown as CloudflareEnv;
}

function ctx(env: CloudflareEnv, body: unknown) {
  return {
    request: new Request('http://localhost/api/admin/login', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
    }),
    locals: { runtime: { env } } as App.Locals,
    clientAddress: '1.2.3.4', cookies: {} as never, redirect: () => new Response(),
    params: {}, props: {}, site: undefined, generator: '',
    preferredLocale: undefined, preferredLocaleList: [], currentLocale: undefined,
    url: new URL('http://localhost/api/admin/login'),
  } as unknown as Parameters<typeof POST>[0];
}

describe('POST /api/admin/login', () => {
  it('returns 200 with Set-Cookie on correct credentials', async () => {
    const env = await fakeEnv('correct-horse');
    const res = await POST(ctx(env, { email: 'admin@missdiasporagh.org', password: 'correct-horse' }));
    expect(res.status).toBe(200);
    expect(res.headers.get('Set-Cookie')).toContain('mdgh_admin=');
  });

  it('rejects wrong password', async () => {
    const env = await fakeEnv('correct-horse');
    const res = await POST(ctx(env, { email: 'admin@missdiasporagh.org', password: 'wrong' }));
    expect(res.status).toBe(401);
  });

  it('rejects wrong email', async () => {
    const env = await fakeEnv('correct-horse');
    const res = await POST(ctx(env, { email: 'someoneelse@example.com', password: 'correct-horse' }));
    expect(res.status).toBe(401);
  });
});
