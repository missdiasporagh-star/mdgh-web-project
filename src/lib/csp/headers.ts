export function applySecurityHeaders(res: Response, opts: { isApply: boolean; isAdmin: boolean }): Response {
  const csp = [
    "default-src 'self'",
    // 'unsafe-inline' on script-src allows the Turnstile widget's bootstrap
    // inline script + the small inline modules Astro generates for islands.
    `script-src 'self' 'unsafe-inline' https://challenges.cloudflare.com${opts.isApply ? ' https://checkout.payaza.africa https://checkout-v2.payaza.africa' : ''}`,
    // 'unsafe-inline' on style-src is needed for the layout's inline <style>
    // block + Astro's scoped style hashes. fonts.googleapis.com is the
    // Google Fonts CSS host (the actual font files come from fonts.gstatic.com,
    // covered by font-src).
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' https://fonts.gstatic.com data:",
    `connect-src 'self' https://api.payaza.africa https://*.r2.cloudflarestorage.com https://challenges.cloudflare.com`,
    `img-src 'self' data: https://*.r2.cloudflarestorage.com`,
    `media-src 'self' https://*.r2.cloudflarestorage.com`,
    `frame-src https://challenges.cloudflare.com${opts.isApply ? ' https://checkout.payaza.africa https://checkout-v2.payaza.africa' : ''}`,
    `form-action 'self'${opts.isApply ? ' https://checkout.payaza.africa https://checkout-v2.payaza.africa' : ''}`,
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
