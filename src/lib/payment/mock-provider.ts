import type { PaymentProvider, PaymentInitInput, PaymentInitResult, PaymentVerifyResult, PaymentStatus } from './types';

export class MockProvider implements PaymentProvider {
  async init(input: PaymentInitInput): Promise<PaymentInitResult> {
    return {
      ok: true,
      flow: 'redirect',
      checkoutUrl: `/mock-checkout?reference=${encodeURIComponent(input.reference)}&callback=${encodeURIComponent(input.callbackUrl)}`,
      providerReference: `mock-${input.reference}`,
    };
  }

  async verify(reference: string): Promise<PaymentVerifyResult> {
    let status: PaymentStatus = 'paid';
    if (reference.endsWith('-FAIL')) status = 'failed';
    else if (reference.endsWith('-PENDING')) status = 'pending';

    return {
      ok: true,
      status,
      providerTransactionId: `mock-${reference}`,
      amountCents: 2000,
      currency: 'USD',
      paidAt: status === 'paid' ? new Date().toISOString() : undefined,
      paymentMethod: 'card',
      raw: { mock: true, reference, status },
    };
  }
}
