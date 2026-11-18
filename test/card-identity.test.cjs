'use strict';
const assert=require('node:assert/strict');
const {test}=require('node:test');
const C=require('../src/ro-survivors-helper.user.js');

test('native chest cards supply stable IDs and slots independently of translated headings and names',()=>{
 for(const slot of ['potion','elixir','blessing','dish','deity']){
  assert.deepEqual(C.chestCardIdentity('新的翻譯 +2','新的類型','',[],{},{slot,item:'native_item'}),{slot,id:'native_item',identitySource:'native'});
 }
 assert.equal(C.chestCardIdentity('','靈藥','',[],{},{slot:'unknown',item:'x'}).identitySource,'label');
});

test('localized elixir heading accepts new 靈藥 and old 秘藥 while the other current client languages remain recognized',()=>{
 const groups={potion:['藥水','药水','Poción','Potion','Poção'],elixir:['靈藥','灵药','秘藥','秘药','Elixir'],
  blessing:['祝福','Blessing','Bendición','Bênção'],dish:['料理','Dish','Plato','Prato'],deity:['神格','Deity','Divindade']};
 for(const [slot,labels] of Object.entries(groups))for(const sub of labels)assert.equal(C.chestCardIdentity('未知物品',sub,'').slot,slot,sub);
});

test('catalog can identify a known item when a heading changes, but ambiguous names or shared icons are not guessed',()=>{
 const catalog=[{id:'e_dot',slot:'elixir',name:'持續傷害藥劑',icon:'same.png'}];
 assert.deepEqual(C.chestCardIdentity('持續傷害藥劑 +2','新名稱','same.png',catalog),{id:'e_dot',slot:'elixir',identitySource:'catalog'});
 const ambiguous=[...catalog,{id:'p_test',slot:'potion',name:'持續傷害藥劑',icon:'same.png'}];
 assert.equal(C.chestCardIdentity('持續傷害藥劑','新名稱','same.png',ambiguous).identitySource,'unknown');
 assert.equal(C.chestCardIdentity('持續傷害藥劑','靈藥','same.png',ambiguous).id,'e_dot');
});

test('legacy elixir names still match first-tier priorities after native item translations change',()=>{
 const card={id:'e_dot',slot:'elixir',name:'持續傷害藥劑',rarity:0,index:0};
 for(const token of ['持續傷害秘藥','持续伤害秘药','*秘藥*','e_dot','持續傷害藥劑']){
  const config=C.validateConfig({priorities:{elixir:token},chestReroll:false});
  assert.equal(C.tierOf(card,config),0,token);
  assert.equal(C.chestDecision([card],config,{used:0,card:9,deck:9},true).card.id,'e_dot');
 }
 assert.equal(C.matchToken('傷害秘藥',{id:'e_critdmg',slot:'elixir',name:'爆擊傷害藥劑'}),false);
});

test('skill deities retain identity fallback and wholly unknown chest types remain a manual choice',()=>{
 assert.equal(C.chestCardIdentity('火箭術 神格 +2','神格','').id,'firebolt');
 assert.equal(C.chestCardIdentity('火箭術 神格 +2','新類型','').slot,'deity');
 assert.deepEqual(C.chestCardIdentity('未知物品','未知類型',''),{id:'',slot:'',identitySource:'unknown'});
});
