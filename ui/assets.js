// Asset loader: images and sound from assets/manifest.json.
//
// Rules (assets/README.md, spec FR-036 and FR-039):
//  - Art and sound are optional enhancements. If the manifest or a file cannot load, the game still
//    works; nothing here may throw into game code.
//  - Sound is OFF by default, never carries information alone, and every sound has an on-screen
//    text equivalent supplied by the caller (see soundCaption()).
//  - Paths come from the manifest and are relative to assets/. Keep file names lower-case.

const BASE = 'assets/';

let manifest = null;
const byId = new Map();
let soundEnabled = false;
let musicEl = null;
let musicId = null;
let ducked = false;
const sfxCache = new Map();

/** Load the manifest once. Resolves to true when art/sound are available. */
export async function loadAssets() {
  if (manifest) return true;
  try {
    const res = await fetch(`${BASE}manifest.json`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    manifest = await res.json();
    for (const a of manifest.assets) byId.set(a.id, a);
    return true;
  } catch (e) {
    console.warn(`Assets unavailable: ${e.message}`);
    manifest = null;
    return false;
  }
}

export function assetsLoaded() {
  return manifest !== null;
}

export function assetInfo(id) {
  const a = byId.get(id);
  if (!a && manifest) console.warn(`Unknown asset id: ${id}`);
  return a || null;
}

/** URL of an image asset, SVG by default (crisp at any size) or 'png'. Null if unknown. */
export function imageUrl(id, format = 'svg') {
  const a = assetInfo(id);
  if (!a || a.type !== 'image') return null;
  const file = a.files[format] || a.files.svg || a.files.png;
  return file ? BASE + file : null;
}

/**
 * An <img> for an image asset. Pass `decorative: true` when the same meaning is already in text
 * beside it (the usual case: an icon next to a label or a number), so assistive technology does
 * not read it twice. Otherwise the alt text is the asset's title from the manifest.
 */
export function imageEl(id, { alt, decorative = false, size, className } = {}) {
  const img = document.createElement('img');
  const url = imageUrl(id);
  if (!url) {
    img.hidden = true;
    img.alt = '';
    return img;
  }
  img.src = url;
  img.alt = decorative ? '' : (alt ?? assetInfo(id).title);
  if (size) {
    img.width = size;
    img.height = size;
  }
  if (className) img.className = className;
  img.decoding = 'async';
  return img;
}

/** Text equivalent for a sound: the manifest title, e.g. "Access point placed". */
export function soundCaption(id) {
  const a = assetInfo(id);
  return a && a.type === 'audio' ? a.title : '';
}

// ---- Sound ----------------------------------------------------------------------------------

function preferredFormat() {
  const probe = document.createElement('audio');
  return probe.canPlayType && probe.canPlayType('audio/ogg; codecs="vorbis"') ? 'ogg' : 'mp3';
}

function soundUrl(id) {
  const a = assetInfo(id);
  if (!a || a.type !== 'audio') return null;
  const file = a.files[preferredFormat()] || a.files.mp3 || a.files.ogg;
  return file ? BASE + file : null;
}

export function isSoundEnabled() {
  return soundEnabled;
}

export function setSoundEnabled(on) {
  soundEnabled = Boolean(on);
  if (!soundEnabled) stopMusic();
  else if (musicId) playMusic(musicId);
  return soundEnabled;
}

/** Play a sound effect. Does nothing while sound is off or the asset is missing. */
export function playSfx(id) {
  if (!soundEnabled) return;
  const url = soundUrl(id);
  if (!url) return;
  let base = sfxCache.get(id);
  if (!base) {
    base = new Audio(url);
    base.preload = 'auto';
    sfxCache.set(id, base);
  }
  const node = base.cloneNode();
  node.volume = Math.min(1, assetInfo(id).suggested_volume ?? 0.7);
  node.play().catch(() => {});
}

/** Start a looping music or ambience track (replaces the current one). */
export function playMusic(id) {
  musicId = id;
  if (!soundEnabled) return;
  const url = soundUrl(id);
  if (!url) return;
  if (musicEl) musicEl.pause();
  musicEl = new Audio(url);
  musicEl.loop = Boolean(assetInfo(id).loop);
  musicEl.volume = (assetInfo(id).suggested_volume ?? 0.4) * (ducked ? 0.25 : 1);
  musicEl.play().catch(() => {});
}

export function stopMusic() {
  if (musicEl) {
    musicEl.pause();
    musicEl = null;
  }
}

/** Lower the music while the game is paused (assets/README.md). */
export function duckMusic(on) {
  ducked = Boolean(on);
  if (musicEl && musicId) musicEl.volume = (assetInfo(musicId).suggested_volume ?? 0.4) * (ducked ? 0.25 : 1);
}
