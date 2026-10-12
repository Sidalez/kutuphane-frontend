const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),ts=require('typescript');
function load(path){const output={};vm.runInNewContext(ts.transpileModule(fs.readFileSync(path,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{exports:output,Date,Math,Number,String,Set});return output;}
const timer=load('src/utils/readingTimer.ts');
test('Pause and resume exclude breaks, including after persisted state is restored',()=>{
 const initial={startAtMs:1000,segmentStartedAtMs:1000,accumulatedMs:0,status:'running'};
 const paused=timer.pauseReadingTimer(initial,61000);
 assert.equal(timer.elapsedReadingMs(paused,661000),60000);
 const restored=timer.restoreReadingTimer(JSON.parse(JSON.stringify(paused)));
 const resumed=timer.resumeReadingTimer(restored,661000);
 const done=timer.finishReadingTimer(resumed,781000);
 assert.equal(done.accumulatedMs,180000);assert.equal(done.startAtMs,1000);assert.equal(done.status,'finished');
 assert.equal(timer.elapsedReadingMs(timer.restoreReadingTimer(done),900000),180000);
 assert.equal(timer.resumeReadingTimer(done,900000).status,'finished');
});
test('Legacy active timers resume and completed zero-length timers do not count breaks',()=>{
 assert.equal(timer.elapsedReadingMs(timer.restoreReadingTimer({startAtMs:1000}),61000),60000);
 assert.equal(timer.restoreReadingTimer({startAtMs:1000,accumulatedMs:0,status:'finished',endAtMs:61000}).accumulatedMs,0);
 assert.equal(timer.restoreReadingTimer({startAtMs:'bad'}),null);
});
test('Istanbul dates stay on the new day after midnight; instants remain UTC',()=>{
 const previous=process.env.TZ;process.env.TZ='Europe/Istanbul';
 try{const hub=load('src/utils/personalHub.ts');const instant=new Date('2026-10-11T21:05:00Z');assert.equal(hub.localDate(instant),'2026-10-12');assert.equal(instant.toISOString(),'2026-10-11T21:05:00.000Z');assert.equal(hub.localDate(new Date('2026-10-11T20:59:00Z')),'2026-10-11');}finally{if(previous===undefined)delete process.env.TZ;else process.env.TZ=previous;}
});
