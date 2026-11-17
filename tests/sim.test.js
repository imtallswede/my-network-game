import { createSim, step, applyAction, replay, fingerprint } from '../engine/sim.js';
import { CONSTANTS, makeGameLevel } from './fixtures.js';

// These tests are about waves and arrivals, so auto-pause (tested in state.test.js) is off.
const fresh = (opts) => { const s = createSim(makeGameLevel(opts), CONSTANTS); s.autoPause = false; return s; };
const act = (sim, action) => applyAction(sim, action);
const resume = (sim) => act(sim, { type: 'set-paused', paused: false });
function run(sim, n) {
  const events = [];
  for (let i = 0; i < n; i += 1) events.push(...step(sim));
  return events;
}

export const tests = [
  {
    id: 'SIM-1',
    name: 'A fresh level is paused with no users and the clock not started (AC1)',
    run(t) {
      const sim = fresh();
      t.eq(sim.paused, true, 'paused');
      t.eq(sim.users.length, 0, 'users');
      t.eq(sim.step, 0, 'step');
      t.eq(sim.phase, 'ready', 'phase');
      run(sim, 50);
      t.eq(sim.step, 0, 'does not advance before the first resume');
      t.eq(sim.users.length, 0, 'still no users');
    },
  },
  {
    id: 'SIM-2',
    name: 'Wave 1 starts on the first resume; users arrive evenly and the wave ends after 600 steps',
    run(t) {
      const sim = fresh();
      const r = resume(sim);
      t.eq(r.ok, true, 'resume ok');
      t.eq(sim.phase, 'running', 'running');
      t.eq(sim.users.length, 1, 'first user arrives at step 0');
      run(sim, 299);
      t.eq(sim.users.length, 10, 'users 0-9 have arrived by step 299 (one every 30 steps)');
      const events = run(sim, 400);
      t.eq(sim.users.length, 20, 'all 20 users present at wave end');
      t.eq(events.filter((e) => e.type === 'wave-ended').length, 1, 'one wave-ended event');
      t.eq(sim.step, 600, 'exactly 600 steps');
      t.eq(sim.paused, true, 'paused at wave end');
      t.eq(sim.phase, 'wave-end', 'phase');
    },
  },
  {
    id: 'SIM-3',
    name: 'While paused the clock, arrivals and building actions behave: nothing advances (AC4)',
    run(t) {
      const sim = fresh();
      resume(sim);
      run(sim, 100);
      act(sim, { type: 'set-paused', paused: true });
      const before = fingerprint(sim);
      run(sim, 200);
      t.eq(fingerprint(sim), before, 'state unchanged by stepping while paused');
      const placed = act(sim, { type: 'place-ap', cell: [2, 2] });
      t.eq(placed.ok, true, 'can build while paused');
      t.eq(sim.step, 100, 'clock still at 100');
      resume(sim);
      run(sim, 10);
      t.eq(sim.step, 110, 'clock resumes from 100');
    },
  },
  {
    id: 'SIM-4',
    name: 'Over-budget purchase is refused with cost and remaining budget; exact budget succeeds (AC3)',
    run(t) {
      const poor = fresh({ budget: 400 });
      const r = act(poor, { type: 'place-ap', cell: [1, 1] });
      t.eq(r.ok, false, 'refused');
      t.eq(r.reason, 'over-budget', 'reason');
      t.eq(r.cost, 500, 'cost');
      t.eq(r.remaining, 400, 'remaining');
      t.eq(poor.equipment.aps.length, 0, 'nothing placed');
      t.eq(poor.budget, 400, 'budget unchanged');
      const exact = fresh({ budget: 500 });
      t.eq(act(exact, { type: 'place-ap', cell: [1, 1] }).ok, true, 'exact budget ok');
      t.eq(exact.budget, 0, 'budget now zero');
    },
  },
  {
    id: 'SIM-5',
    name: 'Removing equipment refunds 100%; pre-installed uplinks cannot be removed (AC5)',
    run(t) {
      const sim = fresh();
      const p = act(sim, { type: 'place-ap', cell: [1, 1] });
      t.eq(sim.budget, 1500, 'after placing');
      t.eq(act(sim, { type: 'remove-ap', id: p.id }).ok, true, 'remove ok');
      t.eq(sim.budget, 2000, 'refunded in full');
      const bought = act(sim, { type: 'buy-uplink', buildingId: 'b', capacityMbps: 100 });
      t.eq(bought.ok, true, 'bought uplink');
      t.eq(sim.budget, 1800, 'uplink cost 200');
      const up = act(sim, { type: 'upgrade-uplink', id: bought.id });
      t.eq(up.ok, true, 'upgrade ok');
      t.eq(sim.budget, 1200, 'upgrade costs the difference (600)');
      act(sim, { type: 'remove-uplink', id: bought.id });
      t.eq(sim.budget, 2000, 'removal refunds everything paid');
      const pre = act(sim, { type: 'remove-uplink', id: 1 });
      t.eq(pre.ok, false, 'pre-installed refused');
      t.eq(pre.reason, 'preinstalled', 'reason');
    },
  },
  {
    id: 'SIM-6',
    name: 'AP limit, locked channels assigned 1/6/11, invalid and occupied cells',
    run(t) {
      const sim = fresh();
      const ids = [[1, 1], [6, 2], [11, 3]].map((cell) => act(sim, { type: 'place-ap', cell }));
      t.deepEq(sim.equipment.aps.map((a) => a.channel), [1, 6, 11], 'channels assigned in order');
      t.ok(ids.every((r) => r.ok), 'three placed');
      const fourth = act(sim, { type: 'place-ap', cell: [3, 3] });
      t.eq(fourth.reason, 'over-limit', 'limit reached');
      t.eq(act(sim, { type: 'place-ap', cell: [1, 1] }).reason, 'occupied', 'occupied');
      t.eq(act(sim, { type: 'place-ap', cell: [40, 40] }).reason, 'invalid-cell', 'outside the building');
      t.eq(act(sim, { type: 'set-channel', id: 1, channel: 3 }).reason, 'channels-locked', 'locked mode');
    },
  },
  {
    id: 'SIM-7',
    name: 'Manual channel mode allows set-channel within 1-11 only',
    run(t) {
      const sim = fresh({ channelMode: { type: 'manual' } });
      const p = act(sim, { type: 'place-ap', cell: [1, 1] });
      t.eq(act(sim, { type: 'set-channel', id: p.id, channel: 9 }).ok, true, 'channel 9 ok');
      t.eq(sim.equipment.aps[0].channel, 9, 'channel stored');
      t.eq(act(sim, { type: 'set-channel', id: p.id, channel: 13 }).reason, 'invalid-channel', 'channel 13 refused');
      t.eq(sim.equipment.aps[0].channel, 9, 'unchanged after refusal');
    },
  },
  {
    id: 'SIM-8',
    name: 'The model updates immediately when an AP is placed (RSSI and coverage)',
    run(t) {
      const sim = fresh();
      act(sim, { type: 'place-ap', cell: [0, 0] });
      const z = sim.model.zones.find((x) => x.id === '4,0');
      t.close(z.rssiDbm, -62.03, 0.01, 'RSSI at 20 m with no walls');
      t.eq(z.covered, true, 'covered');
    },
  },
  {
    id: 'SIM-9',
    name: 'Continue starts the next wave: previous users leave and the new count arrives',
    run(t) {
      const sim = fresh();
      resume(sim);
      run(sim, 600);
      t.eq(sim.phase, 'wave-end', 'wave 1 over');
      t.eq(act(sim, { type: 'set-paused', paused: false }).reason, 'awaiting-continue', 'cannot resume at wave end');
      const c = act(sim, { type: 'continue-wave' });
      t.eq(c.ok, true, 'continue ok');
      t.eq(sim.waveIndex, 2, 'wave 2');
      t.eq(sim.users.length, 1, 'only the first wave-2 user so far (previous users left)');
      run(sim, 600);
      t.eq(sim.users.length, 40, 'wave 2 total of 40 present at wave end');
    },
  },
  {
    id: 'SIM-10',
    name: 'Replaying the same (step, action) log gives identical state (SC-003)',
    run(t) {
      const level = makeGameLevel();
      const log = [
        { step: 0, action: { type: 'place-ap', cell: [1, 1] } },
        { step: 0, action: { type: 'place-ap', cell: [7, 2] } },
        { step: 0, action: { type: 'set-paused', paused: false } },
        { step: 120, action: { type: 'place-ap', cell: [12, 3] } },
        { step: 300, action: { type: 'set-speed', speed: 2 } },
        { step: 450, action: { type: 'remove-ap', id: 2 } },
      ];
      const a = replay(level, CONSTANTS, log, 600);
      const b = replay(level, CONSTANTS, log, 600);
      t.eq(fingerprint(a), fingerprint(b), 'two replays identical');
      // A live run applying the same actions at the same steps matches the replay.
      const live = createSim(level, CONSTANTS);
      const pending = [...log];
      while (live.step < 600) {
        while (pending.length && pending[0].step === live.step) applyAction(live, pending.shift().action);
        if (live.phase === 'wave-end') break;
        step(live);
      }
      t.eq(fingerprint(live), fingerprint(a), 'live run equals replay');
    },
  },
];
