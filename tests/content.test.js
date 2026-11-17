import { validateContent } from '../engine/content.js';
import { validDoc, CORNER_WALL } from './fixtures.js';

const codes = (doc) => validateContent(doc).errors.map((e) => e.code);

function mutated(fn) {
  const d = validDoc();
  fn(d, d.levels[0]);
  return d;
}

export const tests = [
  {
    id: 'CONTENT-0',
    name: 'A valid document passes',
    run(t) {
      const r = validateContent(validDoc());
      t.eq(r.ok, true, JSON.stringify(r.errors));
    },
  },
  {
    id: 'CONTENT-1',
    name: 'Channel 13 is rejected with level and item IDs',
    run(t) {
      const doc = mutated((d, l) => {
        l.startingEquipment.aps = [{ id: 1, cell: [0, 0], channel: 13 }];
      });
      const r = validateContent(doc);
      const e = r.errors.find((x) => x.code === 'CHANNEL_RANGE');
      t.ok(e, 'CHANNEL_RANGE expected');
      t.eq(e.levelId, 'L-test', 'level id');
      t.ok(e.itemId.length > 0, 'item id');
    },
  },
  {
    id: 'CONTENT-2',
    name: 'A locked channel list other than 1/6/11 is rejected',
    run(t) {
      const doc = mutated((d, l) => { l.channelMode = { type: 'locked', channels: [1, 5, 11] }; });
      t.ok(codes(doc).includes('CHANNEL_LIST'));
    },
  },
  {
    id: 'CONTENT-3',
    name: 'A wall line through a grid corner is rejected as ambiguous',
    run(t) {
      const doc = mutated((d, l) => { l.map.walls = [CORNER_WALL]; });
      t.ok(codes(doc).includes('WALL_AMBIGUOUS'));
    },
  },
  {
    id: 'CONTENT-4',
    name: 'A wall that spans the building edge to edge is accepted',
    run(t) {
      const doc = mutated((d, l) => {
        l.map.walls = [{ a: [3, 0], b: [3, 1], type: 'drywall' }, { a: [3, 1], b: [3, 2], type: 'drywall' }, { a: [3, 2], b: [3, 3], type: 'drywall' }];
      });
      const r = validateContent(doc);
      t.eq(r.ok, true, JSON.stringify(r.errors.slice(0, 2)));
    },
  },
  {
    id: 'CONTENT-5',
    name: 'A zone outside any building is rejected (arrival and ticket)',
    run(t) {
      const a = mutated((d, l) => { l.waves[0].arrivals[0].zones = [[9, 9]]; });
      t.ok(codes(a).includes('ZONE_OUTSIDE_BUILDING'), 'arrival zone');
      const b = mutated((d, l) => { l.tickets = [{ zone: [9, 9], title: 'x', complaint: 'y' }]; });
      t.ok(codes(b).includes('ZONE_OUTSIDE_BUILDING'), 'ticket zone');
    },
  },
  {
    id: 'CONTENT-6',
    name: 'A zone listed in two buildings and a zone off the map are rejected',
    run(t) {
      const dup = mutated((d, l) => { l.map.buildings.push({ id: 'b2', name: 'Two', zones: [[0, 0]], startingUplinks: [] }); });
      t.ok(codes(dup).includes('ZONE_DUP'), 'duplicate zone');
      const off = mutated((d, l) => { l.map.buildings[0].zones.push([50, 50]); });
      t.ok(codes(off).includes('ZONE_OUT_OF_MAP'), 'off-map zone');
    },
  },
  {
    id: 'CONTENT-7',
    name: 'Duplicate level and building IDs are rejected',
    run(t) {
      const lv = mutated((d) => { d.levels.push(structuredClone(d.levels[0])); });
      t.ok(codes(lv).includes('DUP_ID'), 'level');
      const bd = mutated((d, l) => { l.map.buildings.push({ id: 'b', name: 'Dup', zones: [], startingUplinks: [] }); });
      t.ok(codes(bd).includes('DUP_ID'), 'building');
    },
  },
  {
    id: 'CONTENT-8',
    name: 'A level must have exactly three waves with positive counts',
    run(t) {
      const two = mutated((d, l) => { l.waves.pop(); });
      t.ok(codes(two).includes('WAVE_COUNT'), 'two waves');
      const zero = mutated((d, l) => { l.waves[0].arrivals[0].count = 0; });
      t.ok(codes(zero).includes('WAVE_COUNT_VALUE'), 'zero count');
    },
  },
  {
    id: 'CONTENT-9',
    name: 'Missing source references and unknown failure buildings are rejected',
    run(t) {
      const src = mutated((d, l) => { l.briefing.sourceIds = ['nope']; });
      t.ok(codes(src).includes('SOURCE_REF'), 'source ref');
      const fail = mutated((d, l) => { l.failures = [{ wave: 2, atSteps: 300, building: 'ghost', uplinkIndex: 0 }]; });
      t.ok(codes(fail).includes('FAILURE_REF'), 'failure ref');
    },
  },
  {
    id: 'CONTENT-10',
    name: 'Unaffordable or over-limit starting equipment is rejected',
    run(t) {
      const rich = mutated((d, l) => {
        l.budget = 400;
        l.startingEquipment.aps = [{ id: 1, cell: [0, 0], channel: 1 }];
      });
      t.ok(codes(rich).includes('EQUIP_UNAFFORDABLE'), 'over budget');
      const many = mutated((d, l) => {
        l.apLimit = 0;
        l.startingEquipment.aps = [{ id: 1, cell: [0, 0], channel: 1 }];
      });
      t.ok(codes(many).includes('EQUIP_UNAFFORDABLE'), 'over AP limit');
    },
  },
  {
    id: 'CONTENT-11',
    name: 'A verified source needs a url and a section; schemaVersion is checked',
    run(t) {
      const v = mutated((d) => { d.sources[0] = { id: 's1', title: 't', url: '', section: '', claim: 'c', status: 'verified' }; });
      t.ok(codes(v).includes('SOURCE_UNVERIFIED'), 'unverified');
      const sv = mutated((d) => { d.schemaVersion = 2; });
      t.ok(codes(sv).includes('SCHEMA_VERSION'), 'schema');
    },
  },
  {
    id: 'CONTENT-12',
    name: 'The shipped data/levels.json validates',
    async run(t) {
      const res = await fetch('../data/levels.json');
      t.ok(res.ok, 'fetch levels.json');
      const r = validateContent(await res.json());
      t.eq(r.ok, true, JSON.stringify(r.errors.slice(0, 3)));
    },
  },
];
