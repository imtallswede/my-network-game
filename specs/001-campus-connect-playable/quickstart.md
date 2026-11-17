# Quickstart: Validate Campus Connect

How to run the game and prove it works. Nothing here exists until the build tasks create it; this
guide defines what "working" looks like. Related: [data-model.md](data-model.md),
[contracts/](contracts/).

## Prerequisites

- A current desktop browser.
- Python 3 (any recent version; on Windows use `py` in place of `python3`).
- No Node, npm, accounts, or network access.

## Run

From the repository root:

```sh
py -m http.server 8000 --bind 127.0.0.1
```

Open **http://127.0.0.1:8000** for the game and **http://127.0.0.1:8000/tests/** for the tests.
Opening `index.html` with `file://` is not supported (modules and JSON need a server).

## Validation scenarios

### 1 · Rules (slice 1)

Open `/tests/`. Expect a visible summary with zero failures and a non-zero test count. It must
cover every row of the spec's Model Verification Cases:

| Case | Expected |
| --- | --- |
| 20 m, one drywall | RSSI −65.0 dBm, Covered |
| Offset (5,3), no walls | −66.9 dBm, Covered |
| Offset (6,0), no walls | −67.3 dBm, Not covered |
| 15 m, one concrete wall | −70.3 dBm |
| Zone −53.0 dBm, AP at 125% | Weak signal wrong; AP at 125% |
| 3 APs × 60 Mbps on 100 Mbps uplink | AP 60%, uplink 180%, users get 55.6% |
| Uplink carrying exactly 100 Mbps | 100%, not congested |
| Channels 1 and 3, 20 m apart | Conflict, 50 Mbps each |
| Channels 1/5 versus 1/6 | 1/5 conflict; 1/6 none, 100 Mbps |
| Two 100 Mbps uplinks, one fails, 180 Mbps | Capacity 100, 180%, 55.6% |
| Single 1 Gbps uplink fails | 0 Mbps; Uplink down accepted |
| Satisfaction 70.0 versus 69.9 | Pass versus fired |
| Channel 13, corner-crossing wall, zone outside building | Content error, no grading |

Expected values are recorded in `tests/fixtures.js` from the spec, not computed by the evaluator
under test, and a second person re-checks them before slice 2.

### 2 · Worked interaction (slice 3)

Load the Level 2 dorm fixture (three APs on 1/6/11, 12 Video users each, one 100 Mbps uplink).
Submit **Weak signal**, then **AP overloaded**, then **Uplink congested**. Expect the feedback
text in the spec (RSSI −53.0 vs −67 dBm; AP at 60%; 180 Mbps over 100 Mbps, 55.6%). The ticket
shows *Diagnosed – awaiting fix* and +25 points once; a second Submit does nothing.

### 3 · Pause, determinism, and review

- Pause: with the game paused, build, inspect, and work a ticket; the clock, arrivals, and ticket
  ages stay unchanged.
- Replay: run the scripted action log in `tests/sim.test.js` twice; wave reviews and scores are
  identical.
- Review: a wave ending at exactly 70.0% passes; 69.9% fires with metric, value, threshold, and
  cause shown, and Retry restores the level's starting map, budget, and score.

### 4 · Keyboard and layout (slice 4)

Play Level 1 Wave 1 with keyboard only, including one pause and one ticket. Check the zone table
matches the map, narrow window keeps pause and action buttons visible, and reduced motion removes
user movement without hiding information. Record what was checked, not a certification.

### 5 · Level 3 (slice 6, if built)

Play with and without a second student-center uplink. Without: the building goes grey, "Uplink
down" tickets are accepted, and the review names the cause. With: it stays online at reduced
speed.

## Recording results

For each acceptance criterion in the spec, record pass / fail / not run, the date, the
environment (browser and version), and evidence in `verification.md`. Failed and unrun checks stay
visible (constitution Principle VII).
