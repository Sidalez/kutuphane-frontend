export async function activateAppUpdate(reg:ServiceWorkerRegistration|undefined,workers:ServiceWorkerContainer|undefined,timeoutMs=30000){
 if(!reg)return;
 const deadline=Date.now()+timeoutMs;
 const bound=async<T>(task:Promise<T>):Promise<T>=>{let timer:ReturnType<typeof setTimeout>|undefined;try{return await Promise.race([task,new Promise<never>((_,reject)=>{timer=setTimeout(()=>reject(new Error('Güncelleme zaman aşımına uğradı. Tekrar dene.')),Math.max(1,deadline-Date.now()))})]);}finally{clearTimeout(timer)}};
 await bound(reg.update());
 const installing=reg.installing;
 if(installing)await bound(new Promise<void>((resolve,reject)=>{const changed=()=>{if(installing.state==='installed'||installing.state==='activated'){installing.removeEventListener('statechange',changed);resolve()}else if(installing.state==='redundant'){installing.removeEventListener('statechange',changed);reject(new Error('Yeni sürüm indirilemedi.'))}};installing.addEventListener('statechange',changed);changed();}));
 const waiting=reg.waiting;
 if(!waiting)return;
 if(!workers)throw new Error('Güncelleme denetleyicisi hazır değil.');
 let changed:()=>void=()=>{};
 try{await bound(new Promise<void>(resolve=>{changed=()=>resolve();workers.addEventListener('controllerchange',changed);waiting.postMessage({type:'SKIP_WAITING'});}));}
 finally{workers.removeEventListener('controllerchange',changed);}
}
