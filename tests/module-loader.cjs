const {compileSource}=require('./compile-source.cjs');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

// Run production modules with the same Obsidian mocks and globals as their caller.
function installModules(context) {
  const obsidianRequire=context.require;
  context.exports=context.module.exports;
  const cache=new Map();
  context.require=id=>{id=id.replace(/\.js$/,'');
    if(id.startsWith('./') && !id.startsWith('./lib/')) id='./lib/'+id.slice(2);
    if(!id.startsWith('./lib/')) {const value=obsidianRequire(id);return id==='obsidian'?{getLanguage:()=> 'ja',...value}:value;}
    if(!cache.has(id)) {
      const module={exports:{}};
      cache.set(id,module);
      const filename=path.join(__dirname,'..',id+(id.endsWith('.json')?'':'.ts'));
      if(id.endsWith('.json')) module.exports=JSON.parse(fs.readFileSync(filename,'utf8'));
      else vm.runInNewContext(compileSource(fs.readFileSync(filename,'utf8')),{...context,module,exports:module.exports},{filename});
      if(id==='./lib/i18n') module.exports.setLanguage('ja');
    }
    return cache.get(id).exports;
  };
  return context;
}
module.exports={installModules};
