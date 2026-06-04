-- migrations/0007_one_paid_per_cycle.sql
-- Backstop for the application-level guard in /api/checkout/create: enforce at
-- most one PAID application per (cycle, email). Even if two pending rows for the
-- same email race to "paid" concurrently (a window the create-time guard cannot
-- close on its own), the second markPaymentPaid() violates this index instead of
-- silently recording a duplicate paid application + double charge.
--
-- Partial (WHERE payment_status='paid') so pending/failed/expired rows are
-- unconstrained — an applicant may have abandoned/failed attempts. Indexed on
-- lower(email) because emails are stored verbatim and compared case-insensitively
-- elsewhere (see recover.ts), so "A@b.com" and "a@b.com" must collide.

-- Heal any pre-existing duplicates first, otherwise CREATE UNIQUE INDEX aborts.
-- Keep the EARLIEST paid application per (cycle, lower(email)) as canonical and
-- demote the rest to 'expired' (NOT deleted) with a clear reason. The row,
-- email, and payaza_transaction_id are preserved so the team can refund the
-- duplicate charge. 'expired' (not 'failed') keeps the retry button off it.
-- This mirrors the runtime conflict handling in markPaymentPaid().
UPDATE applications
SET payment_status = 'expired',
    payment_failure_reason = 'duplicate_paid_demoted_by_migration_0007',
    updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
WHERE payment_status = 'paid'
  AND id NOT IN (
    SELECT id FROM (
      SELECT id,
             ROW_NUMBER() OVER (
               PARTITION BY cycle_id, lower(email)
               ORDER BY COALESCE(payment_verified_at, created_at), created_at, id
             ) AS rn
      FROM applications
      WHERE payment_status = 'paid'
    )
    WHERE rn = 1
  );

CREATE UNIQUE INDEX idx_app_one_paid_per_cycle
  ON applications(cycle_id, lower(email))
  WHERE payment_status = 'paid';
