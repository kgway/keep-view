/**
 * @typedef {{dateProperty:string,creationTimeZone:string,previewLengths:number[],previewMode:string,confirmDelete:boolean,fastSearch:boolean,showDateGuidance:boolean,language:string,obsidianLanguage?:string}} Settings
 * @typedef {{type:string,id:string,tag?:string,children?:TagNode[]}} TagNode
 * @typedef {{file:{path:string,name:string,folder:string,tags:string[],mtime:number,ctime:number,property:number|null,propertyPresent?:boolean,metadataReady?:boolean}}} Page
 * @typedef {{path:string,name:string,pages:Page[],children:Map<string,ResultFolder>,count:number}} ResultFolder
 * @typedef {{name:string,path:string,children:Record<string,FolderNode>}} FolderNode
 * @typedef {{common:string[],partial:string[],checked:string[],counts:Record<string,number>,total:number}} TagDraft
 * @typedef {{present:boolean,value:unknown}} TagValue
 * @typedef {{path:string,expected:TagValue,target:TagValue}} TagChange
 * @typedef {{mtime:number,size:number,text:string}} CacheEntry
 * @typedef {{entries:Map<string,CacheEntry & {epoch:number}>,dirty:boolean,bytes:number}} Bucket
 * @typedef {{file:import('obsidian').TFile,mtime:number,size:number,match:boolean}} CachedMatch
 * @typedef {{matches:Set<string>,settled:Set<string>}} SearchProgress
 * @typedef {(completed:number,total:number,progress:SearchProgress)=>void} ProgressCallback
 * @typedef {{matches:Set<string>,errors:string[],cancelled:boolean,storageError?:boolean}} SearchResult
 * @typedef {{searchTree:TagNode,formula:string,textQuery:string,dateField:string,sortField:string,sortOrder:string,dateFrom:string,dateTo:string,noTagOnly:boolean,density:string,previewChars:number,folderFilters:string[],groupByFolder:boolean,folderGroupState:Record<string,boolean>,tagGroupState:Record<string,boolean>,resultTreeOpen?:Record<string,boolean>}} SavedState
 * @typedef {SavedState & {_selection?:{mode:boolean,paths:string[],folders:string[],draft:TagDraft|null,destination:string|null},_tagChanges?:TagChange[]}} Snapshot
 * @typedef {{summary:string,markdown?:string,thumb:string|null,loading:boolean,promise:Promise<void>}} ContentEntry
 * @typedef {SavedState & {formulaError:string,resultTreeOpen:Record<string,boolean>,resultTreeLimits:Record<string,number>,limit:number,tagCache:Record<string,number>|null,tagRevision:number|null,contentCache:Record<string,ContentEntry>,undoStack:Snapshot[],redoStack:Snapshot[]}} ViewState
 * @typedef {{schema:string,exportedAt:string,vault:string,pathBase:string,count:number,filters:Record<string,unknown>,paths:string[],vaultRoot?:string}} PathExport
 */
export {};
