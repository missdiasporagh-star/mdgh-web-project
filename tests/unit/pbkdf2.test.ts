import { describe, it, expect } from 'vitest';
import { hashPassword, verifyPassword } from '@/lib/crypto/pbkdf2';

describe('pbkdf2 password hashing', () => {
  it('produces a hash that verifies', async () => {
    const hash = await hashPassword('correct-horse-battery-staple');
    const ok = await verifyPassword('correct-horse-battery-staple', hash);
    expect(ok).toBe(true);
  });

  it('rejects wrong password', async () => {
    const hash = await hashPassword('correct-horse-battery-staple');
    const ok = await verifyPassword('wrong', hash);
    expect(ok).toBe(false);
  });

  it('hash format is "pbkdf2$iters$salt$hash"', async () => {
    const hash = await hashPassword('x');
    expect(hash).toMatch(/^pbkdf2\$\d+\$[A-Za-z0-9_-]+\$[A-Za-z0-9_-]+$/);
  });

  it('different runs produce different hashes (random salt)', async () => {
    const a = await hashPassword('same');
    const b = await hashPassword('same');
    expect(a).not.toBe(b);
  });

  it('rejects malformed stored hash', async () => {
    const ok = await verifyPassword('anything', 'not-a-valid-hash');
    expect(ok).toBe(false);
  });

  it('rejects stored hash with too-low iterations', async () => {
    // Manually craft a malicious stored hash with iterations=1
    const ok = await verifyPassword('x', 'pbkdf2$1$abcd$efgh');
    expect(ok).toBe(false);
  });
});
