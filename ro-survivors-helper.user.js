// ==UserScript==
// @name         ro.hans幸存者助手
// @namespace    ro-survivors-local-helper
// @version      1.14.4
// @description  新版本提示可設定、基礎職業共用配置、第二章自動遠征與分等級拾取。
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
  const VERSION = '1.14.4';
  const BASIC_ANY = '__basic__';
  const FIXED = ['firebolt', 'coldbolt', 'lightning'];
  const SLOT_NAMES = { potion: '藥水', elixir: '靈藥', blessing: '祝福', dish: '料理', deity: '神格' };
  const SLOT_ALIASES = { potion: ['藥水', 'potion', 'poción', 'poção'], elixir: ['靈藥', '秘藥', 'elixir'],
    blessing: ['祝福', 'blessing', 'bendición', 'bênção'], dish: ['料理', 'dish', 'plato', 'prato'], deity: ['神格', 'deity', 'divindade'] };
  const SKILL_NAMES = { firebolt: '火箭術', coldbolt: '冰箭術', lightning: '雷擊術' };
  const STAGES = [
    ['prontera', '普隆德拉原野'], ['sewer', '普隆德拉地下水道'], ['sunken', '失事輪'], ['byalan', '柏伊亞嵐島'],
    ['payon', '斐揚森林'], ['payon_cave', '斐揚洞穴'], ['prt_castle', '普隆德拉城'], ['orcs', '獸人村'],
    ['pyramid', '夢羅克金字塔'], ['maze', '迷宮森林'], ['xmas', '聖誕節'], ['louyang', '元宵節'],
    ['c2_gef', '吉芬地下迷宮'], ['c2_clock', '時計塔地下'], ['c2_abyss', '深淵之湖'],
    ['c2_glast', '克雷斯特漢姆修道院'], ['c2_nif', '尼芙菲姆原野'],
  ];
  // HANS 0.14.0：第二章各自解鎖一至六周目，原生 data-i 仍是兩章共用的索引。
  const CHAPTER_LABELS = ['第一章', '第二章'];
  const stageChapter = id => id.startsWith('c2_') ? 2 : 1;
  const LAP_LABELS = ['一周目', '二周目', '三周目', '四周目', '五周目', '六周目'];
  const LAP_SUFFIXES = ['', '・改', '・改²', '・改³', '・改⁴', '・改⁵'];
  const STAGE_ALIASES = ['Campos de Prontera', 'Alcantarillas de Prontera', 'Barco hundido', 'Isla de Byalan', 'Bosque de Payon', 'Cueva de Payon', 'Castillo de Prontera', 'Aldea orca', 'Pirámides de Morroc', 'Bosque laberinto', 'Navidad', 'Feria de faroles de Louyang',
    'Mazmorra de Geffen', 'Sótano de la Torre del Reloj', 'Lago del Abismo', 'Monasterio de Glast Heim', 'Campos de Niflheim'];
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
    enabled: false, skills: true, dodge: true, bellShelter: true, chests: true, chestHunt: true, pickups: true, background: true, autoDoubleSpeed: false,
    first: 'firebolt', second: 'coldbolt', third: 'lightning', skillSlots: 4, fourth: '', fifth: '', rarityFirst: true, skillReroll: true, chestReroll: true,
    profileJob: '', jobProfiles: {}, gameUpdateAction: 'manual',
    chestFillFirst: true, chestSmartReroll: true,
    storedOpenMode: 'manual',
    deityOverrideEnabled: false, deityOverrides: '', deityBanishAfterPick: false, deityBanishTargets: '',
    skillLevelGate: false, skillSaveAtLevel: 100, chestLevelGate: false, chestSaveAtTotal: 50,
    autoEquip: false, autoSell: false, sellQualities: [], expeditionLap: 1,
    banish: false, banishBasic: true, banishExcludeEnabled: false, banishExclude: [],
    repeat: false, progression: false, expedition: 'prontera', repeatLimit: 0, repeatDelay: 5000,
    timedExitEnabled: false, timedExitMinutes: 3, cleanupSeconds: 20,
    deathMailEnabled: false, deathMailDigestMinutes: 30,
    lootRange: 1800, magnetInterval: 0, stopChestPickupAtTotal: 0, stopXpPickupAtLevel: 0, partyRoll: 'greed',
    rerollMode: 'card-deck', maxRerolls: 6, reserveCard: 0, reserveDeck: 0,
    exhausted: 'best', delay: 1000, safety: 65, chestRange: 2400,
    priorities: { potion: '', elixir: '', blessing: '', dish: '', deity: '' },
  };
  const PROFILE_KEYS = ['first', 'second', 'third', 'fourth', 'fifth', 'skillSlots', 'skills', 'rarityFirst', 'skillReroll',
    'banish', 'banishBasic', 'banishExcludeEnabled', 'banishExclude', 'skillLevelGate', 'skillSaveAtLevel', 'chestLevelGate', 'chestSaveAtTotal',
    'chests', 'chestReroll', 'chestSmartReroll', 'chestFillFirst', 'storedOpenMode', 'priorities', 'deityOverrideEnabled', 'deityOverrides', 'deityBanishAfterPick', 'deityBanishTargets', 'rerollMode', 'maxRerolls', 'reserveCard', 'reserveDeck', 'exhausted'];
  const profileSettings = config => Object.fromEntries(PROFILE_KEYS.map(key => [key, JSON.parse(JSON.stringify(config[key]))]));
  const BASE_JOB_NAMES = {
    swordsman: '劍士', mage: '魔法師', archer: '弓箭手', acolyte: '服事', thief: '盜賊',
    merchant: '商人', taekwon: '跆拳少年', ninja: '忍者', gunslinger: '神槍手',
  };
  // HANS 原生職業表的直接前置職業。升階資料由基礎職業設定繼承。
  const PROMOTION_PARENT = {
    knight: 'swordsman', crusader: 'swordsman', wizard: 'mage', sage: 'mage', hunter: 'archer', bard: 'archer',
    priest: 'acolyte', monk: 'acolyte', assassin: 'thief', rogue: 'thief', blacksmith: 'merchant', alchemist: 'merchant',
    star_gladiator: 'taekwon', soul_linker: 'taekwon',
    arch_bishop: 'priest', genetic: 'alchemist', guillotine_cross: 'assassin', kagerou: 'ninja', mechanic: 'blacksmith',
    minstrel: 'bard', ranger: 'hunter', rebellion: 'gunslinger', royal_guard: 'crusader', rune_knight: 'knight',
    shadow_chaser: 'rogue', sorcerer: 'sage', soul_reaper: 'soul_linker', star_emperor: 'star_gladiator',
    sura: 'monk', warlock: 'wizard',
  };
  function baseJobId(id) {
    while (Object.hasOwn(PROMOTION_PARENT, id)) id = PROMOTION_PARENT[id];
    return Object.hasOwn(BASE_JOB_NAMES, id) ? id : '';
  }
  const gameJobId = game => {
    const id = game?.promotion || game?.look?.promotion || game?.classDef?.id;
    return typeof id === 'string' && /^[a-z][a-z0-9_]{0,59}$/.test(id) ? id : '';
  };
  const gameBaseJobId = game => baseJobId(game?.classDef?.id) || baseJobId(game?.look?.job) ||
    baseJobId(gameJobId(game)) || baseJobId(game?.classDef?.base);
  const EMAILJS_ENDPOINT = 'https://api.emailjs.com/api/v1.0/email/send';
  const MAIL_DEFAULTS = { serviceId: '', templateId: '', publicKey: '', toEmail: '' };
  function normalizeMailSettings(raw) {
    return Object.fromEntries(Object.keys(MAIL_DEFAULTS).map(key => [key, typeof raw?.[key] === 'string' ? raw[key].trim().slice(0, key === 'toEmail' ? 254 : 200) : '']));
  }
  function mailSettingsError(settings) {
    if (!/^[a-zA-Z0-9_.-]{1,100}$/.test(settings.serviceId)) return '請填寫有效的 EmailJS Service ID';
    if (!/^[a-zA-Z0-9_.-]{1,100}$/.test(settings.templateId)) return '請填寫有效的 EmailJS Template ID';
    if (!/^[^\s\x00-\x1f<>]{1,200}$/.test(settings.publicKey)) return '請填寫 EmailJS Public Key（公開密鑰）';
    if (!/^[^\s@<>,;]+@[^\s@<>,;]+\.[^\s@<>,;]+$/.test(settings.toEmail)) return '請填寫有效的單一收件郵箱';
    return '';
  }
  const isExpeditionDeath = game => !!(game?.player?.dead === true && typeof game.stageId === 'string' && game.stageId.length > 0
    && !game.coop && !game.endless && !game.story && !game.isStory && !game.replayMoves
    && ['playing', 'over', 'paused', 'levelup', 'reveal'].includes(game.state));
  function deathMailEvent(game, occurredAt) {
    const seconds = Math.max(0, Math.floor(Number(game?.time) || 0)), lap = Math.max(1, Math.floor(Number(game?.difficulty?.lap) || 1));
    const stageId = String(game?.stageId || '').slice(0, 100), jobId = gameJobId(game);
    const stage = STAGES.find(([id]) => id === stageId)?.[1] || stageId;
    const job = String(game?.jobLabel || (game?.classDef?.id === jobId ? game.classDef.name : jobId) || '未知職業').slice(0, 100);
    const duration = `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;
    return { title: 'ro.hans幸存者助手：遠征死亡提醒', job, job_id: jobId, stage, stage_id: stageId, lap,
      survival_time: duration, level: Math.max(0, Number(game?.level) || 0), kills: Math.max(0, Number(game?.kills) || 0), occurred_at: occurredAt,
      message: `角色在遠征中死亡。\n職業：${job} [${jobId}]\n副本：${stage}（第 ${lap} 周目）\n局內存活：${duration}\n等級：${Math.max(0, Number(game?.level) || 0)}\n擊殺：${Math.max(0, Number(game?.kills) || 0)}\n發生時間：${occurredAt}` };
  }
  const emailjsPayload = (settings, event) => ({ service_id: settings.serviceId, template_id: settings.templateId, user_id: settings.publicKey,
    template_params: { ...event, to_email: settings.toEmail } });
  const CHAR_MAP = Object.fromEntries('唤喚 术術 击擊 伤傷 传傳 说說 优優 诗詩 回回 药藥 秘秘 复復 却卻 护護 围圍 采採 贪貪 诵誦 咏詠 双雙 掷擲 丰豐 饶饒 智智 烹烹 调調 闪閃 络絡 连連 链鏈 灵靈 圣聖 体體 力力 敏敏 捷捷 运運 龙龍 毁毀 灭滅 寿壽 烈烈 风風 祝祝 觉覺 醒醒 标標 数數 时時 间間 动動 速速 强強 冰冰 箭箭 续續 剂劑'.split(' ').map(x => [x[0], x[1]]));
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
    const names = [baseName(card.name), ITEM_NAMES[card.id]].filter(Boolean).map(norm);
    if (t === norm(card.id) || names.includes(t)) return true;
    // 星號是顯式包含匹配；不默認用「傷害」匹配「爆擊傷害」。
    return t.includes('*') && names.some(name => name.includes(t.replace(/\*/g, '')));
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
    const candidates = catalog.filter(i => (!slot || i.slot === slot) && norm(baseName(i.name)) === norm(baseName(name)));
    if (candidates.length === 1) return candidates[0];
    const icons = candidates.filter(i => i.icon && i.icon === icon);
    return icons.length === 1 ? icons[0] : null;
  }
  function chestCardIdentity(name, sub, icon, catalog = [], registry = {}, native = null) {
    if (native && Object.hasOwn(SLOT_NAMES, native.slot) && typeof native.item === 'string' && /^[a-z][\w.-]{0,99}$/i.test(native.item)) {
      return { slot: native.slot, id: native.item, identitySource: 'native' };
    }
    let slot = Object.entries(SLOT_ALIASES).find(([key, aliases]) => [key, ...aliases].some(label => norm(label) === norm(sub)))?.[0] || '';
    const item = resolveItem(name, slot, icon, catalog);
    if (item && Object.hasOwn(SLOT_NAMES, item.slot)) return { slot: item.slot, id: item.id, identitySource: 'catalog' };
    if (slot === 'deity' || !slot && /(?:Deity|神格)\s*(?:\+\s*\d+)?$/i.test(name)) {
      const id = skillId(baseName(name).replace(/\s*(?:Deity|神格)$/i, ''), registry);
      if (id) return { slot: 'deity', id, identitySource: 'skill' };
    }
    return { slot, id: '', identitySource: slot ? 'label' : 'unknown' };
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
    const fixed = [...new Set(['first', 'second', 'third'].map((key, i) => cfg[key] === undefined ? FIXED[i] : cfg[key]).filter(Boolean).map(v => skillId(v, registry) || v))];
    const extras = owned.filter(id => !fixed.includes(id));
    const limit = Math.max(1, Math.min(5, Number(cfg.skillSlots) || 4));
    const configured = [cfg.fourth, ...(limit === 5 ? [cfg.fifth] : [])].filter(Boolean).map(v => skillId(v, registry) || v);
    const wanted = configured.filter(id => !owned.includes(id) && !fixed.includes(id));
    const eligible = cards.filter(c => {
      if (owned.includes(c.id)) return true;
      if (owned.length >= limit) return false;
      if (fixed.includes(c.id)) return true;
      if (extras.length >= limit - fixed.length) return false;
      return wanted.length ? wanted.includes(c.id) : c.isNew && !!c.id && c.id !== 'potion';
    });
    const ranked = eligible.map(c => {
      const pref = !c.isNew && FIXED.includes(c.id) ? upgradeOf(c.lines) : 0;
      return { ...c, pref, targetUpgrade: !c.isNew && pref === 3 };
    });
    ranked.sort((a, b) => {
      const order = cfg.rarityFirst ? [b.rarity - a.rarity, b.pref - a.pref] : [b.pref - a.pref, b.rarity - a.rarity];
      return Number(b.targetUpgrade) - Number(a.targetUpgrade) || order.find(Boolean) || Number(fixed.includes(b.id)) - Number(fixed.includes(a.id)) || a.index - b.index;
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
  function pickupTargets(pickups, player, zeny, cost, cfg, enemies = [], magnetDue = null, { waitForChests = false, waitForXp = false, victory = false } = {}) {
    const candidates = pickups.filter(p => {
      if (p.dead || p.magnet || !Number.isFinite(p.x) || !Number.isFinite(p.y)) return false;
      // 原生尾王拾取倒數期間會拒絕開箱。
      if (p.kind === 'chest') return !victory && !waitForChests && cfg.chestHunt && zeny >= cost;
      if (waitForXp && /^gem_(blue|yellow|red)$/.test(p.kind)) return false;
      if (p.kind === 'magnet' && magnetDue === false) return false;
      return (cfg.pickups || victory) && /^(gem_blue|gem_yellow|gem_red|zeny|loot|card|egg|meat|magnet)$/.test(p.kind);
    }).map(p => ({ pickup: p, x: p.x, y: p.y + 20, distance: Math.hypot(p.x - player.x, p.y + 20 - player.y),
      priority: p.kind === 'magnet' && magnetDue === true ? -1 : victory && /^(loot|card|egg)$/.test(p.kind) ? 0 : pickupPriority(p.kind) }))
      .filter(t => t.priority === -1 || t.distance < (t.pickup.kind === 'chest' ? cfg.chestRange : cfg.lootRange))
      .sort((a, b) => a.distance - b.distance);
    // 分別保留高優先級與一般目標，避免大量近距離寶石擠掉較遠的寶箱／磁鐵。
    return (magnetDue === true ? [-1, 0, 1] : [0, 1]).flatMap(priority => candidates.filter(t => t.priority === priority).slice(0, 40)).map(t => {
      const danger = enemies.reduce((sum, e) => sum + Math.max(0, cfg.safety + (e.radius || 18) - Math.hypot(t.x - e.x, t.y - e.y)) ** 2 * 12, 0);
      return { ...t, danger, score: t.distance + danger };
    }).sort((a, b) => Number(a.danger > 0) - Number(b.danger > 0) || (a.danger > 0 ? a.danger - b.danger : 0) || a.priority - b.priority || a.distance - b.distance);
  }
  function chestItem(id, slot, catalog, extra = {}) {
    const found = catalog.find(item => item.slot === slot && item.id === id);
    return { ...extra, ...found, id, slot, name: found?.name || extra.name || ITEM_NAMES[id] || (slot === 'deity' && SKILL_NAMES[id] ? `${SKILL_NAMES[id]} 神格` : id) };
  }
  function deityListTier(card, value) {
    if (card.slot !== 'deity') return 1000;
    const bare = { ...card, name: baseName(card.name).replace(/\s*(?:Deity|神格)$/i, '') };
    const tier = splitTiers(value).findIndex(group => group.some(token => matchToken(token, card) || matchToken(token, bare)));
    return tier < 0 ? 1000 : tier;
  }
  function protectsDeity(card, cfg, owned, catalog = []) {
    const current = owned?.deity;
    if (!cfg.deityOverrideEnabled || card.slot !== 'deity' || !current?.item || card.id === current.item) return false;
    const tier = deityListTier(chestItem(current.item, 'deity', catalog, current), cfg.deityOverrides);
    return tier < 1000 && deityListTier(card, cfg.deityOverrides) >= tier;
  }
  function deityBanishCandidate(cards, cfg, owned = null, context = {}) {
    if (!cfg.deityBanishAfterPick || Number.isFinite(context.banishLeft) && context.banishLeft <= 0) return null;
    const seen = new Set(context.acquiredDeities || []);
    if (owned?.deity?.item) seen.add(owned.deity.item);
    const specified = splitTiers(cfg.deityBanishTargets).length > 0;
    return cards.find(card => card.slot === 'deity' && card.id && card.canBanish && seen.has(card.id)
      && (specified ? deityListTier(card, cfg.deityBanishTargets) < 1000 : context.skillDeities?.includes(card.id))) || null;
  }
  function deityOverrideCandidate(cards, cfg, owned = null, context = {}, catalog = []) {
    if (!cfg.deityOverrideEnabled || !splitTiers(cfg.deityOverrides).length) return null;
    return cards.filter(card => card.slot === 'deity' && card.id && deityListTier(card, cfg.deityOverrides) < 1000
      && !(owned?.deity?.item && owned.deity.item !== card.id && context.swapDeity === false)
      && !protectsDeity(card, cfg, owned, catalog))
      .sort((a, b) => deityListTier(a, cfg.deityOverrides) - deityListTier(b, cfg.deityOverrides)
        || Number(owned?.deity?.item !== a.id) - Number(owned?.deity?.item !== b.id) || b.rarity - a.rarity || a.index - b.index)[0] || null;
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
    return cards.filter(card => !protectsDeity(card, cfg, owned, catalog)).map(card => ({ ...card, tier: tierOf(card, cfg) })).sort((a, b) =>
      a.tier - b.tier || chestNeed(a.slot, cfg, owned, catalog) - chestNeed(b.slot, cfg, owned, catalog)
      || loss(a) - loss(b) || level(a) - level(b) || b.rarity - a.rarity || a.index - b.index);
  }
  function chestTargets(cfg, catalog = [], owned = null, context = {}) {
    return Object.keys(SLOT_NAMES).flatMap(slot => {
      if (!splitTiers(cfg.priorities[slot]).length) return [];
      if (slot === 'deity' && cfg.deityOverrideEnabled && owned?.deity?.item
        && deityListTier(chestItem(owned.deity.item, slot, catalog), cfg.deityOverrides) < 1000) return [];
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
        .filter(item => tierOf(item, cfg) === 0 && !protectsDeity(item, cfg, owned, catalog)) : [];
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
    const banished = deityBanishCandidate(cards, cfg, owned, context);
    if (banished) return { type: 'banish', card: banished, reason: '本局已選過此神格，再次出現時放逐寶箱牌；保留目前神格，不放逐技能升級' };
    const override = deityOverrideCandidate(cards, cfg, owned, context, catalog);
    if (override) return { type: 'pick', card: override, reason: owned?.deity?.item && owned.deity.item !== override.id
      ? '指定神格優先覆蓋，高於寶箱第一優先級；按原生流程確認替換，原神格累計等級會失去' : '選取指定神格，高於寶箱第一優先級' };
    const ranked = rankChest(cards, cfg, owned, catalog);
    const configured = Object.values(cfg.priorities).some(x => splitTiers(x).length);
    if (!ranked.length) return { type: 'wait', reason: cards.length ? '保護已選定的指定神格，不回換同級或較低優先級神格；等待手動選擇' : '沒有可識別卡片' };
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
  function townDirection(target, player, tolerance = 18) {
    const dx = target.x - player.x, dy = target.y - player.y;
    return [Math.abs(dx) > tolerance ? dx > 0 ? 'ArrowRight' : 'ArrowLeft' : '', Math.abs(dy) > tolerance ? dy > 0 ? 'ArrowDown' : 'ArrowUp' : ''].filter(Boolean);
  }
  function townWorldPlan(player, target, yaw) {
    if (![player?.x,player?.y,target?.x,target?.y,yaw].every(Number.isFinite)) return null;
    const dx = target.x - player.x, dy = target.y - player.y, distance = Math.hypot(dx,dy);
    const x = dx * Math.cos(yaw) - dy * Math.sin(yaw), y = dx * Math.sin(yaw) + dy * Math.cos(yaw);
    const limit = distance * .38;
    const keys = distance < .5 ? [] : [Math.abs(x) > limit ? x > 0 ? 'ArrowRight' : 'ArrowLeft' : '', Math.abs(y) > limit ? y > 0 ? 'ArrowDown' : 'ArrowUp' : ''].filter(Boolean);
    return { distance, keys, duration: distance < 220 ? 35 : distance < 500 ? 70 : 140 };
  }
  function townNpcPositions(layer, sheets) {
    const positions = {};
    for (const [kind,id] of [['captain','npc_knight'],['vendor','npc_vendor']]) {
      const sheet = sheets?.get?.(id);
      if (!sheet) continue;
      const matches = (layer?.children || []).filter(view => view?.children?.some(sprite => sprite.sheet === sheet) && Number.isFinite(view.x) && Number.isFinite(view.y));
      if (matches.length === 1) positions[kind] = { x:matches[0].x, y:matches[0].y };
    }
    return positions;
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
  function chestTotalLevels(owned) {
    if (owned === null || owned === undefined) return null;
    let total = 0;
    for (const slot of Object.keys(SLOT_NAMES)) {
      if (!owned[slot]) continue;
      const level = owned[slot].level;
      if (!Number.isInteger(level) || level < 1) return null;
      total += level;
    }
    return total;
  }
  function levelSavePolicy(kind, config, levels = {}) {
    const enabled = kind === 'skill' ? config.skillLevelGate : config.chestLevelGate;
    if (!enabled) return undefined;
    const value = kind === 'skill' ? levels.role : levels.chest;
    return !Number.isInteger(value) || value < (kind === 'skill' ? 1 : 0) ? null : value >= (kind === 'skill' ? config.skillSaveAtLevel : config.chestSaveAtTotal);
  }
  function storedKindAllowed(kind, config, mode = config.storedOpenMode, levels = {}, manual = false) {
    if (kind !== 'skill' && kind !== 'chest' || !(kind === 'skill' ? config.skills : config.chests)) return false;
    const policy = manual ? undefined : levelSavePolicy(kind, config, levels);
    return policy === undefined ? (kind === 'skill' ? ['skills','both'] : ['chests','both']).includes(mode) : policy === false;
  }
  function storedCounts(game, currentKind = '') {
    return { skill: Math.max(0, Math.floor(Number(game?.pendingLevelUps) || 0)),
      chest: Math.max(0, Math.floor(Number(game?.roChests) || 0)) + (game?.roChestKeep ? 1 : 0) + (game?.state === 'levelup' && currentKind === 'chest' ? 1 : 0) };
  }
  function validateConfig(raw, includeProfiles = true) {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw new Error('設定必須是 JSON 物件');
    const out = JSON.parse(JSON.stringify(DEFAULTS));
    for (const key of ['enabled', 'skills', 'dodge', 'bellShelter', 'chests', 'chestHunt', 'pickups', 'background', 'autoDoubleSpeed', 'rarityFirst', 'skillReroll', 'chestReroll', 'chestFillFirst', 'chestSmartReroll', 'deityOverrideEnabled', 'deityBanishAfterPick', 'skillLevelGate', 'chestLevelGate', 'autoEquip', 'autoSell', 'banish', 'banishBasic', 'banishExcludeEnabled', 'repeat', 'progression', 'timedExitEnabled', 'deathMailEnabled']) if (typeof raw[key] === 'boolean') out[key] = raw[key];
    for (const key of ['deityOverrides', 'deityBanishTargets']) if (typeof raw[key] === 'string') out[key] = raw[key].slice(0, 5000);
    if (Number.isInteger(Number(raw.expeditionLap)) && Number(raw.expeditionLap) >= 1 && Number(raw.expeditionLap) <= 99) out.expeditionLap = Number(raw.expeditionLap);
    for (const key of ['skillSaveAtLevel','chestSaveAtTotal']) if (Number.isFinite(Number(raw[key]))) out[key] = clamp(Math.round(Number(raw[key])), 1, 99999);
    if (Array.isArray(raw.sellQualities)) out.sellQualities = [...new Set(raw.sellQualities.filter(q => Number.isInteger(q) && q >= 0 && q <= 4))].sort();
    for (const key of ['first', 'second', 'third', 'fourth', 'fifth']) if (typeof raw[key] === 'string') out[key] = raw[key].slice(0, 100).trim();
    if (Number.isFinite(Number(raw.timedExitMinutes))) out.timedExitMinutes = clamp(Math.round(Number(raw.timedExitMinutes) * 10) / 10, .1, 180);
    if (Number.isFinite(Number(raw.cleanupSeconds))) out.cleanupSeconds = clamp(Math.round(Number(raw.cleanupSeconds)), 0, 120);
    if (out.timedExitEnabled) out.progression = false;
    if ([4, 5].includes(Number(raw.skillSlots))) out.skillSlots = Number(raw.skillSlots);
    if (includeProfiles && typeof raw.chestHunt !== 'boolean' && typeof raw.chests === 'boolean') out.chestHunt = raw.chests;
    if (typeof raw.expedition === 'string') out.expedition = raw.expedition.slice(0, 150);
    if (Array.isArray(raw.banishExclude)) out.banishExclude = [...new Set(raw.banishExclude.filter(v => typeof v === 'string' && /^[\w.-]{1,100}$/.test(v)))].slice(0, 500);
    if (['greed', 'need', 'pass', 'manual'].includes(raw.partyRoll)) out.partyRoll = raw.partyRoll;
    if (['manual', 'later', 'reload'].includes(raw.gameUpdateAction)) out.gameUpdateAction = raw.gameUpdateAction;
    if (['manual', 'skills', 'chests', 'both'].includes(raw.storedOpenMode)) out.storedOpenMode = raw.storedOpenMode;
    if (['card-deck', 'deck-card', 'card', 'deck', 'off'].includes(raw.rerollMode)) out.rerollMode = raw.rerollMode;
    if (['best', 'wait'].includes(raw.exhausted)) out.exhausted = raw.exhausted;
    for (const [key, lo, hi] of [['maxRerolls', 0, 50], ['reserveCard', 0, 99], ['reserveDeck', 0, 99], ['delay', 850, 5000], ['safety', 25, 200], ['chestRange', 100, 12000], ['lootRange', 100, 12000], ['magnetInterval', 0, 600], ['stopChestPickupAtTotal', 0, 99999], ['stopXpPickupAtLevel', 0, 99999], ['deathMailDigestMinutes', 0, 1440], ['repeatLimit', 0, 9999], ['repeatDelay', 1500, 60000]]) {
      if (Number.isFinite(Number(raw[key]))) out[key] = clamp(Math.round(Number(raw[key])), lo, hi);
    }
    for (const slot of Object.keys(SLOT_NAMES)) if (typeof raw.priorities?.[slot] === 'string') out.priorities[slot] = raw.priorities[slot].slice(0, 5000);
    if (includeProfiles) {
      if (typeof raw.profileJob === 'string' && /^[a-z][a-z0-9_]{0,59}$/.test(raw.profileJob)) out.profileJob = raw.profileJob;
      if (raw.jobProfiles && typeof raw.jobProfiles === 'object' && !Array.isArray(raw.jobProfiles)) for (const [id, profile] of Object.entries(raw.jobProfiles).slice(0, 100)) {
        if (!/^[a-z][a-z0-9_]{0,59}$/.test(id) || !profile || typeof profile !== 'object' || Array.isArray(profile)) continue;
        out.jobProfiles[id] = { ...profileSettings(validateConfig(profile, false)), label: typeof profile.label === 'string' ? profile.label.slice(0, 100) : id };
      }
    }
    return out;
  }
  function restoreConfig(raw) {
    const config = validateConfig(raw);
    const { profileJob: oldJob, jobProfiles } = config;
    jobProfiles.shared ??= { ...profileSettings(oldJob ? DEFAULTS : config), label: '舊版共用備份' };
    if (oldJob && oldJob !== 'shared' && !Object.hasOwn(jobProfiles, oldJob)) {
      jobProfiles[oldJob] = { ...profileSettings(config), label: oldJob };
    }
    const activeJob = baseJobId(oldJob) || 'mage';
    // 先採現有基礎檔案；缺少時以舊版正在編輯的職業優先，其餘仍可由匯出保留。
    for (const id of new Set([oldJob, ...Object.keys(jobProfiles)])) {
      const base = baseJobId(id);
      if (base && !Object.hasOwn(jobProfiles, base)) {
        jobProfiles[base] = { ...profileSettings(jobProfiles[id]), label: BASE_JOB_NAMES[base] };
      }
    }
    jobProfiles[activeJob] ??= { ...profileSettings(jobProfiles.shared), label: BASE_JOB_NAMES[activeJob] };
    const activeProfile = jobProfiles[activeJob];
    // 匯入舊版或使用者手改的 JSON 時，保留作用中基礎職業明確給出的頂層設定。
    if (oldJob === activeJob) {
      for (const key of PROFILE_KEYS) if (Object.hasOwn(raw, key)) activeProfile[key] = config[key];
    }
    return { ...config, ...profileSettings(activeProfile), profileJob: activeJob };
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
  function gearOnlyBlocked(failedRequirements) {
    return failedRequirements.length > 0 && failedRequirements.every(t => /gear\s*score|裝備(?:分數|評分)|装备(?:分数|评分)/i.test(t));
  }
  const timedExitDue = (game, config) => !!(config.timedExitEnabled && !config.progression && game && !game.coop && !game.endless && !game.story && !game.isStory && !game.replayMoves
    && game.stageId === config.expedition && Number(game.difficulty?.lap || 1) === config.expeditionLap
    && ['playing', 'levelup', 'reveal'].includes(game.state) && !game.player?.dead && Number.isFinite(game.time) && game.time >= config.timedExitMinutes * 60);
  function chooseFarmStage(stages, targetId, preferredId) {
    const index = targetId === null ? stages.length : stages.findIndex(s => s.id === targetId);
    if (index < 0) return null;
    const eligible = stages.slice(0, index).filter(s => s.cleared === true && !s.locked && !s.storyOnly);
    return eligible.find(s => s.id === preferredId) || eligible.at(-1) || null;
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
    const magnet = target && scene.prioritizeMagnet;
    if (target && goalDistance > 0) candidates.push({ dx: (goal.x - p.x) / goalDistance, dy: (goal.y - p.y) / goalDistance, cap: goalDistance });
    let best = null;
    for (const c of candidates) {
      let risk = 0, minClear = 1e6, valid = true, unsafe = false;
      const travelLimit = magnet ? Math.min(c.cap ?? Infinity, goalDistance) : c.cap ?? Infinity;
      let last = p;
      for (let j = 1; j <= 6; j++) {
        const t = j / 6 * horizon, travel = Math.min(speed * t, travelLimit), x = p.x + c.dx * travel, y = p.y + c.dy * travel;
        if (b && (x < b.x0 + 6 || x > b.x1 - 6 || y < b.y0 + 6 || y > b.y1 - 6) || walkable && !walkable(last.x, last.y, x, y)) { valid = false; break; }
        if (sheltered && Math.hypot(x - shelter.x, y - shelter.y) > shelter.radius) { valid = false; break; }
        for (const e of enemies) {
          const ex = e.x + (e.vx || 0) * t, ey = e.y + (e.vy || 0) * t;
          const clear = Math.hypot(x - ex, y - ey) - (e.radius || 18) - 12;
          minClear = Math.min(minClear, clear);
          risk += Math.max(0, cfg.safety - clear) ** 2 / (j + 2);
          // 採樣間的近身穿越也有代價。
          if (pointSegmentDistance(ex, ey, last.x, last.y, x, y) < (e.radius || 18) + 12) {
            risk += 20000; unsafe = true;
          }
        }
        for (const z of zones) if (insideZone(x, y, z)) { risk += 60000; unsafe = true; }
        last = { x, y };
      }
      if (!valid) continue;
      const distance = Math.hypot(last.x - goal.x, last.y - goal.y);
      // 磁鐵優先推進，同時排除會撞怪或進入傷害預警的路線。
      if (magnet && (unsafe || distance >= goalDistance - .5)) continue;
      const inertia = scene.previous ? c.dx * scene.previous.dx + c.dy * scene.previous.dy : 0;
      const score = magnet ? distance + risk * .2 - inertia * 2
        : shelter && !sheltered ? Math.min(150000, risk * 10) + distance * 10000 - inertia * 6
        : risk * 10 + distance * .35 - Math.min(180, minClear) * .2 - inertia * 6;
      if (!best || score < best.score) best = { ...c, x: last.x, y: last.y, score, risk };
    }
    return best;
  }
  const core = { VERSION, DEFAULTS, FIXED, BASIC_ANY, STAGES, LAP_LABELS, LAP_SUFFIXES, PROFILE_KEYS, profileSettings, gameJobId, gameBaseJobId, restoreConfig, timedExitDue, EMAILJS_ENDPOINT, MAIL_DEFAULTS, normalizeMailSettings, mailSettingsError, isExpeditionDeath, deathMailEvent, emailjsPayload, BACKGROUND_WORKER_SOURCE, needsBackgroundClock, clampPanelPosition, norm, baseName, tokenId, splitTiers, matchToken, tierOf, rarityOf, resolveItem, chestCardIdentity, upgradeOf, skillId, chooseSkill, banishCandidate, displayPriority, appendPriorityTier, pickupPriority, pickupTargets, chestFilledSlots, rankChest, chestTargets, deityListTier, protectsDeity, deityBanishCandidate, deityOverrideCandidate, chestDecision, validateConfig, nextExpedition, gearOnlyBlocked, chooseFarmStage, pointSegmentDistance, insideZone, readBellShelters, chooseBellShelter, planMove, townDirection, totalSkillLevels, chestTotalLevels, levelSavePolicy, townWorldPlan, townNpcPositions, storedKindAllowed, storedCounts };
  if (typeof module === 'object' && module.exports) { module.exports = core; return; }
  if (typeof window === 'undefined' || window.top !== window.self) return;
  if (window.__RO_SURVIVORS_HELPER__) return;

  const STORAGE = 'ro-survivors-helper.settings.v1';
  const MAIL_STORAGE = 'ro-survivors-helper.emailjs.v1';
  const MAIL_DIGEST_STORAGE = 'ro-survivors-helper.mail-digest.v1';
  const MAIL_DIGEST_LIMIT = 40;
  const POSITION_STORAGE = 'ro-survivors-helper.panel-position.v1';
  let cfg = restoreConfig(DEFAULTS);
  try { const saved = localStorage.getItem(STORAGE); if (saved) cfg = restoreConfig(JSON.parse(saved)); } catch (error) { console.warn('[RO助手] 設定讀取失敗', error); }
  let mailSettings = { ...MAIL_DEFAULTS };
  try { mailSettings = normalizeMailSettings(JSON.parse(localStorage.getItem(MAIL_STORAGE) || '{}')); } catch { /* 通知設定無效時等待重新填寫 */ }
  const state = {
    game: null, registry: {}, itemRegistry: {}, catalog: [], hooks: null, assets: null, attaching: false,
    bridge: '等待遊戲模組', message: '已暫停；開啟面板後按「啟動」', logs: [],
    pickerNode: null, pickerType: '', chestToken: null, born: 0, used: 0, pending: null, skillUsed: 0,
    manualUntil: 0, moveOwned: false, previous: null, velocities: new WeakMap(),
    lastMove: 0, lastGameTime: 0, errorCount: 0, zones: new Set(), observedGame: null,
    route: null, magnetRoutes: new WeakMap(), bell: null, bellRoute: null, bellStatus: '尚無鐘罩機制',
    stages: [], laps: [], stageChapter: 1, stageLap: 1,
    stageCatalog: new Map(STAGES.map(([id, name]) => [id, { id, name, chapter: stageChapter(id) }])),
    progressionStatus: '從所選地圖開始，已通關則自動推進', expeditionProbe: null, farmPlan: null, flow: null, gameoverAt: null, runsStarted: 0, launchPending: false, launchStage: '', launchLap: 0,
    revealNode: null, revealAt: 0, revealClicked: false, lastListRead: 0,
    settings: null, autoPauseOriginal: null, clockWorker: null, clockFallback: null, clockRunning: false,
    clockTicker: null, clockTickerWasRunning: false, backgroundLastLogic: 0, backgroundStatus: '前台', resumeAfterVisibility: false,
    panelDrag: null, suppressMiniClickUntil: 0,
    postRun: null, finishedGame: null, townKeys: [], townPulse: null, townDispatch: false, npcApproach: null, nativeDispatch: false,
    townWorldViews: new WeakMap(), townWorldHooks: new WeakSet(), townScene: null, townCamera: null, townBridge: '等待原生廣場場景',
    speedDone: false, speedApplied: false, speedAttempted: false, speedAttemptAt: 0, speedStatus: '等待進入單人遠征',
    runJob: '', versionDialogs: new WeakSet(), lastVersionReloadAt: 0, timedExit: null, magnets: [], lastMagnetAt: 0, magnetsCollected: 0, magnetStatus: '',
    deitySeen: new WeakMap(),
    offerBooks: new WeakMap(), activeOffer: null, savedBatch: null, savedHold: false, savedOpenAt: -Infinity, manualSelection: null,
    mailSeen: new WeakSet(), mailQueue: [], mailDigest: null, mailBusy: false, mailNextAt: 0, mailStatus: '尚未發送郵件', mailAccepted: 0,
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
    const id = cfg.profileJob;
    cfg.jobProfiles[id] = { ...profileSettings(cfg), label: BASE_JOB_NAMES[id] };
    try { localStorage.setItem(STORAGE, JSON.stringify(cfg)); } catch { log('設定無法儲存；請檢查瀏覽器儲存空間'); }
  }
  function populateMailSettings() {
    for (const input of ui.querySelectorAll('[data-mail]')) input.value = mailSettings[input.dataset.mail] || '';
  }
  function saveMailDigest(digest) {
    state.mailDigest = digest;
    try {
      if (digest) sessionStorage.setItem(MAIL_DIGEST_STORAGE, JSON.stringify(digest));
      else sessionStorage.removeItem(MAIL_DIGEST_STORAGE);
    } catch { /* 瀏覽器未提供分頁儲存時，仍可在本頁彙總。 */ }
  }
  if (cfg.deathMailEnabled && !mailSettingsError(mailSettings)) {
    try {
      const stored = JSON.parse(sessionStorage.getItem(MAIL_DIGEST_STORAGE));
      if (Number.isFinite(stored?.startedAt) && Number.isSafeInteger(stored.count) && stored.count > 0 &&
          Array.isArray(stored.messages) && stored.messages.length && stored.messages.length <= Math.min(stored.count, MAIL_DIGEST_LIMIT) &&
          stored.messages.every(message => typeof message === 'string' && message.length <= 300)) state.mailDigest = stored;
    } catch { /* 無法讀取時從下一筆死亡開始彙總。 */ }
  }
  const mailDigestRemaining = (now, digest) => Math.max(0, digest.startedAt + cfg.deathMailDigestMinutes * 60000 - (performance.timeOrigin + now));
  function renderMailStatus() {
    if (!ui) return;
    const error = mailSettingsError(mailSettings);
    const digest = state.mailDigest;
    const minutes = digest ? Math.ceil(mailDigestRemaining(performance.now(), digest) / 60000) : 0;
    const pending = cfg.deathMailEnabled && digest ? ` · 已累積 ${digest.count} 筆 · ${minutes ? `約 ${minutes} 分鐘後寄出` : '已到寄送時間'}` : '';
    ui.querySelector('#mail-status').textContent = `${cfg.deathMailEnabled ? '死亡提醒已開啟（不依賴助手啟動）' : '死亡提醒未開啟'} · ${error || state.mailStatus}${state.mailQueue.length ? ` · 排隊 ${state.mailQueue.length}` : ''}${pending}`;
    ui.querySelector('#mail-test').disabled = !!error || state.mailBusy || state.mailQueue.length > 0;
    ui.querySelector('#mail-save').disabled = state.mailBusy;
    ui.querySelector('#mail-clear').disabled = state.mailBusy;
  }
  function queueMail(kind, event) {
    const error = mailSettingsError(mailSettings);
    if (error) { state.mailStatus = error; renderMailStatus(); return false; }
    if (state.mailQueue.length >= 10) { state.mailStatus = '郵件排隊已滿，本次未發送'; renderMailStatus(); return false; }
    state.mailQueue.push({ kind, event, settings: { ...mailSettings } });
    state.mailStatus = kind === 'test' ? '測試郵件已排隊' : '本局死亡通知已排隊';
    renderMailStatus(); return true;
  }
  function maybeQueueDeath(game) {
    if (!cfg.deathMailEnabled || window.RO_DEAD || $('#ro-tab-dead') || !isExpeditionDeath(game) || state.mailSeen.has(game)
      || !visible($('#hud')) && !visible($('#gameover'))) return;
    if (mailSettingsError(mailSettings)) { state.mailStatus = '本局死亡，但 EmailJS 通知設定未完成'; return; }
    state.mailSeen.add(game);
    const event = deathMailEvent(game, new Date().toLocaleString('zh-TW', { hour12: false }));
    if (!cfg.deathMailDigestMinutes && !state.mailDigest) { queueMail('death', event); return; }
    const digest = state.mailDigest || { startedAt: performance.timeOrigin + performance.now(), count: 0, messages: [] };
    digest.count++;
    digest.messages.push(event.message.slice(0, 300));
    if (digest.messages.length > MAIL_DIGEST_LIMIT) digest.messages.shift();
    saveMailDigest(digest);
    renderMailStatus();
  }
  async function deliverMail(job) {
    state.mailBusy = true; state.mailNextAt = performance.now() + 1100;
    const label = job.kind === 'test' ? '測試郵件' : job.kind === 'digest' ? '死亡通知摘要' : '死亡通知';
    state.mailStatus = `正在發送${label}`; renderMailStatus();
    const controller = new AbortController(), timeout = setTimeout(() => controller.abort(), 15000);
    try {
      const response = await fetch(EMAILJS_ENDPOINT, { method: 'POST', mode: 'cors', credentials: 'omit', cache: 'no-store', referrerPolicy: 'no-referrer',
        headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(emailjsPayload(job.settings, job.event)), signal: controller.signal });
      if (!response.ok) throw { status: Number(response.status) };
      state.mailAccepted++;
      state.mailStatus = job.kind === 'test' ? 'EmailJS 已接受測試郵件，請檢查收件箱' : job.kind === 'digest'
        ? `EmailJS 已接受死亡通知摘要（${job.event.death_count} 筆）` : `EmailJS 已接受${job.event.stage}第 ${job.event.lap} 周目的死亡通知`;
      log(state.mailStatus);
    } catch (error) {
      const reason = error?.status === 429 ? 'HTTP 429，請檢查 EmailJS 頻率／配額' : Number.isInteger(error?.status) ? `HTTP ${error.status}，請檢查 EmailJS 服務、模板和授權`
        : controller.signal.aborted ? '請求逾時，發送結果未確認' : '網路錯誤，發送結果未確認';
      // 逾時仍可能已被服務接受，因此不盲目重發同一局。
      state.mailStatus = `${label}未確認成功：${reason}；本次不自動重發`;
      log(state.mailStatus);
    } finally {
      clearTimeout(timeout); state.mailBusy = false; state.mailNextAt = performance.now() + 1100; renderMailStatus();
    }
  }
  function deathMailStep(now) {
    try {
      maybeQueueDeath(state.game);
      while (state.mailQueue.length && state.mailQueue[0].kind === 'death' && (!cfg.deathMailEnabled || window.RO_DEAD || $('#ro-tab-dead'))) state.mailQueue.shift();
      if (!cfg.deathMailEnabled && state.mailDigest) saveMailDigest(null);
      if (state.mailBusy || now < state.mailNextAt) return;
      if (state.mailQueue.length) { void deliverMail(state.mailQueue.shift()); return; }
      const digest = state.mailDigest;
      if (!digest || mailDigestRemaining(now, digest) > 0 || window.RO_DEAD || $('#ro-tab-dead') || mailSettingsError(mailSettings)) return;
      const omitted = digest.count - digest.messages.length;
      const header = `本批單人遠征死亡 ${digest.count} 次。${omitted ? `以下列出最近 ${digest.messages.length} 次。` : ''}`;
      const details = digest.messages.map((message, i) => `第 ${omitted + i + 1} 筆\n${message}`);
      saveMailDigest(null);
      void deliverMail({ kind: 'digest', settings: { ...mailSettings }, event: {
        title: 'ro.hans幸存者助手：遠征死亡摘要', death_count: digest.count, message: [header, ...details].join('\n\n'),
      } });
    } catch { state.mailStatus = '郵件通知檢查失敗，其他自動功能照常運行'; }
  }
  function renderProfiles() {
    if (!ui) return;
    const select = ui.querySelector('#job-profile');
    if (!select.options.length) select.innerHTML = Object.entries(BASE_JOB_NAMES).map(([id, name]) => `<option value="${id}">${name} [${id}]</option>`).join('');
    select.value = cfg.profileJob;
  }
  function switchProfile(id) {
    if (!Object.hasOwn(BASE_JOB_NAMES, id)) return;
    save();
    cfg.jobProfiles[id] ??= { ...(id === 'mage' ? profileSettings(cfg.jobProfiles.shared)
      : { ...profileSettings(DEFAULTS), first: '', second: '', third: '' }), label: BASE_JOB_NAMES[id] };
    cfg = validateConfig({ ...cfg, ...profileSettings(cfg.jobProfiles[id]), profileJob: id });
    save(); resetPicker(); state.savedBatch = null; state.savedHold = false; populate();
  }
  function syncProfile(game) {
    const id = gameBaseJobId(game);
    if (id && cfg.profileJob !== id) { switchProfile(id); log(`已載入基礎職業配置：${BASE_JOB_NAMES[id]} [${id}]`); }
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
    cfg.enabled = !cfg.enabled;
    if (cfg.enabled && state.game && state.game.state !== 'over' && (visible($('#hud')) || visible($('#picker')))) syncProfile(state.game);
    save();
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
      if (typeof def?.create === 'function' && !id.startsWith('atk_')) items.push({ id, slot: 'deity', skillDeity: true, name: `${def.name} Deity`, available: learned.includes(id), icon: abs(state.assets?.icons?.get(def.icon)) });
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
      for (const key of ['first', 'second', 'third', 'fourth', 'fifth']) {
        const el = ui.querySelector(`[data-setting="${key}"]`), id = skillId(cfg[key], state.registry);
        if (id && el !== ui.activeElement) el.value = `${SKILL_NAMES[id] || state.registry[id]?.name || id} [${id}]`;
      }
      for (const select of ui.querySelectorAll('[data-deity-list]')) {
        const old = select.value;
        select.innerHTML = '<option value="">從神格表加入名單…</option>' + items.filter(item => item.slot === 'deity').map(item => `<option value="${esc(item.id)}">${esc(item.name.replace(/Deity/g, '神格'))} [${esc(item.id)}]${item.available === false ? '（本局未學）' : ''}</option>`).join('');
        select.value = old;
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
  function readChapterTabs() {
    return [...document.querySelectorAll('#ch-tabs button[data-chtab]')];
  }
  function readStages() {
    const laps = readLapTabs();
    const cards = [...document.querySelectorAll('#stg-list .stg-card')];
    if (cards.length) {
      const chapter = Number(readChapterTabs().find(tab => tab.classList.contains('primary'))?.dataset.chtab) || 1;
      const chapterSize = STAGES.filter(([id]) => stageChapter(id) === chapter).length;
      state.stageChapter = chapter;
      state.stageLap = laps.find(l => l.selected)?.lap || 1;
      state.laps = laps.map(({ tab, ...lap }) => lap);
      state.stages = cards.map(card => {
        const title = card.querySelector('.stg-card-info b')?.cloneNode(true);
        // 特殊地圖標記是標題內的子元素，不能把「特殊關卡」當作地圖名稱。
        if (title) for (const child of [...title.children]) child.remove();
        const name = (title?.textContent.trim() || text(card, '.stg-card-info b')).replace(/[・·]\s*改(?:[²³⁴⁵⁶⁷⁸⁹0-9]+)?\s*$/, ''), index = Number(card.dataset.i);
        const displayedName = norm(name);
        const byName = STAGES.find(([id, label], i) => stageChapter(id) === chapter && (norm(label) === displayedName || norm(STAGE_ALIASES[i]) === displayedName));
        const byIndex = STAGES[index];
        const id = card.dataset.stageId || card.dataset.stage || byName?.[0] ||
          (cards.length === chapterSize && byIndex && stageChapter(byIndex[0]) === chapter ? byIndex[0] : `name:${name}`);
        state.stageCatalog.set(id, { id, name, chapter });
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
      const currentStages = new Map(state.stages.map(stage => [stage.id, stage]));
      const options = [...state.stageCatalog.values()].map(stage => {
        const current = state.stageLap === cfg.expeditionLap && state.stageChapter === stage.chapter && currentStages.get(stage.id);
        return { ...stage, cleared: !!current?.cleared, locked: !!current?.locked };
      });
      const select = ui.querySelector('[data-setting="expedition"]');
      const signature = JSON.stringify(options);
      if (select.dataset.signature !== signature) {
        select.dataset.signature = signature;
        select.innerHTML = CHAPTER_LABELS.map((label, index) => `<optgroup label="${label}">${options.filter(stage => stage.chapter === index + 1)
          .map(stage => `<option value="${esc(stage.id)}">${esc(stage.name)}${stage.cleared ? ' ✓' : stage.locked ? '（未開放）' : ''}</option>`).join('')}</optgroup>`).join('');
      }
      if (![...select.options].some(o => o.value === cfg.expedition)) select.insertAdjacentHTML('beforeend', `<option value="${esc(cfg.expedition)}">${esc(cfg.expedition.replace(/^name:/, ''))}（等待確認）</option>`);
      select.value = cfg.expedition;
    }
    return cards;
  }
  function observeGame(g) {
    if (!g?.player || typeof g.moveTo !== 'function' || !Array.isArray(g.enemies)) return;
    maybeQueueDeath(g);
    rememberDeity(g);
    observeOffers(g);
    const job = gameBaseJobId(g);
    if (job && (state.game !== g || state.runJob !== job)) { state.runJob = job; syncProfile(g); }
    if (state.game === g) return;
    stopMove(); state.game = g; state.route = null; state.bell = null; state.bellRoute = null; state.bellStatus = '尚無鐘罩機制'; state.velocities = new WeakMap(); resetPicker();
    if (state.launchPending) { state.runsStarted++; log(`第 ${state.runsStarted} 次自動遠征已開始`); }
    state.launchPending = false; state.flow = null; state.gameoverAt = null;
    state.expeditionProbe = null; state.farmPlan = null;
    resetAutoSpeed();
    state.timedExit = null; state.savedBatch = null; state.savedHold = false; state.savedOpenAt = -Infinity; state.manualSelection = null;
    state.magnets = []; state.lastMagnetAt = 0; state.magnetsCollected = 0; state.magnetRoutes = new WeakMap(); state.magnetStatus = '';
    state.postRun = null; state.npcApproach = null; releaseTownKeys();
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
      installTownBridge(ns);
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
    let id = kind === 'skill' ? skillId(name, state.registry) : '', slot = '', identitySource = '';
    if (kind === 'chest') {
      const native = nativeSaveApi(), buttons = [...(button.closest('#picker')?.querySelectorAll('#pk-cards .pk-card') || [])];
      const current = native?.g === state.game && native.curT === 'chest' && Array.isArray(native.curK)
        && native.curK.length === buttons.length && buttons[index] === button ? native.curK[index] : null;
      ({ id, slot, identitySource } = chestCardIdentity(name, sub, button.querySelector('.pk-art img')?.src, state.catalog, state.registry, current));
    }
    const reroll = [...(slotEl?.querySelectorAll('.pk-act') || [])].find(b => /重抽|重擲|reroll/i.test(`${b.title} ${b.textContent}`) && !b.disabled);
    const banish = [...(slotEl?.querySelectorAll('.pk-act') || [])].find(b => /放逐|banish/i.test(`${b.title} ${b.textContent}`) && !b.disabled);
    return { index, name, id, slot, identitySource, sub, lines, rarity: rarityOf(badge), isNew: !!button.querySelector('.pk-ribbon') || /技能|habilidad|^skill$/i.test(badge), button, slotEl, reroll, canReroll: !!reroll, banish, canBanish: !!banish };
  }
  function deckButton(picker) {
    return [...picker.querySelectorAll('#pk-bar .pk-act')].find(b => /重抽|reroll/i.test(`${b.title} ${b.textContent}`) && !b.disabled);
  }
  function pickerKind(picker) {
    const native = nativeSaveApi();
    if (native?.g === state.game && state.game?.state === 'levelup') {
      if (native.curT === 'chest') return 'chest';
      if (native.curT === 'lv') return 'skill';
    }
    const title = text(picker, '#pk-title');
    if (/寶箱|宝箱|treasure chest|cofre del tesoro/i.test(title)) return 'chest';
    if (/升級|升级|level\s*up/i.test(title)) return 'skill';
    return '';
  }
  function resetPicker() {
    state.pickerNode = null; state.pickerType = ''; state.chestToken = null; state.pending = null; state.used = 0; state.skillUsed = 0; state.activeOffer = null;
  }
  function observeOffers(game) {
    if (state.offerBooks.has(game)) return;
    const book = { cards: new WeakMap(), active: null, activeCards: null };
    state.offerBooks.set(game, book);
    // 觀察原生新一輪事件；重抽重繪不經過這裡，保存後拿出同一組牌也沿用其計數。
    for (const [event, kind] of [['onLevelUp', 'skill'], ['onChest', 'chest']]) {
      const original = game.events?.[event];
      if (typeof original !== 'function') continue;
      game.events[event] = function (cards, ...args) {
        if (Array.isArray(cards)) {
          let offer = book.cards.get(cards);
          if (!offer) { offer = { kind, used: 0, skillUsed: 0 }; book.cards.set(cards, offer); }
          book.active = offer; book.activeCards = cards;
        }
        return original.call(this, cards, ...args);
      };
    }
    // 只觀察玩家／原生實際發起的重抽回傳值，不額外呼叫抽牌或推進亂數。
    for (const [method, kind] of [['rerollChest','chest'],['reroll','skill']]) {
      const original = game[method];
      if (typeof original !== 'function') continue;
      game[method] = function (...args) {
        const cards = original.apply(this, args);
        if (Array.isArray(cards) && book.active?.kind === kind) { book.activeCards = cards; book.cards.set(cards, book.active); }
        return cards;
      };
    }
  }
  function currentOffer(kind) {
    const g = state.game, native = nativeSaveApi(), book = g && state.offerBooks.get(g);
    if (!book || native?.g !== g || !Array.isArray(native.curK)) return null;
    let offer = book.cards.get(native.curK);
    if (!offer) {
      offer = book.active?.kind === kind ? book.active : { kind, used: 0, skillUsed: 0 };
      book.cards.set(native.curK, offer);
    }
    book.active = offer; return offer;
  }
  function rememberOfferRedraw(kind) {
    const native = nativeSaveApi(), book = state.game && state.offerBooks.get(state.game);
    if (state.activeOffer?.kind === kind && book?.active === state.activeOffer && native?.g === state.game && Array.isArray(native.curK)) book.cards.set(native.curK, state.activeOffer);
  }
  function nativeSaveApi() {
    const native = window.RO_SAVEUP;
    if (native && ['ok', 'prefLv', 'prefCh', 'setLv', 'setCh', 'openLv', 'openChest', 'keep', 'sync'].every(key => typeof native[key] === 'function')) return native;
    // RO_SAVEUP 是新版 ES 模組的區域變數；透過原生控制項及其事件委派操作。
    if (!$('#sv-check') || !$('#sv-check-ch') || !$('#sv-bar')) return null;
    const g = state.game, book = g && state.offerBooks.get(g);
    const pref = kind => {
      try { const value = localStorage.getItem(kind === 'chest' ? 'ro-hans.saveChest' : 'ro-hans.saveLv'); if (value !== null) return value === '1'; } catch {}
      return !!$(kind === 'chest' ? '#sv-check-ch' : '#sv-check')?.checked;
    };
    return { g, dom: true, ok: game => !!(game?.script?.bosses?.length && !game.isStory && !game.endless),
      get curT() { return g?.state === 'levelup' ? book?.active?.kind === 'chest' ? 'chest' : book?.active?.kind === 'skill' ? 'lv' : null : null; },
      get curK() { return book?.activeCards; },
      prefLv: () => pref('skill'), prefCh: () => pref('chest'),
      setLv: value => nativeSaveInput('skill', value), setCh: value => nativeSaveInput('chest', value),
      openLv: game => openNativeStored('skill', game), openChest: game => openNativeStored('chest', game), keep: () => nativeSavedAction('keep'), sync() {} };
  }
  function nativeSaveInput(kind, value) {
    const input = $(kind === 'chest' ? '#sv-check-ch' : '#sv-check');
    if (!input || input.disabled) return false;
    state.nativeDispatch = true;
    try { input.checked = value; input.dispatchEvent(new Event('change', { bubbles: true })); } finally { state.nativeDispatch = false; }
    return input.checked === value;
  }
  function nativeSavedAction(action) {
    const bar = $('#sv-bar');
    if (!bar || state.game?.state !== 'levelup' || $('#picker')?.classList.contains('closing')) return false;
    let button = bar.querySelector(`[data-t="${action}"]`), temporary = false;
    if (!button) { button = document.createElement('button'); button.type = 'button'; button.dataset.t = action; button.hidden = true; bar.appendChild(button); temporary = true; }
    if (button.disabled) return false;
    state.nativeDispatch = true;
    try { button.click(); } finally { state.nativeDispatch = false; if (temporary) button.remove(); }
    return true;
  }
  function openNativeStored(kind, game) {
    if (game !== state.game || game.state !== 'playing') return false;
    const button = $('#sv-open');
    if (!visible(button) || button.disabled) return false;
    state.nativeDispatch = true;
    try { button.click(); } finally { state.nativeDispatch = false; }
    const current = state.offerBooks.get(game)?.active?.kind;
    if (game.state === 'levelup' && current !== kind) nativeSavedAction(kind === 'skill' ? 'lv' : 'chest');
    return game.state === 'levelup' && state.offerBooks.get(game)?.active?.kind === kind;
  }
  function saveGameReady(native = nativeSaveApi()) {
    const g = state.game;
    return !!(native && g && native.g === g && native.ok(g) && !g.coop && !g.replayMoves && !g.player?.dead && g.lootUntil < 0
      && ['playing', 'levelup'].includes(g.state) && (!native.dom || visible($('#hud')) && !document.body.classList.contains('in-lobby')) && !window.RO_DEAD && !$('#ro-tab-dead'));
  }
  function setNativeSave(kind, value) {
    const native = nativeSaveApi();
    if (!native) return false;
    const input = $(kind === 'chest' ? '#sv-check-ch' : '#sv-check');
    if (input && !input.disabled) nativeSaveInput(kind, value);
    else { (kind === 'chest' ? native.setCh : native.setLv)(value); if (native.g) native.g.roOpening = false; native.sync(); }
    return (kind === 'chest' ? native.prefCh() : native.prefLv()) === value;
  }
  function openStored(kind, manual = false) {
    const native = nativeSaveApi(), g = state.game;
    if (!saveGameReady(native) || g.state !== 'playing' || visible($('#picker')) || visible($('#drop-reveal'))) return false;
    if (!storedCounts(g)[kind]) return false;
    const mode = manual ? (kind === 'skill' ? 'skills' : 'chests') : cfg.storedOpenMode;
    // 與原生 HUD 開啟相同的 UI 狀態；只呼叫所選類型的原生入口，不自行抽牌。
    g.roOpening = true; state.savedBatch = { game: g, mode, manual }; state.savedHold = false;
    const opened = kind === 'skill' ? native.openLv(g) : native.openChest(g);
    if (!opened) { g.roOpening = false; state.savedBatch = null; }
    native.sync(); state.savedOpenAt = performance.now();
    if (opened) log(`開啟已保存${kind === 'skill' ? '技能牌' : '寶箱'}；沿用原選牌與重抽配置`);
    return opened;
  }
  function storedStep(now) {
    const native = nativeSaveApi(), g = state.game;
    if (!saveGameReady(native)) { state.savedBatch = null; return false; }
    const levels = readSavingLevels();
    const batch = state.savedBatch;
    if (g.state === 'levelup' && batch?.game === g && visible($('#picker'))) {
      if ($('#picker').classList.contains('closing')) return false;
      const kind = pickerKind($('#picker'));
      if (kind && !storedKindAllowed(kind, cfg, batch.mode, levels, batch.manual)) {
        native.keep(); state.savedBatch = null; resetPicker(); log(`此輪不自動選${kind === 'skill' ? '技能牌' : '寶箱'}，已繼續保存`); return true;
      }
      return false;
    }
    if (g.state !== 'playing' || visible($('#picker')) || state.savedHold || now - state.savedOpenAt < cfg.delay) return false;
    state.savedBatch = null;
    const counts = storedCounts(g);
    const kind = ['skill', 'chest'].find(type => counts[type] && storedKindAllowed(type, cfg, cfg.storedOpenMode, levels));
    return kind ? openStored(kind) : false;
  }
  function ownedChestSlots() {
    const slots = state.game?.runItems?.slots;
    if (slots && typeof slots.entries === 'function') return Object.fromEntries([...slots.entries()].map(([slot, value]) => [slot, { item: value.item, level: value.vals?.length || 1 }]));
    const hud = $('#runitems');
    if (!hud || !hud.querySelector('.run-slot')) return null;
    return Object.fromEntries([...hud.querySelectorAll('.run-slot[data-item]:not(.empty)')].map(el => [el.dataset.item, { level: (Number(text(el, '.lvl').replace('+', '')) || 0) + 1 }]));
  }
  function rememberDeity(game = state.game) {
    if (!game) return new Set();
    let seen = state.deitySeen.get(game);
    if (!seen) { seen = new Set(); state.deitySeen.set(game, seen); }
    const id = game.runItems?.slots?.get?.('deity')?.item;
    if (typeof id === 'string' && id) seen.add(id);
    return seen;
  }
  function readChestContext() {
    const g = state.game, reachableBySlot = {};
    const context = { reachableBySlot, swapDeity: Number.isFinite(g?.perksLeft?.deity) ? g.perksLeft.deity > 0 : undefined,
      acquiredDeities: rememberDeity(g), banishLeft: g?.perksLeft?.banish, skillDeities: state.catalog.filter(item => item.skillDeity).map(item => item.id) };
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
  function readSavingLevels() {
    return { role: Number.isInteger(state.game?.level) && state.game.level >= 1 ? state.game.level : null, chest: chestTotalLevels(ownedChestSlots()) };
  }
  function levelSavingStep() {
    const native = nativeSaveApi(), g = state.game;
    if (state.savedHold) return false;
    if (!saveGameReady(native)) {
      if (g?.state === 'levelup' && visible($('#picker'))) {
        const kind = pickerKind($('#picker')), policy = kind && levelSavePolicy(kind, cfg, readSavingLevels());
        if (kind && (kind === 'skill' ? cfg.skills : cfg.chests) && (policy === true || policy === null)) { log('等待原生保存控制項初始化，保留目前牌面'); return true; }
      }
      return false;
    }
    if (g.state === 'playing') state.manualSelection = null;
    const levels = readSavingLevels();
    for (const kind of ['skill','chest']) {
      if (!(kind === 'skill' ? cfg.skills : cfg.chests)) continue;
      const policy = levelSavePolicy(kind, cfg, levels);
      if (typeof policy !== 'boolean') continue;
      if ((kind === 'skill' ? native.prefLv() : native.prefCh()) !== policy && setNativeSave(kind, policy))
        log(`${kind === 'skill' ? `角色等級 ${levels.role}/${cfg.skillSaveAtLevel}` : `寶箱五欄總等級 ${levels.chest}/${cfg.chestSaveAtTotal}`}：${policy ? '達標，之後保存' : '未達標，立即升級'}`);
    }
    if (g.state !== 'levelup' || !visible($('#picker')) || $('#picker').classList.contains('closing')) return false;
    const kind = pickerKind($('#picker'));
    if (!kind || !(kind === 'skill' ? cfg.skills : cfg.chests) || state.savedBatch?.manual || state.manualSelection === g) return false;
    const policy = levelSavePolicy(kind, cfg, levels);
    if (policy === null) { log(`${kind === 'skill' ? '角色等級' : '寶箱總等級'}尚未確認，等待資料或手動操作`); return true; }
    if (policy === true) {
      native.keep();
      if (g.state === 'playing') { state.savedBatch = null; resetPicker(); log(`${kind === 'skill' ? '技能' : '寶箱'}已達保存等級，保留目前未選牌面`); }
      return true;
    }
    return false;
  }
  function actPicker(now) {
    const picker = $('#picker');
    if (!visible(picker)) { resetPicker(); return; }
    stopMove();
    if (picker.classList.contains('closing')) return;
    const kind = pickerKind(picker);
    if (!kind || kind === 'skill' && !cfg.skills || kind === 'chest' && !cfg.chests) return;
    const chestToken = kind === 'chest' ? state.game?.openingChest || null : null;
    const offer = currentOffer(kind);
    if (state.pickerType !== kind || offer && offer !== state.activeOffer || chestToken && chestToken !== state.chestToken) {
      resetPicker(); state.pickerType = kind;
      state.activeOffer = offer; state.used = offer?.used || 0; state.skillUsed = offer?.skillUsed || 0;
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
        banished.banish.click(); rememberOfferRedraw(kind); log(`放逐${banished.id === basic ? '普攻' : '已擁有技能'}：${banished.name}；本局不再出現其升級`); return;
      }
      const limit = Math.min(cfg.skillSlots, state.game?.maxSkills || cfg.skillSlots);
      const selected = chooseSkill(cards, owned, { ...cfg, skillSlots: limit }, state.registry);
      if (selected) return pick(selected, now);
      const deck = deckButton(picker);
      const left = state.game?.perksLeft?.reroll ?? Number(text(deck, 'small') || 0);
      if (cfg.skillReroll && deck && state.skillUsed < cfg.maxRerolls && (left === undefined || left > cfg.reserveDeck)) {
        state.skillUsed++; if (state.activeOffer) state.activeOffer.skillUsed = state.skillUsed;
        state.pending = { type: 'deck', at: now }; deck.click(); rememberOfferRedraw(kind); log(`技能牌沒有符合 ${limit} 技配置的選項，重抽整組`); return;
      }
      log(`技能牌沒有符合 ${limit} 技配置的選項；等待手動選擇`); return;
    }
    if (cards.some(c => !c.slot)) { log(`寶箱欄位未識別：${cards.filter(c => !c.slot).map(c => `${c.name}［${c.sub || '無類型'}］`).join('、')}；等待手動選擇`); return; }
    const deck = deckButton(picker), left = state.game?.perksLeft;
    const cardLeft = Math.max(0, ...cards.map(c => Number(text(c.reroll, 'small') || 0)));
    const result = chestDecision(cards, cfg, { used: state.used, card: left?.reroll_card ?? cardLeft, deck: left?.reroll ?? Number(text(deck, 'small') || 0) }, !!deck, state.catalog, ownedChestSlots(), readChestContext());
    if (result.type === 'pick') return pick(result.card, now, result.reason);
    if (result.type === 'wait') { log(result.reason); return; }
    if (result.type === 'banish') {
      if (!result.card.banish?.isConnected || result.card.banish.disabled) return;
      state.pending = { type: 'banish', at: now }; result.card.banish.click(); rememberOfferRedraw(kind); log(`放逐寶箱神格：${result.card.name}；${result.reason}`); return;
    }
    const button = result.type === 'card' ? result.card.reroll : deck;
    if (!button || button.disabled) return;
    state.used++; if (state.activeOffer) state.activeOffer.used = state.used;
    state.pending = { type: result.type, at: now };
    button.click(); rememberOfferRedraw(kind); log(`${result.reason}；${result.type === 'card' ? '重抽單張：' + result.card.name : '重抽整組'}（本箱 ${state.used}/${cfg.maxRerolls}）`);
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
  function collectReveal(now, force = false) {
    if (!cfg.pickups && !force) return false;
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
    captain: /隊長|队长|船長|船长|captain|capitán|capitão/i,
  };
  function talkToNpc(kind, now) {
    const prompt = $('#lobby-prompt');
    if (!visible(prompt) || prompt.disabled || !NPC_NAMES[kind].test(prompt.textContent)) return false;
    releaseTownKeys(); state.npcApproach = null;
    const key = `npc:${kind}`;
    if (state.flow?.key === key && state.flow.node === prompt) {
      if (!state.flow.clicked && now-state.flow.at >= 700) {
        state.flow.clicked = true;
        prompt.click(); log('空白鍵後仍未切換，已點擊原生交談按鈕一次');
      } else if (now-state.flow.at > 8000) log('交談後未切換畫面，等待遊戲響應；可按「重新識別」重試');
      return true;
    }
    state.flow = { key, node:prompt, at:now, clicked:false };
    state.townDispatch = true;
    try {
      // 使用原生 bindInput 的空白鍵交談入口，只在目標 NPC 提示出現時觸發。
      window.dispatchEvent(new KeyboardEvent('keydown', { key:' ', code:'Space', keyCode:32, which:32, bubbles:true, cancelable:true }));
      window.dispatchEvent(new KeyboardEvent('keyup', { key:' ', code:'Space', keyCode:32, which:32, bubbles:true }));
    } finally { state.townDispatch = false; }
    log(`按空白鍵與${kind === 'vendor' ? '礦石商人' : '遠征隊長'}交談`);
    return true;
  }
  function installTownBridge(namespace) {
    const camera = Object.values(namespace).find(value => value && typeof value === 'object' && Number.isFinite(value.yaw) && Number.isFinite(value.targetYaw) && Number.isFinite(value.zoom) && Number.isFinite(value.targetZoom));
    state.townCamera = camera || null;
    const World = Object.values(namespace).find(value => typeof value === 'function' && ['setView','render','project','pickGround','spriteLift'].every(key => typeof value.prototype?.[key] === 'function'));
    if (!World || !state.assets?.sheets) { state.townBridge = '原生廣場座標適配器不可用；請刷新遊戲或查看診斷'; return; }
    const proto = World.prototype;
    if (state.townWorldHooks.has(proto)) return;
    state.townWorldHooks.add(proto);
    const setView = proto.setView, render = proto.render;
    proto.setView = function (x,y,...args) {
      const result = setView.call(this,x,y,...args);
      if (Number.isFinite(x) && Number.isFinite(y)) state.townWorldViews.set(this,{x,y});
      return result;
    };
    proto.render = function (layer,...args) {
      const result = render.call(this,layer,...args);
      // 只觀察原生渲染的玩家／NPC 座標；不改位置、鏡頭或原生尋路。
      if (!this.gone && document.body.classList.contains('in-lobby') && visible($('#lobby-ui'))) {
        try {
          const player = state.townWorldViews.get(this), npcs = townNpcPositions(layer,state.assets?.sheets);
          if (player && Object.keys(npcs).length) {
            state.townScene = { world:this, layer, player:{...player}, npcs, at:performance.now() };
            state.townBridge = '已連接原生廣場座標';
          }
        } catch { state.townBridge = '原生廣場座標讀取失敗，已停止自動接近'; }
      }
      return result;
    };
    state.townBridge = '等待廣場渲染座標';
  }
  function requestTownPath(scene,target) {
    if (typeof PointerEvent !== 'function') return false;
    const canvas = document.querySelector('#stage canvas:last-child');
    if (!canvas || !visible(canvas)) return false;
    const point = scene.world.project(target.x,target.y), back = scene.world.pickGround(point.x,point.y);
    if (!back || Math.hypot(back.x-target.x,back.y-target.y) > 35) return false;
    const bounds = canvas.getBoundingClientRect();
    if (!(point.x >= 0 && point.y >= 0 && point.x < bounds.width && point.y < bounds.height)) return false;
    // 擁擠時不點擊玩家，以免打開玩家選單；改用精確座標短按接近。
    for (const view of scene.layer.children || []) {
      if (!view?.children?.some(sprite => sprite.sheet) || !Number.isFinite(view.x) || !Number.isFinite(view.y)) continue;
      const floor = scene.world.project(view.x,view.y), head = scene.world.project(view.x,view.y,scene.world.spriteLift(88));
      const height = floor.y-head.y;
      if (Math.hypot(view.x-target.x,view.y-target.y) > 1 && height > 0 && Math.abs(point.x-floor.x) < height*.4 && point.y > head.y && point.y < floor.y+height*.1) return false;
    }
    releaseTownKeys(); state.townDispatch = true;
    try {
      // 原生廣場通用的點按入口；桌面與觸控模式均由 bindInput 接到 pickGround／moveTo。
      canvas.dispatchEvent(new PointerEvent('pointerdown',{bubbles:true,pointerType:'touch',button:0,buttons:1,clientX:point.x+bounds.left,clientY:point.y+bounds.top}));
      window.dispatchEvent(new PointerEvent('pointerup',{bubbles:true,pointerType:'touch',button:0,buttons:0,clientX:point.x+bounds.left,clientY:point.y+bounds.top}));
    } finally { state.townDispatch = false; }
    return true;
  }
  function releaseTownKeys() {
    for (const key of state.townKeys) window.dispatchEvent(new KeyboardEvent('keyup', { key, bubbles: true }));
    state.townKeys = [];
    if (state.townPulse !== null) { clearTimeout(state.townPulse); state.townPulse = null; }
  }
  function approachNpc(kind, now) {
    if (document.querySelector('.overlay:not(.hidden)') || now < state.manualUntil) { releaseTownKeys(); return false; }
    if (talkToNpc(kind, now)) return true;
    const prompt = $('#lobby-prompt');
    const scene = state.townScene, target = scene?.npcs[kind];
    if (!scene || scene.world.gone || now-scene.at > 1500 || !target) { releaseTownKeys(); log(`${state.townBridge}；等待${kind === 'vendor' ? '礦石商人' : '遠征隊長'}實際座標`); return false; }
    if (state.townKeys.length) return true;
    const yaw = state.townCamera?.yaw;
    if (!state.npcApproach || state.npcApproach.world !== scene.world || state.npcApproach.kind !== kind) state.npcApproach = { world:scene.world, kind, distance:Infinity, pathAt:-Infinity, progressAt:now };
    const route = state.npcApproach;
    const step = townWorldPlan(scene.player,target,yaw);
    if (!step) { releaseTownKeys(); log('等待原生廣場鏡頭方向，停止猜測移動'); return false; }
    if (step.distance < route.distance-1) route.progressAt = now;
    route.distance = step.distance;
    if (now-route.pathAt < 6000 && now-route.progressAt < 1200) { log(`原生尋路接近${kind === 'vendor' ? '商人' : '隊長'}，實際距離 ${Math.round(step.distance)}`); return true; }
    if (step.distance > 220 && now-route.pathAt > 6000 && requestTownPath(scene,target)) { route.pathAt = now; route.progressAt = now; return true; }
    const keys = step.keys;
    if (!keys.length) { log(`已到目標座標，等待原生交談提示：${prompt?.textContent || '尚無提示'}`); return false; }
    state.townKeys = keys;
    state.townDispatch = true;
    try { for (const key of keys) window.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true })); }
    finally { state.townDispatch = false; }
    state.townPulse = setTimeout(releaseTownKeys, step.duration);
    log(`按原生座標接近${kind === 'vendor' ? '礦石商人' : '遠征隊長'}，實際距離 ${Math.round(step.distance)}`);
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
  function setExpeditionTarget(id, lap) {
    if (cfg.expedition === id && cfg.expeditionLap === lap) return;
    cfg.expedition = id; cfg.expeditionLap = lap;
    state.flow = null; state.launchStage = ''; state.launchLap = 0; state.launchPending = false; save();
    ui.querySelector('[data-setting="expedition"]').value = id;
    ui.querySelector('[data-setting="expeditionLap"]').value = String(lap);
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
      const cards = readStages();
      const planned = state.farmPlan || state.expeditionProbe, wantedLap = planned?.lap || cfg.expeditionLap;
      const wantedStage = planned?.stage || cfg.expedition;
      const wantedChapter = state.stageCatalog.get(wantedStage)?.chapter || stageChapter(wantedStage);
      if (state.stageChapter !== wantedChapter) {
        const chapter = readChapterTabs().find(tab => Number(tab.dataset.chtab) === wantedChapter);
        if (!chapter || chapter.disabled || chapter.getAttribute('aria-disabled') === 'true') { log(`等待遊戲開放${CHAPTER_LABELS[wantedChapter - 1]}`); return true; }
        return flowClick(chapter, `chapter:${wantedChapter}`, now);
      }
      const tabs = readLapTabs();
      const currentLap = tabs.find(t => t.selected)?.lap || 1;
      if (currentLap !== wantedLap) {
        const target = tabs.find(t => t.lap === wantedLap);
        if (!target || target.locked) { log(`第 ${wantedLap} 周目尚未解鎖，等待手動處理`); return true; }
        return flowClick(target.tab, `lap:${wantedLap}`, now);
      }
      const farming = !!state.farmPlan;
      let stage = planned && state.stages.find(s => s.id === planned.stage);
      if (!planned) {
        const decision = nextExpedition(state.stages, cfg, state.laps);
        if (decision.type === 'wait' || decision.type === 'complete') { state.progressionStatus = decision.reason; log(decision.reason); return true; }
        stage = decision.stage;
        if (decision.type === 'lap' || stage.id !== cfg.expedition) {
          const previous = state.game?.difficulty?.lap === currentLap ? state.game.stageId : cfg.expedition;
          const source = chooseFarmStage(state.stages, decision.type === 'lap' ? null : stage.id, previous);
          state.expeditionProbe = { stage: stage.id, lap: decision.lap || currentLap, source: source ? { stage: source.id, lap: currentLap, name: source.name } : null };
          if (decision.type === 'lap') return flowClick(tabs.find(t => t.lap === decision.lap).tab, `lap:${decision.lap}`, now);
        }
      }
      const card = stage && cards[state.stages.indexOf(stage)];
      if (!card) { log('找不到設定的副本；請重新讀取副本清單'); return true; }
      if (farming && (!stage.cleared || stage.locked || stage.storyOnly)) { log(`回刷副本目前無法出發：${stage.name}；等待手動處理`); return true; }
      if (!farming && state.expeditionProbe && stage.cleared) {
        setExpeditionTarget(stage.id, currentLap); state.expeditionProbe = null; state.flow = null; return true;
      }
      // 鎖定的牌也可選取；只有原生詳情能分辨評分不足或其他解鎖條件。
      if (!card.classList.contains('sel')) return flowClick(card, `stage:${cfg.expedition}`, now);
      const go = $('#stg-go');
      if (stage.locked || !visible(go) || go.disabled) {
        const failed = [...document.querySelectorAll('#stg-detail .stg-req.no')].map(el => el.textContent.trim());
        if (cfg.progression && !farming && gearOnlyBlocked(failed)) {
          const probe = state.expeditionProbe, previous = state.game?.difficulty?.lap === currentLap ? state.game.stageId : probe?.source?.stage || cfg.expedition;
          const local = chooseFarmStage(state.stages, stage.id, previous);
          const source = local ? { stage: local.id, lap: currentLap, name: local.name } : probe?.source && probe.source.lap !== currentLap ? probe.source : null;
          if (source && (source.lap === currentLap || tabs.some(t => t.lap === source.lap && !t.locked))) {
            state.farmPlan = { ...source, target: stage.id, targetLap: currentLap, targetName: stage.name };
            state.expeditionProbe = null; setExpeditionTarget(source.stage, source.lap); state.flow = null;
            state.progressionStatus = `${stage.name}裝備分數不足，回刷第 ${source.lap} 周目 ${source.name}；每局結算後重新檢查`;
            log(state.progressionStatus); return true;
          }
        }
        state.progressionStatus = `等待出發條件：${stage.name}`;
        log(`無法出發：${stage.name}；${failed.join('；') || '請檢查裝備評分、職業或劇情要求'}${cfg.progression && gearOnlyBlocked(failed) ? '；沒有可確認已通關且可出發的回刷副本' : ''}`);
        return true;
      }
      setExpeditionTarget(stage.id, currentLap); state.expeditionProbe = null;
      state.launchStage = cfg.expedition; state.launchLap = cfg.expeditionLap;
      if (cfg.progression) state.progressionStatus = farming ? `裝備分數不足，回刷第 ${currentLap} 周目 ${stage.name}；結算後再檢查${state.farmPlan.targetName}`
        : `正在開荒：第 ${cfg.expeditionLap} 周目 · ${stage.name}；未通關則重試本圖`;
      if (flowClick(go, `depart:${cfg.expedition}`, now)) log(`自動遠征：${stage.name}，沿用遊戲目前的難度設定`);
      return true;
    }
    if (visible($('#lobby-ui')) && document.body.classList.contains('in-lobby') && !visible($('#loading'))) {
      approachNpc('captain', now); return true;
    }
    return false;
  }
  const isSoloPickupRun = g => g && Number.isFinite(g.time) && !g.coop && !g.endless && !g.story && !g.isStory && !g.replayMoves;
  const victoryLootSeconds = g => isSoloPickupRun(g) && g.state !== 'over' && Number.isFinite(g.lootUntil) ? Math.max(0, Math.ceil(g.lootUntil - g.time)) : 0;
  const pickupThresholdReached = (level, threshold) => threshold > 0 && Number.isInteger(level) && level >= threshold;
  function renderPickupStatus(g) {
    const seconds = victoryLootSeconds(g);
    const victoryStatus = ui.querySelector('#victory-loot-status');
    victoryStatus.hidden = !seconds || !cfg.enabled || g.player?.dead || !visible($('#hud'));
    if (!victoryStatus.hidden) victoryStatus.textContent = `尾王收尾 · 剩 ${seconds} 局內秒自動拾取`;
    const statuses = [];
    if (!seconds && isSoloPickupRun(g) && !g.player?.dead && visible($('#hud'))) {
      if (cfg.chestHunt && cfg.stopChestPickupAtTotal) {
        const level = chestTotalLevels(ownedChestSlots());
        statuses.push(`寶箱 ${level ?? '未讀取'}／${cfg.stopChestPickupAtTotal} · ${pickupThresholdReached(level, cfg.stopChestPickupAtTotal) ? '等磁鐵' : '主動尋寶'}`);
      }
      if (cfg.pickups && cfg.stopXpPickupAtLevel) {
        statuses.push(`角色 ${g.level ?? '未讀取'}／${cfg.stopXpPickupAtLevel} · ${pickupThresholdReached(g.level, cfg.stopXpPickupAtLevel) ? '等磁鐵' : '主動拾取經驗'}`);
      }
    }
    ui.querySelector('#pickup-threshold-status').textContent = statuses.join('｜');
  }
  const magnetSecondsLeft = g => Math.max(0, Math.ceil(cfg.magnetInterval - (g.time - state.lastMagnetAt)));
  function renderMagnetStatus(g) {
    const status = ui.querySelector('#magnet-status');
    status.hidden = !cfg.magnetInterval;
    if (status.hidden) return;
    const seconds = isSoloPickupRun(g) ? magnetSecondsLeft(g) : null;
    let message;
    if (!cfg.pickups) message = '請開啟安全拾取掉落物';
    else if (!cfg.enabled) message = '助手已暫停';
    else if (seconds === null || g.player?.dead || !visible($('#hud'))) message = '等待進入單人遠征';
    else if (g.state !== 'playing' || visible($('#picker'))) message = `等待遊戲恢復 · 剩 ${seconds} 局內秒`;
    else if (victoryLootSeconds(g)) message = '尾王收尾時優先拾取';
    else if (state.timedExit || state.bell) message = '目前優先處理遠征機制';
    else if (seconds > 0) message = `還有 ${seconds} 局內秒`;
    else if (state.magnets.some(item => item.magnet)) message = '磁鐵吸附中';
    else message = state.magnetStatus || '到時，正在搜尋磁鐵';
    status.textContent = `磁鐵 · ${message}${state.magnetsCollected ? ` · 本局已拾取 ${state.magnetsCollected} 次` : ''}`;
  }
  function pickupWaypoint(g, target, now) {
    if (!g.walk) return target;
    const { player, walk } = g, magnet = target.priority === -1;
    let route = magnet ? state.magnetRoutes.get(target.pickup) : state.route;
    if (route?.target !== target.pickup || route.until < now) {
      const [x, y] = walk.nearestWalkable(target.x, target.y);
      // 磁鐵的終點必須落在原生吸附範圍內，避免一直走向隔牆的地點。
      const radius = magnet ? (g.stats.pickupRadius ?? 40) + g.buffValue('pickup') : 0;
      const points = (!magnet || Math.hypot(x - target.x, y - target.y) < radius)
        ? walk.pathTo(player.x, player.y, x, y) || [] : [];
      route = { target: target.pickup, until: now + 600, points };
      if (magnet) state.magnetRoutes.set(target.pickup, route); else state.route = route;
    }
    const advanceDistance = magnet ? 8 : 24;
    while (route.points.length > (magnet ? 1 : 0)
      && Math.hypot(route.points[0].x - player.x, route.points[0].y - player.y) < advanceDistance) route.points.shift();
    return route.points[0] || (!magnet && target.distance < 40 ? target : null);
  }
  function movement(now, shelter = null, cleanup = null) {
    const g = state.game;
    if (!g || !visible($('#hud')) || g.state !== 'playing' || g.player.dead || now < state.manualUntil || (document.hidden && !cfg.background) || (!document.hidden && editingSettings()) || g.replayMoves) { stopMove(); return; }
    const victory = victoryLootSeconds(g) > 0;
    if (!cfg.dodge && !cfg.chestHunt && !cfg.pickups && !cleanup && !victory) { stopMove(); return; }
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
    let drops = g.pickups;
    if (cleanup) {
      drops = g.pickups.filter(item => cleanup.has(item) && !item.dead);
      const cards = drops.filter(item => item.kind === 'card'); if (cards.length) drops = cards;
    }
    let magnetDue = null;
    state.magnetStatus = '';
    if (cfg.magnetInterval && (cfg.pickups || victory) && isSoloPickupRun(g)) {
      // 原生拾取會先標記 dead，再從陣列移除；走近或吸附中都不開始下一輪計時。
      const collected = state.magnets.filter(item => item.dead).length;
      if (collected) { state.lastMagnetAt = g.time; state.magnetsCollected += collected; }
      state.magnets = g.pickups.filter(item => item.kind === 'magnet' && !item.dead);
      if (!cleanup) magnetDue = magnetSecondsLeft(g) === 0 && !state.magnets.some(item => item.magnet);
    }
    const useThresholds = !victory && !cleanup && isSoloPickupRun(g);
    const policy = { victory,
      waitForChests: useThresholds && cfg.chestHunt && cfg.stopChestPickupAtTotal > 0 && pickupThresholdReached(chestTotalLevels(ownedChestSlots()), cfg.stopChestPickupAtTotal),
      waitForXp: useThresholds && pickupThresholdReached(g.level, cfg.stopXpPickupAtLevel),
    };
    const pickupConfig = cleanup ? { ...cfg, pickups: true, chestHunt: false } : cfg;
    const targets = shelter ? [] : pickupTargets(drops, p, g.zeny, g.chestCost(), pickupConfig, enemies.slice(0, 100), victory ? true : magnetDue, policy);
    const scene = { player: p, enemies: enemies.slice(0, 100), zones: readZones(), shelter, bounds: g.bounds, previous: state.previous,
      speed: g.classDef.speed * 1.3 * g.stats.speedMult * (1 + g.buffValue('speed')) * (1 - g.buffValue('slow')),
      walkable: g.walk ? (ax, ay, bx, by) => {
        if (!g.walk.walkable(bx, by)) return false;
        const [x, y] = g.walk.resolve(ax, ay, bx, by);
        return Math.hypot(x - bx, y - by) < 3;
      } : null };
    let best = null, magnetRouteFound = false;
    if (!shelter && (magnetDue || victory)) {
      const magnets = targets.filter(target => target.priority === -1);
      for (const target of magnets) {
        const waypoint = pickupWaypoint(g, target, now);
        if (!waypoint) continue;
        magnetRouteFound = true;
        best = planMove({ ...scene, target: waypoint, prioritizeMagnet: true }, cfg);
        if (!best) continue;
        state.magnetStatus = `到時，正在引導拾取 · 距離 ${Math.round(target.distance)}`;
        break;
      }
      if (!best) state.magnetStatus = magnetRouteFound ? '到時，磁鐵路線有危險，暫避'
        : magnets.length ? '到時，磁鐵目前無可達路線' : '到時，地上沒有可拾取的磁鐵';
    }
    if (!best) {
      if (!shelter && !magnetRouteFound) {
        for (const target of targets.filter(t => t.priority !== -1).slice(0, 5)) {
          goal = pickupWaypoint(g, target, now);
          if (goal) break;
        }
      }
      if (!cfg.dodge && !goal) { stopMove(); return; }
      best = planMove({ ...scene, target: goal }, cfg);
    }
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
  function resetAutoSpeed() {
    state.speedDone = false; state.speedApplied = false; state.speedAttempted = false; state.speedAttemptAt = 0; state.speedStatus = '等待進入單人遠征';
  }
  function timedExitStep(now) {
    const g = state.game;
    if (!cfg.timedExitEnabled || !g || g.state === 'over' || g.player.dead || !visible($('#hud'))) return false;
    if (g.coop || g.endless || g.story || g.isStory || g.replayMoves || window.__RO_SPD?.state?.().shown === false) { state.timedExit = null; return false; }
    if (victoryLootSeconds(g) && state.timedExit?.stage !== 'ending') { state.timedExit = null; return false; }
    if (!state.timedExit && timedExitDue(g, cfg)) {
      state.timedExit = { stage: 'collect', at: g.time, items: new Set(g.pickups.filter(p => !p.dead && /^(card|loot|egg)$/.test(p.kind))), clicked: false };
      state.route = null; stopMove();
      log(`已達局內 ${cfg.timedExitMinutes} 分鐘，開始收尾拾取卡片／裝備，最多 ${cfg.cleanupSeconds} 局內秒`);
    }
    const plan = state.timedExit; if (!plan) return false;
    if (plan.stage === 'ending') { if (now - plan.sent > 5000) log('原生結算尚未完成，等待手動確認；不重複結算'); return true; }
    for (const item of g.pickups) if (!item.dead && item.kind === 'card') plan.items.add(item);
    if (collectReveal(now, true)) return true;
    if (visible($('#picker'))) return false;
    if (g.state !== 'playing') return true;
    const pending = [...plan.items].filter(item => !item.dead && g.pickups.includes(item));
    if (pending.length && g.time - plan.at < cfg.cleanupSeconds) {
      if (bellStep(now)) return true;
      movement(now, null, plan.items); return true;
    }
    stopMove();
    const end = $('#btn-endrun');
    if (!end || end.tagName !== 'BUTTON' || end.disabled || typeof end.onclick !== 'function') { log('找不到原生結束結算按鈕，請手動處理'); return true; }
    // 「退出」會保存斷點；原生結束按鈕才會結算 runCards/runLoot 並清除斷點。
    plan.stage = 'ending'; plan.sent = now; plan.clicked = true;
    end.click();
    log(`定時結束本局，按原生規則結算已拾取的卡片與裝備${pending.length ? `；收尾到時，仍有 ${pending.length} 件地面掉落未拾取` : ''}`);
    return true;
  }
  function autoSpeedStep(now) {
    if (!cfg.autoDoubleSpeed || state.speedDone) return;
    const g = state.game;
    if (!g || g.state !== 'playing' || g.player.dead || !visible($('#hud'))) return;
    if (g.coop || g.endless || g.isStory || g.replayMoves) { state.speedStatus = '目前模式不使用單人遠征2x'; return; }
    const button = $('#spd-btn');
    // roSpd 由原生本局第一幀初始化；先等它，避免讀到上一局殘留的按鈕狀態。
    if (![1, 2].includes(g.roSpd) || !visible(button) || button.disabled || button.getAttribute('aria-disabled') === 'true') { state.speedStatus = '等待本局原生倍速按鈕'; return; }
    const isOn = () => button.getAttribute('aria-pressed') === 'true' && /^2x$/i.test(button.textContent.trim());
    if (g.roSpd === 2 || isOn()) { state.speedDone = true; state.speedApplied = true; state.speedStatus = '本局已啟用原生2x'; log(state.speedStatus); return; }
    if (state.speedAttempted) {
      if (now - state.speedAttemptAt >= 1500) { state.speedDone = true; state.speedStatus = '已嘗試切換2x，保留遊戲目前速度，請查看原生按鈕'; log(state.speedStatus); }
      return;
    }
    if (button.getAttribute('aria-pressed') !== 'false' || !/^1x$/i.test(button.textContent.trim())) { state.speedStatus = '原生倍速狀態待確認'; return; }
    state.speedAttempted = true; state.speedAttemptAt = now; button.click();
    if (isOn()) { state.speedDone = true; state.speedApplied = true; state.speedStatus = '本局已自動切換原生2x'; log(state.speedStatus); }
  }
  const UPDATE_DIALOG_TEXT = [
    ['新版本', '遊戲已推出新版本', '稍後', '重新整理'],
    ['New version', 'There is a new version of the game', 'Later', 'Reload'],
    ['Versión nueva', 'Hay una versión nueva del juego', 'Más tarde', 'Recargar'],
    ['Nova versão', 'Há uma versão nova do jogo', 'Mais tarde', 'Recarregar'],
  ];
  const UPDATE_RELOAD_STORAGE = 'ro-survivors-helper.last-game-update-reload';
  function gameUpdateStep() {
    if (cfg.gameUpdateAction === 'manual' || window.RO_DEAD || $('#ro-tab-dead')) return false;
    const dialog = $('#npc-dialog'), title = text(dialog, '#npc-name');
    const translation = UPDATE_DIALOG_TEXT.find(entry => entry[0] === title);
    if (!translation || !visible(dialog) || !text(dialog, '#npc-text').startsWith(translation[1])) return false;
    const [later, reload, ...extra] = dialog.querySelectorAll('#npc-options button');
    if (!later || !reload || extra.length || later.textContent.trim() !== translation[2] || reload.textContent.trim() !== translation[3] ||
        !reload.classList.contains('primary')) return false;
    const refresh = cfg.gameUpdateAction === 'reload', button = refresh ? reload : later;
    if (state.versionDialogs.has(reload) || button.disabled || !visible(button) || typeof button.onclick !== 'function') return true;
    if (refresh) {
      const now = Date.now();
      let previous = state.lastVersionReloadAt;
      try { previous = Math.max(previous, Number(sessionStorage.getItem(UPDATE_RELOAD_STORAGE)) || 0); } catch {}
      if (now - previous < 120000) {
        state.versionDialogs.add(reload);
        log('新版本提示再次出現，本分頁剛自動重新整理，請手動選擇');
        return true;
      }
      state.lastVersionReloadAt = now;
      try { sessionStorage.setItem(UPDATE_RELOAD_STORAGE, String(now)); } catch {}
    }
    state.versionDialogs.add(reload);
    stopMove(); releaseTownKeys();
    log(`遊戲新版本提示：已選擇${refresh ? '重新整理' : '稍後'}`);
    button.click();
    return true;
  }
  function tick() {
    try {
      deathMailStep(performance.now());
      if (gameUpdateStep()) return;
      if (!cfg.enabled) return;
      syncBackground();
      if ((!document.hidden && editingSettings()) || (document.hidden && !cfg.background)) { stopMove(); return; }
      if (window.RO_DEAD || $('#ro-tab-dead')) { stopMove(); log('遊戲分頁已停用，請先在遊戲中恢復'); return; }
      const now = performance.now();
      if (now < state.manualUntil) { stopMove(); return; }
      autoSpeedStep(now);
      if (timedExitStep(now)) { state.errorCount = 0; return; }
      if (now - state.lastListRead > 1000) { state.lastListRead = now; if (visible($('#stages'))) readStages(); }
      if (bellStep(now)) { state.errorCount = 0; return; }
      if (collectReveal(now, victoryLootSeconds(state.game) > 0)) return;
      if (levelSavingStep()) return;
      if (postRunStep(now)) return;
      if (repeatStep(now)) return;
      if (storedStep(now)) return;
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
    renderMagnetStatus(g); renderPickupStatus(g);
    const owned = ownedSkills();
    ui.querySelector('#owned').textContent = `本局技能 ${owned.length}/${cfg.skillSlots}（不含普攻）：` + (owned.map(id => SKILL_NAMES[id] || state.registry[id]?.name || id).join('、') || '等待進入遊戲');
    ui.querySelector('#fifth-field').hidden = cfg.skillSlots !== 5;
    ui.querySelector('#banish-toggle').textContent = cfg.banish ? '停止放逐' : '啟動放逐';
    ui.querySelector('#banish-toggle').classList.toggle('on', cfg.banish);
    ui.querySelector('#exclude-toggle').textContent = cfg.banishExcludeEnabled ? '停用排除放逐的技能' : '啟用排除放逐的技能';
    ui.querySelector('#exclude-toggle').classList.toggle('on', cfg.banishExcludeEnabled);
    ui.querySelector('#exclude-count').textContent = `${cfg.banishExcludeEnabled ? '排除名單已啟用' : '排除名單未啟用'}，已勾選 ${cfg.banishExclude.length} 個技能`;
    ui.querySelector('#repeat-status').textContent = `${cfg.repeat ? '自動遠征已啟用' : '自動遠征已關閉'} · ${cfg.progression ? '首通開荒' : '固定副本'} · ${CHAPTER_LABELS[(state.stageCatalog.get(cfg.expedition)?.chapter || stageChapter(cfg.expedition)) - 1]}第 ${cfg.expeditionLap} 周目 · 本次已自動開局 ${state.runsStarted} 次${cfg.repeatLimit ? `／${cfg.repeatLimit}` : '（無上限）'}${cfg.progression ? `\n${state.progressionStatus}` : ''}`;
    ui.querySelector('#background-status').textContent = `背景掛機：${state.backgroundStatus}`;
    renderMailStatus();
    const native = nativeSaveApi();
    for (const input of ui.querySelectorAll('[data-native-save]')) {
      input.disabled = !native; input.checked = !!native && (input.dataset.nativeSave === 'chest' ? native.prefCh() : native.prefLv());
    }
    const saved = storedCounts(g, native?.g === g ? native.curT === 'chest' ? 'chest' : 'skill' : '');
    ui.querySelector('#stored-status').textContent = !native ? '等待新版保存功能初始化；已打開的牌仍按原配置處理' :
      `局內角色等級 ${readSavingLevels().role ?? '未讀取'} · 寶箱五欄總等級 ${readSavingLevels().chest ?? '未讀取'}\n技能待選 ${saved.skill} · 寶箱待選 ${saved.chest}${state.savedHold ? ' · 手動保存中，按開啟或切換範圍恢復自動' : ''}`;
    ui.querySelector('#stored-skill').disabled = !saveGameReady(native) || g.state !== 'playing' || !saved.skill;
    ui.querySelector('#stored-chest').disabled = !saveGameReady(native) || g.state !== 'playing' || !saved.chest;
    ui.querySelector('#stored-keep').disabled = !saveGameReady(native) || g.state !== 'levelup' || !['lv', 'chest'].includes(native.curT);
    ui.querySelector('#timed-exit-status').textContent = !cfg.timedExitEnabled ? '定時刷卡未啟用' : state.timedExit
      ? `定時刷卡：${g?.state === 'over' ? '本局已結束，等待下一場' : state.timedExit.stage === 'collect' ? '收尾拾取中' : '等待原生結算'}` : `只在第 ${cfg.expeditionLap} 周目 ${cfg.expedition} 生效，局內 ${cfg.timedExitMinutes} 分鐘開始收尾`;
    ui.querySelector('#speed-status').textContent = !cfg.autoDoubleSpeed ? '自動2x未啟用' : state.speedApplied && g?.roSpd === 1
      ? '本局自動2x已處理；目前1x，保留遊戲降速／手動調整' : state.speedStatus;
    ui.querySelector('#bell-status').textContent = !cfg.dodge || !cfg.bellShelter ? '鐘罩避難未啟用（需同時開啟自動避怪）' : state.bellStatus;
    const filled = chestFilledSlots(ownedChestSlots());
    ui.querySelector('#chest-stage').textContent = cfg.chestSmartReroll === false ? '寶箱策略：依設定的先後順序' :
      !cfg.chestFillFirst ? '寶箱策略：依可達類型追首選' : filled === null ? '寶箱策略：等待讀取已填欄位數' :
      `寶箱策略：已填 ${filled}/5，${filled < 2 ? '前兩欄優先整組' : filled < 5 ? '後三欄優先單張，剩餘整組補齊' : '五欄已齊，按首選與等級升級'}`;
    ui.querySelector('#log').textContent = state.logs.slice(-10).map(e => `${e.time} ${e.message}`).join('\n');
  }
  function populate() {
    renderProfiles();
    for (const el of ui.querySelectorAll('[data-sell-quality]')) el.checked = cfg.sellQualities.includes(Number(el.dataset.sellQuality));
    for (const el of ui.querySelectorAll('[data-setting]')) {
      const value = cfg[el.dataset.setting];
      if (el.type === 'checkbox') el.checked = value;
      else if (el.type === 'radio') el.checked = Number(el.value) === value;
      else el.value = value;
    }
    for (const el of ui.querySelectorAll('[data-card-policy]')) {
      const key = el.dataset.cardPolicy;
      el.value = !cfg[key] ? 'manual' : [key, 'both'].includes(cfg.storedOpenMode) ? 'open' : 'pick';
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
      <p id="magnet-status" class="hint" hidden></p>
      <p id="victory-loot-status" class="hint" hidden></p>
      <p id="owned" class="hint"></p>
      <details><summary>職業配置與技能順序</summary>
      <label>基礎職業<select id="job-profile"></select></label>
      <button id="copy-shared-profile">把舊版共用備份複製到此職業</button>
      <small>同一基礎職業的一轉、二轉與三轉共用技能與寶箱配置。手動切換編輯時暫停助手，啟動後自動載入目前角色的基礎職業。</small>
      ${['first', 'second', 'third'].map((key, i) => `<label>第 ${i + 1} 個技能（空白＝任意技能）<input data-setting="${key}" list="skills-list" placeholder="技能名稱或 ID"></label>`).join('')}
      <div class="checkrow">技能欄位（不含普攻）：<label><input type="radio" name="skillSlots" data-setting="skillSlots" value="4"> 4 個</label><label><input type="radio" name="skillSlots" data-setting="skillSlots" value="5"> 5 個（二轉）</label></div>
      <label>第四個技能（空白＝任意技能）<input data-setting="fourth" list="skills-list" placeholder="例如 聖靈召喚 [soul_strike]"><datalist id="skills-list"></datalist></label>
      <label id="fifth-field" hidden>第五個技能（空白＝任意技能）<input data-setting="fifth" list="skills-list" placeholder="選擇 5 個技能時生效"></label>
      <label><input data-setting="rarityFirst" type="checkbox"> 其餘技能牌先比稀有度，再比急速／傷害</label>
      <small>火箭術／冰箭術／雷擊術的「增加目標數」升級固定優先於稀有度；同為目標數升級再比稀有度。本開關只調整其餘技能牌，寶箱遵守獨立優先級。</small>
      </details>
      <details><summary>遠征死亡郵件提醒（EmailJS）</summary>
      <label><input data-setting="deathMailEnabled" type="checkbox"> 啟用單人遠征死亡郵件（可獨立運行）</label>
      <label>合併通知間隔（分鐘，0＝逐封即時發送）<input data-setting="deathMailDigestMinutes" type="number" min="0" max="1440" step="1"></label>
      <small>從首筆死亡開始計時，到時寄一封摘要。分頁保持開啟即可累積，重新整理後可繼續。</small>
      <label>收件郵箱<input data-mail="toEmail" type="email" maxlength="254" autocomplete="off" placeholder="你的收件郵箱"></label>
      <label>EmailJS Service ID<input data-mail="serviceId" maxlength="100" autocomplete="off" placeholder="service_xxx"></label>
      <label>EmailJS Template ID<input data-mail="templateId" maxlength="100" autocomplete="off" placeholder="template_xxx"></label>
      <label>EmailJS Public Key（公開密鑰）<input data-mail="publicKey" type="password" maxlength="200" autocomplete="off" placeholder="只需 Public Key，無需郵箱密碼或 Private Key"></label>
      <div class="buttons"><button id="mail-save">保存通知設定</button><button id="mail-test">發送測試郵件</button><button id="mail-clear">清空通知設定</button></div><small id="mail-status"></small>
      <p class="hint">EmailJS 模板：To Email 填 <code>{{to_email}}</code>，Subject 填 <code>{{title}}</code>，正文放 <code>{{message}}</code>。先保存設定，再發送測試郵件，收到後勾選死亡提醒。</p>
      <small>每局死亡只記一次。通關、定時退圖、劇情／爬塔／組隊／PVP／錄像不計入。通知含職業、副本、周目、局內存活時間、等級及擊殺數，會送到 EmailJS。郵箱與服務參數只存本瀏覽器，不隨職業切換或通用配置導出；失敗／逾時不自動重發同一局。</small>
      </details>
      <details><summary>重抽設定</summary>
      <div class="checkrow"><label><input data-setting="skillReroll" type="checkbox"> 局內技能：允許重抽</label><label><input data-setting="chestReroll" type="checkbox"> 寶箱：允許重抽</label></div>
      <small>兩個開關獨立生效。技能僅在沒有合規選項時重抽整組，關閉後等待手動選擇；寶箱關閉後按現有牌優先級與下方處理方式選擇或等待。沿用下方重抽上限與保留次數。</small>
      </details>
      <details><summary>新版技能／寶箱保存與開啟</summary>
      <div class="checkrow"><label><input data-native-save="skill" type="checkbox"> 遊戲：保存升級選卡</label><label><input data-native-save="chest" type="checkbox"> 遊戲：保存寶箱</label></div>
      <div class="row">${[['skills', '技能牌'], ['chests', '寶箱']].map(([key, label]) => `<label>${label}處理方式<select data-card-policy="${key}"><option value="manual">全程手動</option><option value="pick">只自動選已開啟的牌</option><option value="open">自動開啟並選牌</option></select></label>`).join('')}</div>
      <label><input data-setting="skillLevelGate" type="checkbox"> 技能：按局內角色等級，自動即選／保存</label>
      <label>角色達到幾級後保存技能<input data-setting="skillSaveAtLevel" type="number" min="1" max="99999" step="1"></label>
      <label><input data-setting="chestLevelGate" type="checkbox"> 寶箱：按五欄總等級，自動即選／保存</label>
      <label>寶箱總等級達到多少後保存<input data-setting="chestSaveAtTotal" type="number" min="1" max="99999" step="1"></label>
      <small>兩項分別勾選、隨職業保存。未達標立即選牌，並自動拿出已保存的該類牌；達到閾值即保存，保留尚未選的牌。等級規則優先於自動開啟設定，適用於啟動助手且未選「全程手動」的類型。角色看局內等級；寶箱首張＝1級、+N＝N+1級，空欄＝0，五欄相加。手動開啟可接管，不會擅自丟棄牌。</small>
      <div class="buttons"><button id="stored-skill">立即開技能牌</button><button id="stored-chest">立即開寶箱</button><button id="stored-keep">繼續保存目前牌</button></div>
      <small id="stored-status"></small><br><small>保存開關與遊戲暫停選單同步。啟動助手後，預設只自動選已開啟的牌。只開一種時，原生連選若轉到另一種，助手會將其繼續保存。手動按「繼續保存」會暫緩本局自動開啟，按開啟／B 鍵或切換範圍可恢復；原生分頁可自由切換。面板按鈕先開所選類型，助手運行時限制連選範圍。保存偏好由遊戲全局保存，自動範圍隨職業保存。</small></details>
      <details><summary>升級選牌前放逐已有技能</summary>
      <div class="buttons"><button id="banish-toggle">啟動放逐</button><button id="exclude-toggle">啟用排除放逐的技能</button></div>
      <label><input data-setting="banishBasic" type="checkbox"> 同時放逐普攻的升級牌（不佔 4／5 技名額）</label>
      <p class="hint">啟動後，先對牌面中「已擁有」的技能／普攻使用遊戲放逐按鈕，再選技能。未擁有的新技能不放逐。排除名單啟用後，勾選的技能會保留；勾選「普攻（所有武器）」可統一保護普攻。</p>
      <small id="exclude-count"></small><input id="banish-filter" placeholder="搜尋排除技能：中文名稱或 ID"><div id="banish-list"></div>
      </details>
      <details><summary>自動遠征／新周目開荒</summary>
      <label><input data-setting="repeat" type="checkbox"> 啟用自動遠征（固定重刷／開荒）</label>
      <label><input data-setting="progression" type="checkbox"> 首通開荒：通關後下一張，完成後自動進下一周目</label>
      <label>固定副本／開荒起點<select data-setting="expedition"></select></label>
      <label>所選地圖的周目<select data-setting="expeditionLap">${LAP_LABELS.map((name, i) => `<option value="${i + 1}">${name}${LAP_SUFFIXES[i]}</option>`).join('')}</select></label>
      <button id="read-stages">讀取遊戲副本清單</button>
      <div class="row"><label>自動開局上限（0＝不限）<input data-setting="repeatLimit" type="number" min="0" max="9999"></label><label>局間等待毫秒<input data-setting="repeatDelay" type="number" min="1500" max="60000"></label></div>
      <p id="repeat-status" class="hint"></p><small>開荒需同時勾選自動遠征：從所選地圖開始，按原生已通關標記推進，失敗重試；包含聖誕節、元宵節，後續周目跳過劇情關。下一圖僅裝備分數不足時回刷當前已通關副本，每局結算後重查，達標即推進；跨周目也適用。沿用已勾選的結算穿裝／出售與開局上限；其他解鎖條件不足時等待。兩章周目各自解鎖，開荒沿所選章節推進。六周目完成後等待，關閉開荒則固定重刷。</small>
      <h4>定時退圖刷卡</h4><label><input data-setting="timedExitEnabled" type="checkbox"> 到時收尾拾取並結束結算（固定地圖，與開荒互斥）</label>
      <div class="row"><label>局內幾分鐘後收尾<input data-setting="timedExitMinutes" type="number" min="0.1" max="180" step="0.1"></label><label>收尾最長局內秒數<input data-setting="cleanupSeconds" type="number" min="0" max="120"></label></div>
      <button id="tree-card-preset">套用樹精卡循環：一周目斐揚森林／3分鐘</button><p id="timed-exit-status" class="hint"></p>
      <small>只作用於所選副本與周目。到時先收取已出現的卡片、裝備、寵物蛋（卡片優先），再走原生結束結算；未撿到的不會憑空入帳。勾選自動遠征後重進同圖，受開局上限與結算整理設定控制。分鐘與收尾秒數均為局內時間，2x下約減半；組隊、劇情、PVP、無限之塔、錄像不使用此功能。</small>
      </details>
      <details><summary>結算後裝備整理</summary>
      <label><input data-setting="autoEquip" type="checkbox"> 打完副本後自動一鍵穿更優裝備</label>
      <small>使用遊戲一鍵穿裝：比較裝備分數，武器保持原類型；先穿裝，再出售。原裝備插卡不會自動移到新裝備。</small>
      <label><input data-setting="autoSell" type="checkbox"> 打完副本後自動出售勾選品質的裝備</label>
      <div class="checkrow">${['普通', '優良', '稀有', '史詩', '傳說'].map((name, q) => `<label><input data-sell-quality="${q}" type="checkbox"> ${name}</label>`).join('')}</div>
      <small>總開關和品質均需勾選，預設全部關閉。不出售穿著中、受保護、初始、角色專屬、已插卡及已精煉裝備，不出售卡片。整理未完成前不開始下一場；取消重複遠征仍可單獨整理。</small></details>
      <details><summary>五欄位寶箱優先級</summary>
      <label><input data-setting="chestSmartReroll" type="checkbox"> 智能追首選：前兩欄整組、後三欄單張優先</label>
      <label><input data-setting="chestFillFirst" type="checkbox"> 同優先級先補空欄、讓神格成型，再均衡等級</label>
      <small id="chest-stage"></small><br><small>依已填欄位數分階段：先用整組快速選定任意兩欄，之後優先單張追其餘三欄首選；缺少目標類型或單張不可用時，剩餘整組仍可補齊。已有首選就保住它，不整組冒險；整組不可用時可改單張。先比配置優先級，普通物品鎖定品種後不對不可達目標浪費次數。</small>
      <p class="hint">每行一級，同一行可並列多項（用 | 分隔）。先選要加入的級別，再從物品表選入；同級自動並列，選「新增優先級」另起一級。任一並列首選命中都視為第一優先級。空白＝無指定；可填名稱／ID，包含匹配須寫 *傷害*。</p>
      ${Object.entries(SLOT_NAMES).map(([id, name]) => `<h4>${name}</h4><label>加入哪個優先級<select data-priority-tier="${id}" aria-label="${name}加入優先級"><option value="new">新增優先級</option></select></label><select data-catalog="${id}"><option>等待物品表…</option></select><textarea data-priority="${id}" placeholder="第一優先級 A | 第一優先級 B\n第二優先級 C | 第二優先級 D"></textarea>`).join('')}
      <h4>指定神格覆蓋／選後放逐</h4>
      <label><input data-setting="deityOverrideEnabled" type="checkbox"> 指定神格出現時優先覆蓋（高於寶箱第一優先級）</label>
      <select data-deity-list="deityOverrides" aria-label="加入優先覆蓋神格"><option value="">等待神格表…</option></select>
      <textarea data-setting="deityOverrides" aria-label="優先覆蓋神格名單" placeholder="火箭術 神格 [firebolt]\n冰箭術 神格 [coldbolt] | 雷擊術 神格 [lightning]"></textarea>
      <small>僅在指定神格已出現且原生允許時優先選取，不額外追抽。每行一級、| 並列；替換後不回換同級／較低優先級神格，可換更高級指定神格。替換會失去原神格累計等級，沿用遊戲確認流程。</small>
      <label><input data-setting="deityBanishAfterPick" type="checkbox"> 本局選過的神格再次出現時自動放逐寶箱牌</label>
      <label>放逐名單（留空＝所有職業／技能神格）</label>
      <select data-deity-list="deityBanishTargets" aria-label="加入選後放逐神格"><option value="">等待神格表…</option></select>
      <textarea data-setting="deityBanishTargets" aria-label="選後放逐神格名單" placeholder="留空：所有職業／技能神格；也可指定火箭術 神格 [firebolt]"></textarea>
      <small>只放逐本局已實際取得、再次出現且有可用放逐按鈕的神格；未取得前不放逐。不移除目前神格，不消耗重抽次數，不影響技能升級牌。會消耗遊戲放逐次數（與技能放逐共用）；次數不足按原選牌設定處理。兩項設定均隨職業保存，預設關閉。</small>
      <label>允許的重抽方式／非智能模式先後順序<select data-setting="rerollMode"><option value="card-deck">單張＋整組（非智能時先單張）</option><option value="deck-card">整組＋單張（非智能時先整組）</option><option value="card">僅重抽單張</option><option value="deck">僅重抽整組</option><option value="off">不重抽</option></select></label>
      <small>智能開啟時依可達目標決定方式；關閉後依上述先後順序，遇到首選即選。僅單張／僅整組／不重抽始終有效。重抽遵守上限及保留次數，不為稀有度單獨追抽；首選全部留空時不重抽。</small>
      <div class="row"><label>每箱重抽上限<input data-setting="maxRerolls" type="number" min="0" max="50"></label><label>保留單張次數<input data-setting="reserveCard" type="number" min="0" max="99"></label><label>保留整組次數<input data-setting="reserveDeck" type="number" min="0" max="99"></label></div>
      <label>重抽用盡／達上限後<select data-setting="exhausted"><option value="best">從現有卡片選最優項</option><option value="wait">等待手動選擇</option></select></label>
      <small>使用遊戲原有重抽次數；不購買、不補充。每局剩餘次數以遊戲按鈕為準。</small></details>
      <details><summary>走位、拾取與運行設定</summary>
      <div class="checkrow"><label><input data-setting="dodge" type="checkbox"> 自動避怪</label><label><input data-setting="chestHunt" type="checkbox"> 自動尋寶</label><label><input data-setting="pickups" type="checkbox"> 安全拾取掉落物</label></div>
      <label>寶箱五欄總等級達標後停止主動尋寶<input data-setting="stopChestPickupAtTotal" type="number" min="0" max="99999" step="1"></label>
      <label>局內角色等級達標後停止主動拾取經驗<input data-setting="stopXpPickupAtLevel" type="number" min="0" max="99999" step="1"></label>
      <small>兩項各自生效，填 0 關閉門檻。寶箱首張算 1 級，空欄算 0。單人遠征尾王擊倒後，原生倒數期間會優先拾取磁鐵、裝備、卡片與寵物蛋，並恢復主動拾取經驗。</small>
      <p id="pickup-threshold-status" class="hint"></p>
      <label>優先拾取磁鐵間隔（局內秒，0＝沿用一般拾取）<input data-setting="magnetInterval" type="number" min="0" max="600" step="1" placeholder="例如 30"></label>
      <small>單人遠征開啟安全拾取後生效。達到間隔便搜尋全圖並優先走向可安全接近的磁鐵，實際拾取後重新計時。2 倍速時，30 局內秒約為 15 秒。</small>
      <label><input data-setting="bellShelter" type="checkbox"> 鐘罩倒數自動進罩（需開啟自動避怪）</label><small id="bell-status"></small>
      <label><input data-setting="background" type="checkbox"> 背景掛機：切換分頁繼續運行</label><small id="background-status"></small>
      <label>遊戲「新版本」提示<select data-setting="gameUpdateAction"><option value="manual">手動選擇</option><option value="later">自動選「稍後」</option><option value="reload">自動選「重新整理」</option></select></label>
      <small>設定後在遊戲顯示原生新版本提示時生效，助手暫停也適用。</small>
      <label><input data-setting="autoDoubleSpeed" type="checkbox"> 進入單人遠征自動2倍速</label><small id="speed-status"></small>
      <small>需啟動助手，每局只設定一次；局中勾選也可生效。保留遊戲因卡頓降速及手動改速，取消勾選不改變當前速度。</small>
      <label>避怪安全距離<input data-setting="safety" type="number" min="25" max="200"></label>
      <label>尋找寶箱最大距離<input data-setting="chestRange" type="number" min="100" max="12000"></label>
      <label>尋找掉落物最大距離<input data-setting="lootRange" type="number" min="100" max="12000"></label>
      <label>組隊掉落分配<select data-setting="partyRoll"><option value="greed">貪婪</option><option value="need">需求</option><option value="pass">放棄</option><option value="manual">等待手動</option></select></label>
      <label>每次選卡等待毫秒<input data-setting="delay" type="number" min="850" max="5000"></label>
      <p class="hint">安全目標中優先寶箱與磁鐵，再拾取其他掉落。方向鍵／WASD 或畫面點擊後讓出操作 3 秒。背景模式會暫時關閉遊戲「離開自動暫停」，並用背景時鐘繼續運行；保留手動暫停。瀏覽器凍結／卸載分頁或電腦休眠仍會中斷。</p>
      </details>
      <details><summary>診斷與日誌</summary>
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
    ui.querySelector('#stored-skill').onclick = () => { stopMove(); openStored('skill', true); renderStatus(); };
    ui.querySelector('#stored-chest').onclick = () => { stopMove(); openStored('chest', true); renderStatus(); };
    ui.querySelector('#stored-keep').onclick = () => {
      const native = nativeSaveApi();
      if (!saveGameReady(native) || state.game.state !== 'levelup' || !['lv', 'chest'].includes(native.curT) || $('#picker')?.classList.contains('closing')) return;
      native.keep(); state.savedBatch = null; state.savedHold = true; state.manualSelection = null; resetPicker(); renderStatus(); log('已繼續保存目前牌，暫緩本局自動開啟；按開啟或切換範圍可恢復');
    };
    ui.querySelector('#mail-save').onclick = () => {
      if (state.mailBusy) return;
      const next = normalizeMailSettings(Object.fromEntries([...ui.querySelectorAll('[data-mail]')].map(input => [input.dataset.mail, input.value])));
      const error = mailSettingsError(next);
      if (error) { state.mailStatus = `${error}；仍使用上次已保存的通知設定`; log(state.mailStatus); renderMailStatus(); return; }
      try { localStorage.setItem(MAIL_STORAGE, JSON.stringify(next)); }
      catch { state.mailStatus = '通知設定保存失敗，仍使用原設定'; log(state.mailStatus); renderMailStatus(); return; }
      if (Object.keys(next).some(key => next[key] !== mailSettings[key])) { state.mailQueue = []; saveMailDigest(null); }
      mailSettings = next; state.mailStatus = '通知設定已保存，請先發送測試郵件'; populateMailSettings(); renderMailStatus(); log(state.mailStatus);
    };
    ui.querySelector('#mail-test').onclick = () => {
      if (state.mailBusy || state.mailQueue.length) return;
      if (queueMail('test', { title: 'ro.hans幸存者助手：郵件通知測試', message: '這是一封 EmailJS 通道測試郵件，不表示角色死亡。收到後即可開啟遠征死亡提醒。', occurred_at: new Date().toLocaleString('zh-TW', { hour12: false }) })) deathMailStep(performance.now());
    };
    ui.querySelector('#mail-clear').onclick = () => {
      if (state.mailBusy) return;
      try { localStorage.removeItem(MAIL_STORAGE); } catch { state.mailStatus = '無法清空通知設定，請檢查瀏覽器儲存'; renderMailStatus(); return; }
      mailSettings = { ...MAIL_DEFAULTS }; cfg.deathMailEnabled = false; state.mailQueue = []; saveMailDigest(null); state.mailStatus = '通知設定已清空，死亡提醒已關閉';
      save(); populateMailSettings(); populate(); log(state.mailStatus);
    };
    ui.querySelector('#job-profile').onchange = event => {
      cfg.enabled = false; stopMove(); releaseTownKeys(); syncBackground();
      switchProfile(event.target.value); log('已切換基礎職業配置並暫停助手；啟動時載入目前角色的配置');
    };
    ui.querySelector('#copy-shared-profile').onclick = () => {
      if (!cfg.profileJob || !cfg.jobProfiles.shared) { log('請先選擇要接收備份的職業'); return; }
      cfg = validateConfig({ ...cfg, ...profileSettings(cfg.jobProfiles.shared), enabled: false });
      stopMove(); releaseTownKeys(); syncBackground(); save(); resetPicker(); populate(); log('已把舊版共用備份複製到此職業，保持暫停');
    };
    ui.querySelector('#tree-card-preset').onclick = () => {
      if (!cfg.repeat) state.runsStarted = 0;
      cfg = validateConfig({ ...cfg, repeat: true, progression: false, expedition: 'payon', expeditionLap: 1, timedExitEnabled: true, timedExitMinutes: 3, cleanupSeconds: 20, pickups: true });
      state.timedExit = null; state.flow = null; state.expeditionProbe = null; state.farmPlan = null; state.launchStage = ''; state.launchLap = 0; state.launchPending = false;
      stopMove(); save(); populate(); log('已設定一周目斐揚森林3分鐘刷卡循環；到時收尾拾取後結算，啟動助手後執行');
    };
    ui.addEventListener('keydown', e => { if (e.key !== 'F8' && e.key !== 'F9') e.stopPropagation(); });
    ui.addEventListener('keyup', e => e.stopPropagation());
    ui.addEventListener('input', e => {
      const el = e.target;
      if (el.dataset.priority) { cfg.priorities[el.dataset.priority] = el.value.slice(0, 5000); syncPriorityTiers(el.dataset.priority); save(); }
      if (el.id === 'banish-filter') renderExclusions();
    });
    ui.addEventListener('change', e => {
      const el = e.target;
      if (el.dataset.setting || el.dataset.cardPolicy) {
        const key = el.dataset.setting || 'storedOpenMode', wasRepeat = cfg.repeat;
        const patch = { ...cfg };
        if (el.dataset.cardPolicy) {
          const open = [];
          for (const input of ui.querySelectorAll('[data-card-policy]')) {
            patch[input.dataset.cardPolicy] = input.value !== 'manual';
            if (input.value === 'open') open.push(input.dataset.cardPolicy);
          }
          patch.storedOpenMode = open.length === 2 ? 'both' : open[0] || 'manual';
        } else patch[key] = el.type === 'checkbox' ? el.checked : el.value;
        if (key === 'progression' && patch.progression) patch.timedExitEnabled = false;
        cfg = validateConfig(patch); stopMove(); releaseTownKeys();
        if (key === 'storedOpenMode') { state.savedHold = false; if (state.savedBatch) state.savedBatch.mode = cfg.storedOpenMode; }
        if (['skillLevelGate','skillSaveAtLevel','chestLevelGate','chestSaveAtTotal'].includes(key)) state.savedHold = false;
        if (['timedExitEnabled', 'timedExitMinutes', 'cleanupSeconds', 'expedition', 'expeditionLap', 'progression'].includes(key)) state.timedExit = null;
        if (key === 'autoDoubleSpeed') resetAutoSpeed();
        if (['magnetInterval', 'stopChestPickupAtTotal', 'stopXpPickupAtLevel'].includes(key)) el.value = cfg[key];
        if (key === 'deathMailDigestMinutes') el.value = cfg.deathMailDigestMinutes;
        if (key === 'deathMailEnabled' && !cfg.deathMailEnabled) { state.mailQueue = state.mailQueue.filter(job => job.kind !== 'death'); saveMailDigest(null); }
        if (key === 'repeat' && !wasRepeat && cfg.repeat) state.runsStarted = 0;
        if (['repeat', 'progression', 'expedition', 'expeditionLap'].includes(key)) { state.flow = null; state.launchStage = ''; state.launchLap = 0; state.launchPending = false; state.gameoverAt = null; state.expeditionProbe = null; state.farmPlan = null; state.progressionStatus = '從所選地圖開始，已通關則自動推進'; }
      }
      if (el.dataset.nativeSave) {
        if (setNativeSave(el.dataset.nativeSave, el.checked)) log(`遊戲${el.dataset.nativeSave === 'chest' ? '寶箱' : '升級選卡'}保存：${el.checked ? '開啟' : '關閉'}`);
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
      if (el.dataset.deityList && el.value) {
        const key = el.dataset.deityList;
        const result = appendPriorityTier(cfg[key], displayPriority(el.value, 'deity', state.catalog));
        cfg[key] = result.value.slice(0, 5000); ui.querySelector(`[data-setting="${key}"]`).value = cfg[key]; el.value = '';
        if (!result.added) log('該神格已在名單內，已保留原設定');
      }
      save(); syncBackground();
      if (['timedExitEnabled', 'progression'].includes(el.dataset.setting)) {
        ui.querySelector('[data-setting="timedExitEnabled"]').checked = cfg.timedExitEnabled;
        ui.querySelector('[data-setting="progression"]').checked = cfg.progression;
      }
      renderStatus();
    });
    ui.querySelector('#banish-toggle').onclick = () => { cfg.banish = !cfg.banish; save(); renderStatus(); };
    ui.querySelector('#exclude-toggle').onclick = () => { cfg.banishExcludeEnabled = !cfg.banishExcludeEnabled; save(); renderStatus(); };
    ui.querySelector('#read-stages').onclick = () => {
      if (visible($('#stages'))) { readStages(); log('副本清單已更新'); return; }
      const prompt = $('#lobby-prompt');
      if (visible(prompt) && NPC_NAMES.captain.test(prompt.textContent)) { prompt.click(); readStages(); log('已打開隊長的副本清單'); }
      else log('請先到遠征隊長附近，或手動打開遠征清單後再讀取');
    };
    ui.querySelector('#rescan').onclick = () => { resetPicker(); state.flow = null; state.npcApproach = null; state.expeditionProbe = null; state.farmPlan = null; state.errorCount = 0; if (!state.hooks) attach(); readStages(); log('已重新識別；新版已保存牌保留原重抽計數'); };
    ui.querySelector('#diagnose').onclick = () => {
      const g = state.game, picker = $('#picker'), kind = picker && pickerKind(picker);
      const report = { version: VERSION, bridge: state.bridge, state: g?.state, background: cfg.background, backgroundClock: state.backgroundStatus, hidden: document.hidden, autoPause: state.settings?.autoPause, enemies: g?.enemies?.length, chests: g?.pickups?.filter(p => p.kind === 'chest' && !p.dead).length, drops: g?.pickups?.filter(p => !p.dead).length, skillSlots: cfg.skillSlots, owned: ownedSkills(), totalSkillLevels: readTotalSkillLevel(), chestSlots: ownedChestSlots(), levelSaving: { levels: readSavingLevels(), skillEnabled: cfg.skillLevelGate, skillAt: cfg.skillSaveAtLevel, chestEnabled: cfg.chestLevelGate, chestAt: cfg.chestSaveAtTotal }, postRun: state.postRun?.stage, autoEquip: cfg.autoEquip, autoSell: cfg.autoSell, sellQualities: cfg.sellQualities, basicAttack: basicAttackId(), usedRerolls: state.used, repeatStage: cfg.expedition, repeatLap: cfg.expeditionLap, autoRuns: state.runsStarted, banish: cfg.banish, banishBasic: cfg.banishBasic, banishExcludeEnabled: cfg.banishExcludeEnabled, banishExclude: cfg.banishExclude,
        deity: { overrideEnabled: cfg.deityOverrideEnabled, overrides: cfg.deityOverrides, banishAfterPick: cfg.deityBanishAfterPick, banishTargets: cfg.deityBanishTargets, acquired: [...rememberDeity(g)] },
        stored: { mode: cfg.storedOpenMode, supported: !!nativeSaveApi(), skillSaving: nativeSaveApi()?.prefLv(), chestSaving: nativeSaveApi()?.prefCh(), counts: storedCounts(g, picker && pickerKind(picker)), batch: state.savedBatch?.mode, manualHold: state.savedHold },
        town: { bridge:state.townBridge, sceneAge:state.townScene ? Math.round(performance.now()-state.townScene.at) : null, yaw:state.townCamera?.yaw,
          player:state.townScene?.player, npcs:state.townScene?.npcs, target:state.npcApproach?.kind, distance:state.npcApproach?.distance },
        email: { enabled: cfg.deathMailEnabled, configured: !mailSettingsError(mailSettings), queued: state.mailQueue.length, digestMinutes: cfg.deathMailDigestMinutes, digestCount: state.mailDigest?.count || 0, sending: state.mailBusy, accepted: state.mailAccepted, status: state.mailStatus },
        profile: { job: cfg.profileJob, gameJob: gameJobId(g), saved: Object.keys(cfg.jobProfiles) },
        timedExit: { enabled: cfg.timedExitEnabled, minutes: cfg.timedExitMinutes, cleanupSeconds: cfg.cleanupSeconds, phase: state.timedExit?.stage, pending: state.timedExit ? [...state.timedExit.items].filter(item => !item.dead).length : 0 },
        speed: { enabled: cfg.autoDoubleSpeed, native: g?.roSpd, applied: state.speedApplied, handled: state.speedDone, attempted: state.speedAttempted, status: state.speedStatus },
        expedition: { progression: cfg.progression, status: state.progressionStatus, stageChapter: state.stageChapter, stageLap: state.stageLap, laps: state.laps, stages: state.stages, launchLap: state.launchLap, probe: state.expeditionProbe, farming: state.farmPlan },
        bell: { enabled: cfg.bellShelter, status: state.bellStatus, active: !!state.bell,
          ...(state.bell ? { x: state.bell.x, y: state.bell.y, radius: state.bell.radius, sealed: state.bell.sealed, struck: state.bell.struck, charge: state.bell.charge } : {}) },
        cards: visible(picker) && kind ? [...picker.querySelectorAll('#pk-cards .pk-card')].map((b, i) => { const c = readCard(b, i, kind); return { name: c.name, id: c.id, slot: c.slot, sub: c.sub, identitySource: c.identitySource, rarity: c.rarity, lines: c.lines }; }) : [] };
      ui.querySelector('#config').value = JSON.stringify(report, null, 2); ui.querySelector('#config').closest('details').open = true;
    };
    ui.querySelector('#export').onclick = () => { ui.querySelector('#config').value = JSON.stringify(cfg, null, 2); };
    ui.querySelector('#import').onclick = () => {
      try { cfg = restoreConfig(JSON.parse(ui.querySelector('#config').value)); cfg.enabled = false; stopMove(); releaseTownKeys(); state.expeditionProbe = null; state.farmPlan = null; state.timedExit = null; state.flow = null; state.savedBatch = null; state.savedHold = false; state.launchStage = ''; state.launchLap = 0; state.launchPending = false; resetAutoSpeed(); syncBackground(); save(); populate(); log('設定已匯入，保持暫停'); } catch (error) { log(`匯入失敗：${error.message}`); }
    };
    populateMailSettings(); populate(); refreshCatalog();
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
    if (!e.repeat && !e.ctrlKey && !e.altKey && !e.metaKey && /^b$/i.test(e.key) && saveGameReady() && state.game.state === 'playing') { state.savedHold = false; state.savedBatch = null; state.manualSelection = state.game; state.savedOpenAt = performance.now(); }
    if (e.isTrusted && /^(w|a|s|d|arrowup|arrowdown|arrowleft|arrowright)$/i.test(e.key)) { state.manualUntil = performance.now() + 3000; stopMove(); releaseTownKeys(); }
  }, true);
  window.addEventListener('click', e => {
    if (state.nativeDispatch) return;
    const button = e.target?.closest?.('#sv-bar button[data-t],#sv-open');
    if (!button || button.disabled || !saveGameReady()) return;
    state.savedBatch = null; state.savedHold = button.dataset.t === 'keep'; state.manualSelection = state.savedHold ? null : state.game; state.savedOpenAt = performance.now(); resetPicker();
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

