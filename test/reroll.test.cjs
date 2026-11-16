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
  function advance(ms) { now += ms; for (const [id, timer] of [...timers]) if (timer.at <= now) { timers.delete(id); timer.fn(); } for (const timer of intervals.values()) if (timer.ms === 100 || timer.ms === 500) timer.fn(); }
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
  return { w, ui, game, hooks, setting, advance, picker, errors, close() { assert.deepEqual(errors, []); dom.window.close(); } };
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
  assert.equal(cfg({ expeditionLap: 4 }).expeditionLap, 1);
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
