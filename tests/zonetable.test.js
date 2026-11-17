// The zone table and the map read the same rows (contracts/ui-controls.md). Pure helper, no DOM.
import { zoneRows, formatDbm, formatPct, zoneLabel } from '../engine/feedback.js';
import { createSim, applyAction, step } from '../engine/sim.js';
import { computeModel } from '../engine/rules.js';
import { CONSTANTS, worked2 } from './fixtures.js';

async function simFor(levelId, aps, upgrade) {
  const doc = await (await fetch('../data/levels.json')).json();
  const level = doc.levels.find((l) => l.id === levelId);
  const sim = createSim(level, doc.constants);
  for (const cell of aps) applyAction(sim, { type: 'place-ap', cell });
  if (upgrade) applyAction(sim, { type: 'upgrade-uplink', id: 1 });
  applyAction(sim, { type: 'set-autopause', on: false });
  applyAction(sim, { type: 'set-paused', paused: false });
  for (let i = 0; i < 300; i += 1) step(sim);
  return sim;
}

function check(t, sim) {
  const model = sim.model;
  const rows = zoneRows(model);
  t.eq(rows.length, model.zones.length, 'one row per zone');
  for (const z of model.zones) {
    const row = rows.find((r) => r.id === z.id);
    t.ok(row, `row for ${z.id}`);
    t.eq(row.label, zoneLabel(z.cell));
    t.eq(row.rssi, formatDbm(z.rssiDbm));
    t.eq(row.covered, z.covered ? 'Covered' : 'Not covered');
    t.eq(row.servingAp, z.servingApId ? `AP ${z.servingApId}` : 'none');
    t.eq(row.users, z.users);
    t.eq(row.apUtil, formatPct(z.apUtilizationPct));
    t.eq(row.uplinkUtil, formatPct(z.uplinkUtilizationPct));
    if (z.servingApId) t.eq(row.channel, String(model.aps.find((a) => a.id === z.servingApId).channel));
    for (const part of [row.label, row.rssi, row.covered, row.servingAp, `${z.users} user`]) {
      t.ok(row.name.includes(part), `accessible name of ${z.id} includes "${part}": ${row.name}`);
    }
  }
}

export const tests = [
  {
    id: 'ZT-1',
    name: 'Level 1: every zone row equals the model, and each map cell name carries zone, RSSI, covered, AP and users',
    async run(t) {
      check(t, await simFor('L1', [[2, 3], [8, 3], [12, 3]], false));
    },
  },
  {
    id: 'ZT-2',
    name: 'Level 2: rows equal the model while the uplink is congested',
    async run(t) {
      const sim = await simFor('L2', [[2, 2], [6, 2], [10, 2]], false);
      check(t, sim);
      const row = zoneRows(sim.model).find((r) => r.users > 0);
      t.ok(row.name.length > 0);
    },
  },
  {
    id: 'ZT-3',
    name: 'Congestion and no-signal states are named in text, not color alone',
    async run(t) {
      const none = zoneRows((await simFor('L2', [], false)).model).find((r) => r.users > 0);
      t.ok(/no signal|not covered/i.test(none.name), none.name);
      const w = worked2();
      const rows = zoneRows(computeModel(w.level, CONSTANTS, w.equipment, w.users));
      const busy = rows.find((r) => r.id === w.zone);
      t.ok(/uplink congested/.test(busy.name), busy.name);
    },
  },
];
