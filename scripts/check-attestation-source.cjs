'use strict';
const fs=require('node:fs');
const assert=require('node:assert/strict');
const {execFileSync}=require('node:child_process');

function checkSource(env,manifest,head) {
  assert.equal(env.GITHUB_REPOSITORY,'kgway/keep-view-explorer','Attestations belong to the public distribution repository');
  assert.equal(env.GITHUB_EVENT_NAME,'workflow_dispatch','Preparation requires an explicit dispatch');
  assert.equal(env.GITHUB_REF,'refs/heads/main','Use the protected main branch');
  assert.match(env.EXPECTED_COMMIT||'',/^[a-f0-9]{40}$/,'Supply the full reviewed commit SHA');
  assert.equal(env.EXPECTED_COMMIT,env.GITHUB_SHA,'The workflow must run at the reviewed commit');
  assert.equal(head,env.EXPECTED_COMMIT,'The checked-out source must match the workflow');
  assert.match(env.EXPECTED_VERSION||'',/^\d+\.\d+\.\d+$/,'Supply a release version');
  assert.equal(manifest.version,env.EXPECTED_VERSION,'The manifest must match the reviewed version');
}
if(require.main===module) {
  checkSource(process.env,JSON.parse(fs.readFileSync('manifest.json','utf8')),execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim());
  console.log('Reviewed release source verified.');
}
module.exports={checkSource};
