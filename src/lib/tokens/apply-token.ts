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
    'raw', enc.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
  );
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(data));
  return new Uint8Array(sig);
}

async function hmacVerify(secret: string, data: string, sig: Uint8Array): Promise<boolean> {
  const key = await crypto.subtle.importKey(
    'raw', enc.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' }, false, ['verify']
  );
  return crypto.subtle.verify('HMAC', key, sig, enc.encode(data));
}

export async function signApplyToken(applicationId: string, expiryUnix: number, secret: string): Promise<string> {
  const payload = `${applicationId}.${expiryUnix}`;
  const sig = await hmac(secret, payload);
  return `${applicationId}.${expiryUnix}.${b64urlEncode(sig)}`;
}

export type ApplyTokenVerifyResult =
  | { ok: true; applicationId: string; expiryUnix: number }
  | { ok: false; reason: 'malformed' | 'bad_signature' | 'expired' };

export async function verifyApplyToken(token: string, secret: string): Promise<ApplyTokenVerifyResult> {
  const parts = token.split('.');
  if (parts.length !== 3) return { ok: false, reason: 'malformed' };
  const [applicationId, expiryStr, sigB64] = parts;
  const expiryUnix = Number(expiryStr);
  if (!applicationId || !Number.isFinite(expiryUnix)) return { ok: false, reason: 'malformed' };

  let sig: Uint8Array;
  try { sig = b64urlDecode(sigB64); } catch { return { ok: false, reason: 'malformed' }; }

  const valid = await hmacVerify(secret, `${applicationId}.${expiryUnix}`, sig);
  if (!valid) return { ok: false, reason: 'bad_signature' };

  if (expiryUnix <= Math.floor(Date.now() / 1000)) return { ok: false, reason: 'expired' };
  return { ok: true, applicationId, expiryUnix };
}
