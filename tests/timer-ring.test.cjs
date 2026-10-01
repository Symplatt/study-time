const {test}=require('node:test'),assert=require('node:assert/strict'),C=require('../web/core.js');
test('计时环每小时下一圈，八小时满圈封顶，总时长继续累计',()=>{
 const start=100000,s=C.start(C.initial(),start);
 assert.deepEqual(C.ringProgress(s.active,start),{seconds:0,hour:1,completed:0,fraction:0});
 for(let h=0;h<8;h++){
  assert.deepEqual(C.ringProgress(s.active,start+(h+.5)*3600000),{seconds:h*3600+1800,hour:h+1,completed:h,fraction:.5});
  if(h<7)assert.deepEqual(C.ringProgress(s.active,start+(h+1)*3600000),{seconds:(h+1)*3600,hour:h+2,completed:h+1,fraction:0});
 }
 for(const hours of [8,9,24]){assert.deepEqual(C.ringProgress(s.active,start+hours*3600000),{seconds:28800,hour:8,completed:8,fraction:1});assert.equal(C.duration(s.active,start+hours*3600000),hours*3600000);}
});
test('计时环暂停冻结，继续和重开恢复，结束归零',()=>{
 const start=100000,s=C.start(C.initial(),start),paused=C.toggle(s,start+1800000);
 assert.equal(C.ringProgress(paused.active,start+7200000).fraction,.5);
 const resumed=C.toggle(paused,start+7200000),restored=JSON.parse(JSON.stringify(resumed));assert.equal(C.ringProgress(restored.active,start+8100000).fraction,.75);
 assert.equal(C.ringProgress(C.finish(restored,start+8100000).active,start+9000000).fraction,0);
 assert.equal(C.ringProgress(s.active,start-1000).fraction,0);
});
