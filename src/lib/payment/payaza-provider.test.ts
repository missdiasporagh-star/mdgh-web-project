import { describe, it, expect } from 'vitest';
import { classifyPayazaVerifyResult } from './payaza-provider';

const REF = 'MDGH-2026-TESTREF1';

describe('classifyPayazaVerifyResult', () => {
  it('maps a successful transaction to paid', () => {
    const json = {
      message: 'Transaction data found',
      data: { transaction_status: 'Success', amount: 50.00, currency: 'GHS', transaction_id: 'P-C-123' },
    };
    const r = classifyPayazaVerifyResult(true, 200, json, REF);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.status).toBe('paid');
      expect(r.amountCents).toBe(5000);
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

  it('maps a real-field-name success (amount_received/transaction_reference) to paid', () => {
    const json = {
      message: 'Transaction data found',
      data: {
        transaction_status: 'Successful',
        amount_received: 50.00,
        currency: 'GHS',
        transaction_reference: 'P-C-20260524-UR85J96FOB',
        merchant_transaction_reference: REF,
        current_status_date: '2026-05-24 20:12:00',
      },
    };
    const r = classifyPayazaVerifyResult(true, 200, json, REF);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.status).toBe('paid');
      expect(r.amountCents).toBe(5000);
      expect(r.providerTransactionId).toBe('P-C-20260524-UR85J96FOB');
      expect(r.paidAt).toBe('2026-05-24 20:12:00');
    }
  });

  it('maps "Initialized" (declined/abandoned, not yet advanced) to pending', () => {
    const json = { data: { transaction_status: 'Initialized', amount_received: 1.0 } };
    const r = classifyPayazaVerifyResult(true, 200, json, REF);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.status).toBe('pending');
  });
});
