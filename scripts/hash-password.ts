// scripts/hash-password.ts
// Generate a pbkdf2 password hash (SAME algorithm as the app — see
// src/lib/crypto/pbkdf2.ts) for a new admin. Run:
//   npx tsx scripts/hash-password.ts
// then type the password at the prompt. The plaintext is never stored or
// logged; the prompt reads from stdin so it stays out of shell history. Only
// the printed hash (stdout) goes into the admins.password_hash column.
import { createInterface } from 'node:readline/promises';
import process from 'node:process';
import { hashPassword } from '../src/lib/crypto/pbkdf2';

const rl = createInterface({ input: process.stdin, output: process.stderr });
const password = (await rl.question('New admin password: ')).trim();
rl.close();
if (!password) {
  console.error('No password entered — aborting.');
  process.exit(1);
}
const hash = await hashPassword(password);
process.stderr.write('\nHash (put this in admins.password_hash; do NOT share the plaintext):\n');
console.log(hash);
