# Miss Diaspora Ghana — Platform Redesign Design Spec

**Spec ID:** 2026-04-26-mdgh-platform-redesign
**Scope:** Spec 1 of 3 — Public Site Redesign + Foundation
**Status:** Approved (revised 2026-04-26)
**Author:** ohwpstudios@gmail.com
**Date:** 2026-04-26

---

## Revision Log

**2026-04-26 (after M0.5):** Switched the content layer from **Sanity Studio** to **Astro Content Collections**. Reason: the editor is solo + technical and doesn't benefit from Sanity's headless-CMS UI; the original Drive integration was about external media *hosting*, not importing. The simpler architecture: markdown/MDX content files in `src/content/` validated by TypeScript schemas, with `<YouTubeEmbed>` and `<DriveEmbed>` components for external media references. This deletes the Drive Importer Worker, the Sanity Studio plugin, the dataset-promotion ritual, and Spec 2 entirely (Spec 2 was "CMS hardening" — there's no CMS to harden). All sections below are updated to reflect this; the vision, audience strategy, design system, six wow features, and quality gates are unchanged.

---

## 1. Vision

A diaspora pageantry platform that makes a future contestant feel *"I belong here, and I've never seen a place like this online"* — and gives every other audience (sponsors, alumni, press, community) a dedicated zone that respects their reason for showing up.

The redesign replaces the current single-page site at `missdiasporagh.org` with a multi-page Astro 5 platform (13 top-level pages + 2 dynamic detail templates, ~14 routes total) deployed to `staging.missdiasporagh.org` for review. On approval, custom domains cut over from the existing Cloudflare Pages project (`mdgh-web-project`) to the new project (`mdgh-platform`); the old project is preserved untouched as a rollback.

## 2. Spec Decomposition Context

This redesign is part of a three-spec plan agreed during brainstorming:

- **Spec 1 (this document):** Public site redesign, foundation, content collection schemas wired in. Ships first.
- **Spec 2:** *(Largely obsolete after the 2026-04-26 revision.)* Originally "Sanity CMS hardening." If non-tech editors need to be onboarded later, this spec becomes "Decap CMS layer over the existing content collections" — adds a `/admin` web UI that edits markdown via GitHub. Until then, Spec 2 is on hold.
- **Spec 3:** Pageant platform features — paid contestant application form (provider-agnostic gateway), live voting + judging portal, AR crown try-on, AI pageant coach, sponsor activation hub.

Spec 1 reserves architectural primitives (e.g., `PaymentProvider` interface, disabled voting CTA stub) so Spec 3 plugs in without re-architecting.

## 3. Scope

### 3.1 Spec 1 IS
- A from-scratch site at `staging.missdiasporagh.org` — fresh repo `mdgh-platform`, fresh Cloudflare Pages project, no inheritance from current code.
- 13 pages in the **Neo-African Futurism** visual world (palette, typography, motion, components defined in §6).
- 6 wow-factor experiences built into the redesign + a public Apply entry page that links to a Spec 3 placeholder.
- Content stored as **Astro Content Collections** (markdown/MDX with type-safe TypeScript schemas in `src/content/`) — version-controlled in git, edited in your code editor, deployed via push.
- **YouTube + Google Drive media** referenced by URL via `<YouTubeEmbed>` and `<DriveEmbed>` components — media stays where it lives, no rehosting/import pipeline.
- A clean **`PaymentProvider` abstraction** so Spec 3 plugs in any gateway without re-architecting.
- A **staging→prod cutover plan** (one Cloudflare DNS change).

### 3.2 Spec 1 IS NOT (deferred)
- The actual gated/paid application form, file uploads, applicant dashboard → **Spec 3**.
- Live voting, AR crown try-on, AI pageant coach, sponsor analytics dashboard → **Spec 3**.
- "Find Your Sister" mentor matching → Spec 3.
- Live runway streaming → Spec 3.
- Multi-language UI — English-only V1; revisit if data shows demand.
- A web-based admin UI for non-tech editors → originally "Spec 2 / Sanity hardening", now reframed as "if needed, add Decap CMS over the same content collections." Not in scope for V1.
- Drive media *importing/rehosting* (was Spec 1; cut in 2026-04-26 revision). If hot-link throttling becomes a real problem after launch, write a one-time R2-rehost script then.

### 3.3 Hard Constraint: Asset Reuse Inventory
No asset, font, copy line, or class name may be copy-pasted from the current site. Reusable inputs are limited to:

- **Logos:** `mdgh main logo.png`, `mdgh main logo mini.png`, `mdgh logo updated no bg.png`, `md fav.png`, `md fav 1024px.png`
- **Partner logos:** `diaspora_logo.png`, `exim_logo.png`, `gtdc_logo.jpg`, `kes_logo.png`
- **Photography:** `yvonne_kofigah.jpg` (GM portrait), `about_mdgh.jpg`
- **Video:** `mdgh intro vid.mp4`, `q1.mp4`, `q2.mp4`, `q3.mp4`, `q4.mp4` (and `online-video-cutter.com` variants)
- **Factual copy:** mission statement, three pillars, contact info, founder/GM facts (rewritten in new voice but factually carried over)

Everything else — color, type, layout, components, animation, photography treatment, prose voice — is replaced.

## 4. Audience Strategy

| Audience | Primary "home" page | Secondary touchpoints |
|---|---|---|
| **Future contestants** *(hero owner)* | `/apply` | `/`, `/contestants`, `/heritage` |
| Sponsors & corporate partners | `/sponsors` | `/`, `/mission`, `/programs` |
| Diaspora community | `/diaspora`, `/quiz` | `/`, `/heritage` |
| Media, press & influencers | `/news` | `/`, `/contestants`, `/heritage` |
| Alumni & past contestants | `/heritage` | `/`, `/contestants` |

**Hero ownership:** the homepage hero (first 5 seconds) is owned by future contestants. Aspirational identity is the most viscerally cinematic emotion and naturally pulls every other audience inward.

## 5. Information Architecture

### 5.1 Pages

| URL | Purpose | Page type |
|---|---|---|
| `/` | Cinematic gateway, six-chapter scroll teasing every feature | Singleton (`homePage`) |
| `/about` | Origin story, founder, GM | Singleton (`aboutPage`) |
| `/mission` | Three pillars, expanded | Singleton (`missionPage`) |
| `/programs` | Programs catalogue | Singleton (`programsPage`) |
| `/contestants` | Current cycle hub (grid) | Generated from `cycle` (current) + `contestant[]` |
| `/contestants/[slug]` | Contestant detail | Generated from `contestant` |
| `/heritage` | Crown Heritage Timeline | Generated from `queen[]` |
| `/diaspora` | Interactive Diaspora Globe | Generated from `diasporaCity[]` |
| `/quiz` | Heritage Quiz + result | Generated from `quizQuestion[]` + `quizResult[]` |
| `/sponsors` | Partner roster + sponsorship tiers | Singleton (`sponsorsPage`) |
| `/news` | Press & newsroom feed | Generated from `pressArticle[]` |
| `/news/[slug]` | Article detail | Generated from `pressArticle` |
| `/apply` | Application funnel entry (eligibility, cycle dates, fee, "Begin" CTA → waitlist) | Singleton (`applyPage` config) + current `cycle` collection entry |
| `/contact` | Contact + social | Singleton (`contactPage` config) |

### 5.2 Navigation

- **Top nav (always visible, 6 items):** Story · Heritage · Contestants · Apply · For Sponsors · Press
  - **Apply** = primary CTA, saffron pill button, distinct treatment, right-aligned
- **Mobile:** hamburger overlay, full-screen takeover with cinematic backdrop, same 6 items
- **Footer:** secondary navigation — About, Mission, Programs, Diaspora Globe, Quiz, Contact, Legal (Privacy, Terms)
- **Cultural Greeting overlay:** first visit only (cookie-gated), 4–6 second moment, then dissolves into the Home

### 5.3 Astro Content Collections

Content lives as markdown/MDX files under `src/content/`, validated by TypeScript schemas in `src/content/config.ts`. Editing happens in your code editor; commits trigger Cloudflare Pages redeploys.

**Singletons (one TS/JSON file each, `src/data/`):**
- `site.ts` — logo, social links, contact info, footer copy
- `culturalGreeting.ts` — image path, audio path, greeting text, subtitle, dismiss copy

**Page-config singletons (one MDX file each, `src/content/pages/`):**
- `home.mdx` — six chapter blocks (each: title, body MDX, media reference, CTA)
- `about.mdx`, `mission.mdx`, `programs.mdx`, `sponsors.mdx`, `apply.mdx`, `contact.mdx`

**Collections (multiple files per directory):**
- `src/content/cycles/*.mdx` — year, theme, opens, closes, fee, status (`upcoming` | `current` | `past`). Exactly one with status `current` (build-time validation).
- `src/content/contestants/*.mdx` — name, slug, cycle ref, hero image path, hero video URL (YouTube/Drive), bio MDX, charity platform, gallery (array of image paths or video URLs), social links.
- `src/content/queens/*.mdx` — past winners. Name, crown number, year, era theme, photo, bio MDX, achievements, current city/role.
- `src/content/press/*.mdx` — title, source, date, excerpt, external URL or full body.
- `src/content/cities/*.mdx` — name, country, lat, lng, hero image, story MDX, optional video URL, related queens/contestants by slug.
- `src/content/quiz-questions/*.mdx` — question text, 4 options, weight-per-region matrix.
- `src/content/quiz-results/*.mdx` — region archetype, illustration, accent hex color, description.

**Reusable Astro components (consumed inside MDX or pages):**
- `<YouTubeEmbed url="..." caption="..." />` — extract ID, render with `lite-youtube-embed`.
- `<DriveEmbed url="..." kind="image|video" caption="..." />` — extract Drive file ID, render via Drive's direct embed (`uc?id=`/`preview` for video). No rehosting; if throttling becomes an issue post-launch, swap implementation behind the same component API.
- `<Cta label="..." href="..." variant="primary|secondary|ghost" />`.

**Waitlist storage** (originally `waitlistEntry` Sanity doc): replaced with **Google Form embed** at `/apply/waitlist` — submissions land in a Google Sheet you own. Zero infra. If a custom-styled form is preferred later, a small Cloudflare Worker can POST to a Google Apps Script webhook → same Sheet, same management surface.

## 6. Visual Design System: Neo-African Futurism

### 6.1 Color Tokens

**Foundation:**
- Obsidian `#050111` — base background
- Raised `#0E0420` — section background
- Deep Violet `#1A0833` — card background
- Surface `#21104A` — elevated card

**Brand:**
- Royal Violet `#6B2BD9` — interactive, links, primary state
- Saffron `#FFD166` — CTA, accent, "the gold"
- Rose `#FF7EB3` — energy, highlight, hover accents

**Neutrals & functional:**
- Bone `#FFF8EC` — long-form text background (for any future white-bg surfaces)
- Text 1/2/3/4: `#fff` / 75% / 55% / 35%
- Border subtle: `rgba(107,43,217,.25)` · Border strong: `rgba(255,209,102,.4)`
- Success `#4ADE80` · Warning `#FBBF24` · Danger `#FB7185`

### 6.2 Typography

- **Display & headlines:** **Fraunces** (variable, opsz, SOFT axis, free, self-hosted via `@fontsource-variable/fraunces`). Italic-soft for ceremonial moments.
- **UI & body:** **Inter** (variable, free, `@fontsource-variable/inter`)
- **Tagline / meta / wayfinding:** **JetBrains Mono** (free, `@fontsource/jetbrains-mono`)

**Type scale (modular, base 16px):**
| Token | Size | Family / Weight |
|---|---|---|
| display-l | 96px | Fraunces 400 italic, opsz 144, SOFT 60 |
| display-m | 60px | Fraunces 600, opsz 96 |
| h1 | 48px | Fraunces 500 |
| h2 | 36px | Fraunces 500 |
| h3 | 24px | Inter 700 |
| body-l | 18px | Inter 400, line-height 1.6 |
| body | 16px | Inter 400, line-height 1.6 |
| meta | 11px | JetBrains Mono 600, letter-spacing .25em uppercase |

### 6.3 Spacing

8-point grid. Tokens: 4, 8, 12, 16, 24, 32, 48, 64, 96, 128.

### 6.4 Border Radius

`sm 6` (inputs) · `md 12` (cards) · `lg 20` (large cards) · `xl 32` (hero cards) · `full 9999` (pills, avatars).

### 6.5 Motion

- **Easing — Emphasized:** `cubic-bezier(.2,.7,.1,1)` — for hero entrances and theatrical moments
- **Easing — Standard:** `cubic-bezier(.4,0,.2,1)` — for component states
- **Durations:** 150ms (hover/micro) · 300ms (component) · 600ms (page section reveal) · 1100ms (hero cinematic entrance)
- **Reduced motion (`prefers-reduced-motion: reduce`):** transforms swap to opacity, parallax off, pinned scroll → static stack, greeting overlay shortened to 200ms fade

### 6.6 Components

Catalogued in `/design-system` reference route during build. Includes: primary button (saffron pill), secondary button (ghost violet border), tertiary link (rose underline), input field, chip/tag, feature card (gradient surface, glow on hover), pull quote, navigation item, hero strip.

### 6.7 Photography Direction

Skin tones never desaturated. Subtle film grain (8% opacity, multiply blend layer applied via CSS). Cool deep shadows, warm subject highlights, low-key lighting where possible. Subjects centered, full-bleed, rarely cropped tight. Alt text required on every image (TypeScript schema validation in content collections — missing `alt` fails the build).

## 7. The Six Wow Features

### 7.1 Cinematic Scroll Storytelling — `/`
- **Experience:** Six pinned chapters — Hero (video bg, italic Fraunces headline reveal, "Begin Your Story" CTA) → Mission ("We crown the women who carry continents") → The Crown (queens preview teasing `/heritage`) → The Diaspora (mini globe teasing `/diaspora`) → Current Cycle (contestants teasing `/contestants`) → Become Her (final CTA → `/apply`).
- **Tech:** GSAP ScrollTrigger pinning + parallax video. React island only for the chapter-progress rail. Reduced-motion mode collapses to stacked static sections.
- **CMS:** `homePage` singleton — each chapter is a Portable Text block + media slot + CTA.

### 7.2 Crown Heritage Timeline — `/heritage`
- **Experience:** Horizontal scroll-snap timeline. Each card = full-height portrait + year badge + crown number + name. Click → expanded modal with full bio, photo gallery, current city/role.
- **Tech:** CSS `scroll-snap-x mandatory` + IntersectionObserver. Arrow-key, trackpad horizontal, mobile swipe support. Vertical list fallback at <768px.
- **CMS:** `queen[]` collection.

### 7.3 Cultural Greeting on Entry — overlay
- **Experience:** First visit only. 4-second moment: page dims → still image fades in with **"Akwaaba"** (Fraunces, large, italic) + English subtitle "Welcome home" → optional 2-second audio greeting (gated behind a "tap to hear" button to comply with autoplay policies) → dissolves into Home. Skip button always top-right.
- **State:** Cookie `mdgh_greeted=1`, 365-day TTL. Stored in KV namespace if we want server-side dedupe later.
- **Reduced motion:** shorter, no pan, audio off by default.
- **CMS:** `culturalGreeting` singleton.

### 7.4 Interactive Diaspora Globe — `/diaspora`
- **Experience:** 3D rotating globe, auto-rotates idle. Dots = cities. Hover → city name; click → side-panel story (photo, copy, optional YouTube video, related queens/contestants from that city).
- **Tech:** `react-globe.gl` (Three.js wrapper) lazy-loaded as React island. Static world map + marker grid fallback for reduced-motion / low-power devices.
- **CMS:** `diasporaCity[]` collection.

### 7.5 Current Cycle Contestant Hub — `/contestants` + `/contestants/[slug]`
- **Index:** Cinematic 3-up grid (1-up mobile), each card = full portrait + name + region + cycle badge. Hover plays muted video preview.
- **Detail:** Full-bleed hero (photo or video), bio, charity platform, photo gallery (mix of `public/` images and `<DriveEmbed>`/`<YouTubeEmbed>`), social links, shareable. **Voting button exists but disabled** with copy *"Opens during finale week"* — Spec 3 turns it on.
- **CMS:** `contestant[]` collection.

### 7.6 Diaspora Heritage Quiz — `/quiz`
- **Experience:** A sequence of full-screen questions (Fraunces display, large tap targets, illustration per question — V1 ships with six, count is content-driven via the `quizQuestion[]` collection) → animated reveal of personalized region archetype card ("You are: Volta", or Ashanti / Greater Accra / Northern / Western / etc.).
- **Shareable:** Dynamic OG image generation — Cloudflare Worker uses Satori to render a per-result PNG so social previews show the personalized card.
- **CMS:** `quizQuestion[]` (text, 4 options, weight-per-region matrix), `quizResult[]` (region, illustration, description, OG template).

## 8. Apply Funnel Entry — `/apply`

V1 stub for the Spec 3 gated paid form.

- **Hero:** "Apply for Crown XXVI" (cycle copy from CMS — title generated from `cycle.year`).
- **Cycle info card:** year, theme, opens, closes, application fee — all from the `cycle` document with status `current`.
- **Eligibility list + "What you'll need" prep checklist:** Portable Text in `applyPage` singleton.
- **Primary CTA "Begin Application"** → `/apply/waitlist` (Spec 1 ships a waitlist email capture; Spec 3 swaps in the paid form).
- **Waitlist storage:** Google Form embed at `/apply/waitlist`. Submissions land in a Google Sheet you own. Zero infra, zero secrets, zero code beyond an iframe. If you later want a custom-styled native form, swap in a tiny Worker that POSTs to a Google Apps Script webhook → same Sheet.

## 9. Tech Architecture

### 9.1 Stack
| Layer | Choice |
|---|---|
| Framework | Astro 5 (SSR via `@astrojs/cloudflare` advanced mode) |
| Styling | Tailwind v4 (Vite plugin) + design tokens as CSS custom properties |
| Interactive islands | React 19 — only on `/diaspora` (Globe), `/quiz` (state machine), `/heritage` (horizontal scroller). Astro static everywhere else. |
| Animation | GSAP + ScrollTrigger (cinematic scroll), Lenis (smooth scroll), CSS for micro-interactions |
| Fonts | Fraunces + Inter + JetBrains Mono via `@fontsource-variable` (self-hosted) |
| Content | Astro Content Collections — markdown/MDX in `src/content/` validated by TypeScript schemas in `src/content/config.ts`. Edited in your code editor; deployed via git push. |
| Media | Local images in `public/` referenced by path; YouTube via `lite-youtube-embed`; Drive via direct embed components (no rehosting). |
| Edge runtime | Cloudflare Workers via Pages Functions (used for OG image worker + waitlist Worker if/when added) |
| Storage | KV (binding reserved for future server-side session/dedupe needs — Spec 1 cultural-greeting state lives in a browser cookie); D1 deferred to Spec 3. |
| OG image generation | Satori on Cloudflare Workers |
| Waitlist storage | Google Form embed (submissions land in a Google Sheet you own). No infra, no secrets. |

### 9.2 Repo Structure
```
mdgh-platform/
├── src/
│   ├── components/        # Astro + React components, organized by feature
│   ├── content/           # Astro Content Collections
│   │   ├── config.ts      # TypeScript schema definitions for all collections
│   │   ├── pages/         # home.mdx, about.mdx, mission.mdx, programs.mdx, sponsors.mdx, apply.mdx, contact.mdx
│   │   ├── cycles/        # one .mdx per cycle (e.g., 2026.mdx)
│   │   ├── contestants/   # one .mdx per contestant
│   │   ├── queens/        # one .mdx per past winner
│   │   ├── press/         # one .mdx per article
│   │   ├── cities/        # one .mdx per diaspora city (with lat/lng)
│   │   ├── quiz-questions/
│   │   └── quiz-results/
│   ├── data/              # Singleton TS/JSON config (siteSettings, culturalGreeting)
│   ├── layouts/
│   ├── pages/             # /, /about, /contestants, /heritage, /diaspora, /quiz, /apply, etc.
│   ├── lib/
│   │   └── payment/       # provider-agnostic abstraction (interface only in Spec 1)
│   └── styles/
├── workers/
│   └── og-image/          # Satori OG image generator (only Worker needed in Spec 1)
├── public/                # Logos, partner marks, hero stills, contestant photos (organized by cycle)
│   ├── logos/
│   ├── partners/
│   └── cycles/2026/contestant-name/...
├── astro.config.mjs
└── wrangler.toml
```

### 9.3 Data Flow
1. Editor edits a markdown file in `src/content/` (e.g., adds a contestant).
2. Editor commits and pushes to GitHub.
3. Cloudflare Pages picks up the push → builds the site → deploys.
4. Astro at request time renders pages by reading the content collections from the bundle (zero runtime CMS calls — content is built into the deploy).
5. React islands (Globe, Quiz, Heritage Timeline) receive their data via component props at build time (SSR-baked into HTML, hydrate on the client).

### 9.4 Payment Provider Abstraction
Defined in `src/lib/payment/`:

```typescript
// src/lib/payment/types.ts
export interface PaymentProvider {
  createCheckout(input: CheckoutInput): Promise<CheckoutSession>;
  verifyWebhook(payload: unknown, signature: string): Promise<WebhookEvent>;
  getStatus(sessionId: string): Promise<PaymentStatus>;
  refund(sessionId: string, amount?: number): Promise<RefundResult>;
}
```

Spec 1 ships only the interface + a `MockProvider` for local dev. Spec 3 implements the real adapter(s) — Paystack, Stripe, Flutterwave, Hubtel, or any combination — without touching the form or the funnel.

### 9.5 Environments & Cutover

- **Cloudflare Pages projects:** new project `mdgh-platform`, branch `main` deploys to `staging.missdiasporagh.org`. Production project `mdgh-web-project` stays live and untouched.
- **One source of truth:** since content lives in git, "staging" vs. "production" is just which custom domain points at the new project. There is no separate content store to promote.
- **Cutover when greenlit:**
  1. Smoke-test `staging.missdiasporagh.org` end to end with the final content state in the repo.
  2. Move custom domains `missdiasporagh.org` + `www.missdiasporagh.org` from `mdgh-web-project` → `mdgh-platform` in the Cloudflare dashboard.
  3. Verify DNS + SSL propagated. Confirm sitemap reflects new content.
  4. Archive old repo (rename, keep for rollback).
- **Rollback:** swap custom domains back. Current site is preserved untouched throughout — no destructive step.

### 9.6 Secrets & Env
- Cloudflare Pages project env vars: `OG_SECRET` (signing query params on the OG image worker, optional).
- Worker secrets: none required for Spec 1 (the OG worker is fully public).
- No secret committed to repo. `.env.example` documents the (small) set of required keys.

## 10. Quality Gates

### 10.1 Performance (per page, mobile mid-range device)
- Lighthouse Performance ≥ 95 · FCP < 1s · LCP < 2.5s · INP < 200ms · CLS < 0.1
- Initial JS bundle < 120 KB gzipped
- Images: Astro `<Image>` with WebP/AVIF + responsive `srcset` for local images in `public/`; YouTube via `lite-youtube-embed` lazy facade; Drive embeds lazy-loaded via `loading="lazy"` iframe.
- Videos: `mp4` + `webm` siblings; `preload="metadata"`; no autoplaying loops above-the-fold on cellular (`navigator.connection.saveData` check)

### 10.2 Accessibility (WCAG 2.1 AA)
- 4.5:1 contrast for body, 3:1 for large text — design tokens already satisfy this
- All interactives ≥ 44×44 px hit area, visible focus ring (saffron 2px outline)
- Full keyboard navigation including the horizontal Heritage Timeline and the Globe (arrow keys + Tab to dot list fallback)
- Screen-reader landmarks, `aria-live` on dynamic regions, alt text required on every image (TypeScript schema validation in content collections — missing `alt` fails the build)
- `prefers-reduced-motion` honored throughout
- Captions on every video (transcript stored alongside the content collection entry; YouTube auto-captions accepted as fallback)

### 10.3 Browser Support
Last 2 versions of Chrome / Edge / Safari / Firefox · iOS Safari 15+ · Android Chrome 100+. No IE.

### 10.4 SEO & Social
- Per-page meta + OG + Twitter cards (CMS-driven via `siteSettings` defaults + per-page overrides)
- `sitemap.xml` auto-generated from CMS routes, `robots.txt`
- JSON-LD structured data: `Organization` (sitewide), `Person` (contestant + queen pages), `Event` (cycle pages), `BreadcrumbList`

### 10.5 Security
- CSP headers (strict, nonce-based for inline scripts), HSTS, X-Content-Type-Options, Referrer-Policy
- All third-party origins explicitly allow-listed (YouTube, Google Drive, the OG image worker, Cloudflare)
- No secrets in client bundle; sensitive endpoints via Workers with origin checks

### 10.6 Testing
- **Unit:** `PaymentProvider` abstraction interface contract, content collection query helpers, quiz scoring algorithm
- **Component:** React islands (Globe loads, Quiz scores correctly, Timeline scrolls)
- **E2E (Playwright):** home cinematic scroll completes, contestant detail renders from CMS, quiz happy path → result page, apply CTA → waitlist submission

## 11. Implementation Phasing

Quality over speed; rough pacing follows.

| Milestone | Focus | Approx. duration |
|---|---|---|
| **M0 — Foundation** | Fresh `mdgh-platform` repo, Cloudflare Pages project bound to staging.missdiasporagh.org, Astro Content Collections set up + base config singletons, design tokens & fonts self-hosted, "hello world" live | ~3–5 days |
| **M1 — Design system & shell** | Every component from §6 built and tokenized · top nav · footer · base layouts · `/design-system` reference route | ~1 week |
| **M2 — Editorial pages** | About · Mission · Programs · Sponsors · News (index + detail) · Contact — all CMS-driven | ~1–1.5 weeks |
| **M3 — Cinematic Home + Cultural Greeting** | Six-chapter scroll, GSAP pinning, greeting overlay with cookie + audio gating | ~1 week |
| **M4 — Heritage + Contestants** | `/heritage` horizontal timeline · `/contestants` index + detail · `<DriveEmbed>` + `<YouTubeEmbed>` components | ~1 week |
| **M5 — Globe + Quiz + OG** | `/diaspora` 3D globe · `/quiz` six-question flow · Satori OG worker for shareable result cards | ~1 week |
| **M6 — Apply funnel + final QA** | `/apply` page · waitlist capture · full Lighthouse/axe pass · cross-browser sweep | ~1 week |
| **M7 — Greenlight & Cutover** | Final smoke test · swap custom domains in Cloudflare · DNS/SSL verify · archive old repo | ~1 hour |

Each milestone ends with a deployed staging build the user can review and a demo-ready slice. Nothing waits until the end.

## 12. Open Decisions Reserved for Future Specs

These are explicitly *not* decided now; they belong to Spec 2 or Spec 3.

- **Payment gateway selection** (Spec 3) — abstraction is in place; specific provider(s) TBD.
- **Application form fields** (Spec 3) — what data we collect, file uploads, video submissions.
- **Live voting mechanics** (Spec 3) — public web vote, SMS, judge portal, leaderboard.
- **Sponsor analytics** (Spec 3) — which metrics, dashboard surface.
- **Multi-language UI** — deferred until data shows demand; Astro Content Collections support i18n via per-locale subdirectories (e.g., `src/content/contestants/en/` + `src/content/contestants/fr/`) when needed. Spec 1 ships English-only.

## 13. Glossary

- **Cycle:** one annual edition of the pageant, e.g., "Crown XXVI". Stored as one `.mdx` file in `src/content/cycles/`. Exactly one has `status: current` at a time (build-time validation).
- **Queen:** a past winner (alumni). Distinct from `contestant` to allow different content schemas.
- **Contestant:** a current-cycle participant. Carries a `cycle` ref.
- **Heritage Timeline:** the `/heritage` page rendering all `queen` documents.
- **Diaspora Globe:** the `/diaspora` page rendering all `diasporaCity` documents on a 3D globe.
- **Cultural Greeting:** first-visit overlay defined by the `culturalGreeting` singleton.
- **`PaymentProvider`:** TypeScript interface in `src/lib/payment/types.ts` that all gateway adapters implement.
