(function (root) {
  'use strict';
  const dateKey = (time) => { const d = new Date(time); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; };
  const localDate = key => new Date(`${key}T00:00:00`);
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
  function split(record, now) {
    const days = new Map();
    for (const [start,end] of segments(record,now)) {
      let cursor = start;
      while (cursor < end) {
        const d = new Date(cursor); d.setHours(24,0,0,0);
        const edge = Math.min(end,d.getTime()), key = dateKey(cursor);
        const row = days.get(key) || {id:record.id,date:key,ms:0,start:cursor,end:edge,active:!record.ended};
        row.ms += edge-cursor; row.end = edge; days.set(key,row); cursor = edge;
      }
    }
    return [...days.values()];
  }
  const rows = (state,now) => [...state.records,...(state.active ? [state.active] : [])].flatMap(r=>split(r,now));
  function buckets(state,period,now) {
    const today = new Date(now); today.setHours(0,0,0,0);
    const count = period === 'week' ? 7 : period === 'month' ? 30 : 12;
    const result = Array.from({length:count},(_,i)=>{
      const date = new Date(today);
      if (period === 'year') {date.setDate(1);date.setMonth(date.getMonth()-(count-1-i));}
      else date.setDate(date.getDate()-(count-1-i));
      const key = dateKey(date);
      return {key:period === 'year'?key.slice(0,7):key,ms:0,count:0,label:period === 'year'?`${date.getMonth()+1}月`:`${date.getMonth()+1}/${date.getDate()}`};
    });
    const start = period === 'year' ? `${result[0].key}-01` : result[0].key;
    const validRows = rows(state,now).filter(r=>r.date>=start && r.date<=dateKey(now));
    for (const row of validRows) {const b=result.find(b=>b.key===(period==='year'?row.date.slice(0,7):row.date));if(b){b.ms+=row.ms;b.count++;}}
    const days = Math.round((today-localDate(start))/86400000)+1;
    return {buckets:result,total:validRows.reduce((n,r)=>n+r.ms,0),sessions:new Set(validRows.map(r=>r.id)).size,activeDays:new Set(validRows.filter(r=>r.ms>0).map(r=>r.date)).size,days};
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
    if(typeof text!=='string'||text.length>10*1024*1024) throw Error('备份文件不能超过 10 MB');
    let backup;
    try {backup=JSON.parse(text.replace(/^\uFEFF/,''));}catch(e){throw Error('文件不是有效的 JSON 备份');}
    if(!backup||backup.format!=='shishi-backup'||backup.version!==1||!Array.isArray(backup.records)) throw Error('不支持此备份格式，请选择拾时导出的 JSON 文件');
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
  const api = {dateKey,localDate,initial,start,toggle,finish,duration,rows,buckets,validState,exportBackup,parseBackup,mergeRecords};
  if(typeof module!=='undefined') module.exports=api; else root.StudyCore=api;
})(typeof window==='undefined'?globalThis:window);
