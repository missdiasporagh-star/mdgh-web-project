import type { APIRoute } from 'astro';
import { notificationsSubscribeSchema } from '@/lib/schemas/apply';
import { insertCycleNotification } from '@/lib/db/queries';
import { newUlid } from '@/lib/ids/ulid';

export const prerender = false;

export const POST: APIRoute = async ({ request, locals }) => {
  const env = locals.runtime.env;
  let body: unknown;
  try { body = await request.json(); } catch { return j({ ok: false, error: 'invalid_json' }, 400); }
  const parsed = notificationsSubscribeSchema.safeParse(body);
  if (!parsed.success) return j({ ok: false, error: 'invalid_input' }, 400);
  if (parsed.data.honeypot.length > 0) return j({ ok: false, error: 'bot_detected' }, 400);

  await insertCycleNotification(env.DB, {
    id: newUlid(),
    email: parsed.data.email,
    source: parsed.data.source,
    disqualifyingRule: parsed.data.disqualifyingRule,
  });
  return j({ ok: true });
};

function j(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}
