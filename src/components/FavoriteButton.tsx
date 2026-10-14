import {useState} from 'react';
import {Heart,Loader2} from 'lucide-react';
import {doc,updateDoc} from 'firebase/firestore';
import {db} from '../firebase/firebase';
import {useAuth} from '../auth/AuthContext';
import {withDeadline} from '../utils/withDeadline';
export default function FavoriteButton({id,kind,favorite=false,owner}:{id:string;kind:'BOOK'|'TV'|'MOVIE';favorite?:boolean;owner:string}){
 const {user}=useAuth();const [busy,setBusy]=useState(false),[error,setError]=useState('');
 async function toggle(){if(busy||user?.uid!==owner)return;setError('');if(!navigator.onLine){setError('Favorini kaydetmek için internete bağlan.');return;}setBusy(true);try{await withDeadline(updateDoc(doc(db,kind==='BOOK'?'books':'mediaItems',id),{favorite:!favorite}),15000,'Kaydetme onayı alınamadı.');}catch{setError('Kaydetme onayı alınamadı. Bağlantını kontrol et.');}finally{setBusy(false)}}
 return <span className="relative inline-flex shrink-0"><button type="button" aria-label={favorite?'Favorilerden çıkar':'Favorilere ekle'} aria-pressed={favorite} disabled={busy||user?.uid!==owner} onClick={event=>{event.stopPropagation();void toggle()}} className={`flex h-11 w-11 items-center justify-center rounded-2xl border shadow-sm transition active:scale-95 disabled:opacity-50 ${favorite?'border-rose-200 bg-rose-50 text-rose-600 dark:border-rose-900 dark:bg-rose-950':'border-slate-200 bg-white text-slate-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300'}`}>{busy?<Loader2 size={18} className="animate-spin"/>:<Heart size={18} fill={favorite?'currentColor':'none'}/>}</button>{error&&<span role="alert" className="absolute right-0 top-12 z-20 w-48 rounded-xl border border-rose-200 bg-white p-3 text-xs text-rose-700 shadow-lg dark:bg-slate-900 dark:text-rose-300">{error}<button type="button" onClick={()=>setError('')} className="mt-2 block min-h-11 font-semibold">Kapat</button></span>}</span>;
}
