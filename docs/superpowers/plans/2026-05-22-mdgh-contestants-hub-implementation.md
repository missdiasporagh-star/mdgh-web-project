# Contestant Hub Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship Phase 3 of the staging elevation — the `/contestants` index + `/contestants/[slug]` dynamic detail pages — to `staging.missdiasporagh.org` at flagship quality.

**Architecture:** Astro 5 SSR (Cloudflare Pages). Index page renders a 3-up grid of `<ContestantCard>` components reading from the `contestants` collection filtered by current cycle. Each card carries a `data-href` to its detail page and an optional hover-video preview (native `<video preload="none">`, NOT a React island — no Three.js issues). Detail pages are server-rendered per-slug via `getStaticPaths` (or `getStaticPaths` + `prerender: false` depending on SSR vs SSG setup), full-bleed hero with optional video play button, 2-column bio + charity, 4-up gallery, disabled voting button with "Opens during finale week" copy.

**Tech Stack:** Astro 5.15, TypeScript 5.6, Tailwind 4. Reuses Phase 1's `<MetaLabel>` + `<Portrait>` primitives. No new heavy dependencies.

**Working repo:** `C:/dev/Projects/mdgh-staging`

**Spec references:**
- `mdgh-web-project/docs/superpowers/specs/2026-05-20-mdgh-staging-elevation-design.md` §7.5
- `mdgh-web-project/docs/superpowers/specs/annexes/2026-05-22-contestants-direction.md` (Cover Lineup direction — card composition, detail page layout, content seed list)
- Phase 1 plan (for shared-primitive patterns) and Phase 2 plan (for deploy + e2e patterns)

---

## File Structure

**Create:**
- `src/components/ui/RomanNumeral.astro` — small helper that renders a number → Roman numeral string (reusable across phases)
- `src/components/contestants/ContestantCard.astro` — index grid card with hover video preview
- `src/components/contestants/ContestantHero.astro` — detail full-bleed hero with optional video player
- `src/components/contestants/CharityPanel.astro` — detail sidebar with charity title/description/URL
- `src/components/contestants/GalleryRow.astro` — 4-up gallery using `<Portrait>` for images
- `src/components/contestants/VotingDisabled.astro` — disabled vote button + "Opens during finale week" subtext
- `src/content/contestants/ama-boateng.mdx` and 5 more (Akua Mensah, Esi Owusu, Yaa Asantewaa, Adwoa Asare, Abena Sarpong)
- `public/contestants/<slug>.svg` — 6 placeholder portrait SVGs (gradient + sash number)
- `src/pages/contestants/index.astro` — the grid index page
- `src/pages/contestants/[slug].astro` — dynamic detail page route
- `tests/e2e/contestants.spec.ts` — Playwright e2e

**Modify:** none expected (no new tokens per annex)

---

## Task 0: Setup feature branch

- [ ] **Step 1: Clean main + create branch**

```bash
cd C:/dev/Projects/mdgh-staging
git checkout main
git pull origin main
git status   # expect clean, HEAD at 2aaf9f8 (Phase 2 merge)
git checkout -b feature/contestants-hub
git push -u origin feature/contestants-hub
```

- [ ] **Step 2: Baseline checks**

```bash
npm run typecheck   # expect: 0 errors (1 pre-existing ctaSchema hint)
npm test            # expect: pass
```

---

## Task 1: Generate 6 placeholder portrait SVGs

**Files:** Create `public/contestants/{ama-boateng,akua-mensah,esi-owusu,yaa-asantewaa,adwoa-asare,abena-sarpong}.svg`

Each SVG is a 600x800 gradient with the contestant's sash number as an oversized italic Fraunces glyph centered. Sized small (~2-3 KB each).

- [ ] **Step 1: Write each placeholder**

Run from `C:/dev/Projects/mdgh-staging`:
```bash
mkdir -p public/contestants
```

Create each file. For `public/contestants/ama-boateng.svg`:

```xml
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 800" preserveAspectRatio="xMidYMid slice">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#3a1855"/>
      <stop offset="60%" stop-color="#1a0833"/>
      <stop offset="100%" stop-color="#050111"/>
    </linearGradient>
    <radialGradient id="glow" cx="35%" cy="35%" r="50%">
      <stop offset="0%" stop-color="rgba(255,209,102,0.12)"/>
      <stop offset="100%" stop-color="rgba(255,209,102,0)"/>
    </radialGradient>
  </defs>
  <rect width="600" height="800" fill="url(#g)"/>
  <rect width="600" height="800" fill="url(#glow)"/>
  <text x="300" y="480" font-family="Georgia, serif" font-style="italic" font-weight="700" font-size="320" fill="rgba(255,209,102,0.55)" text-anchor="middle" letter-spacing="-12">I</text>
</svg>
```

Repeat for the other 5 with the sash Roman numerals II / III / IV / V / VI. **Each file has its own filename + a different Roman numeral string in the `<text>` element.** Everything else stays identical.

- [ ] **Step 2: Commit**

```bash
git add public/contestants/
git commit -m "feat(contestants): seed 6 placeholder portrait SVGs (gradient + sash number)"
```

---

## Task 2: Seed 6 contestant MDX entries

**Files:** Create `src/content/contestants/{ama-boateng,akua-mensah,esi-owusu,yaa-asantewaa,adwoa-asare,abena-sarpong}.mdx`

The `contestants` schema lives at `src/content/config.ts`. Required fields: `name`, `cycle: reference('cycles')`, `heroImage`, `heroImageAlt`, plus `sortOrder` (default 0). Optional: `region`, `sashNumber`, `heroVideo`, `charityPlatform`, `gallery`, `social`.

Note: `cycle` is a reference to the cycles collection. The 2026 cycle entry already exists at `src/content/cycles/2026.json` (status: `current`). Reference syntax in MDX frontmatter is `cycle: { collection: 'cycles', id: '2026' }`.

- [ ] **Step 1: Create the 6 MDX files**

For `src/content/contestants/ama-boateng.mdx`:

```mdx
---
name: "Ama Boateng"
cycle: { collection: "cycles", id: "2026" }
region: "Ashanti"
sashNumber: "I"
heroImage: "/contestants/ama-boateng.svg"
heroImageAlt: "Ama Boateng, Crown XXVI contestant from Ashanti — placeholder portrait pending commissioned shoot."
sortOrder: 1
charityPlatform:
  title: "The Reading Garden"
  description: "Bilingual children's libraries in Kumasi neighborhoods, in partnership with the Ashanti Kingdom Cultural Foundation."
social:
  instagram: "@ama.boateng"
---

She walked into the audition with her grandmother's gold earrings and a question: "How do we make sure the next generation knows where their name comes from?" That question is the charity platform she now carries — a literacy initiative for Ghanaian-heritage children in the Ashanti diaspora.
```

Repeat for the other 5 with variations:

| Slug | Name | Region | Sash | Charity title | Sort |
|---|---|---|---|---|---|
| `akua-mensah` | Akua Mensah | Volta | II | River Voices (oral history project) | 2 |
| `esi-owusu` | Esi Owusu | Greater Accra | III | The Open Studio (creative arts for girls) | 3 |
| `yaa-asantewaa` | Yaa Asantewaa | Northern | IV | Shea Sisters (women's economic cooperatives) | 4 |
| `adwoa-asare` | Adwoa Asare | Western | V | The Tide Line (coastal environmental ed) | 5 |
| `abena-sarpong` | Abena Sarpong | Central | VI | Heritage in Hands (textile preservation) | 6 |

Each MDX body: 2-3 sentence bio in the same editorial voice as the Yvonne Kofigah entry (from Phase 1). Vary the prose meaningfully — don't repeat phrasing.

- [ ] **Step 2: Verify schema validation**

```bash
npx astro sync
npm run typecheck
```
Expected: no errors. Warnings about empty cities/contestants collections should resolve to no warning for contestants (now seeded).

- [ ] **Step 3: Commit**

```bash
git add src/content/contestants/
git commit -m "feat(contestants): seed 6 Crown XXVI contestants"
```

---

## Task 3: Build `<RomanNumeral>` helper

**Files:** Create `src/components/ui/RomanNumeral.astro`

Simple component that converts a number to a Roman numeral string. Used by the cards' sash overlay and the detail page hero meta-label.

- [ ] **Step 1: Write the component**

```astro
---
interface Props {
  /** The number to convert. Returns the input as string if < 1. */
  n: number;
  /** Optional HTML element override; defaults to <span> */
  as?: 'span' | 'div';
}

const { n, as = 'span' } = Astro.props;

function toRoman(num: number): string {
  if (num < 1) return String(num);
  const romans: Array<[number, string]> = [
    [1000, 'M'], [900, 'CM'], [500, 'D'], [400, 'CD'],
    [100, 'C'], [90, 'XC'], [50, 'L'], [40, 'XL'],
    [10, 'X'], [9, 'IX'], [5, 'V'], [4, 'IV'], [1, 'I'],
  ];
  let r = num;
  let out = '';
  for (const [val, sym] of romans) {
    while (r >= val) { out += sym; r -= val; }
  }
  return out;
}

const Tag = as;
const roman = toRoman(n);
---
<Tag>{roman}</Tag>
```

- [ ] **Step 2: Typecheck + commit**

```bash
npm run typecheck   # expect: 0 errors
git add src/components/ui/RomanNumeral.astro
git commit -m "feat(ui): add RomanNumeral helper"
```

---

## Task 4: Build `<ContestantCard>` with hover video

**Files:** Create `src/components/contestants/ContestantCard.astro`

The index grid card. Reads `name`, `sashNumber` (or sortOrder fallback), `region`, `cycleCrown`, `heroImage`, `heroImageAlt`, optional `heroVideo`. Hover plays muted video preview (native `<video preload="none">`, no React).

- [ ] **Step 1: Write the component**

```astro
---
import MetaLabel from '~/components/ui/MetaLabel.astro';
import RomanNumeral from '~/components/ui/RomanNumeral.astro';

interface Props {
  slug: string;
  name: string;
  sashNumber?: string;          // already a Roman string from frontmatter, OR
  sortOrder?: number;           // fallback — convert to Roman
  region?: string;
  cycleCrown: string;           // e.g. "XXVI"
  heroImage: string;
  heroImageAlt: string;
  heroVideo?: { kind: 'youtube' | 'drive'; url: string };
  /** Card index in grid, for stagger animation */
  index?: number;
}

const {
  slug, name, sashNumber, sortOrder, region, cycleCrown,
  heroImage, heroImageAlt, heroVideo, index = 0
} = Astro.props;

const sashDisplay = sashNumber ?? '';
const [firstName, ...rest] = name.split(' ');
const lastName = rest.join(' ');

const meta = `CROWN ${cycleCrown}${region ? ' · ' + region.toUpperCase() : ''}`;
---
<a
  class="contestant-card"
  href={`/contestants/${slug}`}
  data-slug={slug}
  aria-label={`Open profile for ${name}${region ? ', from ' + region : ''}, Crown ${cycleCrown}`}
  style={`--stagger: ${index * 40}ms`}
>
  <!-- Static portrait image — always rendered for SSR + fallback -->
  <img
    class="contestant-card__portrait"
    src={heroImage}
    alt={heroImageAlt}
    loading={index < 3 ? 'eager' : 'lazy'}
    decoding="async"
    width="600"
    height="800"
  />

  {heroVideo && heroVideo.kind === 'youtube' && (
    <!-- For YouTube videos we don't autoplay a preview inline (would require iframe + CSP).
         Detail page handles YouTube via the embed component. -->
  )}

  <!-- Engraved sash number top-left -->
  <div class="contestant-card__sash" aria-hidden="true">
    {sashDisplay
      ? <span>{sashDisplay}</span>
      : sortOrder
        ? <RomanNumeral n={sortOrder} />
        : ''}
  </div>

  <!-- Bottom-left meta + name -->
  <div class="contestant-card__footer">
    <MetaLabel text={meta} tone="accent" />
    <div class="contestant-card__name">
      <span>{firstName}</span>
      {lastName && <span>{lastName}</span>}
    </div>
  </div>
</a>

<style>
  .contestant-card {
    position: relative;
    display: flex;
    flex-direction: column;
    aspect-ratio: 3 / 4;
    background: linear-gradient(180deg, var(--color-deep-violet, #1a0833) 0%, var(--color-obsidian, #050111) 100%);
    border: 1px solid rgba(107, 43, 217, 0.25);
    border-radius: 14px;
    padding: 14px;
    overflow: hidden;
    text-decoration: none;
    color: #fff;
    transition: transform 200ms cubic-bezier(.4, 0, .2, 1), border-color 200ms cubic-bezier(.4, 0, .2, 1), box-shadow 200ms cubic-bezier(.4, 0, .2, 1);
    transition-delay: var(--stagger, 0ms);
    will-change: transform;
  }
  .contestant-card:hover,
  .contestant-card:focus-visible {
    transform: translateY(-3px);
    border-color: rgba(255, 209, 102, 0.4);
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.5);
    outline: none;
  }
  .contestant-card:focus-visible {
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.5), 0 0 0 2px var(--color-saffron, #FFD166);
  }
  .contestant-card__portrait {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    object-fit: cover;
    z-index: 0;
  }
  .contestant-card__sash {
    position: relative;
    z-index: 2;
    font-family: 'Fraunces Variable', 'Fraunces', serif;
    font-style: italic;
    font-weight: 700;
    font-size: clamp(48px, 6vw, 72px);
    line-height: 0.85;
    color: rgba(255, 209, 102, 0.7);
    text-shadow: 0 2px 6px rgba(0, 0, 0, 0.6), 0 -1px 0 rgba(255, 250, 200, 0.2);
    transition: color 200ms cubic-bezier(.4, 0, .2, 1);
  }
  .contestant-card:hover .contestant-card__sash,
  .contestant-card:focus-visible .contestant-card__sash {
    color: rgba(255, 209, 102, 0.95);
  }
  .contestant-card__footer {
    position: relative;
    z-index: 2;
    margin-top: auto;
    display: flex;
    flex-direction: column;
    gap: 6px;
  }
  .contestant-card__name {
    display: flex;
    flex-direction: column;
    gap: 2px;
    font-family: 'Fraunces Variable', 'Fraunces', serif;
    font-style: italic;
    font-weight: 500;
    font-size: clamp(22px, 2.5vw, 28px);
    line-height: 1;
    letter-spacing: -0.02em;
    color: #fff;
  }
  @media (prefers-reduced-motion: reduce) {
    .contestant-card { transition: none; }
    .contestant-card:hover,
    .contestant-card:focus-visible { transform: none; }
  }
</style>
```

- [ ] **Step 2: Typecheck + commit**

```bash
npm run typecheck
git add src/components/contestants/ContestantCard.astro
git commit -m "feat(contestants): add ContestantCard with engraved sash + hover lift"
```

---

## Task 5: Build `<CharityPanel>` + `<GalleryRow>` + `<VotingDisabled>` (small detail-page components)

Three small components for the detail page. Group in one commit since each is trivial.

- [ ] **Step 1: Write `src/components/contestants/CharityPanel.astro`**

```astro
---
import MetaLabel from '~/components/ui/MetaLabel.astro';

interface Props {
  charity?: { title: string; description: string; url?: string };
}

const { charity } = Astro.props;
---
{charity && (
  <aside class="charity-panel" aria-label="Charity platform">
    <MetaLabel text="Charity platform" tone="accent" />
    <h3 class="charity-panel__title">{charity.title}</h3>
    <p class="charity-panel__desc">{charity.description}</p>
    {charity.url && (
      <a class="charity-panel__link" href={charity.url} target="_blank" rel="noopener">
        Learn more →
      </a>
    )}
  </aside>
)}

<style>
  .charity-panel {
    background: rgba(26, 8, 51, 0.5);
    border: 1px solid rgba(255, 209, 102, 0.2);
    border-radius: 12px;
    padding: 20px;
    align-self: start;
  }
  .charity-panel__title {
    font-family: 'Fraunces Variable', 'Fraunces', serif;
    font-style: italic;
    font-weight: 500;
    font-size: 24px;
    color: #fff;
    margin: 8px 0 12px;
  }
  .charity-panel__desc {
    color: rgba(255, 255, 255, 0.75);
    font-size: 13px;
    line-height: 1.6;
    margin: 0;
  }
  .charity-panel__link {
    display: inline-block;
    margin-top: 14px;
    font-family: 'JetBrains Mono Variable', 'JetBrains Mono', monospace;
    font-size: 10px;
    color: var(--color-saffron, #FFD166);
    letter-spacing: 0.2em;
    text-transform: uppercase;
    text-decoration: none;
    border-bottom: 1px solid rgba(255, 209, 102, 0.4);
    padding-bottom: 2px;
  }
  .charity-panel__link:hover,
  .charity-panel__link:focus-visible {
    color: #FFE599;
    border-bottom-color: var(--color-saffron, #FFD166);
    outline: none;
  }
</style>
```

- [ ] **Step 2: Write `src/components/contestants/GalleryRow.astro`**

```astro
---
import Portrait from '~/components/ui/Portrait.astro';

interface MediaRef {
  kind: 'image' | 'youtube' | 'drive';
  src: string;
  alt?: string;
  caption?: string;
}

interface Props {
  gallery: MediaRef[];
}

const { gallery } = Astro.props;

// Only render image gallery items inline. Youtube/Drive items get a
// lightweight thumbnail (placeholder with "▶") — proper embed is a
// follow-up (would need DriveEmbed / YouTubeEmbed components per spec §8.4).
const imageItems = gallery.filter((g) => g.kind === 'image');
---
{imageItems.length > 0 && (
  <section class="gallery-row" aria-label="Gallery">
    <div class="gallery-row__head">
      <span class="gallery-row__label">Gallery</span>
    </div>
    <div class="gallery-row__grid">
      {imageItems.slice(0, 8).map((item) => (
        <Portrait src={item.src} alt={item.alt || ''} aspect="3 / 4" />
      ))}
    </div>
  </section>
)}

<style>
  .gallery-row {
    padding: 24px 0;
  }
  .gallery-row__head { margin-bottom: 14px; }
  .gallery-row__label {
    font-family: 'JetBrains Mono Variable', 'JetBrains Mono', monospace;
    font-size: 10px;
    color: var(--color-saffron, #FFD166);
    letter-spacing: 0.25em;
    text-transform: uppercase;
    font-weight: 600;
  }
  .gallery-row__grid {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 12px;
  }
  @media (max-width: 767px) {
    .gallery-row__grid {
      grid-template-columns: repeat(2, 1fr);
    }
  }
</style>
```

- [ ] **Step 3: Write `src/components/contestants/VotingDisabled.astro`**

```astro
---
interface Props {
  /** Optional override of the explanatory copy below the button. */
  copy?: string;
}

const { copy = 'Opens during finale week' } = Astro.props;
---
<div class="voting-disabled">
  <button type="button" class="voting-disabled__btn" disabled aria-disabled="true">
    Vote
  </button>
  <div class="voting-disabled__copy">{copy}</div>
</div>

<style>
  .voting-disabled {
    text-align: right;
  }
  .voting-disabled__btn {
    background: transparent;
    color: rgba(255, 255, 255, 0.4);
    border: 1px solid rgba(255, 255, 255, 0.15);
    padding: 10px 22px;
    border-radius: 999px;
    font-family: 'JetBrains Mono Variable', 'JetBrains Mono', monospace;
    font-size: 11px;
    font-weight: 600;
    letter-spacing: 0.25em;
    text-transform: uppercase;
    cursor: not-allowed;
  }
  .voting-disabled__copy {
    font-family: 'JetBrains Mono Variable', 'JetBrains Mono', monospace;
    font-size: 9px;
    color: rgba(255, 255, 255, 0.45);
    letter-spacing: 0.2em;
    text-transform: uppercase;
    margin-top: 6px;
  }
</style>
```

- [ ] **Step 4: Typecheck + commit (one commit, all three)**

```bash
npm run typecheck
git add src/components/contestants/CharityPanel.astro src/components/contestants/GalleryRow.astro src/components/contestants/VotingDisabled.astro
git commit -m "feat(contestants): add CharityPanel + GalleryRow + VotingDisabled detail-page primitives"
```

---

## Task 6: Build `<ContestantHero>`

**Files:** Create `src/components/contestants/ContestantHero.astro`

Full-bleed hero with optional video play button. Disabled-voting button overlays top-right.

- [ ] **Step 1: Write the component**

```astro
---
import MetaLabel from '~/components/ui/MetaLabel.astro';
import VotingDisabled from './VotingDisabled.astro';

interface Props {
  name: string;
  cycleCrown: string;
  sashNumber?: string;
  region?: string;
  heroImage: string;
  heroImageAlt: string;
  heroVideo?: { kind: 'youtube' | 'drive'; url: string };
}

const { name, cycleCrown, sashNumber, region, heroImage, heroImageAlt, heroVideo } = Astro.props;

const metaParts = [`CROWN ${cycleCrown}`];
if (sashNumber) metaParts.push(`SASH ${sashNumber}`);
if (region) metaParts.push(region.toUpperCase());
const meta = metaParts.join(' · ');
---
<section class="contestant-hero" aria-label={`Hero for ${name}`}>
  <img
    class="contestant-hero__image"
    src={heroImage}
    alt={heroImageAlt}
    loading="eager"
    fetchpriority="high"
    decoding="async"
  />
  <div class="contestant-hero__overlay" aria-hidden="true"></div>

  {heroVideo && (
    <button type="button" class="contestant-hero__play" aria-label={`Play video for ${name}`}>
      <svg width="28" height="28" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
        <path d="M8 5v14l11-7z"/>
      </svg>
    </button>
  )}

  <div class="contestant-hero__vote">
    <VotingDisabled />
  </div>

  <div class="contestant-hero__title">
    <MetaLabel text={meta} tone="accent" />
    <h1 class="contestant-hero__name">{name}</h1>
  </div>
</section>

<style>
  .contestant-hero {
    position: relative;
    height: 520px;
    background: linear-gradient(135deg, #3a1855 0%, #1a0833 50%, #050111 100%);
    overflow: hidden;
  }
  .contestant-hero__image {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    object-fit: cover;
  }
  .contestant-hero__overlay {
    position: absolute;
    inset: 0;
    background: linear-gradient(180deg, rgba(5,1,17,0) 40%, rgba(5,1,17,0.6) 90%);
  }
  .contestant-hero__play {
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    width: 72px;
    height: 72px;
    background: rgba(255, 209, 102, 0.18);
    border: 1px solid rgba(255, 209, 102, 0.55);
    border-radius: 999px;
    backdrop-filter: blur(8px);
    color: var(--color-saffron, #FFD166);
    cursor: pointer;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    transition: transform 200ms cubic-bezier(.4, 0, .2, 1), background 200ms cubic-bezier(.4, 0, .2, 1);
  }
  .contestant-hero__play:hover,
  .contestant-hero__play:focus-visible {
    transform: translate(-50%, -50%) scale(1.06);
    background: rgba(255, 209, 102, 0.28);
    outline: 2px solid var(--color-saffron, #FFD166);
    outline-offset: 2px;
  }
  .contestant-hero__vote {
    position: absolute;
    top: 48px;
    right: 48px;
    z-index: 3;
  }
  .contestant-hero__title {
    position: absolute;
    bottom: 48px;
    left: 48px;
    right: 48px;
    max-width: 800px;
    display: flex;
    flex-direction: column;
    gap: 12px;
    z-index: 2;
  }
  .contestant-hero__name {
    font-family: 'Fraunces Variable', 'Fraunces', serif;
    font-style: italic;
    font-weight: 500;
    font-size: clamp(48px, 7vw, 96px);
    line-height: 1;
    margin: 0;
    letter-spacing: -0.02em;
    color: #fff;
  }
  @media (max-width: 767px) {
    .contestant-hero { height: 380px; }
    .contestant-hero__title { left: 20px; right: 20px; bottom: 20px; }
    .contestant-hero__vote { top: 20px; right: 20px; }
  }
  @media (prefers-reduced-motion: reduce) {
    .contestant-hero__play { transition: none; }
  }
</style>
```

- [ ] **Step 2: Typecheck + commit**

```bash
npm run typecheck
git add src/components/contestants/ContestantHero.astro
git commit -m "feat(contestants): add ContestantHero with optional video play button"
```

---

## Task 7: Wire `/contestants` index page

**Files:** Create `src/pages/contestants/index.astro`

Loads cycles + contestants. Filters contestants by the current cycle. Sorts by `sortOrder`. Renders the 3-up grid.

- [ ] **Step 1: Write the page**

```astro
---
import { getCollection } from 'astro:content';
import PageLayout from '~/layouts/PageLayout.astro';
import MetaLabel from '~/components/ui/MetaLabel.astro';
import ContestantCard from '~/components/contestants/ContestantCard.astro';

const cycles = await getCollection('cycles');
const currentCycle = cycles.find((c) => c.data.status === 'current');

const allContestants = await getCollection('contestants');
const contestants = currentCycle
  ? allContestants.filter((c) => c.data.cycle.id === currentCycle.id)
  : [];
contestants.sort((a, b) => (a.data.sortOrder ?? 0) - (b.data.sortOrder ?? 0));

const cycleCrown = currentCycle?.data.crownNumber ?? '';
const cycleYear = currentCycle?.data.year ?? '';
---
<PageLayout
  title={`Contestants · Crown ${cycleCrown} · Miss Diaspora Ghana`}
  description={`Meet the women representing Crown ${cycleCrown} — their cities, their charities, their reasons.`}
>
  <div class="contestants-page">
    <header class="contestants-page__header">
      <MetaLabel
        text={cycleYear ? `CROWN ${cycleCrown} · CYCLE ${cycleYear} · OPEN` : 'CONTESTANTS'}
        tone="accent"
      />
      <h1 class="contestants-page__title">
        The <em class="contestants-page__italic">cover lineup.</em>
      </h1>
      <p class="contestants-page__lede">
        {contestants.length > 0
          ? `${contestants.length} women, ${contestants.length} stories, one crown. Meet the contestants representing Crown ${cycleCrown} — their cities, their charities, their reasons.`
          : 'The cycle is open. Contestants will appear here as they’re announced.'}
      </p>
    </header>

    {contestants.length > 0 && (
      <div class="contestants-page__grid">
        {contestants.map((c, i) => (
          <ContestantCard
            slug={c.slug}
            name={c.data.name}
            sashNumber={c.data.sashNumber}
            sortOrder={c.data.sortOrder}
            region={c.data.region}
            cycleCrown={cycleCrown}
            heroImage={c.data.heroImage}
            heroImageAlt={c.data.heroImageAlt}
            heroVideo={c.data.heroVideo}
            index={i}
          />
        ))}
      </div>
    )}
  </div>
</PageLayout>

<style>
  .contestants-page {
    max-width: 1280px;
    margin: 0 auto;
    padding: 120px 24px 64px;
  }
  .contestants-page__header {
    max-width: 780px;
    margin-bottom: 48px;
    display: flex;
    flex-direction: column;
    gap: 16px;
  }
  .contestants-page__title {
    font-family: 'Fraunces Variable', 'Fraunces', serif;
    font-weight: 500;
    font-size: clamp(40px, 6vw, 80px);
    line-height: 1.05;
    margin: 0;
    color: #fff;
  }
  .contestants-page__italic {
    font-style: italic;
    color: var(--color-saffron, #FFD166);
  }
  .contestants-page__lede {
    color: rgba(255, 255, 255, 0.7);
    font-size: 18px;
    line-height: 1.6;
    max-width: 56ch;
  }
  .contestants-page__grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 20px;
  }
  @media (max-width: 1023px) {
    .contestants-page__grid {
      grid-template-columns: repeat(2, 1fr);
    }
  }
  @media (max-width: 767px) {
    .contestants-page__grid {
      grid-template-columns: 1fr;
    }
  }
</style>
```

- [ ] **Step 2: Smoke test + commit**

```bash
npm run typecheck
npm run dev &
# wait ~5 sec
curl -s http://localhost:4321/contestants > /tmp/c.html || curl -s http://localhost:4322/contestants > /tmp/c.html
echo "contestants-page: $(grep -oc 'contestants-page' /tmp/c.html)"
echo "contestant-card: $(grep -oc 'contestant-card' /tmp/c.html)"
echo "Ama Boateng: $(grep -oc 'Ama Boateng' /tmp/c.html)"
# Stop dev server
git add src/pages/contestants/index.astro
git commit -m "feat(contestants): wire /contestants index page"
```

---

## Task 8: Wire `/contestants/[slug]` dynamic detail page

**Files:** Create `src/pages/contestants/[slug].astro`

Generates a page per contestant slug. Pulls the entry, computes the cycle crown, renders the hero + bio + charity + gallery + social footer.

- [ ] **Step 1: Write the dynamic route**

```astro
---
import { getCollection, getEntry } from 'astro:content';
import PageLayout from '~/layouts/PageLayout.astro';
import MetaLabel from '~/components/ui/MetaLabel.astro';
import ContestantHero from '~/components/contestants/ContestantHero.astro';
import CharityPanel from '~/components/contestants/CharityPanel.astro';
import GalleryRow from '~/components/contestants/GalleryRow.astro';

export async function getStaticPaths() {
  const contestants = await getCollection('contestants');
  return contestants.map((c) => ({
    params: { slug: c.slug },
    props: { entry: c },
  }));
}

const { entry } = Astro.props;
const { Content } = await entry.render();

const cycle = await getEntry(entry.data.cycle);
const cycleCrown = cycle?.data.crownNumber ?? '';

const social = entry.data.social;
---
<PageLayout
  title={`${entry.data.name} · Crown ${cycleCrown} · Miss Diaspora Ghana`}
  description={entry.data.charityPlatform?.description ?? `${entry.data.name}, Crown ${cycleCrown} contestant.`}
>
  <ContestantHero
    name={entry.data.name}
    cycleCrown={cycleCrown}
    sashNumber={entry.data.sashNumber}
    region={entry.data.region}
    heroImage={entry.data.heroImage}
    heroImageAlt={entry.data.heroImageAlt}
    heroVideo={entry.data.heroVideo}
  />

  <article class="contestant-detail">
    <div class="contestant-detail__main">
      <div class="contestant-detail__bio">
        <MetaLabel text="Her story" tone="accent" />
        <div class="contestant-detail__prose">
          <Content />
        </div>
      </div>
      {entry.data.charityPlatform && <CharityPanel charity={entry.data.charityPlatform} />}
    </div>

    {entry.data.gallery && entry.data.gallery.length > 0 && (
      <GalleryRow gallery={entry.data.gallery} />
    )}

    <footer class="contestant-detail__footer">
      <a class="contestant-detail__back" href="/contestants">← Back to the cover lineup</a>
      {social && (
        <div class="contestant-detail__social">
          {social.instagram && (
            <a class="contestant-detail__chip" href={`https://instagram.com/${social.instagram.replace(/^@/, '')}`} target="_blank" rel="noopener">
              Instagram
            </a>
          )}
          {social.tiktok && (
            <a class="contestant-detail__chip" href={`https://tiktok.com/@${social.tiktok.replace(/^@/, '')}`} target="_blank" rel="noopener">
              TikTok
            </a>
          )}
        </div>
      )}
    </footer>
  </article>
</PageLayout>

<style>
  .contestant-detail {
    max-width: 1280px;
    margin: 0 auto;
    padding: 48px 24px 64px;
  }
  .contestant-detail__main {
    display: grid;
    grid-template-columns: 1.6fr 1fr;
    gap: 48px;
    margin-bottom: 32px;
  }
  .contestant-detail__bio {
    display: flex;
    flex-direction: column;
    gap: 14px;
  }
  .contestant-detail__prose {
    color: rgba(255, 255, 255, 0.85);
    font-size: 15px;
    line-height: 1.7;
  }
  .contestant-detail__prose :global(p) { margin: 0 0 1em; }
  .contestant-detail__footer {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 16px;
    padding-top: 24px;
    border-top: 1px solid rgba(107, 43, 217, 0.25);
    flex-wrap: wrap;
  }
  .contestant-detail__back {
    font-family: 'JetBrains Mono Variable', 'JetBrains Mono', monospace;
    font-size: 11px;
    color: var(--color-saffron, #FFD166);
    letter-spacing: 0.25em;
    text-transform: uppercase;
    text-decoration: none;
  }
  .contestant-detail__back:hover,
  .contestant-detail__back:focus-visible {
    color: #FFE599;
    outline: none;
  }
  .contestant-detail__social {
    display: flex;
    gap: 12px;
  }
  .contestant-detail__chip {
    font-family: 'JetBrains Mono Variable', 'JetBrains Mono', monospace;
    font-size: 10px;
    color: rgba(255, 255, 255, 0.65);
    letter-spacing: 0.2em;
    text-transform: uppercase;
    padding: 6px 12px;
    border: 1px solid rgba(255, 255, 255, 0.15);
    border-radius: 999px;
    text-decoration: none;
  }
  .contestant-detail__chip:hover,
  .contestant-detail__chip:focus-visible {
    border-color: rgba(255, 209, 102, 0.4);
    color: #fff;
    outline: none;
  }
  @media (max-width: 767px) {
    .contestant-detail__main {
      grid-template-columns: 1fr;
      gap: 32px;
    }
  }
</style>
```

- [ ] **Step 2: Smoke test + commit**

```bash
npm run typecheck
npm run dev &
curl -s http://localhost:4321/contestants/ama-boateng > /tmp/d.html || curl -s http://localhost:4322/contestants/ama-boateng > /tmp/d.html
echo "contestant-detail: $(grep -oc 'contestant-detail' /tmp/d.html)"
echo "Ama Boateng: $(grep -oc 'Ama Boateng' /tmp/d.html)"
echo "Reading Garden: $(grep -oc 'Reading Garden' /tmp/d.html)"
# Stop dev server
git add src/pages/contestants/[slug].astro
git commit -m "feat(contestants): wire /contestants/[slug] dynamic detail route"
```

---

## Task 9: Playwright e2e

**Files:** Create `tests/e2e/contestants.spec.ts`

Six tests covering: index renders 6 cards, card click routes to detail, detail page renders hero + bio + charity, mobile shows 1-up stack, reduced-motion disables hover lift, back link returns to index.

- [ ] **Step 1: Write the spec**

```typescript
import { test, expect } from '@playwright/test';

test.describe('/contestants', () => {
  test('index renders 6 contestant cards', async ({ page }) => {
    await page.goto('/contestants');
    await expect(page.locator('.contestants-page__title')).toBeVisible();
    await expect(page.locator('.contestant-card')).toHaveCount(6);
  });

  test('clicking a card routes to detail page', async ({ page }) => {
    await page.goto('/contestants');
    const firstCard = page.locator('.contestant-card').first();
    const href = await firstCard.getAttribute('href');
    expect(href).toMatch(/^\/contestants\/[a-z-]+$/);
    await firstCard.click();
    await expect(page).toHaveURL(new RegExp(href!));
  });

  test('detail page renders hero + bio + charity + back link', async ({ page }) => {
    await page.goto('/contestants/ama-boateng');
    await expect(page.locator('.contestant-hero')).toBeVisible();
    await expect(page.locator('.contestant-hero__name')).toContainText('Ama Boateng');
    await expect(page.locator('.contestant-detail__prose')).toContainText('grandmother');
    await expect(page.locator('.charity-panel')).toBeVisible();
    await expect(page.locator('.charity-panel__title')).toContainText('Reading Garden');
    await expect(page.locator('.contestant-detail__back')).toBeVisible();
  });

  test('voting button is disabled with explanatory copy', async ({ page }) => {
    await page.goto('/contestants/ama-boateng');
    const voteBtn = page.locator('.voting-disabled__btn');
    await expect(voteBtn).toBeDisabled();
    await expect(page.locator('.voting-disabled__copy')).toContainText('finale week');
  });

  test('back link from detail returns to index', async ({ page }) => {
    await page.goto('/contestants/ama-boateng');
    await page.click('.contestant-detail__back');
    await expect(page).toHaveURL(/\/contestants$/);
    await expect(page.locator('.contestants-page__title')).toBeVisible();
  });

  test('mobile (<768px) shows 1-up stack', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 800 });
    await page.goto('/contestants');
    const grid = page.locator('.contestants-page__grid');
    const cols = await grid.evaluate((el) => getComputedStyle(el).gridTemplateColumns);
    // 1-up stack: a single track on mobile
    expect(cols.split(' ').length).toBe(1);
  });
});
```

- [ ] **Step 2: Run + commit**

```bash
cd C:/dev/Projects/mdgh-staging
npm run test:e2e -- contestants.spec.ts
# Expect: all 6 pass × 3 browsers = 18
git add tests/e2e/contestants.spec.ts
git commit -m "test(contestants): e2e — index grid, detail page, voting-disabled, back link, mobile"
```

---

## Task 10: Lighthouse audit (mobile ≥ 0.9 perf)

**Files:** none modified by default.

Same pattern as Phase 2's T11. Build, preview with wrangler flags, run Lighthouse mobile against `/contestants` and `/contestants/ama-boateng`, verify scores.

- [ ] **Step 1: Build + serve**

```bash
cd C:/dev/Projects/mdgh-staging
npm run build
(npx wrangler pages dev ./dist --compatibility-flag=nodejs_compat --compatibility-date=2026-05-01 --port 8788 > /tmp/w.log 2>&1 &)
sleep 7
curl -sI http://localhost:8788/contestants | head -1
curl -sI http://localhost:8788/contestants/ama-boateng | head -1
```
Both should be 200.

- [ ] **Step 2: Lighthouse mobile both routes**

```bash
npx lighthouse http://localhost:8788/contestants --form-factor=mobile --output=json --output-path=./lh-c.json --chrome-flags="--headless --no-sandbox" --quiet
npx lighthouse http://localhost:8788/contestants/ama-boateng --form-factor=mobile --output=json --output-path=./lh-d.json --chrome-flags="--headless --no-sandbox" --quiet

node -e "
['./lh-c.json','./lh-d.json'].forEach(p => {
  const r = require(p);
  console.log(p, JSON.stringify({
    perf: r.categories.performance.score,
    a11y: r.categories.accessibility.score,
    bp: r.categories['best-practices'].score,
    seo: r.categories.seo.score,
    lcp_ms: r.audits['largest-contentful-paint'].numericValue,
    cls: r.audits['cumulative-layout-shift'].numericValue,
    tbt_ms: r.audits['total-blocking-time'].numericValue
  }));
});
"
rm -f ./lh-c.json ./lh-d.json
pkill -f workerd 2>/dev/null
pkill -f "wrangler pages" 2>/dev/null
```

- [ ] **Step 3: Thresholds (per annex — same relaxed as Phase 2)**

- `perf >= 0.9`
- `a11y >= 0.9`
- `bp >= 0.9`
- `seo >= 0.9`
- `lcp_ms < 3500`
- `cls < 0.05` (target; 0.15 acceptable shipping bar given Phase 2 precedent)
- `tbt_ms < 200` (should be ~0 — no heavy JS on this page)

- [ ] **Step 4: If perf misses meaningfully, investigate (don't randomly tweak)**

If miss: report DONE_WITH_CONCERNS or apply a targeted fix and commit `perf(contestants): …`. Don't fix CLS the speculative way Phase 2 first did — investigate first.

---

## Task 11: Deploy to staging + verify live (USER GATE)

- [ ] **Step 1: Confirm clean tree**

```bash
cd C:/dev/Projects/mdgh-staging
git status   # clean
```

- [ ] **Step 2: Push feature branch + merge to main**

```bash
git push origin feature/contestants-hub
git checkout main
git pull origin main
git merge --no-ff feature/contestants-hub -m "Merge feature/contestants-hub: Phase 3 of mdgh-staging elevation

Contestant Hub live at /contestants + /contestants/[slug]:
- contestants content collection seeded with 6 Crown XXVI entries
  (placeholder SVG portraits — replaceable when commissioned shots arrive)
- ContestantCard with engraved Roman-numeral sash, hover lift, focus ring
- ContestantHero full-bleed with optional video play button
- CharityPanel + GalleryRow + VotingDisabled detail-page primitives
- /contestants/[slug] dynamic route via getStaticPaths
- Reuses MetaLabel + Portrait + RomanNumeral primitives
- Detail is a dedicated page (NOT a modal) — shareable URLs per contestant
- 6 Playwright e2e tests covering grid, detail render, voting-disabled,
  back link, mobile stack
- Lighthouse mobile expected to pass all thresholds (no React island
  on this page, so no Three.js parallel)

Direction A (Cover Lineup) per design annex 2026-05-22-contestants-direction.md.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
git push origin main
```

- [ ] **Step 3: Wait for Pages deploy**

Use Monitor or poll:
```bash
CLOUDFLARE_ACCOUNT_ID=233d917842862e30ed5207cf7b95bc33 npx wrangler pages deployment list --project-name mdgh-staging --environment production 2>&1 | head -5
```
Wait until latest shows `Active`.

- [ ] **Step 4: Verify live**

```bash
RAND=$(date +%s)$RANDOM
curl -sI "https://staging.missdiasporagh.org/contestants?v=$RAND" | head -1
curl -s "https://staging.missdiasporagh.org/contestants?v=$RAND-2" > /tmp/live.html
echo "contestant-card: $(grep -oc 'contestant-card' /tmp/live.html)"
echo "Ama Boateng: $(grep -oc 'Ama Boateng' /tmp/live.html)"
curl -sI "https://staging.missdiasporagh.org/contestants/ama-boateng?v=$RAND-3" | head -1
```

If CDN cache returns 404, retry with a fresh cache-bust query string (Phase 1 + 2 both hit this).

- [ ] **Step 5: USER GATE**

Surface live URL to the user. Ask them to test in browser:
- Header reads "The *cover lineup.*"
- 6 contestant cards visible in 3-up grid (desktop) / 1-up (mobile)
- Engraved Roman numerals on top-left of each card
- Hover (desktop): card lifts -3px, border shifts saffron
- Click → routes to detail page with full-bleed hero, bio prose, charity panel, gallery (empty for these placeholders), voting button disabled with "Opens during finale week"
- Back link returns to grid

Wait for `approve` before T12.

---

## Task 12: Wrap — phase memory

- [ ] **Step 1: Write `contestants-phase-3-shipped.md` to project memory**

Path: `C:/Users/USER/.claude/projects/C--dev-Projects-mdgh-web-project/memory/contestants-phase-3-shipped.md`

Mirror Phase 1's wrap structure. Cover:
- Live URL + commit SHA + direction (Cover Lineup)
- New reusable primitives: `<RomanNumeral>`
- Phase-specific: `<ContestantCard>`, `<ContestantHero>`, `<CharityPanel>`, `<GalleryRow>`, `<VotingDisabled>`
- Detail-page-via-getStaticPaths pattern — useful for Phase 4 quiz if quiz results are per-slug
- Lighthouse scores (record actuals)
- Plan deltas (placeholder portraits, cycle-reference handling)
- Approval gates honored

- [ ] **Step 2: Update `MEMORY.md` index**

Append:
```markdown
- [Contestants Phase 3 shipped](contestants-phase-3-shipped.md) — `/contestants` + `/contestants/[slug]` Cover Lineup grid + dynamic detail; RomanNumeral primitive; 6 placeholder portraits replaceable when real shoots happen
```

- [ ] **Step 3: Phase 3 done**

Next session begins Phase 4 (Heritage Quiz at `/quiz`) with its own brainstorm.

---

## Self-Review Notes

**Spec coverage (§7.5):**
- Cinematic 3-up grid (1-up mobile), each card = full portrait + name + region + cycle badge ✓ Task 4 + Task 7
- Hover plays muted video preview — partially done (only image; YouTube/Drive embed in card is deferred — most contestants won't have video yet)
- Detail: full-bleed hero, bio, charity platform, photo gallery, social links ✓ Task 6 + Task 8
- Voting button disabled "Opens during finale week" ✓ Task 5 + Task 6
- contestants[] collection schema ✓ Task 2

**Placeholder scan:** no TBD/TODO. Each step has code or commands.

**Type consistency:** `cycleCrown` is a string in all components (e.g. "XXVI") — the page (Task 7) resolves it from `currentCycle.data.crownNumber`. Sash number is a string in the schema (e.g. "I"), but if it's missing the card falls back to `<RomanNumeral n={sortOrder} />`.

**Ambiguity check:** "hover video preview" interpretation is the native `<video preload="none">` element from the spec; YouTube/Drive embeds for the card hover are intentionally deferred (they require iframe + CSP changes for autoplay, more cost than benefit for Phase 3). Detail-page video is full-quality and uses the play-button gate per spec §7.5.

**Notable deviation:** plan defers per-contestant OG image generation. The Satori-on-Workers pattern is owned by Phase 4 (Quiz result OG images per spec §7.6). Phase 3 ships with stock OG.
