'use strict';
const assert=require('node:assert/strict');
const manifest=require('../manifest.json');
const tag=process.argv[2]||process.env.GITHUB_REF_NAME;
assert.equal(tag,manifest.version,'Release tag must exactly match manifest.version (no v prefix)');
console.log('Release tag matches manifest.version.');
