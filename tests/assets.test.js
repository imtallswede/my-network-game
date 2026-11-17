// Checks that the merged asset pack is intact and that every asset id the game code uses exists.
// Paths in the manifest are relative to assets/.

const base = '../assets/';

async function manifest() {
  const res = await fetch(`${base}manifest.json`);
  if (!res.ok) throw new Error(`manifest fetch failed: HTTP ${res.status}`);
  return res.json();
}

// Ids referenced by game code. Add to this list whenever ui/ starts using a new asset.
export const USED_ASSET_IDS = [
  'logo-wordmark',
  'ui-sound-on',
  'ui-sound-off',
  'ticket-open', 'ticket-diagnosed', 'ticket-closed', 'ticket-resolved-by-change',
  'cause-weak-signal', 'cause-ap-overloaded', 'cause-channel-interference', 'cause-uplink-congested', 'cause-uplink-down',
  'ui-hint',
];

export const tests = [
  {
    id: 'ASSET-1',
    name: 'Manifest counts match the files it lists (103 images, 53 sounds)',
    async run(t) {
      const m = await manifest();
      t.eq(m.assets.filter((a) => a.type === 'image').length, m.counts.images, 'image count');
      t.eq(m.assets.filter((a) => a.type === 'audio').length, m.counts.audio, 'audio count');
      const ids = m.assets.map((a) => a.id);
      t.eq(new Set(ids).size, ids.length, 'ids are unique');
    },
  },
  {
    id: 'ASSET-2',
    name: 'Every file listed in the manifest exists',
    async run(t) {
      const m = await manifest();
      const missing = [];
      await Promise.all(m.assets.flatMap((a) => Object.values(a.files).map(async (f) => {
        const res = await fetch(base + f, { method: 'HEAD' });
        if (!res.ok) missing.push(f);
      })));
      t.eq(missing.length, 0, `missing files: ${missing.slice(0, 5).join(', ')}`);
    },
  },
  {
    id: 'ASSET-3',
    name: 'Every image has alt text material (title and description) in the manifest',
    async run(t) {
      const m = await manifest();
      const bad = m.assets.filter((a) => a.type === 'image' && (!a.title || !a.description));
      t.eq(bad.length, 0, `images without title/description: ${bad.map((a) => a.id).join(', ')}`);
    },
  },
  {
    id: 'ASSET-4',
    name: 'Every asset id used by game code exists in the manifest',
    async run(t) {
      const m = await manifest();
      const ids = new Set(m.assets.map((a) => a.id));
      const unknown = USED_ASSET_IDS.filter((id) => !ids.has(id));
      t.eq(unknown.length, 0, `unknown ids: ${unknown.join(', ')}`);
    },
  },
];
