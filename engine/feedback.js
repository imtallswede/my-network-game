// Player-facing text built from engine results. No DOM. Rounding for display happens here and
// never feeds back into grading (spec FR-013).

const money = (n) => `$${n.toLocaleString('en-US')}`;

/** Human label for a zone cell: column letter plus row number, e.g. [4,2] -> "E3". */
export function zoneLabel(cell) {
  return `${String.fromCharCode(65 + cell[0])}${cell[1] + 1}`;
}

export function formatDbm(rssi) {
  if (rssi === null || rssi === undefined || rssi === -Infinity) return '—';
  return `${(Math.round(rssi * 10) / 10).toFixed(1).replace('-', '−')} dBm`;
}

export function formatPct(p) {
  if (p === null || p === undefined) return '—';
  if (p === Infinity) return '∞%';
  return `${Math.round(p)}%`;
}

export function formatClock(steps) {
  const s = Math.floor(steps / 10);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

/** Text for the result of a sim action, suitable for the live region. */
export function describeAction(result, action, sim) {
  if (result.ok) {
    switch (action.type) {
      case 'place-ap':
        return `AP ${result.id} placed at zone ${zoneLabel(action.cell)} on channel ${result.channel}. ${money(result.cost)} spent, ${money(sim.budget)} left.`;
      case 'move-ap':
        return `AP ${result.id} moved to zone ${zoneLabel(action.cell)}.`;
      case 'remove-ap':
        return `AP ${result.id} removed. ${money(result.refund)} refunded, ${money(sim.budget)} left.`;
      case 'set-channel':
        return `AP ${result.id} is now on channel ${result.channel}.`;
      case 'buy-uplink':
        return `Uplink bought for ${money(result.cost)}. ${money(sim.budget)} left.`;
      case 'upgrade-uplink':
        return `Uplink upgraded to 1 Gbps for ${money(result.cost)}. ${money(sim.budget)} left.`;
      case 'remove-uplink':
        return `Uplink removed. ${money(result.refund)} refunded, ${money(sim.budget)} left.`;
      case 'set-paused':
        return action.paused ? 'Paused. You can still build and inspect.' : 'Running.';
      case 'set-speed':
        return `Speed ${action.speed}×.`;
      case 'submit-diagnosis': {
        const e = explain(result.evaluation, { zoneLabel: result.zoneLabel });
        return `${e.headline} ${e.body} ${e.nextStep}`;
      }
      case 'request-hint':
        return `${result.hintLevel === 1 ? 'Hint' : 'Worked solution'}: ${hintText(sim.level, result.hintLevel)}`;
      case 'continue-wave':
        return result.levelEnd ? 'All waves finished.' : `Wave ${result.wave} started.`;
      default:
        return '';
    }
  }
  switch (result.reason) {
    case 'over-budget':
      return `Cannot buy that: it costs ${money(result.cost)} but only ${money(result.remaining)} is left. Nothing changed.`;
    case 'over-limit':
      return `Cannot place another AP: this level allows at most ${result.limit}.`;
    case 'invalid-cell':
      return 'APs go inside a building. Pick a zone on the floor of the building.';
    case 'occupied':
      return 'There is already an AP in that zone.';
    case 'ambiguous-path':
      return 'Content error: a signal path from that spot passes exactly through a wall corner, so it cannot be graded. Pick another zone.';
    case 'channels-locked':
      return 'Channels are assigned automatically in this level.';
    case 'invalid-channel':
      return 'Channels run from 1 to 11.';
    case 'preinstalled':
      return 'That uplink came with the building and cannot be removed.';
    case 'already-max':
      return 'That uplink is already 1 Gbps.';
    case 'uplink-failed':
      return 'That uplink has failed and cannot be upgraded.';
    case 'invalid-input':
      return 'Choose one of the five causes first, then press Submit. This did not count as an attempt.';
    case 'already-diagnosed':
      return 'This ticket is already diagnosed. Fix the network and it will close. No points were added.';
    case 'ticket-not-open':
      return 'That ticket is no longer open.';
    case 'unknown-ticket':
      return 'That ticket does not exist.';
    case 'content-error':
      return 'Content error: this zone cannot be graded because the level data has a problem.';
    case 'awaiting-continue':
      return 'The wave is over. Continue to the next wave when you are ready.';
    default:
      return `That action was not possible (${result.reason}).`;
  }
}

// ---- Diagnosis explanations -----------------------------------------------------------------

export const CAUSE_LABEL = {
  'uplink-down': 'Uplink down',
  'weak-signal': 'Weak signal',
  'channel-interference': 'Channel interference',
  'uplink-congested': 'Uplink congested',
  'ap-overloaded': 'AP overloaded',
};

const mbps = (n) => `${Math.round(n * 10) / 10} Mbps`;
const pct1 = (p) => `${(Math.round(p * 10) / 10).toFixed(1)}%`;

/** One sentence stating the values that make a cause true (or false) for this zone. */
function evidenceLine(cause, ev, zone) {
  const apName = ev.apId ? `AP ${ev.apId}` : 'no AP';
  switch (cause) {
    case 'weak-signal':
      return ev.covered
        ? `Zone ${zone} has a signal of ${formatDbm(ev.rssiDbm)}, which meets the ${formatDbm(ev.thresholdDbm)} coverage threshold, so the signal is not the problem.`
        : `Zone ${zone} has a signal of ${formatDbm(ev.rssiDbm)}, below the ${formatDbm(ev.thresholdDbm)} coverage threshold, so users there get nothing.`;
    case 'ap-overloaded': {
      if (!ev.apId) return `Zone ${zone} is served by no AP.`;
      const over = ev.apDemandMbps > ev.apCapacityMbps;
      return over
        ? `${apName} is asked for ${mbps(ev.apDemandMbps)} but can carry ${mbps(ev.apCapacityMbps)} (${formatPct(ev.apUtilizationPct)} of capacity).`
        : `${apName} carries ${mbps(ev.apDemandMbps)} of its ${mbps(ev.apCapacityMbps)} (${formatPct(ev.apUtilizationPct)}), so it is not overloaded.`;
    }
    case 'channel-interference': {
      if (!ev.apId) return `Zone ${zone} is served by no AP.`;
      if (ev.apConflictsWith.length === 0) return `${apName} has no channel conflicts, so interference is not the problem.`;
      const others = ev.apConflictsWith.map((i) => `AP ${i}`).join(', ');
      return ev.apUtilizationPct > 100
        ? `${apName} shares airtime with ${others}, which cuts its capacity to ${mbps(ev.apEffectiveCapacityMbps)}; its demand of ${mbps(ev.apDemandMbps)} is ${formatPct(ev.apUtilizationPct)} of that.`
        : `${apName} conflicts with ${others}, but at ${formatPct(ev.apUtilizationPct)} of its reduced ${mbps(ev.apEffectiveCapacityMbps)} it still keeps up.`;
    }
    case 'uplink-congested':
      if (ev.uplinkDown) return 'The building has no working uplink, so there is no uplink load to compare.';
      return ev.uplinkUtilizationPct > 100
        ? `The building's users send ${mbps(ev.uplinkTrafficMbps)} through a ${mbps(ev.uplinkCapacityMbps)} uplink (${formatPct(ev.uplinkUtilizationPct)}), so each user gets ${pct1(ev.sharePct)} of their demand.`
        : `The building's uplink carries ${mbps(ev.uplinkTrafficMbps)} of ${mbps(ev.uplinkCapacityMbps)} (${formatPct(ev.uplinkUtilizationPct)}), so it is not congested.`;
    case 'uplink-down':
      return ev.uplinkDown
        ? 'The building has no working uplink, so every user in it gets 0 Mbps.'
        : `The building still has a working uplink (${mbps(ev.uplinkCapacityMbps)}).`;
    default:
      return '';
  }
}

const FIX_HINT = {
  'uplink-down': 'Restore connectivity first: buy another uplink for the building.',
  'weak-signal': 'Move or add an AP closer to the zone.',
  'channel-interference': 'Give nearby APs channels at least 5 apart (1, 6 and 11).',
  'uplink-congested': 'Upgrade or add an uplink so it can carry the total traffic.',
  'ap-overloaded': 'Add an AP nearby so users spread over more than one.',
};

// Where to look after ruling a cause out: signal, then the AP, then the uplink.
const NEXT_AFTER = {
  'uplink-down': "Next, check the zone's signal strength.",
  'weak-signal': "Next, check the serving AP's load, then the uplink.",
  'channel-interference': 'Next, check how loaded the AP is, then look upstream at the uplink.',
  'ap-overloaded': "The AP is not the limit, so look upstream: check the building's uplink.",
  'uplink-congested': 'The uplink is not the limit, so look back at the signal and the AP.',
};

/**
 * Turn an evaluateDiagnosis() result into player-facing text.
 * ctx: { zoneLabel }. Rounding happens here only.
 */
export function explain(result, ctx = {}) {
  const zone = ctx.zoneLabel || 'this zone';
  const ev = result.evidence;
  if (result.status === 'invalid-input') {
    return { headline: 'Choose a cause first.', body: 'Pick one of the five causes, then press Submit. This did not count as an attempt.', nextStep: 'Compare the signal, then the AP, then the uplink.' };
  }
  if (result.status === 'content-error') {
    return { headline: 'This zone cannot be graded.', body: 'The level data has an error, so no diagnosis was graded.', nextStep: 'Tell the level author.' };
  }
  const [kind, cause] = result.reasonCode.split(':');
  const label = CAUSE_LABEL[cause];
  if (kind === 'accepted') {
    const lines = [evidenceLine(cause, ev, zone)];
    const others = result.trueCauses.filter((c) => c !== cause);
    if (others.length) {
      lines.push(`More than one cause is true here. In fix order: ${result.trueCauses.map((c) => CAUSE_LABEL[c]).join(', ')}.`);
      for (const c of others) lines.push(evidenceLine(c, ev, zone));
    }
    return {
      headline: `Correct: ${label}. +25 points.`,
      body: lines.join(' '),
      nextStep: result.trueCauses.map((c) => FIX_HINT[c]).join(' '),
    };
  }
  return {
    headline: `Not ${label}.`,
    body: evidenceLine(cause, ev, zone),
    nextStep: NEXT_AFTER[cause],
  };
}

// ---- Tickets and hints ----------------------------------------------------------------------

/** { title, complaint } for a ticket, from level data with a generic fallback. */
export function ticketText(level, ticket) {
  const found = (level.tickets || []).find((x) => `${x.zone[0]},${x.zone[1]}` === ticket.zoneId);
  const [c, r] = ticket.zoneId.split(',').map(Number);
  return found
    ? { title: found.title, complaint: found.complaint }
    : { title: `Zone ${zoneLabel([c, r])}`, complaint: 'The Wi-Fi here is not working well.' };
}

/** Hint text for hint level 1 (method) or 2 (worked solution). */
export function hintText(level, hintLevel) {
  const h = level.hints || {};
  if (hintLevel === 1) return h.method || 'Compare the signal, then the AP, then the uplink.';
  return h.worked || "Check each cause in turn against the zone's numbers.";
}

const ACTION_NAME = {
  'place-ap': 'placing an AP',
  'move-ap': 'moving an AP',
  'remove-ap': 'removing an AP',
  'set-channel': 'changing a channel',
  'buy-uplink': 'buying an uplink',
  'upgrade-uplink': 'upgrading an uplink',
  'remove-uplink': 'removing an uplink',
};

/** Message for a ticket that has left the queue. */
export function describeResolution(ticket, level) {
  const { title } = ticketText(level, ticket);
  if (ticket.status === 'closed') return `${title}: ticket closed, the zone is fully served.`;
  const causes = ticket.causesAtOpen.map((c) => CAUSE_LABEL[c]).join(', ') || 'no single cause';
  const act = ticket.resolution && ticket.resolution.action;
  const what = (act && ACTION_NAME[act.type]) || 'a network change';
  return `${title}: resolved by a network change. When it opened the cause was ${causes}; ${what} fixed it. No diagnosis points.`;
}

// ---- Zone rows (shared by the map, the zone table and the tests) -----------------------------

/** One row per zone. The map cell names, the details panel and the zone table all read these. */
export function zoneRows(model) {
  return model.zones.map((z) => {
    const ap = z.servingApId ? model.aps.find((a) => a.id === z.servingApId) : null;
    const building = model.buildings.find((b) => b.id === z.buildingId);
    const flags = [];
    if (!z.covered) flags.push('no signal');
    if (building && building.down) flags.push('uplink down');
    if (ap && ap.conflictsWith.length > 0) flags.push('channel conflict');
    if (ap && ap.overloaded && z.users > 0) flags.push('AP overloaded');
    if (building && building.congested && z.users > 0) flags.push('uplink congested');
    const row = {
      id: z.id,
      label: zoneLabel(z.cell),
      rssi: formatDbm(z.rssiDbm),
      covered: z.covered ? 'Covered' : 'Not covered',
      servingAp: ap ? `AP ${ap.id}` : 'none',
      channel: ap ? String(ap.channel) : '—',
      users: z.users,
      apUtil: formatPct(z.apUtilizationPct),
      uplinkUtil: formatPct(z.uplinkUtilizationPct),
      flags,
    };
    row.name = `Zone ${row.label}: signal ${row.rssi}, ${row.covered}, served by ${row.servingAp}${ap ? ` on channel ${row.channel}` : ''}, ${z.users} ${z.users === 1 ? 'user' : 'users'}${flags.length ? `, ${flags.join(', ')}` : ''}`;
    return row;
  });
}
