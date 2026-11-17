// Grid geometry for Campus Connect. Pure: no DOM, timers, or randomness.
//
// Cells are 5 m x 5 m. All wall-crossing tests use *doubled integer* coordinates so they are exact:
//   cell [c, r] has its center at (2c + 1, 2r + 1)
//   grid vertex [vx, vy] sits at (2vx, 2vy)
// Walls are single cell edges given by two grid vertices (axis-aligned, length 1 cell).

export const CELL_M = 5;

export function cellId(cell) {
  return `${cell[0]},${cell[1]}`;
}

/** Straight-line distance between cell centers in meters, with a minimum (spec FR-005). */
export function distanceM(a, b, minM) {
  const dx = a[0] - b[0];
  const dy = a[1] - b[1];
  return Math.max(minM, CELL_M * Math.sqrt(dx * dx + dy * dy));
}

function orient(p, q, r) {
  return (q[0] - p[0]) * (r[1] - p[1]) - (q[1] - p[1]) * (r[0] - p[0]);
}

function onSegment(p, q, r) {
  return (
    r[0] >= Math.min(p[0], q[0]) && r[0] <= Math.max(p[0], q[0]) &&
    r[1] >= Math.min(p[1], q[1]) && r[1] <= Math.max(p[1], q[1])
  );
}

/**
 * Walls crossed by the straight line between two cell centers.
 *
 * Returns { crossed: wall[], ambiguous: boolean }.
 * `ambiguous` is true when the line passes exactly through a wall endpoint (a grid corner where a
 * wall ends). The crossing count is then undefined, so callers must treat it as a content error
 * and never grade it (spec edge case "wall line through a cell corner", research R6).
 */
export function wallPath(fromCell, toCell, walls) {
  const P = [2 * fromCell[0] + 1, 2 * fromCell[1] + 1];
  const Q = [2 * toCell[0] + 1, 2 * toCell[1] + 1];
  const crossed = [];
  let ambiguous = false;
  const touches = new Map(); // vertex key -> [{ wall, collinear }]

  for (const w of walls) {
    const A = [2 * w.a[0], 2 * w.a[1]];
    const B = [2 * w.b[0], 2 * w.b[1]];
    const o1 = orient(P, Q, A);
    const o2 = orient(P, Q, B);

    // The line passes through a wall endpoint: decided per vertex below.
    const touchA = o1 === 0 && onSegment(P, Q, A);
    const touchB = o2 === 0 && onSegment(P, Q, B);
    if (touchA || touchB) {
      const v = touchA ? w.a : w.b;
      const key = `${v[0]},${v[1]}`;
      if (!touches.has(key)) touches.set(key, []);
      touches.get(key).push({ wall: w, collinear: o1 === 0 && o2 === 0 });
      continue;
    }

    const o3 = orient(A, B, P);
    const o4 = orient(A, B, Q);
    const split12 = (o1 > 0 && o2 < 0) || (o1 < 0 && o2 > 0);
    const split34 = (o3 > 0 && o4 < 0) || (o3 < 0 && o4 > 0);
    if (split12 && split34) crossed.push(w);
  }

  // A vertex where exactly two same-type edges continue in a straight line is the middle of one
  // straight wall: the path crosses it once. Wall ends, T-junctions, mixed-type joins, and paths
  // running along a wall are ambiguous (research R6).
  for (const [key, group] of touches) {
    const [vx, vy] = key.split(',').map(Number);
    const straight =
      group.length === 2 &&
      !group.some((g) => g.collinear) &&
      group[0].wall.type === group[1].wall.type &&
      isOppositeCollinear(group[0].wall, group[1].wall, vx, vy);
    if (straight) crossed.push(group[0].wall);
    else ambiguous = true;
  }

  return { crossed, ambiguous };
}

/** Do two edges share vertex (vx, vy) and extend from it in opposite directions on one axis? */
function isOppositeCollinear(w1, w2, vx, vy) {
  const far = (w) => (w.a[0] === vx && w.a[1] === vy ? w.b : w.a);
  const f1 = far(w1);
  const f2 = far(w2);
  const d1 = [f1[0] - vx, f1[1] - vy];
  const d2 = [f2[0] - vx, f2[1] - vy];
  return d1[0] === -d2[0] && d1[1] === -d2[1];
}

/** Wall edges must be axis-aligned and exactly one cell long. */
export function isUnitAxisEdge(wall) {
  const dx = Math.abs(wall.a[0] - wall.b[0]);
  const dy = Math.abs(wall.a[1] - wall.b[1]);
  return (dx === 1 && dy === 0) || (dx === 0 && dy === 1);
}
