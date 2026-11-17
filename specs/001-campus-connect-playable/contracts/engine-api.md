# Contract: Engine Modules

`engine/` has no DOM, timers, network, or random access. The same modules run in the game and in
`tests/index.html`. Functions are pure unless marked otherwise.

## `rules.js`

```text
computeModel(level, constants, equipment, users) → model        (shape: data-model.md)
rssiDbm(ap, zone, level, constants)             → number         (unrounded)
causesFor(zoneId, model)                        → Set<cause>
evaluateDiagnosis(zoneId, choice, model) → {
  status: "correct" | "incorrect" | "invalid-input" | "content-error",
  trueCauses: cause[],            // all true causes, in suggested fix order
  reasonCode: string,             // e.g. "ruled-out:weak-signal", "accepted:uplink-congested"
  evidence: { ... }               // values used: rssi, thresholds, utilizations, shares
}
```

- `cause` is one of `uplink-down`, `weak-signal`, `channel-interference`, `uplink-congested`,
  `ap-overloaded`, listed in that suggested fix order.
- `invalid-input` is returned for a missing or unknown `choice`; it does not count as an attempt.
- A choice is `correct` when it is in `causesFor`. The UI never decides correctness.
- `content-error` is returned if the level failed validation; nothing is graded.

## `content.js`

```text
validateContent(doc) → { ok: boolean, errors: [{ levelId, itemId, code, message }] }
```

## `sim.js`

```text
createSim(level, constants, snapshot?) → sim
step(sim)                              → events[]    // advances exactly 1 step (0.1 s)
applyAction(sim, action)               → result      // purchase, move, remove, channel, pause...
```

- `step` is the only function that advances time. Pausing prevents callers from calling it; the
  sim also refuses `step` while `paused`.
- Order inside a step: scheduled failures, arrivals, model recompute, zone-below-100% counters,
  ticket opening, ticket aging, auto-close checks, wave-end detection.
- Events: `ticket-opened`, `ticket-closed`, `ticket-resolved-by-change`, `uplink-failed`,
  `wave-ended`, each with the step number.
- `applyAction` actions: `place-ap`, `move-ap`, `remove-ap`, `set-channel`, `buy-uplink`,
  `upgrade-uplink`, `remove-uplink`, `submit-diagnosis`, `request-hint`, `set-paused`,
  `set-speed`, `set-autopause`. Each returns `{ ok, reason?, ... }` and is appended to
  `actionLog` with the current step.
- Replay: feeding the same `(step, action)` log to a fresh sim yields identical events and
  scores (SC-003).

## `review.js`

```text
reviewWave(sim) → {
  satisfactionPct, deliveredMbps, demandedMbps, oldestTicketAgeSteps,
  fired: boolean, firedBy: null | { metric, value, threshold, cause },
  score: { wavePoints, diagnosisPoints, budgetBonus, total },
  nextPreview
}
```

- Fired when `satisfactionPct < 70.0` or any ticket age `> 900` steps (strictly greater).
  Exactly 70.0% and exactly 900 steps pass. Budget never fires (Principle III).
- `wavePoints = round(satisfactionPct)`; `budgetBonus = floor(budget / 100)` only when a level is
  completed.

## `state.js` (stateful)

Owns the session view, level snapshot, restart confirmation, and the high score for the page
session. Retry restores the level snapshot exactly. Restart requires a confirm step; cancel
changes nothing. Duplicate submit on a diagnosed ticket is a no-op.

## `feedback.js`

```text
explain(result, level) → { headline, body, nextStep, assistance? }
```

Builds text from `reasonCode` templates plus `evidence` values. Rounding for display happens
here (RSSI to 0.1 dBm, utilization to whole percent) and never feeds back into grading.
