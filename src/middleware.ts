import { defineMiddleware } from 'astro:middleware';
import { applySecurityHeaders } from '@/lib/csp/headers';

export const onRequest = defineMiddleware(async (context, next) => {
  const res = await next();
  const path = context.url.pathname;
  const isApply = path === '/apply' || path.startsWith('/apply/');
  const isAdmin = path === '/admin' || path.startsWith('/admin/');
  if (isApply || isAdmin) return applySecurityHeaders(res, { isApply, isAdmin });
  return res;
});
