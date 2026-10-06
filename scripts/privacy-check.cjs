'use strict';
const fs=require('node:fs');
const path=require('node:path');
const {execFileSync}=require('node:child_process');
const {root,publicFiles}=require('./public-files.cjs');
const rules=[
  ['personal Windows path',/[A-Z]:[\\/]+Users[\\/]+[A-Za-z0-9_.-]+/i],
  ['personal macOS path',/\/Users\/[A-Za-z0-9_.-]+/],
  ['GitHub token',/\b(?:gh[pousr]_[A-Za-z0-9]{30,}|github_pat_[A-Za-z0-9_]{40,})\b/],
  ['private key',/-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/],
  ['email address',/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i],
];
function checkText(content,label) {
  const failures=[];
  for(const [kind,pattern] of rules) if(pattern.test(content)) failures.push(label+': '+kind);
  if(/\/home\/(?!vault(?:\/|\b))[A-Za-z0-9_.-]+/.test(content)) failures.push(label+': personal Linux path');
  if(failures.length) throw new Error('Public files need review (matched values are hidden):\n'+failures.join('\n'));
}
function checkFiles(files) {
  const failures=[];
  for(const file of files) {
    if(/\.(png|jpg|jpeg|webp|gif|zip)$/i.test(file)) continue;
    try {checkText(fs.readFileSync(file,'utf8'),path.relative(root,file).replaceAll('\\','/'));} catch(error) {failures.push(error.message);}
  }
  if(failures.length) throw new Error('Public files need review (matched values are hidden):\n'+failures.join('\n'));
}
function checkPublic() {
  const allowed=publicFiles();
  checkFiles(allowed.map(name=>path.join(root,name)));
  if(fs.existsSync(path.join(root,'.git'))) {
    const tracked=execFileSync('git',['ls-files','-z'],{cwd:root,encoding:'utf8'}).split('\0').filter(Boolean);
    const unexpected=tracked.filter(name=>!allowed.includes(name));
    if(unexpected.length) throw new Error('Unexpected tracked files: '+unexpected.join(', '));
    checkFiles(tracked.map(name=>path.join(root,name)));
    for(const name of tracked) if(!/\.(png|jpg|jpeg|webp|gif|zip)$/i.test(name)) checkText(execFileSync('git',['show',':'+name],{cwd:root,encoding:'utf8'}),name+' (staged)');
    for(const forbidden of ['.artifacts/private.txt','.pnpm-store/private.txt','node_modules/private.txt','data.json','search-cache-v1/private.txt','.obsidian/private.txt','.env','CONTINUE.md']) execFileSync('git',['check-ignore','--quiet',forbidden],{cwd:root});
  }
  console.log(`Privacy check passed for ${allowed.length} public text/source files. Binary metadata and screenshots require a separate visual review.`);
}
module.exports={checkFiles,checkText,checkPublic};
if(require.main===module) checkPublic();
