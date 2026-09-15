import { beforeEach, describe, expect, it, vi } from 'vitest';
import { POST } from '@/pages/api/admin/applications/[id]/email-link';
import { checkAdminAuth } from '@/middleware/admin-auth';
import { getApplicationById, getCycle, setApplyTokenIssued } from '@/lib/db/queries';
const { send } = vi.hoisted(() => ({ send: vi.fn() }));
vi.mock('@/middleware/admin-auth', () => ({ checkAdminAuth: vi.fn() }));
vi.mock('@/lib/db/queries', () => ({ getApplicationById: vi.fn(), getCycle: vi.fn(), setApplyTokenIssued: vi.fn(), insertAdminAudit: vi.fn() }));
vi.mock('@/lib/tokens/apply-token', () => ({ signApplyToken: vi.fn().mockResolvedValue('private-token') }));
vi.mock('@/lib/crypto/hash', () => ({ hashIp: vi.fn().mockResolvedValue('ip-hash') }));
vi.mock('@/lib/email', () => ({ getEmailProvider: () => ({ send }), renderRecoveryEmail: () => ({ subject: 'Application', html: 'link', text: 'link', category: 'application' }) }));
const app = { id: 'one', email: 'applicant@example.com', payment_status: 'paid', cycle_id: 'cycle', transaction_reference: 'MDGH-TEST' };
function context(origin = 'https://example.com') {
  return { request: new Request('https://example.com/api/admin/applications/one/email-link', { method: 'POST', headers: { origin } }), params: { id: 'one' },
    locals: { runtime: { env: { DB: {}, MOCK_EMAIL: 'true', KV: { get: async () => null, put: async () => {} } } } },
  } as unknown as Parameters<typeof POST>[0];
}
beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(checkAdminAuth).mockResolvedValue({ ok: true, adminEmail: 'staff@example.com', sessionId: 'session' });
  vi.mocked(getApplicationById).mockResolvedValue(app as Awaited<ReturnType<typeof getApplicationById>>);
  vi.mocked(getCycle).mockResolvedValue({ is_active: 1, applications_close_at: '2099-01-01' } as Awaited<ReturnType<typeof getCycle>>);
  send.mockResolvedValue({ ok: true, providerMessageId: 'email-id' });
});
describe('admin application link email', () => {
  it('requires an authenticated admin', async () => {
    vi.mocked(checkAdminAuth).mockResolvedValue({ ok: false, reason: 'no_cookie' });
    expect((await POST(context())).status).toBe(401);
    expect(send).not.toHaveBeenCalled();
  });
  it('rejects cross-origin requests', async () => {
    expect((await POST(context('https://attacker.example'))).status).toBe(403);
    expect(send).not.toHaveBeenCalled();
  });
  it('never emails access for pending payments', async () => {
    vi.mocked(getApplicationById).mockResolvedValue({ ...app, payment_status: 'pending' } as Awaited<ReturnType<typeof getApplicationById>>);
    expect((await POST(context())).status).toBe(409);
    expect(send).not.toHaveBeenCalled();
  });
  it('emails only the stored applicant address and never returns the bearer token', async () => {
    const response = await POST(context());
    expect(await response.json()).toEqual({ ok: true, emailSent: true });
    expect(send).toHaveBeenCalledWith(expect.objectContaining({ to: app.email }));
    expect(setApplyTokenIssued).toHaveBeenCalled();
  });
  it('reports provider rejection without recording successful issuance', async () => {
    send.mockResolvedValue({ ok: false, errorCode: 'rejected' });
    expect((await POST(context())).status).toBe(502);
    expect(setApplyTokenIssued).not.toHaveBeenCalled();
  });
  it('reports network errors without recording successful issuance', async () => {
    send.mockRejectedValue(new Error('network'));
    expect((await POST(context())).status).toBe(502);
    expect(setApplyTokenIssued).not.toHaveBeenCalled();
  });
  it('does not fall back to mock email when production credentials are absent', async () => {
    const ctx = context();
    ctx.locals.runtime.env.MOCK_EMAIL = 'false';
    expect((await POST(ctx)).status).toBe(503);
    expect(send).not.toHaveBeenCalled();
  });
  it('limits repeated admin sends', async () => {
    const ctx = context();
    ctx.locals.runtime.env.KV = { get: async () => '3' } as unknown as KVNamespace;
    expect((await POST(ctx)).status).toBe(429);
    expect(send).not.toHaveBeenCalled();
  });
});
