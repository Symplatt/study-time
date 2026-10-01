const {test}=require('node:test'),assert=require('node:assert/strict'),C=require('../web/core.js');
const now=new Date(2026,8,30,20).getTime();
function record(offset,minutes=1,id=String(offset)){
  const d=new Date(now);d.setDate(d.getDate()-offset);d.setHours(9,0,0,0);const start=+d,end=start+minutes*60000;
  return {id,started:start,ended:end,since:null,segments:[[start,end]]};
}
const state=records=>({...C.initial(),records});
test('连续学习从今天向前跨越1000天，不受统计范围限制',()=>{
  const s=state(Array.from({length:1000},(_,i)=>record(i)));
  for(const period of ['week','month','year'])assert.equal(C.buckets(s,period,now).streak,1000);
});
test('今日未学为零，中断停止计数，多条记录与零时长不重复计天',()=>{
  assert.equal(C.buckets(state([record(1)]),'week',now).streak,0);
  assert.equal(C.buckets(state([record(0),record(0,2,'second'),record(1),record(2,0),record(3)]),'week',now).streak,2);
  assert.equal(C.buckets(C.initial(),'week',now).historyBest.ms,0);
});
test('历史最佳查找全部1000天，并按每天合计而非单次取最大',()=>{
  const s=state([record(999,100),record(998,60),record(998,60,'other'),record(0,20)]);
  for(const period of ['week','month','year']){
    const d=C.buckets(s,period,now);assert.equal(d.historyBest.ms,120*60000);assert.equal(d.historyBest.key,C.dateKey(record(998).started));assert.equal(d.periodBest.ms,20*60000);
  }
});
test('周期最佳随范围切换，年度仍取单日而不是整月累计',()=>{
  const s=state([record(0,10),record(10,20),record(50,30),record(51,25)]);
  assert.equal(C.buckets(s,'week',now).periodBest.ms,10*60000);
  assert.equal(C.buckets(s,'month',now).periodBest.ms,20*60000);
  assert.equal(C.buckets(s,'year',now).periodBest.ms,30*60000);
});
test('跨午夜的进行中计时纳入连续天数及最佳，暂停日不算学习',()=>{
  const start=new Date(2026,8,29,23,30).getTime(),end=new Date(2026,8,30,1).getTime();
  const s=C.start(C.initial(),start),d=C.buckets(s,'year',end);
  assert.equal(d.streak,1);assert.equal(d.historyBest.ms,90*60000);assert.equal(d.historyBest.key,'2026-09-29');
});
test('未来日期不纳入连续天数和最佳，并列最佳固定取较早日期',()=>{
  const d=C.buckets(state([record(-1,200),record(0,20),record(1,20)]),'week',now);
  assert.equal(d.streak,2);assert.equal(d.historyBest.key,C.dateKey(record(1).started));
});
test('最佳范围偏好与旧存储兼容，导入及计时操作保留偏好和原记录',()=>{
  const old=state([record(3)]),s={...old,bestScope:'period'};
  assert.ok(C.validState(old));assert.ok(C.validState(JSON.parse(JSON.stringify(s))));
  const changed=C.finish(C.start(s,now-1000),now);assert.equal(changed.bestScope,'period');assert.deepEqual(changed.records[0],old.records[0]);
  const merged=C.mergeRecords(s,[record(2)]);assert.equal(merged.state.bestScope,'period');assert.equal(merged.state.records.length,2);
});
const fs=require('node:fs'),vm=require('node:vm');
const source=fs.readFileSync(require.resolve('../web/app.js'),'utf8');
function setupUI(s,period='week'){
  const elements={},listeners=new Map(),$=id=>elements[id]??={textContent:'',open:false,classList:{toggle(){}},querySelectorAll:()=>[],addEventListener(type,fn){listeners.set(id+':'+type,fn);},showModal(){this.open=true;},close(){this.open=false;}};
  const context={C,$,state:s,period,Date:{now:()=>now},shortDuration:ms=>String(ms),totalHTML:ms=>String(ms),window:{addEventListener(){}},document:{querySelectorAll:()=>[]},setTimeout,clearTimeout,Math,renderHeatmap(){}};
  context.save=next=>{context.state=next;return true;};
  vm.runInNewContext(source.slice(source.indexOf('  function renderStats'),source.indexOf('  let heatmapSignature=')),context);
  vm.runInNewContext(source.slice(source.indexOf("  const scopeDialog="),source.indexOf('  function pickDate')),context);
  context.renderStats();return {$,context,listeners};
}
test('周期内连续天数按所选范围截断，两个卡片分别确认并持久保存',()=>{
  const s=state(Array.from({length:1000},(_,i)=>record(i,i===999?100:1))),ui=setupUI(s);
  assert.equal(ui.$('stats-days').textContent,'1000 天');
  ui.listeners.get('streak-card:keydown')({key:'Enter',preventDefault(){}});ui.$('cancel-scope').onclick();assert.equal(ui.context.state.streakScope,undefined);
  ui.listeners.get('streak-card:keydown')({key:'Enter',preventDefault(){}});ui.$('confirm-scope').onclick();
  for(const [period,label] of [['week','本周'],['month','本月'],['year','本年']]){
    ui.context.period=period;ui.context.renderStats();assert.equal(ui.$('stats-days').textContent,`${C.buckets(s,period,now).days} 天`);
    assert.equal(ui.$('average-label').textContent,`${label}日均学习`);assert.equal(ui.$('sessions-label').textContent,`${label}专注次数`);
    assert.equal(ui.$('best-label').textContent,'历史单日最佳');
  }
  ui.listeners.get('best-card:keydown')({key:'Enter',preventDefault(){}});ui.$('confirm-scope').onclick();assert.equal(ui.context.state.streakScope,'period');assert.equal(ui.context.state.bestScope,'period');
  const restored=setupUI(JSON.parse(JSON.stringify(ui.context.state)));assert.equal(restored.$('stats-days').textContent,'7 天');
  restored.listeners.get('streak-card:keydown')({key:'Enter',preventDefault(){}});restored.$('confirm-scope').onclick();assert.equal(restored.$('stats-days').textContent,'1000 天');assert.equal(restored.context.state.bestScope,'period');
});
test('周期内连续天数遇到中断仍停止，不按周期天数或总学习天数代替',()=>{
 const ui=setupUI({...state([record(0),record(1),record(3)]),streakScope:'period'});assert.equal(ui.$('stats-days').textContent,'2 天');
});

test('热力图固定365个本地日期，含今天并独立于所选周期',()=>{
  const s=state([record(0,120),record(364,30),record(365,60)]);
  for(const period of ['week','month','year']){
    const days=C.buckets(s,period,now).heatmap;assert.equal(days.length,365);
    assert.equal(days[0].key,C.dateKey(record(364).started));assert.equal(days[0].ms,1800000);
    assert.equal(days[364].key,C.dateKey(now));assert.equal(days[364].level,4);assert.equal(days[363].level,0);
  }
});
test('热力图按每日累计分档，跨闰日保持365格',()=>{
  const s=state([record(0,10),record(0,20,'extra'),record(1,60),record(2,1)]),days=C.buckets(s,'week',now).heatmap;
  assert.equal(days[364].level,2);assert.equal(days[363].level,3);assert.equal(days[362].level,1);
  const leap=C.buckets(C.initial(),'year',new Date(2024,2,1,12).getTime()).heatmap;
  assert.equal(leap.length,365);assert.equal(leap[363].key,'2024-02-29');
});

test('连续学习注释在所有时段和范围下固定不变',()=>{
 for(const scope of ['period','history'])for(const period of ['week','month','year']){
  const ui=setupUI({...state([record(0)]),streakScope:scope},period);assert.equal(ui.$('streak-note').textContent,'不中断学习至今的天数');
 }
});
