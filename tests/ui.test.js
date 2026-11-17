// Render smoke tests: the renderers build the expected structure from real session state.
// (Click and keyboard behaviour is checked by hand and recorded in verification.md.)

import { createSession, beginLevel, perform } from '../engine/state.js';
import { renderBriefing, renderAll, zoneRows } from '../ui/render.js';
import { loadAssets } from '../ui/assets.js';

async function setup() {
  const doc = await (await fetch('../data/levels.json', { cache: 'no-cache' })).json();
  await loadAssets();
  const session = createSession(doc);
  const els = {
    hud: document.createElement('div'),
    panelMap: document.createElement('div'),
    panelTable: document.createElement('div'),
    zoneDetail: document.createElement('div'),
    equipment: document.createElement('div'),
  };
  return { doc, session, els };
}

export const tests = [
  {
    id: 'UI-1',
    name: 'The briefing shows the level, a worked example, the simplified-model notice and a Start button',
    async run(t) {
      const { session } = await setup();
      const box = document.createElement('div');
      renderBriefing(box, session);
      t.ok(box.textContent.includes('Orientation Week'), 'title');
      t.ok(box.textContent.includes('-70.3 dBm'), 'worked example text');
      t.ok(box.textContent.includes('simplified model'), 'notice');
      t.ok(box.querySelector('[data-action="start-level"]'), 'start button');
    },
  },
  {
    id: 'UI-2',
    name: 'The running view renders 70 zones with RSSI numbers, HUD, equipment and zone details',
    async run(t) {
      const { session, els } = await setup();
      beginLevel(session);
      t.eq(session.sim.paused, true, 'level starts paused');
      t.eq(session.sim.users.length, 0, 'no users yet');
      renderAll(session, els);
      t.eq(els.panelMap.querySelectorAll('.cell-hit').length, 70, 'one click target per zone');
      t.eq(els.panelMap.querySelectorAll('.cell-num').length, 70, 'an RSSI number on every zone');
      t.ok(els.hud.textContent.includes('Budget $2,000'), 'budget shown');
      t.ok(els.hud.textContent.includes('Paused'), 'paused status shown');
      t.ok(els.equipment.textContent.includes('Place AP (0 of 3'), 'equipment panel');
      t.ok(els.zoneDetail.textContent.includes('Select a zone'), 'zone details prompt');
    },
  },
  {
    id: 'UI-3',
    name: 'After placing an AP the map shows it with its channel, the budget drops, and the table matches',
    async run(t) {
      const { session, els } = await setup();
      beginLevel(session);
      const { result, text } = perform(session, { type: 'place-ap', cell: [3, 3] });
      t.eq(result.ok, true, 'placed');
      t.ok(text.includes('channel 1'), 'feedback text names the channel');
      session.selectedZone = '3,3';
      renderAll(session, els);
      t.ok(els.panelMap.innerHTML.includes('ch1'), 'channel number drawn beside the AP');
      t.ok(els.hud.textContent.includes('Budget $1,500'), 'budget updated');
      t.ok(els.zoneDetail.textContent.includes('Covered'), 'zone details show coverage text');
      session.tab = 'table';
      renderAll(session, els);
      t.eq(els.panelTable.querySelectorAll('tbody tr').length, 70, 'zone table has a row per zone');
      const rows = zoneRows(session);
      const model = session.sim.model;
      t.eq(rows.length, model.zones.length, 'rows equal model zones');
    },
  },
  {
    id: 'UI-4',
    name: 'An over-budget purchase gives refusal text with cost and remaining budget',
    async run(t) {
      const { session } = await setup();
      beginLevel(session);
      session.sim.budget = 300;
      const { result, text } = perform(session, { type: 'place-ap', cell: [3, 3] });
      t.eq(result.ok, false, 'refused');
      t.ok(text.includes('$500') && text.includes('$300'), 'text shows cost and remaining');
    },
  },
];
