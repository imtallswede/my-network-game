// Rendering: builds HTML/SVG strings from session state. No game logic lives here: every number
// shown comes from the engine's model. Color is never the only signal: each zone shows its RSSI
// number and a covered / not covered label, and congestion/uplink states also use text.

import { imageUrl, assetInfo } from './assets.js';
import { zoneLabel, formatDbm, formatPct, formatClock, zoneRows as zoneRowsOf, CAUSE_LABEL, ticketText, hintText, describeResolution } from '../engine/feedback.js';

const CELL = 40;

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const money = (n) => `$${n.toLocaleString('en-US')}`;

/** Decorative <img> (the same meaning is in the text beside it). Empty string if art is unavailable. */
function icon(id, size = 20) {
  const url = imageUrl(id);
  return url ? `<img src="${url}" alt="" width="${size}" height="${size}">` : '';
}

/** <img> with the manifest title as alt text (for art that stands alone, such as banners). */
function artImg(id, width) {
  const url = imageUrl(id);
  const info = assetInfo(id);
  return url ? `<img class="art" src="${url}" alt="${esc(info.title)}" ${width ? `width="${width}"` : ''}>` : '';
}

// ---- Briefing -------------------------------------------------------------------------------

export function renderBriefing(container, session) {
  const level = session.level;
  const b = level.briefing;
  const art = level.art || {};
  const sources = (b.sourceIds || [])
    .map((id) => session.doc.sources.find((s) => s.id === id))
    .filter(Boolean)
    .map((s) => `<li>${esc(s.title)} <span class="tag">${esc(s.status)}</span></li>`)
    .join('');
  container.innerHTML = `
    <article class="briefing">
      ${art.banner ? artImg(art.banner) : ''}
      <h2 id="briefing-title" tabindex="-1">${art.building ? artImg(art.building, 64) : ''} Level ${session.levelIndex + 1}: ${esc(level.title)}</h2>
      <p class="concept"><strong>New concept:</strong> ${esc(level.concept || '')}</p>
      ${b.paragraphs.map((p) => `<p>${esc(p)}</p>`).join('')}
      ${b.example ? `<section class="example" aria-label="Worked example">
        <h3>Worked example</h3>
        <ol>${b.example.steps.map((s) => `<li>${esc(s)}</li>`).join('')}</ol>
      </section>` : ''}
      <div class="legends">${artImg('legend-wall-types', 280)}${artImg('legend-rssi-heatmap', 280)}</div>
      <p class="simplified"><em>${esc(b.simplification)}</em></p>
      ${sources ? `<details><summary>Sources</summary><ul>${sources}</ul></details>` : ''}
      <p><button class="action" type="button" data-action="start-level">Start level</button></p>
    </article>`;
}

// ---- HUD ------------------------------------------------------------------------------------

export function renderHud(el, session) {
  const sim = session.sim;
  const m = sim.model;
  const waves = session.level.waves.length;
  let status;
  if (sim.phase === 'ready') status = 'Paused. Press Resume to start wave 1.';
  else if (sim.phase === 'wave-end') status = `Wave ${sim.waveIndex} ended.`;
  else if (sim.phase === 'level-end') status = 'All waves finished.';
  else status = sim.paused ? `Wave ${sim.waveIndex}: paused.` : `Wave ${sim.waveIndex}: running.`;
  const waveClock = `${formatClock(sim.waveStep)} / ${formatClock(session.constants.waveSteps)}`;
  const canPause = sim.phase === 'running' || sim.phase === 'ready';
  el.innerHTML = `
    <span class="hud-item">${icon('ui-clock')} <span>Wave ${Math.max(sim.waveIndex, 1)} of ${waves} · ${waveClock}</span></span>
    <span class="hud-item">${icon('ui-budget')} <span>Budget ${money(sim.budget)}</span></span>
    <span class="hud-item">${icon('ui-score')} <span>Score ${session.score + sim.diagnosisPoints}</span></span>
    <span class="hud-item">${icon('ui-satisfaction')} <span>Satisfaction ${formatPct(m.campus.satisfactionPct)}</span></span>
    <button class="action" type="button" data-action="toggle-pause" ${canPause ? '' : 'disabled'}>
      ${icon(sim.paused ? 'ui-play' : 'ui-pause')} <span>${sim.paused ? 'Resume' : 'Pause'} (Space)</span>
    </button>
    <button class="action secondary" type="button" data-action="toggle-speed" aria-label="Speed ${sim.speed}×. Press to switch.">
      ${icon(sim.speed === 2 ? 'ui-speed-2x' : 'ui-speed-1x')} <span>Speed ${sim.speed}×</span>
    </button>
    <span class="hud-status">${esc(status)}</span>
    <label class="hud-item"><input type="checkbox" id="autopause" data-setting="autopause" ${sim.autoPause ? 'checked' : ''}> <span>Auto-pause on new tickets</span></label>
    <button class="action secondary" type="button" data-action="restart">Restart</button>`;
}

// ---- Map ------------------------------------------------------------------------------------

/** Sequential blue scale: stronger signal is darker. Returns { fill, dark } for label contrast. */
function heat(rssi) {
  if (rssi === -Infinity || rssi === null) return { fill: '#e6e9ed', dark: false };
  const t = Math.max(0, Math.min(1, (rssi + 90) / 50));
  const lightness = 92 - 55 * t;
  return { fill: `hsl(210 70% ${lightness.toFixed(0)}%)`, dark: lightness < 55 };
}

const WALL_STYLE = {
  drywall: { stroke: '#6b7785', width: 3, dash: '6 4' },
  brick: { stroke: '#a0522d', width: 4, dash: '10 3 2 3' },
  concrete: { stroke: '#22272b', width: 6, dash: '' },
};

export function renderMap(el, session) {
  const { level, sim } = session;
  const model = sim.model;
  const cols = level.map.cols;
  const rows = level.map.rows;
  const w = cols * CELL;
  const h = rows * CELL;
  const floor = imageUrl('tile-floor');
  const grass = imageUrl('tile-grass');
  const parts = [];

  parts.push(`<defs>
    ${grass ? `<pattern id="p-grass" width="${CELL}" height="${CELL}" patternUnits="userSpaceOnUse"><image href="${grass}" width="${CELL}" height="${CELL}"/></pattern>` : ''}
    ${floor ? `<pattern id="p-floor" width="${CELL}" height="${CELL}" patternUnits="userSpaceOnUse"><image href="${floor}" width="${CELL}" height="${CELL}"/></pattern>` : ''}
    <pattern id="p-hatch" width="8" height="8" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><line x1="0" y1="0" x2="0" y2="8" stroke="#7a1f19" stroke-width="2"/></pattern>
  </defs>`);
  parts.push(`<rect width="${w}" height="${h}" fill="${grass ? 'url(#p-grass)' : '#cfe8c8'}"/>`);

  // Zones: floor tile, heat tint, RSSI number, covered state, user count.
  for (const z of model.zones) {
    const x = z.cell[0] * CELL;
    const y = z.cell[1] * CELL;
    const hc = heat(z.rssiDbm);
    parts.push(`<rect x="${x}" y="${y}" width="${CELL}" height="${CELL}" fill="${floor ? 'url(#p-floor)' : '#f2eee6'}"/>`);
    parts.push(`<rect x="${x}" y="${y}" width="${CELL}" height="${CELL}" fill="${hc.fill}" fill-opacity="0.78"/>`);
    if (!z.covered) {
      parts.push(`<rect x="${x}" y="${y}" width="${CELL}" height="${CELL}" fill="url(#p-hatch)" fill-opacity="0.45"/>`);
    }
    parts.push(`<rect x="${x}" y="${y}" width="${CELL}" height="${CELL}" fill="none" stroke="#fff" stroke-opacity="0.5"/>`);
    const rssiText = z.rssiDbm === -Infinity ? '—' : (Math.round(z.rssiDbm)).toString().replace('-', '−');
    parts.push(`<text class="cell-num" x="${x + CELL / 2}" y="${y + 13}" text-anchor="middle">${rssiText}</text>`);
    parts.push(`<text class="cell-state" x="${x + CELL / 2}" y="${y + CELL - 4}" text-anchor="middle">${z.covered ? 'ok' : 'no signal'}</text>`);
  }

  // Walls on cell edges.
  for (const wall of level.map.walls || []) {
    const s = WALL_STYLE[wall.type];
    parts.push(`<line x1="${wall.a[0] * CELL}" y1="${wall.a[1] * CELL}" x2="${wall.b[0] * CELL}" y2="${wall.b[1] * CELL}" stroke="${s.stroke}" stroke-width="${s.width}" ${s.dash ? `stroke-dasharray="${s.dash}"` : ''} stroke-linecap="butt"/>`);
  }

  // Users (a few sprites per zone plus a count).
  const userUrls = { light: imageUrl('user-light'), video: imageUrl('user-video'), event: imageUrl('user-event') };
  const byZone = new Map();
  for (const u of sim.users) {
    if (!byZone.has(u.zoneId)) byZone.set(u.zoneId, []);
    byZone.get(u.zoneId).push(u);
  }
  const slots = [[4, 15], [22, 15], [4, 27], [22, 27]];
  for (const [zid, list] of byZone) {
    const [c, r] = zid.split(',').map(Number);
    list.slice(0, 4).forEach((u, i) => {
      const url = userUrls[u.type];
      if (url) parts.push(`<image href="${url}" x="${c * CELL + slots[i][0]}" y="${r * CELL + slots[i][1] - 12}" width="14" height="14"/>`);
    });
    if (list.length > 4) {
      parts.push(`<text class="cell-more" x="${c * CELL + CELL - 3}" y="${r * CELL + CELL - 3}" text-anchor="end">+${list.length - 4}</text>`);
    }
  }

  // Congestion marks (text and hatch, not color alone).
  for (const z of model.zones) {
    const ap = z.servingApId ? model.aps.find((a) => a.id === z.servingApId) : null;
    const b = model.buildings.find((x) => x.id === z.buildingId);
    const congested = (ap && ap.overloaded) || (b && b.congested);
    if (congested && z.users > 0) {
      parts.push(`<text class="cell-warn" x="${z.cell[0] * CELL + 3}" y="${z.cell[1] * CELL + 24}">!</text>`);
    }
  }

  // Access points with channel badge and number.
  for (const ap of model.aps) {
    const x = ap.cell[0] * CELL;
    const y = ap.cell[1] * CELL;
    const spriteId = ap.overloaded ? 'ap-overloaded' : ap.conflictsWith.length ? 'ap-channel-conflict' : 'ap';
    const url = imageUrl(spriteId);
    if (url) parts.push(`<image href="${url}" x="${x + 6}" y="${y + 6}" width="28" height="28"/>`);
    else parts.push(`<circle cx="${x + 20}" cy="${y + 20}" r="10" fill="#0b5cad"/>`);
    const badge = imageUrl(`channel-${String(ap.channel).padStart(2, '0')}`);
    if (badge) parts.push(`<image href="${badge}" x="${x + CELL - 16}" y="${y + 1}" width="15" height="15"/>`);
    parts.push(`<text class="cell-ch" x="${x + CELL - 1}" y="${y + 26}" text-anchor="end">ch${ap.channel}</text>`);
  }

  // Selection cursor.
  if (session.selectedZone) {
    const [c, r] = session.selectedZone.split(',').map(Number);
    const cur = imageUrl('map-cursor');
    if (cur) parts.push(`<image href="${cur}" x="${c * CELL}" y="${r * CELL}" width="${CELL}" height="${CELL}"/>`);
    else parts.push(`<rect x="${c * CELL}" y="${r * CELL}" width="${CELL}" height="${CELL}" fill="none" stroke="#ff9d00" stroke-width="3"/>`);
  }

  // Click and keyboard targets last so they sit on top. One tab stop: the focused cell gets
  // tabindex 0 and the arrow keys move between cells (roving tabindex).
  const zrows = zoneRowsOf(model);
  const rowById = new Map(zrows.map((r) => [r.id, r]));
  const stop = model.zoneById.has(session.focusCell) ? session.focusCell : model.zones[0].id;
  for (const z of model.zones) {
    parts.push(`<rect class="cell-hit" data-cell="${z.id}" tabindex="${z.id === stop ? 0 : -1}" role="button" aria-label="${esc(rowById.get(z.id).name)}" x="${z.cell[0] * CELL}" y="${z.cell[1] * CELL}" width="${CELL}" height="${CELL}" fill="transparent"/>`);
  }

  el.innerHTML = `
    <p class="map-help">${session.tool === 'place-ap' ? '<strong>Place AP:</strong> click a zone inside the building.' : 'Click a zone to inspect it. Use the Zone table tab for a text version of this map.'}</p>
    <svg class="map ${session.tool === 'place-ap' ? 'placing' : ''}" viewBox="0 0 ${w} ${h}" role="group" aria-label="Campus map, ${esc(level.title)}. Each zone shows its signal strength in dBm.">
      ${parts.join('\n')}
    </svg>
    <p class="map-legend">Number = signal strength in dBm (closer to 0 is stronger; −67 or better is covered). "no signal" with hatching = not covered. "!" = congested. Walls: dashed grey = drywall, thick black = concrete.</p>
    <div class="legends">${artImg('legend-rssi-heatmap', 240)}${artImg('legend-wall-types', 240)}</div>
    <details class="keys" open><summary>Keyboard shortcuts</summary>
      <ul>
        <li><kbd>Space</kbd> pause or resume · <kbd>1</kbd> / <kbd>2</kbd> speed</li>
        <li>Map: arrow keys move, <kbd>Enter</kbd> select, <kbd>A</kbd> place AP, <kbd>Delete</kbd> remove AP, <kbd>C</kbd> channel</li>
        <li><kbd>T</kbd> next ticket · <kbd>H</kbd> hint for the selected ticket</li>
      </ul>
    </details>`;
}

// ---- Zone details and table -----------------------------------------------------------------

/** One row per zone, shared by the details panel and the zone table. */
export function zoneRows(session) {
  return zoneRowsOf(session.sim.model);
}

function channelControl(session, z) {
  const ap = session.sim.equipment.aps.find((a) => `${a.cell[0]},${a.cell[1]}` === z.id);
  if (!ap || session.level.channelMode.type === 'locked') return '';
  const [lo, hi] = session.constants.channelRange;
  const opts = [];
  for (let c = lo; c <= hi; c += 1) opts.push(`<option value="${c}" ${c === ap.channel ? 'selected' : ''}>Channel ${c}</option>`);
  return `<p><label for="channel-select">Channel for AP ${ap.id}</label> <select id="channel-select" data-ap="${ap.id}">${opts.join('')}</select></p>`;
}

export function renderZoneDetails(el, session) {
  const sim = session.sim;
  if (!session.selectedZone) {
    el.innerHTML = '<p>Select a zone on the map to see its signal, channel, load and uplink.</p>';
    return;
  }
  const z = sim.model.zoneById.get(session.selectedZone);
  const row = zoneRows(session).find((r) => r.id === z.id);
  const building = session.level.map.buildings.find((b) => b.id === z.buildingId);
  const hasAp = sim.equipment.aps.some((a) => `${a.cell[0]},${a.cell[1]}` === z.id);
  el.innerHTML = `
    <dl class="kv">
      <dt>Zone</dt><dd>${row.label} (${esc(building.name)})</dd>
      <dt>Signal</dt><dd>${row.rssi} — ${row.covered}</dd>
      <dt>Serving AP</dt><dd>${row.servingAp}${row.channel !== '—' ? `, channel ${row.channel}` : ''}</dd>
      <dt>Users</dt><dd>${z.users} (demand ${z.demandMbps} Mbps, delivered ${(Math.round(z.deliveredMbps * 10) / 10)} Mbps)</dd>
      <dt>Satisfaction</dt><dd>${formatPct(z.satisfactionPct)}</dd>
      <dt>AP load</dt><dd>${row.apUtil}</dd>
      <dt>Uplink load</dt><dd>${row.uplinkUtil}</dd>
    </dl>
    ${hasAp ? channelControl(session, z) : `<button class="action" type="button" data-action="place-ap-at" data-cell="${z.id}">Place AP here</button>`}`;
}

export function renderZoneTable(el, session) {
  const rows = zoneRows(session);
  el.innerHTML = `
    <div class="scroll-box" tabindex="0" role="region" aria-label="Zone table, scrollable">
      <table>
        <caption>Every zone with its signal, serving AP, channel, users and load</caption>
        <thead><tr><th scope="col">Zone</th><th scope="col">RSSI</th><th scope="col">Coverage</th><th scope="col">Serving AP</th><th scope="col">Channel</th><th scope="col">Users</th><th scope="col">AP load</th><th scope="col">Uplink load</th></tr></thead>
        <tbody>${rows.map((r) => `<tr><th scope="row">${r.label}</th><td>${r.rssi}</td><td>${r.covered}${r.flags.length ? ` (${r.flags.join(', ')})` : ''}</td><td>${r.servingAp}</td><td>${r.channel === '—' ? '—' : `${icon(`channel-${r.channel.padStart(2, '0')}`, 16)} ${r.channel}`}</td><td>${r.users}</td><td>${r.apUtil}</td><td>${r.uplinkUtil}</td></tr>`).join('')}</tbody>
      </table>
    </div>`;
}

// ---- Equipment ------------------------------------------------------------------------------

export function renderEquipment(el, session) {
  const { sim, level, constants } = { sim: session.sim, level: session.level, constants: session.constants };
  const model = sim.model;
  const up100 = constants.prices.uplink100;
  const up1000 = constants.prices.uplink1000;
  const aps = model.aps.map((a) => `
    <li>AP ${a.id} at ${zoneLabel(a.cell)}, channel ${a.channel}, load ${formatPct(a.utilizationPct)}
      <button class="action secondary" type="button" data-action="remove-ap" data-id="${a.id}" aria-label="Remove AP ${a.id}, refund ${money(constants.prices.ap)}">Remove</button></li>`).join('');
  const buildings = level.map.buildings.map((b) => {
    const ups = sim.equipment.uplinks.filter((u) => u.buildingId === b.id).map((u) => `
      <li>Uplink ${u.id}: ${u.capacityMbps === 1000 ? '1 Gbps' : '100 Mbps'}, ${u.state}${u.preinstalled ? ' (came with the building)' : ''}
        ${u.capacityMbps === 100 && u.state === 'working' ? `<button class="action secondary" type="button" data-action="upgrade-uplink" data-id="${u.id}">Upgrade to 1 Gbps (${money(up1000 - up100)})</button>` : ''}
        ${u.preinstalled ? '' : `<button class="action secondary" type="button" data-action="remove-uplink" data-id="${u.id}">Remove</button>`}</li>`).join('');
    const bm = model.buildings.find((x) => x.id === b.id);
    return `<div><h3>${esc(b.name)} uplinks</h3>
      <p>Load ${formatPct(bm.utilizationPct)} of ${bm.workingCapacityMbps} Mbps${bm.congested ? ' (congested)' : ''}${bm.down ? ' (no working uplink)' : ''}</p>
      <ul>${ups || '<li>none</li>'}</ul>
      <button class="action secondary" type="button" data-action="buy-uplink" data-building="${b.id}" data-cap="100">Buy 100 Mbps (${money(up100)})</button>
      <button class="action secondary" type="button" data-action="buy-uplink" data-building="${b.id}" data-cap="1000">Buy 1 Gbps (${money(up1000)})</button></div>`;
  }).join('');
  el.innerHTML = `
    <p>${icon('ui-place-ap')} <button class="action ${session.tool === 'place-ap' ? '' : 'secondary'}" type="button" data-action="tool-place-ap" aria-pressed="${session.tool === 'place-ap'}">Place AP (${model.aps.length} of ${level.apLimit}, ${money(constants.prices.ap)} each)</button></p>
    <ul>${aps || '<li>No APs yet.</li>'}</ul>
    ${buildings}`;
}


// ---- Tickets --------------------------------------------------------------------------------

const CAUSE_ORDER = ['weak-signal', 'ap-overloaded', 'channel-interference', 'uplink-congested', 'uplink-down'];
const STATUS_TEXT = {
  open: 'Open',
  diagnosed: 'Diagnosed – awaiting fix',
  closed: 'Closed',
  'resolved-by-change': 'Resolved by network change',
};
const STATUS_ICON = {
  open: 'ticket-open',
  diagnosed: 'ticket-diagnosed',
  closed: 'ticket-closed',
  'resolved-by-change': 'ticket-resolved-by-change',
};

function ticketAge(sim, tk) {
  const end = tk.closedStep === null ? sim.step : tk.closedStep;
  return formatClock(end - tk.openedStep);
}

function ticketDetail(session, tk) {
  const { sim, level } = session;
  const text = ticketText(level, tk);
  const note = (session.notes || {})[tk.id];
  const isOpen = tk.status === 'open';
  const chosen = (session.choice || {})[tk.id] || '';
  const hints = [];
  if (tk.hintLevel >= 1) hints.push(`<p class="hint"><strong>Hint (method):</strong> ${esc(hintText(level, 1))}</p>`);
  if (tk.hintLevel >= 2) hints.push(`<p class="hint"><strong>Worked solution:</strong> ${esc(hintText(level, 2))}</p>`);
  const radios = CAUSE_ORDER.map((c) => `
      <label class="cause"><input type="radio" id="r-${tk.id}-${c}" name="cause-${tk.id}" value="${c}" data-ticket="${tk.id}" ${chosen === c ? 'checked' : ''} ${isOpen ? '' : 'disabled'}>
        ${icon(`cause-${c}`)} <span>${CAUSE_LABEL[c]}</span></label>`).join('');
  let resolution = '';
  if (tk.status === 'closed' || tk.status === 'resolved-by-change') resolution = `<p class="note">${esc(describeResolution(tk, level))}</p>`;
  return `
    <section class="ticket-detail" aria-label="Ticket details">
      <h3 id="ticket-detail-h" tabindex="-1">${esc(text.title)}</h3>
      <p>${esc(text.complaint)}</p>
      <p>Zone ${zoneLabel(tk.zoneId.split(',').map(Number))} · ${icon(STATUS_ICON[tk.status])} ${STATUS_TEXT[tk.status]} · age <span class="age" data-age="${tk.id}"></span>${tk.awardedPoints ? ` · +${tk.awardedPoints} points` : ''}</p>
      <fieldset class="causes" ${isOpen ? '' : 'disabled'}><legend>What is causing this?</legend>${radios}</fieldset>
      <p>
        <button class="action" type="button" data-action="submit-diagnosis" data-id="${tk.id}" ${isOpen ? '' : 'disabled'}>Submit diagnosis</button>
        <button class="action secondary" type="button" data-action="request-hint" data-id="${tk.id}" ${isOpen ? '' : 'disabled'}>${icon('ui-hint')} <span>${tk.hintLevel === 0 ? 'Hint' : tk.hintLevel === 1 ? 'Worked solution' : 'Show hint again'}</span></button>
      </p>
      ${hints.join('')}
      ${note ? `<div class="note ${note.kind}"><strong>${esc(note.headline)}</strong> ${esc(note.body)} <em>${esc(note.nextStep)}</em></div>` : ''}
      ${resolution}
    </section>`;
}

export function renderTickets(el, session) {
  const sim = session.sim;
  const sorted = [...sim.tickets].sort((a, b) => {
    const live = (t) => (t.status === 'open' || t.status === 'diagnosed' ? 0 : 1);
    return live(a) - live(b) || a.id - b.id;
  });
  const selected = sim.tickets.find((t) => t.id === session.selectedTicket) || null;
  const items = sorted.map((tk) => `
    <li><button type="button" class="ticket-item ${selected && selected.id === tk.id ? 'current' : ''}" data-action="select-ticket" data-id="${tk.id}" aria-pressed="${selected && selected.id === tk.id}">
      ${icon(STATUS_ICON[tk.status])} <span>${esc(ticketText(session.level, tk).title)}: ${STATUS_TEXT[tk.status]}</span> <span class="age-wrap">age <span class="age" data-age="${tk.id}"></span></span></button></li>`).join('');
  const html = `
    <ul class="ticket-list">${items || '<li>No tickets. They open when a zone stays unhappy for 10 seconds.</li>'}</ul>
    ${selected ? ticketDetail(session, selected) : sim.tickets.length ? '<p>Select a ticket to diagnose it.</p>' : ''}`;
  // Re-render only when the structure changes, so radio focus and selection survive the clock.
  if (el.dataset.sig !== html) {
    const focusId = document.activeElement && el.contains(document.activeElement) ? document.activeElement.id : '';
    el.innerHTML = html;
    el.dataset.sig = html;
    if (focusId) document.getElementById(focusId)?.focus();
  }
  for (const span of el.querySelectorAll('[data-age]')) {
    const tk = sim.tickets.find((x) => x.id === Number(span.dataset.age));
    if (tk) span.textContent = ticketAge(sim, tk);
  }
}


// ---- Wave review, summaries, restart --------------------------------------------------------

const FIRE_WORDS = {
  satisfaction: (b) => `campus satisfaction was ${formatPct(b.value)} and the minimum is ${b.threshold}%`,
  'ticket-age': (b) => `a ticket had been open for ${formatClock(b.value)}, past the ${formatClock(b.threshold)} limit`,
};

export function renderReview(container, session) {
  const r = session.review;
  const mood = r.fired ? 'dean-of-it-angry' : r.satisfactionPct >= 90 ? 'dean-of-it-pleased' : 'dean-of-it-concerned';
  const stamp = r.fired ? 'stamp-fired' : 'stamp-wave-passed';
  const cause = r.firedBy && r.firedBy.cause ? CAUSE_LABEL[r.firedBy.cause] : null;
  const voice = r.fired
    ? `I am sorry, but I have to let you go. ${FIRE_WORDS[r.firedBy.metric](r.firedBy)}.${cause ? ` The network cause was: ${cause}.` : ''} Take what you learned and try again; it costs you nothing.`
    : `Well done. Let us look at how wave ${r.wave} went, and then at what is coming.`;
  const s = r.score;
  container.innerHTML = `
    <article class="review ${r.fired ? 'fired' : 'passed'}">
      <h2 id="review-title" tabindex="-1">${icon(stamp, 40)} Wave ${r.wave} review: ${r.fired ? 'fired' : 'passed'}</h2>
      <p class="dean">${icon(mood, 64)} <span><strong>Dean of IT:</strong> ${esc(voice)}</span></p>
      <dl class="kv">
        <dt>Campus satisfaction</dt><dd>${formatPct(r.satisfactionPct)} (${Math.round(r.deliveredMbps * 10) / 10} of ${r.demandedMbps} Mbps delivered; you need at least ${session.constants.fireSatisfactionPct}%)</dd>
        <dt>Oldest open ticket</dt><dd>${r.oldestTicketAgeSteps ? formatClock(r.oldestTicketAgeSteps) : 'none'} (limit ${formatClock(session.constants.fireTicketAgeSteps)})</dd>
        <dt>Wave points</dt><dd>${s.wavePoints} (satisfaction, rounded)</dd>
        <dt>Diagnosis points</dt><dd>${s.diagnosisPoints} (${session.constants.pointsPerDiagnosis} per ticket diagnosed)</dd>
        ${r.finalWave ? `<dt>Budget bonus</dt><dd>${s.budgetBonus} (1 point per $100 left)</dd>` : ''}
        <dt>Score</dt><dd>${r.fired ? 'nothing from this attempt is kept; Retry starts the level over with the score you began with' : session.score + s.diagnosisPoints}</dd>
      </dl>
      ${r.nextPreview && !r.fired ? `<p><strong>Next wave:</strong> ${esc(r.nextPreview)}</p>` : ''}
      <p>
        ${r.fired
          ? '<button class="action" type="button" data-action="retry-level">Retry level</button> <button class="action secondary" type="button" data-action="restart">Restart game</button>'
          : '<button class="action" type="button" data-action="continue-review">Continue to next wave</button>'}
      </p>
    </article>`;
}

export function renderLevelSummary(container, session) {
  const sm = session.summary;
  const d = sm.diagnosed;
  const last = session.levelIndex + 1 >= session.doc.levels.length;
  container.innerHTML = `
    <article class="summary">
      <h2 id="summary-title" tabindex="-1">${icon('stamp-level-complete', 40)} Level complete: ${esc(sm.levelTitle)}</h2>
      <p class="dean">${icon('dean-of-it-pleased', 64)} <span><strong>Dean of IT:</strong> Three waves passed. That is a good day of work.</span></p>
      <dl class="kv">
        <dt>Waves passed</dt><dd>${sm.wavesPassed}</dd>
        <dt>Tickets diagnosed</dt><dd>${d.firstTry} on the first try, ${d.afterHint} after a hint, ${d.afterWorkedSolution} after a worked solution</dd>
        <dt>Budget left</dt><dd>${money(sm.budgetLeft)} (bonus ${sm.budgetBonus} points)</dd>
        <dt>Score</dt><dd>${sm.score}</dd>
      </dl>
      <p><button class="action" type="button" data-action="next-level">${last ? 'See session summary' : 'Next level'}</button></p>
    </article>`;
}

export function renderSessionSummary(container, session) {
  container.innerHTML = `
    <article class="summary">
      <h2 id="summary-title" tabindex="-1">${icon('stamp-level-complete', 40)} All levels finished</h2>
      <dl class="kv"><dt>Final score</dt><dd>${session.score}</dd><dt>High score this session</dt><dd>${session.highScore}</dd></dl>
      <p><button class="action" type="button" data-action="restart">Play again from Level 1</button></p>
    </article>`;
}

export function renderRestartConfirm(container) {
  container.innerHTML = `
    <div class="confirm" role="alertdialog" aria-labelledby="confirm-title" aria-describedby="confirm-desc">
      <h2 id="confirm-title" tabindex="-1">Restart the game?</h2>
      <p id="confirm-desc">This clears your score and equipment and returns you to the Level 1 briefing. Your high score for this page session is kept.</p>
      <p><button class="action" type="button" data-action="confirm-restart">Restart</button> <button class="action secondary" type="button" data-action="cancel-restart">Cancel</button></p>
    </div>`;
}

// ---- All -------------------------------------------------------------------------------------

/** CSS selector that finds the focused control again after a re-render, or '' if none. */
function focusSelector() {
  const a = typeof document !== 'undefined' ? document.activeElement : null;
  if (!a || !a.dataset) return '';
  if (a.id) return `#${a.id}`;
  if (a.dataset.cell) return `[data-cell="${a.dataset.cell}"]`;
  if (a.dataset.action) {
    let sel = `[data-action="${a.dataset.action}"]`;
    for (const k of ['id', 'building', 'cap', 'cell']) if (a.dataset[k]) sel += `[data-${k}="${a.dataset[k]}"]`;
    return sel;
  }
  return '';
}

export function renderAll(session, els) {
  const sel = focusSelector();
  renderAllInner(session, els);
  if (sel) {
    const again = document.querySelector(sel);
    if (again && again !== document.activeElement) again.focus();
  }
}

function renderAllInner(session, els) {
  renderHud(els.hud, session);
  if (session.tab === 'table') renderZoneTable(els.panelTable, session);
  else renderMap(els.panelMap, session);
  renderZoneDetails(els.zoneDetail, session);
  renderEquipment(els.equipment, session);
  if (els.tickets) renderTickets(els.tickets, session);
}
