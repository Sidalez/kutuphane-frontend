import { Link } from "react-router-dom";
import { ArrowRight, BookOpen } from "lucide-react";
import type { Book } from "../../types/book";

export default function ContinueReading({ books }: { books: Book[] }) {
  // The library query already orders records by updatedAt, newest first.
  const book = books.find(item => item.status === "OKUNUYOR");
  if (!book) return null;
  const read = Math.max(0, book.pagesRead || 0);
  const total = book.totalPages && book.totalPages > 0 ? book.totalPages : null;
  const percent = total ? Math.min(100, Math.round(read / total * 100)) : 0;
  return <section aria-labelledby="continue-reading" className="overflow-hidden rounded-3xl border border-orange-200/70 bg-gradient-to-br from-orange-50 to-amber-50 p-5 dark:border-orange-900/50 dark:from-slate-900 dark:to-slate-900">
    <div className="mb-4 flex items-center gap-2 text-sm font-semibold text-primary"><BookOpen className="h-4 w-4" /><h2 id="continue-reading">Okumaya devam et</h2></div>
    <div className="flex items-start gap-4">{book.coverImageUrl ? <img src={book.coverImageUrl} alt={`${book.title} kapağı`} className="h-28 w-20 shrink-0 rounded-xl object-cover shadow-md" loading="lazy" /> : <div className="flex h-28 w-20 shrink-0 items-center justify-center rounded-xl bg-orange-100 text-primary dark:bg-slate-800"><BookOpen className="h-8 w-8" /></div>}<div className="min-w-0 flex-1"><h3 className="break-words text-lg font-semibold text-slate-900 dark:text-white">{book.title}</h3>{book.author && <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{book.author}</p>}<p className="mb-2 mt-3 text-xs font-medium text-slate-600 dark:text-slate-300">{total ? `${read} / ${total} sayfa · %${percent}` : `${read} sayfa okundu`}</p>{total && <div role="progressbar" aria-label="Okuma ilerlemesi" aria-valuemin={0} aria-valuemax={100} aria-valuenow={percent} className="h-1.5 overflow-hidden rounded-full bg-orange-100 dark:bg-slate-800"><div className="h-full rounded-full bg-primary" style={{width: `${percent}%`}} /></div>}</div></div>
    <Link to={`/library/${book.id}`} className="mt-4 flex min-h-12 items-center justify-center gap-2 rounded-2xl bg-primary px-4 text-sm font-semibold text-white shadow-sm">Kitabı aç ve ilerlemeni güncelle<ArrowRight className="h-4 w-4 shrink-0" /></Link>
  </section>;
}
