import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { POST } from '@/pages/api/checkout/create';

function fakeEnv() {
  const cycles = [{
    id: 'MDGH-2026', display_name: 'Miss Diaspora Ghana 2026',
    application_fee_cents: 2599, application_currency: 'USD',
    privacy_policy_version: 'v1.0',
    applications_open_at: '2026-01-01T00:00:00Z',
    applications_close_at: '2099-01-01T00:00:00Z', is_active: 1,
  }];
  const applications: Record<string, unknown>[] = [];
  const DB = {
    prepare(sql: string) {
      const params: unknown[] = [];
      const stmt = {
        bind(...args: unknown[]) { params.push(...args); return stmt; },
        async first<T>() {
          if (sql.includes('FROM cycles WHERE is_active = 1')) return cycles[0] as unknown as T;
          if (sql.includes('FROM cycles WHERE id =')) return cycles[0] as unknown as T;
          return null;
        },
        async run() {
          if (sql.startsWith('\n    INSERT INTO applications') || sql.includes('INSERT INTO applications')) {
            applications.push({ params });
            return { meta: { changes: 1 } };
          }
          return { meta: { changes: 0 } };
        },
      };
      return stmt;
    },
  } as unknown as D1Database;
  return {
    DB, MEDIA: {} as R2Bucket, SESSION: {} as KVNamespace,
    PAYAZA_BASE_URL: 'https://x', PAYAZA_PUBLIC_KEY: 'pk', PAYAZA_SECRET_KEY: 'sk',
    APPLY_TOKEN_SECRET: 'a'.repeat(64), ADMIN_PASSWORD_HASH: '', ADMIN_SESSION_SECRET: 'b'.repeat(64),
    IP_HASH_SALT: 'salt', RESEND_API_KEY: '',
    R2_ACCESS_KEY_ID: '', R2_SECRET_ACCESS_KEY: '', R2_ACCOUNT_ID: '',
    TURNSTILE_SITE_KEY: 'site', TURNSTILE_SECRET_KEY: 'secret',
    MOCK_PAYMENTS: 'true', MOCK_EMAIL: 'true',
    _applications: applications,
  };
}

let originalFetch: typeof globalThis.fetch;

beforeEach(() => {
  originalFetch = globalThis.fetch;
  globalThis.fetch = (async (input: RequestInfo | URL) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
    if (url.includes('turnstile/v0/siteverify')) {
      return new Response(JSON.stringify({ success: true }), { status: 200 });
    }
    return originalFetch(input as RequestInfo | URL);
  }) as typeof globalThis.fetch;
});

afterEach(() => {
  globalThis.fetch = originalFetch;
});

function makeContext(env: ReturnType<typeof fakeEnv>, body: unknown, ip = '1.2.3.4') {
  return {
    request: new Request('http://localhost/api/checkout/create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'user-agent': 'test' },
      body: JSON.stringify(body),
    }),
    locals: { runtime: { env } } as App.Locals,
    clientAddress: ip,
    cookies: {} as never, redirect: () => new Response(),
    params: {}, props: {}, site: undefined, generator: '', preferredLocale: undefined,
    preferredLocaleList: [], currentLocale: undefined,
    url: new URL('http://localhost/api/checkout/create'),
  } as unknown as Parameters<typeof POST>[0];
}

const VALID_INPUT = {
  email: 'a@b.com', ageBand: '18-25', isWoman: true, africanDescent: true,
  outsideGhana: true, validPassport: true,
  consentPolicy: true, consentMediaUse: true, consentMarketing: false,
  honeypot: '', turnstileToken: 'tok',
};

describe('POST /api/checkout/create', () => {
  it('returns ok with a checkoutUrl on the happy path', async () => {
    const env = fakeEnv();
    const res = await POST(makeContext(env, VALID_INPUT));
    expect(res.status).toBe(200);
    const json = await res.json() as { ok: boolean; checkoutUrl: string; reference: string };
    expect(json.ok).toBe(true);
    expect(json.checkoutUrl).toContain('mock-checkout');
    expect(json.reference).toMatch(/^MDGH-2026-/);
    expect(env._applications.length).toBe(1);
  });

  it('rejects when honeypot is filled', async () => {
    const env = fakeEnv();
    const res = await POST(makeContext(env, { ...VALID_INPUT, honeypot: 'spam' }));
    expect(res.status).toBe(400);
    const j = await res.json() as { error: string };
    expect(j.error).toBe('invalid_input');
  });

  it('rejects when ineligible (age out of range)', async () => {
    const env = fakeEnv();
    const res = await POST(makeContext(env, { ...VALID_INPUT, ageBand: 'Over 35' }));
    expect(res.status).toBe(400);
    const j = await res.json() as { error: string; rule: string };
    expect(j.error).toBe('not_eligible');
    expect(j.rule).toBe('age');
  });

  it('rejects when consentMediaUse is missing (zod fails)', async () => {
    const env = fakeEnv();
    const { consentMediaUse: _omit, ...partial } = VALID_INPUT;
    const res = await POST(makeContext(env, partial));
    expect(res.status).toBe(400);
  });

  it('rejects when email is invalid', async () => {
    const env = fakeEnv();
    const res = await POST(makeContext(env, { ...VALID_INPUT, email: 'not-an-email' }));
    expect(res.status).toBe(400);
  });
});
