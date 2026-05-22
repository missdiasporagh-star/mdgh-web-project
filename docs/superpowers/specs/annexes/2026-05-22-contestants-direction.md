# Contestant Hub Direction — Picked

**Date:** 2026-05-22
**Phase:** 3 — Contestant Hub (`/contestants` + `/contestants/[slug]`)
**Predecessor spec:** [`2026-05-20-mdgh-staging-elevation-design.md`](../2026-05-20-mdgh-staging-elevation-design.md) §7.5
**Phase 1 annex:** [`2026-05-20-heritage-direction.md`](./2026-05-20-heritage-direction.md) (Editorial Cinema baseline)
**Phase 2 annex:** [`2026-05-21-diaspora-direction.md`](./2026-05-21-diaspora-direction.md) (Celestial Atlas)

**Picked:** Direction A — Cover Lineup
**Why:** (1) Matches spec §7.5 most literally — uniform 3-up grid, each card = full portrait + name + region + cycle badge with hover video preview; (2) the magazine-cover metaphor is pageant-coded and reads as "these are Crown XXVI's cover stars"; (3) doesn't depend on having video for every contestant (graceful fallback to static portrait); (4) preserves Heritage's editorial restraint while keeping section identity distinct from Diaspora's celestial atlas.

## Pattern + Style

UI/UX Pro Max queries converged on **Portfolio Grid** pattern + **Swiss Modernism 2.0** style for the "magazine editorial fashion portrait gallery" query — clean rational grid, mathematical spacing, asymmetric internal layout per card. Direction A applies this base with our existing palette + Fraunces/Inter/JetBrains Mono typography.

## Card composition (`<ContestantCard>`)

- **Aspect ratio:** 3 / 4 (uniform across all cards)
- **Background:** `linear-gradient(180deg, var(--color-deep-violet) 0%, var(--color-obsidian) 100%)` — same as Phase 1's QueenCard gradient
- **Border:** `1px solid rgba(107, 43, 217, 0.25)` idle, `rgba(255, 209, 102, 0.4)` hover/focus
- **Engraved Roman sash number (top-left):** `font-family: Fraunces; font-style: italic; font-weight: 700; font-size: clamp(48px, 6vw, 72px); color: rgba(255, 209, 102, 0.7); text-shadow: 0 2px 6px rgba(0,0,0,0.6), 0 -1px 0 rgba(255, 250, 200, 0.2);` — the dual-shadow gives the metal-engraved feel
- **Hover state:** card translates `translateY(-3px)`, border shifts to saffron-tinted, sash number opacity increases to `0.85`. Pink-dot indicator (top-right) flashes when video preview starts.
- **MetaLabel (bottom-left):** `CROWN {cycle.crownNumber} · {region.toUpperCase()}` — saffron tone, JetBrains Mono
- **Italic Fraunces name (bottom-left):** `clamp(22px, 2.5vw, 28px)`, weight 500, line-height 1
- **Hover video preview:** native `<video muted playsinline preload="none" loop>` element overlays the card at low opacity (50%) on hover, lazy-loaded only on mouseenter. Falls back to static gradient if `heroVideo` not present. Pauses + resets on mouseleave. Disabled entirely under `prefers-reduced-motion: reduce`.

## Detail page (`/contestants/[slug]`)

Dedicated dynamic route — NOT a modal. Each contestant gets a shareable URL.

- **Hero (full-bleed, ~520px desktop, ~360px mobile):**
  - If `heroVideo` present: poster image with center play button → click plays unmuted in-place
  - If only `heroImage`: static portrait
  - Bottom-left overlay: MetaLabel (`CROWN {cycle} · SASH {romanNumeral} · {region}`) + italic Fraunces name `clamp(48px, 7vw, 96px)`
  - Top-right: `<VotingDisabled>` button (disabled, copy "Opens during finale week") with the explanatory subtext below it
- **Below hero — 2-column content area:**
  - Left (60%): bio prose (MDX body) preceded by MetaLabel "HER STORY"
  - Right (40%): `<CharityPanel>` sidebar with title + description + URL link, surfaced inside a translucent panel with saffron-tinted border
- **Gallery row (4-up grid):** images and videos from `contestants[].gallery` (via `mediaRef` schema). Uses `<Portrait>` for images, `<DriveEmbed>`/`<YouTubeEmbed>` for video refs (already in component library from spec §8.4).
- **Footer row:** back-to-grid link (left) + social chips (right) for Instagram/TikTok

## Mobile (<768px)

- Index: 1-up stack, larger sash numerals
- No hover video on mobile — tap card → route to detail
- Detail: same content stacked single-column; hero shrinks to ~360px; gallery becomes 2-up

## Reduced-motion variant (designed, not stripped)

- Hover-triggered video preview disabled entirely (no autoplay event hooked)
- Card `translateY(-3px)` hover lift → border-color shift only
- No staggered card reveal on scroll — all cards appear at once
- Detail page hero video already click-to-play, doesn't autoplay
- Focus-visible saffron outline preserved everywhere

## New design tokens needed

**None.** All visual treatment uses existing tokens (saffron, royal-violet, rose, obsidian, deep-violet, drawer-surface from Phase 2 reusable for the charity-panel sidebar background, etc.).

## Plan deltas anticipated

- **Contestant portraits:** real photos likely don't exist yet. Phase 3 ships with **gradient placeholder JPGs** (generated via Node script or committed as small SVG-to-PNG outputs) carrying the sash number — replaceable with commissioned portraits later. The `<Portrait>` primitive already handles arbitrary `src` values; this is content-side only.
- **Cycle reference:** the existing `cycles/2026.json` is the current cycle. Page queries `getCollection('cycles', e => e.data.status === 'current')[0]` then filters `contestants` by `data.cycle.id === currentCycle.id`. If no current cycle exists, page shows "Cycle not open" empty state.
- **Hover video implementation:** native `<video>` element, NOT a React island. Three.js's lesson (`client:visible` + dynamic-import) doesn't apply here — `<video preload="none">` is already lazy by default.
- **Per-contestant OG images:** deferred to Phase 4 (where Satori on Workers is in scope for the Quiz feature). Phase 3 ships with the standard PageLayout OG.

## Component reuse from prior phases

- `<MetaLabel>` (Phase 1) — for crown/sash/region labels
- `<Portrait>` (Phase 1) — for heroImage rendering with film-grain treatment (`plain={true}` may be appropriate to disable grain on the magazine-cover portraits — to be decided in T3)
- `<DriveEmbed>` / `<YouTubeEmbed>` (already in spec component library) — for gallery videos
- Hidden-bio-div pattern (Phases 1 + 2) — NOT needed here; detail page natively renders MDX via `<Content />` since each contestant has its own route

## Wireframe approved
Desktop index (3-up grid + hover state on card 1), mobile index (1-up stack), detail page (`/contestants/[slug]` full-bleed hero + 2-col bio/charity + gallery row + social footer), reduced-motion variant — all approved 2026-05-22.

## Content seed (T-content)

6 contestants for Cycle XXVI. Each with:
- Required: `name`, `cycle: reference('cycles', '2026')`, `heroImage` (placeholder path), `heroImageAlt`, `sortOrder`
- Optional but-recommended for shipping demo: `region`, `sashNumber`, `charityPlatform`, `social.instagram`, bio MDX body
- Skip for now: `heroVideo`, `gallery` (graceful empty arrays — components handle the missing-content case)

Suggested seed names (placeholder identities — replace with real contestants when commissioned):

| Sash | Name | Region |
|---|---|---|
| I | Ama Boateng | Ashanti |
| II | Akua Mensah | Volta |
| III | Esi Owusu | Greater Accra |
| IV | Yaa Asantewaa | Northern |
| V | Adwoa Asare | Western |
| VI | Abena Sarpong | Central |

(Names are common Ghanaian first names + surnames — culturally consistent without claiming to represent real individuals.)
