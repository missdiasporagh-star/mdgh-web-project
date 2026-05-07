import { describe, it, expect } from 'vitest';
import { signAdminSession, verifyAdminSession } from '@/lib/tokens/admin-session';

const SECRET = 'c'.repeat(64);

describe('admin-session', () => {
  it('round-trips a session token', async () => {
    const token = await signAdminSession('admin@example.com', 'session-id-1', 9999999999, SECRET);
    const result = await verifyAdminSession(token, SECRET);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.adminEmail).toBe('admin@example.com');
      expect(result.sessionId).toBe('session-id-1');
    }
  });

  it('rejects expired session', async () => {
    const past = Math.floor(Date.now() / 1000) - 1;
    const token = await signAdminSession('a@b.com', 'sid', past, SECRET);
    const result = await verifyAdminSession(token, SECRET);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('expired');
  });

  it('rejects bad signature', async () => {
    const token = await signAdminSession('a@b.com', 'sid', 9999999999, SECRET);
    const result = await verifyAdminSession(token, 'd'.repeat(64));
    expect(result.ok).toBe(false);
  });
});
