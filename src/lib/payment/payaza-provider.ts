import type {
  PaymentProvider, PaymentInitInput, PaymentInitResult, PaymentVerifyResult, PaymentStatus,
} from './types';

type PayazaEnv = {
  PAYAZA_PUBLIC_KEY: string;
  PAYAZA_SECRET_KEY: string;
};

// Payaza's verification endpoint is the same URL for both test and live modes.
// The connection_mode passed to the client SDK determines which environment the
// payment actually executes in. Confirmed from Payaza's official WooCommerce
// plugin (class-wc-gateway-payaza.php).
const VERIFY_URL = 'https://api.payaza.africa/live/merchant-collection/transfer_notification_controller/merchant/transaction-query';

export class PayazaProvider implements PaymentProvider {
  constructor(private readonly env: PayazaEnv) {}

  async init(input: PaymentInitInput): Promise<PaymentInitResult> {
    const connectionMode: 'Test' | 'Live' =
      this.env.PAYAZA_PUBLIC_KEY.includes('PKTEST') ? 'Test' : 'Live';

    const { firstName, lastName } = deriveNameFromEmail(input.customerEmail, input.customerName);

    return {
      ok: true,
      flow: 'sdk',
      providerReference: input.reference,
      sdkBootstrap: {
        publicKey: this.env.PAYAZA_PUBLIC_KEY,
        connectionMode,
        amount: input.amountCents / 100,
        currency: input.currency,
        reference: input.reference,
        email: input.customerEmail,
        firstName,
        lastName,
        // Phone isn't collected in the prequalification step (only after
        // payment, in the long-form application). The Payaza SDK client-
        // side validator accepts an empty string, but the SERVER-side
        // verify endpoint rejects with status_reason="Value '' is invalid.
        // Length is 0 digits but must be at least 1 country code digit"
        // when the transaction is processed.
        //
        // Use a Ghana country-code placeholder ('+233' + 9 zeros to form
        // a complete-length number) until phone is collected upfront.
        // Followup: surface phone in the prequalification form so this
        // can be the real number.
        phoneNumber: input.customerPhone ?? '+233000000000',
      },
    };
  }

  async verify(reference: string): Promise<PaymentVerifyResult> {
    try {
      const url = `${VERIFY_URL}?merchant_reference=${encodeURIComponent(reference)}`;
      const encodedKey = btoa(this.env.PAYAZA_PUBLIC_KEY);
      const res = await fetch(url, {
        method: 'GET',
        headers: {
          Authorization: `Payaza ${encodedKey}`,
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
      });
      const rawText = await res.text();
      let json: unknown;
      try { json = JSON.parse(rawText); } catch { json = {}; }
      if (!res.ok) {
        return {
          ok: false,
          errorCode: extractCode(json) ?? `HTTP_${res.status}`,
          errorMessage: extractMessage(json) ?? 'Verify failed',
        };
      }
      const data = extractTransactionData(json);
      if (!data) {
        return {
          ok: false,
          errorCode: 'INVALID_RESPONSE',
          errorMessage: 'Payaza verify response missing transaction data',
        };
      }
      const statusRaw = (data.transaction_status ?? data.status ?? '').toString().toLowerCase();
      const status: PaymentStatus =
        statusRaw.includes('success') || statusRaw === 'paid' || statusRaw === 'completed' ? 'paid'
        : statusRaw.includes('fail') || statusRaw === 'declined' || statusRaw === 'cancelled' ? 'failed'
        : 'pending';
      return {
        ok: true,
        status,
        providerTransactionId: String(data.transaction_id ?? data.id ?? reference),
        amountCents: Math.round(Number(data.amount ?? 0) * 100),
        currency: ((data.currency ?? 'USD') as 'USD' | 'NGN' | 'GHS'),
        paidAt: data.transaction_date ?? data.paid_at,
        paymentMethod: data.payment_channel ?? data.channel,
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

function deriveNameFromEmail(email: string, customerName?: string): { firstName: string; lastName: string } {
  if (customerName) {
    const parts = customerName.trim().split(/\s+/);
    return { firstName: parts[0] || 'Applicant', lastName: parts.slice(1).join(' ') || 'Applicant' };
  }
  const local = (email.split('@')[0] || 'Applicant').replace(/[^A-Za-z0-9]/g, ' ').trim();
  return { firstName: local || 'Applicant', lastName: 'Applicant' };
}

type TransactionData = {
  transaction_id?: string | number;
  id?: string | number;
  transaction_status?: string;
  status?: string;
  amount?: number | string;
  currency?: string;
  transaction_date?: string;
  paid_at?: string;
  payment_channel?: string;
  channel?: string;
};

function extractTransactionData(json: unknown): TransactionData | null {
  if (typeof json !== 'object' || json === null) return null;
  const obj = json as Record<string, unknown>;
  const candidate = (obj.data ?? obj.transaction ?? obj) as Record<string, unknown> | undefined;
  if (!candidate || typeof candidate !== 'object') return null;
  return candidate as TransactionData;
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
