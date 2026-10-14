export function openSessionImmediately<T>(user:T,publish:(user:T)=>void,prepare:(user:T)=>Promise<T>,onError:(error:unknown)=>void){
 publish(user);
 return Promise.resolve().then(()=>prepare(user)).then(publish).catch(onError);
}
