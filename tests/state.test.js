// Ticket lifecycle in the simulation (FR-014, FR-017, FR-017a, FR-018, FR-019, FR-020).
// Fixture level: Light users arrive in zones 1,1 / 2,1 / 3,2 starting at step 0 (zone 1,1 first).
import { createSim, applyAction, step, fingerprint } from '../engine/sim.js';
import { CONSTANTS, makeGameLevel } from './fixtures.js';

function runSteps(sim, n) {
  const events = [];
  for (let i = 0; i < n; i += 1) events.push(...step(sim));
  return events;
}

function started() {
  const sim = createSim(makeGameLevel(), CONSTANTS);
  applyAction(sim, { type: 'set-paused', paused: false });
  return sim;
}

/** Same, with auto-pause off so the clock keeps running past ticket arrivals. */
function startedNoPause() {
  const sim = createSim(makeGameLevel(), CONSTANTS);
  applyAction(sim, { type: 'set-autopause', on: false });
  applyAction(sim, { type: 'set-paused', paused: false });
  return sim;
}

/** A sim with an open ticket on zone 1,1 (no AP yet, so the cause is Weak signal). */
function withTicket() {
  const sim = startedNoPause();
  runSteps(sim, 100);
  return sim;
}

const ticketFor = (sim, zoneId) => sim.tickets.find((x) => x.zoneId === zoneId);

export const tests = [
  {
    id: 'TKT-1',
    name: 'A ticket opens after 100 steps below 100% satisfaction, not before; one per zone',
    run(t) {
      const sim = startedNoPause();
      runSteps(sim, 99);
      t.eq(sim.tickets.length, 0, 'no ticket at 9.9 s');
      const events = runSteps(sim, 1);
      t.eq(sim.tickets.length, 1, 'ticket at 10.0 s');
      const tk = sim.tickets[0];
      t.eq(tk.zoneId, '1,1');
      t.eq(tk.status, 'open');
      t.eq(tk.openedStep, 100);
      t.deepEq(tk.causesAtOpen, ['weak-signal']);
      t.ok(events.some((e) => e.type === 'ticket-opened' && e.ticketId === tk.id), 'ticket-opened event');
      runSteps(sim, 200);
      t.eq(sim.tickets.filter((x) => x.zoneId === '1,1').length, 1, 'still one ticket for the zone');
    },
  },
  {
    id: 'TKT-2',
    name: 'Wrong diagnosis leaves the ticket open, counts an attempt, and changes no score',
    run(t) {
      const sim = withTicket();
      const tk = ticketFor(sim, '1,1');
      const r = applyAction(sim, { type: 'submit-diagnosis', ticketId: tk.id, choice: 'uplink-congested' });
      t.eq(r.ok, true);
      t.eq(r.evaluation.status, 'incorrect');
      t.eq(tk.status, 'open');
      t.eq(tk.attempts, 1);
      t.eq(sim.diagnosisPoints, 0);
      t.eq(tk.awardedPoints, 0);
    },
  },
  {
    id: 'TKT-3',
    name: 'Empty or unknown submit gives guidance and does not count as an attempt',
    run(t) {
      const sim = withTicket();
      const tk = ticketFor(sim, '1,1');
      const r1 = applyAction(sim, { type: 'submit-diagnosis', ticketId: tk.id, choice: '' });
      t.eq(r1.ok, false);
      t.eq(r1.reason, 'invalid-input');
      const r2 = applyAction(sim, { type: 'submit-diagnosis', ticketId: tk.id, choice: 'dns' });
      t.eq(r2.reason, 'invalid-input');
      t.eq(tk.attempts, 0);
      t.eq(tk.status, 'open');
    },
  },
  {
    id: 'TKT-4',
    name: 'Correct diagnosis sets Diagnosed and awards 25 points exactly once',
    run(t) {
      const sim = withTicket();
      const tk = ticketFor(sim, '1,1');
      const r = applyAction(sim, { type: 'submit-diagnosis', ticketId: tk.id, choice: 'weak-signal' });
      t.eq(r.ok, true);
      t.eq(r.evaluation.status, 'correct');
      t.eq(tk.status, 'diagnosed');
      t.eq(tk.awardedPoints, 25);
      t.eq(sim.diagnosisPoints, 25);
      const again = applyAction(sim, { type: 'submit-diagnosis', ticketId: tk.id, choice: 'weak-signal' });
      t.eq(again.ok, false);
      t.eq(again.reason, 'already-diagnosed');
      t.eq(sim.diagnosisPoints, 25, 'no second award');
      t.eq(tk.attempts, 1, 'repeat submit is a no-op');
    },
  },
  {
    id: 'TKT-5',
    name: 'Hint then worked solution are recorded as assistance and never diagnose',
    run(t) {
      const sim = withTicket();
      const tk = ticketFor(sim, '1,1');
      t.eq(tk.assistance, 'none');
      const h1 = applyAction(sim, { type: 'request-hint', ticketId: tk.id });
      t.eq(h1.ok, true);
      t.eq(h1.hintLevel, 1);
      t.eq(tk.assistance, 'hint');
      const h2 = applyAction(sim, { type: 'request-hint', ticketId: tk.id });
      t.eq(h2.hintLevel, 2);
      t.eq(tk.assistance, 'worked-solution');
      const h3 = applyAction(sim, { type: 'request-hint', ticketId: tk.id });
      t.eq(h3.hintLevel, 2, 'stays at the worked solution');
      t.eq(tk.status, 'open');
      t.eq(sim.diagnosisPoints, 0);
      t.eq(tk.attempts, 0);
    },
  },
  {
    id: 'TKT-6',
    name: 'Zone reaches 100% before diagnosis: resolved-by-change, no points, causes named',
    run(t) {
      const sim = withTicket();
      const tk = ticketFor(sim, '1,1');
      t.eq(applyAction(sim, { type: 'place-ap', cell: [2, 1] }).ok, true);
      const events = runSteps(sim, 1);
      t.eq(tk.status, 'resolved-by-change');
      t.eq(sim.diagnosisPoints, 0);
      t.eq(tk.awardedPoints, 0);
      t.deepEq(tk.causesAtOpen, ['weak-signal']);
      t.ok(events.some((e) => e.type === 'ticket-resolved-by-change' && e.ticketId === tk.id), 'event');
      t.eq(tk.resolution.action.type, 'place-ap', 'names the change that fixed it');
    },
  },
  {
    id: 'TKT-7',
    name: 'Diagnosed ticket closes when the zone reaches 100%; it keeps aging until then',
    run(t) {
      const sim = withTicket();
      const tk = ticketFor(sim, '1,1');
      applyAction(sim, { type: 'submit-diagnosis', ticketId: tk.id, choice: 'weak-signal' });
      runSteps(sim, 50);
      t.eq(tk.status, 'diagnosed');
      t.eq(sim.step - tk.openedStep, 50, 'age keeps counting after diagnosis');
      applyAction(sim, { type: 'place-ap', cell: [2, 1] });
      const events = runSteps(sim, 1);
      t.eq(tk.status, 'closed');
      t.eq(sim.diagnosisPoints, 25, 'points kept');
      t.ok(events.some((e) => e.type === 'ticket-closed' && e.ticketId === tk.id), 'event');
    },
  },
  {
    id: 'TKT-8',
    name: 'Ticket counters and ages do not advance while paused',
    run(t) {
      const sim = withTicket();
      applyAction(sim, { type: 'set-paused', paused: true });
      const before = fingerprint(sim);
      runSteps(sim, 200);
      t.eq(fingerprint(sim), before);
    },
  },
  {
    id: 'TKT-10',
    name: 'Auto-pause (on by default) pauses when a ticket opens; turned off, the clock keeps running',
    run(t) {
      const sim = started();
      t.eq(sim.autoPause, true);
      runSteps(sim, 100);
      t.eq(sim.tickets.length, 1);
      t.eq(sim.paused, true, 'paused when the ticket opened');
      const off = started();
      applyAction(off, { type: 'set-autopause', on: false });
      runSteps(off, 100);
      t.eq(off.paused, false);
      t.eq(off.tickets.length, 1);
    },
  },
  {
    id: 'TKT-9',
    name: 'Replaying the same log gives the same tickets and points',
    run(t) {
      const play = () => {
        const sim = withTicket();
        const tk = sim.tickets[0];
        applyAction(sim, { type: 'request-hint', ticketId: tk.id });
        applyAction(sim, { type: 'submit-diagnosis', ticketId: tk.id, choice: 'weak-signal' });
        runSteps(sim, 40);
        return sim;
      };
      const a = play();
      const b = play();
      t.eq(fingerprint(a), fingerprint(b));
      t.ok(fingerprint(a).includes('"tickets"'), 'fingerprint covers tickets');
    },
  },
];
