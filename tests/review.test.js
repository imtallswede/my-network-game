// Wave review, firing, scoring, retry, progression (FR-024..FR-030).
import { reviewWave } from '../engine/review.js';
import {
  createSession, beginLevel, endWave, continueFromReview, retryLevel,
  requestRestart, confirmRestart, cancelRestart, nextLevel,
} from '../engine/state.js';
import { applyAction, step } from '../engine/sim.js';
import { CONSTANTS, makeGameLevel } from './fixtures.js';

/** A minimal sim-shaped object at the end of a wave, with chosen satisfaction and ticket ages. */
function fakeSim({ sat = 100, ticketAges = [], budget = 0, diagnosisPoints = 0, waveIndex = 1 } = {}) {
  const level = makeGameLevel();
  const step = 5000;
  return {
    level,
    constants: CONSTANTS,
    step,
    waveIndex,
    budget,
    diagnosisPoints,
    model: { campus: { satisfactionPct: sat, deliveredMbps: sat, demandMbps: 100 }, zones: [], aps: [], buildings: [] },
    tickets: ticketAges.map((age, i) => ({
      id: i + 1, zoneId: '1,1', openedStep: step - age, status: 'open', causesAtOpen: ['weak-signal'], closedStep: null,
    })),
  };
}

const makeDoc = () => ({ constants: CONSTANTS, sources: [], levels: [makeGameLevel(), { ...makeGameLevel(), id: 'FIX-2' }] });

/** Run the first wave of a fresh session to its end (no APs built, so satisfaction is low). */
function playWave(session) {
  const sim = session.sim;
  applyAction(sim, { type: 'set-paused', paused: false });
  const events = [];
  while (sim.phase === 'running') {
    if (sim.paused) applyAction(sim, { type: 'set-paused', paused: false }); // auto-pause on a new ticket
    events.push(...step(sim));
  }
  return events;
}

export const tests = [
  {
    id: 'REV-1',
    name: 'Exactly 70.0% passes; 69.9% fires and names the metric, value, threshold',
    run(t) {
      const pass = reviewWave(fakeSim({ sat: 70.0 }));
      t.eq(pass.fired, false);
      t.eq(pass.firedBy, null);
      const fail = reviewWave(fakeSim({ sat: 69.9 }));
      t.eq(fail.fired, true);
      t.eq(fail.firedBy.metric, 'satisfaction');
      t.eq(fail.firedBy.value, 69.9);
      t.eq(fail.firedBy.threshold, 70.0);
    },
  },
  {
    id: 'REV-2',
    name: 'A ticket open exactly 900 steps passes; 901 fires with the ticket-age metric',
    run(t) {
      t.eq(reviewWave(fakeSim({ ticketAges: [900] })).fired, false);
      const r = reviewWave(fakeSim({ ticketAges: [100, 901] }));
      t.eq(r.fired, true);
      t.eq(r.firedBy.metric, 'ticket-age');
      t.eq(r.firedBy.value, 901);
      t.eq(r.firedBy.threshold, 900);
      t.eq(r.oldestTicketAgeSteps, 901);
    },
  },
  {
    id: 'REV-3',
    name: 'Budget never fires, even when nothing is left',
    run(t) {
      t.eq(reviewWave(fakeSim({ sat: 100, budget: 0 })).fired, false);
    },
  },
  {
    id: 'REV-4',
    name: 'Score components: round(satisfaction), 25 per diagnosis, floor(budget/100) only on level completion',
    run(t) {
      const mid = reviewWave(fakeSim({ sat: 84.6, budget: 1250, diagnosisPoints: 50, waveIndex: 1 }));
      t.eq(mid.score.wavePoints, 85);
      t.eq(mid.score.diagnosisPoints, 50);
      t.eq(mid.score.budgetBonus, 0);
      t.eq(mid.score.total, 135);
      const last = reviewWave(fakeSim({ sat: 100, budget: 1250, diagnosisPoints: 25, waveIndex: 3 }));
      t.eq(last.score.budgetBonus, 12);
      t.eq(last.score.total, 100 + 25 + 12);
      const firedLast = reviewWave(fakeSim({ sat: 50, budget: 1250, waveIndex: 3 }));
      t.eq(firedLast.score.budgetBonus, 0, 'no bonus when fired');
    },
  },
  {
    id: 'REV-5',
    name: 'The next wave is previewed before it starts; none after the last',
    run(t) {
      const sim = fakeSim({ waveIndex: 1 });
      t.eq(reviewWave(sim).nextPreview, sim.level.waves[1].previewText);
      t.eq(reviewWave(fakeSim({ waveIndex: 3 })).nextPreview, null);
    },
  },
  {
    id: 'REV-6',
    name: 'A fired wave awards nothing and Retry restores the level start with no penalty',
    run(t) {
      const s = createSession(makeDoc());
      beginLevel(s);
      const before = { budget: s.sim.budget, score: s.score, aps: s.sim.equipment.aps.length };
      applyAction(s.sim, { type: 'place-ap', cell: [13, 4] }); // 60 m from every arrival zone: the wave fails
      playWave(s);
      endWave(s);
      t.eq(s.view, 'wave-review');
      t.eq(s.review.fired, true);
      t.eq(s.score, before.score, 'no points for a fired wave');
      retryLevel(s);
      t.eq(s.view, 'running');
      t.eq(s.score, before.score);
      t.eq(s.sim.budget, before.budget);
      t.eq(s.sim.equipment.aps.length, before.aps);
      t.eq(s.sim.step, 0);
      t.eq(s.sim.paused, true);
    },
  },
  {
    id: 'REV-7',
    name: 'Passing waves adds points and continues; passing wave 3 completes the level and shows a summary',
    run(t) {
      const s = createSession(makeDoc());
      beginLevel(s);
      applyAction(s.sim, { type: 'place-ap', cell: [2, 1] });
      for (let w = 1; w <= 3; w += 1) {
        if (w > 1) continueFromReview(s);
        playWave(s);
        endWave(s);
        t.eq(s.review.fired, false, `wave ${w} passes`);
        if (w < 3) t.eq(s.view, 'wave-review');
      }
      t.eq(s.view, 'level-summary');
      t.eq(s.summary.wavesPassed, 3);
      t.ok(s.score >= 200, `score ${s.score}`);
      t.eq(s.score, s.summary.score);
      nextLevel(s);
      t.eq(s.view, 'briefing');
      t.eq(s.levelIndex, 1);
    },
  },
  {
    id: 'REV-8',
    name: 'Restart asks first; Cancel changes nothing; Confirm clears the session but keeps the high score',
    run(t) {
      const s = createSession(makeDoc());
      beginLevel(s);
      s.score = 140;
      const snap = JSON.stringify({ v: s.view, sc: s.score, step: s.sim.step });
      requestRestart(s);
      t.eq(s.confirmingRestart, true);
      t.eq(s.score, 140, 'nothing changed by asking');
      cancelRestart(s);
      t.eq(s.confirmingRestart, false);
      t.eq(JSON.stringify({ v: s.view, sc: s.score, step: s.sim.step }), snap);
      requestRestart(s);
      confirmRestart(s);
      t.eq(s.view, 'briefing');
      t.eq(s.levelIndex, 0);
      t.eq(s.score, 0);
      t.eq(s.highScore, 140);
    },
  },
  {
    id: 'REV-9',
    name: 'Ticket counts by assistance feed the level summary',
    run(t) {
      const s = createSession(makeDoc());
      beginLevel(s);
      applyAction(s.sim, { type: 'place-ap', cell: [2, 1] });
      for (let w = 1; w <= 3; w += 1) {
        if (w > 1) continueFromReview(s);
        playWave(s);
        endWave(s);
      }
      t.deepEq(Object.keys(s.summary.diagnosed).sort(), ['afterHint', 'afterWorkedSolution', 'firstTry']);
    },
  },
];
