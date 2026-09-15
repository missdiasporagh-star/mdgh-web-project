import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
import { POST } from '@/pages/api/admin/applications/[id]/confirm-gateway-payment';
import { checkAdminAuth } from '@/middleware/admin-auth';
import { getApplicationById, getCycle } from '@/lib/db/queries';
import { deliverPaidApplication } from '@/lib/payment/verify-flow';
vi.mock('@/middleware/admin-auth', () => ({ checkAdminAuth: vi.fn() }));
vi.mock('@/lib/db/queries', () => ({ getApplicationById: vi.fn(), getCycle: vi.fn() }));
vi.mock('@/lib/payment/verify-flow', () => ({ deliverPaidApplication: vi.fn() }));
vi.mock('@/lib/crypto/hash', () => ({ hashIp: vi.fn().mockResolvedValue('hash') }));
const app = { id: 'one', payment_status: 'pending', cycle_id: 'cycle' };
function context(body: unknown = { note: 'Paid through previous gateway during outage', confirmed: true }, origin = 'https://example.com') {
  return { request: new Request('https://example.com/api/admin/applications/one/confirm-gateway-payment', { method: 'POST', headers: { origin, 'Content-Type': 'application/json' }, body: JSON.stringify(body) }), params: { id: 'one' }, locals: { runtime: { env: { DB: {} } } } } as unknown as Parameters<typeof POST>[0];
}
beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(checkAdminAuth).mockResolvedValue({ ok: true, adminEmail: 'staff@example.com', sessionId: 'session' });
  vi.mocked(getApplicationById).mockResolvedValue(app as Awaited<ReturnType<typeof getApplicationById>>);
  vi.mocked(getCycle).mockResolvedValue({ is_active: 1, applications_close_at: '2099-01-01' } as Awaited<ReturnType<typeof getCycle>>);
  vi.mocked(deliverPaidApplication).mockResolvedValue({ ok: true, status: 'paid', applicationId: 'one', emailSent: true });
});
describe('staff gateway confirmation', () => {
  it('requires admin authentication', async () => {
    vi.mocked(checkAdminAuth).mockResolvedValue({ ok: false, reason: 'no_cookie' });
    expect((await POST(context())).status).toBe(401);
    expect(deliverPaidApplication).not.toHaveBeenCalled();
  });
  it('requires same origin and explicit attestation', async () => {
    expect((await POST(context({}, 'https://attacker.example'))).status).toBe(403);
    expect((await POST(context({ note: 'Previous gateway payment', confirmed: false }))).status).toBe(400);
    expect(deliverPaidApplication).not.toHaveBeenCalled();
  });
  it('atomically records staff provenance and leaves transaction ID untouched', async () => {
    const db = new DatabaseSync(':memory:');
    db.exec(readFileSync('migrations/0004_admin_audit.sql', 'utf8'));
    db.exec("CREATE TABLE applications (id TEXT PRIMARY KEY, payment_status TEXT, payment_verified_at TEXT, updated_at TEXT, payaza_transaction_id TEXT); INSERT INTO applications (id,payment_status) VALUES ('one','pending');");
    const ctx = context();
    ctx.locals.runtime.env.DB = {
      prepare: (sql: string) => ({ bind: (...values: (string | number | null)[]) => ({ sql, values }) }),
      batch: async (statements: { sql: string; values: (string | number | null)[] }[]) => {
        db.exec('BEGIN');
        try { for (const statement of statements) db.prepare(statement.sql).run(...statement.values); db.exec('COMMIT'); }
        catch (error) { db.exec('ROLLBACK'); throw error; }
      },
    } as unknown as D1Database;
    vi.mocked(getApplicationById).mockImplementation(async () => ({ ...app, ...db.prepare('SELECT * FROM applications').get() }) as Awaited<ReturnType<typeof getApplicationById>>);
    expect((await POST(ctx)).status).toBe(200);
    expect(db.prepare('SELECT payment_status, payaza_transaction_id FROM applications').get()).toMatchObject({ payment_status: 'paid', payaza_transaction_id: null });
    const audit = db.prepare('SELECT details_json FROM admin_audit').get() as { details_json: string };
    expect(JSON.parse(audit.details_json)).toMatchObject({ verificationSource: 'staff_attestation', providerVerified: false });
    expect(deliverPaidApplication).toHaveBeenCalledOnce();
    db.close();
  });
  it('does not send access on a duplicate paid application conflict', async () => {
    const ctx = context();
    ctx.locals.runtime.env.DB = { prepare: () => ({ bind: () => ({}) }), batch: async () => { throw new Error('UNIQUE constraint'); } } as unknown as D1Database;
    expect((await POST(ctx)).status).toBe(409);
    expect(deliverPaidApplication).not.toHaveBeenCalled();
  });
});
