import type { APIRoute } from 'astro';
import { setEmailBounced } from '@/lib/db/queries';

export const prerender = false;

// Resend signs webhooks with Svix-style headers. For V1 we accept a shared
// secret header. Wire Svix verification per Resend docs at integration time.

export const POST: APIRoute = async ({ request, locals }) => {
  const env = locals.runtime.env;

  // Minimal auth: require shared secret header
  const sig = request.headers.get('x-resend-secret');
  if (sig !== env.RESEND_API_KEY) return new Response('Unauthorized', { status: 401 });

  let body: unknown;
  try { body = await request.json(); } catch { return new Response('Bad Request', { status: 400 }); }

  // Resend's bounce payload shape (verify against their docs at integration time):
  // { type: 'email.bounced', data: { email_id, to: [emails], created_at, ... } }
  const data = (body as { type?: string; data?: { to?: string[] } }) ?? {};
  if (data.type !== 'email.bounced' || !Array.isArray(data.data?.to)) {
    return new Response(JSON.stringify({ ok: true, ignored: true }), {
      status: 200, headers: { 'Content-Type': 'application/json' },
    });
  }
  for (const to of data.data.to) {
    await setEmailBounced(env.DB, to);
  }
  return new Response(JSON.stringify({ ok: true }), {
    status: 200, headers: { 'Content-Type': 'application/json' },
  });
};
