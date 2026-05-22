import { describe, it, expect } from 'vitest';
import { newUlid } from '@/lib/ids/ulid';

describe('newUlid', () => {
  it('produces a 26-char ULID', () => {
    const id = newUlid();
    expect(id).toHaveLength(26);
    expect(id).toMatch(/^[0-9A-HJKMNP-TV-Z]{26}$/);
  });

  it('produces sortable IDs across time', async () => {
    const a = newUlid();
    await new Promise(r => setTimeout(r, 5));
    const b = newUlid();
    expect(a < b).toBe(true);
  });

  it('produces unique values across 10000 calls', () => {
    const set = new Set<string>();
    for (let i = 0; i < 10000; i++) set.add(newUlid());
    expect(set.size).toBe(10000);
  });
});
