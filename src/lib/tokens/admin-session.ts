const enc = new TextEncoder();

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

async function hmac(secret: string, data: string): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey(
    'raw', enc.encode(secret) as BufferSource,
    { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
  );
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(data) as BufferSource);
  return new Uint8Array(sig);
}

async function hmacVerify(secret: string, data: string, sig: Uint8Array): Promise<boolean> {
  const key = await crypto.subtle.importKey(
    'raw', enc.encode(secret) as BufferSource,
    { name: 'HMAC', hash: 'SHA-256' }, false, ['verify']
  );
  return crypto.subtle.verify('HMAC', key, sig as BufferSource, enc.encode(data) as BufferSource);
}

export async function signAdminSession(adminEmail: string, sessionId: string, expiryUnix: number, secret: string): Promise<string> {
  const payload = `${adminEmail}.${sessionId}.${expiryUnix}`;
  const sig = await hmac(secret, payload);
  return `${adminEmail}.${sessionId}.${expiryUnix}.${b64urlEncode(sig)}`;
}

export type AdminSessionVerifyResult =
  | { ok: true; adminEmail: string; sessionId: string; expiryUnix: number }
  | { ok: false; reason: 'malformed' | 'bad_signature' | 'expired' };

export async function verifyAdminSession(token: string, secret: string): Promise<AdminSessionVerifyResult> {
  // Split from the right: last 3 '.' delimiters give sessionId, expiryStr, sigB64.
  // Everything before the first of those delimiters is adminEmail (which may contain dots).
  const lastDot3 = (() => {
    let pos = token.length;
    for (let i = 0; i < 3; i++) {
      pos = token.lastIndexOf('.', pos - 1);
      if (pos === -1) return null;
    }
    return pos;
  })();
  if (lastDot3 === null) return { ok: false, reason: 'malformed' };
  const adminEmail = token.slice(0, lastDot3);
  const rest = token.slice(lastDot3 + 1).split('.');
  if (rest.length !== 3) return { ok: false, reason: 'malformed' };
  const [sessionId, expiryStr, sigB64] = rest;
  const expiryUnix = Number(expiryStr);
  if (!adminEmail || !sessionId || !Number.isFinite(expiryUnix)) return { ok: false, reason: 'malformed' };

  let sig: Uint8Array;
  try { sig = b64urlDecode(sigB64); } catch { return { ok: false, reason: 'malformed' }; }

  const valid = await hmacVerify(secret, `${adminEmail}.${sessionId}.${expiryUnix}`, sig);
  if (!valid) return { ok: false, reason: 'bad_signature' };

  if (expiryUnix <= Math.floor(Date.now() / 1000)) return { ok: false, reason: 'expired' };
  return { ok: true, adminEmail, sessionId, expiryUnix };
}
