const {test}=require('node:test'),assert=require('node:assert/strict'),C=require('../web/core.js');
const t=s=>new Date(s).getTime(),H=3600000;
const session=(a,b)=>C.finish(C.start(C.initial(),t(a)),t(b));
test('学习日04点切换，日期标签仍按日历原样格式化',()=>{
 for(const [stamp,key] of [['2026-10-01T00:00:00','2026-09-30'],['2026-10-01T03:59:59.999','2026-09-30'],['2026-10-01T04:00:00','2026-10-01'],['2027-01-01T03:00:00','2026-12-31'],['2024-03-01T03:00:00','2024-02-29']])assert.equal(C.studyDateKey(t(stamp)),key);
 assert.equal(C.dateKey(C.localDate('2026-10-01')),'2026-10-01');
});
test('中午12点到次日03点全部15小时归前一天，04点后新一天为零',()=>{
 const s=session('2026-09-30T12:00:00','2026-10-01T03:00:00');
 const rows=C.rows(s,0);assert.equal(rows.length,1);assert.equal(rows[0].date,'2026-09-30');assert.equal(rows[0].ms,15*H);
 for(const period of ['week','month','year']){
  const before=C.buckets(s,period,t('2026-10-01T03:00:00'));assert.equal(before.total,15*H);assert.equal(before.streak,1);assert.equal(before.heatmap.at(-1).key,'2026-09-30');assert.equal(before.historyBest.ms,15*H);
  const after=C.buckets(s,period,t('2026-10-01T04:00:00'));assert.equal(after.heatmap.at(-1).key,'2026-10-01');assert.equal(after.heatmap.at(-1).ms,0);assert.equal(after.streak,0);assert.equal(after.total,15*H);
 }
 const b=C.buckets(s,'week',t('2026-10-01T04:00:00')).buckets;assert.equal(b.at(-2).ms,15*H);assert.equal(b.at(-1).ms,0);
});
test('正在计时跨04点才拆分，精确边界不生成零时长记录',()=>{
 const s=C.start(C.initial(),t('2026-09-30T12:00:00'));
 assert.equal(C.rows(s,t('2026-10-01T04:00:00')).length,1);
 const r=C.rows(s,t('2026-10-01T05:00:00'));assert.deepEqual(r.map(x=>[x.date,x.ms]),[['2026-09-30',16*H],['2026-10-01',H]]);
 assert.equal(C.buckets(s,'week',t('2026-10-01T05:00:00')).sessions,1);assert.equal(C.buckets(s,'week',t('2026-10-01T05:00:00')).streak,2);
});
test('跨04点暂停只累计实际学习片段',()=>{
 let s=C.start(C.initial(),t('2026-10-01T03:00:00'));s=C.toggle(s,t('2026-10-01T03:30:00'));s=C.toggle(s,t('2026-10-01T04:30:00'));s=C.finish(s,t('2026-10-01T05:00:00'));
 assert.deepEqual(C.rows(s,0).map(x=>[x.date,x.ms]),[['2026-09-30',H/2],['2026-10-01',H/2]]);
});
test('旧记录序列化和备份恢复按新学习日聚合且原始时间戳不变',()=>{
 const s=session('2026-12-31T12:00:00','2027-01-02T05:00:00'),snapshot=JSON.stringify(s);
 const restored=C.mergeRecords(C.initial(),C.parseBackup(C.exportBackup(s,t('2027-01-02T06:00:00')))).state;
 assert.deepEqual(C.rows(restored,0).map(x=>[x.date,x.ms]),[['2026-12-31',16*H],['2027-01-01',24*H],['2027-01-02',H]]);assert.equal(JSON.stringify(s),snapshot);assert.equal(C.rows(restored,0).reduce((n,x)=>n+x.ms,0),C.duration(s.records[0],0));
});
test('凌晨月初年度范围仍截至前一个学习月',()=>{
 const d=C.buckets(C.initial(),'year',t('2027-01-01T03:00:00'));assert.equal(d.buckets.at(-1).key,'2026-12');assert.equal(d.buckets[0].key,'2026-01');assert.equal(d.heatmap.at(-1).key,'2026-12-31');
});

