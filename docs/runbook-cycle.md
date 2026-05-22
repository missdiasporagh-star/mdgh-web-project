# Cycle Open / Close Runbook

## Opening a new cycle

1. Apply a new migration `migrations/00XX_seed_<cycle_id>.sql` that:
   - Inserts a new row into `cycles` with the new `cycle_id`, fee, currency, policy version, open/close dates, and `is_active = 1`
   - Sets the previous active cycle to `is_active = 0`
2. Update the `cycle_id` placeholder in `src/pages/api/upload/presign.ts` (if not already cycle-aware) to read from `getActiveCycle()` instead.
3. Verify by curling `/apply` — the page should show the new cycle name and fee.
4. Run a sandbox transaction end-to-end to confirm Payaza, R2, D1, email all work for the new cycle.

## Closing a cycle

1. Set `is_active = 0` on the cycle row OR let `applications_close_at` pass naturally.
2. New `/apply` visits redirect to `/apply/closed`.
3. Existing magic links continue to work for already-paid applicants until their token expires (capped at `applications_close_at`).
4. Optionally, run the data-retention cleanup script 3 years after `applications_close_at`.

## Resending an applicant's link manually (operator-side)

If an applicant emails support saying they paid but lost everything:
1. Look up by email or reference in `/admin/applications`.
2. Confirm their `payment_status = 'paid'`.
3. Have them use `/apply/recover` themselves with their email + reference.
4. If recover fails (e.g., wrong reference), manually issue them a magic link by running locally:
   `npx tsx scripts/issue-magic-link.ts <application_id>`
   (Operator-side script; not in V1 — add if a real case requires it.)
