# Cloudflare Worker deployment

Production is the **mdgh-web-project Worker with static assets**, using `wrangler.jsonc`. The Pages instructions previously in this file are obsolete. The successful deployment of commit `3a2ac7267529e0d3fa1812dd04a939e5936e0284` on 2026-09-04 used the GitHub Actions workflow below.

## Target

- Repository: `missdiasporagh-star/mdgh-web-project`, branch `main`.
- Workflow: `.github/workflows/deploy.yml` (Deploy Worker).
- Worker: `mdgh-web-project` in the account selected by the workflow.
- Domains: `missdiasporagh.org`, `www.missdiasporagh.org`, `apply.missdiasporagh.org`.
- Entry: `dist/_worker.js/index.js`; static assets: `dist`.
- Database: `mdgh-applications-db`, binding `DB`.
- KV: `KV`; R2: `MEDIA` (`mdgh-applications`).
- The legacy `wrangler.toml` and the named `production` environment target a different deployment shape. Always pass `--config wrangler.jsonc` and use the top-level configuration for this site.

## Release process

1. Review the exact diff; exclude unrelated local files and secrets.
2. Run `npm ci`, `npm test`, and `npm run build`.
3. Commit and push the reviewed change to `main`. This triggers Deploy Worker.
4. CI installs dependencies, runs tests, and builds Astro.
5. CI applies the additive, idempotent `0011_manual_momo_receipt_unique.sql` to the configured remote D1 database. It does not replay historical seed migrations.
6. CI deploys with `wrangler deploy --config wrangler.jsonc` using the existing GitHub Cloudflare secret.
7. Wait for that exact commit's workflow to complete; inspect migration and deployment logs and record the Worker version.
8. Verify the live application page and API protections. For this release, the page must show **GHS 230**, **Ebenezer Adjetey Sowah**, and **0598913323**, with no Payaza checkout script on the manual application page. Unauthenticated staff confirmation must return 401.

## Manual fallback

Use the same configuration and account as CI. Apply only the reviewed migration before deploying; do not run a fresh replay of historical migrations against production.

```sh
npx wrangler d1 execute mdgh-applications-db --remote --config wrangler.jsonc --file migrations/0011_manual_momo_receipt_unique.sql
npm run build
npx wrangler deploy --config wrangler.jsonc
```

## Payment rollback

Set `PAYMENT_MODE=payaza` in the deployed top-level Worker variables and redeploy to restore gateway checkout. Preserve the receipt uniqueness index and staff confirmation route for outstanding manual applications. The temporary manual fee override does not change the saved gateway cycle price. See [manual MoMo operations](docs/manual-momo-payments.md).

## Credentials

CI uses the existing `CLOUDFLARE_API_TOKEN` GitHub Actions secret and the account configured in the workflow. Runtime secrets stay in Cloudflare. Never commit `.dev.vars`, tokens, or credentials.
