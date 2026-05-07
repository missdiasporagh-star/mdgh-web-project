export type RateLimitResult = { allowed: true } | { allowed: false; retryAfterSeconds: number };

export async function checkRateLimit(
  kv: KVNamespace, key: string, max: number, windowSeconds: number,
): Promise<RateLimitResult> {
  const current = Number((await kv.get(key)) ?? '0');
  if (current >= max) return { allowed: false, retryAfterSeconds: windowSeconds };
  await kv.put(key, String(current + 1), { expirationTtl: windowSeconds });
  return { allowed: true };
}
