import {record,strings} from "./value-guards.js";

/** @param {unknown} value @param {number} depth @returns {import('./types').TagNode|null} */
function tagNode(value,depth=0) {
  const node=record(value);
  if(depth>64 || typeof node.type!=='string' || !['and','or','not','tag'].includes(node.type)) return null;
  const id=typeof node.id==='string' && node.id?node.id:'root';
  if(node.type==='tag') return {type:'tag',id,tag:typeof node.tag==='string'?node.tag:''};
  const children=Array.isArray(node.children)?/** @type {unknown[]} */ (node.children):[];
  return {type:node.type,id,children:children.slice(0,1000).map(child=>tagNode(child,depth+1)).filter(child=>child!==null)};
}
/** @param {unknown} value @returns {Record<string,boolean>} */
function flags(value) {
  /** @type {Record<string,boolean>} */
  const result={};
  for(const [key,enabled] of Object.entries(record(value))) if(typeof enabled==='boolean') Object.defineProperty(result,key,{value:enabled,enumerable:true,writable:true,configurable:true});
  return result;
}
/** @param {unknown} value @returns {Partial<import('./types').SavedState>} */
function readState(value) {
  const source=record(value);
  /** @type {Partial<import('./types').SavedState>} */
  const state={};
  for(const key of /** @type {const} */ (['formula','textQuery','dateField','sortField','sortOrder','dateFrom','dateTo','density'])) {
    const item=source[key];if(typeof item==='string') state[key]=item;
  }
  for(const key of /** @type {const} */ (['noTagOnly','groupByFolder'])) {
    const item=source[key];if(typeof item==='boolean') state[key]=item;
  }
  if(typeof source.previewChars==='number' && Number.isInteger(source.previewChars) && source.previewChars>0 && source.previewChars<=10000) state.previewChars=source.previewChars;
  if(Array.isArray(source.folderFilters)) state.folderFilters=strings(source.folderFilters);
  if(source.folderGroupState) state.folderGroupState=flags(source.folderGroupState);
  if(source.tagGroupState) state.tagGroupState=flags(source.tagGroupState);
  if(source.resultTreeOpen) state.resultTreeOpen=flags(source.resultTreeOpen);
  const tree=tagNode(source.searchTree);
  if(tree) state.searchTree=tree;
  return state;
}
/** @param {unknown} value @param {import('./types').Settings} defaults @returns {import('./types').Settings} */
function readSettings(value,defaults) {
  const source=record(value),settings={...defaults,previewLengths:[...defaults.previewLengths]};
  for(const key of /** @type {const} */ (['dateProperty','creationTimeZone','previewMode','language','obsidianLanguage'])) {
    const item=source[key];if(typeof item==='string') settings[key]=item;
  }
  for(const key of /** @type {const} */ (['confirmDelete','fastSearch','showDateGuidance'])) {
    const item=source[key];if(typeof item==='boolean') settings[key]=item;
  }
  if(Array.isArray(source.previewLengths)) {
    const lengths=/** @type {unknown[]} */ (source.previewLengths);
    if(lengths.length>0 && lengths.length<=20 && lengths.every(n=>typeof n==='number' && Number.isInteger(n) && n>0 && n<=10000)) {
      settings.previewLengths=lengths.filter(/** @param {unknown} n @returns {n is number} */ n=>typeof n==='number');
    }
  }
  return settings;
}
export {readState,readSettings};
