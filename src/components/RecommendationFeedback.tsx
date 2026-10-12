import type { FeedbackEntry, FeedbackItem } from "../hooks/useRecommendationFeedback";
export function FeedbackHistory({entries,busy,onRestore}:{entries:FeedbackEntry[];busy:boolean;onRestore:(item:FeedbackItem)=>void}) {
  if(!entries.length)return null;
  const labels={liked:"Benzerlerini istiyorum",dismissed:"İlgimi çekmedi",consumed:"Okudum / izledim"};
  return <details className="mt-4 rounded-xl border border-slate-200 p-3 dark:border-slate-700"><summary className="min-h-11 cursor-pointer text-xs font-semibold">Öneri tercihlerim ({entries.length})</summary><ul className="max-h-72 space-y-2 overflow-y-auto">{[...entries].reverse().map(entry=><li key={entry.key} className="flex items-center justify-between gap-3 border-t border-slate-100 py-2 text-xs dark:border-slate-800"><span className="min-w-0 break-words">{entry.title}<span className="mt-1 block text-slate-500">{labels[entry.action]}</span></span><button type="button" disabled={busy} onClick={()=>onRestore(entry)} className="min-h-11 shrink-0 px-3 font-semibold text-orange-600">Tercihi kaldır</button></li>)}</ul></details>;
}
export default function RecommendationFeedback({item,busy,onFeedback}:{item:FeedbackItem;busy:boolean;onFeedback:(item:FeedbackItem,action:FeedbackEntry["action"])=>void}) {
  const button="min-h-11 rounded-xl border border-slate-200 px-3 py-2 text-xs font-medium text-slate-600 hover:border-orange-300 hover:text-orange-600 disabled:opacity-50 dark:border-slate-700 dark:text-slate-300";
  return <fieldset disabled={busy} className="mt-4 border-t border-slate-100 pt-3 dark:border-slate-800"><legend className="sr-only">{item.title} için öneri tercihi</legend><div className="flex flex-wrap gap-2">
    <button type="button" className={button} onClick={()=>onFeedback(item,"dismissed")}>İlgimi çekmedi</button>
    <button type="button" className={button} onClick={()=>onFeedback(item,"consumed")}>{item.kind==="BOOK"?"Zaten okudum":"Zaten izledim"}</button>
    <button type="button" className={button} onClick={()=>onFeedback(item,"liked")}>Buna benzer öner</button>
  </div></fieldset>;
}
