export type ApplicationRow = {
  id: string;
  cycle_id: string;
  transaction_reference: string;
  email: string;
  payment_status: 'pending' | 'paid' | 'failed' | 'expired';
  payment_amount_cents: number;
  payment_currency: string;
  payaza_transaction_id: string | null;
  payment_verified_at: string | null;
  payment_failure_reason: string | null;
  eligibility_age_band: string | null;
  eligibility_is_woman: number | null;
  eligibility_african_descent: number | null;
  eligibility_outside_ghana: number | null;
  eligibility_valid_passport: number | null;
  consent_policy_version: string;
  consent_recorded_at: string;
  consent_media_use: number;
  consent_marketing: number;
  magic_link_sent_at: string | null;
  apply_token_issued_at: string | null;
  email_bounced_at: string | null;
  full_name: string | null;
  phone: string | null;
  date_of_birth: string | null;
  country_of_residence: string | null;
  current_city: string | null;
  country_of_heritage: string | null;
  bio: string | null;
  socials_json: string | null;
  headshot_r2_key: string | null;
  video_r2_key: string | null;
  submitted_at: string | null;
  status: 'new' | 'reviewing' | 'shortlisted' | 'rejected';
  admin_notes: string | null;
  created_at: string;
  updated_at: string;
  ip_hash: string | null;
  user_agent: string | null;
};

export type CycleRow = {
  id: string;
  display_name: string;
  application_fee_cents: number;
  application_currency: string;
  privacy_policy_version: string;
  applications_open_at: string;
  applications_close_at: string;
  is_active: number;
};

export async function getActiveCycle(db: D1Database): Promise<CycleRow | null> {
  const r = await db.prepare(`SELECT * FROM cycles WHERE is_active = 1 LIMIT 1`).first<CycleRow>();
  return r ?? null;
}

export async function getCycle(db: D1Database, id: string): Promise<CycleRow | null> {
  const r = await db.prepare(`SELECT * FROM cycles WHERE id = ?`).bind(id).first<CycleRow>();
  return r ?? null;
}

export async function getApplicationById(db: D1Database, id: string): Promise<ApplicationRow | null> {
  const r = await db.prepare(`SELECT * FROM applications WHERE id = ?`).bind(id).first<ApplicationRow>();
  return r ?? null;
}

export async function getApplicationByReference(db: D1Database, ref: string): Promise<ApplicationRow | null> {
  const r = await db.prepare(`SELECT * FROM applications WHERE transaction_reference = ?`).bind(ref).first<ApplicationRow>();
  return r ?? null;
}

export type InsertPendingApplication = {
  id: string;
  cycle_id: string;
  transaction_reference: string;
  email: string;
  payment_amount_cents: number;
  payment_currency: string;
  eligibility_age_band: string;
  eligibility_is_woman: number;
  eligibility_african_descent: number;
  eligibility_outside_ghana: number;
  eligibility_valid_passport: number;
  consent_policy_version: string;
  consent_recorded_at: string;
  consent_media_use: number;
  consent_marketing: number;
  ip_hash: string | null;
  user_agent: string | null;
};

export async function insertPendingApplication(db: D1Database, a: InsertPendingApplication): Promise<void> {
  const now = new Date().toISOString();
  await db.prepare(`
    INSERT INTO applications (
      id, cycle_id, transaction_reference, email,
      payment_status, payment_amount_cents, payment_currency,
      eligibility_age_band, eligibility_is_woman, eligibility_african_descent,
      eligibility_outside_ghana, eligibility_valid_passport,
      consent_policy_version, consent_recorded_at, consent_media_use, consent_marketing,
      created_at, updated_at, ip_hash, user_agent
    ) VALUES (
      ?, ?, ?, ?,
      'pending', ?, ?,
      ?, ?, ?, ?, ?,
      ?, ?, ?, ?,
      ?, ?, ?, ?
    )`)
    .bind(
      a.id, a.cycle_id, a.transaction_reference, a.email,
      a.payment_amount_cents, a.payment_currency,
      a.eligibility_age_band, a.eligibility_is_woman, a.eligibility_african_descent,
      a.eligibility_outside_ghana, a.eligibility_valid_passport,
      a.consent_policy_version, a.consent_recorded_at, a.consent_media_use, a.consent_marketing,
      now, now, a.ip_hash, a.user_agent
    )
    .run();
}

export async function markPaymentPaid(
  db: D1Database, id: string, payazaTransactionId: string, paidAt: string
): Promise<void> {
  const now = new Date().toISOString();
  await db.prepare(`
    UPDATE applications
    SET payment_status = 'paid',
        payaza_transaction_id = ?,
        payment_verified_at = ?,
        updated_at = ?
    WHERE id = ? AND payment_status != 'paid'`)
    .bind(payazaTransactionId, paidAt, now, id).run();
}

export async function markPaymentFailed(db: D1Database, id: string, reason: string): Promise<void> {
  const now = new Date().toISOString();
  await db.prepare(`
    UPDATE applications
    SET payment_status = 'failed',
        payment_failure_reason = ?,
        updated_at = ?
    WHERE id = ?`)
    .bind(reason, now, id).run();
}

export async function resetApplicationForRetry(
  db: D1Database, id: string, newReference: string, priorFailureNote: string
): Promise<void> {
  const now = new Date().toISOString();
  await db.prepare(`
    UPDATE applications
    SET transaction_reference = ?,
        payment_status = 'pending',
        payaza_transaction_id = NULL,
        payment_verified_at = NULL,
        payment_failure_reason = ?,
        updated_at = ?
    WHERE id = ? AND payment_status != 'paid'`)
    .bind(newReference, priorFailureNote, now, id).run();
}

export async function setApplyTokenIssued(db: D1Database, id: string, magicLinkSentAt: string): Promise<void> {
  const now = new Date().toISOString();
  await db.prepare(`
    UPDATE applications
    SET apply_token_issued_at = ?,
        magic_link_sent_at = ?,
        updated_at = ?
    WHERE id = ?`)
    .bind(now, magicLinkSentAt, now, id).run();
}

export async function setDraftFile(
  db: D1Database, id: string, field: 'headshot_r2_key' | 'video_r2_key', value: string
): Promise<void> {
  const now = new Date().toISOString();
  await db.prepare(`UPDATE applications SET ${field} = ?, updated_at = ? WHERE id = ?`)
    .bind(value, now, id).run();
}

export type SubmitApplicationFields = {
  full_name: string;
  phone: string;
  date_of_birth: string;
  country_of_residence: string;
  current_city: string;
  country_of_heritage: string;
  bio: string;
  socials_json: string;
};

export async function submitApplication(
  db: D1Database, id: string, fields: SubmitApplicationFields
): Promise<{ success: boolean; reason?: string }> {
  const now = new Date().toISOString();
  const result = await db.prepare(`
    UPDATE applications
    SET full_name = ?, phone = ?, date_of_birth = ?,
        country_of_residence = ?, current_city = ?, country_of_heritage = ?,
        bio = ?, socials_json = ?,
        submitted_at = ?, updated_at = ?
    WHERE id = ?
      AND payment_status = 'paid'
      AND submitted_at IS NULL
      AND headshot_r2_key IS NOT NULL
      AND video_r2_key IS NOT NULL`)
    .bind(
      fields.full_name, fields.phone, fields.date_of_birth,
      fields.country_of_residence, fields.current_city, fields.country_of_heritage,
      fields.bio, fields.socials_json,
      now, now, id
    )
    .run();

  if (result.meta.changes === 0) {
    const row = await getApplicationById(db, id);
    if (!row) return { success: false, reason: 'not_found' };
    if (row.payment_status !== 'paid') return { success: false, reason: 'not_paid' };
    if (row.submitted_at) return { success: false, reason: 'already_submitted' };
    if (!row.headshot_r2_key) return { success: false, reason: 'missing_headshot' };
    if (!row.video_r2_key) return { success: false, reason: 'missing_video' };
    return { success: false, reason: 'unknown' };
  }
  return { success: true };
}

export async function setEmailBounced(db: D1Database, email: string): Promise<void> {
  const now = new Date().toISOString();
  await db.prepare(`UPDATE applications SET email_bounced_at = ?, updated_at = ? WHERE email = ?`)
    .bind(now, now, email).run();
}

export async function listApplicationsForAdmin(
  db: D1Database, opts: { cycleId?: string; status?: string; q?: string; limit: number; offset: number }
): Promise<{ rows: ApplicationRow[]; total: number }> {
  const where: string[] = [`submitted_at IS NOT NULL`];
  const params: unknown[] = [];
  if (opts.cycleId) { where.push(`cycle_id = ?`); params.push(opts.cycleId); }
  if (opts.status) { where.push(`status = ?`); params.push(opts.status); }
  if (opts.q) { where.push(`(email LIKE ? OR transaction_reference LIKE ? OR full_name LIKE ?)`); params.push(`%${opts.q}%`, `%${opts.q}%`, `%${opts.q}%`); }
  const whereSql = `WHERE ${where.join(' AND ')}`;
  const totalRow = await db.prepare(`SELECT COUNT(*) as c FROM applications ${whereSql}`)
    .bind(...params).first<{ c: number }>();
  const total = totalRow?.c ?? 0;
  const result = await db.prepare(`SELECT * FROM applications ${whereSql} ORDER BY submitted_at DESC LIMIT ? OFFSET ?`)
    .bind(...params, opts.limit, opts.offset).all<ApplicationRow>();
  return { rows: result.results ?? [], total };
}

export async function updateApplicationStatus(
  db: D1Database, id: string, status: 'new' | 'reviewing' | 'shortlisted' | 'rejected', adminNotes: string | null
): Promise<void> {
  const now = new Date().toISOString();
  await db.prepare(`UPDATE applications SET status = ?, admin_notes = ?, updated_at = ? WHERE id = ?`)
    .bind(status, adminNotes, now, id).run();
}

export async function insertCycleNotification(
  db: D1Database, args: { id: string; email: string; source: string; disqualifyingRule: string | null }
): Promise<void> {
  const now = new Date().toISOString();
  try {
    await db.prepare(`
      INSERT INTO cycle_notifications (id, email, source, disqualifying_rule, consent_recorded_at, created_at)
      VALUES (?, ?, ?, ?, ?, ?)`)
      .bind(args.id, args.email, args.source, args.disqualifyingRule, now, now).run();
  } catch (e: unknown) {
    // unique constraint — already subscribed; treat as success silently
    if (e instanceof Error && /UNIQUE/i.test(e.message)) return;
    throw e;
  }
}

export async function insertAdminAudit(
  db: D1Database, args: { id: string; adminEmail: string; action: string; targetApplicationId: string | null; detailsJson: string | null; ipHash: string | null }
): Promise<void> {
  const now = new Date().toISOString();
  await db.prepare(`
    INSERT INTO admin_audit (id, admin_email, action, target_application_id, details_json, ip_hash, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)`)
    .bind(args.id, args.adminEmail, args.action, args.targetApplicationId, args.detailsJson, args.ipHash, now).run();
}
