# Diaspora Globe Direction — Picked

**Date:** 2026-05-21
**Phase:** 2 — Diaspora Globe
**Predecessor spec:** [`2026-05-20-mdgh-staging-elevation-design.md`](../2026-05-20-mdgh-staging-elevation-design.md)
**Phase 1 annex (for pattern reference):** [`2026-05-20-heritage-direction.md`](./2026-05-20-heritage-direction.md)

**Picked:** Direction B — Celestial Atlas
**Why:** (1) Gold wireframe on navy reads as *celestial* + *old-world atlas* — both pageant-coded metaphors that reinforce "the crown" and "legacy" themes carried over from Heritage. (2) Uses only existing tokens (saffron, royal-violet, obsidian, rose) — no new color additions required. (3) Lowest "tech demo" risk of the four candidates — feels like a wood-paneled-library heritage object, not a SaaS dashboard.

## Pattern + Style (from UI/UX Pro Max)

Three queries against UI/UX Pro Max all converged on the same base: **Immersive/Interactive Experience** pattern + **Liquid Glass** style (best for "premium SaaS, high-end e-commerce, creative platforms, branding experiences, luxury portfolios"). On top of this base, Direction B specifies the globe's specific visual treatment: gold wireframe + star markers on navy/violet sphere.

## Globe specification

- **Sphere material:** `radial-gradient(circle at 35% 30%, rgba(107, 43, 217, 0.35), rgba(26, 8, 51, 0.95))` — subtle royal-violet highlight at top-left, obsidian-deep elsewhere. Inset shadow for depth (`inset -20px -20px 60px rgba(0, 0, 0, 0.5)`). Faint saffron glow outside (`box-shadow: 0 0 80px rgba(255, 209, 102, 0.08)`).
- **Wireframe (latitude lines):** horizontal lines at 20% / 35% / 50% / 65% / 80%, with opacity 0.18 → 0.25 → 0.35 → 0.25 → 0.18 (equator most prominent, poles fade). Color: `rgba(255, 209, 102, X)` (saffron at varying alpha).
- **Wireframe (longitude lines):** vertical lines at 25% / 40% / 55% / 70% / 85%, with opacity 0.2 → 0.28 → 0.32 → 0.28 → 0.2 (prime meridian most prominent).
- **In Three.js terms:** these are visual cues — the actual `react-globe.gl` rendering may use the library's `globeImageUrl` with a custom dark-with-gold-lines texture, OR programmatic graticule lines. Implementer to pick whichever is performant.

## Marker specification (cities)

- **Shape:** 4-point gold star (CSS `clip-path: polygon(50% 0%, 61% 35%, 98% 35%, 68% 57%, 79% 91%, 50% 70%, 21% 91%, 32% 57%, 2% 35%, 39% 35%)`) for HTML/SVG fallback; equivalent custom Three.js geometry for the 3D globe.
- **Size:** `8px + (queensCount + contestantsCount) * 2px`, capped at `18px`. The founder city (Accra, 1 queen + 3 contestants = 4 activity) ≈ 14px star.
- **Color:** `var(--color-saffron, #FFD166)` with `drop-shadow(0 0 6px rgba(255, 209, 102, 0.6))`.
- **Opacity at idle:** scales with activity — 1.0 for the busiest city, 0.5 minimum for the quietest. Active = always 1.0.
- **Twinkle animation:** subtle opacity oscillation `0.7 → 1.0` over 2s ease-in-out, alternating, with `60ms` stagger per star. Gated behind `prefers-reduced-motion: no-preference`.

## Active state (city clicked)

- Globe rotates slowly to face the active city (1100ms emphasized easing, per spec §8.2's "hero cinematic" duration).
- Other markers dim to `opacity: 0.3`.
- Active marker scales to `18px` (max) with stronger drop-shadow.
- Illuminated gold meridian line drawn through the active city: `linear-gradient(180deg, transparent 0%, #FFD166 40%, #FFD166 60%, transparent 100%)` with `box-shadow: 0 0 8px rgba(255, 209, 102, 0.8)`.
- Bottom drawer slides up (transform translateY 100% → 0, 280ms emphasized easing).

## Detail panel — bottom drawer

- **Desktop (≥1024px):** drawer occupies bottom 40vh. Grid: `1fr 280px` (bio + meta on left, hero image on right). `border-top: 1px solid rgba(255, 209, 102, 0.25)`. `backdrop-filter: blur(12px)`.
- **Mobile (<768px):** drawer becomes full-screen modal (`min-height: 96vh`). Hero image moves above bio. Swipe-down to dismiss + close button always visible.
- **Contents:** MetaLabel (`CITY · COUNTRY · N QUEENS · M CONTESTANTS`), italic Fraunces city name (`clamp(36px, 5vw, 56px)`), prose bio (MDX body), related-queens chips (using existing MetaLabel + opt-in routing to `/heritage`), related-contestants chips, optional hero image, optional embedded video.
- **Bio rendering:** reuses the Phase 1 hidden-bio-div pattern (`<div data-city-bio="<slug>" hidden>{Content}</div>` siblings).

## Mobile + reduced-motion fallback

- **Three.js does NOT load on `<768px`** or when `prefers-reduced-motion: reduce`. Globe is replaced by a static SVG world map (custom-drawn, three-continent simplified silhouette: Africa, Eurasia, Americas) with gold star markers positioned by lat/lng → SVG coordinate transform.
- **Mobile primary nav:** list of cities with name + country + activity count chips. Map is decorative; list is the affordance.
- **Reduced-motion desktop:** static SVG fills the globe's space (larger, more elaborate than the mobile version). All animation removed; markers visible without twinkle.

## New design tokens needed

- `--color-drawer-surface: linear-gradient(180deg, rgba(10, 4, 20, 0.95) 0%, #050111 100%)` — gradient for the bottom drawer's background (introduces a translucent darker surface so the globe is dimly visible behind the drawer when partly transparent).
- `--color-drawer-border: rgba(255, 209, 102, 0.25)` — top edge of drawer.

Both added to `mdgh-staging/src/styles/tokens.css` per phase rules (named for the phase that introduces them, additive only).

## Architecture decisions

- **Globe library:** `react-globe.gl` (Three.js wrapper). Lazy-loaded as a React island via Astro's `client:visible` directive — won't load until the globe scrolls into view. Adds ~500KB to the page that uses it; mitigated by lazy-load.
- **Component model:**
  - `<CityMarker>` — small SVG star shape with `size` + `opacity` + `tone` props. Reused in 3D globe (as custom Three.js geometry texture), 2D fallback (as positioned absolute), and city list (as small inline icon).
  - `<CityDrawer>` — bottom-drawer detail view with focus management + ESC/swipe-down/close-button dismiss + reduced-motion variant. Phase 1's QueenModal generalization candidate (see below).
  - `<DiasporaGlobe>` (React island) — wraps react-globe.gl with the picked visual treatment.
  - `<DiasporaFallback>` — static SVG world map + city list, no JS deps.
  - `<DiasporaPage>` — orchestrator: feature-detects + renders either Globe or Fallback. Server-renders Fallback by default; hydrates Globe on client if conditions met.
- **`<QueenModal>` → shared `<Modal>` refactor:** the spec §8.4 anticipated a generic Modal primitive. Phase 2 is the second consumer (CityDrawer); ideally this is the time to extract. **Pragmatic call:** the QueenModal's behavior (focus trap, ESC, scale+fade) is generic but its template-cloning pattern is bespoke. CityDrawer is structurally similar but has a different motion (slide-up vs scale+fade) and layout (bottom strip vs centered card). Extract IFF the implementer subagent finds clean shared abstraction during build; otherwise keep them parallel and defer the extraction to Phase 3 (Contestants, third consumer). Plan tasks tentatively keep them parallel.

## Wireframe approved
Desktop idle (large globe), desktop active (drawer up + meridian illuminated), mobile (static SVG + city list), reduced-motion (static SVG no JS) all approved on 2026-05-21.

## Content seed (T-content)

At least these cities seeded for Phase 2 launch:

| Slug | Name | Country | Lat/Lng | Activity | Note |
|---|---|---|---|---|---|
| `accra` | Accra | Ghana | 5.5602 / -0.1969 | 1 queen + 3 contestants (founder city) | Required for the founder's connection point — Yvonne Kofigah's `relatedQueens` entry |
| `london` | London | UK | 51.5074 / -0.1278 | 0 queens + 2 contestants | Largest diaspora pop in Europe |
| `new-york` | New York | USA | 40.7128 / -74.0060 | 0 queens + 1 contestant | NA flagship |
| `toronto` | Toronto | Canada | 43.6532 / -79.3832 | 0 queens + 1 contestant | NA secondary |
| `atlanta` | Atlanta | USA | 33.7490 / -84.3880 | 0 queens + 1 contestant | Cultural anchor for Ghanaian-American community |

Brief MDX bio body per city — 2-3 sentences each at minimum, more for Accra.

## Plan deltas anticipated

- The `cities` collection schema already exists in `src/content/config.ts:204-216` (or thereabouts — verify during execution). Field names: `name`, `country`, `lat`, `lng`, optional `heroImage`/`heroImageAlt`, optional `video`, `relatedQueens` (string[]), `relatedContestants` (string[]). No `currentRole`/`role`-style fields. Plan adapts to this schema, not Phase 1's queens schema.
- `react-globe.gl` ships with peer-dependency `three`. Both need installing. May surface bundle warnings on Astro build — manageable.
- The `relatedQueens` field is a `string[]` of queen slugs (e.g. `["yvonne-kofigah"]`) — NOT a `reference()` collection ref. Bidirectional linking is the page's responsibility, not the schema's. Worth a memory note.

## Quality gates (per phase 1 baseline)

Same as Phase 1 (`§9` of the elevation spec): AA contrast, 44px touch targets, keyboard nav full coverage, designed reduced-motion variant (the static SVG IS the variant), Lighthouse mobile ≥ 0.9 per category, CLS < 0.05, INP < 200ms. **LCP threshold relaxed to "no worse than Phase 1's 3171ms"** since the layout-wide font chain is the dominant LCP factor (still deferred to Phase 5).

**Phase 2-specific additions:**
- Three.js bundle must NOT load on mobile or reduced-motion (verify in build output and Lighthouse network panel).
- Hovering a city marker must show its name (tooltip or label) — basic affordance.
- Drawer dismissal preserves globe rotation state (don't reset to start position when closed).
