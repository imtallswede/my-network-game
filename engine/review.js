// Wave review: pass or fire, and the score for the wave. Pure; reads a sim at wave end.
// Comparisons use unrounded values (FR-013). Exactly 70.0% and exactly 900 steps pass.

import { causesFor, CAUSES } from './rules.js';

const firstCause = (set) => CAUSES.find((c) => set.has(c)) || null;

export function reviewWave(sim) {
  const { constants, level, model } = sim;
  const campus = model.campus;
  const live = sim.tickets.filter((t) => t.status === 'open' || t.status === 'diagnosed');
  let oldest = null;
  for (const tk of live) {
    const age = sim.step - tk.openedStep;
    if (oldest === null || age > oldest.age) oldest = { age, tk };
  }
  const oldestAge = oldest ? oldest.age : 0;

  let firedBy = null;
  if (campus.satisfactionPct < constants.fireSatisfactionPct) {
    // Name the network cause of the worst-served zone that has users.
    let worst = null;
    for (const z of model.zones) {
      if (z.demandMbps > 0 && (worst === null || z.satisfactionPct < worst.satisfactionPct)) worst = z;
    }
    firedBy = {
      metric: 'satisfaction',
      value: campus.satisfactionPct,
      threshold: constants.fireSatisfactionPct,
      cause: worst ? firstCause(causesFor(worst.id, model)) : null,
    };
  } else if (oldestAge > constants.fireTicketAgeSteps) {
    firedBy = {
      metric: 'ticket-age',
      value: oldestAge,
      threshold: constants.fireTicketAgeSteps,
      cause: firstCause(causesFor(oldest.tk.zoneId, model)) || oldest.tk.causesAtOpen[0] || null,
    };
  }
  const fired = firedBy !== null;

  const finalWave = sim.waveIndex >= level.waves.length;
  const wavePoints = Math.round(campus.satisfactionPct);
  const diagnosisPoints = sim.diagnosisPoints;
  const budgetBonus = finalWave && !fired ? Math.floor(sim.budget / 100) : 0;
  return {
    wave: sim.waveIndex,
    finalWave,
    satisfactionPct: campus.satisfactionPct,
    deliveredMbps: campus.deliveredMbps,
    demandedMbps: campus.demandMbps,
    oldestTicketAgeSteps: oldestAge,
    fired,
    firedBy,
    score: { wavePoints, diagnosisPoints, budgetBonus, total: wavePoints + diagnosisPoints + budgetBonus },
    nextPreview: finalWave ? null : level.waves[sim.waveIndex].previewText,
  };
}
