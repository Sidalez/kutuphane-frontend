import { useEffect, useState } from "react";
import { BookOpen, Clapperboard, LibraryBig, Loader2 } from "lucide-react";

type LoadingVariant = "list" | "detail" | "form" | "media";
function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`app-skeleton rounded-lg ${className}`} />;
}
function DetailSkeleton({ form = false }: { form?: boolean }) {
  return <div aria-hidden="true" className="space-y-4">
    <div className="rounded-3xl border border-slate-200/70 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900/60 sm:p-7">
      <div className="flex items-start gap-5 sm:gap-7">
        <div className="relative w-24 shrink-0 sm:w-36"><Skeleton className="aspect-[2/3] rounded-xl shadow-sm" /><div className="absolute inset-y-0 left-1 w-px bg-white/40 dark:bg-white/5" /></div>
        <div className="min-w-0 flex-1 space-y-3 pt-1"><Skeleton className="h-4 w-16 rounded-full" /><Skeleton className="h-6 w-full max-w-80" /><Skeleton className="h-6 w-3/5 max-w-56" /><Skeleton className="!mt-5 h-3 w-4/5 max-w-48" /><Skeleton className="h-3 w-3/5 max-w-36" /><Skeleton className="!mt-5 h-7 w-24 rounded-full" /></div>
      </div>
      <div className="mt-6 grid grid-cols-3 gap-3 border-t border-slate-100 pt-5 dark:border-slate-800">{[0,1,2].map(i => <div key={i} className="space-y-2 rounded-2xl bg-slate-50 p-3 dark:bg-slate-950/60"><Skeleton className="h-2.5 w-3/4" /><Skeleton className="h-5 w-1/2" /></div>)}</div>
      <Skeleton className="mt-5 h-2 w-full rounded-full" />
    </div>
    <div className="rounded-3xl border border-slate-200/70 bg-white p-5 dark:border-slate-800 dark:bg-slate-900/60"><div className="mb-6 flex gap-3"><Skeleton className="h-9 w-28 rounded-xl" /><Skeleton className="h-9 w-20 rounded-xl" /></div>{form ? <div className="grid gap-4 sm:grid-cols-2">{[0,1,2,3].map(i => <div key={i} className="space-y-2"><Skeleton className="h-3 w-20" /><Skeleton className="h-11 w-full rounded-xl" /></div>)}</div> : <div className="space-y-3"><Skeleton className="h-3 w-full" /><Skeleton className="h-3 w-[92%]" /><Skeleton className="h-3 w-4/5" /><Skeleton className="!mt-6 h-16 w-full rounded-2xl" /></div>}</div>
  </div>;
}
function ListSkeleton() {
  return <div aria-hidden="true" className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">{[0,1,2,3].map(index => <div key={index} className="overflow-hidden rounded-3xl border border-slate-200/70 bg-white p-3 shadow-sm dark:border-slate-800 dark:bg-slate-900/60 sm:p-4"><div className="flex justify-center rounded-2xl bg-slate-50 px-4 py-5 dark:bg-slate-950/50"><Skeleton className="aspect-[2/3] w-full max-w-28 rounded-lg shadow-sm" /></div><Skeleton className="mt-4 h-3.5 w-5/6" /><Skeleton className="mt-2 h-3 w-3/5" /><div className="mt-4 flex items-center justify-between gap-2"><Skeleton className="h-5 w-16 rounded-full" /><Skeleton className="h-3 w-8" /></div></div>)}</div>;
}
export default function PageLoading({ fullScreen = false, label = "Sayfan hazırlanıyor…", variant = "list" }: { fullScreen?: boolean; label?: string; variant?: LoadingVariant }) {
  const [slow, setSlow] = useState(false);
  useEffect(() => { const timer = window.setTimeout(() => setSlow(true), 12000); return () => window.clearTimeout(timer); }, []);
  const Icon = variant === "media" ? Clapperboard : BookOpen;
  const section = variant === "detail" ? "Kitap detayı" : variant === "form" ? "Kitap bilgileri" : variant === "media" ? "Film ve diziler" : "Kütüphanem";
  if (fullScreen) return <div role="status" aria-live="polite" className="flex min-h-[100dvh] flex-col items-center justify-center bg-[#fffaf3] px-6 text-center text-slate-900 dark:bg-slate-950 dark:text-white"><div aria-hidden="true" className="relative mb-7 flex h-24 w-24 items-center justify-center"><div className="absolute inset-0 rounded-[2rem] border border-orange-200 bg-orange-100/50 dark:border-orange-900/60 dark:bg-orange-500/5" /><span className="relative flex h-16 w-16 items-center justify-center rounded-2xl bg-primary text-white shadow-lg shadow-orange-600/20"><LibraryBig className="h-8 w-8" strokeWidth={1.7} /></span></div><h1 className="text-2xl font-semibold tracking-tight">Kütüphanem</h1><p className="mt-3 text-sm text-slate-500 dark:text-slate-400">{label}</p><div aria-hidden="true" className="mt-7 h-1 w-32 overflow-hidden rounded-full bg-orange-100 dark:bg-slate-800"><div className="app-progress h-full w-1/3 rounded-full bg-primary" /></div>{slow && <p className="mt-5 max-w-xs text-xs leading-5 text-slate-500 dark:text-slate-400">Yükleme beklenenden uzun sürüyor. Lütfen biraz daha bekle.</p>}</div>;
  return <div className="mx-auto w-full max-w-6xl space-y-5 py-1" aria-busy="true">
    <div role="status" aria-live="polite" className="relative overflow-hidden rounded-3xl border border-orange-200/60 bg-gradient-to-br from-orange-50/90 via-white to-white p-5 dark:border-slate-800 dark:from-orange-500/5 dark:via-slate-900 dark:to-slate-900">
      <div className="flex items-center gap-3"><span aria-hidden="true" className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-orange-100 bg-white text-primary shadow-sm dark:border-orange-900/40 dark:bg-orange-500/10"><Icon className="h-5 w-5" strokeWidth={1.7} /></span><div className="min-w-0 flex-1"><p className="text-[10px] font-semibold uppercase tracking-[.16em] text-orange-600 dark:text-orange-400">{section}</p><h2 className="mt-1 text-sm font-semibold text-slate-900 dark:text-slate-100 sm:text-base">{label}</h2></div><Loader2 aria-hidden="true" className="h-4 w-4 shrink-0 animate-spin text-primary" /></div>
      <p className="mt-3 text-xs leading-5 text-slate-500 dark:text-slate-400">{slow ? "Yükleme beklenenden uzun sürüyor. Lütfen biraz daha bekle." : variant === "detail" ? "Kapak, kitap bilgileri ve okuma ilerlemen hazırlanıyor." : variant === "form" ? "Kitabının kayıtlı bilgileri getiriliyor." : "Kayıtların ve son güncellemelerin getiriliyor."}</p>
      <div aria-hidden="true" className="absolute inset-x-0 bottom-0 h-0.5 overflow-hidden bg-orange-100/60 dark:bg-slate-800"><div className="app-progress h-full w-1/3 bg-primary/70" /></div>
    </div>
    {variant === "detail" || variant === "form" ? <DetailSkeleton form={variant === "form"} /> : <ListSkeleton />}
  </div>;
}
