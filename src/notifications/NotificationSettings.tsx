import { useEffect, useState } from "react";
import { BellRing, Check, Loader2, Smartphone } from "lucide-react";
import { useNotifications } from "./NotificationContext";
const input = "mt-2 block w-full min-w-0 max-w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm dark:border-slate-700 dark:bg-slate-950";
function Toggle({ title, detail, checked, onChange, disabled }: { title: string; detail: string; checked: boolean; onChange: (value: boolean) => void; disabled: boolean }) {
  return <label className={`flex min-h-16 cursor-pointer items-center gap-3 py-3 ${disabled ? "opacity-50" : ""}`}><span className="min-w-0 flex-1"><span className="block text-sm font-semibold">{title}</span><span className="mt-1 block text-xs leading-5 text-slate-500 dark:text-slate-400">{detail}</span></span><input type="checkbox" role="switch" checked={checked} disabled={disabled} onChange={e => onChange(e.target.checked)} className="peer sr-only" /><span aria-hidden="true" className={`flex h-7 w-12 shrink-0 items-center rounded-full p-1 transition peer-focus-visible:ring-2 peer-focus-visible:ring-orange-600 ${checked ? "bg-orange-600" : "bg-slate-200 dark:bg-slate-700"}`}><span className={`h-5 w-5 rounded-full bg-white shadow-sm transition-transform ${checked ? "translate-x-5" : ""}`} /></span></label>;
}
export default function NotificationSettings() {
  const n = useNotifications();
  const [draft, setDraft] = useState(n.preferences);
  const [notice, setNotice] = useState("");
  const [localError, setLocalError] = useState("");
  const serialized = JSON.stringify(n.preferences);
  useEffect(() => { setDraft(JSON.parse(serialized)); }, [serialized]);
  const disabled = n.loading || !n.config?.ready || n.busy;
  const ios = /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  const standalone = matchMedia("(display-mode: standalone)").matches || (navigator as Navigator & { standalone?: boolean }).standalone;
  const supported = "Notification" in window && "PushManager" in window && "serviceWorker" in navigator;
  const denied = supported && Notification.permission === "denied";
  async function perform(work: () => Promise<void>, success: string) {
    setNotice(""); setLocalError("");
    try { await work(); setNotice(success); } catch (error) { setLocalError(error instanceof Error ? error.message : "İşlem tamamlanamadı."); }
  }
  return <section className="min-w-0 rounded-3xl border border-slate-200/80 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900" aria-labelledby="notification-settings-title">
    <span className="mb-3 flex h-11 w-11 items-center justify-center rounded-2xl bg-orange-50 text-orange-600 dark:bg-orange-500/10"><BellRing className="h-5 w-5" /></span><h2 id="notification-settings-title" className="text-lg font-semibold">Bildirim tercihlerin</h2><p className="mt-2 text-sm leading-6 text-slate-500 dark:text-slate-400">Yeni bölümler, okuma molaları ve sana uygun bir bildirim düzeni.</p>
    {n.config && !n.config.ready && <p role="status" className="mt-5 rounded-2xl bg-amber-50 p-4 text-sm leading-6 text-amber-900 dark:bg-amber-500/10 dark:text-amber-200">Bildirim merkezi hazır. Otomatik takip ve telefon bildirimleri, sunucu kurulumu tamamlandığında etkinleşecek.</p>}
    <form className="mt-3" onSubmit={e => { e.preventDefault(); void perform(() => n.savePreferences({ ...draft, timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone || "Europe/Istanbul" }), "Bildirim tercihlerin kaydedildi."); }}>
      <Toggle title="Bildirim takibi" detail="Takip açıkken yeni gelişmeler bildirim merkezine kaydedilir." checked={draft.enabled} disabled={disabled} onChange={enabled => setDraft(d => ({ ...d, enabled }))} />
      <fieldset disabled={disabled || !draft.enabled} className="mt-3 min-w-0 border-t border-slate-100 pt-2 disabled:opacity-50 dark:border-slate-800">
        <legend className="sr-only">Bildirim türleri ve zamanları</legend>
        {([
          ["trailers", "Yeni fragmanlar", "Film ve diziler için resmî fragmanlar. TMDB ve desteklenen resmî kanal kaynağında bölüm eşleşmesi doğrulanır."],
          ["upcoming", "Yayından iki gün önce", "Dizilerin sıradaki bölümü ve filmlerin Türkiye sinema/dijital yayın tarihi için hatırlatma. Kaynakta bulunmayan saat gösterilmez."],
          ["episodes", "Yeni bölümler", "Kütüphanendeki dizilerin yeni bölümleri yayımlandığında."],
          ["seasons", "Yeni sezon tarihleri", "Takip ettiğin dizinin yeni sezon tarihi açıklandığında."],
          ["reading", "Okuma molası", "Seçtiğin saatte günlük, kısa bir okuma hatırlatması."],
          ["readingFollowUp", "Okuma ritmim", "Son okuma kaydının başlangıcından 24 saat sonra; kitabın, okuduğun süre ve sayfalarla kişisel hatırlatma."],
          ["watching", "Kaldığın yerden devam et", "İzlediğin bir içerik varsa pazar günü haftalık hatırlatma."],
        ] as const).map(([key, title, detail]) => <Toggle key={key} title={title} detail={detail} checked={draft[key]} disabled={disabled || !draft.enabled} onChange={value => setDraft(d => ({ ...d, [key]: value }))} />)}
        {draft.upcoming && <label className="mb-4 block text-xs font-semibold">Yaklaşan yayın hatırlatma saati<input type="time" required value={draft.upcomingTime} onChange={e => setDraft(d => ({ ...d, upcomingTime: e.target.value }))} className={input} /></label>}
        {(draft.reading || draft.watching) && <label className="mb-4 block text-xs font-semibold">Hatırlatma saati<input type="time" required value={draft.reminderTime} onChange={e => setDraft(d => ({ ...d, reminderTime: e.target.value }))} className={input} /></label>}
        <div className="mt-4 rounded-2xl bg-slate-50 p-4 dark:bg-slate-950/60">
          <label className="block text-xs font-semibold">Telefon bildirimlerinin zamanı<select value={draft.delivery} onChange={e => setDraft(d => ({ ...d, delivery: e.target.value as "instant" | "daily" }))} className={input}><option value="instant">Yeni gelişmeler geldikçe</option><option value="daily">Günde bir kez özet</option></select></label>
          {draft.delivery === "daily" && <label className="mt-4 block text-xs font-semibold">Günlük özet saati<input type="time" required value={draft.digestTime} onChange={e => setDraft(d => ({ ...d, digestTime: e.target.value }))} className={input} /></label>}
          <Toggle title="Sessiz saatler" detail="Bu saatlerde telefon bildirimi gönderilmez; sonrasında iletilir." checked={draft.quietEnabled} disabled={disabled || !draft.enabled} onChange={quietEnabled => setDraft(d => ({ ...d, quietEnabled }))} />
          {draft.quietEnabled && <div className="grid min-w-0 grid-cols-2 gap-3"><label className="min-w-0 text-xs font-semibold">Başlangıç<input type="time" required value={draft.quietStart} onChange={e => setDraft(d => ({ ...d, quietStart: e.target.value }))} className={input} /></label><label className="min-w-0 text-xs font-semibold">Bitiş<input type="time" required value={draft.quietEnd} onChange={e => setDraft(d => ({ ...d, quietEnd: e.target.value }))} className={input} /></label></div>}
          <p className="mt-3 text-xs leading-5 text-slate-500">Saatler telefonunun saat dilimine göre kaydedilir. Düzenli kontroller nedeniyle bildirimler birkaç dakika gecikebilir.</p>
        </div>
      </fieldset>
      <button type="submit" disabled={disabled || JSON.stringify(draft) === serialized} className="mt-5 flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl bg-orange-600 px-4 text-sm font-semibold text-white hover:bg-orange-700 disabled:opacity-50">{n.busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}Tercihleri kaydet</button>
    </form>
    <div className="mt-5 border-t border-slate-100 pt-5 dark:border-slate-800"><h3 className="flex items-center gap-2 text-sm font-semibold"><Smartphone className="h-5 w-5 text-orange-600" />Bu telefona bildirim gönder</h3><p className="mt-2 text-xs leading-6 text-slate-500 dark:text-slate-400">{n.deviceEnabled ? "Bu cihazda bildirimler açık. Uygulama kapalıyken de haber alabilirsin." : "İzin verdiğinde bildirimler telefonunun kilit ekranına da gelebilir."}</p>
      {ios && !standalone && <p className="mt-3 rounded-2xl bg-orange-50 p-3 text-xs leading-6 text-orange-900 dark:bg-orange-500/10 dark:text-orange-200">iPhone’da Safari → Paylaş → Ana Ekrana Ekle. Ardından uygulamayı ana ekrandaki simgesinden açıp bildirimlere izin ver. iOS 16.4 veya üzeri gerekir.</p>}
      {!supported && !ios && <p className="mt-3 text-xs leading-5 text-slate-500">Bu tarayıcı telefon bildirimlerini desteklemiyor. Uygulama içindeki bildirim merkezini kullanabilirsin.</p>}
      {denied && <p className="mt-3 text-xs leading-5 text-amber-700 dark:text-amber-300">Bildirim izni kapalı. Telefonunun veya tarayıcının bu siteye ait bildirim ayarlarından açabilirsin.</p>}
      <div className="mt-4 flex flex-wrap gap-2">{n.deviceEnabled ? <><button type="button" disabled={disabled} onClick={() => void perform(n.testDevice, "Deneme bildirimi gönderildi. Telefonunu kontrol et.")} className="min-h-11 rounded-xl bg-orange-600 px-4 text-xs font-semibold text-white disabled:opacity-50">Deneme bildirimi gönder</button><button type="button" disabled={disabled} onClick={() => void perform(n.disableDevice, "Bu cihazın telefon bildirimleri kapatıldı.")} className="min-h-11 rounded-xl border border-slate-200 px-4 text-xs font-semibold disabled:opacity-50 dark:border-slate-700">Bu cihazda kapat</button></> : <button type="button" disabled={disabled || !n.config?.pushReady || !supported || (ios && !standalone) || denied} onClick={() => void perform(n.enableDevice, "Telefon bildirimlerin açıldı.")} className="flex min-h-12 items-center gap-2 rounded-2xl bg-orange-600 px-4 text-sm font-semibold text-white disabled:opacity-50"><BellRing className="h-4 w-4" />Telefon bildirimlerini aç</button>}</div>
      {n.config?.ready && !n.config.pushReady && <p className="mt-3 text-xs text-slate-500">Uygulama içi takip hazır; telefon gönderimi için sunucu kurulumu tamamlanmalı.</p>}
      {notice && <p role="status" className="mt-4 text-sm text-emerald-700 dark:text-emerald-300">{notice}</p>}
      {(localError || n.error) && <p role="alert" className="mt-4 text-sm leading-6 text-rose-700 dark:text-rose-300">{localError || n.error}</p>}
    </div>
  </section>;
}
