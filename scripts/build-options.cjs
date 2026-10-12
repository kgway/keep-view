'use strict';
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const license=fs.readFileSync(path.join(root,'LICENSE'),'utf8').trim();
if(license.includes('*/')) throw new Error('Invalid license comment');
const common={bundle:true,platform:'browser',format:'cjs',target:'es2022',minify:false,legalComments:'eof',banner:{js:'/*\n'+license+'\n*/'},logLevel:'warning'};
function pluginOptions(output) {return {...common,entryPoints:[path.join(root,'main.ts')],outfile:path.join(output,'main.js'),external:['obsidian'],metafile:true,footer:{js:'module.exports = module.exports.default;'}};}
module.exports={common,pluginOptions};
