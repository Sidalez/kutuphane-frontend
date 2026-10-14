import BrandLogo from "../components/BrandLogo";
// src/pages/LoginPage.tsx
import { FormEvent, useState } from "react";
import { useAuth } from "../auth/AuthContext";
import {
  Mail,
  Lock,
  BookOpenCheck,
  User,
  Clapperboard,
  Tv2, Eye, EyeOff, ArrowRight, Loader2, AlertCircle,
} from "lucide-react";

export default function LoginPage() {
  const { signInWithGoogle, signInWithEmail, signUpWithEmail } = useAuth();

  const [mode, setMode] = useState<"login" | "register">("login");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [password2, setPassword2] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [showPassword,setShowPassword]=useState(false);

  const handleEmailSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if(submitting)return;
    setError(null);

    if (!email || !password) {
      setError("E-posta ve şifre zorunludur.");
      return;
    }
    if (mode === "register" && !fullName.trim()) {
      setError("Lütfen ad soyad gir.");
      return;
    }
    if (mode === "register" && password !== password2) {
      setError("Şifreler birbiriyle eşleşmiyor.");
      return;
    }

    setSubmitting(true);
    try {
      if (mode === "login") {
        await signInWithEmail(email.trim(), password);
      } else {
        await signUpWithEmail(email.trim(), password, fullName.trim());
      }
    } catch (err: any) {
      console.error(err);
      let msg = "İşlem sırasında bir hata oluştu.";
      if (err.code === "auth/email-already-in-use") {
        msg = "Bu e-posta adresi zaten kayıtlı.";
      } else if (err.code === "auth/invalid-email") {
        msg = "Geçerli bir e-posta adresi gir.";
      } else if (err.code === "auth/weak-password") {
        msg = "Şifre çok zayıf. En az 6 karakter olmalı.";
      } else if (err.code === "auth/user-not-found") {
        msg = "Bu e-posta ile kayıtlı kullanıcı bulunamadı.";
      } else if (err.code === "auth/wrong-password") {
        msg = "Şifre yanlış.";
      }
      if(err.code==='auth/invalid-credential')msg='E-posta veya şifre doğru değil. Tekrar kontrol et.';
      if(err.code==='auth/network-request-failed')msg='Bağlantı kurulamadı. İnternetini kontrol edip tekrar dene.';
      if(err.code==='auth/too-many-requests')msg='Çok fazla deneme yapıldı. Biraz bekleyip yeniden dene.';
      setError(msg);
    } finally {
      setSubmitting(false);
    }
  };

  const handleGoogle = async () => {
    if (submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      await signInWithGoogle();
    } catch {
      // Hata, ortak uygulama uyarısında gösterilir.
    } finally {
      setSubmitting(false);
    }
  };

  const field='min-h-[52px] w-full min-w-0 rounded-2xl border border-slate-200 bg-[#fafaf8] pl-11 pr-4 text-base text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-orange-400 focus:ring-4 focus:ring-orange-500/10 dark:border-slate-700 dark:bg-slate-950/60 dark:text-white';
  const label='mb-2 block text-xs font-semibold text-slate-600 dark:text-slate-300';
  return <main className="min-h-[100dvh] bg-[#f7f6f2] text-slate-900 dark:bg-slate-950 dark:text-white">
   <div className="mx-auto grid min-h-[100dvh] max-w-[1600px] lg:grid-cols-[1.05fr_1fr]">
    <section className="relative isolate hidden overflow-hidden bg-[#142a28] p-12 text-white lg:flex lg:flex-col xl:p-16"><div aria-hidden="true" className="absolute -right-36 -top-36 h-[600px] w-[600px] rounded-full border-[1px] border-white/[.06]"/><div className="relative flex items-center gap-3"><BrandLogo className="h-11 w-11"/><span className="text-xl font-semibold tracking-tight">Kütüphanem<span className="text-orange-300">.</span></span></div>
     <div className="relative my-auto py-12"><p className="text-[10px] font-bold uppercase tracking-[.25em] text-[#e9bc89]">HİKÂYELERİNİN BULUŞMA NOKTASI</p><h1 className="mt-6 text-5xl font-medium leading-[1.12] tracking-[-.045em] xl:text-6xl">İyi hikâyeler<br/>bir yerde<br/><span className="text-[#e9bc89]">birikir.</span></h1><p className="mt-6 max-w-sm text-sm leading-7 text-white/55">Okuduğun kitaplar, izlediğin filmler ve beklediğin yeni bölümler. Hepsine kaldığın yerden devam et.</p>
      <div className="relative mt-10 space-y-3"><div className="flex max-w-sm items-center gap-4 rounded-2xl border border-white/10 bg-white/[.035] p-4"><span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-[#e9bc89]/10 text-[#e9bc89]"><BookOpenCheck size={22}/></span><div><p className="text-sm font-medium text-white/90">Kaldığın sayfadan devam et</p><p className="mt-1 text-xs leading-5 text-white/40">Okuma günlüğün ve hedeflerin yanında.</p></div></div><div className="ml-7 flex max-w-sm items-center gap-4 rounded-2xl border border-white/10 bg-white/[.035] p-4"><span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-emerald-200/10 text-emerald-200"><Clapperboard size={22}/></span><div><p className="text-sm font-medium text-white/90">Sıradaki sahneyi kaçırma</p><p className="mt-1 text-xs leading-5 text-white/40">İzleme rafın ve bölüm takibin bir arada.</p></div></div></div>
     </div><p className="relative text-xs leading-6 text-white/35">Her hikâyede kendine biraz daha yer aç.</p>
    </section>
    <section className="flex min-w-0 flex-col px-5 pb-[calc(2rem+env(safe-area-inset-bottom))] pt-[calc(1.5rem+env(safe-area-inset-top))] sm:px-10 lg:justify-center lg:px-12 xl:px-20"><div className="mx-auto flex w-full max-w-md items-center gap-3 lg:hidden"><BrandLogo className="h-10 w-10"/><span className="text-lg font-semibold tracking-tight">Kütüphanem<span className="text-orange-500">.</span></span></div>
     <div className="mx-auto mt-8 w-full max-w-md rounded-[2rem] border border-white bg-white/90 p-5 shadow-[0_20px_80px_-32px_rgba(30,41,59,.14)] dark:border-slate-800 dark:bg-slate-900/80 sm:p-8 lg:my-8 lg:max-w-[480px] lg:p-9"><p className="mb-3 text-[10px] font-bold uppercase tracking-[.2em] text-orange-600 dark:text-orange-400">{mode==='login'?'HİKÂYENE DEVAM ET':'YENİ BİR BAŞLANGIÇ'}</p><h2 className="text-[28px] font-semibold tracking-[-.04em] sm:text-[32px]">{mode==='login'?'Sana ait bir alan.':'Yeni bir hikâye başlasın.'}</h2><p className="mt-3 text-sm leading-7 text-slate-500 dark:text-slate-400">{mode==='login'?'Kütüphanene giriş yap. Hikâyelerine kaldığın yerden devam et.':'Kitapların, filmlerin ve dizilerin için kişisel alanını oluştur.'}</p>
      <div className="mt-6 grid grid-cols-2 gap-1 rounded-2xl bg-slate-100 p-1 dark:bg-slate-900">{[['login','Giriş yap'],['register','Hesap oluştur']].map(([value,text])=><button key={value} type="button" disabled={submitting} aria-pressed={mode===value} onClick={()=>{setMode(value as 'login'|'register');setError(null);setPassword2('');}} className={`min-h-12 rounded-xl text-sm font-semibold transition disabled:opacity-50 ${mode===value?'bg-white text-slate-900 shadow-sm dark:bg-slate-800 dark:text-white':'text-slate-500 dark:text-slate-400'}`}>{text}</button>)}</div>
      <button type="button" onClick={handleGoogle} disabled={submitting} className="mt-6 flex min-h-[52px] w-full items-center justify-center gap-3 rounded-2xl border border-slate-200 bg-white text-sm font-semibold transition hover:border-slate-400 disabled:opacity-50 dark:border-slate-700 dark:bg-slate-900"><svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path fill="#4285F4" d="M21.6 12.2c0-.7-.1-1.4-.2-2.1H12v4h5.4a4.7 4.7 0 0 1-2 3v2.6h3.3c1.9-1.7 2.9-4.3 2.9-7.5Z"/><path fill="#34A853" d="M12 22c2.7 0 5-1 6.7-2.3l-3.3-2.6c-.9.6-2 .9-3.4.9a6 6 0 0 1-5.7-4.2H2.9v2.7A10 10 0 0 0 12 22Z"/><path fill="#FBBC05" d="M6.3 13.8a6 6 0 0 1 0-3.6V7.5H2.9a10 10 0 0 0 0 9l3.4-2.7Z"/><path fill="#EA4335" d="M12 6c1.5 0 2.8.5 3.9 1.5l2.9-2.9A10 10 0 0 0 2.9 7.5l3.4 2.7A6 6 0 0 1 12 6Z"/></svg>Google ile devam et</button>
      <div className="my-6 flex items-center gap-4"><span className="h-px flex-1 bg-slate-200 dark:bg-slate-800"/><span className="text-[11px] text-slate-400">veya e-posta ile</span><span className="h-px flex-1 bg-slate-200 dark:bg-slate-800"/></div>
      <form onSubmit={handleEmailSubmit} aria-busy={submitting} className="space-y-4"><fieldset disabled={submitting} className="space-y-4 disabled:opacity-70">
       {mode==='register'&&<div><label htmlFor="auth-name" className={label}>Ad ve soyad</label><div className="relative"><User size={18} className="pointer-events-none absolute left-4 top-[17px] text-slate-400"/><input id="auth-name" autoComplete="name" required maxLength={100} value={fullName} onChange={e=>setFullName(e.target.value)} className={field} placeholder="Adın ve soyadın"/></div></div>}
       <div><label htmlFor="auth-email" className={label}>E-posta adresi</label><div className="relative"><Mail size={18} className="pointer-events-none absolute left-4 top-[17px] text-slate-400"/><input id="auth-email" type="email" autoComplete="email" autoCapitalize="none" spellCheck={false} inputMode="email" required value={email} onChange={e=>setEmail(e.target.value)} className={field} placeholder="ornek@mail.com"/></div></div>
       <div><label htmlFor="auth-password" className={label}>Şifre</label><div className="relative"><Lock size={18} className="pointer-events-none absolute left-4 top-[17px] text-slate-400"/><input id="auth-password" type={showPassword?'text':'password'} autoComplete={mode==='login'?'current-password':'new-password'} required minLength={mode==='register'?6:undefined} value={password} onChange={e=>setPassword(e.target.value)} className={`${field} !pr-14`} placeholder={mode==='register'?'En az 6 karakter':'Şifreni gir'}/><button type="button" aria-label={showPassword?'Şifreyi gizle':'Şifreyi göster'} aria-pressed={showPassword} onClick={()=>setShowPassword(!showPassword)} className="absolute right-1 top-0 flex h-[52px] w-12 items-center justify-center rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-white">{showPassword?<EyeOff size={18}/>:<Eye size={18}/>}</button></div></div>
       {mode==='register'&&<div><label htmlFor="auth-password-confirm" className={label}>Şifre tekrar</label><div className="relative"><Lock size={18} className="pointer-events-none absolute left-4 top-[17px] text-slate-400"/><input id="auth-password-confirm" type={showPassword?'text':'password'} autoComplete="new-password" required minLength={6} value={password2} onChange={e=>setPassword2(e.target.value)} className={field} placeholder="Şifreni tekrar gir"/></div></div>}
      </fieldset>
      {error&&<div role="alert" className="flex items-start gap-2 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-xs leading-6 text-rose-700 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-300"><AlertCircle size={17} className="mt-1 shrink-0"/>{error}</div>}
      <button type="submit" disabled={submitting} className="flex min-h-[52px] w-full items-center justify-center gap-2 rounded-2xl bg-[#183b35] px-5 text-sm font-semibold text-white shadow-lg shadow-emerald-950/10 transition hover:bg-[#224a42] dark:bg-[#e9bc89] dark:text-[#142a28] dark:hover:bg-[#f2cba4] active:scale-[.99] disabled:opacity-50">{submitting?<><Loader2 size={18} className="animate-spin"/>İşlemin tamamlanıyor…</>:<>{mode==='login'?'Giriş yap':'Hesabımı oluştur'}<ArrowRight size={18}/></>}</button>
      {submitting&&<p role="status" className="text-center text-xs leading-6 text-slate-500">İşlem tamamlandığında Başlangıç ekranın açılacak.</p>}
      </form><p className="mt-7 border-t border-slate-100 pt-5 text-center text-[11px] leading-6 text-slate-400 dark:border-slate-800">Kitapların, izlediklerin ve kişisel notların hesabında bir arada.</p>
     </div>
    </section>
   </div>
  </main>;
}
