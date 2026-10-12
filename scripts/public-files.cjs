'use strict';
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const rootFiles=[".editorconfig",".gitattributes",".gitignore",".npmrc",".nvmrc","ARCHITECTURE.md","CHANGELOG.md","CONTRIBUTING.md","LICENSE","README.md","SECURITY.md","THIRD_PARTY_NOTICES.md","eslint.config.mjs","main.ts","manifest.json","package.json","pnpm-lock.yaml","pnpm-workspace.yaml","styles.css","tsconfig.json","versions.json"];
const directories=['lib','scripts','tests','docs','.github'];
function publicFiles() {
  const files=rootFiles.filter(name=>fs.existsSync(path.join(root,name)));
  for(const directory of directories) if(fs.existsSync(path.join(root,directory))) for(const name of fs.readdirSync(path.join(root,directory),{recursive:true})) {
    const relative=directory+'/'+name.replaceAll('\\','/');
    if(fs.statSync(path.join(root,relative)).isFile()) files.push(relative);
  }
  return files.sort();
}
module.exports={root,publicFiles};
