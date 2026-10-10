'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {checkSource}=require('../scripts/check-attestation-source.cjs');
const {verificationArgs}=require('../scripts/verify-attestations.cjs');
const commit='a'.repeat(40);
const environment={GITHUB_REPOSITORY:'kgway/keep-view',GITHUB_EVENT_NAME:'workflow_dispatch',GITHUB_REF:'refs/heads/main',GITHUB_SHA:commit,EXPECTED_COMMIT:commit,EXPECTED_VERSION:'1.43.2'};
test('release provenance is bound to the reviewed public main commit and manifest',()=>{
  assert.doesNotThrow(()=>checkSource(environment,{version:'1.43.2'},commit));
  for(const [key,value] of Object.entries({GITHUB_REPOSITORY:'example/private-workspace',GITHUB_EVENT_NAME:'pull_request',GITHUB_REF:'refs/heads/preview',GITHUB_SHA:'b'.repeat(40),EXPECTED_COMMIT:'main',EXPECTED_VERSION:'1.43.1'})) {
    assert.throws(()=>checkSource({...environment,[key]:value},{version:'1.43.2'},commit),key);
  }
  assert.throws(()=>checkSource(environment,{version:'1.43.2'},'b'.repeat(40)));
});
test('verification requires the public source, signer workflow, commit and hosted runner',()=>{
  const args=verificationArgs('download/main.js',commit);
  for(const flag of ['--source-digest','--signer-digest']) assert.equal(args[args.indexOf(flag)+1],commit);
  assert.equal(args[args.indexOf('--repo')+1],'kgway/keep-view');
  assert.equal(args[args.indexOf('--signer-workflow')+1],'kgway/keep-view/.github/workflows/attest-release.yml');
  assert.ok(args.includes('--deny-self-hosted-runners'));
  assert.throws(()=>verificationArgs('main.js','main'));
});
