'use strict';
const assert=require('node:assert/strict');
const {test}=require('node:test');
const vm=require('node:vm');
const C=require('../src/ro-survivors-helper.user.js');
const config=patch=>C.validateConfig({...C.DEFAULTS,priorities:{deity:'g_thought',potion:'p_cd'},...patch});
const catalog=[['g_thought','思考神格'],['firebolt','火箭術 神格'],['coldbolt','冰箭術 神格'],['lightning','雷擊術 神格']].map(([id,name])=>({id,name,slot:'deity'}));
const card=(id,extra={})=>({...catalog.find(c=>c.id===id),id,index:0,rarity:0,canReroll:true,canBanish:true,...extra});
const owned=(id='g_thought',level=13)=>({deity:{item:id,level}});
const context={swapDeity:true,banishLeft:3,skillDeities:['firebolt','coldbolt','lightning']};
const decide=(cards,cfg={},items=owned(),ctx={})=>C.chestDecision(cards,config(cfg),{used:6,card:9,deck:9},true,catalog,items,{...context,...ctx});

test('new deity settings default off and remain independent per job through config round trip',()=>{
 const old=config({});assert.equal(old.deityOverrideEnabled,false);assert.equal(old.deityBanishAfterPick,false);
 const saved=C.validateConfig({jobProfiles:{mage:{deityOverrideEnabled:true,deityOverrides:'火箭術 [firebolt]',deityBanishAfterPick:true},knight:{deityOverrides:'bash'}}});
 const restored=C.validateConfig(JSON.parse(JSON.stringify(saved)));
 assert.equal(restored.jobProfiles.mage.deityOverrides,'火箭術 [firebolt]');assert.equal(restored.jobProfiles.mage.deityBanishAfterPick,true);
 assert.equal(restored.jobProfiles.knight.deityOverrideEnabled,false);assert.equal(restored.jobProfiles.knight.deityBanishAfterPick,false);
 assert.equal(C.profileSettings(restored).deityOverrideEnabled,false);
 assert.equal(config({deityOverrideEnabled:'true',deityBanishTargets:[]}).deityOverrideEnabled,false);
 assert.equal(config({deityOverrides:'x'.repeat(6000)}).deityOverrides.length,5000);
});

test('a specified deity beats a first-tier upgrade or empty first-tier slot regardless of rarity and reroll fallback',()=>{
 const offer=[card('g_thought',{rarity:3}),card('firebolt',{index:1}),card('p_cd',{slot:'potion',name:'冷卻藥水',index:2,rarity:3})];
 assert.notEqual(decide(offer).card.id,'firebolt');
 for(const exhausted of ['best','wait'])for(const rerollMode of ['off','card','deck']){
  const result=decide(offer,{deityOverrideEnabled:true,deityOverrides:'火箭术',chestReroll:false,exhausted,rerollMode});
  assert.equal(result.type,'pick');assert.equal(result.card.id,'firebolt');assert.match(result.reason,/優先覆蓋/);
 }
 assert.equal(decide([card('firebolt')],{deityOverrideEnabled:true,deityOverrides:'firebolt'},{}).card.id,'firebolt');
});

test('explicit deity tiers allow an improvement but preserve same-tier identity and never downgrade later',()=>{
 const cfg={deityOverrideEnabled:true,deityOverrides:'firebolt\ncoldbolt | lightning'};
 assert.equal(decide([card('firebolt')],cfg,owned('coldbolt')).card.id,'firebolt');
 assert.equal(decide([card('lightning',{rarity:3})],cfg,owned('coldbolt')).type,'wait');
 assert.equal(decide([card('coldbolt'),card('g_thought')],cfg,owned('firebolt')).type,'wait');
 const result=decide([card('g_thought'),card('p_cd',{slot:'potion',name:'冷卻藥水',index:1})],cfg,owned('firebolt'));
 assert.equal(result.card.id,'p_cd');
 assert(!C.chestTargets(config(cfg),catalog,owned('firebolt'),{}).some(t=>t.slot==='deity'));
});

test('visible override obeys native replacement permission and absent override never adds pursuit rerolls',()=>{
 const cfg={deityOverrideEnabled:true,deityOverrides:'firebolt'};
 assert.equal(decide([card('firebolt'),card('g_thought')],cfg,owned(),{swapDeity:false}).card.id,'g_thought');
 const result=C.chestDecision([card('coldbolt')],config({...cfg,priorities:{},maxRerolls:6}),{used:0,card:9,deck:9},true,catalog,{},context);
 assert.equal(result.type,'pick');assert.equal(result.card.id,'coldbolt');
});

test('banish only an actually acquired skill deity that reappears, never its first offer or a skill upgrade',()=>{
 const cfg={deityBanishAfterPick:true};
 assert.notEqual(decide([card('firebolt')],cfg,{}).type,'banish');
 assert.equal(decide([card('firebolt')],cfg,owned('firebolt')).type,'banish');
 assert.equal(decide([card('firebolt')],cfg,owned(),{acquiredDeities:new Set(['firebolt'])}).type,'banish');
 assert.notEqual(decide([card('firebolt',{slot:'skill'})],cfg,owned('firebolt')).type,'banish');
 assert.notEqual(decide([card('g_thought')],cfg).type,'banish');
});

test('explicit post-pick banish list restricts targets or opts in an ordinary deity; counts and disabled actions remain hard gates',()=>{
 const cfg={deityBanishAfterPick:true,deityBanishTargets:'火箭術'};
 assert.notEqual(decide([card('coldbolt')],cfg,owned('coldbolt')).type,'banish');
 assert.equal(decide([card('firebolt')],cfg,owned('firebolt')).type,'banish');
 assert.equal(decide([card('g_thought')],{...cfg,deityBanishTargets:'g_thought'}).type,'banish');
 assert.notEqual(decide([card('firebolt',{canBanish:false})],cfg,owned('firebolt')).type,'banish');
 assert.notEqual(decide([card('firebolt')],cfg,owned('firebolt'),{banishLeft:0}).type,'banish');
 assert.notEqual(decide([card('firebolt')],{...cfg,deityBanishAfterPick:false},owned('firebolt')).type,'banish');
});

test('post-pick banishment precedes override upgrades and keeps a different visible desired deity safe',()=>{
 const cfg={deityOverrideEnabled:true,deityOverrides:'firebolt\ncoldbolt',deityBanishAfterPick:true};
 const a=decide([card('coldbolt'),card('firebolt',{index:1})],cfg,owned('coldbolt'));
 assert.equal(a.type,'banish');assert.equal(a.card.id,'coldbolt');
 const b=decide([card('firebolt',{index:1})],cfg,owned('coldbolt'));
 assert.equal(b.type,'pick');assert.equal(b.card.id,'firebolt');
});

test('native banish removes only future item offers, consumes one banish and leaves acquired deity and skill bans intact',()=>{
 const native=require('./fixtures/native-deity.json');
 const banish=vm.runInNewContext(`(${native.banishChestCard})`);
 const slots=new Map([['deity',{item:'firebolt',vals:[1],quality:0}]]), skillBans=new Set(['coldbolt']);
 const g={perksLeft:{banish:2,reroll:7,reroll_card:8},banishedItems:new Set(),banished:skillBans,focusedItems:new Set(['firebolt']),
  deityLearned:()=>['firebolt'],chestOpts(){return{banished:this.banishedItems}},runItems:{slots,roll:()=>[{slot:'potion',item:'p_cd'}],rollSlot(){assert.fail('no fallback roll needed')}}};
 const replacement=banish.call(g,{slot:'deity',item:'firebolt'},[{slot:'deity'}]);
 assert.equal(replacement.item,'p_cd');assert.equal(g.perksLeft.banish,1);assert(g.banishedItems.has('firebolt'));
 assert.equal(slots.get('deity').item,'firebolt');assert.equal(slots.get('deity').vals.length,1);assert.deepEqual([...skillBans],['coldbolt']);
 assert.equal(g.perksLeft.reroll,7);assert.equal(g.perksLeft.reroll_card,8);assert(!g.focusedItems.has('firebolt'));
});
