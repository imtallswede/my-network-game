# Data Model: Campus Connect First Playable

Entities from the spec, split into **authored** (in `data/levels.json`, read-only at runtime) and
**runtime** (in session state, rebuilt on retry or restart). Units: Mbps, dBm, dB, meters, simulated
steps (1 step = 0.1 s; 10 steps = 1 s).

## Authored entities

### Constants

| Field | Value | Notes |
| --- | --- | --- |
| `eirpDbm` | 17 | per AP |
| `pl1mDb` | 40 | path loss at 1 m |
| `pathLossExponent` | 3.0 | n |
| `coverageThresholdDbm` | −67.0 | covered when RSSI ≥ |
| `ccaThresholdDbm` | −82.0 | AP hears AP when RSSI ≥ |
| `apCapacityMbps` | 100 | before conflicts |
| `conflictChannelDelta` | 4 | conflict when delta 0–4 |
| `channelRange` | 1–11 | anything else is a content error |
| `wallLossDb` | drywall 3, brick 8, concrete 12 | illustrative |
| `demandMbps` | light 2, video 5, event 3 | per user |
| `prices` | AP 500, uplink100 200, uplink1000 800 | upgrade = difference |
| `uplinkCapacityMbps` | 100 or 1000 | |
| `ticketOpenSteps` | 100 | zone below 100% for 10 s |
| `fireTicketAgeSteps` | 900 | 90 s |
| `fireSatisfactionPct` | 70.0 | pass when ≥ |
| `waveSteps` | 600 | 60 s |
| `pointsPerDiagnosis` | 25 | |
| `minDistanceM` | 1 | |

### Level

`id`, `title`, `concept`, `outcomeId` (LO1–LO3), `art` (`{ banner, building }` asset ids from `assets/manifest.json`), `briefing` (paragraphs, simplification notice,
source IDs, `example`: a small illustrative map with a worked calculation, display only), `budget`, `apLimit`, `channelMode` (`locked` with fixed channel list, or `manual`),
`map`, `startingEquipment`, `waves[3]`, `failures[]`.

### Map, Building, Zone, Wall

- **Map**: `cols`, `rows` (cells are 5 m × 5 m), `buildings[]`, `walls[]`.
- **Building**: `id`, `name`, `zones[]` (cell coordinates `[col,row]` with optional label), and
  `startingUplinks[]`. Every zone belongs to exactly one building.
- **Wall**: `a` and `b` grid vertices as integer `[col,row]` corner coordinates (one cell edge,
  axis-aligned), `type` (drywall, brick, concrete). The engine doubles coordinates internally so
  cell centers are integers and crossings are exact.

### Wave

`index` (1–3), `arrivals[]` of `{ userType, count, zones[] }` (users are spread evenly over the
wave and assigned round-robin to `zones`), `previewText`. `count` is the total of that wave's users
present at wave end: the previous wave's users leave when it ends.

### Scheduled failure

`wave`, `atSteps` (offset within that wave), `building`, `uplinkIndex`. A failed uplink stays
failed until the level ends.

### Ticket text and hints

`ticketTemplates[]` keyed by zone or building: `title`, `complaint` (text shown to the player).
`hints[]`: ordered, first is a method hint, second a worked solution. Explanation sentences are
assembled from `reasonCode` templates plus evaluator evidence.

### Source

`id`, `title`, `url`, `section`, `claim`, `status` (`verified` or `illustrative`).

## Runtime entities

### AccessPoint

`id` (stable, never reused; tie-break is lowest ID), `cell`, `channel` (1–11), `placedAtStep`.
Derived (never stored as authored): RSSI per zone, conflicts, effective capacity, demand,
utilization, delivery.

### Uplink

`id`, `buildingId`, `capacityMbps` (100 | 1000), `state` (`working` | `failed`).

### User

`id`, `type`, `zoneId`, `arrivalStep`. Derived: demand, delivered Mbps.

### Ticket

| Field | Notes |
| --- | --- |
| `id`, `zoneId` | at most one non-closed ticket per zone |
| `openedStep` | age = current step − openedStep until closed |
| `status` | `open`, `diagnosed`, `closed`, `resolved-by-change` |
| `causesAtOpen` | causes true when opened; explanation only, never grading |
| `attempts` | valid submissions only |
| `assistance` | `none`, `hint`, or `worked-solution`, with the highest used |
| `awardedPoints` | 0 or 25; set once |

### Session

`view`, `levelIndex`, `waveIndex`, `step`, `paused`, `speed` (1 | 2), `autoPause`, `budget`,
`equipment`, `users`, `tickets`, `score` (wave points, diagnosis points, budget bonus),
`levelSnapshot` (taken at level start for Retry), `highScore` (page session only), `actionLog`
(`{step, action}` pairs used for replay tests), `contentError` (or null).

## Derived model result (output of `rules.js`)

```text
model = {
  zones: [{ id, servingApId|null, rssiDbm, covered, users, demandMbps, deliveredMbps,
            satisfactionPct, apUtilizationPct, uplinkUtilizationPct }],
  aps: [{ id, channel, conflictsWith[], effectiveCapacityMbps, demandMbps, deliveredMbps,
          utilizationPct, overloaded }],
  buildings: [{ id, workingCapacityMbps, trafficMbps, utilizationPct, congested, down }],
  campus: { demandMbps, deliveredMbps, satisfactionPct },
  causesByZone: { [zoneId]: Set<cause> }
}
```

## Validation rules (enforced by `content.js` before a level starts)

- Channel outside 1–11 (including 13), or a locked channel list that is not 1, 6, 11, is an error.
- Every zone belongs to exactly one building; a zone outside any building is an error.
- A wall line passing exactly through a grid vertex or collinear with a wall edge, for any AP cell
  and zone pair reachable in the level, is an error.
- Duplicate IDs (levels, buildings, zones, tickets, sources) are errors.
- Waves: exactly three per level, counts are positive integers, every listed zone exists.
- Budget, AP limit, and prices are non-negative integers; failures reference real buildings.
- Every briefing, hint, and source reference points to an existing source ID.
- Starting equipment must be affordable within budget and within AP limit.

Errors name the level and item ID and block grading; they are never counted as attempts.

## State transitions

```text
Level:    briefing → running ⇄ paused → wave-review ─ pass → next wave
                                                    ├ pass (wave 3) → level-summary → next briefing
                                                    └ fired → retry (restore snapshot) → briefing
Session:  loading → briefing … → session-summary ; confirmed Restart → loading/briefing(Level 1)
Ticket:   open ─ correct diagnosis → diagnosed ─ zone 100% → closed
          open ─ wrong diagnosis → open (feedback, no score change)
          open ─ zone reaches 100% before diagnosis → resolved-by-change (no points)
```

Rules: Submit on a `diagnosed`, `closed`, or `resolved-by-change` ticket is ignored. A wrong
diagnosis never changes score. A `diagnosed` ticket keeps aging toward the firing limit until it
closes (clarified FR-020). Paused time never advances ticket age. Wave 1 starts on the first resume after the level
briefing; later waves start when the player continues from the review.
