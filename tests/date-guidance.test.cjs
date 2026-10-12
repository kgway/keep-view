'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {DateGuidance}=require('./load-source.cjs').loadSource('../lib/date-guidance');
const page=(name,property=null,propertyPresent=false,metadataReady=true)=>({file:{name,property,propertyPresent,metadataReady}});

test('disabled date guidance does not request pages or inspect filenames',()=>{
  const fail=()=>{throw Error('Disabled guidance must not check');};
  assert.equal(new DateGuidance().read(false,'created',fail,fail),null);
});
test('guidance distinguishes absent and invalid properties; filename candidates must be absent',()=>{
  const pages=[page('ordinary'),page('timestamp'),page('timestamp',null,true),page('valid',42,true)];
  let scans=0,filenameChecks=0;
  const read=()=>{scans++;return pages;},filename=name=>{filenameChecks++;return name==='timestamp'?'date':null;};
  const guide=new DateGuidance();
  assert.deepEqual(guide.read(true,'created',read,filename),{missing:2,invalid:1,importable:1});
  assert.equal(filenameChecks,2);
  guide.read(true,'created',read,filename);assert.equal(filenameChecks,2,'Unchanged page snapshots reuse the summary');
  guide.read(true,'imported',read,filename);assert.equal(filenameChecks,4,'Changing the configured property recomputes the summary');
  guide.read(false,'created',read,filename);assert.equal(scans,3,'Disabling skips the pages callback even after a prior result');
});
test('guidance waits for indexed metadata and updates after a new page snapshot',()=>{
  const guide=new DateGuidance();let pages=[page('timestamp',null,false,false)],checks=0;
  const read=()=>pages,filename=()=>{checks++;return 'date';};
  assert.equal(guide.read(true,'created',read,filename),null);assert.equal(checks,0);
  pages=[page('timestamp')];assert.equal(guide.read(true,'created',read,filename).importable,1);
  pages=[page('timestamp',42,true)];assert.equal(guide.read(true,'created',read,filename),null);
});
