// Hand-derived test fixtures. Expected values come from specs/001-campus-connect-playable/spec.md
// (Model Verification Cases) and were worked out on paper, NOT by calling engine/. They need a
// second person's re-check before slice 2 (task T008). Do not "fix" an expected value by running
// the evaluator and copying its output.

// Constants as stated in the spec (FR-003, FR-005..FR-013). Independent copy of data/levels.json.
export const CONSTANTS = {
  eirpDbm: 17,
  pl1mDb: 40,
  pathLossExponent: 3.0,
  coverageThresholdDbm: -67.0,
  ccaThresholdDbm: -82.0,
  apCapacityMbps: 100,
  conflictChannelDelta: 4,
  channelRange: [1, 11],
  wallLossDb: { drywall: 3, brick: 8, concrete: 12 },
  demandMbps: { light: 2, video: 5, event: 3 },
  prices: { ap: 500, uplink100: 200, uplink1000: 800 },
  uplinkCapacityMbps: [100, 1000],
  ticketOpenSteps: 100,
  fireTicketAgeSteps: 900,
  fireSatisfactionPct: 70.0,
  waveSteps: 600,
  pointsPerDiagnosis: 25,
  minDistanceM: 1,
};

/** A single-building level whose zones fill cols x rows. */
export function makeLevel({ cols = 14, rows = 5, walls = [], buildingId = 'b' } = {}) {
  const zones = [];
  for (let r = 0; r < rows; r += 1) for (let c = 0; c < cols; c += 1) zones.push([c, r]);
  return {
    id: 'FIX',
    title: 'Fixture level',
    map: { cols, rows, buildings: [{ id: buildingId, name: 'Fixture', zones, startingUplinks: [] }], walls },
  };
}

export const ap = (id, cell, channel) => ({ id, cell, channel });
export const uplink = (id, buildingId, capacityMbps, state = 'working') => ({ id, buildingId, capacityMbps, state });

let nextUserId = 1;
export function usersAt(cell, type, count) {
  const out = [];
  for (let i = 0; i < count; i += 1) out.push({ id: nextUserId++, type, zoneId: `${cell[0]},${cell[1]}` });
  return out;
}

// A full-height vertical wall at grid line x. Walls must run edge to edge: a wall that ends inside
// the building leaves a corner that some signal paths pass through exactly, which is a content error.
const wallLine = (x, type, rows = 5) =>
  Array.from({ length: rows }, (_, y) => ({ a: [x, y], b: [x, y + 1], type }));

/** Three APs on 1/6/11, each with 12 Video users in its own cell (60 Mbps each), cells 25 m apart. */
function threeApEquipment(uplinks) {
  return {
    level: makeLevel(),
    equipment: { aps: [ap(1, [0, 0], 1), ap(2, [5, 0], 6), ap(3, [10, 0], 11)], uplinks },
    users: [...usersAt([0, 0], 'video', 12), ...usersAt([5, 0], 'video', 12), ...usersAt([10, 0], 'video', 12)],
  };
}

// Each case: { id, name, ...state, expect }. `expect` values are hand-computed.
export const MODEL_CASES = [
  {
    id: 'COV-1',
    name: 'AP 20 m from zone, one drywall: RSSI -65.0 dBm, covered',
    level: makeLevel({ walls: wallLine(2, 'drywall') }),
    equipment: { aps: [ap(1, [0, 0], 1)], uplinks: [uplink(1, 'b', 1000)] },
    users: usersAt([4, 0], 'light', 1),
    zone: '4,0',
    expect: { rssi: -65.03, tol: 0.01, covered: true },
  },
  {
    id: 'COV-2',
    name: 'Offset (5,3) = 29.15 m, no walls: RSSI -66.9 dBm, covered (boundary in)',
    level: makeLevel(),
    equipment: { aps: [ap(1, [0, 0], 1)], uplinks: [uplink(1, 'b', 1000)] },
    users: usersAt([5, 3], 'light', 1),
    zone: '5,3',
    expect: { rssi: -66.94, tol: 0.01, covered: true },
  },
  {
    id: 'COV-3',
    name: 'Offset (6,0) = 30 m, no walls: RSSI -67.3 dBm, not covered, 0 Mbps',
    level: makeLevel(),
    equipment: { aps: [ap(1, [0, 0], 1)], uplinks: [uplink(1, 'b', 1000)] },
    users: usersAt([6, 0], 'light', 1),
    zone: '6,0',
    expect: { rssi: -67.31, tol: 0.01, covered: false, deliveredMbps: 0 },
  },
  {
    id: 'WEAK-1',
    name: '15 m with one concrete wall: RSSI -70.3 dBm, not covered',
    level: makeLevel({ walls: wallLine(2, 'concrete') }),
    equipment: { aps: [ap(1, [0, 0], 1)], uplinks: [uplink(1, 'b', 1000)] },
    users: usersAt([3, 0], 'light', 1),
    zone: '3,0',
    expect: { rssi: -70.28, tol: 0.01, covered: false },
  },
  {
    id: 'OVERLOAD-1',
    name: 'Zone at -53.0 dBm, AP serves 25 Video users: AP at 125%, delivers 100 Mbps',
    level: makeLevel(),
    equipment: { aps: [ap(1, [0, 0], 1)], uplinks: [uplink(1, 'b', 1000)] },
    users: usersAt([2, 0], 'video', 25),
    zone: '2,0',
    expect: { rssi: -53.0, tol: 0.01, covered: true, apUtilizationPct: 125, apDelivered: 100, zoneSatisfactionPct: 80 },
  },
  {
    id: 'UPLINK-1',
    name: '3 APs x 60 Mbps on channels 1/6/11, one 100 Mbps uplink: APs 60%, uplink 180%, share 55.6%',
    ...threeApEquipment([uplink(1, 'b', 100)]),
    zone: '0,0',
    expect: { apUtilizationPct: 60, buildingUtilizationPct: 180, congested: true, zoneSatisfactionPct: 55.56, tol: 0.01 },
  },
  {
    id: 'UTIL-100',
    name: 'Uplink carrying exactly 100 Mbps on 100 Mbps: 100%, not congested, satisfaction 100%',
    level: makeLevel(),
    equipment: { aps: [ap(1, [0, 0], 1), ap(2, [5, 0], 6)], uplinks: [uplink(1, 'b', 100)] },
    users: [...usersAt([0, 0], 'video', 10), ...usersAt([5, 0], 'video', 10)],
    zone: '0,0',
    expect: { buildingUtilizationPct: 100, congested: false, campusSatisfactionPct: 100 },
  },
  {
    id: 'CHAN-1-3',
    name: 'Channels 1 and 3, 20 m apart: conflict, 50 Mbps each',
    level: makeLevel(),
    equipment: { aps: [ap(1, [0, 0], 1), ap(2, [4, 0], 3)], uplinks: [uplink(1, 'b', 1000)] },
    users: [],
    expect: { conflict: true, effectiveCapacity: 50 },
  },
  {
    id: 'CHAN-1-5',
    name: 'Channels 1 and 5 (differ by 4): conflict, 50 Mbps each',
    level: makeLevel(),
    equipment: { aps: [ap(1, [0, 0], 1), ap(2, [4, 0], 5)], uplinks: [uplink(1, 'b', 1000)] },
    users: [],
    expect: { conflict: true, effectiveCapacity: 50 },
  },
  {
    id: 'CHAN-1-6',
    name: 'Channels 1 and 6: no conflict, 100 Mbps each',
    level: makeLevel(),
    equipment: { aps: [ap(1, [0, 0], 1), ap(2, [4, 0], 6)], uplinks: [uplink(1, 'b', 1000)] },
    users: [],
    expect: { conflict: false, effectiveCapacity: 100 },
  },
  {
    id: 'REDUND-1',
    name: 'Demand 180 Mbps on two 100 Mbps uplinks, one fails: capacity 100, 180%, share 55.6%',
    ...threeApEquipment([uplink(1, 'b', 100, 'failed'), uplink(2, 'b', 100)]),
    zone: '0,0',
    expect: { workingCapacity: 100, buildingUtilizationPct: 180, zoneSatisfactionPct: 55.56, tol: 0.01, down: false },
  },
  {
    id: 'SPOF-1',
    name: 'Building on a single 1 Gbps uplink that fails: delivers 0 Mbps, building down',
    ...threeApEquipment([uplink(1, 'b', 1000, 'failed')]),
    zone: '0,0',
    expect: { campusDeliveredMbps: 0, down: true, zoneSatisfactionPct: 0 },
  },
  {
    id: 'TIE-1',
    name: 'Equal RSSI from two APs: the lowest AP ID serves the zone',
    level: makeLevel(),
    equipment: { aps: [ap(2, [4, 0], 6), ap(1, [0, 0], 1)], uplinks: [uplink(1, 'b', 1000)] },
    users: usersAt([2, 0], 'light', 1),
    zone: '2,0',
    expect: { servingApId: 1 },
  },
];

// Firing boundary (spec case "Firing boundary"): campus demand 100 Mbps. Used by review tests (T032).
export const FIRING_CASES = [
  { id: 'FIRE-70', demanded: 100, delivered: 70.0, fired: false },
  { id: 'FIRE-69.9', demanded: 100, delivered: 69.9, fired: true },
];

// Unsupported content (spec case "Unsupported content"). Mutations applied to validDoc() in tests.
export const UNSUPPORTED_CASES = [
  'channel-13',
  'wall-through-corner',
  'zone-outside-building',
];

/** A minimal valid document, used as the base for content tests. */
export function validDoc() {
  const zones = [];
  for (let r = 0; r < 3; r += 1) for (let c = 0; c < 6; c += 1) zones.push([c, r]);
  const wave = (index, count) => ({
    index,
    previewText: `${count} Light users arrive`,
    arrivals: [{ userType: 'light', count, zones: [[0, 0], [1, 0]] }],
  });
  return {
    schemaVersion: 1,
    constants: structuredClone(CONSTANTS),
    sources: [{ id: 's1', title: 'Source', url: '', section: 'n/a', claim: 'claim', status: 'illustrative' }],
    levels: [{
      id: 'L-test',
      title: 'Test level',
      outcomeId: 'LO1',
      budget: 2000,
      apLimit: 3,
      channelMode: { type: 'locked', channels: [1, 6, 11] },
      briefing: { paragraphs: ['Intro'], simplification: 'This is a simplified model; real networks have more effects.', sourceIds: ['s1'] },
      map: {
        cols: 6,
        rows: 3,
        buildings: [{ id: 'b', name: 'Test', zones, startingUplinks: [1000] }],
        walls: [],
      },
      startingEquipment: { aps: [], uplinks: [] },
      waves: [wave(1, 2), wave(2, 4), wave(3, 6)],
      failures: [],
      tickets: [],
      hints: { method: 'Compare signal, then AP, then uplink.', worked: 'Worked solution.' },
    }],
  };
}

/** A corner case: a wall ends at grid vertex (1,1); the line from cell (0,0) to (2,2) passes it. */
export const CORNER_WALL = { a: [1, 1], b: [1, 2], type: 'drywall' };

/** A playable fixture level: one building, three waves of Light users, locked channels 1/6/11. */
export function makeGameLevel({ budget = 2000, apLimit = 3, channelMode = { type: 'locked', channels: [1, 6, 11] } } = {}) {
  const base = makeLevel();
  base.map.buildings[0].startingUplinks = [1000];
  const wave = (index, count) => ({
    index,
    previewText: `${count} Light users arrive`,
    arrivals: [{ userType: 'light', count, zones: [[1, 1], [2, 1], [3, 2]] }],
  });
  return {
    ...base,
    id: 'FIX-GAME',
    title: 'Fixture game level',
    budget,
    apLimit,
    channelMode,
    startingEquipment: { aps: [], uplinks: [] },
    waves: [wave(1, 20), wave(2, 40), wave(3, 60)],
    failures: [],
  };
}

// ---- Level 2 worked interaction (spec US2) -------------------------------------------------
// Dorm: three APs on channels 1/6/11, 12 Video users in each AP's section, one 100 Mbps uplink.
// Zone 2B is cell [2,0]: 10 m from AP 1, so RSSI = 17 - 40 - 30*log10(10) = -53.0 dBm.
// Hand-derived expectations (NOT computed by engine/):
//   AP 1 serves 12 Video users = 60 Mbps of 100 Mbps          -> 60%
//   Building traffic 3 x 60 = 180 Mbps on a 100 Mbps uplink    -> 180%
//   Each user gets 100 / 180 = 55.6% of demand
export function worked2() {
  const level = makeLevel();
  return {
    level,
    equipment: {
      aps: [ap(1, [0, 0], 1), ap(2, [5, 0], 6), ap(3, [10, 0], 11)],
      uplinks: [uplink(1, 'b', 100)],
    },
    users: [...usersAt([2, 0], 'video', 12), ...usersAt([7, 0], 'video', 12), ...usersAt([12, 0], 'video', 12)],
    zone: '2,0',
  };
}

export const WORKED2_EXPECT = {
  rssi: -53.0,
  thresholdDbm: -67,
  apUtilizationPct: 60,
  apDemandMbps: 60,
  apCapacityMbps: 100,
  uplinkUtilizationPct: 180,
  uplinkTrafficMbps: 180,
  uplinkCapacityMbps: 100,
  sharePct: 55.6, // 100/180, one decimal
  trueCauses: ['uplink-congested'],
};
