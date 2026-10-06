function createSearchFixture() {
// Deterministic Japanese/Latin fixture; no user notes are read.
let seed=42;
const random=()=>{seed^=seed<<13;seed^=seed>>>17;seed^=seed<<5;return seed>>>0;};
const count=3000,words=['会議','予定','確認','記録','作業','買い物','開発','旅行','日記','読書'];
const texts=Array.from({length:count},(_,i)=>{
  const length=i%20===0?8000:i%4===0?1500:150;
  return Array.from({length},()=>words[random()%words.length]+(random()%2000)).join(' ')+(i%137===0?' 特殊検索語はるかぜ':'');
});
const files=texts.map((text,i)=>({path:`notes/${i}.md`,basename:`note${i}`,stat:{mtime:1,size:Buffer.byteLength(text)},index:i}));
return {texts,files,count};
}
module.exports={createSearchFixture};
