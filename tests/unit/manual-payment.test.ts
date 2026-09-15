import { describe, it, expect, vi, beforeEach } from 'vitest';
import { manualPaymentsEnabled, MOMO_NUMBER, MOMO_RECIPIENT, MOMO_INTERNATIONAL, MOMO_WHATSAPP, MOMO_FEE_CENTS } from '@/lib/payment/manual';
import { runPaymentVerification } from '@/lib/payment/verify-flow';
import { POST } from '@/pages/api/admin/applications/[id]/confirm-payment';
import { checkAdminAuth } from '@/middleware/admin-auth';
import { getApplicationById, getApplicationByReference, getCycle, markPaymentPaid } from '@/lib/db/queries';
import { getPaymentProvider } from '@/lib/payment';
vi.mock('@/middleware/admin-auth', () => ({ checkAdminAuth: vi.fn() }));
vi.mock('@/lib/db/queries', () => ({ getApplicationById: vi.fn(), getApplicationByReference: vi.fn(), getCycle: vi.fn(), markPaymentPaid: vi.fn(), markPaymentFailed: vi.fn(), setApplyTokenIssued: vi.fn(), insertAdminAudit: vi.fn() }));
vi.mock('@/lib/tokens/apply-token', () => ({ signApplyToken: vi.fn().mockResolvedValue('signed-token') }));
vi.mock('@/lib/crypto/hash', () => ({ hashIp: vi.fn().mockResolvedValue('hashed-ip') }));
vi.mock('@/lib/email', () => ({ getEmailProvider: () => ({ send: async () => ({ ok: true }) }), renderMagicLinkEmail: () => ({ subject: 'Application', html: 'link' }) }));
vi.mock('@/lib/email/notify-team', () => ({ notifyTeam: vi.fn().mockResolvedValue(undefined) }));
vi.mock('@/lib/payment', () => ({ getPaymentProvider: vi.fn() }));
const app = { id: 'one', transaction_reference: 'MOMO-TEST-123', payment_status: 'pending', payment_currency: 'GHS', payment_amount_cents: 23000, cycle_id: 'cycle' };
function context(body: unknown, origin = 'https://example.com') {
  return { request: new Request('https://example.com/api/admin/applications/one/confirm-payment', { method: 'POST', headers: { origin, 'Content-Type': 'application/json' }, body: JSON.stringify(body) }),
    params: { id: 'one' }, locals: { runtime: { env: { DB: { prepare: () => ({ bind: () => ({ first: async () => ({ id: 'other' }) }) }) } } } },
  } as unknown as Parameters<typeof POST>[0];
}
const receipt = { transactionId: '123456', receivedAmountGhs: 230, confirmed: true };
beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(checkAdminAuth).mockResolvedValue({ ok: true, adminEmail: 'staff@example.com', sessionId: 'session' });
  vi.mocked(getApplicationById).mockResolvedValue(app as Awaited<ReturnType<typeof getApplicationById>>);
  vi.mocked(getApplicationByReference).mockResolvedValue(app as Awaited<ReturnType<typeof getApplicationByReference>>);
  vi.mocked(getCycle).mockResolvedValue({ is_active: 1, applications_close_at: '2099-01-01' } as Awaited<ReturnType<typeof getCycle>>);
});
describe('manual payment controls', () => {
  it('defaults to manual with the approved number and amount, and allows explicit rollback', () => {
    expect(manualPaymentsEnabled({})).toBe(true);
    expect(manualPaymentsEnabled({ PAYMENT_MODE: 'payaza' })).toBe(false);
    expect(MOMO_NUMBER).toBe('0598913323');
    expect(MOMO_RECIPIENT).toBe('Ebenezer Adjetey Sowah');
    expect(MOMO_INTERNATIONAL).toBe('+233598913323');
    expect(MOMO_WHATSAPP).toBe('https://wa.me/233598913323');
    expect(MOMO_FEE_CENTS).toBe(23000);
  });
  it('public verification never calls a gateway or marks a manual reference paid', async () => {
    const result = await runPaymentVerification({ DB: {} } as App.Locals['runtime']['env'], app.transaction_reference, 'https://example.com');
    expect(result).toMatchObject({ ok: true, status: 'pending' });
    expect(getPaymentProvider).not.toHaveBeenCalled();
    expect(markPaymentPaid).not.toHaveBeenCalled();
  });
  it('rejects unauthenticated confirmations', async () => {
    vi.mocked(checkAdminAuth).mockResolvedValue({ ok: false, reason: 'no_cookie' });
    expect((await POST(context(receipt))).status).toBe(401);
    expect(markPaymentPaid).not.toHaveBeenCalled();
  });
  it('rejects cross-origin confirmations', async () => {
    expect((await POST(context(receipt, 'https://attacker.example'))).status).toBe(403);
    expect(markPaymentPaid).not.toHaveBeenCalled();
  });
  it('rejects an incorrect received amount', async () => {
    expect((await POST(context({ ...receipt, receivedAmountGhs: 20 }))).status).toBe(400);
    expect(markPaymentPaid).not.toHaveBeenCalled();
  });
  it('confirms a verified receipt and emails access without exposing the token in the API response', async () => {
    const ctx = context(receipt);
    ctx.locals.runtime.env.DB = { prepare: () => ({ bind: () => ({ first: async () => null }) }) } as unknown as D1Database;
    ctx.locals.runtime.env.KV = { get: async () => null, put: async () => {} } as unknown as KVNamespace;
    vi.mocked(markPaymentPaid).mockResolvedValue({ ok: true });
    const response = await POST(ctx);
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true, emailSent: true });
    expect(markPaymentPaid).toHaveBeenCalledWith(ctx.locals.runtime.env.DB, 'one', 'MOMO:123456', expect.any(String));
  });
  it('rejects a receipt already used by another application', async () => {
    const response = await POST(context(receipt));
    expect(response.status).toBe(409);
    expect(await response.json()).toMatchObject({ error: 'receipt_already_used' });
    expect(markPaymentPaid).not.toHaveBeenCalled();
  });
});
