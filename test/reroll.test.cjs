'use strict';
const assert = require('node:assert/strict');
const { test } = require('node:test');
const fs = require('node:fs');
const { JSDOM, VirtualConsole } = require('jsdom');
const C = require('../src/ro-survivors-helper.user.js');
const source = fs.readFileSync(require.resolve('../src/ro-survivors-helper.user.js'), 'utf8');
const STORAGE = 'ro-survivors-helper.settings.v1';
const cfg = overrides => C.validateConfig({ ...C.DEFAULTS, ...overrides });
const cards = [
  { id: 'p_hp', name: '生命藥水', slot: 'potion', rarity: 3, index: 0, canReroll: true },
  { id: 'e_dmg', name: '傷害秘藥', slot: 'elixir', rarity: 0, index: 1, canReroll: true },
];
const budget = { used: 0, card: 9, deck: 9 };
const priorities = { potion: 'p_cd', elixir: 'e_crit\ne_dmg' };

test('v1.3.0 settings retain skill toggle, chest strategy and reserves; new chest toggle defaults on', () => {
  const old = cfg({ skillReroll: false, rerollMode: 'off', reserveDeck: 3 });
  assert.equal(old.skillReroll, false);
  assert.equal(old.chestReroll, true);
  assert.equal(old.rerollMode, 'off');
  assert.equal(old.reserveDeck, 3);
  assert.equal(cfg({}).skillReroll, true);
  assert.equal(cfg({ skillReroll: 'false', chestReroll: 0 }).chestReroll, true);
});

for (const skillReroll of [false, true]) for (const chestReroll of [false, true]) {
  test(`independent settings round trip: skill=${skillReroll}, chest=${chestReroll}`, () => {
    const saved = cfg({ skillReroll, chestReroll });
    const restored = C.validateConfig(JSON.parse(JSON.stringify(saved)));
    assert.equal(restored.skillReroll, skillReroll);
    assert.equal(restored.chestReroll, chestReroll);
    const decision = C.chestDecision(cards, { ...restored, priorities }, budget, true);
    assert.equal(decision.type, chestReroll ? 'card' : 'pick');
    if (!chestReroll) assert.equal(decision.card.id, 'e_dmg');
  });
}

for (const rerollMode of ['card-deck', 'deck-card', 'card', 'deck', 'off']) {
  test(`chest toggle blocks both reroll types with strategy ${rerollMode}`, () => {
    const decision = C.chestDecision(cards, cfg({ priorities, chestReroll: false, rerollMode }), budget, true);
    assert.equal(decision.type, 'pick');
    assert.equal(decision.card.id, 'e_dmg');
  });
}

test('disabled chest reroll preserves manual fallback when no first tier matches', () => {
  assert.equal(C.chestDecision(cards, cfg({ priorities, chestReroll: false, exhausted: 'wait' }), budget, true).type, 'wait');
  const matched = [{ ...cards[0], id: 'p_cd' }];
  assert.equal(C.chestDecision(matched, cfg({ priorities, chestReroll: false, exhausted: 'wait' }), budget, true).type, 'pick');
});

test('enabled chest reroll still obeys mode, budgets, reserves, limits and first tier stop', () => {
  const options = cfg({ priorities });
  assert.equal(C.chestDecision(cards, options, budget, true).type, 'card');
  assert.equal(C.chestDecision(cards, { ...options, rerollMode: 'deck' }, budget, true).type, 'deck');
  for (const overrides of [{ rerollMode: 'off' }, { maxRerolls: 0 }, { reserveCard: 9, reserveDeck: 9 }])
    assert.equal(C.chestDecision(cards, { ...options, ...overrides }, budget, true).type, 'pick');
  assert.equal(C.chestDecision(cards, options, { used: 0, card: 0, deck: 0 }, true).type, 'pick');
  assert.equal(C.chestDecision(cards, options, { ...budget, used: 6 }, true).type, 'pick');
  assert.equal(C.chestDecision(cards, cfg(), budget, true).type, 'pick');
  assert.equal(C.chestDecision([{ ...cards[0], id: 'p_cd' }], options, budget, true).type, 'pick');
});

// Mount the actual userscript in a DOM and drive its interval and click handlers.
// Game hooks and picker markup are fixtures; no game/network operations run here.
async function browserFixture(saved = {}) {
  const errors = [];
  const console = new VirtualConsole();
  console.on('jsdomError', error => errors.push(error));
  console.on('error', (...args) => errors.push(args));
  const dom = new JSDOM(`<!doctype html><html><head><style>.hidden{display:none}</style>
    <link rel="modulepreload" href="/assets/soul_linker-fixture.js"></head><body>
    <div id="picker" class="hidden"><h2 id="pk-title"></h2><div id="pk-cards"></div><div id="pk-bar"></div></div>
    </body></html>`, { url: 'https://ro.hans-webgametw.com/', runScripts: 'outside-only', pretendToBeVisual: true, virtualConsole: console });
  const w = dom.window;
  let now = 0, timerId = 0;
  const intervals = new Map();
  w.setInterval = (fn, ms) => { const id = ++timerId; intervals.set(id, { fn, ms }); return id; };
  w.clearInterval = id => intervals.delete(id);
  Object.defineProperty(w.performance, 'now', { value: () => now });
  w.localStorage.setItem(STORAGE, JSON.stringify({ background: false, dodge: false, pickups: false, ...saved }));
  const hooks = { start: [], tick: [], hurt: [], cast: [], kill: [] };
  const registry = Object.fromEntries([...C.FIXED, 'soul_strike', 'napalm'].map(id => [id, { name: ({ firebolt: '火箭術', coldbolt: '冰箭術', lightning: '雷擊術', soul_strike: '聖靈召喚', napalm: '心靈爆破' })[id] }]));
  const items = { p_cd: { id: 'p_cd', slot: 'potion', name: '冷卻藥水' }, p_hp: { id: 'p_hp', slot: 'potion', name: '生命藥水' }, e_dmg: { id: 'e_dmg', slot: 'elixir', name: '傷害秘藥' } };
  w.__testImport = async () => ({ hooks, registry, items });
  w.eval(source.replace('await import(urls[0])', 'await window.__testImport(urls[0])'));
  await new Promise(resolve => setImmediate(resolve));
  const ui = w.document.querySelector('#ro-survivors-helper-host').shadowRoot;
  assert.equal(hooks.tick.length, 1, 'game bridge connected');
  const game = { player: { x: 500, y: 500, dead: false }, enemies: [], pickups: [], moveTo() {}, slots: [...C.FIXED, 'soul_strike'], state: 'levelup', perksLeft: { reroll: 9, reroll_card: 9 } };
  hooks.tick[0](game);
  if (!JSON.parse(w.localStorage.getItem(STORAGE)).enabled) ui.querySelector('#toggle').click();
  function setting(key, value) {
    const element = ui.querySelector(`[data-setting="${key}"]`);
    if (element.type === 'checkbox') element.checked = value; else element.value = value;
    element.dispatchEvent(new w.Event('change', { bubbles: true }));
  }
  function advance(ms) { now += ms; for (const timer of intervals.values()) if (timer.ms === 100 || timer.ms === 500) timer.fn(); }
  function picker(kind, { eligible = false, cardDisabled = false, deckDisabled = false } = {}) {
    const counts = { card: 0, deck: 0, pick: 0 };
    const element = w.document.querySelector('#picker');
    game.state = 'levelup';
    element.classList.remove('hidden');
    element.querySelector('#pk-title').textContent = kind === 'skill' ? 'Level Up!' : '寶箱';
    element.querySelector('#pk-cards').innerHTML = `<div class="pk-slot"><button class="pk-card">
      <span class="pk-name">${kind === 'skill' ? eligible ? '火箭術' : '心靈爆破' : '生命藥水'}</span>
      <span class="pk-sub">${kind === 'chest' ? '藥水' : ''}</span><span class="pk-badge">傳說</span><span class="pk-lines">傷害</span>
      ${kind === 'skill' && !eligible ? '<span class="pk-ribbon">新</span>' : ''}</button>
      <button class="pk-act" title="重抽單張" ${cardDisabled ? 'disabled' : ''}>重抽<small>9</small></button></div>`;
    element.querySelector('#pk-bar').innerHTML = `<button class="pk-act" title="重抽整組" ${deckDisabled ? 'disabled' : ''}>重抽<small>9</small></button>`;
    element.querySelector('#pk-cards .pk-act').onclick = () => counts.card++;
    element.querySelector('#pk-bar .pk-act').onclick = () => counts.deck++;
    element.querySelector('.pk-card').onclick = () => { counts.pick++; element.classList.add('hidden'); };
    ui.querySelector('#rescan').click();
    advance(100); advance(1100);
    return counts;
  }
  return { w, ui, game, setting, advance, picker, errors, close() { assert.deepEqual(errors, []); dom.window.close(); } };
}

for (const skillReroll of [false, true]) for (const chestReroll of [false, true]) {
  test(`actual picker clicks obey independent checkboxes: skill=${skillReroll}, chest=${chestReroll}`, async () => {
    const f = await browserFixture({ priorities: { potion: 'p_cd' } });
    try {
      for (const [key, value] of Object.entries({ skillReroll, chestReroll })) f.setting(key, value);
      assert.equal(f.ui.querySelectorAll('[data-setting="skillReroll"]').length, 1);
      assert.equal(f.ui.querySelectorAll('[data-setting="chestReroll"]').length, 1);
      assert.equal(f.ui.querySelector('[data-setting="skillReroll"]').closest('details'), f.ui.querySelector('[data-setting="chestReroll"]').closest('details'));
      assert.deepEqual(f.picker('skill'), { card: 0, deck: Number(skillReroll), pick: 0 });
      assert.deepEqual(f.picker('chest'), { card: Number(chestReroll), deck: 0, pick: Number(!chestReroll) });
      f.setting('rerollMode', 'deck');
      assert.deepEqual(f.picker('chest'), { card: 0, deck: Number(chestReroll), pick: Number(!chestReroll) });
    } finally { f.close(); }
  });
}

test('skill reroll off still selects eligible upgrades, otherwise waits', async () => {
  const f = await browserFixture({ skillReroll: false });
  try {
    assert.deepEqual(f.picker('skill', { eligible: true }), { card: 0, deck: 0, pick: 1 });
    assert.deepEqual(f.picker('skill'), { card: 0, deck: 0, pick: 0 });
  } finally { f.close(); }
});

test('skill reroll on obeys maximum, reserve and disabled deck button', async () => {
  const f = await browserFixture();
  try {
    f.setting('maxRerolls', 0);
    assert.equal(f.picker('skill').deck, 0);
    f.setting('maxRerolls', 6); f.setting('reserveDeck', 9);
    assert.equal(f.picker('skill').deck, 0);
    f.setting('reserveDeck', 0);
    assert.equal(f.picker('skill', { deckDisabled: true }).deck, 0);
    assert.equal(f.picker('skill').deck, 1);
  } finally { f.close(); }
});

test('checkbox changes survive export, page reload, import and default migration', async () => {
  const f = await browserFixture({ skillReroll: false, rerollMode: 'deck-card' });
  let stored;
  try {
    assert.equal(f.ui.querySelector('[data-setting="skillReroll"]').checked, false);
    assert.equal(f.ui.querySelector('[data-setting="chestReroll"]').checked, true);
    f.setting('chestReroll', false);
    f.ui.querySelector('#export').click();
    const exported = JSON.parse(f.ui.querySelector('#config').value);
    assert.equal(exported.skillReroll, false); assert.equal(exported.chestReroll, false);
    assert.equal(exported.rerollMode, 'deck-card');
    stored = JSON.parse(f.w.localStorage.getItem(STORAGE));
    f.ui.querySelector('#config').value = JSON.stringify({ ...exported, skillReroll: true, chestReroll: false });
    f.ui.querySelector('#import').click();
    assert.equal(f.ui.querySelector('[data-setting="skillReroll"]').checked, true);
    assert.equal(f.ui.querySelector('[data-setting="chestReroll"]').checked, false);
    assert.equal(JSON.parse(f.w.localStorage.getItem(STORAGE)).enabled, false);
  } finally { f.close(); }
  const reload = await browserFixture(stored);
  try {
    assert.equal(reload.ui.querySelector('[data-setting="skillReroll"]').checked, false);
    assert.equal(reload.ui.querySelector('[data-setting="chestReroll"]').checked, false);
  } finally { reload.close(); }
});
