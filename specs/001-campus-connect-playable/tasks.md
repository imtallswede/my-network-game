---

description: "Task list for Campus Connect first playable"
---

# Tasks: Campus Connect First Playable

**Input**: Design documents from `/specs/001-campus-connect-playable/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/, quickstart.md

**Tests**: Included. The spec requires every Model Verification Case to pass in automated checks
(SC-002), and the plan defines a browser test runner. Test tasks come before the code they check.

**Organization**: Tasks are grouped by user story. Level 3 (US5, P2) is last and is the first
thing cut if time runs short (constitution cut order). Phases 1–7 are the minimum release.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies on unfinished tasks)
- **[Story]**: US1–US5, matching `spec.md`
- Paths are relative to the repository root, per `plan.md` Project Structure
- Field citations like `data-model.md Constants.channelRange` point to the canonical definition;
  the constraint itself is not repeated here

## Path Conventions

Single static project at the repository root: `index.html`, `style.css`, `main.js`, `engine/`,
`ui/`, `data/`, `tests/`. Serve with `py -m http.server 8000 --bind 127.0.0.1` (see `quickstart.md`).

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Project skeleton and the test runner, so every later task can be checked.

- [X] T001 Create the directory skeleton `engine/`, `ui/`, `data/`, `tests/` at the repository root with an empty `.gitkeep` in each (remove once real files exist)
- [X] T002 [P] Create `index.html`: semantic shell with a heading, regions for map, side panel (tickets, selected zone), tab control (Map / Zone table), a persistent `aria-live="polite"` feedback region, and `<script type="module" src="main.js">` (layout per `contracts/ui-controls.md`)
- [X] T003 [P] Create `style.css`: layout for laptop and narrow widths, always-visible focus ring, scrollable labeled containers for dense data, and `prefers-reduced-motion` rules (per `contracts/ui-controls.md`)
- [X] T004 [P] Create `tests/index.html`: dependency-free runner that imports each `tests/*.test.js` module, shows total, passed, and failed case IDs, and reports zero discovered tests as a failure (per plan Verification section)
- [X] T005 [P] Implement `ui/assets.js` and `tests/assets.test.js` for the supplied `assets/` pack: manifest loader, `imageEl`/`imageUrl` helpers (SVG, alt text from the manifest, a `decorative` option when text sits beside the icon), optional sound with OGG then MP3 fallback, off by default, a mute toggle in `index.html` using `ui-sound-on`/`ui-sound-off`, music ducking while paused; tests check manifest counts, that every listed file exists, and that every asset id used by code exists (FR-039, research R13)

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: The pure rule engine, level-data validation, and constants. No user story can start
until the spec's hand-computed rule cases pass (plan slice 1, constitution Principle I).

**CRITICAL**: No user story work can begin until this phase is complete.

- [X] T006 [P] Create `data/levels.json` with `schemaVersion`, the `constants` block (every field defined under Constants in `data-model.md`: `Constants.eirpDbm`, `Constants.pl1mDb`, `Constants.pathLossExponent`, `Constants.coverageThresholdDbm`, `Constants.ccaThresholdDbm`, `Constants.apCapacityMbps`, `Constants.conflictChannelDelta`, `Constants.channelRange`, `Constants.wallLossDb`, `Constants.demandMbps`, `Constants.prices`, `Constants.uplinkCapacityMbps`, `Constants.ticketOpenSteps`, `Constants.fireTicketAgeSteps`, `Constants.fireSatisfactionPct`, `Constants.waveSteps`, `Constants.pointsPerDiagnosis`, `Constants.minDistanceM`), and a `sources` list using `data-model.md Source.status` (mark any source whose section is not yet verified as `illustrative`); empty `levels` array for now
- [X] T007 [P] Implement `engine/geometry.js`: cell-center distance in meters honoring `data-model.md Constants.minDistanceM`; doubled-integer coordinates; exact segment-versus-wall crossing using `data-model.md Wall.type` edges; report segments that pass through a grid vertex or run collinear with a wall as ambiguous (research R6)
- [X] T008 Create `tests/fixtures.js`: the 13 Model Verification Cases from `spec.md` as data (inputs and expected values copied from the spec table, not computed by `engine/`), covering coverage correct and both boundaries, weak signal, AP overloaded, uplink congested, utilization boundary, channel conflict and boundary, redundancy, single point of failure, firing boundary, unsupported content
- [ ] T009 Human review: a second person re-checks every expected value in `tests/fixtures.js` against the formulas in `spec.md` (FR-005 to FR-013) and records name, date, and result in `verification.md` (create it with a "Model case review" heading). Constitution Principle I requires this before slice 2
- [X] T010 [P] Write `tests/rules.test.js` for the model cases in `tests/fixtures.js`: RSSI and Covered at −65.0, −66.9, −67.3, −70.3 dBm; exactly-100% utilization not congested; channel conflict 1/3 gives 50 Mbps each; 1/5 conflicts while 1/6 does not; redundancy 200 → 100 Mbps with 180% and 55.6%; single uplink failure gives 0 Mbps. Tests must fail before T011
- [X] T011 Implement `engine/rules.js` `computeModel` following the ordered pipeline in `research.md` R9 and the shape in `data-model.md` "Derived model result": RSSI per AP/zone, serving AP (lowest `data-model.md AccessPoint.id` on ties), conflicts using `data-model.md AccessPoint.channel` and `Constants.ccaThresholdDbm`, effective capacity, AP demand using `data-model.md User.type`, delivery, building scale using `data-model.md Uplink.capacityMbps` and `Uplink.state`, zone and campus satisfaction. Use integer cross-multiplication for 100% comparisons (research R7). Make T010 pass
- [X] T012 [P] Write `tests/content.test.js`: invalid data is rejected with level and item IDs for channel 13, a locked channel list other than 1/6/11, a wall line through a grid vertex, a zone outside any building, duplicate IDs, a wave count other than three, a missing zone or source reference, and unaffordable starting equipment (rules in `data-model.md` Validation rules). Tests must fail before T013
- [X] T013 Implement `engine/content.js` `validateContent` per `contracts/level-data.md` and `data-model.md` Validation rules, using `data-model.md Level.channelMode`, `Level.budget`, `Level.apLimit`, `Wave.index`, and `Constants.channelRange`, and using `engine/geometry.js` for wall ambiguity checks. Return `{ ok, errors[] }` with `{ levelId, itemId, code, message }`. Make T012 pass
- [X] T014 Implement `main.js` loading: fetch `data/levels.json` via a relative URL, run `validateContent`, show a loading state, and on failure render an on-screen error panel (announced via the live region) that blocks starting any level and is never counted as an attempt (`contracts/level-data.md` Error output)

**Checkpoint**: `tests/` shows all rule and content tests passing and T009 is signed off.

---

## Phase 3: User Story 1 - Build ahead of demand (Priority: P1) 🎯 MVP

**Goal**: Place APs and uplinks on the Level 1 map, see RSSI and coverage respond, run and pause
the clock, and watch users arrive.

**Independent Test**: Start fresh, read the Level 1 briefing (clock paused, no users), place one
AP, and confirm each zone's RSSI and Covered/Not covered match the model cases. Try an
over-budget purchase (refused) and pause while building (nothing advances).

### Tests for User Story 1

- [X] T015 [P] [US1] Write `tests/sim.test.js`: fresh level starts paused with zero users (AC1); the clock, arrivals, and (later) ticket ages do not advance while paused (AC4); purchases over budget are refused with cost and remaining budget and change nothing, and a purchase equal to the remaining budget succeeds (AC3); removals refund 100% (AC5); replaying the same `(step, action)` log twice gives identical state (SC-003). Tests must fail before T017

### Implementation for User Story 1

- [X] T016 [US1] Add Level 1 "Orientation Week" to `data/levels.json`: library map with drywall and concrete walls (`data-model.md Wall.type`), waves of 20/40/60 Light users (`data-model.md Wave.index`, `data-model.md Wave.arrivals`), 1 Gbps pre-installed uplink, AP limit and budget per `spec.md` FR-031 (`data-model.md Level.apLimit`, `Level.budget`), locked channels 1/6/11 (`data-model.md Level.channelMode`), briefing text with the "simplified model" notice and a static worked example (`data-model.md Level.briefing`), and `previewText` for each wave. Keep the layout free of ambiguous wall lines (research R6). Re-run `engine/content.js` validation on it
- [X] T017 [US1] Implement `engine/sim.js`: `createSim`, fixed-step `step()` of 0.1 s with a paused flag that blocks stepping, even arrivals with round-robin zone assignment (research R4, R5, `data-model.md User.type`), removal of the previous wave's users at wave end, Wave 1 starting on the first resume after the briefing, wave-end detection, and `applyAction` for `place-ap`, `move-ap`, `remove-ap`, `set-channel`, `buy-uplink`, `upgrade-uplink`, `remove-uplink`, `set-paused`, `set-speed` (`data-model.md Session.speed`), each logged to `actionLog` with the step. Use `data-model.md Constants.prices`, `Uplink.capacityMbps`, and `AccessPoint.channel`. Make T015 pass
- [X] T018 [US1] Implement `engine/state.js` session core: views `loading → briefing → running`, level start paused behind the briefing (AC1), level snapshot taken at level start for later Retry, budget and equipment held in session state (`data-model.md Session` fields)
- [X] T019 [US1] Implement `engine/feedback.js` purchase and placement messages: refused-over-budget (shows cost and remaining budget), over AP limit, invalid cell, and refund confirmation, returned as text for the live region
- [X] T020 [US1] Implement `ui/render.js` for Level 1: briefing view with its static worked example and the level's building art and banner (`ui/assets.js`), SVG campus map built from the pack's tiles, wall segments, `ap`, user sprites and `map-cursor` with heat color plus RSSI number and Covered/Not covered label on every zone, users as dots, always-visible HUD (clock and pause state, budget, score, campus satisfaction), selected-zone panel (RSSI, channel, utilization, uplink load), and equipment panel with buy/remove buttons
- [X] T021 [US1] Implement basic pointer and button controls in `ui/controls.js`: click a cell to place or select, remove button, pause button and `Space`, speed toggle 1×/2× (full keyboard map comes in US4)
- [X] T022 [US1] Wire the game loop in `main.js`: `requestAnimationFrame` accumulator running whole 0.1 s steps scaled by speed, no stepping while paused, re-render on each change

**Checkpoint**: Level 1 is playable up to the end of a wave (no tickets or review yet). `tests/` passes.

---

## Phase 4: User Story 2 - Diagnose trouble tickets (Priority: P1)

**Goal**: Tickets open for unhappy zones; the player picks a cause and gets feedback that cites
the actual values; hints are recorded as assistance.

**Independent Test**: Load the Level 2 worked-interaction state, submit Weak signal, AP
overloaded, and Uplink congested in turn, and confirm text, status, and score (+25 once) match
`spec.md` US2 and `quickstart.md` scenario 2.

### Tests for User Story 2

- [X] T023 [US2] Extend `tests/fixtures.js` with the Level 2 worked-interaction state (three APs on 1/6/11, 12 Video users each, one 100 Mbps uplink, zone 2B at −53.0 dBm) and the expected feedback values from `spec.md` (RSSI −53.0 vs −67, AP at 60%, 180% uplink, 55.6% share)
- [ ] T024 Human review: a second person re-checks the Level 2 fixture values added in the previous task (`tests/fixtures.js`) against `spec.md` US2 and records name, date, and result in `verification.md` before the diagnosis tests rely on them
- [X] T025 [P] [US2] Write `tests/diagnosis.test.js`: worked interaction accepts only Uplink congested and rejects Weak signal and AP overloaded with the right evidence; the AP-at-125% case rejects Weak signal; zone with several true causes accepts any true cause and lists all in fix order (clarified FR-016); channel interference versus AP overloaded rules (clarified FR-015); invalid or missing choice returns `invalid-input`; content error is never graded. Tests must fail before T027
- [X] T026 [P] [US2] Write `tests/state.test.js`: one ticket per zone; ticket opens only after `data-model.md Constants.ticketOpenSteps` below 100%; wrong diagnosis leaves ticket open with no score change; empty submit does not change `data-model.md Ticket.attempts`; correct diagnosis sets `data-model.md Ticket.status` to diagnosed and awards `data-model.md Ticket.awardedPoints` of 25 exactly once; repeated Submit is a no-op; hint then worked solution recorded in `data-model.md Ticket.assistance` without diagnosing; zone reaching 100% before diagnosis gives `resolved-by-change` with no points and the notice names causes at open and the fixing change (FR-017a). Tests must fail before T028

### Implementation for User Story 2

- [X] T027 [US2] Implement `causesFor` and `evaluateDiagnosis` in `engine/rules.js` per `contracts/engine-api.md` and FR-015/FR-016: correctness is computed from current model state only, never from a stored answer key. Make T025 pass
- [X] T028 [US2] Extend `engine/sim.js` with tickets per `data-model.md Ticket.zoneId`, `data-model.md Ticket.openedStep`, `data-model.md Ticket.status`, `data-model.md Ticket.causesAtOpen`, `data-model.md Ticket.attempts`, `data-model.md Ticket.assistance`, and `data-model.md Ticket.awardedPoints`: zone-below-100% counters, open at `Constants.ticketOpenSteps`, one open ticket per zone, aging of every non-closed ticket including diagnosed ones (clarified FR-020), `causesAtOpen` recorded for explanation only, auto-close and resolved-by-change, and actions `submit-diagnosis` and `request-hint`; award `Constants.pointsPerDiagnosis` once. Emit `ticket-opened`, `ticket-closed`, `ticket-resolved-by-change`. Make T026 pass
- [X] T029 [US2] Extend `engine/feedback.js` `explain()`: reason-code templates that name the value ruling a cause in or out and the next place to look, list all true causes in fix order, and render the hint ladder (method first, then worked solution) from level data; rounding for display only (RSSI 0.1 dBm, utilization whole percent)
- [X] T030 [US2] Add Level 2 "Dorm Move-In" to `data/levels.json`: dorm map, 100 Mbps uplink, waves of 20/40/50 Video users, locked channels, budget and AP limit per `spec.md` FR-031 (`data-model.md Level.budget`, `Level.apLimit`, `Level.channelMode`), a static worked example in the briefing (`data-model.md Level.briefing`), ticket templates (including "Dorm room 2B"), hint text, and source IDs. Validate with `engine/content.js`
- [X] T031 [US2] Extend `ui/render.js` with the ticket list (status icon from the `ticket-*` assets plus text, age), ticket detail with radio group of five causes (each with its `cause-*` icon and a text label), Submit and Hint buttons, persistent feedback text showing the values used, and *Diagnosed – awaiting fix* / *Resolved by network change* states
- [X] T032 [US2] Extend `ui/controls.js` to handle selecting a ticket, choosing a cause, Submit (including empty-selection guidance), Hint, and refusing repeated Submit after success

**Checkpoint**: The worked interaction in `quickstart.md` scenario 2 passes in the browser and in `tests/`.

---

## Phase 5: User Story 3 - Wave review, firing, and progression (Priority: P1)

**Goal**: Each wave ends with a review that explains scoring or firing, supports free retry, and
advances to the next wave, level, or session summary.

**Independent Test**: Script a wave ending at exactly 70.0% (passes) and one at 69.9% (fired,
reason shown); Retry restores the level start; passing wave 3 shows the level summary.

### Tests for User Story 3

- [X] T033 [P] [US3] Write `tests/review.test.js`: 70.0% passes and 69.9% fires; a ticket open exactly `data-model.md Constants.fireTicketAgeSteps` passes and one step more fires; budget never fires; the review names metric, value, threshold, and cause; score components `round(satisfaction)`, 25 per diagnosis, and `floor(budget/100)` on level completion; Retry restores the level snapshot with no penalty; passing wave 3 completes the level; Restart asks for confirmation and Cancel changes nothing; the next wave is previewed before it starts. Tests must fail before T034

### Implementation for User Story 3

- [X] T034 [US3] Implement `engine/review.js` `reviewWave` per `contracts/engine-api.md`: campus satisfaction measured at the moment the wave ends (clarified FR-012) using `data-model.md Constants.fireSatisfactionPct`, strict greater-than for ticket age against `Constants.fireTicketAgeSteps`, score components, `firedBy` with metric, value, threshold, and network cause, and `nextPreview`. Make T033 pass
- [X] T035 [US3] Extend `engine/sim.js` so a wave runs `data-model.md Constants.waveSteps` steps, stops at wave end, and the next wave starts only when the player continues from the review (previous wave's users removed at wave end)
- [X] T036 [US3] Extend `engine/state.js`: `wave-review`, `level-summary`, and `session-summary` views, fired → Retry level restoring the snapshot taken in T018, level completion and next briefing, session high score for the page session only (FR-030), and Restart with a confirm step where Cancel is a no-op
- [X] T037 [US3] Extend `ui/render.js` with the review (written in the original Dean of IT character's patient voice, FR-038, using the `dean-of-it-*` expressions and `stamp-*` art alongside the text; satisfaction with delivered and demanded Mbps, oldest ticket age, every score component, firing explanation, next-wave preview), the level summary (waves passed, tickets diagnosed first try / after a hint / after a worked solution, score, budget left), the session summary, and the restart confirmation dialog
- [X] T038 [US3] Extend `ui/controls.js` for Continue, Retry level, Restart with Confirm and Cancel, and advancing from the summaries

**Checkpoint**: Levels 1 and 2 can be played start to finish; firing and retry work.

---

## Phase 6: User Story 4 - Play with accessible controls (Priority: P1)

**Goal**: Everything is usable by keyboard, with text equivalents, auto-pause, and reduced-motion
and narrow-window support.

**Independent Test**: Complete Level 1 Wave 1 with keyboard only, including a pause and one
ticket; confirm the zone table matches the map.

### Tests for User Story 4

- [X] T039 [P] [US4] Write `tests/zonetable.test.js`: the zone table rows (RSSI, serving AP, channel, users, AP utilization, uplink utilization) equal the values behind the map for the Level 1 and Level 2 fixtures, and every map cell's accessible name contains zone, RSSI, covered state, serving AP, and users. Tests must fail before T042

### Implementation for User Story 4

- [X] T040 [US4] Implement the full keyboard map from `contracts/ui-controls.md` in `ui/controls.js`: roving-tabindex map with arrow keys, `A` place, `Delete` remove, `C` channel list (hidden when locked), `T` cycle tickets, `H` hint, `1`/`2` speed, `Space` pause, tab-control navigation, and every action also reachable by a visible button; list shortcuts on screen
- [X] T041 [US4] Extend `ui/render.js`: channel badges (`channel-NN`) beside each AP and in the zone table next to the number, the `legend-*` images, accessible names on map cells, the Zone table tab as a real `<table>` with headers, text and icon (not color alone) for congestion, conflict, and uplink-down states, focus moved to the heading after each view change, and feedback announced through the live region while staying on screen
- [X] T042 [US4] Add a pure `zoneRows(model)` helper used by both `ui/render.js` and `tests/zonetable.test.js` so the table and map read the same values; make T039 pass
- [X] T043 [US4] Add the auto-pause setting to `engine/sim.js` and `ui/controls.js`: on by default, pauses when a ticket opens and at each wave review, with a visible toggle that holds for the page session (FR-022)
- [X] T044 [US4] Finish `style.css`: honor `prefers-reduced-motion` by removing user-dot movement without hiding information, stacked narrow layout down to 320 CSS px width (also checked at 1366×768) where pause and action buttons stay visible and dense data scrolls in labeled containers, and non-hover-only details
- [ ] T045 [US4] Human check: keyboard-only playthrough of Level 1 Wave 1 including pause and one ticket, a narrow-window check, and a reduced-motion check; record browser, date, and what was actually checked in `verification.md` (constitution Principle IV evidence; no accessibility certification claim)

**Checkpoint**: All P1 stories work and are keyboard-checked. Finish Phase 7 to complete the minimum release.

---

## Phase 7: Release Gate for Levels 1–2

**Purpose**: Sources, evidence, and documentation for the minimum release. This phase comes
before Level 3 so a verified, shippable game exists even if Level 3 is cut.

- [ ] T046 Fill the `[VERIFY]` references in `data/levels.json` `sources` (ITU-R P.1238 path loss, IEEE 802.11-2020 channel plan and CCA, a named vendor guide for −67 dBm): exact section, URL, claim, and `data-model.md Source.status` set to `verified` or `illustrative`; link each briefing and explanation to its source IDs (constitution Principle I, FR-033).
- [ ] T047 Human review: read every briefing, ticket text, hint, and explanation template in `data/levels.json` and `engine/feedback.js` against the cited sources and record name, date, and result in `verification.md` (constitution Principle I evidence)
- [ ] T048 Content/logic separation check: trace one zone's RSSI and one AP's utilization through `engine/rules.js` for Level 1, then add a trial ticket by editing only `data/levels.json` and `tests/`; confirm `git diff` shows no change under `engine/` or `ui/`; record in `verification.md` (Principle VI evidence, SC-008)
- [ ] T049 Playtest: a teammate plays Levels 1–2 from a fresh start; record play time (SC-001), a mapping of each player action and ticket type to LO1–LO3 (Principle II evidence), and their own explanation of why Weak signal was wrong on the worked ticket (SC-005) in `verification.md`
- [ ] T050 [P] Write `README.md`: what the game teaches, how to run (`py -m http.server 8000 --bind 127.0.0.1`), simplified-model notice and exclusions, source list, asset credits and license (`assets/README.md`, Apache-2.0), current status, known limits, and Level 3 status (built, in progress, or cut and why)
- [ ] T051 Write `verification.md` results: for every acceptance criterion in `spec.md` record pass / fail / not run, date, environment, and evidence; keep failed and unrun checks visible (Principle VII)
- [ ] T052 Run every scenario in `quickstart.md` from a fresh browser session and record outcomes in `verification.md`; confirm no network request other than same-origin files is needed (SC-007)

**Checkpoint**: Levels 1–2 are playable, sourced, documented, and verified. This is the minimum release.

---

## Phase 8: User Story 5 - Level 3 Homecoming: interference and availability (Priority: P2)

**Goal**: Manual channels, visible conflicts, and a scheduled uplink failure that rewards
redundancy. **First to cut if time runs short.**

**Independent Test**: Play Level 3 with and without a second student-center uplink and confirm
the failure at 0:30 of Wave 2 takes the building to 0 Mbps without redundancy and to reduced
capacity with it.

### Tests for User Story 5

- [ ] T053 [P] [US5] Write `tests/level3.test.js`: a scheduled failure at wave 2 step 300 fails the student-center uplink; one uplink gives 0 Mbps and tickets accept Uplink down; two uplinks keep the building online at reduced capacity; conflicts show 50 Mbps for channels 1 and 3 and none for 1 and 6; Wave 2 preview mentions scheduled maintenance risk. Tests must fail before T054

### Implementation for User Story 5

- [ ] T054 [US5] Extend `engine/sim.js` with scheduled failures (`data-model.md Scheduled failure.wave`, `data-model.md Scheduled failure.atSteps`, `data-model.md Scheduled failure.building`, `data-model.md Scheduled failure.uplinkIndex`): at the scheduled step set `data-model.md Uplink.state` to failed for the rest of the level and emit `uplink-failed`. Make T053 pass
- [ ] T055 [US5] Add Level 3 "Homecoming" to `data/levels.json`: stadium and student center, Event users 30/50/70 and 20/30/40 per wave, one 100 Mbps uplink per building, up to 6 APs, `data-model.md Level.channelMode` manual (channels per `Constants.channelRange`), budget 5,000, failure at wave 2 step 300 for the student center, briefing and Wave 2 preview text "scheduled maintenance risk". Validate with `engine/content.js`
- [ ] T056 [US5] Extend `ui/render.js` and `ui/controls.js`: channel selector for each AP in manual mode with conflict indicators (text and the `ap-channel-conflict` icon), `uplink-failed` and `overlay-uplink-down` art, the `scheduled-maintenance-risk` icon on the Wave 2 preview, grey users and "Uplink down" status when a building has no working uplink, and uplink failure announced through the live region
- [ ] T057 [US5] Human check: play Level 3 with and without a second student-center uplink; record results and the full-solution cost (about $3,800 of $5,000) in `verification.md`
- [ ] T058 Update `README.md`, `verification.md`, and the quickstart results for Level 3, or record that Level 3 was cut and why (constitution Principle VII)

**Checkpoint**: All three levels playable. If Level 3 is cut, record that in `README.md` and `verification.md` and move to Phase 9.

---

## Phase 9: Polish & Cross-Cutting Concerns

**Purpose**: Optional hosting check and the final consistency pass.

- [ ] T059 Wire optional audio in `ui/controls.js` and the sim event handling via `ui/assets.js`: effects for build, ticket, wave and failure events as described by each manifest `use` field, music per screen, `voice-*` lines for the Dean and users; every sound has an on-screen text equivalent from `soundCaption()`, sound stays off by default, and no gameplay depends on it (FR-039). Cut this before anything else
- [ ] T060 [P] Optional: check the game under a repository subpath (for example GitHub Pages) for relative paths and filename case; record result
- [ ] T061 Run `/speckit-analyze` and fix any spec, plan, tasks, and README disagreement before calling the build done

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: none. Start immediately.
- **Foundational (Phase 2)**: needs Setup. **Blocks all user stories.** T009 (second-person review) must be done before Phase 3.
- **US1 (Phase 3)**: needs Phase 2. This is the MVP.
- **US2 (Phase 4)**: needs US1 (map, sim, session core).
- **US3 (Phase 5)**: needs US2 (tickets feed the review's ticket-age and score).
- **US4 (Phase 6)**: needs US1–US3 in place so every control exists to make keyboard-accessible.
- **Release Gate (Phase 7)**: needs Phases 2–6. Complete it before starting Level 3.
- **US5 (Phase 8)**: needs Phase 7, so a verified shippable game exists first. Cuttable.
- **Polish (Phase 9)**: needs the stories you are shipping.

Stories share `engine/sim.js`, `engine/state.js`, `ui/render.js`, and `ui/controls.js`, so the P1
stories run sequentially in priority order. Within a phase, [P] tasks touch different files.

### Within Each Story

Tests first and failing, then rules, then sim and state, then data, then UI. Commit after each task
or small group.

### Parallel Opportunities

- Phase 1: T002, T003, T004 together.
- Phase 2: T006 and T007 together; then T010 and T012 together (tests for rules and content) while T008 and T009 finish.
- US1: T015 can be written while T016 (Level 1 data) is authored.
- US2: T025 and T026 together.
- US3, US4, US5: each story's test task can run alongside the first implementation task in that story, since they touch different files.

---

## Parallel Example: Phase 2

```text
Task: "Create data/levels.json with constants and sources"          (T006)
Task: "Implement engine/geometry.js"                                (T007)
# After fixtures exist (T008):
Task: "Write tests/rules.test.js"                                   (T010)
Task: "Write tests/content.test.js"                                 (T012)
```

---

## Implementation Strategy

### MVP First

1. Phase 1 (Setup), then Phase 2 (Foundational); stop at the Phase 2 checkpoint and get T009 signed off.
2. Phase 3 (US1): confirm Level 1 plays up to the end of a wave.
3. Phase 4 (US2): confirm the worked interaction.
4. Phase 5 (US3): complete Levels 1–2 start to finish.
5. Phase 6 (US4): confirm keyboard-only play, then Phase 7 (Release Gate). This is the minimum release.

### Cut Line (constitution order)

1. Cut Phase 8 (Level 3) first. Record it in the README and verification notes.
2. Then cut visual and animation polish, then persistence (not planned).
3. Never cut: correct grading, explanations, pause, the wave review (US1–US3 core) or the
   accessibility basics in US4.

### Honest Status

Check a task box only when its test or check passes. Human checks (T009, T024, T045, T047, T048, T049, T057, T052)
need a recorded result, not a tick alone.

---

## Notes

- Total tasks: 61 (see phase headings).
- `[P]` means a different file with no unfinished dependency.
- Every task names a file path (human checks name `verification.md`).
- Avoid: weakening a test to pass, hand-authoring answer keys, or moving rules into `ui/`.
