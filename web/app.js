(() => {
  'use strict';
  const C=StudyCore, $=id=>document.getElementById(id);
  const paths={trash:'M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15M10 10v7m4-7v7',settings:'M9 3h6l1 3 3 1 2 5-2 5-3 1-1 3H9l-1-3-3-1-2-5 2-5 3-1z M16 12a4 4 0 1 1-8 0 4 4 0 0 1 8 0',database:'M20 5c0 2-16 2-16 0s16-2 16 0v14c0 2-16 2-16 0V5M4 12c0 2 16 2 16 0',download:'M12 3v12m-5-5 5 5 5-5M4 17v4h16v-4',upload:'M12 16V4m-5 5 5-5 5 5M4 17v4h16v-4',play:'m9 5 11 7-11 7z',pause:'M8 5v14M16 5v14',stop:'M6 6h12v12H6z',home:'m3 10 9-7 9 7v10H3z M9 20v-7h6v7',chart:'M4 20V10m8 10V4m8 16v-7',chevron:'m7 10 5 5 5-5',close:'m6 6 12 12M6 18 18 6',book:'M12 5C8 2 4 3 2 4v15c4-2 7-1 10 1 3-2 6-3 10-1V4c-4-2-7-1-10 1v15',clock:'M12 8v5l3 2 M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0',calendar:'M5 5h14a2 2 0 0 1 2 2v13H3V7a2 2 0 0 1 2-2 M7 3v4m10-4v4M3 10h18',leaf:'M4 20C4 8 12 3 21 3c0 12-7 16-14 13M4 20 15 9',shield:'m12 2 9 4v6c0 5-5 8-9 10-4-2-9-5-9-10V6z m-4 10 3 3 5-6',sun:'M16 12a4 4 0 1 1-8 0 4 4 0 0 1 8 0 M12 1v2m0 18v2M1 12h2m18 0h2M4 4l2 2m12 12 2 2M4 20l2-2M18 6l2-2',trophy:'M7 3h10v6c0 7-10 7-10 0z M7 5H3v4c0 3 3 4 5 4m9-8h4v4c0 3-3 4-5 4M12 15v5m-5 1h10'};
  const icon=name=>`<svg viewBox="0 0 24 24" aria-hidden="true"><path d="${paths[name]||paths.clock}"/></svg>`;
  document.querySelectorAll('[data-icon]').forEach(e=>e.innerHTML=icon(e.dataset.icon));
  let storageError=false;
  function read(){try{const raw=window.AndroidStore?AndroidStore.read():localStorage.getItem('study-time-v1');if(!raw)return C.initial();const parsed=JSON.parse(raw);if(!C.validState(parsed))throw Error('Invalid state');return parsed;}catch(e){storageError=true;return C.initial();}}
  let state=read(), selected=C.studyDateKey(Date.now()), period='week', view='home', calendarMonth=C.localDate(selected), lastToday=selected;
  let toastTimer,toastHideTimer;
  function toast(message,duration=3800){clearTimeout(toastTimer);clearTimeout(toastHideTimer);const box=$('toast');box.textContent=message;box.classList.remove('fading');box.hidden=false;toastTimer=setTimeout(()=>{box.classList.add('fading');toastHideTimer=setTimeout(()=>box.hidden=true,250);},duration-250);}
  function save(next){if(storageError){toast('记录读取失败，请重新打开应用；原始数据未被覆盖');return false;}try{const raw=JSON.stringify(next);if(window.AndroidStore){if(!AndroidStore.write(raw))throw Error('save');}else localStorage.setItem('study-time-v1',raw);state=next;return true;}catch(e){toast('保存失败，请检查设备存储空间后重试');return false;}}
  const shortDuration=ms=>{const seconds=Math.floor(ms/1000);if(seconds<60)return `${seconds} 秒`;const minutes=Math.floor(seconds/60);return minutes<60?`${minutes} 分钟`:`${Math.floor(minutes/60)} 小时 ${minutes%60} 分`;};
  const totalHTML=ms=>{if(ms>0&&ms<60000)return `<strong>${Math.floor(ms/1000)}</strong> 秒`;const m=Math.floor(ms/60000);return m>=60?`<strong>${Math.floor(m/60)}</strong> 小时 <strong>${m%60}</strong> 分钟`:`<strong>${m}</strong> 分钟`;};
  const clockTime=ms=>new Date(ms).toLocaleTimeString('zh-CN',{hour:'2-digit',minute:'2-digit',hour12:false});
  function renderTimer(){const now=Date.now(),a=state.active,s=Math.floor(C.duration(a,now)/1000);const progress=C.ringProgress(a,now),colors=['#d4e8b4','#c3dda0','#a7cc7a','#90b663','#779f53','#608746','#4f753e','#3f6839'];$('timer-progress').style.strokeDashoffset=String(792*(1-progress.fraction));$('timer-progress').style.stroke=colors[progress.hour-1];$('timer-track').style.stroke='#e1e5dd';$('timer-orbit').setAttribute('aria-valuenow',String(progress.seconds));$('timer-orbit').setAttribute('aria-valuetext',`累计 ${Math.floor(s/3600)} 小时 ${Math.floor(s/60)%60} 分 ${s%60} 秒，${a&&a.since===null?'已暂停':a?'正在专注':'准备开始'}`);$('timer-digits').textContent=[Math.floor(s/3600),Math.floor(s/60)%60,s%60].map(n=>String(n).padStart(2,'0')).join(':');$('start-button').disabled=!!a||storageError;$('pause-button').disabled=!a;$('finish-button').disabled=!a;$('pause-label').textContent=a&&a.since===null?'继续':'暂停';$('pause-button').firstElementChild.innerHTML=icon(a&&a.since===null?'play':'pause');$('timer-state').innerHTML=`<i></i>${!a?'准备开始':a.since===null?'已暂停':'正在专注'}`;document.querySelector('.timer-card').classList.toggle('running',!!a&&a.since!==null);}
  function renderHome(){const today=C.studyDateKey(Date.now()),d=C.localDate(selected);$('date-title').textContent=`${d.getMonth()+1}月${d.getDate()}日`;$('date-caption').textContent=`${d.getFullYear()}年 · ${d.toLocaleDateString('zh-CN',{weekday:'long'})}${selected===today?' · 今天':''}`;$('today-button').hidden=selected===today;$('home-decoration').hidden=selected!==today;const rows=C.rows(state,Date.now()).filter(r=>r.date===selected).sort((a,b)=>b.start-a.start);$('day-total').innerHTML=totalHTML(rows.reduce((n,r)=>n+r.ms,0));$('day-count').textContent=rows.length;$('record-count').textContent=rows.length;$('record-list').innerHTML=rows.length?rows.map((r,i)=>`<div class="record-swipe" ${r.active?'':`data-record-index="${state.records.findIndex(record=>record.id===r.id)}"`}>${r.active?'':`<div class="swipe-background" aria-hidden="true">${icon('trash')}</div>`}<article class="record" ${r.active?'':'tabindex="0" aria-label="专注记录，左右滑动或按 Delete 删除"'}><span class="record-icon">${icon(r.active?'leaf':'book')}</span><div><h3 class="record-title">${r.active?'本次专注':`第 ${rows.length-i} 次专注`}</h3><span class="record-time">${clockTime(r.start)} — ${r.active?(state.active.since===null?'已暂停':'进行中'):clockTime(r.end)}${C.dateKey(r.end)!==C.dateKey(r.start)?' · 跨日':''}</span></div><div class="record-duration">${shortDuration(r.ms)}<small>${r.active?'尚未结束':'已完成'}</small></div></article></div>`).join(''):`<div class="empty-state">${icon('book')}<h3>暂无学习记录</h3>${selected===today?'<p>点击「开始」计时</p>':''}</div>`;renderTimer();}
  function renderStats(){const data=C.buckets(state,period,Date.now()), bs=data.buckets;const max=Math.max(...bs.map(b=>b.ms)),unit=max>=7200000?3600000:60000;const ceiling=Math.max(1,Math.ceil(max/unit/4))*4;$('chart-unit').textContent=`单位：${unit===3600000?'小时':'分钟'}`;$('stats-total').innerHTML=totalHTML(data.total);$('stats-range').textContent=`${bs[0].key.replaceAll('-','.')} — ${C.studyDateKey(Date.now()).replaceAll('-','.')} · ${period==='year'?'近 12 个月':`近 ${data.days} 天`}`;$('chart-grid').innerHTML=[ceiling,ceiling/2,0].map(v=>`<div><span>${v}</span></div>`).join('');$('chart-bars').classList.toggle('dense',period==='month');$('chart-bars').innerHTML=bs.map((b,i)=>`<button class="bar" data-bucket="${i}" aria-label="${b.key}，${shortDuration(b.ms)}" aria-pressed="false"><span class="bar-fill" style="height:${b.ms/unit/ceiling*100}%"></span></button>`).join('');$('chart-labels').innerHTML=bs.map((b,i)=>`<span>${period==='month'&&![0,7,14,21,29].includes(i)?'':period==='year'?b.label.replace('月',''):b.label}</span>`).join('');$('chart-detail').textContent=data.total?'点击柱形，查看详细记录':'暂无学习记录';$('chart-bars').querySelectorAll('button').forEach(button=>button.onclick=()=>{document.querySelectorAll('.bar').forEach(b=>{b.classList.remove('selected');b.setAttribute('aria-pressed','false');});button.classList.add('selected');button.setAttribute('aria-pressed','true');const b=bs[Number(button.dataset.bucket)];$('chart-detail').textContent=`${b.key} · ${shortDuration(b.ms)}`;});const scope={week:'本周',month:'本月',year:'本年'}[period];$('average-label').textContent=`${scope}日均学习`;$('sessions-label').textContent=`${scope}专注次数`;$('stats-average').textContent=shortDuration(data.total/data.days);$('stats-sessions').textContent=`${data.sessions} 次`;$('stats-days').textContent=`${state.streakScope==='period'?Math.min(data.streak,data.days):data.streak} 天`;$('streak-label').textContent=state.streakScope==='period'?`${scope}连续学习天数`:'连续学习天数';$('streak-note').textContent='不中断学习至今的天数';const best=state.bestScope==='period'?data.periodBest:data.historyBest;$('best-label').textContent=state.bestScope==='period'?`${scope}单日最佳`:'历史单日最佳';$('stats-best').textContent=shortDuration(best.ms);$('best-date').textContent=best.ms?best.key:'暂无记录';renderHeatmap(data.heatmap);}
  let swipePress=null,swipeBusy=false;
  const recordList=$('record-list');
  function closeSwipes(){recordList.querySelectorAll('.record-swipe').forEach(row=>{row.classList.remove('swiping');row.querySelector('.record').style.transform='';});}
  function deleteRecord(row,direction=1){
    const record=state.records[Number(row.dataset.recordIndex)];if(!record||swipeBusy)return;
    const id=record.id,content=row.querySelector('.record');swipeBusy=true;
    row.style.height=`${row.getBoundingClientRect().height}px`;
    row.classList.toggle('swipe-right',direction>0);row.classList.add('dismissing');
    content.style.transform=`translateX(${direction*row.getBoundingClientRect().width}px)`;
    // Match inch_light's Dismissible: slide away first, then collapse the space before deleting.
    setTimeout(()=>{row.classList.add('collapsing');row.style.height='0px';},200);
    setTimeout(()=>{
      swipeBusy=false;
      if(save(C.removeRecord(state,id))){render();toast('本次专注记录已删除',1500);}
      else{row.classList.remove('dismissing','collapsing');row.style.height='';closeSwipes();}
    },500);
  }
  recordList.addEventListener('pointerdown',event=>{
    if(swipeBusy||!event.isPrimary||event.button!==0||event.target.closest('button'))return;
    const row=event.target.closest('[data-record-index]');if(!row)return;
    closeSwipes();swipePress={row,id:event.pointerId,x:event.clientX,y:event.clientY,dx:0,dragging:false,samples:[{x:event.clientX,y:event.clientY,time:event.timeStamp}]};
  });
  recordList.addEventListener('pointermove',event=>{
    const p=swipePress;if(!p||p.id!==event.pointerId)return;
    const dx=event.clientX-p.x,dy=event.clientY-p.y;
    if(!p.dragging){
      if(Math.abs(dy)>10&&Math.abs(dy)>=Math.abs(dx)){swipePress=null;return;}
      if(Math.abs(dx)<10||Math.abs(dx)<=Math.abs(dy))return;
      p.dragging=true;p.row.classList.add('swiping');p.row.setPointerCapture(event.pointerId);
    }
    event.preventDefault();const width=p.row.getBoundingClientRect().width;p.dx=Math.max(-width,Math.min(width,dx));
    p.row.classList.toggle('swipe-right',dx>0);
    p.samples.push({x:event.clientX,y:event.clientY,time:event.timeStamp});
    while(p.samples.length>2&&event.timeStamp-p.samples[0].time>100)p.samples.shift();
    p.row.querySelector('.record').style.transform=`translateX(${p.dx}px)`;
  });
  function endSwipe(event){
    const p=swipePress;if(!p||p.id!==event.pointerId)return;
    // Touch starts with implicit capture on the inner article. Moving capture to the row
    // emits a bubbling lostpointercapture from that article; it must not end the swipe.
    if(event.type==='lostpointercapture'&&event.target!==p.row)return;
    swipePress=null;
    if(p.row.hasPointerCapture(event.pointerId))p.row.releasePointerCapture(event.pointerId);
    p.row.classList.remove('swiping');
    const first=p.samples[0],last=p.samples[p.samples.length-1],elapsed=event.timeStamp-first.time;
    const vx=elapsed>0?(last.x-first.x)/elapsed*1000:0,vy=elapsed>0?(last.y-first.y)/elapsed*1000:0;
    const fling=Math.abs(vx)>=700&&Math.abs(vx)-Math.abs(vy)>=400;
    const dismiss=fling?Math.sign(vx)===Math.sign(p.dx):Math.abs(p.dx)>p.row.getBoundingClientRect().width*.4;
    if(event.type==='pointerup'&&dismiss)deleteRecord(p.row,Math.sign(p.dx));
    else p.row.querySelector('.record').style.transform='';
  }
  for(const type of ['pointerup','pointercancel','lostpointercapture'])recordList.addEventListener(type,endSwipe);
  recordList.addEventListener('keydown',event=>{if(event.key==='Delete'){const row=event.target.closest('[data-record-index]');if(row){event.preventDefault();deleteRecord(row);}}else if(event.key==='Escape'){swipePress=null;closeSwipes();}});
  window.addEventListener('blur',()=>{swipePress=null;if(!swipeBusy)closeSwipes();});
  let heatmapSignature='',heatmapSelected='';
  function renderHeatmap(days){
    const signature=days.map(d=>`${d.key}:${d.ms}`).join('|');
    if(signature===heatmapSignature)return;
    const firstRender=!heatmapSignature;heatmapSignature=signature;
    const offset=(C.localDate(days[0].key).getDay()+6)%7,columns=Math.ceil((offset+days.length)/7);
    $('heatmap-months').style.width=`${columns*14-3}px`;
    $('heatmap-months').innerHTML=days.map((d,i)=>d.key.endsWith('-01')?`<span style="left:${Math.floor((offset+i)/7)*14}px">${Number(d.key.slice(5,7))}月</span>`:'').join('');
    $('heatmap-cells').innerHTML='<span class="heatmap-empty"></span>'.repeat(offset)+days.map(d=>`<button data-date="${d.key}" data-level="${d.level}" aria-label="${d.key}，${shortDuration(d.ms)}" aria-pressed="${d.key===heatmapSelected}" title="${d.key} · ${shortDuration(d.ms)}"></button>`).join('');
    function showDay(d){$('heatmap-detail').textContent=`${d.key} · ${shortDuration(d.ms)}`;}
    $('heatmap-cells').querySelectorAll('button').forEach(button=>button.onclick=()=>{
      heatmapSelected=button.dataset.date;
      $('heatmap-cells').querySelectorAll('button').forEach(b=>b.setAttribute('aria-pressed',String(b===button)));
      showDay(days.find(d=>d.key===heatmapSelected));
    });
    const selectedDay=days.find(d=>d.key===heatmapSelected);if(selectedDay)showDay(selectedDay);
    if(firstRender)$('heatmap-scroll').scrollLeft=$('heatmap-scroll').scrollWidth;
  }
  function render(){renderHome();if(view==='stats')renderStats();}
  $('start-button').onclick=()=>{if(save(C.start(state,Date.now()))){selected=C.studyDateKey(Date.now());render();toast('专注已开始，锁屏后仍会继续计时',1500);}};
  $('pause-button').onclick=()=>{if(save(C.toggle(state,Date.now())))render();};
  $('finish-button').onclick=()=>{if(save(C.finish(state,Date.now()))){render();toast('本次学习已保存',1500);}};
  function navigate(next){view=next;$('home-view').hidden=next!=='home';$('stats-view').hidden=next!=='stats';$('settings-view').hidden=next!=='settings';for(const item of ['home','stats','settings']){const b=$(`nav-${item}`);b.classList.toggle('active',next===item);if(next===item)b.setAttribute('aria-current','page');else b.removeAttribute('aria-current');}if(next==='stats')renderStats();else renderHome();window.scrollTo(0,0);}
  $('nav-home').onclick=()=>navigate('home');$('nav-stats').onclick=()=>navigate('stats');$('nav-settings').onclick=()=>navigate('settings');
  document.querySelectorAll('[data-period]').forEach(b=>b.onclick=()=>{period=b.dataset.period;document.querySelectorAll('[data-period]').forEach(x=>x.setAttribute('aria-selected',String(x===b)));renderStats();});
  const scopeDialog=$('scope-dialog');let scopeField='bestScope';
  function openScopeOptions(field){
    scopeField=field;
    const streak=field==='streakScope',inPeriod=state[field]==='period';
    $('scope-title').textContent=streak?'连续学习天数范围':'最佳数据范围';
    $('scope-option').textContent=streak?(inPeriod?'改为呈现全部历史中不间断学习至今的天数':'改为呈现本次统计周期内不间断学习至今的天数'):(inPeriod?'改为呈现历史最佳数据':'改为呈现本次统计周期的最佳数据');
    if(!scopeDialog.open)scopeDialog.showModal();
  }
  function bindScopePress(card,field){
    let press=null;
    function cancel(){if(press)clearTimeout(press.timer);press=null;}
    card.addEventListener('pointerdown',event=>{
      cancel();if(!event.isPrimary||event.button!==0)return;
      press={x:event.clientX,y:event.clientY,timer:setTimeout(()=>{cancel();openScopeOptions(field);},550)};
    });
    card.addEventListener('pointermove',event=>{if(press&&Math.hypot(event.clientX-press.x,event.clientY-press.y)>10)cancel();});
    for(const type of ['pointerup','pointercancel','pointerleave'])card.addEventListener(type,cancel);
    window.addEventListener('blur',cancel);
    window.addEventListener('scroll',cancel,true);
    card.addEventListener('contextmenu',event=>{event.preventDefault();cancel();openScopeOptions(field);});
    card.addEventListener('keydown',event=>{if(['Enter',' ','ContextMenu'].includes(event.key)){event.preventDefault();openScopeOptions(field);}});
  }
  bindScopePress($('best-card'),'bestScope');
  bindScopePress($('streak-card'),'streakScope');
  $('close-scope').onclick=$('cancel-scope').onclick=()=>scopeDialog.close();
  $('confirm-scope').onclick=()=>{
    if(save({...state,[scopeField]:state[scopeField]==='period'?'history':'period'})){scopeDialog.close();renderStats();}
  };
  function pickDate(key){selected=key;renderHome();$('calendar-dialog').close();}
  $('today-button').onclick=()=>pickDate(C.studyDateKey(Date.now()));
  function renderCalendar(){const y=calendarMonth.getFullYear(),m=calendarMonth.getMonth(),offset=(new Date(y,m,1).getDay()+6)%7,count=new Date(y,m+1,0).getDate(),today=C.studyDateKey(Date.now()),recorded=new Set(C.rows(state,Date.now()).map(r=>r.date));$('calendar-month').textContent=`${y}年 ${m+1}月`;const currentMonth=C.localDate(today);$('next-month').disabled=y===currentMonth.getFullYear()&&m===currentMonth.getMonth();$('calendar-days').innerHTML='<span></span>'.repeat(offset)+Array.from({length:count},(_,i)=>{const key=C.dateKey(new Date(y,m,i+1));return `<button data-date="${key}" class="${key===selected?'selected ':''}${key===today?'today ':''}${recorded.has(key)?'has-record':''}" ${key>today?'disabled':''} aria-label="${key}${recorded.has(key)?'，有学习记录':''}" aria-pressed="${key===selected}">${i+1}</button>`;}).join('');$('calendar-days').querySelectorAll('button').forEach(b=>b.onclick=()=>pickDate(b.dataset.date));}
  $('date-button').onclick=()=>{calendarMonth=C.localDate(selected);calendarMonth.setDate(1);renderCalendar();$('calendar-dialog').showModal();};$('close-calendar').onclick=()=>$('calendar-dialog').close();$('calendar-today').onclick=()=>pickDate(C.studyDateKey(Date.now()));$('previous-month').onclick=()=>{calendarMonth.setMonth(calendarMonth.getMonth()-1);renderCalendar();};$('next-month').onclick=()=>{calendarMonth.setMonth(calendarMonth.getMonth()+1);renderCalendar();};$('calendar-dialog').addEventListener('click',e=>{if(e.target===$('calendar-dialog')){const r=e.target.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)e.target.close();}});
  let pendingImport=null;
  function resetImport(){pendingImport=null;$('import-preview').hidden=true;}
  function receiveImport(text){
    try{
      if(!text || !text.trim())throw Error('剪切板中没有文本，请先复制备份数据');
      if(new Blob([text]).size>10*1024*1024)throw Error('备份不能超过 10 MB');
      pendingImport=C.parseBackup(text);
      const result=C.mergeRecords(state,pendingImport);
      $('import-summary').textContent=`共 ${pendingImport.length} 条记录，将新增 ${result.added} 条，跳过 ${result.duplicates} 条重复记录。`;
      $('import-conflicts').textContent=result.conflicts?`${result.conflicts} 条记录的编号与本机记录冲突，将保留本机记录。`:'';
      $('confirm-import').disabled=result.added===0||storageError;
      $('import-preview').hidden=false;
      navigate('settings');
    }catch(e){resetImport();toast(e.message);}
  }
  window.receiveStudyImport=receiveImport;
  window.studyFileResult=(success,message)=>toast(message);
  $('cancel-import').onclick=resetImport;
  $('confirm-import').onclick=()=>{
    if(!pendingImport)return;
    const result=C.mergeRecords(state,pendingImport);
    if(save(result.state)){resetImport();render();toast(`已导入 ${result.added} 条记录`);}
  };
  $('export-button').onclick=async ()=>{
    if(storageError){toast('无法读取现有数据，暂不能导出');return;}
    const text=C.exportBackup(state,Date.now());
    if(new Blob([text]).size>10*1024*1024){toast('备份超过 10 MB，暂无法导出');return;}
    try {
      if(window.AndroidStore){AndroidStore.exportData(text);return;}
      if(!navigator.clipboard || !navigator.clipboard.writeText)throw Error('Clipboard unavailable');
      await navigator.clipboard.writeText(text);
      toast('数据已复制到剪切板');
    }catch(e){toast('复制失败，请检查剪切板权限后重试');}
  };
  $('import-button').onclick=async ()=>{
    resetImport();
    try{
      if(window.AndroidStore){AndroidStore.importData();return;}
      if(!navigator.clipboard || !navigator.clipboard.readText)throw Error('Clipboard unavailable');
      receiveImport(await navigator.clipboard.readText());
    }catch(e){toast('读取失败，请检查剪切板权限后重试');}
  };
  window.addEventListener('storage',()=>{state=read();render();});document.addEventListener('visibilitychange',()=>{if(!document.hidden)render();});
  setInterval(()=>{const today=C.studyDateKey(Date.now());if(today!==lastToday){if(selected===lastToday)selected=today;lastToday=today;render();}else if(state.active){if(view==='home'){if(swipePress||swipeBusy)renderTimer();else renderHome();}else if(view==='stats')renderStats();}},1000);
  render();if(storageError)toast('无法读取记录，请重新打开应用；原始数据未被覆盖');
})();
