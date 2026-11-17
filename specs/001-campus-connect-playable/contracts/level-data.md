# Contract: `data/levels.json`

Authored content is the interface between content authors and the engine. One document, loaded
once over HTTP (relative URL), validated whole before any level starts.

## Top-level shape

```json
{
  "schemaVersion": 1,
  "constants": { "...": "see data-model.md Constants" },
  "sources": [
    { "id": "itu-p1238", "title": "...", "url": "https://...", "section": "...",
      "claim": "log-distance indoor path loss", "status": "verified" }
  ],
  "levels": [ { "id": "L1", "title": "Orientation Week" } ]
}
```

## Level

```json
{
  "id": "L2",
  "title": "Dorm Move-In",
  "outcomeId": "LO2",
  "concept": "Capacity: AP versus uplink congestion",
  "art": { "banner": "banner-level-2-dorm-move-in", "building": "building-dorm" },
  "budget": 2500,
  "apLimit": 3,
  "channelMode": { "type": "locked", "channels": [1, 6, 11] },
  "briefing": { "paragraphs": ["..."], "simplification": "This is a simplified model; real networks have more effects.", "sourceIds": ["..."],
    "example": { "cols": 4, "rows": 3, "aps": [[1,1]], "zone": [3,1], "steps": ["..."] } },
  "map": {
    "cols": 12, "rows": 8,
    "buildings": [
      { "id": "dorm", "name": "Dorm", "zones": [[2,1],[3,1]], "startingUplinks": [100] }
    ],
    "walls": [ { "a": [2,1], "b": [2,2], "type": "drywall" } ]
  },
  "startingEquipment": { "aps": [], "uplinks": [] },
  "waves": [
    { "index": 1, "previewText": "20 Video users arrive", "arrivals": [ { "userType": "video", "count": 20, "zones": [[2,1],[3,1]] } ] }
  ],
  "failures": [],
  "tickets": [ { "zone": [3,1], "title": "Dorm room 2B", "complaint": "Wi-Fi is really slow tonight." } ],
  "hints": { "method": "Compare the signal, then the AP, then the uplink.", "worked": "..." }
}
```

For Level 3: `channelMode` is `{ "type": "manual" }` and
`failures` contains `{ "wave": 2, "atSteps": 300, "building": "student-center", "uplinkIndex": 0 }`.

## Rules the loader enforces

See "Validation rules" in [data-model.md](../data-model.md). In summary: channels 1–11, locked
lists restricted to 1/6/11, every zone in exactly one building, no vertex-crossing walls, unique
IDs, exactly three waves, existing zone and source references, affordable starting equipment.

## Error output

A rejected file produces a list of `{ levelId, itemId, code, message }` entries. The UI shows them
in an on-screen error panel (announced to assistive technology) and does not start the level or
grade anything. Content errors are never counted as player attempts.

## Compatibility

`schemaVersion` is required and checked. Adding a level or ticket that uses existing mechanics
requires only a data change plus its content tests (constitution Principle VI). A schema change
requires a version bump and updates here and in `tests/content.test.js`.
