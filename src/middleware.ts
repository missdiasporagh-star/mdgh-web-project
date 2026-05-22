import { defineMiddleware } from 'astro:middleware';
import { applySecurityHeaders } from '@/lib/csp/headers';

// Apply security headers (CSP, HSTS, XFO, Referrer-Policy, Permissions-Policy,
// X-Content-Type-Options, frame-ancestors) to EVERY route. Previously gated on
// /apply* or /admin* — left the apex brand site unprotected against clickjacking
// + downgrade attacks. The CSP is per-route-shape (extra Payaza origins on
// /apply* only) so the apex still gets a tight policy.
export const onRequest = defineMiddleware(async (context, next) => {
  const res = await next();
  const path = context.url.pathname;
  const isApply = path === '/apply' || path.startsWith('/apply/');
  const isAdmin = path === '/admin' || path.startsWith('/admin/');
  return applySecurityHeaders(res, { isApply, isAdmin });
});
