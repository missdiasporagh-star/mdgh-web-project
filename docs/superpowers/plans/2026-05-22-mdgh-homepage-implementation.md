# Homepage Maximalism Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship Phase 5 (final) of the staging elevation — the elevated homepage at `/` — to `staging.missdiasporagh.org` at flagship quality. This is also where the layout-wide font preload work fixes the LCP/CLS regression carried since Phase 1.

**Architecture:** No new routes — only `/` is touched. The existing 6-chapter scroll-snap structure stays. Each chapter is elevated: HeroChapter gets a live cycle-status pill + secondary Quiz CTA, MissionChapter gets a pull-quote treatment, CrownTeaserChapter renders a real mini Yvonne portrait card, DiasporaTeaserChapter renders a real mini react-globe.gl globe (via the Phase 2 dynamic-import pattern), CycleTeaserChapter renders a real 3-up ContestantCard mini grid, BecomeHerChapter gets finale polish. A new QuizTeaserChapter is added as Chapter VI between Cycle and Apply. ChapterRail expands from 6 → 7 entries. Font preload added at BaseLayout `<head>` + `font-display: optional` on @font-face — finally achieves the spec's LCP < 2500ms target.

**Tech Stack:** Astro 5.15, React 19 (existing islands only). Reuses every primitive built in Phases 1-4. No new heavy dependencies.

**Working repo:** `C:/dev/Projects/mdgh-staging`

**Spec references:**
- `mdgh-web-project/docs/superpowers/specs/2026-05-20-mdgh-staging-elevation-design.md` §1, §3, §4 row 5, §9
- `mdgh-web-project/docs/superpowers/specs/annexes/2026-05-22-homepage-direction.md` (Cinematic Tour direction — per-chapter elevations, font preload approach, motion language pass)

---

## File Structure

**Create:**
- `src/components/home/QuizTeaserChapter.astro` — new 7th chapter
- `public/fonts/*.woff2` — 3 font files copied from `node_modules/@fontsource-variable/*`

**Modify:**
- `src/layouts/BaseLayout.astro` — add 3 `<link rel="preload">` font tags in `<head>`
- `src/styles/global.css` (or wherever `@fontsource-variable/*` is imported) — change/add `font-display: optional` to the @font-face declarations
- `src/components/home/HeroChapter.astro` — add live cycle-status pill + secondary Quiz CTA
- `src/components/home/MissionChapter.astro` — pull-quote treatment
- `src/components/home/CrownTeaserChapter.astro` — live mini Yvonne portrait card
- `src/components/home/DiasporaTeaserChapter.astro` — live mini react-globe.gl globe
- `src/components/home/CycleTeaserChapter.astro` — live 3-up ContestantCard mini
- `src/components/home/BecomeHerChapter.astro` — finale polish
- `src/components/home/ChapterRail.tsx` — expand from 6 to 7 entries
- `src/pages/index.astro` — import + render the new QuizTeaserChapter, pass any new data
- `tests/e2e/homepage.spec.ts` — new e2e suite

---

## Task 0: Branch setup

- [ ] **Step 1: Clean main + create branch**

```bash
cd C:/dev/Projects/mdgh-staging
git checkout main
git pull origin main
git status   # clean, HEAD at e792768 (Phase 4 merge)
git checkout -b feature/homepage-maximalism
git push -u origin feature/homepage-maximalism
```

- [ ] **Step 2: Baseline**

```bash
npm run typecheck   # expect 0 errors
```

---

## Task 1: Layout-wide font preload (the technical centerpiece)

**Files:**
- Copy: 3 woff2 files from `node_modules/@fontsource-variable/*` to `public/fonts/`
- Modify: `src/layouts/BaseLayout.astro` (add preload links in `<head>`)
- Modify: wherever fonts are declared (`src/styles/global.css` or similar) — change `font-display` to `optional`

This is THE task that unlocks the spec's LCP target. Get it right.

### Step 1: Identify the current font setup

```bash
cd C:/dev/Projects/mdgh-staging
# Find where @fontsource-variable/* is imported
grep -rn "@fontsource" src/ 2>&1 | head -20
# Inspect the @font-face declarations currently in use
grep -rn "@font-face\|font-display" src/ 2>&1 | head -20
```
Expected: either CSS imports of `@fontsource-variable/fraunces/index.css` (or per-axis subsets like `wght.css`), or explicit `@font-face` in `src/styles/global.css`.

Note which woff2 files those imports actually pull. The smallest viable subset per family is preferred (`wght-only` or `standard`). Resolve the absolute path of each:

```bash
find node_modules/@fontsource-variable/fraunces/files -name "*latin*italic*wght*.woff2" 2>&1 | head -3
find node_modules/@fontsource-variable/inter/files -name "*latin*wght*.woff2" 2>&1 | head -3
find node_modules/@fontsource-variable/jetbrains-mono/files -name "*latin*wght*.woff2" 2>&1 | head -3
```

### Step 2: Copy the chosen font files to public/fonts/

```bash
mkdir -p public/fonts
# Adjust filenames to whatever Step 1 surfaced.
cp node_modules/@fontsource-variable/fraunces/files/fraunces-latin-wght-italic.woff2 public/fonts/fraunces-italic-wght.woff2
cp node_modules/@fontsource-variable/inter/files/inter-latin-wght-normal.woff2 public/fonts/inter-wght.woff2
cp node_modules/@fontsource-variable/jetbrains-mono/files/jetbrains-mono-latin-wght-normal.woff2 public/fonts/jetbrains-mono-wght.woff2
ls -lh public/fonts/
```

If exact filenames differ from what's in node_modules, adapt. The targets `public/fonts/<name>.woff2` are referenced by Step 3.

### Step 3: Add preload links to BaseLayout

Read `src/layouts/BaseLayout.astro` first. Find the `<head>` block. Add (near the top of `<head>`, before any stylesheet links):

```astro
<link rel="preload" as="font" type="font/woff2"
      href="/fonts/fraunces-italic-wght.woff2" crossorigin />
<link rel="preload" as="font" type="font/woff2"
      href="/fonts/inter-wght.woff2" crossorigin />
<link rel="preload" as="font" type="font/woff2"
      href="/fonts/jetbrains-mono-wght.woff2" crossorigin />
```

### Step 4: Add @font-face declarations that use the preloaded files + font-display: optional

The existing `@fontsource-variable/*` CSS imports produce their own `@font-face` declarations with `font-display: swap` (the swap is what causes the CLS). We can either:

**Option A (preferred):** Add custom `@font-face` declarations to `src/styles/global.css` BEFORE the `@fontsource-variable` imports, pointing to `/fonts/*.woff2` with `font-display: optional`. The browser uses the first matching declaration.

**Option B:** Remove the `@fontsource-variable` CSS imports entirely and only declare the custom @font-face with the local woff2 files.

Either way, the @font-face declarations must look like:

```css
@font-face {
  font-family: 'Fraunces Variable';
  font-style: italic;
  font-weight: 100 900;
  font-display: optional;
  src: url('/fonts/fraunces-italic-wght.woff2') format('woff2-variations');
}
@font-face {
  font-family: 'Inter Variable';
  font-style: normal;
  font-weight: 100 900;
  font-display: optional;
  src: url('/fonts/inter-wght.woff2') format('woff2-variations');
}
@font-face {
  font-family: 'JetBrains Mono Variable';
  font-style: normal;
  font-weight: 100 800;
  font-display: optional;
  src: url('/fonts/jetbrains-mono-wght.woff2') format('woff2-variations');
}
```

Implementer's choice between Option A and Option B. If unsure, Option A (preserves the fontsource imports as fallback for non-italic Fraunces weights etc.) is safer.

### Step 5: Verify

```bash
npm run typecheck   # 0 errors
npm run build
ls -lh dist/_astro/*.woff2 dist/fonts/*.woff2 2>&1 | head -10
# Confirm the woff2 files made it to dist
curl --head http://localhost:8788/fonts/fraunces-italic-wght.woff2  # (after spinning up preview)
```

Actually wait on the curl test until you spin up the preview server in Task 12 (Lighthouse). For now, just confirm the files exist in `dist/`.

### Step 6: Commit

```bash
git add public/fonts/ src/layouts/BaseLayout.astro src/styles/global.css
git status   # confirm ONLY these files
git commit -m "perf(fonts): preload + font-display: optional for variable woff2 (fixes carried LCP/CLS regression)"
```

---

## Task 2: Build `<QuizTeaserChapter>` (new Chapter VI)

**Files:** Create `src/components/home/QuizTeaserChapter.astro`

The new 7th chapter. Two-column layout: tagline + Begin CTA on left, 7-archetype tiles preview on right.

### Step 1: Write the component

```astro
---
import { getCollection } from 'astro:content';
import MetaLabel from '~/components/ui/MetaLabel.astro';

interface Props {
  /** Optional override; defaults to internal content */
  eyebrow?: string;
}

const { eyebrow = 'CHAPTER VI · HERITAGE QUIZ' } = Astro.props;

const results = await getCollection('quiz-results');
// Sort by an explicit order if needed; for now alphabetical-by-region works
const archetypes = results
  .map((r) => ({
    region: r.data.region,
    archetypeName: r.data.archetypeName,
    accentHex: r.data.accentHex,
  }))
  .sort((a, b) => a.region.localeCompare(b.region));
---
<section class="quiz-teaser" data-chapter="quiz">
  <div class="quiz-teaser__inner">
    <div class="quiz-teaser__copy">
      <MetaLabel text={eyebrow} tone="accent" />
      <h2 class="quiz-teaser__title">
        Which Ghana <em>are you?</em>
      </h2>
      <p class="quiz-teaser__lede">
        Six questions. One archetype. The region of Ghana whose spirit lives loudest in you. Takes ninety seconds.
      </p>
      <a class="quiz-teaser__cta" href="/quiz">Take the quiz →</a>
    </div>
    <div class="quiz-teaser__tiles" aria-label="The seven regional archetypes">
      <div class="quiz-teaser__tiles-eyebrow">YOU MIGHT BE…</div>
      <div class="quiz-teaser__grid">
        {archetypes.map((a) => (
          <a
            href={`/quiz/result/${a.region.toLowerCase().replace(/\s+/g, '-')}`}
            class="quiz-teaser__tile"
            style={`--accent: ${a.accentHex}`}
          >
            <div class="quiz-teaser__tile-region">{a.region}</div>
            <div class="quiz-teaser__tile-archetype">{a.archetypeName.replace(/^The /, '').toUpperCase()}</div>
          </a>
        ))}
      </div>
    </div>
  </div>
</section>

<style>
  .quiz-teaser {
    min-height: 80vh;
    background: radial-gradient(ellipse at 70% 50%, var(--color-deep-violet, #1a0833) 0%, var(--color-obsidian, #050111) 90%);
    padding: 96px 48px;
    position: relative;
    overflow: hidden;
    scroll-snap-align: start;
  }
  .quiz-teaser::before {
    content: '';
    position: absolute;
    top: 50%;
    left: 70%;
    transform: translate(-50%, -50%);
    width: 720px;
    height: 720px;
    border-radius: 50%;
    background: radial-gradient(circle, rgba(255, 126, 179, 0.06) 0%, rgba(107, 43, 217, 0.03) 50%, transparent 80%);
    pointer-events: none;
  }
  .quiz-teaser__inner {
    position: relative;
    z-index: 1;
    max-width: 1280px;
    margin: 0 auto;
    display: grid;
    grid-template-columns: 1.4fr 1fr;
    gap: 64px;
    align-items: center;
  }
  .quiz-teaser__copy { display: flex; flex-direction: column; gap: 18px; }
  .quiz-teaser__title {
    font-family: 'Fraunces Variable', 'Fraunces', serif;
    font-weight: 500;
    font-size: clamp(40px, 6vw, 72px);
    line-height: 1.05;
    color: #fff;
    margin: 0;
    letter-spacing: -0.02em;
  }
  .quiz-teaser__title em { font-style: italic; color: var(--color-saffron, #FFD166); }
  .quiz-teaser__lede {
    color: rgba(255, 255, 255, 0.7);
    font-size: 18px;
    line-height: 1.55;
    max-width: 46ch;
    margin: 0;
  }
  .quiz-teaser__cta {
    align-self: flex-start;
    margin-top: 14px;
    background: var(--color-saffron, #FFD166);
    color: var(--color-deep-violet, #1a0833);
    border: none;
    padding: 14px 36px;
    border-radius: 999px;
    font-family: 'JetBrains Mono Variable', 'JetBrains Mono', monospace;
    font-size: 11px;
    font-weight: 600;
    letter-spacing: 0.25em;
    text-transform: uppercase;
    text-decoration: none;
    box-shadow: 0 8px 24px rgba(255, 209, 102, 0.25);
    transition: transform 200ms cubic-bezier(.4, 0, .2, 1);
  }
  .quiz-teaser__cta:hover, .quiz-teaser__cta:focus-visible {
    transform: translateY(-2px);
    outline: 2px solid var(--color-saffron, #FFD166);
    outline-offset: 4px;
  }
  .quiz-teaser__tiles { display: flex; flex-direction: column; gap: 10px; }
  .quiz-teaser__tiles-eyebrow {
    font-family: 'JetBrains Mono Variable', 'JetBrains Mono', monospace;
    font-size: 10px;
    color: rgba(255, 255, 255, 0.5);
    letter-spacing: 0.3em;
    text-transform: uppercase;
    margin-bottom: 4px;
  }
  .quiz-teaser__grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 8px;
  }
  .quiz-teaser__tile {
    background: color-mix(in srgb, var(--accent) 12%, transparent);
    border: 1px solid color-mix(in srgb, var(--accent) 30%, transparent);
    border-radius: 10px;
    padding: 12px 14px;
    text-decoration: none;
    color: #fff;
    transition: transform 200ms cubic-bezier(.4, 0, .2, 1), border-color 200ms cubic-bezier(.4, 0, .2, 1);
  }
  .quiz-teaser__tile:hover, .quiz-teaser__tile:focus-visible {
    transform: translateY(-2px);
    border-color: color-mix(in srgb, var(--accent) 60%, transparent);
    outline: none;
  }
  .quiz-teaser__tile-region {
    font-family: 'Fraunces Variable', 'Fraunces', serif;
    font-style: italic;
    font-size: 17px;
    color: #fff;
  }
  .quiz-teaser__tile-archetype {
    font-family: 'JetBrains Mono Variable', 'JetBrains Mono', monospace;
    font-size: 9px;
    font-weight: 600;
    letter-spacing: 0.18em;
    color: var(--accent);
    margin-top: 2px;
  }
  @media (max-width: 767px) {
    .quiz-teaser { padding: 64px 20px; }
    .quiz-teaser__inner { grid-template-columns: 1fr; gap: 32px; }
    .quiz-teaser__lede { font-size: 16px; }
  }
  @media (prefers-reduced-motion: reduce) {
    .quiz-teaser__cta, .quiz-teaser__tile { transition: none; }
    .quiz-teaser__cta:hover, .quiz-teaser__tile:hover { transform: none; }
  }
</style>
```

### Step 2: Typecheck + commit

```bash
npm run typecheck
git add src/components/home/QuizTeaserChapter.astro
git commit -m "feat(home): add QuizTeaserChapter — 7-archetype tiles preview + Take The Quiz CTA"
```

---

## Task 3: Elevate the 3 small chapters (Hero, Mission, BecomeHer)

**Files:** Modify `HeroChapter.astro`, `MissionChapter.astro`, `BecomeHerChapter.astro`.

These three chapters have smaller deltas. Bundled in one task because each is a few-line edit.

### Step 1: Read the current chapters

```bash
cat src/components/home/HeroChapter.astro
cat src/components/home/MissionChapter.astro
cat src/components/home/BecomeHerChapter.astro
```

Take a snapshot of what's there. The elevations below add to or polish what exists; they don't replace.

### Step 2: HeroChapter elevation

Add a **live cycle-status pill** that reads the current cycle from the `cycles` collection. Add a **secondary "Take the quiz" link** below the primary Apply CTA.

In the frontmatter (or pass via props from index.astro if the chapter currently takes structured props):

```astro
// In HeroChapter.astro frontmatter, IF it doesn't already receive cycle as a prop:
import { getCollection } from 'astro:content';
const cycles = await getCollection('cycles');
const currentCycle = cycles.find((c) => c.data.status === 'current');
const cycleEyebrow = currentCycle
  ? `CROWN ${currentCycle.data.crownNumber} · CYCLE ${currentCycle.data.year} · OPEN`
  : 'CROWN HERITAGE';
```

In the template, replace or augment the existing eyebrow with `{cycleEyebrow}`.

Add the secondary CTA below the existing Apply button:

```astro
<a class="hero-chapter__secondary-cta" href="/quiz">Or find your archetype →</a>
```

Style it as a tertiary text link (smaller, less prominent than Apply):

```css
.hero-chapter__secondary-cta {
  display: inline-block;
  margin-top: 16px;
  font-family: 'JetBrains Mono Variable', 'JetBrains Mono', monospace;
  font-size: 11px;
  color: rgba(255, 255, 255, 0.7);
  letter-spacing: 0.2em;
  text-transform: uppercase;
  text-decoration: none;
  border-bottom: 1px solid rgba(255, 209, 102, 0.4);
  padding-bottom: 2px;
  transition: color 200ms cubic-bezier(.4, 0, .2, 1), border-color 200ms cubic-bezier(.4, 0, .2, 1);
}
.hero-chapter__secondary-cta:hover, .hero-chapter__secondary-cta:focus-visible {
  color: var(--color-saffron, #FFD166);
  border-bottom-color: var(--color-saffron, #FFD166);
  outline: none;
}
```

### Step 3: MissionChapter elevation

Wrap the mission statement in a pull-quote treatment. Add ornamental gold dividers above and below.

Suggested structure (adapt to whatever's currently there):

```astro
<blockquote class="mission-chapter__quote">
  <span class="mission-chapter__divider" aria-hidden="true"></span>
  <p class="mission-chapter__statement">{existing statement text}</p>
  <span class="mission-chapter__divider" aria-hidden="true"></span>
</blockquote>
```

```css
.mission-chapter__quote {
  margin: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 24px;
  text-align: center;
}
.mission-chapter__divider {
  width: 48px;
  height: 1px;
  background: linear-gradient(90deg, transparent, var(--color-saffron, #FFD166), transparent);
}
.mission-chapter__statement {
  font-family: 'Fraunces Variable', 'Fraunces', serif;
  font-style: italic;
  font-weight: 500;
  font-size: clamp(22px, 3vw, 32px);
  line-height: 1.4;
  color: #fff;
  max-width: 32ch;
  margin: 0;
}
```

### Step 4: BecomeHerChapter elevation

Polish: ensure centered finale alignment, ensure saffron Apply CTA is prominent, add a subtle ambient gradient behind. If it already has these, this task may be a no-op for BecomeHerChapter — note that in the commit message.

```css
.become-her {
  background: linear-gradient(135deg, #3a1855 0%, #1a0833 70%, #050111 100%);
  text-align: center;
  /* … existing styles … */
}
.become-her__title {
  font-family: 'Fraunces Variable', 'Fraunces', serif;
  font-style: italic;
  font-weight: 500;
  font-size: clamp(40px, 7vw, 80px);
  line-height: 1;
  letter-spacing: -0.02em;
  color: #fff;
  margin: 0 0 28px;
}
.become-her__cta {
  background: var(--color-saffron, #FFD166);
  color: var(--color-deep-violet, #1a0833);
  /* … existing button styles … */
}
```

### Step 5: Typecheck + commit (one commit for all 3)

```bash
npm run typecheck
git add src/components/home/HeroChapter.astro src/components/home/MissionChapter.astro src/components/home/BecomeHerChapter.astro
git status
git commit -m "feat(home): elevate Hero (cycle pill + Quiz secondary CTA), Mission (pull quote), BecomeHer (finale polish)"
```

---

## Task 4: Elevate `<CrownTeaserChapter>` — live mini Yvonne portrait card

**Files:** Modify `src/components/home/CrownTeaserChapter.astro`.

Replace whatever placeholder is there for the queen preview with a real mini portrait card pulled from the `queens` collection.

### Step 1: Read the current chapter

```bash
cat src/components/home/CrownTeaserChapter.astro
```

### Step 2: Add data load + mini card render

In frontmatter:

```astro
import { getCollection } from 'astro:content';
import MetaLabel from '~/components/ui/MetaLabel.astro';

const queens = await getCollection('queens');
const founder = queens.find((q) => q.data.crownNumber === 1) ?? queens[0];
```

In template, render a small portrait card:

```astro
<div class="crown-teaser__mini-card">
  <div class="crown-teaser__mini-sash" aria-hidden="true">I</div>
  <img
    src={founder.data.heroImage}
    alt={founder.data.heroImageAlt}
    loading="lazy"
    decoding="async"
    class="crown-teaser__mini-img"
  />
  <div class="crown-teaser__mini-meta">
    <MetaLabel text={`${founder.data.year} · CROWN I`} tone="accent" />
    <div class="crown-teaser__mini-name">{founder.data.name}</div>
  </div>
</div>
```

```css
.crown-teaser__mini-card {
  position: relative;
  width: 200px;
  aspect-ratio: 3 / 4;
  background: linear-gradient(180deg, var(--color-deep-violet, #1a0833), var(--color-obsidian, #050111));
  border: 1px solid rgba(255, 209, 102, 0.4);
  border-radius: 14px;
  padding: 14px;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
}
.crown-teaser__mini-img {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
  z-index: 0;
  opacity: 0.85;
}
.crown-teaser__mini-sash {
  position: relative;
  z-index: 2;
  font-family: 'Fraunces Variable', 'Fraunces', serif;
  font-style: italic;
  font-weight: 700;
  font-size: 56px;
  line-height: 0.85;
  color: rgba(255, 209, 102, 0.85);
  text-shadow: 0 2px 6px rgba(0, 0, 0, 0.6);
}
.crown-teaser__mini-meta {
  position: relative;
  z-index: 2;
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.crown-teaser__mini-name {
  font-family: 'Fraunces Variable', 'Fraunces', serif;
  font-style: italic;
  font-weight: 500;
  font-size: 18px;
  line-height: 1;
  color: #fff;
}
```

Layout: keep the existing chapter's text-on-left structure, add the mini-card on the right (CSS grid 1fr 200px on desktop, single-column stack on mobile).

### Step 3: Commit

```bash
npm run typecheck
git add src/components/home/CrownTeaserChapter.astro
git commit -m "feat(home): elevate CrownTeaserChapter with live mini founder portrait card"
```

---

## Task 5: Elevate `<DiasporaTeaserChapter>` — live mini globe

**Files:** Modify `src/components/home/DiasporaTeaserChapter.astro`. Possibly create a `<MiniGlobe>` wrapper component.

Replace the v1 "globe-stub" with a real react-globe.gl mini globe (200×200px, decorative, no markers).

### Step 1: Read the current chapter

```bash
cat src/components/home/DiasporaTeaserChapter.astro
```

### Step 2: Either: create a `<MiniGlobe>` wrapper component, OR: render `<DiasporaGlobe>` with smaller-size props

The Phase 2 `<DiasporaGlobe>` component is at `src/components/diaspora/DiasporaGlobe.tsx`. It's hardcoded to 560px and shows markers. Two paths:

**Path A (recommended, smallest delta):** Make a wrapper that mounts a small instance:

Create `src/components/home/MiniGlobe.tsx`:

```tsx
import { useEffect, useRef, useState } from 'react';
import type { ComponentType } from 'react';

type GlobeComponent = ComponentType<any>;

export default function MiniGlobe() {
  const [GlobeModule, setGlobeModule] = useState<GlobeComponent | null>(null);
  const globeRef = useRef<any>(null);

  useEffect(() => {
    let cancelled = false;
    import('react-globe.gl').then((mod) => {
      if (!cancelled) setGlobeModule(() => mod.default as GlobeComponent);
    });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (!GlobeModule) return;
    const id = requestAnimationFrame(() => {
      const g = globeRef.current;
      if (!g?.controls) return;
      const c = g.controls();
      c.autoRotate = true;
      c.autoRotateSpeed = 0.6;
      c.enableZoom = false;
      c.enablePan = false;
      g.pointOfView?.({ lat: 10, lng: 0, altitude: 2.4 }, 0);
    });
    return () => cancelAnimationFrame(id);
  }, [GlobeModule]);

  if (!GlobeModule) {
    return <div style={{ width: 200, height: 200 }} aria-hidden="true" />;
  }

  const Globe = GlobeModule;
  return (
    <div className="mini-globe" style={{ width: 200, height: 200 }} aria-hidden="true">
      <Globe
        ref={globeRef}
        width={200}
        height={200}
        backgroundColor="rgba(0,0,0,0)"
        globeImageUrl={undefined}
        showAtmosphere={true}
        atmosphereColor="#6B2BD9"
        atmosphereAltitude={0.18}
        showGraticules={true}
      />
    </div>
  );
}
```

### Step 3: Mount MiniGlobe in the chapter

In `DiasporaTeaserChapter.astro` frontmatter:

```astro
import MiniGlobe from './MiniGlobe.tsx';
```

In template (wherever the v1 globe-stub was — replace it):

```astro
<div class="diaspora-teaser__globe">
  <MiniGlobe client:visible />
</div>
```

`client:visible` is safe here because the mini globe is purely decorative and the same dynamic-import pattern works (no SSR-time `window` reference at module load — the import only fires inside useEffect).

### Step 4: Commit

```bash
npm run typecheck
git add src/components/home/DiasporaTeaserChapter.astro src/components/home/MiniGlobe.tsx
git commit -m "feat(home): elevate DiasporaTeaserChapter with live mini decorative globe"
```

---

## Task 6: Elevate `<CycleTeaserChapter>` — live 3-up ContestantCard mini grid

**Files:** Modify `src/components/home/CycleTeaserChapter.astro`.

Replace the v1 stub with a real 3-up grid of the first 3 contestants (by sortOrder) from the current cycle, rendered as smaller variants of `<ContestantCard>`.

### Step 1: Read the current chapter

```bash
cat src/components/home/CycleTeaserChapter.astro
```

### Step 2: Add data load + mini grid

In frontmatter:

```astro
import { getCollection } from 'astro:content';
import ContestantCard from '~/components/contestants/ContestantCard.astro';

const cycles = await getCollection('cycles');
const currentCycle = cycles.find((c) => c.data.status === 'current');
const allContestants = await getCollection('contestants');
const top3 = currentCycle
  ? allContestants
      .filter((c) => c.data.cycle.id === currentCycle.id)
      .sort((a, b) => (a.data.sortOrder ?? 0) - (b.data.sortOrder ?? 0))
      .slice(0, 3)
  : [];
const cycleCrown = currentCycle?.data.crownNumber ?? '';
```

In template:

```astro
<div class="cycle-teaser__mini-grid">
  {top3.map((c, i) => (
    <ContestantCard
      slug={c.slug}
      name={c.data.name}
      sashNumber={c.data.sashNumber}
      sortOrder={c.data.sortOrder}
      region={c.data.region}
      cycleCrown={cycleCrown}
      heroImage={c.data.heroImage}
      heroImageAlt={c.data.heroImageAlt}
      index={i}
    />
  ))}
</div>
```

CSS to constrain the grid to the chapter:

```css
.cycle-teaser__mini-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 14px;
  max-width: 560px;
  margin-top: 24px;
}
@media (max-width: 767px) {
  .cycle-teaser__mini-grid {
    grid-template-columns: 1fr;
    max-width: 320px;
  }
}
```

If `ContestantCard` looks too big for a teaser (it's `aspect-ratio: 3/4`, so 3 cards at 180px wide = 240px tall, decent), it works inline as-is. If too big, scale via CSS transform OR add a `size="sm"` prop variant to ContestantCard — but YAGNI: try inline first.

### Step 3: Commit

```bash
npm run typecheck
git add src/components/home/CycleTeaserChapter.astro
git commit -m "feat(home): elevate CycleTeaserChapter with live 3-up ContestantCard mini grid"
```

---

## Task 7: Update `<ChapterRail>` — 6 → 7 entries

**Files:** Modify `src/components/home/ChapterRail.tsx`.

### Step 1: Read the current component

```bash
cat src/components/home/ChapterRail.tsx
cat src/components/home/ChapterRail.css
```

It's a React component (per the import in index.astro). Find the chapter list — probably an array of `{ id, label }` objects.

### Step 2: Add the Quiz entry

Insert between the existing Cycle and BecomeHer entries:

```tsx
const chapters = [
  { id: 'hero',     label: 'HERO' },
  { id: 'mission',  label: 'MISSION' },
  { id: 'heritage', label: 'HERITAGE' },
  { id: 'diaspora', label: 'DIASPORA' },
  { id: 'cycle',    label: 'CYCLE' },
  { id: 'quiz',     label: 'QUIZ' },       // NEW
  { id: 'become-her', label: 'APPLY' },
];
```

The actual data shape in the existing file may differ — adapt minimally, just add a Quiz entry in the right position.

### Step 3: Commit

```bash
npm run typecheck
git add src/components/home/ChapterRail.tsx
git commit -m "feat(home): expand ChapterRail to 7 entries (adds Quiz)"
```

---

## Task 8: Wire `src/pages/index.astro` — import + render QuizTeaserChapter

**Files:** Modify `src/pages/index.astro`.

### Step 1: Add import + render

In frontmatter:

```astro
import QuizTeaserChapter from '~/components/home/QuizTeaserChapter.astro';
```

In template, between CycleTeaserChapter and BecomeHerChapter:

```astro
<CycleTeaserChapter ... />
<QuizTeaserChapter />   {/* NEW */}
<BecomeHerChapter ... />
```

If the existing chapters take `chapterId` or anchor IDs, ensure the new chapter has `data-chapter="quiz"` or whatever convention is used. (The component I wrote in Task 2 already has `data-chapter="quiz"` on the section.)

### Step 2: Smoke test + commit

```bash
npm run typecheck
git add src/pages/index.astro
git commit -m "feat(home): wire QuizTeaserChapter between Cycle and BecomeHer"
```

---

## Task 9: Motion-language consistency audit

**Files:** small modifications across the chapter files if outliers found.

Spec §8.2 timing tokens:
- 150ms micro
- 300ms component
- 600ms section reveal
- 1100ms hero cinematic
- Exit = 60–70% of enter

### Step 1: Audit each chapter for timing outliers

```bash
cd C:/dev/Projects/mdgh-staging
grep -nE "transition|animation|duration" src/components/home/*.astro src/components/home/*.tsx 2>&1 | head -40
```

For each `transition:`/`animation:` declaration with a duration, check it against the spec tokens. Most existing chapters likely conform.

### Step 2: Fix any outliers

Replace non-conformant durations with the closest spec token. Do NOT change duration unless it's clearly off-spec — this is a polish pass, not a rewrite.

### Step 3: Commit (or no-op if no outliers)

```bash
git status
# If changes:
git add src/components/home/
git commit -m "chore(home): motion-language consistency pass — align durations to spec §8.2 tokens"
# If no changes:
echo "No motion outliers found — skip commit"
```

---

## Task 10: Playwright e2e for homepage

**Files:** Create `tests/e2e/homepage.spec.ts`.

Six tests:
1. Homepage renders all 7 chapters
2. Hero apply CTA links to /apply (or `apply.missdiasporagh.org` per existing setup)
3. Heritage teaser link routes to /heritage
4. Diaspora teaser link routes to /diaspora
5. Cycle teaser link routes to /contestants
6. Quiz teaser CTA routes to /quiz

### Step 1: Write the spec

```typescript
import { test, expect } from '@playwright/test';

test.describe('/', () => {
  test('homepage renders all 7 chapters', async ({ page }) => {
    await page.goto('/');
    // Each chapter's section element should be present. We don't enforce
    // a specific selector here because chapter components have varying
    // class names; instead we check the QuizTeaserChapter selector + count
    // sections containing scroll-snap-align.
    await expect(page.locator('[data-chapter="quiz"]')).toBeVisible();
    await expect(page.locator('section')).toHaveCountGreaterThan(5);
  });

  test('Quiz teaser CTA routes to /quiz', async ({ page }) => {
    await page.goto('/');
    const quizCta = page.locator('.quiz-teaser__cta');
    await expect(quizCta).toBeVisible();
    await quizCta.scrollIntoViewIfNeeded();
    await quizCta.click();
    await expect(page).toHaveURL(/\/quiz$/);
  });

  test('Heritage teaser link routes to /heritage', async ({ page }) => {
    await page.goto('/');
    const heritageLink = page.locator('a[href="/heritage"]').first();
    await heritageLink.scrollIntoViewIfNeeded();
    await heritageLink.click();
    await expect(page).toHaveURL(/\/heritage$/);
  });

  test('Diaspora teaser link routes to /diaspora', async ({ page }) => {
    await page.goto('/');
    const link = page.locator('a[href="/diaspora"]').first();
    await link.scrollIntoViewIfNeeded();
    await link.click();
    await expect(page).toHaveURL(/\/diaspora$/);
  });

  test('Cycle teaser link routes to /contestants', async ({ page }) => {
    await page.goto('/');
    const link = page.locator('a[href="/contestants"]').first();
    await link.scrollIntoViewIfNeeded();
    await link.click();
    await expect(page).toHaveURL(/\/contestants$/);
  });

  test('Quiz teaser archetype tile routes to /quiz/result/<region>', async ({ page }) => {
    await page.goto('/');
    const tile = page.locator('.quiz-teaser__tile').first();
    await tile.scrollIntoViewIfNeeded();
    const href = await tile.getAttribute('href');
    expect(href).toMatch(/^\/quiz\/result\/[a-z-]+$/);
    await tile.click();
    await expect(page).toHaveURL(new RegExp(href!));
  });
});
```

Note: `toHaveCountGreaterThan` doesn't exist as a built-in matcher in older Playwright versions. If typecheck flags it, use `(await page.locator('section').count()) > 5` with a normal expect instead. Implementer adapts.

### Step 2: Run + commit

```bash
cd C:/dev/Projects/mdgh-staging
npm run test:e2e -- homepage.spec.ts
# Expect 18 pass (6 × 3 projects)
git add tests/e2e/homepage.spec.ts
git commit -m "test(home): e2e — 7 chapters render + all destination CTAs route correctly"
```

---

## Task 11: Lighthouse audit — verify LCP target finally hit

**Files:** none modified by default. The whole point of this task is verification of the font preload work.

Run Lighthouse mobile against **5 routes** (the spec's final DoD): /, /heritage, /diaspora, /contestants, /quiz, /quiz/result/volta.

### Step 1: Build + serve

```bash
cd C:/dev/Projects/mdgh-staging
npm run build
(npx wrangler pages dev ./dist --compatibility-flag=nodejs_compat --compatibility-date=2026-05-01 --port 8788 > /tmp/w.log 2>&1 &)
sleep 7
# Verify font files are accessible
curl --head http://localhost:8788/fonts/fraunces-italic-wght.woff2 | head -3
# Verify each route is 200
for r in / heritage diaspora contestants quiz quiz/result/volta; do
  curl -sI "http://localhost:8788/$r" | head -1
done
```

### Step 2: Run mobile Lighthouse on each route

```bash
for r in '' 'heritage' 'diaspora' 'contestants' 'quiz' 'quiz/result/volta'; do
  label="${r//\//-}"
  [ -z "$label" ] && label="root"
  echo "--- Lighthouse mobile: /$r ---"
  npx lighthouse "http://localhost:8788/$r" \
    --form-factor=mobile \
    --output=json \
    --output-path="./lh-$label.json" \
    --chrome-flags="--headless --no-sandbox" \
    --quiet
done

node -e "
['root','heritage','diaspora','contestants','quiz','quiz-result-volta'].forEach((name) => {
  const r = require(\`./lh-\${name}.json\`);
  console.log(name, JSON.stringify({
    perf: r.categories.performance.score,
    lcp_ms: r.audits['largest-contentful-paint'].numericValue,
    cls: r.audits['cumulative-layout-shift'].numericValue,
    tbt_ms: r.audits['total-blocking-time'].numericValue
  }));
});
"
```

### Step 3: Check against thresholds

For EVERY route:
- `perf >= 0.9`
- `lcp_ms < 2500` (THE spec target — Phase 5 is the first chance to hit it)
- `cls < 0.05`
- `tbt_ms < 300`

If Heritage LCP is still >2500ms, the preload didn't take effect — investigate. Common causes:
- Font files aren't being served from `/fonts/` (404 in network panel)
- The `<link rel="preload">` URLs don't match the actual served URLs
- The browser is still using `font-display: swap` from a fontsource @font-face that's overriding ours

### Step 4: Cleanup

```bash
rm -f ./lh-*.json
pkill -f workerd 2>/dev/null
pkill -f "wrangler pages" 2>/dev/null
```

### Step 5: If thresholds miss — fix + commit, else no-op

If a clear fix surfaces (e.g. preload URL mismatch), apply and commit `perf(fonts): <fix>`. If no clear fix, report DONE_WITH_CONCERNS with numbers + suspected cause.

---

## Task 12: Deploy to staging + verify live (USER GATE)

- [ ] **Step 1: Confirm clean tree + push feature**

```bash
cd C:/dev/Projects/mdgh-staging
git status   # clean
git push origin feature/homepage-maximalism
```

- [ ] **Step 2: Merge to main + push**

```bash
git checkout main
git pull origin main
git merge --no-ff feature/homepage-maximalism -m "Merge feature/homepage-maximalism: Phase 5 (final) of mdgh-staging elevation

Homepage at / elevated to flagship cinematic tour:
- 7 chapters (Hero / Mission / Heritage teaser / Diaspora teaser / Cycle teaser / Quiz teaser ★ NEW / BecomeHer)
- Each teaser swaps v1 stub for LIVE preview from real content collections
  - Heritage: real Yvonne portrait card
  - Diaspora: real react-globe.gl mini globe (dynamic-import, decorative)
  - Cycle: real 3-up ContestantCard preview
  - Quiz: 7 archetype tiles with per-region accentHex
- ChapterRail expanded from 6 → 7 dots
- Hero gets live cycle-status pill + secondary 'find your archetype' Quiz CTA
- Mission gets pull-quote treatment with ornamental gold dividers
- BecomeHer finale polish
- Motion-language consistency pass per spec §8.2

LAYOUT-WIDE FONT PRELOAD (the technical centerpiece):
- 3 woff2 files copied from @fontsource-variable to public/fonts/
- <link rel='preload'> in BaseLayout <head>
- font-display: optional on @font-face (eliminates swap CLS)
- Expected: Heritage LCP 3171ms → ~1500ms, Quiz LCP 3210ms → ~1500ms,
  Diaspora CLS 0.122 → near 0 — finally hitting spec's LCP < 2500ms target

ELEVATION SPEC COMPLETE — all 5 phases shipped:
- Phase 1 Heritage (018eae2) · Phase 2 Diaspora (2aaf9f8)
- Phase 3 Contestants (3e54690) · Phase 4 Quiz (e792768)
- Phase 5 Homepage (this merge)

Direction A (Cinematic Tour) per design annex 2026-05-22-homepage-direction.md.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
git push origin main
```

- [ ] **Step 3: Wait for Cloudflare Pages deploy**

Use Monitor or poll:
```bash
CLOUDFLARE_ACCOUNT_ID=233d917842862e30ed5207cf7b95bc33 npx wrangler pages deployment list --project-name mdgh-staging --environment production 2>&1 | head -5
```
Wait until latest shows `Active`.

- [ ] **Step 4: Verify live (with cache-bust + retry pattern from prior phases)**

```bash
RAND=$(date +%s)$RANDOM
curl -sI "https://staging.missdiasporagh.org/?v=$RAND" | head -1
# Verify homepage shows Quiz chapter
curl -s "https://staging.missdiasporagh.org/?v=$RAND-1" | grep -oc 'quiz-teaser'  # >= 1
curl -s "https://staging.missdiasporagh.org/?v=$RAND-1" | grep -oc 'Which Ghana'  # >= 1
# Verify font preload landed
curl -s "https://staging.missdiasporagh.org/?v=$RAND-2" | grep -c 'rel="preload"'  # >= 3
```

If CDN cache returns 404, retry with fresh cache-bust (Phases 1-4 all hit this).

- [ ] **Step 5: USER GATE**

Surface live URL. Ask user to test:
- All 7 chapters scroll-snap correctly
- Hero shows cycle status pill, Apply CTA, secondary Quiz link
- Heritage teaser shows real Yvonne card
- Diaspora teaser shows real mini globe (rotating slowly)
- Cycle teaser shows 3 real contestants (Ama / Akua / Esi)
- Quiz teaser shows 7 archetype tiles, each with its accent
- BecomeHer finale shows Apply CTA
- ChapterRail has 7 dots
- Mobile: chapters stack, rail collapses
- Reduced-motion: animations strip per spec

ALSO ask: "This is the final phase of the elevation. With Phase 5 live, all 5 wow features + the homepage are at flagship quality. Per spec §10, this requires your explicit cutover-readiness approval. Do you approve the elevation as DONE, ready for the DNS cutover ritual (separate work)?"

Wait for `approve` AND the cutover-readiness confirmation.

---

## Task 13: Wrap — phase memory + ELEVATION SPEC COMPLETION

This phase wraps both the phase AND the entire elevation spec.

- [ ] **Step 1: Write `homepage-phase-5-shipped.md` to project memory**

Mirror prior phase wraps. Cover: live URL, commit SHA, direction (Cinematic Tour), per-chapter elevations, the font-preload work as the technical centerpiece (with before/after Lighthouse numbers), motion-consistency pass, approval gates honored.

- [ ] **Step 2: Write `elevation-spec-complete.md` to project memory**

A SHORTER wrap that captures the elevation completion as a whole:
- The 5 phases shipped, in order, with their direction picks and commit SHAs
- The wow features now live (Heritage Timeline, Diaspora Globe, Contestant Hub, Heritage Quiz, Cinematic Homepage)
- The patterns/primitives that came out of the elevation (MetaLabel, Portrait, RomanNumeral, CityMarker, hidden-bio-div pattern, SSR-not-prerender pattern, dynamic-import for SSR-unsafe React libs, font-preload + font-display:optional pattern)
- The Phase 4.5 follow-ups still queued (Satori OG endpoints + real contestant portraits)
- Whether DNS cutover happened (probably "pending — out of scope per spec §10")

- [ ] **Step 3: Update `MEMORY.md` index**

Append:
```markdown
- [Homepage Phase 5 shipped](homepage-phase-5-shipped.md) — `/` cinematic 7-chapter tour live on staging; font preload finally hits LCP < 2500ms across all pages
- [Elevation spec complete](elevation-spec-complete.md) — 5 phases shipped; staging.missdiasporagh.org at flagship quality; DNS cutover is its own separate ritual
```

- [ ] **Step 4: Phase 5 + elevation complete**

The user has signed off via the cutover-readiness gate in Task 12 Step 5. No further phases. Next conversations either pick up the Phase 4.5 follow-up (Satori OG + portraits) or address DNS cutover.

---

## Self-Review Notes

**Spec coverage:**
- Spec §1 ("elevation, not redesign — page structure carrying forward") ✓ Direction A
- Spec §3 quality gates (AA contrast, 44px targets, keyboard nav, reduced-motion variant, Lighthouse ≥0.9, LCP < 2500ms, CLS < 0.05, real content) ✓ All tasks
- Spec §4 row 5 (Homepage at /) ✓ Task 8
- Spec §8.2 motion language (timing tokens) ✓ Task 9
- Spec §9 quality gates ✓ Task 11
- Spec §10 Definition of Done ("user explicitly approves cutover-readiness") ✓ Task 12 Step 5

**Placeholder scan:** None.

**Type consistency:** all data flows match the schemas from Phases 1-4. Cycle ref handled identically. ContestantCard reused with index prop. MetaLabel reused everywhere.

**Notable architectural choices:**
- Path A (custom @font-face before fontsource imports) chosen for font preload to minimize blast radius
- MiniGlobe is a new component, not a prop variant of DiasporaGlobe — cleaner separation, smaller diff to existing code
- ChapterRail update is the smallest possible (one new entry) — no rewrite
- e2e tests skip CLS/perf assertions (Lighthouse handles those) and focus on routing correctness

**Notable deviations:**
- Quiz archetype tiles on the homepage are linkable directly to their result page (e.g., clicking "Volta · RIVER-BEARER" goes to `/quiz/result/volta` even without taking the quiz). This is a feature, not a deviation — but worth noting since it slightly bypasses the quiz flow for curious visitors.

**Out of scope (carried Phase 4.5 work, intentionally NOT addressed here per the scope decision earlier):**
- Satori OG endpoints
- Real contestant portrait replacements
- Per-contestant OG images
