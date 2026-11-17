# Contract: UI Controls and Accessibility

User-facing interface contract (Principle IV, FR-034 to FR-036). Everything below must be
checked in a keyboard-only playthrough and recorded in `verification.md`.

## Keyboard map

| Action | Keys | Notes |
| --- | --- | --- |
| Pause / resume | `Space` (global, also a visible button) | Works from anywhere except inside a text field |
| Speed 1× / 2× | `1` / `2` or a visible toggle | |
| Move map cursor | Arrow keys inside the map | Map is one tab stop (roving tabindex) |
| Place AP | `A` on a focused cell | Refused with message if over budget, over AP limit, or on invalid cell |
| Remove equipment | `Delete` on a focused AP cell | Refund shown |
| Set channel | `C` opens a labeled channel list for the focused AP | Hidden or locked in Levels 1–2 |
| Buy or upgrade uplink | Button per building in the side panel | |
| Open ticket | `T` cycles tickets, or select in the ticket list | |
| Submit diagnosis | Radio group plus Submit button | Enter submits |
| Hint | `H` or a visible button | Records assistance |
| Switch to zone table | Tab control, arrow keys, Enter | |
| Restart | Button, with confirm dialog | Cancel keeps session |

All shortcuts are listed on-screen and have visible buttons; no action is shortcut-only.

## Focus and announcements

- Focus ring is always visible and never removed.
- After a view change (briefing, review, summary) focus moves to that view's heading.
- A single `aria-live="polite"` region announces feedback: ticket result, purchase refused,
  ticket opened, wave ended, uplink failed. Feedback also stays as on-screen text until
  dismissed or replaced.
- Map cells have accessible names including zone label, RSSI, covered state, serving AP, users.
- The zone table is a real `<table>` with headers: zone, RSSI (dBm), covered, serving AP, channel,
  users, AP utilization, uplink utilization. Its values equal the map's.

## Always-visible information

Clock and pause state, budget, score, campus satisfaction, open tickets list, and the selected
zone's RSSI, channel, utilization, and uplink load. Nothing is hover-only.

## Color and motion

- Heat-map color is always paired with the numeric RSSI and a covered/not covered label.
- Congestion, "Uplink down", and conflict states use text and an icon as well as color.
- `prefers-reduced-motion: reduce` removes user-dot movement; the same information appears
  immediately. No animation delays feedback or controls.

## Layout

- Typical laptop width: map center, tickets and selected-zone details at the side, zone table as
  a tab.
- Narrow window: panels stack; dense data (zone table, ticket list) scrolls inside its own labeled
  container; pause and action buttons remain visible.

## Auto-pause

On by default. Pauses when a ticket opens and at each wave review. A visible setting turns it off
and the choice persists for the page session.
