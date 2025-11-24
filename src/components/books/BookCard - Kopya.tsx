// src/components/books/BookCard.tsx
import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import type { Book } from "../../types/book";
import {
  BookOpen,
  Star,
  Pencil,
  Eye,
} from "lucide-react";

type Props = {
  book: Book;
};

function statusBadge(book: Book) {
  switch (book.status) {
    case "OKUNACAK":
      return {
        label: "Okunacak",
        className:
          "bg-amber-50 text-amber-700 border border-amber-200 dark:bg-amber-900/30 dark:text-amber-200 dark:border-amber-700",
      };
    case "OKUNUYOR":
      return {
        label: "Okunuyor",
        className:
          "bg-sky-50 text-sky-700 border border-sky-200 dark:bg-sky-900/30 dark:text-sky-200 dark:border-sky-700",
      };
    case "OKUNDU":
      return {
        label: "Okundu",
        className:
          "bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-200 dark:border-emerald-700",
      };
    default:
      return {
        label: "Bilinmiyor",
        className:
          "bg-slate-100 text-slate-700 border border-slate-200 dark:bg-slate-800 dark:text-slate-200 dark:border-slate-600",
      };
  }
}

export default function BookCard({ book }: Props) {
  const navigate = useNavigate();

  const badge = statusBadge(book);

  const progress = useMemo(() => {
    const total = book.totalPages || 0;
    const read = book.pagesRead || 0;
    if (!total || !read) return 0;
    return Math.min(100, Math.round((read / total) * 100));
  }, [book.totalPages, book.pagesRead]);

  // Gösterilecek rating: önce overall, yoksa final, yoksa progress, yoksa expected
  const rating = useMemo(() => {
    if (book.overallRating) return book.overallRating;
    if (book.finalRating) return book.finalRating;
    if (book.progressRating) return book.progressRating;
    if (book.expectedRating) return book.expectedRating;
    return null;
  }, [
    book.overallRating,
    book.finalRating,
    book.progressRating,
    book.expectedRating,
  ]);

  const ratingLabel = useMemo(() => {
    if (!rating) return "Henüz puan yok";
    return `${rating.toFixed(1)}/5`;
  }, [rating]);

  const firstCategory =
    Array.isArray(book.categories) && book.categories.length > 0
      ? book.categories[0]
      : null;

  return (
    <div className="group relative rounded-2xl border border-slate-200/80 dark:border-slate-700/80 bg-white/95 dark:bg-slate-900/90 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-200 overflow-hidden">
      {/* Üst kapak */}
      <div className="relative">
        <div className="aspect-[3/4] w-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
          {book.coverImageUrl ? (
            <img
              src={book.coverImageUrl}
              alt={book.title}
              className="w-full h-full object-cover object-center transition-transform duration-300 group-hover:scale-[1.04]"
            />
          ) : (
            <div className="w-full h-full flex flex-col items-center justify-center text-slate-400 text-xs gap-2">
              <div className="w-10 h-10 rounded-xl bg-slate-200 dark:bg-slate-700 flex items-center justify-center">
                <BookOpen className="w-5 h-5" />
              </div>
              <span>Kapak resmi yok</span>
            </div>
          )}
        </div>

        {/* Durum badge'i */}
        <div className="absolute left-3 top-3">
          <span
            className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-medium backdrop-blur-sm ${badge.className}`}
          >
            <span className="w-1.5 h-1.5 rounded-full bg-current opacity-70" />
            {badge.label}
          </span>
        </div>
      </div>

      {/* Alt içerik */}
      <div className="p-3.5 flex flex-col gap-2.5">
        {/* Başlık / yazar */}
        <div className="space-y-1">
          <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-50 line-clamp-2">
            {book.title || "İsimsiz kitap"}
          </h3>
          {book.author && (
            <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-1">
              {book.author}
            </p>
          )}
        </div>

        {/* İlerleme & puan */}
        <div className="space-y-1.5">
          {/* Progress bar sadece sayfa bilgisi varsa */}
          {book.totalPages && (
            <div>
              <div className="flex justify-between items-center text-[11px] text-slate-500 dark:text-slate-400 mb-1">
                <span>İlerleme</span>
                <span>
                  {book.pagesRead || 0}/{book.totalPages} sayfa
                  {progress > 0 && ` • %${progress}`}
                </span>
              </div>
              <div className="h-1.5 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-primary to-orange-500 transition-all"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>
          )}

          {/* Rating */}
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5 text-[11px] text-slate-500 dark:text-slate-400">
              <Star
                className="w-3.5 h-3.5"
                fill={rating ? "#f97316" : "none"}
                stroke={rating ? "#ea580c" : "#64748b"}
              />
              <span className="font-medium text-slate-700 dark:text-slate-200">
                {ratingLabel}
              </span>
            </div>
            {firstCategory && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-[11px] text-slate-600 dark:text-slate-300">
                {firstCategory}
              </span>
            )}
          </div>
        </div>

        {/* Raf & alt bilgi */}
        <div className="flex items-center justify-between text-[11px] text-slate-400 dark:text-slate-500">
          <div className="flex items-center gap-1.5">
            {book.shelf && (
              <>
                <span className="w-1.5 h-1.5 rounded-full bg-primary/80" />
                <span>{book.shelf}</span>
              </>
            )}
          </div>
          {book.isbn && (
            <span className="truncate max-w-[120px]">ISBN: {book.isbn}</span>
          )}
        </div>

        {/* Butonlar */}
        <div className="mt-2 flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={() => navigate(`/books/${book.id}`)}
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 px-2.5 py-1.5 text-[11px] font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            <Eye className="w-3.5 h-3.5" />
            Detay
          </button>
          <button
            type="button"
            onClick={() => navigate(`/books/${book.id}/edit`)}
            className="inline-flex items-center gap-1.5 rounded-xl bg-primary text-[11px] font-medium text-white px-2.5 py-1.5 hover:brightness-110"
          >
            <Pencil className="w-3.5 h-3.5" />
            Düzenle
          </button>
        </div>
      </div>
    </div>
  );
}
