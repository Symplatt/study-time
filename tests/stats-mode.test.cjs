const {test}=require('node:test'),assert=require('node:assert/strict'),C=require('../web/core.js');
const at=(date,time='12:00:00')=>new Date(`${date}T${time}`).getTime();
const record=(date,minutes=1)=>{const started=at(date);return {id:date,started,ended:started+minutes*60000,since:null,segments:[[started,started+minutes*60000]]};};
const state=(mode,records=[])=>({...C.initial(),statsMode:mode,records});
test('1月2日星期二：所在周月年均从1月1日起，排除上一年记录',()=>{
 const s=state('calendar',[record('2023-12-31',100),record('2024-01-01',10),record('2024-01-02',20),record('2024-01-03',200)]);
 for(const p of ['week','month','year']){const d=C.buckets(s,p,at('2024-01-02'));assert.equal(d.start,'2024-01-01');assert.equal(d.end,'2024-01-02');assert.equal(d.days,2);assert.equal(d.total,1800000);assert.equal(d.sessions,2);assert.equal(d.periodBest.ms,1200000);assert.equal(d.historyBest.ms,6000000);assert.equal(d.total/d.days,900000);}
});
test('周期时长精确包含今天及前6/29/364天，年度首月只汇总范围内日期',()=>{
 const now=at('2026-10-03');
 for(const [period,days] of [['week',7],['month',30],['year',365]]){
  const first=new Date(now);first.setDate(first.getDate()-days+1);const before=new Date(first);before.setDate(before.getDate()-1);
  const s=state('rolling',[record(C.dateKey(first),10),record(C.dateKey(before),100),record('2026-10-03',20)]),d=C.buckets(s,period,now);
  assert.equal(d.days,days);assert.equal(d.start,C.dateKey(first));assert.equal(d.total,1800000);assert.equal(d.sessions,2);assert.equal(d.buckets.reduce((n,b)=>n+b.ms,0),d.total);assert.equal(d.periodBest.ms,1200000);
 }
});
test('闰年近一年始终365天，所在年可为366天，所在月长度正确',()=>{
 const now=at('2024-12-31');assert.equal(C.buckets(state('rolling'),'year',now).start,'2024-01-02');assert.equal(C.buckets(state('calendar'),'year',now).days,366);
 for(const [date,days] of [['2024-02-29',29],['2026-04-30',30],['2026-01-31',31]])assert.equal(C.buckets(state('calendar'),'month',at(date)).days,days);
});
test('所在周从周一开始，周日为7天，可以跨月跨年',()=>{
 for(const [date,start,days] of [['2024-01-01','2024-01-01',1],['2024-01-07','2024-01-01',7],['2025-01-01','2024-12-30',3]]){const d=C.buckets(state('calendar'),'week',at(date));assert.equal(d.start,start);assert.equal(d.days,days);}
});
test('凌晨4点才切换所在年与月，跨分界计时按实际片段纳入且不重复计次',()=>{
 const s=C.start(state('calendar'),at('2025-12-31','23:00:00'));
 assert.equal(C.buckets(s,'year',at('2026-01-01','03:59:59')).start,'2025-01-01');
 const d=C.buckets(s,'year',at('2026-01-01','05:00:00'));assert.equal(d.start,'2026-01-01');assert.equal(d.days,1);assert.equal(d.total,3600000);assert.equal(d.sessions,1);
});
test('切换方式保留历史连续天数和热力图，旧数据默认周期时长，操作保留新偏好',()=>{
 const records=[record('2024-01-01'),record('2024-01-02'),record('2023-12-31')],a=state('rolling',records),b=state('calendar',records),now=at('2024-01-02');
 for(const p of ['week','month','year']){const x=C.buckets(a,p,now),y=C.buckets(b,p,now);assert.deepEqual(x.heatmap,y.heatmap);assert.equal(x.streak,y.streak);assert.deepEqual(x.historyBest,y.historyBest);assert.deepEqual(C.buckets({...C.initial(),records},p,now),x);}
 const restored=JSON.parse(JSON.stringify(b));assert.ok(C.validState(restored));assert.equal(C.finish(C.start(restored,now),now+1000).statsMode,'calendar');assert.equal(C.mergeRecords(restored,[]).state.statsMode,'calendar');
});
const fs=require('node:fs'),vm=require('node:vm'),source=fs.readFileSync(require.resolve('../web/app.js'),'utf8');
test('设置按钮切换并保存，保存失败不切换，恢复时反映已存偏好',()=>{
 const buttons=['rolling','calendar'].map(mode=>({dataset:{statsMode:mode},setAttribute(k,v){this[k]=v;}})),note={},context={state:state(),document:{querySelectorAll:()=>buttons},$:()=>note,renderStats(){this.renders=(this.renders||0)+1;}};
 context.save=next=>{context.state=JSON.parse(JSON.stringify(next));return true;};
 vm.runInNewContext(source.slice(source.indexOf('  function renderSettings'),source.indexOf('  function render(){')),context);
 context.renderSettings();assert.equal(buttons[0]['aria-pressed'],'true');buttons[1].onclick();assert.equal(context.state.statsMode,'calendar');assert.equal(buttons[1]['aria-pressed'],'true');assert.match(note.textContent,/周一/);
 context.save=()=>false;buttons[0].onclick();assert.equal(context.state.statsMode,'calendar');assert.equal(buttons[1]['aria-pressed'],'true');
 context.renderSettings();assert.equal(buttons[1]['aria-pressed'],'true');
});
