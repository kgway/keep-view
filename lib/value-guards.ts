import type {TAbstractFile, TFile, TFolder} from "obsidian";


function record(value: unknown): Record<string,unknown> {
  return value!==null && typeof value==='object' && !Array.isArray(value)
    ?  (value as Record<string,unknown>) : {};
}

function isFolder(file: TAbstractFile|null): file is TFolder {return !!file && 'children' in file && Array.isArray(file.children);}

function isFile(file: TAbstractFile|null): file is TFile {return !!file && !isFolder(file);}

function errorMessage(error: unknown) {return error instanceof Error?error.message:String(error);}

function clone<T>(value: T): T {

  const copy: unknown=typeof structuredClone==='function'?structuredClone(value):JSON.parse(JSON.stringify(value));
  return  (copy as T);
}

function strings(value: unknown): string[] {
  const values=Array.isArray(value)? (value as unknown[]):[];
  return values.filter( (item: unknown): item is string=>typeof item==='string');
}

function dictionary<T>(): Record<string,T> {
  const value= (Object.create(null) as unknown);
  return  (value as Record<string,T>);
}

export {record,isFolder,isFile,errorMessage,clone,strings,dictionary};
