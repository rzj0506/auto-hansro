'use strict';
const assert=require('node:assert/strict');
const {test}=require('node:test');
const C=require('../src/ro-survivors-helper.user.js');
const setup={serviceId:'service_fixture',templateId:'template_fixture',publicKey:'public_fixture',toEmail:'user@example.com'};
test('mail defaults off, is global and omits service settings from profiles and common config',()=>{
  assert.equal(C.validateConfig({}).deathMailEnabled,false);
  const config=C.validateConfig({deathMailEnabled:true,mailSettings:setup});
  assert.equal(config.deathMailEnabled,true);assert.equal(config.mailSettings,undefined);assert.equal(C.profileSettings(config).deathMailEnabled,undefined);
});
test('EmailJS setup validates a single recipient and required public identifiers',()=>{
  assert.deepEqual(C.normalizeMailSettings({...setup,toEmail:' user@example.com ',extra:'ignore'}),setup);
  assert.equal(C.mailSettingsError(setup),'');
  for(const patch of [{serviceId:''},{templateId:''},{publicKey:''},{publicKey:'key\nsecret'},{toEmail:'broken'},{toEmail:'a@example.com;b@example.com'},{toEmail:'a@example.com\r\nBcc:x@y.com'}])assert(C.mailSettingsError({...setup,...patch}));
});
test('only genuine expedition death qualifies; victory and timed abandonment do not',()=>{
  const game={stageId:'payon',state:'over',player:{dead:true}};
  assert.equal(C.isExpeditionDeath(game),true);
  for(const patch of [{player:{dead:false}},{player:{dead:'true'}},{state:'lobby'},{coop:{}},{endless:{}},{story:{}},{isStory:true},{replayMoves:[]},{stageId:undefined},{stageId:''}])assert.equal(C.isExpeditionDeath({...game,...patch}),false);
});
test('EmailJS payload uses documented REST parameters and contains only a small death snapshot',()=>{
  const event=C.deathMailEvent({stageId:'payon',difficulty:{lap:2},classDef:{id:'mage',name:'魔法師'},time:189.9,level:12,kills:321,privateAccount:'do-not-send'},'fixture-time');
  assert.equal(event.survival_time,'03:09');assert.equal(event.stage,'斐揚森林');assert.equal(event.lap,2);assert.equal(event.occurred_at,'fixture-time');
  const payload=C.emailjsPayload(setup,event);
  assert.equal(payload.service_id,setup.serviceId);assert.equal(payload.template_id,setup.templateId);assert.equal(payload.user_id,setup.publicKey);assert.equal(payload.template_params.to_email,setup.toEmail);
  assert.equal(payload.accessToken,undefined);assert(!JSON.stringify(payload).includes('do-not-send'));assert.equal(C.EMAILJS_ENDPOINT,'https://api.emailjs.com/api/v1.0/email/send');
});
