import type {CacheEntry} from "./types";
import {record} from "./value-guards";

const strToU8=(text: string)=>new TextEncoder().encode(text);

const strFromU8=(bytes: Uint8Array)=>new TextDecoder('utf-8',{fatal:true}).decode(bytes);

async function transform(bytes: Uint8Array,compress: boolean) {
  const stream=new Blob([bytes]).stream().pipeThrough(compress?new CompressionStream('gzip'):new DecompressionStream('gzip'));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}
const HEADER=[75,86,2];

function packText(text: string) {
  const counts=new Uint32Array(65536);
  for(let i=0;i<text.length;i++) counts[text.charCodeAt(i)]++;
  const alphabet=[];
  for(let code=0;code<counts.length;code++) if(counts[code]) alphabet.push(code);
  alphabet.sort((a,b)=>counts[b]-counts[a] || a-b);
  const ranks=new Uint16Array(65536);
  let length=12+alphabet.length*2;
  alphabet.forEach((code,rank)=>{ranks[code]=rank;length+=counts[code]*(rank<128?1:rank<16384?2:3);});
  const bytes=new Uint8Array(length),view=new DataView(bytes.buffer);
  bytes.set(HEADER);bytes[3]=1;view.setUint32(4,alphabet.length,true);view.setUint32(8,text.length,true);
  let offset=12;
  for(const code of alphabet) {view.setUint16(offset,code,true);offset+=2;}
  for(let i=0;i<text.length;i++) {
    let rank=ranks[text.charCodeAt(i)];
    while(rank>=128) {bytes[offset++]=(rank&127)|128;rank>>>=7;}
    bytes[offset++]=rank;
  }
  return bytes;
}

function unpackText(bytes: Uint8Array) {
  if(bytes.length<12) throw Error('Incomplete search cache');
  const view=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength);
  const count=view.getUint32(4,true),length=view.getUint32(8,true);
  let offset=12+count*2;
  if(!count || count>65536 || offset>bytes.length || length>bytes.length-offset) throw Error('Invalid search dictionary');
  const alphabet=new Uint16Array(count);
  for(let i=0;i<count;i++) alphabet[i]=view.getUint16(12+i*2,true);
  const utf16=new Uint8Array(length*2);
  for(let i=0;i<length;i++) {
    if(offset>=bytes.length) throw Error('Invalid search character');
    let byte=bytes[offset++],rank=byte&127,shift=7;
    while(byte&128) {
      if(offset>=bytes.length || shift>14) throw Error('Invalid search character');
      byte=bytes[offset++];rank|=(byte&127)<<shift;shift+=7;
    }
    if(rank>=count) throw Error('Invalid search character');
    const code=alphabet[rank];utf16[i*2]=code&255;utf16[i*2+1]=code>>>8;
  }
  if(offset!==bytes.length) throw Error('Unexpected search cache data');
  if(typeof TextDecoder!=='undefined') return new TextDecoder('utf-16le',{fatal:true}).decode(utf16);
  const parts=[];
  for(let i=0;i<length;i+=8192) {
    const block=[];
    for(let j=i;j<Math.min(i+8192,length);j++) block.push(utf16[j*2]|(utf16[j*2+1]<<8));
    parts.push(String.fromCharCode(...block));
  }
  return parts.join('');
}

async function encodeBucket(entries: [string,CacheEntry][]) {
  const text=JSON.stringify(entries.map(([path,entry])=>[path,entry.mtime,entry.size,entry.text]));
  const utf8=strToU8(text),plain=new Uint8Array(4+utf8.length);
  plain.set(HEADER);plain.set(utf8,4);
  const compressed=await transform(plain,true);
  // ASCII needs no dictionary; compare compressed sizes before keeping a Unicode dictionary.
  if(utf8.length===text.length) return compressed;
  const packed=packText(text);
  if(packed.length>=plain.length) return compressed;
  const compact=await transform(packed,true);
  return compact.length<compressed.length?compact:compressed;
}

async function decodeBucket(compressed: Uint8Array): Promise<{entries:[string,CacheEntry][],legacy:boolean}> {
  const bytes=await transform(compressed,false);
  if(bytes[0]===123) {
    const data=record(JSON.parse(strFromU8(bytes)));
    if(data.version!==1 || !Array.isArray(data.entries)) throw Error('Invalid legacy search cache');
    const entries=data.entries.map( (row: unknown): [string,CacheEntry]=>{
      if(!Array.isArray(row) || row.length!==2) throw Error('Invalid legacy search row');
      const path= (row[0] as unknown),entry=record(row[1]);
      if(typeof path!=='string' || typeof entry.text!=='string' || typeof entry.mtime!=='number' || typeof entry.size!=='number' || !Number.isFinite(entry.mtime) || !Number.isFinite(entry.size)) throw Error('Invalid legacy search entry');
      return [path,{mtime:entry.mtime,size:entry.size,text:entry.text}];
    });
    return {entries,legacy:true};
  }
  if(!HEADER.every((byte,i)=>bytes[i]===byte) || bytes.length<4 || bytes[3]>1) throw Error('Invalid search cache format');
  const rows= (JSON.parse(bytes[3]===1?unpackText(bytes):strFromU8(bytes.subarray(4))) as unknown);
  if(!Array.isArray(rows)) throw Error('Invalid search cache rows');
  const entries=rows.map( (row: unknown): [string,CacheEntry]=>{
    if(!Array.isArray(row) || row.length!==4) throw Error('Invalid search cache row');
    const values= (row as unknown[]);
    const path=values[0],mtime=values[1],size=values[2],text=values[3];
    if(typeof path!=='string' || typeof text!=='string' || typeof mtime!=='number' || typeof size!=='number' || !Number.isFinite(mtime) || !Number.isFinite(size)) throw Error('Invalid search cache entry');
    return [path,{mtime,size,text}];
  });
  return {entries,legacy:false};
}

export {encodeBucket,decodeBucket};
