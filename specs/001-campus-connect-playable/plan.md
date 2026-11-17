# Implementation Plan: Campus Connect First Playable

**Branch**: `001-campus-connect-playable` (spec folder; work is currently on `master`) | **Date**: 2026-11-17 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/001-campus-connect-playable/spec.md`

## Summary

A real-time, pausable campus Wi-Fi builder and ticket-diagnosis game that runs as static files in
a browser. The core is a **pure, deterministic rule engine** (RSSI, channel conflict, AP and
uplink load, availability, ticket cause truth) that is separate from the **fixed-step simulation**
(clock, waves, tickets, wave review) and from the **UI** (SVG map, zone table, controls). Levels,
tickets, hints, and sources live in `data/levels.json`. Build order puts the rule engine first so
the spec's hand-computed cases pass before any screen exists, and puts Level 3 last because it is
first in the constitution's cut order.

## Technical Context

**Language/Version**: JavaScript (ES2022 modules), HTML5, CSS3. No transpiler.

**Primary Dependencies**: None at runtime. No framework, bundler, or rendering library.

**Storage**: None. In-memory session state; reload starts fresh (FR-030). Level data is a static
JSON file loaded over HTTP with a relative URL.

**Testing**: Dependency-free browser test runner at `tests/index.html` importing the pure modules.
Node is not installed on the development machine, so tests must not require it.

**Target Platform**: Current desktop browsers (Chrome, Edge, Firefox, Safari), laptop-sized and
narrow windows. Static hosting, including a GitHub Pages repository subpath.

**Project Type**: Static single-page browser game (no backend).

**Performance Goals**: Smooth interaction on a typical laptop. The full model recomputes in well
under one frame for the largest level (about 100 zones, 6 APs, 2 buildings, about 150 users).

**Constraints**: Works from static files only (FR-037); deterministic replay (SC-003);
keyboard-complete with pause (Principle IV); relative asset paths and case-correct filenames.

**Scale/Scope**: 3 levels × 3 waves, about 5 AP/uplink actions per wave, 5 diagnosis options,
about 25 source files at most.

All items resolved; see [research.md](research.md).

## Constitution Check

*GATE: passed before Phase 0 research; re-checked after Phase 1 design (both passes below).*

| Principle | Gate | Plan response | Status |
| --- | --- | --- | --- |
| I. Technical truth | Reproducible grading; sourced rules; unsupported content blocked | `engine/rules.js` is pure; constants live in data with source IDs; `content.js` rejects unsupported content (channel 13, corner-crossing walls, zones outside buildings); expected values come from the spec's hand-computed table, not from the evaluator | Pass |
| II. Every decision teaches | Values visible; misconception-specific feedback; hints method-first | Evaluator returns structured `evidence`; `feedback.js` turns reason codes plus values into text; hint ladder is data | Pass |
| III. Fair pressure | Always pausable; fired only at review; retry free; no double scoring | Pause is an engine-level flag that stops the stepper; firing is evaluated only in `reviewWave`; state module guards duplicate submit; level snapshot taken at level start | Pass |
| IV. Access | Keyboard, text equivalents, reduced motion, narrow window | Native controls; roving-tabindex map grid; zone table tab; live region; `prefers-reduced-motion` honored; no hover-only info | Pass |
| V. Deterministic, self-contained | Fixed steps; seeded or authored randomness; no services | Fixed 0.1 s steps; arrivals are authored round-robin (no randomness in v1); no network except same-origin JSON | Pass |
| VI. Content/logic separate | Data-driven; validated; no answer-key override | `levels.json` plus `content.js` validator; ticket correctness computed by `rules.js` on current state | Pass |
| VII. Done is demonstrated | Recorded verification; README matches build | Slice exit evidence and a `verification.md` recording pass/fail/not run per AC | Pass |

**Post-design re-check**: no violations introduced by data model, contracts, or quickstart.
Complexity Tracking is empty.

## Project Structure

### Documentation (this feature)

```text
specs/001-campus-connect-playable/
├── plan.md              # This file
├── research.md          # Phase 0 decisions
├── data-model.md        # Phase 1 entities, states, validation
├── quickstart.md        # Phase 1 run and validation guide
├── contracts/
│   ├── level-data.md    # levels.json shape and validation rules
│   ├── engine-api.md    # Pure rule engine and simulation module contracts
│   └── ui-controls.md   # Keyboard map, focus, live region, text equivalents
├── checklists/
│   └── requirements.md
└── tasks.md             # Created later by /speckit-tasks
```

### Source Code (repository root)

```text
index.html                    Semantic page shell and module entry point
style.css                     Layout, focus rings, feedback states, reduced motion
main.js                       Load, validate, start; loading and content-error screens
engine/
  geometry.js                 Integer grid math, exact wall-crossing (doubled coordinates)
  rules.js                    Pure model: RSSI, serving AP, conflicts, loads, delivery, causes
  content.js                  Validate levels.json; reject unsupported content
  sim.js                      Fixed-step stepper: clock, arrivals, failures, ticket timers
  review.js                   Wave review: satisfaction, firing check, score components
  state.js                    Session: views, snapshot/retry, purchases, tickets, restart
  feedback.js                 Reason codes plus evidence into explanation text
ui/
  render.js                   Briefing, map (SVG), zone table, tickets, review, summaries
  assets.js                   Loads assets/manifest.json; image elements; optional sound (off by default)
  controls.js                 Keyboard handling, focus management, live-region announcements
assets/                       Original art and audio pack with manifest.json (supplied; do not edit)
data/
  levels.json                 Levels, maps, waves, tickets text, hints, sources, constants
tests/
  index.html                  Browser test runner with totals and failed case IDs
  fixtures.js                 Worked-interaction and case-table states (hand-derived)
  rules.test.js               Spec Model Verification Cases
  sim.test.js                 Determinism replay, pause, ticket timers, scheduled failure
  review.test.js              Firing boundary, scoring, retry snapshot
  state.test.js               Purchases, duplicate submit, hints, restart/cancel
  content.test.js             Invalid or ambiguous authored data
  diagnosis.test.js           Cause truth rules, feedback evidence, worked interaction
  zonetable.test.js           Zone table equals map values; cell accessible names
  level3.test.js              Scheduled failure, redundancy, channel conflicts (if built)
  assets.test.js              Manifest intact, files exist, every asset id used by code exists
README.md                     Run instructions, behavior, limits, recorded verification
verification.md               Pass / fail / not run per acceptance criterion with evidence
```

**Structure Decision**: single static project at the repository root, matching the workshop
`StarterKit/PLAN.md` layout. `engine/` imports nothing from `ui/` or the DOM, which enforces the
Principle VI separation and lets the same modules run in the test page.

## Build Order and Cut Line

| Slice | Deliverable | Evidence before next slice | Cut? |
| --- | --- | --- | --- |
| 1 · Prove the rules | `geometry.js`, `rules.js`, `content.js` plus the spec's 13 cases | All cases pass independently of UI | Never |
| 2 · One wave playable | `sim.js`, `review.js`, `state.js`, SVG map, build, pause, one ticket, review, retry | One correct and one wrong ticket path, firing and pass, in a browser | Never |
| 3 · Levels 1–2 | Level data, briefings, hints, level summary, scoring | Worked interaction reproduces spec text exactly | Never |
| 4 · Make it usable | Keyboard map, zone table, live region, reduced motion, narrow layout | Keyboard-only playthrough recorded | Never |
| 5 · Package | README, `verification.md`, hosting check | Another attendee can run it | Never |
| 6 · Level 3 | Manual channels, conflicts UI, scheduled failure, redundancy | Failure with and without second uplink | **First to cut** |

Constitution cut order after Level 3 is polish, then persistence (not planned). Correct grading,
explanations, pause, and the wave review are not cuttable.

## Complexity Tracking

No constitution violations. The plan adds no layers beyond the spec: the only structural choice
beyond "UI plus data" is separating `engine/` from `ui/`, which Principle VI requires.
