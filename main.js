// Entry point: load data/levels.json, validate it, and either show the content-error panel
// (blocking every level, never counted as an attempt) or start the game.
//
// Game loop: requestAnimationFrame accumulates real time scaled by speed and runs whole 0.1 s
// simulation steps. Pausing means no steps are run. All game state changes happen in engine/.

import { validateContent } from './engine/content.js';
import { createSession, tick, endWave } from './engine/state.js';
import { formatPct, ticketText, describeResolution } from './engine/feedback.js';
import { loadAssets, setSoundEnabled, isSoundEnabled, playSfx, imageUrl } from './ui/assets.js';
import {
  renderBriefing, renderAll, renderReview, renderLevelSummary, renderSessionSummary, renderRestartConfirm,
} from './ui/render.js';
import { bindControls } from './ui/controls.js';

const app = document.getElementById('app');
const feedback = document.getElementById('feedback');
const STEP_MS = 100; // one simulation step = 0.1 s of game time at 1x

function announce(text, isError = false) {
  feedback.textContent = text;
  feedback.classList.toggle('error', isError);
}

function panelErrors(title, intro, errors) {
  app.hidden = false;
  app.replaceChildren();
  const panel = document.createElement('div');
  panel.className = 'error-panel';
  panel.setAttribute('role', 'alert');
  const h = document.createElement('h2');
  h.textContent = title;
  h.tabIndex = -1;
  const p = document.createElement('p');
  p.textContent = intro;
  panel.append(h, p);
  if (errors) {
    const list = document.createElement('ul');
    for (const e of errors) {
      const li = document.createElement('li');
      li.textContent = `[${e.levelId} / ${e.itemId}] ${e.code}: ${e.message}`;
      list.appendChild(li);
    }
    panel.appendChild(list);
  }
  app.appendChild(panel);
  return { panel, h };
}

function showContentErrors(errors) {
  const { h } = panelErrors(
    'This content cannot be played',
    'The level data has errors, so no level was started and nothing was graded.',
    errors,
  );
  h.focus();
  announce(`Content error: ${errors.length} problem${errors.length === 1 ? '' : 's'} found. No level started.`, true);
}

function showLoadFailure(message) {
  const { panel } = panelErrors(
    'Levels could not be loaded',
    `${message} Serve this folder over HTTP (for example: py -m http.server 8000 --bind 127.0.0.1) and reload.`,
  );
  const retry = document.createElement('button');
  retry.type = 'button';
  retry.className = 'action';
  retry.textContent = 'Retry loading';
  retry.addEventListener('click', () => start());
  panel.appendChild(retry);
  announce('Levels could not be loaded.', true);
}

// Optional art and sound. If the pack fails to load the game still runs and the toggle stays hidden.
async function initSound() {
  const ok = await loadAssets();
  const btn = document.getElementById('sound-toggle');
  if (!ok) return false;
  const icon = document.getElementById('sound-icon');
  const label = document.getElementById('sound-label');
  const paint = () => {
    const on = isSoundEnabled();
    btn.setAttribute('aria-pressed', String(on));
    label.textContent = on ? 'Sound: on' : 'Sound: off';
    icon.src = imageUrl(on ? 'ui-sound-on' : 'ui-sound-off');
  };
  btn.hidden = false;
  btn.addEventListener('click', () => {
    setSoundEnabled(!isSoundEnabled());
    paint();
    announce(isSoundEnabled() ? 'Sound on.' : 'Sound off.');
    playSfx('sfx-ui-click');
  });
  paint();
  return true;
}

let controlsBound = false;
let loopStarted = false;

function startGame(doc) {
  const wanted = Number(new URLSearchParams(location.search).get('level')) || 1;
  const session = createSession(doc, Math.min(Math.max(wanted, 1), doc.levels.length) - 1);
  const els = {
    hud: document.getElementById('hud'),
    panelMap: document.getElementById('panel-map'),
    panelTable: document.getElementById('panel-table'),
    zoneDetail: document.getElementById('zone-detail-body'),
    equipment: document.getElementById('equipment'),
    tickets: document.getElementById('ticket-list'),
  };
  const mainPanel = document.getElementById('main-panel');
  const sidePanel = document.getElementById('side-panel');

  // One place decides what is on screen for the current view. The game panels stay visible
  // under the wave review so the player can look at the network while reading it.
  let shownKey = '';
  const render = () => {
    const v = session.view;
    const showPanels = v === 'running' || v === 'wave-review';
    mainPanel.hidden = !showPanels;
    sidePanel.hidden = !showPanels;
    if (showPanels) renderAll(session, els);
    app.hidden = v === 'running' && !session.confirmingRestart;
    let headingId = '';
    if (session.confirmingRestart) {
      renderRestartConfirm(app);
      headingId = 'confirm-title';
    } else if (v === 'wave-review') {
      renderReview(app, session);
      headingId = 'review-title';
    } else if (v === 'level-summary') {
      renderLevelSummary(app, session);
      headingId = 'summary-title';
    } else if (v === 'session-summary') {
      renderSessionSummary(app, session);
      headingId = 'summary-title';
    } else if (v === 'briefing') {
      renderBriefing(app, session);
      headingId = 'briefing-title';
    }
    // Move focus to the new heading only when the screen actually changes.
    const key = `${v}|${session.confirmingRestart}|${session.levelIndex}|${session.review ? session.review.wave : ''}`;
    if (key !== shownKey) {
      shownKey = key;
      if (headingId) document.getElementById(headingId)?.focus();
    }
  };
  const hooks = { announce, render };

  render();
  announce(`Level ${session.levelIndex + 1}: ${session.level.title}. Read the briefing, then choose Start level.`);

  if (!controlsBound) {
    bindControls(session, hooks);
    controlsBound = true;
  }

  // Fixed-step loop.
  let last = performance.now();
  let acc = 0;
  function frame(now) {
    const dt = Math.min(250, now - last);
    last = now;
    if (session.view === 'running' && !session.confirmingRestart) {
      const sim = session.sim;
      if (!sim.paused && sim.phase === 'running') {
        acc += dt * sim.speed;
        let steps = 0;
        while (acc >= STEP_MS && steps < 6) {
          acc -= STEP_MS;
          steps += 1;
          for (const ev of tick(session)) {
            if (ev.type === 'ticket-opened') {
              const tk = sim.tickets.find((x) => x.id === ev.ticketId);
              const tt = ticketText(session.level, tk);
              announce(`New ticket: ${tt.title}. ${tt.complaint}`);
            } else if (ev.type === 'ticket-closed' || ev.type === 'ticket-resolved-by-change') {
              announce(describeResolution(sim.tickets.find((x) => x.id === ev.ticketId), session.level));
            }
            if (ev.type === 'wave-ended') {
              const r = endWave(session);
              announce(r.fired
                ? `Wave ${ev.wave} review: you are fired. See the review for why.`
                : `Wave ${ev.wave} review: passed with ${formatPct(r.satisfactionPct)} campus satisfaction.`);
              render();
            }
          }
          if (sim.paused) {
            acc = 0;
            break;
          }
        }
        if (steps > 0) render();
      } else {
        acc = 0;
      }
    }
    requestAnimationFrame(frame);
  }
  if (!loopStarted) {
    loopStarted = true;
    requestAnimationFrame(frame);
  }
  window.__campusConnect = { doc, session };
}

export async function start() {
  app.hidden = false;
  app.replaceChildren();
  const loading = document.createElement('p');
  loading.id = 'loading';
  loading.textContent = 'Loading levels…';
  app.appendChild(loading);
  announce('Loading levels…');

  let doc;
  try {
    const res = await fetch('data/levels.json', { cache: 'no-cache' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    doc = await res.json();
  } catch (e) {
    showLoadFailure(`Could not read data/levels.json (${e.message}).`);
    return;
  }

  const result = validateContent(doc);
  if (!result.ok) {
    showContentErrors(result.errors);
    return;
  }
  if (doc.levels.length === 0) {
    app.replaceChildren();
    const p = document.createElement('p');
    p.textContent = 'Content loaded and valid. No levels are authored yet.';
    app.appendChild(p);
    announce(p.textContent);
    return;
  }

  await assetsReady;
  startGame(doc);
}

const assetsReady = initSound();
start();
