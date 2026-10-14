import {withDeadline} from '../utils/withDeadline';
import {signInWithCustomToken,type User} from 'firebase/auth';
import {auth} from '../firebase/firebase';
import {API_BASE_URL} from '../apiClient';
let enabled=false;
const pending=new Map<string,Promise<User>>();
export const hasSecureSession=()=>enabled;
export function restoreSecureSessionMode(uid:string){try{enabled=/^[a-f0-9]{48}$/.test(localStorage.getItem(`device-session:${uid}`)||'');}catch{enabled=false;}}
export async function sessionRequest(path:string,body?:unknown){const token=path==='/config'?undefined:await withDeadline(auth.currentUser?.getIdToken()||Promise.resolve(undefined),12000,'Oturum bilgisi alınamadı. Bağlantını kontrol edip tekrar dene.');const response=await fetch(`${API_BASE_URL.replace(/\/$/,'')}/api/sessions${path}`,{method:body===undefined?'GET':'POST',headers:{...(token?{Authorization:`Bearer ${token}`}:{ }),...(body===undefined?{}:{'Content-Type':'application/json'})},body:body===undefined?undefined:JSON.stringify(body),signal:AbortSignal.timeout(20000)});if(path==='/config'&&response.status===404)return {enabled:false,ready:false};const data=await response.json();if(!response.ok)throw new Error(data.message||'Oturum işlemi tamamlanamadı.');return data;}
export async function bootstrapSecureSession(user:User):Promise<User>{
 if(!navigator.onLine){try{enabled=/^[a-f0-9]{48}$/.test(localStorage.getItem(`device-session:${user.uid}`)||'');}catch{enabled=false;}return user;}
 const running=pending.get(user.uid);if(running)return running;
 const task=(async()=>{
  // Check the public feature flag before asking Firebase to refresh a token.
  // Legacy mode needs no custom claim and must not wait for token refresh.
  let config;
  try{config=await sessionRequest('/config');}
  catch{
   // Backend availability must not gate the existing Firebase session.
   // Firestore rules and backend token validation still enforce device revocation.
   try{enabled=/^[a-f0-9]{48}$/.test(localStorage.getItem(`device-session:${user.uid}`)||'');}catch{enabled=false;}
   return user;
  }
  enabled=config.enabled;
  if(!enabled)return user;
  if(!config.ready)throw new Error('Güvenli oturum sunucusu hazır değil.');
  const claims=await withDeadline(user.getIdTokenResult(),12000,'Oturum doğrulaması zaman aşımına uğradı. Tekrar dene.');
  if(typeof claims.claims.sessionId==='string'){
   try{localStorage.setItem(`device-session:${user.uid}`,claims.claims.sessionId);}catch{}
   return user;
  }
  const {deviceInfo,currentSessionId}=await import('./deviceSessions');
  const result=await sessionRequest('/register',{...deviceInfo(navigator.userAgent,navigator.maxTouchPoints),deviceKey:currentSessionId(user.uid)});
  if(auth.currentUser?.uid!==user.uid)throw new Error('Oturum değişti. Tekrar giriş yap.');
  try{localStorage.setItem(`device-session:${user.uid}`,result.id);}catch{}
  return (await signInWithCustomToken(auth,result.token)).user;
 })();
 pending.set(user.uid,task);
 try{return await task}finally{pending.delete(user.uid)}
}
