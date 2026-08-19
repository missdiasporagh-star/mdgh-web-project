import { describe, it, expect } from 'vitest';
import { MockProvider } from '@/lib/payment/mock-provider';

const provider = new MockProvider();

describe('MockProvider.init', () => {
  it('returns ok with a checkoutUrl carrying the reference', async () => {
    const r = await provider.init({
      amountCents: 5000, currency: 'GHS', reference: 'MDGH-2026-AAAAAAAA',
      customerEmail: 'a@b.com', callbackUrl: 'https://x/return',
    });
    expect(r.ok).toBe(true);
    if (r.ok && r.flow === 'redirect') {
      expect(r.checkoutUrl).toContain('MDGH-2026-AAAAAAAA');
      expect(r.providerReference).toBe('mock-MDGH-2026-AAAAAAAA');
    }
  });
});

describe('MockProvider.verify', () => {
  it('returns paid for normal references', async () => {
    const r = await provider.verify('MDGH-2026-AAAAAAAA');
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.status).toBe('paid');
      expect(r.amountCents).toBe(2000);
      expect(r.currency).toBe('GHS');
      expect(r.paymentMethod).toBe('card');
      expect(r.paidAt).toBeDefined();
    }
  });

  it('returns failed for references ending in -FAIL', async () => {
    const r = await provider.verify('MDGH-2026-FAIL');
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.status).toBe('failed');
  });

  it('returns pending for references ending in -PENDING', async () => {
    const r = await provider.verify('MDGH-2026-PENDING');
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.status).toBe('pending');
  });
});
