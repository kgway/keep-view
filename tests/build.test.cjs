'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const path=require('node:path');
const vm=require('node:vm');
const esbuild=require('esbuild');
const {pluginOptions}=require('../scripts/build-options.cjs');

const output=esbuild.buildSync({...pluginOptions(path.join(__dirname,'../dist/keep-view')),write:false});
const source=output.outputFiles[0].text;

function loadPlugin(data) {
  const saved=[],commands=[],icons=[];
  class Plugin {
    async loadData() {return data;}
    async saveData(value) {saved.push(value);}
    registerView(type,factory) {this.viewFactory=factory;}
    addRibbonIcon(icon,label) {icons.push({icon,label});}
    addCommand(command) {commands.push(command);}
    addSettingTab() {}
  }
  const module={exports:{}};
  vm.runInNewContext(source,{module,structuredClone,console,require:id=>{
    assert.equal(id,'obsidian','The installed bundle may only import the Obsidian API');
    return {Plugin,ItemView:class{},Modal:class{},PluginSettingTab:class{},addIcon(){},getLanguage:()=> 'en'};
  }});
  assert.equal(typeof module.exports,'function','Obsidian must receive the plugin class');
  return {plugin:new module.exports(),saved,commands,icons};
}

test('the TypeScript release bundle preserves existing filters, sorting and opt-outs on load',async()=>{
  const state={searchTree:{type:'and',id:'root',children:[{type:'tag',id:'tag-1',tag:'work'}]},formula:'#work',textQuery:'draft',dateField:'property',sortField:'property',sortOrder:'asc',dateFrom:'2026-01-01',dateTo:'2026-12-31',folderFilters:['Projects'],groupByFolder:true};
  const settings={dateProperty:'created',language:'en',obsidianLanguage:'en',previewMode:'source',previewLengths:[100,300],showDateGuidance:false,fastSearch:false,confirmDelete:true};
  const data={state,settings};
  const original=JSON.stringify(data);
  const {plugin,saved,commands,icons}=loadPlugin(data);
  await plugin.onload();await plugin.saveQueue;
  assert.deepEqual(JSON.parse(JSON.stringify(plugin.saved)),state);
  assert.equal(plugin.settings.showDateGuidance,false);
  assert.equal(plugin.settings.fastSearch,false);
  assert.equal(plugin.settings.previewMode,'source');
  assert.deepEqual(Array.from(plugin.settings.previewLengths),[100,300]);
  assert.equal(plugin.getSearchIndex(),null);
  assert.equal(saved.length,1);
  assert.equal(saved[0].state.sortField,'property');
  assert.equal(saved[0].settings.showDateGuidance,false);
  assert.equal(JSON.stringify(data),original,'Loading must not mutate the saved input');
  assert.equal(commands[0].id,'open');
  assert.equal(icons[0].icon,'keep-view-note-bulb');
});

test('a fresh TypeScript release bundle starts without requiring a stored data file',async()=>{
  const {plugin,saved}=loadPlugin(null);
  await plugin.onload();await plugin.saveQueue;
  assert.equal(JSON.stringify(plugin.saved),'{}');
  assert.equal(plugin.settings.dateProperty,'created');
  assert.equal(plugin.settings.language,'auto');
  assert.equal(plugin.settings.showDateGuidance,true);
  assert.equal(saved.length,1);
  assert.equal(typeof plugin.viewFactory,'function');
});
