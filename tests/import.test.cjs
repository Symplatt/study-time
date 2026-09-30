const {test}=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs'),C=require('../web/core.js');
const source=fs.readFileSync(require.resolve('../web/app.js'),'utf8');
function setup({clipboard,native}={}){
  const elements={},messages=[];
  const $=id=>elements[id]??=(id==='data-dialog'?{open:true,showModal(){this.open=true;},close(){this.open=false;},addEventListener(){}}:{});
  const context={$,C,Blob,Date,window:{AndroidStore:native},AndroidStore:native,navigator:{clipboard},storageError:false,state:C.start(C.initial(),90000),toast:m=>messages.push(m),render(){},navigate(){}};
  context.save=next=>{context.state=next;return true;};
  vm.runInNewContext(source.slice(source.indexOf('  let pendingImport='),source.indexOf("  window.addEventListener('storage'")),context);
  return {$,context,messages,click:()=>$('import-button').onclick()};
}
const records=C.finish(C.start(C.initial(),1000),61000).records;
const text=JSON.stringify({format:'shishi-backup',version:1,records});
test('剪切板导入先预览，确认后合并并保留当前计时，重复数据禁止确认',async()=>{
  const app=setup({clipboard:{readText:async()=>text}}),active=app.context.state.active;
  await app.click();assert.equal(app.context.state.records.length,0);assert.equal(app.$('import-preview').hidden,false);
  app.$('confirm-import').onclick();assert.equal(app.context.state.records.length,1);assert.equal(app.context.state.active,active);
  await app.click();assert.equal(app.$('confirm-import').disabled,true);
});
test('取消预览不写入数据',async()=>{
  const app=setup({clipboard:{readText:async()=>text}});await app.click();app.$('cancel-import').onclick();app.$('confirm-import').onclick();assert.equal(app.context.state.records.length,0);
});
test('空文本、无效 JSON 及超出字节限制时清除预览且不写入',async()=>{
  for(const value of ['', '  ', 'broken', '中'.repeat(4*1024*1024)]){
    let content=text;const app=setup({clipboard:{readText:async()=>content}});await app.click();content=value;await app.click();
    assert.equal(app.$('import-preview').hidden,true);app.$('confirm-import').onclick();assert.equal(app.context.state.records.length,0);assert.equal(app.messages.length,1);
  }
});
test('剪切板不可用及权限拒绝提示失败',async()=>{
  for(const clipboard of [undefined,{readText:async()=>{throw Error('denied');}}]){
    const app=setup({clipboard});await app.click();assert.deepEqual(app.messages,['读取失败，请检查剪切板权限后重试']);assert.equal(app.context.state.records.length,0);
  }
});
test('Android 导入调用原生桥接，回传文本后显示预览',async()=>{
  let calls=0;const app=setup({native:{importData:()=>calls++}});await app.click();assert.equal(calls,1);assert.equal(app.$('import-preview').hidden,true);
  app.context.window.receiveStudyImport(text);assert.equal(app.$('import-preview').hidden,false);assert.equal(app.context.state.records.length,0);
});
