'use strict';
const assert=require('node:assert/strict');
const {test}=require('node:test');
const C=require('../src/ro-survivors-helper.user.js');
const config=patch=>C.validateConfig({...C.DEFAULTS,...patch});

test('legacy config keeps three spells and new job-profile data is independently validated',()=>{
  const old=config({fourth:'soul_strike',priorities:{potion:'p_cd'}});
  assert.equal(old.skillSlots, 4);
  assert.equal(old.sixth, '');
  assert.equal(config({ skillSlots: 5 }).skillSlots, 5);
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


test('all native promotions resolve to the right base job without changing actual job identity', () => {
  const { jobs } = require('./fixtures/native-job-run.json');
  const byId = Object.fromEntries(jobs.map(job => [job.id, job]));
  for (const job of jobs) {
    let base = job;
    while (base.base) base = byId[base.base];
    assert.equal(C.gameBaseJobId({ classDef: job }), base.id, job.id);
    assert.equal(C.gameBaseJobId({ promotion: job.id }), base.id, job.id);
    assert.equal(C.gameJobId({ promotion: job.id }), job.id);
  }
  assert.equal(C.gameBaseJobId({ classDef: { id: 'future', base: 'knight' } }), 'swordsman');
  assert.equal(C.gameBaseJobId({ look: { job: 'ninja', promotion: 'future' } }), 'ninja');
});

test('migration prefers an existing base profile, seeds missing families, and keeps old profiles in export', () => {
  const old = { profileJob: 'warlock', first: 'old-top-level', jobProfiles: {
    wizard: { first: 'old-wizard' }, warlock: { first: 'old-warlock', priorities: { potion: 'p_cd' } },
    ranger: { first: 'old-ranger' }, archer: { first: 'base-archer' }, rune_knight: { first: 'old-knight' },
  } };
  const migrated = C.restoreConfig(old);
  assert.equal(migrated.profileJob, 'mage');
  assert.equal(migrated.first, 'old-warlock');
  assert.equal(migrated.priorities.potion, 'p_cd');
  assert.equal(migrated.jobProfiles.archer.first, 'base-archer');
  assert.equal(migrated.jobProfiles.swordsman.first, 'old-knight');
  assert.equal(migrated.jobProfiles.wizard.first, 'old-wizard');
  assert.equal(migrated.jobProfiles.ranger.first, 'old-ranger');
  assert.equal(C.restoreConfig({ ...old, jobProfiles: { ...old.jobProfiles, mage: { first: 'base-mage' } } }).first, 'base-mage');
  assert.equal(C.restoreConfig({ profileJob: 'rebellion', first: 'triple_action' }).jobProfiles.gunslinger.first, 'triple_action');
  assert.deepEqual(C.restoreConfig(JSON.parse(JSON.stringify(migrated))), migrated);
  const edited = C.restoreConfig({ ...migrated, skillReroll: false });
  assert.equal(edited.skillReroll, false);
  assert.equal(edited.jobProfiles.mage.skillReroll, false);
});

test('native update action is global, opt-in and validated on import', () => {
  assert.equal(C.restoreConfig({}).gameUpdateAction, 'manual');
  for (const action of ['later', 'reload']) {
    const settings = C.restoreConfig({ gameUpdateAction: action });
    assert.equal(settings.gameUpdateAction, action);
    assert.equal(C.profileSettings(settings).gameUpdateAction, undefined);
  }
  assert.equal(C.restoreConfig({ gameUpdateAction: 'confirm-all' }).gameUpdateAction, 'manual');
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
