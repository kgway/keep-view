'use strict';
const valid='2026-02-08T10:00:00+09:00';
const samples=[
  {path:'01 Created.md',frontmatter:{created:valid},yaml:`created: "${valid}"\n`,title:'有効な作成日時',body:'createdが設定済みなので、案内の未設定件数には含まれません。'},
  {path:'02 Missing.md',frontmatter:{},yaml:'',title:'createdプロパティがない',body:'通常のタイトルなので、ファイル名からの日時取り込み候補にはなりません。'},
  {path:'03 Empty.md',frontmatter:{created:null},yaml:'created:\n',title:'createdが空欄',body:'プロパティは存在します。移行ツールはこの値を上書きしません。'},
  {path:'04 Invalid.md',frontmatter:{created:'not-a-date'},yaml:'created: not-a-date\n',title:'createdが無効な値',body:'日時として読めない値です。移行ツールはこの値を上書きしません。'},
  {path:'Imported/2026-02-09T15_46_51.388+09_00.md',frontmatter:{},yaml:'',title:'日時形式のファイル名・未設定',body:'移行ツールで対象を確認すると、このノートだけが取り込み可能な候補になります。'},
  {path:'Preserved/2026-02-10T08_00_00.000Z.md',frontmatter:{created:null},yaml:'created:\n',title:'日時形式のファイル名・空欄',body:'ファイル名は読めますが、createdが既に存在するため取り込みません。'},
  {path:'07 Keep note with a title.md',frontmatter:{},yaml:'',title:'タイトルだけのKeep移行ノートの例',body:'Keepから来たノートでも、日時形式のファイル名がなければ、このツールでは元の作成日時を復元できません。'}
];
module.exports=samples.map(sample=>({...sample,content:`---\n${sample.yaml}tags: [date-sample]\n---\n\n# ${sample.title}\n\n${sample.body}\n`}));
