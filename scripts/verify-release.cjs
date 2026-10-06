const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..'),output=path.join(root,'dist','keep-view');
const read=name=>fs.readFileSync(path.join(root,name),'utf8');
const manifest=JSON.parse(read('manifest.json'));
assert.equal(manifest.version,JSON.parse(read('package.json')).version);
assert.equal(JSON.parse(read('versions.json'))[manifest.version],manifest.minAppVersion);
assert.match(manifest.id,/^[a-z]+(?:-[a-z]+)*$/);
assert.ok(manifest.description.length<=250 && manifest.description.endsWith('.'));
for(const name of ['manifest.json','styles.css']) {
  assert.equal(fs.readFileSync(path.join(output,name),'utf8'),read(name),name);
}
const source=fs.readFileSync(path.join(output,'main.js'),'utf8');
assert.ok(source.startsWith('/*\n'+read('LICENSE').trim()+'\n*/'),'Installed code must retain the MIT notice');
const context={module:{exports:{}},require:id=>{
  assert.equal(id,'obsidian','Runtime dependencies must be bundled');
  return {Plugin:class{},ItemView:class{},Modal:class{},PluginSettingTab:class{}};
}};
vm.runInNewContext(source,context);
assert.equal(typeof context.module.exports.prototype.onload,'function');
const migrationPath=path.join(root,'dist','extras','keep_created.js');
assert.equal(fs.existsSync(migrationPath),true);
const migration={module:{exports:{}}};
vm.runInNewContext(fs.readFileSync(migrationPath,'utf8'),migration);
assert.equal(typeof migration.module.exports,'function');
const assets=['main.js','manifest.json','styles.css'];
for(const name of assets) assert.ok(fs.statSync(path.join(output,name)).size>0,name);
const rebuilt=require('esbuild').buildSync({...require('./build-options.cjs').pluginOptions(output),write:false});
assert.ok(Object.keys(rebuilt.metafile.inputs).every(name=>!name.replaceAll('\\','/').includes('node_modules/')),'No third-party packages may enter the distributed bundle');
assert.equal(rebuilt.outputFiles[0].text,source,'Release JavaScript must reproduce from source');
require('./privacy-check.cjs').checkFiles(fs.readdirSync(output,{recursive:true}).filter(name=>fs.statSync(path.join(output,name)).isFile()).map(name=>path.join(output,name)));
const allowed=new Set(assets);
assert.deepEqual(fs.readdirSync(output).sort(),assets.toSorted(),'Install directory must contain only the three runtime files');
for(const name of fs.readdirSync(output,{recursive:true})) if(fs.statSync(path.join(output,name)).isFile()) assert.ok(allowed.has(name.replaceAll('\\','/')),'Unexpected release file: '+name);
console.log(`Release ${manifest.version} verified (${Buffer.byteLength(source)} bytes of JavaScript).`);
