'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {readState,readSettings}=require('./load-source.cjs').loadSource('../lib/saved-data');
test('saved data preserves supported state and rejects invalid or transient fields',()=>{
  const tree={type:'and',id:'root',children:[{type:'tag',id:'note',tag:'work/sub'}]};
  const saved={searchTree:tree,textQuery:'query',folderFilters:['Work',42],previewChars:150,groupByFolder:true,folderGroupState:JSON.parse('{"Work":true,"__proto__":true,"bad":"yes"}'),contentCache:{private:'must not restore'},undoStack:['must not restore']};
  const state=readState(saved);
  assert.deepEqual(state.searchTree,tree);assert.deepEqual(state.folderFilters,['Work']);assert.equal(state.textQuery,'query');assert.equal(state.groupByFolder,true);
  assert.equal(state.folderGroupState.Work,true);assert.equal(Object.hasOwn(state.folderGroupState,'bad'),false);assert.equal({}.polluted,undefined);
  assert.equal(Object.hasOwn(state,'contentCache'),false);assert.equal(Object.hasOwn(state,'undoStack'),false);
  assert.deepEqual(readState({searchTree:{type:'invalid'},textQuery:[],previewChars:Infinity}),{});
});
test('settings use defaults for invalid types without sharing mutable arrays',()=>{
  const defaults={dateProperty:'created',creationTimeZone:'',previewLengths:[50,150],previewMode:'markdown',confirmDelete:true,fastSearch:true,showDateGuidance:true,language:'auto'};
  const settings=readSettings({dateProperty:42,confirmDelete:false,fastSearch:'no',previewLengths:[100,'200'],language:'ja',unexpected:'discard'},defaults);
  assert.equal(settings.dateProperty,'created');assert.equal(settings.confirmDelete,false);assert.equal(settings.fastSearch,true);assert.equal(settings.language,'ja');assert.equal(Object.hasOwn(settings,'unexpected'),false);
  assert.deepEqual(settings.previewLengths,[50,150]);settings.previewLengths.push(300);assert.deepEqual(defaults.previewLengths,[50,150]);
  assert.deepEqual(readSettings({previewLengths:[100,200]},defaults).previewLengths,[100,200]);
  assert.equal(readSettings({showDateGuidance:false},defaults).showDateGuidance,false);
  assert.equal(readSettings({showDateGuidance:'false'},defaults).showDateGuidance,true);
});
