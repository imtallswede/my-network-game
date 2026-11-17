// Diagnosis grading (FR-015, FR-016, FR-018). Expected values come from tests/fixtures.js.
import { computeModel, causesFor, evaluateDiagnosis } from '../engine/rules.js';
import { explain } from '../engine/feedback.js';
import { CONSTANTS, MODEL_CASES, worked2, WORKED2_EXPECT, makeLevel, ap, uplink, usersAt } from './fixtures.js';

function modelOf(s) {
  return computeModel(s.level, CONSTANTS, s.equipment, s.users);
}

const ORDER = ['uplink-down', 'weak-signal', 'channel-interference', 'uplink-congested', 'ap-overloaded'];

export const tests = [
  {
    id: 'DIAG-1',
    name: 'Worked interaction: only Uplink congested is true',
    run(t) {
      const s = worked2();
      const m = modelOf(s);
      t.deepEq([...causesFor(s.zone, m)], WORKED2_EXPECT.trueCauses);
      const r = evaluateDiagnosis(s.zone, 'uplink-congested', m);
      t.eq(r.status, 'correct');
      t.deepEq(r.trueCauses, ['uplink-congested']);
      t.eq(r.reasonCode, 'accepted:uplink-congested');
      t.close(r.evidence.uplinkUtilizationPct, 180, 1e-9);
      t.eq(r.evidence.uplinkTrafficMbps, 180);
      t.eq(r.evidence.uplinkCapacityMbps, 100);
      t.close(r.evidence.sharePct, 55.5556, 0.001);
    },
  },
  {
    id: 'DIAG-2',
    name: 'Worked interaction: Weak signal is rejected with RSSI -53.0 against -67',
    run(t) {
      const s = worked2();
      const r = evaluateDiagnosis(s.zone, 'weak-signal', modelOf(s));
      t.eq(r.status, 'incorrect');
      t.eq(r.reasonCode, 'ruled-out:weak-signal');
      t.close(r.evidence.rssiDbm, -53.0, 0.01);
      t.eq(r.evidence.thresholdDbm, -67);
      const text = explain(r, { zoneLabel: 'C1' });
      t.ok(text.body.includes('−53.0'), `body cites RSSI: ${text.body}`);
      t.ok(text.body.includes('−67'), 'body cites threshold');
    },
  },
  {
    id: 'DIAG-3',
    name: 'Worked interaction: AP overloaded is rejected with AP at 60% of 100 Mbps and an upstream hint',
    run(t) {
      const s = worked2();
      const r = evaluateDiagnosis(s.zone, 'ap-overloaded', modelOf(s));
      t.eq(r.status, 'incorrect');
      t.eq(r.reasonCode, 'ruled-out:ap-overloaded');
      t.close(r.evidence.apUtilizationPct, 60, 1e-9);
      t.eq(r.evidence.apCapacityMbps, 100);
      const text = explain(r, { zoneLabel: 'C1' });
      t.ok(text.body.includes('60%'), `body cites 60%: ${text.body}`);
      t.ok(text.body.includes('100 Mbps'), 'body cites capacity');
      t.ok(/upstream|uplink/i.test(text.nextStep), `next step looks upstream: ${text.nextStep}`);
    },
  },
  {
    id: 'DIAG-4',
    name: 'Correct feedback cites 180 Mbps against 100 Mbps (180%) and 55.6% of demand',
    run(t) {
      const s = worked2();
      const r = evaluateDiagnosis(s.zone, 'uplink-congested', modelOf(s));
      const text = explain(r, { zoneLabel: 'C1' });
      t.ok(text.body.includes('180 Mbps') && text.body.includes('100 Mbps'), text.body);
      t.ok(text.body.includes('180%'), 'cites 180%');
      t.ok(text.body.includes('55.6%'), 'cites 55.6%');
    },
  },
  {
    id: 'DIAG-5',
    name: 'AP at 125%: Weak signal is rejected, AP overloaded accepted',
    run(t) {
      const c = MODEL_CASES.find((x) => x.id === 'OVERLOAD-1');
      const m = computeModel(c.level, CONSTANTS, c.equipment, c.users);
      t.eq(evaluateDiagnosis(c.zone, 'weak-signal', m).status, 'incorrect');
      t.eq(evaluateDiagnosis(c.zone, 'ap-overloaded', m).status, 'correct');
      t.eq(evaluateDiagnosis(c.zone, 'channel-interference', m).status, 'incorrect');
    },
  },
  {
    id: 'DIAG-6',
    name: 'Uncovered zone: only Weak signal is true',
    run(t) {
      const c = MODEL_CASES.find((x) => x.id === 'COV-3');
      const m = computeModel(c.level, CONSTANTS, c.equipment, c.users);
      t.deepEq([...causesFor(c.zone, m)], ['weak-signal']);
    },
  },
  {
    id: 'DIAG-7',
    name: 'Several true causes: any is accepted and all are listed in fix order',
    run(t) {
      // AP 1 and AP 2 (channels 1 and 3) sit 5 m apart, so they conflict. 30 Video users in zone 0,1
      // demand 150 Mbps: over full capacity (overloaded) and over the halved capacity (interference).
      const level = makeLevel();
      const equipment = { aps: [ap(1, [0, 0], 1), ap(2, [1, 0], 3)], uplinks: [uplink(1, 'b', 1000)] };
      const m = computeModel(level, CONSTANTS, equipment, usersAt([0, 1], 'video', 30));
      const causes = causesFor('0,1', m);
      t.ok(causes.has('ap-overloaded'), 'ap-overloaded true');
      t.ok(causes.has('channel-interference'), 'interference true');
      const r = evaluateDiagnosis('0,1', 'ap-overloaded', m);
      t.eq(r.status, 'correct');
      t.deepEq(r.trueCauses, ORDER.filter((c) => causes.has(c)));
      t.eq(evaluateDiagnosis('0,1', 'channel-interference', m).status, 'correct');
      const text = explain(r, { zoneLabel: 'A2' });
      t.ok(text.body.includes('Channel interference'), 'lists every true cause');
    },
  },
  {
    id: 'DIAG-8',
    name: 'Channel interference needs a conflict and demand over the halved capacity',
    run(t) {
      const level = makeLevel();
      const equipment = { aps: [ap(1, [0, 0], 1), ap(2, [1, 0], 3)], uplinks: [uplink(1, 'b', 1000)] };
      // 10 Video users = 50 Mbps against 50 Mbps effective capacity: exactly 100%, not over.
      const m = computeModel(level, CONSTANTS, equipment, usersAt([0, 1], 'video', 10));
      t.eq(causesFor('0,1', m).has('channel-interference'), false);
      // 11 Video users = 55 Mbps: over.
      const m2 = computeModel(level, CONSTANTS, equipment, usersAt([0, 1], 'video', 11));
      t.eq(causesFor('0,1', m2).has('channel-interference'), true);
    },
  },
  {
    id: 'DIAG-9',
    name: 'Building with no working uplink: Uplink down is true',
    run(t) {
      const level = makeLevel();
      const equipment = { aps: [ap(1, [0, 0], 1)], uplinks: [uplink(1, 'b', 100, 'failed')] };
      const m = computeModel(level, CONSTANTS, equipment, usersAt([1, 0], 'light', 2));
      t.ok(causesFor('1,0', m).has('uplink-down'));
      t.eq(evaluateDiagnosis('1,0', 'uplink-down', m).status, 'correct');
    },
  },
  {
    id: 'DIAG-10',
    name: 'Missing or unknown choice is invalid-input; content errors are never graded',
    run(t) {
      const s = worked2();
      const m = modelOf(s);
      t.eq(evaluateDiagnosis(s.zone, '', m).status, 'invalid-input');
      t.eq(evaluateDiagnosis(s.zone, undefined, m).status, 'invalid-input');
      t.eq(evaluateDiagnosis(s.zone, 'dns', m).status, 'invalid-input');
      t.eq(evaluateDiagnosis('99,99', 'weak-signal', m).status, 'invalid-input');
      const bad = { ...m, contentErrors: [{ code: 'PATH_AMBIGUOUS', message: 'x' }] };
      t.eq(evaluateDiagnosis(s.zone, 'weak-signal', bad).status, 'content-error');
    },
  },
];
