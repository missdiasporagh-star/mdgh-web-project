export type TurnstileVerifyResult = { ok: true } | { ok: false; reason: string };

export async function verifyTurnstile(token: string, secret: string, remoteIp?: string): Promise<TurnstileVerifyResult> {
  try {
    const body = new URLSearchParams({ secret, response: token });
    if (remoteIp) body.set('remoteip', remoteIp);
    const res = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST', body,
    });
    const json = await res.json() as { success: boolean; 'error-codes'?: string[] };
    if (json.success) return { ok: true };
    return { ok: false, reason: (json['error-codes'] ?? ['unknown']).join(',') };
  } catch (e) {
    return { ok: false, reason: e instanceof Error ? e.message : 'network_error' };
  }
}
