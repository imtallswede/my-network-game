// Session state: which view is showing, the current level, and the running simulation.
// The rule engine and simulation own all game logic; this module only sequences views.
//   loading -> briefing -> running   (wave review, firing, summaries arrive with US3)
// The level start point is "a fresh sim from level data plus the score at level start", so
// Retry (US3) is a rebuild, not a patch.

import { createSim, applyAction, step } from './sim.js';
import { describeAction } from './feedback.js';
import { reviewWave } from './review.js';

export function createSession(doc, levelIndex = 0) {
  const session = {
    doc,
    constants: doc.constants,
    view: 'briefing',
    levelIndex,
    level: doc.levels[levelIndex],
    sim: null,
    score: 0,
    scoreAtLevelStart: 0,
    selectedZone: null,
    tool: null, // 'place-ap' while the player is placing, else null
    selectedTicket: null,
    choice: {}, // ticketId -> chosen cause (not yet submitted)
    notes: {}, // ticketId -> last diagnosis feedback
    review: null,
    summary: null,
    autoPause: true, // setting holds for the page session (FR-022)
    highScore: 0, // page session only (FR-030)
    confirmingRestart: false,
  };
  return session;
}

/** Leave the briefing: build the sim for this level. It starts paused with no users (AC1). */
export function beginLevel(session) {
  session.level = session.doc.levels[session.levelIndex];
  session.scoreAtLevelStart = session.score;
  session.sim = createSim(session.level, session.constants);
  session.sim.autoPause = session.autoPause;
  session.selectedZone = null;
  session.tool = null;
  session.selectedTicket = null;
  session.choice = {};
  session.notes = {};
  session.review = null;
  session.summary = null;
  session.score = session.scoreAtLevelStart;
  session.view = 'running';
}

/** Run one player action; returns the sim result plus text for the live region. */
export function perform(session, action) {
  const result = applyAction(session.sim, action);
  return { result, text: describeAction(result, action, session.sim) };
}

/** Advance one 0.1 s step (never while paused; the sim also guards this). */
export function tick(session) {
  return step(session.sim);
}

// ---- Wave review, firing, progression -------------------------------------------------------

/** Called when the sim reports wave-ended: score the wave and show the review (or the summary). */
export function endWave(session) {
  const review = reviewWave(session.sim);
  session.review = review;
  session.view = 'wave-review';
  if (review.fired) return review;
  session.score += review.score.wavePoints;
  if (review.finalWave) completeLevel(session, review);
  return review;
}

function ticketCounts(sim) {
  const counts = { firstTry: 0, afterHint: 0, afterWorkedSolution: 0 };
  for (const tk of sim.tickets) {
    if (tk.awardedPoints <= 0) continue;
    if (tk.assistance === 'worked-solution') counts.afterWorkedSolution += 1;
    else if (tk.assistance === 'hint') counts.afterHint += 1;
    else if (tk.attempts === 1) counts.firstTry += 1;
  }
  return counts;
}

function completeLevel(session, review) {
  const sim = session.sim;
  session.score += review.score.diagnosisPoints + review.score.budgetBonus;
  session.summary = {
    levelTitle: session.level.title,
    wavesPassed: session.level.waves.length,
    diagnosed: ticketCounts(sim),
    budgetLeft: sim.budget,
    budgetBonus: review.score.budgetBonus,
    diagnosisPoints: review.score.diagnosisPoints,
    score: session.score,
  };
  session.view = 'level-summary';
}

/** Leave a passed wave review and start the next wave (paused state is cleared by the sim). */
export function continueFromReview(session) {
  if (session.view !== 'wave-review' || !session.review || session.review.fired) return { ok: false };
  const result = applyAction(session.sim, { type: 'continue-wave' });
  session.view = 'running';
  session.review = null;
  return result;
}

/** Retry after being fired: rebuild the level from its start with the score it began with. */
export function retryLevel(session) {
  beginLevel(session);
}

/** Move on from the level summary: the next level's briefing, or the session summary. */
export function nextLevel(session) {
  session.highScore = Math.max(session.highScore, session.score);
  if (session.levelIndex + 1 >= session.doc.levels.length) {
    session.view = 'session-summary';
    return;
  }
  session.levelIndex += 1;
  session.level = session.doc.levels[session.levelIndex];
  session.summary = null;
  session.review = null;
  session.view = 'briefing';
}

export function requestRestart(session) {
  session.confirmingRestart = true;
}

export function cancelRestart(session) {
  session.confirmingRestart = false;
}

/** Clear the session and return to the Level 1 briefing. The high score survives for this page. */
export function confirmRestart(session) {
  session.highScore = Math.max(session.highScore, session.score);
  session.confirmingRestart = false;
  session.levelIndex = 0;
  session.level = session.doc.levels[0];
  session.score = 0;
  session.scoreAtLevelStart = 0;
  session.sim = null;
  session.review = null;
  session.summary = null;
  session.selectedZone = null;
  session.selectedTicket = null;
  session.tool = null;
  session.choice = {};
  session.notes = {};
  session.view = 'briefing';
}
