import { describe, it, expect } from 'vitest';
import { markPaymentPaid } from '@/lib/db/queries';

/**
 * Fake D1 that lets a test decide whether the "mark paid" UPDATE throws the
 * partial-unique-index violation (migration 0007). Records every run() so we can
 * assert how the conflict was parked.
 */
function fakeDb(opts: { throwOnPaid: boolean }) {
  const runs: { sql: string; params: unknown[] }[] = [];
  const DB = {
    prepare(sql: string) {
      const params: unknown[] = [];
      const stmt = {
        bind(...args: unknown[]) { params.push(...args); return stmt; },
        async run() {
          const isPaidUpdate = sql.includes("payment_status = 'paid'");
          if (isPaidUpdate && opts.throwOnPaid) {
            throw new Error('D1_ERROR: UNIQUE constraint failed: index idx_app_one_paid_per_cycle');
          }
          runs.push({ sql, params });
          return { meta: { changes: 1 } };
        },
      };
      return stmt;
    },
  } as unknown as D1Database;
  return { DB, runs };
}

describe('markPaymentPaid', () => {
  it('returns ok on a clean write', async () => {
    const { DB, runs } = fakeDb({ throwOnPaid: false });
    const r = await markPaymentPaid(DB, 'app-1', 'txn-1', '2026-06-04T00:00:00Z');
    expect(r).toEqual({ ok: true });
    expect(runs.some((x) => x.sql.includes("payment_status = 'paid'"))).toBe(true);
  });

  it('parks the row as expired and reports conflict on a unique violation', async () => {
    const { DB, runs } = fakeDb({ throwOnPaid: true });
    const r = await markPaymentPaid(DB, 'app-2', 'txn-2', '2026-06-04T00:00:00Z');
    expect(r).toEqual({ ok: false, conflict: true });
    // The only successful write should be the "park as expired" fallback.
    expect(runs.length).toBe(1);
    expect(runs[0].sql).toContain("payment_status = 'expired'");
    expect(runs[0].params[0]).toBe('duplicate_paid_same_email_blocked:txn-2');
  });

  it('rethrows non-unique errors', async () => {
    const DB = {
      prepare() {
        return {
          bind() { return this; },
          async run() { throw new Error('D1_ERROR: database is locked'); },
        };
      },
    } as unknown as D1Database;
    await expect(markPaymentPaid(DB, 'app-3', 'txn-3', '2026-06-04T00:00:00Z')).rejects.toThrow(/locked/);
  });
});
