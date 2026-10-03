(function (root) {
  'use strict';
  const dateKey = (time) => { const d = new Date(time); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; };
  const localDate = key => new Date(`${key}T00:00:00`);
  // Use wall-clock dates so daylight-saving changes still switch at local 04:00.
  const studyDateKey = time => { const d=new Date(time); if(d.getHours()<4)d.setDate(d.getDate()-1); return dateKey(d); };
  const initial = () => ({version:1, records:[], active:null});
  function start(state, now) {
    if (state.active) return state;
    return {...state, active:{id:`${now}`, started:now, since:now, segments:[]}};
  }
  function toggle(state, now) {
    if (!state.active) return state;
    const a = state.active;
    return {...state,active:a.since !== null ? {...a,since:null,segments:[...a.segments,[a.since,Math.max(a.since,now)]]} : {...a,since:now}};
  }
  const segments = (a,now) => !a ? [] : [...a.segments,...(a.since !== null ? [[a.since,Math.max(a.since,now)]] : [])];
  const duration = (a,now) => segments(a,now).reduce((n,[s,e])=>n+e-s,0);
  function finish(state,now) {
    if (!state.active) return state;
    const record = {...state.active, since:null, ended:now, segments:segments(state.active,now)};
    return {...state,active:null,records:[...state.records,record]};
  }
  // Each hour starts a darker lap on the same gray track; cap only the ring, never the timer.
  function ringProgress(active,now) {
    const seconds=Math.min(28800,Math.floor(duration(active,now)/1000));
    return {seconds,hour:Math.min(8,Math.floor(seconds/3600)+1),completed:Math.floor(seconds/3600),fraction:seconds===28800?1:seconds%3600/3600};
  }
  function removeRecord(state,id) {
    return {...state,records:state.records.filter(record=>record.id!==id)};
  }
  function split(record, now) {
    const days = new Map();
    for (const [start,end] of segments(record,now)) {
      let cursor = start;
      while (cursor < end) {
        const key = studyDateKey(cursor), d = localDate(key);
        d.setDate(d.getDate()+1); d.setHours(4,0,0,0);
        const edge = Math.min(end,d.getTime());
        const row = days.get(key) || {id:record.id,date:key,ms:0,start:cursor,end:edge,active:!record.ended};
        row.ms += edge-cursor; row.end = edge; days.set(key,row); cursor = edge;
      }
    }
    return [...days.values()];
  }
  const rows = (state,now) => [...state.records,...(state.active ? [state.active] : [])].flatMap(r=>split(r,now));
  function buckets(state,period,now) {
    const todayKey = studyDateKey(now), today = localDate(todayKey);
    const calendar = state.statsMode === 'calendar', first = new Date(today);
    if(calendar){
      if(period==='week')first.setDate(first.getDate()-(first.getDay()+6)%7);
      else if(period==='month')first.setDate(1);
      else first.setMonth(0,1);
    }else first.setDate(first.getDate()-({week:7,month:30,year:365}[period]-1));
    const start = dateKey(first), days = Math.round((today-first)/86400000)+1;
    // Annual columns group by month, but the first month is clipped to the exact day range.
    const count = period==='year' ? (today.getFullYear()-first.getFullYear())*12+today.getMonth()-first.getMonth()+1 : days;
    const result = Array.from({length:count},(_,i)=>{
      const date = new Date(first);
      if (period === 'year') {date.setDate(1);date.setMonth(date.getMonth()+i);}
      else date.setDate(date.getDate()+i);
      const key = dateKey(date);
      return {key:period === 'year'?key.slice(0,7):key,ms:0,count:0,label:period === 'year'?`${date.getMonth()+1}月`:`${date.getMonth()+1}/${date.getDate()}`};
    });
    const allRows = rows(state,now);
    const validRows = allRows.filter(r=>r.date>=start && r.date<=todayKey);
    for (const row of validRows) {const b=result.find(b=>b.key===(period==='year'?row.date.slice(0,7):row.date));if(b){b.ms+=row.ms;b.count++;}}
    // Aggregate by study day before finding the best, including year view.
    const daily = new Map();
    for(const row of allRows)if(row.date<=todayKey&&row.ms>0)daily.set(row.date,(daily.get(row.date)||0)+row.ms);
    const cursor = new Date(today);let streak=0;
    while(daily.has(dateKey(cursor))){streak++;cursor.setDate(cursor.getDate()-1);}
    const best = from => [...daily].filter(([key])=>key>=from).reduce((best,[key,ms])=>ms>best.ms||(ms===best.ms&&key<best.key)?{key,ms}:best,{key:'',ms:0});
    const heatmap=Array.from({length:365},(_,i)=>{
      const d=new Date(today);d.setDate(d.getDate()-(364-i));const key=dateKey(d),ms=daily.get(key)||0;
      return {key,ms,level:ms===0?0:ms<1800000?1:ms<3600000?2:ms<7200000?3:4};
    });
    return {start,end:todayKey,heatmap,streak,historyBest:best(''),periodBest:best(start),buckets:result,total:validRows.reduce((n,r)=>n+r.ms,0),sessions:new Set(validRows.map(r=>r.id)).size,activeDays:new Set(validRows.filter(r=>r.ms>0).map(r=>r.date)).size,days};
  }
  function validState(s) {
    const segment = p => Array.isArray(p)&&p.length===2&&p.every(Number.isFinite)&&p[1]>=p[0];
    const record = r=>r&&typeof r.id==='string'&&Number.isFinite(r.started)&&Array.isArray(r.segments)&&r.segments.every(segment)&&(r.since===null||Number.isFinite(r.since));
    return s&&s.version===1&&Array.isArray(s.records)&&s.records.every(r=>record(r)&&Number.isFinite(r.ended)&&r.since===null)&&(s.active===null||record(s.active));
  }
  function exportBackup(state,now) {
    return JSON.stringify({format:'shishi-backup',version:1,exportedAt:new Date(now).toISOString(),records:state.records},null,2);
  }
  function parseBackup(text) {
    if(typeof text!=='string'||text.length>10*1024*1024) throw Error('备份不能超过 10 MB');
    let backup;
    try {backup=JSON.parse(text.replace(/^\uFEFF/,''));}catch(e){throw Error('内容不是有效的 JSON 备份');}
    if(!backup||backup.format!=='shishi-backup'||backup.version!==1||!Array.isArray(backup.records)) throw Error('不支持此备份格式，请复制拾时导出的 JSON 数据');
    if(backup.records.length>50000)throw Error('单个备份最多支持 50000 条记录');
    const time=n=>Number.isSafeInteger(n)&&n>=0&&n<8640000000000000;
    let spans=0,days=0;
    return backup.records.map(r=>{
      if(!r||typeof r.id!=='string'||!r.id.length||r.id.length>200||!time(r.started)||!time(r.ended)||r.ended<r.started||r.since!==null||!Array.isArray(r.segments))throw Error('备份包含无效的学习记录，未导入任何数据');
      let previous=r.started;
      const clean=r.segments.map(p=>{
        if(!Array.isArray(p)||p.length!==2||!p.every(time)||p[0]<previous||p[1]<p[0]||p[1]>r.ended)throw Error('备份包含无效的起止时间，未导入任何数据');
        previous=p[1];spans++;days+=Math.ceil((p[1]-p[0])/86400000)+1;
        if(spans>100000||days>200000)throw Error('备份记录范围过大，请拆分后导入');
        return [...p];
      });
      return {id:r.id,started:r.started,since:null,segments:clean,ended:r.ended};
    });
  }
  function mergeRecords(state,incoming) {
    const fingerprint=r=>JSON.stringify([r.started,r.ended,r.segments]);
    const byId=new Map(state.records.map(r=>[r.id,fingerprint(r)]));
    const fingerprints=new Set(byId.values());
    const added=[];let duplicates=0,conflicts=0;
    for(const record of incoming){
      const f=fingerprint(record);
      if(state.active&&state.active.id===record.id){conflicts++;continue;}
      if(byId.has(record.id)){if(byId.get(record.id)===f)duplicates++;else conflicts++;continue;}
      if(fingerprints.has(f)){duplicates++;continue;}
      byId.set(record.id,f);fingerprints.add(f);added.push(record);
    }
    return {state:{...state,records:[...state.records,...added]},added:added.length,duplicates,conflicts};
  }
  const api = {dateKey,studyDateKey,localDate,initial,start,toggle,finish,removeRecord,duration,ringProgress,rows,buckets,validState,exportBackup,parseBackup,mergeRecords};
  if(typeof module!=='undefined') module.exports=api; else root.StudyCore=api;
})(typeof window==='undefined'?globalThis:window);
