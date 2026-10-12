import type {App, TFile} from "obsidian";
import type {Bucket, CacheEntry, CachedMatch, ProgressCallback, SearchResult} from "./types";

import {encodeBucket,decodeBucket} from "./search-codec";
const BUCKETS=8,LEGACY_BUCKETS=64;

const normalize=(value: unknown)=>String(value).normalize('NFC').toLowerCase();

const hash=(value: string)=>{
  let result=2166136261;
  for(let i=0;i<value.length;i++) result=Math.imul(result^value.charCodeAt(i),16777619);
  return result>>>0;
};

const bucketFor=(path: string)=>hash(path)%BUCKETS;

class SearchIndex {
  declare app: App;
  declare directory: string;
  declare yieldTask: () => Promise<void>;
  declare memoryLimit: number;
  declare buckets: Map<number, Bucket>;
  declare invalidated: Map<string, number>;
  declare revision: number;
  declare tail: Promise<unknown>;
  declare query: string;
  declare results: Map<string, CachedMatch>;
  declare migrated: boolean;

  static supported() {return typeof CompressionStream!=='undefined' && typeof DecompressionStream!=='undefined';}

  constructor(app: App,directory: string,{yieldTask=()=>new Promise((resolve)=>(typeof window==='undefined'?setTimeout:window.setTimeout)(resolve,0)),memoryLimit=12*1024*1024}: {yieldTask?:()=>Promise<void>,memoryLimit?:number}={}) {
    this.app=app;this.directory=directory;this.yieldTask=yieldTask;this.memoryLimit=memoryLimit;
    this.buckets= (new Map() as Map<number,Bucket>);this.invalidated= (new Map() as Map<string,number>);this.revision=0;this.tail= (Promise.resolve() as Promise<unknown>);
    this.query='';this.results= (new Map() as Map<string,CachedMatch>);
    this.migrated=false;
  }

  invalidate(path: string) {this.invalidated.set(path,++this.revision);this.results.delete(path);}

  search(query: string,files: TFile[],{cancelled=()=>false,onProgress=()=>{}}: {cancelled?:()=>boolean,onProgress?:ProgressCallback}={}) {
    const result=this.tail.then(()=>this.run(query,files,{cancelled,onProgress}));
    this.tail=result.catch(()=>{});
    return result;
  }
  clear() {
    const work=this.tail.then(async()=>{
      const adapter=this.app.vault.adapter;
      try {
        for(let id=0;id<LEGACY_BUCKETS;id++) {
          const path=`${this.directory}/${id}.gz`;
          if(await adapter.exists(path)) await adapter.remove(path);
        }
        for(let id=0;id<BUCKETS;id++) {const path=`${this.directory}/bucket-${id}.gz`;if(await adapter.exists(path)) await adapter.remove(path);}
      } finally {this.buckets.clear();this.invalidated.clear();this.results.clear();this.query='';this.migrated=false;}
    });
    this.tail=work.catch(()=>{});
    return work;
  }

  async load(id: number): Promise<Bucket> {
    if(this.buckets.has(id)) {
      const bucket=this.buckets.get(id)!;this.buckets.delete(id);this.buckets.set(id,bucket);return bucket;
    }
    const bucket= ({entries:new Map(),dirty:false,bytes:0} as Bucket);
    try {
      const adapter=this.app.vault.adapter,path=`${this.directory}/bucket-${id}.gz`;
      if(await adapter.exists(path)) {
        const data=await decodeBucket(new Uint8Array(await adapter.readBinary(path)));
        bucket.dirty=data.legacy;
        for(const [path,entry] of data.entries) {
          if(typeof path!=='string' || bucketFor(path)!==id || typeof entry.text!=='string' || !Number.isFinite(entry.mtime) || !Number.isFinite(entry.size)) throw Error('Invalid search cache');
          const {mtime,size,text}=entry;
          bucket.entries.set(path,{mtime,size,text,epoch:0});bucket.bytes+=text.length*2+path.length*2+128;
        }
      }
    } catch {bucket.entries.clear();bucket.bytes=0;}
    this.buckets.set(id,bucket);return bucket;
  }

  async migrate(cancelled: ()=>boolean) {
    if(this.migrated) return;
    const adapter=this.app.vault.adapter;
    for(let id=0;id<BUCKETS;id++) {
      if(cancelled()) return;
      const old=[];
      for(let legacy=id;legacy<LEGACY_BUCKETS;legacy+=BUCKETS) {const path=`${this.directory}/${legacy}.gz`;if(await adapter.exists(path)) old.push(path);}
      if(!old.length) continue;
      const bucket=await this.load(id);
      for(const path of old) {
        const legacy=Number(path.split('/').pop()!.split('.')[0]);
        let data;
        try {data=await decodeBucket(new Uint8Array(await adapter.readBinary(path)));} catch {continue;}
        for(const [note,entry] of data.entries) {
          if(hash(note)%LEGACY_BUCKETS!==legacy || bucketFor(note)!==id) continue;
          if(!bucket.entries.has(note) && this.app.vault.getAbstractFileByPath(note)) bucket.entries.set(note,{...entry,epoch:0});
        }
        await this.yieldTask();
      }
      bucket.dirty=true;
      await this.save(id,bucket);
      // Remove source shards only after their replacement has been written.
      for(const path of old) await adapter.remove(path);
      bucket.bytes=[...bucket.entries].reduce((sum,[path,entry])=>sum+entry.text.length*2+path.length*2+128,0);
      this.trim();
    }
    this.migrated=true;
  }
  trim() {
    let bytes=[...this.buckets.values()].reduce((sum,bucket)=>sum+bucket.bytes,0);
    for(const [id,bucket] of this.buckets) {
      if(bytes<=this.memoryLimit) break;
      bytes-=bucket.bytes;this.buckets.delete(id);
    }
  }

  async save(id: number,bucket: Bucket) {
    if(!bucket.dirty) return;
    const entries=[...bucket.entries].map(([path,{epoch,...entry}])=> ([path,entry] as [string,CacheEntry]));
    const epochs=new Map([...bucket.entries].map(([path,entry])=>[path,entry.epoch]));
    const adapter=this.app.vault.adapter;
    if(!await adapter.exists(this.directory)) await adapter.mkdir(this.directory);
    await this.yieldTask();
    const compressed=await encodeBucket(entries);
    await adapter.writeBinary(`${this.directory}/bucket-${id}.gz`,compressed.buffer.slice(compressed.byteOffset,compressed.byteOffset+compressed.byteLength));
    for(const [path,epoch] of epochs) if((this.invalidated.get(path)||0)===epoch) {
      this.invalidated.delete(path);bucket.entries.get(path)!.epoch=0;
    }
    bucket.dirty=false;
  }

  async run(query: string,files: TFile[],{cancelled,onProgress}: {cancelled:()=>boolean,onProgress:ProgressCallback}): Promise<SearchResult> {
    const matches=new Set( ([] as string[])),settled=new Set( ([] as string[])),errors= ([] as string[]),groups= (new Map() as Map<number,TFile[]>);let completed=0,storageError=false;
    try {await this.migrate(cancelled);} catch {storageError=true;}
    const report=()=>{if(!cancelled()) onProgress(completed,files.length,{matches,settled});};
    if(query!==this.query) {this.query=query;this.results.clear();}
    for(const file of files) {
      const cached=this.results.get(file.path);
      if(cached && cached.file===file && cached.mtime===file.stat.mtime && cached.size===file.stat.size) {
        if(cached.match) matches.add(file.path);
        settled.add(file.path);
        completed++;continue;
      }
      const id=bucketFor(file.path);
      if(!groups.has(id)) groups.set(id,[]);
      groups.get(id)!.push(file);
    }
    report();
    let started=Date.now();
    for(const [id,candidates] of groups) {
      if(cancelled()) break;
      const bucket=await this.load(id);
      for(const path of bucket.entries.keys()) if(!this.app.vault.getAbstractFileByPath(path)) {bucket.entries.delete(path);this.invalidated.delete(path);bucket.dirty=true;}
      for(const file of candidates) {
        if(cancelled()) break;
        const path=file.path,mtime=file.stat.mtime,size=file.stat.size,epoch=this.invalidated.get(path)||0;
        try {
          let entry=bucket.entries.get(path);
          if(!entry || entry.mtime!==mtime || entry.size!==size || entry.epoch!==epoch) {
            const text=normalize(await this.app.vault.cachedRead(file));
            if(file.path!==path || file.stat.mtime!==mtime || file.stat.size!==size || (this.invalidated.get(path)||0)!==epoch || this.app.vault.getAbstractFileByPath(path)!==file) throw Error('Note changed during indexing');
            entry={mtime,size,text,epoch};bucket.entries.set(path,entry);bucket.dirty=true;
          }
          const match=normalize(file.basename).includes(query) || entry.text.includes(query);
          if(match) matches.add(path);
          const oldest=this.results.keys().next();
          const oldestPath= (oldest.value as unknown);
          if(this.results.size>=10000 && typeof oldestPath==='string') this.results.delete(oldestPath);
          this.results.set(path,{file,mtime,size,match});
        } catch {bucket.entries.delete(path);bucket.dirty=true;errors.push(path);}
        completed++;
        settled.add(path);
        if(Date.now()-started>=8) {report();await this.yieldTask();started=Date.now();}
      }
      try {await this.save(id,bucket);} catch {
        storageError=true;
        for(const path of bucket.entries.keys()) this.results.delete(path);
      }
      bucket.bytes=[...bucket.entries].reduce((sum,[path,entry])=>sum+entry.text.length*2+path.length*2+128,0);
      this.trim();report();
      if(Date.now()-started>=8) {await this.yieldTask();started=Date.now();}
    }
    report();
    return {matches,errors,storageError,cancelled:cancelled()};
  }
}

export {SearchIndex,bucketFor};
