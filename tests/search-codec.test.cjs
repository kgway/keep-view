const {test}=require('node:test');
const assert=require('node:assert/strict');
const {gzipSync,gunzipSync,strToU8}=require('fflate');
const {encodeBucket,decodeBucket}=require('../lib/search-codec');

test('compact storage round-trips Unicode, whitespace, controls, paths and timestamps exactly',async()=>{
  const texts=['','plain ASCII text','日本語の買い物メモ。\n'.repeat(100),'cafe\u0301 😀 👩‍💻 [.*] a b\r\n\t\u0000\ud800',Array.from({length:65536},(_,code)=>String.fromCharCode(code)).join('')];
  for(const text of texts) {
    const entries=[['ノート/😀.md',{mtime:1234.567,size:999,text}]];
    assert.deepEqual(await decodeBucket(await encodeBucket(entries)),{entries,legacy:false});
  }
});

test('Unicode dictionary is used when smaller; ASCII does not pay its overhead',async()=>{
  const entry=text=>[['n.md',{mtime:1,size:text.length,text}]];
  assert.equal(gunzipSync(await encodeBucket(entry('ASCII only')))[3],0);
  const text=Array.from({length:3000},(_,i)=>'買い物確認予定'+(i%137)).join('\n');
  const compressed=await encodeBucket(entry(text));
  assert.equal(gunzipSync(compressed)[3],1);
  const plain=gzipSync(strToU8(JSON.stringify([['n.md',1,text.length,text]])),{level:9});
  assert.ok(compressed.length<plain.length);
  assert.equal((await decodeBucket(compressed)).entries[0][1].text,text);
});

test('legacy payload is readable and marked for in-place conversion',async()=>{
  const entries=[['n.md',{mtime:1,size:5,text:'hello',bits:[1,2,3]}]];
  const legacy=gzipSync(strToU8(JSON.stringify({version:1,entries})),{level:6});
  assert.deepEqual(await decodeBucket(legacy),{entries,legacy:true});
});

test('standard decompression reads 1.27 fflate payloads and verifies their gzip checksum',async()=>{
  const entries=[['日本語.md',{mtime:1,size:123,text:'あいうえお 😀\n'.repeat(1000)}]];
  const payload=gunzipSync(await encodeBucket(entries));
  const old=gzipSync(payload,{level:9,mtime:0});
  assert.deepEqual(await decodeBucket(old),{entries,legacy:false});
  old[old.length-8]^=1;
  await assert.rejects(()=>decodeBucket(old));
});

test('malformed dictionaries, unknown formats and invalid row shapes are rejected',async()=>{
  for(const bytes of [
    Uint8Array.from([75,86,9,0]),Uint8Array.from([75,86,2,2]),
    Uint8Array.from([75,86,2,1]),
    Uint8Array.from([75,86,2,1,255,255,255,255,1,0,0,0]),
    Uint8Array.from([75,86,2,1,1,0,0,0,2,0,0,0,65,0,0]),
    Uint8Array.from([75,86,2,1,1,0,0,0,1,0,0,0,65,0,127]),
    Uint8Array.from([75,86,2,0,...strToU8('[["bad"]]')])
  ]) await assert.rejects(()=>decodeBucket(gzipSync(bytes)));
});
