import { describe, it, expect } from 'vitest';
import { signApplyToken, verifyApplyToken } from '@/lib/tokens/apply-token';

const SECRET = 'a'.repeat(64);

describe('apply-token', () => {
  it('round-trips a valid token', async () => {
    const token = await signApplyToken('app-123', 9999999999, SECRET);
    const result = await verifyApplyToken(token, SECRET);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.applicationId).toBe('app-123');
      expect(result.expiryUnix).toBe(9999999999);
    }
  });

  it('rejects an expired token', async () => {
    const past = Math.floor(Date.now() / 1000) - 100;
    const token = await signApplyToken('app-123', past, SECRET);
    const result = await verifyApplyToken(token, SECRET);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('expired');
  });

  it('rejects a token signed with a different secret', async () => {
    const token = await signApplyToken('app-123', 9999999999, SECRET);
    const result = await verifyApplyToken(token, 'b'.repeat(64));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('bad_signature');
  });

  it('rejects a tampered token', async () => {
    const token = await signApplyToken('app-123', 9999999999, SECRET);
    const tampered = token.slice(0, -4) + 'XXXX';
    const result = await verifyApplyToken(tampered, SECRET);
    expect(result.ok).toBe(false);
  });

  it('rejects a malformed token', async () => {
    const result = await verifyApplyToken('not-a-token', SECRET);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('malformed');
  });
});
