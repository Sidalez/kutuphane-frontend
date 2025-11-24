// src/pages/LibraryPage.tsx
import { useEffect, useMemo, useState } from "react";
import { collection, onSnapshot, query, where, orderBy } from "firebase/firestore";
import { db } from "../firebase/firebase";
import { useAuth } from "../auth/AuthContext";
import type { Book, BookStatus } from "../types/book";
import BookCard from "../components/books/BookCard";
import { Loader2, Search } from "lucide-react";

type StatusFilter = "ALL" | BookStatus;

export default function LibraryPage() {
  const { user } = useAuth();
  const [books, setBooks] = useState<Book[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("ALL");
  const [search, setSearch] = useState("");

useEffect(() => {
  if (!user) {
    setBooks([]);
    setLoading(false);
    return;
  }

  const booksRef = collection(db, "books");
  
  // ✅ Sadece where kullan (orderBy kaldırıldı)
  const q = query(
    booksRef,
    where("userId", "==", user.uid)
  );

  const unsub = onSnapshot(
    q,
    (snapshot) => {
      console.log("📚 Firestore'dan gelen kitap sayısı:", snapshot.docs.length); // Debug
      
      const data: Book[] = snapshot.docs.map((doc) => {
        const raw = doc.data() as any;
        return {
          id: doc.id,
          ...raw,
        } as Book;
      });
      
      // ✅ Client-side'da sıralama yap
      const sorted = data.sort((a, b) => {
        const aTime = a.updatedAt?.toMillis?.() || 0;
        const bTime = b.updatedAt?.toMillis?.() || 0;
        return bTime - aTime; // En yeni üstte
      });
      
      console.log("✅ Sıralanmış kitaplar:", sorted.length); // Debug
      setBooks(sorted);
      setLoading(false);
    },
    (err) => {
      console.error("❌ Firestore hatası:", err);
      setLoading(false);
    }
  );

  return () => unsub();
}, [user]);

  const filteredBooks = useMemo(() => {
    return books.filter((book) => {
      if (statusFilter !== "ALL" && book.status !== statusFilter) return false;

      if (search.trim()) {
        const term = search.toLowerCase();
        const inTitle = book.title?.toLowerCase().includes(term);
        const inAuthor = book.author?.toLowerCase().includes(term);
        return inTitle || inAuthor;
      }

      return true;
    });
  }, [books, statusFilter, search]);

  if (!user) {
    return (
      <div className="max-w-xl mx-auto mt-10 rounded-2xl border border-amber-200/60 bg-amber-50/80 dark:border-amber-900/60 dark:bg-amber-950/40 px-4 py-6">
        <h1 className="text-lg font-semibold text-amber-900 dark:text-amber-100 mb-1">
          Giriş gerekli
        </h1>
        <p className="text-sm text-amber-800/90 dark:text-amber-100/90">
          Kütüphaneni görüntülemek için önce giriş yapmalısın.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Üst başlık */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-slate-50">
            Kütüphanem
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Eklediğin tüm kitaplar burada. Filtreleyebilir, arayabilir ve
            detaylarını görüntüleyebilirsin.
          </p>
        </div>
        {/* Basit özet */}
        <div className="flex flex-wrap gap-2 text-xs text-slate-500 dark:text-slate-400">
          <span className="px-3 py-1 rounded-full bg-slate-100 dark:bg-slate-900/80">
            Toplam:{" "}
            <span className="font-semibold text-slate-800 dark:text-slate-100">
              {books.length}
            </span>
          </span>
          <span className="px-3 py-1 rounded-full bg-emerald-50 dark:bg-emerald-900/40">
            Okundu:{" "}
            <span className="font-semibold text-emerald-700 dark:text-emerald-200">
              {books.filter((b) => b.status === "OKUNDU").length}
            </span>
          </span>
          <span className="px-3 py-1 rounded-full bg-amber-50 dark:bg-amber-900/40">
            Okunuyor:{" "}
            <span className="font-semibold text-amber-700 dark:text-amber-200">
              {books.filter((b) => b.status === "OKUNUYOR").length}
            </span>
          </span>
        </div>
      </div>

      {/* Filtre & arama */}
      <div className="flex flex-col md:flex-row md:items-center gap-3">
        {/* Arama */}
        <div className="flex-1">
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Kitap veya yazar ara..."
              className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 pl-9 pr-3 py-2 text-sm text-slate-900 dark:text-slate-50 outline-none focus:ring-2 focus:ring-primary/40"
            />
          </div>
        </div>

        {/* Durum filtreleri */}
        <div className="flex flex-wrap gap-2">
          {([
            ["ALL", "Tümü"],
            ["OKUNACAK", "Okunacak"],
            ["OKUNUYOR", "Okunuyor"],
            ["OKUNDU", "Okundu"],
          ] as [StatusFilter, string][]).map(([value, label]) => {
            const active = statusFilter === value;
            return (
              <button
                key={value}
                type="button"
                onClick={() => setStatusFilter(value)}
                className={`px-3 py-1.5 rounded-full text-xs font-medium border transition ${
                  active
                    ? "bg-primary text-white border-primary shadow-sm"
                    : "bg-slate-100/80 dark:bg-slate-900/70 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-200/80 dark:hover:bg-slate-800"
                }`}
              >
                {label}
              </button>
            );
          })}
        </div>
      </div>

      {/* İçerik */}
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <div className="inline-flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400">
            <Loader2 className="w-4 h-4 animate-spin" />
            <span>Kitapların yükleniyor...</span>
          </div>
        </div>
      ) : filteredBooks.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Filtrelere uyan kitap bulunamadı.
          </p>
          <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">
            Yeni bir kitap ekleyerek kütüphaneni doldurmaya başlayabilirsin.
          </p>
        </div>
      ) : (
       // LibraryPage.tsx içinde grid'i güncelle:
<div className="grid gap-4 grid-cols-1 lg:grid-cols-2 xl:grid-cols-3">
  {filteredBooks.map((book) => (
    <BookCard key={book.id} book={book} />
  ))}
</div>

      )}
    </div>
  );
}
