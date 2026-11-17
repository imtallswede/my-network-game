// Validation of data/levels.json before any level is presented (constitution Principle VI,
// data-model.md "Validation rules", contracts/level-data.md). Pure: returns errors, never throws.
// A rejected document must not start a level or grade anything, and is never a learner attempt.

import { cellId, isUnitAxisEdge, wallPath } from './geometry.js';

const REQUIRED_CONSTANTS = [
  'eirpDbm', 'pl1mDb', 'pathLossExponent', 'coverageThresholdDbm', 'ccaThresholdDbm',
  'apCapacityMbps', 'conflictChannelDelta', 'channelRange', 'wallLossDb', 'demandMbps', 'prices',
  'uplinkCapacityMbps', 'ticketOpenSteps', 'fireTicketAgeSteps', 'fireSatisfactionPct',
  'waveSteps', 'pointsPerDiagnosis', 'minDistanceM',
];
const SOURCE_STATUSES = ['verified', 'illustrative'];
const MAX_AMBIGUITY_REPORTS = 5;

const isInt = (n) => Number.isInteger(n);
const isCell = (c) => Array.isArray(c) && c.length === 2 && isInt(c[0]) && isInt(c[1]);

export function validateContent(doc) {
  const errors = [];
  const err = (levelId, itemId, code, message) => errors.push({ levelId, itemId, code, message });

  if (!doc || typeof doc !== 'object') {
    err('(file)', 'document', 'NOT_AN_OBJECT', 'levels.json is not a JSON object');
    return { ok: false, errors };
  }
  if (doc.schemaVersion !== 1) {
    err('(file)', 'schemaVersion', 'SCHEMA_VERSION', `Unsupported schemaVersion ${JSON.stringify(doc.schemaVersion)}; expected 1`);
  }

  // Constants
  const k = doc.constants || {};
  for (const name of REQUIRED_CONSTANTS) {
    if (k[name] === undefined) err('(file)', `constants.${name}`, 'CONSTANT_MISSING', `Missing constant ${name}`);
  }
  if (errors.length && errors.some((e) => e.code === 'CONSTANT_MISSING')) return { ok: false, errors };
  const [chMin, chMax] = k.channelRange;

  // Sources
  const sourceIds = new Set();
  for (const s of doc.sources || []) {
    if (sourceIds.has(s.id)) err('(file)', s.id, 'DUP_ID', `Duplicate source id ${s.id}`);
    sourceIds.add(s.id);
    if (!SOURCE_STATUSES.includes(s.status)) {
      err('(file)', s.id, 'SOURCE_STATUS', `Source ${s.id} status must be verified or illustrative`);
    }
    if (s.status === 'verified' && (!s.url || !s.section)) {
      err('(file)', s.id, 'SOURCE_UNVERIFIED', `Verified source ${s.id} needs a url and a section`);
    }
  }

  const levelIds = new Set();
  for (const level of doc.levels || []) {
    const L = level.id;
    if (levelIds.has(L)) err(L, L, 'DUP_ID', `Duplicate level id ${L}`);
    levelIds.add(L);

    if (!isInt(level.budget) || level.budget < 0) err(L, 'budget', 'BUDGET', 'budget must be a non-negative integer');
    if (!isInt(level.apLimit) || level.apLimit < 0) err(L, 'apLimit', 'AP_LIMIT', 'apLimit must be a non-negative integer');

    // Channel mode
    const cm = level.channelMode || {};
    if (cm.type === 'locked') {
      const list = [...(cm.channels || [])].sort((a, b) => a - b);
      if (list.join(',') !== '1,6,11') err(L, 'channelMode', 'CHANNEL_LIST', 'Locked channel list must be exactly 1, 6, 11');
    } else if (cm.type !== 'manual') {
      err(L, 'channelMode', 'CHANNEL_MODE', 'channelMode.type must be locked or manual');
    }
    for (const ap of (level.startingEquipment && level.startingEquipment.aps) || []) {
      if (!isInt(ap.channel) || ap.channel < chMin || ap.channel > chMax) {
        err(L, `ap ${ap.id}`, 'CHANNEL_RANGE', `AP ${ap.id} channel ${ap.channel} is outside ${chMin}-${chMax}`);
      }
    }
    for (const ch of cm.channels || []) {
      if (!isInt(ch) || ch < chMin || ch > chMax) err(L, 'channelMode', 'CHANNEL_RANGE', `Channel ${ch} is outside ${chMin}-${chMax}`);
    }

    // Map: buildings, zones
    const map = level.map || {};
    const zoneOwner = new Map();
    const buildingIds = new Set();
    for (const b of map.buildings || []) {
      if (buildingIds.has(b.id)) err(L, b.id, 'DUP_ID', `Duplicate building id ${b.id}`);
      buildingIds.add(b.id);
      for (const cell of b.zones || []) {
        const zid = isCell(cell) ? cellId(cell) : JSON.stringify(cell);
        if (!isCell(cell) || cell[0] < 0 || cell[1] < 0 || cell[0] >= map.cols || cell[1] >= map.rows) {
          err(L, zid, 'ZONE_OUT_OF_MAP', `Zone ${zid} is outside the ${map.cols}x${map.rows} map`);
          continue;
        }
        if (zoneOwner.has(zid)) err(L, zid, 'ZONE_DUP', `Zone ${zid} is in more than one building (${zoneOwner.get(zid)}, ${b.id})`);
        zoneOwner.set(zid, b.id);
      }
      for (const cap of b.startingUplinks || []) {
        if (!k.uplinkCapacityMbps.includes(cap)) err(L, b.id, 'UPLINK_CAPACITY', `Uplink capacity ${cap} is not allowed`);
      }
    }

    // Walls
    const walls = map.walls || [];
    for (const w of walls) {
      if (!k.wallLossDb[w.type]) err(L, JSON.stringify(w.a), 'WALL_TYPE', `Unknown wall type ${w.type}`);
      if (!isCell(w.a) || !isCell(w.b) || !isUnitAxisEdge(w)) {
        err(L, JSON.stringify([w.a, w.b]), 'WALL_EDGE', 'A wall must be one axis-aligned cell edge between two grid vertices');
      }
    }

    // Waves
    const waves = level.waves || [];
    if (waves.length !== 3) err(L, 'waves', 'WAVE_COUNT', `A level needs exactly three waves; found ${waves.length}`);
    waves.forEach((w, i) => {
      if (w.index !== i + 1) err(L, `wave ${i + 1}`, 'WAVE_INDEX', `Wave ${i + 1} has index ${w.index}`);
      for (const a of w.arrivals || []) {
        if (!isInt(a.count) || a.count <= 0) err(L, `wave ${w.index}`, 'WAVE_COUNT_VALUE', 'Arrival count must be a positive integer');
        if (!k.demandMbps[a.userType]) err(L, `wave ${w.index}`, 'USER_TYPE', `Unknown user type ${a.userType}`);
        for (const z of a.zones || []) {
          if (!zoneOwner.has(isCell(z) ? cellId(z) : JSON.stringify(z))) {
            err(L, `wave ${w.index}`, 'ZONE_OUTSIDE_BUILDING', `Arrival zone ${JSON.stringify(z)} is not inside any building`);
          }
        }
      }
    });

    // Failures
    for (const f of level.failures || []) {
      if (!buildingIds.has(f.building)) err(L, `failure ${f.building}`, 'FAILURE_REF', `Failure references unknown building ${f.building}`);
      if (!isInt(f.wave) || f.wave < 1 || f.wave > 3) err(L, 'failure', 'FAILURE_WAVE', 'Failure wave must be 1-3');
      if (!isInt(f.atSteps) || f.atSteps < 0 || f.atSteps >= k.waveSteps) err(L, 'failure', 'FAILURE_STEP', 'Failure atSteps must be within the wave');
      if (!isInt(f.uplinkIndex) || f.uplinkIndex < 0) err(L, 'failure', 'FAILURE_UPLINK', 'uplinkIndex must be a non-negative integer');
    }

    // Tickets, source references
    for (const tk of level.tickets || []) {
      if (!zoneOwner.has(isCell(tk.zone) ? cellId(tk.zone) : JSON.stringify(tk.zone))) {
        err(L, `ticket ${tk.title}`, 'ZONE_OUTSIDE_BUILDING', `Ticket zone ${JSON.stringify(tk.zone)} is not inside any building`);
      }
    }
    for (const sid of (level.briefing && level.briefing.sourceIds) || []) {
      if (!sourceIds.has(sid)) err(L, 'briefing', 'SOURCE_REF', `Briefing references unknown source ${sid}`);
    }

    // Starting equipment must fit the AP limit and budget (pre-installed building uplinks are free).
    const eq = level.startingEquipment || { aps: [], uplinks: [] };
    const apCost = (eq.aps || []).length * k.prices.ap;
    const uplinkCost = (eq.uplinks || []).reduce((s, u) => s + (u.capacityMbps === 1000 ? k.prices.uplink1000 : k.prices.uplink100), 0);
    if ((eq.aps || []).length > level.apLimit || apCost + uplinkCost > level.budget) {
      err(L, 'startingEquipment', 'EQUIP_UNAFFORDABLE', 'Starting equipment exceeds the AP limit or the budget');
    }

    // Ambiguous signal paths: any AP cell (zones) to any zone whose line passes through a wall corner.
    if (walls.length && !errors.some((e) => e.levelId === L && (e.code === 'WALL_EDGE' || e.code === 'ZONE_OUT_OF_MAP'))) {
      const cells = [...zoneOwner.keys()].map((id) => id.split(',').map(Number));
      let reported = 0;
      let extra = 0;
      outer:
      for (const a of cells) {
        for (const z of cells) {
          if (a[0] === z[0] && a[1] === z[1]) continue;
          if (wallPath(a, z, walls).ambiguous) {
            if (reported < MAX_AMBIGUITY_REPORTS) {
              err(L, `${cellId(a)}->${cellId(z)}`, 'WALL_AMBIGUOUS', `The line from ${cellId(a)} to ${cellId(z)} passes exactly through a wall corner`);
              reported += 1;
            } else {
              extra += 1;
              if (extra > 1000) break outer;
            }
          }
        }
      }
      if (extra > 0) err(L, 'map', 'WALL_AMBIGUOUS_MORE', `${extra}+ more ambiguous wall paths not listed`);
    }
  }

  return { ok: errors.length === 0, errors };
}
