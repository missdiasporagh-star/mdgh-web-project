export type Currency = 'USD' | 'NGN' | 'GHS';

export type PaymentInitInput = {
  amountCents: number;
  currency: Currency;
  reference: string;
  customerEmail: string;
  customerName?: string;
  callbackUrl: string;
  metadata?: Record<string, string>;
};

export type PaymentInitResult =
  | { ok: true; checkoutUrl: string; providerReference: string }
  | { ok: false; errorCode: string; errorMessage: string };

export type PaymentStatus = 'paid' | 'pending' | 'failed';

export type PaymentVerifyResult =
  | { ok: true;
      status: PaymentStatus;
      providerTransactionId: string;
      amountCents: number;
      currency: Currency;
      paidAt?: string;
      paymentMethod?: string;
      raw: unknown;
    }
  | { ok: false; errorCode: string; errorMessage: string };

export interface PaymentProvider {
  init(input: PaymentInitInput): Promise<PaymentInitResult>;
  verify(reference: string): Promise<PaymentVerifyResult>;
}
