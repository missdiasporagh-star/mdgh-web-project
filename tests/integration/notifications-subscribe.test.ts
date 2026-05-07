import { describe, it, expect } from 'vitest';
import { POST } from '@/pages/api/notifications/subscribe';

function fakeEnv() {
  const inserts: unknown[] = [];
  const DB = {
    prepare(sql: string) {
      const params: unknown[] = [];
      const stmt = {
        bind(...a: unknown[]) { params.push(...a); return stmt; },
        async run() { if (sql.includes('INSERT INTO cycle_notifications')) inserts.push(params); return { meta: { changes: 1 } }; },
        async first() { return null; },
      };
      return stmt;
    },
  } as unknown as D1Database;
  return { DB, _inserts: inserts };
}

function ctx(env: ReturnType<typeof fakeEnv>, body: unknown) {
  return {
    request: new Request('http://localhost/api/notifications/subscribe', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
    }),
    locals: { runtime: { env } } as App.Locals,
    clientAddress: '1.2.3.4',
    cookies: {} as never, redirect: () => new Response(), params: {}, props: {},
    site: undefined, generator: '', preferredLocale: undefined, preferredLocaleList: [], currentLocale: undefined,
    url: new URL('http://localhost/api/notifications/subscribe'),
  } as unknown as Parameters<typeof POST>[0];
}

describe('POST /api/notifications/subscribe', () => {
  it('inserts and returns ok', async () => {
    const env = fakeEnv();
    const res = await POST(ctx(env, { email: 'a@b.com', source: 'eligibility_disqualified', disqualifyingRule: 'age', honeypot: '' }));
    expect(res.status).toBe(200);
    expect(env._inserts.length).toBe(1);
  });

  it('rejects bad email', async () => {
    const env = fakeEnv();
    const res = await POST(ctx(env, { email: 'no', source: 'manual', disqualifyingRule: null, honeypot: '' }));
    expect(res.status).toBe(400);
  });

  it('rejects honeypot', async () => {
    const env = fakeEnv();
    const res = await POST(ctx(env, { email: 'a@b.com', source: 'manual', disqualifyingRule: null, honeypot: 'spam' }));
    expect(res.status).toBe(400);
  });
});
