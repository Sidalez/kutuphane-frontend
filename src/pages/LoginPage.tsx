// src/pages/LoginPage.tsx
import { FormEvent, useState } from "react";
import { useAuth } from "../auth/AuthContext";
import {
  Chrome,
  Mail,
  Lock,
  LogIn,
  UserPlus,
  BookOpenCheck,
  Sparkles,
  User,
  Clapperboard,
  Tv2,
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

  const handleEmailSubmit = async (e: FormEvent) => {
    e.preventDefault();
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
        await signInWithEmail(email, password);
      } else {
        await signUpWithEmail(email, password, fullName.trim());
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
      setError(msg);
    } finally {
      setSubmitting(false);
    }
  };

  const handleGoogle = async () => {
    setError(null);
    try {
      await signInWithGoogle();
    } catch {
      // hata AuthContext içinde alert ile gösteriliyor
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 text-slate-50 flex items-center justify-center">
      <div className="w-full max-w-6xl mx-auto px-4 py-8 md:py-12 flex flex-col gap-8 md:gap-10 lg:flex-row lg:items-center">
        {/* SOL TARAF – tanıtım / hero */}
        <section className="flex-1 flex flex-col gap-6">
          {/* üst badge */}
          <div className="inline-flex items-center gap-2 rounded-full bg-slate-900/80 border border-slate-700 px-3 py-1 text-[11px] font-medium text-slate-200 shadow-sm shadow-slate-950/70 w-fit">
            <span className="inline-flex h-4 w-4 items-center justify-center rounded-full bg-primary/90 text-[10px] font-bold">
              ✦
            </span>
            Tüm içeriklerinin kontrol paneli
          </div>

          {/* başlık + açıklama */}
          <div>
            <h1 className="text-3xl sm:text-4xl lg:text-5xl font-black tracking-tight mb-3 leading-tight">
              Kitap, film ve dizilerin{" "}
              <span className="text-primary">tek panoda</span>.
            </h1>
            <p className="text-sm sm:text-base text-slate-300 max-w-xl">
              Okudukların, izlediklerin, hedeflerin ve istatistiklerin tek yerde.
              Kişiselleştirilmiş önerilerle ne okuyacağını / ne izleyeceğini
              düşünme derdini bırak.
            </p>
          </div>

          {/* küçük istatistik kartları */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 max-w-lg mt-1 sm:mt-2">
            {/* kitap kartı */}
            <div className="rounded-2xl bg-slate-900/80 border border-slate-700/80 px-4 py-3 flex flex-col gap-1 shadow-sm shadow-slate-950/80">
              <span className="text-[11px] uppercase tracking-[0.18em] text-slate-400 font-semibold">
                Bu yıl okunan
              </span>
              <div className="flex items-baseline gap-1">
                <span className="text-2xl font-extrabold text-primary">
                  27
                </span>
                <span className="text-xs text-slate-400">kitap</span>
              </div>
              <span className="text-[11px] text-slate-400">
                Okuma hedefinde %72 ilerleme
              </span>
            </div>

            {/* film kartı */}
            <div className="rounded-2xl bg-slate-900/80 border border-slate-700/80 px-4 py-3 flex flex-col gap-1 shadow-sm shadow-slate-950/80">
              <span className="text-[11px] uppercase tracking-[0.18em] text-slate-400 font-semibold">
                Bu ay izlenen
              </span>
              <div className="flex items-baseline gap-1">
                <span className="text-2xl font-extrabold text-emerald-400">
                  12
                </span>
                <span className="text-xs text-slate-400">film</span>
              </div>
              <span className="text-[11px] text-slate-400">
                İzleme listenden otomatik takip
              </span>
            </div>

            {/* dizi / öneri kartı */}
            <div className="col-span-2 sm:col-span-1 rounded-2xl bg-gradient-to-br from-primary/30 via-violet-500/20 to-sky-400/20 border border-primary/50 px-4 py-3 flex gap-3 items-center shadow-sm shadow-primary/40">
              <div className="w-9 h-9 rounded-2xl bg-slate-950/80 flex items-center justify-center">
                <Sparkles className="w-4 h-4 text-amber-200" />
              </div>
              <div className="flex flex-col">
                <span className="text-xs font-semibold text-amber-100">
                  Akıllı karışık öneriler
                </span>
                <span className="text-[11px] text-amber-100/80">
                  Kitap + film + dizi alışkanlığına göre tek tıkla öneri.
                </span>
              </div>
            </div>
          </div>

          {/* içerik türleri mini etiketleri */}
          <div className="flex flex-wrap items-center gap-2 mt-2 text-[11px] text-slate-400">
            <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-slate-900/70 border border-slate-700/70">
              <BookOpenCheck className="w-3 h-3" />
              Kitap kütüphanesi
            </span>
            <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-slate-900/70 border border-slate-700/70">
              <Clapperboard className="w-3 h-3" />
              Film arşivi
            </span>
            <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-slate-900/70 border border-slate-700/70">
              <Tv2 className="w-3 h-3" />
              Dizi / bölüm takibi
            </span>
          </div>
        </section>

        {/* SAĞ TARAF – login card */}
        <section className="flex-1 flex justify-center">
          <div className="w-full max-w-md rounded-3xl bg-slate-950/80 backdrop-blur-2xl border border-slate-800/80 shadow-[0_18px_60px_rgba(0,0,0,0.75)] px-6 py-6 md:px-7 md:py-7 relative overflow-hidden">
            {/* dekoratif arka plan blur */}
            <div className="pointer-events-none absolute -top-10 -right-10 w-40 h-40 rounded-full bg-primary/30 blur-3xl opacity-60" />
            <div className="pointer-events-none absolute bottom-0 -left-10 w-40 h-40 rounded-full bg-sky-500/20 blur-3xl opacity-60" />

            <div className="relative z-10">
              {/* üst başlık */}
              <div className="flex items-start justify-between mb-5">
                <div>
                  <div className="inline-flex items-center gap-2 rounded-full bg-slate-900/80 px-3 py-1 border border-slate-700 text-[11px] text-slate-300 mb-2">
                    <Sparkles className="w-3 h-3 text-primary" />
                    <span>Kişisel medya merkezin</span>
                  </div>
                  <h2 className="text-xl font-bold text-slate-50">
                    {mode === "login" ? "Giriş yap" : "Hesap oluştur"}
                  </h2>
                  <p className="text-xs text-slate-400 mt-1">
                    {mode === "login"
                      ? "Kitap, film ve dizi panona erişmek için oturum aç."
                      : "Okuma ve izleme alışkanlıklarını takip etmek için saniyeler içinde kayıt ol."}
                  </p>
                </div>
              </div>

              {/* login / register toggle */}
              <div className="inline-flex rounded-full bg-slate-900 px-1 py-1 text-[11px] font-semibold mb-5 w-full border border-slate-800">
                <button
                  type="button"
                  onClick={() => setMode("login")}
                  className={`flex-1 px-3 py-1.5 rounded-full transition ${
                    mode === "login"
                      ? "bg-slate-800 text-slate-50 shadow-sm shadow-slate-950"
                      : "text-slate-500"
                  }`}
                >
                  Giriş yap
                </button>
                <button
                  type="button"
                  onClick={() => setMode("register")}
                  className={`flex-1 px-3 py-1.5 rounded-full transition ${
                    mode === "register"
                      ? "bg-slate-800 text-slate-50 shadow-sm shadow-slate-950"
                      : "text-slate-500"
                  }`}
                >
                  Kayıt ol
                </button>
              </div>

              {/* Google butonu */}
              <button
                type="button"
                onClick={handleGoogle}
                disabled={submitting}
                className="w-full inline-flex items-center justify-center gap-2 rounded-xl border border-slate-700 bg-slate-900 text-xs sm:text-sm font-semibold px-4 py-2.5 hover:bg-slate-800 transition disabled:opacity-60 mb-4"
              >
                <Chrome className="w-4 h-4 text-slate-200" />
                <span>Google ile devam et</span>
              </button>

              {/* separator */}
              <div className="flex items-center gap-3 mb-4">
                <div className="flex-1 h-px bg-slate-800" />
                <span className="text-[11px] text-slate-500">
                  veya e-posta ile
                </span>
                <div className="flex-1 h-px bg-slate-800" />
              </div>

              {/* form */}
              <form onSubmit={handleEmailSubmit} className="space-y-3">
                {mode === "register" && (
                  <div>
                    <label className="block text-[11px] font-medium text-slate-400 mb-1">
                      Ad Soyad
                    </label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500">
                        <User className="w-4 h-4" />
                      </span>
                      <input
                        type="text"
                        value={fullName}
                        onChange={(e) => setFullName(e.target.value)}
                        className="w-full rounded-xl border border-slate-700 bg-slate-950/60 pl-9 pr-3 py-2 text-sm text-slate-50 placeholder:text-slate-500 outline-none focus:ring-2 focus:ring-primary/60 focus:border-primary/70"
                        placeholder="Adın ve soyadın"
                      />
                    </div>
                  </div>
                )}

                <div>
                  <label className="block text-[11px] font-medium text-slate-400 mb-1">
                    E-posta adresi
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500">
                      <Mail className="w-4 h-4" />
                    </span>
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full rounded-xl border border-slate-700 bg-slate-950/60 pl-9 pr-3 py-2 text-sm text-slate-50 placeholder:text-slate-500 outline-none focus:ring-2 focus:ring-primary/60 focus:border-primary/70"
                      placeholder="ornek@mail.com"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-medium text-slate-400 mb-1">
                    Şifre
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500">
                      <Lock className="w-4 h-4" />
                    </span>
                    <input
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="w-full rounded-xl border border-slate-700 bg-slate-950/60 pl-9 pr-3 py-2 text-sm text-slate-50 placeholder:text-slate-500 outline-none focus:ring-2 focus:ring-primary/60 focus:border-primary/70"
                      placeholder="••••••••"
                    />
                  </div>
                </div>

                {mode === "register" && (
                  <div>
                    <label className="block text-[11px] font-medium text-slate-400 mb-1">
                      Şifre (tekrar)
                    </label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500">
                        <Lock className="w-4 h-4" />
                      </span>
                      <input
                        type="password"
                        value={password2}
                        onChange={(e) => setPassword2(e.target.value)}
                        className="w-full rounded-xl border border-slate-700 bg-slate-950/60 pl-9 pr-3 py-2 text-sm text-slate-50 placeholder:text-slate-500 outline-none focus:ring-2 focus:ring-primary/60 focus:border-primary/70"
                        placeholder="••••••••"
                      />
                    </div>
                  </div>
                )}

                {error && (
                  <div className="text-[11px] text-red-400 bg-red-950/40 border border-red-900/70 rounded-xl px-3 py-2 flex items-start gap-2">
                    <span className="mt-[2px]">⚠️</span>
                    <span>{error}</span>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-primary text-white text-xs sm:text-sm font-semibold px-4 py-2.5 shadow-[0_10px_30px_rgba(248,117,33,0.55)] hover:brightness-110 transition disabled:opacity-60 mt-1"
                >
                  {mode === "login" ? (
                    <>
                      <LogIn className="w-4 h-4" />
                      <span>Giriş yap</span>
                    </>
                  ) : (
                    <>
                      <UserPlus className="w-4 h-4" />
                      <span>Kayıt ol</span>
                    </>
                  )}
                </button>

                <p className="text-[10px] text-slate-500 mt-2 text-center">
                  Devam ederek{" "}
                  <span className="underline underline-offset-2">
                    kullanım koşullarını
                  </span>{" "}
                  kabul etmiş olursun.
                </p>
              </form>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
