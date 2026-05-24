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
      return classifyPayazaVerifyResult(res.ok, res.status, json, reference);
    } catch (e) {
      return {
        ok: false,
        errorCode: 'NETWORK_ERROR',
        errorMessage: e instanceof Error ? e.message : String(e),
      };
    }
  }
}

/**
 * Pure mapping from Payaza's transaction-query response to a PaymentVerifyResult.
 * Exported for unit testing.
 *
 * Correctness rule this encodes: a 200 OK that carries NO transaction record
 * means the payment never completed (e.g. the card was declined before Payaza
 * created a transaction). That MUST resolve to 'failed' — not 'pending' — so the
 * applicant sees the retry path instead of a perpetual "Still confirming" screen.
 *
 * The previous implementation fell back to the whole response body whenever
 * `data` was absent (`?? obj`), which produced an empty status string that
 * defaulted to 'pending' and stranded failed payments forever.
 */
export function classifyPayazaVerifyResult(
  httpOk: boolean,
  httpStatus: number,
  json: unknown,
  reference: string,
): PaymentVerifyResult {
  if (!httpOk) {
    return {
      ok: false,
      errorCode: extractCode(json) ?? `HTTP_${httpStatus}`,
      errorMessage: extractMessage(json) ?? 'Verify failed',
    };
  }

  const data = extractTransactionData(json);
  if (!data) {
    // 200 OK but Payaza has no transaction for this reference → no charge
    // occurred. Resolve to failed so the applicant gets the retry path.
    return {
      ok: true,
      status: 'failed',
      providerTransactionId: reference,
      amountCents: 0,
      currency: 'USD',
      raw: json,
    };
  }

  const statusRaw = (data.transaction_status ?? data.status ?? '').toString().toLowerCase().trim();
  let status: PaymentStatus;
  if (isSuccessStatus(statusRaw)) {
    status = 'paid';
  } else if (statusRaw === '' || isFailureStatus(statusRaw)) {
    // A transaction object with no status, or an explicit failure status, is
    // terminal — never leave these on 'pending'.
    status = 'failed';
  } else {
    // A recognized in-flight status (e.g. "Processing", "Pending", "Initiated").
    status = 'pending';
  }

  return {
    ok: true,
    status,
    providerTransactionId: String(
      data.transaction_reference ?? data.transaction_id ?? data.id ?? reference,
    ),
    amountCents: Math.round(Number(data.amount_received ?? data.amount ?? 0) * 100),
    currency: ((data.currency ?? 'USD') as 'USD' | 'NGN' | 'GHS'),
    paidAt: data.current_status_date ?? data.transaction_date ?? data.paid_at ?? data.initiated_date,
    paymentMethod: data.payment_channel ?? data.channel,
    raw: json,
  };
}

function isSuccessStatus(s: string): boolean {
  return s.includes('success') || s === 'paid' || s === 'completed';
}

function isFailureStatus(s: string): boolean {
  return ['fail', 'declin', 'cancel', 'revers', 'insufficient', 'expire', 'abandon', 'unsuccess', 'void', 'error']
    .some((k) => s.includes(k));
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
  transaction_reference?: string;
  merchant_transaction_reference?: string;
  transaction_status?: string;
  status?: string;
  amount?: number | string;
  amount_received?: number | string;
  currency?: string;
  transaction_date?: string;
  paid_at?: string;
  initiated_date?: string;
  current_status_date?: string;
  status_reason?: string;
  payment_channel?: string;
  channel?: string;
};

function extractTransactionData(json: unknown): TransactionData | null {
  if (typeof json !== 'object' || json === null) return null;
  const obj = json as Record<string, unknown>;
  // Payaza wraps a found transaction as { message, data: {...} }. Prefer that.
  const nested = obj.data ?? obj.transaction;
  if (nested && typeof nested === 'object') return nested as TransactionData;
  // Only fall back to the top-level object when it actually carries a status
  // field — NEVER blindly. A "transaction not found" body has no status, so
  // returning it here would default to 'pending' and strand failed payments.
  if ('transaction_status' in obj || 'status' in obj) return obj as TransactionData;
  return null;
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
