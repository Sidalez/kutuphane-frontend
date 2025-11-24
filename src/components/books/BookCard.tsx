// src/components/books/BookCard.tsx

import { useMemo, useState } from "react";
import type { Book } from "../../types/book";
import { useNavigate } from "react-router-dom";
import {
  BookOpen,
  CalendarDays,
  Edit3,
  FileText,
  ChevronRight,
  Bookmark,
  Star,
  X,
} from "lucide-react";

interface BookCardProps {
  book: Book;
}

const statusMeta: Record<
  Book["status"],
  {
    label: string;             // Okunacak / Okunuyor / Okundu
    description: string;       // Alt açıklama
    color: string;             // Açıklama rengi
    progressPillBg: string;    // Durum çubuğu pill arka plan
    progressPillText: string;  // Durum çubuğu pill yazı rengi
    progressState: string;     // Başlamadı / Devam ediyor / Tamamlandı
    mainStatusBg: string;      // Başlığın altındaki durum pill arka plan
    mainStatusText: string;    // Başlığın altındaki durum pill yazı rengi
  }
> = {
  OKUNACAK: {
    label: "Okunacak",
    description: "Bu kitabı listene ekledin, henüz başlamadın.",
    color: "text-slate-600 dark:text-slate-300",
    progressPillBg: "bg-slate-100 dark:bg-slate-800",
    progressPillText: "text-slate-800 dark:text-slate-50",
    progressState: "Başlamadı",
    mainStatusBg: "bg-indigo-50 dark:bg-indigo-900/40",
    mainStatusText: "text-indigo-800 dark:text-indigo-100",
  },
  OKUNUYOR: {
    label: "Okunuyor",
    description: "Okuma sürecin devam ediyor.",
    color: "text-amber-700 dark:text-amber-200",
    progressPillBg: "bg-amber-100/90 dark:bg-amber-900/60",
    progressPillText: "text-amber-900 dark:text-amber-50",
    progressState: "Devam ediyor",
    mainStatusBg: "bg-amber-50 dark:bg-amber-900/40",
    mainStatusText: "text-amber-800 dark:text-amber-50",
  },
  OKUNDU: {
    label: "Okundu",
    description: "Bu kitabı tamamladın.",
    color: "text-emerald-700 dark:text-emerald-200",
    progressPillBg: "bg-emerald-100/90 dark:bg-emerald-900/60",
    progressPillText: "text-emerald-900 dark:text-emerald-50",
    progressState: "Tamamlandı",
    mainStatusBg: "bg-emerald-50 dark:bg-emerald-900/40",
    mainStatusText: "text-emerald-800 dark:text-emerald-50",
  },
};

export default function BookCard({ book }: BookCardProps) {
  const navigate = useNavigate();
  const [showImage, setShowImage] = useState(false);

  // ---- RATING (expected / progress / final / overall) ----
  const {
    primaryRating,
    primaryLabel,
    primaryEmptyText,
    overallText,
    aiRating,
  } = useMemo(() => {
    const clamp = (val: number | null | undefined) => {
      if (val === null || val === undefined) return null;
      const v = Math.max(0, Math.min(5, val));
      return Number.isFinite(v) ? v : null;
    };

    const expected = clamp(book.expectedRating ?? null);
    const progress = clamp(book.progressRating ?? null);
    const final = clamp(book.finalRating ?? null);
    const overall = clamp(book.overallRating ?? null);

    // OKUNDU → bitmiş kitap
    if (book.status === "OKUNDU") {
      return {
        primaryRating: final ?? overall,
        primaryLabel: "Puanım",
        primaryEmptyText: "Bu kitap için henüz puan vermedin",
        overallText: overall ? `Genel ortalama: ${overall.toFixed(1)} / 5` : null,
        aiRating: overall, // yapay zeka puanı
      };
    }

    // OKUNUYOR
    if (book.status === "OKUNUYOR") {
      return {
        primaryRating: progress,
        primaryLabel: "Gidişat",
        primaryEmptyText: "Gidişat puanı eklenmedi",
        overallText: overall ? `Genel beklenti: ${overall.toFixed(1)} / 5` : null,
        aiRating: overall,
      };
    }

    // OKUNACAK
    return {
      primaryRating: expected,
      primaryLabel: "Beklentim",
      primaryEmptyText: "Bu kitap için beklenti puanın yok",
      overallText: overall ? `Genel: ${overall.toFixed(1)} / 5` : null,
      aiRating: overall,
    };
  }, [
    book.status,
    book.expectedRating,
    book.progressRating,
    book.finalRating,
    book.overallRating,
  ]);

  // ---- PROGRESS / SAYFA ----
  const progress = useMemo(() => {
    if (!book.totalPages || !book.pagesRead) return 0;
    const value = Math.round((book.pagesRead / book.totalPages) * 100);
    return Math.min(100, Math.max(0, value));
  }, [book.totalPages, book.pagesRead]);

  const pagesLeft = useMemo(() => {
    if (!book.totalPages || !book.pagesRead) return null;
    return Math.max(0, book.totalPages - book.pagesRead);
  }, [book.totalPages, book.pagesRead]);

  const startDateLabel = useMemo(() => {
    if (!book.startDate) return null;
    const d = new Date(book.startDate);
    if (isNaN(d.getTime())) return null;
    return d.toLocaleDateString("tr-TR", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  }, [book.startDate]);

  const meta = statusMeta[book.status];

  return (
    <>
      {/* Kart */}
      <div
        className="
          group relative flex flex-col overflow-hidden
          rounded-3xl
          border border-slate-200/90 dark:border-slate-700
          bg-white dark:bg-slate-900
          shadow-[0_12px_40px_rgba(15,23,42,0.12)]
          dark:shadow-[0_20px_60px_rgba(0,0,0,0.7)]
          transition-transform duration-200
          hover:-translate-y-[3px]
        "
      >
        {/* Sol renk aksanı */}
        <div className="absolute inset-y-4 left-0 w-[3px] rounded-r-full bg-gradient-to-b from-amber-400 via-amber-500 to-emerald-500 opacity-90" />

        <div className="p-4 pl-5 flex gap-4">
          {/* Kapak alanı */}
          <div className="w-28 shrink-0 flex flex-col">
            <button
              type="button"
              onClick={() => book.coverImageUrl && setShowImage(true)}
              className="
                relative
                aspect-[3/4]
                overflow-hidden rounded-2xl
                bg-slate-100 dark:bg-slate-950
                border border-slate-200/90 dark:border-slate-700
                flex items-center justify-center
                shadow-sm
                transition-transform duration-200
                group-hover:scale-[1.02]
              "
            >
              {book.coverImageUrl ? (
                <img
                  src={book.coverImageUrl}
                  alt={book.title || "Kitap kapağı"}
                  className="h-full w-full object-cover"
                  loading="lazy"
                />
              ) : (
                <BookOpen className="w-7 h-7 text-slate-400" />
              )}

              {/* ISBN alt bandı */}
              {book.isbn && (
                <div
                  className="
                    absolute bottom-0 inset-x-0
                    bg-gradient-to-t from-black/70 via-black/40 to-transparent
                    px-2.5 pb-2 pt-4
                    text-[10px] text-slate-100
                  "
                >
                  <div className="tracking-[0.18em] uppercase opacity-80">
                    ISBN
                  </div>
                  <div className="font-mono text-[11px] font-medium">
                    {book.isbn}
                  </div>
                </div>
              )}
            </button>
          </div>

          {/* Sağ taraf: içerik */}
          <div className="flex flex-1 flex-col gap-2 min-w-0">
            {/* Üst satır: başlık + durum + rating */}
            <div className="flex items-start justify-between gap-3">
              {/* Başlık + yazar + yayın bilgisi + durum pill */}
              <div className="min-w-0 flex-1 flex flex-col gap-1">
                {/* Başlık */}
                <h2 className="text-[15px] md:text-[16px] font-semibold text-slate-900 dark:text-slate-50 leading-snug break-words">
                  {book.title || "İsimsiz kitap"}
                </h2>

                {/* Yazar */}
                {book.author && (
                  <p className="text-xs font-medium text-slate-600 dark:text-slate-300">
                    {book.author}
                  </p>
                )}

                {/* Yayın yılı + yayın evi */}
                {(book.publishYear || book.publisher) && (
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    {book.publishYear && (
                      <span className="font-medium">{book.publishYear}</span>
                    )}
                    {book.publishYear && book.publisher && <span> · </span>}
                    {book.publisher && <span>{book.publisher}</span>}
                  </p>
                )}

                {/* Durum pill: Okunacak / Okunuyor / Okundu – RENKLİ */}
                <span
                  className={`
                    inline-flex items-center gap-1.5 rounded-full px-2.5 py-1
                    mt-1
                    text-[11px] font-semibold
                    ${meta.mainStatusBg} ${meta.mainStatusText}
                  `}
                >
                  <span className="h-1.5 w-1.5 rounded-full bg-current" />
                  {meta.label}
                </span>
              </div>

              {/* Rating alanı – sade: tek yıldız + X / 5 */}
              <div className="flex flex-col items-end gap-0.5 min-w-[92px]">
                {primaryRating !== null ? (
                  <>
                    <div className="inline-flex items-center gap-1.5">
                      <Star className="w-4 h-4 fill-amber-400 text-amber-400" />
                      <span className="text-[11px] font-semibold text-slate-800 dark:text-slate-50">
                        {primaryRating.toFixed(1)} / 5
                      </span>
                    </div>
                    <span className="text-[10px] text-slate-500 dark:text-slate-300">
                      {primaryLabel}
                    </span>

                    {/* Yapay zeka puanı */}
                    {aiRating !== null ? (
                      <span className="text-[10px] text-slate-500 dark:text-slate-400">
                        Yapay zeka: {aiRating.toFixed(1)} / 5
                      </span>
                    ) : (
                      book.status === "OKUNDU" && (
                        <span className="text-[10px] text-slate-500 dark:text-slate-500">
                          Yapay zeka puanı hazırlanıyor
                        </span>
                      )
                    )}

                    {overallText && (
                      <span className="text-[10px] text-slate-400 dark:text-slate-500">
                        {overallText}
                      </span>
                    )}
                  </>
                ) : (
                  <span className="text-[10px] text-slate-400 dark:text-slate-500 text-right">
                    {primaryEmptyText}
                  </span>
                )}
              </div>
            </div>

            {/* Meta bilgiler: sayfa + tarih + kalan sayfa */}
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-slate-500 dark:text-slate-400">
              {book.totalPages && (
                <span className="inline-flex items-center gap-1.5">
                  <Bookmark className="w-3 h-3" />
                  <span className="font-semibold text-slate-700 dark:text-slate-100">
                    {book.totalPages} s.
                  </span>
                  {book.pagesRead ? (
                    <span className="text-slate-500 dark:text-slate-400">
                      · {book.pagesRead} s. okundu ({progress}%)
                    </span>
                  ) : null}
                </span>
              )}

              {startDateLabel && (
                <span className="inline-flex items-center gap-1.5">
                  <CalendarDays className="w-3 h-3" />
                  <span>Başlangıç: {startDateLabel}</span>
                </span>
              )}

              {pagesLeft !== null && pagesLeft > 0 && (
                <span className="inline-flex items-center gap-1.5">
                  <span className="h-1.5 w-1.5 rounded-full bg-slate-300 dark:bg-slate-500" />
                  <span>{pagesLeft} sayfa kaldı</span>
                </span>
              )}
            </div>

            {/* Açıklama / notlar */}
            {(book.description || book.notes) && (
              <div className="mt-1">
                <div className="flex items-center gap-1 text-[11px] text-slate-400 dark:text-slate-500">
                  <FileText className="w-3 h-3" />
                  <span>Özet / Not</span>
                </div>
                <p className="mt-0.5 text-xs text-slate-600 dark:text-slate-300">
                  {book.notes || book.description}
                </p>
              </div>
            )}

            {/* Durum açıklaması */}
            <p className={`mt-1 text-[11px] font-semibold ${meta.color}`}>
              {meta.description}
            </p>
          </div>
        </div>

        {/* İlerleme ve DURUM ÇUBUĞU */}
        {book.totalPages && (
          <div className="px-4 pb-3">
            <div className="flex items-center justify-between mb-1.5">
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-semibold text-slate-800 dark:text-slate-50">
                  Okuma durumu
                </span>
                <span
                  className={`
                    inline-flex items-center gap-1 rounded-full px-2.5 py-0.5
                    text-[11px] font-semibold
                    ${meta.progressPillBg} ${meta.progressPillText}
                  `}
                >
                  <span className="h-1.5 w-1.5 rounded-full bg-current" />
                  {meta.progressState}
                </span>
              </div>

              <span className="text-[11px] font-semibold text-slate-800 dark:text-slate-50">
                {progress}% tamamlandı
              </span>
            </div>

            <div className="h-1.5 w-full rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
              <div
                className={`
                  h-full rounded-full transition-all duration-300
                  ${
                    book.status === "OKUNDU"
                      ? "bg-gradient-to-r from-emerald-400 to-emerald-500"
                      : book.status === "OKUNUYOR"
                      ? "bg-gradient-to-r from-amber-400 to-amber-500"
                      : "bg-gradient-to-r from-slate-300 to-slate-500"
                  }
                `}
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        )}

        {/* Alt aksiyon barı */}
        <div className="border-t border-slate-100 dark:border-slate-800 px-3 py-2.5 flex items-center justify-between bg-slate-50/95 dark:bg-slate-950/95">
          <button
            type="button"
            onClick={() => navigate(`/library/${book.id}`)}
            className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-900 transition"
          >
            <ChevronRight className="w-3 h-3" />
            <span>Kitap ile ilgili işlemler</span>
          </button>

          <button
            type="button"
            onClick={() => navigate(`/edit/${book.id}`)}
            className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-900 transition"
          >
            <Edit3 className="w-3 h-3" />
            Düzenle
          </button>
        </div>
      </div>

      {/* 📸 Kapak büyütme: modal */}
      {showImage && book.coverImageUrl && (
        <div
          className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4"
          onClick={() => setShowImage(false)}
        >
          <div
            className="relative max-w-md w-full"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => setShowImage(false)}
              className="absolute -top-3 -right-3 rounded-full bg-black/80 text-white p-1 shadow-lg"
            >
              <X className="w-4 h-4" />
            </button>
            <img
              src={book.coverImageUrl}
              alt={book.title || "Kitap kapağı"}
              className="w-full rounded-2xl shadow-2xl"
            />
          </div>
        </div>
      )}
    </>
  );
}
