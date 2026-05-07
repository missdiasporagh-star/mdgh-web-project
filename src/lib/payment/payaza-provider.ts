import type {
  PaymentProvider, PaymentInitInput, PaymentInitResult, PaymentVerifyResult, PaymentStatus,
} from './types';

type PayazaEnv = {
  PAYAZA_PUBLIC_KEY: string;
  PAYAZA_SECRET_KEY: string;
  PAYAZA_BASE_URL: string;
};

export class PayazaProvider implements PaymentProvider {
  constructor(private readonly env: PayazaEnv) {}

  async init(input: PaymentInitInput): Promise<PaymentInitResult> {
    try {
      const res = await fetch(`${this.env.PAYAZA_BASE_URL}/checkout/initiate`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.env.PAYAZA_SECRET_KEY}`,
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({
          reference: input.reference,
          amount: input.amountCents / 100,
          currency: input.currency,
          email: input.customerEmail,
          name: input.customerName,
          callback_url: input.callbackUrl,
          metadata: input.metadata ?? {},
        }),
      });
      const json = await safeJson(res);
      if (!res.ok || !isSuccessShape(json)) {
        return {
          ok: false,
          errorCode: extractCode(json) ?? `HTTP_${res.status}`,
          errorMessage: extractMessage(json) ?? 'Checkout init failed',
        };
      }
      const data = (json as { data: { checkout_url: string; transaction_id: string } }).data;
      return { ok: true, checkoutUrl: data.checkout_url, providerReference: data.transaction_id };
    } catch (e) {
      return {
        ok: false,
        errorCode: 'NETWORK_ERROR',
        errorMessage: e instanceof Error ? e.message : String(e),
      };
    }
  }

  async verify(reference: string): Promise<PaymentVerifyResult> {
    try {
      const res = await fetch(
        `${this.env.PAYAZA_BASE_URL}/transactions/verify/${encodeURIComponent(reference)}`,
        {
          headers: {
            Authorization: `Bearer ${this.env.PAYAZA_SECRET_KEY}`,
            Accept: 'application/json',
          },
        }
      );
      const json = await safeJson(res);
      if (!res.ok || !isSuccessShape(json)) {
        return {
          ok: false,
          errorCode: extractCode(json) ?? `HTTP_${res.status}`,
          errorMessage: extractMessage(json) ?? 'Verify failed',
        };
      }
      const d = (json as { data: VerifyData }).data;
      const status: PaymentStatus =
        d.status === 'success' || d.status === 'paid' ? 'paid'
        : d.status === 'failed' || d.status === 'declined' ? 'failed'
        : 'pending';
      return {
        ok: true,
        status,
        providerTransactionId: d.transaction_id ?? d.id ?? reference,
        amountCents: Math.round(Number(d.amount) * 100),
        currency: (d.currency ?? 'USD') as 'USD' | 'NGN' | 'GHS',
        paidAt: d.paid_at,
        paymentMethod: d.channel,
        raw: json,
      };
    } catch (e) {
      return {
        ok: false,
        errorCode: 'NETWORK_ERROR',
        errorMessage: e instanceof Error ? e.message : String(e),
      };
    }
  }
}

type VerifyData = {
  status: string;
  transaction_id?: string;
  id?: string;
  amount: number | string;
  currency?: string;
  paid_at?: string;
  channel?: string;
};

async function safeJson(res: Response): Promise<unknown> {
  try { return await res.json(); } catch { return {}; }
}

function isSuccessShape(json: unknown): json is { status: 'success'; data: unknown } {
  return typeof json === 'object' && json !== null
    && (json as { status?: unknown }).status === 'success'
    && typeof (json as { data?: unknown }).data === 'object';
}

function extractCode(json: unknown): string | undefined {
  if (typeof json === 'object' && json !== null) {
    const c = (json as { code?: unknown }).code;
    if (typeof c === 'string') return c;
  }
  return undefined;
}

function extractMessage(json: unknown): string | undefined {
  if (typeof json === 'object' && json !== null) {
    const m = (json as { message?: unknown }).message;
    if (typeof m === 'string') return m;
  }
  return undefined;
}
