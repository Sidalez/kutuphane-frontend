import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { BellRing, Loader2, Smartphone } from "lucide-react";
import { useAuth } from "../auth/AuthContext";
import { useNotifications } from "./NotificationContext";

export default function NotificationPermissionPrompt() {
  const { user } = useAuth();
  const notifications = useNotifications();
  const [dismissed, setDismissed] = useState(false);
  const [message, setMessage] = useState("");
  useEffect(() => { setDismissed(false); setMessage(""); }, [user?.uid]);
  const supported = "Notification" in window && "PushManager" in window && "serviceWorker" in navigator;
  const ios = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  const standalone = matchMedia("(display-mode: standalone)").matches || Boolean((navigator as Navigator & { standalone?: boolean }).standalone);
  const needsInstall = ios && !standalone;
  const denied = supported && Notification.permission === "denied";
  const open = Boolean(user && !dismissed && !notifications.loading && notifications.config?.pushReady && !notifications.deviceEnabled && (supported || needsInstall));
  const panel = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  const titleId = useId(), descriptionId = useId();
  useEffect(() => {
    if (!open) return;
    const previous = document.activeElement as HTMLElement | null;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    button.current?.focus();
    const keydown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !notifications.busy) setDismissed(true);
      if (event.key !== "Tab") return;
      const buttons = panel.current?.querySelectorAll<HTMLButtonElement>("button:not(:disabled)");
      if (!buttons?.length) return;
      const first = buttons[0], last = buttons[buttons.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    };
    document.addEventListener("keydown", keydown);
    return () => { document.body.style.overflow = overflow; document.removeEventListener("keydown", keydown); if (previous?.isConnected) previous.focus(); };
  }, [open, notifications.busy]);
  if (!open) return null;
  const enable = () => {
    setMessage("");
    // Keep the system permission request directly in the tap handler for iOS.
    void notifications.enableDevice().then(() => setDismissed(true)).catch(error => setMessage(error instanceof Error ? error.message : "Bildirimler açılamadı."));
  };
  return createPortal(<div className="fixed inset-0 z-[90] flex items-end justify-center bg-slate-950/50 p-3 pb-[max(.75rem,env(safe-area-inset-bottom))] backdrop-blur-sm sm:items-center sm:p-6">
    <div ref={panel} role="dialog" aria-modal="true" aria-labelledby={titleId} aria-describedby={descriptionId} aria-busy={notifications.busy} className="app-page-enter w-full max-w-md rounded-[1.75rem] border border-white/70 bg-white p-6 text-slate-900 shadow-2xl dark:border-slate-700 dark:bg-slate-900 dark:text-slate-50">
      <div className="mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-orange-50 text-primary dark:bg-orange-500/10"><BellRing className="h-7 w-7" strokeWidth={1.7} /></div>
      <h2 id={titleId} className="text-xl font-semibold tracking-tight">Yeni gelişmelerden haberdar ol</h2>
      <p id={descriptionId} className="mt-3 text-sm leading-6 text-slate-500 dark:text-slate-400">Takip ettiğin dizilerin yeni bölümleri, sezon tarihleri ve seçtiğin hatırlatmalar telefonuna gelsin.</p>
      {needsInstall ? <p className="mt-4 rounded-2xl bg-orange-50 p-4 text-sm leading-6 dark:bg-orange-500/10"><Smartphone className="mb-2 h-5 w-5 text-primary" />Safari’de Paylaş → Ana Ekrana Ekle seçeneğini kullan. Ardından uygulamayı ana ekrandaki simgesinden açıp bildirimlere izin ver.</p> : denied ? <p className="mt-4 text-sm leading-6 text-slate-500 dark:text-slate-400">Bu cihazda bildirim izni kapalı. Telefonunun veya tarayıcının bildirim ayarlarından Kütüphanem için izni açabilirsin.</p> : <button ref={button} type="button" disabled={notifications.busy} onClick={enable} className="mt-6 flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl bg-primary px-4 font-semibold text-white disabled:opacity-60">{notifications.busy ? <Loader2 className="h-5 w-5 animate-spin" /> : <BellRing className="h-5 w-5" />}{notifications.busy ? "Bildirimler açılıyor…" : "Bildirimlere izin ver"}</button>}
      {message && <p role="alert" className="mt-3 text-sm text-red-600 dark:text-red-400">{message}</p>}
      <button ref={needsInstall || denied ? button : undefined} type="button" disabled={notifications.busy} onClick={() => setDismissed(true)} className="mt-2 min-h-12 w-full rounded-2xl px-4 text-sm font-medium text-slate-500 hover:bg-slate-100 disabled:opacity-60 dark:text-slate-400 dark:hover:bg-slate-800">Şimdi değil</button>
      <p className="mt-3 text-center text-xs leading-5 text-slate-400">Tercihlerini istediğin zaman Bildirimler sayfasından değiştirebilirsin.</p>
    </div>
  </div>, document.body);
}
