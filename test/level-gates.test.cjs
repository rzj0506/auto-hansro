'use strict';
const assert=require('node:assert/strict');
const {test}=require('node:test');
const C=require('../src/ro-survivors-helper.user.js');
const cfg=patch=>C.validateConfig({...C.DEFAULTS,...patch});

test('role policy uses in-run character level with inclusive saving threshold, independently of item totals',()=>{
 const config=cfg({skillLevelGate:true,skillSaveAtLevel:100});
 assert.equal(C.levelSavePolicy('skill',config,{role:99,chest:1000}),false);
 assert.equal(C.levelSavePolicy('skill',config,{role:100,chest:0}),true);
 assert.equal(C.levelSavePolicy('chest',config,{role:100,chest:0}),undefined);
 assert.equal(C.levelSavePolicy('skill',config,{role:null}),null);
 assert.equal(C.storedKindAllowed('skill',config,'manual',{role:99}),true);
 assert.equal(C.storedKindAllowed('skill',config,'both',{role:100}),false);
 assert.equal(C.storedKindAllowed('skill',config,'skills',{role:100},true),true);
});

test('chest totals count base card as one, empty slot as zero and all five real item levels once',()=>{
 assert.equal(C.chestTotalLevels({}),0);
 assert.equal(C.chestTotalLevels({potion:{level:1},elixir:{level:4},blessing:{level:3},dish:{level:2},deity:{level:10},unknown:{level:999}}),20);
 assert.equal(C.chestTotalLevels(null),null);assert.equal(C.chestTotalLevels({potion:{level:NaN}}),null);
 const config=cfg({chestLevelGate:true,chestSaveAtTotal:20});
 assert.equal(C.levelSavePolicy('chest',config,{role:999,chest:19}),false);assert.equal(C.levelSavePolicy('chest',config,{chest:20}),true);
 assert.equal(C.storedKindAllowed('chest',config,'both',{chest:null}),false);
 assert.equal(C.storedKindAllowed('chest',{...config,chests:false},'both',{chest:1}),false);
});

test('new policies are per job, default off and never inherit removed time/skill-total thresholds',()=>{
 const saved=cfg({noFlipEnabled:true,noFlipMinutes:1,noFlipLevelEnabled:true,noFlipTotalLevel:1,jobProfiles:{mage:{skillLevelGate:true,skillSaveAtLevel:80},knight:{chestLevelGate:true,chestSaveAtTotal:25}}});
 assert.equal(saved.noFlipEnabled,undefined);assert.equal(saved.noFlipTotalLevel,undefined);assert.equal(saved.skillLevelGate,false);
 const restored=C.validateConfig(JSON.parse(JSON.stringify(saved)));
 assert.equal(restored.jobProfiles.mage.skillSaveAtLevel,80);assert.equal(restored.jobProfiles.mage.chestLevelGate,false);
 assert.equal(restored.jobProfiles.knight.chestSaveAtTotal,25);assert.equal(restored.jobProfiles.knight.skillLevelGate,false);
 assert.equal(cfg({skillSaveAtLevel:0}).skillSaveAtLevel,1);assert.equal(cfg({chestSaveAtTotal:1e6}).chestSaveAtTotal,99999);
});

test('NPC search moves beyond an approximate nameplate destination until native interaction range is reached',()=>{
 const npc={left:400,width:60,bottom:355},self={left:400,width:60,bottom:400};
 assert.deepEqual(C.npcApproachPoint(npc,self,0).keys,[]);
 assert.deepEqual(C.npcApproachPoint(npc,self,1).keys,['ArrowDown']);
 assert(C.npcApproachPoint(npc,self,5).keys.includes('ArrowRight'));
});
