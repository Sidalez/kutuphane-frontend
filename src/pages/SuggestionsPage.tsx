// src/pages/SuggestionsPage.tsx
import { useEffect, useMemo, useState } from "react";
import { collection, getDocs, query, where } from "firebase/firestore";
import { db } from "../firebase/firebase";
import { useAuth } from "../auth/AuthContext";
import type { Book } from "../types/book";
import { api } from "../apiClient";
import {
  Sparkles,
  Brain,
  MessageCircle,
  Loader2,
  Target,
  Clock,
  BookOpen,
  Quote,
  AlertTriangle,
  Stars,
  ShoppingBag,
  Dice5,
} from "lucide-react";

type AiTone = "motive" | "calm" | "direct";
type RecommendGoal = "choose_library_book" | "choose_new_book";

interface AiResponse {
  text: string;
}

function diffInDays(start?: string | null, end?: string | null) {
  if (!start || !end) return null;
  const s = new Date(start);
  const e = new Date(end);
  if (isNaN(s.getTime()) || isNaN(e.getTime())) return null;
  const ms = e.getTime() - s.getTime();
  if (ms <= 0) return null;
  return Math.max(1, Math.round(ms / (1000 * 60 * 60 * 24)));
}

export default function SuggestionsPage() {
  const { user } = useAuth();
  const [books, setBooks] = useState<Book[]>([]);
  const [loadingBooks, setLoadingBooks] = useState(true);

  const [goal, setGoal] = useState<RecommendGoal>("choose_library_book");
  const [mood, setMood] = useState("Normal");
  const [availableMinutes, setAvailableMinutes] = useState("30");
  const [preferenceText, setPreferenceText] = useState(
    "Bugün hafif ama ilham verici bir şeyler okumak istiyorum."
  );
  const [tone, setTone] = useState<AiTone>("motive");

  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [aiResult, setAiResult] = useState<string | null>(null);

  const [luckyBook, setLuckyBook] = useState<Book | null>(null);

  // Kitapları çek
  useEffect(() => {
    if (!user) return;

    const fetchBooks = async () => {
      setLoadingBooks(true);
      try {
        const qBooks = query(
          collection(db, "books"),
          where("userId", "==", user.uid)
        );
        const snap = await getDocs(qBooks);
        const data = snap.docs.map(
          (d) => ({ id: d.id, ...d.data() } as Book)
        );
        setBooks(data);
      } catch (err) {
        console.error("Kitaplar çekilirken hata:", err);
      } finally {
        setLoadingBooks(false);
      }
    };

    fetchBooks();
  }, [user]);

  const {
    summary,
    readerProfile,
    rankedCandidates,
    topMustRead,
    secondaryGood,
  } = useMemo(() => {
    const total = books.length;
    const toRead = books.filter((b) => b.status === "OKUNACAK");
    const reading = books.filter((b) => b.status === "OKUNUYOR");
    const done = books.filter((b) => b.status === "OKUNDU");

    const totalPages = books.reduce(
      (sum, b) => sum + (b.totalPages || 0),
      0
    );
    const donePages = done.reduce(
      (sum, b) => sum + (b.totalPages || 0),
      0
    );

    const ratedFinished = done.filter(
      (b) =>
        (b.finalRating ?? null) !== null ||
        (b.overallRating ?? null) !== null
    );
    const avgFinishedRating =
      ratedFinished.length > 0
        ? ratedFinished.reduce(
            (sum, b) =>
              sum + (b.overallRating || b.finalRating || 0),
            0
          ) / ratedFinished.length
        : null;

    const favCategoryCount: Record<string, number> = {};
    ratedFinished.forEach((b) => {
      const score = b.overallRating || b.finalRating || 0;
      if (score >= 4 && Array.isArray(b.categories)) {
        b.categories.forEach((c) => {
          if (!c) return;
          favCategoryCount[c] = (favCategoryCount[c] || 0) + 1;
        });
      }
    });
    const favCategories = Object.entries(favCategoryCount)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([name]) => name);

    const speeds: number[] = [];
    done.forEach((b) => {
      if (!b.totalPages) return;
      const days = diffInDays(b.startDate, b.endDate);
      if (!days) return;
      const spd = b.totalPages / days;
      if (spd > 0 && spd < 1000) speeds.push(spd);
    });
    const avgPagesPerDay =
      speeds.length > 0
        ? Math.round(
            (speeds.reduce((s, x) => s + x, 0) / speeds.length) * 10
          ) / 10
        : null;

    let speedLabel = "Veri yetersiz";
    if (avgPagesPerDay) {
      if (avgPagesPerDay < 10) speedLabel = "Yavaş / keyifli tempo";
      else if (avgPagesPerDay < 30)
        speedLabel = "Orta düzey, dengeli tempo";
      else speedLabel = "Hızlı okur";
    }

    const summaryText = `
Toplam kitap: ${total}
Okunacak: ${toRead.length}
Okunuyor: ${reading.length}
Okundu: ${done.length}
Toplam sayfa: ${totalPages}
Tamamlanan sayfa: ${donePages}
Okunmuş kitap ortalama puanı: ${
      avgFinishedRating ? avgFinishedRating.toFixed(2) : "bilinmiyor"
    }
Tahmini okuma hızı (sayfa/gün): ${
      avgPagesPerDay ?? "bilinmiyor"
    } (${speedLabel})
Favori kategoriler: ${
      favCategories.length > 0 ? favCategories.join(", ") : "henüz net değil"
    }
    `.trim();

    const sampleBooks = books.slice(0, 10).map((b) => {
      const s =
        b.status === "OKUNUYOR"
          ? "Okunuyor"
          : b.status === "OKUNDU"
          ? "Okundu"
          : "Okunacak";
      return `${b.title} - ${
        b.author || "Bilinmiyor"
      } (${s}) • Kategori: ${
        b.categories?.join(", ") || "-"
      } • Puan: ${
        b.overallRating || b.finalRating || b.expectedRating || "-"
      }`;
    });

    const candidates = books.filter(
      (b) => b.status === "OKUNACAK" || b.status === "OKUNUYOR"
    );

    const rankedCandidates = candidates
      .map((b) => {
        let score = 0;

        if (b.status === "OKUNUYOR") score += 8;
        if (b.status === "OKUNACAK") score += 5;

        const rating =
          b.overallRating || b.expectedRating || b.progressRating || 0;
        score += rating * 2;

        let catBoost = 0;
        if (Array.isArray(b.categories) && favCategories.length > 0) {
          b.categories.forEach((c) => {
            if (favCategories.includes(c)) catBoost += 3;
          });
        }
        score += catBoost;

        if (avgPagesPerDay && b.totalPages) {
          const idealMin = avgPagesPerDay * 4;
          const idealMax = avgPagesPerDay * 12;
          if (
            b.totalPages >= idealMin &&
            b.totalPages <= idealMax
          ) {
            score += 4;
          }
        }

        return { book: b, score };
      })
      .sort((a, b) => b.score - a.score);

    const topMustRead = rankedCandidates
      .slice(0, 3)
      .map((x) => x.book);

    const secondaryGood = rankedCandidates
      .slice(3, 6)
      .map((x) => x.book);

    return {
      summary: {
        total,
        toReadCount: toRead.length,
        readingCount: reading.length,
        doneCount: done.length,
        totalPages,
        donePages,
        summaryText,
        sampleBooks,
      },
      readerProfile: {
        avgFinishedRating,
        favCategories,
        avgPagesPerDay,
        speedLabel,
      },
      rankedCandidates,
      topMustRead,
      secondaryGood,
    };
  }, [books]);

const handleGenerate = async () => {
    setAiError(null);
    setAiResult(null);
    setAiLoading(true);

    try {
      const payload = {
        goal,
        mood,
        availableMinutes: Number(availableMinutes) || 0,
        preferenceText,
        tone,
        summary: summary.summaryText,
        sampleBooks: summary.sampleBooks,
        readerProfile,
        candidateBooks: rankedCandidates.map((x) => x.book).map((b) => ({
          id: b.id,
          title: b.title,
          author: b.author,
          isbn: b.isbn || null,
          status: b.status,
          totalPages: b.totalPages || null,
          pagesRead: b.pagesRead || 0,
          expectedRating: b.expectedRating || null,
          progressRating: b.progressRating || null,
          finalRating: b.finalRating || null,
          overallRating: b.overallRating || null,
          categories: b.categories || [],
        })),
      };

      // 🚀 Burayı apiClient ile düzelttik
      const res = await api.post<AiResponse>("/api/ai/recommend", payload);
      const data = res.data;

      setAiResult(data.text || "Herhangi bir öneri üretilemedi.");
    } catch (err: any) {
      console.error(err);
      setAiError(err.message || "Öneriler alınırken bir hata oluştu.");
    } finally {
      setAiLoading(false);
    }
  };

  const handleLuckyPick = () => {
    const pool =
      topMustRead.length > 0
        ? topMustRead
        : rankedCandidates.map((x) => x.book);
    if (pool.length === 0) {
      setLuckyBook(null);
      return;
    }
    const idx = Math.floor(Math.random() * pool.length);
    setLuckyBook(pool[idx]);
  };

  const goalLabel =
    goal === "choose_library_book"
      ? "Kütüphanemden hangi kitaba başlamalıyım?"
      : "Yeni hangi kitabı satın almalıyım?";

  // AI text'i kartlara bölelim
  const aiParagraphs =
    aiResult
      ?.split(/\n\s*\n/)
      .map((p) => p.trim())
      .filter((p) => p.length > 0) || [];

  return (
    <div className="max-w-6xl mx-auto p-4 md:p-8 space-y-6 text-slate-800 dark:text-slate-100">
      {/* HERO */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-amber-400 via-orange-500 to-rose-500 text-white shadow-xl">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(255,255,255,0.18),_transparent_60%)]" />
        <div className="relative p-6 md:p-8 flex flex-col md:flex-row gap-6 md:gap-10 items-start md:items-center">
          <div className="flex-1 space-y-3">
            <div className="inline-flex items-center gap-2 bg-white/15 rounded-full px-3 py-1 text-xs font-semibold backdrop-blur-sm border border-white/30">
              <Sparkles className="w-3 h-3" />
              <span>Yapay Zekâ Destekli Öneriler</span>
            </div>
            <h1 className="text-2xl md:text-3xl font-black flex items-center gap-2">
              <Brain className="w-7 h-7" />
              Okuma Öneri Asistanı
            </h1>
            <p className="text-sm md:text-base text-white/90 max-w-xl">
              Okuduğun kitapları, verdiğin puanları, okuma hızını ve ruh
              halini analiz edip senin için en mantıklı sıradaki kitabı ve
              yeni keşfedilecek kitapları önerir.
            </p>
          </div>
          <div className="w-full md:w-64 bg-white/15 rounded-2xl p-4 backdrop-blur-md border border-white/30">
            <p className="text-xs uppercase tracking-wide text-white/80 font-semibold flex items-center gap-1">
              <Target className="w-3 h-3" />
              Okuma hedef panosu
            </p>
            <div className="mt-3 space-y-1.5 text-xs">
              <div className="flex justify-between">
                <span>Toplam Kitap</span>
                <strong>{summary.total}</strong>
              </div>
              <div className="flex justify-between">
                <span>Okunuyor</span>
                <strong>{summary.readingCount}</strong>
              </div>
              <div className="flex justify-between">
                <span>Okunacak</span>
                <strong>{summary.toReadCount}</strong>
              </div>
              <div className="flex justify-between">
                <span>Okundu</span>
                <strong>{summary.doneCount}</strong>
              </div>
              {readerProfile.avgPagesPerDay && (
                <div className="flex justify-between pt-1 border-t border-white/30 mt-1">
                  <span>Hız (syf/gün)</span>
                  <strong>{readerProfile.avgPagesPerDay}</strong>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ANA GRID */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* SOL: FORM */}
        <div className="lg:col-span-1 space-y-4">
          {/* ÖNERİ TİPİ */}
          <div className="bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-3xl p-5 shadow-sm">
            <p className="text-xs font-bold uppercase text-slate-400 mb-2">
              Öneri tipi
            </p>
            <div className="flex flex-col gap-2">
              <button
                type="button"
                onClick={() => setGoal("choose_library_book")}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-2xl border text-left text-sm transition ${
                  goal === "choose_library_book"
                    ? "border-amber-400 bg-amber-50/80 dark:bg-amber-900/30 text-amber-900 dark:text-amber-100 shadow"
                    : "border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-900"
                }`}
              >
                <BookOpen className="w-4 h-4 flex-shrink-0" />
                <div>
                  <div className="font-semibold">
                    Kütüphanemden başlayacağım kitabı seç
                  </div>
                  <div className="text-[11px] text-slate-500 dark:text-slate-400">
                    Kendi kitapların arasından, sıradaki en mantıklı
                    kitabı belirle.
                  </div>
                </div>
              </button>

              <button
                type="button"
                onClick={() => setGoal("choose_new_book")}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-2xl border text-left text-sm transition ${
                  goal === "choose_new_book"
                    ? "border-emerald-400 bg-emerald-50/80 dark:bg-emerald-900/30 text-emerald-900 dark:text-emerald-100 shadow"
                    : "border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-900"
                }`}
              >
                <ShoppingBag className="w-4 h-4 flex-shrink-0" />
                <div>
                  <div className="font-semibold">
                    Satın alacağım yeni kitabı öner
                  </div>
                  <div className="text-[11px] text-slate-500 dark:text-slate-400">
                    Okuma profilini ve sevdiğin türleri analiz ederek
                    dışarıdan alabileceğin kitaplar öner.
                  </div>
                </div>
              </button>
            </div>
          </div>

          {/* PROFİL FORMU */}
          <div className="bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-3xl p-5 shadow-sm">
            <div className="flex items-center gap-2 mb-3">
              <div className="p-2 rounded-xl bg-slate-100 dark:bg-slate-900">
                <MessageCircle className="w-4 h-4 text-amber-500" />
              </div>
              <div>
                <p className="text-xs font-bold uppercase text-slate-400">
                  Bugünkü Profilin
                </p>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  {goalLabel}
                </p>
              </div>
            </div>

            <div className="mb-4">
              <label className="text-xs font-semibold text-slate-500 dark:text-slate-300">
                Ruh Halin
              </label>
              <select
                value={mood}
                onChange={(e) => setMood(e.target.value)}
                className="w-full mt-1.5 px-3 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-sm focus:ring-2 focus:ring-amber-500/60 outline-none"
              >
                <option>Normal</option>
                <option>Yorgun / Düşük Enerji</option>
                <option>Motivasyon Arıyorum</option>
                <option>Odaklanmış Hissediyorum</option>
                <option>Hafif Bir Şeyler İstiyorum</option>
              </select>
            </div>

            <div className="mb-4">
              <label className="text-xs font-semibold text-slate-500 dark:text-slate-300 flex items-center gap-1">
                <Clock className="w-3 h-3" />
                Bugün okumaya ayırabileceğin süre (dakika)
              </label>
              <input
                type="number"
                min={5}
                max={600}
                value={availableMinutes}
                onChange={(e) => setAvailableMinutes(e.target.value)}
                className="w-full mt-1.5 px-3 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-sm focus:ring-2 focus:ring-amber-500/60 outline-none"
              />
            </div>

            <div className="mb-4">
              <label className="text-xs font-semibold text-slate-500 dark:text-slate-300">
                Öneri stili
              </label>
              <div className="mt-1.5 flex bg-slate-100 dark:bg-slate-900 rounded-xl p-1">
                {[
                  { id: "motive", label: "Motive edici" },
                  { id: "calm", label: "Sakin" },
                  { id: "direct", label: "Net ve kısa" },
                ].map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setTone(t.id as AiTone)}
                    className={`flex-1 py-1.5 text-xs rounded-lg font-semibold transition ${
                      tone === t.id
                        ? "bg-white dark:bg-slate-800 shadow text-amber-600"
                        : "text-slate-500"
                    }`}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-500 dark:text-slate-300">
                Bugün ne tarz bir şeyler okumak / satın almak istiyorsun?
              </label>
              <textarea
                value={preferenceText}
                onChange={(e) => setPreferenceText(e.target.value)}
                rows={4}
                className="w-full mt-1.5 px-3 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-sm focus:ring-2 focus:ring-amber-500/60 outline-none resize-none"
                placeholder={
                  goal === "choose_library_book"
                    ? "Örn: Kütüphanemdeki kitaplardan, ilham verici ama çok da ağır olmayan bir kitaba başlamak istiyorum."
                    : "Örn: Bilimkurgu ve kişisel gelişim seviyorum, yeni bir kitap satın almak istiyorum."
                }
              />
            </div>
          </div>

          {/* BUTONLAR */}
          <div className="bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-3xl p-4 flex flex-col gap-3 shadow-sm">
            <button
              onClick={handleGenerate}
              disabled={aiLoading || loadingBooks}
              className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 font-semibold shadow-lg hover:opacity-90 transition disabled:opacity-60"
            >
              {aiLoading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Sparkles className="w-4 h-4" />
              )}
              Önerileri Oluştur
            </button>

            <button
              onClick={handleLuckyPick}
              disabled={rankedCandidates.length === 0}
              className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-dashed border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-100 text-sm hover:bg-slate-50 dark:hover:bg-slate-900/60 transition disabled:opacity-50"
            >
              <Dice5 className="w-4 h-4 text-amber-500" />
              Kendimi şanslı hissediyorum
            </button>

            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              Yapay zekâ, okuduğun kitapları ve kütüphanendeki adayları
              internette araştırarak hem detaylı bir yorum üretir, hem de
              senin için en mantıklı sıradaki kitabı işaret eder.
            </p>
          </div>
        </div>

        {/* SAĞ: AI CEVAP + KARTLAR */}
        <div className="lg:col-span-2 space-y-4">
          {/* AI CEVAP – DAHA “LUX” TASARIM */}
          <div className="bg-gradient-to-br from-slate-900/90 via-slate-900 to-slate-950 rounded-3xl p-[1px] shadow-xl">
            <div className="bg-white/95 dark:bg-slate-950 rounded-[22px] p-5 md:p-6 flex flex-col h-full">
              <div className="flex items-start justify-between gap-3 mb-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-2xl bg-indigo-100 dark:bg-indigo-900/60">
                    <Quote className="w-4 h-4 text-indigo-600 dark:text-indigo-200" />
                  </div>
                  <div>
                    <p className="text-xs font-bold uppercase text-slate-500 dark:text-slate-400">
                      Yapay Zekâ Yorumu
                    </p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      Okuma geçmişin ve kütüphanen üzerinden üretilen
                      detaylı öneri & yorum paneli.
                    </p>
                  </div>
                </div>

                {/* Mini profil badge kolonu */}
                <div className="hidden md:flex flex-col gap-1 text-[11px] text-slate-500 dark:text-slate-400">
                  <div className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-slate-100 dark:bg-slate-900">
                    <Target className="w-3 h-3" />
                    {goal === "choose_library_book"
                      ? "Kütüphane odaklı"
                      : "Yeni kitap odaklı"}
                  </div>
                  <div className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-slate-100 dark:bg-slate-900">
                    <MessageCircle className="w-3 h-3" />
                    Ruh: {mood}
                  </div>
                  <div className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-slate-100 dark:bg-slate-900">
                    <Clock className="w-3 h-3" />
                    Süre: {availableMinutes || 0} dk
                  </div>
                </div>
              </div>

              {aiError && (
                <div className="flex items-start gap-2 text-xs bg-rose-50 dark:bg-rose-900/20 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300 rounded-2xl px-3 py-2 mb-3">
                  <AlertTriangle className="w-4 h-4 mt-0.5" />
                  <div>
                    <strong className="block mb-0.5">
                      Öneri alınırken bir hata oluştu
                    </strong>
                    <span>{aiError}</span>
                  </div>
                </div>
              )}

              <div className="flex-1 flex flex-col md:flex-row gap-4">
                {/* Sol sütun: küçük profil kartı */}
                <div className="md:w-40 lg:w-48 hidden md:flex flex-col gap-2 text-[11px]">
                  <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/70 p-3 space-y-1.5">
                    <p className="text-[10px] font-semibold text-slate-400 uppercase">
                      Okur Profili Özeti
                    </p>
                    <div className="flex justify-between">
                      <span>Ortalama puan</span>
                      <span className="font-semibold text-amber-500">
                        {readerProfile.avgFinishedRating
                          ? readerProfile.avgFinishedRating.toFixed(1)
                          : "-"}
                        {readerProfile.avgFinishedRating && " ★"}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span>Hız</span>
                      <span className="font-semibold">
                        {readerProfile.avgPagesPerDay
                          ? `${readerProfile.avgPagesPerDay} syf/gün`
                          : "-"}
                      </span>
                    </div>
                    <div className="mt-1 text-[10px] text-slate-500 dark:text-slate-400">
                      {readerProfile.speedLabel}
                    </div>
                    {readerProfile.favCategories.length > 0 && (
                      <div className="pt-1 border-t border-slate-200 dark:border-slate-800 mt-1">
                        <p className="text-[10px] font-semibold mb-1">
                          Öne çıkan türler:
                        </p>
                        <div className="flex flex-wrap gap-1">
                          {readerProfile.favCategories.map((c) => (
                            <span
                              key={c}
                              className="px-1.5 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-[10px]"
                            >
                              {c}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                  <div className="rounded-2xl border border-dashed border-slate-300 dark:border-slate-700 bg-slate-50/70 dark:bg-slate-900/60 p-3 text-[10px] text-slate-500 dark:text-slate-400">
                    <p className="font-semibold mb-1">
                      Ton:{" "}
                      {tone === "motive"
                        ? "Motive edici"
                        : tone === "calm"
                        ? "Sakin"
                        : "Net & kısa"}
                    </p>
                    <p>
                      AI, bu tona göre hem cümle ritmini hem de öneri
                      dilini ayarlıyor.
                    </p>
                  </div>
                </div>

                {/* Sağ sütun: asıl yorumlar */}
                <div className="flex-1">
                  {aiLoading && (
                    <div className="h-full flex flex-col items-center justify-center gap-2 text-sm text-slate-500">
                      <Loader2 className="w-6 h-6 animate-spin text-amber-500" />
                      <p>
                        Öneriler hazırlanıyor, birkaç saniye sürebilir...
                      </p>
                    </div>
                  )}

                  {!aiLoading && aiResult && (
                    <div className="space-y-3">
                      {aiParagraphs.map((para, idx) => (
                        <div
                          key={idx}
                          className="relative rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-900/80 px-3.5 py-3 text-sm text-slate-700 dark:text-slate-100 shadow-sm"
                        >
                          <div className="absolute -left-2 -top-2 w-6 h-6 rounded-full bg-slate-900 dark:bg-slate-100 text-[10px] flex items-center justify-center text-white dark:text-slate-900 font-bold shadow-md">
                            {idx + 1}
                          </div>
                          {para}
                        </div>
                      ))}
                    </div>
                  )}

                  {!aiLoading && !aiResult && !aiError && (
                    <div className="text-sm text-slate-500 dark:text-slate-400 space-y-2">
                      <p>
                        Henüz bir öneri istemedin. Solda{" "}
                        <strong>öneri tipini</strong>,{" "}
                        <strong>ruh halini</strong> ve{" "}
                        <strong>bugünkü süreni</strong> seç, sonra{" "}
                        <strong>“Önerileri Oluştur”</strong> butonuna bas.
                      </p>
                      <p>
                        Asistan; okuduğun kitapları, puanlarını, hızını
                        ve sevdiğin türleri analiz edip senin için hem
                        kütüphanenden hem de dışarıdan mantıklı
                        seçenekler önerir. Aşağıdaki kartlar ise bu
                        önerileri somut kitaplar olarak gösterir.
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* KÜTÜPHANE ÖNERİLERİ – sadece kütüphane modu */}
          {goal === "choose_library_book" && rankedCandidates.length > 0 && (
            <div className="space-y-4">
              {/* Kesinlikle başlaman gerekenler */}
              {topMustRead.length > 0 && (
                <div className="bg-white dark:bg-slate-950 border border-amber-200/60 dark:border-amber-700/60 rounded-3xl p-4 shadow-sm">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <div className="p-2 rounded-xl bg-amber-100 dark:bg-amber-900/40">
                        <Stars className="w-4 h-4 text-amber-600" />
                      </div>
                      <div>
                        <p className="text-xs font-bold uppercase text-amber-700 dark:text-amber-300">
                          Kesinlikle başlaman gerekenler
                        </p>
                        <p className="text-xs text-slate-500 dark:text-slate-400">
                          Okuma profiline göre en yüksek puanı alan
                          kütüphane kitapların.
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    {topMustRead.map((b) => (
                      <div
                        key={b.id}
                        className="flex flex-col gap-2 p-3 rounded-2xl bg-gradient-to-br from-amber-50 to-white dark:from-slate-900 dark:to-slate-950 border border-amber-100/70 dark:border-amber-700/40"
                      >
                        <div className="flex gap-3">
                          <div className="w-14 h-20 rounded-lg overflow-hidden bg-slate-200 flex-shrink-0">
                            {b.coverImageUrl && (
                              <img
                                src={b.coverImageUrl}
                                className="w-full h-full object-cover"
                              />
                            )}
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm font-semibold line-clamp-2">
                              {b.title}
                            </p>
                            <p className="text-xs text-slate-500">
                              {b.author || "Bilinmeyen Yazar"}
                            </p>
                            {b.isbn && (
                              <p className="text-[10px] text-slate-500 mt-0.5">
                                ISBN:{" "}
                                <span className="font-mono">
                                  {b.isbn}
                                </span>
                              </p>
                            )}
                          </div>
                        </div>
                        <div className="flex justify-between items-center text-[11px] text-slate-600 dark:text-slate-300">
                          <span>
                            Durum:{" "}
                            <strong>
                              {b.status === "OKUNUYOR"
                                ? "Okunuyor"
                                : "Okunacak"}
                            </strong>
                          </span>
                          {b.totalPages && (
                            <span>
                              {(b.pagesRead || 0)}/{b.totalPages} sf
                            </span>
                          )}
                        </div>
                        {(b.overallRating ||
                          b.finalRating ||
                          b.expectedRating) && (
                          <div className="text-[11px] text-amber-500">
                            Beklenti / genel puan:{" "}
                            {(
                              b.overallRating ||
                              b.finalRating ||
                              b.expectedRating ||
                              0
                            ).toFixed(1)}{" "}
                            ★
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Diğer güçlü adaylar */}
              {secondaryGood.length > 0 && (
                <div className="bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-3xl p-4 shadow-sm">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <div className="p-2 rounded-xl bg-slate-100 dark:bg-slate-900">
                        <BookOpen className="w-4 h-4 text-slate-700 dark:text-slate-200" />
                      </div>
                      <div>
                        <p className="text-xs font-bold uppercase text-slate-500">
                          Profiline göre diğer güçlü adaylar
                        </p>
                        <p className="text-xs text-slate-500 dark:text-slate-400">
                          Kategori ve hız uyumu iyi olan alternatifler.
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {secondaryGood.map((b) => (
                      <div
                        key={b.id}
                        className="flex gap-3 p-3 rounded-2xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800"
                      >
                        <div className="w-12 h-18 rounded-lg overflow-hidden bg-slate-200 flex-shrink-0">
                          {b.coverImageUrl && (
                            <img
                              src={b.coverImageUrl}
                              className="w-full h-full object-cover"
                            />
                          )}
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-semibold line-clamp-1">
                            {b.title}
                          </p>
                          <p className="text-xs text-slate-500">
                            {b.author || "Bilinmeyen Yazar"}
                          </p>
                          <p className="mt-1 text-[11px] text-slate-500">
                            {b.totalPages && (
                              <>
                                {(b.pagesRead || 0)}/{b.totalPages} sf
                              </>
                            )}{" "}
                            {Array.isArray(b.categories) &&
                              b.categories.length > 0 && (
                                <>
                                  {" "}
                                  • {b.categories.join(", ")}
                                </>
                              )}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ŞANSLI HİSSEDİYORUM KARTI */}
          {luckyBook && (
            <div className="bg-gradient-to-br from-indigo-600 via-purple-600 to-amber-500 text-white rounded-3xl p-4 md:p-5 shadow-xl flex flex-col md:flex-row gap-4 items-center">
              <div className="w-20 h-28 rounded-xl overflow-hidden bg-white/10 flex-shrink-0">
                {luckyBook.coverImageUrl && (
                  <img
                    src={luckyBook.coverImageUrl}
                    className="w-full h-full object-cover"
                  />
                )}
              </div>
              <div className="flex-1 space-y-1">
                <div className="inline-flex items-center gap-2 bg-white/15 rounded-full px-3 py-1 text-[11px] font-semibold">
                  <Dice5 className="w-3 h-3" />
                  Kendimi şanslı hissediyorum
                </div>
                <h3 className="text-lg md:text-xl font-bold">
                  Bugün şansını bu kitapla dene:
                </h3>
                <p className="font-semibold">
                  {luckyBook.title}{" "}
                  <span className="text-sm opacity-90">
                    — {luckyBook.author || "Bilinmeyen Yazar"}
                  </span>
                </p>
                <p className="text-xs opacity-90">
                  Durum:{" "}
                  {luckyBook.status === "OKUNUYOR"
                    ? "Okunuyor, kaldığın yerden devam et."
                    : "Okunacak, yeni bir başlangıç için hazır."}{" "}
                  {luckyBook.totalPages && (
                    <>
                      • {(luckyBook.pagesRead || 0)}/
                      {luckyBook.totalPages} sf
                    </>
                  )}
                </p>
              </div>
            </div>
          )}

          {/* Yeni kitap modu için not */}
          {goal === "choose_new_book" && (
            <div className="bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-3xl p-4 text-xs text-slate-500 dark:text-slate-400">
              Yapay zekâ, yukarıdaki yorumda senin okuduğun kitapları ve
              kütüphaneni internette araştırarak{" "}
              <strong>satın alman için dışarıdan yeni kitaplar</strong>{" "}
              öneriyor. Önerilen kitap adlarını AI cevabı içinden çekip
              istersen ayrıca not alabilir veya harici listene ekleyebilirsin.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
