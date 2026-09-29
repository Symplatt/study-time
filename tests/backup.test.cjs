const {test}=require('node:test'),assert=require('node:assert/strict'),C=require('../web/core.js');
const one=()=>C.finish(C.start(C.initial(),1000),61000);
const pack=records=>JSON.stringify({format:'shishi-backup',version:1,records});
test('备份往返保留全部已结束片段，不包含进行中的计时',()=>{
  let s=one();s=C.start(s,80000);const text=C.exportBackup(s,100000);
  const records=C.parseBackup(text);assert.deepEqual(records,s.records);assert.equal(JSON.parse(text).active,undefined);
  assert.equal(C.duration(records[0],0),60000);
});
test('重复导入与文件内重复项不会重复累计',()=>{
  const r=one().records[0],incoming=C.parseBackup(pack([r,r]));
  const first=C.mergeRecords(C.initial(),incoming);assert.equal(first.added,1);assert.equal(first.duplicates,1);
  const second=C.mergeRecords(first.state,incoming);assert.equal(second.added,0);assert.equal(second.duplicates,2);
});
test('相同内容不同编号去重，同编号不同内容保留本机记录',()=>{
  const s=one(),r=s.records[0];const merged=C.mergeRecords(s,[{...r,id:'another'},{...r,ended:62000,segments:[[1000,62000]]}]);
  assert.equal(merged.duplicates,1);assert.equal(merged.conflicts,1);assert.deepEqual(merged.state.records,s.records);
});
test('导入不改变当前计时及原数据对象',()=>{
  const s=C.start(C.initial(),100000);const original=JSON.stringify(s);
  const merged=C.mergeRecords(s,one().records);assert.equal(merged.state.active,s.active);assert.equal(JSON.stringify(s),original);assert.equal(merged.added,1);
  assert.equal(C.mergeRecords(s,[{...one().records[0],id:s.active.id}]).conflicts,1);
});
test('非法文件与不支持版本整份拒绝',()=>{
  for(const text of ['bad','null','{}',JSON.stringify({format:'shishi-backup',version:2,records:[]})])assert.throws(()=>C.parseBackup(text));
  const valid=one().records[0];assert.throws(()=>C.parseBackup(pack([valid,{...valid,segments:[[6000,5000]]}])));
});
test('重叠、越界、非数值时间与超大范围被拒绝',()=>{
  const r=one().records[0];for(const segments of [[[0,2000]],[[1000,90000]],[[1000,5000],[4000,6000]],[[null,2000]]])assert.throws(()=>C.parseBackup(pack([{...r,segments}])));
  assert.throws(()=>C.parseBackup(pack([{...r,ended:8e15,segments:[[1000,8e15]]}])));
});
test('兼容 UTF-8 BOM 与空备份，只保留预期字段',()=>{
  assert.deepEqual(C.parseBackup('\uFEFF'+pack([])),[]);
  const r=one().records[0];assert.deepEqual(C.parseBackup(pack([{...r,extra:'ignored'}]))[0],r);
});
