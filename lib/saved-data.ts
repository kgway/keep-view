import type {SavedState, Settings, TagNode} from "./types";
import {record,strings} from "./value-guards";

function tagNode(value: unknown,depth: number=0): TagNode|null {
  const node=record(value);
  if(depth>64 || typeof node.type!=='string' || !['and','or','not','tag'].includes(node.type)) return null;
  const id=typeof node.id==='string' && node.id?node.id:'root';
  if(node.type==='tag') return {type:'tag',id,tag:typeof node.tag==='string'?node.tag:''};
  const children=Array.isArray(node.children)? (node.children as unknown[]):[];
  return {type:node.type,id,children:children.slice(0,1000).map((child)=>tagNode(child,depth+1)).filter((child): child is TagNode=>child!==null)};
}

function flags(value: unknown): Record<string,boolean> {

  const result: Record<string,boolean>={};
  for(const [key,enabled] of Object.entries(record(value))) if(typeof enabled==='boolean') Object.defineProperty(result,key,{value:enabled,enumerable:true,writable:true,configurable:true});
  return result;
}

function readState(value: unknown): Partial<SavedState> {
  const source=record(value);

  const state: Partial<SavedState>={};
  for(const key of  (['formula','textQuery','dateField','sortField','sortOrder','dateFrom','dateTo','density'] as const)) {
    const item=source[key];if(typeof item==='string') state[key]=item;
  }
  for(const key of  (['noTagOnly','groupByFolder'] as const)) {
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

function readSettings(value: unknown,defaults: Settings): Settings {
  const source=record(value),settings={...defaults,previewLengths:[...defaults.previewLengths]};
  for(const key of  (['dateProperty','creationTimeZone','previewMode','language','obsidianLanguage'] as const)) {
    const item=source[key];if(typeof item==='string') settings[key]=item;
  }
  for(const key of  (['confirmDelete','fastSearch','showDateGuidance'] as const)) {
    const item=source[key];if(typeof item==='boolean') settings[key]=item;
  }
  if(Array.isArray(source.previewLengths)) {
    const lengths= (source.previewLengths as unknown[]);
    if(lengths.length>0 && lengths.length<=20 && lengths.every((n)=>typeof n==='number' && Number.isInteger(n) && n>0 && n<=10000)) {
      settings.previewLengths=lengths.filter( (n: unknown): n is number=>typeof n==='number');
    }
  }
  return settings;
}
export {readState,readSettings};
