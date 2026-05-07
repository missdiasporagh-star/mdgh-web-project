export function applySecurityHeaders(res: Response, opts: { isApply: boolean; isAdmin: boolean }): Response {
  const csp = [
    "default-src 'self'",
    `script-src 'self' https://challenges.cloudflare.com${opts.isApply ? ' https://checkout.payaza.africa' : ''}`,
    `connect-src 'self' https://api.payaza.africa https://*.r2.cloudflarestorage.com https://challenges.cloudflare.com`,
    `img-src 'self' data: https://*.r2.cloudflarestorage.com`,
    `media-src 'self' https://*.r2.cloudflarestorage.com`,
    `frame-src https://challenges.cloudflare.com${opts.isApply ? ' https://checkout.payaza.africa' : ''}`,
    `form-action 'self'${opts.isApply ? ' https://checkout.payaza.africa' : ''}`,
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
