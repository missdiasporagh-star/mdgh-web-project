import { verifyApplyToken } from './apply-token';
import { getApplicationById, getCycle } from '@/lib/db/queries';

export type ValidateApplyTokenResult =
  | { ok: true; applicationId: string }
  | { ok: false; reason: 'malformed' | 'bad_signature' | 'expired' | 'not_found' | 'not_paid' | 'already_submitted' | 'cycle_closed' };

export async function validateApplyToken(
  token: string, secret: string, db: D1Database
): Promise<ValidateApplyTokenResult> {
  const verified = await verifyApplyToken(token, secret);
  if (!verified.ok) return { ok: false, reason: verified.reason };

  const app = await getApplicationById(db, verified.applicationId);
  if (!app) return { ok: false, reason: 'not_found' };
  if (app.payment_status !== 'paid') return { ok: false, reason: 'not_paid' };
  if (app.submitted_at) return { ok: false, reason: 'already_submitted' };

  const cycle = await getCycle(db, app.cycle_id);
  if (!cycle) return { ok: false, reason: 'cycle_closed' };
  if (cycle.is_active !== 1) return { ok: false, reason: 'cycle_closed' };
  if (new Date() > new Date(cycle.applications_close_at)) return { ok: false, reason: 'cycle_closed' };

  return { ok: true, applicationId: verified.applicationId };
}
