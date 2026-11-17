// Fixed-step simulation for Campus Connect. Pure: no DOM, timers, or randomness.
//
// Time advances ONLY in step(), one fixed 0.1 s step at a time, so the same level and the same
// (step, action) log always give the same result (constitution Principle V, research R4/R5).
// Callers (the game loop) decide how many steps to run; pausing simply means not stepping, and
// step() refuses to advance while paused as a second guard.
//
// Phases: ready (before the first resume) -> running -> wave-end -> (continue) running ... level-end.

import { cellId } from './geometry.js';
import { computeModel, listZones, causesFor, evaluateDiagnosis } from './rules.js';
import { zoneLabel } from './feedback.js';

export function createSim(level, constants) {
  const zones = listZones(level);
  const sim = {
    level,
    constants,
    zoneIds: new Set(zones.map((z) => z.id)),
    step: 0,
    paused: true,
    speed: 1,
    autoPause: true, // pause when a ticket opens (FR-022); wave ends always pause
    phase: 'ready',
    waveIndex: 0,
    waveStep: 0,
    equipment: { aps: [], uplinks: [] },
    nextApId: 1,
    nextUplinkId: 1,
    users: [],
    nextUserId: 1,
    pending: [],
    budget: level.budget,
    tickets: [],
    nextTicketId: 1,
    zoneBelow: new Map(), // zoneId -> consecutive steps below 100% satisfaction
    diagnosisPoints: 0,
    lastChange: null, // last successful equipment action, used to explain resolved-by-change
    actionLog: [],
    model: null,
  };

  // Starting equipment is paid for from the budget (validated by engine/content.js).
  const eq = level.startingEquipment || { aps: [], uplinks: [] };
  let spent = 0;
  for (const a of eq.aps || []) {
    const id = a.id ?? sim.nextApId;
    sim.equipment.aps.push({ id, cell: [...a.cell], channel: a.channel, paid: constants.prices.ap });
    sim.nextApId = Math.max(sim.nextApId, id + 1);
    spent += constants.prices.ap;
  }
  for (const b of level.map.buildings) {
    for (const capacityMbps of b.startingUplinks || []) {
      sim.equipment.uplinks.push({
        id: sim.nextUplinkId, buildingId: b.id, capacityMbps, state: 'working', paid: 0, preinstalled: true,
      });
      sim.nextUplinkId += 1;
    }
  }
  for (const u of eq.uplinks || []) {
    const price = uplinkPrice(constants, u.capacityMbps);
    sim.equipment.uplinks.push({
      id: sim.nextUplinkId, buildingId: u.buildingId, capacityMbps: u.capacityMbps, state: 'working', paid: price, preinstalled: false,
    });
    sim.nextUplinkId += 1;
    spent += price;
  }
  sim.budget = level.budget - spent;
  recompute(sim);
  return sim;
}

function uplinkPrice(constants, capacityMbps) {
  return capacityMbps === 1000 ? constants.prices.uplink1000 : constants.prices.uplink100;
}

export function recompute(sim) {
  sim.model = computeModel(sim.level, sim.constants, sim.equipment, sim.users);
}

// ---- Waves and arrivals -------------------------------------------------------------------

/** Users of a wave: user i of N arrives at step round(i * waveSteps / N), zones round-robin. */
function expandArrivals(sim, wave) {
  const out = [];
  let order = 0;
  for (const a of wave.arrivals) {
    for (let i = 0; i < a.count; i += 1) {
      out.push({
        type: a.userType,
        zoneId: cellId(a.zones[i % a.zones.length]),
        arrivalStep: Math.round((i * sim.constants.waveSteps) / a.count),
        order: order++,
      });
    }
  }
  return out.sort((x, y) => x.arrivalStep - y.arrivalStep || x.order - y.order);
}

function processArrivals(sim) {
  while (sim.pending.length && sim.pending[0].arrivalStep <= sim.waveStep) {
    const p = sim.pending.shift();
    sim.users.push({ id: sim.nextUserId, type: p.type, zoneId: p.zoneId });
    sim.nextUserId += 1;
  }
}

function startWave(sim, index) {
  sim.waveIndex = index;
  sim.waveStep = 0;
  sim.users = []; // the previous wave's users leave when the next wave starts
  sim.pending = expandArrivals(sim, sim.level.waves[index - 1]);
  sim.phase = 'running';
  processArrivals(sim);
  recompute(sim);
}

/** Advance exactly one 0.1 s step. Returns the events that happened. */
export function step(sim) {
  if (sim.paused || sim.phase !== 'running') return [];
  const events = [];
  sim.step += 1;
  sim.waveStep += 1;
  processArrivals(sim);
  recompute(sim);
  updateTickets(sim, events);
  if (sim.autoPause && events.some((e) => e.type === 'ticket-opened')) sim.paused = true;
  if (sim.waveStep >= sim.constants.waveSteps) {
    sim.phase = 'wave-end';
    sim.paused = true;
    events.push({ type: 'wave-ended', wave: sim.waveIndex, step: sim.step });
  }
  return events;
}

// ---- Tickets ------------------------------------------------------------------------------

const EPS_PCT = 1e-9;
const isFullyServed = (z) => z.satisfactionPct >= 100 - EPS_PCT;
const isOpenish = (tk) => tk.status === 'open' || tk.status === 'diagnosed';

/** Zone counters, ticket opening, and auto-close. Aging is derived: age = step - openedStep. */
function updateTickets(sim, events) {
  const { constants } = sim;
  const byZone = new Map(sim.model.zones.map((z) => [z.id, z]));
  // Auto-close first: a ticket whose zone is fully served leaves the queue.
  for (const tk of sim.tickets) {
    if (!isOpenish(tk)) continue;
    if (!isFullyServed(byZone.get(tk.zoneId))) continue;
    if (tk.status === 'diagnosed') {
      tk.status = 'closed';
      tk.closedStep = sim.step;
      events.push({ type: 'ticket-closed', ticketId: tk.id, zoneId: tk.zoneId, step: sim.step });
    } else {
      tk.status = 'resolved-by-change';
      tk.closedStep = sim.step;
      tk.resolution = { step: sim.step, action: sim.lastChange ? structuredClone(sim.lastChange.action) : null };
      events.push({ type: 'ticket-resolved-by-change', ticketId: tk.id, zoneId: tk.zoneId, step: sim.step });
    }
  }
  // Counters and opening, in zone order.
  for (const z of sim.model.zones) {
    if (isFullyServed(z)) {
      sim.zoneBelow.set(z.id, 0);
      continue;
    }
    const n = (sim.zoneBelow.get(z.id) || 0) + 1;
    sim.zoneBelow.set(z.id, n);
    if (n >= constants.ticketOpenSteps && !sim.tickets.some((tk) => tk.zoneId === z.id && isOpenish(tk))) {
      const tk = {
        id: sim.nextTicketId,
        zoneId: z.id,
        openedStep: sim.step,
        status: 'open',
        causesAtOpen: [...causesFor(z.id, sim.model)],
        attempts: 0,
        assistance: 'none',
        hintLevel: 0,
        awardedPoints: 0,
        closedStep: null,
        resolution: null,
      };
      sim.nextTicketId += 1;
      sim.tickets.push(tk);
      events.push({ type: 'ticket-opened', ticketId: tk.id, zoneId: z.id, step: sim.step });
    }
  }
}

// ---- Player actions -----------------------------------------------------------------------

const refuse = (reason, extra = {}) => ({ ok: false, reason, ...extra });

function assignChannel(sim) {
  const mode = sim.level.channelMode;
  if (mode.type !== 'locked') return 1;
  const used = new Set(sim.equipment.aps.map((a) => a.channel));
  const free = mode.channels.find((c) => !used.has(c));
  return free ?? mode.channels[sim.equipment.aps.length % mode.channels.length];
}

function hasAmbiguousPath(sim) {
  return computeModel(sim.level, sim.constants, sim.equipment, sim.users).contentErrors.length > 0;
}

const EQUIPMENT_ACTIONS = new Set(['place-ap', 'move-ap', 'remove-ap', 'set-channel', 'buy-uplink', 'upgrade-uplink', 'remove-uplink']);

export function applyAction(sim, action) {
  const result = doAction(sim, action);
  if (result.ok && EQUIPMENT_ACTIONS.has(action.type)) sim.lastChange = { step: sim.step, action: structuredClone(action) };
  sim.actionLog.push({ step: sim.step, action: structuredClone(action) });
  return result;
}

function doAction(sim, action) {
  const { constants, level } = sim;
  switch (action.type) {
    case 'place-ap': {
      const id = cellId(action.cell);
      if (!sim.zoneIds.has(id)) return refuse('invalid-cell');
      if (sim.equipment.aps.some((a) => cellId(a.cell) === id)) return refuse('occupied');
      if (sim.equipment.aps.length >= level.apLimit) return refuse('over-limit', { limit: level.apLimit });
      const cost = constants.prices.ap;
      if (cost > sim.budget) return refuse('over-budget', { cost, remaining: sim.budget });
      const ap = { id: sim.nextApId, cell: [...action.cell], channel: assignChannel(sim), paid: cost };
      sim.equipment.aps.push(ap);
      if (hasAmbiguousPath(sim)) {
        sim.equipment.aps.pop();
        return refuse('ambiguous-path');
      }
      sim.nextApId += 1;
      sim.budget -= cost;
      recompute(sim);
      return { ok: true, id: ap.id, channel: ap.channel, cost };
    }
    case 'move-ap': {
      const ap = sim.equipment.aps.find((a) => a.id === action.id);
      if (!ap) return refuse('unknown-ap');
      const id = cellId(action.cell);
      if (!sim.zoneIds.has(id)) return refuse('invalid-cell');
      if (sim.equipment.aps.some((a) => a.id !== ap.id && cellId(a.cell) === id)) return refuse('occupied');
      const old = ap.cell;
      ap.cell = [...action.cell];
      if (hasAmbiguousPath(sim)) {
        ap.cell = old;
        return refuse('ambiguous-path');
      }
      recompute(sim);
      return { ok: true, id: ap.id };
    }
    case 'remove-ap': {
      const i = sim.equipment.aps.findIndex((a) => a.id === action.id);
      if (i < 0) return refuse('unknown-ap');
      const [ap] = sim.equipment.aps.splice(i, 1);
      sim.budget += ap.paid;
      recompute(sim);
      return { ok: true, id: ap.id, refund: ap.paid };
    }
    case 'set-channel': {
      if (level.channelMode.type === 'locked') return refuse('channels-locked');
      const ap = sim.equipment.aps.find((a) => a.id === action.id);
      if (!ap) return refuse('unknown-ap');
      const [lo, hi] = constants.channelRange;
      if (!Number.isInteger(action.channel) || action.channel < lo || action.channel > hi) return refuse('invalid-channel');
      ap.channel = action.channel;
      recompute(sim);
      return { ok: true, id: ap.id, channel: ap.channel };
    }
    case 'buy-uplink': {
      if (!level.map.buildings.some((b) => b.id === action.buildingId)) return refuse('unknown-building');
      if (!constants.uplinkCapacityMbps.includes(action.capacityMbps)) return refuse('invalid-capacity');
      const cost = uplinkPrice(constants, action.capacityMbps);
      if (cost > sim.budget) return refuse('over-budget', { cost, remaining: sim.budget });
      const up = {
        id: sim.nextUplinkId, buildingId: action.buildingId, capacityMbps: action.capacityMbps, state: 'working', paid: cost, preinstalled: false,
      };
      sim.nextUplinkId += 1;
      sim.equipment.uplinks.push(up);
      sim.budget -= cost;
      recompute(sim);
      return { ok: true, id: up.id, cost };
    }
    case 'upgrade-uplink': {
      const up = sim.equipment.uplinks.find((u) => u.id === action.id);
      if (!up) return refuse('unknown-uplink');
      if (up.state !== 'working') return refuse('uplink-failed');
      if (up.capacityMbps >= 1000) return refuse('already-max');
      const cost = constants.prices.uplink1000 - constants.prices.uplink100;
      if (cost > sim.budget) return refuse('over-budget', { cost, remaining: sim.budget });
      up.capacityMbps = 1000;
      up.paid += cost;
      sim.budget -= cost;
      recompute(sim);
      return { ok: true, id: up.id, cost };
    }
    case 'remove-uplink': {
      const i = sim.equipment.uplinks.findIndex((u) => u.id === action.id);
      if (i < 0) return refuse('unknown-uplink');
      if (sim.equipment.uplinks[i].preinstalled) return refuse('preinstalled');
      const [up] = sim.equipment.uplinks.splice(i, 1);
      sim.budget += up.paid;
      recompute(sim);
      return { ok: true, id: up.id, refund: up.paid };
    }
    case 'submit-diagnosis': {
      const tk = sim.tickets.find((x) => x.id === action.ticketId);
      if (!tk) return refuse('unknown-ticket');
      if (tk.status === 'diagnosed') return refuse('already-diagnosed');
      if (tk.status !== 'open') return refuse('ticket-not-open');
      const evaluation = evaluateDiagnosis(tk.zoneId, action.choice, sim.model);
      if (evaluation.status === 'invalid-input') return refuse('invalid-input');
      if (evaluation.status === 'content-error') return refuse('content-error');
      tk.attempts += 1;
      if (evaluation.status === 'correct') {
        tk.status = 'diagnosed';
        tk.awardedPoints = constants.pointsPerDiagnosis;
        sim.diagnosisPoints += constants.pointsPerDiagnosis;
      }
      return { ok: true, evaluation, zoneLabel: zoneLabel(tk.zoneId.split(',').map(Number)), ticketId: tk.id };
    }
    case 'request-hint': {
      const tk = sim.tickets.find((x) => x.id === action.ticketId);
      if (!tk) return refuse('unknown-ticket');
      if (tk.status !== 'open') return refuse('ticket-not-open');
      tk.hintLevel = Math.min(2, tk.hintLevel + 1);
      tk.assistance = tk.hintLevel === 1 ? 'hint' : 'worked-solution';
      return { ok: true, hintLevel: tk.hintLevel, ticketId: tk.id };
    }
    case 'set-paused': {
      if (action.paused) {
        sim.paused = true;
        return { ok: true };
      }
      if (sim.phase === 'wave-end' || sim.phase === 'level-end') return refuse('awaiting-continue');
      if (sim.phase === 'ready') startWave(sim, 1);
      sim.paused = false;
      return { ok: true };
    }
    case 'set-autopause': {
      sim.autoPause = Boolean(action.on);
      return { ok: true };
    }
    case 'set-speed': {
      if (action.speed !== 1 && action.speed !== 2) return refuse('invalid-speed');
      sim.speed = action.speed;
      return { ok: true };
    }
    case 'continue-wave': {
      if (sim.phase !== 'wave-end') return refuse('not-at-wave-end');
      if (sim.waveIndex >= level.waves.length) {
        sim.phase = 'level-end';
        return { ok: true, levelEnd: true };
      }
      startWave(sim, sim.waveIndex + 1);
      sim.paused = false;
      return { ok: true, wave: sim.waveIndex };
    }
    default:
      return refuse('unknown-action');
  }
}

// ---- Replay and fingerprint (used by determinism tests) -----------------------------------

/** Re-run a (step, action) log on a fresh sim until `totalSteps` steps have elapsed. */
export function replay(level, constants, log, totalSteps) {
  const sim = createSim(level, constants);
  let i = 0;
  for (;;) {
    while (i < log.length && log[i].step === sim.step) {
      applyAction(sim, log[i].action);
      i += 1;
    }
    if (sim.step >= totalSteps || sim.phase === 'wave-end' || sim.phase === 'level-end') break;
    if (sim.paused && !(i < log.length && log[i].step === sim.step)) break;
    step(sim);
  }
  return sim;
}

export function fingerprint(sim) {
  return JSON.stringify({
    step: sim.step,
    waveIndex: sim.waveIndex,
    waveStep: sim.waveStep,
    phase: sim.phase,
    paused: sim.paused,
    speed: sim.speed,
    autoPause: sim.autoPause,
    budget: sim.budget,
    aps: sim.equipment.aps,
    uplinks: sim.equipment.uplinks,
    users: sim.users,
    tickets: sim.tickets,
    diagnosisPoints: sim.diagnosisPoints,
    campus: sim.model.campus,
  });
}
