'use strict';
const ts=require('typescript');

// Compile source modules for the existing VM and browser mocks.
function compileSource(source) {
  if (/^export default /m.test(source)) {
    // Browser assertions inspect these bindings outside the compiled entry point.
    const names=[...source.matchAll(/import \{([^}]+)\} from /g)].flatMap(match=>match[1].split(',').map(binding=>binding.trim().split(/\s+as\s+/).at(-1)));
    source+='\nObject.assign(globalThis,{'+names.join(',')+'});\n';
  }
  const result=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText;
  return result+'\nif (module.exports.default) module.exports = module.exports.default;\n';
}
module.exports={compileSource};
