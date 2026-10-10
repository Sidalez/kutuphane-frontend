import { useState } from "react";
import { Link } from "react-router-dom";
import { LogOut, Moon, SunMedium, UserCircle2, Smartphone, ChevronRight, Loader2, Settings } from "lucide-react";
import { useAuth } from "../auth/AuthContext";
import { useTheme } from "../theme/ThemeContext";

export default function SettingsPage() {
  const { user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const [leaving, setLeaving] = useState(false);
  const [error, setError] = useState("");
  const standalone = window.matchMedia("(display-mode: standalone)").matches || (navigator as Navigator & { standalone?: boolean }).standalone;
  const card = "rounded-3xl border border-slate-200/80 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900";
  const signOut = async () => {
    if (leaving) return;
    setLeaving(true); setError("");
    try { await logout(); } catch { setError("Oturum kapatılamadı. Lütfen tekrar dene."); setLeaving(false); }
  };
  return <div className="mx-auto max-w-2xl space-y-5 text-slate-900 dark:text-slate-50">
    <header className="space-y-2"><div className="flex items-center gap-2 text-sm font-semibold text-primary"><Settings className="h-5 w-5" />Sana göre</div><h1 className="text-2xl font-semibold tracking-tight md:text-3xl">Ayarlar</h1><p className="text-sm text-slate-500 dark:text-slate-400">Görünümünü düzenle, hesabını yönet.</p></header>
    <section className={card} aria-labelledby="settings-account"><h2 id="settings-account" className="mb-4 text-sm font-semibold">Hesabım</h2><Link to="/profile" className="flex min-h-14 items-center gap-3 rounded-2xl p-2 hover:bg-slate-50 dark:hover:bg-slate-800"><span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-orange-50 text-primary dark:bg-orange-500/10"><UserCircle2 className="h-6 w-6" /></span><span className="min-w-0 flex-1"><span className="block truncate text-sm font-semibold">{user?.displayName || "Profilim"}</span><span className="block truncate text-xs text-slate-500 dark:text-slate-400">{user?.email}</span></span><ChevronRight className="h-5 w-5 shrink-0 text-slate-400" /></Link></section>
    <section className={card} aria-labelledby="settings-theme"><h2 id="settings-theme" className="mb-4 text-sm font-semibold">Görünüm</h2><button type="button" role="switch" aria-checked={theme === "dark"} aria-label="Koyu tema" onClick={toggleTheme} className="flex min-h-14 w-full items-center gap-3 rounded-2xl p-2 text-left hover:bg-slate-50 dark:hover:bg-slate-800">{theme === "dark" ? <Moon className="h-5 w-5 text-primary" /> : <SunMedium className="h-5 w-5 text-primary" />}<span className="flex-1"><span className="block text-sm font-semibold">Koyu tema</span><span className="text-xs text-slate-500 dark:text-slate-400">Seçimin bu cihazda hatırlanır.</span></span><span aria-hidden="true" className={`flex h-7 w-12 shrink-0 items-center rounded-full p-1 transition ${theme === "dark" ? "bg-primary" : "bg-slate-200"}`}><span className={`h-5 w-5 rounded-full bg-white shadow transition-transform ${theme === "dark" ? "translate-x-5" : ""}`} /></span></button></section>
    <section className={card} aria-labelledby="settings-app"><div className="mb-3 flex items-center gap-2"><Smartphone className="h-5 w-5 text-primary" /><h2 id="settings-app" className="text-sm font-semibold">Telefonunda Kütüphanem</h2></div><p className="text-sm leading-6 text-slate-600 dark:text-slate-300">{standalone ? "Kütüphanem’i uygulama görünümünde kullanıyorsun." : "iPhone’da Safari’nin Paylaş menüsünden “Ana Ekrana Ekle”yi seç. Android’de tarayıcı menüsünden “Uygulamayı yükle” veya “Ana ekrana ekle” seçeneğini kullan."}</p><p className="mt-3 text-xs leading-5 text-slate-500 dark:text-slate-400">Kapatmak için telefonunun uygulama değiştiricisini veya tarayıcı sekmesini kullanabilirsin.</p></section>
    <section className={card}><h2 className="text-sm font-semibold">Oturum</h2><p className="mb-4 mt-2 text-xs leading-5 text-slate-500 dark:text-slate-400">Kitapların ve medya kayıtların hesabında kalır. Devam etmek için tekrar giriş yapabilirsin.</p><button type="button" disabled={leaving} onClick={signOut} className="flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl bg-slate-900 px-4 text-sm font-semibold text-white disabled:opacity-60 dark:bg-slate-100 dark:text-slate-900">{leaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <LogOut className="h-4 w-4" />}{leaving ? "Oturum kapatılıyor…" : "Oturumu kapat"}</button>{error && <p role="alert" className="mt-3 text-sm text-red-600">{error}</p>}</section>
  </div>;
}
