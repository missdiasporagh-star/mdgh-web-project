import { describe, it, expect } from 'vitest';
import { POST } from '@/pages/api/admin/login';
import { hashPassword } from '@/lib/crypto/pbkdf2';

const ADMIN_EMAIL = 'admin@missdiasporagh.org';

async function fakeEnv(adminPassword: string) {
  const kv = new Map<string, string>();
  // Admins now live in a D1 `admins` table (getAdminByEmail -> SELECT * FROM
  // admins WHERE email = ?). The fake returns a single seeded admin row only for
  // the matching (lowercased) email; any other email .first()s to null, which
  // the route collapses to the same generic 401.
  const adminRow = {
    email: ADMIN_EMAIL,
    password_hash: await hashPassword(adminPassword),
    display_name: 'Test Admin',
    created_at: '2026-01-01T00:00:00Z',
    disabled: 0,
  };
  const kvNs = {
    get: async (k: string) => kv.get(k) ?? null,
    put: async (k: string, v: string) => { kv.set(k, v); },
    delete: async (k: string) => { kv.delete(k); },
  } as unknown as KVNamespace;
  return {
    DB: {
      prepare(sql: string) {
        const params: unknown[] = [];
        const stmt = {
          bind(...args: unknown[]) { params.push(...args); return stmt; },
          async first() {
            if (sql.includes('FROM admins WHERE email =')) {
              return String(params[0]).toLowerCase() === ADMIN_EMAIL ? adminRow : null;
            }
            return null;
          },
          async run() { return { meta: { changes: 1 } }; },
        };
        return stmt;
      },
    } as unknown as D1Database,
    SESSION: kvNs,
    KV: kvNs,
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
    const res = await POST(ctx(env, { email: ADMIN_EMAIL, password: 'correct-horse' }));
    expect(res.status).toBe(200);
    expect(res.headers.get('Set-Cookie')).toContain('mdgh_admin=');
  });

  it('rejects wrong password', async () => {
    const env = await fakeEnv('correct-horse');
    const res = await POST(ctx(env, { email: ADMIN_EMAIL, password: 'wrong' }));
    expect(res.status).toBe(401);
  });

  it('rejects wrong email', async () => {
    const env = await fakeEnv('correct-horse');
    const res = await POST(ctx(env, { email: 'someoneelse@example.com', password: 'correct-horse' }));
    expect(res.status).toBe(401);
  });
});
