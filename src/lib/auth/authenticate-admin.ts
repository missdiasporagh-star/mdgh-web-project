import { verifyPassword } from '@/lib/crypto/pbkdf2';
import type { AdminRow } from '@/lib/db/queries';

/**
 * Decide whether an admin login attempt succeeds.
 *
 * Returns the matched admin row on success, or null for: unknown email
 * (row === null), a disabled account, or a wrong password. Callers MUST treat
 * all null results identically (generic "invalid_credentials") so the response
 * can't be used to enumerate which emails are admins.
 */
export async function authenticateAdmin(row: AdminRow | null, password: string): Promise<AdminRow | null> {
  if (!row || row.disabled === 1) return null;
  const ok = await verifyPassword(password, row.password_hash);
  return ok ? row : null;
}
