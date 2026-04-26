# Miss Diaspora Ghana — Platform Redesign Design Spec

**Spec ID:** 2026-04-26-mdgh-platform-redesign
**Scope:** Spec 1 of 3 — Public Site Redesign + Foundation
**Status:** Draft pending user review
**Author:** ohwpstudios@gmail.com
**Date:** 2026-04-26

---

## 1. Vision

A diaspora pageantry platform that makes a future contestant feel *"I belong here, and I've never seen a place like this online"* — and gives every other audience (sponsors, alumni, press, community) a dedicated zone that respects their reason for showing up.

The redesign replaces the current single-page site at `missdiasporagh.org` with a multi-page Astro 5 platform (13 top-level pages + 2 dynamic detail templates + the Studio link, ~15 routes total) deployed to `staging.missdiasporagh.org` for review. On approval, custom domains cut over from the existing Cloudflare Pages project (`mdgh-web-project`) to the new project (`mdgh-platform`); the old project is preserved untouched as a rollback.

## 2. Spec Decomposition Context

This redesign is part of a three-spec plan agreed during brainstorming:

- **Spec 1 (this document):** Public site redesign, foundation, CMS schemas wired in. Ships first.
- **Spec 2:** Sanity CMS hardening — editor experience polish, roles, scheduled publishing, Drive Importer plugin polish, content migration playbook.
- **Spec 3:** Pageant platform features — paid contestant application form (provider-agnostic gateway), live voting + judging portal, AR crown try-on, AI pageant coach, sponsor activation hub.

Spec 1 reserves architectural primitives (e.g., `PaymentProvider` interface, disabled voting CTA stub) so Spec 3 plugs in without re-architecting.

## 3. Scope

### 3.1 Spec 1 IS
- A from-scratch site at `staging.missdiasporagh.org` — fresh repo `mdgh-platform`, fresh Cloudflare Pages project, no inheritance from current code.
- 13 pages in the **Neo-African Futurism** visual world (palette, typography, motion, components defined in §6).
- 6 wow-factor experiences built into the redesign + a public Apply entry page that links to a Spec 3 placeholder.
- Wired to a **Sanity Studio** CMS (Sanity-hosted at `mdgh.sanity.studio`) — content models live from day one, Spec 2 hardens the editor experience.
- A clean **`PaymentProvider` abstraction** so Spec 3 plugs in any gateway without re-architecting.
- A **staging→prod cutover plan** (one Cloudflare DNS change).

### 3.2 Spec 1 IS NOT (deferred)
- The actual gated/paid application form, file uploads, applicant dashboard → **Spec 3**.
- Live voting, AR crown try-on, AI pageant coach, sponsor analytics dashboard → **Spec 3**.
- "Find Your Sister" mentor matching → Spec 3.
- Live runway streaming → Spec 3.
- Multi-language UI — English-only V1; revisit if data shows demand.
- CMS editor configuration polish & roles → **Spec 2**.

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
| `/apply` | Application funnel entry (eligibility, cycle dates, fee, "Begin" CTA → waitlist) | Singleton (`applyPage`) + current `cycle` |
| `/contact` | Contact + social | Singleton (`contactPage`) |
| `/studio` link | Redirects to `mdgh.sanity.studio` | Static redirect |

### 5.2 Navigation

- **Top nav (always visible, 6 items):** Story · Heritage · Contestants · Apply · For Sponsors · Press
  - **Apply** = primary CTA, saffron pill button, distinct treatment, right-aligned
- **Mobile:** hamburger overlay, full-screen takeover with cinematic backdrop, same 6 items
- **Footer:** secondary navigation — About, Mission, Programs, Diaspora Globe, Quiz, Contact, Legal (Privacy, Terms)
- **Cultural Greeting overlay:** first visit only (cookie-gated), 4–6 second moment, then dissolves into the Home

### 5.3 Sanity Content Types

**Singletons (one document each):**
- `siteSettings` — logo, social links, contact info, footer copy
- `homePage` — six chapter blocks (each: title, body Portable Text, media, CTA)
- `aboutPage`, `missionPage`, `programsPage`, `sponsorsPage`, `applyPage`, `contactPage`
- `culturalGreeting` — image, audio asset, greeting text, subtitle, dismiss copy

**Collections:**
- `cycle` — year, theme, opens, closes, fee, status (`upcoming` | `current` | `past`). Exactly one document with status `current` at any time (Studio validation rule).
- `contestant` — name, slug, cycle ref, hero image, hero video, bio (Portable Text), charity platform, photo gallery (Drive-imported), social links
- `queen` — past winners. Name, crown number, year, era theme, photo, bio, achievements, current city/role
- `pressArticle` — title, source, date, excerpt, link or full text
- `diasporaCity` — name, country, lat, lng, hero image, story (Portable Text), embedded video, related contestant/queen refs
- `quizQuestion` — question text, 4 options, weight-per-region matrix
- `quizResult` — region archetype, illustration, color theme (Sanity color picker — region-specific accent applied to result card), description, OG image template
- `waitlistEntry` (added in M6) — name, email, optional notes, source URL, created timestamp. Captures `/apply/waitlist` submissions until Spec 3 swaps in the paid form.

**Reusable objects:**
- `richText` (Portable Text + custom marks for callouts, pull quotes)
- `videoEmbed` (custom field type — paste YouTube URL → extract ID → render with `lite-youtube-embed`)
- `driveAsset` (custom field type — paste Drive share URL → Worker imports to Sanity assets or R2)
- `cta` (label + url + variant — primary | secondary | ghost)

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

Skin tones never desaturated. Subtle film grain (8% opacity, multiply blend layer applied via CSS). Cool deep shadows, warm subject highlights, low-key lighting where possible. Subjects centered, full-bleed, rarely cropped tight. Captions on every image stored in Sanity (alt text field is required).

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
- **Detail:** Full-bleed hero (photo or video), bio, charity platform, photo gallery (Drive-imported), social links, shareable. **Voting button exists but disabled** with copy *"Opens during finale week"* — Spec 3 turns it on.
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
- **Waitlist storage:** Sanity-backed (creates a `waitlistEntry` document) OR forwarded to `WAITLIST_EMAIL_TARGET` env. Pick one in M6 based on whether non-tech staff need to view entries — default to Sanity.

## 9. Tech Architecture

### 9.1 Stack
| Layer | Choice |
|---|---|
| Framework | Astro 5 (SSR via `@astrojs/cloudflare` advanced mode) |
| Styling | Tailwind v4 (Vite plugin) + design tokens as CSS custom properties |
| Interactive islands | React 19 — only on `/diaspora` (Globe), `/quiz` (state machine), `/heritage` (horizontal scroller). Astro static everywhere else. |
| Animation | GSAP + ScrollTrigger (cinematic scroll), Lenis (smooth scroll), CSS for micro-interactions |
| Fonts | Fraunces + Inter + JetBrains Mono via `@fontsource-variable` (self-hosted) |
| CMS | Sanity Studio, hosted at `mdgh.sanity.studio` (free Sanity-hosted) |
| Media | Sanity CDN (images), Cloudflare R2 (large videos), `lite-youtube-embed` (YouTube), Drive Importer Worker (Drive → R2/Sanity) |
| Edge runtime | Cloudflare Workers via Pages Functions |
| Storage | KV (binding reserved for future server-side session/dedupe needs — Spec 1 cultural-greeting state lives in a browser cookie), R2 (large media), D1 (deferred to Spec 3) |
| OG image generation | Satori on Cloudflare Workers |

### 9.2 Repo Structure
```
mdgh-platform/
├── src/
│   ├── components/        # Astro + React components, organized by feature
│   ├── layouts/
│   ├── pages/             # /, /about, /contestants, /heritage, /diaspora, /quiz, /apply, etc.
│   ├── lib/
│   │   ├── sanity/        # client, queries, Portable Text components
│   │   └── payment/       # provider-agnostic abstraction (interface only in Spec 1)
│   └── styles/
├── studio/                # Sanity schemas (singletons, collections, custom field types)
├── workers/
│   ├── drive-importer/    # Drive service-account → R2/Sanity pipeline
│   └── og-image/          # Satori OG image generator
├── public/                # Static assets (logos only — everything else lives in CMS)
├── astro.config.mjs
├── wrangler.toml
└── sanity.config.ts
```

### 9.3 Data Flow
1. Editor publishes in Sanity Studio → Sanity webhook fires.
2. Webhook calls a Cloudflare Worker → triggers Cloudflare Pages cache purge for the affected routes.
3. Astro at request time → `@sanity/client` queries the production dataset → SSR-renders → cached at the edge.
4. React islands (Globe, Quiz, Heritage Timeline) hydrate client-side with data fetched at build time (SSR-baked into the HTML).

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

Spec 1 ships only the interface + a `MockProvider` for local dev. Spec 3 implements the real adapter(s) — Paystack, Stripe, Flutterwave, Hubtel, or any combination — without touching the form, the funnel, or the CMS.

### 9.5 Environments & Cutover

- **Sanity datasets:** two — `staging` (used by `staging.missdiasporagh.org`) and `production` (used by `missdiasporagh.org` after cutover). Editors test in `staging`, then promote with Sanity's built-in dataset copy.
- **Cloudflare Pages projects:** new project `mdgh-platform`, branch `main` deploys to `staging.missdiasporagh.org`. Production project `mdgh-web-project` stays live and untouched.
- **Cutover when greenlit:**
  1. Promote Sanity `staging` dataset → `production` via Sanity's built-in dataset copy. Verify all `cycle`, `contestant`, `queen`, `diasporaCity`, `quizQuestion`, `quizResult` content is present.
  2. Switch `mdgh-platform`'s `SANITY_DATASET` env var to `production`. Trigger a deploy.
  3. Smoke-test `staging.missdiasporagh.org` against the production dataset.
  4. Move custom domains `missdiasporagh.org` + `www.missdiasporagh.org` from `mdgh-web-project` → `mdgh-platform` in the Cloudflare dashboard.
  5. Verify DNS + SSL propagated. Confirm sitemap reflects new content.
  6. Archive old repo (rename, keep for rollback).
- **Rollback:** swap custom domains back. Current site is preserved untouched throughout — no destructive step.

### 9.6 Secrets & Env
- Cloudflare Pages project env vars: `SANITY_PROJECT_ID`, `SANITY_DATASET`, `SANITY_TOKEN` (read), `OG_SECRET`, `WAITLIST_EMAIL_TARGET`.
- Worker secrets: `DRIVE_SERVICE_ACCOUNT_JSON` (Drive Importer), `SANITY_WRITE_TOKEN` (Drive Importer, OG worker).
- No secret committed to repo. `.env.example` documents required keys.

## 10. Quality Gates

### 10.1 Performance (per page, mobile mid-range device)
- Lighthouse Performance ≥ 95 · FCP < 1s · LCP < 2.5s · INP < 200ms · CLS < 0.1
- Initial JS bundle < 120 KB gzipped
- Images: Sanity CDN with `auto=format&q=80&w={responsive}` + `loading="lazy"` below the fold
- Videos: `mp4` + `webm` siblings; `preload="metadata"`; no autoplaying loops above-the-fold on cellular (`navigator.connection.saveData` check)

### 10.2 Accessibility (WCAG 2.1 AA)
- 4.5:1 contrast for body, 3:1 for large text — design tokens already satisfy this
- All interactives ≥ 44×44 px hit area, visible focus ring (saffron 2px outline)
- Full keyboard navigation including the horizontal Heritage Timeline and the Globe (arrow keys + Tab to dot list fallback)
- Screen-reader landmarks, `aria-live` on dynamic regions, alt text required on every Sanity image (schema validation)
- `prefers-reduced-motion` honored throughout
- Captions on every video (Sanity stores transcript per video asset)

### 10.3 Browser Support
Last 2 versions of Chrome / Edge / Safari / Firefox · iOS Safari 15+ · Android Chrome 100+. No IE.

### 10.4 SEO & Social
- Per-page meta + OG + Twitter cards (CMS-driven via `siteSettings` defaults + per-page overrides)
- `sitemap.xml` auto-generated from CMS routes, `robots.txt`
- JSON-LD structured data: `Organization` (sitewide), `Person` (contestant + queen pages), `Event` (cycle pages), `BreadcrumbList`

### 10.5 Security
- CSP headers (strict, nonce-based for inline scripts), HSTS, X-Content-Type-Options, Referrer-Policy
- All third-party origins explicitly allow-listed (sanity.io CDN, YouTube, R2, Cloudflare)
- No secrets in client bundle; sensitive endpoints via Workers with origin checks

### 10.6 Testing
- **Unit:** `PaymentProvider` abstraction interface contract, Sanity query helpers, quiz scoring algorithm
- **Component:** React islands (Globe loads, Quiz scores correctly, Timeline scrolls)
- **E2E (Playwright):** home cinematic scroll completes, contestant detail renders from CMS, quiz happy path → result page, apply CTA → waitlist submission

## 11. Implementation Phasing

Quality over speed; rough pacing follows.

| Milestone | Focus | Approx. duration |
|---|---|---|
| **M0 — Foundation** | Fresh `mdgh-platform` repo, Cloudflare Pages project bound to staging.missdiasporagh.org, Sanity project + base singletons, design tokens & fonts self-hosted, "hello world" live | ~1 week |
| **M1 — Design system & shell** | Every component from §6 built and tokenized · top nav · footer · base layouts · `/design-system` reference route | ~1 week |
| **M2 — Editorial pages** | About · Mission · Programs · Sponsors · News (index + detail) · Contact — all CMS-driven | ~1–1.5 weeks |
| **M3 — Cinematic Home + Cultural Greeting** | Six-chapter scroll, GSAP pinning, greeting overlay with cookie + audio gating | ~1 week |
| **M4 — Heritage + Contestants** | `/heritage` horizontal timeline · `/contestants` index + detail · Drive Importer Sanity plugin built here | ~1.5 weeks |
| **M5 — Globe + Quiz + OG** | `/diaspora` 3D globe · `/quiz` six-question flow · Satori OG worker for shareable result cards | ~1 week |
| **M6 — Apply funnel + final QA** | `/apply` page · waitlist capture · full Lighthouse/axe pass · cross-browser sweep | ~1 week |
| **M7 — Greenlight & Cutover** | Sanity dataset promotion · swap custom domains · DNS/SSL verify · archive old repo | ~1 day |

Each milestone ends with a deployed staging build the user can review and a demo-ready slice. Nothing waits until the end.

## 12. Open Decisions Reserved for Future Specs

These are explicitly *not* decided now; they belong to Spec 2 or Spec 3.

- **Payment gateway selection** (Spec 3) — abstraction is in place; specific provider(s) TBD.
- **Application form fields** (Spec 3) — what data we collect, file uploads, video submissions.
- **Live voting mechanics** (Spec 3) — public web vote, SMS, judge portal, leaderboard.
- **Sponsor analytics** (Spec 3) — which metrics, dashboard surface.
- **Multi-language UI** — deferred until data shows demand; Sanity content models are i18n-ready (per-field locale objects) but Spec 1 ships English-only.

## 13. Glossary

- **Cycle:** one annual edition of the pageant, e.g., "Crown XXVI". Stored as a `cycle` Sanity document. Exactly one is `current` at a time.
- **Queen:** a past winner (alumni). Distinct from `contestant` to allow different content schemas.
- **Contestant:** a current-cycle participant. Carries a `cycle` ref.
- **Heritage Timeline:** the `/heritage` page rendering all `queen` documents.
- **Diaspora Globe:** the `/diaspora` page rendering all `diasporaCity` documents on a 3D globe.
- **Cultural Greeting:** first-visit overlay defined by the `culturalGreeting` singleton.
- **`PaymentProvider`:** TypeScript interface in `src/lib/payment/types.ts` that all gateway adapters implement.
