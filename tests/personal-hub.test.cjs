const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),ts=require('typescript');
const output={};vm.runInNewContext(ts.transpileModule(fs.readFileSync('src/utils/personalHub.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{exports:output,Date,Set,Number,String,Math});
const {localDate,monthDays,csv,readingEvent,watchEvent,eventStats}=output;
test('Legacy reading times are recovered, midnight is handled and missing durations stay unknown',()=>{
 assert.equal(output.readingMinutes({startTime:'20:00',endTime:'20:35'}),35);
 assert.equal(output.readingMinutes({durationMinutes:null,startTime:'23:50',endTime:'00:15'}),25);
 assert.equal(output.readingMinutes({durationMinutes:10,startTime:'20:00',endTime:'20:35'}),10);
 assert.equal(output.readingMinutes({startTime:'25:00',endTime:'26:00'}),null);
 assert.equal(output.readingMinutes({}),null);
 const book={id:'b',kind:'BOOK',title:'Kitap',url:'/library/b'};
 assert.equal(output.readingSummary([readingEvent(book,{id:'1',totalRead:57})]),'Süre girilmedi');
 assert.equal(output.readingSummary([readingEvent(book,{id:'1'}),readingEvent(book,{id:'2',startTime:'20:00',endTime:'20:35'})]),'35 dk (eksik süreler var)');
 assert.equal(output.formatHubMinutes(2885),'48 sa 5 dk');
});
test('Calendar begins on Monday, includes leap day and keeps local dates',()=>{
 const days=monthDays('2024-02');assert.equal(days.length,42);assert.equal(days[0],'2024-01-29');assert.ok(days.includes('2024-02-29'));assert.equal(days[41],'2024-03-10');
 assert.equal(localDate(new Date(2026,9,12,0,5)),'2026-10-12');
});
test('Reading and watching totals stay separate and do not invent missing duration',()=>{
 const book={id:'b',kind:'BOOK',title:'Kitap',url:'/library/b'};
 const reading=readingEvent(book,{id:'1',date:'2026-10-12',startPage:10,endPage:30,durationMinutes:15});
 const oldReading=readingEvent(book,{id:'2',date:'2026-10-12',totalRead:5});
 const watch=watchEvent({id:'w',date:'2026-10-12',mediaId:'m',mediaType:'TV',title:'Dizi',minutes:40});
 const stats=eventStats([reading,oldReading,watch]);assert.equal(stats.pages,25);assert.equal(stats.readingMinutes,15);assert.equal(stats.watchingMinutes,40);assert.equal(stats.sessions,3);
 assert.equal(watch.url,'/media/m');assert.equal(readingEvent(book,{id:'x',startPage:30,endPage:10}).pages,0);
});
test('CSV preserves Turkish, commas, multiline notes and prevents formula execution',()=>{
 const value=csv([{title:'Ayı, "Alıntı"',note:'Satır 1\nSatır 2',unsafe:'=IMPORTXML("url")',other:'  +SUM(1,2)'}]);
 assert.ok(value.startsWith('\uFEFF'));assert.ok(value.includes('"Ayı, ""Alıntı"""'));assert.ok(value.includes('"Satır 1\nSatır 2"'));assert.ok(value.includes("\"'=IMPORTXML"));assert.ok(value.includes("\"'  +SUM"));
});
