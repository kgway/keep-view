'use strict';

/** @param {unknown} value @returns {Record<string,unknown>} */
function record(value) {
  return value!==null && typeof value==='object' && !Array.isArray(value)
    ? /** @type {Record<string,unknown>} */ (value) : {};
}

/** @param {import('obsidian').TAbstractFile|null} file @returns {file is import('obsidian').TFolder} */
function isFolder(file) {return !!file && 'children' in file && Array.isArray(file.children);}

/** @param {import('obsidian').TAbstractFile|null} file @returns {file is import('obsidian').TFile} */
function isFile(file) {return !!file && !isFolder(file);}

/** @param {unknown} error */
function errorMessage(error) {return error instanceof Error?error.message:String(error);}

/** @template T @param {T} value @returns {T} */
function clone(value) {
  /** @type {unknown} */
  const copy=typeof structuredClone==='function'?structuredClone(value):JSON.parse(JSON.stringify(value));
  return /** @type {T} */ (copy);
}

/** @param {unknown} value @returns {string[]} */
function strings(value) {
  const values=Array.isArray(value)?/** @type {unknown[]} */ (value):[];
  return values.filter(/** @param {unknown} item @returns {item is string} */ item=>typeof item==='string');
}
/** @template T @returns {Record<string,T>} */
function dictionary() {
  const value=/** @type {unknown} */ (Object.create(null));
  return /** @type {Record<string,T>} */ (value);
}

module.exports={record,isFolder,isFile,errorMessage,clone,strings,dictionary};
