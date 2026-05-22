import { describe, it, expect } from 'vitest';
import { signApplyToken } from '@/lib/tokens/apply-token';
import { validateApplyToken } from '@/lib/tokens/validate-apply-token';

const SECRET = 'a'.repeat(64);

function fakeDb(rows: Record<string, unknown>) {
  return {
    prepare(_: string) {
      return {
        bind(id: string) {
          return { async first() { return rows[id] ?? null; } };
        },
      };
    },
  } as unknown as D1Database;
}

const FUTURE = Math.floor(Date.now() / 1000) + 3600;

describe('validateApplyToken', () => {
  it('passes for paid, unsubmitted, open cycle', async () => {
    const token = await signApplyToken('app1', FUTURE, SECRET);
    const result = await validateApplyToken(token, SECRET, fakeDb({
      app1: { id: 'app1', payment_status: 'paid', submitted_at: null, cycle_id: 'C1' },
      C1: { id: 'C1', is_active: 1, applications_close_at: '2099-01-01T00:00:00Z' },
    }));
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.applicationId).toBe('app1');
  });

  it('rejects unpaid', async () => {
    const token = await signApplyToken('app2', FUTURE, SECRET);
    const result = await validateApplyToken(token, SECRET, fakeDb({
      app2: { id: 'app2', payment_status: 'pending', submitted_at: null, cycle_id: 'C1' },
      C1: { id: 'C1', is_active: 1, applications_close_at: '2099-01-01T00:00:00Z' },
    }));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('not_paid');
  });

  it('rejects already-submitted', async () => {
    const token = await signApplyToken('app3', FUTURE, SECRET);
    const result = await validateApplyToken(token, SECRET, fakeDb({
      app3: { id: 'app3', payment_status: 'paid', submitted_at: '2026-05-10T00:00:00Z', cycle_id: 'C1' },
      C1: { id: 'C1', is_active: 1, applications_close_at: '2099-01-01T00:00:00Z' },
    }));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('already_submitted');
  });

  it('rejects when cycle has closed', async () => {
    const token = await signApplyToken('app4', FUTURE, SECRET);
    const result = await validateApplyToken(token, SECRET, fakeDb({
      app4: { id: 'app4', payment_status: 'paid', submitted_at: null, cycle_id: 'C1' },
      C1: { id: 'C1', is_active: 1, applications_close_at: '2020-01-01T00:00:00Z' },
    }));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('cycle_closed');
  });

  it('rejects bad signature (delegated)', async () => {
    const token = await signApplyToken('app5', FUTURE, SECRET);
    const result = await validateApplyToken(token, 'b'.repeat(64), fakeDb({}));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('bad_signature');
  });
});
