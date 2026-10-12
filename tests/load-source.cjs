'use strict';
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const {createRequire}=require('node:module');
const {compileSource}=require('./compile-source.cjs');
const cache=new Map();

// Load TypeScript modules for Node tests and benchmarks without writing output.
function loadSource(id,parent=__filename) {
  const filename=path.resolve(path.dirname(parent),id)+(path.extname(id)?'':'.ts');
  if(cache.has(filename)) return cache.get(filename).exports;
  const module={exports:{}};
  cache.set(filename,module);
  try {
    if(filename.endsWith('.json')) module.exports=createRequire(parent)(filename);
    else {
      const nativeRequire=createRequire(filename);
      const requireSource=id=>id.startsWith('.')?loadSource(id,filename):nativeRequire(id);
      const wrapper=vm.runInThisContext('(function(require,module,exports){\n'+compileSource(fs.readFileSync(filename,'utf8'))+'\n})',{filename});
      wrapper(requireSource,module,module.exports);
    }
    return module.exports;
  } catch(error) {cache.delete(filename);throw error;}
}
module.exports={loadSource};
