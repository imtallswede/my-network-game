// Pure domain rules for Campus Connect. No DOM, timers, network, or randomness.
// Pipeline order follows specs/001-campus-connect-playable/research.md R9:
//   1 RSSI per AP/zone   2 serving AP + covered   3 conflicts + effective capacity
//   4 AP demand          5 AP delivery            6 building traffic + uplink capacity
//   7 building scale     8 zone and campus delivered Mbps and satisfaction
// Grading uses unrounded values (FR-013). Utilization "> 100%" tests use integer arithmetic
// wherever the inputs are integers, so exactly 100% is never congested.

import { cellId, distanceM, wallPath } from './geometry.js';

const EPS = 1e-9;

/** All zones of a level: { id, cell, buildingId }. */
export function listZones(level) {
  const zones = [];
  for (const b of level.map.buildings) {
    for (const cell of b.zones) zones.push({ id: cellId(cell), cell, buildingId: b.id });
  }
  return zones;
}

/**
 * RSSI in dBm between an AP cell and a zone cell, or { ambiguous: true } when the signal path
 * passes exactly through a wall endpoint (content error, never graded).
 */
export function pathRssi(apCell, zoneCell, level, constants) {
  const { crossed, ambiguous } = wallPath(apCell, zoneCell, level.map.walls || []);
  if (ambiguous) return { ambiguous: true, rssi: -Infinity };
  const d = distanceM(apCell, zoneCell, constants.minDistanceM);
  let wallLoss = 0;
  for (const w of crossed) wallLoss += constants.wallLossDb[w.type];
  const rssi =
    constants.eirpDbm - constants.pl1mDb - 10 * constants.pathLossExponent * Math.log10(d) - wallLoss;
  return { ambiguous: false, rssi };
}

/** Convenience wrapper returning a number; throws for ambiguous paths. */
export function rssiDbm(apCell, zoneCell, level, constants) {
  const r = pathRssi(apCell, zoneCell, level, constants);
  if (r.ambiguous) {
    const err = new Error(`signal path ${cellId(apCell)} -> ${cellId(zoneCell)} passes through a wall corner`);
    err.code = 'PATH_AMBIGUOUS';
    throw err;
  }
  return r.rssi;
}

export function computeModel(level, constants, equipment, users) {
  const contentErrors = [];
  const zones = listZones(level);
  const zoneById = new Map(zones.map((z) => [z.id, z]));
  const aps = [...equipment.aps].sort((a, b) => a.id - b.id);

  // AP -> building (the building containing the AP's cell). Its traffic uses that building's uplinks.
  const apBuilding = new Map();
  for (const ap of aps) {
    const z = zoneById.get(cellId(ap.cell));
    if (!z) {
      contentErrors.push({ code: 'AP_OUTSIDE_BUILDING', apId: ap.id, message: `AP ${ap.id} is not in a building zone` });
      apBuilding.set(ap.id, null);
    } else {
      apBuilding.set(ap.id, z.buildingId);
    }
  }

  // 1. RSSI per AP/zone (cached by cell pair).
  const cache = new Map();
  function rssiAt(apCell, cell, apId) {
    const key = `${cellId(apCell)}|${cellId(cell)}`;
    if (!cache.has(key)) {
      const r = pathRssi(apCell, cell, level, constants);
      if (r.ambiguous) {
        contentErrors.push({
          code: 'PATH_AMBIGUOUS',
          apId,
          message: `Signal path from ${cellId(apCell)} to ${cellId(cell)} passes through a wall corner`,
        });
      }
      cache.set(key, r.rssi);
    }
    return cache.get(key);
  }

  // 3. Conflicts and effective capacity (computed before demand so capacity is known).
  const conflicts = new Map(aps.map((a) => [a.id, []]));
  for (let i = 0; i < aps.length; i += 1) {
    for (let j = i + 1; j < aps.length; j += 1) {
      const a = aps[i];
      const b = aps[j];
      const hearsAB = rssiAt(a.cell, b.cell, a.id) >= constants.ccaThresholdDbm;
      const hearsBA = rssiAt(b.cell, a.cell, b.id) >= constants.ccaThresholdDbm;
      const overlap = Math.abs(a.channel - b.channel) <= constants.conflictChannelDelta;
      if (hearsAB && hearsBA && overlap) {
        conflicts.get(a.id).push(b.id);
        conflicts.get(b.id).push(a.id);
      }
    }
  }

  // Users grouped by zone.
  const usersByZone = new Map(zones.map((z) => [z.id, []]));
  for (const u of users) {
    if (!usersByZone.has(u.zoneId)) {
      contentErrors.push({ code: 'USER_ZONE_UNKNOWN', userId: u.id, message: `User ${u.id} is in unknown zone ${u.zoneId}` });
      continue;
    }
    usersByZone.get(u.zoneId).push(u);
  }
  const demandOf = (u) => constants.demandMbps[u.type];

  // 2. Serving AP and covered flag per zone.
  const zoneServing = new Map();
  for (const z of zones) {
    let best = null;
    for (const ap of aps) {
      const r = rssiAt(ap.cell, z.cell, ap.id);
      if (best === null || r > best.rssi + EPS) best = { apId: ap.id, rssi: r };
      // ties (within EPS) keep the lowest AP id because aps are sorted by id
    }
    const rssi = best ? best.rssi : -Infinity;
    zoneServing.set(z.id, {
      apId: best && rssi > -Infinity ? best.apId : null,
      rssi,
      covered: best !== null && rssi >= constants.coverageThresholdDbm,
    });
  }

  // 4. AP demand: users in covered zones served by that AP.
  const apDemand = new Map(aps.map((a) => [a.id, 0]));
  for (const z of zones) {
    const s = zoneServing.get(z.id);
    if (!s.covered) continue;
    for (const u of usersByZone.get(z.id)) apDemand.set(s.apId, apDemand.get(s.apId) + demandOf(u));
  }

  // 5. AP results: utilization, overload, delivery.
  const apResults = aps.map((ap) => {
    const k = conflicts.get(ap.id).length;
    const demand = apDemand.get(ap.id);
    const effCap = constants.apCapacityMbps / (1 + k);
    const overloaded = demand * (1 + k) > constants.apCapacityMbps; // exact for integer demand
    const delivered = overloaded ? effCap : demand;
    return {
      id: ap.id,
      cell: ap.cell,
      channel: ap.channel,
      buildingId: apBuilding.get(ap.id),
      conflictsWith: [...conflicts.get(ap.id)],
      capacityMbps: constants.apCapacityMbps,
      effectiveCapacityMbps: effCap,
      demandMbps: demand,
      deliveredMbps: delivered,
      utilizationPct: (demand * 100) / effCap,
      overloaded,
      factor: demand > 0 ? delivered / demand : 1,
    };
  });
  const apById = new Map(apResults.map((a) => [a.id, a]));

  // 6 and 7. Buildings: traffic, working uplink capacity, scale.
  const buildingResults = level.map.buildings.map((b) => {
    const bUplinks = equipment.uplinks.filter((u) => u.buildingId === b.id);
    const working = bUplinks.filter((u) => u.state === 'working');
    const workingCap = working.reduce((s, u) => s + u.capacityMbps, 0);
    const traffic = apResults.filter((a) => a.buildingId === b.id).reduce((s, a) => s + a.deliveredMbps, 0);
    const down = workingCap === 0;
    const congested = !down && traffic > workingCap + EPS;
    let scale = 1;
    if (traffic > 0) scale = down ? 0 : Math.min(1, workingCap / traffic);
    let utilizationPct = 0;
    if (traffic > 0) utilizationPct = down ? Infinity : (traffic * 100) / workingCap;
    return {
      id: b.id,
      workingCapacityMbps: workingCap,
      trafficMbps: traffic,
      utilizationPct,
      congested,
      down,
      scale,
    };
  });
  const buildingById = new Map(buildingResults.map((b) => [b.id, b]));

  // 8. Zone and campus results.
  let campusDemand = 0;
  let campusDelivered = 0;
  const zoneResults = zones.map((z) => {
    const s = zoneServing.get(z.id);
    const zUsers = usersByZone.get(z.id);
    const demand = zUsers.reduce((sum, u) => sum + demandOf(u), 0);
    let delivered = 0;
    let apUtil = null;
    let upUtil = null;
    if (s.covered) {
      const ap = apById.get(s.apId);
      const b = buildingById.get(ap.buildingId);
      const scale = b ? b.scale : 0;
      delivered = demand * ap.factor * scale;
      apUtil = ap.utilizationPct;
      upUtil = b ? b.utilizationPct : null;
    }
    campusDemand += demand;
    campusDelivered += delivered;
    return {
      id: z.id,
      cell: z.cell,
      buildingId: z.buildingId,
      servingApId: s.apId,
      rssiDbm: s.rssi,
      covered: s.covered,
      users: zUsers.length,
      demandMbps: demand,
      deliveredMbps: delivered,
      satisfactionPct: demand > 0 ? (delivered * 100) / demand : 100,
      apUtilizationPct: apUtil,
      uplinkUtilizationPct: upUtil,
    };
  });

  const model = {
    zones: zoneResults,
    aps: apResults.map(({ factor, ...rest }) => rest),
    buildings: buildingResults.map(({ scale, ...rest }) => rest),
    campus: {
      demandMbps: campusDemand,
      deliveredMbps: campusDelivered,
      satisfactionPct: campusDemand > 0 ? (campusDelivered * 100) / campusDemand : 100,
    },
    coverageThresholdDbm: constants.coverageThresholdDbm,
    contentErrors,
  };
  model.zoneById = new Map(model.zones.map((z) => [z.id, z]));
  return model;
}

// ---- Diagnosis (FR-015, FR-016) -------------------------------------------------------------

/** All causes, in the suggested fix order. */
export const CAUSES = ['uplink-down', 'weak-signal', 'channel-interference', 'uplink-congested', 'ap-overloaded'];

function zoneContext(zoneId, model) {
  const zone = model.zones.find((z) => z.id === zoneId);
  if (!zone) return null;
  const ap = zone.servingApId ? model.aps.find((a) => a.id === zone.servingApId) : null;
  const building = model.buildings.find((b) => b.id === zone.buildingId);
  return { zone, ap, building };
}

/** Which causes are true for a zone right now. Computed only from the current model. */
export function causesFor(zoneId, model) {
  const out = new Set();
  const ctx = zoneContext(zoneId, model);
  if (!ctx) return out;
  const { zone, ap, building } = ctx;
  if (building && building.down) out.add('uplink-down');
  if (!zone.covered) out.add('weak-signal');
  if (zone.covered && ap) {
    if (ap.conflictsWith.length > 0 && ap.overloaded) out.add('channel-interference');
    if (ap.demandMbps > ap.capacityMbps) out.add('ap-overloaded');
  }
  if (building && building.congested) out.add('uplink-congested');
  return out;
}

/**
 * Grade a diagnosis against the current model. The choice is correct exactly when it is a true
 * cause; no answer key is stored anywhere.
 */
export function evaluateDiagnosis(zoneId, choice, model) {
  const ctx = zoneContext(zoneId, model);
  if (typeof choice !== 'string' || !CAUSES.includes(choice) || !ctx) {
    return { status: 'invalid-input', trueCauses: [], reasonCode: 'invalid-input', evidence: {} };
  }
  if (model.contentErrors && model.contentErrors.length > 0) {
    return { status: 'content-error', trueCauses: [], reasonCode: 'content-error', evidence: {} };
  }
  const { zone, ap, building } = ctx;
  const causes = causesFor(zoneId, model);
  const trueCauses = CAUSES.filter((c) => causes.has(c));
  const evidence = {
    zoneId,
    rssiDbm: zone.rssiDbm,
    thresholdDbm: model.coverageThresholdDbm,
    covered: zone.covered,
    sharePct: zone.satisfactionPct,
    apId: ap ? ap.id : null,
    apDemandMbps: ap ? ap.demandMbps : null,
    apCapacityMbps: ap ? ap.capacityMbps : null,
    apEffectiveCapacityMbps: ap ? ap.effectiveCapacityMbps : null,
    apUtilizationPct: ap ? ap.utilizationPct : null,
    apConflictsWith: ap ? [...ap.conflictsWith] : [],
    buildingId: building ? building.id : null,
    uplinkTrafficMbps: building ? building.trafficMbps : null,
    uplinkCapacityMbps: building ? building.workingCapacityMbps : null,
    uplinkUtilizationPct: building ? building.utilizationPct : null,
    uplinkDown: building ? building.down : false,
  };
  const ok = causes.has(choice);
  return {
    status: ok ? 'correct' : 'incorrect',
    trueCauses,
    reasonCode: `${ok ? 'accepted' : 'ruled-out'}:${choice}`,
    evidence,
  };
}
