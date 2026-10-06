const {test}=require('node:test');
const assert=require('node:assert/strict');
const {t,setLanguage,getLocale}=require('../lib/i18n');
const messages=require('../lib/ja.json');

test('message catalog edits change text while placeholders preserve arbitrary file names',()=>{
  setLanguage('ja');
  const key='{0} に新規ノート',original=messages[key];
  try {
    messages[key]='{0} に作成';
    assert.equal(t(key,['folder {1} 🧑🏽‍💻']),'folder {1} 🧑🏽‍💻 に作成');
    assert.equal(t('unknown'),'unknown');
  } finally {messages[key]=original;}
  for(const [key,value] of Object.entries(messages)) {
    assert.equal(typeof value,'string');
    assert.deepEqual([...value.matchAll(/\{\d+\}/g)].map(m=>m[0]).sort(),[...key.matchAll(/\{\d+\}/g)].map(m=>m[0]).sort());
  }
});

test('English is the default fallback and both editable catalogs cover every message',()=>{
  const english=require('../lib/en.json');
  assert.deepEqual(Object.keys(english).sort(),Object.keys(messages).sort());
  for(const [key,value] of Object.entries(english)) {
    assert.ok(value.length>0);
    assert.deepEqual([...value.matchAll(/\{\d+\}/g)].map(m=>m[0]).sort(),[...key.matchAll(/\{\d+\}/g)].map(m=>m[0]).sort());
  }
  for(const language of ['en','de','fr','']) {setLanguage(language);assert.equal(getLocale(),'en');assert.equal(t('新規ノート'),'New note');}
  for(const language of ['ja','ja-JP']) {setLanguage(language);assert.equal(t('新規ノート'),'新規ノート');}
});

test('preview character labels use English singular only for one',()=>{
  setLanguage('en');assert.equal(t('{0}字',[1]),'1 char');assert.equal(t('{0}字',[150]),'150 chars');
  setLanguage('ja');assert.equal(t('{0}字',[1]),'1字');assert.equal(t('{0}字',[150]),'150字');
});
