const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),C=require('../web/core.js');
const source=fs.readFileSync(require.resolve('../web/app.js'),'utf8');
function setup(fail=false){
 const listeners=new Map(),classes=new Set(),article={style:{}},row={dataset:{recordIndex:'0'},classList:{remove(...names){names.forEach(n=>classes.delete(n));},add:n=>classes.add(n)},querySelector:()=>article,setPointerCapture(){},hasPointerCapture:()=>false};
 const elements={},$=id=>elements[id]??={querySelectorAll:()=>[row],addEventListener(t,f){listeners.set(id+':'+t,f);}};
 const start=new Date(2026,8,30,23,30).getTime(),end=start+3600000;
 let state=C.finish(C.start(C.initial(),start),end);state=C.start({...state,streakScope:'period'},end+1000);
 const context={$,C,state,window:{addEventListener(){}},render(){},toast(){},Math};context.save=next=>{if(fail)return false;context.state=next;return true;};
 vm.runInNewContext(source.slice(source.indexOf('  let swipePress='),source.indexOf('  let heatmapSignature=')),context);
 const event=(x,y,type)=>({isPrimary:true,button:0,pointerId:1,clientX:x,clientY:y,type,target:{closest:s=>s==='button'?null:row},preventDefault(){}});
 return {context,row,classes,article,fire:(type,x=0,y=0)=>listeners.get('record-list:'+type)(event(x,y,type)),listeners};
}
test('左右滑动达到阈值松手即删除，未松手不删除',()=>{for(const dx of [-80,80]){const a=setup();a.fire('pointerdown');a.fire('pointermove',dx);assert.equal(a.context.state.records.length,1);a.fire('pointerup',dx);assert.equal(a.context.state.records.length,0);}});
test('短滑、纵向滑动及取消手势保留记录',()=>{for(const [dx,dy,type] of [[20,0,'pointerup'],[0,80,'pointerup'],[-80,0,'pointercancel']]){const a=setup();a.fire('pointerdown');a.fire('pointermove',dx,dy);a.fire(type,dx,dy);assert.equal(a.context.state.records.length,1);assert.equal(a.article.style.transform||'','');}});
test('直接删除跨日专注全部切片，保留当前计时和范围偏好，可序列化恢复',()=>{const a=setup(),active=a.context.state.active;assert.equal(C.rows(a.context.state,active.started).filter(r=>!r.active).length,2);a.context.deleteRecord(a.row);assert.equal(a.context.state.records.length,0);assert.equal(a.context.state.active,active);assert.equal(a.context.state.streakScope,'period');assert.ok(C.validState(JSON.parse(JSON.stringify(a.context.state))));assert.equal(C.buckets(a.context.state,'week',active.started).total,0);});
test('保存失败保留记录并回弹',()=>{const a=setup(true);a.fire('pointerdown');a.fire('pointermove',-80);a.fire('pointerup',-80);assert.equal(a.context.state.records.length,1);assert.equal(a.article.style.transform,'');});
test('不存在的编号或当前计时不被删除',()=>{const a=setup(),s=a.context.state;assert.deepEqual(C.removeRecord(s,'missing'),s);assert.deepEqual(C.removeRecord(s,s.active.id),s);});
test('触摸隐式捕获转移的子元素事件不会提前结束滑动',()=>{const a=setup();a.fire('pointerdown');a.fire('pointermove',-30);a.listeners.get('record-list:lostpointercapture')({type:'lostpointercapture',pointerId:1,target:{}});a.fire('pointermove',-80);a.fire('pointerup',-80);assert.equal(a.context.state.records.length,0);});
