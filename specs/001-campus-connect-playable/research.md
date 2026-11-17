# Research: Campus Connect First Playable

All Technical Context unknowns are resolved below. Each entry: decision, rationale, alternatives.

## R1 · Stack: plain ES modules, no framework or bundler

- **Decision**: HTML, CSS, and native JavaScript modules; DOM controls, SVG for the map.
- **Rationale**: The constitution requires static-files-only play (Principle V) and the workshop
  budget is 60 minutes. Native controls give keyboard and screen-reader behavior for free
  (Principle IV). No build step means nothing to install or break.
- **Alternatives**: React/Vue (build tooling and extra a11y surface, no benefit at this scale);
  Canvas or WebGL/Three.js (no text equivalent by default, harder keyboard support, rejected for
  Principle IV).

## R2 · Map rendering: SVG with a roving-tabindex grid

- **Decision**: Render zones as SVG `<rect>` elements inside a grid with one tab stop; arrow keys
  move focus between cells. Each cell has an accessible name ("Library zone C4, RSSI −65.0 dBm,
  covered, 2 users"). Heat color is always paired with the number.
- **Rationale**: SVG elements are inspectable, scale to narrow windows, and take `aria-label`.
  A single tab stop avoids hundreds of tab presses.
- **Alternatives**: One button per cell (too many tab stops); canvas plus offscreen DOM (duplicate
  structure to keep in sync).

## R3 · Testing without Node

- **Decision**: `tests/index.html` runs ES-module test files in the browser and shows totals and
  failed case IDs; zero discovered tests is a failure. Serve with `python -m http.server`
  (Python 3.14 is available here; `py` on Windows).
- **Rationale**: Node and npm are not installed, and the starter kit already specifies this
  runner. Pure engine modules import the same way in the page and in tests.
- **Alternatives**: Installing Node plus a test framework (new dependency, setup time, not needed).
  Optional later: a headless browser smoke run if one is installed; not required.

## R4 · Deterministic fixed-step simulation

- **Decision**: Simulation time advances in fixed 0.1 s steps (10 per simulated second). A
  `requestAnimationFrame` loop accumulates real time scaled by speed (1× or 2×) and runs whole
  steps; pause stops accumulation. All state changes happen inside `step()`. Player actions are
  applied between steps and stamped with the current step number.
- **Rationale**: Frame-rate independence (Principle V). A scripted replay of
  `(step, action)` pairs must give identical reviews and scores (SC-003). Tenths of a second
  keep ticket timers (10 s, 90 s) and the 0:30 failure exactly representable as integer steps.
- **Alternatives**: Variable delta-time (non-deterministic across machines); one step per
  second (coarse; actions between seconds would need rounding rules).

## R5 · Randomness: none in v1

- **Decision**: Arrivals are authored: each wave lists arrival zones and counts; users arrive
  evenly (user *i* of *N* at step `round(i × 600 / N)`) and are assigned to zones by round-robin
  over the wave's listed zones. Users from the previous wave leave when it ends, so a wave's
  count is the total present at wave end. No random generator in v1.
- **Rationale**: Principle V allows authored data or a seeded generator. Authored arrivals are
  simplest and make hand-checking easier. If randomness is ever added, a seed field in level data
  and a seeded generator (for example mulberry32) will be required, with an amendment to the spec.
- **Alternatives**: Seeded random zone assignment (adds a generator and a replay surface with no
  teaching value).

## R6 · Exact geometry for wall crossings

- **Decision**: Work in doubled integer coordinates (cell centers at odd values, cell edges at
  even values) so segment-versus-wall intersection tests use exact integer arithmetic. If the
  AP-to-zone segment passes through a grid vertex (a wall endpoint), or is collinear with a wall,
  the pair is ambiguous (spec edge case "wall line through a cell corner"). Because this depends
  on where the player puts an AP, validation checks every possible AP cell against every zone when
  the level loads. A level where any pair is ambiguous is rejected with a content error, so the
  authored map must avoid such layouts.
- **Implemented rule**: ambiguity is flagged only where the path passes exactly through a wall endpoint that is not the middle of one straight, same-type wall (a wall end, a T-junction, a join of different types, or running along a wall). A path through a shared vertex of two collinear same-type edges counts as one crossing. Without this, diagonal neighbors across any multi-edge wall would be unplayable.
- **Decision on the open risk**: keep the spec's rule as written. The authored maps must avoid
  wall lines through grid corners; if a realistic layout proves impractical, propose a spec change
  for approval rather than loosening the validator silently.
- **Rationale**: Floating-point intersection could flip a wall count at exact grid points and
  change grading (Principle I). Integer math removes that.
- **Alternatives**: Epsilon-based float tests (can mis-count at vertices); disallow diagonal
  walls entirely (does not remove the vertex problem for diagonal lines).

## R7 · Comparison tolerance and boundaries

- **Decision**: Compare unrounded values. Where exact rational comparison is possible, use
  integers: AP utilization is `demand × (1 + conflicts) ≤ 100` and uplink utilization is
  `traffic ≤ capacity`, so "exactly 100%" is exact. Satisfaction compares as
  `delivered × 100 ≥ 70 × demanded` with a documented `1e-9` tolerance, since delivered values
  involve proportional scaling. RSSI uses floating `log10` and is only compared to −67.0 and
  −82.0; the spec's boundary cases (−66.94, −67.31) sit far from the thresholds.
- **Rationale**: Prevents display rounding from changing grading (FR-013).
- **Alternatives**: Round everything to 0.1 first (violates FR-013 and flips boundary cases).

## R8 · Ticket cause evaluation

- **Decision**: `causesFor(zone, model)` returns the set of true causes from FR-015 using current
  model state: `weak-signal`, `uplink-down`, `channel-interference`, `uplink-congested`,
  `ap-overloaded`. The UI never stores a "correct answer". A ticket also records the causes true
  at opening for explanation only (FR-017a), never for grading.
- **Rationale**: Principle VI (no hand-authored key overrides the engine) and the clarified
  "any true cause accepted" rule.
- **Alternatives**: Per-ticket authored answer (rejected by Principle VI).

## R9 · Model computation pipeline

- **Decision**: Fixed order per recompute: (1) RSSI for each AP/zone pair; (2) serving AP per
  zone and covered flag; (3) conflicts between AP pairs and effective capacity; (4) per-AP
  demand from covered zones' users; (5) AP delivery `min(demand, effectiveCapacity)` and
  per-user share; (6) per-building traffic and working uplink capacity; (7) building scale
  `min(1, capacity / traffic)` (0 if no working uplink); (8) per-zone and campus delivered Mbps
  and satisfaction.
- **Rationale**: Matches the spec's rules and reproduces its worked cases (3 APs × 60 Mbps on
  100 Mbps gives 180% and 55.6%). One ordered pipeline makes each value traceable (SC-008,
  constitution Principle VI evidence).
- **Alternatives**: Per-user iterative allocation (more complex, no teaching value).

## R10 · Level data authoring

- **Decision**: One `data/levels.json` with `schemaVersion`, `constants`, `sources`, `levels`.
  `constants` holds EIRP, PL(1 m), n, thresholds, wall losses, demand per type, prices, capacities,
  timers, so model values are not scattered in code. Validated before any level starts.
- **Rationale**: Principle VI and FR-032. A new level or ticket using existing mechanics should be
  a data change.
- **Alternatives**: Constants in JS (cannot be reviewed separately from logic).

## R11 · Sources for the [VERIFY] references

- **Decision**: `sources` records carry title, URL, section, and supported claim. The `[VERIFY]`
  sections from `StarterKit/SPEC.md` (ITU-R P.1238 path loss, IEEE 802.11-2020 channel plan and
  CCA, a named vendor guide for −67 dBm) must be filled in with exact sections before release.
  Wall losses are labeled "illustrative" unless a site-survey guide is cited.
- **Rationale**: Principle I requires a source link and section per networking rule. This is
  research to be done while implementing slice 3, tracked as a release dependency in the spec.
- **Alternatives**: Ship uncited constants (violates Principle I).

## R12 · Hosting

- **Decision**: Static hosting with relative URLs; GitHub Pages from the repository root is the
  optional target. Local run uses `python -m http.server`.
- **Rationale**: `file://` blocks module imports and JSON fetch, so a server is the supported
  path. The `README` and quickstart state this.
- **Alternatives**: Inlining data into JS to allow `file://` (loses the data/logic separation
  the constitution values).

## R13 · Art and audio pack

- **Decision**: Use the supplied pack in `assets/` through a small loader, `ui/assets.js`, that
  reads `assets/manifest.json`. Images are SVG (PNG fallback); sound prefers OGG with MP3 as the
  fallback. Sound is off by default with a visible toggle, music ducks while paused, and a missing
  pack never blocks play.
- **Rationale**: The pack is original (Apache-2.0, matching the repository license), carries titles
  and descriptions for alt text, and follows the constitution's rules: color is never the only
  signal, and sound carries no information alone. A manifest lookup avoids hard-coded paths.
- **Checks**: The SVGs were scanned and contain no scripts or external references.
  `tests/assets.test.js` checks the manifest counts, that every listed file exists, and that every
  asset id used in code exists.
- **Alternatives**: Draw sprites in code (more work, nothing to cite); inline SVG per sprite
  (no reuse of the supplied manifest).
