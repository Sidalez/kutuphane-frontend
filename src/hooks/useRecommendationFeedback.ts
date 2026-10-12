import { useEffect, useRef, useState } from "react";
import { doc, onSnapshot, runTransaction } from "firebase/firestore";
import { db } from "../firebase/firebase";
export type FeedbackItem = { key: string; kind: "BOOK" | "TV" | "MOVIE"; title: string; author?: string; tmdbId?: number; isbn?: string };
export type FeedbackEntry = FeedbackItem & { action: "dismissed" | "consumed" | "liked"; updatedAt: number };
export function useRecommendationFeedback(uid?: string) {
  const [entries,setEntries]=useState<FeedbackEntry[]>([]);
  const [ready,setReady]=useState(false);
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState("");
  const [last,setLast]=useState<FeedbackItem|null>(null);
  const active=useRef(uid); active.current=uid;
  useEffect(()=>{
    setEntries([]);setReady(false);setBusy(false);setError("");setLast(null);
    if(!uid)return;
    return onSnapshot(doc(db,"users",uid),snapshot=>{
      const value=snapshot.data()?.recommendationFeedback;
      setEntries(Array.isArray(value)?value:[]);setReady(true);
    },()=>{setError("Öneri tercihlerin yüklenemedi. Bağlantını kontrol et.");});
  },[uid]);
  async function save(item:FeedbackItem,action:FeedbackEntry["action"]|null) {
    if(!uid||busy||!ready)return false;
    const owner=uid;setBusy(true);setError("");
    try {
      await runTransaction(db,async transaction=>{
        const ref=doc(db,"users",owner);const snapshot=await transaction.get(ref);
        const value=snapshot.data()?.recommendationFeedback;
        const next=(Array.isArray(value)?value:[]).filter((entry:FeedbackEntry)=>entry.key!==item.key);
        if(action)next.push({...item,action,updatedAt:Date.now()});
        transaction.set(ref,{recommendationFeedback:next.slice(-200)},{merge:true});
      });
      if(active.current===owner)setLast(action?item:null);
      return active.current===owner;
    } catch {if(active.current===owner)setError("Tercihin kaydedilemedi. Tekrar deneyebilirsin.");return false;}
    finally {if(active.current===owner)setBusy(false);}
  }
  return {entries,ready,busy,error,last,save,isExcluded:(key:string)=>entries.some(entry=>entry.key===key&&entry.action!=="liked")};
}
