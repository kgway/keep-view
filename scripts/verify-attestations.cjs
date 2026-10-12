'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {execFileSync}=require('node:child_process');
const assets=['main.js','manifest.json','styles.css'];
function verificationArgs(file,commit) {
  assert.match(commit||'',/^[a-f0-9]{40}$/,'Supply the full reviewed public commit SHA');
  return ['attestation','verify',file,'--repo','kgway/keep-view-explorer',
    '--signer-workflow','kgway/keep-view-explorer/.github/workflows/attest-release.yml',
    '--source-ref','refs/heads/main','--source-digest',commit,'--signer-digest',commit,'--deny-self-hosted-runners'];
}
if(require.main===module) {
  const [directory,commit]=process.argv.slice(2);
  assert.ok(directory,'Usage: node scripts/verify-attestations.cjs <downloaded-assets-directory> <public-commit-sha>');
  verificationArgs('',commit);
  for(const name of assets) {
    const file=path.resolve(directory,name);
    assert.ok(fs.statSync(file).isFile(),'A release asset is missing');
    execFileSync(process.env.GH_BINARY||'gh',verificationArgs(file,commit),{stdio:'inherit'});
  }
  console.log('All three release assets have verified provenance.');
}
module.exports={verificationArgs};
