# Miss Diaspora Ghana — Staging Elevation Design Spec

**Spec ID:** 2026-05-20-mdgh-staging-elevation
**Scope:** Elevation of `staging.missdiasporagh.org` from v1 (current) to flagship-quality v2 ("out of this world")
**Status:** Draft — awaiting user review
**Author:** ohwpstudios@gmail.com (with Claude Opus 4.7 1M-context)
**Date:** 2026-05-20
**Predecessor:** [`2026-04-26-mdgh-platform-redesign-design.md`](./2026-04-26-mdgh-platform-redesign-design.md)

---

## 1. Vision

The `mdgh-staging` Pages project already carries a substantial v1 redesign — obsidian/saffron palette, "She wears the future." tagline, six-chapter cinematic homepage, Akwaaba greeting overlay, 14 pages stubbed or built. This spec governs the **v1 → v2 elevation**: pushing each wow feature to the polish ceiling described by UI/UX Pro Max, completing the four wow features that are still unbuilt, and finishing with a homepage maximalism pass once the destinations exist.

The driving intent is not redesign — it's elevation. The brand world ("Neo-African Futurism"), the audience strategy (future contestants own the hero), the color/typography tokens, and the page structure from the predecessor spec are all carried forward. What changes is depth, motion, content authenticity, and the consistent application of UI/UX Pro Max design intelligence at each step.

The success bar is "out of this world" — defined operationally as: every wow feature reaches a state where a critical viewer could not name three specific changes that would improve it. There is **no fixed deadline**; quality > speed.

## 2. Relationship to Predecessor Spec

The `2026-04-26-mdgh-platform-redesign-design.md` spec defined:
- Information architecture (13 pages + 2 dynamic templates)
- Visual design system (palette, typography, spacing, motion, components)
- The six wow features (Cinematic Scroll, Heritage Timeline, Cultural Greeting, Diaspora Globe, Contestant Hub, Heritage Quiz)
- Content collection schemas
- Tech architecture (Astro 5, Content Collections, Cloudflare Pages)

**That spec is the floor, not the ceiling.** This elevation spec inherits all of it; nothing there is overturned. Where this spec adds new material, it is additive (new motion primitives, new shared components, UI/UX Pro Max integration model). Where this spec narrows scope (e.g. defers a non-essential feature), the deferral is explicit and time-bounded.

## 3. Scope

### 3.1 IS

- **Sequenced execution** of the four unbuilt wow features (Heritage Timeline, Diaspora Globe, Contestant Hub, Heritage Quiz) at flagship quality, in the order defined in §5.
- **A consistent per-phase method** (six steps, three approval gates) that every wow feature passes through — see §6.
- **UI/UX Pro Max integration** at the Direction step of each phase, surfacing 3–4 candidate visual directions per feature for user selection.
- **A homepage maximalism pass** as the final phase, undertaken only once the destinations exist.
- **Cross-cutting cohesion work**: shared motion language, shared UI primitives, content collection architecture, repo workflow conventions — applied uniformly across every phase.
- **Quality gates per phase**: AA contrast, 44px touch targets, full keyboard navigation, designed reduced-motion variants, Lighthouse ≥ 90 mobile, LCP < 2.5s, CLS < 0.05, real (non-placeholder) content on staging.

### 3.2 IS NOT (deferred or out of scope)

- **The contestant application form** at `apply.missdiasporagh.org` — owned by the existing Worker (`mdgh-app`), governed by `2026-05-06-contest-application-form-design.md`, unaffected by this elevation.
- **Live voting, AR crown try-on, AI pageant coach** — Spec 3 work; not in scope.
- **Multi-language UI** — English-only v2.
- **A web admin CMS** — content authoring stays in the repo (markdown / MDX in `src/content/`).
- **Production cutover** — pointing `missdiasporagh.org` apex DNS at `mdgh-staging` is a deployment decision, handled in a separate cutover ritual after this elevation lands. Out of scope here.

### 3.3 Hard Constraint Carried Forward

The Asset Reuse Inventory from §3.3 of the predecessor spec stands: only the listed logos, partner logos, photography (Yvonne Kofigah portrait, About MDGH), and intro video may be reused from the legacy site. Everything else — color, type, layout, components, animation, photography treatment, prose voice — remains replaced.

## 4. Sequence (the five phases)

| # | Phase | URL | Rationale for order |
|---|---|---|---|
| 1 | **Heritage Timeline** | `/heritage` | The destination the homepage hero teases ("Twenty-six queens. One legacy."). Showcasing legacy unblocks press/sponsors who want proof. |
| 2 | **Diaspora Globe** | `/diaspora` | The current globe-stub on the homepage teaser is the most visible placeholder. Replacing it lifts the perceived completeness of the whole site. |
| 3 | **Contestant Hub** | `/contestants`, `/contestants/[slug]` | The page Crown XXVI applicants will compare themselves against. Has to feel like the front cover of a magazine. |
| 4 | **Heritage Quiz** | `/quiz` | Most viral-shareable feature. Dynamic OG image generation (Satori on Workers) makes shares look on-brand. Drives the social loop. |
| 5 | **Homepage maximalism** | `/` | Done last because the homepage teases the destinations — easier to compose the final cinematic once we know what's downstream. |

Each phase ships independently to staging. Progress is always visible at `staging.missdiasporagh.org`.

## 5. Per-Phase Method

Every phase passes through the same six-step loop. Three explicit user-approval gates (Steps 2, 3, 5).

| Step | Activity | User-visible artifact | Approval gate |
|------|----------|----------------------|---------------|
| 1 | **Discovery** — read spec section, examine existing stub/code, define data model, write a 5–8 line brief | Brief in terminal | None (informational) |
| 2 | **Direction** — query UI/UX Pro Max (`--design-system` + relevant domain searches), surface 3–4 visual directions side-by-side in the visual companion | Mockups in browser | **Yes** — user picks one |
| 3 | **Wireframe** — layout sketch, interaction map, motion timing, given the picked direction | Wireframe + flow diagram in browser | **Yes** — structure approved before code |
| 4 | **Build** — Astro components, content collection wiring, motion implementation, accessibility/performance hits, on a feature branch of `mdgh-staging` | Progress updates in terminal | None (not on staging yet) |
| 5 | **Deploy + verify** — push to `main` of `mdgh-staging`, Cloudflare auto-builds, user opens live URL | Live URL on `staging.missdiasporagh.org` | **Yes** — ship-or-iterate decision |
| 6 | **Wrap** — save learnings to project memory, transition to next phase | Phase-complete summary in terminal | Implicit (next phase begins) |

Iteration within a phase loops back from the gate to the prior step (Step 5 → Step 4, etc.). Phases do not run in parallel; each finishes before the next begins.

## 6. UI/UX Pro Max Integration Model

The `ui-ux-pro-max` skill (50+ styles, 161 color palettes, 57 font pairings, 161 product types, 99 UX guidelines, 25 chart types) is invoked at **Step 2 of every phase** and on-demand for narrow questions.

**Invocation pattern at Step 2:**

```bash
python3 ~/.claude/skills/ui-ux-pro-max/scripts/search.py \
  "<feature-keywords>" --design-system -p "MDGH <Feature>"
```

The CLI returns a structured design system recommendation (pattern, style, colors, typography, effects, anti-patterns). I synthesize 3–4 candidate directions per feature by varying the query keywords or supplementing with domain-specific searches (`--domain style`, `--domain typography`, `--domain color`). The candidates are shown side-by-side in the visual companion; the user picks one.

**Color adaptation rule:** UI/UX Pro Max returns generic palettes (often light-mode/blue). When recommended palettes conflict with the brand, the *logic* transfers (which slot is the CTA, which is metadata, etc.) but the *values* are mapped onto our existing tokens (obsidian / saffron / royal-violet / rose) — preserving brand continuity.

**Typography adaptation rule:** Same logic. UI/UX Pro Max may suggest Playfair Display + Inter for an "elegant editorial luxury" mood; we keep our spec'd Fraunces + Inter + JetBrains Mono since they sit in the same mood and are already in the brand.

## 7. Phase 1 — Heritage Timeline (deep-dive)

### 7.1 Spec mandates (inherited from predecessor §7.2)

- **Route:** `/heritage`
- **Interaction:** horizontal scroll-snap timeline; each card = full-height portrait + year badge + crown number + name. Click → expanded modal with full bio, photo gallery, current city/role.
- **Input:** arrow keys, trackpad horizontal, mobile swipe. Vertical list fallback at < 768px.
- **Tech:** CSS `scroll-snap-x mandatory` + IntersectionObserver. Lazy-load images. `prefers-reduced-motion` swaps to a designed static stack (not a stripped one).
- **Data source:** `queens[]` Astro Content Collection.

### 7.2 Content Collection schema — `src/content/queens/<slug>.mdx`

```yaml
---
name: string                  # required
slug: string                  # required, unique
crownNumber: string           # required, e.g. "I", "II", "XXVI"
year: number                  # required
era: string                   # optional, e.g. "Founding"
city: string                  # required
role: string                  # optional, e.g. "Founder & GM"
photo: string                 # required, public path
photoAlt: string              # REQUIRED — TypeScript schema validation
gallery: array<{src, alt}>    # optional
achievements: array<string>   # optional
socials: object               # optional
---

<MDX body — full bio prose>
```

### 7.3 Direction (UI/UX Pro Max, Step 2)

To be selected during execution. The first sample returned for the query `"archival editorial luxury portrait gallery museum heritage"`:

- **Pattern:** Portfolio Grid (adapted to horizontal scroll-snap per spec; vertical masonry as the < 768px fallback)
- **Style:** Exaggerated Minimalism — bold oversized type, massive whitespace, high-contrast portraiture, statement design ("best for: fashion, architecture, portfolios, luxury brands, editorial")
- **Typography:** Fraunces (display, italic for ceremonial moments) + Inter (body) + JetBrains Mono (year badge, crown number)
- **Key effects:** `font-size: clamp(3rem, 10vw, 12rem)` for name on detail modal; `letter-spacing: -0.05em` for tight editorial feel; deliberate whitespace
- **Colors (adapted to brand):** Obsidian `#050111` base, saffron `#FFD166` for active year badge / CTA, royal-violet `#6B2BD9` for navigation arrows, rose `#FF7EB3` for card hover state

This is the **first sample**, not a commitment. At Step 2 of execution, I'll bring 3–4 alternative directions for selection.

### 7.4 Definition of Done for Phase 1

- All available `queens[]` content entries render on `/heritage` with real photos + bios (no placeholder content).
- Horizontal scroll-snap with arrow / trackpad / swipe support; vertical stack fallback at < 768px; reduced-motion path tested.
- Modal: scrim, focus trap, ESC + swipe-down dismiss, scale+fade entry from trigger source.
- Lighthouse mobile ≥ 90 (Performance, Accessibility, Best Practices, SEO).
- LCP < 2.5s, CLS < 0.05, INP < 200ms (verified on slow-3G profile).
- Keyboard nav: focus visible on every interactive element, tab order matches visual order.
- AA contrast on every text/background pair.
- Live on `staging.missdiasporagh.org/heritage`.

## 8. Cross-Cutting Concerns

### 8.1 Design tokens — evolution, not replacement

- Existing `src/styles/tokens.css` is the baseline.
- New tokens added per-phase only when UI/UX Pro Max surfaces a genuine need (e.g. a "vellum" surface for Heritage modals, a "globe-glow" gradient for Diaspora).
- **Never overwrite an existing token's meaning.** New use cases get new token names.
- Every new token is documented inline with the phase that introduced it.

### 8.2 Motion language (shared across all phases)

Anchored to the predecessor spec's tokens + UI/UX Pro Max guidelines:

- **Easing:** `--ease-emp: cubic-bezier(.2,.7,.1,1)` (theatrical) · `--ease-std: cubic-bezier(.4,0,.2,1)` (component state)
- **Durations:** 150ms micro · 300ms component · 600ms section reveal · 1100ms hero cinematic
- **Stagger:** 30–50ms between list/grid items on entrance
- **Exit faster than enter:** exit duration = 60–70% of enter duration
- **Animated properties:** `transform` + `opacity` only (no width/height/top/left)
- **Reduced motion:** every animated element ships with a *designed* reduced-motion variant (not just stripped) — opacity fades replace transforms, parallax disabled, greeting overlay shortened to 200ms
- **Interruptibility:** any user gesture cancels in-progress animation immediately

### 8.3 Content Collections architecture

Each phase adds its own collection schema to `src/content/config.ts`:

```ts
queens         // Phase 1 → /heritage
diasporaCities // Phase 2 → /diaspora
contestants    // Phase 3 → /contestants
quizQuestions  // Phase 4 → /quiz
quizResults    // Phase 4 → /quiz
```

**Hard rule:** every image field requires a corresponding `alt` field, enforced via TypeScript schema validation — missing alt = build fail.

### 8.4 Shared UI primitives — `src/components/ui/`

Built once, used by multiple wow features:

- `<Button>` — primary (saffron pill), secondary (ghost violet), ghost (rose underline)
- `<Modal>` — Heritage uses it for queen detail; Diaspora uses it for city detail. (Quiz uses full-screen question views, not modals — see predecessor §7.6.)
- `<MetaLabel>` — JetBrains Mono uppercase tracking-wide caption
- `<Portrait>` — film-grain layer, warm-highlight / cool-shadow treatment
- `<ScrollRail>` — generalized chapter-progress rail; works for homepage chapters AND Heritage timeline
- `<DriveEmbed>` / `<YouTubeEmbed>` — lazy-loaded, click-to-play, aspect-ratio reserved

### 8.5 Repo workflow on `mdgh-staging`

- **Branching:** one feature branch per phase (e.g. `feature/heritage-timeline`). Sub-iterations stay on the same branch.
- **Commits:** Conventional Commits (`feat(heritage): …`, `fix(motion): …`).
- **Deploys:** push to feature branch → Cloudflare preview deploy auto-builds. Merge to `main` → production deploy at `staging.missdiasporagh.org`.
- **Memory:** at end of each phase, save learnings (token additions, motion patterns, content authoring conventions) to project memory.

## 9. Quality Gates (applied to every phase)

| Gate | Threshold | Verification |
|------|-----------|--------------|
| Color contrast | AA on all text/background pairs (4.5:1 normal, 3:1 large) | Manual audit + Lighthouse |
| Touch targets | 44×44px minimum on every interactive element | Manual audit |
| Keyboard nav | Full keyboard support; visible focus ring; tab order matches visual order | Manual audit |
| Reduced motion | Designed (not stripped) variant for every animated element | Manual toggle + test |
| Lighthouse mobile | Performance ≥ 90, Accessibility ≥ 90, Best Practices ≥ 90, SEO ≥ 90 | Lighthouse CLI run on staged URL |
| Core Web Vitals | LCP < 2.5s, CLS < 0.05, INP < 200ms | PageSpeed Insights + WebPageTest on slow-3G |
| Content authenticity | No placeholder content on staging | Manual review before deploy |
| Build-time schema validation | All required fields present (including `alt`) | TypeScript build in CI |

## 10. Definition of Done (overall elevation)

Heritage Timeline, Diaspora Globe, Contestant Hub, Heritage Quiz, and the polished homepage are all live at `staging.missdiasporagh.org`, all pass their Definition of Done at the phase level (§7.4 is the template), all six wow features feel like part of one cohesive site (motion language consistent, shared primitives applied), and the user explicitly approves cutover-readiness. **DNS cutover itself is out of scope for this spec — it's its own ritual.**

## 11. Open Decisions Reserved for Future Specs

- Whether `mdgh-app-production` Worker gets deployed (currently never deployed; production payment flow blocked on live Payaza keys).
- Whether the eventual production cutover keeps `mdgh-web-project` Pages project as a rollback target or fully decommissions it.
- Whether `apply.missdiasporagh.org` subdomain stays separate from the apex post-cutover, or whether the apply flow merges into the main site as `/apply` once a unified deployment model is settled.

## 12. Glossary

- **v1 / v2** — the current state of `staging.missdiasporagh.org` (v1) vs the elevated state (v2).
- **Phase** — one wow feature's full execution cycle (six-step loop, three approval gates).
- **Direction** — the visual choice made at Step 2 of a phase (style + palette + typography + motion language).
- **Wow feature** — one of six high-impact experiences defined in the predecessor spec.
- **Brand world** — "Neo-African Futurism" per the predecessor spec.
- **UI/UX Pro Max** — the design intelligence skill at `~/.claude/skills/ui-ux-pro-max/`, queried via Python CLI.

## 13. Implementation Planning Cadence

This spec covers five phases. **Implementation plans are produced one phase at a time**, not as a single five-phase plan. The first invocation of the `writing-plans` skill following spec approval will produce the implementation plan for **Phase 1 — Heritage Timeline** only. Subsequent phases each get their own plan invoked at the start of that phase, informed by what shipped in the prior phase.

Rationale: a single five-phase plan would be too long to be useful and would lock in design directions before Step 2 of each phase has been run. Per-phase plans keep the work concrete and let UI/UX Pro Max recommendations land freshly per feature.

---

*End of spec. Next step: writing-plans skill will translate Phase 1 (Heritage Timeline) into a step-by-step implementation plan.*
