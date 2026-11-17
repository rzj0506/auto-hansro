'use strict';
const assert = require('node:assert/strict');
const { test } = require('node:test');
const C = require('../src/ro-survivors-helper.user.js');
const native = require('./fixtures/native-stages.json');
const stages = cleared => native.stages.map((s, index) => ({ ...s, index, locked: false, cleared: cleared.includes(s.id) }));
const config = patch => C.validateConfig({ progression: true, expeditionLap: 4, expedition: 'payon_cave', ...patch });
const laps = Array.from({ length: 6 }, (_, i) => ({ lap: i + 1, locked: false }));

test('current native data matches all twelve map IDs, six lap labels and suffixes', () => {
  assert.deepEqual(C.STAGES.map(s => s[0]), native.stages.map(s => s.id));
  assert.equal(native.config.max, 6); assert.deepEqual(C.LAP_LABELS, native.config.label);
  assert.deepEqual(C.LAP_SUFFIXES, native.config.suffix);
  assert.equal(native.stages.find(s => s.id === 'prt_castle').storyOnly, true);
  assert.deepEqual(native.stages.filter(s => s.special).map(s => s.id), ['xmas', 'louyang']);
});

test('legacy settings keep fixed farming; laps four to six and future native tabs survive config round trips', () => {
  assert.equal(C.validateConfig({ repeat: true }).progression, false);
  for (const lap of [1, 2, 3, 4, 5, 6, 7]) assert.equal(C.validateConfig(JSON.parse(JSON.stringify({ expeditionLap: lap, progression: true }))).expeditionLap, lap);
  for (const lap of [0, -1, 1.1, 100, Infinity, 'not-a-lap']) assert.equal(C.validateConfig({ expeditionLap: lap }).expeditionLap, 1);
});

test('uncleared map is retried even when later maps are unlocked; fixed farming always retains its map', () => {
  const list = stages([]);
  assert.equal(C.nextExpedition(list, config(), laps).stage.id, 'payon_cave');
  assert.equal(C.nextExpedition(stages(['payon_cave']), config({ progression: false }), laps).stage.id, 'payon_cave');
  assert.equal(C.nextExpedition(list, config({ repeat: false }), laps).stage.id, 'payon_cave');
});

test('later laps skip story-only castle; first lap retains the story map', () => {
  const list = stages(['payon_cave']);
  assert.equal(C.nextExpedition(list, config(), laps).stage.id, 'orcs');
  assert.equal(C.nextExpedition(list, config({ expeditionLap: 1 }), laps).stage.id, 'prt_castle');
  assert.equal(C.nextExpedition(list, config({ expedition: 'prt_castle' }), laps).stage.id, 'orcs');
});

test('already cleared maps are skipped, but a locked next target is retained rather than bypassed', () => {
  const list = stages(['payon_cave', 'orcs']); list.find(s => s.id === 'pyramid').locked = true;
  const result = C.nextExpedition(list, config(), laps);
  assert.equal(result.stage.id, 'pyramid'); assert.equal(result.stage.locked, true);
});

test('new special maps follow maze in native order before crossing laps', () => {
  assert.equal(C.nextExpedition(stages(['maze']), config({ expedition: 'maze' }), laps).stage.id, 'xmas');
  assert.equal(C.nextExpedition(stages(['xmas']), config({ expedition: 'xmas' }), laps).stage.id, 'louyang');
});

test('completing the selected tail switches to the first map of the next unlocked lap', () => {
  const result = C.nextExpedition(stages(['louyang']), config({ expedition: 'louyang' }), laps);
  assert.equal(result.type, 'lap'); assert.equal(result.lap, 5); assert.equal(result.stage.id, 'prontera');
});

test('absent or disabled next lap waits, sixth lap finishes, and future native seventh lap can continue', () => {
  const list = stages(['louyang']);
  assert.equal(C.nextExpedition(list, config({ expedition: 'louyang' }), laps.slice(0, 4)).type, 'wait');
  assert.equal(C.nextExpedition(list, config({ expedition: 'louyang' }), laps.map(l => ({ ...l, locked: l.lap === 5 }))).type, 'wait');
  assert.equal(C.nextExpedition(list, config({ expedition: 'louyang', expeditionLap: 6 }), laps).type, 'complete');
  assert.equal(C.nextExpedition(list, config({ expedition: 'louyang', expeditionLap: 6 }), [...laps, { lap: 7 }]).lap, 7);
});

test('unknown map or empty native list never advances, and unknown clear state never counts as victory', () => {
  assert.equal(C.nextExpedition([], config(), laps).type, 'wait');
  assert.equal(C.nextExpedition(stages([]), config({ expedition: 'missing' }), laps).type, 'wait');
  const list = stages([]); delete list.find(s => s.id === 'payon_cave').cleared;
  assert.equal(C.nextExpedition(list, config(), laps).stage.id, 'payon_cave');
});
