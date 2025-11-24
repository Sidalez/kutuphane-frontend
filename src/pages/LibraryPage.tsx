// src/pages/LibraryPage.tsx

import { useEffect, useMemo, useState } from "react";
import {
  collection,
  onSnapshot,
  query,
  where,
  orderBy,
} from "firebase/firestore";
import { db } from "../firebase/firebase";
import { useAuth } from "../auth/AuthContext";
import type { Book, BookStatus } from "../types/book";
import BookCard from "../components/books/BookCard";
import { Link } from "react-router-dom";
import {
  BookOpen,
  CheckCircle2,
  Filter,
  LibraryBig,
  Loader2,
  Plus,
  Search,
} from "lucide-react";

type StatusFilter = BookStatus | "ALL";

export default function LibraryPage() {
  const { user } = useAuth();
  const [books, setBooks] = useState<Book[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("ALL");
  const [search, setSearch] = useState("");

  // Kullanıcı yoksa güvenlik için hiçbir şey çekme
  useEffect(() => {
    if (!user) {
      setBooks([]);
      setLoading(false);
      return;
    }

    setLoading(true);

    const q = query(
      collection(db, "books"),
      where("userId", "==", user.uid), // 🔐 sadece o kullanıcının kitapları
      orderBy("updatedAt", "desc")
    );

    const unsub = onSnapshot(
      q,
      (snapshot) => {
        const data: Book[] = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...(doc.data() as Omit<Book, "id">),
        }));
        setBooks(data);
        setLoading(false);
      },
      (error) => {
        console.error("Kütüphane verisi okunurken hata:", error);
        setLoading(false);
      }
    );

    return () => unsub();
  }, [user]);

  // Filtrelenmiş / aranmış liste
  const filteredBooks = useMemo(() => {
    let list = [...books];

    if (statusFilter !== "ALL") {
      list = list.filter((b) => b.status === statusFilter);
    }

    if (search.trim()) {
      const q = search.toLocaleLowerCase("tr-TR");
      list = list.filter((b) => {
        const title = (b.title || "").toLocaleLowerCase("tr-TR");
        const author = (b.author || "").toLocaleLowerCase("tr-TR");
        return title.includes(q) || author.includes(q);
      });
    }

    return list;
  }, [books, statusFilter, search]);

  // Özet istatistikler
  const stats = useMemo(() => {
    const total = books.length;
    const completed = books.filter((b) => b.status === "OKUNDU").length;
    const reading = books.filter((b) => b.status === "OKUNUYOR").length;
    const planned = books.filter((b) => b.status === "OKUNACAK").length;

    const totalPages = books.reduce(
      (sum, b) => sum + (b.totalPages || 0),
      0
    );
    const pagesRead = books.reduce(
      (sum, b) => sum + (b.pagesRead || 0),
      0
    );

    return { total, completed, reading, planned, totalPages, pagesRead };
  }, [books]);

  const statusTabs: { key: StatusFilter; label: string }[] = [
    { key: "ALL", label: "Tümü" },
    { key: "OKUNACAK", label: "Okunacak" },
    { key: "OKUNUYOR", label: "Okunuyor" },
    { key: "OKUNDU", label: "Okundu" },
  ];

  if (!user) {
    // App.tsx zaten koruyor ama ekstra güvenlik
    return (
      <div className="max-w-5xl mx-auto py-10">
        <div className="rounded-3xl border border-amber-100/60 dark:border-slate-800 bg-white/80 dark:bg-slate-900/80 p-8 text-center shadow-sm">
          <p className="text-lg font-medium mb-2">
            Kütüphaneni görmek için giriş yapmalısın.
          </p>
          <p className="text-sm text-slate-500 mb-6">
            Oturum açtıktan sonra eklediğin tüm kitaplar burada listelenecek.
          </p>
          <Link
            to="/login"
            className="inline-flex items-center justify-center rounded-full px-4 py-2 text-sm font-medium bg-slate-900 text-slate-50 dark:bg-slate-100 dark:text-slate-900 hover:bg-slate-700 dark:hover:bg-white transition"
          >
            Giriş yap
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* ÜST HEADER */}
      <div
        className="
          rounded-3xl border
          border-amber-100/70 dark:border-slate-800/80
          bg-gradient-to-r
          from-amber-50/95 via-orange-50/90 to-amber-100/95
          dark:from-slate-950 dark:via-slate-900 dark:to-slate-950
          px-6 py-5 shadow-sm
          flex flex-col gap-4 md:flex-row md:items-center md:justify-between
        "
      >
        {/* Sol taraf: başlık */}
        <div className="space-y-2">
          <div className="inline-flex items-center gap-2 rounded-full bg-white/70 dark:bg-slate-900/80 px-3 py-1 text-[11px] font-medium text-amber-800 dark:text-slate-200">
            <BookOpen className="w-4 h-4" />
            <span>Kişisel kütüphanen</span>
            <span className="h-1 w-1 rounded-full bg-amber-400" />
            <span className="text-amber-700/80 dark:text-slate-400">
              {stats.total} kitap
            </span>
          </div>

          <h1 className="mt-2 text-2xl md:text-3xl font-semibold tracking-tight text-slate-900 dark:text-slate-50">
            Merhaba, kitap rafın hazır. 📚
          </h1>

          <p className="text-sm text-slate-600 dark:text-slate-400 max-w-xl">
            Eklediğin kitapları, okuma durumlarını ve ilerlemeni tek bir yerden takip et.
            İster yeni kitap ekle, ister yarım bıraktıklarına geri dön.
          </p>

        {/* Özet kutucuklar (Toplam / Okunacak / Okunuyor / Okundu) */}
<div className="grid grid-cols-1 sm:grid-cols-4 gap-3 mt-3 w-full md:w-auto">

  {/* Toplam kitap */}
  <div className="flex items-center gap-3 rounded-2xl px-4 py-3 bg-slate-100/80 dark:bg-slate-900/80 border border-slate-200/80 dark:border-slate-700/80">
    <div className="inline-flex items-center justify-center w-9 h-9 rounded-xl bg-white dark:bg-slate-800 shadow-sm">
      <LibraryBig className="w-5 h-5 text-amber-700 dark:text-slate-200" />
    </div>
    <div className="flex flex-col">
      <span className="text-[11px] font-semibold tracking-[0.16em] uppercase text-slate-500 dark:text-slate-400">
        Toplam
      </span>
      <span className="text-lg font-bold text-slate-900 dark:text-slate-50">
        {stats.total}
      </span>
    </div>
  </div>

  {/* Okunacak */}
  <div className="flex items-center gap-3 rounded-2xl px-4 py-3 bg-indigo-50/80 dark:bg-indigo-900/20 border border-indigo-200/80 dark:border-indigo-800/80">
    <div className="inline-flex items-center justify-center w-9 h-9 rounded-xl bg-indigo-500/90 dark:bg-indigo-500/80 shadow-sm">
      <BookOpen className="w-5 h-5 text-white" />
    </div>
    <div className="flex flex-col">
      <span className="text-[11px] font-semibold tracking-[0.16em] uppercase text-indigo-700/90 dark:text-indigo-200/90">
        Okunacak
      </span>
      <span className="text-lg font-bold text-indigo-900 dark:text-indigo-100">
        {stats.planned}
      </span>
    </div>
  </div>

  {/* Okunuyor */}
  <div className="flex items-center gap-3 rounded-2xl px-4 py-3 bg-amber-50/80 dark:bg-amber-900/20 border border-amber-200/80 dark:border-amber-800/80">
    <div className="inline-flex items-center justify-center w-9 h-9 rounded-xl bg-amber-500/90 dark:bg-amber-500/80 shadow-sm">
      <BookOpen className="w-5 h-5 text-white" />
    </div>
    <div className="flex flex-col">
      <span className="text-[11px] font-semibold tracking-[0.16em] uppercase text-amber-700/90 dark:text-amber-100/90">
        Okunuyor
      </span>
      <span className="text-lg font-bold text-amber-900 dark:text-amber-50">
        {stats.reading}
      </span>
    </div>
  </div>

  {/* Okundu */}
  <div className="flex items-center gap-3 rounded-2xl px-4 py-3 bg-emerald-50/80 dark:bg-emerald-900/20 border border-emerald-200/80 dark:border-emerald-800/80">
    <div className="inline-flex items-center justify-center w-9 h-9 rounded-xl bg-emerald-500/90 dark:bg-emerald-500/80 shadow-sm">
      <CheckCircle2 className="w-5 h-5 text-white" />
    </div>
    <div className="flex flex-col">
      <span className="text-[11px] font-semibold tracking-[0.16em] uppercase text-emerald-700/80 dark:text-emerald-200/90">
        Okundu
      </span>
      <span className="text-lg font-bold text-emerald-900 dark:text-emerald-100">
        {stats.completed}
      </span>
    </div>
  </div>

</div>

        </div>

        {/* Sağ taraf: küçük özet + buton */}
        <div className="flex flex-col items-end gap-3">
          <div className="flex items-center gap-4 text-[11px] text-slate-500 dark:text-slate-400">
            <div className="flex items-center gap-1">
              <span className="h-2.5 w-2.5 rounded-full bg-emerald-400/80" />
              <span>{stats.completed} okundu</span>
            </div>
            <div className="flex items-center gap-1">
              <span className="h-2.5 w-2.5 rounded-full bg-sky-400/80" />
              <span>{stats.reading} okunuyor</span>
            </div>
          </div>

          <Link
            to="/add-book"
            className="inline-flex items-center justify-center rounded-full px-4 py-2 text-sm font-medium bg-slate-900 text-slate-50 dark:bg-slate-100 dark:text-slate-900 hover:bg-slate-700 dark:hover:bg-white transition gap-2 shadow-sm"
          >
            <Plus className="w-4 h-4" />
            Yeni kitap ekle
          </Link>
        </div>
      </div>

    {/* FİLTRE ÇUBUĞU */}
<div className="rounded-3xl border border-amber-100/70 dark:border-slate-800 bg-white/80 dark:bg-slate-900/80 px-4 py-3 shadow-sm flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
  {/* Durum filtresi */}
  <div className="flex flex-col gap-2">
    <div className="flex items-center gap-2 text-xs font-medium text-slate-500 dark:text-slate-400">
      <div className="inline-flex items-center gap-1 rounded-full bg-slate-100/80 dark:bg-slate-900/90 px-2 py-1">
        <Filter className="w-3 h-3 text-amber-500" />
        <span>Duruma göre filtrele</span>
      </div>
      {statusFilter !== "ALL" && (
        <button
          type="button"
          onClick={() => setStatusFilter("ALL")}
          className="text-[11px] underline underline-offset-2 hover:text-slate-700 dark:hover:text-slate-200"
        >
          sıfırla
        </button>
      )}
    </div>

    <div className="inline-flex items-center gap-1 rounded-full bg-slate-50/80 dark:bg-slate-950/60 p-1 border border-slate-200/80 dark:border-slate-700/80 max-w-full overflow-x-auto">
      {statusTabs.map((tab) => {
        const active = tab.key === statusFilter;
        return (
          <button
            key={tab.key}
            type="button"
            onClick={() => setStatusFilter(tab.key)}
            className={`
              px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition
              ${
                active
                  ? "bg-amber-500 text-white shadow-sm"
                  : "text-slate-500 hover:text-slate-900 dark:text-slate-300 dark:hover:text-slate-50"
              }
            `}
          >
            {tab.label}
          </button>
        );
      })}
    </div>
  </div>

  {/* Arama kutusu */}
  <div className="w-full md:w-72">
    <div className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-1 flex items-center gap-2">
      <Search className="w-3 h-3" />
      <span>Başlık veya yazar ara</span>
      {(search || "").trim().length > 0 && (
        <button
          type="button"
          onClick={() => setSearch("")}
          className="text-[11px] underline underline-offset-2 hover:text-slate-700 dark:hover:text-slate-200"
        >
          temizle
        </button>
      )}
    </div>
    <div className="relative">
      <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
      <input
        type="text"
        placeholder="Örn: Sabahattin Ali, psikoloji..."
        className="w-full rounded-full border border-amber-100/70 dark:border-slate-700 bg-white/90 dark:bg-slate-950/70 pl-9 pr-3 py-1.5 text-sm outline-none focus:ring-2 focus:ring-amber-400/40 dark:focus:ring-slate-100/20 shadow-sm"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />
    </div>
  </div>
</div>


      {/* İÇERİK */}
      {loading ? (
        <div className="flex justify-center py-16">
          <div className="inline-flex items-center gap-2 text-sm text-slate-500">
            <Loader2 className="w-4 h-4 animate-spin" />
            Kütüphanen yükleniyor...
          </div>
        </div>
      ) : filteredBooks.length === 0 ? (
        <div className="mt-6">
          <div className="rounded-3xl border border-dashed border-amber-100/80 dark:border-slate-800 bg-white/80 dark:bg-slate-900/70 p-10 text-center shadow-sm">
            <div className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-amber-100 text-amber-700 dark:bg-slate-800 dark:text-slate-200 mb-4">
              <BookOpen className="w-6 h-6" />
            </div>
            <p className="text-base font-medium mb-1">
              Henüz gösterilecek kitap yok
            </p>
            <p className="text-sm text-slate-500 mb-4">
              Yeni kitap ekleyerek kişisel kütüphaneni oluşturmaya başlayabilirsin.
            </p>
            <Link
              to="/add-book"
              className="inline-flex items-center justify-center rounded-full px-4 py-2 text-sm font-medium bg-slate-900 text-slate-50 dark:bg-slate-100 dark:text-slate-900 hover:bg-slate-700 dark:hover:bg-white transition gap-2"
            >
              <Plus className="w-4 h-4" />
              İlk kitabını ekle
            </Link>
          </div>
        </div>
      ) : (
        <div className="mt-4 grid gap-4 grid-cols-1 md:grid-cols-2 xl:grid-cols-3">
          {filteredBooks.map((book) => (
            <BookCard key={book.id} book={book} />
          ))}
        </div>
      )}
    </div>
  );
}
