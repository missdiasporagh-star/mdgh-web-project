# Heritage Direction — Picked

**Date:** 2026-05-21
**Phase:** 1 — Heritage Timeline
**Predecessor spec:** [`2026-05-20-mdgh-staging-elevation-design.md`](../2026-05-20-mdgh-staging-elevation-design.md)
**Plan:** [`2026-05-20-mdgh-heritage-timeline-implementation.md`](../../plans/2026-05-20-mdgh-heritage-timeline-implementation.md)

**Picked:** Direction A — Editorial Cinema
**Why:** Brand alignment. Italic Fraunces is already the ceremonial voice on the staging homepage; existing saffron-on-obsidian palette carries the direction without inventing new tokens; "statement design" matches the spec's "out of this world" intent; ships well at flagship quality without depending on dramatic studio photography of every queen (which Direction D would have required).

## Pattern
Portfolio Grid adapted to **horizontal scroll-snap-x mandatory** (per spec §7.1). Vertical masonry / stack fallback at `<768px`. IntersectionObserver tracks the centered active card.

## Style
**Exaggerated Minimalism** — bold oversized typography, high-contrast portraiture, massive deliberate whitespace, statement design. Anti-pattern guardrail: never cluttered.

## Typography
- **Display:** Fraunces Variable (italic, 500 weight, opsz ~120) for queen names — clamp the modal title to `clamp(36px, 6vw, 72px)`; card-level name to `clamp(24px, 3vw, 32px)`
- **Body / UI:** Inter Variable (400 body, 600 emphasis) for bios, navigation copy, helper text
- **Meta / wayfinding:** JetBrains Mono Variable (600 weight) uppercase `letter-spacing: 0.25em` — used for year badges, crown numbers, era labels

## Color application
- **Foundation:** `--color-obsidian` `#050111` (page background)
- **Card surface:** `linear-gradient(180deg, var(--color-deep-violet) 0%, var(--color-obsidian) 100%)` — `#1A0833 → #050111`
- **Card border (idle):** `rgba(107, 43, 217, 0.25)` (royal-violet at low opacity)
- **Card border (hover/focus):** `rgba(255, 126, 179, 0.55)` (rose, more prominent)
- **Active year badge / crown number:** `--color-saffron` `#FFD166`
- **CTA / focus ring:** `--color-saffron` `#FFD166`
- **Modal scrim:** `rgba(5, 1, 17, 0.55)` + `backdrop-filter: blur(6px)`
- **Modal card border:** `rgba(255, 209, 102, 0.2)` (saffron at low opacity for warmth)

## Motion language
- **Card hover (desktop):** `transform: translateY(-4px)` + border-color shift, `200ms cubic-bezier(.4, 0, .2, 1)` (standard easing)
- **Card focus-visible (keyboard):** same transform + `box-shadow: 0 0 0 2px var(--color-saffron)` focus ring
- **Modal entry:** `transform: scale(0.96) → scale(1)` + `opacity: 0 → 1`, `280ms cubic-bezier(.2, .7, .1, 1)` (emphasized easing — theatrical)
- **Modal exit:** same transform reversed, duration cut to `~200ms` (per spec §8.2 "exit 60–70% of enter")
- **Card stagger on initial render:** `30–50ms` per card (per spec §8.2)
- **Reduced-motion variant (designed, not stripped):**
  - All `transform`s become `none`
  - Modal entry/exit use opacity-only fade (200ms linear)
  - Scroll-snap → regular horizontal scroll (`scroll-snap-type: none`)
  - Hover translateY removed; border-color and outline-on-focus still active for affordance

## Key effects
- Massive italic Fraunces names on detail modal (`clamp(36px, 6vw, 72px)`)
- Tight letter-spacing on display (`-0.02em` on names, `-0.03em` on modal title)
- JetBrains Mono labels (`0.25em` letter-spacing, uppercase, 11px) for editorial wayfinding
- Subtle saffron glow on active/hovered states — never on idle (avoid visual noise)
- Card portrait gets a film-grain layer (8% opacity, multiply blend) via the shared `<Portrait>` primitive — adds editorial warmth

## New tokens needed
**None — uses existing tokens.** The direction is fully expressible with the staging repo's current `tokens.css` (obsidian, deep-violet, royal-violet, saffron, rose, text-1/2/3/4). T5 of the plan becomes a no-op.

## Wireframe approved
Desktop (≥1024px scroll-snap rail), mobile (<768px vertical stack), reduced-motion (designed variant — scroll-snap off, transforms off, opacity-only modal, focus rings preserved), and modal (scale+fade entry, side-by-side portrait + bio + achievements) all approved on 2026-05-21.

## Plan deltas discovered during T0-T2
- **T3 (queens schema)** is a no-op — schema already exists in `mdgh-staging/src/content/config.ts:181-202`. Field names differ from the plan: actual schema uses `heroImage` / `heroImageAlt` (not `photo` / `photoAlt`), `crownNumber: number` (not string Roman numeral), `eraTheme` (not `era`), `currentCity` / `currentRole` (not `city` / `role`), `social` (not `socials`). Downstream tasks adapt to existing field names rather than modify the schema.
- **T5 (Heritage tokens)** is a no-op — direction A uses only existing tokens.
- **T0 dev server step** skipped during controller execution to avoid blocking; subagents verify their work via `astro sync` + typecheck without keeping a long-running server.
