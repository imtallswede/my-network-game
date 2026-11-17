// Input handling: pointer and button controls plus Space to pause. Every action is also available
// as a visible button. (The full keyboard map for the map grid arrives with US4.)
// Controls never change game state directly: they call perform() and then re-render.

import {
  perform, beginLevel, continueFromReview, retryLevel, nextLevel, requestRestart, confirmRestart, cancelRestart,
} from '../engine/state.js';
import { explain } from '../engine/feedback.js';

const INTERACTIVE = new Set(['BUTTON', 'INPUT', 'SELECT', 'TEXTAREA', 'A', 'SUMMARY']);

/**
 * hooks: { render(), announce(text, isError), showGame(), showBriefing() }
 */
export function bindControls(session, hooks) {
  function run(action) {
    const { result, text } = perform(session, action);
    if (text) hooks.announce(text, !result.ok);
    hooks.render();
    return result;
  }

  function select(zoneId) {
    session.selectedZone = zoneId;
  }

  document.addEventListener('click', (e) => {
    const actEl = e.target.closest('[data-action]');
    if (actEl) {
      const a = actEl.dataset.action;
      const id = actEl.dataset.id ? Number(actEl.dataset.id) : undefined;
      switch (a) {
        case 'start-level':
          beginLevel(session);
          hooks.render();
          hooks.announce('Level ready. The clock is paused. Build, then press Resume to start the first wave.');
          return;
        case 'toggle-pause':
          run({ type: 'set-paused', paused: !session.sim.paused });
          return;
        case 'toggle-speed':
          run({ type: 'set-speed', speed: session.sim.speed === 1 ? 2 : 1 });
          return;
        case 'continue-review':
          continueFromReview(session);
          hooks.announce('Next wave started.');
          hooks.render();
          return;
        case 'retry-level':
          retryLevel(session);
          hooks.announce('Level restarted from its beginning. The clock is paused.');
          hooks.render();
          return;
        case 'next-level':
          nextLevel(session);
          hooks.render();
          return;
        case 'restart':
          requestRestart(session);
          hooks.render();
          return;
        case 'cancel-restart':
          cancelRestart(session);
          hooks.announce('Restart cancelled. Nothing changed.');
          hooks.render();
          return;
        case 'confirm-restart':
          confirmRestart(session);
          hooks.announce('Game restarted. Read the Level 1 briefing.');
          hooks.render();
          return;
        case 'tool-place-ap':
          session.tool = session.tool === 'place-ap' ? null : 'place-ap';
          hooks.announce(session.tool ? 'Place AP: click a zone inside the building.' : 'Place AP tool off.');
          hooks.render();
          return;
        case 'place-ap-at': {
          const cell = actEl.dataset.cell.split(',').map(Number);
          select(actEl.dataset.cell);
          run({ type: 'place-ap', cell });
          return;
        }
        case 'select-ticket':
          session.selectedTicket = id;
          hooks.render();
          return;
        case 'submit-diagnosis': {
          const choice = (session.choice || {})[id] || '';
          const { result, text } = perform(session, { type: 'submit-diagnosis', ticketId: id, choice });
          session.notes = session.notes || {};
          if (result.ok) {
            const e = explain(result.evaluation, { zoneLabel: result.zoneLabel });
            session.notes[id] = { ...e, kind: result.evaluation.status };
          } else {
            session.notes[id] = { headline: 'No change.', body: text, nextStep: '', kind: 'guidance' };
          }
          hooks.announce(text, !result.ok || result.evaluation.status !== 'correct');
          hooks.render();
          return;
        }
        case 'request-hint':
          run({ type: 'request-hint', ticketId: id });
          return;
        case 'remove-ap':
          run({ type: 'remove-ap', id });
          return;
        case 'upgrade-uplink':
          run({ type: 'upgrade-uplink', id });
          return;
        case 'remove-uplink':
          run({ type: 'remove-uplink', id });
          return;
        case 'buy-uplink':
          run({ type: 'buy-uplink', buildingId: actEl.dataset.building, capacityMbps: Number(actEl.dataset.cap) });
          return;
        default:
          return;
      }
    }

    const hit = e.target.closest('.cell-hit');
    if (hit && session.view === 'running' && !session.confirmingRestart) {
      const zoneId = hit.dataset.cell;
      select(zoneId);
      if (session.tool === 'place-ap') run({ type: 'place-ap', cell: zoneId.split(',').map(Number) });
      else hooks.render();
    }
  });

  // Remember which map cell has keyboard focus so it stays the single tab stop after a re-render.
  document.addEventListener('focusin', (e) => {
    const cell = e.target.closest && e.target.closest('.cell-hit');
    if (cell) session.focusCell = cell.dataset.cell;
  });

  // Settings and channel choice.
  document.addEventListener('change', (e) => {
    if (e.target.id === 'autopause') {
      session.autoPause = e.target.checked;
      run({ type: 'set-autopause', on: e.target.checked });
      return;
    }
    if (e.target.id === 'channel-select') {
      run({ type: 'set-channel', id: Number(e.target.dataset.ap), channel: Number(e.target.value) });
      return;
    }
  });

  // Choosing a cause only records the selection; Submit grades it.
  document.addEventListener('change', (e) => {
    const r = e.target.closest('input[type="radio"][data-ticket]');
    if (!r) return;
    session.choice = session.choice || {};
    session.choice[Number(r.dataset.ticket)] = r.value;
    hooks.render();
  });

  // Keyboard map (contracts/ui-controls.md). Every key also has a visible button.
  function cellAt(col, row) {
    return document.querySelector(`.cell-hit[data-cell="${col},${row}"]`);
  }

  /** Move map focus one step in a direction, skipping gaps outside the building. */
  function moveFocus(from, dc, dr) {
    const [c0, r0] = from.dataset.cell.split(',').map(Number);
    const { cols, rows } = session.level.map;
    for (let c = c0 + dc, r = r0 + dr; c >= 0 && r >= 0 && c < cols && r < rows; c += dc, r += dr) {
      const next = cellAt(c, r);
      if (next) {
        document.querySelectorAll('.cell-hit[tabindex="0"]').forEach((n) => n.setAttribute('tabindex', '-1'));
        next.setAttribute('tabindex', '0');
        next.focus();
        return;
      }
    }
  }

  function liveTickets() {
    return [...session.sim.tickets].sort((a, b) => a.id - b.id);
  }

  document.addEventListener('keydown', (e) => {
    if (session.view !== 'running' || session.confirmingRestart) return;
    if (e.ctrlKey || e.altKey || e.metaKey) return;
    const tag = e.target.tagName;
    const onCell = e.target.classList && e.target.classList.contains('cell-hit');

    // Enter on a cause radio submits the diagnosis.
    if (e.key === 'Enter' && tag === 'INPUT' && e.target.dataset.ticket) {
      e.preventDefault();
      document.querySelector(`[data-action="submit-diagnosis"][data-id="${e.target.dataset.ticket}"]`)?.click();
      return;
    }

    if (onCell) {
      const dirs = { ArrowRight: [1, 0], ArrowLeft: [-1, 0], ArrowDown: [0, 1], ArrowUp: [0, -1] };
      if (dirs[e.key]) {
        e.preventDefault();
        moveFocus(e.target, ...dirs[e.key]);
        return;
      }
      const zoneId = e.target.dataset.cell;
      const cell = zoneId.split(',').map(Number);
      const apHere = session.sim.equipment.aps.find((a) => `${a.cell[0]},${a.cell[1]}` === zoneId);
      if (e.key === 'Enter') {
        e.preventDefault();
        select(zoneId);
        if (session.tool === 'place-ap') run({ type: 'place-ap', cell });
        else hooks.render();
        return;
      }
      if (e.key === 'a' || e.key === 'A') {
        e.preventDefault();
        select(zoneId);
        run({ type: 'place-ap', cell });
        return;
      }
      if (e.key === 'Delete' || e.key === 'Backspace') {
        e.preventDefault();
        if (apHere) run({ type: 'remove-ap', id: apHere.id });
        else hooks.announce('There is no AP in this zone to remove.', true);
        return;
      }
      if (e.key === 'c' || e.key === 'C') {
        e.preventDefault();
        if (session.level.channelMode.type === 'locked') {
          hooks.announce('Channels are assigned automatically in this level.');
        } else if (!apHere) {
          hooks.announce('Put an AP in this zone first, then press C to choose its channel.', true);
        } else {
          select(zoneId);
          hooks.render();
          document.getElementById('channel-select')?.focus();
        }
        return;
      }
    }

    if (tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA') {
      if (!(tag === 'INPUT' && e.target.type === 'radio')) return;
    }

    if (e.code === 'Space') {
      if (INTERACTIVE.has(tag)) return;
      e.preventDefault();
      run({ type: 'set-paused', paused: !session.sim.paused });
    } else if (e.key === '1' || e.key === '2') {
      run({ type: 'set-speed', speed: Number(e.key) });
    } else if (e.key === 't' || e.key === 'T') {
      const list = liveTickets();
      if (!list.length) {
        hooks.announce('There are no tickets yet.');
        return;
      }
      const i = list.findIndex((tk) => tk.id === session.selectedTicket);
      session.selectedTicket = list[(i + 1) % list.length].id;
      hooks.render();
      document.getElementById('ticket-detail-h')?.focus();
    } else if (e.key === 'h' || e.key === 'H') {
      const tk = session.sim.tickets.find((x) => x.id === session.selectedTicket);
      if (!tk) hooks.announce('Select a ticket first (T), then press H for a hint.', true);
      else run({ type: 'request-hint', ticketId: tk.id });
    }
  });

  // Tabs: Map / Zone table.
  const tabs = [document.getElementById('tab-map'), document.getElementById('tab-table')];
  function showTab(name) {
    session.tab = name;
    tabs[0].setAttribute('aria-selected', String(name === 'map'));
    tabs[1].setAttribute('aria-selected', String(name === 'table'));
    tabs[0].tabIndex = name === 'map' ? 0 : -1;
    tabs[1].tabIndex = name === 'table' ? 0 : -1;
    document.getElementById('panel-map').hidden = name !== 'map';
    document.getElementById('panel-table').hidden = name !== 'table';
    hooks.render();
  }
  tabs[0].addEventListener('click', () => showTab('map'));
  tabs[1].addEventListener('click', () => showTab('table'));
  for (const [i, tab] of tabs.entries()) {
    tab.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
        const next = tabs[(i + 1) % 2];
        next.focus();
        next.click();
      }
    });
  }
  session.tab = 'map';
}
