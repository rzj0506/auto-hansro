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
async function browserFixture(saved = {}, mailSaved = null, digestSaved = null) {
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
  if(mailSaved)w.localStorage.setItem('ro-survivors-helper.emailjs.v1',JSON.stringify(mailSaved));
  if (digestSaved) w.sessionStorage.setItem('ro-survivors-helper.mail-digest.v1', digestSaved);
  const hooks = { start: [], tick: [], hurt: [], cast: [], kill: [] };
  const registry = Object.fromEntries([...C.FIXED, 'soul_strike', 'napalm'].map(id => [id, { name: ({ firebolt: '火箭術', coldbolt: '冰箭術', lightning: '雷擊術', soul_strike: '聖靈召喚', napalm: '心靈爆破' })[id] }]));
  const items = { p_cd: { id: 'p_cd', slot: 'potion', name: '冷卻藥水' }, p_hp: { id: 'p_hp', slot: 'potion', name: '生命藥水' }, p_dmg: { id: 'p_dmg', slot: 'potion', name: '傷害藥水' }, p_area: { id: 'p_area', slot: 'potion', name: '範圍藥水' }, e_dmg: { id: 'e_dmg', slot: 'elixir', name: '傷害秘藥' }, e_hp: { id: 'e_hp', slot: 'elixir', name: '生命秘藥' }, b_dmg: { id: 'b_dmg', slot: 'blessing', name: '傷害祝福' } };
  const camera={yaw:0,targetYaw:0,zoom:.2,targetZoom:.2},assets={icons:new w.Map(),itemTextures:new w.Map(),sheets:new w.Map([['npc_knight',{}],['npc_vendor',{}]]),manifest:{items:{}}};
  const World=w.eval(`(function(camera){return class World{
    setView(x,y){this.focus={x,y}} render(layer){this.layer=layer}
    project(x,y,z=0){const dx=x-(this.focus?.x||0),dy=y-(this.focus?.y||0);return{x:512+(dx*Math.cos(camera.yaw)-dy*Math.sin(camera.yaw))*.5,y:384+(dx*Math.sin(camera.yaw)+dy*Math.cos(camera.yaw))*.3-z*.5}}
    pickGround(x,y){const dx=(x-512)/.5,dy=(y-384)/.3;return{x:(this.focus?.x||0)+dx*Math.cos(camera.yaw)+dy*Math.sin(camera.yaw),y:(this.focus?.y||0)-dx*Math.sin(camera.yaw)+dy*Math.cos(camera.yaw)}}
    spriteLift(height){return height} setCellCursor(){}
  }} )`)(camera);
  w.__testImport = async () => ({ hooks, registry, items, World, camera, assets });
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
  function policy(key, value) {
    const element = ui.querySelector(`[data-card-policy="${key}"]`);
    element.value = value;
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
  return { w, ui, game, hooks, items, World, camera, assets, setting, policy, advance, picker, errors, close() { assert.deepEqual(errors, []); dom.window.close(); } };
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
  assert.equal(options.skillLevelGate, false); assert.equal(options.chestLevelGate,false); assert.equal(options.autoEquip, false); assert.equal(options.autoSell, false);
  assert.deepEqual(options.sellQualities, []);
  assert.equal(options.expeditionLap, 1);
  assert.deepEqual(cfg({ sellQualities: [0,2,3,4,2,'4',99,-1] }).sellQualities, [0,2,3,4]);
  assert.equal(cfg({ skillSaveAtLevel: -1 }).skillSaveAtLevel, 1);
  assert.equal(cfg({ chestSaveAtTotal: 999999 }).chestSaveAtTotal, 99999);
  assert.equal(cfg({ expeditionLap: 3 }).expeditionLap, 3);
  assert.equal(cfg({ expeditionLap: 4 }).expeditionLap, 4);
});

const native = require('./fixtures/native-ui.json');
test('removed time/skill-total section does not reappear or apply old settings after import',async()=>{
 const f=await browserFixture({noFlipEnabled:true,noFlipMinutes:0,noFlipLevelEnabled:true,noFlipTotalLevel:1});try{
  assert.equal(f.ui.querySelector('[data-setting="noFlipEnabled"]'),null);assert.equal(f.ui.querySelector('#skill-total'),null);
  assert(f.ui.querySelector('[data-setting="skillLevelGate"]'));assert(f.ui.querySelector('[data-setting="chestLevelGate"]'));
  f.ui.querySelector('#export').click();const saved=JSON.parse(f.ui.querySelector('#config').value);
  assert.equal(saved.noFlipEnabled,undefined);assert.equal(saved.noFlipTotalLevel,undefined);assert.equal(f.game.roNoFlip,undefined);
 }finally{f.close();}
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


test('second-chapter expeditions switch chapter before lap and follow native progression with global map indices', async () => {
  const f = await browserFixture({ repeat: true, progression: true, expeditionLap: 2, expedition: 'c2_gef' });
  try {
    townMarkup(f);
    const d = f.w.document, stages = d.querySelector('#stages'), go = d.querySelector('#stg-go');
    stages.insertAdjacentHTML('afterbegin', '<div id="ch-tabs"></div>');
    stages.classList.remove('hidden');
    let chapter = 1, lap = 1, selected = 0, locked = true;
    const actions = [];
    function render() {
      d.querySelector('#ch-tabs').innerHTML = [1, 2].map(n => `<button data-chtab="${n}" class="${n === chapter ? 'primary' : ''}">${n === 1 ? '第一章' : '第二章'}${n === 2 && locked ? ' 🔒' : ''}</button>`).join('');
      for (const tab of d.querySelectorAll('[data-chtab]')) tab.onclick = () => {
        chapter = +tab.dataset.chtab; lap = 1; selected = chapter === 2 ? 12 : 0;
        actions.push(`chapter:${chapter}`); render();
      };
      d.querySelector('#lap-tabs').innerHTML = Array.from({ length: chapter === 2 && !locked ? 2 : 1 }, (_, i) =>
        `<button data-laptab="${i + 1}" class="${lap === i + 1 ? 'primary' : ''}">${C.LAP_LABELS[i]}</button>`).join('');
      for (const tab of d.querySelectorAll('[data-laptab]')) tab.onclick = () => { lap = +tab.dataset.laptab; actions.push(`lap:${lap}`); render(); };
      d.querySelector('#stg-list').innerHTML = C.STAGES.map(([id, name], index) => {
        if ((id.startsWith('c2_') ? 2 : 1) !== chapter) return '';
        const status = locked && chapter === 2 ? 'locked' : lap === 2 && index === 12 ? 'cleared' : 'open';
        const title = index === 13 ? 'Sótano de la Torre del Reloj' : name;
        return `<button class="stg-card ${status}${index === selected ? ' sel' : ''}" data-i="${index}"><span class="stg-card-info"><b>${title}${C.LAP_SUFFIXES[lap - 1]}</b></span></button>`;
      }).join('');
      for (const card of d.querySelectorAll('.stg-card')) card.onclick = () => {
        selected = +card.dataset.i; actions.push(`stage:${selected}`); render();
      };
      go.disabled = locked && chapter === 2;
    }
    render();
    go.onclick = () => { actions.push(`go:${chapter}:${lap}:${selected}`); stages.classList.add('hidden'); };
    for (let i = 0; i < 3; i++) f.advance(1100);
    assert.deepEqual(actions, ['chapter:2']);
    assert.match(f.ui.querySelector('#status').textContent, /周目尚未解鎖/);
    const select = f.ui.querySelector('[data-setting="expedition"]');
    assert.equal(select.querySelector('optgroup[label="第二章"]').children.length, 5);
    assert.equal(select.value, 'c2_gef');

    locked = false; render();
    for (let i = 0; i < 5; i++) f.advance(1100);
    assert.deepEqual(actions, ['chapter:2', 'lap:2', 'stage:13', 'go:2:2:13']);
    assert.equal(JSON.parse(f.w.localStorage.getItem(STORAGE)).expedition, 'c2_clock');
    assert.equal(select.querySelector('option[value="c2_clock"]').textContent, 'Sótano de la Torre del Reloj');
  } finally { f.close(); }
});

test('skill fields and long settings start collapsed and still save through the expanded panel', async () => {
  const f = await browserFixture({});
  try {
    const panel = f.ui.querySelector('#panel'), fields = ['first', 'second', 'third', 'fourth', 'fifth', 'skillSlots'];
    const group = f.ui.querySelector('#job-profile').closest('details');
    assert.equal(panel.querySelectorAll('details[open]').length, 0);
    assert(fields.every(key => group.contains(panel.querySelector(`[data-setting="${key}"]`))));
    group.querySelector('summary').click();
    assert.equal(group.open, true);
    f.setting('first', 'soul_strike');
    group.querySelector('summary').click();
    assert.equal(group.open, false);
    assert.equal(JSON.parse(f.w.localStorage.getItem(STORAGE)).first, 'soul_strike');
  } finally { f.close(); }
});

test('magnet interval uses game time and restarts after native pickup', async () => {
  const f = await browserFixture({ pickups: true, chests: false, magnetInterval: 30 });
  try {
    f.w.document.body.insertAdjacentHTML('beforeend', '<div id="hud"></div>');
    const magnet = { kind: 'magnet', x: 860, y: 480 };
    const otherMagnet = { kind: 'magnet', x: 900, y: 480 };
    const gem = { kind: 'gem_blue', x: 430, y: 480 };
    const moves = [];
    Object.assign(f.game, { state: 'playing', stageId: 'prontera', pickups: [gem, magnet, otherMagnet],
      zeny: 0, chestCost: () => 100, classDef: { speed: 100 }, stats: { speedMult: 1 },
      buffValue: () => 0, bounds: { minX: 0, minY: 0, maxX: 1200, maxY: 1200 },
      moveTo(x) { moves.push(x); } });
    const step = (time, direction) => {
      f.game.time = time; f.advance(1100);
      assert(direction * (moves.pop() - f.game.player.x) > 0, `movement at game time ${time}`);
    };
    const status = f.ui.querySelector('#magnet-status');
    step(29, -1);
    assert.match(status.textContent, /還有 1 局內秒/);
    step(30, 1);
    assert.match(status.textContent, /正在引導拾取/);
    magnet.magnet = true;
    step(31, -1);
    assert.match(status.textContent, /吸附中/);
    magnet.dead = true; f.game.pickups = [gem, otherMagnet];
    step(32, -1);
    assert.match(status.textContent, /還有 30 局內秒.*已拾取 1 次/);
    step(61, -1);
    step(62, 1);
    f.setting('magnetInterval', 0);
    assert.equal(JSON.parse(f.w.localStorage.getItem(STORAGE)).magnetInterval, 0);
    assert.equal(status.hidden, true);
  } finally { f.close(); }
});



function pickupRun(f, options = {}) {
  f.w.document.body.insertAdjacentHTML('beforeend', '<div id="hud"></div>');
  const moves = [], playerX = f.game.player.x;
  Object.assign(f.game, { state: 'playing', stageId: 'prontera', lootUntil: -1, time: 0, level: 9, zeny: 100,
    chestCost: () => 10, classDef: { speed: 100 }, stats: { speedMult: 1 },
    buffValue: () => 0, bounds: { minX: 0, minY: 0, maxX: 1200, maxY: 1200 },
    moveTo(x) { moves.push(Math.sign(x - playerX)); }, ...options });
  const step = (time, pickups, direction) => {
    moves.length = 0;
    Object.assign(f.game, { time, pickups }); f.advance(1100);
    assert.deepEqual(moves, direction ? [direction] : [], `movement at game time ${time}`);
  };
  return { step, game: f.game };
}

test('active chest and XP pickup stops independently at the configured levels, while magnets and gear remain eligible', async () => {
  const f = await browserFixture({ dodge: false, chestHunt: true, pickups: true, stopChestPickupAtTotal: 20, stopXpPickupAtLevel: 10, magnetInterval: 30 });
  try {
    const { step, game } = pickupRun(f);
    const setChest = count => {
      game.runItems = { slots: new Map([['potion', { vals: Array(8) }], ['deity', { vals: Array(count - 8) }]]) };
    };
    const chest = { kind: 'chest', x: 600, y: 480 };
    const gems = ['blue', 'yellow', 'red'].map(color => ({ kind: `gem_${color}`, x: 450, y: 480 }));
    const gear = { kind: 'loot', x: 650, y: 480 }, magnet = { kind: 'magnet', x: 800, y: 480 };
    const status = f.ui.querySelector('#pickup-threshold-status');

    setChest(19); step(1, [chest, ...gems], 1);
    game.level = 10; step(2, [chest, ...gems], 1);
    step(3, gems, 0);
    setChest(20); game.level = 9; step(4, [chest, ...gems], -1);
    assert.match(status.textContent, /寶箱 20／20 · 等磁鐵.*角色 9／10 · 主動拾取經驗/);
    game.level = 10; step(5, [chest, ...gems, magnet], 0);
    step(6, [chest, ...gems, gear], 1);
    step(30, [chest, ...gems, magnet], 1);
    delete game.runItems; delete game.level;
    step(31, [chest, ...gems], 1);

    f.setting('stopChestPickupAtTotal', 0);
    f.setting('stopXpPickupAtLevel', 0);
    setChest(110); game.level = 100;
    step(32, [chest], 1);
    step(33, gems, -1);
  } finally { f.close(); }
});

test('native boss countdown takes priority over early exit and collects rewards even with normal pickup disabled', async () => {
  const f = await browserFixture({ dodge: false, pickups: false, chestHunt: true, magnetInterval: 60,
    stopChestPickupAtTotal: 20, stopXpPickupAtLevel: 10, timedExitEnabled: true, timedExitMinutes: 0.1 });
  try {
    const { step, game } = pickupRun(f, { lootUntil: 30, level: 30, runItems: { slots: new Map([['potion', { vals: Array(25) }]]) } });
    const doc = f.w.document;
    doc.body.insertAdjacentHTML('beforeend', '<button id="btn-endrun">結束</button>');
    let earlyExits = 0;
    doc.querySelector('#btn-endrun').onclick = () => earlyExits++;
    const chest = { kind: 'chest', x: 470, y: 480 }, gem = { kind: 'gem_blue', x: 430, y: 480 };
    const gear = { kind: 'loot', x: 630, y: 480 }, magnet = { kind: 'magnet', x: 780, y: 480 };
    step(10, [chest, gem, { ...gear, x: 455 }, magnet], 1);
    assert.match(f.ui.querySelector('#victory-loot-status').textContent, /剩 20 局內秒/);
    step(11, [chest], 0);
    step(12, [chest, gem, gear], 1);
    step(13, [chest, gem], -1);
    assert.equal(earlyExits, 0);

    doc.body.insertAdjacentHTML('beforeend', '<div id="drop-reveal"><div class="dr-inner"><button class="dr-get">領取</button></div></div>');
    let claimed = 0;
    doc.querySelector('.dr-get').onclick = () => { claimed++; doc.querySelector('#drop-reveal').classList.add('hidden'); };
    game.state = 'reveal';
    f.advance(100); f.advance(800);
    assert.equal(claimed, 1);
    game.state = 'over';
    step(30, [gem], 0);
    assert.equal(f.ui.querySelector('#victory-loot-status').hidden, true);
  } finally { f.close(); }
});

test('card policies migrate old settings and the treasure switch stays independent', async () => {
  const f = await browserFixture({ skills: false, chests: false, storedOpenMode: 'both', dodge: false, pickups: false });
  try {
    const find = key => f.ui.querySelector(`[data-setting="${key}"]`);
    for (const key of ['skills', 'chests']) assert.equal(find(key), null);
    const movement = find('chestHunt').closest('details');
    for (const key of ['dodge', 'pickups']) assert(movement.contains(find(key)));
    const skillPolicy = f.ui.querySelector('[data-card-policy="skills"]');
    const chestPolicy = f.ui.querySelector('[data-card-policy="chests"]');
    assert.equal(skillPolicy.value, 'manual');
    assert.equal(chestPolicy.value, 'manual');
    assert.equal(find('chestHunt').checked, false);

    f.setting('chestHunt', true);
    assert.equal(chestPolicy.value, 'manual');
    f.policy('skills', 'pick'); f.policy('chests', 'open');
    const saved = JSON.parse(f.w.localStorage.getItem(STORAGE));
    assert.equal(saved.skills, true);
    assert.equal(saved.chests, true);
    assert.equal(saved.storedOpenMode, 'chests');
    assert.equal(saved.chestHunt, true);
    const chest = { kind: 'chest', x: 500, y: 475 };
    assert.equal(C.pickupTargets([chest], f.game.player, 50, 10, { ...saved, chests: false })[0].pickup, chest);
    assert.equal(C.pickupTargets([chest], f.game.player, 50, 10, { ...saved, chestHunt: false }).length, 0);
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
    const town=nativeTownScenario(f,{player:{x:0,y:0},target:{x:600,y:-400}}),down=[],up=[];
    f.w.addEventListener('keydown',e=>down.push(e.key));f.w.addEventListener('keyup',e=>up.push(e.key));
    f.ui.querySelector('#mini').focus();
    town.render();f.advance(1000); assert.deepEqual(down,['ArrowRight','ArrowUp']);
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

test('new level rules are independent in the UI and survive per-job settings export',async()=>{
 const f=await browserFixture();try{
  f.setting('skillLevelGate',true);f.setting('skillSaveAtLevel',75);f.setting('chestLevelGate',true);f.setting('chestSaveAtTotal',30);
  f.ui.querySelector('#export').click();const saved=JSON.parse(f.ui.querySelector('#config').value);
  assert.equal(saved.skillSaveAtLevel,75);assert.equal(saved.chestSaveAtTotal,30);assert.equal(saved.jobProfiles.shared.skillLevelGate,true);
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
    s.g.replayMoves = null; f.setting('bellShelter', false); f.setting('chestHunt', false); f.setting('pickups', false);
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
    assert.equal(f.ui.querySelector('[data-setting="expedition"]').options.length, 17);
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

// Execute HANS V0.13.2's actual speed controller, including the per-run reset,
// restrictions, low-FPS downgrade and run telemetry; only the game loop is a fixture.
function nativeSpeedScenario(f, { deferTimer = false, co = null, base = 1, pvp = false } = {}) {
  const fixture = require('./fixtures/native-speed.json'), d = f.w.document;
  d.body.insertAdjacentHTML('beforeend', `<div id="hud">${deferTimer ? '' : '<div id="timer-box"></div>'}</div>`);
  Object.assign(f.game, { state: 'playing', time: 0, ticks: 0, zeny: 0, chestCost: () => 10,
    classDef: { speed: 145 }, stats: { speedMult: 1 }, buffValue: () => 0,
    events: { onAnnounce(text) { announcements.push(text); } } });
  const announcements = []; f.w.__speedPvp = pvp;
  f.w.eval(`window.__fixtureSpeed=(${fixture.client})(${JSON.stringify(fixture.config)},()=>window.__speedPvp)`);
  const native = f.w.__fixtureSpeed; let game = f.game, clicks = 0;
  d.addEventListener('click', e => { if (e.target.id === 'spd-btn') clicks++; }, true);
  function frame(ms = 100) {
    const rate = native.k(game, co, Math.min(ms, 100), base);
    if (game.state === 'playing') { game.ticks += Math.round(Math.min(ms, 100) * rate / (fixture.config.step * 1000)); game.time += ms / 1000 * rate; }
    f.advance(ms); return rate;
  }
  function nextGame() {
    game = { ...f.game, player: { x: 500, y: 500, dead: false }, roSpd: undefined, ticks: 0, time: 0 };
    f.hooks.start[0](game); return game;
  }
  return { native, frame, nextGame, announcements, get game() { return game; }, get clicks() { return clicks; }, get button() { return d.querySelector('#spd-btn'); } };
}

test('auto 2x defaults off, validates booleans, saves its checkbox and survives export/import/reload', async () => {
  assert.equal(C.validateConfig({}).autoDoubleSpeed, false);
  assert.equal(C.validateConfig({ autoDoubleSpeed: 'true' }).autoDoubleSpeed, false);
  const f = await browserFixture(); let saved;
  try {
    const s = nativeSpeedScenario(f); s.frame(); s.frame(); assert.equal(s.game.roSpd, 1); assert.equal(s.clicks, 0);
    f.setting('autoDoubleSpeed', true); f.ui.querySelector('#export').click(); saved = JSON.parse(f.ui.querySelector('#config').value);
    assert.equal(saved.autoDoubleSpeed, true); f.ui.querySelector('#import').click();
    assert.equal(f.ui.querySelector('[data-setting="autoDoubleSpeed"]').checked, true);
    assert.equal(JSON.parse(f.w.localStorage.getItem(STORAGE)).enabled, false);
  } finally { f.close(); }
  const reload = await browserFixture(saved);
  try { assert.equal(reload.ui.querySelector('[data-setting="autoDoubleSpeed"]').checked, true); }
  finally { reload.close(); }
});

test('auto 2x clicks native expedition button once and preserves native speed telemetry', async () => {
  const f = await browserFixture({ autoDoubleSpeed: true });
  try {
    const s = nativeSpeedScenario(f); const run = s.native.reg(); s.native.bind({ run: 'fixture-run' }, run);
    s.frame(); assert.equal(s.button.textContent, '2x');
    for (let i = 0; i < 20; i++) s.frame();
    assert.equal(s.game.roSpd, 2); assert.equal(s.clicks, 1); assert(s.native.claim('fixture-run').x2 > 0);
    f.ui.querySelector('#diagnose').click(); const report = JSON.parse(f.ui.querySelector('#config').value);
    assert.equal(report.speed.enabled, true); assert.equal(report.speed.native, 2); assert.equal(report.speed.applied, true);
  } finally { f.close(); }
});

test('auto 2x waits for native button mount without marking the run complete', async () => {
  const f = await browserFixture({ autoDoubleSpeed: true });
  try {
    const s = nativeSpeedScenario(f, { deferTimer: true }); s.frame(); s.frame(); assert.equal(s.clicks, 0);
    f.w.document.querySelector('#hud').insertAdjacentHTML('beforeend', '<div id="timer-box"></div>');
    s.frame(); s.frame(); assert.equal(s.game.roSpd, 2); assert.equal(s.clicks, 1);
  } finally { f.close(); }
});

test('auto 2x resets each run and waits past a stale previous-run 2x button', async () => {
  const f = await browserFixture({ autoDoubleSpeed: true });
  try {
    const s = nativeSpeedScenario(f); s.frame(); s.frame(); assert.equal(s.clicks, 1);
    s.nextGame(); f.advance(500); assert.equal(s.clicks, 1, 'old 2x display is not a new-run confirmation');
    s.frame(); s.frame(); assert.equal(s.game.roSpd, 2); assert.equal(s.clicks, 2);
  } finally { f.close(); }
});

test('auto 2x accepts an already enabled native speed without toggling it off', async () => {
  const f = await browserFixture();
  try {
    const s = nativeSpeedScenario(f); s.frame(); s.button.click(); s.frame(); const clicks = s.clicks;
    f.setting('autoDoubleSpeed', true); s.frame(); assert.equal(s.game.roSpd, 2); assert.equal(s.clicks, clicks);
  } finally { f.close(); }
});

test('auto 2x applies during a run when enabled, then retains manual changes and opt-out speed', async () => {
  const f = await browserFixture();
  try {
    const s = nativeSpeedScenario(f); s.frame(); f.setting('autoDoubleSpeed', true); s.frame(); s.frame();
    f.setting('autoDoubleSpeed', false); s.frame(); assert.equal(s.game.roSpd, 2);
    s.button.click(); s.frame(); assert.equal(s.game.roSpd, 1);
    f.setting('autoDoubleSpeed', true); s.frame(); s.frame(); assert.equal(s.game.roSpd, 2);
    s.button.click(); for (let i = 0; i < 10; i++) s.frame(); assert.equal(s.game.roSpd, 1);
    assert.match(f.ui.querySelector('#speed-status').textContent, /保留遊戲降速／手動調整/);
  } finally { f.close(); }
});

test('auto 2x respects assistant pause and game pause before applying', async () => {
  const f = await browserFixture({ autoDoubleSpeed: true });
  try {
    const s = nativeSpeedScenario(f); f.ui.querySelector('#toggle').click(); s.frame(); assert.equal(s.clicks, 0);
    f.ui.querySelector('#toggle').click(); s.game.state = 'paused'; s.frame(); assert.equal(s.clicks, 0);
    s.game.state = 'playing'; s.frame(); s.frame(); assert.equal(s.game.roSpd, 2);
  } finally { f.close(); }
});

for (const mode of ['coop', 'connection', 'endless', 'story', 'pvp', 'replay']) test(`auto 2x preserves native restrictions for ${mode}`, async () => {
  const f = await browserFixture({ autoDoubleSpeed: true });
  try {
    const s = nativeSpeedScenario(f, { co: mode === 'connection' ? {} : null, pvp: mode === 'pvp', base: mode === 'endless' ? 4 : 1 });
    if (mode === 'coop') s.game.coop = {};
    if (mode === 'endless') s.game.endless = {};
    if (mode === 'story') s.game.isStory = true;
    if (mode === 'replay') s.game.replayMoves = [];
    for (let i = 0; i < 3; i++) s.frame();
    assert.equal(s.clicks, 0); assert.equal(s.game.roSpd, 1);
  } finally { f.close(); }
});

test('native low-FPS fallback to 1x is preserved instead of being repeatedly overridden', async () => {
  const f = await browserFixture({ autoDoubleSpeed: true });
  try {
    const s = nativeSpeedScenario(f); s.frame(); s.frame();
    for (let i = 0; i < 20; i++) s.frame(500);
    assert.equal(s.game.roSpd, 1); assert.equal(s.clicks, 1); assert.equal(s.native.state().on, false);
    assert(s.announcements.some(t => /已自動切回/.test(t)));
  } finally { f.close(); }
});

test('nonresponsive native speed button is attempted once and does not stall automation', async () => {
  const f = await browserFixture();
  try {
    const s = nativeSpeedScenario(f); s.frame(); s.button.onclick = () => {};
    f.setting('autoDoubleSpeed', true); for (let i = 0; i < 30; i++) s.frame();
    assert.equal(s.clicks, 1); assert.equal(s.game.roSpd, 1);
    assert.match(f.ui.querySelector('#log').textContent, /已嘗試切換2x/);
    f.ui.querySelector('#diagnose').click(); const report = JSON.parse(f.ui.querySelector('#config').value);
    assert.equal(report.speed.applied, false); assert.equal(report.speed.handled, true);
    assert.match(f.ui.querySelector('#speed-status').textContent, /已嘗試切換2x/);
  } finally { f.close(); }
});

test('job profiles migrate old mage setup and independently retain skills, chest priorities and globals',async()=>{
  const f=await browserFixture({fourth:'soul_strike',priorities:{potion:'p_cd'},autoDoubleSpeed:true});let saved;
  try{
    const mage={...f.game,classDef:{id:'mage',name:'魔法師',start:'firebolt'},slots:['firebolt']};f.hooks.start[0](mage);
    assert.equal(f.ui.querySelector('#job-profile').value,'mage');assert.match(f.ui.querySelector('[data-setting="fourth"]').value,/soul_strike/);
    const sword={...f.game,classDef:{id:'swordsman',name:'劍士',start:'bash'},slots:['bash']};f.hooks.start[0](sword);
    assert.equal(f.ui.querySelector('[data-setting="first"]').value,'');assert.equal(f.ui.querySelector('[data-priority="potion"]').value,'');
    f.setting('first','bash');f.setting('fourth','magnum');f.setting('skillReroll',false);
    const area=f.ui.querySelector('[data-priority="potion"]');area.value='p_hp';area.dispatchEvent(new f.w.Event('input',{bubbles:true}));
    f.hooks.start[0]({...mage});assert.match(f.ui.querySelector('[data-priority="potion"]').value,/p_cd/);assert.equal(f.ui.querySelector('[data-setting="skillReroll"]').checked,true);
    f.hooks.start[0]({...sword});assert.equal(f.ui.querySelector('[data-setting="first"]').value,'bash');assert.match(f.ui.querySelector('[data-priority="potion"]').value,/p_hp/);
    assert.equal(f.ui.querySelector('[data-setting="skillReroll"]').checked,false);assert.equal(f.ui.querySelector('[data-setting="autoDoubleSpeed"]').checked,true);
    f.ui.querySelector('#export').click();saved=JSON.parse(f.ui.querySelector('#config').value);
    assert.equal(saved.jobProfiles.shared.fourth,'soul_strike');assert.equal(saved.jobProfiles.mage.priorities.potion,'p_cd');
  }finally{f.close();}
  const r=await browserFixture(saved);try{assert.equal(r.ui.querySelector('#job-profile').value,'swordsman');assert.equal(r.ui.querySelector('[data-setting="first"]').value,'bash');}finally{r.close();}
});

test('promotions get separate profiles and manual profile editing pauses then resumes with current job',async()=>{
  const f=await browserFixture();try{
    f.w.document.body.insertAdjacentHTML('beforeend','<div id="hud"></div>');
    const base={...f.game,classDef:{id:'mage',name:'魔法師',start:'firebolt'},slots:['firebolt']};f.hooks.start[0](base);f.setting('fourth','napalm');
    const wizard={...base,look:{promotion:'wizard'},jobLabel:'巫師'};f.hooks.start[0](wizard);assert.equal(f.ui.querySelector('#job-profile').value,'wizard');
    f.setting('fourth','soul_strike');const select=f.ui.querySelector('#job-profile');select.value='mage';select.dispatchEvent(new f.w.Event('change',{bubbles:true}));
    assert.equal(JSON.parse(f.w.localStorage.getItem(STORAGE)).enabled,false);assert.match(f.ui.querySelector('[data-setting="fourth"]').value,/napalm/);
    f.ui.querySelector('#toggle').click();assert.equal(select.value,'wizard');assert.match(f.ui.querySelector('[data-setting="fourth"]').value,/soul_strike/);
  }finally{f.close();}
});

test('actual non-mage skill picker accepts its job skill with blank generic targets',async()=>{
  const f=await browserFixture();try{
    const ns=await f.w.__testImport();ns.registry.bash={name:'狂擊'};ns.registry.magnum={name:'怒爆'};
    const game={...f.game,classDef:{id:'swordsman',name:'劍士',start:'bash'},slots:['bash']};f.hooks.start[0](game);
    const d=f.w.document,p=d.querySelector('#picker');p.classList.remove('hidden');d.querySelector('#pk-title').textContent='Level Up!';
    d.querySelector('#pk-cards').innerHTML='<div class="pk-slot"><button class="pk-card"><span class="pk-name">怒爆</span><span class="pk-badge">技能</span><span class="pk-ribbon">新</span></button></div>';
    let chosen=0;p.querySelector('.pk-card').onclick=()=>{chosen++;p.classList.add('hidden')};f.advance(100);f.advance(1100);assert.equal(chosen,1);
  }finally{f.close();}
});

test('profile import/export retains all jobs and shared-copy changes only the selected profile',async()=>{
  const f=await browserFixture({fourth:'napalm'});try{
    f.hooks.start[0]({...f.game,classDef:{id:'swordsman',name:'劍士',start:'bash'}});f.setting('first','bash');
    f.ui.querySelector('#copy-shared-profile').click();assert.equal(f.ui.querySelector('[data-setting="first"]').value,'firebolt');assert.match(f.ui.querySelector('[data-setting="fourth"]').value,/napalm/);
    f.ui.querySelector('#export').click();const exported=JSON.parse(f.ui.querySelector('#config').value);assert.equal(exported.jobProfiles.shared.first,'firebolt');
    f.ui.querySelector('#import').click();assert.equal(f.ui.querySelector('#job-profile').value,'swordsman');assert.equal(JSON.parse(f.w.localStorage.getItem(STORAGE)).enabled,false);
  }finally{f.close();}
});

function timedRunScenario(f,game=f.game){
  const fixture=require('./fixtures/native-job-run.json'),d=f.w.document;
  if(!d.querySelector('#hud'))d.body.insertAdjacentHTML('beforeend','<div id="hud"></div>');
  if(!d.querySelector('#gameover'))d.body.insertAdjacentHTML('beforeend','<div id="gameover" class="hidden"><div id="go-title"></div><button id="btn-restart">返回</button></div>');
  if(!d.querySelector('#go-title'))d.querySelector('#gameover').insertAdjacentHTML('afterbegin','<div id="go-title"></div>');
  if(!d.querySelector('#pause'))d.body.insertAdjacentHTML('beforeend','<div id="pause" class="hidden"><button id="btn-endrun" class="hidden">結束</button><button id="btn-quit">退出</button></div>');
  if(!d.querySelector('#drop-reveal'))d.body.insertAdjacentHTML('beforeend','<div id="drop-reveal" class="hidden"></div>');
  const report={game,saved:0,snapshotsCleared:0,settlements:[],records:[],claims:0,char:{id:'fixture',job:'mage',record:{runs:0,totalKills:0,bestTime:0,bestLevel:0,bestKills:0,wins:0},level:1,exp:0,jobLevel:1,jobExp:0,inventory:[],cards:{},mvpsDefeated:[],stagesCleared:[]}};
  Object.assign(game,{state:'playing',stageId:'payon',difficulty:{lap:1},classDef:{id:'mage',name:'魔法師',start:'firebolt',speed:145},stats:{speedMult:1},buffValue:()=>0,chestCost:()=>10,zeny:100,
    time:179.9,ticks:0,level:1,kills:0,bossKills:0,killsBy:new Map(),mvpsKilled:[],runLoot:[],runCards:[],runEggs:[],charExp:{base:0,job:0},pickups:[],moves:[],
    moveTo(x,y){this.movePath=[{x,y}];this.moves.push({x,y})},events:{onDrop(item){
      const r=d.querySelector('#drop-reveal');r.classList.remove('hidden');r.innerHTML=`<div class="dr-inner"><span class="dr-name">${item.kind}</span><button class="dr-get">領取</button></div>`;
      r.querySelector('button').onclick=()=>{report.claims++;r.classList.add('hidden');game.state='playing'};
    }}});
  f.w.__timedReport=report;
  f.w.eval(`(()=>{
    const N=window.__timedReport;let F=N.game,mt=N.char,Kn=false,ft=null;
    const RO_PVP={wi:()=>false},tt={payon:{bosses:[{id:'eddga'}]}},xe=[{id:'payon',map:'pay_fild08'}],RO_LAPOF=g=>g.difficulty.lap;
    const Yh=()=>N.snapshotsCleared++,RO_LAPCLR=()=>{},Zl=(lv,exp,gain)=>[lv,exp+gain],Jo=()=>100,oc=99,ic=()=>100,no=()=>50,RO_TJ=a=>a.job,An=()=>0,Pg=()=>0;
    const eu=id=>({uid:'fixture-'+id,itemId:id,cards:[]}),Ih=()=>0,_a=()=>N.saved++,HL=()=>{},nA=(a,run)=>N.records.push(run),MC=()=>{},Ff=()=>{};
    const Sr=()=>{},Ca=()=>{},ur=()=>{},c=s=>s,Ae=()=>{},O={play(){}},u1=(g,win,reward,char,back)=>{N.settlements.push({win,cards:[...g.runCards],loot:[...g.runLoot]});document.querySelector('#gameover').classList.remove('hidden')};
    const ce=id=>document.getElementById(id)?.classList.add('hidden');
    ${fixture.award}
    ${fixture.finish}
    document.querySelector('#btn-endrun').onclick=${fixture.endHandler};
    N.collect=${fixture.collect};
  })()`);
  let quit=0;d.querySelector('#btn-quit').onclick=()=>quit++;
  f.hooks.tick[0](game);
  function step(seconds){for(let i=0;i<Math.round(seconds*10);i++){
    if(game.state==='playing'){
      const goal=game.movePath?.[0];if(goal){const distance=Math.hypot(goal.x-game.player.x,goal.y-game.player.y),travel=Math.min(distance,145*1.3*.1);if(distance){game.player.x+=(goal.x-game.player.x)/distance*travel;game.player.y+=(goal.y-game.player.y)/distance*travel;}if(travel>=distance)game.movePath.shift();}
      game.time+=.1;game.ticks++;
      const item=game.pickups.find(p=>!p.dead&&Math.hypot(p.x-game.player.x,p.y-(game.player.y-20))<34);
      if(item){if(item.kind==='card')report.collect.call(game,item);item.dead=true;}
    }
    f.advance(100);
  }}
  return {game,report,step,get quit(){return quit}};
}

test('three-minute native settlement collects ground card first and awards it once without saving a resumable run',async()=>{
  const f=await browserFixture({timedExitEnabled:true,expedition:'payon',timedExitMinutes:3,cleanupSeconds:20,pickups:false,chests:false,dodge:false});try{
    const s=timedRunScenario(f);s.game.pickups=[{kind:'card',ref:4001,quality:0,x:650,y:480,dead:false},{kind:'chest',x:400,y:480,dead:false}];
    s.step(.3);s.game.pickups.push({kind:'card',ref:4003,quality:0,x:700,y:480,dead:false});
    s.step(5);assert.equal(s.report.char.cards[4001],1);assert.equal(s.report.char.cards[4003],1);assert.equal(s.report.claims,2);assert.equal(s.report.saved,1);assert.equal(s.report.snapshotsCleared,1);assert.equal(s.quit,0);
    assert.equal(s.report.settlements.length,1);assert.equal(s.report.settlements[0].win,false);assert.equal(s.report.records[0].win,false);
    s.step(2);assert.equal(s.report.saved,1,'ending is not repeated');
  }finally{f.close();}
});

test('cleanup deadline does not manufacture unreachable loot and preserves only already collected cards',async()=>{
  const f=await browserFixture({timedExitEnabled:true,expedition:'payon',cleanupSeconds:1,pickups:false,chests:false,dodge:false});try{
    const s=timedRunScenario(f);s.game.runCards=[4002];s.game.pickups=[{kind:'card',ref:4001,quality:0,x:6000,y:6000,dead:false}];s.step(2);
    assert.equal(s.report.char.cards[4002],1);assert.equal(s.report.char.cards[4001],undefined);assert.match(f.ui.querySelector('#log').textContent,/仍有 1 件/);
  }finally{f.close();}
});

test('timer waits for game time, manual pause and correct map; changing setting cancels pending cleanup',async()=>{
  const f=await browserFixture({timedExitEnabled:true,expedition:'payon',cleanupSeconds:20});try{
    const s=timedRunScenario(f);s.game.time=100;f.advance(600000);assert.equal(s.report.saved,0);
    s.game.time=180;s.game.state='paused';f.advance(1000);assert.equal(s.report.saved,0);
    s.game.state='playing';f.w.document.querySelector('#hud').classList.add('hidden');s.step(.2);assert.equal(s.report.saved,0);f.w.document.querySelector('#hud').classList.remove('hidden');
    s.game.state='playing';s.game.stageId='maze';s.step(.2);assert.equal(s.report.saved,0);
    s.game.stageId='payon';s.game.pickups=[{kind:'card',x:1800,y:1800,ref:4001,dead:false}];s.step(.1);f.setting('timedExitEnabled',false);s.step(25);assert.equal(s.report.saved,0);
  }finally{f.close();}
});

test('tree-card preset selects one-lap Payon three-minute fixed loop and campaign remains exclusive',async()=>{
  const f=await browserFixture({progression:true});try{
    f.ui.querySelector('#tree-card-preset').click();let saved=JSON.parse(f.w.localStorage.getItem(STORAGE));
    assert.equal(saved.expedition,'payon');assert.equal(saved.expeditionLap,1);assert.equal(saved.timedExitMinutes,3);assert.equal(saved.repeat,true);assert.equal(saved.progression,false);assert.equal(saved.pickups,true);
    f.setting('progression',true);saved=JSON.parse(f.w.localStorage.getItem(STORAGE));assert.equal(saved.timedExitEnabled,false);
    f.setting('timedExitEnabled',true);assert.equal(f.ui.querySelector('[data-setting="progression"]').checked,false);
  }finally{f.close();}
});

test('timed loop starts a fresh run after native settlement and respects automatic run limit',async()=>{
  const f=await browserFixture({repeat:true,repeatLimit:2,timedExitEnabled:true,expedition:'payon',cleanupSeconds:0});try{
    const loop=expeditionScenario(f);loop.until(()=>loop.launches.length===1);
    const first=timedRunScenario(f,loop.current);first.game.runCards=[4001];first.step(.3);assert.equal(first.report.saved,1);
    loop.until(()=>loop.launches.length===2);const second=timedRunScenario(f,loop.current);second.game.runCards=[4001];second.step(.3);assert.equal(second.report.saved,1);
    for(let i=0;i<15;i++)f.advance(1000);assert.equal(loop.launches.length,2);assert.equal(first.quit+second.quit,0);
  }finally{f.close();}
});

test('timer cancels cleanup if game becomes a group run and never substitutes save-and-exit for missing settlement',async()=>{
  const f=await browserFixture({timedExitEnabled:true,expedition:'payon',cleanupSeconds:20});try{
    const s=timedRunScenario(f);s.game.pickups=[{kind:'card',ref:4001,x:1800,y:1800,dead:false}];s.step(.2);s.game.coop={};s.step(25);assert.equal(s.report.saved,0);
    s.game.coop=null;f.setting('cleanupSeconds',0);f.w.document.querySelector('#btn-endrun').onclick=null;s.step(1);
    assert.equal(s.report.saved,0);assert.equal(s.quit,0);assert.match(f.ui.querySelector('#log').textContent,/找不到原生結束結算/);
  }finally{f.close();}
});

const mailFixtureSettings={serviceId:'service_fixture',templateId:'template_fixture',publicKey:'public_fixture',toEmail:'user@example.com'};
const mailFlush=()=>new Promise(resolve=>setImmediate(resolve));
function mailTransport(f,handler=()=>Promise.resolve({ok:true,status:200})){
  const calls=[];f.w.fetch=(url,options)=>{calls.push({url,options,payload:JSON.parse(options.body)});return handler(url,options)};return calls;
}
function mailGame(f,patch={}){
  const d=f.w.document;if(!d.querySelector('#hud'))d.body.insertAdjacentHTML('beforeend','<div id="hud"></div>');
  const g={...f.game,state:'over',stageId:'payon',difficulty:{lap:2},time:189,level:12,kills:321,player:{x:500,y:500,dead:true},...patch};f.hooks.tick[0](g);return g;
}
test('mail setup saves locally and stays out of export and diagnostics',async()=>{
  const f=await browserFixture({deathMailEnabled:true,deathMailDigestMinutes:0});let saved,stored;try{
    for(const [key,value]of Object.entries(mailFixtureSettings))f.ui.querySelector(`[data-mail="${key}"]`).value=value;
    f.ui.querySelector('#mail-save').click();stored=JSON.parse(f.w.localStorage.getItem('ro-survivors-helper.emailjs.v1'));assert.deepEqual(stored,mailFixtureSettings);
    f.ui.querySelector('#export').click();saved=JSON.parse(f.ui.querySelector('#config').value);
    for(const value of Object.values(mailFixtureSettings))assert(!JSON.stringify(saved).includes(value));
    f.ui.querySelector('#diagnose').click();const report=JSON.parse(f.ui.querySelector('#config').value);assert.equal(report.email.configured,true);
    for(const value of Object.values(mailFixtureSettings))assert(!JSON.stringify(report).includes(value));
  }finally{f.close();}
  const r=await browserFixture(saved,stored);try{assert.equal(r.ui.querySelector('[data-mail="toEmail"]').value,mailFixtureSettings.toEmail);assert.equal(r.ui.querySelector('[data-setting="deathMailEnabled"]').checked,true);}finally{r.close();}
});
test('death sends once per run even when assistant is paused in background and death page redraws',async()=>{
  const f=await browserFixture({deathMailEnabled:true,deathMailDigestMinutes:0},mailFixtureSettings);try{
    const calls=mailTransport(f);f.ui.querySelector('#toggle').click();Object.defineProperty(f.w.document,'hidden',{configurable:true,value:true});const g=mailGame(f);
    for(let i=0;i<10;i++){f.hooks.tick[0](g);f.advance(100)}await mailFlush();
    assert.equal(calls.length,1);assert.equal(calls[0].payload.template_params.survival_time,'03:09');assert.equal(calls[0].options.credentials,'omit');assert.equal(calls[0].options.referrerPolicy,'no-referrer');
    for(let i=0;i<10;i++)f.advance(1000);await mailFlush();assert.equal(calls.length,1);assert.match(f.ui.querySelector('#mail-status').textContent,/EmailJS 已接受/);
  }finally{f.close();}
});
test('pending death snapshot survives a new run and requests respect rate interval',async()=>{
  const f=await browserFixture({deathMailEnabled:true,deathMailDigestMinutes:0},mailFixtureSettings);try{
    const calls=mailTransport(f);mailGame(f,{stageId:'payon'});mailGame(f,{stageId:'payon_cave',time:400});
    f.advance(100);await mailFlush();assert.equal(calls.length,1);assert.equal(calls[0].payload.template_params.stage_id,'payon');
    f.advance(1000);await mailFlush();assert.equal(calls.length,1);
    f.advance(100);await mailFlush();assert.equal(calls.length,2);assert.equal(calls[1].payload.template_params.stage_id,'payon_cave');
  }finally{f.close();}
});

test('two deaths form one timed digest, and refreshing preserves the pending batch', async () => {
  const initial = await browserFixture({ deathMailEnabled: true }, mailFixtureSettings);
  const key = 'ro-survivors-helper.mail-digest.v1';
  let saved;
  try {
    assert.equal(initial.ui.querySelector('[data-setting="deathMailDigestMinutes"]').value, '30');
    const calls = mailTransport(initial);
    const first = mailGame(initial, { stageId: 'payon' });
    initial.advance(2000);
    initial.hooks.tick[0](first);
    mailGame(initial, { stageId: 'c2_gef', time: 400 });
    assert.equal(calls.length, 0);
    assert.match(initial.ui.querySelector('#mail-status').textContent, /已累積 2 筆/);
    saved = initial.w.sessionStorage.getItem(key);
  } finally { initial.close(); }

  const reloaded = await browserFixture({ deathMailEnabled: true }, mailFixtureSettings, saved);
  try {
    const calls = mailTransport(reloaded);
    const elapsed = reloaded.w.performance.timeOrigin - JSON.parse(saved).startedAt;
    reloaded.advance(1800000 - elapsed - 1);
    assert.equal(calls.length, 0);
    reloaded.advance(2);
    await mailFlush();
    assert.equal(calls.length, 1);
    const { title, message, death_count } = calls[0].payload.template_params;
    assert.match(title, /遠征死亡摘要/);
    assert.equal(death_count, 2);
    assert.match(message, /斐揚森林[\s\S]*吉芬地下迷宮/);
    assert.equal(reloaded.w.sessionStorage.getItem(key), null);
    reloaded.advance(1800000);
    assert.equal(calls.length, 1);
  } finally { reloaded.close(); }
});

test('normal victory and native timed settlement never send death mail',async()=>{
  const f=await browserFixture({deathMailEnabled:true,deathMailDigestMinutes:0,timedExitEnabled:true,expedition:'payon',cleanupSeconds:0},mailFixtureSettings);try{
    const calls=mailTransport(f);mailGame(f,{player:{x:500,y:500,dead:false}});f.advance(100);await mailFlush();assert.equal(calls.length,0);
    const s=timedRunScenario(f);s.game.runCards=[4001];s.step(.3);await mailFlush();assert.equal(s.report.saved,1);assert.equal(calls.length,0);
  }finally{f.close();}
});
test('test mail works with alerts off and a double click cannot duplicate requests',async()=>{
  const f=await browserFixture({},mailFixtureSettings);try{
    const calls=mailTransport(f);f.ui.querySelector('#mail-test').click();f.ui.querySelector('#mail-test').click();await mailFlush();assert.equal(calls.length,1);
    assert.match(calls[0].payload.template_params.title,/測試/);assert.equal(f.ui.querySelector('[data-setting="deathMailEnabled"]').checked,false);
  }finally{f.close();}
});
for(const status of [400,429,500])test(`EmailJS HTTP ${status} never retries same run or stops automation`,async()=>{
  const f=await browserFixture({deathMailEnabled:true,deathMailDigestMinutes:0},mailFixtureSettings);try{
    const calls=mailTransport(f,()=>Promise.resolve({ok:false,status}));mailGame(f);f.advance(100);await mailFlush();
    for(let i=0;i<5;i++)f.advance(5000);await mailFlush();assert.equal(calls.length,1);assert.equal(JSON.parse(f.w.localStorage.getItem(STORAGE)).enabled,true);
    assert.match(f.ui.querySelector('#mail-status').textContent,new RegExp('HTTP '+status));
  }finally{f.close();}
});
test('mail request timeout is contained, reports uncertain result and does not resend',async()=>{
  const f=await browserFixture({deathMailEnabled:true,deathMailDigestMinutes:0},mailFixtureSettings);try{
    const calls=mailTransport(f,(url,options)=>new Promise((resolve,reject)=>options.signal.addEventListener('abort',()=>reject(new Error('aborted')))));
    mailGame(f);f.advance(100);assert.equal(calls.length,1);f.advance(15000);await mailFlush();
    f.advance(30000);await mailFlush();assert.equal(calls.length,1);assert.match(f.ui.querySelector('#mail-status').textContent,/逾時/);
  }finally{f.close();}
});
test('missing setup, stale lobby game and inactive game tab never send mail',async()=>{
  const f=await browserFixture({deathMailEnabled:true,deathMailDigestMinutes:0});try{
    const calls=mailTransport(f);mailGame(f);f.advance(100);await mailFlush();assert.equal(calls.length,0);
    for(const [key,value]of Object.entries(mailFixtureSettings))f.ui.querySelector(`[data-mail="${key}"]`).value=value;f.ui.querySelector('#mail-save').click();
    f.w.document.querySelector('#hud').classList.add('hidden');f.advance(2000);await mailFlush();assert.equal(calls.length,0);
    f.w.document.querySelector('#hud').classList.remove('hidden');f.w.RO_DEAD=true;f.advance(2000);await mailFlush();assert.equal(calls.length,0);
  }finally{f.close();}
});
test('turning alerts off cancels pending deaths and clear removes local service settings',async()=>{
  const f=await browserFixture({deathMailEnabled:true,deathMailDigestMinutes:0},mailFixtureSettings);try{
    const calls=mailTransport(f);mailGame(f);f.setting('deathMailEnabled',false);f.advance(2000);await mailFlush();assert.equal(calls.length,0);
    f.ui.querySelector('#mail-clear').click();assert.equal(f.w.localStorage.getItem('ro-survivors-helper.emailjs.v1'),null);
    assert.equal(f.ui.querySelector('[data-setting="deathMailEnabled"]').checked,false);assert.equal(f.ui.querySelector('[data-mail="publicKey"]').value,'');
  }finally{f.close();}
});

test('network failure does not expose provider details, retry mail or disable the assistant',async()=>{
  const f=await browserFixture({deathMailEnabled:true,deathMailDigestMinutes:0},mailFixtureSettings);try{
    const calls=mailTransport(f,()=>Promise.reject(new Error('private provider details '+mailFixtureSettings.publicKey)));
    mailGame(f);f.advance(100);await mailFlush();for(let i=0;i<5;i++)f.advance(5000);await mailFlush();
    assert.equal(calls.length,1);assert.match(f.ui.querySelector('#mail-status').textContent,/網路錯誤/);assert(!f.ui.querySelector('#log').textContent.includes(mailFixtureSettings.publicKey));
    assert.equal(JSON.parse(f.w.localStorage.getItem(STORAGE)).enabled,true);
  }finally{f.close();}
});

async function deityScenario(f, owned={}) {
  const registry=(await f.w.__testImport()).registry;
  for(const id of C.FIXED)registry[id].create=()=>{};
  f.items.g_thought={id:'g_thought',slot:'deity',name:'思考神格'};
  const nativePool=f.w.eval(`(function(ws){return ${native.chestSlotItems}})`)(f.items);
  const nativeBanish=f.w.eval(`(${require('./fixtures/native-deity.json').banishChestCard})`);
  const counts={picks:[],attempts:[],confirm:0,banish:[],card:0,deck:0,rng:0};
  let replacement='p_cd';
  function nextGame(items={}) {
    f.game={...f.game,player:{...f.game.player},runItems:{slots:new Map(Object.entries(items)),slotItems:nativePool,
      roll(){counts.rng++;return[{slot:f.items[replacement]?.slot||'deity',item:replacement}]},rollSlot(){assert.fail('native banish fallback not needed')}},
      perksLeft:{reroll:9,reroll_card:9,deity:1,banish:3},banishedItems:new Set(),focusedItems:new Set(),
      deityLearned:()=>[...C.FIXED],chestOpts(){return{swap:this.perksLeft.deity>0,banished:this.banishedItems,useless:new Set()}}};
    f.hooks.start[0](f.game);
  }
  nextGame(owned);
  const picker=f.w.document.querySelector('#picker');
  function draw(ids,{newBox=false,banishDisabled=false,confirm=true}={}) {
    if(newBox)f.game.openingChest={};
    f.game.state='levelup';picker.classList.remove('hidden','closing');picker.querySelector('#pk-title').textContent='寶箱';
    const box=picker.querySelector('#pk-cards');box.innerHTML='';
    ids.forEach((id,index)=>{
      const item=f.items[id]||{id,slot:'deity',name:registry[id].name+' 神格'},slot=f.w.document.createElement('div');slot.className='pk-slot';
      slot.innerHTML=`<button class="pk-card"><span class="pk-name">${item.name}</span><span class="pk-sub">${{potion:'藥水',deity:'神格'}[item.slot]}</span><span class="pk-badge">普通</span><span class="pk-lines">測試</span></button><button class="pk-act" title="重抽單張">重抽<small>9</small></button><button class="pk-act" title="放逐" ${banishDisabled?'disabled':''}>放逐<small>3</small></button>`;
      const finish=()=>{counts.picks.push(id);f.game.runItems.slots.set(item.slot,{item:id,vals:[1]});picker.classList.add('hidden');f.game.openingChest=null;f.game.state='playing';};
      slot.querySelector('.pk-card').onclick=()=>{
        counts.attempts.push(id);
        if(confirm&&item.slot==='deity'&&f.game.runItems.slots.get('deity')?.item&&f.game.runItems.slots.get('deity').item!==id){
          slot.insertAdjacentHTML('beforeend','<div class="pk-back"><button data-yes>確認替換</button></div>');
          f.w.setTimeout(()=>slot.classList.add('asking'),160);
          slot.querySelector('[data-yes]').onclick=()=>{counts.confirm++;finish()};
        }else finish();
      };
      const buttons=slot.querySelectorAll('.pk-act');buttons[0].onclick=()=>counts.card++;
      buttons[1].onclick=()=>{
        counts.banish.push(id);
        const result=nativeBanish.call(f.game,{slot:item.slot,item:id},ids.map(key=>({slot:f.items[key]?.slot||'deity'})));
        const after=[...ids];if(result)after[index]=result.item;else after.splice(index,1);
        draw(after,{confirm});
      };
      box.append(slot);
    });
    picker.querySelector('#pk-bar').innerHTML='<button class="pk-act" title="重抽整組">重抽<small>9</small></button>';
    picker.querySelector('#pk-bar .pk-act').onclick=()=>counts.deck++;
  }
  function step(n=5){for(let i=0;i<n;i++){f.hooks.tick[0](f.game);f.advance(1100)}}
  function diagnostic(){f.ui.querySelector('#diagnose').click();return JSON.parse(f.ui.querySelector('#config').value)}
  return{draw,step,counts,nextGame,diagnostic,setReplacement(id){replacement=id}};
}

test('actual deity override completes native asking confirmation once, retains chosen deity in later chests and uses no rerolls',async()=>{
  const f=await browserFixture({chestReroll:false,deityOverrideEnabled:true,deityOverrides:'firebolt',priorities:{deity:'g_thought',potion:'p_cd'}});
  try{
    const s=await deityScenario(f,{deity:{item:'g_thought',vals:Array(14).fill(1)}});
    s.draw(['g_thought','firebolt','p_cd'],{newBox:true});s.step();
    assert.deepEqual(s.counts.picks,['firebolt']);assert.equal(s.counts.confirm,1);assert.deepEqual(s.counts.attempts,['firebolt']);
    s.draw(['g_thought','p_cd'],{newBox:true});s.step();
    assert.deepEqual(s.counts.picks,['firebolt','p_cd']);assert.equal(f.game.runItems.slots.get('deity').item,'firebolt');
    assert.equal(s.counts.card+s.counts.deck+s.counts.rng,0);
  }finally{f.close();}
});

test('actual next-offer banish preserves acquired passive, redraws the same chest then picks another first-tier card',async()=>{
  const f=await browserFixture({chestReroll:false,deityOverrideEnabled:true,deityOverrides:'firebolt',deityBanishAfterPick:true,priorities:{potion:'p_cd'}});
  try{
    const s=await deityScenario(f);s.draw(['firebolt'],{newBox:true});s.step();assert.deepEqual(s.counts.banish,[]);
    s.draw(['firebolt','p_hp'],{newBox:true});s.step();
    assert.deepEqual(s.counts.banish,['firebolt']);assert.deepEqual(s.counts.picks,['firebolt','p_cd']);
    assert.equal(f.game.perksLeft.banish,2);assert.equal(f.game.runItems.slots.get('deity').item,'firebolt');
    assert(f.game.banishedItems.has('firebolt'));assert.equal(f.game.perksLeft.reroll,9);assert.equal(f.game.perksLeft.reroll_card,9);
    assert.equal(s.diagnostic().usedRerolls,0);assert.equal(s.counts.rng,1);
  }finally{f.close();}
});

test('acquired deity history survives rescan and replacement but starts fresh for the next run',async()=>{
  const f=await browserFixture({chestReroll:false,deityBanishAfterPick:true});
  try{
    const s=await deityScenario(f,{deity:{item:'firebolt',vals:[1]}});f.hooks.tick[0](f.game);
    f.game.runItems.slots.set('deity',{item:'coldbolt',vals:[1]});f.hooks.tick[0](f.game);f.ui.querySelector('#rescan').click();
    s.draw(['firebolt'],{newBox:true});s.step();assert.deepEqual(s.counts.banish,['firebolt']);
    assert.deepEqual(s.diagnostic().deity.acquired.sort(),['coldbolt','firebolt']);
    s.nextGame();s.draw(['firebolt'],{newBox:true});s.step();
    assert.deepEqual(s.counts.banish,['firebolt']);assert.equal(f.game.runItems.slots.get('deity').item,'firebolt');
  }finally{f.close();}
});

test('disabled banish, zero charges or unmatched explicit list follows existing picker settings without clicking banish',async()=>{
  const f=await browserFixture({chestReroll:false,deityBanishAfterPick:true,priorities:{potion:'p_cd'}});
  try{
    const s=await deityScenario(f,{deity:{item:'firebolt',vals:[1]}});
    s.draw(['firebolt','p_cd'],{newBox:true,banishDisabled:true});s.step();
    f.game.perksLeft.banish=0;s.draw(['firebolt','p_cd'],{newBox:true});s.step();
    f.game.perksLeft.banish=3;f.setting('deityBanishTargets','coldbolt');s.draw(['firebolt','p_cd'],{newBox:true});s.step();
    assert.deepEqual(s.counts.banish,[]);assert.deepEqual(s.counts.picks,['p_cd','p_cd','p_cd']);assert.equal(s.counts.rng,0);
  }finally{f.close();}
});

test('deity options round-trip through actual UI, catalog selection, JSON and independent job profiles',async()=>{
  const f=await browserFixture();let saved;
  try{
    const s=await deityScenario(f);f.game.classDef={id:'mage',name:'魔法師'};f.hooks.tick[0](f.game);
    f.setting('deityOverrideEnabled',true);f.setting('deityBanishAfterPick',true);f.setting('deityBanishTargets','firebolt');
    const select=f.ui.querySelector('[data-deity-list="deityOverrides"]');select.value='firebolt';select.dispatchEvent(new f.w.Event('change',{bubbles:true}));
    assert.match(f.ui.querySelector('[data-setting="deityOverrides"]').value,/\[firebolt\]/);
    f.ui.querySelector('#export').click();saved=JSON.parse(f.ui.querySelector('#config').value);
    assert.equal(saved.jobProfiles.mage.deityOverrideEnabled,true);assert.equal(saved.jobProfiles.mage.deityBanishAfterPick,true);
    f.game={...f.game,classDef:{id:'swordsman',name:'劍士'}};f.hooks.start[0](f.game);
    assert.equal(f.ui.querySelector('[data-setting="deityOverrideEnabled"]').checked,false);assert.equal(f.ui.querySelector('[data-setting="deityBanishAfterPick"]').checked,false);
    assert.equal(s.counts.picks.length,0);
  }finally{f.close();}
  const r=await browserFixture(saved);try{assert.equal(r.ui.querySelector('[data-setting="deityOverrideEnabled"]').checked,true);assert.equal(r.ui.querySelector('[data-setting="deityBanishTargets"]').value,'firebolt');}finally{r.close();}
});

function storedScenario(f,{skills=2,chests=2,chestIds=['p_cd'],skillIds=['firebolt'],time=0,roleLevel=1,exposeGlobal=true,subNames={potion:'藥水',elixir:'秘藥',blessing:'祝福',dish:'料理',deity:'神格'}}={}){
  const spec=require('./fixtures/native-save.json'),w=f.w,d=w.document,S={g:null};if(exposeGlobal)w.RO_SAVEUP=S;
  d.body.insertAdjacentHTML('beforeend','<div id="hud"></div><div id="pause" class="hidden"><div class="ro-body"></div></div><div id="toasts"></div>');
  w.eval(`(${spec.saveClient})`)(S,spec.config,()=>{d.querySelector('#picker').classList.add('hidden');d.querySelector('#pk-cards').innerHTML=''});
  S.setLv(true);S.setCh(true);
  const counts={skills:[],chests:[],card:0,deck:0,rollSkill:0,rollChest:0,draws:[]},picker=d.querySelector('#picker');
  const pool=w.eval(`(function(ws){return ${native.chestSlotItems}})`)(f.items);
  const g={...f.game,player:{...f.game.player},script:{bosses:[{id:'test'}]},time,level:roleLevel,lootUntil:-1,state:'playing',pendingLevelUps:skills,roChests:chests,
    roLvSaved:skills,roOpening:false,openingChest:null,openingCost:0,perksLeft:{...f.game.perksLeft,deity:1,banish:3},
    runItems:{slots:new Map(),slotItems:pool,choose(c){const current=this.slots.get(c.slot);if(current?.item===c.item)current.vals.push(c.value||1);else this.slots.set(c.slot,{item:c.item,vals:[c.value||1],quality:0})}},
    weapons:[{id:'firebolt',rank:1,applyUpgrade(){this.rank++}}],passives:new Map(),passiveRank:new Map(),events:{},
    recomputeStats(){},healPlayer(){},runItemName(slot,id){return f.items[id]?.name||id},
    deityLearned:()=>['firebolt'],chestOpts:()=>({swap:true,banished:new Set(),useless:new Set()}),
    rollChoices(){counts.rollSkill++;return skillIds.map(id=>({id,isNew:id!=='firebolt',rarity:0,upgrade:{rarity:0}}))},
    rollChest(){counts.rollChest++;const ids=Array.isArray(chestIds[0])?chestIds[Math.min(counts.rollChest-1,chestIds.length-1)]:chestIds;return ids.map(id=>({slot:f.items[id].slot,item:id,quality:0,value:1,refine:0}))},
    rerollChest(){this.perksLeft.reroll--;return S.curK.map(c=>({...c}))},
    reroll(){this.perksLeft.reroll--;return S.curK.map(c=>({...c}))},
    skillLevel(id){return id==='atk_test'?1:this.weapons.find(c=>c.id===id)?.rank||1},basicAttack:'atk_test'};
  const names={firebolt:'火箭術',napalm:'心靈爆破'};
  g.choose=w.eval(`(function(RO_SAVEUP,le){const O={play(){}};return ${spec.choose}})`)(S,{firebolt:{kind:'weapon'},napalm:{kind:'weapon'}});
  g.chooseChest=w.eval(`(function(RO_SAVEUP){const O={play(){}};return ${spec.chooseChest}})`)(S);
  function draw(kind,cards){
    S.cur(g,kind==='skill'?'lv':'chest',cards);g.state='levelup';
    picker.classList.remove('hidden','closing');picker.querySelector('#pk-title').textContent=kind==='skill'?'Level Up!':'寶箱';
    const box=picker.querySelector('#pk-cards');box.innerHTML='';counts.draws.push({kind,cards});
    cards.forEach((c,index)=>{
      const item=kind==='chest'?f.items[c.item]:null,slot=d.createElement('div');slot.className='pk-slot';
      slot.innerHTML=`<button class="pk-card"><span class="pk-name">${item?.name||names[c.id]}</span><span class="pk-sub">${item?subNames[item.slot]:''}</span><span class="pk-badge">普通</span><span class="pk-lines">傷害</span>${c.isNew?'<span class="pk-ribbon">新</span>':''}</button><button class="pk-act" title="重抽單張">重抽<small>9</small></button>`;
      slot.querySelector('.pk-act').onclick=()=>{counts.card++;g.perksLeft.reroll_card--;cards[index]={...c};draw(kind,cards)};
      slot.querySelector('.pk-card').onclick=()=>{
        picker.classList.add('closing');
        w.setTimeout(()=>{
          picker.classList.add('hidden');picker.classList.remove('closing');box.innerHTML='';
          if(kind==='skill'){counts.skills.push(c.id);g.choose(c)}else{counts.chests.push(c.item);g.chooseChest(c)}
        },820);
      };
      box.append(slot);
    });
    picker.querySelector('#pk-bar').innerHTML='<button class="pk-act" title="重抽整組">重抽<small>9</small></button>';
    picker.querySelector('#pk-bar .pk-act').onclick=()=>{counts.deck++;draw(kind,kind==='chest'?g.rerollChest():g.reroll())};
  }
  g.events={onLevelUp:cards=>draw('skill',cards),onChest:cards=>draw('chest',cards),onLoot(){}};
  f.game=g;S.g=g;f.hooks.start[0](g);S.sync();
  function step(n=1){for(let i=0;i<n;i++){f.hooks.tick[0](g);f.advance(1100)}}
  function diagnostic(){f.ui.querySelector('#diagnose').click();return JSON.parse(f.ui.querySelector('#config').value)}
  return{S,g,counts,step,diagnostic};
}

test('new native save switches remain independent and the assistant mirrors the actual game controls',async()=>{
  const f=await browserFixture();try{
    const s=storedScenario(f);s.step();
    const skill=f.ui.querySelector('[data-native-save="skill"]');skill.checked=false;skill.dispatchEvent(new f.w.Event('change',{bubbles:true}));
    assert.equal(s.S.prefLv(),false);assert.equal(s.S.prefCh(),true);assert.equal(f.w.localStorage.getItem('ro-hans.saveLv'),'0');
    const chest=f.w.document.querySelector('#sv-check-ch');chest.checked=false;chest.dispatchEvent(new f.w.Event('change',{bubbles:true}));s.step();
    assert.equal(f.ui.querySelector('[data-native-save="chest"]').checked,false);assert.equal(s.S.prefCh(),false);
    assert.equal(s.counts.rollChest+s.counts.rollSkill,0);
  }finally{f.close();}
});

test('default manual mode leaves stored offers intact; explicit chest button starts with chest and preserves the other type',async()=>{
  const f=await browserFixture({chestReroll:false});try{
    const s=storedScenario(f,{chests:1});s.step(3);assert.equal(s.counts.rollChest+s.counts.rollSkill,0);
    f.ui.querySelector('#stored-chest').click();s.step(12);
    assert.deepEqual(s.counts.chests,['p_cd']);assert.deepEqual(s.counts.skills,[]);assert.equal(s.g.pendingLevelUps,2);assert(s.g.roLvKeep);
  }finally{f.close();}
});

for(const mode of ['skills','chests','both'])test(`native saved queue opens permitted types only: ${mode}`,async()=>{
  const f=await browserFixture({storedOpenMode:mode,chestReroll:false});try{
    const s=storedScenario(f);s.step(25);
    assert.equal(s.counts.skills.length,mode==='chests'?0:2);assert.equal(s.counts.chests.length,mode==='skills'?0:2);
    assert.equal(s.g.pendingLevelUps,mode==='chests'?2:0);
    assert.equal(C.storedCounts(s.g).chest,mode==='skills'?2:0);
    assert.equal(s.g.state,'playing');
  }finally{f.close();}
});

test('saved opening respects disabled picker types and assistant pause, and excludes invalid/stale native games',async()=>{
  const f=await browserFixture({storedOpenMode:'both',skills:false,chestReroll:false});try{
    const s=storedScenario(f);f.ui.querySelector('#toggle').click();s.step(3);assert.equal(s.counts.rollChest+s.counts.rollSkill,0);
    f.ui.querySelector('#toggle').click();s.step(18);assert.equal(s.counts.skills.length,0);assert.equal(s.counts.chests.length,2);
    for(const patch of [{state:'paused'},{player:{...s.g.player,dead:true}},{lootUntil:1},{endless:{}},{isStory:true},{coop:{}},{replayMoves:[]}]){
      const previous={...s.g};Object.assign(s.g,patch,{roChests:2});const before=s.counts.rollChest;s.step(2);assert.equal(s.counts.rollChest,before);Object.assign(s.g,previous);
    }
    s.S.g={...s.g};s.g.roChests=2;const before=s.counts.rollChest;s.step(3);assert.equal(s.counts.rollChest,before);
  }finally{f.close();}
});

test('role level policy saves pending skills at equality, without confusing role level with summed skill ranks',async()=>{
 const f=await browserFixture({skillLevelGate:true,skillSaveAtLevel:10,storedOpenMode:'both',chestReroll:false});try{
  const s=storedScenario(f,{roleLevel:10,chests:1,exposeGlobal:false});s.step(15);
  assert.equal(s.counts.skills.length,0);assert.equal(s.g.pendingLevelUps,2);assert.equal(s.S.prefLv(),true);assert.deepEqual(s.counts.chests,['p_cd']);
  f.ui.querySelector('#stored-skill').click();s.step(15);assert.equal(s.counts.skills.length,2);
 }finally{f.close();}
});

for(const rerollMode of ['card','deck'])test(`saved chest budget survives ${rerollMode} redraw, parking, rescan and reopen; next null-token chest starts fresh`,async()=>{
  const f=await browserFixture({storedOpenMode:'chests',rerollMode,maxRerolls:1,exhausted:'wait',priorities:{potion:'p_cd',elixir:'e_dmg'}});try{
    const s=storedScenario(f,{skills:0,chests:2,chestIds:[['p_hp'],['e_hp']],exposeGlobal:false});s.step(7);
    assert.equal(s.counts[rerollMode],1);assert.equal(s.g.openingChest,null);assert.equal(s.diagnostic().usedRerolls,1);
    f.policy('chests', 'pick');f.ui.querySelector('#stored-keep').click();s.step(2);
    const kept=s.g.roChestKeep;assert(kept);f.ui.querySelector('#rescan').click();s.step();
    f.ui.querySelector('#stored-chest').click();s.step(5);assert.equal(s.counts[rerollMode],1);assert.equal(s.S.curK,kept);assert.equal(s.diagnostic().usedRerolls,1);
    f.w.document.querySelector('.pk-card').click();s.step(8);
    assert.equal(s.counts[rerollMode],2,JSON.stringify({counts:s.counts,state:s.g.state,remaining:s.g.roChests,stored:s.g.roChestKeep,diagnostic:s.diagnostic()}));assert.equal(s.counts.chests.length,1);assert.equal(s.diagnostic().usedRerolls,1);
  }finally{f.close();}
});

test('native continue-saving pauses automatic reopening until explicit HUD open, with no saved opportunities discarded',async()=>{
  const f=await browserFixture({storedOpenMode:'both',chestReroll:false});try{
    const s=storedScenario(f,{chests:1});s.step();
    f.w.document.querySelector('#sv-bar [data-t="keep"]').click();s.step(8);
    assert.equal(s.g.state,'playing');assert.equal(s.counts.skills.length+s.counts.chests.length,0);assert.equal(s.g.pendingLevelUps,2);assert.equal(s.g.roChests,1);
    assert.equal(s.diagnostic().stored.manualHold,true);
    f.w.document.querySelector('#sv-open').click();s.step(20);
    assert.equal(s.counts.skills.length,2);assert.equal(s.counts.chests.length,1);assert.equal(s.diagnostic().stored.manualHold,false);
  }finally{f.close();}
});

test('manual native tabs override an automatic batch and preserve independent skill and chest reroll budgets',async()=>{
  const f=await browserFixture({storedOpenMode:'chests',rerollMode:'card',maxRerolls:1,exhausted:'wait',priorities:{potion:'p_cd'}});try{
    const s=storedScenario(f,{skills:2,chests:1,chestIds:['p_hp'],skillIds:['napalm']});s.step(6);assert.equal(s.counts.card,1);
    const original=s.S.curK;f.w.document.querySelector('#sv-bar [data-t="lv"]').click();s.step(6);
    assert.equal(s.S.curT,'lv');assert.equal(s.counts.deck,1);assert.equal(s.counts.skills.length,0);
    f.w.document.querySelector('#sv-bar [data-t="chest"]').click();s.step(6);
    assert.equal(s.S.curK,original);assert.equal(s.counts.card,1);assert.equal(s.diagnostic().usedRerolls,1);
  }finally{f.close();}
});

for(const identity of ['native','catalog'])test(`screenshot chest with 靈藥 no longer blocks selection; ${identity} identifies the middle first-tier card`,async()=>{
  const f=await browserFixture({storedOpenMode:'chests',chestReroll:false,priorities:{elixir:'持續傷害秘藥'}});try{
    Object.assign(f.items,{e_dot:{id:'e_dot',slot:'elixir',name:'持續傷害藥劑'},g_executioner:{id:'g_executioner',slot:'deity',name:'行刑者之神'},b_double:{id:'b_double',slot:'blessing',name:'雙倍投擲祝福'}});
    const s=storedScenario(f,{skills:19,chests:1,chestIds:['g_executioner','e_dot','b_double'],subNames:{deity:'神格',elixir:'靈藥',blessing:'祝福'}});
    s.g.runItems.slots.set('deity',{item:'g_executioner',vals:[1,1]});s.g.runItems.slots.set('blessing',{item:'b_double',vals:[1,1,1]});
    s.step();
    if(identity==='catalog')s.S.curK=[{slot:'potion',item:'p_hp'}]; // stale/mismatched native array must not override the visible three cards
    const report=s.diagnostic();assert.equal(report.cards[1].id,'e_dot');assert.equal(report.cards[1].slot,'elixir');assert.equal(report.cards[1].identitySource,identity);
    s.step(8);assert.deepEqual(s.counts.chests,['e_dot']);assert.equal(s.g.pendingLevelUps,19);assert.equal(s.counts.skills.length,0);
    assert(!f.ui.querySelector('#log').textContent.includes('寶箱欄位未識別'));
  }finally{f.close();}
});

test('module-local save client works through native controls and below-level rules override manual auto-open range',async()=>{
 const f=await browserFixture({skillLevelGate:true,skillSaveAtLevel:10,storedOpenMode:'manual'});try{
  const s=storedScenario(f,{exposeGlobal:false,roleLevel:9,skills:2,chests:0});assert.equal(f.w.RO_SAVEUP,undefined);
  s.step(14);assert.equal(s.counts.skills.length,2);assert.equal(s.S.prefLv(),false);
  s.g.level=10;s.g.pendingLevelUps=3;s.step(8);assert.equal(s.S.prefLv(),true);assert.equal(s.counts.skills.length,2);assert.equal(s.g.pendingLevelUps,3);
  assert(!f.ui.querySelector('#stored-status').textContent.includes('等待新版'));
 }finally{f.close();}
});

test('chest gate sums separate occupied slots and parks the next offer immediately upon equality',async()=>{
 const f=await browserFixture({chestLevelGate:true,chestSaveAtTotal:3,storedOpenMode:'manual',chestReroll:false});try{
  const s=storedScenario(f,{exposeGlobal:false,skills:0,chests:3});
  s.g.runItems.slots.set('potion',{item:'p_cd',vals:[1]});s.g.runItems.slots.set('blessing',{item:'b_dmg',vals:[1]});
  s.step(20);assert.equal(s.counts.chests.length,1);assert.equal(s.g.runItems.slots.get('potion').vals.length,2);
  assert.equal(s.S.prefCh(),true);assert.equal(C.storedCounts(s.g).chest,2);assert.equal(s.g.state,'playing');assert(s.g.roChestKeep);
 }finally{f.close();}
});

test('role and chest gates remain independent, permit manual reopening, and unknown levels do not trigger a guess',async()=>{
 const f=await browserFixture({skillLevelGate:true,skillSaveAtLevel:10,chestLevelGate:true,chestSaveAtTotal:2,chestReroll:false,storedOpenMode:'both'});try{
  const s=storedScenario(f,{exposeGlobal:false,roleLevel:10,skills:2,chests:3});s.step(20);
  assert.equal(s.counts.skills.length,0);assert.equal(s.counts.chests.length,2);assert.equal(s.g.pendingLevelUps,2);assert.equal(C.storedCounts(s.g).chest,1);
  f.ui.querySelector('#stored-skill').click();s.step(14);assert.equal(s.counts.skills.length,2);
  s.g.runItems=undefined;s.step(3);assert.equal(s.counts.chests.length,2);
 }finally{f.close();}
});

test('natural single skill offer can be parked through native delegated action even when the keep button was never rendered',async()=>{
 const f=await browserFixture({skillLevelGate:true,skillSaveAtLevel:10});try{
  const s=storedScenario(f,{exposeGlobal:false,roleLevel:10,skills:1,chests:0});s.S.setLv(false);s.S.setCh(false);s.g.roLvSaved=0;
  s.g.events.onLevelUp(s.g.rollChoices());s.S.sync();assert.equal(f.w.document.querySelector('#sv-bar [data-t="keep"]'),null);
  s.step(8);assert.equal(s.g.state,'playing');assert.equal(s.g.pendingLevelUps,1);assert(s.g.roLvKeep);assert.equal(s.counts.skills.length,0);
 }finally{f.close();}
});

function nativeTownScenario(f,{player={x:0,y:0},target={x:650,y:300},yaw=0,pointer=false,action=require('./fixtures/native-town.json').captainActions.zh}={}){
 const spec=require('./fixtures/native-town.json'),w=f.w,d=w.document;
 townMarkup(f);f.game.state='over';f.camera.yaw=yaw;f.camera.targetYaw=yaw;
 d.body.insertAdjacentHTML('beforeend','<div id="stage"><canvas></canvas></div>');const canvas=d.querySelector('#stage canvas');
 canvas.getBoundingClientRect=()=>({left:0,top:0,width:1024,height:768});
 d.querySelector('#lobby-prompt').classList.add('hidden');d.querySelector('#lobby-labels').innerHTML='<div class="lobby-name self">自己</div><div class="lobby-name npc">遠征隊長</div>';
 // Deliberately misleading nameplates: the real character/NPC positions are elsewhere.
 d.querySelector('.self').getBoundingClientRect=()=>({left:400,width:60,bottom:400});d.querySelector('.npc').getBoundingClientRect=()=>({left:400,width:60,bottom:355});
 const counts={talk:0,launch:0,path:0},world=new f.World(),avatar={x:player.x,y:player.y,children:[{sheet:{}}]},npcView={...target,children:[{sheet:f.assets.sheets.get('npc_knight')}]},layer={children:[avatar,npcView]};
 const town={player:{...player,update(){avatar.x=this.x;avatar.y=this.y}},classDef:{speed:180},keys:new Set(),touchMove:{x:0,y:0},cleanup:[],emotes:[],others:new Map(),npcs:[],pet:null,ambient:{update(){}},prompt:d.querySelector('#lobby-prompt'),near:null,world3d:world,
  menuOpen(){return !!d.querySelector('.overlay:not(.hidden)')},inPlaza(x,y){return[x,y]},sendPosition(){},pickPlayer(){return false},closeMenu(){},closeChannels(){},zoomBy(){}};
 const direction=w.eval(`(function(Ht){return ${spec.direction}})`)(f.camera);
 town.tick=w.eval(`(function(Vd,Sd,gp,rt,ln){const Ze=false,c=text=>text;return ${spec.tick}})`)(direction,spec.speedMultiplier,spec.radius,{move:{x:0,y:0}},class Sprite{});
 town.moveTo=w.eval(`(function(gp){return ${spec.moveTo}})`)(spec.radius);
 const nativeMove=town.moveTo;town.moveTo=function(...args){counts.path++;return nativeMove.apply(this,args)};
 town.npcs.push({x:target.x,y:target.y,view:npcView,action,onTalk(){counts.talk++;d.querySelector('#stages').classList.remove('hidden');d.querySelector('#stg-list').innerHTML='<button class="stg-card sel" data-i="0"><span class="stg-card-info"><b>普隆德拉原野</b></span></button>'}});
 w.eval(`(function(Ie,Ze,Mw){return ${spec.bindInput}})`)(f.camera,false,null).call(town);
 d.querySelector('#stg-go').onclick=()=>{counts.launch++;d.querySelector('#stages').classList.add('hidden');d.querySelector('#lobby-ui').classList.add('hidden');d.body.classList.remove('in-lobby');world.gone=true;f.hooks.start[0]({...f.game,state:'playing',stageId:'prontera',difficulty:{lap:1}})};
 if(pointer){
  w.PointerEvent=class extends w.MouseEvent{constructor(type,options){super(type,options);this.pointerType=options.pointerType}};
  const Container=class{constructor(){this.children=[];this.position={set(){}}}addChild(x){this.children.push(x)}destroy(){}},Sprite=class{play(){}update(){}};
  const Mouse=w.eval(`(function(g,Qe,ln,te){const fo=32,dE=.12,nn=()=>null;return ${spec.mouse}})`)((o,k,v)=>o[k]=v,Container,Sprite,{sheet:()=>({})});
  town.mouse=new Mouse(canvas,world,new Container(),{moveTo(x,y){town.moveTo(x,y)},pick:()=>false,rotating:()=>false});
 }
 function render(){world.setView(town.player.x,town.player.y);world.render(layer)}
 function frames(n){for(let i=0;i<n&&!counts.launch;i++){if(d.body.classList.contains('in-lobby')){town.tick(.02);render()}f.advance(20)}}
 render();return{town,world,counts,render,frames,cleanup(){town.mouse?.destroy();for(const fn of town.cleanup)fn()}};
}

test('screenshot captain prompt uses Space through native input instead of moving past the nearby NPC',async()=>{
 const f=await browserFixture({repeat:true});let scene;try{
  scene=nativeTownScenario(f,{player:{x:139,y:378},target:{x:141,y:378}});
  const down=[],up=[];let clicks=0;f.w.addEventListener('keydown',e=>down.push({key:e.key,code:e.code}));f.w.addEventListener('keyup',e=>up.push(e.code));
  f.w.document.querySelector('#lobby-prompt').addEventListener('click',()=>clicks++);
  scene.frames(100);
  assert.equal(scene.counts.talk,1);assert.equal(scene.counts.launch,1);
  assert.deepEqual(down,[{key:' ',code:'Space'}]);assert.deepEqual(up,['Space']);assert.equal(clicks,0);
 }finally{scene?.cleanup();f.close();}
});

test('native captain action translations and legacy labels all open the expedition list',async()=>{
 const actions=[...Object.values(require('./fixtures/native-town.json').captainActions),'與隊長交談','和船长说话'];
 for(const action of actions){
  const f=await browserFixture({repeat:true});let scene;try{
   scene=nativeTownScenario(f,{player:{x:140,y:378},target:{x:141,y:378},action});scene.frames(70);
   assert.equal(scene.counts.talk,1,action);assert.equal(scene.counts.launch,1,action);
  }finally{scene?.cleanup();f.close();}
 }
});

test('blocked Space falls back to the native talk button once, then departs once',async()=>{
 const f=await browserFixture({repeat:true});let scene;try{
  scene=nativeTownScenario(f,{player:{x:139,y:378},target:{x:141,y:378}});
  let spaces=0,ups=0,clicks=0;
  f.w.addEventListener('keydown',e=>{if(e.code==='Space'){spaces++;e.stopImmediatePropagation()}},true);
  f.w.addEventListener('keyup',e=>{if(e.code==='Space')ups++});f.w.document.querySelector('#lobby-prompt').addEventListener('click',()=>clicks++);
  scene.frames(150);
  assert.equal(spaces,1);assert.equal(ups,1);assert.equal(clicks,1);assert.equal(scene.counts.talk,1);assert.equal(scene.counts.launch,1);
 }finally{scene?.cleanup();f.close();}
});

test('unresponsive talk transition does not spam Space or clicks',async()=>{
 const f=await browserFixture({repeat:true});let scene;try{
  scene=nativeTownScenario(f,{player:{x:139,y:378},target:{x:141,y:378}});scene.town.npcs[0].onTalk=()=>scene.counts.talk++;
  let spaces=0,clicks=0;f.w.addEventListener('keydown',e=>{if(e.code==='Space')spaces++});f.w.document.querySelector('#lobby-prompt').addEventListener('click',()=>clicks++);
  scene.frames(100);f.advance(60000);scene.frames(10);
  assert.equal(spaces,1);assert.equal(clicks,1);assert.equal(scene.counts.talk,2);assert.equal(scene.counts.launch,0);
 }finally{scene?.cleanup();f.close();}
});

test('other NPC prompts, pause and overlays do not send captain interaction keys',async()=>{
 for(const mode of ['other','paused','overlay']){
  const f=await browserFixture({repeat:true});let scene;try{
   scene=nativeTownScenario(f,{player:{x:139,y:378},target:{x:141,y:378},...(mode==='other'?{action:'和坐騎管理員說話'}:{})});
   if(mode==='paused')f.ui.querySelector('#toggle').click();if(mode==='overlay')f.w.document.querySelector('#npc-dialog').classList.remove('hidden');
   let spaces=0,clicks=0;f.w.addEventListener('keydown',e=>{if(e.code==='Space')spaces++});f.w.document.querySelector('#lobby-prompt').addEventListener('click',()=>clicks++);
   scene.frames(70);assert.equal(spaces,0,mode);assert.equal(clicks,0,mode);assert.equal(scene.counts.talk,0,mode);
  }finally{scene?.cleanup();f.close();}
 }
});

test('read-stage button recognizes the screenshot captain wording even with automatic repeat off',async()=>{
 const f=await browserFixture({repeat:false});let scene;try{
  scene=nativeTownScenario(f,{player:{x:139,y:378},target:{x:141,y:378}});scene.frames(1);
  f.ui.querySelector('#read-stages').click();assert.equal(scene.counts.talk,1);assert.equal(f.w.document.querySelectorAll('#stg-list .stg-card').length,1);
 }finally{scene?.cleanup();f.close();}
});

for(const yaw of [0,Math.PI/2,Math.PI,-Math.PI/3])test(`native lobby movement reaches captain and departs without relying on nameplate geometry; yaw=${yaw}`,async()=>{
 const f=await browserFixture({repeat:true});let scene;try{
  scene=nativeTownScenario(f,{yaw});scene.frames(600);
  assert.equal(scene.counts.talk,1);assert.equal(scene.counts.launch,1);
 }finally{scene?.cleanup();f.close();}
});

test('native click-to-move follows the actual captain coordinate and invokes native auto-talk',async()=>{
 const f=await browserFixture({repeat:true});let scene;try{
  scene=nativeTownScenario(f,{pointer:true,yaw:.7});scene.frames(600);
  assert.equal(scene.counts.path,1);assert.equal(scene.counts.talk,1);assert.equal(scene.counts.launch,1);
 }finally{scene?.cleanup();f.close();}
});

test('missing or stale native town scene stops navigation instead of repeating a guessed nameplate search',async()=>{
 const f=await browserFixture({repeat:true});try{
  townMarkup(f);f.w.document.querySelector('#lobby-prompt').classList.add('hidden');let keys=0;f.w.addEventListener('keydown',()=>keys++);
  f.advance(2000);assert.equal(keys,0);assert.match(f.ui.querySelector('#status').textContent,/實際座標/);
 }finally{f.close();}
});
