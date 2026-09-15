# Temporary manual MoMo payments

- Fee: **GHS 230.00**.
- Recipient number: **0598913323** (+233 598 913 323).
- MoMo recipient: **Ebenezer Adjetey Sowah**. Applicants must check this name before authorizing a transfer.
- New production checkout defaults to manual MoMo. `MOCK_PAYMENTS=true` preserves test checkout; `PAYMENT_MODE=payaza` restores gateway checkout.
- WhatsApp payment confirmation: **+233 27 223 7722**, separate from the receiving account.
- The temporary fee is defined in `src/lib/payment/manual.ts`. Existing gateway/cycle prices are preserved for rollback. Admin cycle settings explain this override.

## Applicant flow

Complete eligibility and consent, then receive a `MOMO-` application reference and payment instructions. Send GHS 230 with that reference, then send the receipt transaction ID, amount and date to the confirmation team on WhatsApp at +233 27 223 7722. Payment stays pending until staff verifies it. The instruction page displays payment status when refreshed. Never request a PIN or OTP.

## Staff flow

Open Admin → Applications. Pending manual applications are now visible. Open the matching reference, check the actual incoming transfer in the receiving MoMo account, enter its transaction ID and GHS 230 received, and confirm. The server authenticates the staff session, checks request origin and amount, records an audit event, and emails the existing application magic link. Duplicate receipts and duplicate paid applications are blocked. After confirmation, reload the application detail page. Paid, unsubmitted applications have an **Email application link** button for sending a fresh link to the stored applicant email. This action does not reconfirm or change payment. The result reports provider acceptance or an email error; acceptance is not proof of inbox delivery. Sends are limited to three per application per hour.

Existing gateway references remain eligible for gateway verification. Card retry creation is paused during manual mode; applicants with an existing uncertain card payment should contact support before another transfer.

## Release order

1. Apply `migrations/0011_manual_momo_receipt_unique.sql` to the intended application D1 database before releasing the code. Use the explicit `wrangler.jsonc` Worker configuration, because this repository also has a legacy `wrangler.toml`.
2. Build and deploy the Worker with `MOCK_PAYMENTS=false`. Leave `PAYMENT_MODE` unset for manual checkout.
3. Verify `/apply` displays GHS 230 and the correct number. Verify an unpaid manual reference cannot unlock the form, then complete a staff confirmation using a controlled test receipt in staging.
4. To restore the gateway, set `PAYMENT_MODE=payaza` and redeploy. Existing manual applications retain staff confirmation and recovery support.

## Validation

- Full Vitest suite: 123 passing tests, including the production audit CHECK constraint, admin email authorization, unpaid-access rejection, and email failure handling.
- Production Astro build: passes.
- SQLite: new unique receipt index rejects duplicate paid receipts and permits the existing duplicate-parking behavior.
- Full Astro type check encounters unrelated existing project errors. The historical `0005_seed_mdgh_2026.sql` also fails a fresh SQLite migration replay (11 values for 8 columns); this change does not modify that seed.
- Production release runs through `.github/workflows/deploy.yml`, applying the receipt index before deploying. See `CLOUDFLARE_DEPLOYMENT.md` for the verified process.

## Gateway payment recovery during the outage

Collect the successful gateway receipt/reference and reconcile it against the original gateway payment. Do not enter placeholder IDs such as `ALREADYPAID` in the MoMo form or treat an original card payment as a MoMo transfer. A pending gateway response is not confirmation of receipt. Once the original application is paid, staff can open its detail page and use **Email application link**, or the applicant can use Recover with that original reference and email.

Manual confirmation audit events use the existing `status_change` action with `event: manual_momo_confirmation` in details. Email requests use `signed_url_issued` with `event: application_link_email_requested`. Both respect the production audit table CHECK constraint; no schema migration is needed for this repair.
