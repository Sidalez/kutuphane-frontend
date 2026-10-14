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

  const field='min-h-14 w-full min-w-0 rounded-2xl border border-slate-200 bg-slate-50/70 pl-11 pr-4 text-base text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-orange-400 focus:ring-4 focus:ring-orange-500/10 dark:border-slate-700 dark:bg-slate-950/60 dark:text-white';
  const label='mb-2 block text-xs font-semibold text-slate-600 dark:text-slate-300';
  return <main className="min-h-[100dvh] bg-[#fffaf3] text-slate-900 dark:bg-slate-950 dark:text-white">
   <div className="mx-auto grid min-h-[100dvh] max-w-[1440px] lg:grid-cols-[1.05fr_1fr]">
    <section className="relative isolate hidden overflow-hidden bg-[#172b29] p-12 text-white lg:flex lg:flex-col xl:p-16"><div aria-hidden="true" className="absolute -right-36 -top-36 h-[600px] w-[600px] rounded-full border-[75px] border-white/[.025]"/><div className="relative flex items-center gap-3"><BrandLogo className="h-11 w-11"/><span className="text-xl font-semibold tracking-tight">Kütüphanem<span className="text-orange-300">.</span></span></div>
     <div className="relative my-auto py-12"><p className="text-[10px] font-bold uppercase tracking-[.25em] text-[#e9bc89]">HİKÂYELERİNİN BULUŞMA NOKTASI</p><h1 className="mt-6 text-5xl font-semibold leading-[1.08] tracking-tight xl:text-6xl">Bir sayfa.<br/>Bir sahne.<br/><span className="text-[#e9bc89]">Sana ait bir dünya.</span></h1><p className="mt-6 max-w-sm text-sm leading-7 text-white/55">Okuduğun kitaplar, izlediğin filmler ve beklediğin yeni bölümler. Hepsine kaldığın yerden devam et.</p>
      <div aria-hidden="true" className="relative mt-10 flex h-44 items-end gap-4 pl-3"><div className="flex h-36 w-24 -rotate-12 flex-col justify-between rounded-r-xl border-l-4 border-black/10 bg-[#c28c69] p-4 shadow-2xl"><BookOpenCheck size={23}/><span className="text-[9px] tracking-widest">HİKÂYELER</span></div><div className="flex h-44 w-28 -rotate-3 flex-col justify-between rounded-r-xl border-l-4 border-black/10 bg-[#e5d3b5] p-4 text-[#172b29] shadow-2xl"><Clapperboard size={26}/><span className="text-[9px] tracking-widest">SAHNELER</span></div><div className="flex h-36 w-24 rotate-12 flex-col justify-between rounded-r-xl border-l-4 border-black/10 bg-[#62816e] p-4 shadow-2xl"><Tv2 size={24}/><span className="text-[9px] tracking-widest">YENİ DÜNYALAR</span></div></div>
     </div><p className="relative text-xs leading-6 text-white/35">Her hikâyede kendine biraz daha yer aç.</p>
    </section>
    <section className="flex min-w-0 flex-col px-5 pb-[calc(2rem+env(safe-area-inset-bottom))] pt-[calc(1.5rem+env(safe-area-inset-top))] sm:px-10 lg:justify-center lg:px-12 xl:px-20"><div className="mx-auto flex w-full max-w-md items-center gap-3 lg:hidden"><BrandLogo className="h-10 w-10"/><span className="text-lg font-semibold tracking-tight">Kütüphanem<span className="text-orange-500">.</span></span></div>
     <div className="mx-auto mt-9 w-full max-w-md lg:my-8"><p className="mb-3 text-[10px] font-bold uppercase tracking-[.2em] text-orange-600 dark:text-orange-400">{mode==='login'?'HİKÂYENE DEVAM ET':'YENİ BİR BAŞLANGIÇ'}</p><h2 className="text-3xl font-bold tracking-tight sm:text-4xl">{mode==='login'?'Yeniden hoş geldin.':'Kendi rafını oluştur.'}</h2><p className="mt-3 text-sm leading-7 text-slate-500 dark:text-slate-400">{mode==='login'?'Kaldığın sayfa, sıradaki bölüm ve tüm favorilerin seni bekliyor.':'Kitaplarını ve izlediklerini bir araya getir. Yolculuğun burada başlasın.'}</p>
      <div className="mt-6 grid grid-cols-2 gap-1 rounded-2xl bg-slate-100 p-1 dark:bg-slate-900">{[['login','Giriş yap'],['register','Hesap oluştur']].map(([value,text])=><button key={value} type="button" disabled={submitting} aria-pressed={mode===value} onClick={()=>{setMode(value as 'login'|'register');setError(null);setPassword2('');}} className={`min-h-12 rounded-xl text-sm font-semibold transition disabled:opacity-50 ${mode===value?'bg-white text-slate-900 shadow-sm dark:bg-slate-800 dark:text-white':'text-slate-500 dark:text-slate-400'}`}>{text}</button>)}</div>
      <button type="button" onClick={handleGoogle} disabled={submitting} className="mt-6 flex min-h-14 w-full items-center justify-center gap-3 rounded-2xl border border-slate-200 bg-white text-sm font-semibold transition hover:border-slate-400 disabled:opacity-50 dark:border-slate-700 dark:bg-slate-900"><svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path fill="#4285F4" d="M21.6 12.2c0-.7-.1-1.4-.2-2.1H12v4h5.4a4.7 4.7 0 0 1-2 3v2.6h3.3c1.9-1.7 2.9-4.3 2.9-7.5Z"/><path fill="#34A853" d="M12 22c2.7 0 5-1 6.7-2.3l-3.3-2.6c-.9.6-2 .9-3.4.9a6 6 0 0 1-5.7-4.2H2.9v2.7A10 10 0 0 0 12 22Z"/><path fill="#FBBC05" d="M6.3 13.8a6 6 0 0 1 0-3.6V7.5H2.9a10 10 0 0 0 0 9l3.4-2.7Z"/><path fill="#EA4335" d="M12 6c1.5 0 2.8.5 3.9 1.5l2.9-2.9A10 10 0 0 0 2.9 7.5l3.4 2.7A6 6 0 0 1 12 6Z"/></svg>Google ile devam et</button>
      <div className="my-6 flex items-center gap-4"><span className="h-px flex-1 bg-slate-200 dark:bg-slate-800"/><span className="text-[11px] text-slate-400">veya e-posta ile</span><span className="h-px flex-1 bg-slate-200 dark:bg-slate-800"/></div>
      <form onSubmit={handleEmailSubmit} aria-busy={submitting} className="space-y-4"><fieldset disabled={submitting} className="space-y-4 disabled:opacity-70">
       {mode==='register'&&<div><label htmlFor="auth-name" className={label}>Ad ve soyad</label><div className="relative"><User size={18} className="pointer-events-none absolute left-4 top-5 text-slate-400"/><input id="auth-name" autoComplete="name" required maxLength={100} value={fullName} onChange={e=>setFullName(e.target.value)} className={field} placeholder="Adın ve soyadın"/></div></div>}
       <div><label htmlFor="auth-email" className={label}>E-posta adresi</label><div className="relative"><Mail size={18} className="pointer-events-none absolute left-4 top-5 text-slate-400"/><input id="auth-email" type="email" autoComplete="email" autoCapitalize="none" spellCheck={false} inputMode="email" required value={email} onChange={e=>setEmail(e.target.value)} className={field} placeholder="ornek@mail.com"/></div></div>
       <div><label htmlFor="auth-password" className={label}>Şifre</label><div className="relative"><Lock size={18} className="pointer-events-none absolute left-4 top-5 text-slate-400"/><input id="auth-password" type={showPassword?'text':'password'} autoComplete={mode==='login'?'current-password':'new-password'} required minLength={mode==='register'?6:undefined} value={password} onChange={e=>setPassword(e.target.value)} className={`${field} !pr-14`} placeholder={mode==='register'?'En az 6 karakter':'Şifreni gir'}/><button type="button" aria-label={showPassword?'Şifreyi gizle':'Şifreyi göster'} aria-pressed={showPassword} onClick={()=>setShowPassword(!showPassword)} className="absolute right-1 top-1 flex h-12 w-12 items-center justify-center rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-white">{showPassword?<EyeOff size={18}/>:<Eye size={18}/>}</button></div></div>
       {mode==='register'&&<div><label htmlFor="auth-password-confirm" className={label}>Şifre tekrar</label><div className="relative"><Lock size={18} className="pointer-events-none absolute left-4 top-5 text-slate-400"/><input id="auth-password-confirm" type={showPassword?'text':'password'} autoComplete="new-password" required minLength={6} value={password2} onChange={e=>setPassword2(e.target.value)} className={field} placeholder="Şifreni tekrar gir"/></div></div>}
      </fieldset>
      {error&&<div role="alert" className="flex items-start gap-2 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-xs leading-6 text-rose-700 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-300"><AlertCircle size={17} className="mt-1 shrink-0"/>{error}</div>}
      <button type="submit" disabled={submitting} className="flex min-h-14 w-full items-center justify-center gap-2 rounded-2xl bg-orange-600 px-5 text-sm font-semibold text-white shadow-lg shadow-orange-600/10 transition hover:bg-orange-700 active:scale-[.99] disabled:opacity-50">{submitting?<><Loader2 size={18} className="animate-spin"/>İşlemin tamamlanıyor…</>:<>{mode==='login'?'Giriş yap':'Hesabımı oluştur'}<ArrowRight size={18}/></>}</button>
      {submitting&&<p role="status" className="text-center text-xs leading-6 text-slate-500">İşlem tamamlandığında Başlangıç ekranın açılacak.</p>}
      </form><p className="mt-7 text-center text-[11px] leading-6 text-slate-400">Kitapların, izlediklerin ve kişisel notların hesabında bir arada.</p>
     </div>
    </section>
   </div>
  </main>;
}
