# Miss Diaspora Ghana — Astro Website

Marketing site for Miss Diaspora Ghana, a pageant celebrating women of African descent. Live at **[missdiasporagh.org](https://missdiasporagh.org)**.

![Astro](https://img.shields.io/badge/Built%20with-Astro%205-FF5D01?style=for-the-badge&logo=astro)
![Tailwind](https://img.shields.io/badge/Styled%20with-Tailwind%20v4-38B2AC?style=for-the-badge&logo=tailwind-css)
![Cloudflare](https://img.shields.io/badge/Deployed%20on-Cloudflare%20Pages-F38020?style=for-the-badge&logo=cloudflare)

## Features

- Glassmorphism UI with dark theme + gold accents
- Video background hero
- GSAP scroll animations + Lenis smooth scroll
- WhatsApp chat widget (`wa.me/233591942227`)
- EmailJS-powered contact form
- Fully responsive, SEO-optimized

## Tech Stack

- **Framework:** [Astro 5](https://astro.build) (SSR, `output: 'server'`)
- **Adapter:** [@astrojs/cloudflare](https://docs.astro.build/en/guides/integrations-guide/cloudflare/) (`mode: 'advanced'`)
- **Styling:** [Tailwind CSS v4](https://tailwindcss.com) (Vite plugin)
- **Animation:** GSAP + ScrollTrigger, Lenis, Framer Motion
- **Icons:** lucide-astro
- **Email:** EmailJS (contact form)

## Quick Start

```bash
npm install
npm run dev      # http://localhost:4321
npm run build    # → dist/
npm run preview
```

## Project Structure

```
src/
  components/
    Navigation.astro    # Top nav
    Hero.astro          # Hero with video bg
  layouts/
    Layout.astro        # Base layout
  pages/
    index.astro         # Single-page site
  styles/
    global.css          # Tokens + utilities
public/
  assets/               # Images, videos, logos
astro.config.mjs        # Astro + Cloudflare adapter config
```

## Customization

**Colors** — `src/styles/global.css`:
```css
:root {
  --primary: #F8B92F;   /* Gold */
  --gold: #FFD700;
  --dark: #0A0A0A;
  --light: #FFFFFF;
}
```

**Content** — all in `src/pages/index.astro`.

**WhatsApp number** — search `wa.me/233591942227` in `src/pages/index.astro`.

## Deployment

Auto-deployed to Cloudflare Pages on every push to `main`.

- **Source repo:** `missdiasporagh-star/mdgh-web-project`
- **Project:** `mdgh-web-project`
- **Build:** `npm run build` → `dist`
- **Domains:** missdiasporagh.org, www.missdiasporagh.org

See [`CLOUDFLARE_DEPLOYMENT.md`](./CLOUDFLARE_DEPLOYMENT.md) for full deployment details.

## Performance Targets

- Lighthouse Performance: 90+
- First Contentful Paint: <1s
- Bundle Size: <100KB gzipped

---

Made for **Miss Diaspora Ghana** · Nubian Crown Company Limited
