import { describe, it, expect } from 'vitest';
import { hashPassword } from '@/lib/crypto/pbkdf2';
import { authenticateAdmin } from './authenticate-admin';
import type { AdminRow } from '@/lib/db/queries';

function makeRow(overrides: Partial<AdminRow> = {}): AdminRow {
  return {
    email: 'admin2@example.com',
    password_hash: 'unset',
    display_name: null,
    created_at: '2026-05-25T00:00:00.000Z',
    disabled: 0,
    ...overrides,
  };
}

describe('authenticateAdmin', () => {
  it('returns null when the admin does not exist', async () => {
    expect(await authenticateAdmin(null, 'whatever')).toBeNull();
  });

  it('returns null for a disabled admin even with the correct password', async () => {
    const password_hash = await hashPassword('correct-horse-battery');
    expect(await authenticateAdmin(makeRow({ password_hash, disabled: 1 }), 'correct-horse-battery')).toBeNull();
  });

  it('returns null for a wrong password', async () => {
    const password_hash = await hashPassword('correct-horse-battery');
    expect(await authenticateAdmin(makeRow({ password_hash }), 'wrong-password')).toBeNull();
  });

  it('returns the row for a valid email + password', async () => {
    const password_hash = await hashPassword('correct-horse-battery');
    const row = makeRow({ email: 'admin2@example.com', password_hash });
    expect(await authenticateAdmin(row, 'correct-horse-battery')).toEqual(row);
  });
});
