import { useAppDialog } from "./DialogProvider";
import { useEffect, useState, useSyncExternalStore } from "react";
import { useLocation } from "react-router-dom";
import { useRegisterSW } from "virtual:pwa-register/react";
import { CheckCircle2, Download, Loader2, RefreshCw, WifiOff, X } from "lucide-react";
import { getActivity, subscribeActivity } from "../../requestActivity";
interface InstallPrompt extends Event { prompt: () => Promise<void>; userChoice: Promise<{outcome: string}>; }
export default function AppFeedback() {
  const dialog = useAppDialog();
  const { pathname, state } = useLocation();
  const pending = useSyncExternalStore(subscribeActivity, getActivity);
  const [online, setOnline] = useState(navigator.onLine);
  const [slow, setSlow] = useState(false);
  const [install, setInstall] = useState<InstallPrompt | null>(null);
  const [installHidden, setInstallHidden] = useState(false);
  const [notice, setNotice] = useState("");
  const iosInstall = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.matchMedia("(display-mode: standalone)").matches && !(navigator as Navigator & {standalone?: boolean}).standalone;
  const { needRefresh: [needRefresh, setNeedRefresh], updateServiceWorker } = useRegisterSW({onRegisterError: error => console.warn("Çevrimdışı destek başlatılamadı:", error)});
  useEffect(() => {
    const on = () => setOnline(true), off = () => setOnline(false);
    const offer = (event: Event) => { event.preventDefault(); setInstall(event as InstallPrompt); };
    const installed = () => setInstall(null);
    window.addEventListener("online", on); window.addEventListener("offline", off);
    window.addEventListener("beforeinstallprompt", offer); window.addEventListener("appinstalled", installed);
    return () => { window.removeEventListener("online", on); window.removeEventListener("offline", off); window.removeEventListener("beforeinstallprompt", offer); window.removeEventListener("appinstalled", installed); };
  }, []);
  useEffect(() => { if (!pending) { setSlow(false); return; } const timer = window.setTimeout(()=>setSlow(true), 15000); return ()=>window.clearTimeout(timer); }, [pending > 0]);
  useEffect(() => { setNotice(state?.notice || ""); const timer = window.setTimeout(()=>setNotice(""), 4500); return ()=>window.clearTimeout(timer); }, [pathname, state]);
  return <>
    {pending > 0 && <div role="status" aria-live="polite" className="pointer-events-none fixed inset-x-0 top-0 z-[80]"><div className="h-1 overflow-hidden bg-orange-100"><div className="app-progress h-full w-1/3 rounded-full bg-orange-600" /></div><p className="mx-auto mt-[calc(.5rem+env(safe-area-inset-top))] flex w-fit max-w-[90vw] items-center gap-2 rounded-full border border-orange-100 bg-white/95 px-4 py-2 text-xs text-slate-700 shadow-sm dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"><Loader2 className="h-4 w-4 shrink-0 animate-spin text-orange-600" />{slow ? "İşlem sürüyor; bağlantı ve kaynaklar kontrol ediliyor…" : "İşlemin hazırlanıyor…"}</p></div>}
    <div className="app-notices fixed inset-x-3 bottom-[calc(6rem+env(safe-area-inset-bottom))] z-40 mx-auto max-w-md space-y-2 md:bottom-5" aria-live="polite">
      {!online && <div role="status" className="flex items-start gap-3 rounded-2xl bg-slate-900 p-4 text-sm text-white shadow-lg"><WifiOff className="h-5 w-5 shrink-0" /><div><p className="font-semibold">İnternet bağlantısı yok</p><p className="mt-1 text-xs text-slate-300">Arama ve kaydetme için yeniden bağlan. Kitap formundaki taslağın bu tarayıcı oturumunda korunur.</p></div></div>}
      {notice && <div role="status" className="flex items-center gap-2 rounded-2xl bg-emerald-700 px-4 py-3 text-sm text-white shadow-lg"><CheckCircle2 className="h-5 w-5" />{notice}<button type="button" aria-label="Bildirimi kapat" onClick={()=>setNotice("")} className="ml-auto flex h-10 w-10 items-center justify-center"><X className="h-4 w-4" /></button></div>}
      {needRefresh && <div className="rounded-2xl border border-orange-100 bg-white p-4 text-sm shadow-lg dark:border-slate-700 dark:bg-slate-900"><p className="font-semibold">Yeni sürüm hazır</p><p className="mt-1 text-xs text-slate-500">Devam eden işlemini tamamlayıp güncelleyebilirsin.</p><div className="mt-3 flex gap-2"><button type="button" disabled={pending > 0} onClick={async()=>{if(await dialog.confirm({title:"Yeni sürüme geçilsin mi?",message:"Uygulama yenilenecek. Kaydetmediğin düzenlemeler varsa önce tamamlamanı öneririz.",cancelLabel:"Şimdilik devam et",confirmLabel:"Güncelle ve yenile",tone:"info"})) void updateServiceWorker(true);}} className="flex min-h-11 items-center gap-2 rounded-xl bg-orange-600 px-4 text-xs font-semibold text-white disabled:opacity-50"><RefreshCw className="h-4 w-4" />Güncelle</button><button type="button" onClick={()=>setNeedRefresh(false)} className="min-h-11 px-4 text-xs">Daha sonra</button></div></div>}
      {install && !installHidden && !needRefresh && online && <div className="flex items-center gap-3 rounded-2xl border border-orange-100 bg-white p-3 shadow-lg dark:border-slate-700 dark:bg-slate-900"><Download className="h-5 w-5 text-orange-600" /><button type="button" onClick={async()=>{try{await install.prompt();await install.userChoice;setInstall(null);}catch{setInstallHidden(true);}}} className="min-h-11 flex-1 text-left text-xs font-semibold">Kütüphanem’i ana ekranına ekle</button><button type="button" aria-label="Kurulum önerisini kapat" onClick={()=>setInstallHidden(true)} className="flex h-11 w-11 items-center justify-center"><X className="h-4 w-4" /></button></div>}
      {iosInstall && !installHidden && !needRefresh && online && <div className="flex items-center gap-3 rounded-2xl border border-orange-100 bg-white p-3 shadow-lg dark:border-slate-700 dark:bg-slate-900"><Download className="h-5 w-5 shrink-0 text-orange-600" /><p className="flex-1 text-xs leading-5">Uygulama gibi açmak için Safari’de <strong>Paylaş → Ana Ekrana Ekle</strong> seçeneğini kullan.</p><button type="button" aria-label="Kurulum bilgisini kapat" onClick={()=>setInstallHidden(true)} className="flex h-11 w-11 items-center justify-center"><X className="h-4 w-4" /></button></div>}
    </div>
  </>;
}
