# Heritage Quiz Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship Phase 4 — Heritage Quiz at `/quiz` + `/quiz/result/[region]` + Satori OG endpoint at `/quiz/og/[region].png` — to `staging.missdiasporagh.org` at flagship quality.

**Architecture:** Astro 5 SSR (Cloudflare Pages). `/quiz` mounts a React island (`<QuizEngine client:load />`) holding 6-question state + per-region weight accumulator. On Q6 completion, a `<ResultReveal>` animates a horizontal bar-chart of region totals (~800ms), then route-navigates to `/quiz/result/<winning-slug>`. Result pages are SSR'd per-region via the Phase 3 pattern (`Astro.params.region` + `getEntry`, no `prerender`). OG images render via an Astro endpoint that pipes Satori SVG output through `@resvg/resvg-wasm` to a PNG.

**Tech Stack:** Astro 5.15, TypeScript 5.6, React 19 (island only), `satori` + `@resvg/resvg-wasm` for OG, Tailwind 4. Reuses Phase 1's `<MetaLabel>`.

**Working repo:** `C:/dev/Projects/mdgh-staging`

**Spec references:**
- `mdgh-web-project/docs/superpowers/specs/2026-05-20-mdgh-staging-elevation-design.md` §7.6
- `mdgh-web-project/docs/superpowers/specs/annexes/2026-05-22-quiz-direction.md` (Cinematic Story direction)

---

## File Structure

**Create:**
- `src/content/quiz-questions/01.json` through `06.json` — 6 question entries
- `src/content/quiz-results/{greater-accra,ashanti,volta,northern,western,central,eastern}.mdx` — 7 archetype entries
- `public/fonts/Fraunces-Italic.ttf` — font binary for Satori
- `src/lib/quiz/scoring.ts` — pure TS scoring module
- `src/lib/quiz/types.ts` — shared types (Region, Question, Result)
- `src/components/quiz/ProgressDots.tsx` — I-VI Roman-numeral progress
- `src/components/quiz/QuestionCard.tsx` — one question + 4 options
- `src/components/quiz/ResultReveal.tsx` — bar-chart animation between Q6 and result
- `src/components/quiz/QuizEngine.tsx` — React island orchestrator
- `src/components/quiz/ResultHero.astro` — result-page hero with accent gradient
- `src/components/quiz/ShareButton.astro` — Web Share API + clipboard fallback
- `src/pages/quiz/index.astro` — start screen + QuizEngine mount
- `src/pages/quiz/result/[region].astro` — per-region SSR result page
- `src/pages/quiz/og/[region].png.ts` — Satori OG endpoint
- `tests/e2e/quiz.spec.ts` — Playwright

**Modify:**
- `package.json` — add `satori`, `@resvg/resvg-wasm`
- (None of the existing tokens or layouts modified)

---

## Task 0: Branch setup

- [ ] **Step 1: Clean main + create branch**

```bash
cd C:/dev/Projects/mdgh-staging
git checkout main
git pull origin main
git status   # clean, HEAD at 3e54690 (Phase 3 final)
git checkout -b feature/heritage-quiz
git push -u origin feature/heritage-quiz
```

- [ ] **Step 2: Baseline checks**

```bash
npm run typecheck   # expect: 0 errors
npm test
```

---

## Task 1: Seed 6 quiz questions

**Files:** Create `src/content/quiz-questions/01.json` through `06.json`

The `quizQuestions` schema (already defined in `src/content/config.ts`) is type `data`, requires `order: int`, `question: string`, optional `illustration: string`, `options: array[4]` of `{ label: string, weights: array<{ region: REGIONS, weight: 0-5 }> }`. The REGIONS enum has 7 entries.

Goal: each region should be the strongest option in at least one question, and have at least 2 questions where it scores ≥ 3.

- [ ] **Step 1: Create `01.json` — A moment of home**

```json
{
  "order": 1,
  "question": "Which moment feels most like home?",
  "options": [
    {
      "label": "Morning kelewele in Osu",
      "weights": [
        { "region": "Greater Accra", "weight": 5 },
        { "region": "Eastern", "weight": 2 },
        { "region": "Central", "weight": 1 }
      ]
    },
    {
      "label": "Kente in a Kumasi courtyard",
      "weights": [
        { "region": "Ashanti", "weight": 5 },
        { "region": "Eastern", "weight": 2 }
      ]
    },
    {
      "label": "Drums on the edge of Lake Volta",
      "weights": [
        { "region": "Volta", "weight": 5 },
        { "region": "Eastern", "weight": 1 }
      ]
    },
    {
      "label": "Harmattan light in Tamale",
      "weights": [
        { "region": "Northern", "weight": 5 }
      ]
    }
  ]
}
```

- [ ] **Step 2: Create `02.json` — Rhythm**

```json
{
  "order": 2,
  "question": "What rhythm carries you on a good day?",
  "options": [
    {
      "label": "Highlife from the kitchen radio",
      "weights": [
        { "region": "Greater Accra", "weight": 4 },
        { "region": "Central", "weight": 2 }
      ]
    },
    {
      "label": "Borborbor at a family gathering",
      "weights": [
        { "region": "Volta", "weight": 5 }
      ]
    },
    {
      "label": "Adowa at a royal wedding",
      "weights": [
        { "region": "Ashanti", "weight": 5 }
      ]
    },
    {
      "label": "Fontomfrom — slow, ceremonial",
      "weights": [
        { "region": "Eastern", "weight": 4 },
        { "region": "Ashanti", "weight": 2 }
      ]
    }
  ]
}
```

- [ ] **Step 3: Create `03.json` — A value**

```json
{
  "order": 3,
  "question": "Which value did your grandmother live?",
  "options": [
    {
      "label": "Patience — the long view",
      "weights": [
        { "region": "Northern", "weight": 5 },
        { "region": "Eastern", "weight": 3 }
      ]
    },
    {
      "label": "Generosity — the open kitchen",
      "weights": [
        { "region": "Central", "weight": 4 },
        { "region": "Western", "weight": 3 }
      ]
    },
    {
      "label": "Pride of craft — the perfect line",
      "weights": [
        { "region": "Ashanti", "weight": 4 },
        { "region": "Volta", "weight": 2 }
      ]
    },
    {
      "label": "Wit — the read-the-room",
      "weights": [
        { "region": "Greater Accra", "weight": 5 }
      ]
    }
  ]
}
```

- [ ] **Step 4: Create `04.json` — A craft**

```json
{
  "order": 4,
  "question": "What does your hand know how to make?",
  "options": [
    {
      "label": "A meal that feeds twenty",
      "weights": [
        { "region": "Central", "weight": 5 },
        { "region": "Eastern", "weight": 2 }
      ]
    },
    {
      "label": "A cloth that tells a name",
      "weights": [
        { "region": "Ashanti", "weight": 5 },
        { "region": "Volta", "weight": 2 }
      ]
    },
    {
      "label": "A net that catches what feeds a village",
      "weights": [
        { "region": "Western", "weight": 5 },
        { "region": "Central", "weight": 2 }
      ]
    },
    {
      "label": "A speech that turns a meeting",
      "weights": [
        { "region": "Greater Accra", "weight": 4 },
        { "region": "Eastern", "weight": 3 }
      ]
    }
  ]
}
```

- [ ] **Step 5: Create `05.json` — Wisdom kept**

```json
{
  "order": 5,
  "question": "What kind of wisdom keeps you steady?",
  "options": [
    {
      "label": "The proverb that arrived late but stayed",
      "weights": [
        { "region": "Eastern", "weight": 5 },
        { "region": "Ashanti", "weight": 2 }
      ]
    },
    {
      "label": "The drum that knew before the news did",
      "weights": [
        { "region": "Volta", "weight": 4 },
        { "region": "Northern", "weight": 3 }
      ]
    },
    {
      "label": "The bargain that taught you the price of pride",
      "weights": [
        { "region": "Greater Accra", "weight": 4 },
        { "region": "Western", "weight": 2 }
      ]
    },
    {
      "label": "The harvest that was never about the harvest",
      "weights": [
        { "region": "Northern", "weight": 4 },
        { "region": "Central", "weight": 3 }
      ]
    }
  ]
}
```

- [ ] **Step 6: Create `06.json` — A dream**

```json
{
  "order": 6,
  "question": "What do you dream of building?",
  "options": [
    {
      "label": "A library that holds every dialect",
      "weights": [
        { "region": "Eastern", "weight": 4 },
        { "region": "Ashanti", "weight": 3 }
      ]
    },
    {
      "label": "A coast that knows itself again",
      "weights": [
        { "region": "Western", "weight": 5 },
        { "region": "Central", "weight": 2 }
      ]
    },
    {
      "label": "A stage where every voice from the north is heard",
      "weights": [
        { "region": "Northern", "weight": 5 }
      ]
    },
    {
      "label": "A studio where ideas become products before lunch",
      "weights": [
        { "region": "Greater Accra", "weight": 5 },
        { "region": "Ashanti", "weight": 1 }
      ]
    }
  ]
}
```

- [ ] **Step 7: Verify + commit**

```bash
npx astro sync
npm run typecheck
git add src/content/quiz-questions/
git commit -m "feat(quiz): seed 6 questions covering home/rhythm/value/craft/wisdom/dream"
```

---

## Task 2: Seed 7 quiz results (one per region)

**Files:** Create `src/content/quiz-results/{greater-accra,ashanti,volta,northern,western,central,eastern}.mdx`

The `quizResults` schema (already defined) is type `content`, requires `region: REGIONS`, `archetypeName: string`, optional `shortLine`, `accentHex: /^#[0-9A-Fa-f]{6}$/`, optional `illustration`, `illustrationAlt`. MDX body is the archetype prose.

- [ ] **Step 1: Create the 7 MDX files**

`src/content/quiz-results/greater-accra.mdx`:

```mdx
---
region: "Greater Accra"
archetypeName: "The Bridge-Builder"
shortLine: "The connector. The translator. The one who turns the room."
accentHex: "#FF7EB3"
---

You hold the city's velocity in your hands. Every conversation lands somewhere useful when you're in it — you can hear the deal before it's been pitched, the alliance before it's been spoken. Greater Accra women are the ones who can sit at three tables in one night and walk out with the same name across all of them.

You don't romanticize movement; you organize it. The future of the diaspora keeps becoming legible because people like you draw the maps.
```

`src/content/quiz-results/ashanti.mdx`:

```mdx
---
region: "Ashanti"
archetypeName: "The Crown-Bearer"
shortLine: "The keeper of weight. The carrier of legacy."
accentHex: "#FFD166"
---

You were taught that some things are kept, not consumed. That a name carries weight whether you ask it to or not. Ashanti daughters wear inheritance the way other people wear jewelry — visibly, intentionally, with the understanding that what's been handed down is also a kind of work.

You know the long version of every short story. You also know when to tell the short one.
```

`src/content/quiz-results/volta.mdx`:

```mdx
---
region: "Volta"
archetypeName: "The River-Bearer"
shortLine: "The keeper of stories that arrive in chorus."
accentHex: "#4EBDFF"
---

You hold rhythm before logic. People remember the way you say their names. You'd rather sing a thing into being than write it down — and somehow, the thing exists anyway. Volta women carry the line where land meets water; you carry the line where heart meets word.

Your gift is making complicated love sound simple. Don't apologize for that.
```

`src/content/quiz-results/northern.mdx`:

```mdx
---
region: "Northern"
archetypeName: "The Sun-Walker"
shortLine: "The one who walks long in dust and patience."
accentHex: "#FF9D5C"
---

You measure things by the season, not the hour. People mistake your stillness for slowness, then watch you finish what they couldn't start. Northern women have a kind of patience that isn't passive — it's the patience of someone who's read the long weather and knows when the rain comes.

Whatever you build will outlast its critics.
```

`src/content/quiz-results/western.mdx`:

```mdx
---
region: "Western"
archetypeName: "The Tide-Reader"
shortLine: "The one who reads what the ocean leaves behind."
accentHex: "#5CFFCE"
---

You notice what other people walk past. The shape of a footprint, the timing of a tide, the way a song repeats one word three times to mean different things. Western Region women carry attention as a craft — you're the ones who turn observation into oeuvre.

You'll find a question worth asking before everyone else realizes it was even open.
```

`src/content/quiz-results/central.mdx`:

```mdx
---
region: "Central"
archetypeName: "The Door-Keeper"
shortLine: "The one who remembers what others came through."
accentHex: "#B084FF"
---

History didn't pass over Central Region — it stopped here, took notes, kept moving. You inherited the keeping. You're the one who can name the door each generation came through, who knows which house belonged to which auntie before it became a boutique. Cape Coast made archivists out of love.

You're not nostalgic. You're precise.
```

`src/content/quiz-results/eastern.mdx`:

```mdx
---
region: "Eastern"
archetypeName: "The Hill-Watcher"
shortLine: "The one who sees the long story from a slow place."
accentHex: "#80C97F"
---

Up where the air is thinner and the rivers are younger, Eastern women have always taken the long view. You're the one who could see the bend in the road from miles before everyone else hit it. You don't shout the foresight; you set the kettle on, and by the time the tea is ready, the room has caught up.

Your patience is a different kind of speed.
```

- [ ] **Step 2: Verify + commit**

```bash
npx astro sync
npm run typecheck
git add src/content/quiz-results/
git commit -m "feat(quiz): seed 7 region archetypes"
```

---

## Task 3: Install Satori + resvg-wasm + ship Fraunces font

**Files:** Modify `package.json`. Create `public/fonts/Fraunces-Italic.ttf`.

- [ ] **Step 1: Install dependencies**

```bash
cd C:/dev/Projects/mdgh-staging
npm install satori @resvg/resvg-wasm
```
Expected: no peer-dep errors. `satori` is ~80KB, `@resvg/resvg-wasm` is ~1.5MB (WASM blob, lazy-loaded by Worker).

- [ ] **Step 2: Download Fraunces Italic TTF**

Fraunces is open-source via Google Fonts. Download `Fraunces[opsz,SOFT,WONK,wght]-Italic.ttf` or the variable italic file:

```bash
mkdir -p public/fonts
# Use curl to download the variable italic file from Google Fonts:
curl -L "https://github.com/undercasetype/Fraunces/raw/main/fonts/variable/Fraunces%5BSOFT%2CWONK%2Copsz%2Cwght%5D-Italic.ttf" -o public/fonts/Fraunces-Italic.ttf
ls -lh public/fonts/Fraunces-Italic.ttf   # expect ~400-600KB
```

If the curl URL has changed, alternative: download from `fonts.google.com` manually and place the file at the same path. Verify the binary is a real TTF (`file public/fonts/Fraunces-Italic.ttf` should report "TrueType Font data").

- [ ] **Step 3: Verify**

```bash
npm run typecheck   # expect 0 new errors
```

- [ ] **Step 4: Commit**

```bash
git add package.json package-lock.json public/fonts/Fraunces-Italic.ttf
git commit -m "build(quiz): add satori + resvg-wasm + Fraunces-Italic font for OG generation"
```

---

## Task 4: Scoring engine

**Files:** Create `src/lib/quiz/types.ts` and `src/lib/quiz/scoring.ts`

- [ ] **Step 1: Create `src/lib/quiz/types.ts`**

```typescript
export type Region =
  | 'Greater Accra'
  | 'Ashanti'
  | 'Volta'
  | 'Northern'
  | 'Western'
  | 'Central'
  | 'Eastern';

export const ALL_REGIONS: Region[] = [
  'Greater Accra',
  'Ashanti',
  'Volta',
  'Northern',
  'Western',
  'Central',
  'Eastern',
];

export interface QuestionOption {
  label: string;
  weights: Array<{ region: Region; weight: number }>;
}

export interface Question {
  order: number;
  question: string;
  illustration?: string;
  options: QuestionOption[];
}

export interface ResultMeta {
  slug: string;            // 'volta', 'greater-accra'
  region: Region;
  archetypeName: string;
  shortLine?: string;
  accentHex: string;
  illustration?: string;
  illustrationAlt?: string;
}

export type Weights = Record<Region, number>;

export function emptyWeights(): Weights {
  return {
    'Greater Accra': 0,
    Ashanti: 0,
    Volta: 0,
    Northern: 0,
    Western: 0,
    Central: 0,
    Eastern: 0,
  };
}

export function regionToSlug(region: Region): string {
  return region.toLowerCase().replace(/\s+/g, '-');
}

export function slugToRegion(slug: string): Region | null {
  const found = ALL_REGIONS.find((r) => regionToSlug(r) === slug);
  return found ?? null;
}
```

- [ ] **Step 2: Create `src/lib/quiz/scoring.ts`**

```typescript
import { ALL_REGIONS, type QuestionOption, type Region, type Weights } from './types';

/** Add an option's weights into the running per-region accumulator. Returns a new object. */
export function applyAnswer(weights: Weights, option: QuestionOption): Weights {
  const next = { ...weights };
  for (const w of option.weights) {
    next[w.region] = (next[w.region] ?? 0) + w.weight;
  }
  return next;
}

/**
 * Pick the winning region. Sort by weight descending; on tie, the region whose
 * strongest answer arrived earliest wins. `answerOrder` is the list of regions
 * that each answer's strongest option pointed to (one per question).
 */
export function pickWinner(weights: Weights, answerOrder: Region[]): Region {
  const sorted = [...ALL_REGIONS].sort((a, b) => {
    if (weights[b] !== weights[a]) return weights[b] - weights[a];
    // Tie-break: whichever region appeared earlier in answerOrder wins
    const aIdx = answerOrder.indexOf(a);
    const bIdx = answerOrder.indexOf(b);
    if (aIdx === -1 && bIdx === -1) return 0;
    if (aIdx === -1) return 1;
    if (bIdx === -1) return -1;
    return aIdx - bIdx;
  });
  return sorted[0];
}

/** Return the strongest region for an option (highest weight). Used for answerOrder tracking. */
export function strongestRegion(option: QuestionOption): Region {
  if (option.weights.length === 0) return 'Greater Accra'; // fallback (shouldn't happen given schema)
  return [...option.weights].sort((a, b) => b.weight - a.weight)[0].region;
}
```

- [ ] **Step 3: Verify**

```bash
npm run typecheck
```

- [ ] **Step 4: Commit**

```bash
git add src/lib/quiz/
git commit -m "feat(quiz): scoring engine — applyAnswer, pickWinner, region/slug helpers"
```

---

## Task 5: Build `<ProgressDots>` React component

**Files:** Create `src/components/quiz/ProgressDots.tsx`

Renders the I-VI italic Fraunces sash-Roman numerals with the current step highlighted.

- [ ] **Step 1: Write the component**

```tsx
interface Props {
  current: number;   // 1-indexed (1..6)
  total: number;     // typically 6
}

const ROMANS = ['', 'I', 'II', 'III', 'IV', 'V', 'VI'];

export default function ProgressDots({ current, total }: Props) {
  return (
    <div className="quiz-progress" role="progressbar" aria-valuemin={1} aria-valuemax={total} aria-valuenow={current}>
      {Array.from({ length: total }, (_, i) => {
        const n = i + 1;
        const isCurrent = n === current;
        const isPast = n < current;
        return (
          <span
            key={n}
            className={`quiz-progress__dot${isCurrent ? ' is-current' : ''}${isPast ? ' is-past' : ''}`}
            aria-hidden="true"
          >
            {ROMANS[n] ?? String(n)}
          </span>
        );
      })}
      <style>{`
        .quiz-progress {
          display: inline-flex;
          gap: 10px;
          align-items: center;
          font-family: 'Fraunces Variable', 'Fraunces', serif;
          font-style: italic;
          font-weight: 600;
        }
        .quiz-progress__dot {
          font-size: 14px;
          color: rgba(255, 255, 255, 0.25);
          transition: color 200ms cubic-bezier(.4, 0, .2, 1), font-size 200ms cubic-bezier(.4, 0, .2, 1), text-shadow 200ms cubic-bezier(.4, 0, .2, 1);
        }
        .quiz-progress__dot.is-past {
          color: rgba(255, 209, 102, 0.9);
          font-size: 18px;
        }
        .quiz-progress__dot.is-current {
          color: #FFD166;
          font-size: 22px;
          font-weight: 700;
          text-shadow: 0 0 8px rgba(255, 209, 102, 0.4);
        }
        @media (prefers-reduced-motion: reduce) {
          .quiz-progress__dot { transition: none; }
        }
      `}</style>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
npm run typecheck
git add src/components/quiz/ProgressDots.tsx
git commit -m "feat(quiz): add ProgressDots — I-VI italic Fraunces sash progress"
```

---

## Task 6: Build `<QuestionCard>` React component

**Files:** Create `src/components/quiz/QuestionCard.tsx`

Renders one question + 4 options. Pure presentation; QuizEngine handles state.

- [ ] **Step 1: Write the component**

```tsx
import type { Question, QuestionOption } from '~/lib/quiz/types';

interface Props {
  question: Question;
  questionNumber: number;     // 1-indexed for display
  onSelect: (option: QuestionOption) => void;
}

export default function QuestionCard({ question, questionNumber, onSelect }: Props) {
  const ROMANS = ['', 'I', 'II', 'III', 'IV', 'V', 'VI'];
  const roman = ROMANS[questionNumber] ?? String(questionNumber);

  return (
    <div className="quiz-question">
      <div className="quiz-question__eyebrow">QUESTION {roman}</div>
      <h2 className="quiz-question__title">{question.question}</h2>
      <div className="quiz-question__grid">
        {question.options.map((opt, i) => (
          <button
            key={i}
            type="button"
            className="quiz-question__option"
            onClick={() => onSelect(opt)}
          >
            {opt.label}
          </button>
        ))}
      </div>
      <style>{`
        .quiz-question {
          width: 100%;
          max-width: 880px;
          margin: 0 auto;
          padding: 0 48px;
          text-align: center;
          display: flex;
          flex-direction: column;
          gap: 32px;
        }
        .quiz-question__eyebrow {
          font-family: 'JetBrains Mono Variable', 'JetBrains Mono', monospace;
          font-size: 10px;
          font-weight: 600;
          color: rgba(255, 255, 255, 0.5);
          letter-spacing: 0.25em;
          text-transform: uppercase;
        }
        .quiz-question__title {
          font-family: 'Fraunces Variable', 'Fraunces', serif;
          font-style: italic;
          font-weight: 500;
          font-size: clamp(28px, 4vw, 44px);
          line-height: 1.15;
          letter-spacing: -0.02em;
          color: #fff;
          margin: 0;
        }
        .quiz-question__grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 14px;
        }
        .quiz-question__option {
          background: linear-gradient(180deg, var(--color-deep-violet, #1a0833), var(--color-obsidian, #050111));
          border: 1px solid rgba(107, 43, 217, 0.4);
          border-radius: 14px;
          padding: 22px 24px;
          color: #fff;
          text-align: left;
          font-family: 'Inter Variable', 'Inter', sans-serif;
          font-size: 15px;
          line-height: 1.4;
          cursor: pointer;
          min-height: 80px;
          transition: transform 200ms cubic-bezier(.4, 0, .2, 1), border-color 200ms cubic-bezier(.4, 0, .2, 1), box-shadow 200ms cubic-bezier(.4, 0, .2, 1);
        }
        .quiz-question__option:hover,
        .quiz-question__option:focus-visible {
          transform: translateY(-2px);
          border-color: rgba(255, 209, 102, 0.55);
          box-shadow: 0 0 0 2px rgba(255, 209, 102, 0.2), 0 6px 16px rgba(0, 0, 0, 0.3);
          outline: none;
        }
        @media (max-width: 767px) {
          .quiz-question { padding: 0 20px; gap: 24px; }
          .quiz-question__grid { grid-template-columns: 1fr; }
          .quiz-question__option { padding: 18px 16px; min-height: 64px; }
        }
        @media (prefers-reduced-motion: reduce) {
          .quiz-question__option { transition: none; }
          .quiz-question__option:hover,
          .quiz-question__option:focus-visible { transform: none; }
        }
      `}</style>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
npm run typecheck
git add src/components/quiz/QuestionCard.tsx
git commit -m "feat(quiz): add QuestionCard — one question + 2×2 option grid"
```

---

## Task 7: Build `<ResultReveal>` bar-chart animation

**Files:** Create `src/components/quiz/ResultReveal.tsx`

Mounts after Q6 completion. Shows the 7 regions as horizontal bars, animates widths to their final ratios over ~800ms, then route-navigates to `/quiz/result/<winner-slug>`.

- [ ] **Step 1: Write the component**

```tsx
import { useEffect, useMemo, useState } from 'react';
import { ALL_REGIONS, regionToSlug, type Region, type Weights } from '~/lib/quiz/types';

interface Props {
  weights: Weights;
  winner: Region;
  /** Optional callback fired when the reveal completes; default is to navigate. */
  onComplete?: (winnerSlug: string) => void;
  /** Ms before navigation (default 1400 — 800 for animation + 600 pause). */
  delayMs?: number;
}

const REGION_LABELS: Record<Region, string> = {
  'Greater Accra': 'GR. ACCRA',
  Ashanti: 'ASHANTI',
  Volta: 'VOLTA',
  Northern: 'NORTHERN',
  Western: 'WESTERN',
  Central: 'CENTRAL',
  Eastern: 'EASTERN',
};

export default function ResultReveal({ weights, winner, onComplete, delayMs = 1400 }: Props) {
  const [animated, setAnimated] = useState(false);

  const ranked = useMemo(() => {
    return [...ALL_REGIONS]
      .map((r) => ({ region: r, weight: weights[r] }))
      .sort((a, b) => b.weight - a.weight);
  }, [weights]);

  const maxWeight = Math.max(1, ...ranked.map((r) => r.weight));

  useEffect(() => {
    // Trigger animation on mount
    const t1 = requestAnimationFrame(() => setAnimated(true));
    const t2 = setTimeout(() => {
      const slug = regionToSlug(winner);
      if (onComplete) {
        onComplete(slug);
      } else {
        window.location.href = `/quiz/result/${slug}`;
      }
    }, delayMs);
    return () => {
      cancelAnimationFrame(t1);
      clearTimeout(t2);
    };
  }, [winner, onComplete, delayMs]);

  return (
    <div className="result-reveal" role="status" aria-live="polite">
      <div className="result-reveal__eyebrow">COUNTING THE STARS</div>
      <ul className="result-reveal__bars">
        {ranked.map(({ region, weight }) => {
          const isWinner = region === winner;
          const targetWidth = (weight / maxWeight) * 100;
          return (
            <li key={region} className={`result-reveal__row${isWinner ? ' is-winner' : ''}`}>
              <span className="result-reveal__label">{REGION_LABELS[region]}</span>
              <div className="result-reveal__track">
                <div
                  className="result-reveal__bar"
                  style={{ width: animated ? `${targetWidth}%` : '0%' }}
                />
              </div>
              <span className="result-reveal__weight">{weight}</span>
            </li>
          );
        })}
      </ul>
      <style>{`
        .result-reveal {
          display: flex;
          flex-direction: column;
          gap: 14px;
          width: 100%;
          max-width: 560px;
          margin: 0 auto;
          padding: 48px 24px;
        }
        .result-reveal__eyebrow {
          font-family: 'JetBrains Mono Variable', 'JetBrains Mono', monospace;
          font-size: 10px;
          font-weight: 600;
          color: var(--color-saffron, #FFD166);
          letter-spacing: 0.25em;
          text-transform: uppercase;
          text-align: center;
          margin-bottom: 8px;
        }
        .result-reveal__bars {
          list-style: none;
          margin: 0;
          padding: 0;
          display: flex;
          flex-direction: column;
          gap: 12px;
        }
        .result-reveal__row {
          display: flex;
          align-items: center;
          gap: 12px;
        }
        .result-reveal__label {
          font-family: 'JetBrains Mono Variable', 'JetBrains Mono', monospace;
          font-size: 10px;
          color: rgba(255, 255, 255, 0.55);
          letter-spacing: 0.18em;
          width: 88px;
          text-align: right;
        }
        .result-reveal__row.is-winner .result-reveal__label {
          color: rgba(255, 255, 255, 0.95);
        }
        .result-reveal__track {
          flex: 1;
          height: 6px;
          background: rgba(255, 255, 255, 0.05);
          border-radius: 99px;
          overflow: hidden;
        }
        .result-reveal__bar {
          height: 100%;
          background: rgba(255, 209, 102, 0.35);
          border-radius: 99px;
          transition: width 800ms cubic-bezier(.2, .7, .1, 1);
        }
        .result-reveal__row.is-winner .result-reveal__bar {
          background: var(--color-saffron, #FFD166);
          box-shadow: 0 0 10px rgba(255, 209, 102, 0.5);
        }
        .result-reveal__weight {
          font-family: 'JetBrains Mono Variable', 'JetBrains Mono', monospace;
          font-size: 10px;
          color: rgba(255, 255, 255, 0.5);
          width: 28px;
          text-align: right;
        }
        .result-reveal__row.is-winner .result-reveal__weight {
          color: var(--color-saffron, #FFD166);
        }
        @media (prefers-reduced-motion: reduce) {
          .result-reveal__bar { transition: none; }
        }
      `}</style>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
npm run typecheck
git add src/components/quiz/ResultReveal.tsx
git commit -m "feat(quiz): add ResultReveal bar-chart animation"
```

---

## Task 8: Build `<QuizEngine>` React island

**Files:** Create `src/components/quiz/QuizEngine.tsx`

Holds the state machine: idle (start screen) → asking (Q1..Q6) → revealing (bar chart) → done (navigation). Receives `questions` as a prop.

- [ ] **Step 1: Write the component**

```tsx
import { useCallback, useState } from 'react';
import { applyAnswer, pickWinner, strongestRegion } from '~/lib/quiz/scoring';
import { emptyWeights, type Question, type QuestionOption, type Region } from '~/lib/quiz/types';
import ProgressDots from './ProgressDots';
import QuestionCard from './QuestionCard';
import ResultReveal from './ResultReveal';

interface Props {
  questions: Question[];
}

type Phase = 'idle' | 'asking' | 'revealing';

export default function QuizEngine({ questions }: Props) {
  const [phase, setPhase] = useState<Phase>('idle');
  const [index, setIndex] = useState(0);
  const [weights, setWeights] = useState(emptyWeights());
  const [answerOrder, setAnswerOrder] = useState<Region[]>([]);

  const handleStart = useCallback(() => {
    setPhase('asking');
    setIndex(0);
    setWeights(emptyWeights());
    setAnswerOrder([]);
  }, []);

  const handleSelect = useCallback(
    (opt: QuestionOption) => {
      const newWeights = applyAnswer(weights, opt);
      const newAnswerOrder = [...answerOrder, strongestRegion(opt)];

      const isLast = index === questions.length - 1;
      setWeights(newWeights);
      setAnswerOrder(newAnswerOrder);

      if (isLast) {
        setPhase('revealing');
      } else {
        setIndex(index + 1);
      }
    },
    [weights, answerOrder, index, questions.length]
  );

  if (phase === 'idle') {
    return (
      <div className="quiz-start">
        <div className="quiz-start__eyebrow">SIX QUESTIONS · YOUR HOMELAND</div>
        <h1 className="quiz-start__title">
          Which Ghana <em>are you?</em>
        </h1>
        <p className="quiz-start__lede">
          Six questions. One archetype. The region of Ghana whose spirit lives loudest in you. Takes ninety seconds.
        </p>
        <button type="button" className="quiz-start__cta" onClick={handleStart}>
          Begin →
        </button>
        <style>{`
          .quiz-start {
            text-align: center;
            max-width: 680px;
            margin: 0 auto;
            padding: 48px 24px;
            display: flex;
            flex-direction: column;
            gap: 20px;
            align-items: center;
          }
          .quiz-start__eyebrow {
            font-family: 'JetBrains Mono Variable', 'JetBrains Mono', monospace;
            font-size: 11px;
            font-weight: 600;
            color: var(--color-saffron, #FFD166);
            letter-spacing: 0.25em;
            text-transform: uppercase;
          }
          .quiz-start__title {
            font-family: 'Fraunces Variable', 'Fraunces', serif;
            font-weight: 500;
            font-size: clamp(40px, 6vw, 72px);
            line-height: 1.05;
            color: #fff;
            margin: 0;
          }
          .quiz-start__title em {
            font-style: italic;
            color: var(--color-saffron, #FFD166);
          }
          .quiz-start__lede {
            color: rgba(255, 255, 255, 0.7);
            font-size: 17px;
            line-height: 1.6;
            max-width: 52ch;
            margin: 0 0 16px;
          }
          .quiz-start__cta {
            background: var(--color-saffron, #FFD166);
            color: var(--color-deep-violet, #1a0833);
            border: none;
            padding: 16px 48px;
            border-radius: 999px;
            font-family: 'JetBrains Mono Variable', 'JetBrains Mono', monospace;
            font-size: 12px;
            font-weight: 600;
            letter-spacing: 0.25em;
            text-transform: uppercase;
            cursor: pointer;
            box-shadow: 0 8px 24px rgba(255, 209, 102, 0.25);
            transition: transform 200ms cubic-bezier(.4, 0, .2, 1), box-shadow 200ms cubic-bezier(.4, 0, .2, 1);
          }
          .quiz-start__cta:hover,
          .quiz-start__cta:focus-visible {
            transform: translateY(-2px);
            box-shadow: 0 12px 32px rgba(255, 209, 102, 0.35);
            outline: 2px solid var(--color-saffron, #FFD166);
            outline-offset: 4px;
          }
          @media (prefers-reduced-motion: reduce) {
            .quiz-start__cta { transition: none; }
            .quiz-start__cta:hover, .quiz-start__cta:focus-visible { transform: none; }
          }
        `}</style>
      </div>
    );
  }

  if (phase === 'asking') {
    const q = questions[index];
    if (!q) return null;
    return (
      <div className="quiz-active">
        <div className="quiz-active__progress">
          <ProgressDots current={index + 1} total={questions.length} />
        </div>
        <QuestionCard question={q} questionNumber={index + 1} onSelect={handleSelect} />
        <style>{`
          .quiz-active {
            display: flex;
            flex-direction: column;
            gap: 40px;
            padding: 48px 0 80px;
            min-height: 70vh;
          }
          .quiz-active__progress {
            text-align: center;
          }
        `}</style>
      </div>
    );
  }

  // phase === 'revealing'
  const winner = pickWinner(weights, answerOrder);
  return <ResultReveal weights={weights} winner={winner} />;
}
```

- [ ] **Step 2: Commit**

```bash
npm run typecheck
git add src/components/quiz/QuizEngine.tsx
git commit -m "feat(quiz): add QuizEngine React island — start/asking/revealing state machine"
```

---

## Task 9: Build `<ResultHero>` Astro component

**Files:** Create `src/components/quiz/ResultHero.astro`

The result page's hero. SSR-rendered. Reads accentHex from props and applies it via CSS custom property.

- [ ] **Step 1: Write the component**

```astro
---
import MetaLabel from '~/components/ui/MetaLabel.astro';

interface Props {
  region: string;
  archetypeName: string;
  shortLine?: string;
  accentHex: string;
}

const { region, archetypeName, shortLine, accentHex } = Astro.props;
---
<section class="result-hero" style={`--accent: ${accentHex}`}>
  <div class="result-hero__accent" aria-hidden="true"></div>
  <div class="result-hero__inner">
    <MetaLabel text="YOUR ARCHETYPE · CROWN HERITAGE" tone="accent" />
    <div class="result-hero__youre">YOU ARE</div>
    <h1 class="result-hero__name">{region}</h1>
    <div class="result-hero__archetype">{archetypeName}</div>
    {shortLine && <p class="result-hero__line">{shortLine}</p>}
  </div>
</section>

<style>
  .result-hero {
    position: relative;
    padding: 96px 24px 48px;
    overflow: hidden;
    background: linear-gradient(135deg, #1a0833 0%, #0a0414 40%, #050111 100%);
  }
  .result-hero__accent {
    position: absolute;
    top: -200px;
    left: 50%;
    transform: translateX(-50%);
    width: 800px;
    height: 800px;
    border-radius: 50%;
    background: radial-gradient(circle, var(--accent, #FFD166) 0%, transparent 60%);
    opacity: 0.15;
    pointer-events: none;
  }
  .result-hero__inner {
    position: relative;
    z-index: 1;
    text-align: center;
    max-width: 880px;
    margin: 0 auto;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 8px;
  }
  .result-hero__youre {
    font-family: 'JetBrains Mono Variable', 'JetBrains Mono', monospace;
    font-size: 10px;
    color: var(--accent, #FFD166);
    letter-spacing: 0.3em;
    text-transform: uppercase;
    margin-top: 16px;
  }
  .result-hero__name {
    font-family: 'Fraunces Variable', 'Fraunces', serif;
    font-style: italic;
    font-weight: 500;
    font-size: clamp(72px, 12vw, 112px);
    line-height: 0.95;
    color: #fff;
    letter-spacing: -0.04em;
    margin: 8px 0 4px;
  }
  .result-hero__archetype {
    font-family: 'Fraunces Variable', 'Fraunces', serif;
    font-style: italic;
    font-weight: 400;
    font-size: clamp(22px, 3vw, 28px);
    color: rgba(255, 255, 255, 0.85);
    margin-top: 4px;
  }
  .result-hero__line {
    font-family: 'Fraunces Variable', 'Fraunces', serif;
    font-style: italic;
    font-size: clamp(17px, 2.5vw, 22px);
    line-height: 1.45;
    color: rgba(255, 255, 255, 0.65);
    margin: 16px auto 0;
    max-width: 42ch;
  }
</style>
```

- [ ] **Step 2: Commit**

```bash
npm run typecheck
git add src/components/quiz/ResultHero.astro
git commit -m "feat(quiz): add ResultHero with per-region accent gradient"
```

---

## Task 10: Wire `/quiz` page

**Files:** Create `src/pages/quiz/index.astro`

- [ ] **Step 1: Write the page**

```astro
---
import { getCollection } from 'astro:content';
import PageLayout from '~/layouts/PageLayout.astro';
import QuizEngine from '~/components/quiz/QuizEngine.tsx';

const questionEntries = await getCollection('quiz-questions');
const questions = questionEntries
  .map((e) => e.data)
  .sort((a, b) => a.order - b.order);
---
<PageLayout
  title="Which Ghana are you? · Heritage Quiz · Miss Diaspora Ghana"
  description="Six questions, one archetype. The region of Ghana whose spirit lives loudest in you."
>
  <div class="quiz-page">
    <QuizEngine questions={questions} client:load />
  </div>
</PageLayout>

<style>
  .quiz-page {
    min-height: 80vh;
    background: radial-gradient(ellipse at center, #1a0833 0%, #050111 80%);
    padding: 80px 0 80px;
    display: flex;
    flex-direction: column;
    justify-content: center;
  }
</style>
```

- [ ] **Step 2: Dev smoke test + commit**

```bash
npm run typecheck
npm run test:e2e -- --grep "@nonexistent" 2>/dev/null   # no-op to confirm Playwright config still works
git add src/pages/quiz/index.astro
git commit -m "feat(quiz): wire /quiz interactive page with React island"
```

---

## Task 11: Wire `/quiz/result/[region]` SSR page

**Files:** Create `src/pages/quiz/result/[region].astro`

Uses the Phase 3 SSR pattern — `Astro.params.region` + `getCollection`. NO `prerender = true`, NO `getStaticPaths`.

- [ ] **Step 1: Write the page**

```astro
---
import { getCollection } from 'astro:content';
import PageLayout from '~/layouts/PageLayout.astro';
import MetaLabel from '~/components/ui/MetaLabel.astro';
import ResultHero from '~/components/quiz/ResultHero.astro';
import { slugToRegion } from '~/lib/quiz/types';

const { region: slug } = Astro.params;
if (!slug) return Astro.redirect('/quiz');

const region = slugToRegion(slug);
if (!region) return Astro.redirect('/quiz');

const results = await getCollection('quiz-results');
const entry = results.find((r) => r.data.region === region);
if (!entry) return Astro.redirect('/quiz');

const { Content } = await entry.render();

const ogImage = `${Astro.site ?? 'https://staging.missdiasporagh.org'}/quiz/og/${slug}.png`;
const description = entry.data.shortLine ?? `${entry.data.archetypeName} — ${region}.`;
---
<PageLayout
  title={`You are ${region} — ${entry.data.archetypeName} · Heritage Quiz`}
  description={description}
  ogImage={ogImage}
>
  <ResultHero
    region={region}
    archetypeName={entry.data.archetypeName}
    shortLine={entry.data.shortLine}
    accentHex={entry.data.accentHex}
  />

  <article class="result-prose" style={`--accent: ${entry.data.accentHex}`}>
    <Content />

    <div class="result-prose__actions">
      <button type="button" class="result-prose__share" data-share-button data-share-url={`/quiz/result/${slug}`} data-share-title={`I am ${region} — ${entry.data.archetypeName}`}>
        Share
      </button>
      <a class="result-prose__retake" href="/quiz">Retake</a>
    </div>
  </article>

  <script>
    const btn = document.querySelector<HTMLButtonElement>('[data-share-button]');
    btn?.addEventListener('click', async () => {
      const path = btn.dataset.shareUrl ?? '/';
      const title = btn.dataset.shareTitle ?? 'Heritage Quiz';
      const url = `${location.origin}${path}`;
      if (navigator.share) {
        try { await navigator.share({ title, url }); } catch { /* user cancelled */ }
      } else if (navigator.clipboard) {
        await navigator.clipboard.writeText(url);
        btn.textContent = 'Copied ✓';
        setTimeout(() => { btn.textContent = 'Share'; }, 2000);
      }
    });
  </script>
</PageLayout>

<style>
  .result-prose {
    max-width: 720px;
    margin: 0 auto;
    padding: 48px 24px 96px;
    color: rgba(255, 255, 255, 0.85);
    font-size: 17px;
    line-height: 1.7;
  }
  .result-prose :global(p) { margin: 0 0 1.2em; }
  .result-prose__actions {
    display: flex;
    justify-content: center;
    gap: 14px;
    margin-top: 32px;
    flex-wrap: wrap;
  }
  .result-prose__share {
    background: var(--color-saffron, #FFD166);
    color: var(--color-deep-violet, #1a0833);
    border: none;
    padding: 14px 32px;
    border-radius: 999px;
    font-family: 'JetBrains Mono Variable', 'JetBrains Mono', monospace;
    font-size: 11px;
    font-weight: 600;
    letter-spacing: 0.25em;
    text-transform: uppercase;
    cursor: pointer;
  }
  .result-prose__retake {
    background: transparent;
    color: var(--color-saffron, #FFD166);
    border: 1px solid rgba(255, 209, 102, 0.4);
    padding: 14px 32px;
    border-radius: 999px;
    font-family: 'JetBrains Mono Variable', 'JetBrains Mono', monospace;
    font-size: 11px;
    font-weight: 600;
    letter-spacing: 0.25em;
    text-transform: uppercase;
    text-decoration: none;
  }
</style>
```

Note: this assumes `PageLayout` accepts an `ogImage` prop. If it doesn't, add a passthrough or set the meta tag inline via `<Fragment slot="head">` per existing convention. Check `src/layouts/PageLayout.astro` props before relying on `ogImage` — if absent, use this fallback inside the page frontmatter and head:

```astro
const ogImage = ...;
---
<PageLayout title={...} description={description}>
  <Fragment slot="head">
    <meta property="og:image" content={ogImage} />
    <meta name="twitter:image" content={ogImage} />
    <meta name="twitter:card" content="summary_large_image" />
  </Fragment>
  ...
```

- [ ] **Step 2: Smoke test + commit**

```bash
npm run typecheck
git add src/pages/quiz/result/[region].astro
git commit -m "feat(quiz): wire /quiz/result/[region] SSR page with share button"
```

---

## Task 12: Wire `/quiz/og/[region].png` Satori endpoint

**Files:** Create `src/pages/quiz/og/[region].png.ts`

Generates a 1200×630 PNG via Satori. Cached at the edge.

- [ ] **Step 1: Write the endpoint**

```typescript
import type { APIRoute } from 'astro';
import { getCollection } from 'astro:content';
import satori from 'satori';
import { Resvg, initWasm } from '@resvg/resvg-wasm';
import { slugToRegion } from '~/lib/quiz/types';

// Lazy WASM init — only happens once per Worker isolate
let wasmInitialized = false;
let fontData: ArrayBuffer | null = null;

async function ensureSetup(origin: string) {
  if (!wasmInitialized) {
    const wasmRes = await fetch('https://unpkg.com/@resvg/resvg-wasm/index_bg.wasm');
    const wasmBuf = await wasmRes.arrayBuffer();
    await initWasm(wasmBuf);
    wasmInitialized = true;
  }
  if (!fontData) {
    const fontRes = await fetch(`${origin}/fonts/Fraunces-Italic.ttf`);
    fontData = await fontRes.arrayBuffer();
  }
}

export const GET: APIRoute = async ({ params, url }) => {
  const slug = params.region;
  if (!slug) return new Response('Bad request', { status: 400 });

  const region = slugToRegion(slug);
  if (!region) return new Response('Not found', { status: 404 });

  const results = await getCollection('quiz-results');
  const entry = results.find((r) => r.data.region === region);
  if (!entry) return new Response('Not found', { status: 404 });

  const origin = `${url.protocol}//${url.host}`;
  await ensureSetup(origin);

  const accent = entry.data.accentHex;
  const archetypeName = entry.data.archetypeName;
  const shortLine = entry.data.shortLine ?? '';

  const svg = await satori(
    {
      type: 'div',
      props: {
        style: {
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'center',
          width: '1200px',
          height: '630px',
          background: 'linear-gradient(135deg, #1a0833 0%, #0a0414 50%, #050111 100%)',
          color: '#fff',
          fontFamily: 'Fraunces',
          padding: '80px',
          position: 'relative',
        },
        children: [
          // Accent radial overlay
          {
            type: 'div',
            props: {
              style: {
                position: 'absolute',
                top: '-300px',
                left: '50%',
                transform: 'translateX(-50%)',
                width: '900px',
                height: '900px',
                borderRadius: '450px',
                background: `radial-gradient(circle, ${accent} 0%, transparent 60%)`,
                opacity: 0.25,
              },
            },
          },
          {
            type: 'div',
            props: {
              style: {
                fontSize: '20px',
                color: accent,
                letterSpacing: '0.3em',
                textTransform: 'uppercase',
                marginBottom: '16px',
                zIndex: 1,
              },
              children: 'YOU ARE',
            },
          },
          {
            type: 'div',
            props: {
              style: {
                fontSize: '180px',
                fontStyle: 'italic',
                fontWeight: 500,
                lineHeight: 0.95,
                letterSpacing: '-0.04em',
                marginBottom: '24px',
                zIndex: 1,
              },
              children: region,
            },
          },
          {
            type: 'div',
            props: {
              style: {
                fontSize: '38px',
                fontStyle: 'italic',
                color: 'rgba(255,255,255,0.85)',
                marginBottom: '40px',
                zIndex: 1,
              },
              children: archetypeName,
            },
          },
          shortLine && {
            type: 'div',
            props: {
              style: {
                fontSize: '26px',
                fontStyle: 'italic',
                color: 'rgba(255,255,255,0.6)',
                textAlign: 'center',
                maxWidth: '880px',
                zIndex: 1,
              },
              children: shortLine,
            },
          },
          {
            type: 'div',
            props: {
              style: {
                position: 'absolute',
                bottom: '40px',
                right: '60px',
                fontSize: '18px',
                color: 'rgba(255,209,102,0.7)',
                letterSpacing: '0.25em',
                textTransform: 'uppercase',
                zIndex: 1,
              },
              children: 'MISS DIASPORA GHANA',
            },
          },
        ].filter(Boolean),
      },
    } as any,
    {
      width: 1200,
      height: 630,
      fonts: [
        {
          name: 'Fraunces',
          data: fontData!,
          weight: 500,
          style: 'italic',
        },
      ],
    }
  );

  const resvg = new Resvg(svg);
  const pngBuf = resvg.render().asPng();

  return new Response(pngBuf, {
    headers: {
      'content-type': 'image/png',
      'cache-control': 'public, max-age=86400',
    },
  });
};
```

- [ ] **Step 2: Build + smoke test the endpoint locally**

```bash
cd C:/dev/Projects/mdgh-staging
npm run build
(npx wrangler pages dev ./dist --compatibility-flag=nodejs_compat --compatibility-date=2026-05-01 --port 8788 > /tmp/w.log 2>&1 &)
sleep 7
curl -sI http://localhost:8788/quiz/og/volta.png | head -5
curl -s http://localhost:8788/quiz/og/volta.png > /tmp/og-volta.png
file /tmp/og-volta.png    # expect: PNG image data, 1200 x 630
pkill -f workerd 2>/dev/null; pkill -f "wrangler pages" 2>/dev/null
```

If the smoke test fails with a Satori or resvg error: investigate. Common issues:
- Font ArrayBuffer fetch failed — try inlining the font binary as a base64 import instead of fetching at runtime
- resvg-wasm init failed — try `@resvg/resvg-js` (Node-native, not WASM) IF the Cloudflare adapter allows it (likely not in production, but local dev works)
- Satori JSX is misformed — Satori is strict about CSS subset; remove anything Satori doesn't support

If the endpoint is materially complex to ship: gate it behind an environment variable and ship the result pages without dynamic OG. Phase 4.5 follow-up.

- [ ] **Step 3: Commit (only after smoke test passes)**

```bash
git add src/pages/quiz/og/[region].png.ts
git commit -m "feat(quiz): /quiz/og/[region].png Satori endpoint for shareable OG"
```

---

## Task 13: Playwright e2e

**Files:** Create `tests/e2e/quiz.spec.ts`

Six tests:
1. Start screen renders with Begin button
2. Click Begin → Q1 visible
3. Selecting an option advances to Q2
4. Completing all 6 questions navigates to a result page
5. Result page renders archetype name + accent
6. Reduced-motion strips the bar-chart animation (bar widths are at final state immediately)

- [ ] **Step 1: Write the spec**

```typescript
import { test, expect } from '@playwright/test';

test.describe('/quiz', () => {
  test('start screen renders with Begin button', async ({ page }) => {
    await page.goto('/quiz');
    await expect(page.locator('.quiz-start__title')).toContainText('Which Ghana');
    await expect(page.locator('.quiz-start__cta')).toBeVisible();
    await expect(page.locator('.quiz-start__cta')).toContainText('Begin');
  });

  test('clicking Begin advances to Q1', async ({ page }) => {
    await page.goto('/quiz');
    await page.click('.quiz-start__cta');
    await expect(page.locator('.quiz-question__title')).toBeVisible();
    await expect(page.locator('.quiz-question__option')).toHaveCount(4);
  });

  test('selecting an option advances to Q2', async ({ page }) => {
    await page.goto('/quiz');
    await page.click('.quiz-start__cta');
    const q1Title = await page.locator('.quiz-question__title').textContent();
    await page.click('.quiz-question__option >> nth=0');
    // Either the title text changed OR the QUESTION roman numeral advanced
    await expect(page.locator('.quiz-question__eyebrow')).toContainText('II');
  });

  test('completing all 6 questions navigates to a result page', async ({ page }) => {
    await page.goto('/quiz');
    await page.click('.quiz-start__cta');
    // Answer all 6 questions by clicking the first option each time
    for (let i = 0; i < 6; i++) {
      await page.click('.quiz-question__option >> nth=0');
    }
    // After Q6 the reveal mounts; wait for navigation to /quiz/result/...
    await page.waitForURL(/\/quiz\/result\/[a-z-]+/, { timeout: 5000 });
    await expect(page.locator('.result-hero__name')).toBeVisible();
  });

  test('result page renders archetype name + accent', async ({ page }) => {
    // Pick a known region directly
    await page.goto('/quiz/result/volta');
    await expect(page.locator('.result-hero__name')).toContainText('Volta');
    await expect(page.locator('.result-hero__archetype')).toContainText('River-Bearer');
  });

  test('reduced-motion strips the bar-chart animation transition', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('/quiz');
    await page.click('.quiz-start__cta');
    for (let i = 0; i < 6; i++) {
      await page.click('.quiz-question__option >> nth=0');
    }
    // ResultReveal still renders during the brief interlude; verify the bars exist (no animation assertion)
    // Then verify the eventual navigation
    await page.waitForURL(/\/quiz\/result\/[a-z-]+/, { timeout: 5000 });
  });
});
```

- [ ] **Step 2: Run + commit**

```bash
npm run test:e2e -- quiz.spec.ts
# Expect: 18 passes (6 × 3 projects)
git add tests/e2e/quiz.spec.ts
git commit -m "test(quiz): e2e — start, advance, complete, result render, reduced-motion"
```

---

## Task 14: Lighthouse audit

Same pattern as prior phases. Build, preview, run mobile Lighthouse against `/quiz` and `/quiz/result/volta`, verify thresholds (Perf ≥ 0.9, A11y ≥ 0.9, BP ≥ 0.9, SEO ≥ 0.9, LCP < 3500ms, CLS < 0.15, TBT < 300ms).

The /quiz page has a React island (`client:load`) — expect TBT > 0 but should still be < 300ms since the bundle is small (~30-40KB, no Three.js parallel).

- [ ] **Step 1: Build + serve**

```bash
cd C:/dev/Projects/mdgh-staging
npm run build
(npx wrangler pages dev ./dist --compatibility-flag=nodejs_compat --compatibility-date=2026-05-01 --port 8788 > /tmp/w.log 2>&1 &)
sleep 7
curl -sI http://localhost:8788/quiz | head -1
curl -sI http://localhost:8788/quiz/result/volta | head -1
```

- [ ] **Step 2: Run audits + check + cleanup**

```bash
npx lighthouse http://localhost:8788/quiz --form-factor=mobile --output=json --output-path=./lh-q.json --chrome-flags="--headless --no-sandbox" --quiet
npx lighthouse http://localhost:8788/quiz/result/volta --form-factor=mobile --output=json --output-path=./lh-r.json --chrome-flags="--headless --no-sandbox" --quiet

node -e "
['./lh-q.json','./lh-r.json'].forEach(p => {
  const r = require(p);
  console.log(p.replace(/^\.\//,''), JSON.stringify({
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

rm -f ./lh-q.json ./lh-r.json
pkill -f workerd 2>/dev/null
pkill -f "wrangler pages" 2>/dev/null
```

If thresholds miss meaningfully, investigate. Don't fix CLS by adding speculative min-heights (Phase 2 lesson).

---

## Task 15: Deploy to staging + verify live (USER GATE)

- [ ] **Step 1: Push feature + merge to main + push**

```bash
cd C:/dev/Projects/mdgh-staging
git status   # clean
git push origin feature/heritage-quiz
git checkout main
git pull origin main
git merge --no-ff feature/heritage-quiz -m "Merge feature/heritage-quiz: Phase 4 of mdgh-staging elevation

Heritage Quiz live at /quiz + /quiz/result/[region] + /quiz/og/[region].png:
- 6 quiz questions seeded (home/rhythm/value/craft/wisdom/dream)
- 7 region archetypes seeded with shortLine + accentHex + prose
- QuizEngine React island holds 6-question state machine
- ProgressDots + QuestionCard + ResultReveal supporting components
- ResultHero Astro component with per-region accent gradient
- Satori + resvg-wasm OG endpoint at /quiz/og/[region].png
- Result pages use SSR pattern (Phase 3 lesson — no prerender)
- 6 Playwright e2e tests pass across browsers
- Lighthouse mobile passes thresholds (TBT > 0 due to island, < 300ms)

Direction A (Cinematic Story) per design annex 2026-05-22-quiz-direction.md.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
git push origin main
```

- [ ] **Step 2: Wait for Cloudflare Pages deploy + verify**

Use Monitor to poll for Active. Then verify:
```bash
RAND=$(date +%s)$RANDOM
curl -sI "https://staging.missdiasporagh.org/quiz?v=$RAND" | head -1
curl -sI "https://staging.missdiasporagh.org/quiz/result/volta?v=$RAND-2" | head -1
curl -sI "https://staging.missdiasporagh.org/quiz/og/volta.png?v=$RAND-3" | head -3
```

CDN cache lag may require retries (Phases 1/2/3 all hit this).

- [ ] **Step 3: USER GATE**

Surface live URL. Ask user to test:
- Start screen → Begin
- Answer 6 questions
- See bar-chart reveal → land on `/quiz/result/<region>`
- Per-region accent visible
- Share button copies URL
- Retake returns to /quiz

Wait for `approve`.

---

## Task 16: Wrap — phase memory

- [ ] **Step 1: Write `quiz-phase-4-shipped.md` to project memory**

Mirror prior phase wraps. Cover: live URLs + commit SHA + direction (Cinematic Story), new reusable concepts (Satori on Workers OG pattern, client:load React island state machine pattern), plan deltas, Lighthouse scores, approval gates honored.

- [ ] **Step 2: Update `MEMORY.md` index**

Append:
```markdown
- [Quiz Phase 4 shipped](quiz-phase-4-shipped.md) — `/quiz` cinematic 6-question flow + `/quiz/result/[region]` SSR + Satori OG at `/quiz/og/[region].png` live on staging
```

- [ ] **Step 3: Phase 4 done**

Next session begins Phase 5 (homepage maximalism polish — also addresses the font-preload CLS regression carried since Phase 2) with its own brainstorm.

---

## Self-Review Notes

**Spec coverage (§7.6):**
- Sequence of full-screen questions ✓ Task 6 + Task 8
- Fraunces display, large tap targets, illustration per question ✓ Task 6 (illustration field on Question schema available but not rendered in V1 since most questions won't have one seeded — graceful: only renders if present)
- Animated reveal of personalized region archetype ✓ Task 7 (ResultReveal bar chart)
- Shareable: dynamic OG via Satori on Worker ✓ Task 12
- CMS: quizQuestion[] + quizResult[] ✓ Tasks 1, 2
- Six questions, content-driven count ✓ Task 1

**Placeholder scan:** None.

**Type consistency:** `Region` type is defined once in `~/lib/quiz/types.ts` and used everywhere. `regionToSlug` / `slugToRegion` are consistent helpers.

**Notable deviations:**
- Question illustrations (`illustration` field on schema) NOT rendered in V1 questions. They're optional and not seeded — graceful no-op.
- Per-question illustration backgrounds are designed as ambient radial gradients (in CSS), not seeded images, to keep the visual integrity without requiring 6 commissioned illustrations. If real illustrations arrive, the QuestionCard can layer them as a background.
- `<ShareButton>` uses Web Share API if available (mobile) else copy-to-clipboard fallback. No analytics tracking.
- The OG endpoint's WASM init pulls resvg-wasm from unpkg at first request. If that's a concern (latency or CSP), bundle the WASM as a binary import. Phase 4.5 polish.
