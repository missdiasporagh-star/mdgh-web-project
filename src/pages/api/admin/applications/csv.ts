import type { APIRoute } from 'astro';
import { listApplicationsForAdmin, insertAdminAudit } from '@/lib/db/queries';
import { checkAdminAuth } from '@/middleware/admin-auth';
import { newUlid } from '@/lib/ids/ulid';
import { hashIp } from '@/lib/crypto/hash';

export const prerender = false;

const COLUMNS = [
  'id', 'cycle_id', 'transaction_reference', 'email',
  'full_name', 'phone', 'date_of_birth',
  'country_of_residence', 'current_city', 'country_of_heritage',
  'bio',
  'eligibility_age_band',
  'consent_media_use', 'consent_marketing', 'consent_policy_version',
  'submitted_at', 'status', 'admin_notes',
  'payment_amount_cents', 'payment_currency', 'payaza_transaction_id', 'payment_verified_at',
] as const;

function csvEscape(v: unknown): string {
  if (v === null || v === undefined) return '';
  const s = String(v);
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

export const GET: APIRoute = async ({ request, locals, clientAddress }) => {
  const env = locals.runtime.env;
  const auth = await checkAdminAuth(request, env);
  if (!auth.ok) return new Response('Unauthorized', { status: 401 });

  const url = new URL(request.url);
  const status = url.searchParams.get('status') ?? undefined;
  const q = url.searchParams.get('q') ?? undefined;

  // Pull all matching, paginating internally
  const all: Record<string, unknown>[] = [];
  let offset = 0;
  while (true) {
    const { rows } = await listApplicationsForAdmin(env.DB, { status, q, limit: 200, offset });
    if (rows.length === 0) break;
    all.push(...rows);
    if (rows.length < 200) break;
    offset += 200;
  }

  const lines = [COLUMNS.join(',')];
  for (const row of all) {
    lines.push(COLUMNS.map(c => csvEscape((row as Record<string, unknown>)[c])).join(','));
  }
  const csv = lines.join('\n');

  const ipHash = await hashIp(clientAddress ?? 'unknown', env.IP_HASH_SALT);
  await insertAdminAudit(env.DB, {
    id: newUlid(), adminEmail: auth.adminEmail, action: 'csv_export',
    targetApplicationId: null,
    detailsJson: JSON.stringify({ rowCount: all.length, status, q }), ipHash,
  });

  return new Response(csv, {
    status: 200,
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="mdgh-applications-${new Date().toISOString().slice(0, 10)}.csv"`,
    },
  });
};
