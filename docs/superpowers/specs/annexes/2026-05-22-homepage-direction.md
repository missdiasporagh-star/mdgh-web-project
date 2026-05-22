# Homepage Maximalism Direction — Picked

**Date:** 2026-05-22
**Phase:** 5 (final) — Homepage Maximalism (`/`)
**Predecessor spec:** [`2026-05-20-mdgh-staging-elevation-design.md`](../2026-05-20-mdgh-staging-elevation-design.md) §1, §3, §4 row 5
**Prior annexes:** Heritage (Phase 1), Diaspora (Phase 2), Contestants (Phase 3), Quiz (Phase 4)

**Picked:** Direction A — Cinematic Tour
**Why:** (1) Spec §1 explicitly mandates "elevation, not redesign — page structure carrying forward"; A is the spec-faithful path. (2) Phases 1-4 built the four wow destinations specifically so the homepage could showcase them as live mini-previews — A is what makes that investment pay off. (3) Lowest engineering risk of the four candidates, letting the polish budget go to motion-consistency + the layout-wide font preload that finally fixes the LCP/CLS regression carried since Phase 1.

## The seven chapters

| # | Chapter | v1 state | v2 elevation |
|---|---|---|---|
| I | Hero | Apply CTA + tagline | "She wears the future." italic Fraunces clamp(56–96px) hero. Kente-loom parallax background (designed for reduced-motion). Live "Crown XXVI · OPEN" status pill (reads from `cycles/2026.json`). Apply CTA preserved as primary; secondary "Take the quiz" link added. |
| II | Mission | Mission statement paragraph | Pull-quote treatment with ornamental gold dividers, scroll-tied opacity reveal. Subtle ambient radial illustration behind. |
| III | Heritage teaser | "Twenty-six queens. One legacy." text-only | Adds a **live mini Yvonne portrait card** rendered using the same component primitives as `/heritage`. Single card + "Enter the heritage →" CTA. |
| IV | Diaspora teaser | "globe-stub" placeholder | Adds a **live mini react-globe.gl globe** (200×200px, lazy-loaded via dynamic import per Phase 2 pattern, auto-rotate at 0.6 deg/s, no markers visible since this is a teaser). Behind "A globe of *Ghanaian daughters*" headline. |
| V | Cycle teaser | "Crown XXVI is open" text | Adds **live 3-up mini ContestantCard preview** of the first 3 contestants by sortOrder (Ama / Akua / Esi). Each card is a smaller version of the production card from `/contestants`. "Meet Crown XXVI →" CTA. |
| VI | Quiz teaser ⭐ NEW | (didn't exist) | "Which Ghana *are you?*" italic Fraunces 64px. Two-column layout: tagline + Begin CTA on left, 7-archetype tiles preview on right (each tile uses the archetype's `accentHex` from `quizResults`). "Take the quiz →" routes to /quiz. |
| VII | Become Her | Apply CTA | "Become the next." centered finale. Saffron Apply CTA. Subtle ambient gradient behind. |

## ChapterRail update

Expand from 6 → 7 dots. New "QUIZ ★" entry between Cycle and Apply. On mobile, ChapterRail collapses to a bottom-fixed dot row (or top-right menu toggle — implementer to decide based on existing pattern).

## Live previews — sourcing strategy

The teaser chapters load real content via Astro Content Collections:
- Heritage teaser: `getCollection('queens')` → take crownNumber 1 entry (Yvonne).
- Diaspora teaser: no city markers (decorative globe only — no need to load cities).
- Cycle teaser: `getCollection('contestants')` filtered by current cycle, `sort by sortOrder`, take first 3.
- Quiz teaser: `getCollection('quiz-results')` → take all 7, render as archetype-name tiles with their `accentHex`.

This means: when real contestant portraits land in the future Phase 4.5 patch, the homepage automatically inherits them. No additional updates needed.

## Layout-wide font preload (the technical centerpiece)

Add to `src/layouts/BaseLayout.astro` `<head>` (and check that the existing `@fontsource-variable/*` declarations in `src/styles/global.css` or wherever they're imported use `font-display: optional`):

```html
<link rel="preload" as="font" type="font/woff2"
      href="/fonts/fraunces-latin-italic-wght-only.woff2" crossorigin />
<link rel="preload" as="font" type="font/woff2"
      href="/fonts/inter-latin-wght-only.woff2" crossorigin />
<link rel="preload" as="font" type="font/woff2"
      href="/fonts/jetbrains-mono-latin-wght-only.woff2" crossorigin />
```

Implementation choice:
- The `@fontsource-variable/*` packages ship multiple woff2 files per family (one per axis subset: opsz, soft, wonk, wght, full, standard). For preload we want the smallest viable variant — typically `wght-only` or `standard`.
- Copy the chosen subset for each family from `node_modules/@fontsource-variable/<family>/files/*.woff2` to `public/fonts/` at build time, OR import them via Vite and let the bundler put them in `_astro/`.
- Use `font-display: optional` (NOT `swap`) on the `@font-face` declarations so the font either loads in time and is used, or the fallback stays — no swap shift. This is the actual CLS fix.

Expected impact:
- Heritage `/heritage` mobile LCP: 3171ms → ~1500ms (preload removes the woff2 chain blocking LCP)
- Quiz `/quiz` mobile LCP: 3210ms → ~1500ms
- Diaspora `/diaspora` mobile CLS: 0.122 → near 0 (font-swap eliminated by `font-display: optional`)
- Homepage `/` mobile LCP: should be <2000ms post-preload; would meet the spec's 2500ms target.

## Motion-language consistency pass

Audit every existing chapter for timing outliers. Spec §8.2 timing tokens:
- 150ms micro
- 300ms component
- 600ms section reveal
- 1100ms hero cinematic
- Exit = 60–70% of enter

Apply: standardize any non-conformant transitions across HeroChapter, MissionChapter, CrownTeaserChapter, DiasporaTeaserChapter, CycleTeaserChapter, BecomeHerChapter. Most existing chapters likely conform — this is a polish + lint pass, not a rewrite.

## Apply CTA strategy preserved

Per the predecessor spec, "future contestants own the hero." The Hero's primary CTA stays "Apply for Crown XXVI" (or equivalent). The Quiz chapter (Ch VI) does NOT compete with Apply — it's positioned AFTER the contestants reveal so visitors have already seen the bar before being offered the quiz.

## Reduced-motion variant

Per-chapter (designed, not stripped):
- Hero: kente-loom parallax disabled, static gradient background
- Mission: scroll-tied opacity reveal becomes static (text visible immediately)
- Heritage mini-card: hover lift → border-color shift only
- Diaspora mini globe: 3D still renders but `controls.autoRotate = false`; static at lat 10, lng 0
- Cycle 3-up: card hover lifts removed
- Quiz teaser: archetype-tile sample animation (if any) disabled
- BecomeHer: button transition removed
- ChapterRail: dot transitions instant

Font preload still applies (perf benefit independent of motion preference).

## New design tokens

**None needed.** All visual treatment uses existing tokens. The per-archetype accent colors live in content (`quizResults.accentHex`), applied inline.

## Plan deltas anticipated

- **Mini globe React island on the homepage:** uses the same dynamic-import pattern from Phase 2's `DiasporaGlobe.tsx`. Likely just instantiate a smaller-sized variant (200×200 instead of 560px). If complexity grows, could extract a shared `<MiniGlobe>` primitive — defer until it actually needs to be reused.
- **Font subset selection:** the `@fontsource-variable/*` packages have multiple woff2 subsets per family. Implementer picks the smallest viable one per family at build time. If none is right, fall back to the static `@fontsource/*` package's specific weight files.
- **`font-display: optional` vs `swap`:** `optional` is the CLS fix. The trade-off is that fallback font may sometimes "stick" on slow connections (~5% of users). Acceptable per Spec §9 CLS gate.
- **ChapterRail mobile collapse:** the existing v1 might already handle mobile via the chapter-rail CSS; implementer audits and confirms behavior or improves it.
- **Live cycle/heritage data loading:** the home page already does this (per `src/pages/index.astro`). New work is just consuming the data in the elevated chapters' template, not adding new data fetches.

## Quality gates (per spec §9 — finally achievable post-preload)

- AA contrast ✓
- 44px touch targets ✓
- Full keyboard navigation (anchor between chapters, ChapterRail clickable) ✓
- Designed reduced-motion variant ✓
- Lighthouse mobile: Perf ≥ 0.9, A11y ≥ 0.9, BP ≥ 0.9, SEO ≥ 0.9
- **LCP < 2500ms (THE spec target — first phase to hit it after the font preload work)**
- CLS < 0.05
- Real content (no placeholders) on staging ✓

## Wireframe approved

All 7 chapters at-a-glance, Quiz chapter deep-dive, ChapterRail expansion, mobile stack, reduced-motion variant, font-preload code sketch — all approved 2026-05-22.

## Elevation completion

This is the final phase of the elevation spec. After Phase 5 ships, the four wow features + the homepage all live at `staging.missdiasporagh.org` at flagship quality. Per spec §10 ("Definition of Done"), the user-explicit cutover-readiness approval is the final gate; DNS cutover itself is its own ritual.

Documented Phase 4.5 follow-ups remain queued (Satori OG endpoints + real contestant portrait replacements) — they're independent of this phase's shipping bar.
