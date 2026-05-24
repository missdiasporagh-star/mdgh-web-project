/**
 * Pure helpers for the Payaza collection webhook. Kept out of the route file so
 * they can be unit-tested without the Astro/Worker request harness.
 */

/** Extract our merchant reference (MDGH-YYYY-XXXXXXXX) from a webhook body. */
export function extractMerchantReference(body: unknown): string | null {
  if (typeof body !== 'object' || body === null) return null;
  const b = body as Record<string, unknown>;
  const data = (b.data && typeof b.data === 'object' ? (b.data as Record<string, unknown>) : {}) ?? {};
  const candidates = [
    b.merchant_transaction_reference,
    b.merchant_reference,
    data.merchant_transaction_reference,
    data.merchant_reference,
  ];
  for (const c of candidates) {
    if (typeof c === 'string' && c.length > 0) return c;
  }
  return null;
}

/** Constant-time token comparison. */
export function verifyWebhookToken(provided: string, expected: string): boolean {
  if (!expected || provided.length !== expected.length) return false;
  let mismatch = 0;
  for (let i = 0; i < expected.length; i++) {
    mismatch |= provided.charCodeAt(i) ^ expected.charCodeAt(i);
  }
  return mismatch === 0;
}
