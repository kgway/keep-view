const {installModules}=require('./module-loader.cjs');
const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const source = fs.readFileSync(require('node:path').join(__dirname, '..', 'main.js'), 'utf8');

function core() {
  const sandbox = {module:{exports:{}}, require:() => ({Plugin:class {}, ItemView:class {}, Modal:class {}, PluginSettingTab:class{}, getAllTags:cache=>cache.tags}), structuredClone, console};
  const modified = source.replace('\nrender();\nreturn {', '\nreturn {S, parseFormula, evalNode, nodeToFormula, moveNode, getContent, getPages, stripContent, extractThumb, sortArr, doUndo, doRedo, filteredPages};\nreturn {').replace('const render = () => {', 'const render = () => { return;');
  vm.runInNewContext(modified + '\nmodule.exports = mountKeepView;', installModules(sandbox));
  const win = {AbortController, setTimeout, clearTimeout, ResizeObserver:class {observe(){} disconnect(){}}};
  const app = {vault:{getMarkdownFiles:()=>[],getAbstractFileByPath:()=>({}),cachedRead:async()=>''},metadataCache:{getFileCache:()=>null}};
  return {api:sandbox.module.exports(app, {ownerDocument:{defaultView:win}}, {}, ()=>{}), app};
}

test('AND / OR precedence, parentheses and nested NOT evaluate correctly', () => {
  const {api:a} = core();
  const tree = a.parseFormula('#仕事 AND (NOT #完了 OR #緊急)');
  assert.equal(a.evalNode(tree, ['#仕事']), true);
  assert.equal(a.evalNode(tree, ['#仕事','#完了']), false);
  assert.equal(a.evalNode(tree, ['#仕事','#完了','#緊急']), true);
  assert.equal(a.evalNode(a.parseFormula('NOT NOT #仕事'), ['#仕事']), true);
  assert.equal(a.evalNode(a.parseFormula('#a\tAND\n#b'), ['#a','#b']), true);
});
test('formula is independent of previous root operator and survives roundtrip', () => {
  const {api:a} = core();
  a.S.searchTree = {type:'not',id:'root',children:[]};
  const tree = a.parseFormula('#a OR #b');
  assert.equal(a.evalNode(tree, ['#a']), true);
  assert.equal(a.evalNode(a.parseFormula(a.nodeToFormula(tree, true)), ['#b']), true);
  for (const bad of ['#a AND', '(#a', '#a #b']) assert.throws(()=>a.parseFormula(bad));
});

test('tag expressions preserve Unicode recognized by Obsidian and match case-insensitively',()=>{
  const {api:a}=core();
  for(const tag of ['café','cafe\u0301','مرحبا','हिन्दी','中文/🧑🏽‍💻','🏳️‍🌈','ANDromeda','NOTES','ORANGE']) {
    const tree=a.parseFormula('#'+tag);
    assert.equal(a.evalNode(tree,['#'+tag]),true);
    assert.equal(a.evalNode(a.parseFormula(a.nodeToFormula(tree,true)),['#'+tag]),true);
  }
  assert.equal(a.evalNode(a.parseFormula('#CAFÉ AND #ANDromeda'),['#café','#andromeda']),true);
  assert.throws(()=>a.parseFormula('#'));
});
test('dragging into self, descendants or full NOT does not remove source', () => {
  const {api:a} = core();
  a.S.searchTree = {type:'and',id:'root',children:[{type:'and',id:'g',children:[{type:'tag',id:'a',tag:'a'}]},{type:'not',id:'n',children:[{type:'tag',id:'b',tag:'b'}]}]};
  const initial = JSON.stringify(a.S.searchTree);
  a.moveNode('g','a',0); a.moveNode('g','g',0); a.moveNode('g','n',0);
  assert.equal(JSON.stringify(a.S.searchTree), initial);
  a.moveNode('a','root',2);
  assert.equal(a.S.searchTree.children[2].id,'a');
  a.doUndo(); assert.equal(JSON.stringify(a.S.searchTree),initial);
  a.doRedo(); assert.equal(a.S.searchTree.children[2].id,'a');
});
test('native metadata includes nested parent tags without duplicates', () => {
  const {api:a, app} = core();
  app.vault.getMarkdownFiles = () => [{path:'a.md',basename:'a',parent:{path:'/'},stat:{mtime:10,ctime:1}}];
  app.metadataCache.getFileCache = () => ({tags:['#仕事/重要','#仕事']});
  const page = a.getPages()[0];
  assert.deepEqual(Array.from(page.file.tags), ['#仕事','#仕事/重要']);
  assert.equal(page.file.folder,'');
});
test('preview read is shared and rejected read settles', async () => {
  const {api:a, app} = core(); let reads = 0;
  app.vault.cachedRead = async () => { reads++; throw Error('unavailable'); };
  const page = {file:{path:'a.md',mtime:1}};
  const entry = a.getContent(page);
  assert.equal(a.getContent(page), entry);
  await entry.promise;
  assert.equal(reads,1); assert.equal(entry.loading,false); assert.match(entry.summary,/読み込めません/);
});
test('previews preserve links and body rules, recognize both image syntaxes', () => {
  const {api:a} = core();
  assert.equal(a.stripContent('---\ntags: a\n---\n[表示](https://example.com)\n本文---区切り---'), '表示\n本文---区切り---');
  assert.equal(a.extractThumb('![[images/a.png|200]]'), 'images/a.png');
  assert.equal(a.extractThumb('![x](images/a.png)'), 'images/a.png');
});

test('property sort keeps missing values last in both directions and ties deterministic',()=>{
  const {api:a}=core();a.S.sortField='property';
  const pages=[{file:{path:'missing',property:null}},{file:{path:'b',property:10}},{file:{path:'a',property:10}},{file:{path:'epoch',property:0}}];
  a.S.sortOrder='asc';assert.deepEqual(Array.from(a.sortArr(pages),p=>p.file.path),['epoch','a','b','missing']);
  a.S.sortOrder='desc';assert.deepEqual(Array.from(a.sortArr(pages),p=>p.file.path),['a','b','epoch','missing']);
});
test('property ranges exclude invalid dates, include local day boundaries, and never fall back to mtime',()=>{
  const {api:a,app}=core();
  const values=['2026-02-09T00:00:00','2026-02-09T23:59:59.999','2026-02-10T00:00:00',undefined,'bad'];
  app.vault.getMarkdownFiles=()=>values.map((value,i)=>({path:`${i}.md`,basename:String(i),parent:{path:'/'},stat:{mtime:Date.now(),ctime:Date.now()},i}));
  app.metadataCache.getFileCache=file=>({tags:[],frontmatter:{created:values[file.i]}});
  a.S.dateFrom='2026-02-09';a.S.dateTo='2026-02-09';a.S.dateField='property';
  assert.deepEqual(Array.from(a.filteredPages(),p=>p.file.path),['1.md','0.md']);
});

test('tagless is ANDed with the tag expression',()=>{
  const {api:a,app}=core();
  app.vault.getMarkdownFiles=()=>[0,1].map(i=>({path:`${i}.md`,basename:String(i),parent:{path:'/'},stat:{mtime:0,ctime:0},i}));
  app.metadataCache.getFileCache=file=>({tags:file.i?['#work']:[]});
  a.S.noTagOnly=true;a.S.searchTree=a.parseFormula('#work');
  assert.equal(a.filteredPages().length,0);
  a.S.searchTree=a.parseFormula('NOT #work');
  assert.deepEqual(Array.from(a.filteredPages(),p=>p.file.path),['0.md']);
});

test('modified time sorts and filters by file mtime independently of created',()=>{
  const {api:a,app}=core();
  const dates=['2026-02-09T12:00:00','2026-02-10T12:00:00','2026-02-09T18:00:00'];
  app.vault.getMarkdownFiles=()=>dates.map((date,i)=>({path:`${i}.md`,basename:String(i),parent:{path:'/'},stat:{mtime:Date.parse(date),ctime:0},i}));
  app.metadataCache.getFileCache=()=>({tags:[],frontmatter:{created:'2000-01-01'}});
  a.S.sortField='mtime';a.S.dateField='mtime';
  a.S.sortOrder='desc';assert.deepEqual(Array.from(a.filteredPages(),p=>p.file.path),['1.md','2.md','0.md']);
  a.S.sortOrder='asc';assert.deepEqual(Array.from(a.filteredPages(),p=>p.file.path),['0.md','2.md','1.md']);
  a.S.dateFrom='2026-02-09';a.S.dateTo='2026-02-09';
  assert.deepEqual(Array.from(a.filteredPages(),p=>p.file.path),['0.md','2.md']);
});
