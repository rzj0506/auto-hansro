// ==UserScript==
// @name         ro.hans幸存者助手
// @namespace    ro-survivors-local-helper
// @version      1.7.0
// @description  六周目與新地圖開荒、自動下一張與跨周目、鐘罩避難、寶箱智能重抽及結算裝備整理。
// @match        https://ro.hans-webgametw.com/*
// @run-at       document-start
// @grant        none
// @sandbox      raw
// @noframes
// @homepageURL  https://github.com/rzj0506/auto-hansro
// @updateURL    https://raw.githubusercontent.com/rzj0506/auto-hansro/userscript-release/ro-survivors-helper.meta.js
// @downloadURL  https://raw.githubusercontent.com/rzj0506/auto-hansro/userscript-release/ro-survivors-helper.user.js
// ==/UserScript==

(() => {
  'use strict';
  const VERSION = '1.7.0';
  const BASIC_ANY = '__basic__';
  const FIXED = ['firebolt', 'coldbolt', 'lightning'];
  const SLOT_NAMES = { potion: '藥水', elixir: '秘藥', blessing: '祝福', dish: '料理', deity: '神格' };
  const SKILL_NAMES = { firebolt: '火箭術', coldbolt: '冰箭術', lightning: '雷擊術' };
  const STAGES = [
    ['prontera', '普隆德拉原野'], ['sewer', '普隆德拉地下水道'], ['sunken', '失事輪'], ['byalan', '柏伊亞嵐島'],
    ['payon', '斐揚森林'], ['payon_cave', '斐揚洞穴'], ['prt_castle', '普隆德拉城'], ['orcs', '獸人村'],
    ['pyramid', '夢羅克金字塔'], ['maze', '迷宮森林'], ['xmas', '聖誕節'], ['louyang', '元宵節'],
  ];
  // 2026-11-17 原生清單：六周目、12 張地圖；城堡是劇情關，後續周目跳過。
  const LAP_LABELS = ['一周目', '二周目', '三周目', '四周目', '五周目', '六周目'];
  const LAP_SUFFIXES = ['', '・改', '・改²', '・改³', '・改⁴', '・改⁵'];
  const STAGE_ALIASES = ['Campos de Prontera', 'Alcantarillas de Prontera', 'Barco hundido', 'Isla de Byalan', 'Bosque de Payon', 'Cueva de Payon', 'Castillo de Prontera', 'Aldea orca', 'Pirámides de Morroc', 'Bosque laberinto', 'Navidad', 'Festival de los Faroles'];
  const ITEM_NAMES = {
    p_regen: '回復藥水', p_cd: '冷卻藥水', p_hp: '生命藥水', p_armor: '護甲藥水', p_area: '範圍藥水', p_pickup: '採集藥水', p_greed: '貪婪藥水', p_speed: '速度藥水', p_cast: '詠唱藥水', p_reach: '近戰範圍藥水', p_dmg: '傷害藥水',
    e_crit: '爆擊秘藥', e_dmg: '傷害秘藥', e_hp: '生命秘藥', e_critdmg: '爆擊傷害秘藥', e_surprise: '驚奇秘藥', e_dot: '持續傷害秘藥', e_dodge: '迴避秘藥', e_cast: '詠唱秘藥', e_area: '範圍秘藥', e_armor: '護甲秘藥',
    b_dmg: '傷害祝福', b_regen: '回復祝福', b_cd: '冷卻祝福', b_lifesteal: '吸血祝福', b_double: '雙倍投擲祝福', b_plenty: '豐饒祝福', b_cast: '詠唱祝福', b_area: '範圍祝福', b_reach: '近戰範圍祝福', b_wisdom: '智慧祝福',
    d_str: 'STR（力量）料理', d_agi: 'AGI（敏捷）料理', d_vit: 'VIT（體力）料理', d_int: 'INT（智力）料理', d_dex: 'DEX（靈巧）料理', d_luk: 'LUK（幸運）料理',
  };
  const ALIASES = {
    firebolt: ['火箭術', 'Fire Bolt', 'Saeta de fuego'],
    coldbolt: ['冰箭術', 'Cold Bolt', 'Saeta de hielo'],
    lightning: ['雷擊術', '雷撃術', 'Lightning Bolt', 'Saeta de rayo'],
  };
  const DEFAULTS = {
    enabled: false, skills: true, dodge: true, bellShelter: true, chests: true, pickups: true, background: true,
    skillSlots: 4, fourth: '', fifth: '', rarityFirst: true, skillReroll: true, chestReroll: true,
    chestFillFirst: true, chestSmartReroll: true, noFlipEnabled: false, noFlipMinutes: 10,
    noFlipLevelEnabled: false, noFlipTotalLevel: 100,
    autoEquip: false, autoSell: false, sellQualities: [], expeditionLap: 1,
    banish: false, banishBasic: true, banishExcludeEnabled: false, banishExclude: [],
    repeat: false, progression: false, expedition: 'prontera', repeatLimit: 0, repeatDelay: 5000,
    lootRange: 1800, partyRoll: 'greed',
    rerollMode: 'card-deck', maxRerolls: 6, reserveCard: 0, reserveDeck: 0,
    exhausted: 'best', delay: 1000, safety: 65, chestRange: 2400,
    priorities: { potion: '', elixir: '', blessing: '', dish: '', deity: '' },
  };
  const CHAR_MAP = Object.fromEntries('唤喚 术術 击擊 伤傷 传傳 说說 优優 诗詩 回回 药藥 秘秘 复復 却卻 护護 围圍 采採 贪貪 诵誦 咏詠 双雙 掷擲 丰豐 饶饒 智智 烹烹 调調 闪閃 络絡 连連 链鏈 灵靈 圣聖 体體 力力 敏敏 捷捷 运運 龙龍 毁毀 灭滅 寿壽 烈烈 风風 祝祝 觉覺 醒醒 标標 数數 时時 间間 动動 速速 强強 冰冰 箭箭'.split(' ').map(x => [x[0], x[1]]));
  const norm = value => String(value ?? '').normalize('NFKC').toLowerCase()
    .replace(/deity/g, '神格')
    .replace(/[\u3400-\u9fff]/g, ch => CHAR_MAP[ch] || ch)
    .replace(/[\s·•:：,，。!！()（）\[\]「」『』_\-]/g, '');
  const baseName = value => String(value ?? '').replace(/\s*\+\s*\d+\s*$/, '').trim();
  const tokenId = value => String(value ?? '').normalize('NFKC').match(/\[([a-z][\w.-]*)\]\s*$/i)?.[1] || '';
  const splitTiers = text => String(text || '').split(/\r?\n/).map(x => x.trim()).filter(Boolean)
    .map(line => line.split(/[|｜]/).map(x => x.trim()).filter(Boolean)).filter(x => x.length);
  function matchToken(token, card) {
    const t = norm(tokenId(token) || token);
    if (!t) return false;
    if (t === norm(card.id) || t === norm(baseName(card.name))) return true;
    // 星號是顯式包含匹配；不默認用「傷害」匹配「爆擊傷害」。
    return t.includes('*') && norm(baseName(card.name)).includes(t.replace(/\*/g, ''));
  }
  function tierOf(card, cfg) {
    const tiers = splitTiers(cfg.priorities[card.slot]);
    const n = tiers.findIndex(tier => tier.some(t => matchToken(t, card)));
    return n < 0 ? 1000 : n;
  }
  function rarityOf(text) {
    const n = norm(text);
    if (/傳說|legendary|legendari[oa]|lendári[oa]/.test(n)) return 3;
    if (/史詩|epic|épic[oa]|epica/.test(n)) return 2;
    if (/稀有|rare|rar[ao]/.test(n)) return 1;
    if (/優良|uncommon|pococomún|incomum/.test(n)) return .5;
    return 0;
  }
  function resolveItem(name, slot, icon, catalog) {
    const candidates = catalog.filter(i => i.slot === slot && norm(baseName(i.name)) === norm(baseName(name)));
    if (candidates.length === 1) return candidates[0];
    return candidates.find(i => i.icon && i.icon === icon) || null;
  }
  function upgradeOf(text) {
    const n = norm(text);
    if (/目標|targets?|objetivos?|alvos?/.test(n)) return 3;
    if (/急速|冷卻|haste|cooldown|celeridad|acelera/.test(n)) return 2;
    if (/傷害|damage|daño|dano/.test(n)) return 1;
    return 0;
  }
  function skillId(name, registry = {}) {
    const n = norm(tokenId(name) || baseName(name));
    for (const [id, aliases] of Object.entries(ALIASES)) {
      if ([id, ...aliases].some(a => norm(a) === n)) return id;
    }
    for (const [id, def] of Object.entries(registry)) {
      if (norm(id) === n || norm(def.name) === n) return id;
    }
    return '';
  }
  function chooseSkill(cards, owned, cfg, registry = {}) {
    const extras = owned.filter(id => !FIXED.includes(id));
    const limit = cfg.skillSlots === 5 ? 5 : 4;
    const configured = [cfg.fourth, ...(limit === 5 ? [cfg.fifth] : [])].filter(Boolean).map(v => skillId(v, registry) || v);
    const wanted = configured.filter(id => !owned.includes(id) && !FIXED.includes(id));
    const eligible = cards.filter(c => {
      if (owned.includes(c.id)) return true;
      if (owned.length >= limit) return false;
      if (FIXED.includes(c.id)) return true;
      if (extras.length >= limit - FIXED.length) return false;
      return wanted.length ? wanted.includes(c.id) : c.isNew && !!c.id && c.id !== 'potion';
    });
    const ranked = eligible.map(c => {
      const pref = !c.isNew && FIXED.includes(c.id) ? upgradeOf(c.lines) : 0;
      return { ...c, pref, targetUpgrade: !c.isNew && pref === 3 };
    });
    ranked.sort((a, b) => {
      const order = cfg.rarityFirst ? [b.rarity - a.rarity, b.pref - a.pref] : [b.pref - a.pref, b.rarity - a.rarity];
      return Number(b.targetUpgrade) - Number(a.targetUpgrade) || order.find(Boolean) || Number(FIXED.includes(b.id)) - Number(FIXED.includes(a.id)) || a.index - b.index;
    });
    return ranked[0] || null;
  }
  function banishCandidate(cards, owned, cfg, basicId = '') {
    if (!cfg.banish) return null;
    const excluded = cfg.banishExcludeEnabled ? new Set(cfg.banishExclude) : new Set();
    return cards.find(c => {
      const basic = !!basicId && c.id === basicId;
      if (!c.id || (!owned.includes(c.id) && !basic) || c.isNew || !c.canBanish || excluded.has(c.id)) return false;
      if (basic && (cfg.banishBasic === false || excluded.has(BASIC_ANY))) return false;
      return true;
    }) || null;
  }
  function displayPriority(value, slot, catalog = []) {
    return splitTiers(value).map(tier => tier.map(token => {
      const id = tokenId(token) || token.trim();
      const found = catalog.find(c => c.slot === slot && c.id === id);
      const name = found?.name || (slot === 'deity' && SKILL_NAMES[id] ? `${SKILL_NAMES[id]} 神格` : ITEM_NAMES[id]);
      return name ? `${name.replace(/Deity/g, '神格')} [${id}]` : token;
    }).join(' | ')).join('\n');
  }
  function appendPriorityTier(value, token, requestedTier = 'new') {
    const tiers = splitTiers(value);
    const label = text => norm(String(text).replace(/\s*\[[^\]]+\]\s*$/, ''));
    const same = other => {
      const a = tokenId(other), b = tokenId(token);
      if (a && b) return norm(a) === norm(b);
      return norm(a || other) === norm(b || token) || label(other) === label(token)
        || !!a && norm(a) === norm(token) || !!b && norm(b) === norm(other);
    };
    const existing = tiers.findIndex(tier => tier.some(same));
    if (existing >= 0) return { value: tiers.map(tier => tier.join(' | ')).join('\n'), tier: existing, added: false };
    const index = Number(requestedTier);
    const tier = Number.isInteger(index) && index >= 0 && index <= tiers.length ? index : tiers.length;
    if (tier === tiers.length) tiers.push([]);
    tiers[tier].push(token);
    return { value: tiers.map(group => group.join(' | ')).join('\n'), tier, added: true };
  }
  const pickupPriority = kind => kind === 'chest' || kind === 'magnet' ? 0 : 1;
  function pickupTargets(pickups, player, zeny, cost, cfg, enemies = []) {
    const candidates = pickups.filter(p => {
      if (p.dead || p.magnet || !Number.isFinite(p.x) || !Number.isFinite(p.y)) return false;
      if (p.kind === 'chest') return cfg.chests && zeny >= cost;
      return cfg.pickups && /^(gem_blue|gem_yellow|gem_red|zeny|loot|card|egg|meat|magnet)$/.test(p.kind);
    }).map(p => ({ pickup: p, priority: pickupPriority(p.kind), x: p.x, y: p.y + 20, distance: Math.hypot(p.x - player.x, p.y + 20 - player.y) }))
      .filter(t => t.distance < (t.pickup.kind === 'chest' ? cfg.chestRange : cfg.lootRange))
      .sort((a, b) => a.distance - b.distance);
    // 分別保留高優先級與一般目標，避免大量近距離寶石擠掉較遠的寶箱／磁鐵。
    return [0, 1].flatMap(priority => candidates.filter(t => t.priority === priority).slice(0, 40)).map(t => {
      const danger = enemies.reduce((sum, e) => sum + Math.max(0, cfg.safety + (e.radius || 18) - Math.hypot(t.x - e.x, t.y - e.y)) ** 2 * 12, 0);
      return { ...t, danger, score: t.distance + danger };
    }).sort((a, b) => Number(a.danger > 0) - Number(b.danger > 0) || (a.danger > 0 ? a.danger - b.danger : 0) || a.priority - b.priority || a.distance - b.distance);
  }
  function chestItem(id, slot, catalog, extra = {}) {
    const found = catalog.find(item => item.slot === slot && item.id === id);
    return { ...extra, ...found, id, slot, name: found?.name || extra.name || ITEM_NAMES[id] || id };
  }
  function chestNeed(slot, cfg, owned, catalog) {
    if (!cfg.chestFillFirst || owned === null) return 0;
    const current = owned[slot];
    if (!current) return 0;
    return tierOf(chestItem(current.item, slot, catalog, current), cfg) === 0 ? 2 : 1;
  }
  function chestFilledSlots(owned = null) {
    return owned === null ? null : Object.keys(SLOT_NAMES).filter(slot => !!owned[slot]).length;
  }
  function rankChest(cards, cfg, owned = null, catalog = []) {
    const level = card => cfg.chestFillFirst && owned !== null ? Number(owned[card.slot]?.level) || 0 : 0;
    const loss = card => owned?.[card.slot]?.item && card.id && owned[card.slot].item !== card.id ? Number(owned[card.slot].level) || 1 : 0;
    return cards.map(card => ({ ...card, tier: tierOf(card, cfg) })).sort((a, b) =>
      a.tier - b.tier || chestNeed(a.slot, cfg, owned, catalog) - chestNeed(b.slot, cfg, owned, catalog)
      || loss(a) - loss(b) || level(a) - level(b) || b.rarity - a.rarity || a.index - b.index);
  }
  function chestTargets(cfg, catalog = [], owned = null, context = {}) {
    return Object.keys(SLOT_NAMES).flatMap(slot => {
      if (!splitTiers(cfg.priorities[slot]).length) return [];
      let pool = context.reachableBySlot?.[slot];
      const confirmed = Array.isArray(pool);
      const current = owned?.[slot];
      if (!Array.isArray(pool)) {
        // 普通欄位已有物品時鎖定品種；神格須知道替換權限才推斷。
        if (current?.item && (slot !== 'deity' || context.swapDeity === false)) pool = [current.item];
        else if (current?.item && slot === 'deity' && context.swapDeity !== true) pool = null;
        else pool = catalog.length ? catalog.filter(item => item.slot === slot && item.available !== false) : null;
      }
      const known = Array.isArray(pool);
      const items = known ? pool.map(item => typeof item === 'string' ? chestItem(item, slot, catalog) : chestItem(item.id, slot, catalog, item))
        .filter(item => tierOf(item, cfg) === 0) : [];
      if (known && !items.length) return [];
      return [{ slot, need: chestNeed(slot, cfg, owned, catalog), known, confirmed, items }];
    });
  }
  const needsBackgroundClock = (config, hidden) => !!(config.enabled && config.background && hidden);
  function clampPanelPosition(position, size, viewport) {
    const width = Math.max(0, Number(size.width) || 0), height = Math.max(0, Number(size.height) || 0);
    const x = Number(position.x), y = Number(position.y);
    return { x: clamp(Number.isFinite(x) ? x : 8, 8, Math.max(8, viewport.width - width - 8)),
      y: clamp(Number.isFinite(y) ? y : 8, 8, Math.max(8, viewport.height - height - 8)) };
  }
  const BACKGROUND_WORKER_SOURCE = `let timer = null;
self.onmessage = event => {
  if (event.data === 'start' && timer === null) timer = setInterval(() => self.postMessage('pulse'), 50);
  if (event.data === 'stop' && timer !== null) { clearInterval(timer); timer = null; }
};`;
  function chestDecision(cards, cfg, budget, deckAvailable, catalog = [], owned = null, context = {}) {
    const ranked = rankChest(cards, cfg, owned, catalog);
    const configured = Object.values(cfg.priorities).some(x => splitTiers(x).length);
    if (!ranked.length) return { type: 'wait', reason: '沒有可識別卡片' };
    const good = ranked.find(card => card.tier === 0);
    const targets = chestTargets(cfg, catalog, owned, context);
    const filled = chestFilledSlots(owned);
    const allowed = cfg.chestReroll !== false && configured && budget.used < cfg.maxRerolls;
    const canCard = allowed && ['card-deck', 'deck-card', 'card'].includes(cfg.rerollMode) && budget.card > cfg.reserveCard;
    const canDeck = allowed && !good && ['card-deck', 'deck-card', 'deck'].includes(cfg.rerollMode) && deckAvailable && budget.deck > cfg.reserveDeck && targets.length;
    const choices = canCard ? ranked.filter(card => card.tier !== 0 && card.canReroll).flatMap(card => {
      const target = targets.find(target => target.slot === card.slot);
      return target ? [{ card, target }] : [];
    }).sort((a, b) => a.target.need - b.target.need || b.card.tier - a.card.tier || a.card.rarity - b.card.rarity || a.card.index - b.card.index) : [];
    const single = (choice, protecting = false) => ({ type: 'card', card: choice.card, targetSlot: choice.target.slot,
      reason: `${protecting ? '保留現有第一優先級；' : ''}${SLOT_NAMES[choice.target.slot]}已在牌面，單張定向追首選` });
    const deck = (target, early = false) => ({ type: 'deck', targetSlot: target.slot, reason:
      `${early ? `前兩欄階段（已填 ${filled}/5），優先整組；` : cfg.chestSmartReroll !== false && cfg.chestFillFirst && filled >= 2 && filled < 5 ? '後三欄單張目標未出現或不可用，使用剩餘整組補齊；' : ''}${SLOT_NAMES[target.slot]}首選仍可取得，整組重新尋找可用目標類型` });
    if (cfg.chestSmartReroll !== false) {
      if (good) {
        const better = cfg.chestFillFirst && owned !== null && choices.find(choice => choice.target.confirmed && choice.target.need < chestNeed(good.slot, cfg, owned, catalog));
        if (better) return single(better, true);
      } else {
        const earlyTarget = cfg.chestFillFirst && filled !== null && filled < 2 && targets.find(target => !owned[target.slot]);
        if (earlyTarget && canDeck) return deck(earlyTarget, true);
        const needed = [...targets].sort((a, b) => a.need - b.need)[0];
        const direct = needed && choices.find(choice => choice.target.need === needed.need);
        if (direct) return single(direct);
        if (canDeck) return deck(needed);
        if (choices.length) return single(choices[0]);
      }
    } else if (!good) {
      const order = cfg.rerollMode === 'deck-card' || cfg.rerollMode === 'deck' ? ['deck', 'card'] : ['card', 'deck'];
      for (const type of order) {
        if (type === 'card' && choices.length) return single(choices[0]);
        if (type === 'deck' && canDeck) return deck(targets[0]);
      }
    }
    if (configured && !good && cfg.exhausted === 'wait') return { type: 'wait', reason: '未中第一優先級；重抽不可用或達上限，等待手動選擇' };
    return { type: 'pick', card: good || ranked[0], reason: good ? '保留並選取第一優先級，不為稀有度冒險重抽' :
      !configured ? '未配置首選，從現有牌選擇' : `${targets.length ? '重抽已關閉、用盡或不可用' : '設定首選本局不可達，欄位已鎖定或目標不在可抽池'}；按用盡設定選現有最優項` };
  }
  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
  function townDirection(target, player) {
    const dx = target.x - player.x, dy = target.y - player.y;
    return [Math.abs(dx) > 18 ? dx > 0 ? 'ArrowRight' : 'ArrowLeft' : '', Math.abs(dy) > 18 ? dy > 0 ? 'ArrowDown' : 'ArrowUp' : ''].filter(Boolean);
  }
  function sumSkillLevels(ids, read) {
    const unique = [...new Set(ids.filter(Boolean))];
    if (!unique.length) return null;
    let total = 0;
    for (const id of unique) {
      let level;
      try { level = read(id); } catch { return null; }
      if (!Number.isFinite(level) || level < 0) return null;
      total += level;
    }
    return total;
  }
  function totalSkillLevels(game) {
    if (!game?.basicAttack || !Array.isArray(game.slots)) return null;
    return sumSkillLevels([...game.slots, game.basicAttack], id => {
      if (typeof game.skillLevel === 'function') return game.skillLevel(id);
      return game.weapons?.find(skill => skill.id === id)?.rank ?? game.passiveRank?.get?.(id);
    });
  }
  const noFlipDue = (game, config, totalLevel = totalSkillLevels(game)) => !!(['playing', 'levelup'].includes(game?.state)
    && (config.noFlipEnabled && Number.isFinite(game?.time) && game.time >= config.noFlipMinutes * 60
      || config.noFlipLevelEnabled && Number.isFinite(totalLevel) && totalLevel >= config.noFlipTotalLevel));
  function validateConfig(raw) {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw new Error('設定必須是 JSON 物件');
    const out = JSON.parse(JSON.stringify(DEFAULTS));
    for (const key of ['enabled', 'skills', 'dodge', 'bellShelter', 'chests', 'pickups', 'background', 'rarityFirst', 'skillReroll', 'chestReroll', 'chestFillFirst', 'chestSmartReroll', 'noFlipEnabled', 'noFlipLevelEnabled', 'autoEquip', 'autoSell', 'banish', 'banishBasic', 'banishExcludeEnabled', 'repeat', 'progression']) if (typeof raw[key] === 'boolean') out[key] = raw[key];
    if (Number.isInteger(Number(raw.expeditionLap)) && Number(raw.expeditionLap) >= 1 && Number(raw.expeditionLap) <= 99) out.expeditionLap = Number(raw.expeditionLap);
    if (Number.isFinite(Number(raw.noFlipMinutes))) out.noFlipMinutes = clamp(Math.round(Number(raw.noFlipMinutes) * 10) / 10, 0, 180);
    if (Number.isFinite(Number(raw.noFlipTotalLevel))) out.noFlipTotalLevel = clamp(Math.round(Number(raw.noFlipTotalLevel)), 1, 99999);
    if (Array.isArray(raw.sellQualities)) out.sellQualities = [...new Set(raw.sellQualities.filter(q => Number.isInteger(q) && q >= 0 && q <= 4))].sort();
    if (typeof raw.fourth === 'string') out.fourth = raw.fourth.slice(0, 100).trim();
    if (typeof raw.fifth === 'string') out.fifth = raw.fifth.slice(0, 100).trim();
    if ([4, 5].includes(Number(raw.skillSlots))) out.skillSlots = Number(raw.skillSlots);
    if (typeof raw.expedition === 'string') out.expedition = raw.expedition.slice(0, 150);
    if (Array.isArray(raw.banishExclude)) out.banishExclude = [...new Set(raw.banishExclude.filter(v => typeof v === 'string' && /^[\w.-]{1,100}$/.test(v)))].slice(0, 500);
    if (['greed', 'need', 'pass', 'manual'].includes(raw.partyRoll)) out.partyRoll = raw.partyRoll;
    if (['card-deck', 'deck-card', 'card', 'deck', 'off'].includes(raw.rerollMode)) out.rerollMode = raw.rerollMode;
    if (['best', 'wait'].includes(raw.exhausted)) out.exhausted = raw.exhausted;
    for (const [key, lo, hi] of [['maxRerolls', 0, 50], ['reserveCard', 0, 99], ['reserveDeck', 0, 99], ['delay', 850, 5000], ['safety', 25, 200], ['chestRange', 100, 12000], ['lootRange', 100, 12000], ['repeatLimit', 0, 9999], ['repeatDelay', 1500, 60000]]) {
      if (Number.isFinite(Number(raw[key]))) out[key] = clamp(Math.round(Number(raw[key])), lo, hi);
    }
    for (const slot of Object.keys(SLOT_NAMES)) if (typeof raw.priorities?.[slot] === 'string') out.priorities[slot] = raw.priorities[slot].slice(0, 5000);
    return out;
  }
  function nextExpedition(stages, config, laps = []) {
    const index = stages.findIndex(s => s.id === config.expedition);
    if (index < 0) return { type: 'wait', reason: '找不到設定的副本，請重新讀取副本清單' };
    const current = stages[index];
    if (!config.progression || current.cleared !== true && !(config.expeditionLap > 1 && current.storyOnly)) return { type: 'stage', stage: current };
    const next = stages.slice(index + 1).find(s => s.cleared !== true && !(config.expeditionLap > 1 && s.storyOnly));
    if (next) return { type: 'stage', stage: next };
    const nextLap = config.expeditionLap + 1;
    if (laps.some(l => l.lap === nextLap && !l.locked)) {
      const first = stages.find(s => !s.storyOnly);
      return first ? { type: 'lap', lap: nextLap, stage: first } : { type: 'wait', reason: '找不到下一周目起點，等待讀取地圖' };
    }
    const maximum = Math.max(LAP_LABELS.length, ...laps.map(l => l.lap));
    return config.expeditionLap >= maximum ? { type: 'complete', reason: `第 ${config.expeditionLap} 周目所選地圖及後續地圖已通關，已到目前最後周目` }
      : { type: 'wait', reason: `本周目所選地圖及後續地圖已通關，等待第 ${nextLap} 周目解鎖` };
  }
  function pointSegmentDistance(x, y, ax, ay, bx, by) {
    const dx = bx - ax, dy = by - ay;
    const t = clamp(((x - ax) * dx + (y - ay) * dy) / (dx * dx + dy * dy || 1), 0, 1);
    return Math.hypot(x - ax - t * dx, y - ay - t * dy);
  }
  function insideZone(x, y, z, pad = 15) {
    const dx = x - z.x, dy = y - z.y, r = Math.hypot(dx, dy);
    if (z.kind === 'circle') return r < z.r + pad;
    if (z.kind === 'ring') return r < z.r + pad && r > z.r0 - pad;
    if (z.kind === 'line' || z.kind === 'rect') {
      const c = Math.cos(z.ang || 0), s = Math.sin(z.ang || 0);
      return Math.abs(dx * c + dy * s) < z.w / 2 + pad && Math.abs(-dx * s + dy * c) < z.h / 2 + pad;
    }
    if (z.kind === 'cone') return r < z.r + pad && (r < pad * 2 || Math.abs(Math.atan2(Math.sin(Math.atan2(dy, dx) - z.ang), Math.cos(Math.atan2(dy, dx) - z.ang))) < z.half + pad / Math.max(r, 1));
    return false;
  }
  // 僅讀取原生鐘罩特效；普通地面預警不具有這組欄位與方法。
  function readBellShelters(effects) {
    if (!Array.isArray(effects)) return [];
    return effects.flatMap(effect => {
      const radius = effect?.groundMat?.uniforms?.safeR?.value, position = effect?.mesh?.position;
      if (!effect?.bellMat || typeof effect.toll !== 'function' || typeof effect.finish !== 'function'
        || typeof effect.sealed !== 'boolean' || !Number.isFinite(effect.waveAge)
        || !Number.isFinite(effect.out) || effect.out >= 0 || !Number.isFinite(effect.charge)
        || !Number.isFinite(radius) || radius <= 24 || radius > 2000
        || !Number.isFinite(position?.x) || !Number.isFinite(position?.z)) return [];
      // 原生傷害邊界為 safeR - 4，再留 18 世界單位餘量。
      return [{ effect, x: position.x, y: position.z, radius: radius - 22, outerRadius: radius,
        sealed: effect.sealed, struck: effect.waveAge >= 0, charge: clamp(effect.charge, 0, 1) }];
    });
  }
  function chooseBellShelter(shelters, player, previous = null) {
    return [...shelters].sort((a, b) => Number(a.sealed) - Number(b.sealed)
      || Number(b.effect === previous) - Number(a.effect === previous)
      || Math.hypot(a.x - player.x, a.y - player.y) - Math.hypot(b.x - player.x, b.y - player.y))[0] || null;
  }
  // 一般按途經風險排序；鐘罩倒數時優先入罩，入罩後在邊界內避怪。
  function planMove(scene, cfg) {
    const { player: p, enemies, target, bounds: b, walkable, zones = [], shelter } = scene;
    const sheltered = shelter && Math.hypot(p.x - shelter.x, p.y - shelter.y) <= shelter.radius;
    const speed = Math.max(40, scene.speed || 180), horizon = .75;
    const candidates = [{ dx: 0, dy: 0 }];
    for (let i = 0; i < 24; i++) candidates.push({ dx: Math.cos(i * Math.PI / 12), dy: Math.sin(i * Math.PI / 12), cap: sheltered ? shelter.radius * .5 : Infinity });
    const goal = target || p;
    const goalDistance = Math.hypot(goal.x - p.x, goal.y - p.y);
    if (target && goalDistance > 0) candidates.push({ dx: (goal.x - p.x) / goalDistance, dy: (goal.y - p.y) / goalDistance, cap: goalDistance });
    let best = null;
    for (const c of candidates) {
      let risk = 0, minClear = 1e6, valid = true;
      let last = p;
      for (let j = 1; j <= 6; j++) {
        const t = j / 6 * horizon, travel = Math.min(speed * t, c.cap ?? Infinity), x = p.x + c.dx * travel, y = p.y + c.dy * travel;
        if (b && (x < b.x0 + 6 || x > b.x1 - 6 || y < b.y0 + 6 || y > b.y1 - 6) || walkable && !walkable(last.x, last.y, x, y)) { valid = false; break; }
        if (sheltered && Math.hypot(x - shelter.x, y - shelter.y) > shelter.radius) { valid = false; break; }
        for (const e of enemies) {
          const ex = e.x + (e.vx || 0) * t, ey = e.y + (e.vy || 0) * t;
          const clear = Math.hypot(x - ex, y - ey) - (e.radius || 18) - 12;
          minClear = Math.min(minClear, clear);
          risk += Math.max(0, cfg.safety - clear) ** 2 / (j + 2);
          // 採樣間的近身穿越也有代價。
          if (pointSegmentDistance(ex, ey, last.x, last.y, x, y) < (e.radius || 18) + 12) risk += 20000;
        }
        for (const z of zones) if (insideZone(x, y, z)) risk += 60000;
        last = { x, y };
      }
      if (!valid) continue;
      const distance = Math.hypot(last.x - goal.x, last.y - goal.y);
      const inertia = scene.previous ? c.dx * scene.previous.dx + c.dy * scene.previous.dy : 0;
      const score = shelter && !sheltered ? Math.min(150000, risk * 10) + distance * 10000 - inertia * 6
        : risk * 10 + distance * .35 - Math.min(180, minClear) * .2 - inertia * 6;
      if (!best || score < best.score) best = { ...c, x: last.x, y: last.y, score, risk };
    }
    return best;
  }
  const core = { VERSION, DEFAULTS, FIXED, BASIC_ANY, STAGES, LAP_LABELS, LAP_SUFFIXES, BACKGROUND_WORKER_SOURCE, needsBackgroundClock, clampPanelPosition, norm, baseName, tokenId, splitTiers, matchToken, tierOf, rarityOf, resolveItem, upgradeOf, skillId, chooseSkill, banishCandidate, displayPriority, appendPriorityTier, pickupPriority, pickupTargets, rankChest, chestFilledSlots, chestTargets, chestDecision, validateConfig, nextExpedition, pointSegmentDistance, insideZone, readBellShelters, chooseBellShelter, planMove, townDirection, totalSkillLevels, noFlipDue };
  if (typeof module === 'object' && module.exports) { module.exports = core; return; }
  if (typeof window === 'undefined' || window.top !== window.self) return;
  if (window.__RO_SURVIVORS_HELPER__) return;

  const STORAGE = 'ro-survivors-helper.settings.v1';
  const POSITION_STORAGE = 'ro-survivors-helper.panel-position.v1';
  let cfg = validateConfig(DEFAULTS);
  try { const saved = localStorage.getItem(STORAGE); if (saved) cfg = validateConfig(JSON.parse(saved)); } catch (error) { console.warn('[RO助手] 設定讀取失敗', error); }
  const state = {
    game: null, registry: {}, itemRegistry: {}, catalog: [], hooks: null, assets: null, attaching: false,
    bridge: '等待遊戲模組', message: '已暫停；開啟面板後按「啟動」', logs: [],
    pickerNode: null, pickerType: '', chestToken: null, born: 0, used: 0, pending: null, skillUsed: 0,
    manualUntil: 0, moveOwned: false, previous: null, velocities: new WeakMap(),
    lastMove: 0, lastGameTime: 0, errorCount: 0, zones: new Set(), observedGame: null,
    route: null, bell: null, bellRoute: null, bellStatus: '尚無鐘罩機制',
    stages: [], laps: [], stageLap: 1, progressionStatus: '從所選地圖開始，已通關則自動推進', flow: null, gameoverAt: null, runsStarted: 0, launchPending: false, launchStage: '', launchLap: 0,
    revealNode: null, revealAt: 0, revealClicked: false, lastListRead: 0,
    settings: null, autoPauseOriginal: null, clockWorker: null, clockFallback: null, clockRunning: false,
    clockTicker: null, clockTickerWasRunning: false, backgroundLastLogic: 0, backgroundStatus: '前台', resumeAfterVisibility: false,
    panelDrag: null, suppressMiniClickUntil: 0,
    noFlipDone: false, postRun: null, finishedGame: null, townKeys: [], townPulse: null, townDispatch: false,
  };
  let root, panel, ui, interval, attachTimer;
  const $ = selector => document.querySelector(selector);
  const text = (element, selector) => element?.querySelector(selector)?.textContent?.trim() || '';
  const editingSettings = () => !panel?.hidden && /^(INPUT|TEXTAREA|SELECT)$/.test(ui?.activeElement?.tagName);
  const visible = el => !!el && !el.classList.contains('hidden') && !el.closest('.hidden') && getComputedStyle(el).display !== 'none' && getComputedStyle(el).visibility !== 'hidden';
  const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  function log(message) {
    state.message = message;
    if (state.logs.at(-1)?.message !== message) state.logs.push({ time: new Date().toLocaleTimeString(), message });
    state.logs = state.logs.slice(-50);
  }
  function save() {
    try { localStorage.setItem(STORAGE, JSON.stringify(cfg)); } catch { log('設定無法儲存；請檢查瀏覽器儲存空間'); }
  }
  function releaseBackgroundTicker() {
    const ticker = state.clockTicker, restart = state.clockTickerWasRunning;
    state.clockTicker = null; state.clockTickerWasRunning = false;
    try { if (restart && ticker?.start) ticker.start(); } catch { /* 已銷毀的時鐘無需恢復 */ }
  }
  function stopBackgroundClock() {
    if (state.clockRunning) { try { state.clockWorker?.postMessage('stop'); } catch {} }
    if (state.clockFallback !== null) { clearInterval(state.clockFallback); state.clockFallback = null; }
    state.clockRunning = false; releaseBackgroundTicker();
  }
  function resumeVisibilityPause() {
    const allowed = state.resumeAfterVisibility;
    state.resumeAfterVisibility = false;
    if (!allowed || !needsBackgroundClock(cfg, document.hidden) || state.game?.state !== 'paused') return;
    const pause = $('#pause'), resume = $('#btn-resume');
    if (visible(pause) && resume && !resume.disabled) { resume.click(); log('已恢復切換分頁造成的自動暫停'); }
  }
  function backgroundPulse() {
    if (!needsBackgroundClock(cfg, document.hidden) || window.RO_DEAD || $('#ro-tab-dead')) { syncBackground(); return; }
    try {
      resumeVisibilityPause();
      const now = performance.now();
      // 手動驅動原有的完整遊戲時鐘，保留正常速度、暫停狀態、組隊與結算邏輯。
      if (state.clockTicker?.update) state.clockTicker.update(now);
      if (now - state.backgroundLastLogic >= 100) { state.backgroundLastLogic = now; tick(); }
    } catch (error) {
      stopBackgroundClock(); cfg.background = false; save();
      log(`背景時鐘失敗，已關閉背景模式：${error.message}`);
    }
  }
  function startBackgroundFallback() {
    if (state.clockFallback === null) state.clockFallback = setInterval(backgroundPulse, 50);
    state.clockRunning = true; state.backgroundStatus = '瀏覽器計時器（可能被限速）';
  }
  function syncBackground() {
    if (state.settings) {
      if (cfg.enabled && cfg.background) {
        if (state.autoPauseOriginal === null) state.autoPauseOriginal = state.settings.autoPause;
        state.settings.autoPause = false;
      } else if (state.autoPauseOriginal !== null) {
        state.settings.autoPause = state.autoPauseOriginal; state.autoPauseOriginal = null;
      }
    }
    if (!needsBackgroundClock(cfg, document.hidden) || window.RO_DEAD || $('#ro-tab-dead')) {
      stopBackgroundClock(); state.backgroundStatus = cfg.enabled && cfg.background ? '已就緒，前台使用原時鐘' : '未啟用'; return;
    }
    const ticker = state.game?.app?.ticker;
    if (ticker && typeof ticker.update === 'function' && ticker !== state.clockTicker) {
      releaseBackgroundTicker(); state.clockTicker = ticker; state.clockTickerWasRunning = !!ticker.started;
      if (state.clockTickerWasRunning) ticker.stop?.();
    }
    if (state.clockRunning) {
      if (state.clockWorker && state.clockFallback === null) state.backgroundStatus = ticker ? 'Worker 時鐘約 20 Hz' : 'Worker 等待接入遊戲時鐘';
      return;
    }
    if (!state.clockWorker && typeof Worker === 'function' && typeof URL.createObjectURL === 'function') {
      let workerURL;
      try {
        workerURL = URL.createObjectURL(new Blob([BACKGROUND_WORKER_SOURCE], { type: 'application/javascript' }));
        state.clockWorker = new Worker(workerURL);
        state.clockWorker.onmessage = event => { if (event.data === 'pulse') backgroundPulse(); };
        state.clockWorker.onerror = () => {
          state.clockWorker?.terminate(); state.clockWorker = null;
          if (needsBackgroundClock(cfg, document.hidden)) startBackgroundFallback();
        };
      } catch { state.clockWorker = null; }
      finally { if (workerURL) URL.revokeObjectURL(workerURL); }
    }
    if (state.clockWorker) {
      try { state.clockWorker.postMessage('start'); state.clockRunning = true; state.backgroundStatus = ticker ? 'Worker 時鐘約 20 Hz' : 'Worker 等待接入遊戲時鐘'; }
      catch { state.clockWorker = null; startBackgroundFallback(); }
    } else startBackgroundFallback();
  }
  function stopMove() {
    if (state.moveOwned && state.game) state.game.movePath = null;
    state.moveOwned = false; state.previous = null;
  }
  function toggle() {
    cfg.enabled = !cfg.enabled; save();
    if (!cfg.enabled) { stopMove(); releaseTownKeys(); }
    syncBackground();
    log(cfg.enabled ? '已啟動' : '已暫停'); renderStatus();
  }
  function syncPriorityTiers(slot, preferred) {
    const select = ui?.querySelector(`[data-priority-tier="${slot}"]`);
    if (!select) return;
    const tiers = splitTiers(cfg.priorities[slot]);
    const chosen = preferred === undefined ? select.value : String(preferred);
    select.innerHTML = tiers.map((tier, index) => `<option value="${index}">第 ${index + 1} 級（並列）</option>`).join('') + '<option value="new">新增優先級</option>';
    select.value = chosen === 'new' || /^\d+$/.test(chosen) && Number(chosen) < tiers.length ? chosen : tiers.length ? '0' : 'new';
  }
  function refreshCatalog() {
    const game = state.game;
    const abs = value => value ? new URL(value, location.href).href : '';
    const items = Object.values(state.itemRegistry).filter(d => d && SLOT_NAMES[d.slot]).map(d => ({ id: d.id, slot: d.slot, name: d.name,
      icon: abs(d.img ? 'assets/' + d.img : state.assets?.manifest?.items?.[d.icon]?.icon ? 'assets/' + state.assets.manifest.items[d.icon].icon : '') }));
    const learned = game?.deityLearned?.() || [];
    for (const [id, def] of Object.entries(state.registry)) {
      if (typeof def?.create === 'function' && !id.startsWith('atk_')) items.push({ id, slot: 'deity', name: `${def.name} Deity`, available: learned.includes(id), icon: abs(state.assets?.icons?.get(def.icon)) });
    }
    state.catalog = items;
    if (ui) {
      for (const slot of Object.keys(SLOT_NAMES)) {
        const select = ui.querySelector(`[data-catalog="${slot}"]`), old = select.value;
        select.innerHTML = '<option value="">從遊戲物品表加入一行優先級…</option>' + items.filter(i => i.slot === slot).map(i => `<option value="${esc(i.id)}">${esc(i.name.replace(/Deity/g, '神格'))} [${esc(i.id)}]${i.available === false ? '（本局未學）' : ''}</option>`).join('');
        select.value = old;
        const area = ui.querySelector(`[data-priority="${slot}"]`);
        if (area !== ui.activeElement) area.value = displayPriority(cfg.priorities[slot], slot, items);
        syncPriorityTiers(slot);
      }
      ui.querySelector('#skills-list').innerHTML = Object.entries(state.registry).filter(([id]) => !id.startsWith('atk_')).map(([id, d]) => `<option value="${esc(`${d.name} [${id}]`)}"></option>`).join('');
      for (const key of ['fourth', 'fifth']) {
        const el = ui.querySelector(`[data-setting="${key}"]`), id = skillId(cfg[key], state.registry);
        if (id && el !== ui.activeElement) el.value = `${SKILL_NAMES[id] || state.registry[id]?.name || id} [${id}]`;
      }
      renderExclusions();
    }
  }
  function renderExclusions() {
    if (!ui) return;
    const query = norm(ui.querySelector('#banish-filter').value), owned = ownedSkills();
    const basic = basicAttackId();
    const choices = [...new Set([BASIC_ANY, ...owned, ...(basic ? [basic] : []), ...Object.keys(state.registry).filter(id => !id.startsWith('atk_')), ...cfg.banishExclude])];
    const label = id => id === BASIC_ANY ? '普攻（所有武器）' : id === basic ? `普攻 · ${state.registry[id]?.name || id}` : SKILL_NAMES[id] || state.registry[id]?.name || id;
    choices.sort((a, b) => Number(owned.includes(b)) - Number(owned.includes(a)) || a.localeCompare(b));
    ui.querySelector('#banish-list').innerHTML = choices.filter(id => norm(`${id} ${label(id)}`).includes(query)).map(id => `<label><input type="checkbox" data-exclude="${esc(id)}"${cfg.banishExclude.includes(id) ? ' checked' : ''}> ${esc(label(id))} <small>[${esc(id)}]${owned.includes(id) || id === basic ? ' · 已擁有' : ''}</small></label>`).join('') || '<small>等待遊戲技能表，或無符合搜尋的技能。</small>';
  }
  function readLapTabs() {
    return [...document.querySelectorAll('#lap-tabs [data-laptab]')].map(tab => ({ lap: Number(tab.dataset.laptab),
      label: tab.textContent.trim(), locked: tab.disabled || tab.getAttribute('aria-disabled') === 'true', selected: tab.classList.contains('primary'), tab }))
      .filter(l => Number.isInteger(l.lap) && l.lap >= 1 && l.lap <= 99);
  }
  function readStages() {
    const laps = readLapTabs();
    state.laps = laps.map(({ tab, ...lap }) => lap);
    const cards = [...document.querySelectorAll('#stg-list .stg-card')];
    if (cards.length) {
      state.stageLap = laps.find(l => l.selected)?.lap || 1;
      state.stages = cards.map(card => {
        const title = card.querySelector('.stg-card-info b')?.cloneNode(true);
        // 特殊地圖標記是標題內的子元素，不能把「特殊關卡」當作地圖名稱。
        if (title) for (const child of [...title.children]) child.remove();
        const name = (title?.textContent.trim() || text(card, '.stg-card-info b')).replace(/[・·]\s*改(?:[²³⁴⁵⁶⁷⁸⁹0-9]+)?\s*$/, ''), index = Number(card.dataset.i);
        const known = STAGES.find(([, n], i) => norm(n) === norm(name) || norm(STAGE_ALIASES[i]) === norm(name)) || (cards.length === STAGES.length ? STAGES[index] : null);
        const id = card.dataset.stageId || card.dataset.stage || known?.[0] || `name:${name}`;
        return { id, name, index, cleared: card.classList.contains('cleared'),
          storyOnly: id === 'prt_castle' || /劇情關|剧情关/.test(text(card, '.stg-state')),
          special: ['xmas', 'louyang'].includes(id) || !!card.querySelector('.ro-fs-badge'),
          locked: card.disabled || card.classList.contains('locked') || card.classList.contains('soon') };
      });
    }
    if (ui) {
      const lapSelect = ui.querySelector('[data-setting="expeditionLap"]');
      const values = [...new Set([...LAP_LABELS.map((_, i) => i + 1), ...laps.map(l => l.lap), cfg.expeditionLap])].sort((a, b) => a - b);
      const lapOptions = values.map(n => ({ value: n, label: laps.find(l => l.lap === n)?.label || `${LAP_LABELS[n - 1] || `第 ${n} 周目`}${LAP_SUFFIXES[n - 1] || ''}` }));
      const lapSignature = JSON.stringify(lapOptions);
      if (lapSelect.dataset.signature !== lapSignature) {
        lapSelect.dataset.signature = lapSignature;
        lapSelect.innerHTML = lapOptions.map(l => `<option value="${l.value}">${esc(l.label)}</option>`).join('');
      }
      lapSelect.value = String(cfg.expeditionLap);
      const options = state.stages.length ? state.stages : STAGES.map(([id, name], index) => ({ id, name, index }));
      const select = ui.querySelector('[data-setting="expedition"]');
      const signature = JSON.stringify(options);
      if (select.dataset.signature !== signature) {
        select.dataset.signature = signature;
        select.innerHTML = options.map(stage => `<option value="${esc(stage.id)}">${esc(stage.name)}${stage.cleared ? ' ✓' : stage.locked ? '（未開放）' : ''}</option>`).join('');
      }
      if (![...select.options].some(o => o.value === cfg.expedition)) select.insertAdjacentHTML('beforeend', `<option value="${esc(cfg.expedition)}">${esc(cfg.expedition.replace(/^name:/, ''))}（等待確認）</option>`);
      select.value = cfg.expedition;
    }
    return cards;
  }
  function observeGame(g) {
    if (!g?.player || typeof g.moveTo !== 'function' || !Array.isArray(g.enemies)) return;
    if (state.game === g) return;
    stopMove(); state.game = g; state.route = null; state.bell = null; state.bellRoute = null; state.bellStatus = '尚無鐘罩機制'; state.velocities = new WeakMap(); resetPicker();
    if (state.launchPending) { state.runsStarted++; log(`第 ${state.runsStarted} 次自動遠征已開始`); }
    state.launchPending = false; state.flow = null; state.gameoverAt = null;
    state.noFlipDone = false; state.postRun = null; releaseTownKeys();
    syncBackground();
    state.zones.clear(); state.observedGame = g;
    // 記錄遊戲本來建立的紅色地面預警；不改寫傷害、技能、抽卡或角色能力。
    if (typeof g.zoneDecal === 'function') {
      const original = g.zoneDecal;
      const wrapped = function (kind, param) {
        const decal = original.apply(this, arguments);
        if (decal && typeof decal.dispose === 'function') {
          const entry = { kind, param, decal };
          state.zones.add(entry);
          const dispose = decal.dispose;
          decal.dispose = function () { state.zones.delete(entry); return dispose.apply(this, arguments); };
        }
        return decal;
      };
      g.zoneDecal = wrapped;
      g.cleanup?.push(() => { if (g.zoneDecal === wrapped) g.zoneDecal = original; });
    }
    log('已連接本局；讀取角色、怪物與掉落物座標'); refreshCatalog();
  }
  async function attach() {
    if (state.hooks || state.attaching) return;
    const urls = [...document.querySelectorAll('link[rel="modulepreload"][href],script[type="module"][src]')]
      .map(e => e.href || e.src).filter(u => /\/soul_linker[^/]*\.js(?:\?|$)/.test(u) && new URL(u).origin === location.origin);
    if (!urls.length) return;
    state.attaching = true;
    state.bridge = '正在連接遊戲模組';
    try {
      const ns = await import(urls[0]);
      const objects = Object.values(ns).filter(v => v && typeof v === 'object');
      const hooks = objects.find(v => ['start', 'tick', 'hurt', 'cast', 'kill'].every(k => Array.isArray(v[k])));
      const registry = objects.find(v => v.firebolt?.name && v.coldbolt?.name && v.lightning?.name);
      const items = objects.find(v => v.p_cd?.slot === 'potion' && v.e_dmg?.slot === 'elixir');
      if (!hooks || !registry || !items) throw new Error('當前版本的資料結構與適配器不同');
      state.registry = registry; state.itemRegistry = items; state.hooks = hooks;
      state.assets = objects.find(v => v.icons instanceof Map && v.itemTextures instanceof Map) || null;
      state.settings = objects.find(v => typeof v.autoPause === 'boolean' && typeof v.muteHidden === 'boolean' && typeof v.lang === 'string') || null;
      hooks.start.push(observeGame); hooks.tick.push(observeGame);
      syncBackground();
      state.bridge = '模組已連接，等待進入本局'; clearInterval(attachTimer); refreshCatalog();
      log('模組已連接；如已在局內，下一個遊戲幀會自動接入');
    } catch (error) { state.bridge = `連接失敗：${error.message}；選卡仍可用，走位等待連接`; }
    finally { state.attaching = false; }
  }
  function ownedSkills() {
    if (state.game?.slots) return [...state.game.slots];
    return [...document.querySelectorAll('#lu-sockets .skill-slot[data-skill]:not(.basic),#skillbar .skill-slot[data-skill]:not(.basic)')].map(e => e.dataset.skill).filter((v, i, a) => a.indexOf(v) === i);
  }
  function basicAttackId() {
    return state.game?.basicAttack || document.querySelector('#lu-sockets .skill-slot.basic[data-skill],#skillbar .skill-slot.basic[data-skill]')?.dataset.skill || '';
  }
  function readCard(button, index, kind) {
    const name = text(button, '.pk-name'), slotEl = button.closest('.pk-slot');
    const sub = text(button, '.pk-sub'), badge = text(button, '.pk-badge');
    const lines = text(button, '.pk-lines');
    let id = kind === 'skill' ? skillId(name, state.registry) : '', slot = '';
    if (kind === 'chest') {
      slot = Object.keys(SLOT_NAMES).find(k => norm(sub) === norm(SLOT_NAMES[k]) || norm(sub) === norm(k)) || '';
      if (!slot) slot = Object.entries({ potion: ['poción', 'potion'], elixir: ['elixir'], blessing: ['bendición', 'blessing'], dish: ['plato', 'dish'], deity: ['deity'] }).find(([, aliases]) => aliases.some(n => norm(sub) === norm(n)))?.[0] || '';
      id = resolveItem(name, slot, button.querySelector('.pk-art img')?.src, state.catalog)?.id || '';
      if (slot === 'deity' && !id) id = skillId(name.replace(/\s*(?:Deity|神格)\s*(?:\+\s*\d+)?$/i, ''), state.registry);
    }
    const reroll = [...(slotEl?.querySelectorAll('.pk-act') || [])].find(b => /重抽|重擲|reroll/i.test(`${b.title} ${b.textContent}`) && !b.disabled);
    const banish = [...(slotEl?.querySelectorAll('.pk-act') || [])].find(b => /放逐|banish/i.test(`${b.title} ${b.textContent}`) && !b.disabled);
    return { index, name, id, slot, sub, lines, rarity: rarityOf(badge), isNew: !!button.querySelector('.pk-ribbon') || /技能|habilidad|^skill$/i.test(badge), button, slotEl, reroll, canReroll: !!reroll, banish, canBanish: !!banish };
  }
  function deckButton(picker) {
    return [...picker.querySelectorAll('#pk-bar .pk-act')].find(b => /重抽|reroll/i.test(`${b.title} ${b.textContent}`) && !b.disabled);
  }
  function pickerKind(picker) {
    const title = text(picker, '#pk-title');
    if (/寶箱|宝箱|treasure chest|cofre del tesoro/i.test(title)) return 'chest';
    if (/升級|升级|level\s*up/i.test(title)) return 'skill';
    return '';
  }
  function resetPicker() {
    state.pickerNode = null; state.pickerType = ''; state.chestToken = null; state.pending = null; state.used = 0; state.skillUsed = 0;
  }
  function ownedChestSlots() {
    const slots = state.game?.runItems?.slots;
    if (slots && typeof slots.entries === 'function') return Object.fromEntries([...slots.entries()].map(([slot, value]) => [slot, { item: value.item, level: value.vals?.length || 1 }]));
    const hud = $('#runitems');
    if (!hud || !hud.querySelector('.run-slot')) return null;
    return Object.fromEntries([...hud.querySelectorAll('.run-slot[data-item]:not(.empty)')].map(el => [el.dataset.item, { level: (Number(text(el, '.lvl').replace('+', '')) || 0) + 1 }]));
  }
  function readChestContext() {
    const g = state.game, reachableBySlot = {};
    const context = { reachableBySlot, swapDeity: Number.isFinite(g?.perksLeft?.deity) ? g.perksLeft.deity > 0 : undefined };
    if (typeof g?.runItems?.slotItems !== 'function' || typeof g.deityLearned !== 'function' || typeof g.chestOpts !== 'function') return context;
    try {
      const learned = g.deityLearned(), options = g.chestOpts();
      context.swapDeity = options.swap === true;
      for (const slot of Object.keys(SLOT_NAMES)) {
        try {
          const pool = g.runItems.slotItems(slot, learned, options);
          if (Array.isArray(pool) && pool.every(id => typeof id === 'string')) reachableBySlot[slot] = pool.map(id =>
            chestItem(id, slot, state.catalog, { name: slot === 'deity' && state.registry[id] ? `${state.registry[id].name} Deity` : ITEM_NAMES[id] || id }));
        } catch { /* 不確定的欄位不在保留首選時追加重抽 */ }
      }
    } catch { /* 適配器不可用時沿用已知欄位與物品表，不試抽、不消耗亂數 */ }
    return context;
  }
  function readTotalSkillLevel() {
    const total = totalSkillLevels(state.game);
    if (total !== null) return total;
    const basic = basicAttackId();
    if (!basic) return null;
    const slots = [...document.querySelectorAll('#skillbar .skill-slot[data-skill],#lu-sockets .skill-slot[data-skill]')];
    return sumSkillLevels([...ownedSkills(), basic], id => {
      const label = slots.find(el => el.dataset.skill === id)?.querySelector('.lvl')?.textContent;
      const value = label?.match(/\d+/)?.[0];
      return value === undefined ? null : Number(value);
    });
  }
  function timedNoFlip() {
    if (state.noFlipDone || !cfg.noFlipEnabled && !cfg.noFlipLevelEnabled) return;
    const total = cfg.noFlipLevelEnabled ? readTotalSkillLevel() : null;
    if (!noFlipDue(state.game, cfg, total)) return;
    if (state.game.roNoFlip) { state.noFlipDone = true; return; }
    const check = $('#nf-check'), button = $('#nf-btn');
    if (check && !check.disabled && check.checked) {
      check.checked = false; check.dispatchEvent(new Event('change', { bubbles: true }));
    } else if (visible(button) && !button.disabled && !button.classList.contains('on')) button.click();
    else return;
    const reasons = [];
    if (cfg.noFlipEnabled && state.game.time >= cfg.noFlipMinutes * 60) reasons.push(`局內 ${cfg.noFlipMinutes} 分鐘`);
    if (cfg.noFlipLevelEnabled && Number.isFinite(total) && total >= cfg.noFlipTotalLevel) reasons.push(`技能總等級 ${total}/${cfg.noFlipTotalLevel}（含普攻）`);
    state.noFlipDone = true; log(`已達${reasons.join('、')}，已開啟「之後不再翻牌」；寶箱照常處理`);
  }
  function actPicker(now) {
    const picker = $('#picker');
    if (!visible(picker)) { resetPicker(); return; }
    stopMove();
    if (picker.classList.contains('closing')) return;
    const kind = pickerKind(picker);
    if (!kind || kind === 'skill' && !cfg.skills || kind === 'chest' && !cfg.chests) return;
    const chestToken = kind === 'chest' ? state.game?.openingChest || null : null;
    if (state.pickerType !== kind || chestToken && chestToken !== state.chestToken) {
      resetPicker(); state.pickerType = kind;
    }
    state.chestToken = chestToken;
    const buttons = [...picker.querySelectorAll('#pk-cards .pk-card')];
    if (!buttons.length) return;
    if (buttons[0] !== state.pickerNode) {
      state.pickerNode = buttons[0]; state.born = now; state.pending = null;
    }
    const cards = buttons.map((b, i) => readCard(b, i, kind));
    if (now - state.born < cfg.delay) return; // 遊戲有 380 + 卡數 ×120 ms 的入場鎖。
    if (state.pending) {
      if (state.pending.type === 'pick') {
        const card = cards.find(c => c.button === state.pending.button);
        const yes = card?.slotEl?.classList.contains('asking') && card.slotEl.querySelector('[data-yes]');
        if (yes && now - state.pending.at > 240 && !state.pending.confirmed) { yes.click(); state.pending.confirmed = true; return; }
      }
      if (now - state.pending.at > 3000) log('操作後頁面未更新；暫停此組操作，請手動處理或按「重新識別」');
      return;
    }
    if (kind === 'skill') {
      const owned = ownedSkills();
      const basic = basicAttackId();
      const banished = banishCandidate(cards, owned, cfg, basic);
      if (banished) {
        state.pending = { type: 'banish', at: now };
        banished.banish.click(); log(`放逐${banished.id === basic ? '普攻' : '已擁有技能'}：${banished.name}；本局不再出現其升級`); return;
      }
      const limit = Math.min(cfg.skillSlots, state.game?.maxSkills || cfg.skillSlots);
      const selected = chooseSkill(cards, owned, { ...cfg, skillSlots: limit }, state.registry);
      if (selected) return pick(selected, now);
      const deck = deckButton(picker);
      const left = state.game?.perksLeft?.reroll ?? Number(text(deck, 'small') || 0);
      if (cfg.skillReroll && deck && state.skillUsed < cfg.maxRerolls && (left === undefined || left > cfg.reserveDeck)) {
        state.skillUsed++; state.pending = { type: 'deck', at: now }; deck.click(); log(`技能牌沒有符合 ${limit} 技配置的選項，重抽整組`); return;
      }
      log(`技能牌沒有符合 ${limit} 技配置的選項；等待手動選擇`); return;
    }
    if (cards.some(c => !c.slot)) { log('寶箱欄位未識別；等待手動選擇'); return; }
    const deck = deckButton(picker), left = state.game?.perksLeft;
    const cardLeft = Math.max(0, ...cards.map(c => Number(text(c.reroll, 'small') || 0)));
    const result = chestDecision(cards, cfg, { used: state.used, card: left?.reroll_card ?? cardLeft, deck: left?.reroll ?? Number(text(deck, 'small') || 0) }, !!deck, state.catalog, ownedChestSlots(), readChestContext());
    if (result.type === 'pick') return pick(result.card, now, result.reason);
    if (result.type === 'wait') { log(result.reason); return; }
    const button = result.type === 'card' ? result.card.reroll : deck;
    if (!button || button.disabled) return;
    state.used++; state.pending = { type: result.type, at: now };
    button.click(); log(`${result.reason}；${result.type === 'card' ? '重抽單張：' + result.card.name : '重抽整組'}（本箱 ${state.used}/${cfg.maxRerolls}）`);
  }
  function pick(card, now, reason = '') {
    if (!card.button.isConnected || card.button.disabled) return;
    state.pending = { type: 'pick', at: now, button: card.button, confirmed: false };
    card.button.click(); log(`選取：${card.name}（${({ 0: '普通', 0.5: '優良', 1: '稀有', 2: '史詩', 3: '傳說' })[card.rarity]}）${reason ? '；' + reason : ''}`);
  }
  function readZones() {
    const zones = [];
    for (const { kind, param, decal: d } of state.zones) {
      if (d.alpha === 0) continue;
      const z = { kind, x: d.x, y: d.y, r: d.w / 2, r0: d.w / 2 * param, w: d.w, h: d.h, ang: d.rotation || 0, half: param };
      if (Number.isFinite(z.x) && Number.isFinite(z.y) && Number.isFinite(z.r)) zones.push(z);
    }
    return zones;
  }
  function collectReveal(now) {
    if (!cfg.pickups) return false;
    const reveal = $('#drop-reveal');
    if (!visible(reveal)) { state.revealNode = null; state.revealClicked = false; return false; }
    stopMove();
    const node = reveal.querySelector('.dr-inner') || reveal.firstElementChild;
    if (node !== state.revealNode) { state.revealNode = node; state.revealAt = now; state.revealClicked = false; }
    if (!node || now - state.revealAt < 750 || state.revealClicked) return true;
    let button = reveal.querySelector('.dr-get');
    if (!button && reveal.querySelector('.dr-roll-btns')) {
      if (cfg.partyRoll === 'manual') { log('組隊掉落等待手動分配'); return true; }
      button = [...reveal.querySelectorAll('.dr-roll-btns [data-c]')].find(b => b.dataset.c === cfg.partyRoll);
    }
    if (button && !button.disabled) {
      const name = text(reveal, '.dr-name');
      state.revealClicked = true; button.click(); log(`拾取掉落物：${name || '已確認'}`);
    }
    return true;
  }
  function flowClick(button, key, now) {
    if (!button || !visible(button) || button.disabled) return false;
    if (state.flow?.key === key && state.flow.node === button) {
      if (now - state.flow.at > 8000) log('遠征操作後未切換畫面，等待遊戲響應；可按「重新識別」重試');
      return true;
    }
    state.flow = { key, node: button, at: now };
    button.click(); return true;
  }
  const NPC_NAMES = {
    vendor: /礦石商人|矿石商人|Vendedor de minerales|Ore Merchant|Ore vendor|Mercador de Minérios/i,
    captain: /隊長|队长|captain|capitán|capitão/i,
  };
  function releaseTownKeys() {
    for (const key of state.townKeys) window.dispatchEvent(new KeyboardEvent('keyup', { key, bubbles: true }));
    state.townKeys = [];
    if (state.townPulse !== null) { clearTimeout(state.townPulse); state.townPulse = null; }
  }
  function approachNpc(kind, now) {
    const prompt = $('#lobby-prompt'), name = NPC_NAMES[kind];
    if (visible(prompt) && name.test(prompt.textContent)) { releaseTownKeys(); return flowClick(prompt, `npc:${kind}`, now); }
    if (document.querySelector('.overlay:not(.hidden)') || now < state.manualUntil) { releaseTownKeys(); return false; }
    const target = [...document.querySelectorAll('#lobby-labels .lobby-name.npc')].find(el => name.test(el.textContent));
    const self = $('#lobby-labels .lobby-name.self');
    if (!target || !self) { log(`等待${kind === 'vendor' ? '礦石商人' : '遠征隊長'}位置；請走近該 NPC`); return false; }
    const a = target.getBoundingClientRect(), b = self.getBoundingClientRect();
    // NPC 名牌在頭頂，自己的名牌在腳下；按畫面方向短按遊戲原有移動鍵。
    const keys = townDirection({ x: a.left + a.width / 2, y: a.bottom + 45 }, { x: b.left + b.width / 2, y: b.bottom });
    if (!keys.length) { log('已接近 NPC，等待交談提示'); return false; }
    if (state.townKeys.length) return true;
    state.townKeys = keys;
    state.townDispatch = true;
    try { for (const key of keys) window.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true })); }
    finally { state.townDispatch = false; }
    state.townPulse = setTimeout(releaseTownKeys, 180);
    return true;
  }
  function postRunStep(now) {
    const g = state.game;
    if (!state.postRun && g && state.finishedGame !== g && (visible($('#gameover')) || g.state === 'over') && (cfg.autoEquip || cfg.autoSell && cfg.sellQualities.length)) {
      state.finishedGame = g; state.postRun = { stage: 'return', at: now, next: now + cfg.repeatDelay };
    }
    const p = state.postRun;
    if (!p || p.stage === 'done') return false;
    if (now < state.manualUntil || (!document.hidden && editingSettings())) { releaseTownKeys(); return true; }
    if (now < p.next) return true;
    const dialog = $('#npc-dialog'), lobby = visible($('#lobby-ui')) && document.body.classList.contains('in-lobby');
    if (p.stage === 'return') {
      if (visible(dialog) && /未完待續|未完待续|continuar|to be continued/i.test(text(dialog, '#npc-name'))) { flowClick(dialog.querySelector('#npc-options button.primary'), 'post-summary', now); return true; }
      if (visible($('#gameover'))) { flowClick($('#btn-restart'), 'post-return', now); return true; }
      if (!lobby || visible($('#loading'))) return true;
      p.stage = 'equip'; p.next = now + 700; return true;
    }
    if (!lobby) { releaseTownKeys(); return true; }
    const finish = message => { releaseTownKeys(); p.stage = 'done'; state.flow = null; log(message); return true; };
    if (!cfg.autoEquip && !cfg.autoSell && p.stage !== 'sell-wait') {
      if (p.stage === 'sell-confirm' && visible(dialog) && p.confirm?.isConnected) dialog.querySelector('#npc-options button:not(.primary)')?.click();
      if (visible($('#charpanel'))) $('#cp-back')?.click();
      if (visible($('#shop'))) $('#shop-close')?.click();
      return finish('結算整理已停用');
    }
    if (p.stage === 'equip') {
      if (!cfg.autoEquip) { p.stage = 'sell'; return true; }
      if (!visible($('#charpanel'))) { $('#lobby-char')?.click(); p.next = now + 700; return true; }
      const tab = $('#charpanel [data-tab="equip"]');
      if (tab && !tab.classList.contains('active')) { tab.click(); p.next = now + 400; return true; }
      const button = $('#cp-auto-btn');
      if (!button || button.disabled) { log('等待遊戲一鍵穿裝按鈕；可關閉自動穿裝後繼續'); return true; }
      button.click(); p.stage = 'equip-close'; p.next = now + 700; log('已執行遊戲一鍵穿裝：同武器類型、可穿且分數更高的裝備'); return true;
    }
    if (p.stage === 'equip-close') {
      if (visible($('#charpanel'))) { $('#cp-back')?.click(); p.next = now + 700; return true; }
      p.stage = 'sell'; return true;
    }
    if (p.stage === 'sell') {
      if (!cfg.autoSell || !cfg.sellQualities.length) return finish('結算穿裝完成；未啟用出售或未勾選品質');
      if (!visible($('#shop'))) { approachNpc('vendor', now); return true; }
      releaseTownKeys();
      const all = $('#shop-filters [data-f="all"]');
      if (all && !all.classList.contains('active')) { all.click(); p.next = now + 300; return true; }
      const quick = $('#shop-quick');
      if (!visible(quick)) { log('等待遊戲一鍵販賣介面；請切到商人「出售」分頁'); return true; }
      // 每次只改一個原生勾選，因為遊戲會立即重繪整個販賣區。
      const checks = [...quick.querySelectorAll('[data-qs], [data-qo]')];
      const mismatch = checks.find(el => el.checked !== (el.hasAttribute('data-qs') && cfg.sellQualities.includes(Number(el.dataset.qs))));
      if (mismatch) { mismatch.checked = !mismatch.checked; mismatch.dispatchEvent(new Event('change', { bubbles: true })); return true; }
      const button = $('#shop-quick-btn');
      if (!button) { log('目前遊戲版本未提供一鍵販賣；等待手動處理'); return true; }
      if (button.disabled) { $('#shop-close')?.click(); return finish('沒有符合所選品質的可出售裝備；已保留穿著中、保護、初始、插卡和精煉裝備'); }
      p.saleConfig = JSON.stringify(cfg.sellQualities); button.click();
      p.confirm = visible(dialog) && /一鍵販賣/.test(text(dialog, '#npc-name')) ? dialog.querySelector('#npc-options button.primary') : null;
      p.stage = 'sell-confirm'; p.next = now + 400; return true;
    }
    if (p.stage === 'sell-confirm') {
      if (!cfg.autoSell || p.saleConfig !== JSON.stringify(cfg.sellQualities)) {
        if (visible(dialog) && p.confirm?.isConnected) dialog.querySelector('#npc-options button:not(.primary)')?.click();
        $('#shop-close')?.click(); return finish('出售設定已改變，已取消這次出售');
      }
      if (!visible(dialog) || !p.confirm?.isConnected || !/一鍵販賣/.test(text(dialog, '#npc-name')) || !/全部賣掉/.test(p.confirm.textContent)) {
        log('出售確認與預期不符，等待手動處理'); return true;
      }
      p.stage = 'sell-wait'; p.at = now; p.next = now + 800; p.confirm.click(); log('已確認按勾選品質出售；等待遊戲保存結果'); return true;
    }
    if (p.stage === 'sell-wait') {
      const info = text($('#shop'), '#shop-info');
      if (/已售|售出|賣出|卖出|Has vendido|You sold|vendid|vendeu/i.test(info)) { $('#shop-close')?.click(); return finish(`結算整理完成：${info}`); }
      if (now - p.at > 15000) log(`出售未確認成功，暫停下一次遠征；請查看商人提示：${info || '等待伺服器回覆'}`);
      return true;
    }
    return true;
  }
  function repeatStep(now) {
    if (!cfg.repeat) return false;
    if (cfg.repeatLimit > 0 && state.runsStarted >= cfg.repeatLimit) {
      if (!visible($('#hud')) || state.game?.state === 'over') log(`自動遠征已達 ${cfg.repeatLimit} 次上限，等待手動操作`);
      return false;
    }
    if (state.flow && now - state.flow.at < 700) return true;
    if (visible($('#gameover'))) {
      stopMove(); state.gameoverAt ??= now;
      if (now - state.gameoverAt >= cfg.repeatDelay) {
        if (flowClick($('#btn-restart'), 'return', now)) log('遠征結束，返回隊長並準備下一局');
      }
      return true;
    }
    const dialog = $('#npc-dialog');
    if (visible(dialog)) {
      if (state.launchStage === cfg.expedition && state.launchLap === cfg.expeditionLap && /高難度提醒|高难度提醒|High difficulty|Dificultad alta|Dificuldade alta/i.test(text(dialog, '#npc-name'))) {
        const button = dialog.querySelector('#npc-options button.primary');
        if (button && /入場|入场|Enter|Entrar/i.test(button.textContent)) { state.launchPending = true; return flowClick(button, 'high-difficulty', now); }
        return true;
      }
      if (state.game?.state === 'over' && /未完待續|continuar|to be continued/i.test(text(dialog, '#npc-name'))) {
        return flowClick(dialog.querySelector('#npc-options button.primary'), 'continue-summary', now);
      }
      if (state.launchStage === cfg.expedition && state.launchLap === cfg.expeditionLap && dialog.querySelector('#npc-text .diff')) {
        const button = [...dialog.querySelectorAll('#npc-options button')].find(b => /前往野外|ir al campo|go to the field/i.test(b.textContent));
        if (button) { state.launchPending = true; return flowClick(button, 'difficulty', now); }
        log('遠征確認不是單人出發流程，等待手動確認'); return true;
      }
      return true;
    }
    if (visible($('#stages'))) {
      const tabs = readLapTabs();
      const currentLap = tabs.find(t => t.selected)?.lap || 1;
      if (currentLap !== cfg.expeditionLap) {
        const target = tabs.find(t => t.lap === cfg.expeditionLap);
        if (!target || target.locked) { log(`第 ${cfg.expeditionLap} 周目尚未解鎖，等待手動處理`); return true; }
        return flowClick(target.tab, `lap:${cfg.expeditionLap}`, now);
      }
      const cards = readStages();
      const decision = nextExpedition(state.stages, cfg, state.laps);
      if (decision.type === 'wait' || decision.type === 'complete') { state.progressionStatus = decision.reason; log(decision.reason); return true; }
      if (decision.type === 'lap' || decision.stage.id !== cfg.expedition) {
        cfg.expedition = decision.stage.id;
        if (decision.type === 'lap') cfg.expeditionLap = decision.lap;
        state.flow = null; state.launchStage = ''; state.launchLap = 0; state.launchPending = false; save();
        ui.querySelector('[data-setting="expedition"]').value = cfg.expedition;
        ui.querySelector('[data-setting="expeditionLap"]').value = String(cfg.expeditionLap);
        state.progressionStatus = `開荒推進：第 ${cfg.expeditionLap} 周目 · ${decision.stage.name}`;
        log(state.progressionStatus);
        if (decision.type === 'lap') return flowClick(tabs.find(t => t.lap === decision.lap).tab, `lap:${decision.lap}`, now);
      }
      const stage = decision.stage;
      const card = stage && cards.find(c => Number(c.dataset.i) === stage.index);
      if (!card) { log('找不到設定的副本；請重新讀取副本清單'); return true; }
      if (stage.locked) { state.progressionStatus = `等待解鎖：${stage.name}`; log(`副本未開放：${stage.name}；請檢查前置通關、裝備評分、職業或劇情要求`); return true; }
      if (!card.classList.contains('sel')) return flowClick(card, `stage:${cfg.expedition}`, now);
      const go = $('#stg-go');
      if (!visible(go) || go.disabled) { state.progressionStatus = `等待出發條件：${stage.name}`; log(`無法出發：${stage.name}；請檢查裝備評分、職業或劇情要求`); return true; }
      state.launchStage = cfg.expedition; state.launchLap = cfg.expeditionLap;
      if (cfg.progression) state.progressionStatus = `正在開荒：第 ${cfg.expeditionLap} 周目 · ${stage.name}；未通關則重試本圖`;
      if (flowClick(go, `depart:${cfg.expedition}`, now)) log(`自動遠征：${stage.name}，沿用遊戲目前的難度設定`);
      return true;
    }
    if (visible($('#lobby-ui')) && document.body.classList.contains('in-lobby') && !visible($('#loading'))) {
      const prompt = $('#lobby-prompt');
      if (visible(prompt) && NPC_NAMES.captain.test(prompt.textContent)) return flowClick(prompt, 'captain', now);
      approachNpc('captain', now); return true;
    }
    return false;
  }
  function movement(now, shelter = null) {
    const g = state.game;
    if (!g || !visible($('#hud')) || g.state !== 'playing' || g.player.dead || now < state.manualUntil || (document.hidden && !cfg.background) || (!document.hidden && editingSettings()) || g.replayMoves) { stopMove(); return; }
    if (!cfg.dodge && !cfg.chests && !cfg.pickups) { stopMove(); return; }
    if (now - state.lastMove < 110 || g.time === state.lastGameTime) return;
    state.lastMove = now; state.lastGameTime = g.time;
    const p = g.player;
    const enemies = [];
    for (const e of g.enemies) {
      if (e.dead || e.removed || e.hiddenUntil > g.time || !Number.isFinite(e.x) || Math.hypot(e.x - p.x, e.y - p.y) > 950) continue;
      const old = state.velocities.get(e), dt = old ? g.time - old.time : 0;
      const vx = dt > 0 && dt < .6 ? clamp((e.x - old.x) / dt, -400, 400) : 0;
      const vy = dt > 0 && dt < .6 ? clamp((e.y - old.y) / dt, -400, 400) : 0;
      state.velocities.set(e, { x: e.x, y: e.y, time: g.time });
      enemies.push({ x: e.x, y: e.y, vx, vy, radius: e.radius ?? e.def?.radius ?? 18 * (e.def?.scale ?? 1) });
    }
    enemies.sort((a, b) => Math.hypot(a.x - p.x, a.y - p.y) - Math.hypot(b.x - p.x, b.y - p.y));
    let goal = shelter ? { x: shelter.x, y: shelter.y } : null;
    if (shelter && g.walk && Math.hypot(p.x - shelter.x, p.y - shelter.y) > shelter.radius) {
      if (state.bellRoute?.effect !== shelter.effect || state.bellRoute.until < now) {
        const [x, y] = g.walk.nearestWalkable(shelter.x, shelter.y);
        state.bellRoute = { effect: shelter.effect, until: now + 250,
          points: Math.hypot(x - shelter.x, y - shelter.y) <= shelter.radius ? g.walk.pathTo(p.x, p.y, x, y) || [] : [] };
      }
      while (state.bellRoute.points.length && Math.hypot(state.bellRoute.points[0].x - p.x, state.bellRoute.points[0].y - p.y) < 12) state.bellRoute.points.shift();
      state.bellRoute.unreachable = !state.bellRoute.points.length;
      if (state.bellRoute.unreachable) { stopMove(); return; }
      goal = state.bellRoute.points[0];
    }
    const targets = shelter ? [] : pickupTargets(g.pickups, p, g.zeny, g.chestCost(), cfg, enemies.slice(0, 100));
    // 遊戲拾取判定使用玩家 y-20，所有掉落物目標需加回 20。
    for (const target of targets.slice(0, 5)) {
      const destination = { x: target.x, y: target.y };
      if (!g.walk) { goal = destination; break; }
      if (state.route?.target !== target.pickup || state.route.until < now) {
        const [x, y] = g.walk.nearestWalkable(destination.x, destination.y);
        state.route = { target: target.pickup, until: now + 600, points: g.walk.pathTo(p.x, p.y, x, y) || [] };
      }
      while (state.route.points.length && Math.hypot(state.route.points[0].x - p.x, state.route.points[0].y - p.y) < 24) state.route.points.shift();
      if (state.route.points.length) { goal = state.route.points[0]; break; }
      if (Math.hypot(destination.x - p.x, destination.y - p.y) < 40) { goal = destination; break; }
    }
    if (!cfg.dodge && !goal) { stopMove(); return; }
    const zones = readZones();
    // 僅尋寶時仍評估路徑安全，怪物優先於拾箱。
    const scene = { player: p, enemies: enemies.slice(0, 100), zones, target: goal, shelter, bounds: g.bounds, previous: state.previous,
      speed: g.classDef.speed * 1.3 * g.stats.speedMult * (1 + g.buffValue('speed')) * (1 - g.buffValue('slow')),
      walkable: g.walk ? (ax, ay, bx, by) => {
        if (!g.walk.walkable(bx, by)) return false;
        const [x, y] = g.walk.resolve(ax, ay, bx, by);
        return Math.hypot(x - bx, y - by) < 3;
      } : null };
    const best = planMove(scene, cfg);
    if (!best || !best.dx && !best.dy) { stopMove(); return; }
    // 只呼叫與滑鼠移動相同的尋路入口；角色仍以遊戲原速度行走。
    g.moveTo(best.x, best.y); state.moveOwned = true; state.previous = best;
  }
  function bellStep(now) {
    const g = state.game;
    const shelters = g && cfg.dodge && cfg.bellShelter ? readBellShelters(g.world3d?.cylinders) : [];
    const bell = g && chooseBellShelter(shelters, g.player, state.bell?.effect);
    if (!bell) {
      if (state.bell) {
        stopMove(); state.route = null; state.bellRoute = null;
        log('鐘罩機制結束，恢復普通避怪與拾取');
      }
      state.bell = null;
      state.bellStatus = '尚無鐘罩機制';
      return false;
    }
    const changed = state.bell?.effect !== bell.effect || state.bell?.sealed !== bell.sealed;
    state.bell = bell;
    const inside = Math.hypot(g.player.x - bell.x, g.player.y - bell.y) <= bell.radius;
    state.bellStatus = bell.sealed ? '封印鐘尚未解除，進罩也不安全；需先擊殺九尾狐'
      : bell.struck ? '鐘聲已發動，暫留罩內'
      : inside ? '已進入鐘罩，倒數期間保持在罩內' : '鐘罩倒數中，優先進罩並暫停拾取';
    if (changed) {
      stopMove(); state.route = null; state.bellRoute = null;
      state.lastMove = 0; state.lastGameTime = -1;
      log(state.bellStatus);
    }
    // 選牌／暫停時不移動，讓原有流程先完成；封印狀態僅提示，不改寫原生機制。
    if (g.state !== 'playing' || g.player.dead || !visible($('#hud')) || g.replayMoves) return false;
    movement(now, bell);
    if (!inside && state.bellRoute?.unreachable) state.bellStatus = '鐘罩路徑不可達，請手動走位' + (bell.sealed ? '；封印未解除仍不安全' : '');
    return true;
  }
  function tick() {
    try {
      if (!cfg.enabled) return;
      syncBackground();
      if ((!document.hidden && editingSettings()) || (document.hidden && !cfg.background)) { stopMove(); return; }
      if (window.RO_DEAD || $('#ro-tab-dead')) { stopMove(); log('遊戲分頁已停用，請先在遊戲中恢復'); return; }
      const now = performance.now();
      if (now < state.manualUntil) { stopMove(); return; }
      if (now - state.lastListRead > 1000) { state.lastListRead = now; if (visible($('#stages'))) readStages(); }
      if (bellStep(now)) { state.errorCount = 0; return; }
      if (collectReveal(now)) return;
      timedNoFlip();
      if (postRunStep(now)) return;
      if (repeatStep(now)) return;
      if (visible($('#picker'))) actPicker(now);
      else { resetPicker(); movement(now); }
      state.errorCount = 0;
    } catch (error) {
      stopMove(); log(`執行失敗：${error.message}`); console.error('[RO助手]', error);
      if (++state.errorCount >= 3) { cfg.enabled = false; syncBackground(); save(); log('連續錯誤三次，已暫停；請查看診斷資訊'); }
    }
  }
  function renderStatus() {
    if (!ui) return;
    const g = state.game;
    ui.querySelector('#toggle').textContent = cfg.enabled ? '暫停 (F8)' : '啟動 (F8)';
    ui.querySelector('#toggle').classList.toggle('on', cfg.enabled);
    ui.querySelector('#mini').textContent = `ro.hans ${cfg.enabled ? '▶' : 'Ⅱ'}`;
    ui.querySelector('#status').textContent = `${cfg.enabled ? '運行中' : '已暫停'} · ${g ? `本局 ${g.state}` : state.bridge}\n${state.message}`;
    const owned = ownedSkills();
    ui.querySelector('#owned').textContent = `本局技能 ${owned.length}/${cfg.skillSlots}（不含普攻）：` + (owned.map(id => SKILL_NAMES[id] || state.registry[id]?.name || id).join('、') || '等待進入遊戲');
    ui.querySelector('#fifth-field').hidden = cfg.skillSlots !== 5;
    ui.querySelector('#banish-toggle').textContent = cfg.banish ? '停止放逐' : '啟動放逐';
    ui.querySelector('#banish-toggle').classList.toggle('on', cfg.banish);
    ui.querySelector('#exclude-toggle').textContent = cfg.banishExcludeEnabled ? '停用排除放逐的技能' : '啟用排除放逐的技能';
    ui.querySelector('#exclude-toggle').classList.toggle('on', cfg.banishExcludeEnabled);
    ui.querySelector('#exclude-count').textContent = `${cfg.banishExcludeEnabled ? '排除名單已啟用' : '排除名單未啟用'}，已勾選 ${cfg.banishExclude.length} 個技能`;
    ui.querySelector('#repeat-status').textContent = `${cfg.repeat ? '自動遠征已啟用' : '自動遠征已關閉'} · ${cfg.progression ? '首通開荒' : '固定副本'} · 第 ${cfg.expeditionLap} 周目 · 本次已自動開局 ${state.runsStarted} 次${cfg.repeatLimit ? `／${cfg.repeatLimit}` : '（無上限）'}${cfg.progression ? `\n${state.progressionStatus}` : ''}`;
    ui.querySelector('#background-status').textContent = `背景掛機：${state.backgroundStatus}`;
    ui.querySelector('#bell-status').textContent = !cfg.dodge || !cfg.bellShelter ? '鐘罩避難未啟用（需同時開啟自動避怪）' : state.bellStatus;
    ui.querySelector('#skill-total').textContent = `本局技能總等級（含普攻）：${readTotalSkillLevel() ?? '等待讀取'}`;
    const filled = chestFilledSlots(ownedChestSlots());
    ui.querySelector('#chest-stage').textContent = cfg.chestSmartReroll === false ? '寶箱策略：依設定的先後順序' :
      !cfg.chestFillFirst ? '寶箱策略：依可達類型追首選' : filled === null ? '寶箱策略：等待讀取已填欄位數' :
      `寶箱策略：已填 ${filled}/5，${filled < 2 ? '前兩欄優先整組' : filled < 5 ? '後三欄優先單張，剩餘整組補齊' : '五欄已齊，按首選與等級升級'}`;
    ui.querySelector('#log').textContent = state.logs.slice(-10).map(e => `${e.time} ${e.message}`).join('\n');
  }
  function populate() {
    for (const el of ui.querySelectorAll('[data-sell-quality]')) el.checked = cfg.sellQualities.includes(Number(el.dataset.sellQuality));
    for (const el of ui.querySelectorAll('[data-setting]')) {
      const value = cfg[el.dataset.setting];
      if (el.type === 'checkbox') el.checked = value;
      else if (el.type === 'radio') el.checked = Number(el.value) === value;
      else el.value = value;
    }
    for (const el of ui.querySelectorAll('[data-priority]')) {
      const slot = el.dataset.priority;
      el.value = displayPriority(cfg.priorities[slot], slot, state.catalog);
      syncPriorityTiers(slot, splitTiers(cfg.priorities[slot]).length ? '0' : 'new');
    }
    readStages(); renderExclusions(); renderStatus();
  }
  function fitPanelPosition(remember = false) {
    if (!root) return;
    const rect = root.getBoundingClientRect();
    const size = { width: rect.width || (panel?.hidden ? 84 : 390), height: rect.height || 42 };
    const point = clampPanelPosition({ x: parseFloat(root.style.left), y: parseFloat(root.style.top) }, size, { width: window.innerWidth, height: window.innerHeight });
    root.style.left = `${point.x}px`; root.style.top = `${point.y}px`; root.style.right = 'auto';
    if (remember) { try { localStorage.setItem(POSITION_STORAGE, JSON.stringify(point)); } catch {} }
    return point;
  }
  function resetPanelPosition() {
    root.style.left = `${window.innerWidth - (panel.hidden ? 100 : 410)}px`; root.style.top = '90px'; fitPanelPosition();
    try { localStorage.removeItem(POSITION_STORAGE); } catch {}
  }
  function togglePanel() { panel.hidden = !panel.hidden; fitPanelPosition(); }
  function installPanelDrag() {
    try {
      const stored = JSON.parse(localStorage.getItem(POSITION_STORAGE) || 'null');
      if (stored && Number.isFinite(stored.x) && Number.isFinite(stored.y)) { root.style.left = `${stored.x}px`; root.style.top = `${stored.y}px`; }
    } catch {}
    fitPanelPosition();
    ui.addEventListener('pointerdown', event => {
      const target = event.target, mini = target.closest?.('#mini'), handle = target.closest?.('#drag-handle');
      if ((!mini && !handle) || event.button !== 0 || event.isPrimary === false || (!mini && target.closest?.('button,input,select,textarea,a'))) return;
      const rect = root.getBoundingClientRect();
      state.panelDrag = { pointerId: event.pointerId, sx: event.clientX, sy: event.clientY,
        x: parseFloat(root.style.left) || rect.left, y: parseFloat(root.style.top) || rect.top, moved: false };
      try { (mini || handle).setPointerCapture?.(event.pointerId); } catch {}
      event.stopPropagation();
    });
    window.addEventListener('pointermove', event => {
      const drag = state.panelDrag;
      if (!drag || event.pointerId !== drag.pointerId) return;
      const dx = event.clientX - drag.sx, dy = event.clientY - drag.sy;
      if (!drag.moved && Math.hypot(dx, dy) < 5) return;
      drag.moved = true; root.style.left = `${drag.x + dx}px`; root.style.top = `${drag.y + dy}px`;
      fitPanelPosition(); event.preventDefault();
    }, { capture: true, passive: false });
    const end = event => {
      const drag = state.panelDrag;
      if (!drag || event.pointerId !== drag.pointerId) return;
      state.panelDrag = null;
      if (drag.moved) { state.suppressMiniClickUntil = performance.now() + 400; fitPanelPosition(true); }
    };
    window.addEventListener('pointerup', end, true); window.addEventListener('pointercancel', end, true);
    window.addEventListener('resize', () => { state.panelDrag = null; fitPanelPosition(true); });
  }
  function mount() {
    root = document.createElement('div'); root.id = 'ro-survivors-helper-host';
    root.style.cssText = `position:fixed;left:${window.innerWidth - 100}px;top:90px;z-index:2147483000;`;
    ui = root.attachShadow({ mode: 'open' });
    ui.innerHTML = `<style>
      :host{all:initial;color:#edf2ff;font:13px/1.6 system-ui,"Microsoft YaHei",sans-serif}*{box-sizing:border-box}button,input,select,textarea{font:inherit}button,select{cursor:pointer}button{border:1px solid #48628d;background:#253651;color:#e9f1ff;border-radius:7px;padding:5px 10px}button:hover{background:#354e76}button.on{background:#17654a}#mini{box-shadow:0 3px 15px #0008}#panel{width:390px;max-width:calc(100vw - 24px);max-height:calc(100vh - 130px);overflow:auto;background:#111d2af5;border:1px solid #50688b;border-radius:12px;box-shadow:0 8px 35px #0009;padding:15px;margin-top:7px}#panel[hidden]{display:none}.top{display:flex;gap:8px;align-items:center}.top strong{flex:1}#status{white-space:pre-wrap;color:#9fe3d0;margin:10px 0}label{display:block;margin:8px 0}input:not([type=checkbox]),select,textarea{width:100%;background:#0b1421;color:#e5edff;border:1px solid #40526c;border-radius:6px;padding:6px}input[type=checkbox]{accent-color:#5ad5ac}textarea{min-height:88px;resize:vertical}small,.hint{color:#adc0db}details{border-top:1px solid #31425d;padding-top:8px;margin-top:12px}summary{cursor:pointer;font-weight:650}h4{margin:12px 0 4px;color:#9bd9ff}#log{white-space:pre-wrap;word-break:break-word;font:11px/1.6 Consolas,monospace;max-height:160px;overflow:auto;color:#becce2}.row{display:flex;gap:8px}.row>*{flex:1}.checkrow{display:flex;flex-wrap:wrap;gap:0 12px}.checkrow label{margin:4px 0}.buttons{display:flex;gap:6px;flex-wrap:wrap;margin-top:12px}#config{min-height:150px}p{margin:7px 0}
      input[type=radio]{width:auto;accent-color:#5ad5ac}#fifth-field[hidden]{display:none}#banish-list{max-height:190px;overflow:auto;border:1px solid #31425d;border-radius:6px;padding:6px;margin-top:6px}#banish-list label{margin:3px 0}
      #drag-handle,#mini{touch-action:none;cursor:grab}#drag-handle strong{user-select:none}#drag-handle button{cursor:pointer}
    </style>
    <button id="mini" title="ro.hans幸存者助手：點擊展開／收起，按住拖動移位 (F9)">ro.hans</button>
    <section id="panel" hidden>
      <div class="top" id="drag-handle"><strong title="按住標題拖動">ro.hans幸存者助手 ${VERSION} · 拖動</strong><button id="reset-position">歸位</button><button id="close">收起</button></div>
      <div id="status"></div><button id="toggle">啟動 (F8)</button>
      <div class="checkrow"><label><input data-setting="skills" type="checkbox"> 自動選技能</label><label><input data-setting="dodge" type="checkbox"> 自動避怪</label><label><input data-setting="chests" type="checkbox"> 尋寶與寶箱選卡</label><label><input data-setting="pickups" type="checkbox"> 安全拾取掉落物</label></div>
      <label><input data-setting="bellShelter" type="checkbox"> 鐘罩倒數自動進罩（需開啟自動避怪）</label><small id="bell-status"></small>
      <p id="owned" class="hint"></p>
      <div class="checkrow">技能欄位（不含普攻）：<label><input type="radio" name="skillSlots" data-setting="skillSlots" value="4"> 4 個</label><label><input type="radio" name="skillSlots" data-setting="skillSlots" value="5"> 5 個（二轉）</label></div>
      <label>第四個技能（空白＝任意技能）<input data-setting="fourth" list="skills-list" placeholder="例如 聖靈召喚 [soul_strike]"><datalist id="skills-list"></datalist></label>
      <label id="fifth-field" hidden>第五個技能（空白＝任意技能）<input data-setting="fifth" list="skills-list" placeholder="選擇 5 個技能時生效"></label>
      <label><input data-setting="rarityFirst" type="checkbox"> 其餘技能牌先比稀有度，再比急速／傷害</label>
      <small>火箭術／冰箭術／雷擊術的「增加目標數」升級固定優先於稀有度；同為目標數升級再比稀有度。本開關只調整其餘技能牌，寶箱遵守獨立優先級。</small>
      <label><input data-setting="background" type="checkbox"> 背景掛機：切換分頁繼續運行</label><small id="background-status"></small>
      <details open><summary>重抽設定</summary>
      <div class="checkrow"><label><input data-setting="skillReroll" type="checkbox"> 局內技能：允許重抽</label><label><input data-setting="chestReroll" type="checkbox"> 寶箱：允許重抽</label></div>
      <small>兩個開關獨立生效。技能僅在沒有合規選項時重抽整組，關閉後等待手動選擇；寶箱關閉後按現有牌優先級與下方處理方式選擇或等待。沿用下方重抽上限與保留次數。</small>
      </details>
      <details><summary>之後不再翻牌觸發條件</summary>
      <label><input data-setting="noFlipEnabled" type="checkbox"> 按局內時間啟用「之後不再翻牌」</label>
      <label>本局經過幾分鐘後開啟<input data-setting="noFlipMinutes" type="number" min="0" max="180" step="0.1"></label>
      <label><input data-setting="noFlipLevelEnabled" type="checkbox"> 按技能總等級啟用「之後不再翻牌」</label>
      <label>本局技能總等級達到<input data-setting="noFlipTotalLevel" type="number" min="1" max="99999" step="1"></label>
      <small id="skill-total"></small><br><small>兩項可同時勾選，任一達標即開啟。技能總等級＝本局已擁有技能＋普攻的當前等級之和，每個技能只計一次；每局重新計算、觸發一次。只關閉之後的技能翻牌，寶箱照常；時間 0 表示開局後即啟用。</small></details>
      <details><summary>升級選牌前放逐已有技能</summary>
      <div class="buttons"><button id="banish-toggle">啟動放逐</button><button id="exclude-toggle">啟用排除放逐的技能</button></div>
      <label><input data-setting="banishBasic" type="checkbox"> 同時放逐普攻的升級牌（不佔 4／5 技名額）</label>
      <p class="hint">啟動後，先對牌面中「已擁有」的技能／普攻使用遊戲放逐按鈕，再選技能。未擁有的新技能不放逐。排除名單啟用後，勾選的技能會保留；勾選「普攻（所有武器）」可統一保護普攻。</p>
      <small id="exclude-count"></small><input id="banish-filter" placeholder="搜尋排除技能：中文名稱或 ID"><div id="banish-list"></div>
      </details>
      <details><summary>自動遠征／新周目開荒</summary>
      <label><input data-setting="repeat" type="checkbox"> 啟用自動遠征（固定重刷／開荒）</label>
      <label><input data-setting="progression" type="checkbox"> 首通開荒：通關後下一張，完成後自動進下一周目</label>
      <label>遠征周目<select data-setting="expeditionLap">${LAP_LABELS.map((name, i) => `<option value="${i + 1}">${name}${LAP_SUFFIXES[i]}</option>`).join('')}</select></label>
      <label>固定副本／開荒起點<select data-setting="expedition"></select></label><button id="read-stages">讀取遊戲副本清單</button>
      <div class="row"><label>自動開局上限（0＝不限）<input data-setting="repeatLimit" type="number" min="0" max="9999"></label><label>局間等待毫秒<input data-setting="repeatDelay" type="number" min="1500" max="60000"></label></div>
      <p id="repeat-status" class="hint"></p><small>開荒需同時勾選自動遠征：從所選地圖開始，按原生已通關標記推進，失敗重試；包含聖誕節、元宵節，後續周目跳過劇情關。當所選地圖及其後續地圖通關後，切換已解鎖的下一周目，六周目完成後等待。關閉開荒則固定重刷所選副本。沿用目前難度，先完成勾選的結算裝備整理；未解鎖或評分不足時等待手動處理。</small>
      </details>
      <details><summary>結算後裝備整理</summary>
      <label><input data-setting="autoEquip" type="checkbox"> 打完副本後自動一鍵穿更優裝備</label>
      <small>使用遊戲一鍵穿裝：比較裝備分數，武器保持原類型；先穿裝，再出售。原裝備插卡不會自動移到新裝備。</small>
      <label><input data-setting="autoSell" type="checkbox"> 打完副本後自動出售勾選品質的裝備</label>
      <div class="checkrow">${['普通', '優良', '稀有', '史詩', '傳說'].map((name, q) => `<label><input data-sell-quality="${q}" type="checkbox"> ${name}</label>`).join('')}</div>
      <small>總開關和品質均需勾選，預設全部關閉。不出售穿著中、受保護、初始、角色專屬、已插卡及已精煉裝備，不出售卡片。整理未完成前不開始下一場；取消重複遠征仍可單獨整理。</small></details>
      <details open><summary>五欄位寶箱優先級</summary>
      <label><input data-setting="chestSmartReroll" type="checkbox"> 智能追首選：前兩欄整組、後三欄單張優先</label>
      <label><input data-setting="chestFillFirst" type="checkbox"> 同優先級先補空欄、讓神格成型，再均衡等級</label>
      <small id="chest-stage"></small><br><small>依已填欄位數分階段：先用整組快速選定任意兩欄，之後優先單張追其餘三欄首選；缺少目標類型或單張不可用時，剩餘整組仍可補齊。已有首選就保住它，不整組冒險；整組不可用時可改單張。先比配置優先級，普通物品鎖定品種後不對不可達目標浪費次數。</small>
      <p class="hint">每行一級，同一行可並列多項（用 | 分隔）。先選要加入的級別，再從物品表選入；同級自動並列，選「新增優先級」另起一級。任一並列首選命中都視為第一優先級。空白＝無指定；可填名稱／ID，包含匹配須寫 *傷害*。</p>
      ${Object.entries(SLOT_NAMES).map(([id, name]) => `<h4>${name}</h4><label>加入哪個優先級<select data-priority-tier="${id}" aria-label="${name}加入優先級"><option value="new">新增優先級</option></select></label><select data-catalog="${id}"><option>等待物品表…</option></select><textarea data-priority="${id}" placeholder="第一優先級 A | 第一優先級 B\n第二優先級 C | 第二優先級 D"></textarea>`).join('')}
      <label>允許的重抽方式／非智能模式先後順序<select data-setting="rerollMode"><option value="card-deck">單張＋整組（非智能時先單張）</option><option value="deck-card">整組＋單張（非智能時先整組）</option><option value="card">僅重抽單張</option><option value="deck">僅重抽整組</option><option value="off">不重抽</option></select></label>
      <small>智能開啟時依可達目標決定方式；關閉後依上述先後順序，遇到首選即選。僅單張／僅整組／不重抽始終有效。重抽遵守上限及保留次數，不為稀有度單獨追抽；首選全部留空時不重抽。</small>
      <div class="row"><label>每箱重抽上限<input data-setting="maxRerolls" type="number" min="0" max="50"></label><label>保留單張次數<input data-setting="reserveCard" type="number" min="0" max="99"></label><label>保留整組次數<input data-setting="reserveDeck" type="number" min="0" max="99"></label></div>
      <label>重抽用盡／達上限後<select data-setting="exhausted"><option value="best">從現有卡片選最優項</option><option value="wait">等待手動選擇</option></select></label>
      <small>使用遊戲原有重抽次數；不購買、不補充。每局剩餘次數以遊戲按鈕為準。</small></details>
      <details><summary>走位、操作與診斷</summary>
      <label>避怪安全距離<input data-setting="safety" type="number" min="25" max="200"></label>
      <label>尋找寶箱最大距離<input data-setting="chestRange" type="number" min="100" max="12000"></label>
      <label>尋找掉落物最大距離<input data-setting="lootRange" type="number" min="100" max="12000"></label>
      <label>組隊掉落分配<select data-setting="partyRoll"><option value="greed">貪婪</option><option value="need">需求</option><option value="pass">放棄</option><option value="manual">等待手動</option></select></label>
      <label>每次選卡等待毫秒<input data-setting="delay" type="number" min="850" max="5000"></label>
      <p class="hint">安全目標中優先寶箱與磁鐵，再拾取其他掉落。方向鍵／WASD 或畫面點擊後讓出操作 3 秒。背景模式會暫時關閉遊戲「離開自動暫停」，並用背景時鐘繼續運行；保留手動暫停。瀏覽器凍結／卸載分頁或電腦休眠仍會中斷。</p>
      <div class="buttons"><button id="rescan">重新識別</button><button id="diagnose">顯示診斷</button></div><pre id="log"></pre>
      </details>
      <details><summary>匯入／匯出設定</summary><textarea id="config" spellcheck="false" placeholder="在這裡貼上設定 JSON"></textarea><div class="buttons"><button id="export">匯出到上框</button><button id="import">匯入上框設定</button></div><small>匯入後保持暫停，按啟動即可使用。</small></details>
    </section>`;
    document.body.appendChild(root); panel = ui.querySelector('#panel');
    ui.querySelector('#mini').onclick = () => { if (performance.now() >= state.suppressMiniClickUntil) togglePanel(); };
    ui.querySelector('#close').onclick = togglePanel;
    ui.querySelector('#reset-position').onclick = resetPanelPosition;
    installPanelDrag();
    ui.querySelector('#toggle').onclick = toggle;
    ui.addEventListener('keydown', e => { if (e.key !== 'F8' && e.key !== 'F9') e.stopPropagation(); });
    ui.addEventListener('keyup', e => e.stopPropagation());
    ui.addEventListener('input', e => {
      const el = e.target;
      if (el.dataset.priority) { cfg.priorities[el.dataset.priority] = el.value.slice(0, 5000); syncPriorityTiers(el.dataset.priority); save(); }
      if (el.id === 'banish-filter') renderExclusions();
    });
    ui.addEventListener('change', e => {
      const el = e.target;
      if (el.dataset.setting) {
        const key = el.dataset.setting, wasRepeat = cfg.repeat;
        cfg = validateConfig({ ...cfg, [key]: el.type === 'checkbox' ? el.checked : el.value }); stopMove(); releaseTownKeys();
        if (key === 'repeat' && !wasRepeat && cfg.repeat) state.runsStarted = 0;
        if (['repeat', 'progression', 'expedition', 'expeditionLap'].includes(key)) { state.flow = null; state.launchStage = ''; state.launchLap = 0; state.launchPending = false; state.gameoverAt = null; state.progressionStatus = '從所選地圖開始，已通關則自動推進'; }
      }
      if (el.hasAttribute('data-sell-quality')) {
        const q = Number(el.dataset.sellQuality);
        cfg.sellQualities = el.checked ? [...new Set([...cfg.sellQualities, q])].sort() : cfg.sellQualities.filter(value => value !== q);
      }
      if (el.dataset.exclude) {
        cfg.banishExclude = el.checked ? [...new Set([...cfg.banishExclude, el.dataset.exclude])] : cfg.banishExclude.filter(id => id !== el.dataset.exclude);
      }
      if (el.dataset.priority) { cfg.priorities[el.dataset.priority] = el.value.slice(0, 5000); syncPriorityTiers(el.dataset.priority); }
      if (el.dataset.catalog && el.value) {
        const slot = el.dataset.catalog, area = ui.querySelector(`[data-priority="${slot}"]`);
        const result = appendPriorityTier(cfg.priorities[slot], displayPriority(el.value, slot, state.catalog), ui.querySelector(`[data-priority-tier="${slot}"]`)?.value);
        area.value = displayPriority(result.value, slot, state.catalog); cfg.priorities[slot] = area.value;
        syncPriorityTiers(slot, result.tier); el.value = '';
        if (!result.added) log(`該物品已在第 ${result.tier + 1} 優先級，已保留原設定`);
      }
      save(); syncBackground(); renderStatus();
    });
    ui.querySelector('#banish-toggle').onclick = () => { cfg.banish = !cfg.banish; save(); renderStatus(); };
    ui.querySelector('#exclude-toggle').onclick = () => { cfg.banishExcludeEnabled = !cfg.banishExcludeEnabled; save(); renderStatus(); };
    ui.querySelector('#read-stages').onclick = () => {
      if (visible($('#stages'))) { readStages(); log('副本清單已更新'); return; }
      const prompt = $('#lobby-prompt');
      if (visible(prompt) && /隊長|captain|capitán/i.test(prompt.textContent)) { prompt.click(); readStages(); log('已打開隊長的副本清單'); }
      else log('請先到遠征隊長附近，或手動打開遠征清單後再讀取');
    };
    ui.querySelector('#rescan').onclick = () => { resetPicker(); state.flow = null; state.errorCount = 0; if (!state.hooks) attach(); readStages(); log('已重新識別；本組重抽計數重新開始'); };
    ui.querySelector('#diagnose').onclick = () => {
      const g = state.game, picker = $('#picker'), kind = picker && pickerKind(picker);
      const report = { version: VERSION, bridge: state.bridge, state: g?.state, background: cfg.background, backgroundClock: state.backgroundStatus, hidden: document.hidden, autoPause: state.settings?.autoPause, enemies: g?.enemies?.length, chests: g?.pickups?.filter(p => p.kind === 'chest' && !p.dead).length, drops: g?.pickups?.filter(p => !p.dead).length, skillSlots: cfg.skillSlots, owned: ownedSkills(), totalSkillLevels: readTotalSkillLevel(), chestSlots: ownedChestSlots(), noFlip: { enabled: cfg.noFlipEnabled, minutes: cfg.noFlipMinutes, levelEnabled: cfg.noFlipLevelEnabled, totalLevel: cfg.noFlipTotalLevel, applied: state.noFlipDone }, postRun: state.postRun?.stage, autoEquip: cfg.autoEquip, autoSell: cfg.autoSell, sellQualities: cfg.sellQualities, basicAttack: basicAttackId(), usedRerolls: state.used, repeatStage: cfg.expedition, repeatLap: cfg.expeditionLap, autoRuns: state.runsStarted, banish: cfg.banish, banishBasic: cfg.banishBasic, banishExcludeEnabled: cfg.banishExcludeEnabled, banishExclude: cfg.banishExclude,
        expedition: { progression: cfg.progression, status: state.progressionStatus, stageLap: state.stageLap, laps: state.laps, stages: state.stages, launchLap: state.launchLap },
        bell: { enabled: cfg.bellShelter, status: state.bellStatus, active: !!state.bell,
          ...(state.bell ? { x: state.bell.x, y: state.bell.y, radius: state.bell.radius, sealed: state.bell.sealed, struck: state.bell.struck, charge: state.bell.charge } : {}) },
        cards: visible(picker) && kind ? [...picker.querySelectorAll('.pk-card')].map((b, i) => { const c = readCard(b, i, kind); return { name: c.name, id: c.id, slot: c.slot, rarity: c.rarity, lines: c.lines }; }) : [] };
      ui.querySelector('#config').value = JSON.stringify(report, null, 2); ui.querySelector('#config').closest('details').open = true;
    };
    ui.querySelector('#export').onclick = () => { ui.querySelector('#config').value = JSON.stringify(cfg, null, 2); };
    ui.querySelector('#import').onclick = () => {
      try { cfg = validateConfig(JSON.parse(ui.querySelector('#config').value)); cfg.enabled = false; stopMove(); releaseTownKeys(); syncBackground(); save(); populate(); log('設定已匯入，保持暫停'); } catch (error) { log(`匯入失敗：${error.message}`); }
    };
    populate(); refreshCatalog();
    interval = setInterval(tick, 100); setInterval(renderStatus, 500);
    attach(); attachTimer = setInterval(attach, 5000);
  }
  window.addEventListener('keydown', e => {
    if (state.townDispatch && !e.isTrusted) return;
    const editing = /^(INPUT|TEXTAREA|SELECT)$/.test(e.target?.tagName) || e.target?.isContentEditable || !!ui?.activeElement;
    if (e.key === 'F8') { e.preventDefault(); e.stopImmediatePropagation(); toggle(); return; }
    if (e.key === 'F9' && panel) { e.preventDefault(); e.stopImmediatePropagation(); togglePanel(); return; }
    if (e.key === 'Escape') state.resumeAfterVisibility = false;
    if (editing) { stopMove(); releaseTownKeys(); return; }
    if (e.isTrusted && /^(w|a|s|d|arrowup|arrowdown|arrowleft|arrowright)$/i.test(e.key)) { state.manualUntil = performance.now() + 3000; stopMove(); releaseTownKeys(); }
  }, true);
  window.addEventListener('pointerdown', e => {
    if (!e.composedPath().includes(root) && e.target instanceof HTMLCanvasElement && e.isTrusted) { state.manualUntil = performance.now() + 3000; stopMove(); releaseTownKeys(); }
  }, true);
  window.addEventListener('blur', () => { releaseTownKeys(); if (!cfg.enabled || !cfg.background) stopMove(); });
  window.addEventListener('ro-pause', () => { state.resumeAfterVisibility = false; }, true);
  document.addEventListener('visibilitychange', () => {
    state.resumeAfterVisibility = needsBackgroundClock(cfg, document.hidden) && state.game?.state === 'playing';
    syncBackground();
    if (state.resumeAfterVisibility) setTimeout(resumeVisibilityPause, 0);
    if (document.hidden && !cfg.background) stopMove();
  }, true);
  window.addEventListener('pagehide', () => {
    releaseTownKeys();
    stopBackgroundClock();
    if (state.settings && state.autoPauseOriginal !== null) state.settings.autoPause = state.autoPauseOriginal;
  });
  window.__RO_SURVIVORS_HELPER__ = Object.freeze({ version: VERSION });
  if (document.body) mount(); else document.addEventListener('DOMContentLoaded', mount, { once: true });
})();

