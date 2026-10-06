const {test}=require('node:test');
const assert=require('node:assert/strict');
const {CardSearch}=require('../lib/card-search');

function fixture(texts,options={}) {
  const files=texts.map((text,i)=>({path:`${i}.md`,basename:`note${i}`,stat:{mtime:1,size:text.length}}));
  const reads=[];
  const app={vault:{getAbstractFileByPath:path=>files.find(file=>file.path===path),cachedRead:async file=>{reads.push(file.path);return texts[files.indexOf(file)];}}};
  return {files,texts,reads,app,engine:new CardSearch(app,options)};
}

test('literal full-text search supports Japanese, one character, punctuation, NFC and whitespace',async()=>{
  const f=fixture(['前文 買い物メモ 後文','cafe\u0301 😀 [x] a b','a\nb','---\ncreated: yes\n---\n本文']);
  for(const [query,expected] of [['買',[0]],['い物',[0]],['CAFÉ',[1]],['😀',[1]],['[x]',[1]],['a b',[1]],['a\nb',[2]],['created',[3]],['note2',[2]],['.*',[]]]) {
    const result=await f.engine.search(query,f.files);
    assert.deepEqual([...result.matches],expected.map(i=>`${i}.md`));
  }
});

test('only candidates are read; repeat searches reuse booleans; only changed candidates are re-read',async()=>{
  const f=fixture(['target','target','miss']);
  assert.equal(f.reads.length,0);
  await f.engine.search('target',[f.files[0],f.files[2]]);
  assert.deepEqual(f.reads,['0.md','2.md']);f.reads.length=0;
  await f.engine.search('target',[f.files[0],f.files[2]]);assert.equal(f.reads.length,0);
  f.texts[2]='target';f.files[2].stat.mtime++;
  const result=await f.engine.search('target',[f.files[0],f.files[2]]);
  assert.deepEqual(f.reads,['2.md']);assert.equal(result.matches.size,2);
  f.reads.length=0;await f.engine.search('other',[f.files[0]]);assert.deepEqual(f.reads,['0.md']);
  assert.ok([...f.engine.cache.values()].every(entry=>typeof entry.match==='boolean' && !('text' in entry)));
});

test('cache is bounded and cleared on disposal',async()=>{
  const f=fixture(['a','b','c','d'],{limit:2});await f.engine.search('a',f.files);
  assert.equal(f.engine.cache.size,2);f.engine.dispose();assert.equal(f.engine.cache.size,0);
});

test('a title match does not need a body read',async()=>{
  const f=fixture(['body']);
  assert.equal((await f.engine.search('note0',f.files)).matches.size,1);
  assert.equal(f.reads.length,0);
});

test('cancelled searches do not read the entire remaining vault and cannot overwrite newer results',async()=>{
  const f=fixture(Array(20).fill('old'));
  const pending=[];f.app.vault.cachedRead=file=>{f.reads.push(file.path);return new Promise(resolve=>pending.push(resolve));};
  const old=f.engine.search('old',f.files);
  await new Promise(resolve=>setImmediate(resolve));assert.equal(pending.length,4);
  const latest=f.engine.search('new',[f.files[0]]);
  pending.splice(0).forEach(resolve=>resolve('old'));
  assert.equal((await old).cancelled,true);
  await new Promise(resolve=>setImmediate(resolve));pending.splice(0).forEach(resolve=>resolve('new'));
  assert.deepEqual([...(await latest).matches],['0.md']);assert.equal(f.reads.length,5);
});

test('read errors are reported and retried instead of cached as a miss',async()=>{
  const f=fixture(['target']);const read=f.app.vault.cachedRead;
  f.app.vault.cachedRead=async()=>{throw Error('unavailable');};
  assert.deepEqual((await f.engine.search('target',f.files)).errors,['0.md']);
  f.app.vault.cachedRead=read;assert.equal((await f.engine.search('target',f.files)).matches.size,1);
});

test('renamed or modified files during a read are not returned as valid results',async()=>{
  const f=fixture(['target']);f.app.vault.cachedRead=async file=>{file.stat.mtime++;return 'target';};
  const result=await f.engine.search('target',f.files);
  assert.equal(result.matches.size,0);assert.deepEqual(result.errors,['0.md']);
});

test('explicit invalidation handles edits whose timestamps and sizes are unchanged',async()=>{
  const f=fixture(['target']);await f.engine.search('target',f.files);
  f.texts[0]='absent';f.engine.invalidate('0.md');
  assert.equal((await f.engine.search('target',f.files)).matches.size,0);assert.equal(f.reads.length,2);
});
