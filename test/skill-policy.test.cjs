'use strict';
const assert=require('node:assert/strict');
const {test}=require('node:test');
const C=require('../src/ro-survivors-helper.user.js');
const cfg=extra=>C.validateConfig({...C.DEFAULTS,...extra});
const card=(id,rarity,lines,index=0,extra={})=>({id,name:id,rarity,lines,index,isNew:false,...extra});

test('parallel priorities parse at every tier and both first-tier alternatives stop chest reroll',()=>{
  const text='p_cd | p_hp\np_dmg ｜ p_area';
  assert.deepEqual(C.splitTiers(text),[['p_cd','p_hp'],['p_dmg','p_area']]);
  const config=cfg({priorities:{potion:text}});
  for(const id of ['p_cd','p_hp']) {
    const offered={...card(id,0,''),slot:'potion',canReroll:true};
    const result=C.chestDecision([offered],config,{used:0,card:9,deck:9},true,[],{});
    assert.equal(result.type,'pick');assert.equal(result.card.id,id);assert.equal(C.tierOf(offered,config),0);
  }
  for(const id of ['p_dmg','p_area']) assert.equal(C.tierOf({id,slot:'potion'},config),1);
});

test('adding items can append to any existing tier or create a new tier without changing earlier groups',()=>{
  let result=C.appendPriorityTier('', '冷卻藥水 [p_cd]', 'new');
  assert.equal(result.tier,0);
  result=C.appendPriorityTier(result.value,'生命藥水 [p_hp]',0);
  assert.deepEqual(C.splitTiers(result.value).map(t=>t.map(C.tokenId)),[['p_cd','p_hp']]);
  result=C.appendPriorityTier(result.value,'傷害藥水 [p_dmg]','new');
  assert.equal(result.tier,1);
  result=C.appendPriorityTier(result.value,'範圍藥水 [p_area]',1);
  assert.deepEqual(C.splitTiers(result.value).map(t=>t.map(C.tokenId)),[['p_cd','p_hp'],['p_dmg','p_area']]);
});

test('priority picker prevents duplicate IDs or names but preserves distinct IDs sharing a name',()=>{
  for(const value of ['p_cd','冷卻藥水','冷卻藥水 [p_cd]']) {
    const result=C.appendPriorityTier(value,'冷卻藥水 [p_cd]','new');
    assert.equal(result.added,false);assert.equal(result.tier,0);assert.equal(C.splitTiers(result.value).length,1);
  }
  assert.equal(C.appendPriorityTier('範圍藥水 [p_area]','範圍藥水 [p_reach]',0).added,true);
});

for(const id of C.FIXED) for(const rarityFirst of [false,true])test(`${id} target upgrade outranks legendary damage with rarityFirst=${rarityFirst}`,()=>{
  const cards=[card(id,3,'傷害 +60%',0),card(id,0,'+1 目標',1)];
  assert.equal(C.chooseSkill(cards,C.FIXED,cfg({rarityFirst})).index,1);
});

test('fixed target upgrades outrank other eligible rare/new cards, and two target cards use rarity',()=>{
  const cards=[card('soul_strike',3,'新技能',0,{isNew:true}),card('firebolt',0,'+1 目標',1)];
  assert.equal(C.chooseSkill(cards,C.FIXED,cfg()).id,'firebolt');
  assert.equal(C.chooseSkill([card('firebolt',0,'+1 目標'),card('coldbolt',3,'+2 目標',1)],C.FIXED,cfg()).id,'coldbolt');
  assert.equal(C.skillId('雷撃術'),'lightning');
});

test('target text on a new skill or on non-fixed skills does not receive the fixed-upgrade override',()=>{
  const fresh=card('lightning',0,'攻擊多個目標',1,{isNew:true});
  for(const rarityFirst of [false,true]) assert.equal(C.chooseSkill([card('firebolt',3,'傷害 +60%'),fresh],['firebolt','coldbolt'],cfg({rarityFirst})).id,'firebolt');
  const owned=[...C.FIXED,'soul_strike'];
  assert.equal(C.chooseSkill([card('firebolt',3,'傷害 +60%'),card('soul_strike',0,'+2 目標',1)],owned,cfg()).id,'firebolt');
});

test('sum of skill levels includes basic attack and passives once, excluding unowned derived skills',()=>{
  const levels={firebolt:20,coldbolt:20,lightning:20,soul_strike:20,passive:10,atk_staff:15};
  const ids=[...Object.keys(levels),'atk_staff','firebolt'];let reads=0;
  const game={slots:ids,basicAttack:'atk_staff',skillLevel(id){reads++;return levels[id]}};
  assert.equal(C.totalSkillLevels(game),105);assert.equal(reads,6);
  const native={slots:['firebolt','passive'],basicAttack:'atk_staff',weapons:[{id:'firebolt',rank:20},{id:'atk_staff',rank:15},{id:'derived',rank:999}],passiveRank:new Map([['passive',10]])};
  assert.equal(C.totalSkillLevels(native),45);
});

test('missing, invalid or throwing level data is unknown and cannot trigger level-based no-flip',()=>{
  for(const game of [null,{slots:['firebolt']},{slots:['firebolt'],basicAttack:'atk_staff'},
    {slots:['firebolt'],basicAttack:'atk_staff',skillLevel(){return NaN}},
    {slots:['firebolt'],basicAttack:'atk_staff',skillLevel(){throw Error('not ready')}}]) {
    assert.equal(C.totalSkillLevels(game),null);
    assert.equal(C.noFlipDue({...game,state:'playing',time:99999},cfg({noFlipLevelEnabled:true,noFlipTotalLevel:1})),false);
  }
});

test('time and total-level triggers are independent OR conditions with inclusive thresholds',()=>{
  for(const noFlipEnabled of [false,true]) for(const noFlipLevelEnabled of [false,true])
    for(const time of [599,600]) for(const total of [99,100]) {
      const config=cfg({noFlipEnabled,noFlipMinutes:10,noFlipLevelEnabled,noFlipTotalLevel:100});
      assert.equal(C.noFlipDue({state:'playing',time},config,total),noFlipEnabled&&time>=600||noFlipLevelEnabled&&total>=100);
    }
  for(const state of ['paused','over','lobby']) assert.equal(C.noFlipDue({state,time:9999},cfg({noFlipEnabled:true,noFlipLevelEnabled:true}),9999),false);
  assert.equal(C.noFlipDue({state:'levelup',time:600},cfg({noFlipEnabled:true,noFlipLevelEnabled:true}),null),true);
});

test('old minute settings migrate unchanged and both new trigger fields survive JSON round trip',()=>{
  const old=C.validateConfig({noFlipEnabled:true,noFlipMinutes:7.5});
  assert.equal(old.noFlipEnabled,true);assert.equal(old.noFlipMinutes,7.5);assert.equal(old.noFlipLevelEnabled,false);
  const both=C.validateConfig(JSON.parse(JSON.stringify({...old,noFlipLevelEnabled:true,noFlipTotalLevel:125})));
  assert.equal(both.noFlipLevelEnabled,true);assert.equal(both.noFlipTotalLevel,125);
  assert.equal(cfg({noFlipTotalLevel:0}).noFlipTotalLevel,1);assert.equal(cfg({noFlipTotalLevel:1000000}).noFlipTotalLevel,99999);
});
