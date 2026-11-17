// Level 2 "Dorm Move-In" content and playability (FR-031).
import { validateContent } from '../engine/content.js';
import { createSim, applyAction, step } from '../engine/sim.js';
import { causesFor } from '../engine/rules.js';

async function load() {
  const res = await fetch('../data/levels.json');
  const doc = await res.json();
  return doc;
}

function run(sim, n) {
  for (let i = 0; i < n; i += 1) step(sim);
}

const APS = [[2, 2], [6, 2], [10, 2]];

function built(doc, { upgrade }) {
  const level = doc.levels.find((l) => l.id === 'L2');
  const sim = createSim(level, doc.constants);
  for (const cell of APS) applyAction(sim, { type: 'place-ap', cell });
  if (upgrade) applyAction(sim, { type: 'upgrade-uplink', id: 1 });
  applyAction(sim, { type: 'set-autopause', on: false });
  return sim;
}

export const tests = [
  {
    id: 'L2-1',
    name: 'Level 2 validates and matches the spec table (budget 2500, 3 APs, 20/40/50 Video users, 100 Mbps uplink)',
    async run(t) {
      const doc = await load();
      t.deepEq(validateContent(doc).errors, []);
      const l = doc.levels.find((x) => x.id === 'L2');
      t.ok(l, 'level 2 exists');
      t.eq(l.budget, 2500);
      t.eq(l.apLimit, 3);
      t.deepEq(l.channelMode, { type: 'locked', channels: [1, 6, 11] });
      t.deepEq(l.waves.map((w) => w.arrivals[0].count), [20, 40, 50]);
      t.ok(l.waves.every((w) => w.arrivals[0].userType === 'video'));
      t.deepEq(l.map.buildings[0].startingUplinks, [100]);
      t.ok(l.tickets.some((x) => x.title === 'Dorm room 2B'), 'has the Dorm room 2B ticket');
      t.ok(l.hints.method && l.hints.worked, 'has both hints');
      t.ok(l.briefing.example, 'has a worked example');
    },
  },
  {
    id: 'L2-2',
    name: 'Three APs on 1/6/11 serve every wave, but the 100 Mbps uplink congests in wave 2 (Uplink congested)',
    async run(t) {
      const doc = await load();
      const sim = built(doc, { upgrade: false });
      t.deepEq(sim.equipment.aps.map((a) => a.channel), [1, 6, 11]);
      applyAction(sim, { type: 'set-paused', paused: false });
      run(sim, 599); // end of wave 1: 100 Mbps wanted, 100 available
      t.close(sim.model.campus.satisfactionPct, 100, 1e-9, 'wave 1 is fully served');
      run(sim, 1);
      applyAction(sim, { type: 'continue-wave' });
      run(sim, 599);
      t.ok(sim.model.campus.satisfactionPct < 100, 'wave 2 is congested');
      const congested = sim.model.buildings[0];
      t.eq(congested.congested, true);
      const open = sim.tickets.filter((x) => x.status === 'open');
      t.ok(open.length > 0, 'tickets opened');
      t.ok(causesFor(open[0].zoneId, sim.model).has('uplink-congested'));
    },
  },
  {
    id: 'L2-3',
    name: 'Three APs plus a 1 Gbps upgrade fit the budget and serve all three waves fully',
    async run(t) {
      const doc = await load();
      const sim = built(doc, { upgrade: true });
      t.ok(sim.budget >= 0, `budget left ${sim.budget}`);
      applyAction(sim, { type: 'set-paused', paused: false });
      for (let w = 1; w <= 3; w += 1) {
        run(sim, 600);
        t.close(sim.model.campus.satisfactionPct, 100, 1e-9, `wave ${w}`);
        if (w < 3) applyAction(sim, { type: 'continue-wave' });
      }
      t.eq(sim.tickets.length, 0, 'no tickets when built well');
    },
  },
];
