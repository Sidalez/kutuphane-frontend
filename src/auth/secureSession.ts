import {signInWithCustomToken,type User} from 'firebase/auth';
import {auth} from '../firebase/firebase';
import {API_BASE_URL} from '../apiClient';
let enabled=false;
const pending=new Map<string,Promise<User>>();
export const hasSecureSession=()=>enabled;
export async function sessionRequest(path:string,body?:unknown){const token=await auth.currentUser?.getIdToken();const response=await fetch(`${API_BASE_URL.replace(/\/$/,'')}/api/sessions${path}`,{method:body===undefined?'GET':'POST',headers:{...(token?{Authorization:`Bearer ${token}`}:{ }),...(body===undefined?{}:{'Content-Type':'application/json'})},body:body===undefined?undefined:JSON.stringify(body),signal:AbortSignal.timeout(20000)});if(path==='/config'&&response.status===404)return {enabled:false,ready:false};const data=await response.json();if(!response.ok)throw new Error(data.message||'Oturum işlemi tamamlanamadı.');return data;}
export async function bootstrapSecureSession(user:User):Promise<User>{
 if(!navigator.onLine){enabled=/^[a-f0-9]{48}$/.test(localStorage.getItem(`device-session:${user.uid}`)||'');return user;}
 const claims=await user.getIdTokenResult();
 if(typeof claims.claims.sessionId==='string'){enabled=true;localStorage.setItem(`device-session:${user.uid}`,claims.claims.sessionId);return user;}
 const running=pending.get(user.uid);if(running)return running;
 const task=(async()=>{const config=await sessionRequest('/config');enabled=config.enabled;if(!enabled)return user;if(!config.ready)throw new Error('Güvenli oturum sunucusu hazır değil.');
 const {deviceInfo,currentSessionId}=await import('./deviceSessions');const result=await sessionRequest('/register',{...deviceInfo(navigator.userAgent,navigator.maxTouchPoints),deviceKey:currentSessionId(user.uid)});if(auth.currentUser?.uid!==user.uid)throw new Error('Oturum değişti. Tekrar giriş yap.');localStorage.setItem(`device-session:${user.uid}`,result.id);return (await signInWithCustomToken(auth,result.token)).user;})();pending.set(user.uid,task);try{return await task}finally{pending.delete(user.uid)}
}
