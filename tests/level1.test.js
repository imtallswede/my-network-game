// Level 1 design checks against the shipped data/levels.json: the teaching premise ("one AP in
// the middle does not cover the library") and that a good build serves every wave.

import { createSim, step, applyAction } from '../engine/sim.js';
import { validateContent } from '../engine/content.js';

async function load() {
  const res = await fetch('../data/levels.json', { cache: 'no-cache' });
  const doc = await res.json();
  return { doc, level: doc.levels.find((l) => l.id === 'L1') };
}

const place = (sim, cell) => applyAction(sim, { type: 'place-ap', cell });

function runWave(sim) {
  while (sim.phase === 'running' && !sim.paused) step(sim);
}

export const tests = [
  {
    id: 'L1-1',
    name: 'Level 1 exists, validates, and matches the spec (budget 2000, 3 APs, 3 waves of 20/40/60 Light users)',
    async run(t) {
      const { doc, level } = await load();
      t.ok(level, 'level L1 present');
      t.eq(validateContent(doc).ok, true, JSON.stringify(validateContent(doc).errors.slice(0, 2)));
      t.eq(level.budget, 2000, 'budget');
      t.eq(level.apLimit, 3, 'AP limit');
      t.deepEq(level.waves.map((w) => w.arrivals[0].count), [20, 40, 60], 'wave sizes');
      t.ok(level.waves.every((w) => w.arrivals.every((a) => a.userType === 'light')), 'Light users');
      t.deepEq(level.map.buildings[0].startingUplinks, [1000], '1 Gbps uplink pre-installed');
    },
  },
  {
    id: 'L1-2',
    name: 'One AP in the middle leaves occupied zones uncovered (the misconception Level 1 exposes)',
    async run(t) {
      const { doc, level } = await load();
      const sim = createSim(level, doc.constants);
      t.eq(place(sim, [7, 3]).ok, true, 'placed');
      applyAction(sim, { type: 'set-paused', paused: false });
      const uncovered = sim.model.zones.filter((z) => z.users > 0 && !z.covered);
      t.ok(uncovered.length > 0, 'some occupied zone has no coverage');
    },
  },
  {
    id: 'L1-3',
    name: 'One AP per section covers every zone, and all three waves are fully served',
    async run(t) {
      const { doc, level } = await load();
      const sim = createSim(level, doc.constants);
      for (const cell of [[3, 3], [8, 3], [12, 3]]) t.eq(place(sim, cell).ok, true, `place ${cell}`);
      t.eq(sim.budget, 500, 'three APs cost 1500');
      t.deepEq(sim.equipment.aps.map((a) => a.channel), [1, 6, 11], 'channels 1/6/11');
      t.eq(sim.model.zones.every((z) => z.covered), true, 'every zone covered');
      applyAction(sim, { type: 'set-paused', paused: false });
      for (let wave = 1; wave <= 3; wave += 1) {
        runWave(sim);
        t.eq(sim.phase, 'wave-end', `wave ${wave} ended`);
        t.eq(sim.model.campus.satisfactionPct, 100, `wave ${wave} satisfaction`);
        if (wave < 3) applyAction(sim, { type: 'continue-wave' });
      }
      t.eq(sim.users.length, 60, 'wave 3 has 60 users');
    },
  },
  {
    id: 'L1-4',
    name: 'Without building anything, wave 1 users get no service (satisfaction 0%)',
    async run(t) {
      const { doc, level } = await load();
      const sim = createSim(level, doc.constants);
      applyAction(sim, { type: 'set-paused', paused: false });
      runWave(sim);
      t.eq(sim.model.campus.satisfactionPct, 0, 'no APs means no service');
    },
  },
];
