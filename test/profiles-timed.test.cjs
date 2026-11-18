'use strict';
const assert=require('node:assert/strict');
const {test}=require('node:test');
const C=require('../src/ro-survivors-helper.user.js');
const config=patch=>C.validateConfig({...C.DEFAULTS,...patch});

test('legacy config keeps three spells and new job-profile data is independently validated',()=>{
  const old=config({fourth:'soul_strike',priorities:{potion:'p_cd'}});
  assert.deepEqual([old.first,old.second,old.third],C.FIXED);assert.equal(old.profileJob,'');assert.deepEqual(old.jobProfiles,{});
  const cfg=config({profileJob:'swordsman',jobProfiles:{mage:{first:'firebolt',priorities:{potion:'p_cd'}},swordsman:{first:'bash',firstGlobal:false,priorities:{potion:'p_hp'}}}});
  assert.equal(cfg.jobProfiles.swordsman.first,'bash');assert.equal(cfg.jobProfiles.swordsman.enabled,undefined);
  cfg.jobProfiles.swordsman.priorities.potion='p_dmg';assert.equal(cfg.jobProfiles.mage.priorities.potion,'p_cd');
  assert.equal(C.validateConfig(JSON.parse(JSON.stringify(cfg))).jobProfiles.swordsman.first,'bash');
});

test('job identity uses actual promotion before base class and rejects malformed IDs',()=>{
  for(const job of require('./fixtures/native-job-run.json').jobs)assert.equal(C.gameJobId({classDef:job}),job.id);
  assert.equal(C.gameJobId({classDef:{id:'mage'}}),'mage');
  assert.equal(C.gameJobId({classDef:{id:'mage'},look:{promotion:'wizard'}}),'wizard');
  assert.equal(C.gameJobId({classDef:{id:'swordsman'},look:{promotion:'knight'},promotion:'rune_knight'}),'rune_knight');
  assert.equal(C.gameJobId({classDef:{id:'<bad>'}}),'');assert.equal(C.gameJobId({}), '');
});

test('profile captures skill/chest choices but leaves movement, repeat, speed and timer global',()=>{
  const p=C.profileSettings(config({first:'bash',autoDoubleSpeed:true,timedExitEnabled:true}));
  assert.equal(p.first,'bash');assert(p.priorities);assert.equal(p.autoDoubleSpeed,undefined);assert.equal(p.timedExitEnabled,undefined);assert.equal(p.repeat,undefined);
});

test('non-mage profiles choose configured skills or any new skill when first slots are blank',()=>{
  const registry={bash:{name:'狂擊'},magnum:{name:'怒爆'},firebolt:{name:'火箭術'}};
  const cards=[{id:'firebolt',isNew:true,index:0,rarity:3,lines:''},{id:'magnum',isNew:true,index:1,rarity:0,lines:''}];
  assert.equal(C.chooseSkill(cards,['bash'],config({first:'bash',second:'magnum',third:'heal',fourth:'sword'}),registry).id,'magnum');
  assert(C.chooseSkill(cards,['bash'],config({first:'',second:'',third:'',fourth:''}),registry));
  assert.equal(C.chooseSkill(cards,['bash','heal'],{...config({first:'',second:'',third:''}),skillSlots:2},registry),null);
});

test('timed exit defaults off, validates ranges and is mutually exclusive with campaign',()=>{
  assert.equal(config({}).timedExitEnabled,false);
  assert.equal(config({timedExitMinutes:0}).timedExitMinutes,.1);
  assert.equal(config({cleanupSeconds:999}).cleanupSeconds,120);
  assert.equal(config({timedExitEnabled:true,progression:true}).progression,false);
});

test('timed threshold uses game time and applies only to selected single-player stage and lap',()=>{
  const cfg=config({timedExitEnabled:true,expedition:'payon',expeditionLap:2,timedExitMinutes:3});
  const g={state:'playing',time:179.9,stageId:'payon',difficulty:{lap:2},player:{dead:false}};
  assert.equal(C.timedExitDue(g,cfg),false);g.time=180;assert.equal(C.timedExitDue(g,cfg),true);
  for(const patch of [{stageId:'maze'},{difficulty:{lap:1}},{state:'paused'},{state:'over'},{coop:{}},{endless:{}},{story:{}},{isStory:true},{replayMoves:[]},{player:{dead:true}}])assert.equal(C.timedExitDue({...g,...patch},cfg),false);
});
