import { describe, it, expect, vi, afterEach } from 'vitest';
import { ResendProvider } from './resend-provider';

afterEach(() => vi.unstubAllGlobals());

describe('ResendProvider.send', () => {
  it('sends array recipients, category header, and Resend tag', async () => {
    const fetchSpy = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ id: 'msg_1' }),
    });
    vi.stubGlobal('fetch', fetchSpy);

    const provider = new ResendProvider('key_123');
    const res = await provider.send({
      to: ['a@example.com', 'b@example.com'],
      subject: '[MDGH 💰 Payment] New paid application — REF1',
      html: '<p>hi</p>',
      text: 'hi',
      category: 'payment_paid',
    });

    expect(res.ok).toBe(true);
    const body = JSON.parse((fetchSpy.mock.calls[0][1] as RequestInit).body as string);
    expect(body.to).toEqual(['a@example.com', 'b@example.com']);
    expect(body.headers['X-MDGH-Category']).toBe('payment_paid');
    expect(body.tags).toEqual([{ name: 'category', value: 'payment_paid' }]);
  });

  it('wraps a single string recipient into an array', async () => {
    const fetchSpy = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ id: 'm' }) });
    vi.stubGlobal('fetch', fetchSpy);
    await new ResendProvider('k').send({
      to: 'solo@example.com', subject: 's', html: 'h', text: 't', category: 'magic_link',
    });
    const body = JSON.parse((fetchSpy.mock.calls[0][1] as RequestInit).body as string);
    expect(body.to).toEqual(['solo@example.com']);
  });
});
