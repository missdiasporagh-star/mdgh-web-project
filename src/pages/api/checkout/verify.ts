import type { APIRoute } from 'astro';
import { runPaymentVerification } from '@/lib/payment/verify-flow';

export const prerender = false;

export const GET: APIRoute = async ({ request, locals }) => {
  const env = locals.runtime.env;
  const url = new URL(request.url);
  const reference = url.searchParams.get('reference');
  if (!reference) return j({ ok: false, error: 'missing_reference' }, 400);

  const outcome = await runPaymentVerification(env, reference, request.url);
  if (!outcome.ok) {
    return j(outcome, outcome.httpStatus);
  }
  const { ...rest } = outcome;
  return j(rest, 200);
};

function j(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}
