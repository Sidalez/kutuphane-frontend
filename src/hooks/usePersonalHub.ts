import {useEffect,useMemo,useRef,useState} from 'react';
import {collection,doc,onSnapshot,query,setDoc,where} from 'firebase/firestore';
import {db} from '../firebase/firebase';
import {useAuth} from '../auth/AuthContext';
import {readingEvent,watchEvent,type HubEntity} from '../utils/personalHub';
export type HubNote={id:string;entityKey:string;text:string;page:string;quote:boolean;createdAt:number;archived:boolean};
export type HubCollection={id:string;name:string;members:string[];createdAt:number;archived:boolean};
export type HubReport={id:string;title:string;message:string;path:string;createdAt:number;archived:boolean};
export function usePersonalHub(mode:string) {
 const {user}=useAuth();const uid=user?.uid;
 const [books,setBooks]=useState<any[]>([]),[media,setMedia]=useState<any[]>([]),[watchLogs,setWatchLogs]=useState<any[]>([]),[goals,setGoals]=useState<any[]>([]),[profile,setProfile]=useState<any>({});
 const [logs,setLogs]=useState<Record<string,any[]>>({}),[legacyNotes,setLegacyNotes]=useState<Record<string,any[]>>({});
 const [loaded,setLoaded]=useState<string[]>([]),[error,setError]=useState(''),[pending,setPending]=useState(false),[online,setOnline]=useState(navigator.onLine),[notice,setNotice]=useState('');
 const owner=useRef(uid);owner.current=uid;
 const wantsHistory=['today','calendar','data'].includes(mode),wantsNotes=['notes','data'].includes(mode);
 useEffect(()=>{const on=()=>setOnline(true),off=()=>setOnline(false);window.addEventListener('online',on);window.addEventListener('offline',off);return()=>{window.removeEventListener('online',on);window.removeEventListener('offline',off)}},[]);
 useEffect(()=>{
  setBooks([]);setMedia([]);setWatchLogs([]);setGoals([]);setProfile({});setLogs({});setLegacyNotes({});setLoaded([]);setError('');setNotice('');
  if(!uid)return;
  const fail=()=>setError('Bazı kayıtlar yüklenemedi. Bağlantını kontrol et; sayfayı yenileyerek tekrar deneyebilirsin.');
  const mark=(key:string)=>setLoaded(previous=>previous.includes(key)?previous:[...previous,key]);
  const unsubs=[onSnapshot(query(collection(db,'books'),where('userId','==',uid)),snap=>{setBooks(snap.docs.map(d=>({...d.data(),id:d.id})));mark('books')},fail),onSnapshot(query(collection(db,'mediaItems'),where('userId','==',uid)),snap=>{setMedia(snap.docs.map(d=>({...d.data(),id:d.id})));mark('media')},fail),onSnapshot(doc(db,'users',uid),{includeMetadataChanges:true},snap=>{setProfile(snap.data()||{});setPending(snap.metadata.hasPendingWrites);mark('profile')},fail)];
  if(wantsHistory){unsubs.push(onSnapshot(query(collection(db,'watchLogs'),where('userId','==',uid)),snap=>{setWatchLogs(snap.docs.map(d=>({...d.data(),id:d.id})));mark('watchLogs')},fail));unsubs.push(onSnapshot(collection(db,'users',uid,'goals'),snap=>{setGoals(snap.docs.map(d=>({...d.data(),id:d.id})));mark('goals')},fail));}
  return()=>unsubs.forEach(unsubscribe=>unsubscribe());
 },[uid,wantsHistory]);
 useEffect(()=>{
  if(!uid||(!wantsHistory&&!wantsNotes))return;
  const unsubs: Array<()=>void>=[];setLogs({});setLegacyNotes({});
  for(const book of books){
   if(wantsHistory)unsubs.push(onSnapshot(collection(db,'books',book.id,'logs'),snap=>setLogs(previous=>({...previous,[book.id]:snap.docs.map(d=>({...d.data(),id:d.id}))})),()=>setError('Okuma geçmişinin bir kısmı yüklenemedi.')));
   if(wantsNotes)unsubs.push(onSnapshot(collection(db,'books',book.id,'notes'),snap=>setLegacyNotes(previous=>({...previous,[book.id]:snap.docs.map(d=>({...d.data(),id:d.id}))})),()=>setError('Eski kitap notlarının bir kısmı yüklenemedi.')));
  }
  return()=>unsubs.forEach(unsubscribe=>unsubscribe());
 },[uid,books,wantsHistory,wantsNotes]);
 const entities=useMemo<HubEntity[]>(()=>[...books.map(book=>({id:book.id,kind:'BOOK' as const,title:book.title,image:book.coverImageUrl,url:`/library/${book.id}`})),...media.map(item=>({id:item.id,kind:item.type as 'TV'|'MOVIE',title:item.title,image:item.posterUrl,url:`/media/${item.id}`}))],[books,media]);
 const events=useMemo(()=>[...books.flatMap(book=>(logs[book.id]||[]).map(log=>readingEvent({id:book.id,kind:'BOOK',title:book.title,url:`/library/${book.id}`},log))),...watchLogs.map(watchEvent)].filter(event=>/^\d{4}-\d{2}-\d{2}$/.test(event.date)).sort((a,b)=>b.date.localeCompare(a.date)),[books,logs,watchLogs]);
 function save(field:'hubNotes'|'hubCollections'|'hubReports',id:string,value:HubNote|HubCollection|HubReport){
  if(!uid)return;setError('');setNotice(online?'Kaydediliyor…':'Cihaza kaydediliyor; bağlantı gelince eşitlenecek.');
  const current=uid;
  void setDoc(doc(db,'users',uid),{[field]:{[id]:value}},{merge:true}).then(()=>{if(owner.current===current)setNotice('Hesabına kaydedildi.')}).catch(()=>{if(owner.current===current){setNotice('');setError('Kayıt eşitlenemedi. Bağlantını ve hesap erişimini kontrol et.')}});
 }
 const required=['books','media','profile',...(wantsHistory?['watchLogs','goals']:[])];
 const historyReady=!wantsHistory||books.every(book=>Object.prototype.hasOwnProperty.call(logs,book.id));
 const notesReady=!wantsNotes||books.every(book=>Object.prototype.hasOwnProperty.call(legacyNotes,book.id));
 return {uid,books,media,watchLogs,goals,profile,logs,legacyNotes,entities,events,pending,online,error,notice,save,loading:!required.every(key=>loaded.includes(key))||!historyReady||!notesReady,notes:Object.values(profile.hubNotes||{}) as HubNote[],collections:Object.values(profile.hubCollections||{}) as HubCollection[],reports:Object.values(profile.hubReports||{}) as HubReport[]};
}
