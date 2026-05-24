import { describe, it, expect } from 'vitest';
import { extractMerchantReference, verifyWebhookToken } from './payaza-webhook';

describe('extractMerchantReference', () => {
  it('reads top-level merchant_transaction_reference', () => {
    expect(extractMerchantReference({ merchant_transaction_reference: 'MDGH-2026-AAA' })).toBe('MDGH-2026-AAA');
  });
  it('reads nested data.merchant_transaction_reference', () => {
    expect(extractMerchantReference({ data: { merchant_transaction_reference: 'MDGH-2026-BBB' } })).toBe('MDGH-2026-BBB');
  });
  it('reads merchant_reference fallback', () => {
    expect(extractMerchantReference({ data: { merchant_reference: 'MDGH-2026-CCC' } })).toBe('MDGH-2026-CCC');
  });
  it('returns null when no reference present', () => {
    expect(extractMerchantReference({ message: 'hello' })).toBeNull();
    expect(extractMerchantReference(null)).toBeNull();
    expect(extractMerchantReference('nope')).toBeNull();
  });
});

describe('verifyWebhookToken', () => {
  it('accepts an exact match', () => {
    expect(verifyWebhookToken('s3cr3t-token', 's3cr3t-token')).toBe(true);
  });
  it('rejects mismatch, empty, and length differences', () => {
    expect(verifyWebhookToken('s3cr3t-token', 'wrong')).toBe(false);
    expect(verifyWebhookToken('', 's3cr3t-token')).toBe(false);
    expect(verifyWebhookToken('s3cr3t-token', '')).toBe(false);
  });
});
