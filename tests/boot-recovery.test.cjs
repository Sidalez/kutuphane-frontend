const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
function setup({boot=true,online=true,last=0,waiting=false,blocked=false}={}){
 const callbacks={},children=[],storage=new Map([['app-boot-recovery',String(last)]]);let reloads=0,messages=0,updates=0;
 const worker={getRegistration:async()=>({update:async()=>{updates++},waiting:waiting?{postMessage:()=>{messages++;callbacks.controllerchange?.()}}:null}),addEventListener:(name,fn)=>callbacks[name]=fn,removeEventListener:()=>{}};
 const window={location:{reload:()=>reloads++},addEventListener:(name,fn)=>callbacks[name]=fn};
 const context={window,navigator:{onLine:online,serviceWorker:worker},document:{querySelector:()=>boot?{appendChild:child=>children.push(child)}:null,getElementById:()=>null,createElement:()=>({style:{}})},sessionStorage:{getItem:key=>{if(blocked)throw Error();return storage.get(key)},setItem:(key,value)=>storage.set(key,value)},setTimeout:()=>{},Date,Promise};
 vm.runInNewContext(fs.readFileSync('public/boot-recovery.js','utf8'),context);
 return {window,callbacks,children,counts:()=>({reloads,messages,updates})};
}
test('A broken boot activates the waiting worker and reloads once',async()=>{const s=setup({waiting:true});await s.window.recoverAppVersion(false);assert.deepEqual(s.counts(),{reloads:1,messages:1,updates:1});await s.window.recoverAppVersion(false);assert.equal(s.counts().reloads,1)});
test('Mounted pages never reload automatically, preserving unsaved edits',async()=>{const s=setup({boot:false});await s.window.recoverAppVersion(false);assert.equal(s.counts().reloads,0);await s.window.recoverAppVersion(true);assert.equal(s.counts().reloads,1)});
test('Offline, repeated failure and unavailable storage offer retry without reload loops',async()=>{for(const options of [{online:false},{last:Date.now()},{blocked:true}]){const s=setup(options);await s.window.recoverAppVersion(false);assert.equal(s.counts().reloads,0);assert.equal(s.children.length,2)}});
