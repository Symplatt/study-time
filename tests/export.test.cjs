const {test}=require('node:test');
const assert=require('node:assert/strict');
const vm=require('node:vm');
const fs=require('node:fs');
const C=require('../web/core.js');
const source=fs.readFileSync(require.resolve('../web/app.js'),'utf8');
const handler=source.slice(source.indexOf("  $('export-button').onclick="),source.indexOf("  $('import-button').onclick="));
function setup({native,clipboard,storageError=false}={}){
  const button={},messages=[];
  let state=C.finish(C.start(C.initial(),1000),61000);
  state=C.start(state,70000);
  const context={$:()=>button,C,state,storageError,window:{AndroidStore:native},AndroidStore:native,navigator:{clipboard},Blob,Date,toast:m=>messages.push(m)};
  vm.runInNewContext(handler,context);
  return {click:()=>button.onclick(),messages,state};
}
test('网页导出复制可重新导入的 JSON，排除当前计时',async()=>{
  let copied;const app=setup({clipboard:{writeText:async text=>{copied=text;}}});
  await app.click();assert.deepEqual(C.parseBackup(copied),app.state.records);
  assert.equal(JSON.parse(copied).active,undefined);assert.deepEqual(app.messages,['数据已复制到剪切板']);
});
test('剪切板拒绝访问及不可用时提示失败，不误报成功',async()=>{
  for(const clipboard of [undefined,{writeText:async()=>{throw Error('denied');}}]){
    const app=setup({clipboard});await app.click();assert.deepEqual(app.messages,['复制失败，请检查剪切板权限后重试']);
  }
});
test('Android 导出交给原生剪切板桥接并等待原生反馈',async()=>{
  let copied;const app=setup({native:{exportData:text=>{copied=text;}}});
  await app.click();assert.deepEqual(C.parseBackup(copied),app.state.records);assert.deepEqual(app.messages,[]);
});
test('存储读取失败时禁止复制空备份覆盖用户剪切板',async()=>{
  let calls=0;const app=setup({storageError:true,clipboard:{writeText:async()=>calls++}});
  await app.click();assert.equal(calls,0);assert.deepEqual(app.messages,['无法读取现有数据，暂不能导出']);
});
