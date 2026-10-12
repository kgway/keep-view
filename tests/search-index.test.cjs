const {test}=require('node:test');
const assert=require('node:assert/strict');
const {SearchIndex,bucketFor}=require('./load-source.cjs').loadSource('../lib/search-index');
const {CardSearch}=require('./load-source.cjs').loadSource('../lib/card-search');
const {gzipSync,strToU8}=require('fflate');
const {decodeBucket,encodeBucket}=require('./load-source.cjs').loadSource('../lib/search-codec');

function fixture(texts) {
  const files=texts.map((text,i)=>({path:`${i}.md`,basename:`note${i}`,stat:{mtime:1,size:text.length}}));
  const disk=new Map(),reads=[],writes=[],loads=[];
  const adapter={exists:async path=>disk.has(path),mkdir:async path=>disk.set(path,null),remove:async path=>disk.delete(path),readBinary:async path=>{loads.push(path);return disk.get(path);},writeBinary:async(path,data)=>{writes.push(path);disk.set(path,data.slice(0));}};
  const app={vault:{adapter,getAbstractFileByPath:path=>files.find(file=>file.path===path),cachedRead:async file=>{reads.push(file.path);return texts[files.indexOf(file)];}}};
  const open=options=>new SearchIndex(app,'cache',{yieldTask:async()=>{},...options});
  return {app,files,texts,disk,reads,writes,loads,open};
}

test('persisted index is lazy; reopening and new queries need no unchanged note reads or writes',async()=>{
  const f=fixture(['買い物メモ [x] a b','cafe\u0301 😀','---\ncreated: today\n---\n本文']);
  let index=f.open();assert.equal(f.disk.size,0);assert.equal(f.reads.length,0);
  await index.search('買',f.files);assert.equal(f.reads.length,3);
  f.reads.length=f.writes.length=0;index=f.open();assert.equal(f.loads.length,0);
  const engine=new CardSearch(f.app,{index});
  for(const [query,expected] of [['買',[0]],['い物',[0]],['[x]',[0]],['a b',[0]],['CAFÉ',[1]],['😀',[1]],['created',[2]],['note2',[2]],['absent',[]]]) {
    assert.deepEqual([...(await engine.search(query,f.files)).matches].sort(),expected.map(i=>`${i}.md`));
  }
  assert.equal(f.reads.length,0);assert.equal(f.writes.length,0);
});

test('only candidates are indexed; modifications rebuild just their bucket and note',async()=>{
  const f=fixture(['one','two','three']);await f.open().search('one',f.files.slice(0,2));
  assert.deepEqual(f.reads.sort(),['0.md','1.md']);
  f.reads.length=f.writes.length=0;f.texts[1]='new';f.files[1].stat.mtime++;
  const result=await f.open().search('new',f.files.slice(0,2));
  assert.deepEqual([...result.matches],['1.md']);assert.deepEqual(f.reads,['1.md']);
  assert.deepEqual(f.writes,[`cache/bucket-${bucketFor('1.md')}.gz`]);
});

test('explicit invalidation handles same-sized edits with the same timestamp, even after eviction',async()=>{
  const f=fixture(['hit']);const index=f.open({memoryLimit:0});await index.search('hit',f.files);
  f.texts[0]='new';index.invalidate('0.md');await index.search('new',f.files);
  const reads=f.reads.length;
  assert.equal((await f.open().search('new',f.files)).matches.size,1);assert.equal(f.reads.length,reads);
});

test('corrupt shards recover from source; save failures preserve search correctness and retry',async()=>{
  const f=fixture(['hit']);await f.open().search('hit',f.files);
  f.disk.set(`cache/bucket-${bucketFor('0.md')}.gz`,new Uint8Array([1,2,3]).buffer);
  assert.equal((await f.open().search('hit',f.files)).matches.size,1);assert.equal(f.reads.length,2);
  const write=f.app.vault.adapter.writeBinary;f.app.vault.adapter.writeBinary=async()=>{throw Error('full');};
  f.files[0].stat.mtime++;const index=f.open();
  const failed=await index.search('hit',f.files);assert.equal(failed.storageError,true);assert.equal(failed.matches.size,1);
  f.app.vault.adapter.writeBinary=write;assert.equal((await index.search('hit',f.files)).storageError,false);
  f.reads.length=0;await f.open().search('hit',f.files);assert.equal(f.reads.length,0);
});

test('changes during reads and failed reads cannot become cached false results',async()=>{
  const f=fixture(['hit']);const read=f.app.vault.cachedRead;
  f.app.vault.cachedRead=async file=>{file.stat.mtime++;return 'hit';};
  const index=f.open();const result=await index.search('hit',f.files);
  assert.equal(result.matches.size,0);assert.deepEqual(result.errors,['0.md']);
  f.app.vault.cachedRead=read;assert.equal((await index.search('hit',f.files)).matches.size,1);
});

test('cancellation saves completed work, and a fresh instance resumes without reading it again',async()=>{
  const f=fixture(Array(100).fill('hit'));let stop=false;
  const result=await f.open().search('hit',f.files,{cancelled:()=>stop,onProgress:completed=>{if(completed) stop=true;}});
  assert.equal(result.cancelled,true);assert.ok(f.reads.length>0 && f.reads.length<100);
  const done=new Set(f.reads);f.reads.length=0;
  assert.equal((await f.open().search('hit',f.files)).matches.size,100);
  assert.ok(f.reads.every(path=>!done.has(path)));
});

test('deleted and renamed notes do not remain in results and loaded buckets are pruned',async()=>{
  const f=fixture(['hit','hit']);await f.open().search('hit',f.files);
  f.files[0].path='renamed.md';f.files[0].basename='renamed';f.files.splice(1,1);
  const result=await f.open().search('hit',f.files);assert.deepEqual([...result.matches],['renamed.md']);
});

test('two views share serialized index updates without losing either candidate set',async()=>{
  const f=fixture(['hit','hit']);const index=f.open();
  await Promise.all([index.search('hit',[f.files[0]]),index.search('hit',[f.files[1]])]);
  f.reads.length=0;assert.equal((await f.open().search('hit',f.files)).matches.size,2);assert.equal(f.reads.length,0);
});

test('existing saved buckets shrink in place without reading notes or rebuilding their content',async()=>{
  const f=fixture(['買い物メモ','other']);
  for(const file of f.files) {
    const data=gzipSync(strToU8(JSON.stringify({version:1,entries:[[file.path,{mtime:1,size:file.stat.size,text:f.texts[f.files.indexOf(file)],bits:Array(256).fill(123456789)}]]})));
    let hash=2166136261;for(const char of file.path) hash=Math.imul(hash^char.charCodeAt(0),16777619);
    f.disk.set(`cache/${(hash>>>0)%64}.gz`,data.buffer);
  }
  assert.equal((await f.open().search('買',f.files)).matches.size,1);
  assert.equal(f.reads.length,0);assert.equal(f.writes.length,2);
  for(const path of f.writes) assert.equal((await decodeBucket(new Uint8Array(f.disk.get(path)))).legacy,false);
  f.writes.length=0;assert.equal((await f.open().search('い物',f.files)).matches.size,1);
  assert.equal(f.reads.length,0);assert.equal(f.writes.length,0);
});

test('progress reports exact hits and settled misses before the whole search finishes',async()=>{
  const f=fixture(['hit','miss','hit','miss','hit']);const reports=[];
  const result=await f.open().search('hit',f.files,{onProgress:(count,total,partial)=>reports.push({count,total,matches:[...partial.matches],settled:[...partial.settled]})});
  assert.ok(reports.some(report=>report.count>0 && report.count<5));
  for(const report of reports) {
    assert.equal(report.count,report.settled.length);
    assert.ok(report.matches.every(path=>report.settled.includes(path) && result.matches.has(path)));
  }
  assert.equal(reports.at(-1).settled.length,5);
});

test('deleting search cache waits for writes, clears memory, and leaves notes and other files intact',async()=>{
  const f=fixture(['needle','other']);
  f.app.vault.adapter.remove=async path=>f.disk.delete(path);
  f.disk.set('cache/README.md','unrelated');f.disk.set('note.md','source');
  const index=f.open();const searching=index.search('needle',f.files);const clearing=index.clear();
  await searching;await clearing;
  assert.equal([...f.disk.keys()].filter(path=>path.endsWith('.gz')).length,0);
  assert.equal(f.disk.get('cache/README.md'),'unrelated');assert.equal(f.disk.get('note.md'),'source');
  assert.equal(index.buckets.size,0);assert.equal(index.results.size,0);
  f.reads.length=0;assert.equal((await index.search('needle',f.files)).matches.size,1);assert.equal(f.reads.length,2);
});

test('a failed cache deletion does not poison later searches and can be retried',async()=>{
  const f=fixture(['needle']);const index=f.open();await index.search('needle',f.files);
  f.app.vault.adapter.remove=async()=>{throw Error('denied');};
  await assert.rejects(index.clear(),/denied/);assert.equal(index.buckets.size,0);
  assert.equal((await index.search('needle',f.files)).matches.size,1);
  f.app.vault.adapter.remove=async path=>f.disk.delete(path);await index.clear();
  assert.equal([...f.disk.keys()].filter(path=>path.endsWith('.gz')).length,0);
});

test('legacy shards consolidate to at most eight files without reading unchanged notes',async()=>{
  const f=fixture(Array(200).fill('needle'));
  const old=new Map();
  for(const file of f.files) {
    let hash=2166136261;for(let i=0;i<file.path.length;i++) hash=Math.imul(hash^file.path.charCodeAt(i),16777619);
    const id=(hash>>>0)%64;if(!old.has(id)) old.set(id,[]);
    old.get(id).push([file.path,{mtime:1,size:file.stat.size,text:'needle'}]);
  }
  for(const [id,rows] of old) f.disk.set(`cache/${id}.gz`,(await encodeBucket(rows)).buffer);
  assert.ok(old.size>8);
  const result=await f.open({memoryLimit:0}).search('needle',f.files.slice(0,1));
  assert.equal(result.matches.size,1);assert.equal(f.reads.length,0);
  assert.equal([...f.disk.keys()].filter(path=>/\/\d+\.gz$/.test(path)).length,0);
  assert.equal([...f.disk.keys()].filter(path=>path.endsWith('.gz')).length,8);
  f.writes.length=0;
  assert.equal((await f.open().search('needle',f.files)).matches.size,200);
  assert.equal(f.reads.length,0);assert.equal(f.writes.length,0);
});

test('failed consolidation keeps legacy files until a successful replacement and retries safely',async()=>{
  const f=fixture(['needle']);let hash=2166136261;
  for(let i=0;i<f.files[0].path.length;i++) hash=Math.imul(hash^f.files[0].path.charCodeAt(i),16777619);
  const oldPath=`cache/${(hash>>>0)%64}.gz`;
  f.disk.set(oldPath,(await encodeBucket([[f.files[0].path,{mtime:1,size:6,text:'needle'}]])).buffer);
  const write=f.app.vault.adapter.writeBinary;f.app.vault.adapter.writeBinary=async()=>{throw Error('full');};
  const index=f.open();assert.equal((await index.search('needle',f.files)).storageError,true);
  assert.ok(f.disk.has(oldPath));assert.equal(f.reads.length,0);
  f.app.vault.adapter.writeBinary=write;
  assert.equal((await index.search('needle',f.files)).storageError,false);
  assert.equal(f.disk.has(oldPath),false);assert.equal(f.reads.length,0);
});
