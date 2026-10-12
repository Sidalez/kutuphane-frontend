import {doc, onSnapshot, runTransaction, updateDoc, FieldPath} from 'firebase/firestore';
import {signOut, type User} from 'firebase/auth';
import {auth, db} from '../firebase/firebase';
import {removeDeviceNotifications} from '../notifications/api';

export type DeviceSession = {id:string; device:string; browser:string; createdAt:number; lastActiveAt:number; revokedAt:number|null};
const key=(uid:string)=>`device-session:${uid}`;
export function deviceInfo(ua:string,touchPoints=0) {
 const device=/iPad/i.test(ua)||(/Macintosh/i.test(ua)&&touchPoints>1)?'iPad':/iPhone/i.test(ua)?'iPhone':/Android/i.test(ua)?'Android':/Windows/i.test(ua)?'Windows bilgisayar':/Macintosh/i.test(ua)?'Mac':/Linux/i.test(ua)?'Linux bilgisayar':'Diğer cihaz';
 const browser=/Edg\//.test(ua)?'Edge':/OPR\//.test(ua)?'Opera':/Firefox\/|FxiOS\//.test(ua)?'Firefox':/Chrome\/|CriOS\//.test(ua)?'Chrome':/Safari\//.test(ua)?'Safari':'Tarayıcı';
 return {device,browser};
}
export function currentSessionId(uid:string) {let id=localStorage.getItem(key(uid));if(!id){id=crypto.randomUUID();localStorage.setItem(key(uid),id)}return id;}
export function clearSessionId(uid:string){localStorage.removeItem(key(uid))}
export async function revokeSessions(uid:string,ids:string[]) {
 if(!navigator.onLine)throw new Error('Cihazlardan çıkış yapmak için internete bağlan.');
 if(!ids.length)return;
 const updates:unknown[]=[];for(const id of ids)updates.push(new FieldPath('deviceSessions',id,'revokedAt'),Date.now());
 await updateDoc(doc(db,'users',uid),updates[0] as FieldPath,updates[1],...updates.slice(2));
}
export function trackDeviceSession(user:User,onError:(message:string)=>void) {
 let id:string;try{id=currentSessionId(user.uid)}catch{onError('Bu tarayıcıda cihaz kaydı saklanamıyor. Oturum listesi kullanılamıyor.');return()=>{}}
 const ref=doc(db,'users',user.uid);let stopped=false,creating=false,registered=false;
 const active=()=>!stopped&&auth.currentUser?.uid===user.uid;
 const touch=()=>{if(active()&&registered&&navigator.onLine&&document.visibilityState==='visible')void updateDoc(ref,new FieldPath('deviceSessions',id,'lastActiveAt'),Date.now()).catch(()=>{})};
 const unsub=onSnapshot(ref,{includeMetadataChanges:true},snapshot=>{
  if(!active())return;
  const entry=snapshot.data()?.deviceSessions?.[id] as DeviceSession|undefined;
  if(entry?.revokedAt){stopped=true;clearSessionId(user.uid);void removeDeviceNotifications().catch(()=>undefined).finally(()=>{if(auth.currentUser?.uid===user.uid)void signOut(auth)});return;}
  if(entry){const first=!registered;registered=true;if(first)touch();return;}
  if(snapshot.metadata.fromCache||creating)return;
  creating=true;
  const now=Date.now();
  void runTransaction(db,async transaction=>{const latest=await transaction.get(ref);if(latest.data()?.deviceSessions?.[id])return;transaction.set(ref,{deviceSessions:{[id]:{id,...deviceInfo(navigator.userAgent,navigator.maxTouchPoints),createdAt:now,lastActiveAt:now,revokedAt:null}}},{merge:true});}).catch(()=>{creating=false;onError('Cihaz oturumu kaydedilemedi. Hesap erişimini kontrol et.');});
 },()=>onError('Cihaz oturumları doğrulanamadı. Bağlantını ve hesap erişimini kontrol et.'));
 const interval=setInterval(touch,60000);window.addEventListener('focus',touch);window.addEventListener('online',touch);document.addEventListener('visibilitychange',touch);touch();
 return()=>{stopped=true;unsub();clearInterval(interval);window.removeEventListener('focus',touch);window.removeEventListener('online',touch);document.removeEventListener('visibilitychange',touch)};
}
