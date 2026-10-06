const {test}=require('node:test');
const assert=require('node:assert/strict');
const {openNoteInForeground}=require('../lib/note-opening');

test('foreground note opening overrides background preference and reveals the same loaded leaf',async()=>{
  const file={path:'notes/example.md'},events=[];
  let finishOpen,finishReveal,foreground=null;
  const leaf={openFile:(opened,state)=>{
    assert.equal(opened,file);
    assert.deepEqual(state,{active:true});
    events.push('open');
    return new Promise(resolve=>{finishOpen=()=>{events.push('loaded');resolve();};});
  }};
  const app={workspace:{
    getLeaf:type=>{assert.equal(type,'tab');events.push('tab');return leaf;},
    revealLeaf:revealed=>{
      assert.equal(revealed,leaf);events.push('reveal');
      return new Promise(resolve=>{finishReveal=()=>{foreground=file;resolve();};});
    }
  }};
  let completed=false;
  const opening=openNoteInForeground(app,file).then(()=>{completed=true;});
  assert.deepEqual(events,['tab','open']);
  finishOpen();await Promise.resolve();
  assert.deepEqual(events,['tab','open','loaded','reveal']);
  assert.equal(completed,false);
  finishReveal();await opening;
  assert.equal(foreground,file);assert.equal(completed,true);
});

test('failed opening does not reveal an unrelated or unloaded note',async()=>{
  const error=new Error('Test open failure');let reveals=0;
  const app={workspace:{getLeaf:()=>({openFile:async()=>{throw error;}}),revealLeaf:async()=>{reveals++;}}};
  await assert.rejects(openNoteInForeground(app,{path:'notes/example.md'}),value=>value===error);
  assert.equal(reveals,0);
});

test('reveal failures reach the caller instead of reporting success',async()=>{
  const error=new Error('Test reveal failure');
  const app={workspace:{getLeaf:()=>({openFile:async()=>{}}),revealLeaf:async()=>{throw error;}}};
  await assert.rejects(openNoteInForeground(app,{path:'notes/example.md'}),value=>value===error);
});
