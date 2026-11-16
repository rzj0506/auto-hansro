'use strict';
const assert = require('node:assert/strict');
const { test } = require('node:test');
const vm = require('node:vm');
const C = require('../src/ro-survivors-helper.user.js');
const native = require('./fixtures/native-ui.json');
const catalog = [
  ['p_cd','potion'],['p_hp','potion'],['e_dmg','elixir'],['e_hp','elixir'],
  ['b_cd','blessing'],['b_dmg','blessing'],['d_int','dish'],['d_str','dish'],
  ['firebolt','deity'],['g_avarice','deity'],
].map(([id,slot])=>({id,slot,name:id}));
const first = {potion:'p_cd',elixir:'e_dmg',blessing:'b_cd',dish:'d_int',deity:'firebolt'};
const config = extra => C.validateConfig({...C.DEFAULTS,priorities:first,...extra});
const card = (id, extra={}) => ({...catalog.find(c=>c.id===id),rarity:1,index:0,canReroll:true,...extra});
const budget = {used:0,card:9,deck:9};
const pool = vm.runInNewContext(`(${native.chestSlotItems})`,{ws:Object.fromEntries(catalog.filter(c=>c.id!=='firebolt').map(c=>[c.id,c]))});
const reachable = (owned, options={}) => ({reachableBySlot:Object.fromEntries(Object.keys(first).map(slot=>[slot,
  pool.call({slots:new Map(Object.entries(owned||{}))},slot,options.learned||['firebolt'],{swap:!!options.swap,banished:new Set(options.banished||[]),useless:new Set(options.useless||[])})
])),swapDeity:!!options.swap});
const decision = (cards, owned={}, extra={}, moreBudget={}, deck=true, context=reachable(owned)) =>
  C.chestDecision(cards,config(extra),{...budget,...moreBudget},deck,catalog,owned,context);

test('first-tier priority always beats an empty second-tier slot, including when reroll is exhausted',()=>{
  const owned={deity:{item:'firebolt',level:13}};
  const offered=[card('firebolt'),card('p_hp',{index:1,rarity:3})];
  for(const extra of [{chestReroll:false},{maxRerolls:0},{rerollMode:'off'}]) {
    assert.equal(decision(offered,owned,extra).card.id,'firebolt');
  }
  assert.equal(decision(offered,owned,{}, {used:6}).card.id,'firebolt');
});

test('visible target type uses single reroll even when the non-smart preference is deck first',()=>{
  const result=decision([card('p_hp')],{},{rerollMode:'deck-card'});
  assert.equal(result.type,'card');assert.equal(result.targetSlot,'potion');assert.match(result.reason,/單張定向/);
});

test('missing higher-need type uses deck; once it appears the next decision uses single',()=>{
  const owned={blessing:{item:'b_dmg',level:4},dish:{item:'d_str',level:11},deity:{item:'g_avarice',level:13}};
  const context=reachable(owned,{swap:true});
  const offer=[card('b_dmg'),card('d_str',{index:1}),card('g_avarice',{index:2})];
  const a=decision(offer,owned,{}, {},true,context);
  assert.equal(a.type,'deck');assert.equal(a.targetSlot,'potion');
  const b=decision([card('p_hp'),card('g_avarice',{index:1})],owned,{}, {used:1},true,context);
  assert.equal(b.type,'card');assert.equal(b.card.id,'p_hp');
});

test('when deck is unavailable or prohibited, pursue a reachable lower-need type in the current hand',()=>{
  const owned={deity:{item:'g_avarice',level:13}};
  const context=reachable(owned,{swap:true});
  for(const [extra,more,available] of [[{rerollMode:'card'},{},true],[{}, {reserveDeck:0,deck:0},true],[{}, {},false]]) {
    const result=decision([card('g_avarice')],owned,extra,more,available,context);
    assert.equal(result.type,'card');assert.equal(result.targetSlot,'deity');
  }
});

test('hold the first-tier card, reroll only another card toward a more needed first-tier slot, then pick that hit',()=>{
  const owned={deity:{item:'firebolt',level:13}};
  const before=decision([card('firebolt'),card('p_hp',{index:1})],owned);
  assert.equal(before.type,'card');assert.equal(before.card.id,'p_hp');assert.match(before.reason,/保留現有第一優先級/);
  const after=decision([card('firebolt'),card('p_cd',{index:1})],owned,{}, {used:1});
  assert.equal(after.type,'pick');assert.equal(after.card.id,'p_cd');
});

test('never discard an existing first-tier card with deck reroll, even when all missing types are offscreen',()=>{
  const owned={deity:{item:'firebolt',level:13},dish:{item:'d_str',level:12}};
  for(const rerollMode of ['card-deck','deck-card','deck','card','off']) {
    const result=decision([card('firebolt'),card('d_str',{index:1})],owned,{rerollMode});
    assert.equal(result.type,'pick');assert.equal(result.card.id,'firebolt');
  }
});

test('same-need candidates do not consume rerolls for rarity or minor level balancing',()=>{
  assert.equal(decision([card('p_cd',{rarity:0}),card('e_hp',{rarity:3,index:1})]).type,'pick');
  const owned={potion:{item:'p_cd',level:13},elixir:{item:'e_dmg',level:1}};
  assert.equal(decision([card('p_cd'),card('e_hp',{index:1})],owned).type,'pick');
});

test('native pool locks a filled ordinary slot; neither single nor deck can fix that item',()=>{
  const owned={potion:{item:'p_hp',level:12}};
  const context=reachable(owned);
  assert.deepEqual(Array.from(context.reachableBySlot.potion),['p_hp']);
  assert(!C.chestTargets(config(),catalog,owned,context).some(t=>t.slot==='potion'));
  const onlyPotion={priorities:{potion:'p_cd'}};
  const result=decision([card('p_hp')],owned,onlyPotion,{},true,context);
  assert.equal(result.type,'pick');assert.match(result.reason,/不可達.*鎖定/);
  assert.equal(decision([card('p_hp')],owned,{...onlyPotion,exhausted:'wait'},{},true,context).type,'wait');
});

test('deity replacement is reachable only with swap permission, learned target and no banishment',()=>{
  const owned={potion:{item:'p_cd',level:9},deity:{item:'g_avarice',level:3}};
  const offer=[card('p_cd'),card('g_avarice',{index:1})];
  assert.equal(decision(offer,owned,{}, {},true,reachable(owned,{swap:true})).type,'card');
  for(const options of [{swap:false},{swap:true,learned:[]},{swap:true,banished:['firebolt']}]) {
    const result=decision(offer,owned,{}, {},true,reachable(owned,options));
    assert.equal(result.type,'pick');assert.equal(result.card.id,'p_cd');
  }
});

test('banished and useless first-tier items are filtered using the native read-only pool',()=>{
  for(const options of [{banished:['p_cd']},{useless:['p_cd']}]) {
    const result=decision([card('p_hp')],{},{priorities:{potion:'p_cd'}},{},true,reachable({},options));
    assert.equal(result.type,'pick');
  }
});

test('unknown pools never justify additional rerolls when a first-tier card is already safe',()=>{
  const owned={deity:{item:'firebolt',level:13}};
  const result=decision([card('firebolt'),card('p_hp',{index:1})],owned,{}, {},true,{});
  assert.equal(result.type,'pick');assert.equal(result.card.id,'firebolt');
});

test('disabling smart reroll restores configured order and stops at the first hit',()=>{
  const offered=[card('p_hp')];
  assert.equal(decision(offered,{},{chestSmartReroll:false,rerollMode:'deck-card'}).type,'deck');
  assert.equal(decision(offered,{},{chestSmartReroll:false,rerollMode:'card-deck'}).type,'card');
  const owned={deity:{item:'firebolt',level:13}};
  assert.equal(decision([card('firebolt'),card('p_hp',{index:1})],owned,{chestSmartReroll:false}).type,'pick');
});

test('disabling fill/balance prevents additional goal-chasing once any first-tier card appears',()=>{
  const owned={deity:{item:'firebolt',level:13}};
  assert.equal(decision([card('firebolt'),card('p_hp',{index:1})],owned,{chestFillFirst:false}).type,'pick');
});

test('single-only, deck-only and off modes stay hard limits under the intelligent strategy',()=>{
  assert.equal(decision([card('p_hp')],{},{rerollMode:'deck'}).type,'deck');
  assert.equal(decision([card('p_hp')],{},{rerollMode:'card'}).type,'card');
  assert.equal(decision([card('p_hp')],{},{rerollMode:'off'}).type,'pick');
  const owned={dish:{item:'d_str',level:11}};
  assert.equal(decision([card('d_str')],owned,{rerollMode:'card'}).type,'pick');
});

test('maximum and reserve budgets also limit additional rerolls while protecting first-tier cards',()=>{
  const owned={deity:{item:'firebolt',level:13}}, offer=[card('firebolt'),card('p_hp',{index:1})];
  for(const [extra,more] of [[{maxRerolls:0},{}],[{}, {used:6}],[{reserveCard:9},{}],[{chestReroll:false},{}],[{}, {card:0}]]) {
    const result=decision(offer,owned,extra,more);assert.equal(result.type,'pick');assert.equal(result.card.id,'firebolt');
  }
  assert.equal(decision([card('p_hp')],{},{reserveCard:9}).type,'deck');
  assert.equal(decision([card('p_hp')],{},{reserveCard:9,reserveDeck:9}).type,'pick');
});

test('same-tier selection prefers completing a deity, then preserves accumulated levels before rarity',()=>{
  const owned={potion:{item:'p_cd',level:10},deity:{item:'g_avarice',level:13}};
  assert.equal(decision([card('p_cd'),card('firebolt',{index:1})],owned).card.id,'firebolt');
  const equivalent=config({priorities:{deity:'firebolt | g_avarice'}});
  const ranked=C.rankChest([card('g_avarice',{rarity:0}),card('firebolt',{index:1,rarity:3})],equivalent,owned,catalog);
  assert.equal(ranked[0].id,'g_avarice');
});

test('first-tier matching supports localized names and ID-bearing display tokens in the reachable pool',()=>{
  const localized=catalog.map(item=>({...item,name:item.id==='p_cd'?'冷卻藥水':item.name}));
  for(const value of ['冷卻藥水','冷卻藥水 [p_cd]','p_cd']) {
    const result=C.chestDecision([card('p_hp')],config({priorities:{potion:value}}),budget,true,localized,{},reachable({}));
    assert.equal(result.type,'card');
  }
});

test('legacy configs default to smart strategy without changing priorities, restrictions, budgets or fallback',()=>{
  const old=C.validateConfig({priorities:first,rerollMode:'deck',maxRerolls:3,reserveCard:2,reserveDeck:1,exhausted:'wait'});
  assert.equal(old.chestSmartReroll,true);assert.equal(old.rerollMode,'deck');assert.equal(old.maxRerolls,3);
  assert.equal(old.reserveCard,2);assert.equal(old.reserveDeck,1);assert.equal(old.exhausted,'wait');assert.deepEqual(old.priorities,first);
  const restored=C.validateConfig(JSON.parse(JSON.stringify({...old,chestSmartReroll:false})));
  assert.equal(restored.chestSmartReroll,false);assert.deepEqual(restored.priorities,first);
});
