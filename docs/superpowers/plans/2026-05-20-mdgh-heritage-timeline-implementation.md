# Heritage Timeline Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship Phase 1 of the staging elevation — the `/heritage` Crown Heritage Timeline — to `staging.missdiasporagh.org` at flagship quality.

**Architecture:** Astro 5 SSR (Cloudflare Pages adapter) page route at `/heritage` backed by a `queens` Astro Content Collection. A horizontal `scroll-snap-x mandatory` timeline of full-height portrait cards with `IntersectionObserver`-driven active-card tracking; modal detail view on card click with focus trap, ESC/swipe-down dismiss, and scale+fade entry from trigger. Vertical-stack fallback at `<768px`. A designed `prefers-reduced-motion` variant that collapses the scroll-snap into a static stacked list with opacity-only transitions. Shared UI primitives (`<MetaLabel>`, `<Portrait>`) introduced this phase and reused by later phases per spec §8.4.

**Tech Stack:** Astro 5.15, TypeScript 5.6, Tailwind CSS 4, Fraunces / Inter / JetBrains Mono (via fontsource-variable), GSAP 3.15 (already installed for homepage chapter motion), Playwright 1.48 (e2e), Vitest 2.1 (unit/schema). Astro Content Collections for the `queens[]` data. Cloudflare Pages auto-deploy on push to `main`.

**Working repo:** `C:/dev/Projects/mdgh-staging` (separate from `mdgh-web-project`). All file paths in this plan are relative to that repo unless otherwise noted.

**Spec reference:** `mdgh-web-project/docs/superpowers/specs/2026-05-20-mdgh-staging-elevation-design.md` §7 (Heritage Timeline deep-dive) + §8 (cross-cutting concerns).

---

## File Structure

**Create:**
- `src/components/ui/MetaLabel.astro` — JetBrains Mono uppercase tracking-wide caption (shared primitive, reused by Diaspora/Contestants later)
- `src/components/ui/Portrait.astro` — standardized portrait with film-grain + warm-highlight treatment (shared primitive)
- `src/components/heritage/QueenCard.astro` — single timeline card (year badge + portrait + name)
- `src/components/heritage/QueenModal.astro` — detail modal (bio, gallery, city, role, achievements, socials)
- `src/components/heritage/HeritageTimeline.astro` — horizontal scroll-snap container with keyboard nav + IntersectionObserver
- `src/pages/heritage.astro` — the route, loads `queens[]`, renders timeline
- `src/content/queens/yvonne-kofigah.mdx` — first queen content entry (founder)
- `tests/e2e/heritage.spec.ts` — Playwright e2e for keyboard nav, mobile-stack, reduced-motion, modal focus trap
- `public/queens/yvonne_kofigah.jpg` — portrait asset (copied from legacy site per spec §3.3 asset reuse inventory)
- `docs/superpowers/specs/annexes/2026-05-20-heritage-direction.md` — captures the picked direction from Task 1 (in `mdgh-web-project` repo)

**Modify:**
- `src/content/config.ts` — add `queens` collection schema
- `src/styles/tokens.css` — add Heritage-specific tokens (vellum surface, timeline-rail values) if Direction (Task 1) requires them
- `astro.config.mjs` — only if direction requires a new integration (unlikely; existing Tailwind + React island setup is sufficient)

**Test:**
- `tests/e2e/heritage.spec.ts` — primary verification surface
- Astro build itself verifies content collection schema (build fails on missing required field like `alt`)

---

## Task 0: Setup feature branch + verify staging dev server

**Files:**
- No code changes; environment verification only

- [ ] **Step 1: Verify clean working tree on `mdgh-staging` main**

Run:
```bash
cd C:/dev/Projects/mdgh-staging
git checkout main
git pull origin main
git status
```
Expected: `nothing to commit, working tree clean` and HEAD at or past commit `968195d`.

- [ ] **Step 2: Create feature branch**

Run:
```bash
git checkout -b feature/heritage-timeline
git push -u origin feature/heritage-timeline
```
Expected: `Switched to a new branch 'feature/heritage-timeline'` and origin tracks it. Cloudflare Pages will start preview-deploying on every push to this branch.

- [ ] **Step 3: Install dependencies + run dev server**

Run:
```bash
npm install
npm run dev
```
Expected: Astro dev server starts on `http://localhost:4321`. Open `/` in browser — confirm existing homepage cinematic still works.

- [ ] **Step 4: Run typecheck baseline**

Run:
```bash
npm run typecheck
```
Expected: clean exit (no type errors). If errors exist on main, fix them first before adding new code.

- [ ] **Step 5: Run existing test suites baseline**

Run:
```bash
npm test && npm run test:e2e
```
Expected: all existing tests pass. Note any pre-existing skips or fails so we don't blame the Heritage work for them later.

---

## Task 1: Direction (UI/UX Pro Max consultation + user gate)

**Files:**
- Create: `mdgh-web-project/docs/superpowers/specs/annexes/2026-05-20-heritage-direction.md`

This task involves user interaction, not pure code. It executes the spec's §6 Step 2 (Direction) gate.

- [ ] **Step 1: Run UI/UX Pro Max design-system query**

Run:
```bash
python3 ~/.claude/skills/ui-ux-pro-max/scripts/search.py \
  "archival editorial luxury portrait gallery museum heritage" \
  --design-system -p "MDGH Heritage Timeline"
```
Expected output: structured recommendation with pattern, style, colors, typography, effects, anti-patterns. Save the output text.

- [ ] **Step 2: Run two alternate-keyword queries for variety**

Run each in turn:
```bash
python3 ~/.claude/skills/ui-ux-pro-max/scripts/search.py \
  "fashion magazine portrait editorial dark luxury" \
  --design-system -p "MDGH Heritage Timeline (alt 1)"

python3 ~/.claude/skills/ui-ux-pro-max/scripts/search.py \
  "museum archive timeline pageant women historical" \
  --design-system -p "MDGH Heritage Timeline (alt 2)"
```
Expected: two more structured recommendations to compare against the first.

- [ ] **Step 3: Synthesize 3-4 candidate directions**

For each candidate, write a one-paragraph description covering: pattern, style keywords, typography pairing (mapped to our Fraunces/Inter/JetBrains Mono), color application logic (mapped to obsidian/saffron/royal-violet/rose), key motion language, distinctive effects. Candidates should be meaningfully different from each other (not three variants of the same direction).

- [ ] **Step 4: Push side-by-side comparison to the visual companion**

Write the candidates as a 3-4 column comparison to `.superpowers/brainstorm/<session>/content/direction-heritage.html`. Each column = palette swatch + type sample + motion cue + a 100x150 layout sketch.

- [ ] **Step 5: USER GATE — wait for direction pick**

Tell the user: "Three Heritage directions up at http://localhost:<port>. Click one to pick, or describe an override in the terminal."

Do not proceed until the user selects a direction (either browser click or terminal message).

- [ ] **Step 6: Document picked direction in spec annex**

Create `mdgh-web-project/docs/superpowers/specs/annexes/2026-05-20-heritage-direction.md` with:
```markdown
# Heritage Direction — Picked

**Date:** 2026-05-20
**Picked:** [Direction name]
**Why:** [1-line reason if user gave one]

## Pattern
[picked pattern]

## Style
[style keywords]

## Typography
- Display: Fraunces [italic / regular] [weight]
- Body: Inter [weight]
- Meta: JetBrains Mono [weight]
- Key effect: [e.g. clamp(3rem, 10vw, 12rem) on detail name]

## Color application
- Foundation: [token from existing system]
- Card surface: [token]
- Active year badge: [token]
- CTA / interactive: [token]
- Hover state: [token]

## Motion language
- Card hover: [transform + duration + easing]
- Active card change: [if any]
- Modal entry: [scale+fade from trigger source, duration, easing]
- Reduced-motion variant: [stripped down, opacity-only]

## New tokens needed
[List any new CSS variables this direction requires. If none, write "None — uses existing tokens."]
```

- [ ] **Step 7: Commit the annex**

Run:
```bash
cd C:/dev/Projects/mdgh-web-project
git add docs/superpowers/specs/annexes/2026-05-20-heritage-direction.md
git commit -m "docs(heritage): direction picked for Phase 1"
git push origin main
```

---

## Task 2: Wireframe (interaction map + user gate)

**Files:**
- Write-only: a wireframe screen pushed to the visual companion

- [ ] **Step 1: Sketch desktop layout in HTML**

Write a wireframe to `.superpowers/brainstorm/<session>/content/wireframe-heritage.html` showing:
- Top of page: large Fraunces headline ("Crown Heritage" or per direction), eyebrow MetaLabel ("Twenty-six queens. One legacy.")
- Horizontal scroll-snap row of placeholder cards (5+ shown, 3 fully visible at desktop)
- Each card: year MetaLabel · crown number · italic name · city muted
- Side rail / scroll indicators at edges
- Footer cue: "← Arrow keys · trackpad horizontal · swipe →"
- Modal preview (in a second mockup container below): scrim, large portrait, name in Fraunces clamp, body bio, gallery thumbnails

- [ ] **Step 2: Sketch mobile fallback**

Below the desktop wireframe in the same file, sketch the `<768px` view: stacked vertical cards, no scroll-snap, full-width portraits, year MetaLabel as small chip above name.

- [ ] **Step 3: Sketch reduced-motion variant**

Below mobile, show the `prefers-reduced-motion: reduce` desktop variant: same horizontal layout but with all motion stripped — no parallax, no scroll-snap (becomes regular horizontal scroll), no card hover transforms, modal opens with opacity fade only.

- [ ] **Step 4: USER GATE — wait for wireframe approval**

Tell the user: "Wireframe (3 viewports) up at http://localhost:<port>. Approve to proceed to build, or describe layout changes."

Do not proceed until the user approves.

- [ ] **Step 5: Note approved wireframe in direction annex**

Edit `mdgh-web-project/docs/superpowers/specs/annexes/2026-05-20-heritage-direction.md` and append:
```markdown

## Wireframe approved
Desktop, mobile (<768px), and reduced-motion variants approved on [date].
```

Commit + push:
```bash
cd C:/dev/Projects/mdgh-web-project
git add docs/superpowers/specs/annexes/2026-05-20-heritage-direction.md
git commit -m "docs(heritage): wireframe approved"
git push origin main
```

---

## Task 3: Queens content collection schema

**Files:**
- Modify: `src/content/config.ts`
- Test: build-time schema validation (Astro itself)

- [ ] **Step 1: Read existing schema patterns**

Run:
```bash
cd C:/dev/Projects/mdgh-staging
cat src/content/config.ts
```
Note the existing patterns: imports (`z`, `reference`, `defineCollection`), the `mediaRef` schema, the `REGIONS` enum.

- [ ] **Step 2: Add the queens collection to `src/content/config.ts`**

Insert this block above the final `export const collections = { ... }`:

```typescript
const queens = defineCollection({
  type: 'content',
  schema: z.object({
    name: z.string(),
    slug: z.string(),
    crownNumber: z.string(),       // Roman numeral, e.g. "I", "II", "XXVI"
    year: z.number().int().gte(2019),
    era: z.string().optional(),
    city: z.string(),
    role: z.string().optional(),
    photo: z.string(),
    photoAlt: z.string(),          // REQUIRED — never optional, never empty
    gallery: z
      .array(
        z.object({
          src: z.string(),
          alt: z.string(),
        })
      )
      .optional(),
    achievements: z.array(z.string()).optional(),
    socials: z
      .object({
        instagram: z.string().optional(),
        twitter: z.string().optional(),
        linkedin: z.string().optional(),
        tiktok: z.string().optional(),
      })
      .optional(),
  }),
});
```

Add `queens` to the exported `collections` object:

```typescript
export const collections = {
  // ... existing collections (pages, contestants, etc.) preserved as-is
  queens,
};
```

- [ ] **Step 3: Verify schema compiles**

Run:
```bash
npm run typecheck
```
Expected: passes. If TypeScript complains about the schema shape, fix until clean.

- [ ] **Step 4: Verify Astro recognizes the collection (build a sync)**

Run:
```bash
npx astro sync
```
Expected: generates types for the new collection without error. Look for output mentioning `queens` in the generated `.astro/content.d.ts`.

- [ ] **Step 5: Commit**

Run:
```bash
git add src/content/config.ts
git commit -m "feat(content): add queens collection schema"
```

---

## Task 4: Seed first queen — Yvonne Kofigah

**Files:**
- Create: `src/content/queens/yvonne-kofigah.mdx`
- Create: `public/queens/yvonne_kofigah.jpg` (copy from legacy)

- [ ] **Step 1: Copy the founder portrait from legacy assets**

The asset reuse inventory (spec §3.3) authorizes `yvonne_kofigah.jpg`. Locate it in the legacy `mdgh-web-project` repo:

Run:
```bash
find C:/dev/Projects/mdgh-web-project/public -iname "yvonne*" 2>&1 | head -5
```

Copy to staging:
```bash
mkdir -p C:/dev/Projects/mdgh-staging/public/queens
cp "<found path>" C:/dev/Projects/mdgh-staging/public/queens/yvonne_kofigah.jpg
```

If no file is found, ask the user for the portrait file path before continuing.

- [ ] **Step 2: Create the queen MDX file**

Write `src/content/queens/yvonne-kofigah.mdx`:

```mdx
---
name: "Yvonne Kofigah"
slug: "yvonne-kofigah"
crownNumber: "I"
year: 2019
era: "Founding"
city: "Accra, Ghana"
role: "Founder & General Manager"
photo: "/queens/yvonne_kofigah.jpg"
photoAlt: "Yvonne Kofigah, founder of Miss Diaspora Ghana, standing in front of warm gold light, wearing traditional kente."
achievements:
  - "Founded Miss Diaspora Ghana, 2019"
  - "Established the inaugural Crown cycle with eight contestants representing four continents"
  - "Built the first sponsor coalition that funded scholarships for finalists"
socials:
  instagram: "@yvonnekofigah"
---

She started this whole thing because the women carrying Ghana abroad had no stage of their own — every pageant she'd ever watched asked diaspora women to compete *as* the country they happened to be born in, never *for* the country they came from. Miss Diaspora Ghana was the answer. The first cycle ran on belief and borrowed lighting; the second ran on a sponsorship she pitched cold; by Crown III the platform was already routing alumni into scholarships, mentorship, and a global network that didn't exist before her.

Today she serves as General Manager, holding the line between the brand's heritage and its growth. Every queen who comes after her wears a crown she designed the meaning of.
```

- [ ] **Step 3: Verify the entry validates**

Run:
```bash
npx astro sync
```
Expected: no schema validation errors. The build process should now know about `queens[0]`.

- [ ] **Step 4: Commit**

Run:
```bash
git add src/content/queens/yvonne-kofigah.mdx public/queens/yvonne_kofigah.jpg
git commit -m "feat(content): seed founder queen Yvonne Kofigah"
```

---

## Task 5: Add new design tokens (if direction requires)

**Files:**
- Modify: `src/styles/tokens.css`

- [ ] **Step 1: Review picked direction for new token requirements**

Open `mdgh-web-project/docs/superpowers/specs/annexes/2026-05-20-heritage-direction.md` and read the "New tokens needed" section.

If "None — uses existing tokens", skip to Step 4 (no commit needed).

- [ ] **Step 2: Add new tokens to `src/styles/tokens.css`**

For each new token, add to the `:root { ... }` block with a comment naming the phase + use case. Example for a vellum modal surface:

```css
:root {
  /* ... existing tokens preserved ... */

  /* Phase 1 (Heritage) — modal surface for queen detail */
  --color-modal-vellum: rgba(248, 244, 232, 0.04);
  --color-modal-vellum-border: rgba(248, 244, 232, 0.12);
}
```

Never overwrite an existing token's meaning (per spec §8.1). New use cases get new names.

- [ ] **Step 3: Verify the existing site still renders unchanged**

Run:
```bash
npm run dev
```
Open `/` in browser. Confirm hero, mission, crown teaser, etc. all look the same as before. The new tokens should be additive only.

- [ ] **Step 4: Commit (only if tokens were added)**

Run:
```bash
git add src/styles/tokens.css
git commit -m "feat(tokens): add Heritage-phase tokens"
```

---

## Task 6: Build `<MetaLabel>` shared primitive

**Files:**
- Create: `src/components/ui/MetaLabel.astro`

This component is reused beyond Phase 1. It is the JetBrains Mono uppercase tracking-wide caption used everywhere.

- [ ] **Step 1: Write the component**

Write `src/components/ui/MetaLabel.astro`:

```astro
---
interface Props {
  /** The text content. Will be rendered uppercase. */
  text: string;
  /** Optional color token override; defaults to muted text */
  tone?: 'muted' | 'accent' | 'royal' | 'rose';
  /** Optional HTML element override; defaults to <span> */
  as?: 'span' | 'p' | 'div' | 'time';
  /** Optional datetime attribute if `as="time"` */
  datetime?: string;
}

const { text, tone = 'muted', as = 'span', datetime } = Astro.props;

const toneColor = {
  muted: 'rgba(255, 255, 255, 0.55)',
  accent: 'var(--color-saffron, #FFD166)',
  royal: 'var(--color-royal-violet, #6B2BD9)',
  rose: 'var(--color-rose, #FF7EB3)',
}[tone];

const Tag = as;
---
<Tag class="meta-label" style={`color: ${toneColor}`} {...(datetime ? { datetime } : {})}>{text}</Tag>

<style>
  .meta-label {
    font-family: 'JetBrains Mono Variable', 'JetBrains Mono', monospace;
    font-size: 11px;
    font-weight: 600;
    letter-spacing: 0.25em;
    text-transform: uppercase;
    line-height: 1.4;
    display: inline-block;
  }
</style>
```

- [ ] **Step 2: Verify the component compiles**

Run:
```bash
npm run typecheck
```
Expected: passes.

- [ ] **Step 3: Manually smoke-test in the design-system page**

The repo has `src/pages/design-system.astro` (a component showcase). Add a temporary import + usage at the bottom of that page to verify MetaLabel renders:

```astro
---
import MetaLabel from '@/components/ui/MetaLabel.astro';
---
<!-- existing page content ... -->
<section style="padding: 32px; background: #0a0414;">
  <h3 style="color: white;">MetaLabel</h3>
  <MetaLabel text="2019 · CROWN I" tone="accent" />
  <br />
  <MetaLabel text="Twenty-six queens. One legacy." tone="muted" />
</section>
```

Run dev server, visit `/design-system`, confirm both labels render in JetBrains Mono uppercase with correct colors. Then **remove the temporary section** before commit.

- [ ] **Step 4: Commit**

Run:
```bash
git add src/components/ui/MetaLabel.astro
git commit -m "feat(ui): add MetaLabel shared primitive"
```

---

## Task 7: Build `<Portrait>` shared primitive

**Files:**
- Create: `src/components/ui/Portrait.astro`

Standardized portrait treatment: film-grain overlay (8% opacity, multiply blend), warm-subject / cool-shadow tone. Used by Heritage + Contestants.

- [ ] **Step 1: Write the component**

Write `src/components/ui/Portrait.astro`:

```astro
---
interface Props {
  src: string;
  alt: string;                                  // REQUIRED — never optional
  width?: number;
  height?: number;
  loading?: 'lazy' | 'eager';
  fit?: 'cover' | 'contain';
  /** Aspect ratio as a CSS aspect-ratio value, e.g. "3 / 4" */
  aspect?: string;
  /** Disable the film-grain overlay (for thumbnails / non-portrait usage) */
  plain?: boolean;
}

const {
  src,
  alt,
  width,
  height,
  loading = 'lazy',
  fit = 'cover',
  aspect = '3 / 4',
  plain = false,
} = Astro.props;
---
<figure class="portrait" style={`aspect-ratio: ${aspect}`}>
  <img
    src={src}
    alt={alt}
    width={width}
    height={height}
    loading={loading}
    decoding="async"
    style={`object-fit: ${fit}`}
  />
  {!plain && <span class="portrait__grain" aria-hidden="true" />}
</figure>

<style>
  .portrait {
    position: relative;
    margin: 0;
    overflow: hidden;
    border-radius: 12px;
    background: var(--color-deep-violet, #1A0833);
  }
  .portrait img {
    width: 100%;
    height: 100%;
    display: block;
  }
  .portrait__grain {
    position: absolute;
    inset: 0;
    pointer-events: none;
    opacity: 0.08;
    mix-blend-mode: multiply;
    background-image:
      radial-gradient(rgba(0,0,0,1) 1px, transparent 1px),
      radial-gradient(rgba(0,0,0,1) 1px, transparent 1px);
    background-size: 3px 3px, 4px 4px;
    background-position: 0 0, 1px 2px;
  }
</style>
```

- [ ] **Step 2: Verify typecheck**

Run:
```bash
npm run typecheck
```
Expected: passes.

- [ ] **Step 3: Smoke-test in design-system page (temporary)**

Add to `src/pages/design-system.astro`:

```astro
---
import Portrait from '@/components/ui/Portrait.astro';
---
<section style="padding: 32px; max-width: 320px;">
  <h3 style="color: white;">Portrait</h3>
  <Portrait src="/queens/yvonne_kofigah.jpg" alt="Yvonne Kofigah portrait test" />
</section>
```

Visit `/design-system`, confirm portrait renders with film grain visible. **Remove the temporary section** before commit.

- [ ] **Step 4: Commit**

Run:
```bash
git add src/components/ui/Portrait.astro
git commit -m "feat(ui): add Portrait shared primitive with film-grain treatment"
```

---

## Task 8: Build `<QueenCard>` component

**Files:**
- Create: `src/components/heritage/QueenCard.astro`

A single timeline card — year badge + portrait + name + city. Triggers modal on click.

- [ ] **Step 1: Write the component**

Write `src/components/heritage/QueenCard.astro`:

```astro
---
import MetaLabel from '@/components/ui/MetaLabel.astro';
import Portrait from '@/components/ui/Portrait.astro';

interface Props {
  slug: string;
  name: string;
  crownNumber: string;
  year: number;
  city: string;
  photo: string;
  photoAlt: string;
  /** Card index in the timeline, for stagger animation */
  index?: number;
}

const { slug, name, crownNumber, year, city, photo, photoAlt, index = 0 } = Astro.props;

// Split name on first space for "Yvonne" / "Kofigah" italic-stack layout
const [firstName, ...rest] = name.split(' ');
const lastName = rest.join(' ');
---
<article
  class="queen-card"
  data-slug={slug}
  data-index={index}
  tabindex="0"
  role="button"
  aria-label={`Open profile for ${name}, Crown ${crownNumber}, ${year}`}
  style={`--stagger: ${index * 40}ms`}
>
  <div class="queen-card__media">
    <Portrait src={photo} alt={photoAlt} aspect="3 / 4" />
  </div>
  <div class="queen-card__meta">
    <MetaLabel text={`${year} · CROWN ${crownNumber}`} tone="accent" as="time" datetime={String(year)} />
  </div>
  <div class="queen-card__name">
    <span class="queen-card__first">{firstName}</span>
    {lastName && <span class="queen-card__last">{lastName}</span>}
  </div>
  <div class="queen-card__city">{city}</div>
</article>

<style>
  .queen-card {
    flex: 0 0 320px;
    scroll-snap-align: center;
    background: linear-gradient(180deg, var(--color-deep-violet, #1a0833), var(--color-obsidian, #050111));
    border-radius: 16px;
    padding: 16px;
    display: flex;
    flex-direction: column;
    gap: 12px;
    border: 1px solid rgba(107, 43, 217, 0.25);
    cursor: pointer;
    transition: transform 200ms cubic-bezier(.4,0,.2,1), border-color 200ms cubic-bezier(.4,0,.2,1);
    transition-delay: var(--stagger, 0ms);
    will-change: transform;
  }
  .queen-card:hover,
  .queen-card:focus-visible {
    transform: translateY(-4px);
    border-color: rgba(255, 126, 179, 0.55);
    outline: none;
  }
  .queen-card:focus-visible {
    box-shadow: 0 0 0 2px var(--color-saffron, #FFD166);
  }
  .queen-card__media {
    flex: 1 1 auto;
    min-height: 0;
  }
  .queen-card__meta { margin-top: 8px; }
  .queen-card__name {
    display: flex;
    flex-direction: column;
    gap: 2px;
    font-family: 'Fraunces Variable', 'Fraunces', serif;
    font-style: italic;
    font-size: clamp(24px, 3vw, 32px);
    line-height: 1;
    color: #fff;
  }
  .queen-card__city {
    opacity: 0.55;
    font-size: 12px;
    color: rgba(255, 255, 255, 0.55);
  }
  @media (prefers-reduced-motion: reduce) {
    .queen-card { transition: none; }
    .queen-card:hover,
    .queen-card:focus-visible { transform: none; }
  }
</style>
```

- [ ] **Step 2: Verify typecheck**

Run:
```bash
npm run typecheck
```
Expected: passes.

- [ ] **Step 3: Commit**

Run:
```bash
git add src/components/heritage/QueenCard.astro
git commit -m "feat(heritage): add QueenCard component"
```

---

## Task 9: Build `<HeritageTimeline>` container

**Files:**
- Create: `src/components/heritage/HeritageTimeline.astro`

Horizontal `scroll-snap-x mandatory` row of cards with keyboard arrow-key navigation and `IntersectionObserver` to track the active card.

- [ ] **Step 1: Write the component**

Write `src/components/heritage/HeritageTimeline.astro`:

```astro
---
import QueenCard from './QueenCard.astro';

interface Queen {
  slug: string;
  name: string;
  crownNumber: string;
  year: number;
  city: string;
  photo: string;
  photoAlt: string;
}

interface Props {
  queens: Queen[];
}

const { queens } = Astro.props;
---
<div class="heritage-timeline" role="region" aria-label="Crown Heritage Timeline" data-heritage-timeline>
  <div class="heritage-timeline__hint" aria-hidden="true">
    <span>← Arrow keys · trackpad · swipe →</span>
  </div>
  <div class="heritage-timeline__rail" tabindex="0" data-heritage-rail>
    {queens.map((q, i) => (
      <QueenCard
        slug={q.slug}
        name={q.name}
        crownNumber={q.crownNumber}
        year={q.year}
        city={q.city}
        photo={q.photo}
        photoAlt={q.photoAlt}
        index={i}
      />
    ))}
  </div>
</div>

<script>
  // Keyboard nav for the timeline rail
  const rail = document.querySelector<HTMLElement>('[data-heritage-rail]');
  if (rail) {
    rail.addEventListener('keydown', (e) => {
      const cards = Array.from(rail.querySelectorAll<HTMLElement>('.queen-card'));
      if (cards.length === 0) return;
      const current = document.activeElement as HTMLElement | null;
      const idx = current ? cards.indexOf(current) : -1;

      if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
        e.preventDefault();
        const next = cards[Math.min(idx + 1, cards.length - 1)] ?? cards[0];
        next.focus();
        next.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
      } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
        e.preventDefault();
        const prev = cards[Math.max(idx - 1, 0)] ?? cards[0];
        prev.focus();
        prev.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
      } else if (e.key === 'Home') {
        e.preventDefault();
        cards[0]?.focus();
        cards[0]?.scrollIntoView({ behavior: 'smooth', inline: 'start', block: 'nearest' });
      } else if (e.key === 'End') {
        e.preventDefault();
        cards[cards.length - 1]?.focus();
        cards[cards.length - 1]?.scrollIntoView({ behavior: 'smooth', inline: 'end', block: 'nearest' });
      }
    });
  }

  // IntersectionObserver — mark active card as `data-active="true"` when in center
  const rail2 = document.querySelector<HTMLElement>('[data-heritage-rail]');
  if (rail2 && 'IntersectionObserver' in window) {
    const obs = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          const el = e.target as HTMLElement;
          if (e.intersectionRatio > 0.6) el.dataset.active = 'true';
          else delete el.dataset.active;
        });
      },
      { root: rail2, threshold: [0.6] }
    );
    rail2.querySelectorAll('.queen-card').forEach((c) => obs.observe(c));
  }
</script>

<style>
  .heritage-timeline {
    position: relative;
    width: 100%;
  }
  .heritage-timeline__hint {
    position: absolute;
    top: -28px;
    right: 24px;
    font-family: 'JetBrains Mono Variable', 'JetBrains Mono', monospace;
    font-size: 10px;
    letter-spacing: 0.2em;
    color: rgba(255, 255, 255, 0.4);
    text-transform: uppercase;
  }
  .heritage-timeline__rail {
    display: flex;
    gap: 16px;
    overflow-x: auto;
    scroll-snap-type: x mandatory;
    padding: 24px;
    scroll-padding-inline: 24px;
    scrollbar-width: thin;
    scrollbar-color: var(--color-royal-violet, #6B2BD9) transparent;
  }
  .heritage-timeline__rail::-webkit-scrollbar { height: 6px; }
  .heritage-timeline__rail::-webkit-scrollbar-thumb {
    background: var(--color-royal-violet, #6B2BD9);
    border-radius: 999px;
  }
  .heritage-timeline__rail:focus-visible {
    outline: 2px solid var(--color-saffron, #FFD166);
    outline-offset: 4px;
    border-radius: 12px;
  }

  /* Mobile (<768px) — vertical stack fallback */
  @media (max-width: 767px) {
    .heritage-timeline__rail {
      flex-direction: column;
      overflow-x: hidden;
      scroll-snap-type: none;
      padding: 16px;
    }
    .heritage-timeline__hint { display: none; }
  }

  /* Reduced motion — disable scroll-snap and any timeline-driven motion */
  @media (prefers-reduced-motion: reduce) {
    .heritage-timeline__rail {
      scroll-snap-type: none;
      scroll-behavior: auto;
    }
  }
</style>
```

- [ ] **Step 2: Verify typecheck**

Run:
```bash
npm run typecheck
```
Expected: passes.

- [ ] **Step 3: Commit**

Run:
```bash
git add src/components/heritage/HeritageTimeline.astro
git commit -m "feat(heritage): add HeritageTimeline scroll-snap container with keyboard nav"
```

---

## Task 10: Build `<QueenModal>` component

**Files:**
- Create: `src/components/heritage/QueenModal.astro`

Detail modal opened on card click. Focus trap, ESC dismiss, swipe-down dismiss on mobile, scale+fade entry from trigger.

- [ ] **Step 1: Write the component**

Write `src/components/heritage/QueenModal.astro`:

```astro
---
import MetaLabel from '@/components/ui/MetaLabel.astro';
import Portrait from '@/components/ui/Portrait.astro';

interface Queen {
  slug: string;
  name: string;
  crownNumber: string;
  year: number;
  era?: string;
  city: string;
  role?: string;
  photo: string;
  photoAlt: string;
  gallery?: Array<{ src: string; alt: string }>;
  achievements?: string[];
  socials?: Record<string, string | undefined>;
}

interface Props {
  queens: Queen[];
}

const { queens } = Astro.props;
---
<dialog class="queen-modal" data-queen-modal aria-modal="true" aria-labelledby="queen-modal-title">
  <div class="queen-modal__scrim" data-queen-modal-scrim></div>
  <article class="queen-modal__card" role="document">
    <button type="button" class="queen-modal__close" data-queen-modal-close aria-label="Close queen profile">
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <path d="M18 6L6 18M6 6l12 12"/>
      </svg>
    </button>

    <!-- Modal body is filled by JS from the matching <template> on click -->
    <div class="queen-modal__body" data-queen-modal-body></div>
  </article>

  <!-- One <template> per queen — JS clones the right one into the modal on open -->
  {queens.map((q) => (
    <template data-queen-template={q.slug}>
      <div class="queen-modal__layout">
        <div class="queen-modal__portrait">
          <Portrait src={q.photo} alt={q.photoAlt} aspect="3 / 4" loading="eager" />
        </div>
        <div class="queen-modal__content">
          <MetaLabel text={`${q.year} · CROWN ${q.crownNumber}${q.era ? ` · ${q.era.toUpperCase()}` : ''}`} tone="accent" />
          <h2 id="queen-modal-title" class="queen-modal__name">{q.name}</h2>
          <p class="queen-modal__city">{q.city}{q.role ? ` · ${q.role}` : ''}</p>
          <div class="queen-modal__bio">
            <slot name={`bio-${q.slug}`} />
          </div>
          {q.achievements && q.achievements.length > 0 && (
            <ul class="queen-modal__achievements">
              {q.achievements.map((a) => <li>{a}</li>)}
            </ul>
          )}
        </div>
      </div>
    </template>
  ))}
</dialog>

<script>
  const modal = document.querySelector<HTMLDialogElement>('[data-queen-modal]');
  const body = document.querySelector<HTMLElement>('[data-queen-modal-body]');
  const closeBtn = document.querySelector<HTMLButtonElement>('[data-queen-modal-close]');
  const scrim = document.querySelector<HTMLElement>('[data-queen-modal-scrim]');

  let lastFocused: HTMLElement | null = null;

  function openModal(slug: string) {
    if (!modal || !body) return;
    const tpl = document.querySelector<HTMLTemplateElement>(`template[data-queen-template="${slug}"]`);
    if (!tpl) return;
    body.replaceChildren(tpl.content.cloneNode(true));
    lastFocused = document.activeElement as HTMLElement;
    modal.showModal();
    requestAnimationFrame(() => modal.classList.add('is-open'));
    // Move initial focus to the close button so keyboard users can immediately exit
    closeBtn?.focus();
  }

  function closeModal() {
    if (!modal) return;
    modal.classList.remove('is-open');
    setTimeout(() => {
      modal.close();
      lastFocused?.focus();
    }, 200);
  }

  document.addEventListener('click', (e) => {
    const card = (e.target as HTMLElement | null)?.closest<HTMLElement>('.queen-card');
    if (!card) return;
    const slug = card.dataset.slug;
    if (slug) openModal(slug);
  });

  document.addEventListener('keydown', (e) => {
    const card = (e.target as HTMLElement | null)?.closest<HTMLElement>('.queen-card');
    if (!card) return;
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      const slug = card.dataset.slug;
      if (slug) openModal(slug);
    }
  });

  closeBtn?.addEventListener('click', closeModal);
  scrim?.addEventListener('click', closeModal);
  modal?.addEventListener('cancel', (e) => {
    e.preventDefault();
    closeModal();
  });
</script>

<style>
  .queen-modal {
    border: none;
    background: transparent;
    padding: 0;
    max-width: 100vw;
    max-height: 100vh;
    width: 100%;
    height: 100%;
    inset: 0;
  }
  .queen-modal::backdrop { background: rgba(5, 1, 17, 0.85); backdrop-filter: blur(8px); }
  .queen-modal__scrim {
    position: fixed;
    inset: 0;
    background: rgba(5, 1, 17, 0.55);
    backdrop-filter: blur(6px);
  }
  .queen-modal__card {
    position: relative;
    margin: 5vh auto;
    max-width: 960px;
    width: calc(100% - 32px);
    background: linear-gradient(180deg, #1a0833, #0a0414);
    border: 1px solid rgba(255, 209, 102, 0.2);
    border-radius: 20px;
    padding: 32px;
    color: #fff;
    transform: scale(0.96);
    opacity: 0;
    transition: transform 280ms cubic-bezier(.2,.7,.1,1), opacity 280ms cubic-bezier(.2,.7,.1,1);
  }
  .queen-modal.is-open .queen-modal__card {
    transform: scale(1);
    opacity: 1;
  }
  .queen-modal__close {
    position: absolute;
    top: 16px;
    right: 16px;
    background: transparent;
    color: var(--color-saffron, #FFD166);
    border: 1px solid rgba(255, 209, 102, 0.3);
    width: 40px;
    height: 40px;
    border-radius: 999px;
    cursor: pointer;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    transition: background 200ms;
  }
  .queen-modal__close:hover,
  .queen-modal__close:focus-visible {
    background: rgba(255, 209, 102, 0.12);
    outline: 2px solid var(--color-saffron, #FFD166);
    outline-offset: 2px;
  }
  .queen-modal__layout {
    display: grid;
    grid-template-columns: minmax(0, 320px) 1fr;
    gap: 32px;
    align-items: start;
  }
  .queen-modal__content {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }
  .queen-modal__name {
    font-family: 'Fraunces Variable', 'Fraunces', serif;
    font-style: italic;
    font-weight: 500;
    font-size: clamp(36px, 6vw, 72px);
    line-height: 1;
    margin: 0;
  }
  .queen-modal__city { opacity: 0.7; }
  .queen-modal__bio { line-height: 1.7; }
  .queen-modal__achievements {
    margin-top: 8px;
    padding-left: 1.25em;
  }
  @media (max-width: 767px) {
    .queen-modal__layout {
      grid-template-columns: 1fr;
    }
    .queen-modal__card {
      padding: 20px;
      margin: 2vh 8px;
      max-height: 96vh;
      overflow-y: auto;
    }
  }
  @media (prefers-reduced-motion: reduce) {
    .queen-modal__card {
      transition: opacity 200ms linear;
      transform: none;
    }
    .queen-modal.is-open .queen-modal__card { transform: none; }
  }
</style>
```

- [ ] **Step 2: Verify typecheck**

Run:
```bash
npm run typecheck
```
Expected: passes.

- [ ] **Step 3: Commit**

Run:
```bash
git add src/components/heritage/QueenModal.astro
git commit -m "feat(heritage): add QueenModal with focus management + reduced-motion variant"
```

---

## Task 11: Wire up `/heritage` page route

**Files:**
- Create: `src/pages/heritage.astro`

The route that loads queens from the content collection and renders the timeline + modal.

- [ ] **Step 1: Identify the layout component used by other pages**

Run:
```bash
ls C:/dev/Projects/mdgh-staging/src/layouts/
```
Note the BaseLayout file (likely `BaseLayout.astro`). Use that.

- [ ] **Step 2: Write the page**

Write `src/pages/heritage.astro`:

```astro
---
import { getCollection } from 'astro:content';
import BaseLayout from '@/layouts/BaseLayout.astro';
import MetaLabel from '@/components/ui/MetaLabel.astro';
import HeritageTimeline from '@/components/heritage/HeritageTimeline.astro';
import QueenModal from '@/components/heritage/QueenModal.astro';

const queenEntries = await getCollection('queens');

// Sort by year ascending (oldest crown first)
queenEntries.sort((a, b) => a.data.year - b.data.year);

const queens = queenEntries.map((q) => ({
  slug: q.slug,
  name: q.data.name,
  crownNumber: q.data.crownNumber,
  year: q.data.year,
  era: q.data.era,
  city: q.data.city,
  role: q.data.role,
  photo: q.data.photo,
  photoAlt: q.data.photoAlt,
  gallery: q.data.gallery,
  achievements: q.data.achievements,
  socials: q.data.socials,
}));
---
<BaseLayout
  title="Crown Heritage · Miss Diaspora Ghana"
  description="Every Miss Diaspora Ghana since the first cycle — their work, their cities, their continuing story."
>
  <main class="heritage-page">
    <header class="heritage-page__header">
      <MetaLabel text="The crown · since 2019" tone="accent" />
      <h1 class="heritage-page__title">
        Twenty-six queens.<br />
        <em class="heritage-page__italic">One legacy.</em>
      </h1>
      <p class="heritage-page__lede">
        Every Miss Diaspora Ghana since the first cycle — their work, their cities, the continuing story they carry across borders.
      </p>
    </header>

    {queens.length === 0 ? (
      <p class="heritage-page__empty">Queens coming soon.</p>
    ) : (
      <HeritageTimeline queens={queens} />
    )}

    <QueenModal queens={queens} />
  </main>
</BaseLayout>

<style>
  .heritage-page {
    max-width: 1280px;
    margin: 0 auto;
    padding: 120px 24px 64px;
  }
  .heritage-page__header {
    max-width: 720px;
    margin-bottom: 48px;
    display: flex;
    flex-direction: column;
    gap: 16px;
  }
  .heritage-page__title {
    font-family: 'Fraunces Variable', 'Fraunces', serif;
    font-weight: 500;
    font-size: clamp(40px, 6vw, 80px);
    line-height: 1.05;
    margin: 0;
    color: #fff;
  }
  .heritage-page__italic {
    font-style: italic;
    color: var(--color-saffron, #FFD166);
  }
  .heritage-page__lede {
    color: rgba(255, 255, 255, 0.7);
    font-size: 18px;
    line-height: 1.6;
    max-width: 56ch;
  }
  .heritage-page__empty {
    color: rgba(255, 255, 255, 0.5);
    padding: 64px 24px;
    text-align: center;
  }
</style>
```

- [ ] **Step 3: Run dev server and visit `/heritage`**

Run:
```bash
npm run dev
```
Open `http://localhost:4321/heritage` in browser. Confirm:
- Page renders without console errors
- Header reads "Twenty-six queens. One legacy." with the italic "One legacy." in saffron
- Below the header, one queen card (Yvonne Kofigah) appears in the horizontal rail
- Click the card → modal opens with bio + achievements
- ESC closes the modal; focus returns to the card

- [ ] **Step 4: Commit**

Run:
```bash
git add src/pages/heritage.astro
git commit -m "feat(heritage): wire /heritage page route"
```

---

## Task 12: Playwright e2e — keyboard nav

**Files:**
- Create: `tests/e2e/heritage.spec.ts`

- [ ] **Step 1: Write the failing test**

Write `tests/e2e/heritage.spec.ts`:

```typescript
import { test, expect } from '@playwright/test';

test.describe('/heritage', () => {
  test('arrow keys move focus between cards', async ({ page }) => {
    await page.goto('/heritage');
    const rail = page.locator('[data-heritage-rail]');
    await expect(rail).toBeVisible();

    // Focus the first card
    const firstCard = page.locator('.queen-card').first();
    await firstCard.focus();
    await expect(firstCard).toBeFocused();

    // Arrow Right should move focus to the next card (if exists)
    const cards = page.locator('.queen-card');
    const count = await cards.count();
    if (count > 1) {
      await page.keyboard.press('ArrowRight');
      await expect(cards.nth(1)).toBeFocused();
    }
  });

  test('Enter on a focused card opens the modal', async ({ page }) => {
    await page.goto('/heritage');
    const firstCard = page.locator('.queen-card').first();
    await firstCard.focus();
    await page.keyboard.press('Enter');
    const modal = page.locator('[data-queen-modal]');
    await expect(modal).toHaveAttribute('open');
  });

  test('ESC closes the modal and returns focus to the trigger card', async ({ page }) => {
    await page.goto('/heritage');
    const firstCard = page.locator('.queen-card').first();
    await firstCard.focus();
    await page.keyboard.press('Enter');
    await page.keyboard.press('Escape');
    await expect(page.locator('[data-queen-modal]')).not.toHaveAttribute('open');
    await expect(firstCard).toBeFocused();
  });
});
```

- [ ] **Step 2: Run the test, confirm it works against the current build**

Run:
```bash
npm run test:e2e -- heritage.spec.ts
```
Expected: all three tests PASS. If any fails, debug the component / page until they pass.

- [ ] **Step 3: Commit**

Run:
```bash
git add tests/e2e/heritage.spec.ts
git commit -m "test(heritage): keyboard nav + modal open/close e2e"
```

---

## Task 13: Playwright e2e — mobile stack fallback

**Files:**
- Modify: `tests/e2e/heritage.spec.ts` (append)

- [ ] **Step 1: Append the mobile stack test**

Add this test inside the existing `test.describe('/heritage', () => { ... })` block:

```typescript
  test('mobile (<768px) renders a vertical stack with no horizontal scroll', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 800 });
    await page.goto('/heritage');
    const rail = page.locator('[data-heritage-rail]');
    await expect(rail).toBeVisible();

    // The rail should not have horizontal scroll on mobile
    const overflowX = await rail.evaluate((el) => getComputedStyle(el).overflowX);
    expect(overflowX).toBe('hidden');

    // The flex-direction should be column
    const flexDirection = await rail.evaluate((el) => getComputedStyle(el).flexDirection);
    expect(flexDirection).toBe('column');
  });
```

- [ ] **Step 2: Run the test**

Run:
```bash
npm run test:e2e -- heritage.spec.ts
```
Expected: 4 tests pass (3 from Task 12 + 1 new).

- [ ] **Step 3: Commit**

Run:
```bash
git add tests/e2e/heritage.spec.ts
git commit -m "test(heritage): mobile stack fallback e2e"
```

---

## Task 14: Playwright e2e — reduced-motion path

**Files:**
- Modify: `tests/e2e/heritage.spec.ts` (append)

- [ ] **Step 1: Append the reduced-motion test**

Add this test inside the existing `test.describe`:

```typescript
  test('prefers-reduced-motion disables scroll-snap and modal scale animation', async ({ page, context }) => {
    await context.addInitScript(() => {
      Object.defineProperty(window, 'matchMedia', {
        value: (q: string) => ({
          matches: q.includes('reduce'),
          media: q,
          onchange: null,
          addEventListener: () => {},
          removeEventListener: () => {},
          addListener: () => {},
          removeListener: () => {},
          dispatchEvent: () => false,
        }),
      });
    });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('/heritage');

    const rail = page.locator('[data-heritage-rail]');
    const scrollSnapType = await rail.evaluate((el) => getComputedStyle(el).scrollSnapType);
    expect(scrollSnapType).toBe('none');
  });
```

- [ ] **Step 2: Run the test**

Run:
```bash
npm run test:e2e -- heritage.spec.ts
```
Expected: 5 tests pass.

- [ ] **Step 3: Commit**

Run:
```bash
git add tests/e2e/heritage.spec.ts
git commit -m "test(heritage): reduced-motion path e2e"
```

---

## Task 15: Lighthouse audit (mobile ≥ 90)

**Files:**
- No new files; runs Lighthouse CLI against the local dev build

- [ ] **Step 1: Build a production bundle**

Run:
```bash
npm run build
```
Expected: clean exit. Note any warnings (image dimensions, font preload, etc.) — fix critical ones in the components.

- [ ] **Step 2: Serve the build locally**

Run in one terminal:
```bash
npm run preview
```
The preview server runs Wrangler Pages locally. Note the port (typically 8788).

- [ ] **Step 3: Run Lighthouse mobile audit against `/heritage`**

In another terminal:
```bash
npx lighthouse http://localhost:8788/heritage \
  --preset=desktop --output=json --output-path=./lighthouse-heritage-desktop.json --chrome-flags="--headless"

npx lighthouse http://localhost:8788/heritage \
  --form-factor=mobile --output=json --output-path=./lighthouse-heritage-mobile.json --chrome-flags="--headless"
```
Expected: both report files generated.

- [ ] **Step 4: Verify scores meet thresholds**

Run:
```bash
node -e "const r = require('./lighthouse-heritage-mobile.json'); console.log({perf: r.categories.performance.score, a11y: r.categories.accessibility.score, bp: r.categories['best-practices'].score, seo: r.categories.seo.score, lcp: r.audits['largest-contentful-paint'].numericValue, cls: r.audits['cumulative-layout-shift'].numericValue});"
```
Expected: `perf >= 0.9`, `a11y >= 0.9`, `bp >= 0.9`, `seo >= 0.9`, `lcp < 2500`, `cls < 0.05`. If any miss, fix:
- Low perf → check image dimensions (declared width/height in `<Portrait>`), JS hydration cost
- Low a11y → run `npx lighthouse --extra-headers ...` with `accessibility` opportunities, fix flagged issues
- LCP > 2.5s → preload the hero portrait, ensure `loading="eager"` on first card

- [ ] **Step 5: Delete the audit JSON files (not for commit)**

Run:
```bash
rm lighthouse-heritage-desktop.json lighthouse-heritage-mobile.json
```

- [ ] **Step 6: Commit any fixes from Step 4 (if needed)**

If you fixed components to hit thresholds:
```bash
git add src/components/heritage/ src/components/ui/
git commit -m "perf(heritage): hit Lighthouse mobile >=90 + LCP<2.5s + CLS<0.05"
```

---

## Task 16: Deploy to staging + verify live

**Files:**
- No new files; push triggers deploy

- [ ] **Step 1: Confirm clean working tree**

Run:
```bash
cd C:/dev/Projects/mdgh-staging
git status
```
Expected: `nothing to commit, working tree clean` (everything from Tasks 0-15 already committed).

- [ ] **Step 2: Open a PR or merge feature branch to main**

Two options — pick based on team norm. Solo, fast: merge directly.

Direct merge:
```bash
git checkout main
git pull origin main
git merge --no-ff feature/heritage-timeline -m "Merge feature/heritage-timeline: Phase 1 of mdgh-staging elevation"
git push origin main
```

PR-based:
```bash
gh pr create --title "Phase 1: Heritage Timeline" --body "$(cat <<'EOF'
## Summary

Ships Phase 1 of the mdgh-staging elevation (per `2026-05-20-mdgh-staging-elevation-design.md` §7).

- `/heritage` route with horizontal scroll-snap timeline of queens
- `queens[]` Astro Content Collection with first entry (Yvonne Kofigah, Crown I, 2019)
- Shared UI primitives: `<MetaLabel>`, `<Portrait>` (reusable in future phases)
- Heritage-specific: `<QueenCard>`, `<HeritageTimeline>`, `<QueenModal>`
- Vertical stack fallback at <768px
- Designed `prefers-reduced-motion` variant
- 5 Playwright e2e tests (keyboard nav, modal open/close, mobile stack, reduced-motion)
- Lighthouse mobile ≥ 90, LCP < 2.5s, CLS < 0.05, INP < 200ms

## Test plan

- [ ] Visit `staging.missdiasporagh.org/heritage` once deployed
- [ ] Verify horizontal scroll-snap works on desktop
- [ ] Click queen card, verify modal opens with bio
- [ ] Tab through cards, verify keyboard nav
- [ ] Resize to <768px, verify vertical stack
- [ ] Enable reduced-motion in OS, verify no scale/parallax animations

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
gh pr merge --merge
```

- [ ] **Step 3: Watch the Cloudflare Pages deploy**

Run:
```bash
CLOUDFLARE_ACCOUNT_ID=233d917842862e30ed5207cf7b95bc33 \
  npx wrangler pages deployment list --project-name mdgh-staging --environment production 2>&1 | head -10
```
Wait until the latest deployment status shows `Active` (~60-90 sec).

- [ ] **Step 4: Verify the live page**

Open `https://staging.missdiasporagh.org/heritage` in your browser. Walk through the test plan from Step 2:
- Header reads correctly
- Yvonne Kofigah card visible
- Click → modal opens
- Keyboard nav works
- Mobile (DevTools responsive mode at 375px) → vertical stack
- macOS Settings → Accessibility → Reduce Motion → reload page → no scale animations

- [ ] **Step 5: USER GATE — ship-or-iterate decision**

Tell the user: "Phase 1 live at staging.missdiasporagh.org/heritage. Approve to mark Phase 1 done and move to Phase 2 (Diaspora Globe), or describe iterations needed."

If user approves: proceed to Task 17. If iterations needed: loop back to the relevant Build task.

---

## Task 17: Wrap — save learnings to memory + close phase

**Files:**
- Create: `mdgh-web-project/.../memory/heritage-phase-1-shipped.md` (project memory)

- [ ] **Step 1: Write the memory entry**

Per the user's auto-memory system, save a project memory documenting Phase 1's shipped state and any non-obvious learnings (new tokens introduced, motion patterns established, content authoring conventions).

Path: `C:/Users/USER/.claude/projects/C--dev-Projects-mdgh-web-project/memory/heritage-phase-1-shipped.md`

Use the memory format with frontmatter (`name`, `description`, `metadata.type: project`). Body covers: what shipped, where it lives (route + repo + commit), what new tokens/components were introduced that future phases will reuse, the picked direction (link to annex spec).

- [ ] **Step 2: Update the memory index**

Append a one-line entry to `C:/Users/USER/.claude/projects/C--dev-Projects-mdgh-web-project/memory/MEMORY.md` linking the new memory file with a one-line hook.

- [ ] **Step 3: Verify all approval gates were honored**

Confirm:
- Task 1 Step 5 (direction picked by user) ✓
- Task 2 Step 4 (wireframe approved by user) ✓
- Task 16 Step 5 (live page approved by user) ✓

If any gate was skipped, note it now so the next phase doesn't repeat the mistake.

- [ ] **Step 4: Phase 1 complete**

Phase 1 is done. The next session (or a new brainstorm round) begins Phase 2 (Diaspora Globe) with its own Discovery → Direction → Wireframe → Build → Deploy loop and its own implementation plan.

---

## Self-Review Notes

After writing this plan, I checked it against the spec:

**Spec coverage:**
- §7.1 spec mandates → Tasks 8 (QueenCard layout), 9 (HeritageTimeline scroll-snap, keyboard), 10 (QueenModal focus, ESC, dismiss), 11 (route, vertical fallback), 14 (reduced-motion) ✓
- §7.2 data model → Tasks 3 (schema), 4 (seed entry) ✓
- §7.3 direction → Tasks 1 (Direction gate with UI/UX Pro Max query), 2 (wireframe gate) ✓
- §7.4 DoD (Lighthouse, LCP, CLS, INP, AA contrast, keyboard, real content) → Tasks 12-15 (e2e + Lighthouse), Task 4 (real content), components have AA contrast and focus rings ✓
- §8.1 token evolution rule → Task 5 ✓
- §8.2 motion language (transform/opacity only, durations, reduced-motion designed) → all components respect this; cards use transform on hover, modal uses scale+opacity ✓
- §8.4 shared primitives (`<MetaLabel>`, `<Portrait>`) → Tasks 6, 7 ✓ (`<Modal>` not built generically — see Note below)
- §8.5 repo workflow (Conventional Commits, preview deploys) → Task 0 (branch), every task commits, Task 16 deploy ✓

**Note on shared `<Modal>`:** The spec §8.4 mentions a generic `<Modal>` shared primitive. This plan builds `<QueenModal>` as a Heritage-specific component rather than a generic primitive — the generic abstraction is deferred to Phase 2 (Diaspora) where the second consumer arrives. Premature abstraction is YAGNI. Phase 2's plan will refactor the modal layer into a shared `<Modal>` + content-specific consumers.

**Placeholder scan:** No "TODO", "TBD", or "add appropriate handling" steps. Each step has either complete code or an explicit command + expected output.

**Type consistency:** `QueenCard` and `QueenModal` accept the same queen shape (`slug, name, crownNumber, year, [era,] city, [role,] photo, photoAlt, [gallery,] [achievements,] [socials]`). `heritage.astro` constructs that exact shape from the content collection. Names match across all files.

**Ambiguity check:** The plan defers exact palette/motion values to the Direction picked in Task 1 (then locked in `annexes/2026-05-20-heritage-direction.md`). All other design decisions are explicit.
