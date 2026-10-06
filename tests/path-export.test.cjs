const {test}=require('node:test');
const assert=require('node:assert/strict');
const {formatPathExport}=require('../lib/path-export');

test('path export omits device paths by default and includes them only when requested',()=>{
  const payload={schema:'keep-view-paths/v1',paths:['Notes/日本語 # [x].md','root.md'],vaultRoot:'private old root'};
  assert.equal(Object.hasOwn(JSON.parse(formatPathExport(payload)),'vaultRoot'),false);
  assert.equal(formatPathExport(payload,'txt'),'Notes/日本語 # [x].md\nroot.md');
  const absolute=JSON.parse(formatPathExport(payload,'json','C:\\Vault'));
  assert.equal(absolute.vaultRoot,'C:\\Vault');assert.deepEqual(absolute.paths,['C:\\Vault\\Notes\\日本語 # [x].md','C:\\Vault\\root.md']);
  assert.equal(absolute.pathBase,'absolute');assert.ok(formatPathExport(payload,'json','C:\\Vault').startsWith('{\n  "vaultRoot":'));
  assert.equal(formatPathExport(payload,'txt','C:\\Vault\\'),'C:\\Vault\\Notes\\日本語 # [x].md\nC:\\Vault\\root.md');
  assert.equal(formatPathExport(payload,'txt','/home/vault/'),'/home/vault/Notes/日本語 # [x].md\n/home/vault/root.md');
  assert.equal(payload.vaultRoot,'private old root');
});
