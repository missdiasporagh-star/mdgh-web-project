// src/lib/crypto/pbkdf2.ts
const enc = new TextEncoder();
// Cloudflare Workers' Web Crypto rejects PBKDF2 iteration counts ABOVE 100,000
// ("Pbkdf2 failed: iteration counts above 100000 are not supported"). This code
// runs in the Worker for verification, so the work factor is capped at the
// runtime ceiling. Do NOT raise above 100_000 — hashes generated higher (e.g.
// in Node) will throw at verify time in production. verifyPassword reads the
// iteration count from the stored hash, so it still validates older hashes that
// used a supported count.
const ITERATIONS = 100_000;

function b64urlEncode(bytes: Uint8Array): string {
  return btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function b64urlDecode(s: string): Uint8Array {
  const padded = s.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((s.length + 3) % 4);
  const bin = atob(padded);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

async function derive(password: string, salt: Uint8Array, iterations: number): Promise<Uint8Array> {
  const keyMaterial = await crypto.subtle.importKey(
    'raw', enc.encode(password) as BufferSource, 'PBKDF2', false, ['deriveBits']
  );
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt: salt as BufferSource, iterations, hash: 'SHA-256' },
    keyMaterial, 256
  );
  return new Uint8Array(bits);
}

export async function hashPassword(password: string): Promise<string> {
  const salt = new Uint8Array(16);
  crypto.getRandomValues(salt);
  const hash = await derive(password, salt, ITERATIONS);
  return `pbkdf2$${ITERATIONS}$${b64urlEncode(salt)}$${b64urlEncode(hash)}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const parts = stored.split('$');
  if (parts.length !== 4 || parts[0] !== 'pbkdf2') return false;
  const iterations = Number(parts[1]);
  if (!Number.isFinite(iterations) || iterations < 1000) return false;
  let salt: Uint8Array, expected: Uint8Array;
  try {
    salt = b64urlDecode(parts[2]);
    expected = b64urlDecode(parts[3]);
  } catch { return false; }
  const actual = await derive(password, salt, iterations);
  if (actual.length !== expected.length) return false;
  let diff = 0;
  for (let i = 0; i < actual.length; i++) diff |= actual[i] ^ expected[i];
  return diff === 0;
}
