# Heritage Quiz Direction — Picked

**Date:** 2026-05-22
**Phase:** 4 — Heritage Quiz (`/quiz` + `/quiz/result/[region]` + `/quiz/og/[region].png`)
**Predecessor spec:** [`2026-05-20-mdgh-staging-elevation-design.md`](../2026-05-20-mdgh-staging-elevation-design.md) §7.6
**Prior annexes:** Phase 1 (Editorial Cinema), Phase 2 (Celestial Atlas), Phase 3 (Cover Lineup)

**Picked:** Direction A — Cinematic Story
**Why:** (1) matches spec §7.6 verbatim ("full-screen questions → animated reveal of personalized region archetype"); (2) reuses Phase 3's sash-numeral I-VI as progress dots — free brand cohesion; (3) lowest engineering risk while still ceremonial — the bar-chart-resolving-to-archetype reveal is pure CSS + transform, no GPU-heavy 3D card flips.

## Quiz UX flow

1. **Start screen** (`/quiz` initial state) — "Which Ghana *are you?*" headline, "Six questions · your homeland" eyebrow, saffron Begin button.
2. **Question screens** (Q1 → Q6) — full-screen ambient radial illustration, I-VI sash-Roman progress at top (current question rendered larger + glow), question centered in italic Fraunces clamp(28px, 4vw, 44px), 4 options in 2×2 grid below (mobile: stacked 1-up). Selection adds the option's `weights[]` to the per-region accumulator and advances to the next question.
3. **Reveal transition** (~800ms between Q6 and result) — horizontal bar chart of all 7 regions with their accumulated weights, sorted high-to-low. Saffron bar for the winner, dimmed saffron for the rest. "Counting the stars" mono eyebrow.
4. **Result page** (`/quiz/result/[region]`) — per-region accent radial (color from `quizResults.accentHex`), "YOU ARE" eyebrow, italic Fraunces region name clamp(72px, 12vw, 112px), italic shortLine, prose archetype description from MDX body, Share + Retake actions.

## Component model

- `<QuizEngine>` (React island, `client:load`) — holds the question index + per-region weight accumulator + advances on option selection. Final transition is a route navigation to `/quiz/result/<winning-slug>`.
- `<QuestionCard>` (React) — renders one question + 4 options + selected state. Pure presentation; QuizEngine handles state.
- `<ProgressDots>` (React) — renders I-VI with current dot highlighted via italic Fraunces sash-numeral language.
- `<ResultReveal>` (React) — bar-chart animation between Q6 and result. Mounts on Q6 completion, animates bars to their final widths over 800ms ease-out, then route-navigates.
- `<ResultHero>` (Astro) — full-bleed result page hero with accent gradient + archetype name + shortLine. Server-rendered.
- `<ShareButton>` (Astro with inline script) — Web Share API where available, falls back to copy-to-clipboard.

Reused primitives: `<MetaLabel>` (Phase 1).

## Scoring engine

A small TypeScript module at `src/lib/quiz/scoring.ts`. Public API:

```typescript
type Region = 'Greater Accra' | 'Ashanti' | 'Volta' | 'Northern' | 'Western' | 'Central' | 'Eastern';
type Weights = Record<Region, number>;

function emptyWeights(): Weights;
function applyAnswer(weights: Weights, optionWeights: Array<{ region: Region; weight: number }>): Weights;
function pickWinner(weights: Weights, answerOrder: Region[]): Region;
function regionToSlug(region: Region): string;   // "Greater Accra" → "greater-accra", "Volta" → "volta"
```

`pickWinner` sorts regions by total weight descending; on tie, the region that appeared earliest in `answerOrder` wins (each answer's strongest region pushes onto that list).

## Routes

- `/quiz` — interactive single-page experience. Astro renders PageLayout + `<QuizEngine client:load />`. No SSR data fetch beyond loading the 6 questions + 7 results (passed as props to the React island).
- `/quiz/result/[region]` — SSR per-region result page. Resolves the region slug → quizResult entry via `getCollection('quizResults').find(...)`. Renders `<ResultHero>` + MDX body. Uses the SSR pattern proven in Phase 3 (no `prerender + getStaticPaths`).
- `/quiz/og/[region].png` — Astro endpoint that returns `image/png` content type. Uses Satori to render archetype card as SVG, then resvg-wasm to rasterize. Edge-cacheable via `cache-control: public, max-age=86400`.

## OG image generation (Satori on Workers)

- Astro endpoint at `src/pages/quiz/og/[region].png.ts` exports `GET({ params, locals })` and returns a `Response` with `image/png` content type.
- Stack: `satori` (Vercel's library) + `@resvg/resvg-wasm` (WASM rasterizer compatible with Cloudflare Workers).
- Fraunces font ships as a `.ttf` in `public/fonts/Fraunces-Italic.ttf` (or fetched from Google Fonts at first request and cached).
- Output: 1200×630 PNG with the archetype name (italic Fraunces), shortLine (italic Fraunces smaller), accent gradient pulled from `quizResults.accentHex`, MDGH logo bottom-right.
- The result page sets `<meta property="og:image" content={`/quiz/og/${slug}.png`} />` and matching `twitter:image`.

## Content seed

**6 questions** (`src/content/quiz-questions/01-06.json`) — order, question text, 4 options each with weights[] across the 7 regions (weights 0-5). Goal: every region should have at least 2 questions where it can win.

Suggested questions (theme: home / rhythm / value / wisdom / craft / dream):

| Q | Theme | Sample |
|---|---|---|
| 1 | A moment of home | "Which moment feels most like home?" |
| 2 | Rhythm | "What rhythm carries you on a good day?" |
| 3 | A value | "Which value did your grandmother live?" |
| 4 | A craft | "What does your hand know how to make?" |
| 5 | Wisdom kept | "What kind of wisdom keeps you steady?" |
| 6 | A dream | "What do you dream of building?" |

**7 results** (`src/content/quiz-results/{greater-accra,ashanti,volta,northern,western,central,eastern}.mdx`) — region, archetypeName, shortLine, accentHex, archetype prose body.

Suggested archetypes + accents:

| Region | Archetype | Accent | One-liner |
|---|---|---|---|
| Greater Accra | "The Bridge-Builder" | #FF7EB3 (rose) | The connector. The translator. |
| Ashanti | "The Crown-Bearer" | #FFD166 (saffron) | The keeper of weight. The carrier of legacy. |
| Volta | "The River-Bearer" | #4EBDFF (sky) | The keeper of stories that arrive in chorus. |
| Northern | "The Sun-Walker" | #FF9D5C (terracotta) | The one who walks long in dust and patience. |
| Western | "The Tide-Reader" | #5CFFCE (sea-foam) | The one who reads what the ocean leaves behind. |
| Central | "The Door-Keeper" | #B084FF (orchid) | The one who remembers what others came through. |
| Eastern | "The Hill-Watcher" | #80C97F (sage) | The one who sees the long story from a slow place. |

Each archetype's body: 2-3 paragraphs in the editorial voice established by Phase 1's Yvonne Kofigah bio + Phase 3's contestant bios.

## New design tokens

**None needed.** Accent colors live in the content collection (`quizResults.accentHex`) and are applied inline via CSS custom property on the result page. Keeps the design system clean — region accents are content, not design tokens.

## Plan deltas anticipated

- **Satori + resvg-wasm bundle on Cloudflare Workers:** known-good combo but requires the right packaging. Bundle size adds ~150-300KB to the Worker. Acceptable since it only runs on `/quiz/og/*` route (other routes don't touch it).
- **Font loading for Satori:** Fraunces Italic font must be available as ArrayBuffer at request time. Cleanest: ship the `.ttf` in `public/fonts/` and fetch via `fetch(`/fonts/Fraunces-Italic.ttf`)`. Or import the binary directly into the bundle. To be decided in implementation.
- **React island JSX with Satori:** Satori uses a JSX-like syntax for its layout, which is NOT the same as React JSX. Inside `/quiz/og/[region].png.ts`, we write Satori-flavored markup (inline styles only, limited CSS subset). Not full TSX.
- **SSR pattern reaffirmed:** /quiz/result/[region] uses the same SSR pattern Phase 3 proved (no prerender + getStaticPaths, just `Astro.params.region` + `getEntry`). Lesson carried forward.
- **Per-contestant OG images:** the same Satori plumbing built for /quiz/og can be reused for /contestants/og/<slug>.png in a Phase 4.5 patch. Out of scope for this phase but flagged.

## Quality gates

- E2E (Playwright): start screen → click Begin → answer Q1 → reaches Q2; complete all 6 → reveal animation → result page renders the right region. Keyboard nav works. Reduced-motion strips animations.
- Lighthouse mobile: Perf ≥ 0.9, A11y ≥ 0.9, BP ≥ 0.9, SEO ≥ 0.9 — same Phase 2/3 bar. /quiz uses React island, so TBT may be > 0 but should be < 200ms.
- OG endpoint: `curl -I /quiz/og/volta.png` returns `image/png` with valid PNG body (first 8 bytes match PNG signature).
- All 7 regions navigable to their result page.
