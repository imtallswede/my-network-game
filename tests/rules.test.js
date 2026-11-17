import { computeModel } from '../engine/rules.js';
import { wallPath } from '../engine/geometry.js';
import { CONSTANTS, MODEL_CASES, makeLevel, CORNER_WALL } from './fixtures.js';

function run(c) {
  const model = computeModel(c.level, CONSTANTS, c.equipment, c.users);
  return {
    model,
    zone: c.zone ? model.zones.find((z) => z.id === c.zone) : null,
    building: model.buildings[0],
    ap1: model.aps.find((a) => a.id === 1),
    ap2: model.aps.find((a) => a.id === 2),
  };
}

const checks = {
  'COV-1': (r, e, t) => { t.close(r.zone.rssiDbm, e.rssi, e.tol, 'rssi'); t.eq(r.zone.covered, e.covered, 'covered'); },
  'COV-2': (r, e, t) => { t.close(r.zone.rssiDbm, e.rssi, e.tol, 'rssi'); t.eq(r.zone.covered, e.covered, 'covered'); },
  'COV-3': (r, e, t) => {
    t.close(r.zone.rssiDbm, e.rssi, e.tol, 'rssi');
    t.eq(r.zone.covered, e.covered, 'covered');
    t.eq(r.zone.deliveredMbps, e.deliveredMbps, 'delivered');
  },
  'WEAK-1': (r, e, t) => { t.close(r.zone.rssiDbm, e.rssi, e.tol, 'rssi'); t.eq(r.zone.covered, e.covered, 'covered'); },
  'OVERLOAD-1': (r, e, t) => {
    t.close(r.zone.rssiDbm, e.rssi, e.tol, 'rssi');
    t.eq(r.ap1.utilizationPct, e.apUtilizationPct, 'ap utilization');
    t.eq(r.ap1.deliveredMbps, e.apDelivered, 'ap delivered');
    t.close(r.zone.satisfactionPct, e.zoneSatisfactionPct, 1e-9, 'zone satisfaction');
  },
  'UPLINK-1': (r, e, t) => {
    t.eq(r.ap1.utilizationPct, e.apUtilizationPct, 'ap utilization');
    t.eq(r.building.utilizationPct, e.buildingUtilizationPct, 'uplink utilization');
    t.eq(r.building.congested, e.congested, 'congested');
    t.close(r.zone.satisfactionPct, e.zoneSatisfactionPct, e.tol, 'share');
  },
  'UTIL-100': (r, e, t) => {
    t.eq(r.building.utilizationPct, e.buildingUtilizationPct, 'utilization');
    t.eq(r.building.congested, e.congested, 'congested');
    t.eq(r.model.campus.satisfactionPct, e.campusSatisfactionPct, 'satisfaction');
  },
  'CHAN-1-3': (r, e, t) => channel(r, e, t),
  'CHAN-1-5': (r, e, t) => channel(r, e, t),
  'CHAN-1-6': (r, e, t) => channel(r, e, t),
  'REDUND-1': (r, e, t) => {
    t.eq(r.building.workingCapacityMbps, e.workingCapacity, 'working capacity');
    t.eq(r.building.utilizationPct, e.buildingUtilizationPct, 'utilization');
    t.close(r.zone.satisfactionPct, e.zoneSatisfactionPct, e.tol, 'share');
    t.eq(r.building.down, e.down, 'down');
  },
  'SPOF-1': (r, e, t) => {
    t.eq(r.model.campus.deliveredMbps, e.campusDeliveredMbps, 'delivered');
    t.eq(r.building.down, e.down, 'down');
    t.eq(r.zone.satisfactionPct, e.zoneSatisfactionPct, 'zone satisfaction');
  },
  'TIE-1': (r, e, t) => t.eq(r.zone.servingApId, e.servingApId, 'serving AP'),
};

function channel(r, e, t) {
  t.eq(r.ap1.conflictsWith.includes(2), e.conflict, 'AP1 conflict');
  t.eq(r.ap2.conflictsWith.includes(1), e.conflict, 'AP2 conflict');
  t.eq(r.ap1.effectiveCapacityMbps, e.effectiveCapacity, 'AP1 capacity');
  t.eq(r.ap2.effectiveCapacityMbps, e.effectiveCapacity, 'AP2 capacity');
}

export const tests = [
  ...MODEL_CASES.map((c) => ({
    id: c.id,
    name: c.name,
    run(t) {
      const check = checks[c.id];
      t.ok(check, `no check defined for ${c.id}`);
      const r = run(c);
      t.eq(r.model.contentErrors.length, 0, 'unexpected content errors');
      check(r, c.expect, t);
    },
  })),
  {
    id: 'ROUND-1',
    name: 'Grading uses unrounded values: displayed -66.9 covered, displayed -67.3 not covered',
    run(t) {
      const lvl = makeLevel();
      const eq = { aps: [{ id: 1, cell: [0, 0], channel: 1 }], uplinks: [] };
      const mk = (cell) => [{ id: 1, type: 'light', zoneId: `${cell[0]},${cell[1]}` }];
      const inb = computeModel(lvl, CONSTANTS, eq, mk([5, 3])).zones.find((z) => z.id === '5,3');
      const out = computeModel(lvl, CONSTANTS, eq, mk([6, 0])).zones.find((z) => z.id === '6,0');
      t.eq(Math.round(inb.rssiDbm * 10) / 10, -66.9, 'displayed in');
      t.eq(inb.covered, true, 'in covered');
      t.eq(Math.round(out.rssiDbm * 10) / 10, -67.3, 'displayed out');
      t.eq(out.covered, false, 'out not covered');
    },
  },
  {
    id: 'GEOM-1',
    name: 'A line through a wall endpoint is ambiguous; a plain crossing is counted once',
    run(t) {
      const through = wallPath([0, 0], [2, 2], [CORNER_WALL]);
      t.eq(through.ambiguous, true, 'corner line ambiguous');
      const plain = wallPath([0, 0], [4, 0], [{ a: [2, 0], b: [2, 1], type: 'drywall' }]);
      t.eq(plain.ambiguous, false, 'plain not ambiguous');
      t.eq(plain.crossed.length, 1, 'crossed once');
      const miss = wallPath([0, 0], [1, 0], [{ a: [2, 0], b: [2, 1], type: 'drywall' }]);
      t.eq(miss.crossed.length, 0, 'wall not between the cells');
    },
  },
  {
    id: 'GEOM-3',
    name: 'A path through the shared vertex of one straight wall crosses it once; mixed types are ambiguous',
    run(t) {
      const straight = [
        { a: [1, 0], b: [1, 1], type: 'drywall' },
        { a: [1, 1], b: [1, 2], type: 'drywall' },
      ];
      const r = wallPath([0, 0], [1, 1], straight);
      t.eq(r.ambiguous, false, 'straight wall not ambiguous');
      t.eq(r.crossed.length, 1, 'crossed once');
      const mixed = [straight[0], { ...straight[1], type: 'concrete' }];
      t.eq(wallPath([0, 0], [1, 1], mixed).ambiguous, true, 'mixed types ambiguous');
    },
  },
  {
    id: 'GEOM-2',
    name: 'An ambiguous AP-to-zone path is reported as a content error, never graded',
    run(t) {
      const lvl = makeLevel({ walls: [CORNER_WALL] });
      const model = computeModel(
        lvl, CONSTANTS,
        { aps: [{ id: 1, cell: [0, 0], channel: 1 }], uplinks: [] },
        [{ id: 1, type: 'light', zoneId: '2,2' }],
      );
      t.ok(model.contentErrors.some((e) => e.code === 'PATH_AMBIGUOUS'), 'content error reported');
    },
  },
];
