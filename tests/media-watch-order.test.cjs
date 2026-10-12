const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),ts=require('typescript');
const exportsObject={};vm.runInNewContext(ts.transpileModule(fs.readFileSync('src/utils/mediaWatchOrder.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText,{exports:exportsObject});
const {compareLastWatched,lastWatchTime}=exportsObject;
test('Newest watch outranks newly added and newly edited media',()=>{
 const last={title:'Son izlenen',status:'IZLENIYOR',lastWatchedAt:'2026-10-12'};
 const old={title:'Eski izlenen',status:'IZLENDI',watchedAt:'2026-10-01',updatedAt:'2026-10-13'};
 const added={title:'Yeni eklenen',status:'IZLENECEK',createdAt:'2026-10-13'};
 assert.deepEqual([added,old,last].sort(compareLastWatched).map(x=>x.title),['Son izlenen','Eski izlenen','Yeni eklenen']);
});
test('Latest episode date and viewing timestamps work; notes cannot move same-day entries',()=>{
 const a={status:'IZLENDI',watchedEpisodes:[{watchedAt:'2026-10-10'},{watchedAt:'2026-10-12'}],lastWatchActivityAt:{toMillis:()=>20},updatedAt:100};
 const b={status:'IZLENIYOR',lastWatchedAt:'2026-10-12',lastWatchActivityAt:10,updatedAt:999};
 assert.ok(compareLastWatched(a,b)<0);assert.equal(lastWatchTime(a),Date.parse('2026-10-12'));
 assert.equal(lastWatchTime({status:'IZLENECEK',lastWatchedAt:'2026-10-12'}),0);
});
