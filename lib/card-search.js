'use strict';

const normalizeSearch=value=>String(value).normalize('NFC').toLowerCase();

class CardSearch {
  constructor(app,{index=null,limit=10000,yieldTask=()=>new Promise(resolve=>(typeof window==='undefined'?setTimeout:window.setTimeout)(resolve,0))}={}) {
    this.index=index;
    this.app=app;this.limit=limit;this.yieldTask=yieldTask;
    this.query='';this.cache=new Map();this.generation=0;this.tail=Promise.resolve();
  }
  cancel() {this.generation++;}
  invalidate(path) {this.cache.delete(path);this.index?.invalidate(path);}
  clear() {this.cancel();this.cache.clear();this.query='';}
  dispose() {this.clear();}
  search(value,files,{onProgress=()=>{}}={}) {
    const query=normalizeSearch(value.trim()),generation=++this.generation;
    const cancelled=()=>generation!==this.generation;
    const work=async()=>{
      const matches=new Set(),settled=new Set(),errors=[];
      if(cancelled()) return {matches,errors,cancelled:true};
      if(this.index) return this.index.search(query,files,{cancelled,onProgress});
      if(query!==this.query) {this.query=query;this.cache.clear();}
      let next=0,completed=0;
      await Promise.all(Array.from({length:Math.min(4,files.length)},async()=>{
        let started=Date.now();
        while(next<files.length && !cancelled()) {
          const file=files[next++],path=file.path,mtime=file.stat.mtime,size=file.stat.size;
          const cached=this.cache.get(path);
          let match;
          try {
            if(cached && cached.file===file && cached.mtime===mtime && cached.size===size) match=cached.match;
            else {
              // Do not keep note text: only the result for the current query is cached.
              match=normalizeSearch(file.basename).includes(query);
              if(!match) match=normalizeSearch(await this.app.vault.cachedRead(file)).includes(query);
              if(cancelled()) break;
              if(file.path!==path || file.stat.mtime!==mtime || file.stat.size!==size || this.app.vault.getAbstractFileByPath(path)!==file) throw Error('Note changed during search');
              if(this.cache.size>=this.limit) this.cache.delete(this.cache.keys().next().value);
              if(this.limit>0) this.cache.set(path,{file,mtime,size,match});
            }
            if(match) matches.add(path);
          } catch {this.cache.delete(path);errors.push(path);}
          completed++;
          settled.add(path);
          if(Date.now()-started>=8) {onProgress(completed,files.length,{matches,settled});await this.yieldTask();started=Date.now();}
        }
      }));
      if(!cancelled()) onProgress(completed,files.length,{matches,settled});
      return {matches,errors,cancelled:cancelled()};
    };
    const result=this.tail.then(work);
    this.tail=result.catch(()=>{});
    return result;
  }
}

module.exports={CardSearch,normalizeSearch};
