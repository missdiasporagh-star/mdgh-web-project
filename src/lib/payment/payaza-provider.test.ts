import { describe, it, expect } from 'vitest';
import { classifyPayazaVerifyResult } from './payaza-provider';

const REF = 'MDGH-2026-TESTREF1';

describe('classifyPayazaVerifyResult', () => {
  it('maps a successful transaction to paid', () => {
    const json = {
      message: 'Transaction data found',
      data: { transaction_status: 'Success', amount: 25.99, currency: 'USD', transaction_id: 'P-C-123' },
    };
    const r = classifyPayazaVerifyResult(true, 200, json, REF);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.status).toBe('paid');
      expect(r.amountCents).toBe(2599);
      expect(r.providerTransactionId).toBe('P-C-123');
    }
  });

  it('maps an explicit "Failed" transaction to failed', () => {
    const json = { message: 'Transaction data found', data: { transaction_status: 'Failed' } };
    const r = classifyPayazaVerifyResult(true, 200, json, REF);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.status).toBe('failed');
  });

  it('maps "Transaction Declined" to failed (broadened matching)', () => {
    const json = { data: { transaction_status: 'Transaction Declined' } };
    const r = classifyPayazaVerifyResult(true, 200, json, REF);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.status).toBe('failed');
  });

  it('maps "Insufficient Funds" to failed (previously mis-mapped to pending)', () => {
    const json = { data: { transaction_status: 'Insufficient Funds' } };
    const r = classifyPayazaVerifyResult(true, 200, json, REF);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.status).toBe('failed');
  });

  // THE BUG: a 200 OK with no transaction record must resolve to failed,
  // never pending — otherwise a declined card strands the applicant on
  // "Still confirming" forever.
  it.each([
    ['message only', { message: 'Transaction not found' }],
    ['data null', { message: 'Transaction not found', data: null }],
    ['empty object', {}],
    ['empty data object', { data: {} }],
  ])('maps a not-found response (%s) to failed, never pending', (_label, json) => {
    const r = classifyPayazaVerifyResult(true, 200, json, REF);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.status).toBe('failed');
  });

  it('keeps a genuinely in-flight transaction as pending', () => {
    const json = { data: { transaction_status: 'Processing' } };
    const r = classifyPayazaVerifyResult(true, 200, json, REF);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.status).toBe('pending');
  });

  it('preserves a top-level (unwrapped) transaction shape', () => {
    const json = { transaction_status: 'Success', amount: 1, transaction_id: 'P-C-9' };
    const r = classifyPayazaVerifyResult(true, 200, json, REF);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.status).toBe('paid');
  });

  it('maps a non-2xx response to an error result', () => {
    const json = { message: 'Server error' };
    const r = classifyPayazaVerifyResult(false, 500, json, REF);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errorCode).toBe('HTTP_500');
  });
});
