'use strict';
const assert = require('node:assert/strict');
const { test } = require('node:test');
const C = require('../src/ro-survivors-helper.user.js');
const effect = (x = 880, y = 500) => ({ bellMat: {}, groundMat: { uniforms: { safeR: { value: 150 } } }, mesh: { position: { x, z: y } }, charge: 0, out: -1, waveAge: -1, sealed: false, toll() {}, finish() {} });
const config = C.validateConfig({});
const scene = overrides => ({ player: { x: 500, y: 500 }, enemies: [], speed: 220, target: { x: 880, y: 500 }, shelter: { x: 880, y: 500, radius: 128 }, ...overrides });

test('bell config defaults on for legacy settings and preserves explicit opt-out', () => {
  assert.equal(C.validateConfig({ dodge: true }).bellShelter, true);
  assert.equal(C.validateConfig(JSON.parse(JSON.stringify({ bellShelter: false }))).bellShelter, false);
});

test('only active native bell effects qualify; x/z map to world x/y without mutating effects', () => {
  const valid = effect(), before = JSON.stringify(valid);
  const invalid = [null, {}, { ...valid, bellMat: null }, { ...valid, toll: null }, { ...valid, finish: null },
    { ...valid, sealed: undefined }, { ...valid, waveAge: NaN }, { ...valid, charge: Infinity },
    { ...valid, out: 0 }, { ...valid, groundMat: { uniforms: { safeR: { value: 0 } } } },
    { ...valid, mesh: { position: { x: 100, z: NaN } } }];
  assert.equal(C.readBellShelters(invalid).length, 0);
  assert.deepEqual(C.readBellShelters(undefined), []);
  const [s] = C.readBellShelters([valid]);
  assert.equal(s.effect, valid); assert.equal(s.x, 880); assert.equal(s.y, 500);
  assert.equal(s.radius, 128); assert.equal(s.outerRadius, 150); assert.equal(s.struck, false);
  assert.equal(JSON.stringify(valid), before);
  valid.waveAge = 0; assert.equal(C.readBellShelters([valid])[0].struck, true);
});

test('prefer open bell, then retain same bell, then nearest bell', () => {
  const a = effect(600), b = effect(900), p = { x: 500, y: 500 };
  let list = C.readBellShelters([a, b]);
  assert.equal(C.chooseBellShelter(list, p).effect, a);
  assert.equal(C.chooseBellShelter(list, p, b).effect, b);
  b.sealed = true; list = C.readBellShelters([a, b]);
  assert.equal(C.chooseBellShelter(list, p, b).effect, a);
  assert.equal(C.chooseBellShelter([], p), null);
});

test('bell approach makes progress despite normal enemy and red-zone avoidance costs', () => {
  const best = C.planMove(scene({ enemies: [{ x: 600, y: 500, radius: 70 }], zones: [{ kind: 'circle', x: 660, y: 500, r: 80 }] }), config);
  assert(best.x > 600); assert(best.x <= 880);
  const ordinary = C.planMove(scene({ shelter: null, enemies: [{ x: 600, y: 500, radius: 70 }], zones: [{ kind: 'circle', x: 660, y: 500, r: 80 }] }), config);
  assert(ordinary.x < 500, 'ordinary loot movement still avoids danger');
});

test('inside bell every sampled segment stays within margin while still dodging nearby enemies', () => {
  const shelter = { x: 500, y: 500, radius: 128 };
  const p = { x: 620, y: 500 };
  const best = C.planMove(scene({ player: p, target: shelter, shelter, speed: 1100,
    enemies: [{ x: 610, y: 500, radius: 45 }] }), config);
  assert(best); assert(best.risk < C.planMove(scene({ player: p, target: p, shelter, speed: 40, enemies: [{ x: 610, y: 500, radius: 45 }] }), config).risk);
  for (let j = 0; j <= 20; j++) assert(Math.hypot(p.x + (best.x - p.x) * j / 20 - 500, p.y + (best.y - p.y) * j / 20 - 500) <= 128);
});

test('bell movement respects walls and map bounds and does not overshoot a nearby center', () => {
  const near = C.planMove(scene({ player: { x: 875, y: 500 }, speed: 1000 }), config);
  assert(near.x <= 880); assert.equal(near.y, 500);
  const best = C.planMove(scene({ bounds: { x0: 0, x1: 580, y0: 0, y1: 1000 }, walkable: (ax, ay, bx) => bx <= 540 }), config);
  assert(best.x <= 540);
  const blocked = C.planMove(scene({ walkable: () => false }), config);
  assert.equal(blocked, null);
});
