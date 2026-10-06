const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const output = path.join(root, 'dist', 'keep-view');
fs.mkdirSync(output, {recursive:true});
// Remove only obsolete assets from earlier builds in this known output directory.
for(const name of ['README.md','LICENSE','THIRD_PARTY_NOTICES.md']) fs.rmSync(path.join(output,name),{force:true});
const oldMigration=path.join(output,'scripts','keep_created.js');
fs.rmSync(oldMigration,{force:true});
if(fs.existsSync(path.join(output,'scripts')) && fs.readdirSync(path.join(output,'scripts')).length===0) fs.rmdirSync(path.join(output,'scripts'));
for (const file of ['manifest.json', 'styles.css']) fs.copyFileSync(path.join(root, file), path.join(output, file));
// Keep modules in source, but ship one CommonJS entry point for desktop and mobile.
const {common,pluginOptions}=require('./build-options.cjs');
const result=require('esbuild').buildSync(pluginOptions(output));
if(Object.keys(result.metafile.inputs).some(name=>name.replaceAll('\\','/').includes('node_modules/'))) throw new Error('Unexpected third-party code in runtime bundle');
// Keep the standalone migration script identical to the implementation in the plugin.
const source=fs.readFileSync(path.join(root,'main.js'),'utf8');
const helpers=source.split('// BEGIN MIGRATION HELPERS')[1].split('\n').slice(1).join('\n').split('// END MIGRATION HELPERS')[0];
const extras=path.join(root,'dist','extras');
fs.mkdirSync(extras,{recursive:true});
require('esbuild').buildSync({...common,stdin:{contents:"const {t:msg}=require('./lib/i18n');\n"+helpers+'\nmodule.exports = migrateCreated;\n',resolveDir:root,sourcefile:'keep_created.js'},outfile:path.join(extras,'keep_created.js')});
console.log('Plugin files: dist/keep-view/');
