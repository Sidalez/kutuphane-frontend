import {useEffect,useState} from 'react';
import {doc,onSnapshot} from 'firebase/firestore';
import {Monitor,Smartphone,ShieldCheck,LogOut,Loader2} from 'lucide-react';
import {db} from '../firebase/firebase';
import {useAuth} from '../auth/AuthContext';
import {currentSessionId,revokeSessions,type DeviceSession} from '../auth/deviceSessions';
import {useAppDialog} from './feedback/DialogProvider';

const date=(value:number)=>new Intl.DateTimeFormat('tr-TR',{dateStyle:'medium',timeStyle:'short'}).format(new Date(value));
export default function DeviceSessions(){
 const {user,logout}=useAuth();const dialog=useAppDialog();
 const [sessions,setSessions]=useState<DeviceSession[]>([]),[loading,setLoading]=useState(true),[busy,setBusy]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState('');
 const [current,setCurrent]=useState('');
 useEffect(()=>{setSessions([]);setLoading(true);setError('');if(!user)return;try{setCurrent(currentSessionId(user.uid))}catch{setError('Cihaz kaydı bu tarayıcıda kullanılamıyor.');setLoading(false);return;}
  return onSnapshot(doc(db,'users',user.uid),snapshot=>{setSessions((Object.values(snapshot.data()?.deviceSessions||{}) as DeviceSession[]).filter(item=>item&&typeof item.id==='string'&&Number.isFinite(item.createdAt)&&Number.isFinite(item.lastActiveAt)&&!item.revokedAt).sort((a,b)=>b.lastActiveAt-a.lastActiveAt));setLoading(false)},()=>{setLoading(false);setError('Oturumlar yüklenemedi. Bağlantını kontrol et.');});
 },[user?.uid]);
 async function close(ids:string[]){if(!user||busy)return;if(!await dialog.confirm({title:ids.includes(current)?'Bu cihazdan çıkış yapılsın mı?':'Seçili oturumlar kapatılsın mı?',message:'Çevrimiçi uygulama oturumları kapatılır. Çevrimdışı cihazlarda çıkış, bağlantı kurulduğunda uygulanır. Tekrar kullanmak için giriş yapılması gerekir.',confirmLabel:'Çıkış yap',cancelLabel:'Vazgeç',tone:'warning'}))return;
  setBusy(true);setError('');setNotice('');try{if(ids.includes(current))await logout();else{await revokeSessions(user.uid,ids);setNotice('Çıkış komutu kaydedildi. Cihazlar bağlantı kurduklarında uygulanacak.')}}catch(e){setError(e instanceof Error?e.message:'Oturum kapatılamadı. Tekrar dene.')}finally{setBusy(false)}
 }
 const others=sessions.filter(item=>item.id!==current);
 return <section id="device-sessions" className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:p-6"><div className="flex items-start gap-3"><ShieldCheck className="mt-1 h-6 w-6 shrink-0 text-orange-600"/><div><h2 className="text-lg font-semibold">Cihazlar ve oturumlar</h2><p className="mt-2 text-sm leading-6 text-slate-500">{loading?'Oturumların yükleniyor…':`${sessions.length} kayıtlı açık oturum`}. Aynı tarayıcıdaki sekmeler tek oturum sayılır.</p></div></div>
 <p className="mt-3 text-xs leading-6 text-slate-500">Bu özellik eklendikten sonra uygulamayı açan cihazlar listelenir. Son etkinlik yaklaşık dakikada bir güncellenir; açık oturum, cihazın şu anda çevrimiçi olduğu anlamına gelmez. Cihaz ve tarayıcı adları tarayıcının bildirdiği bilgilere dayanır.</p>
 {loading?<Loader2 aria-label="Oturumlar yükleniyor" className="my-6 h-5 w-5 animate-spin text-orange-600"/>:<ul className="mt-5 space-y-3">{sessions.map(item=>{const mine=item.id===current;const Icon=/iPhone|iPad|Android/.test(item.device)?Smartphone:Monitor;return <li key={item.id} className="flex flex-wrap items-start gap-3 rounded-2xl border border-slate-200 p-4 dark:border-slate-700"><Icon className="mt-1 h-5 w-5 shrink-0 text-slate-500"/><div className="min-w-0 flex-1"><p className="break-words text-sm font-semibold">{item.device} · {item.browser}</p>{mine&&<span className="mt-2 inline-block rounded-full bg-emerald-50 px-2 py-1 text-xs font-semibold text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">Bu cihaz</span>}<p className="mt-2 text-xs leading-6 text-slate-500">Giriş: {date(item.createdAt)}<br/>Son etkinlik: {date(item.lastActiveAt)}</p></div><button disabled={busy} onClick={()=>close([item.id])} className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-red-200 px-3 text-xs font-semibold text-red-600 disabled:opacity-50 dark:border-red-900"><LogOut className="h-4 w-4"/>Çıkış yap</button></li>})}</ul>}
 {!loading&&!sessions.length&&!error&&<p className="mt-4 text-sm text-slate-500">Bu cihazın kaydı bağlantı kurulduğunda görünecek.</p>}
 <button disabled={busy||!others.length} onClick={()=>close(others.map(item=>item.id))} className="mt-5 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 text-sm font-semibold text-white disabled:opacity-40 dark:bg-slate-100 dark:text-slate-900">{busy?<Loader2 className="h-4 w-4 animate-spin"/>:<LogOut className="h-4 w-4"/>}Diğer tüm cihazlardan çıkış yap</button>
 {error&&<p role="alert" className="mt-3 text-sm text-red-600">{error}</p>}{notice&&<p role="status" className="mt-3 text-sm text-emerald-700 dark:text-emerald-300">{notice}</p>}
 </section>;
}
