import { describe, it, expect } from 'vitest';
import { newTransactionReference } from '@/lib/ids/reference';

describe('newTransactionReference', () => {
  it('matches the MDGH-{cycle}-{8 base32} format', () => {
    const ref = newTransactionReference('MDGH-2026');
    expect(ref).toMatch(/^MDGH-2026-[0-9A-HJKMNP-TV-Z]{8}$/);
  });

  it('produces 10000 unique references', () => {
    const set = new Set<string>();
    for (let i = 0; i < 10000; i++) set.add(newTransactionReference('MDGH-2026'));
    expect(set.size).toBe(10000);
  });

  it('uses the cycle short id (everything after the first dash)', () => {
    expect(newTransactionReference('MDGH-2027')).toMatch(/^MDGH-2027-/);
  });
});
