'use strict';

const {encodeBucket,decodeBucket}=require('./search-codec');
const BUCKETS=8,LEGACY_BUCKETS=64;
/** @param {unknown} value */
const normalize=value=>String(value).normalize('NFC').toLowerCase();
/** @param {string} value */
const hash=value=>{
  let result=2166136261;
  for(let i=0;i<value.length;i++) result=Math.imul(result^value.charCodeAt(i),16777619);
  return result>>>0;
};
/** @param {string} path */
const bucketFor=path=>hash(path)%BUCKETS;

class SearchIndex {
  static supported() {return typeof CompressionStream!=='undefined' && typeof DecompressionStream!=='undefined';}
  /** @param {import('obsidian').App} app @param {string} directory @param {{yieldTask?:()=>Promise<void>,memoryLimit?:number}} options */
  constructor(app,directory,{yieldTask=()=>new Promise(resolve=>(typeof window==='undefined'?setTimeout:window.setTimeout)(resolve,0)),memoryLimit=12*1024*1024}={}) {
    this.app=app;this.directory=directory;this.yieldTask=yieldTask;this.memoryLimit=memoryLimit;
    this.buckets=/** @type {Map<number,import('./types').Bucket>} */ (new Map());this.invalidated=/** @type {Map<string,number>} */ (new Map());this.revision=0;this.tail=/** @type {Promise<unknown>} */ (Promise.resolve());
    this.query='';this.results=/** @type {Map<string,import('./types').CachedMatch>} */ (new Map());
    this.migrated=false;
  }
  /** @param {string} path */
  invalidate(path) {this.invalidated.set(path,++this.revision);this.results.delete(path);}
  /** @param {string} query @param {import('obsidian').TFile[]} files @param {{cancelled?:()=>boolean,onProgress?:import('./types').ProgressCallback}} options */
  search(query,files,{cancelled=()=>false,onProgress=()=>{}}={}) {
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
  /** @param {number} id @returns {Promise<import('./types').Bucket>} */
  async load(id) {
    if(this.buckets.has(id)) {
      const bucket=this.buckets.get(id);this.buckets.delete(id);this.buckets.set(id,bucket);return bucket;
    }
    const bucket=/** @type {import('./types').Bucket} */ ({entries:new Map(),dirty:false,bytes:0});
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
  /** @param {()=>boolean} cancelled */
  async migrate(cancelled) {
    if(this.migrated) return;
    const adapter=this.app.vault.adapter;
    for(let id=0;id<BUCKETS;id++) {
      if(cancelled()) return;
      const old=[];
      for(let legacy=id;legacy<LEGACY_BUCKETS;legacy+=BUCKETS) {const path=`${this.directory}/${legacy}.gz`;if(await adapter.exists(path)) old.push(path);}
      if(!old.length) continue;
      const bucket=await this.load(id);
      for(const path of old) {
        const legacy=Number(path.split('/').pop().split('.')[0]);
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
  /** @param {number} id @param {import('./types').Bucket} bucket */
  async save(id,bucket) {
    if(!bucket.dirty) return;
    const entries=[...bucket.entries].map(([path,{epoch,...entry}])=>/** @type {[string,import('./types').CacheEntry]} */ ([path,entry]));
    const epochs=new Map([...bucket.entries].map(([path,entry])=>[path,entry.epoch]));
    const adapter=this.app.vault.adapter;
    if(!await adapter.exists(this.directory)) await adapter.mkdir(this.directory);
    await this.yieldTask();
    const compressed=await encodeBucket(entries);
    await adapter.writeBinary(`${this.directory}/bucket-${id}.gz`,compressed.buffer.slice(compressed.byteOffset,compressed.byteOffset+compressed.byteLength));
    for(const [path,epoch] of epochs) if((this.invalidated.get(path)||0)===epoch) {
      this.invalidated.delete(path);bucket.entries.get(path).epoch=0;
    }
    bucket.dirty=false;
  }
  /** @param {string} query @param {import('obsidian').TFile[]} files @param {{cancelled:()=>boolean,onProgress:import('./types').ProgressCallback}} options @returns {Promise<import('./types').SearchResult>} */
  async run(query,files,{cancelled,onProgress}) {
    const matches=new Set(/** @type {string[]} */ ([])),settled=new Set(/** @type {string[]} */ ([])),errors=/** @type {string[]} */ ([]),groups=/** @type {Map<number,import('obsidian').TFile[]>} */ (new Map());let completed=0,storageError=false;
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
      groups.get(id).push(file);
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
          const oldestPath=/** @type {unknown} */ (oldest.value);
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

module.exports={SearchIndex,bucketFor};
