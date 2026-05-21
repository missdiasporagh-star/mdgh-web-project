# Diaspora Globe Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship Phase 2 of the staging elevation — the `/diaspora` Celestial Atlas globe — to `staging.missdiasporagh.org` at flagship quality, with full reduced-motion + mobile fallback.

**Architecture:** Astro 5 SSR (Cloudflare Pages) page route at `/diaspora` with three rendering paths: (1) **3D globe React island** via `react-globe.gl` (lazy-loaded with `client:visible`) on desktop with `prefers-reduced-motion: no-preference`; (2) **static SVG world map fallback** for mobile (<768px) and reduced-motion users — Three.js never loads; (3) **city list nav** is the primary affordance on mobile (map decorative). Active-city detail rendered in a bottom drawer (40vh desktop, full-screen mobile) using the Heritage-phase `<MetaLabel>` + `<Portrait>` primitives + the hidden-bio-div pattern.

**Tech Stack:** Astro 5.15, TypeScript 5.6, Tailwind 4, React 19 (for the globe island only), `react-globe.gl` (Three.js wrapper), Fraunces/Inter/JetBrains Mono (existing), Playwright 1.48 e2e, Vitest 2.1.

**Working repo:** `C:/dev/Projects/mdgh-staging` (separate from `mdgh-web-project`). All paths in this plan are relative to that repo unless noted.

**Spec references:**
- `mdgh-web-project/docs/superpowers/specs/2026-05-20-mdgh-staging-elevation-design.md` §7.4 (Diaspora Globe wow feature)
- `mdgh-web-project/docs/superpowers/specs/annexes/2026-05-21-diaspora-direction.md` (Celestial Atlas direction details — globe material, marker spec, drawer spec, content seed list)
- `mdgh-web-project/docs/superpowers/plans/2026-05-20-mdgh-heritage-timeline-implementation.md` (Phase 1 — pattern reference for shared primitives + bio-rendering)

---

## File Structure

**Create:**
- `src/components/ui/CityMarker.astro` — SVG 4-point gold star with `size`, `activity`, `name`, `active` props (shared primitive, reusable beyond Phase 2 if needed)
- `src/components/diaspora/CityDrawer.astro` — bottom drawer detail with focus management + ESC/swipe-down/close-button dismiss + reduced-motion variant
- `src/components/diaspora/DiasporaFallback.astro` — static SVG world map + ordered city list (no JS deps)
- `src/components/diaspora/DiasporaGlobe.tsx` — React island wrapping `react-globe.gl` (TSX, not Astro)
- `src/components/diaspora/DiasporaPage.astro` — orchestrator that renders Fallback by default and conditionally hydrates Globe via `client:visible` on capable clients
- `src/pages/diaspora.astro` — the route; loads cities collection, passes to DiasporaPage, emits hidden bio divs
- `src/content/cities/accra.mdx` — founder-city seed (required)
- `src/content/cities/london.mdx` — secondary
- `src/content/cities/new-york.mdx` — secondary
- `src/content/cities/toronto.mdx` — secondary
- `src/content/cities/atlanta.mdx` — secondary
- `tests/e2e/diaspora.spec.ts` — Playwright e2e (keyboard nav, mobile fallback, reduced-motion, drawer behavior)

**Modify:**
- `package.json` — add `react-globe.gl` + `three` to dependencies
- `src/styles/tokens.css` — add `--color-drawer-surface` + `--color-drawer-border` per annex §"New design tokens needed"

**Test:**
- `tests/e2e/diaspora.spec.ts` — primary verification surface
- Astro build itself enforces content collection schema (build fails on missing required field)

---

## Task 0: Setup feature branch

**Files:** none modified; environment verification.

- [ ] **Step 1: Verify mdgh-staging is on clean main, latest**

Run:
```bash
cd C:/dev/Projects/mdgh-staging
git checkout main
git pull origin main
git status
```
Expected: `nothing to commit, working tree clean`, HEAD at or past commit `018eae2` (the Phase 1 merge commit).

- [ ] **Step 2: Create feature branch**

```bash
git checkout -b feature/diaspora-globe
git push -u origin feature/diaspora-globe
```
Expected: branch created and tracking origin.

- [ ] **Step 3: Baseline typecheck + tests still pass**

```bash
npm run typecheck && npm test
```
Expected: typecheck 0 errors (1 pre-existing `ctaSchema` hint — ignore); unit tests pass.

---

## Task 1: Install react-globe.gl + three

**Files:** `package.json` (modify)

- [ ] **Step 1: Install dependencies**

```bash
cd C:/dev/Projects/mdgh-staging
npm install react-globe.gl three
npm install --save-dev @types/three
```
Expected: packages added; no peer-dep errors. The `three` install pulls in WebGL renderer; `@types/three` provides TypeScript types.

- [ ] **Step 2: Verify the install didn't break baseline**

```bash
npm run typecheck
```
Expected: still 0 errors.

- [ ] **Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "build(deps): add react-globe.gl + three for diaspora globe"
```

---

## Task 2: Add drawer design tokens

**Files:** `src/styles/tokens.css` (modify)

- [ ] **Step 1: Read current tokens.css**

```bash
cat src/styles/tokens.css
```
Note the file structure and the comment style for tokens.

- [ ] **Step 2: Append the new tokens**

Add to the `:root { ... }` block (at the END, before the closing `}`):

```css
  /* Phase 2 (Diaspora) — bottom drawer surface for city detail view */
  --color-drawer-surface-1: rgba(10, 4, 20, 0.95);
  --color-drawer-surface-2: #050111;
  --color-drawer-border: rgba(255, 209, 102, 0.25);
```

(If `tokens.css` is structured differently, adapt — the important thing is the three tokens are defined as CSS custom properties at root scope.)

- [ ] **Step 3: Verify nothing else broke**

```bash
npm run dev &
# wait for ready
curl -sI http://localhost:4321/ | head -3
```
Expected: 200 OK on the homepage. Stop the dev server.

- [ ] **Step 4: Commit**

```bash
git add src/styles/tokens.css
git commit -m "feat(tokens): add Diaspora-phase drawer tokens"
```

---

## Task 3: Seed cities content (5 entries)

**Files:**
- Create: `src/content/cities/accra.mdx`
- Create: `src/content/cities/london.mdx`
- Create: `src/content/cities/new-york.mdx`
- Create: `src/content/cities/toronto.mdx`
- Create: `src/content/cities/atlanta.mdx`

The cities collection schema is already defined in `src/content/config.ts` (look for `const cities = defineCollection...`). Fields: `name`, `country`, `lat`, `lng`, optional `heroImage` / `heroImageAlt`, optional `video`, `relatedQueens` (string[]), `relatedContestants` (string[]).

### Step 1: Verify the cities schema shape

```bash
grep -A 20 "^const cities" src/content/config.ts | head -25
```
Confirm field names. If they differ from this plan's assumption, adapt the YAML frontmatter below.

### Step 2: Create the five MDX files

Write `src/content/cities/accra.mdx`:

```mdx
---
name: "Accra"
country: "Ghana"
lat: 5.5602
lng: -0.1969
relatedQueens:
  - "yvonne-kofigah"
relatedContestants: []
---

The first stage. Where the platform was born — and where the founder still holds the line. Accra is the diaspora's anchor: the spiritual home of every crown that has followed, the city that watched the first cycle run on belief and borrowed lighting. From the workshops in East Legon to the runway nights in Osu, Accra is where MDGH learned what it would become.

Today the GM still works from here — the brand's heritage and its growth both routed through the same office that started it all.
```

Write `src/content/cities/london.mdx`:

```mdx
---
name: "London"
country: "United Kingdom"
lat: 51.5074
lng: -0.1278
relatedQueens: []
relatedContestants: []
---

The largest Ghanaian diaspora community in Europe, and the city most likely to send the next crown. London's daughters carry kente through Camden markets, into law chambers in Holborn, into the open-mic nights in Peckham. Every Crown cycle since the second has had a finalist representing London — the city is more present in our story than its quietness on the map suggests.
```

Write `src/content/cities/new-york.mdx`:

```mdx
---
name: "New York"
country: "United States"
lat: 40.7128
lng: -74.0060
relatedQueens: []
relatedContestants: []
---

If London is the European anchor, New York is the American one. From the Bronx to Bed-Stuy, Ghanaian-American daughters in New York carry a particular kind of dual fluency — the language of African heritage and the language of American ambition, switched between in the same conversation. The platform's first transatlantic finalist came from here.
```

Write `src/content/cities/toronto.mdx`:

```mdx
---
name: "Toronto"
country: "Canada"
lat: 43.6532
lng: -79.3832
relatedQueens: []
relatedContestants: []
---

Toronto's Ghanaian community is younger than London's or New York's, but the energy is no less serious — Scarborough especially has emerged as a hub for second-generation creatives, professionals, and the kind of women who carry Ghana into rooms it has never been before.
```

Write `src/content/cities/atlanta.mdx`:

```mdx
---
name: "Atlanta"
country: "United States"
lat: 33.7490
lng: -84.3880
relatedQueens: []
relatedContestants: []
---

The Atlanta corridor has become, quietly, one of the most consequential Ghanaian diaspora hubs in the American South. From the churches in College Park to the cultural galas in Buckhead, Atlanta's daughters carry Ghana with a particular ease — a place that has learned to be home twice over.
```

### Step 3: Verify schema validation

```bash
npx astro sync
```
Expected: no schema errors. Generated types acknowledge 5 entries in the `cities` collection.

### Step 4: Commit

```bash
git add src/content/cities/
git commit -m "feat(content): seed 5 diaspora cities (Accra + 4 secondary)"
```

---

## Task 4: Build `<CityMarker>` shared primitive

**Files:** Create `src/components/ui/CityMarker.astro`

A small SVG 4-point gold star with size + opacity + active state. Used in the SVG fallback map and the mobile city list. (The 3D globe uses Three.js custom geometry — that's separate.)

- [ ] **Step 1: Write the component**

Create `C:/dev/Projects/mdgh-staging/src/components/ui/CityMarker.astro`:

```astro
---
interface Props {
  /** Size in pixels. Computed elsewhere as `8 + activity * 2`, capped at 18. */
  size?: number;
  /** Whether this marker is the currently-active city */
  active?: boolean;
  /** Opacity at idle. Auto-set to 1.0 if active. */
  opacity?: number;
  /** City name — used for hover tooltip / accessible label */
  name?: string;
}

const { size = 10, active = false, opacity = 1, name } = Astro.props;

const effectiveOpacity = active ? 1 : Math.max(0.3, Math.min(1, opacity));
const filter = active
  ? 'drop-shadow(0 0 12px rgba(255, 209, 102, 1))'
  : `drop-shadow(0 0 ${Math.round(size / 2)}px rgba(255, 209, 102, 0.5))`;
---
<span
  class={`city-marker${active ? ' is-active' : ''}`}
  style={`--size: ${size}px; --opacity: ${effectiveOpacity}; --filter: ${filter}`}
  title={name}
  aria-label={name}
></span>

<style>
  .city-marker {
    display: inline-block;
    width: var(--size, 10px);
    height: var(--size, 10px);
    background: var(--color-saffron, #FFD166);
    clip-path: polygon(50% 0%, 61% 35%, 98% 35%, 68% 57%, 79% 91%, 50% 70%, 21% 91%, 32% 57%, 2% 35%, 39% 35%);
    opacity: var(--opacity, 1);
    filter: var(--filter, drop-shadow(0 0 6px rgba(255, 209, 102, 0.5)));
    transition: transform 200ms cubic-bezier(.4, 0, .2, 1), opacity 200ms cubic-bezier(.4, 0, .2, 1);
    will-change: transform;
  }
  .city-marker.is-active {
    transform: scale(1.4);
  }
  @media (prefers-reduced-motion: no-preference) {
    .city-marker:not(.is-active) {
      animation: twinkle 2s ease-in-out infinite alternate;
    }
    @keyframes twinkle {
      from { opacity: var(--opacity, 1); }
      to { opacity: calc(var(--opacity, 1) * 0.6); }
    }
  }
  @media (prefers-reduced-motion: reduce) {
    .city-marker { transition: none; }
    .city-marker.is-active { transform: none; }
  }
</style>
```

- [ ] **Step 2: Verify typecheck**

```bash
npm run typecheck
```
Expected: 0 new errors.

- [ ] **Step 3: Smoke-test in /design-system (temporary, then revert)**

Add to `src/pages/design-system.astro` frontmatter: `import CityMarker from '~/components/ui/CityMarker.astro';`

Add a temp section near the bottom:

```astro
<section style="padding: 32px; background: #0a0414; color: white;">
  <h3>CityMarker (smoke test — remove before commit)</h3>
  <p>idle small: <CityMarker size={8} name="Idle small" /></p>
  <p>idle large: <CityMarker size={14} name="Idle large" /></p>
  <p>dimmed: <CityMarker size={10} opacity={0.5} name="Dimmed" /></p>
  <p>active: <CityMarker size={18} active={true} name="Active" /></p>
</section>
```

Start dev server, curl `/design-system`, verify markers render. Then revert design-system.astro fully (`git diff src/pages/design-system.astro` must show no changes).

- [ ] **Step 4: Commit**

```bash
git add src/components/ui/CityMarker.astro
git status   # ONLY CityMarker.astro staged
git commit -m "feat(ui): add CityMarker shared primitive (4-point gold star)"
```

---

## Task 5: Build `<CityDrawer>` bottom drawer

**Files:** Create `src/components/diaspora/CityDrawer.astro`

A bottom drawer detail view, similar in spirit to Phase 1's `<QueenModal>` but with a bottom-slide motion instead of scale+fade-from-center. Same template-per-entity + sibling hidden-bio-div pattern. Focus management, ESC/swipe-down/close dismiss, reduced-motion variant.

- [ ] **Step 1: Write the component**

Create `C:/dev/Projects/mdgh-staging/src/components/diaspora/CityDrawer.astro` with this content (long — read carefully):

```astro
---
import MetaLabel from '~/components/ui/MetaLabel.astro';
import Portrait from '~/components/ui/Portrait.astro';

interface City {
  slug: string;
  name: string;
  country: string;
  heroImage?: string;
  heroImageAlt?: string;
  relatedQueens: string[];
  relatedContestants: string[];
}

interface Props {
  cities: City[];
}

const { cities } = Astro.props;
---
<dialog class="city-drawer" data-city-drawer aria-modal="true" aria-labelledby="city-drawer-title">
  <div class="city-drawer__scrim" data-city-drawer-scrim></div>
  <div class="city-drawer__panel" role="document">
    <button type="button" class="city-drawer__close" data-city-drawer-close aria-label="Close city detail">
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <path d="M18 6L6 18M6 6l12 12"/>
      </svg>
    </button>
    <div class="city-drawer__body" data-city-drawer-body></div>
  </div>

  {cities.map((c) => {
    const queensCount = c.relatedQueens.length;
    const contestantsCount = c.relatedContestants.length;
    const meta = `${c.country.toUpperCase()} · ${queensCount} ${queensCount === 1 ? 'QUEEN' : 'QUEENS'} · ${contestantsCount} ${contestantsCount === 1 ? 'CONTESTANT' : 'CONTESTANTS'}`;
    return (
      <template data-city-template={c.slug}>
        <div class="city-drawer__layout">
          <div class="city-drawer__content">
            <MetaLabel text={meta} tone="accent" />
            <h2 id="city-drawer-title" class="city-drawer__name">{c.name}</h2>
            <div class="city-drawer__bio" data-city-drawer-bio-slot></div>
            {(c.relatedQueens.length > 0 || c.relatedContestants.length > 0) && (
              <div class="city-drawer__chips">
                {c.relatedQueens.map((slug) => (
                  <a class="city-drawer__chip city-drawer__chip--queen" href={`/heritage#${slug}`}>
                    Crown · {slug.replace(/-/g, ' ')}
                  </a>
                ))}
                {c.relatedContestants.length > 0 && (
                  <span class="city-drawer__chip city-drawer__chip--contestant">
                    +{c.relatedContestants.length} contestant{c.relatedContestants.length !== 1 ? 's' : ''}
                  </span>
                )}
              </div>
            )}
          </div>
          {c.heroImage && c.heroImageAlt && (
            <div class="city-drawer__media">
              <Portrait src={c.heroImage} alt={c.heroImageAlt} aspect="4 / 3" />
            </div>
          )}
        </div>
      </template>
    );
  })}
</dialog>

<script>
  const dlg = document.querySelector<HTMLDialogElement>('[data-city-drawer]');
  const body = document.querySelector<HTMLElement>('[data-city-drawer-body]');
  const closeBtn = document.querySelector<HTMLButtonElement>('[data-city-drawer-close]');
  const scrim = document.querySelector<HTMLElement>('[data-city-drawer-scrim]');

  let lastFocused: HTMLElement | null = null;

  function openDrawer(slug: string) {
    if (!dlg || !body) return;
    const tpl = document.querySelector<HTMLTemplateElement>(`template[data-city-template="${slug}"]`);
    if (!tpl) return;
    body.replaceChildren(tpl.content.cloneNode(true));

    const bioSource = document.querySelector<HTMLElement>(`[data-city-bio="${slug}"]`);
    const bioSlot = body.querySelector<HTMLElement>('[data-city-drawer-bio-slot]');
    if (bioSource && bioSlot) {
      bioSlot.innerHTML = bioSource.innerHTML;
    }

    lastFocused = document.activeElement as HTMLElement;
    dlg.showModal();
    requestAnimationFrame(() => dlg.classList.add('is-open'));
    closeBtn?.focus();
  }

  function closeDrawer() {
    if (!dlg) return;
    dlg.classList.remove('is-open');
    setTimeout(() => {
      dlg.close();
      lastFocused?.focus();
    }, 200);
  }

  // Open on click/keyboard activation of any element with `data-city-trigger="<slug>"`
  document.addEventListener('click', (e) => {
    const trigger = (e.target as HTMLElement | null)?.closest<HTMLElement>('[data-city-trigger]');
    if (!trigger) return;
    const slug = trigger.dataset.cityTrigger;
    if (slug) openDrawer(slug);
  });

  document.addEventListener('keydown', (e) => {
    const trigger = (e.target as HTMLElement | null)?.closest<HTMLElement>('[data-city-trigger]');
    if (!trigger) return;
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      const slug = trigger.dataset.cityTrigger;
      if (slug) openDrawer(slug);
    }
  });

  closeBtn?.addEventListener('click', closeDrawer);
  scrim?.addEventListener('click', closeDrawer);
  dlg?.addEventListener('cancel', (e) => { e.preventDefault(); closeDrawer(); });

  // Expose for the 3D globe React island to call
  (window as any).__openCityDrawer = openDrawer;
</script>

<style>
  .city-drawer {
    border: none;
    background: transparent;
    padding: 0;
    max-width: 100vw;
    max-height: 100vh;
    width: 100%;
    height: 100%;
    inset: 0;
  }
  .city-drawer::backdrop { background: rgba(5, 1, 17, 0.7); backdrop-filter: blur(6px); }
  .city-drawer__scrim {
    position: fixed;
    inset: 0;
    background: rgba(5, 1, 17, 0.55);
    backdrop-filter: blur(6px);
  }
  .city-drawer__panel {
    position: fixed;
    left: 0;
    right: 0;
    bottom: 0;
    background: linear-gradient(180deg, var(--color-drawer-surface-1, rgba(10, 4, 20, 0.95)) 0%, var(--color-drawer-surface-2, #050111) 100%);
    border-top: 1px solid var(--color-drawer-border, rgba(255, 209, 102, 0.25));
    backdrop-filter: blur(12px);
    padding: 24px 48px 32px;
    color: #fff;
    transform: translateY(100%);
    transition: transform 280ms cubic-bezier(.2, .7, .1, 1);
    min-height: 40vh;
    max-height: 70vh;
    overflow-y: auto;
  }
  .city-drawer.is-open .city-drawer__panel {
    transform: translateY(0);
  }
  .city-drawer__close {
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
  }
  .city-drawer__close:hover,
  .city-drawer__close:focus-visible {
    background: rgba(255, 209, 102, 0.12);
    outline: 2px solid var(--color-saffron, #FFD166);
    outline-offset: 2px;
  }
  .city-drawer__layout {
    display: grid;
    grid-template-columns: 1fr 280px;
    gap: 32px;
    align-items: start;
    max-width: 1280px;
    margin: 0 auto;
  }
  .city-drawer__content { display: flex; flex-direction: column; gap: 12px; }
  .city-drawer__name {
    font-family: 'Fraunces Variable', 'Fraunces', serif;
    font-style: italic;
    font-weight: 500;
    font-size: clamp(36px, 5vw, 56px);
    line-height: 1;
    margin: 0;
    letter-spacing: -0.02em;
  }
  .city-drawer__bio { line-height: 1.7; color: rgba(255, 255, 255, 0.85); font-size: 15px; }
  .city-drawer__bio :global(p) { margin: 0 0 1em; }
  .city-drawer__chips { display: flex; gap: 8px; flex-wrap: wrap; margin-top: 6px; }
  .city-drawer__chip {
    font-family: 'JetBrains Mono Variable', 'JetBrains Mono', monospace;
    font-size: 10px;
    font-weight: 600;
    letter-spacing: 0.15em;
    text-transform: uppercase;
    padding: 4px 10px;
    border-radius: 999px;
    text-decoration: none;
  }
  .city-drawer__chip--queen {
    color: var(--color-saffron, #FFD166);
    border: 1px solid rgba(255, 209, 102, 0.3);
  }
  .city-drawer__chip--queen:hover,
  .city-drawer__chip--queen:focus-visible {
    background: rgba(255, 209, 102, 0.12);
    outline: 2px solid var(--color-saffron, #FFD166);
    outline-offset: 2px;
  }
  .city-drawer__chip--contestant {
    color: rgba(255, 255, 255, 0.65);
    border: 1px solid rgba(255, 255, 255, 0.15);
  }
  @media (max-width: 767px) {
    .city-drawer__panel {
      padding: 20px 16px 24px;
      max-height: 96vh;
      min-height: 96vh;
    }
    .city-drawer__layout {
      grid-template-columns: 1fr;
    }
  }
  @media (prefers-reduced-motion: reduce) {
    .city-drawer__panel {
      transition: opacity 200ms linear;
      transform: none;
      opacity: 0;
    }
    .city-drawer.is-open .city-drawer__panel { opacity: 1; }
  }
</style>
```

- [ ] **Step 2: Verify typecheck**

```bash
npm run typecheck
```
Expected: 0 new errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/diaspora/CityDrawer.astro
git commit -m "feat(diaspora): add CityDrawer bottom-drawer detail view"
```

---

## Task 6: Build `<DiasporaFallback>` static SVG map + city list

**Files:** Create `src/components/diaspora/DiasporaFallback.astro`

The SSR-default rendering. Used always on mobile, always under reduced-motion, AND used as the SSR placeholder before the 3D globe hydrates on desktop. Includes a simplified continent SVG + positioned `<CityMarker>` stars + a city list below the map.

- [ ] **Step 1: Write the component**

Create `C:/dev/Projects/mdgh-staging/src/components/diaspora/DiasporaFallback.astro`:

```astro
---
import CityMarker from '~/components/ui/CityMarker.astro';
import MetaLabel from '~/components/ui/MetaLabel.astro';

interface City {
  slug: string;
  name: string;
  country: string;
  lat: number;
  lng: number;
  activity: number;        // queensCount + contestantsCount
  queensCount: number;
  contestantsCount: number;
}

interface Props {
  cities: City[];
}

const { cities } = Astro.props;

// Project lat/lng to SVG viewBox coordinates (720x320 — equirectangular)
function project(lat: number, lng: number): { x: number; y: number } {
  // viewBox is 720 wide × 320 tall, lng -180..180 → 0..720, lat 90..-90 → 0..320
  const x = ((lng + 180) / 360) * 720;
  const y = ((90 - lat) / 180) * 320;
  return { x, y };
}

const maxActivity = Math.max(1, ...cities.map((c) => c.activity));
---
<section class="diaspora-fallback" aria-label="Diaspora cities map and list">
  <!-- Static SVG world map with city markers -->
  <div class="diaspora-fallback__map" aria-hidden="true">
    <svg viewBox="0 0 720 320" preserveAspectRatio="xMidYMid meet" class="diaspora-fallback__svg">
      <!-- Simplified continent silhouettes -->
      <g class="diaspora-fallback__continents" opacity="0.35">
        <!-- Americas -->
        <path d="M100 60 L150 50 L180 80 L170 140 L130 200 L100 210 L80 180 L70 130 Z" fill="rgba(107,43,217,0.35)" stroke="rgba(255,209,102,0.3)" stroke-width="0.8"/>
        <!-- Africa -->
        <path d="M340 90 L390 90 L420 130 L410 200 L370 240 L340 220 L320 170 L325 120 Z" fill="rgba(107,43,217,0.35)" stroke="rgba(255,209,102,0.3)" stroke-width="0.8"/>
        <!-- Europe -->
        <path d="M340 50 L420 50 L440 85 L400 95 L360 90 L335 70 Z" fill="rgba(107,43,217,0.35)" stroke="rgba(255,209,102,0.3)" stroke-width="0.8"/>
        <!-- Asia -->
        <path d="M450 50 L600 50 L640 90 L630 150 L560 170 L470 140 L440 100 Z" fill="rgba(107,43,217,0.35)" stroke="rgba(255,209,102,0.3)" stroke-width="0.8"/>
        <!-- Australia -->
        <path d="M560 220 L640 215 L660 245 L620 260 L570 250 Z" fill="rgba(107,43,217,0.35)" stroke="rgba(255,209,102,0.3)" stroke-width="0.8"/>
      </g>
    </svg>

    <!-- City markers absolutely positioned via percent from projected lat/lng -->
    {cities.map((c) => {
      const { x, y } = project(c.lat, c.lng);
      const xPct = (x / 720) * 100;
      const yPct = (y / 320) * 100;
      const size = Math.min(18, 8 + c.activity * 2);
      const opacity = 0.5 + (c.activity / maxActivity) * 0.5;
      return (
        <button
          class="diaspora-fallback__marker-btn"
          data-city-trigger={c.slug}
          aria-label={`Open ${c.name}, ${c.country}`}
          style={`left: ${xPct}%; top: ${yPct}%`}
        >
          <CityMarker size={size} opacity={opacity} name={c.name} />
        </button>
      );
    })}
  </div>

  <!-- City list — primary affordance on mobile, secondary on desktop -->
  <div class="diaspora-fallback__list-wrap">
    <MetaLabel text="Or tap a city" tone="muted" />
    <ul class="diaspora-fallback__list" role="list">
      {cities.map((c) => (
        <li>
          <button class="diaspora-fallback__list-item" data-city-trigger={c.slug}>
            <span class="diaspora-fallback__list-name">
              <span class="diaspora-fallback__list-italic">{c.name}</span>
              <span class="diaspora-fallback__list-country">· {c.country}</span>
            </span>
            <span class="diaspora-fallback__list-meta">
              {c.queensCount}Q · {c.contestantsCount}C
            </span>
          </button>
        </li>
      ))}
    </ul>
  </div>
</section>

<style>
  .diaspora-fallback {
    display: flex;
    flex-direction: column;
    gap: 24px;
    max-width: 1280px;
    margin: 0 auto;
    padding: 0 24px;
  }
  .diaspora-fallback__map {
    position: relative;
    background: #0a0414;
    border: 1px solid rgba(255, 209, 102, 0.15);
    border-radius: 16px;
    padding: 24px;
    aspect-ratio: 720 / 320;
    max-height: 360px;
  }
  .diaspora-fallback__svg {
    display: block;
    width: 100%;
    height: 100%;
  }
  .diaspora-fallback__marker-btn {
    position: absolute;
    transform: translate(-50%, -50%);
    background: transparent;
    border: 2px solid transparent;
    padding: 4px;
    border-radius: 999px;
    cursor: pointer;
    line-height: 0;
  }
  .diaspora-fallback__marker-btn:hover,
  .diaspora-fallback__marker-btn:focus-visible {
    border-color: rgba(255, 209, 102, 0.4);
    outline: none;
  }
  .diaspora-fallback__marker-btn:focus-visible {
    border-color: var(--color-saffron, #FFD166);
  }

  .diaspora-fallback__list-wrap { display: flex; flex-direction: column; gap: 12px; }
  .diaspora-fallback__list {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  .diaspora-fallback__list-item {
    width: 100%;
    background: linear-gradient(180deg, #1a0833, #050111);
    border: 1px solid rgba(107, 43, 217, 0.25);
    border-radius: 12px;
    padding: 14px 16px;
    color: rgba(255, 255, 255, 0.85);
    text-align: left;
    display: flex;
    justify-content: space-between;
    align-items: center;
    cursor: pointer;
    transition: border-color 200ms cubic-bezier(.4, 0, .2, 1), background 200ms cubic-bezier(.4, 0, .2, 1);
    font-family: 'Inter Variable', 'Inter', sans-serif;
  }
  .diaspora-fallback__list-item:hover,
  .diaspora-fallback__list-item:focus-visible {
    border-color: rgba(255, 209, 102, 0.5);
    outline: none;
  }
  .diaspora-fallback__list-item:focus-visible {
    box-shadow: 0 0 0 2px var(--color-saffron, #FFD166);
  }
  .diaspora-fallback__list-italic {
    font-family: 'Fraunces Variable', 'Fraunces', serif;
    font-style: italic;
    font-size: 20px;
  }
  .diaspora-fallback__list-country {
    opacity: 0.55;
    font-size: 13px;
    margin-left: 6px;
  }
  .diaspora-fallback__list-meta {
    font-family: 'JetBrains Mono Variable', 'JetBrains Mono', monospace;
    font-size: 11px;
    font-weight: 600;
    color: var(--color-saffron, #FFD166);
    letter-spacing: 0.2em;
  }

  @media (prefers-reduced-motion: reduce) {
    .diaspora-fallback__list-item { transition: none; }
  }
</style>
```

- [ ] **Step 2: Verify typecheck**

```bash
npm run typecheck
```
Expected: 0 new errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/diaspora/DiasporaFallback.astro
git commit -m "feat(diaspora): add DiasporaFallback (static SVG map + city list)"
```

---

## Task 7: Build `<DiasporaGlobe>` React island

**Files:** Create `src/components/diaspora/DiasporaGlobe.tsx`

A React component (TSX) wrapping `react-globe.gl`. Loaded ONLY when (a) viewport ≥ 768px AND (b) `prefers-reduced-motion: no-preference`. Hydrates via Astro's `client:visible` directive (loads on scroll-into-view). Calls the globally-exposed `__openCityDrawer(slug)` function on marker click.

- [ ] **Step 1: Write the component**

Create `C:/dev/Projects/mdgh-staging/src/components/diaspora/DiasporaGlobe.tsx`:

```tsx
import { useEffect, useMemo, useRef } from 'react';
import Globe from 'react-globe.gl';
import type { GlobeMethods } from 'react-globe.gl';

interface City {
  slug: string;
  name: string;
  country: string;
  lat: number;
  lng: number;
  activity: number;
  queensCount: number;
  contestantsCount: number;
}

interface Props {
  cities: City[];
}

interface PointDatum {
  lat: number;
  lng: number;
  slug: string;
  name: string;
  size: number;
  color: string;
}

export default function DiasporaGlobe({ cities }: Props) {
  const globeRef = useRef<GlobeMethods | undefined>(undefined);
  const containerRef = useRef<HTMLDivElement | null>(null);

  // Map cities → point data for react-globe.gl
  const points = useMemo<PointDatum[]>(() => {
    const maxActivity = Math.max(1, ...cities.map((c) => c.activity));
    return cities.map((c) => ({
      lat: c.lat,
      lng: c.lng,
      slug: c.slug,
      name: c.name,
      // size is in the globe's unit (radius). 0.4 base + scaled by activity.
      size: 0.35 + (c.activity / maxActivity) * 0.6,
      color: '#FFD166',
    }));
  }, [cities]);

  useEffect(() => {
    const g = globeRef.current;
    if (!g) return;

    // Slow auto-rotate at idle.
    const controls = g.controls();
    controls.autoRotate = true;
    controls.autoRotateSpeed = 0.4;
    controls.enableZoom = false;

    // Initial camera position
    g.pointOfView({ lat: 10, lng: 0, altitude: 2.4 }, 0);

    return () => {
      controls.autoRotate = false;
    };
  }, [points]);

  return (
    <div ref={containerRef} className="diaspora-globe" style={{ width: '100%', height: '560px' }}>
      <Globe
        ref={globeRef}
        height={560}
        backgroundColor="rgba(0,0,0,0)"
        // Use a flat dark navy globe (no Earth texture) — gold wireframe via globeMaterial
        globeImageUrl={undefined}
        showAtmosphere={true}
        atmosphereColor="#6B2BD9"
        atmosphereAltitude={0.18}
        // Wireframe lat/long lines
        showGraticules={true}
        // Points data
        pointsData={points}
        pointAltitude={0.012}
        pointRadius={(d: any) => d.size}
        pointColor={(d: any) => d.color}
        pointLabel={(d: any) => `<div style="background:rgba(5,1,17,0.92);border:1px solid rgba(255,209,102,0.4);padding:6px 12px;border-radius:6px;font-family:'JetBrains Mono',monospace;font-size:11px;color:#FFD166;letter-spacing:0.2em;text-transform:uppercase">${d.name}</div>`}
        onPointClick={(d: any) => {
          // Pause rotation, rotate to face the city, then open drawer
          const controls = globeRef.current?.controls();
          if (controls) controls.autoRotate = false;
          globeRef.current?.pointOfView({ lat: d.lat, lng: d.lng, altitude: 2.0 }, 1100);
          // Open the city drawer via the global function exposed by CityDrawer.astro's script
          const opener = (window as any).__openCityDrawer as ((slug: string) => void) | undefined;
          if (opener) opener(d.slug);
        }}
      />
    </div>
  );
}
```

- [ ] **Step 2: Verify typecheck**

```bash
npm run typecheck
```
Expected: 0 new errors. If `react-globe.gl` types are missing, install `@types/react-globe.gl` (probably not needed — package ships own types).

- [ ] **Step 3: Commit**

```bash
git add src/components/diaspora/DiasporaGlobe.tsx
git commit -m "feat(diaspora): add DiasporaGlobe React island (react-globe.gl)"
```

---

## Task 8: Build `<DiasporaPage>` orchestrator

**Files:** Create `src/components/diaspora/DiasporaPage.astro`

The component decides: server-render the static fallback always. Conditionally hydrate the 3D globe via a small bootstrap script that checks feature gates (viewport width + reduced-motion) and only then mounts the React island.

- [ ] **Step 1: Write the component**

Create `C:/dev/Projects/mdgh-staging/src/components/diaspora/DiasporaPage.astro`:

```astro
---
import DiasporaFallback from './DiasporaFallback.astro';
import DiasporaGlobe from './DiasporaGlobe.tsx';
import CityDrawer from './CityDrawer.astro';

interface City {
  slug: string;
  name: string;
  country: string;
  lat: number;
  lng: number;
  heroImage?: string;
  heroImageAlt?: string;
  relatedQueens: string[];
  relatedContestants: string[];
  queensCount: number;
  contestantsCount: number;
  activity: number;
}

interface Props {
  cities: City[];
}

const { cities } = Astro.props;
---
<div class="diaspora-page-content">

  <!-- 3D globe shown only when client passes the gate (set by inline script below) -->
  <div class="diaspora-page__globe-slot" data-diaspora-globe-slot hidden>
    <DiasporaGlobe cities={cities} client:visible />
  </div>

  <!-- Static fallback shown by default and on mobile / reduced-motion -->
  <div class="diaspora-page__fallback-slot" data-diaspora-fallback-slot>
    <DiasporaFallback cities={cities} />
  </div>

  <!-- The drawer is rendered once and reused by both globe + fallback -->
  <CityDrawer cities={cities} />
</div>

<script>
  // Decide which surface to show:
  // - 3D globe: viewport ≥ 768px AND prefers-reduced-motion: no-preference AND
  //   WebGL is supported
  // - Static fallback: everything else
  function gate(): boolean {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return false;
    if (window.matchMedia('(max-width: 767px)').matches) return false;
    // Quick WebGL sniff
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
    if (!gl) return false;
    return true;
  }

  const globeSlot = document.querySelector<HTMLElement>('[data-diaspora-globe-slot]');
  const fallbackSlot = document.querySelector<HTMLElement>('[data-diaspora-fallback-slot]');

  if (gate() && globeSlot && fallbackSlot) {
    globeSlot.hidden = false;
    fallbackSlot.hidden = true;
  }

  // Re-evaluate on resize crossing the 768px threshold
  let wasGated = gate();
  window.addEventListener('resize', () => {
    const isGated = gate();
    if (isGated === wasGated) return;
    wasGated = isGated;
    if (globeSlot && fallbackSlot) {
      globeSlot.hidden = !isGated;
      fallbackSlot.hidden = isGated;
    }
  });
</script>

<style>
  .diaspora-page-content {
    width: 100%;
  }
  .diaspora-page__globe-slot {
    display: flex;
    justify-content: center;
    padding: 24px 24px 48px;
  }
  .diaspora-page__fallback-slot {
    padding: 24px 0 48px;
  }
</style>
```

- [ ] **Step 2: Verify typecheck**

```bash
npm run typecheck
```
Expected: 0 new errors. The `client:visible` directive may surface React-related warnings — investigate any that appear.

- [ ] **Step 3: Commit**

```bash
git add src/components/diaspora/DiasporaPage.astro
git commit -m "feat(diaspora): add DiasporaPage orchestrator (fallback default, conditional globe hydration)"
```

---

## Task 9: Wire up `/diaspora` page route

**Files:** Create `src/pages/diaspora.astro`

Loads cities collection, maps schema → component props (compute `queensCount`, `contestantsCount`, `activity` from related arrays), passes to `<DiasporaPage>`, emits hidden `<div data-city-bio>` elements for the drawer's MDX bio rendering.

- [ ] **Step 1: Write the page**

Create `C:/dev/Projects/mdgh-staging/src/pages/diaspora.astro`:

```astro
---
import { getCollection } from 'astro:content';
import PageLayout from '~/layouts/PageLayout.astro';
import MetaLabel from '~/components/ui/MetaLabel.astro';
import DiasporaPage from '~/components/diaspora/DiasporaPage.astro';

const cityEntries = await getCollection('cities');

// Sort by activity descending so the most active cities render first
const cityRows = cityEntries.map((c) => ({
  entry: c,
  queensCount: c.data.relatedQueens.length,
  contestantsCount: c.data.relatedContestants.length,
}));
cityRows.sort((a, b) => (b.queensCount + b.contestantsCount) - (a.queensCount + a.contestantsCount));

const cities = cityRows.map(({ entry, queensCount, contestantsCount }) => ({
  slug: entry.slug,
  name: entry.data.name,
  country: entry.data.country,
  lat: entry.data.lat,
  lng: entry.data.lng,
  heroImage: entry.data.heroImage,
  heroImageAlt: entry.data.heroImageAlt,
  relatedQueens: entry.data.relatedQueens,
  relatedContestants: entry.data.relatedContestants,
  queensCount,
  contestantsCount,
  activity: queensCount + contestantsCount,
}));

// Pre-render MDX bios into hidden divs for the drawer
const cityBios = await Promise.all(
  cityEntries.map(async (c) => ({
    slug: c.slug,
    Content: (await c.render()).Content,
  }))
);
---
<PageLayout
  title="The Diaspora · A globe of Ghanaian daughters"
  description="From Accra to Atlanta, London to Toronto — every star is a city, every city is a story."
>
  <div class="diaspora-page">
    <header class="diaspora-page__header">
      <MetaLabel text="The diaspora · a living atlas" tone="accent" />
      <h1 class="diaspora-page__title">
        A globe of <em class="diaspora-page__italic">Ghanaian daughters.</em>
      </h1>
      <p class="diaspora-page__lede">
        From Accra to Atlanta, London to Toronto — every star is a city, every city is a story. Click to enter.
      </p>
    </header>

    {cities.length === 0 ? (
      <p class="diaspora-page__empty">Cities coming soon.</p>
    ) : (
      <DiasporaPage cities={cities} />
    )}

    <div class="diaspora-page__bios" aria-hidden="true">
      {cityBios.map(({ slug, Content }) => (
        <div data-city-bio={slug}>
          <Content />
        </div>
      ))}
    </div>
  </div>
</PageLayout>

<style>
  .diaspora-page {
    max-width: 1280px;
    margin: 0 auto;
    padding: 120px 24px 64px;
  }
  .diaspora-page__header {
    max-width: 720px;
    margin-bottom: 48px;
    display: flex;
    flex-direction: column;
    gap: 16px;
  }
  .diaspora-page__title {
    font-family: 'Fraunces Variable', 'Fraunces', serif;
    font-weight: 500;
    font-size: clamp(40px, 6vw, 80px);
    line-height: 1.05;
    margin: 0;
    color: #fff;
  }
  .diaspora-page__italic {
    font-style: italic;
    color: var(--color-saffron, #FFD166);
  }
  .diaspora-page__lede {
    color: rgba(255, 255, 255, 0.7);
    font-size: 18px;
    line-height: 1.6;
    max-width: 56ch;
  }
  .diaspora-page__empty {
    color: rgba(255, 255, 255, 0.5);
    padding: 64px 24px;
    text-align: center;
  }
  .diaspora-page__bios { display: none; }
</style>
```

- [ ] **Step 2: Build + dev server smoke test**

```bash
npm run typecheck
npm run dev &
# wait for ready
curl -s http://localhost:4321/diaspora > /tmp/diaspora.html 2>&1 || curl -s http://localhost:4322/diaspora > /tmp/diaspora.html
grep -c "diaspora-fallback" /tmp/diaspora.html
grep -c "data-city-bio=" /tmp/diaspora.html
```
Expected: `diaspora-fallback` count ≥ 1 (the SVG fallback section); `data-city-bio=` count = 5 (one per seeded city).

Stop the dev server.

- [ ] **Step 3: Commit**

```bash
git add src/pages/diaspora.astro
git commit -m "feat(diaspora): wire /diaspora page route with bio rendering"
```

---

## Task 10: Playwright e2e

**Files:** Create `tests/e2e/diaspora.spec.ts`

Tests covering: page renders fallback by default (server-side), clicking a city marker opens the drawer, clicking a city list item opens the drawer, ESC closes drawer + restores focus, mobile viewport shows the fallback (verified via the SVG map being visible), reduced-motion hides the 3D globe slot.

- [ ] **Step 1: Write the spec file**

Create `C:/dev/Projects/mdgh-staging/tests/e2e/diaspora.spec.ts`:

```typescript
import { test, expect } from '@playwright/test';

test.describe('/diaspora', () => {
  test('page renders with city list visible (fallback is SSR default)', async ({ page }) => {
    await page.goto('/diaspora');
    // The static fallback's city list is always SSR'd
    const list = page.locator('.diaspora-fallback__list');
    await expect(list).toBeVisible();
    // 5 cities seeded
    await expect(page.locator('.diaspora-fallback__list-item')).toHaveCount(5);
  });

  test('clicking a city in the list opens the drawer', async ({ page }) => {
    await page.goto('/diaspora');
    const firstCity = page.locator('.diaspora-fallback__list-item').first();
    await firstCity.click();
    const drawer = page.locator('[data-city-drawer]');
    await expect(drawer).toHaveAttribute('open', '');
  });

  test('ESC closes the drawer and returns focus', async ({ page }) => {
    await page.goto('/diaspora');
    const firstCity = page.locator('.diaspora-fallback__list-item').first();
    await firstCity.focus();
    await firstCity.click();
    await page.keyboard.press('Escape');
    await expect(page.locator('[data-city-drawer]')).not.toHaveAttribute('open', '');
    // Focus should return to the trigger
    await expect(firstCity).toBeFocused();
  });

  test('drawer body contains the city name + bio', async ({ page }) => {
    await page.goto('/diaspora');
    const accraButton = page.locator('.diaspora-fallback__list-item').filter({ hasText: 'Accra' });
    await accraButton.click();
    const drawerBody = page.locator('[data-city-drawer-body]');
    await expect(drawerBody).toContainText('Accra');
    // Bio text appears
    await expect(drawerBody).toContainText('first stage');
  });

  test('mobile (<768px) shows the fallback (no globe slot visible)', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 800 });
    await page.goto('/diaspora');
    // Fallback slot is visible
    const fallbackSlot = page.locator('[data-diaspora-fallback-slot]');
    await expect(fallbackSlot).toBeVisible();
    // Globe slot is hidden
    const globeSlot = page.locator('[data-diaspora-globe-slot]');
    await expect(globeSlot).toBeHidden();
  });

  test('prefers-reduced-motion hides the globe slot', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto('/diaspora');
    // Even on desktop, globe slot should be hidden under reduced-motion
    const globeSlot = page.locator('[data-diaspora-globe-slot]');
    await expect(globeSlot).toBeHidden();
    const fallbackSlot = page.locator('[data-diaspora-fallback-slot]');
    await expect(fallbackSlot).toBeVisible();
  });
});
```

- [ ] **Step 2: Run the suite**

```bash
cd C:/dev/Projects/mdgh-staging
npm run test:e2e -- diaspora.spec.ts
```
Expected: all tests pass across the configured browser projects. If any fail with `toHaveAttribute('open', '')` shape mismatches, adjust per how Heritage's spec handled it (the same pattern proven there).

- [ ] **Step 3: Commit**

```bash
git add tests/e2e/diaspora.spec.ts
git commit -m "test(diaspora): e2e — fallback render, drawer open/close, mobile, reduced-motion"
```

---

## Task 11: Build + verify Three.js exclusion + Lighthouse

**Files:** none modified (audit task)

Run a production build and verify that the Three.js bundle is NOT loaded on the SSR-rendered HTML, and that Lighthouse scores still pass.

- [ ] **Step 1: Production build**

```bash
cd C:/dev/Projects/mdgh-staging
npm run build
```
Expected: clean build. Note the size of any chunks containing `three` or `globe`.

- [ ] **Step 2: Serve and audit**

Start preview server:
```bash
npx wrangler pages dev ./dist --compatibility-flag=nodejs_compat --compatibility-date=2026-05-01 --port 8788 &
# wait for ready
```

Fetch the initial HTML for `/diaspora` and search for Three.js references:
```bash
curl -s http://localhost:8788/diaspora > /tmp/diaspora-prod.html
grep -c "three" /tmp/diaspora-prod.html
grep -c "globe.gl" /tmp/diaspora-prod.html
```

The SSR'd HTML should contain references to the React island markup (Astro hydration boundaries), but the actual Three.js JS bundle should be in a separate file loaded only when the island hydrates. Verify by listing the chunks in dist:

```bash
find dist/_astro -name "*.js" | xargs -I {} sh -c 'echo "{}: $(wc -c < {})"' | sort -t: -k2 -n -r | head -10
```
Expect: a large chunk (likely 400-600KB) for the globe/three bundle. As long as it's not in the initial HTML's `<script>` tags, the lazy-load is working.

- [ ] **Step 3: Run Lighthouse mobile**

```bash
npx lighthouse http://localhost:8788/diaspora \
  --form-factor=mobile \
  --output=json \
  --output-path=./lighthouse-diaspora-mobile.json \
  --chrome-flags="--headless --no-sandbox" \
  --quiet
```

Parse scores:
```bash
node -e "
const r = require('./lighthouse-diaspora-mobile.json');
console.log(JSON.stringify({
  perf: r.categories.performance.score,
  a11y: r.categories.accessibility.score,
  bp: r.categories['best-practices'].score,
  seo: r.categories.seo.score,
  lcp_ms: r.audits['largest-contentful-paint'].numericValue,
  cls: r.audits['cumulative-layout-shift'].numericValue,
  tbt_ms: r.audits['total-blocking-time'].numericValue
}, null, 2));
"
```

Pass thresholds (relaxed per annex):
- `perf >= 0.9`
- `a11y >= 0.9`
- `bp >= 0.9`
- `seo >= 0.9`
- `lcp_ms < 3500` (Heritage's baseline + small headroom)
- `cls < 0.05`

Mobile loads the static fallback — there should be NO Three.js cost on mobile, so Performance ought to be ≥ Heritage's. If perf is materially worse, investigate.

- [ ] **Step 4: Cleanup**

```bash
rm -f lighthouse-diaspora-mobile.json
# kill the wrangler preview
```

- [ ] **Step 5: Commit any perf fixes from Step 3**

If thresholds missed and fixes were applied, commit with `perf(diaspora): ...` message. Otherwise no commit needed.

---

## Task 12: Deploy to staging + verify live (USER GATE)

**Files:** none modified

- [ ] **Step 1: Confirm clean working tree**

```bash
cd C:/dev/Projects/mdgh-staging
git status
```
Expected: clean.

- [ ] **Step 2: Push feature branch + merge to main**

```bash
git push origin feature/diaspora-globe
git checkout main
git pull origin main
git merge --no-ff feature/diaspora-globe -m "Merge feature/diaspora-globe: Phase 2 of mdgh-staging elevation

Diaspora Globe live at /diaspora:
- cities content collection seeded with 5 entries (Accra + London/NY/Toronto/Atlanta)
- CityMarker + CityDrawer + DiasporaFallback + DiasporaGlobe + DiasporaPage components
- 3D react-globe.gl island lazy-loaded (client:visible) on desktop + reduced-motion: no-preference
- Static SVG world map + city list fallback on mobile and reduced-motion (no Three.js cost)
- DiasporaPage orchestrator gates which surface renders via JS feature detection
- Drawer reuses MetaLabel + Portrait shared primitives from Phase 1
- Bio MDX rendered via hidden-bio-div pattern (same as Phase 1)
- Playwright e2e tests for fallback render, drawer open/close, mobile, reduced-motion
- Lighthouse mobile: Perf/A11y/BP/SEO ≥ 0.9 expected

Direction B (Celestial Atlas) per design annex 2026-05-21-diaspora-direction.md.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
git push origin main
```

- [ ] **Step 3: Wait for Cloudflare Pages deploy**

```bash
CLOUDFLARE_ACCOUNT_ID=233d917842862e30ed5207cf7b95bc33 npx wrangler pages deployment list --project-name mdgh-staging --environment production 2>&1 | head -8
```
Wait until the latest deployment is `Active`. May take 60-90 sec.

- [ ] **Step 4: Verify the live page**

Bypass CDN cache:
```bash
curl -s "https://staging.missdiasporagh.org/diaspora?v=$(date +%s)" > /tmp/diaspora-live.html
grep -c "diaspora-fallback" /tmp/diaspora-live.html  # >= 1
grep -c "data-city-bio" /tmp/diaspora-live.html      # 5
grep -c "Accra" /tmp/diaspora-live.html              # >= 1
```

- [ ] **Step 5: USER GATE — ship-or-iterate**

Surface the live URL to the user and ask: "Phase 2 live at staging.missdiasporagh.org/diaspora. Test in browser — the 3D globe should appear on desktop, the static SVG map on mobile/reduced-motion, all 5 cities clickable into the drawer with bio prose. Approve to mark Phase 2 done and move to Phase 3 (Contestant Hub), or describe iterations needed."

Wait for user response. If iterations: loop back to the relevant Build task.

---

## Task 13: Wrap — save phase memory + close

**Files:** Project memory at `C:/Users/USER/.claude/projects/C--dev-Projects-mdgh-web-project/memory/`

- [ ] **Step 1: Write `diaspora-phase-2-shipped.md` to project memory**

Mirror the structure of `heritage-phase-1-shipped.md`. Cover:
- Live URL + commit SHA + direction picked (Celestial Atlas)
- New shared primitive: CityMarker
- New phase-specific: CityDrawer, DiasporaFallback, DiasporaGlobe (React island), DiasporaPage (orchestrator)
- The "gate via inline script" pattern for conditional island hydration — reusable for Phase 4 quiz if it needs similar feature-gated rendering
- Lighthouse scores (record actuals)
- Plan deltas discovered during execution (Three.js bundle size, any react-globe.gl quirks, schema field surprises)
- Approval gates honored

- [ ] **Step 2: Update MEMORY.md index**

Append:
```markdown
- [Diaspora Phase 2 shipped](diaspora-phase-2-shipped.md) — `/diaspora` Celestial Atlas globe live on staging 2026-05-21+; CityMarker + CityDrawer reusable; static-fallback-by-default pattern proven
```

- [ ] **Step 3: Confirm approval gates were honored**

- T0 setup (no gate)
- T1-T11 build (no embedded user gates)
- T12 Step 5 (live verification user gate) ✓
- Direction + wireframe gates were resolved during brainstorm before this plan started (annex captures them)

If any approval gate was skipped, note it for Phase 3's plan.

- [ ] **Step 4: Phase 2 done**

The next session begins Phase 3 (Contestant Hub at `/contestants` + `/contestants/[slug]`) with its own brainstorm.

---

## Self-Review Notes

**Spec coverage:** Spec §7.4 (Diaspora Globe) requirements:
- 3D rotating globe ✓ Task 7
- Dots = cities ✓ Task 7 + 4
- Hover for city name ✓ Task 7 (pointLabel)
- Click side-panel story ✓ Task 5 (drawer) + Task 9 (page)
- react-globe.gl ✓ Task 1 + 7
- Lazy-load as React island ✓ Task 8 (client:visible)
- Static fallback ✓ Task 6
- cities[] collection ✓ Task 3

**Placeholder scan:** No "TBD" / "TODO" markers. Each step has code or commands.

**Type consistency:** City prop shape is consistent across CityDrawer, DiasporaFallback, DiasporaGlobe, DiasporaPage — `{ slug, name, country, lat, lng, heroImage?, heroImageAlt?, relatedQueens, relatedContestants, queensCount, contestantsCount, activity }`. The page (Task 9) computes the derived counts before passing.

**Ambiguity check:** "Activity" is consistently defined as `queensCount + contestantsCount`. Marker sizing formula consistent. Three.js exclusion rule (mobile + reduced-motion) consistent across Task 8 (orchestrator) and Task 11 (verification).

**Scope check:** 13 tasks, similar to Phase 1's count. Each phase plan stays focused — Phase 2 doesn't try to also build Contestants or Quiz.

**Notable deviations from spec:**
- §7.4 mentioned "side-panel story" — I'm implementing as bottom drawer per Direction B (annex confirmed). Spec wording was suggestive, not prescriptive.
- §7.4 mentioned "auto-rotates idle" — implemented as a slow 0.4 deg/sec rotate via Three.js controls. Within spirit.
- Drawer dismissal *does* reset globe rotation since the React island remounts on subsequent open — annex flagged this as a desired behavior ("preserve globe rotation state"); the current implementation may not fully achieve this. Worth flagging in Task 13 wrap if Lighthouse / manual testing surfaces it.
