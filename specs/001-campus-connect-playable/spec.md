# Feature Specification: Campus Connect First Playable

**Feature Branch**: none (no branch hook installed; work is on `master`)

**Created**: 2026-11-17

**Status**: Draft

**Input**: User description: "Build the Campus Connect first playable as described in StarterKit/SPEC.md"

**Source draft**: `StarterKit/SPEC.md`. **Governing rules**: `.specify/memory/constitution.md` v1.0.0.

## Overview

Campus Connect is a browser game for new network engineers, help-desk staff, and IT students.
The player is the new network manager of a small college campus. They place access points
(APs), choose 2.4 GHz channels, and buy building uplinks ahead of waves of arriving users. When
users suffer, trouble tickets appear and the player must diagnose the cause: Weak signal, AP
overloaded, Uplink congested, Channel interference, or Uplink down.

The misconception being targeted is "slow Wi-Fi means weak signal, so add more APs". Players see
zones with strong signal that are still slow because the AP, the uplink, or the channel is the
bottleneck.

The session target is 10–15 minutes for a first playthrough. The clock can always be paused, so
thinking time is unlimited.

## Clarifications

### Session 2026-11-17

- Q: When an AP both overlaps a neighbor's channel and is overloaded, how is the correct
  diagnosis decided? → A: Keep separate rules. *AP overloaded* = users demand more than the full
  100 Mbps; *Channel interference* = AP has a conflict and exceeds its effective capacity. Both may
  be true at once, and either is accepted.
- Q: When more than one cause is true for a zone, accept any true cause or only the top one?
  → A: Accept any true cause; the explanation lists every true cause and suggests which to fix
  first.
- Q: Is wave-review campus satisfaction measured at wave end or averaged over the wave? → A: At
  the moment the wave ends (peak load); the review shows delivered vs. demanded Mbps at that
  moment.
- Q: If the player fixes a zone by building before diagnosing its ticket, what happens? → A:
  Auto-close as "Resolved by network change" with no diagnosis points; the notice names the
  cause(s) true when the ticket opened and what fixed it.
- Analyze fix (2026-11-17, default applied; confirm or change): users from a wave leave when it
  ends, each wave's count is the total present at wave end, and Wave 1 starts on the first resume
  after the briefing.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Build ahead of demand (Priority: P1)

As a learner, I place APs and uplinks on a grid campus map and immediately see how signal
strength (RSSI) and capacity respond, so I can serve users before they arrive.

**Why this priority**: Building is the core action. Without it there is no coverage, no load,
and nothing to diagnose. It alone delivers the Level 1 learning outcome (coverage).

**Independent Test**: Start a fresh session, place one AP in Level 1, and confirm each zone's
RSSI and Covered/Not covered status match the hand-computed cases in the Model Verification
Cases table.

**Acceptance Scenarios**:

1. **Given** a fresh session, **When** I start, **Then** the Level 1 briefing appears with the
   clock paused and no users on the map.
2. **Given** an AP placed 20 m (4 cells in a straight line) from a zone with one drywall between
   them, **When** the model updates, **Then** the zone shows RSSI −65.0 dBm and "Covered".
3. **Given** a purchase that costs more than the remaining budget, **When** I try it, **Then** it
   is refused, the cost and remaining budget are shown, and nothing changes.
4. **Given** the game is paused, **When** I build, inspect, or work tickets, **Then** the
   simulation clock, user arrivals, and ticket ages do not advance.
5. **Given** I remove an AP or uplink I bought, **When** the removal completes, **Then** 100% of
   its price is refunded and the model updates immediately.

---

### User Story 2 - Diagnose trouble tickets (Priority: P1)

As a learner, I diagnose why users in a zone are unhappy and learn why my answer is right or
wrong, citing the actual values.

**Why this priority**: Diagnosis is where the misconception is exposed and corrected. It is the
main teaching moment for all three learning outcomes.

**Independent Test**: Load the Level 2 worked-interaction state (dorm, three APs on channels
1/6/11, 12 Video users each, one 100 Mbps uplink) and submit each diagnosis in turn. Confirm the
feedback, ticket status, and score for each.

**Acceptance Scenarios**:

1. **Given** a zone with users whose satisfaction stays below 100% for 10 simulated seconds,
   **When** the 10 seconds elapse, **Then** one ticket opens for that zone, and no second ticket
   opens for that zone while the first is open.
2. **Given** the worked-interaction ticket, **When** I submit **Uplink congested**, **Then** the
   ticket becomes *Diagnosed – awaiting fix*, 25 points are awarded once, and the explanation
   shows 180 Mbps against a 100 Mbps uplink (180%), with each user getting 55.6% of demand.
3. **Given** that ticket, **When** I submit **Weak signal**, **Then** the feedback cites RSSI
   −53.0 dBm against the −67 dBm threshold, the ticket stays open, and the score does not change.
4. **Given** that ticket, **When** I submit **AP overloaded**, **Then** the feedback states the
   serving AP is at 60% of 100 Mbps, suggests looking upstream, and the ticket stays open.
5. **Given** no diagnosis is selected, **When** I submit, **Then** input guidance appears and the
   attempt count does not change.
6. **Given** a ticket already correctly diagnosed, **When** I submit again, **Then** nothing
   changes and no points are awarded.
7. **Given** an open ticket, **When** I ask for a hint, **Then** the first hint explains a method
   ("compare the signal, then the AP, then the uplink"), the next shows a worked solution, both
   are recorded as assistance, and neither diagnoses the ticket for me.
8. **Given** a zone where more than one cause is true, **When** I submit any true cause, **Then**
   it is accepted and the explanation lists every true cause.
9. **Given** a ticket in *Diagnosed – awaiting fix*, **When** the zone becomes fully served (100%
   satisfaction), **Then** the ticket closes.

---

### User Story 3 - Wave review, firing, and progression (Priority: P1)

As a learner, I get clear, explained rules for passing a wave, getting fired, scoring, retrying,
and advancing.

**Why this priority**: Without the wave review there is no feedback loop, no stakes, and no
progression between levels. The constitution forbids cutting it.

**Independent Test**: Script a wave that ends at exactly 70.0% campus satisfaction and another
at 69.9%, and confirm the first passes and the second fires the player with the reason shown.

**Acceptance Scenarios**:

1. **Given** a wave reaches 60 simulated seconds, **When** the wave ends, **Then** the review
   shows campus satisfaction, the oldest open ticket's age, and each score component.
2. **Given** campus satisfaction below 70.0% at the review, or any ticket open longer than 90
   simulated seconds, **When** the review appears, **Then** the player is fired, and the review
   names the metric, its value, the threshold, and the network cause, and offers **Retry level**.
3. **Given** campus satisfaction exactly 70.0%, **When** the review appears, **Then** the wave
   passes.
4. **Given** I was fired, **When** I choose Retry level, **Then** the map, budget, and score
   return to their state at the start of that level, with no extra penalty.
5. **Given** I pass the third wave review of a level, **When** the review closes, **Then** the
   level summary appears and then the next level's briefing. After Level 3, the session summary
   shows the final score.
6. **Given** a session in progress, **When** I choose Restart, **Then** a confirmation appears;
   confirming clears the session and returns to the Level 1 briefing, and cancelling keeps it.
7. **Given** a wave review, **When** I continue, **Then** the next wave's size and user types are
   previewed before it starts.

---

### User Story 4 - Play with accessible controls (Priority: P1)

As a keyboard user, or someone who needs more time, I can do everything without a mouse and
without time pressure.

**Why this priority**: The constitution makes access part of the core game, not polish.

**Independent Test**: Complete Level 1 Wave 1 using only the keyboard, including one pause and
one ticket, then check the zone table matches the map.

**Acceptance Scenarios**:

1. **Given** keyboard-only input, **When** I move a map cursor, place or remove equipment, set a
   channel, pause/resume (single key, e.g. Space), and work tickets, **Then** each action works
   with visible focus and an accessible name.
2. **Given** default settings, **When** a ticket opens or a wave review starts, **Then** the game
   auto-pauses. I can turn auto-pause off.
3. **Given** the zone table, **When** I compare it to the map, **Then** every zone's RSSI,
   serving AP, channel, users, and utilization match.
4. **Given** any feedback message, **When** it appears, **Then** it stays on screen as text and
   is announced to assistive technology.
5. **Given** the heat map is shown, **When** I view any zone, **Then** its number appears beside
   the color.
6. **Given** a reduced-motion preference, **When** I play, **Then** user-movement animation is
   removed and no information is hidden or delayed.
7. **Given** a browser window as narrow as 320 CSS px (and a 1366×768 laptop screen), **When** I play, **Then** pause and action buttons remain
   visible, and dense data scrolls within its own labeled container.

---

### User Story 5 - Level 3 Homecoming: interference and availability (Priority: P2)

As a learner who finished Level 2, I assign channels manually and design for an uplink failure
during an event surge.

**Why this priority**: It delivers the transfer outcome (LO3), but it is first in the
constitution's cut order. Levels 1–2 are a complete, playable game without it.

**Independent Test**: Start Level 3 with and without a redundant student-center uplink and
confirm the scripted failure at 0:30 of Wave 2 takes the building to 0 Mbps without redundancy
and to reduced capacity with it.

**Acceptance Scenarios**:

1. **Given** two APs on channels 1 and 3 that hear each other, **When** the model updates,
   **Then** both show a conflict and an effective capacity of 50 Mbps.
2. **Given** two APs on channels 1 and 6 that hear each other, **When** the model updates,
   **Then** neither shows a conflict and each has 100 Mbps.
3. **Given** the student center has one uplink, **When** it fails at 0:30 of Wave 2, **Then** the
   building delivers 0 Mbps, its users show grey "Uplink down" status, and tickets for its zones
   accept **Uplink down**.
4. **Given** the student center has two uplinks, **When** one fails, **Then** the building stays
   online at the remaining uplink's capacity.
5. **Given** the Level 3 briefing and Wave 2 preview, **When** I read them, **Then** the failure
   is previewed as "scheduled maintenance risk" before it happens.

---

### Edge Cases

- **Coverage boundary**: RSSI −66.94 dBm (displayed −66.9) is Covered; −67.31 dBm (displayed
  −67.3) is Not covered. Grading always uses unrounded values.
- **Utilization boundary**: exactly 100% utilization is not congested.
- **Firing boundary**: 70.0% satisfaction passes; 69.9% fires.
- **AP tie**: two APs with equal RSSI at a zone; the lowest AP ID serves it.
- **No demand**: with no users on campus, campus satisfaction is 100% and no tickets open. A zone
  with no users has zone satisfaction 100% and never opens a ticket.
- **Problem fixed before diagnosis**: if a ticket's zone becomes fully served before it is
  diagnosed, the ticket closes as "Resolved by network change" with no diagnosis points, and the
  notice names the cause(s) true when it opened and the change that fixed it.
- **Wrong answer then building**: diagnosis is always graded against the zone's current model
  state, never a stale answer key.
- **Unsupported content**: an AP channel outside 1–11, a signal path passing exactly through a
  point where a wall ends or joins another wall (the middle of a straight same-type wall is fine,
  so walls should run edge to edge), or a zone outside any building shows a visible content error, and the level does not
  start or grade.
- **Purchase at exact budget**: a purchase costing exactly the remaining budget succeeds.
- **Retry after firing**: no score, budget, or equipment carries over from the failed attempt.

## Requirements *(mandatory)*

### Functional Requirements

**Campus and building**

- **FR-001**: The campus MUST be a grid of 5 m × 5 m cells. A zone is one cell inside a building.
  Walls lie on cell edges and have a type (drywall, brick, concrete).
- **FR-002**: Players MUST be able to place, move, and remove APs within a level's AP limit, set
  AP channels where the level allows it, and buy, upgrade, or remove uplinks within budget.
- **FR-003**: Prices MUST be: AP $500; 100 Mbps uplink $200; 1 Gbps uplink $800; an upgrade
  costs the difference. Removing equipment refunds 100%. Channel changes are free.
- **FR-004**: Purchases exceeding the remaining budget MUST be refused with the cost and remaining
  budget shown. Budget MUST limit purchases only and MUST NOT cause firing.

**Signal model (2.4 GHz only)**

- **FR-005**: RSSI (dBm) MUST equal EIRP − PL(1 m) − 10·n·log₁₀(d) − Σ wall losses, with EIRP
  17 dBm, PL(1 m) 40 dB, n 3.0, d the straight-line distance between cell centers (minimum 1 m),
  and wall losses of drywall 3 dB, brick 8 dB, concrete 12 dB for each wall the line crosses.
- **FR-006**: A zone MUST be Covered when RSSI ≥ −67.0 dBm. The serving AP MUST be the AP with the
  highest RSSI at that zone (ties go to the lowest AP ID). Users in an uncovered zone receive
  0 Mbps.

**Channels**

- **FR-007**: APs MUST use channels 1–11. Two APs conflict when each hears the other (RSSI at the
  other's cell ≥ −82.0 dBm) and their channel numbers differ by 0–4. An AP's effective capacity
  MUST be 100 Mbps ÷ (1 + number of conflicting APs).

**Congestion and availability**

- **FR-008**: User demand MUST be Light 2 Mbps, Video 5 Mbps, Event 3 Mbps.
- **FR-009**: AP utilization MUST equal the sum of its users' demand ÷ effective capacity. Above
  100% is overloaded, and each user receives a proportional share.
- **FR-010**: Uplink utilization MUST equal building traffic (sum delivered by its APs) ÷ total
  working uplink capacity. Above 100% is congested, and every AP's delivery in that building is
  scaled down proportionally. A building with no working uplink delivers 0 Mbps.
- **FR-011**: Level data MUST be able to schedule an uplink failure at a set simulation time. A
  failed uplink stays failed for the rest of the level.
- **FR-012**: Campus satisfaction MUST equal total Mbps delivered ÷ total Mbps demanded × 100,
  measured at the moment the wave ends (peak load), not averaged; the review MUST show delivered
  and demanded Mbps at that moment. Zone satisfaction uses the same formula for one zone.
- **FR-013**: All comparisons MUST use unrounded values. Displays MUST round RSSI to 0.1 dBm and
  utilization to a whole percent.

**Tickets and diagnosis**

- **FR-014**: A ticket MUST open for a zone whose satisfaction stays below 100% for 10 simulated
  seconds, with at most one open ticket per zone.
- **FR-015**: Each diagnosis MUST be true for a zone under these rules, evaluated on current model
  state:
  - *Weak signal*: the zone is not Covered.
  - *Uplink down*: the zone's building has no working uplink.
  - *Channel interference*: the serving AP has at least one conflict and its utilization against
    effective capacity exceeds 100%.
  - *AP overloaded*: the serving AP's users demand more than 100 Mbps (full capacity).
    Channel interference and AP overloaded MAY both be true for the same zone; fixing the channel
    clears interference but not overload.
  - *Uplink congested*: the building's uplink utilization exceeds 100%.
- **FR-016**: Submitting any true cause MUST be accepted with full points; the explanation MUST
  list every true cause and suggest fixing them in this order: Uplink down → Weak signal →
  Channel interference → Uplink congested → AP overloaded. A wrong diagnosis MUST leave the
  ticket open, explain which value rules that cause out, suggest the next place to look, and not
  change the score.
- **FR-017**: A correct diagnosis MUST set the ticket to *Diagnosed – awaiting fix* and award 25
  points exactly once. The ticket MUST close when the zone reaches 100% satisfaction.
- **FR-017a**: An undiagnosed ticket whose zone reaches 100% satisfaction MUST auto-close as
  "Resolved by network change" with no diagnosis points. The notice MUST name the cause(s) true
  when the ticket opened (recorded for explanation only, never for grading) and the change that
  fixed it.
- **FR-018**: Empty or malformed submissions MUST show input guidance and not count as attempts.
- **FR-019**: Hints MUST reveal a method first, then a worked solution. Both MUST be recorded as
  assistance, carry no score penalty, and not diagnose the ticket.
- **FR-020**: A ticket's age MUST count simulated seconds since it opened, until it closes. A
  ticket in *Diagnosed – awaiting fix* is still open and keeps aging toward the 90-second firing
  limit; a correct diagnosis does not stop its clock.

**Time, waves, and progression**

- **FR-021**: The simulation clock MUST run in real time at 1× or 2× speed and MUST be pausable
  at any moment by a single key or a button. While paused, players can inspect, build, configure,
  and work tickets, and nothing advances.
- **FR-022**: Auto-pause on ticket arrival and at each wave review MUST be available and on by
  default.
- **FR-023**: Each level MUST have three waves of 60 simulated seconds, with users arriving
  evenly during the wave into zones defined by level data. A wave's stated size is the total
  number of its users present when it ends: users from the previous wave leave when it ends, and
  the new wave's users arrive from zero. Wave 1 starts when the player first resumes after the
  level briefing. The next wave's size and user types MUST be previewed before it starts, and it
  starts when the player continues from the review.
- **FR-024**: At each wave review, the player MUST be fired if campus satisfaction is below 70.0%
  or any ticket has been open longer than 90 simulated seconds. The review MUST name the metric,
  value, threshold, and network cause, and offer Retry level.
- **FR-025**: Retry level MUST restore the level's starting map, budget, and score with no extra
  penalty.
- **FR-026**: Passing the third wave review MUST complete the level, show a level summary (waves
  passed; tickets diagnosed first try, after a hint, or after a worked solution; score; budget
  left), and open the next briefing. Completing the last level MUST show the session summary.
- **FR-027**: Restart MUST ask for confirmation, then clear the session and return to the Level 1
  briefing.
- **FR-028**: Each level MUST open paused with a briefing introducing one new concept through a
  static worked example on a small illustrative map (shown in the briefing, not playable), and stating "This is a simplified model; real networks have
  more effects."

**Scoring**

- **FR-029**: Each wave review MUST add round(campus satisfaction %) points (up to 100). Each
  correct diagnosis adds 25. Completing a level adds floor(remaining budget ÷ 100). The review
  MUST show every component.
- **FR-030**: Progress and the session high score MUST last for the current page session only;
  reloading starts again.

**Content**

- **FR-031**: Levels MUST match this table:

  | Level | Concept | Setup |
  | --- | --- | --- |
  | 1 · Orientation Week | Coverage: distance and walls (LO1) | Library with drywall and concrete walls. Waves of 20/40/60 Light users. 1 Gbps uplink pre-installed. Up to 3 APs, channels auto-assigned 1/6/11 and locked. Budget $2,000 |
  | 2 · Dorm Move-In | Capacity: AP vs. uplink congestion (LO2) | Dorm on a 100 Mbps uplink. Waves of 20/40/50 Video users (100/200/250 Mbps). Up to 3 APs, channels auto 1/6/11. Budget $2,500 |
  | 3 · Homecoming | Interference and availability (LO3) | Stadium and student center. Waves of Event users: stadium 30/50/70 (90/150/210 Mbps), student center 20/30/40 (60/90/120 Mbps). Each building starts with one 100 Mbps uplink. Up to 6 APs, manual channels 1–11. The student center's original uplink fails at 0:30 of Wave 2. Budget $5,000 |

  Level 3 design intent: Wave 3 stadium demand (210 Mbps) requires a 1 Gbps upgrade, and the
  student center survives the Wave 2 failure only with a second uplink. A full solution costs
  about $3,800 (6 APs, one upgrade, one extra 100 Mbps link), leaving room for mistakes.
- **FR-032**: Levels, layouts, wall types, equipment, demand, waves, tickets, hints, sources, and
  thresholds MUST be editable data, validated before a level is presented. Adding a level or
  ticket using existing mechanics MUST require only a data change and its checks.
- **FR-033**: Every networking rule MUST cite a verified source and section in the README and
  briefing (ITU-R P.1238 for indoor path loss; IEEE 802.11-2020 for the 2.4 GHz channel plan and
  −82 dBm CCA; a named vendor design guide for −67 dBm). Wall losses MAY be labeled illustrative.

**Presentation and access**

- **FR-034**: Always visible: clock and pause state, budget, score, campus satisfaction, open
  tickets, and the selected zone's RSSI, channel, utilization, and uplink load.
- **FR-035**: A zone table tab MUST provide a text equivalent of the map. No information may be
  hover-only, and heat-map colors MUST always have numbers beside them.
- **FR-036**: All core actions MUST be keyboard-operable with visible focus and accessible names.
  Feedback MUST be persistent text announced to assistive technology. Reduced motion MUST remove
  user-movement animation without hiding information.
- **FR-037**: The game MUST run with no account, backend, network service, or API key, and the
  same level with the same actions at the same simulation steps MUST produce identical results
  and scores.
- **FR-038**: Art, characters (the Dean of IT and users), and humor MUST be original.
- **FR-039**: The game MUST use the supplied original art and audio pack in `assets/` (indexed by
  `assets/manifest.json`) for map sprites, overlays, channel badges, ticket and cause icons, the
  Dean of IT, and sounds. Sound MUST be optional, off by default, and controllable with a visible
  on/off button. No sound may carry information alone: every sound has an on-screen text
  equivalent. If the art or audio fails to load, the game MUST still be fully playable.

### Key Entities

- **Level**: name, concept, briefing, map, budget, AP limit, channel mode (locked or manual),
  waves, scheduled failures.
- **Campus map / Building / Zone**: grid of cells; buildings contain zones; walls sit on cell
  edges with a type and loss.
- **Access point**: ID, cell, channel, price; derived RSSI per zone, conflicts, effective
  capacity, utilization.
- **Uplink**: building, capacity (100 Mbps or 1 Gbps), working or failed, price.
- **User**: type (Light, Video, Event), demand, zone, delivered Mbps.
- **Wave**: size, composition, duration, arrival zones.
- **Ticket**: zone, opened time, age, causes true at opening (explanation only), status (open,
  diagnosed – awaiting fix, closed, resolved by network change), attempts, assistance used.
- **Diagnosis option**: one of five causes, with its truth rule and explanation text.
- **Score / Session**: wave points, diagnosis points, budget bonus, assistance record, level
  start snapshot, session high score.

## Model Verification Cases

Expected values were hand-computed from the formulas above and must be re-checked by a second
person before implementation (constitution Principle I).

| Case | Input state | Action / event | Expected result |
| --- | --- | --- | --- |
| Coverage – correct | AP 20 m (4 cells straight) from zone, 1 drywall | Model update | RSSI −65.0 dBm (−65.03), Covered |
| Coverage – boundary in | AP offset (5, 3) cells = 29.15 m, no walls | Model update | RSSI −66.9 dBm (−66.94), Covered |
| Coverage – boundary out | AP offset (6, 0) cells = 30 m, no walls | Model update | RSSI −67.3 dBm (−67.31), Not covered; users get 0 Mbps |
| Weak signal | Zone 15 m from only AP, 1 concrete wall | Ticket → Weak signal | RSSI −70.3 dBm (−70.28); correct |
| AP overloaded | Zone at −53.0 dBm; AP serves 25 Video (125 Mbps), no conflicts | Ticket → Weak signal | Wrong: RSSI above −67; AP at 125% of 100 Mbps |
| Uplink congested | 3 APs × 60 Mbps, ch 1/6/11, one 100 Mbps uplink | Ticket → AP overloaded | Wrong: each AP 60%; uplink 180%; each user gets 55.6% |
| Utilization boundary | 100 Mbps uplink carrying exactly 100 Mbps | Model update | 100%, not congested; satisfaction 100% |
| Channel conflict | AP-A ch 1, AP-B ch 3, 20 m apart, no walls (−62.0 ≥ −82) | Model update | Conflict; each effective capacity 50 Mbps |
| Channel boundary | Same APs, ch 1/5 and ch 1/6 | Model update | 1/5 conflict; 1/6 no conflict, 100 Mbps each |
| Redundancy | Building demand 180 Mbps, two 100 Mbps uplinks; one fails | Scheduled failure | Capacity 200 → 100; uplink 180%; delivery 55.6% |
| Single point of failure | Building on one 1 Gbps uplink; it fails | Scheduled failure | Building delivers 0 Mbps; tickets accept Uplink down |
| Firing boundary | Campus demand 100 Mbps, delivered 70.0 / 69.9 | Wave review | 70.0% passes; 69.9% fired with reason |
| Unsupported content | Channel 13; wall line through a cell corner; zone outside building | Open level | Visible content error; level does not start or grade |

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A first-time player completes Levels 1–2 in about 10–15 minutes of play.
- **SC-002**: 100% of the Model Verification Cases produce the expected result.
- **SC-003**: Replaying the same level, actions, and seed produces identical wave reviews and
  scores every time.
- **SC-004**: A teammate completes Level 1 Wave 1 using only the keyboard, including one pause
  and one ticket, without assistance.
- **SC-005**: Every wrong diagnosis on the worked-interaction ticket shows the specific value
  that rules it out, and a playtester can explain afterwards why "Weak signal" was wrong.
- **SC-006**: Every firing names the metric, value, threshold, and network cause, and the player
  can retry the level in one action.
- **SC-007**: The game runs from a clean browser session using only the project's static files,
  with no network requests needed to play.
- **SC-008**: A teammate can add a new ticket or level that uses existing mechanics by editing
  data only.

## Assumptions

- **Scope and cut order**: Levels 1–2 with build, tickets, wave review, pause, and accessibility
  are the minimum release. If time runs short, cut Level 3 first, then visual and animation
  polish, then persistence. Correct grading, explanations, pause, and the wave review are never cut.
- **Refunds**: 100% refunds apply during a wave as well as between waves.
- **Ticket timing**: 10 seconds to open and a 90-second firing limit are kept from the source
  draft for 60-second waves.
- **Failures**: a scheduled uplink failure lasts for the rest of the level.
- **References**: the `[VERIFY]` sections in `StarterKit/SPEC.md` must be filled in before
  release; this is a release dependency, not a design choice.
- **Sound**: off by default, with a mute toggle, because autoplay is restricted and unexpected
  sound is unwelcome in some settings. Music and effects are optional polish and are cut before
  anything else in the build.
- **Platform**: a typical laptop browser (1366×768 or larger); no mobile-specific layout beyond
  narrow-window support down to 320 CSS px.
- **Wall-corner rule**: a signal path through a wall end, a T-junction, or a join of two different
  wall types is a content error; a path through the middle of one straight same-type wall counts as
  one crossing. Authors run walls edge to edge. Revisit only if a level layout becomes impractical, with your approval.
- **Exclusions**: no 5/6 GHz, non-20 MHz channels, client limits, roaming, band steering,
  multipath, MU-MIMO/OFDMA, TCP behavior, wired switching, spanning tree, security, vendor
  features, accounts, multiplayer, backend, runtime AI, persistent leaderboard, or level editor.
