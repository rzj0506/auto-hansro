'use strict';
const assert = require('node:assert/strict');
const { test } = require('node:test');
const fs = require('node:fs');
const crypto = require('node:crypto');
const C = require('../src/ro-survivors-helper.user.js');
const { buildRelease } = require('../scripts/build-release.cjs');
const source = fs.readFileSync(require.resolve('../src/ro-survivors-helper.user.js'), 'utf8');

test('release name, site, version, download URLs and checksum belong to auto-hansro', () => {
  const result = buildRelease(source, 'rzj0506/auto-hansro');
  assert.equal(result.version, '1.3.1');
  assert.equal(result.version, C.VERSION);
  assert.equal(require('../package.json').version, C.VERSION);
  assert.match(result.meta, /@name\s+ro\.hans幸存者助手\n/);
  assert.match(result.meta, /@namespace\s+ro-survivors-local-helper/);
  assert.match(result.meta, /@match\s+https:\/\/ro\.hans-webgametw\.com\/\*/);
  assert.doesNotMatch(result.meta, /auto-ro-survivors|ro-survivors\.com/);
  assert.equal(result.script.match(/@updateURL/g).length, 1);
  assert.equal(result.script.match(/@downloadURL/g).length, 1);
  for (const suffix of ['updateURL', 'downloadURL']) assert(result.meta.includes(result.manifest[suffix]));
  assert.equal(result.manifest.sha256, crypto.createHash('sha256').update(result.script).digest('hex'));
  assert.doesNotMatch(result.meta, /\(\(\) =>/);
});

test('release builder rejects version mismatches and invalid source/repository/branch', () => {
  assert.throws(() => buildRelease(source.replace("const VERSION = '1.3.1'", "const VERSION = '1.3.0'"), 'rzj0506/auto-hansro'));
  assert.throws(() => buildRelease(source, '../bad/repo'));
  assert.throws(() => buildRelease(source, 'rzj0506/auto-hansro', '../bad'));
  assert.throws(() => buildRelease('not a userscript', 'rzj0506/auto-hansro'));
});
