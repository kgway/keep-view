const {gzipSync,strToU8}=require('fflate');
const {writeFileSync,mkdirSync}=require('node:fs');
const {encodeBucket,decodeBucket}=require('../lib/search-codec');
const {bucketFor}=require('../lib/search-index');
const {texts,files}=require('./search-fixture.cjs').createSearchFixture();

// Reference signature from 1.26, retained only for the storage comparison.
function oldSignature(text) {
  let words=8;
  while(words<256 && words*32<text.length*8) words*=2;
  const bits=new Array(words).fill(0),mask=words*32-1;
  for(let i=0;i<text.length;i++) {
    let value=2166136261;
    for(let n=0;n<3 && i+n<text.length;n++) {
      value=Math.imul(value^text.charCodeAt(i+n),16777619);
      const bit=(value>>>0)&mask;bits[bit>>>5]|=1<<(bit&31);
    }
  }
  return bits;
}
const buckets=Array.from({length:8},()=>[]);
files.forEach((file,i)=>buckets[bucketFor(file.path)].push([file.path,{mtime:file.stat.mtime,size:file.stat.size,text:texts[i],bits:oldSignature(texts[i])}]));
const totals={original:0,strongerGzipOnly:0,withoutSignatures:0,compact:0};
(async()=>{
for(const entries of buckets) {
  const original=strToU8(JSON.stringify({version:1,entries}));
  totals.original+=gzipSync(original,{level:6}).length;
  totals.strongerGzipOnly+=gzipSync(original,{level:9}).length;
  totals.withoutSignatures+=gzipSync(strToU8(JSON.stringify(entries.map(([path,e])=>[path,e.mtime,e.size,e.text]))),{level:9}).length;
  const compressed=await encodeBucket(entries);totals.compact+=compressed.length;
  const restored=(await decodeBucket(compressed)).entries;
  if(restored.length!==entries.length || restored.some(([path,entry],i)=>path!==entries[i][0] || entry.text!==entries[i][1].text)) throw Error('Round-trip mismatch');
}
const report={notes:files.length,sourceBytes:texts.reduce((n,text)=>n+Buffer.byteLength(text),0),bytes:totals,reductionPercent:(1-totals.compact/totals.original)*100,note:'Deterministic synthetic data, not a prediction for every vault. Each compact bucket is decoded and checked against its original text.'};
mkdirSync('.artifacts/benchmarks',{recursive:true});
writeFileSync('.artifacts/benchmarks/compression-benchmark.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report,null,2));

})().catch(error=>{console.error(error);process.exitCode=1;});
