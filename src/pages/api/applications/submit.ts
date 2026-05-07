import type { APIRoute } from 'astro';
import { submitSchema } from '@/lib/schemas/form';
import { validateApplyToken } from '@/lib/tokens/validate-apply-token';
import { submitApplication, getApplicationById } from '@/lib/db/queries';
import { getEmailProvider, renderApplicantConfirmation, renderAdminNotification } from '@/lib/email';

export const prerender = false;

export const POST: APIRoute = async ({ request, locals }) => {
  const env = locals.runtime.env;
  let body: unknown;
  try { body = await request.json(); } catch { return j({ ok: false, error: 'invalid_json' }, 400); }
  const parsed = submitSchema.safeParse(body);
  if (!parsed.success) return j({ ok: false, error: 'invalid_input', details: parsed.error.flatten() }, 400);

  const validation = await validateApplyToken(parsed.data.token, env.APPLY_TOKEN_SECRET, env.DB);
  if (!validation.ok) return j({ ok: false, error: 'invalid_token', reason: validation.reason }, 401);

  const result = await submitApplication(env.DB, validation.applicationId, {
    full_name: parsed.data.fullName,
    phone: parsed.data.phone,
    date_of_birth: parsed.data.dateOfBirth,
    country_of_residence: parsed.data.countryOfResidence,
    current_city: parsed.data.currentCity,
    country_of_heritage: parsed.data.countryOfHeritage,
    bio: parsed.data.bio,
    socials_json: JSON.stringify(parsed.data.socials ?? {}),
  });
  if (!result.success) return j({ ok: false, error: 'submit_failed', reason: result.reason }, 409);

  const app = await getApplicationById(env.DB, validation.applicationId);
  if (!app) return j({ ok: true });

  // Send confirmation + admin notification (best-effort; failures don't block submission success)
  const email = getEmailProvider(env);
  const dashboardUrl = new URL(`/admin/applications/${app.id}`, request.url).toString();
  await Promise.all([
    email.send({ to: app.email, ...renderApplicantConfirmation({ fullName: parsed.data.fullName, reference: app.transaction_reference }) }).catch(() => null),
    email.send({ to: 'applications@missdiasporagh.org', ...renderAdminNotification({ fullName: parsed.data.fullName, reference: app.transaction_reference, dashboardUrl }) }).catch(() => null),
  ]);

  return j({ ok: true, reference: app.transaction_reference });
};

function j(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}
