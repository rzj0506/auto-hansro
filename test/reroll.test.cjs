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
  const timers = new Map();
  w.setInterval = (fn, ms) => { const id = ++timerId; intervals.set(id, { fn, ms }); return id; };
  w.clearInterval = id => intervals.delete(id);
  w.setTimeout = (fn, ms) => { const id = ++timerId; timers.set(id, { fn, at: now + ms }); return id; };
  w.clearTimeout = id => timers.delete(id);
  Object.defineProperty(w.performance, 'now', { value: () => now });
  w.localStorage.setItem(STORAGE, JSON.stringify({ background: false, dodge: false, pickups: false, ...saved }));
  const hooks = { start: [], tick: [], hurt: [], cast: [], kill: [] };
  const registry = Object.fromEntries([...C.FIXED, 'soul_strike', 'napalm'].map(id => [id, { name: ({ firebolt: '火箭術', coldbolt: '冰箭術', lightning: '雷擊術', soul_strike: '聖靈召喚', napalm: '心靈爆破' })[id] }]));
  const items = { p_cd: { id: 'p_cd', slot: 'potion', name: '冷卻藥水' }, p_hp: { id: 'p_hp', slot: 'potion', name: '生命藥水' }, p_dmg: { id: 'p_dmg', slot: 'potion', name: '傷害藥水' }, p_area: { id: 'p_area', slot: 'potion', name: '範圍藥水' }, e_dmg: { id: 'e_dmg', slot: 'elixir', name: '傷害秘藥' }, e_hp: { id: 'e_hp', slot: 'elixir', name: '生命秘藥' }, b_dmg: { id: 'b_dmg', slot: 'blessing', name: '傷害祝福' } };
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
  function advance(ms, runIntervals = true) { now += ms; for (const [id, timer] of [...timers]) if (timer.at <= now) { timers.delete(id); timer.fn(); } if (runIntervals) for (const timer of intervals.values()) if (timer.ms === 100 || timer.ms === 500) timer.fn(); }
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
  return { w, ui, game, hooks, items, setting, advance, picker, errors, close() { assert.deepEqual(errors, []); dom.window.close(); } };
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

test('fill missing chest slots before upgrades, while retaining first-tier reroll and exhaustion fallback', () => {
  const owned = { blessing: { level: 4 }, dish: { level: 11 }, deity: { level: 13 } };
  const offer = [
    { id: 'd_int', slot: 'dish', name: 'INT', rarity: 3, index: 0, canReroll: true },
    { id: 'p_hp', slot: 'potion', name: 'HP', rarity: 0, index: 1, canReroll: true },
    { id: 'e_dmg', slot: 'elixir', name: 'Damage', rarity: 1, index: 2, canReroll: true },
  ];
  const options = cfg({ priorities: { dish: 'd_int', potion: 'p_hp', elixir: 'e_dmg' } });
  assert.equal(C.chestDecision(offer, options, budget, true, [], owned).card.id, 'e_dmg');
  assert.equal(C.chestDecision(offer, { ...options, chestFillFirst: false }, budget, true, [], owned).card.id, 'd_int');
  const misses = cfg({ priorities: { dish: 'd_agi', potion: 'p_cd', elixir: 'e_crit' } });
  assert.equal(C.chestDecision(offer, misses, budget, true, [], owned).type, 'card');
  assert.equal(C.chestDecision(offer, misses, { ...budget, used: 6 }, true, [], owned).card.id, 'e_dmg');
  assert.equal(C.chestDecision(offer, { ...misses, exhausted: 'wait' }, { ...budget, used: 6 }, true, [], owned).type, 'wait');
});

test('filled chest slots upgrade lower levels within the same priority tier', () => {
  const owned = Object.fromEntries(['potion','elixir','blessing','dish','deity'].map((slot, i) => [slot, { level: i + 1 }]));
  const offer = [{ id: 'g', slot: 'deity', rarity: 3, index: 0 }, { id: 'p', slot: 'potion', rarity: 0, index: 1 }];
  assert.equal(C.rankChest(offer, cfg(), owned)[0].id, 'p');
  assert.equal(C.rankChest(offer, cfg({ priorities: { deity: 'g' } }), owned)[0].id, 'g');
  assert.equal(C.rankChest(offer, cfg({ chestFillFirst: false }), owned)[0].id, 'g');
});

test('actual chest picker reads occupied slots from game state, then chooses a missing slot', async () => {
  const f = await browserFixture({ priorities: {}, chestReroll: false });
  try {
    f.game.runItems = { slots: new Map([['elixir', { item: 'e_dmg', vals: Array(14).fill(1) }]]) };
    f.picker('chest');
    f.ui.querySelector('#diagnose').click();
    assert.deepEqual(JSON.parse(f.ui.querySelector('#config').value).chestSlots, { elixir: { item: 'e_dmg', level: 14 } });
  } finally { f.close(); }
});

test('new settings validate, dangerous options default off and quality IDs remain distinct', () => {
  const options = C.validateConfig({});
  assert.equal(options.chestFillFirst, true);
  assert.equal(options.noFlipEnabled, false); assert.equal(options.autoEquip, false); assert.equal(options.autoSell, false);
  assert.deepEqual(options.sellQualities, []);
  assert.equal(options.expeditionLap, 1);
  assert.deepEqual(cfg({ sellQualities: [0,2,3,4,2,'4',99,-1] }).sellQualities, [0,2,3,4]);
  assert.equal(cfg({ noFlipMinutes: -1 }).noFlipMinutes, 0);
  assert.equal(cfg({ noFlipMinutes: 999 }).noFlipMinutes, 180);
  assert.equal(cfg({ expeditionLap: 3 }).expeditionLap, 3);
  assert.equal(cfg({ expeditionLap: 4 }).expeditionLap, 4);
});

const native = require('./fixtures/native-ui.json');
test('timed no-flip uses native checkbox after game minutes; resets for next run and leaves chest selections active', async () => {
  const f = await browserFixture({ noFlipEnabled: true, noFlipMinutes: 10 });
  try {
    f.w.document.body.insertAdjacentHTML('beforeend', '<div id="pause" class="hidden"><div class="ro-body"></div></div>');
    f.w.__nf = { g: f.game };
    f.w.eval(`(${native.noFlipClient})(window.__nf,{T:{btn:'之後不再翻牌',btnOn:'已關閉翻牌',row:'升級翻牌'},CSS:''})`);
    f.game.time = 599; f.advance(100); assert.equal(f.game.roNoFlip, undefined);
    f.game.time = 600; f.advance(100); assert.equal(f.game.roNoFlip, true);
    assert.equal(f.w.document.querySelector('#nf-check').checked, false);
    assert.deepEqual(f.picker('chest'), { card: 0, deck: 0, pick: 1 });
    const next = { ...f.game, state: 'playing', time: 5, roNoFlip: false };
    f.w.__nf.g = next; f.hooks.start[0](next);
    f.w.document.querySelector('#nf-check').checked = true;
    f.advance(100); assert.equal(next.roNoFlip, false);
    next.time = 600; f.advance(100); assert.equal(next.roNoFlip, true);
  } finally { f.close(); }
});

test('no-flip clock excludes pause/over and uses game time instead of elapsed computer time', () => {
  for (const state of ['paused','over','lobby']) assert.equal(C.noFlipDue({ state, time: 9999 }, cfg({ noFlipEnabled: true })), false);
  assert.equal(C.noFlipDue({ state: 'playing', time: 599 }, cfg({ noFlipEnabled: true })), false);
  assert.equal(C.noFlipDue({ state: 'playing', time: 600 }, cfg({ noFlipEnabled: true })), true);
  assert.equal(C.noFlipDue({ state: 'playing', time: 600 }, cfg()), false);
});

function townMarkup(f) {
  f.w.document.body.classList.add('in-lobby');
  f.w.document.body.insertAdjacentHTML('beforeend', `<div id="lobby-ui"><button id="lobby-char">角色</button><div id="lobby-labels"></div></div>
    <button id="lobby-prompt">與隊長交談</button><div id="gameover" class="hidden"><button id="btn-restart">返回</button></div>
    <div id="stages" class="overlay hidden"><div id="lap-tabs"></div><div id="stg-list"></div><button id="stg-go">出發</button></div>
    <div id="npc-dialog" class="overlay hidden"><div id="npc-name"></div><div id="npc-text"></div><div id="npc-options"></div></div>
    <div id="charpanel" class="overlay hidden"><button class="tab-btn active" data-tab="equip">裝備</button><div id="cp-tab-equip"><div class="eq-work"></div></div><button id="cp-back">返回</button></div>
    <div id="shop" class="overlay hidden"><div id="shop-filters"><button class="active" data-f="all">全部</button></div><div id="shop-quality"></div><div id="shop-info"></div><button id="shop-close">關閉</button></div>`);
}

test('repeat expedition switches to second lap then accepts native high-difficulty Enter dialog', async () => {
  const f = await browserFixture({ repeat: true, expeditionLap: 2, expedition: 'sewer' });
  try {
    townMarkup(f); let lap = 1, selected = 0, launched = 0;
    const d = f.w.document, stages = d.querySelector('#stages'), dialog = d.querySelector('#npc-dialog');
    function render() {
      d.querySelector('#lap-tabs').innerHTML = [1,2].map(n => `<button data-laptab="${n}" class="${n === lap ? 'primary' : ''}">${n}周目</button>`).join('');
      for (const tab of d.querySelectorAll('[data-laptab]')) tab.onclick = () => { lap = +tab.dataset.laptab; render(); };
      d.querySelector('#stg-list').innerHTML = ['普隆德拉原野','普隆德拉地下水道'].map((name,i) => `<button class="stg-card${i === selected ? ' sel' : ''}" data-i="${i}"><span class="stg-card-info"><b>${name}${lap === 2 ? '・改' : ''}</b></span></button>`).join('');
      for (const card of d.querySelectorAll('.stg-card')) card.onclick = () => { selected = +card.dataset.i; render(); };
    }
    render(); stages.classList.remove('hidden');
    d.querySelector('#stg-go').onclick = () => {
      assert.equal(lap, 2); assert.equal(selected, 1); stages.classList.add('hidden'); dialog.classList.remove('hidden');
      d.querySelector('#npc-name').textContent = '難度'; d.querySelector('#npc-text').innerHTML = '<div class="diff"></div>';
      d.querySelector('#npc-options').innerHTML = '<button class="primary">前往野外</button>';
      d.querySelector('#npc-options button').onclick = () => {
        d.querySelector('#npc-name').textContent = '高難度提醒'; d.querySelector('#npc-text').textContent = '預估 9,800 隻怪物';
        d.querySelector('#npc-options').innerHTML = '<button>✘ 取消</button><button class="primary">✔ 入場</button>';
        d.querySelector('#npc-options .primary').onclick = () => { launched++; dialog.classList.add('hidden'); f.hooks.start[0]({ ...f.game, stageId: 'sewer', difficulty: { lap: 2 }, state: 'playing' }); };
      };
    };
    for (let i = 0; i < 7; i++) f.advance(900);
    assert.equal(launched, 1);
    assert.equal(f.ui.querySelector('[data-setting="expedition"]').value, 'sewer');
    assert.match(f.ui.querySelector('#repeat-status').textContent, /第 2 周目/);
  } finally { f.close(); }
});

test('locked lap and unrelated dialogs never trigger departure or confirmation', async () => {
  const f = await browserFixture({ repeat: true, expeditionLap: 2 });
  try {
    townMarkup(f); const d = f.w.document; let clicks = 0;
    d.querySelector('#stages').classList.remove('hidden'); d.querySelector('#stg-go').onclick = () => clicks++;
    f.advance(1000); assert.equal(clicks, 0); assert.match(f.ui.querySelector('#status').textContent, /尚未解鎖/);
    d.querySelector('#stages').classList.add('hidden'); d.querySelector('#npc-dialog').classList.remove('hidden');
    d.querySelector('#npc-name').textContent = '購買裝備'; d.querySelector('#npc-options').innerHTML = '<button class="primary">入場</button>';
    d.querySelector('#npc-options button').onclick = () => clicks++;
    f.advance(1000); assert.equal(clicks, 0);
  } finally { f.close(); }
});

function equipmentUi(f, inventory, equipped) {
  townMarkup(f); const w = f.w, d = w.document, events = [];
  const character = { id: 'test', inventory, equipped };
  w.RO_EQJ = () => 'mage';
  const plan = w.eval(`(${native.quickEquipPlan})`), equip = w.eval(`(${native.quickEquipUi})`), sell = w.eval(`(${native.quickSellUi})`);
  const definitions = { staff: { slot: 'weapon', wtype: 'staff' }, sword: { slot: 'weapon', wtype: 'sword' }, armor: { slot: 'armor' }, starter: { slot: 'weapon', starter: true } };
  const protectedWorn = new Set(['other-character']);
  const M = { t: () => character, def: definitions, slots: [{ id: 'weapon', gear: 'weapon' }, { id: 'armor', gear: 'armor' }],
    others: () => protectedWorn, score: item => item.score || 0, total: c => Object.values(c.equipped).reduce((sum, uid) => sum + (c.inventory.find(it => it.uid === uid)?.score || 0), 0),
    mine: (c,it) => !it.owner, canUse: () => true, wearing: (c,uid) => Object.values(c.equipped).includes(uid),
    fits: (job,def,slot) => def.slot === slot, twoHand: () => false,
    equip(c,uid,slot) { events.push('equip:' + uid); c.equipped[slot] = uid; }, name: it => it.uid, sound() {}, save() {}, redraw() {} };
  d.querySelector('#lobby-char').onclick = () => { events.push('panel'); d.querySelector('#charpanel').classList.remove('hidden'); equip(M, {}, plan); };
  d.querySelector('#cp-back').onclick = () => { events.push('close-panel'); d.querySelector('#charpanel').classList.add('hidden'); };
  const selection = { q: [true,true,true,true,true], cards: true, ref: true };
  const sales = [];
  function renderShop() {
    sell({ inv: character.inventory, worn: new Set([...Object.values(equipped), ...protectedWorn]), cat: 'all', fit: () => true, def: definitions,
      Q: ['普通','優良','稀有','史詩','傳說'].map(name => ({ name })), qcol: () => '#fff', fmt: String, price: () => 1, el: id => d.getElementById(id), kp: '點', redraw: renderShop,
      confirm(title, html, label, run) {
        events.push('sale-dialog'); d.querySelector('#npc-dialog').classList.remove('hidden'); d.querySelector('#npc-name').textContent = title;
        d.querySelector('#npc-text').innerHTML = html; d.querySelector('#npc-options').innerHTML = `<button>取消</button><button class="primary">${label}</button>`;
        d.querySelector('#npc-options button').onclick = () => d.querySelector('#npc-dialog').classList.add('hidden');
        d.querySelector('#npc-options .primary').onclick = () => { d.querySelector('#npc-dialog').classList.add('hidden'); run(); };
      },
      sell(ids) { events.push('sell'); sales.push(...ids); character.inventory = character.inventory.filter(it => !ids.includes(it.uid)); renderShop(); d.querySelector('#shop-info').textContent = '你賣出了 ' + ids.length + ' 件物品'; },
    }, selection);
  }
  d.querySelector('#lobby-prompt').textContent = '和礦石商人交談';
  d.querySelector('#lobby-prompt').onclick = () => { events.push('shop'); d.querySelector('#shop').classList.remove('hidden'); renderShop(); };
  d.querySelector('#shop-close').onclick = () => { events.push('close-shop'); d.querySelector('#shop').classList.add('hidden'); };
  d.querySelector('#btn-restart').onclick = () => { events.push('return'); d.querySelector('#gameover').classList.add('hidden'); };
  f.game.state = 'over'; d.querySelector('#gameover').classList.remove('hidden');
  return { events, sales, character, selection };
}

test('post-run native equip keeps weapon type and precedes sale; selected qualities exclude worn and protected gear', async () => {
  const f = await browserFixture({ autoEquip: true, autoSell: true, sellQualities: [0,2,3,4], repeat: false, repeatDelay: 1500 });
  try {
    const item = (uid, quality, more = {}) => ({ uid, quality, itemId: 'staff', cards: [], score: 1, ...more });
    const inventory = [item('old',0,{score:10}),item('better',4,{score:20}),item('other-weapon',4,{itemId:'sword',score:100}),
      item('ordinary',0),item('uncommon',1),item('rare',2),item('epic',3),item('legendary',4),
      item('safe',4,{safe:true}),item('carded',4,{cards:[123]}),item('refined',4,{refine:7}),item('starter',0,{itemId:'starter'}),item('owner',0,{owner:'someone'}),item('other-character',4)];
    const ui = equipmentUi(f, inventory, { weapon: 'old' });
    for (let i=0;i<40;i++) f.advance(500);
    assert.equal(ui.character.equipped.weapon, 'better');
    assert.deepEqual([...ui.sales].sort(), ['old','other-weapon','ordinary','rare','epic','legendary'].sort());
    assert(ui.events.indexOf('equip:better') < ui.events.indexOf('sell'));
    assert(ui.events.indexOf('close-panel') < ui.events.indexOf('shop'));
    assert.equal(ui.events.filter(x=>x==='sell').length, 1);
    for (const id of ['better','uncommon','safe','carded','refined','starter','owner','other-character']) assert(ui.character.inventory.some(it=>it.uid===id), id);
    f.advance(20000); assert.equal(ui.events.filter(x=>x==='sell').length, 1);
  } finally { f.close(); }
});

test('auto-sell requires master switch AND quality selection', async () => {
  for (const saved of [{autoSell:false,sellQualities:[4]},{autoSell:true,sellQualities:[]}]) {
    const f = await browserFixture(saved);
    try { const ui=equipmentUi(f,[{uid:'x',itemId:'staff',cards:[],quality:4}],{}); for(let i=0;i<10;i++)f.advance(1000); assert.deepEqual(ui.sales,[]); assert.deepEqual(ui.events,[]); }
    finally { f.close(); }
  }
});

test('changing sale settings cancels native confirmation before any sale', async () => {
  const f=await browserFixture({autoSell:true,sellQualities:[4],repeatDelay:1500});
  try {
    const ui=equipmentUi(f,[{uid:'legend',itemId:'staff',cards:[],quality:4}],{});
    for(let i=0;i<40&&!ui.events.includes('sale-dialog');i++)f.advance(500);
    assert(ui.events.includes('sale-dialog')); assert.deepEqual(ui.sales,[]);
    f.setting('autoSell',false); f.advance(1000);
    assert.deepEqual(ui.sales,[]); assert(f.w.document.querySelector('#npc-dialog').classList.contains('hidden'));
  } finally { f.close(); }
});

test('navigation uses short native direction keys and releases them when paused', async () => {
  assert.deepEqual(C.townDirection({x:100,y:-100},{x:0,y:0}),['ArrowRight','ArrowUp']);
  assert.deepEqual(C.townDirection({x:2,y:2},{x:0,y:0}),[]);
  const f=await browserFixture({repeat:true});
  try {
    townMarkup(f); const d=f.w.document, down=[],up=[];
    d.querySelector('#lobby-prompt').classList.add('hidden');
    d.querySelector('#lobby-labels').innerHTML='<div class="lobby-name self">自己</div><div class="lobby-name npc">遠征隊長</div>';
    d.querySelector('.self').getBoundingClientRect=()=>({left:400,width:60,bottom:400});
    d.querySelector('.npc').getBoundingClientRect=()=>({left:600,width:60,bottom:300});
    f.w.addEventListener('keydown',e=>down.push(e.key));f.w.addEventListener('keyup',e=>up.push(e.key));
    f.ui.querySelector('#mini').focus();
    f.advance(1000); assert.deepEqual(down,['ArrowRight','ArrowUp']);
    f.ui.querySelector('#toggle').click(); assert.deepEqual(up,['ArrowRight','ArrowUp']);
  } finally {f.close();}
});

function chestScenario(f, owned={}) {
  const d=f.w.document, picker=d.querySelector('#picker'), counts={card:0,deck:0,picks:[],used:[]};
  f.w.__nativeChestItems=f.items;
  const nativePool=f.w.eval(`(function(ws){return ${native.chestSlotItems}})(window.__nativeChestItems)`);
  f.game.runItems={slots:new Map(Object.entries(owned)),slotItems:nativePool,
    roll(){assert.fail('advisor must not roll to inspect probabilities')},rollSlot(){assert.fail('advisor must not advance RNG to inspect a pool')}};
  f.game.deityLearned=()=>[];
  f.game.chestOpts=()=>({swap:false,banished:new Set(),useless:new Set()});
  function used() {f.ui.querySelector('#diagnose').click();counts.used.push(JSON.parse(f.ui.querySelector('#config').value).usedRerolls);}
  function draw(ids, actions={}) {
    f.game.state='levelup';picker.classList.remove('hidden');d.querySelector('#pk-title').textContent='寶箱';
    d.querySelector('#pk-cards').innerHTML='';
    ids.forEach(id=>{
      const item=f.items[id],slot=d.createElement('div');slot.className='pk-slot';
      slot.innerHTML=`<button class="pk-card"><span class="pk-name">${item.name}</span><span class="pk-sub">${{potion:'藥水',elixir:'秘藥',blessing:'祝福'}[item.slot]}</span><span class="pk-badge">稀有</span><span class="pk-lines">測試</span></button><button class="pk-act" title="重抽單張">重抽<small>9</small></button>`;
      slot.querySelector('.pk-act').onclick=()=>{counts.card++;f.game.perksLeft.reroll_card--;used();actions.card?.(id)};
      slot.querySelector('.pk-card').onclick=()=>{counts.picks.push(id);f.game.runItems.slots.set(item.slot,{item:id,vals:[1]});actions.pick?.(id)};
      d.querySelector('#pk-cards').append(slot);
    });
    d.querySelector('#pk-bar').innerHTML='<button class="pk-act" title="重抽整組">重抽<small>9</small></button>';
    d.querySelector('#pk-bar .pk-act').onclick=()=>{counts.deck++;f.game.perksLeft.reroll--;used();actions.deck?.()};
  }
  function closePicker(){picker.classList.add('hidden');f.game.state='playing';}
  return {draw,counts,closePicker};
}

test('native pool adapter holds a first-tier card and single-rerolls the other type until it hits',async()=>{
  const f=await browserFixture({priorities:{potion:'p_cd',elixir:'e_dmg'}});
  try {
    const scene=chestScenario(f,{elixir:{item:'e_dmg',vals:Array(13).fill(1)}});
    f.game.openingChest={id:1};
    const actions={card(id){assert.equal(id,'p_hp');scene.draw(['e_dmg','p_cd'],{pick:scene.closePicker})},deck(){assert.fail('must not discard existing first tier')}};
    scene.draw(['e_dmg','p_hp'],actions);
    for(let i=0;i<8;i++)f.advance(1200);
    assert.equal(scene.counts.card,1);assert.equal(scene.counts.deck,0);assert.deepEqual(scene.counts.picks,['p_cd']);
    assert.deepEqual(scene.counts.used,[1]);
  } finally {f.close();}
});

test('filling any second slot switches the next box to single-first, with independent per-box counts',async()=>{
  const f=await browserFixture({priorities:{potion:'p_cd',elixir:'e_dmg'},maxRerolls:2});
  try {
    const scene=chestScenario(f,{blessing:{item:'b_dmg',vals:Array(13).fill(1)}});
    function box(index){
      f.game.openingChest={id:index};
      const miss=index===1?'p_hp':'e_hp',hit=index===1?'p_cd':'e_dmg';
      const selected=()=>{if(index===1)box(2);else scene.closePicker()};
      scene.draw(['b_dmg'],{deck(){if(index===1)scene.draw([hit],{pick:selected});else scene.draw([miss],{card(){scene.draw([hit],{pick:selected})}})}});
    }
    box(1);for(let i=0;i<16;i++)f.advance(1200);
    assert.equal(scene.counts.deck,2);assert.equal(scene.counts.card,1);
    assert.deepEqual(scene.counts.picks,['p_cd','e_dmg']);assert.deepEqual(scene.counts.used,[1,1,2]);
    assert.match(f.ui.querySelector('#chest-stage').textContent,/已填 3\/5.*後三欄/);
  } finally {f.close();}
});

for(const exhausted of ['best','wait'])test(`same chest redraw never resets the cap; exhausted=${exhausted} remains respected`,async()=>{
  const f=await browserFixture({priorities:{potion:'p_cd'},maxRerolls:2,exhausted});
  try {
    const scene=chestScenario(f);f.game.openingChest={id:'same'};
    function miss(){scene.draw(['p_hp'],{card:miss,deck:miss,pick:scene.closePicker})}
    miss();for(let i=0;i<12;i++)f.advance(1200);
    assert.equal(scene.counts.card,0);assert.equal(scene.counts.deck,2);assert.deepEqual(scene.counts.used,[1,2]);
    assert.deepEqual(scene.counts.picks,exhausted==='best'?['p_hp']:[]);
  } finally {f.close();}
});

test('priority picker adds parallel items to selected tiers and preserves groups through save/import/reload',async()=>{
  const f=await browserFixture();let saved;
  try {
    const picker=f.ui.querySelector('[data-catalog="potion"]'),tier=f.ui.querySelector('[data-priority-tier="potion"]');
    const add=id=>{picker.value=id;picker.dispatchEvent(new f.w.Event('change',{bubbles:true}))};
    assert.equal(tier.value,'new');add('p_cd');assert.equal(tier.value,'0');add('p_hp');
    tier.value='new';add('p_dmg');assert.equal(tier.value,'1');add('p_area');add('p_cd');
    const groups=()=>C.splitTiers(f.ui.querySelector('[data-priority="potion"]').value).map(group=>group.map(C.tokenId));
    assert.deepEqual(groups(),[['p_cd','p_hp'],['p_dmg','p_area']]);
    f.ui.querySelector('#export').click();saved=JSON.parse(f.ui.querySelector('#config').value);
    assert.deepEqual(C.splitTiers(saved.priorities.potion).map(g=>g.map(C.tokenId)),groups());
    f.ui.querySelector('#import').click();assert.deepEqual(groups(),[['p_cd','p_hp'],['p_dmg','p_area']]);
    saved=JSON.parse(f.w.localStorage.getItem(STORAGE));
  }finally{f.close();}
  const reload=await browserFixture(saved);
  try{assert.deepEqual(C.splitTiers(reload.ui.querySelector('[data-priority="potion"]').value).map(g=>g.map(C.tokenId)),[['p_cd','p_hp'],['p_dmg','p_area']]);}
  finally{reload.close();}
});

test('native no-flip triggers on total including basic attack before the enabled minute condition is reached',async()=>{
  const f=await browserFixture({noFlipEnabled:true,noFlipMinutes:10,noFlipLevelEnabled:true,noFlipTotalLevel:50});
  try{
    const levels={firebolt:10,coldbolt:10,lightning:10,soul_strike:10,atk_staff:9};
    f.game.basicAttack='atk_staff';f.game.skillLevel=id=>levels[id];f.game.time=5;
    f.w.document.body.insertAdjacentHTML('beforeend','<div id="pause" class="hidden"><div class="ro-body"></div></div>');
    f.w.__nf={g:f.game};f.w.eval(`(${native.noFlipClient})(window.__nf,{T:{btn:'之後不再翻牌',btnOn:'已關閉翻牌',row:'升級翻牌'},CSS:''})`);
    f.advance(1000);assert.equal(f.game.roNoFlip,undefined);assert.match(f.ui.querySelector('#skill-total').textContent,/49/);
    levels.atk_staff=10;f.advance(1000);assert.equal(f.game.roNoFlip,true);
    f.ui.querySelector('#diagnose').click();const report=JSON.parse(f.ui.querySelector('#config').value);
    assert.equal(report.totalSkillLevels,50);assert.equal(report.noFlip.levelEnabled,true);assert.equal(report.noFlip.applied,true);
    assert.match(f.ui.querySelector('#status').textContent,/含普攻/);
    f.ui.querySelector('#export').click();const exported=JSON.parse(f.ui.querySelector('#config').value);
    assert.equal(exported.noFlipLevelEnabled,true);assert.equal(exported.noFlipTotalLevel,50);assert.equal(exported.noFlipEnabled,true);
  }finally{f.close();}
});

test('actual skill picker selects ordinary fixed target upgrade over legendary damage',async()=>{
  const f=await browserFixture({rarityFirst:true});
  try{
    const d=f.w.document,picker=d.querySelector('#picker');let picked=-1;
    picker.classList.remove('hidden');d.querySelector('#pk-title').textContent='Level Up!';
    d.querySelector('#pk-cards').innerHTML=[['火箭術','傳說','傷害 +60%'],['冰箭術','普通','+1 目標']].map(([name,rarity,line])=>
      `<div class="pk-slot"><button class="pk-card"><span class="pk-name">${name}</span><span class="pk-badge">${rarity}</span><span class="pk-lines">${line}</span></button></div>`).join('');
    [...picker.querySelectorAll('.pk-card')].forEach((button,i)=>button.onclick=()=>{picked=i;picker.classList.add('hidden')});
    f.advance(100);f.advance(1100);assert.equal(picked,1);
  }finally{f.close();}
});

// Run the unmodified HANS boss cast against the actual userscript. Rendering,
// audio and enemy spawning are stubs; countdown, seal and damage checks are native.
function moonBellScenario(f, { sealed = false } = {}) {
  const fixture = require('./fixtures/native-bell.json');
  const { w, game: g } = f;
  w.eval(`window.fixtureMoonBell = (() => {
    const zc=${fixture.constants.safeRadius},eC=${fixture.constants.damage},Re=Math.cos,Le=Math.sin,we=Math.hypot;
    const O={play(){}},Je=()=>({}),c=s=>s,tC=id=>id;
    const sk=class { constructor(o){this.style=o.style;this.anchor={set(){}}} };
    const Qe=class { addChild(){} };
    const $E=class {
      constructor(o){this.mesh={position:{x:0,z:0}};this.bellMat={};this.groundMat={uniforms:{safeR:{value:o.safeR}}};this.sealed=false;this.charge=0;this.waveAge=-1;this.out=-1}
      toll(){this.waveAge=0} finish(){this.out=0}
    };
    ${fixture.cast}
    return am;
  })()`);
  w.document.body.insertAdjacentHTML('beforeend', '<div id="hud"></div>');
  const boss = { x: 500, y: 500, dead: false, def: { id: 'moonlight', radius: 41 }, sprite: { alpha: 1 } };
  Object.assign(g, { state: 'playing', time: 1, classDef: { speed: 145 }, stats: { speedMult: 1 }, buffValue: () => 0,
    zeny: 1000, chestCost: () => 10, enemies: [boss], world3d: { cylinders: [] }, fx: [], scheduled: [], damage: 0,
    pickups: [{ kind: 'chest', x: 300, y: 480, dead: false }], moves: [],
    moveTo(x, y) { this.movePath = [{ x, y }]; this.moves.push({ x, y }); },
    fx3d(x, y, effect) { effect.mesh.position.x = x; effect.mesh.position.z = y; this.world3d.cylinders.push(effect); },
    addFx(effect) { if (effect.update) this.fx.push(effect); },
    schedule(seconds, fn) { this.scheduled.push({ at: this.time + seconds, fn }); },
    spawnBoss(id, x, y) { const mini = { x, y, def: { id, hp: 112500, radius: 26 }, maxHp: 112500, hp: 112500, dead: false }; this.enemies.push(mini); return mini; },
    events: { onAnnounce() {} }, shake() {}, hurtPlayer(n) { this.damage += n; },
  });
  w.fixtureMoonBell(sealed ? fixture.constants.sealedSeconds : fixture.constants.normalSeconds,
    sealed ? { id: 'cat_o_nine_tail', secs: fixture.constants.miniSeconds, hp: 175000 } : undefined)(g, boss, { aim: () => ({ x: 500, y: 500 }), rnd: () => 0 });
  const bell = g.world3d.cylinders[0];
  function progress(dt) {
    const goal = g.movePath?.[0];
    if (goal && g.state === 'playing') {
      const d = Math.hypot(goal.x - g.player.x, goal.y - g.player.y), travel = Math.min(d, g.classDef.speed * 1.3 * dt);
      if (d) { g.player.x += (goal.x - g.player.x) / d * travel; g.player.y += (goal.y - g.player.y) / d * travel; }
      if (d <= travel) g.movePath.shift();
    }
    if (g.state !== 'playing') return;
    g.time += dt;
    for (const task of [...g.scheduled]) if (task.at <= g.time) { g.scheduled.splice(g.scheduled.indexOf(task), 1); task.fn(); }
    g.fx = g.fx.filter(effect => !effect.update(dt * 1000));
  }
  function step(seconds) { for (let i = 0; i < Math.round(seconds * 10); i++) { progress(.1); f.advance(100); } }
  const distance = () => Math.hypot(g.player.x - bell.mesh.position.x, g.player.y - bell.mesh.position.z);
  return { g, boss, bell, step, progress, distance };
}

test('native nine-second bell: reach shelter before toll, hold through strike, then resume loot', async () => {
  const f = await browserFixture({ dodge: true, pickups: true });
  try {
    const s = moonBellScenario(f);
    s.step(3); assert(s.distance() <= 128); assert.equal(s.bell.waveAge, -1);
    for (let i = 0; i < 61; i++) { s.step(.1); assert(s.distance() <= 128); }
    assert.equal(s.bell.waveAge, 0); assert.equal(s.g.damage, 0);
    f.ui.querySelector('#diagnose').click();
    const report = JSON.parse(f.ui.querySelector('#config').value);
    assert.equal(report.bell.active, true); assert.equal(report.bell.struck, true); assert.equal(report.bell.radius, 128);
    s.step(1.2); assert.equal(s.bell.out, 0);
    assert.match(f.ui.querySelector('#log').textContent, /鐘罩機制結束/);
    assert(s.g.movePath?.[0].x < s.g.player.x, 'loot to the left becomes the goal again');
  } finally { f.close(); }
});

test('native control: remaining outside the bell takes the original lethal damage', async () => {
  const f = await browserFixture({ dodge: false, chests: false, pickups: false });
  try { const s = moonBellScenario(f); s.step(9.1); assert.equal(s.g.damage, 999); assert.equal(s.g.moves.length, 0); }
  finally { f.close(); }
});

for (const unlock of [false, true]) test(`native sealed bell: entering alone remains unsafe; mini killed in time=${unlock}`, async () => {
  const f = await browserFixture({ dodge: true, chests: false, pickups: false });
  try {
    const s = moonBellScenario(f, { sealed: true });
    s.step(3); assert(s.distance() <= 128); assert.equal(s.bell.sealed, true);
    assert.match(f.ui.querySelector('#bell-status').textContent, /進罩也不安全.*九尾狐/);
    assert.equal(s.g.enemies.find(e => e.def.id === 'cat_o_nine_tail').hp, 175000);
    if (unlock) { s.g.enemies.find(e => e.def.id === 'cat_o_nine_tail').dead = true; s.step(.1); assert.equal(s.bell.sealed, false); }
    s.step(20.1); assert.equal(s.g.damage, unlock ? 0 : 999);
    assert(s.distance() <= 128);
  } finally { f.close(); }
});

test('native sealed bell cannot be unlocked after the mini deadline', async () => {
  const f = await browserFixture({ dodge: true, chests: false, pickups: false });
  try {
    const s = moonBellScenario(f, { sealed: true }); s.step(21);
    s.g.enemies.find(e => e.def.id === 'cat_o_nine_tail').dead = true;
    s.step(2.1); assert.equal(s.bell.sealed, true); assert.equal(s.g.damage, 999);
  } finally { f.close(); }
});

test('bell follows a wall detour using native path waypoints instead of moving through a wall', async () => {
  const f = await browserFixture({ dodge: true });
  try {
    const s = moonBellScenario(f);
    const open = (x, y) => !(x >= 650 && x <= 730 && y < 650);
    s.g.walk = { nearestWalkable: (x, y) => [x, y], walkable: open,
      pathTo: (px, py, x, y) => px < 800 ? [...(py < 710 ? [{ x: 600, y: 740 }] : []), { x: 800, y: 740 }, { x, y }] : [{ x, y }],
      resolve(ax, ay, bx, by) { for (let i = 0; i <= 8; i++) if (!open(ax + (bx - ax) * i / 8, ay + (by - ay) * i / 8)) return [ax, ay]; return [bx, by]; } };
    for (let i = 0; i < 80; i++) { s.step(.1); assert(open(s.g.player.x, s.g.player.y)); }
    assert(s.distance() <= 128); s.step(1.1); assert.equal(s.g.damage, 0);
  } finally { f.close(); }
});

test('unreachable bell stops owned movement and reports manual intervention', async () => {
  const f = await browserFixture({ dodge: true });
  try {
    const s = moonBellScenario(f); s.step(.2); assert(s.g.movePath?.length);
    s.g.walk = { nearestWalkable: () => [0, 0], pathTo: () => { throw Error('must not route outside bell'); } };
    s.step(.3); assert.equal(s.g.movePath, null); assert.match(f.ui.querySelector('#bell-status').textContent, /路徑不可達/);
  } finally { f.close(); }
});

test('bell movement takes priority over an open loot reveal and resumes its native collect button afterward', async () => {
  const f = await browserFixture({ dodge: true, pickups: true });
  try {
    const s = moonBellScenario(f); let collected = 0;
    f.w.document.body.insertAdjacentHTML('beforeend', '<div id="drop-reveal"><div class="dr-inner"><button class="dr-get">領取</button></div></div>');
    f.w.document.querySelector('.dr-get').onclick = () => { collected++; f.w.document.querySelector('#drop-reveal').classList.add('hidden'); };
    s.step(9.1); assert.equal(collected, 0); assert(s.distance() <= 128); assert.equal(s.g.damage, 0);
    s.step(2); assert.equal(collected, 1);
  } finally { f.close(); }
});

test('bell respects pause, toggle, replay, hidden-tab policy and new-run cleanup', async () => {
  const f = await browserFixture({ dodge: true });
  try {
    const s = moonBellScenario(f); s.g.state = 'paused'; s.step(.2); assert.equal(s.g.moves.length, 0);
    s.g.state = 'playing'; s.g.replayMoves = []; s.step(.2); assert.equal(s.g.moves.length, 0);
    s.g.replayMoves = null; f.setting('bellShelter', false); f.setting('chests', false); f.setting('pickups', false);
    s.step(.2); assert.match(f.ui.querySelector('#bell-status').textContent, /未啟用/);
    f.setting('bellShelter', true);
    Object.defineProperty(f.w.document, 'hidden', { configurable: true, value: true });
    s.g.moves = []; s.step(.2); assert.equal(s.g.moves.length, 0);
    Object.defineProperty(f.w.document, 'hidden', { configurable: true, value: false });
    s.step(.2); assert(s.g.moves.length > 0);
    f.ui.querySelector('#toggle').click(); assert.equal(s.g.movePath, null);
    s.g.moves = []; s.step(.2); assert.equal(s.g.moves.length, 0);
    f.ui.querySelector('#toggle').click();
    const next = { ...s.g, time: 0, world3d: { cylinders: [] }, pickups: [], moves: [], state: 'playing' };
    f.hooks.start[0](next); f.advance(500); assert.match(f.ui.querySelector('#bell-status').textContent, /尚無/);
    f.ui.querySelector('#diagnose').click(); assert.equal(JSON.parse(f.ui.querySelector('#config').value).bell.active, false);
  } finally { f.close(); }
});

test('bell leaves paused skill picker available, then resumes shelter after selection', async () => {
  const f = await browserFixture({ dodge: true });
  try {
    const s = moonBellScenario(f); const counts = f.picker('skill', { eligible: true });
    for (let i = 0; i < 3; i++) f.advance(1200);
    assert.equal(counts.pick, 1); assert.equal(s.g.moves.length, 0);
    s.g.state = 'playing'; s.step(3); assert(s.distance() <= 128);
  } finally { f.close(); }
});

test('hidden Worker pulses drive native bell countdown and shelter movement with browser intervals suspended', async () => {
  const f = await browserFixture({ dodge: true, background: true });
  try {
    const s = moonBellScenario(f); let worker, updates = 0;
    f.w.URL.createObjectURL = () => 'blob:fixture'; f.w.URL.revokeObjectURL = () => {};
    f.w.Worker = class { constructor() { worker = this; this.messages = []; } postMessage(m) { this.messages.push(m); } };
    s.g.app = { ticker: { started: true, stop() { this.started = false; }, start() { this.started = true; }, update() { updates++; s.progress(.1); } } };
    Object.defineProperty(f.w.document, 'hidden', { configurable: true, value: true });
    f.w.document.dispatchEvent(new f.w.Event('visibilitychange'));
    assert.equal(s.g.app.ticker.started, false); assert(worker.messages.includes('start'));
    for (let i = 0; i < 91; i++) { f.advance(100, false); worker.onmessage({ data: 'pulse' }); }
    assert.equal(updates, 91); assert(s.distance() <= 128); assert.equal(s.g.damage, 0); assert.equal(s.bell.waveAge, 0);
    f.ui.querySelector('#toggle').click(); assert.equal(s.g.movePath, null);
    assert(worker.messages.includes('stop')); assert.equal(s.g.app.ticker.started, true);
  } finally { f.close(); }
});

// Current native unlock rules and tab handlers, with a simulated character and
// gear score provider. No game progress or account data is changed outside tests.
function expeditionScenario(f, { futureLap = false, gearNeed, requirements = true } = {}) {
  townMarkup(f);
  const fixture = require('./fixtures/native-stages.json'), d = f.w.document;
  const saved = JSON.parse(f.w.localStorage.getItem(STORAGE));
  const config = JSON.parse(JSON.stringify(fixture.config));
  if (futureLap) { config.max = 7; config.label.push('七周目'); config.suffix.push('・改⁶'); }
  const char = { gs: 20000, jobLevel: 99, mvpsDefeated: [], stagesCleared: [], roLap: {} };
  const initialLap = saved.expeditionLap || 1, initialStage = fixture.stages.findIndex(s => s.id === saved.expedition);
  function clear(id, lap) {
    const stage = fixture.stages.find(s => s.id === id);
    if (!char.mvpsDefeated.includes(stage.mvp.id)) char.mvpsDefeated.push(stage.mvp.id);
    if (lap > 1) char.roLap[id] = Math.max(char.roLap[id] || 0, lap);
    if (stage.storyOnly) char.stagesCleared.push(id);
  }
  if (initialLap > 1) for (const s of fixture.stages) clear(s.id, initialLap - 1);
  for (let i = 0; i < initialStage; i++) clear(fixture.stages[i].id, initialLap);
  f.w.__stageFixture = fixture;
  f.w.eval(`(() => {
    const xe=window.__stageFixture.stages, wr=a=>a.gs, aliases=window.__stageFixture.mvpAliases;
    const Zd=(a,e)=>a.includes(e)||(aliases[e]||[]).some(t=>a.includes(t));
    ${fixture.previousStage}
    ${fixture.baseUnlock}
    window.__baseUnlock=eh;
    window.__makeNativeLaps=${fixture.lapClient};
  })()`);
  const G = { stages: () => fixture.stages, st: id => fixture.stages.some(s => s.id === id && s.map && !s.storyOnly),
    zd: (a, id) => a.includes(id) || (fixture.mvpAliases[id] || []).some(v => a.includes(v)),
    gs: c => c.gs, k: (id, lap) => ({ gs: gearNeed ? gearNeed(id, lap) : 1000 * (fixture.stages.findIndex(s => s.id === id) + 1) }), eh0: f.w.__baseUnlock };
  const native = f.w.__makeNativeLaps(G, config);
  let selected = Math.max(0, initialStage), current = f.game;
  const launches = [], actions = [];
  const stages = d.querySelector('#stages'), dialog = d.querySelector('#npc-dialog'), gameover = d.querySelector('#gameover');
  stages.insertAdjacentHTML('beforeend', '<div id="stg-detail"></div>');
  function eligibility(i) { return native.tab() > 1 ? native.eh(char, i, char.gs) : f.w.__baseUnlock(char, i, char.gs); }
  function render() {
    native.tabs(char, render, i => { selected = i; });
    d.querySelector('#stg-list').innerHTML = fixture.stages.map((s, i) => {
      const v = eligibility(i), cls = v.unlocked ? v.cleared ? 'cleared' : 'open' : 'locked';
      return `<button class="stg-card ${cls}${selected === i ? ' sel' : ''}" data-i="${i}"><span class="stg-card-info"><b>${C.STAGES[i][1]}${config.suffix[native.tab()-1]}${s.special ? '<span class="ro-fs-badge">特殊關卡</span>' : ''}</b></span><span class="stg-state">${v.lapSkip ? '劇情關' : cls}</span></button>`;
    }).join('');
    for (const card of d.querySelectorAll('.stg-card')) card.onclick = () => { selected = +card.dataset.i; actions.push('select:' + fixture.stages[selected].id); render(); };
    const v = eligibility(selected);
    const stage = fixture.stages[selected], need = native.tab() > 1 ? G.k(stage.id, native.tab()).gs : stage.gsMin;
    const req = (ok, text) => `<span class="stg-req ${ok ? 'ok' : 'no'}">${ok ? '✓' : '✗'} ${text}</span>`;
    d.querySelector('#stg-detail').innerHTML = !requirements ? '' : v.lapSkip ? '<span class="stg-req">劇情關卡，周目不用重打</span>' : [
      v.needMvp ? req(v.mvpOk, '打倒前一關 MVP') : '', need ? req(v.gsOk, `裝備分數 ${need}（目前 ${char.gs}）`) : '',
      stage.jobLvMin ? req(v.jobOk, `Job Lv ${stage.jobLvMin}`) : '', stage.story ? req(v.storyOk, '完成劇情') : '',
    ].join('');
    d.querySelector('#stg-go').disabled = !v.unlocked || native.tab() === 1 && (!v.storyOk || v.closed);
  }
  d.querySelector('#lobby-prompt').onclick = () => { stages.classList.remove('hidden'); render(); };
  d.querySelector('#btn-restart').onclick = () => {
    actions.push('return'); gameover.classList.add('hidden'); d.querySelector('#lobby-ui').classList.remove('hidden'); render();
  };
  d.querySelector('#stg-go').onclick = () => {
    actions.push('go'); stages.classList.add('hidden'); dialog.classList.remove('hidden');
    d.querySelector('#npc-name').textContent = '難度'; d.querySelector('#npc-text').innerHTML = '<div class="diff"></div>';
    d.querySelector('#npc-options').innerHTML = '<button class="primary">前往野外</button>';
    d.querySelector('#npc-options button').onclick = () => {
      d.querySelector('#npc-name').textContent = '高難度提醒'; d.querySelector('#npc-text').textContent = '高周目';
      d.querySelector('#npc-options').innerHTML = '<button>取消</button><button class="primary">入場</button>';
      d.querySelector('#npc-options .primary').onclick = () => {
        const run = { stage: fixture.stages[selected].id, lap: native.tab() }; launches.push(run); actions.push('launch:' + run.stage);
        dialog.classList.add('hidden'); d.querySelector('#lobby-ui').classList.add('hidden');
        current = { ...f.game, player: { x: 500, y: 500, dead: false }, stageId: run.stage, difficulty: { lap: run.lap }, state: 'playing' };
        f.hooks.start[0](current);
      };
    };
  };
  function finish(win) {
    if (win) clear(current.stageId, current.difficulty.lap);
    current.state = 'over'; current.player.dead = !win; gameover.classList.remove('hidden'); render();
  }
  function until(test, limit = 40) { for (let i = 0; i < limit && !test(); i++) f.advance(900); assert(test(), 'expedition state did not reach expected condition'); }
  render(); stages.classList.remove('hidden');
  return { char, native, launches, actions, render, finish, until, clear, get current() { return current; } };
}

test('native six-lap UI reads all new maps, badges and suffixes and persists progression config', async () => {
  const f = await browserFixture({ repeat: false, progression: true, expeditionLap: 6, expedition: 'xmas' }); let saved;
  try {
    const s = expeditionScenario(f);
    f.w.document.querySelector('[data-laptab="6"]').click(); f.advance(1100);
    assert.equal(f.ui.querySelector('[data-setting="expeditionLap"]').options.length, 6);
    assert.equal(f.ui.querySelector('[data-setting="expedition"]').options.length, 12);
    f.ui.querySelector('#diagnose').click(); const report = JSON.parse(f.ui.querySelector('#config').value);
    assert.equal(report.expedition.stageLap, 6);
    assert.equal(report.expedition.stages.find(s => s.id === 'xmas').name, '聖誕節');
    assert.equal(report.expedition.stages.find(s => s.id === 'louyang').name, '元宵節');
    assert.equal(report.expedition.stages.find(s => s.id === 'prt_castle').storyOnly, true);
    assert.equal(s.launches.length, 0, 'master repeat remains required');
    f.ui.querySelector('#export').click(); saved = JSON.parse(f.ui.querySelector('#config').value);
    assert.equal(saved.progression, true); assert.equal(saved.expeditionLap, 6); assert.equal(saved.expedition, 'xmas');
  } finally { f.close(); }
  const reload = await browserFixture(saved);
  try { assert.equal(reload.ui.querySelector('[data-setting="progression"]').checked, true); assert.equal(reload.ui.querySelector('[data-setting="expeditionLap"]').value, '6'); }
  finally { reload.close(); }
});

test('native fourth-lap campaign retries defeat and advances after clear while skipping castle story', async () => {
  const f = await browserFixture({ repeat: true, progression: true, expeditionLap: 4, expedition: 'payon_cave' });
  try {
    const s = expeditionScenario(f); s.until(() => s.launches.length === 1);
    s.finish(false); s.until(() => s.launches.length === 2);
    assert.deepEqual(s.launches, [{ stage: 'payon_cave', lap: 4 }, { stage: 'payon_cave', lap: 4 }]);
    s.finish(true); s.until(() => s.launches.length === 3);
    assert.deepEqual(s.launches[2], { stage: 'orcs', lap: 4 });
    const saved = JSON.parse(f.w.localStorage.getItem(STORAGE)); assert.equal(saved.expedition, 'orcs'); assert.equal(saved.expeditionLap, 4);
    assert.match(f.ui.querySelector('#repeat-status').textContent, /首通開荒/);
  } finally { f.close(); }
});

test('native special-stage sequence finishes both new maps before entering fifth lap', async () => {
  const f = await browserFixture({ repeat: true, progression: true, expeditionLap: 4, expedition: 'maze' });
  try {
    const s = expeditionScenario(f); s.until(() => s.launches.length === 1);
    for (let i = 2; i <= 4; i++) { s.finish(true); s.until(() => s.launches.length === i); }
    assert.deepEqual(s.launches, [{ stage: 'maze', lap: 4 }, { stage: 'xmas', lap: 4 }, { stage: 'louyang', lap: 4 }, { stage: 'prontera', lap: 5 }]);
    assert.equal(f.ui.querySelector('[data-setting="expeditionLap"]').value, '5');
  } finally { f.close(); }
});

test('sixth lap completion does not relaunch the last map or select nonexistent seventh lap', async () => {
  const f = await browserFixture({ repeat: true, progression: true, expeditionLap: 6, expedition: 'louyang' });
  try {
    const s = expeditionScenario(f); s.until(() => s.launches.length === 1); s.finish(true);
    for (let i = 0; i < 30; i++) f.advance(900);
    assert.equal(s.launches.length, 1); assert.equal(f.ui.querySelector('[data-setting="expeditionLap"]').value, '6');
    assert.match(f.ui.querySelector('#repeat-status').textContent, /目前最後周目/);
  } finally { f.close(); }
});

test('fixed farming remains on the same native cleared map with campaign mode off', async () => {
  const f = await browserFixture({ repeat: true, progression: false, expeditionLap: 4, expedition: 'payon_cave' });
  try {
    const s = expeditionScenario(f); s.until(() => s.launches.length === 1); s.finish(true); s.until(() => s.launches.length === 2);
    assert.deepEqual(s.launches, [{ stage: 'payon_cave', lap: 4 }, { stage: 'payon_cave', lap: 4 }]);
  } finally { f.close(); }
});

test('native gear lock repeatedly farms current map, then advances when score is sufficient', async () => {
  const f = await browserFixture({ repeat: true, progression: true, expeditionLap: 4, expedition: 'payon_cave' });
  try {
    const s = expeditionScenario(f); s.until(() => s.launches.length === 1); s.char.gs = 7000; s.finish(true);
    s.until(() => s.launches.length === 2); assert.equal(s.launches[1].stage, 'payon_cave');
    assert.equal(f.ui.querySelector('[data-setting="expedition"]').value, 'payon_cave');
    assert.match(f.ui.querySelector('#repeat-status').textContent, /回刷/);
    s.finish(false); s.until(() => s.launches.length === 3); assert.equal(s.launches[2].stage, 'payon_cave');
    s.char.gs = 20000; s.finish(true); s.until(() => s.launches.length === 4); assert.equal(s.launches[3].stage, 'orcs');
    assert.equal(f.ui.querySelector('[data-setting="expedition"]').value, 'orcs');
  } finally { f.close(); }
});

test('campaign completes enabled equipment work before departing for next native map', async () => {
  const f = await browserFixture({ repeat: true, progression: true, autoEquip: true, expeditionLap: 4, expedition: 'payon_cave' });
  try {
    const s = expeditionScenario(f), d = f.w.document;
    d.querySelector('#lobby-char').onclick = () => d.querySelector('#charpanel').classList.remove('hidden');
    d.querySelector('#cp-back').onclick = () => d.querySelector('#charpanel').classList.add('hidden');
    d.querySelector('#cp-tab-equip').insertAdjacentHTML('beforeend', '<button id="cp-auto-btn">一鍵穿裝</button>');
    d.querySelector('#cp-auto-btn').onclick = () => s.actions.push('equip');
    s.until(() => s.launches.length === 1); s.finish(true); s.until(() => s.launches.length === 2, 60);
    assert(s.actions.indexOf('equip') < s.actions.indexOf('launch:orcs')); assert(s.actions.includes('equip'));
  } finally { f.close(); }
});

test('campaign respects shared launch limit across lap boundaries', async () => {
  const f = await browserFixture({ repeat: true, progression: true, repeatLimit: 1, expeditionLap: 4, expedition: 'louyang' });
  try {
    const s = expeditionScenario(f); s.until(() => s.launches.length === 1); s.finish(true);
    for (let i = 0; i < 25; i++) f.advance(900);
    assert.equal(s.launches.length, 1); assert.match(f.ui.querySelector('#status').textContent, /1 次上限/);
  } finally { f.close(); }
});

test('changing lap during a pending high-difficulty prompt prevents stale confirmation', async () => {
  const f = await browserFixture({ repeat: true, progression: true, expeditionLap: 4, expedition: 'payon_cave' });
  try {
    const s = expeditionScenario(f); s.until(() => f.w.document.querySelector('#npc-name').textContent === '高難度提醒');
    f.setting('expeditionLap', 5);
    for (let i = 0; i < 5; i++) f.advance(900);
    assert.equal(s.launches.length, 0);
  } finally { f.close(); }
});

test('future native lap tab is discovered without truncating the selection to six', async () => {
  const f = await browserFixture({ repeat: true, progression: true, expeditionLap: 6, expedition: 'louyang' });
  try {
    const s = expeditionScenario(f, { futureLap: true }); s.until(() => s.launches.length === 1);
    s.finish(true); s.until(() => s.launches.length === 2);
    assert.deepEqual(s.launches[1], { stage: 'prontera', lap: 7 });
    assert.equal(f.ui.querySelector('[data-setting="expeditionLap"]').value, '7');
  } finally { f.close(); }
});

test('new lap first-map gear lock farms previous lap final map, then retries the new lap', async () => {
  const f = await browserFixture({ repeat: true, progression: true, expeditionLap: 4, expedition: 'louyang' });
  try {
    const s = expeditionScenario(f, { gearNeed: (id, lap) => lap >= 5 ? 30000 : 1000 });
    s.until(() => s.launches.length === 1); s.finish(true); s.until(() => s.launches.length === 2, 60);
    assert.deepEqual(s.launches[1], { stage: 'louyang', lap: 4 });
    s.char.gs = 40000; s.finish(true); s.until(() => s.launches.length === 3, 60);
    assert.deepEqual(s.launches[2], { stage: 'prontera', lap: 5 });
  } finally { f.close(); }
});

for (const progression of [false, true]) test(`unknown gear-lock reason never starts farming; progression=${progression}`, async () => {
  const f = await browserFixture({ repeat: true, progression, expeditionLap: 4, expedition: 'orcs' });
  try {
    const s = expeditionScenario(f, { requirements: false }); s.char.gs = 7000; s.render();
    for (let i = 0; i < 20; i++) f.advance(900);
    assert.equal(s.launches.length, 0); assert.match(f.ui.querySelector('#status').textContent, /無法出發/);
  } finally { f.close(); }
});

test('gear and job requirements together wait instead of farming a story map', async () => {
  const f = await browserFixture({ repeat: true, progression: true, expeditionLap: 1, expedition: 'payon_cave' });
  try {
    const s = expeditionScenario(f); s.until(() => s.launches.length === 1); s.char.gs = 170; s.char.jobLevel = 1; s.finish(true);
    for (let i = 0; i < 25; i++) f.advance(900);
    assert.equal(s.launches.length, 1); assert.match(f.ui.querySelector('#status').textContent, /Job Lv/);
  } finally { f.close(); }
});

test('farming honours shared run limit and cannot endlessly bypass the configured cap', async () => {
  const f = await browserFixture({ repeat: true, progression: true, repeatLimit: 2, expeditionLap: 4, expedition: 'payon_cave' });
  try {
    const s = expeditionScenario(f); s.until(() => s.launches.length === 1); s.char.gs = 7000; s.finish(true); s.until(() => s.launches.length === 2);
    s.finish(true); for (let i = 0; i < 25; i++) f.advance(900);
    assert.equal(s.launches.length, 2); assert.match(f.ui.querySelector('#status').textContent, /2 次上限/);
  } finally { f.close(); }
});

test('post-run auto-equip raises score before rechecking, so no unnecessary farming run starts', async () => {
  const f = await browserFixture({ repeat: true, progression: true, autoEquip: true, expeditionLap: 4, expedition: 'payon_cave' });
  try {
    const s = expeditionScenario(f), d = f.w.document;
    d.querySelector('#lobby-char').onclick = () => d.querySelector('#charpanel').classList.remove('hidden');
    d.querySelector('#cp-back').onclick = () => d.querySelector('#charpanel').classList.add('hidden');
    d.querySelector('#cp-tab-equip').insertAdjacentHTML('beforeend', '<button id="cp-auto-btn">一鍵穿裝</button>');
    d.querySelector('#cp-auto-btn').onclick = () => { s.char.gs = 20000; s.actions.push('equip'); };
    s.until(() => s.launches.length === 1); s.char.gs = 7000; s.finish(true); s.until(() => s.launches.length === 2, 60);
    assert.equal(s.launches[1].stage, 'orcs'); assert(s.actions.indexOf('equip') < s.actions.indexOf('launch:orcs'));
  } finally { f.close(); }
});

test('a saved blocked-target config recovers its previous cleared map after refresh', async () => {
  const f = await browserFixture({ repeat: true, progression: true, expeditionLap: 4, expedition: 'orcs' });
  try {
    const s = expeditionScenario(f); s.char.gs = 7000; s.render(); s.until(() => s.launches.length === 1);
    assert.deepEqual(s.launches[0], { stage: 'payon_cave', lap: 4 });
    assert.equal(JSON.parse(f.w.localStorage.getItem(STORAGE)).expedition, 'payon_cave');
  } finally { f.close(); }
});

test('fixed mode with a confirmed gear-only lock does not switch to another map', async () => {
  const f = await browserFixture({ repeat: true, progression: false, expeditionLap: 4, expedition: 'orcs' });
  try {
    const s = expeditionScenario(f); s.char.gs = 7000; s.render();
    for (let i = 0; i < 20; i++) f.advance(900);
    assert.equal(s.launches.length, 0); assert.equal(f.ui.querySelector('[data-setting="expedition"]').value, 'orcs');
  } finally { f.close(); }
});

test('gear-only lock without a reachable cleared source waits instead of cycling between maps', async () => {
  const f = await browserFixture({ repeat: true, progression: true, expeditionLap: 4, expedition: 'orcs' });
  try {
    const s = expeditionScenario(f); s.char.gs = 0; s.render();
    for (let i = 0; i < 20; i++) f.advance(900);
    assert.equal(s.launches.length, 0); assert.match(f.ui.querySelector('#status').textContent, /沒有可確認已通關且可出發/);
  } finally { f.close(); }
});

test('importing a new target discards a pending farming plan before resuming', async () => {
  const f = await browserFixture({ repeat: true, progression: true, expeditionLap: 4, expedition: 'payon_cave' });
  try {
    const s = expeditionScenario(f); s.until(() => s.launches.length === 1); s.char.gs = 7000; s.finish(true);
    s.until(() => /回刷/.test(f.ui.querySelector('#repeat-status').textContent));
    f.ui.querySelector('#export').click(); const imported = JSON.parse(f.ui.querySelector('#config').value);
    imported.progression = false; imported.expedition = 'payon'; f.ui.querySelector('#config').value = JSON.stringify(imported);
    f.ui.querySelector('#import').click(); f.ui.querySelector('#toggle').click();
    s.until(() => s.launches.length === 2); assert.equal(s.launches[1].stage, 'payon');
  } finally { f.close(); }
});
