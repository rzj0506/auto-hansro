'use strict';
const assert=require('node:assert/strict');
const {test}=require('node:test');
const C=require('../src/ro-survivors-helper.user.js');

test('legacy storage defaults to manual opening and retains OR thresholds and all previous priorities',()=>{
 const old=C.validateConfig({noFlipEnabled:true,noFlipMinutes:3,noFlipLevelEnabled:true,noFlipTotalLevel:100,priorities:{deity:'firebolt'},deityBanishAfterPick:true});
 assert.equal(old.storedOpenMode,'manual');assert.equal(old.noFlipMinutes,3);assert.equal(old.noFlipTotalLevel,100);assert.equal(old.priorities.deity,'firebolt');assert.equal(old.deityBanishAfterPick,true);
 assert.equal(C.validateConfig({storedOpenMode:'unknown'}).storedOpenMode,'manual');
 for(const mode of ['manual','skills','chests','both'])assert.equal(C.validateConfig(JSON.parse(JSON.stringify({...old,storedOpenMode:mode}))).storedOpenMode,mode);
});

test('stored opening ranges respect enabled picker types and reached skill-saving thresholds',()=>{
 const cfg=C.validateConfig({});
 for(const mode of ['manual','skills','chests','both']){
  assert.equal(C.storedKindAllowed('skill',cfg,mode),['skills','both'].includes(mode));
  assert.equal(C.storedKindAllowed('chest',cfg,mode),['chests','both'].includes(mode));
 }
 assert.equal(C.storedKindAllowed('skill',{...cfg,skills:false},'both'),false);
 assert.equal(C.storedKindAllowed('chest',{...cfg,chests:false},'both'),false);
 assert.equal(C.storedKindAllowed('skill',cfg,'both',true),false);
 assert.equal(C.storedKindAllowed('chest',cfg,'both',true),true);
});

test('stored counts include parked cards/chest and the current chest once; opening range is job specific',()=>{
 assert.deepEqual(C.storedCounts({pendingLevelUps:3,roChests:2,roChestKeep:[{}]}),{skill:3,chest:3});
 assert.deepEqual(C.storedCounts({state:'levelup',pendingLevelUps:3,roChests:2},'chest'),{skill:3,chest:3});
 assert.deepEqual(C.storedCounts(null),{skill:0,chest:0});
 const cfg=C.validateConfig({jobProfiles:{mage:{storedOpenMode:'skills'},knight:{storedOpenMode:'chests'}}});
 assert.equal(cfg.jobProfiles.mage.storedOpenMode,'skills');assert.equal(cfg.jobProfiles.knight.storedOpenMode,'chests');
 assert(C.PROFILE_KEYS.includes('storedOpenMode'));
});
