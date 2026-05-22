export function applySecurityHeaders(res: Response, opts: { isApply: boolean; isAdmin: boolean }): Response {
  // Payment origins are only allow-listed on /apply* (where the Payaza SDK
  // popup + form-action target run). The brand site doesn't need them in CSP.
  const payazaOrigins = opts.isApply ? ' https://checkout.payaza.africa https://checkout-v2.payaza.africa' : '';

  const csp = [
    "default-src 'self'",
    // 'unsafe-inline' on script-src is needed for Astro's per-island inline
    // bootstrap scripts + Turnstile's widget bootstrap. Future hardening:
    // switch to nonce-based CSP (Astro 5 experimental.csp).
    `script-src 'self' 'unsafe-inline' https://challenges.cloudflare.com${payazaOrigins}`,
    // 'unsafe-inline' on style-src covers Astro's scoped <style> blocks +
    // inline element styles.
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' https://fonts.gstatic.com data:",
    `connect-src 'self' https://api.payaza.africa https://*.r2.cloudflarestorage.com https://challenges.cloudflare.com`,
    `img-src 'self' data: https://*.r2.cloudflarestorage.com`,
    `media-src 'self' https://*.r2.cloudflarestorage.com`,
    `frame-src https://challenges.cloudflare.com${payazaOrigins}`,
    // Block all framing of OUR pages — parity with X-Frame-Options: DENY,
    // but frame-ancestors is the modern equivalent that browsers prefer.
    "frame-ancestors 'none'",
    `form-action 'self'${payazaOrigins}`,
    "base-uri 'self'",
    "object-src 'none'",
  ].join('; ');

  // Cloudflare Workers Response headers are mutable. Mutate in place to avoid
  // re-wrapping the body stream (which mangles Astro's SSR template render
  // output to "[object Object]" in some pipeline configurations).
  res.headers.set('Content-Security-Policy', csp);
  res.headers.set('Strict-Transport-Security', 'max-age=63072000; includeSubDomains; preload');
  res.headers.set('X-Content-Type-Options', 'nosniff');
  res.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  res.headers.set('X-Frame-Options', 'DENY');

  return res;
}
