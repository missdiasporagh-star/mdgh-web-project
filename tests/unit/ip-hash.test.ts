import { describe, it, expect } from 'vitest';
import { hashIp } from '@/lib/crypto/hash';

describe('hashIp', () => {
  it('produces a 64-char hex string', async () => {
    const h = await hashIp('192.168.1.1', 'salt');
    expect(h).toMatch(/^[0-9a-f]{64}$/);
  });

  it('is deterministic for the same input', async () => {
    const a = await hashIp('192.168.1.1', 'salt');
    const b = await hashIp('192.168.1.1', 'salt');
    expect(a).toBe(b);
  });

  it('changes with a different salt', async () => {
    const a = await hashIp('192.168.1.1', 'salt-a');
    const b = await hashIp('192.168.1.1', 'salt-b');
    expect(a).not.toBe(b);
  });
});
