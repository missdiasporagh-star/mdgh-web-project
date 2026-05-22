import type { APIRoute } from 'astro';
import { z } from 'zod';
import { hashIp } from '@/lib/crypto/hash';
import { verifyTurnstile } from '@/lib/turnstile/verify';
import { checkRateLimit } from '@/lib/ratelimit/kv-limiter';
import { getEmailProvider } from '@/lib/email';

export const prerender = false;

const contactSchema = z.object({
  name: z.string().trim().min(1, 'name required').max(100),
  email: z.string().trim().email().max(254),
  subject: z.string().trim().min(1, 'subject required').max(120),
  message: z.string().trim().min(10, 'message too short').max(5000),
  honeypot: z.string().max(0, 'bot detected'),
  turnstileToken: z.string().min(1, 'turnstile token required'),
});

export const POST: APIRoute = async ({ request, locals, clientAddress }) => {
  const env = locals.runtime.env;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return j({ ok: false, error: 'invalid_json' }, 400);
  }
  const parsed = contactSchema.safeParse(body);
  if (!parsed.success) {
    return j({ ok: false, error: 'invalid_input', details: parsed.error.flatten() }, 400);
  }
  const input = parsed.data;

  if (input.honeypot.length > 0) return j({ ok: false, error: 'bot_detected' }, 400);

  // Rate limit: 5 submissions per hour per IP. Contact form is much lower-volume
  // than the apply form, so a tighter cap is fine.
  const ipHash = await hashIp(clientAddress ?? 'unknown', env.IP_HASH_SALT);
  const rl = await checkRateLimit(env.KV, `rl:contact:${ipHash}`, 5, 3600);
  if (!rl.allowed) {
    return j({ ok: false, error: 'rate_limited', retryAfter: rl.retryAfterSeconds }, 429);
  }

  const ts = await verifyTurnstile(input.turnstileToken, env.TURNSTILE_SECRET_KEY, clientAddress);
  if (!ts.ok) return j({ ok: false, error: 'turnstile_failed', reason: ts.reason }, 400);

  const email = getEmailProvider(env);
  const subjectSafe = input.subject.length > 80 ? `${input.subject.slice(0, 80)}…` : input.subject;
  const sendResult = await email.send({
    to: 'info@missdiasporagh.org',
    from: 'MDGH Contact Form <applications@missdiasporagh.org>',
    subject: `[Contact] ${subjectSafe} — from ${input.name}`,
    html: contactHtml(input),
    text: contactText(input),
  });

  if (!sendResult.ok) {
    return j({ ok: false, error: 'send_failed', code: sendResult.errorCode }, 502);
  }

  return j({ ok: true });
};

function contactHtml(d: { name: string; email: string; subject: string; message: string }): string {
  const e = escapeHtml;
  return `<!DOCTYPE html>
<html><body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; color: #1a1a1a;">
  <h2 style="color: #F8B92F; font-size: 18px; margin: 0 0 16px">New contact form submission</h2>
  <table style="width: 100%; border-collapse: collapse; margin-bottom: 16px">
    <tr><td style="padding: 8px 0; font-weight: 600; width: 100px">From:</td><td style="padding: 8px 0">${e(d.name)} &lt;<a href="mailto:${e(d.email)}">${e(d.email)}</a>&gt;</td></tr>
    <tr><td style="padding: 8px 0; font-weight: 600">Subject:</td><td style="padding: 8px 0">${e(d.subject)}</td></tr>
  </table>
  <div style="border-top: 1px solid #ddd; padding-top: 16px">
    <p style="font-weight: 600; margin: 0 0 8px">Message:</p>
    <p style="white-space: pre-wrap; margin: 0; line-height: 1.6">${e(d.message)}</p>
  </div>
  <p style="color: #999; font-size: 11px; margin-top: 24px; border-top: 1px solid #eee; padding-top: 12px">Sent from the contact form at missdiasporagh.org. Reply directly to this email to respond to ${e(d.name)}.</p>
</body></html>`;
}

function contactText(d: { name: string; email: string; subject: string; message: string }): string {
  return `New contact form submission

From: ${d.name} <${d.email}>
Subject: ${d.subject}

Message:
${d.message}

--
Sent from the contact form at missdiasporagh.org. Reply directly to this email to respond to ${d.name}.`;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function j(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}
