'use strict';
const {t:msg} = require('./i18n');
const tagValue = fm => ({present:Object.hasOwn(fm,'tags'),value:fm.tags===undefined?null:JSON.parse(JSON.stringify(fm.tags))});
const noteTags = fm => {
  const value=fm?.tags;
  return [...new Set((Array.isArray(value)?value:typeof value==='string'?value.split(/[,\s]+/):[]).filter(tag=>typeof tag==='string').map(tag=>tag.replace(/^#/,'')))];
};
async function restoreTagChanges(app,changes) {
  const inverse=[],errors=[];
  for(const change of changes) {
    try {
      const file=app.vault.getAbstractFileByPath(change.path);
      if(!file) throw Error('missing file');
      await app.fileManager.processFrontMatter(file,fm=>{
        if(JSON.stringify(tagValue(fm))!==JSON.stringify(change.expected)) throw Error('tags changed externally');
        if(change.target.present) fm.tags=change.target.value;else delete fm.tags;
      });
      inverse.push({path:change.path,expected:change.target,target:change.expected});
    } catch {errors.push(change.path);}
  }
  return {inverse,errors};
}
async function editNoteTags(app,paths,add,remove) {
  const report={changed:0,errors:[],changes:[]};
  for(const path of paths) {
    const file=app.vault.getAbstractFileByPath(path);
    if(!file) {report.errors.push(path);continue;}
    try {
      let change;
      await app.fileManager.processFrontMatter(file,fm=>{
        const before=tagValue(fm);
        const existing=fm.tags;
        if(existing!=null && !Array.isArray(existing) && typeof existing!=='string') throw Error('unsupported tags');
        const tags=(Array.isArray(existing)?existing:typeof existing==='string'?existing.split(/[,\s]+/):[]).map(tag=>{
          if(typeof tag!=='string') throw Error('unsupported tag');return tag.replace(/^#/,'');
        }).filter(Boolean);
        fm.tags=[...new Set([...tags.filter(tag=>!remove.includes(tag)),...add])];
        change={path,expected:tagValue(fm),target:before};
      });report.changed++;
      if(JSON.stringify(change.expected)!==JSON.stringify(change.target)) report.changes.push(change);
    } catch {report.errors.push(path);}
  }
  return report;
}
// Move through FileManager so Obsidian can update links according to vault settings.
async function moveSelectedNotes(app,paths,destination) {
  const report={moved:[],skipped:[],errors:[]};
  const folder=app.vault.getAbstractFileByPath(destination||'/');
  if(!folder || !Array.isArray(folder.children)) throw Error(msg("移動先のフォルダが見つかりません"));
  const prefix=destination?destination+'/':'';
  for(const path of new Set(paths)) {
    const name=path.split('/').pop();
    const initial=prefix+name;
    if(path===initial) {report.skipped.push(path);continue;}
    const file=app.vault.getAbstractFileByPath(path);
    if(!file || Array.isArray(file.children)) {report.errors.push(path);continue;}
    const dot=name.lastIndexOf('.'),stem=dot>0?name.slice(0,dot):name,ext=dot>0?name.slice(dot):'';
    let moved=false;
    for(let index=0;index<10000;index++) {
      const target=index?prefix+stem+' '+index+ext:initial;
      if(app.vault.getAbstractFileByPath(target)) continue;
      try {await app.fileManager.renameFile(file,target);report.moved.push({from:path,to:target});moved=true;break;}
      catch {
        // A rename may finish before a link-update hook rejects. Do not move it twice.
        if(app.vault.getAbstractFileByPath(target)===file) {report.moved.push({from:path,to:target});moved=true;break;}
        // A concurrently created destination can be retried under a fresh name.
        if(app.vault.getAbstractFileByPath(path)===file && app.vault.getAbstractFileByPath(target)) continue;
        break;
      }
    }
    if(!moved) report.errors.push(path);
  }
  return report;
}
async function moveSelection(app,paths,folders,destination) {
  const roots=[...new Set(folders)].filter(path=>!folders.some(parent=>parent!==path && path.startsWith(parent+'/')));
  const report={moved:[],skipped:[],errors:[],folders:[]};
  const parent=app.vault.getAbstractFileByPath(destination||'/');
  if(!parent || !Array.isArray(parent.children)) throw Error(msg("移動先のフォルダが見つかりません"));
  for(const path of roots) {
    const folder=app.vault.getAbstractFileByPath(path);
    const target=(destination?destination+'/':'')+path.split('/').pop();
    if(target===path) {report.skipped.push(path);continue;}
    if(!folder || !Array.isArray(folder.children) || destination===path || destination.startsWith(path+'/') || app.vault.getAbstractFileByPath(target)) {report.errors.push(path);continue;}
    const descendants=[];
    const collect=node=>{for(const child of node.children) {if(Array.isArray(child.children)) collect(child);else descendants.push(child.path);}};
    collect(folder);
    try {await app.fileManager.renameFile(folder,target);}
    catch {if(app.vault.getAbstractFileByPath(target)!==folder) {report.errors.push(path);continue;}}
    report.folders.push({from:path,to:target});
    for(const child of descendants) report.moved.push({from:child,to:target+child.slice(path.length)});
  }
  // Descendants of a folder are never retried as individual files, even if moving the folder fails.
  const files=await moveSelectedNotes(app,paths.filter(path=>!roots.some(folder=>path.startsWith(folder+'/'))),destination);
  for(const key of ['moved','skipped','errors']) report[key].push(...files[key]);
  return report;
}
async function trashSelectedNotes(app,targets) {
  const report={deleted:[],errors:[]};
  for(const {path,file} of targets) {
    try {
      if(!file || app.vault.getAbstractFileByPath(path)!==file || Array.isArray(file.children) || !path.toLowerCase().endsWith('.md')) throw Error(msg("対象が変更されています"));
      // Delegate the deletion method to Obsidian's user preferences.
      await app.fileManager.trashFile(file);report.deleted.push(path);
    } catch {report.errors.push(path);}
  }
  return report;
}
function validTimeZone(zone) {
  if(typeof zone!=='string') return false;
  try {if(zone) new Intl.DateTimeFormat('en',{timeZone:zone});return true;} catch {return false;}
}
function localIsoTimestamp(date = new Date(), timeZone = '') {
  let offset=-date.getTimezoneOffset();
  if(timeZone) {
    const parts=Object.fromEntries(new Intl.DateTimeFormat('en-GB',{timeZone,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'}).formatToParts(date).map(part=>[part.type,part.value]));
    offset=Math.round((Date.UTC(+parts.year,+parts.month-1,+parts.day,+parts.hour,+parts.minute,+parts.second)-Math.floor(date.getTime()/1000)*1000)/60000);
  }
  const pad=n=>String(n).padStart(2,'0');
  return new Date(date.getTime()+offset*60000).toISOString().slice(0,-1)+(offset>=0?'+':'-')+pad(Math.floor(Math.abs(offset)/60))+':'+pad(Math.abs(offset)%60);
}
async function createNote(app, property, folderPath, timeZone = '') {
  let folder=folderPath!=null?app.vault.getAbstractFileByPath(folderPath||'/'):null;
  if(folderPath!=null && (!folder || !Array.isArray(folder.children))) throw Error(msg("作成先のフォルダが見つかりません"));
  if(!folder || !Array.isArray(folder.children)) folder=app.fileManager.getNewFileParent('');
  const prefix=folder.path==='/'?'':folder.path+'/';
  // Leave the body truly empty so creation hooks can insert their default content.
  const body=`---\n${JSON.stringify(property)}: ${JSON.stringify(localIsoTimestamp(new Date(),timeZone))}\n---\n`;
  for(let index=0;index<10000;index++) {
    const path=prefix+msg("無題")+(index?' '+index:'')+'.md';
    if(app.vault.getAbstractFileByPath(path)) continue;
    try {return await app.vault.create(path,body);}
    catch(error) {if(!app.vault.getAbstractFileByPath(path)) throw error;}
  }
  throw new Error(msg("新規ノートの名前を確保できませんでした"));
}


module.exports = {noteTags,restoreTagChanges,editNoteTags,moveSelectedNotes,moveSelection,trashSelectedNotes,validTimeZone,localIsoTimestamp,createNote};
