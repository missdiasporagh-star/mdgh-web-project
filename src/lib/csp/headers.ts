export function applySecurityHeaders(res: Response, opts: { isApply: boolean; isAdmin: boolean }): Response {
  const headers = new Headers(res.headers);

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

  headers.set('Content-Security-Policy', csp);
  headers.set('Strict-Transport-Security', 'max-age=63072000; includeSubDomains; preload');
  headers.set('X-Content-Type-Options', 'nosniff');
  headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  headers.set('X-Frame-Options', 'DENY');

  return new Response(res.body, { status: res.status, statusText: res.statusText, headers });
}
