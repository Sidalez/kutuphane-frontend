import { LibraryBig, Loader2 } from "lucide-react";

export default function PageLoading({ fullScreen = false, label = "Sayfa yükleniyor…" }: { fullScreen?: boolean; label?: string }) {
  return <div role="status" aria-live="polite" className={fullScreen ? "flex min-h-[100dvh] flex-col items-center justify-center gap-5 bg-[#fffaf3] px-6 dark:bg-slate-950" : "mx-auto w-full max-w-5xl space-y-6 py-8"}>
    {fullScreen ? <><span className="flex h-20 w-20 items-center justify-center rounded-3xl bg-orange-600 text-white shadow-lg shadow-orange-600/15"><LibraryBig className="h-10 w-10" /></span><h1 className="text-2xl font-semibold tracking-tight">Kütüphanem</h1></> : <div aria-hidden="true" className="space-y-3"><div className="h-7 w-48 animate-pulse rounded-lg bg-slate-200 dark:bg-slate-800" /><div className="h-4 w-64 max-w-full animate-pulse rounded bg-slate-100 dark:bg-slate-800" /></div>}
    <p className="flex items-center justify-center gap-2 text-sm text-slate-500 dark:text-slate-400"><Loader2 className="h-5 w-5 animate-spin" />{label}</p>
    {!fullScreen && <div aria-hidden="true" className="grid grid-cols-2 gap-4 sm:grid-cols-3">{[0,1,2,3,4,5].map(index=><div key={index} className="h-48 animate-pulse rounded-2xl border border-slate-100 bg-slate-100/80 dark:border-slate-800 dark:bg-slate-900" />)}</div>}
  </div>;
}
