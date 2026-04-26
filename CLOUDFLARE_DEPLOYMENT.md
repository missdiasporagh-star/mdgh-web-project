# Cloudflare Pages Deployment

The site is already live at **[missdiasporagh.org](https://missdiasporagh.org)**. This doc describes the current setup so future deploys (or a recreate) are reproducible.

## Current Setup

| | |
|---|---|
| Pages project | `mdgh-web-project` |
| Account ID | `233d917842862e30ed5207cf7b95bc33` |
| Source repo | `missdiasporagh-star/mdgh-web-project` (branch `main`) |
| Production URL | `mdgh-web-project-4h7.pages.dev` |
| Custom domains | missdiasporagh.org, www.missdiasporagh.org |
| Framework | Astro 5 (auto-detected) |
| Build command | `npm run build` |
| Output dir | `dist` |
| Compatibility date | 2025-11-12 |
| Bindings (prod) | KV namespace `SESSION` (id `e617b51f080c451abe6aade5373fcf6d`) |

## How Auto-Deploy Works

1. Push to `main` on `missdiasporagh-star/mdgh-web-project`
2. Cloudflare Pages picks up the webhook → builds with `npm run build`
3. Deploys to `mdgh-web-project-4h7.pages.dev` and the custom domains
4. PRs get preview deployments at `<short-id>.mdgh-web-project-4h7.pages.dev`

Watch deploys in the Cloudflare dashboard → Workers & Pages → `mdgh-web-project`.

## Local Development

```bash
git clone https://github.com/missdiasporagh-star/mdgh-web-project.git
cd mdgh-web-project
npm install
npm run dev      # http://localhost:4321
```

## Recreate from Scratch (if ever needed)

If the Pages project gets deleted and you need to rebuild it:

1. **Cloudflare dashboard** → Workers & Pages → Create → Pages → Connect to Git
2. Authorize the Cloudflare GitHub App on `missdiasporagh-star/mdgh-web-project`
3. Configure:
   - Production branch: `main`
   - Build command: `npm run build`
   - Output directory: `dist`
   - Compatibility date: latest
4. Re-attach custom domains under **Custom Domains** tab
5. Re-create the `SESSION` KV namespace and bind it under **Settings → Functions → KV namespace bindings**

## Troubleshooting

**Build fails**
- Check the Cloudflare build log
- Verify `npm run build` succeeds locally
- Ensure `package.json` and `package-lock.json` are committed

**Images not loading**
- Place under `public/assets/`
- Reference as `/assets/...` (absolute), not `../assets/...`
- Filenames are case-sensitive on Cloudflare

**WhatsApp widget not appearing**
- Check `src/pages/index.astro` for the `.whatsapp-widget` element
- Confirm GSAP loaded (browser console)

**Contact form not sending**
- EmailJS service ID / template ID / public key must be set in the form's client-side code
- Check browser console for EmailJS errors

## Performance Targets

- Lighthouse Performance: 90+
- FCP <1s, TTI <2s
- Cloudflare CDN global edge (free tier covers MDGH's traffic)

## Useful Links

- [Astro Docs](https://docs.astro.build)
- [Astro Cloudflare adapter](https://docs.astro.build/en/guides/integrations-guide/cloudflare/)
- [Cloudflare Pages Docs](https://developers.cloudflare.com/pages)
- [Wrangler CLI](https://developers.cloudflare.com/workers/wrangler/)
