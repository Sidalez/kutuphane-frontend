const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),ts=require('typescript');
function load(file,extra={}){const exports={};vm.runInNewContext(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{exports,setTimeout,clearTimeout,Promise,Map,AbortSignal,...extra});return exports;}
const deadline=load('src/utils/withDeadline.ts');
test('Hung authentication promises reject within the deadline',async()=>{await assert.rejects(deadline.withDeadline(new Promise(()=>{}),10,'timeout'),/timeout/)});
test('Successful and failed authentication results retain their original outcome',async()=>{assert.equal(await deadline.withDeadline(Promise.resolve('token'),100,'timeout'),'token');await assert.rejects(deadline.withDeadline(Promise.reject(Error('invalid token')),100,'timeout'),/invalid token/)});
test('Public session configuration does not wait for a Firebase token',async()=>{let tokens=0;const session=load('src/auth/secureSession.ts',{require:id=>id.includes('withDeadline')?deadline:id==='firebase/auth'?{}:id.includes('firebase/firebase')?{auth:{currentUser:{getIdToken(){tokens++;return new Promise(()=>{})}}}}:id.includes('apiClient')?{API_BASE_URL:'http://test'}:{},fetch:async()=>({status:200,ok:true,json:async()=>({enabled:false,ready:true})})});const result=await session.sessionRequest('/config');assert.equal(result.enabled,false);assert.equal(tokens,0)});

test('Disabled secure sessions open without token refresh, even when Firebase token requests hang',async()=>{
 let tokens=0;const user={uid:'u',getIdTokenResult(){tokens++;return new Promise(()=>{})}};
 const session=load('src/auth/secureSession.ts',{navigator:{onLine:true},require:id=>id.includes('withDeadline')?deadline:id==='firebase/auth'?{}:id.includes('firebase/firebase')?{auth:{currentUser:user}}:id.includes('apiClient')?{API_BASE_URL:'http://test'}:{},fetch:async()=>({status:200,ok:true,json:async()=>({enabled:false,ready:true})})});
 assert.equal(await deadline.withDeadline(session.bootstrapSecureSession(user),100,'startup blocked'),user);assert.equal(tokens,0);
});

test('Backend network failure preserves the Firebase session and cached secure mode',async()=>{
 const user={uid:'u'};
 const session=load('src/auth/secureSession.ts',{navigator:{onLine:true},localStorage:{getItem:()=> 'a'.repeat(48)},require:id=>id.includes('withDeadline')?deadline:id==='firebase/auth'?{}:id.includes('firebase/firebase')?{auth:{currentUser:user}}:id.includes('apiClient')?{API_BASE_URL:'http://test'}:{},fetch:async()=>{throw new TypeError('Failed to fetch')}});
 assert.equal(await session.bootstrapSecureSession(user),user);assert.equal(session.hasSecureSession(),true);
});
