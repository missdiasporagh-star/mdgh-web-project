import { hashPassword } from '../src/lib/crypto/pbkdf2';

const password = process.argv[2];
if (!password) {
  console.error('Usage: npx tsx scripts/hash-admin-password.ts <password>');
  process.exit(1);
}
hashPassword(password).then(h => console.log(h));
