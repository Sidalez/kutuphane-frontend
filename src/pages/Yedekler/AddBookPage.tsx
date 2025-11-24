import {
  FormEvent,
  useState,
  KeyboardEvent,
  useEffect,
} from "react";
import { useAuth } from "../auth/AuthContext";
import { db } from "../firebase/firebase";
import {
  addDoc,
  collection,
  serverTimestamp,
} from "firebase/firestore";
import { useNavigate } from "react-router-dom";
import {
  BookOpen,
  Loader2,
  Search,
  Image as ImageIcon,
  Star,
  Plus,
  X,
} from "lucide-react";
import type { BookStatus } from "../types/book";

const STATUS_OPTIONS: { value: BookStatus; label: string }[] = [
  { value: "OKUNACAK", label: "Okunacak" },
  { value: "OKUNUYOR", label: "Okunuyor" },
  { value: "OKUNDU", label: "Okundu" },
];

type StarRatingProps = {
  label: string;
  value: number;
  onChange: (v: number) => void;
  helper?: string;
};

function StarRating({ label, value, onChange, helper }: StarRatingProps) {
  return (
    <div>
      <label className="block text-[11px] font-medium text-slate-500 dark:text-slate-400 mb-1">
        {label}
      </label>
      <div className="flex items-center gap-1">
        {[1, 2, 3, 4, 5].map((v) => (
          <button
            key={v}
            type="button"
            onClick={() => onChange(v)}
            className="p-0.5"
          >
            <Star
              className="w-5 h-5"
              fill={v <= value ? "#f97316" : "none"}
              stroke={v <= value ? "#ea580c" : "#64748b"}
            />
          </button>
        ))}
      </div>
      <p className="text-[11px] text-slate-400 mt-1">
        <span className="font-medium">
          {value > 0 ? `${value}/5` : "Henüz puan verilmedi"}
        </span>
        {helper && <> • {helper}</>}
      </p>
    </div>
  );
}

/* -------------------- ORTAK TIPLER -------------------- */

type NormalizedBookData = {
  found: boolean;
  title?: string;
  author?: string;
  publisher?: string;
  pageCount?: number;
  publishedDate?: string;
  description?: string;
  coverImageUrl?: string;
  message?: string;
};

/* -------------------- AI TABANLI ISBN ARAMA (OpenAI + Web Search) -------------------- */

async function fetchBookFromAI(isbn: string): Promise<NormalizedBookData> {
  try {
    const res = await fetch("http://localhost:3001/api/books/ai", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ isbn }),
    });

    const json = await res.json();

    if (!res.ok) {
      console.error("Backend hata:", json);
      return {
        found: false,
        message:
          json?.message || `Backend hata: ${res.status}`,
      };
    }

    // backend zaten NormalizedBookData formatında dönüyor
    return {
      found: !!json.found,
      title: json.title || undefined,
      author: json.author || undefined,
      publisher: json.publisher || undefined,
      pageCount: json.pageCount ?? undefined,
      publishedDate: json.publishedDate || undefined,
      description: json.description || undefined,
      coverImageUrl: json.coverImageUrl || undefined,
      message: json.message,
    };
  } catch (err) {
    console.error("fetchBookFromAI hata:", err);
    return {
      found: false,
      message: "Backend'e bağlanırken hata oluştu.",
    };
  }
}



/* -------------------- COMPONENT -------------------- */

export default function AddBookPage() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [isbn, setIsbn] = useState("");
  const [isbnLoading, setIsbnLoading] = useState(false);
  const [isbnMessage, setIsbnMessage] = useState<string | null>(null);

  const [title, setTitle] = useState("");
  const [author, setAuthor] = useState("");
  const [publisher, setPublisher] = useState("");
  const [totalPages, setTotalPages] = useState<number | "">("");
  const [coverImageUrl, setCoverImageUrl] = useState("");

  const [publishedDate, setPublishedDate] = useState("");
  const [description, setDescription] = useState("");

  const [status, setStatus] = useState<BookStatus>("OKUNACAK");
  const [pagesRead, setPagesRead] = useState<number | "">("");

  const [expectedRating, setExpectedRating] = useState(0);
  const [progressRating, setProgressRating] = useState(0);
  const [finalRating, setFinalRating] = useState(0);

  const [categories, setCategories] = useState<string[]>([]);
  const [categoriesInput, setCategoriesInput] = useState("");
  const [shelfInput, setShelfInput] = useState("");
  const [shelf, setShelf] = useState<string>("");

  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [notes, setNotes] = useState("");
  const [review, setReview] = useState("");

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!user) {
    return (
      <div className="max-w-xl mx-auto mt-10 rounded-2xl border border-amber-200/60 bg-amber-50/80 dark:border-amber-900/60 dark:bg-amber-950/40 px-4 py-6">
        <h1 className="text-lg font-semibold text-amber-900 dark:text-amber-100 mb-1">
          Giriş gerekli
        </h1>
        <p className="text-sm text-amber-800/90 dark:text-amber-100/90">
          Kitap eklemek için önce giriş yapmalısın.
        </p>
      </div>
    );
  }

  /* ------------ ISBN ARAMA (AI + Web Search) ------------ */

 const handleSearchISBN = async () => {
  if (!isbn.trim()) {
    setIsbnMessage("Lütfen bir ISBN numarası gir.");
    return;
  }

  setIsbnLoading(true);
  setIsbnMessage("Yapay zeka ile kitap bilgisi aranıyor...");

  try {
    const data = await fetchBookFromAI(isbn);
    console.log("AI book data:", data);

    if (!data.found) {
      setIsbnMessage(
        data.message ||
          "Bu ISBN için otomatik veri bulunamadı. Bilgileri manuel girebilirsin."
      );
      return;
    }

    if (data.title) setTitle(data.title);
    if (data.author) setAuthor(data.author);
    if (data.publisher) setPublisher(data.publisher);
    if (typeof data.pageCount === "number") {
      setTotalPages(data.pageCount);
    }
    if (data.coverImageUrl) setCoverImageUrl(data.coverImageUrl);
    if (data.publishedDate) setPublishedDate(data.publishedDate);
    if (data.description) setDescription(data.description);

    setIsbnMessage(
      "Kitap bilgileri yapay zeka ile başarıyla alındı. Formu kontrol edebilirsin."
    );
  } catch (err) {
    console.error("ISBN arama genel hata:", err);
    setIsbnMessage(
      "ISBN bilgisi alınırken bir hata oluştu. Bilgileri manuel girebilirsin."
    );
  } finally {
    setIsbnLoading(false);
  }
};


  useEffect(() => {
    if (status === "OKUNACAK") {
      setPagesRead("");
    } else if (status === "OKUNDU") {
      if (totalPages && typeof totalPages === "number") {
        setPagesRead(totalPages);
      }
    }
  }, [status, totalPages]);

  const addCategory = () => {
    const value = categoriesInput.trim();
    if (!value) return;
    setCategories((prev) => (prev.includes(value) ? prev : [...prev, value]));
    setCategoriesInput("");
  };

  const handleCategoryKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      addCategory();
    }
  };

  const removeCategory = (cat: string) => {
    setCategories((prev) => prev.filter((c) => c !== cat));
  };

  const addShelf = () => {
    const value = shelfInput.trim();
    if (!value) return;
    setShelf(value);
    setShelfInput("");
  };

  const handleShelfKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      addShelf();
    }
  };

  const clearShelf = () => {
    setShelf("");
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!totalPages || totalPages <= 0) {
      alert("Lütfen geçerli bir sayfa sayısı girin.");
      return;
    }

    if (!title.trim()) {
      setError("Kitap adı zorunludur.");
      return;
    }

    if (status === "OKUNUYOR" && !pagesRead) {
      setError("Okunuyor durumundaki kitaplar için okunan sayfa sayısını gir.");
      return;
    }

    if (status === "OKUNDU" && (!finalRating || finalRating < 1)) {
      setError(
        "Okundu durumundaki kitaplar için bitmiş kitaba bir puan vermelisin."
      );
      return;
    }

    setSubmitting(true);
    try {
      let pagesReadToSave = 0;
      if (status === "OKUNUYOR") {
        pagesReadToSave = (pagesRead as number) || 0;
      } else if (status === "OKUNDU") {
        if (typeof totalPages === "number" && totalPages > 0) {
          pagesReadToSave = totalPages;
        } else {
          pagesReadToSave = (pagesRead as number) || 0;
        }
      }

      const ratingsForOverall = [
        expectedRating,
        progressRating,
        finalRating,
      ].filter((v) => v > 0);
      const overallRating =
        status === "OKUNDU" && ratingsForOverall.length > 0
          ? ratingsForOverall.reduce((a, b) => a + b, 0) /
            ratingsForOverall.length
          : null;

      await addDoc(collection(db, "books"), {
        userId: user.uid,
        title: title.trim(),
        author: author.trim() || null,
        publisher: publisher.trim() || null,
        isbn: isbn.trim() || null,
        totalPages: totalPages || null,
        coverImageUrl: coverImageUrl.trim() || null,

        publishedDate: publishedDate || null,
        description: description.trim() || null,

        status,
        pagesRead: pagesReadToSave,
        expectedRating: expectedRating || null,
        progressRating: progressRating || null,
        finalRating: finalRating || null,
        overallRating,
        categories,
        shelf: shelf.trim() || null,
        startDate: startDate || null,
        endDate: endDate || null,
        notes: notes.trim() || null,
        review: review.trim() || null,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      navigate("/library");
    } catch (err: any) {
      console.error("Error adding book:", err);
      let msg = "Kitap eklenirken bir hata oluştu.";
      if (err.code === "permission-denied") {
        msg =
          "Kitap eklemek için Firestore güvenlik kurallarını kontrol etmen gerekiyor (books koleksiyonuna yazma izni).";
      }
      setError(msg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Başlık */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-primary to-orange-500 flex items-center justify-center shadow-sm shadow-orange-500/40">
            <BookOpen className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-900 dark:text-slate-50">
              Yeni kitap ekle
            </h1>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              ISBN ile otomatik doldurabilir veya bilgileri manuel girebilirsin.
            </p>
          </div>
        </div>
      </div>

      {/* ISBN ile arama kutusu */}
      <section className="rounded-2xl border border-orange-200/80 dark:border-orange-900/70 bg-gradient-to-r from-orange-50/90 via-amber-50/90 to-white/90 dark:from-slate-950/90 dark:via-slate-950/80 dark:to-slate-900/90 px-4 py-4 md:px-5 md:py-5 space-y-3">
        <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-50 flex items-center gap-2">
          <span className="inline-flex w-7 h-7 rounded-xl bg-white/80 dark:bg-slate-900/80 items-center justify-center shadow-sm">
            <BookOpen className="w-4 h-4 text-orange-500" />
          </span>
          ISBN ile kitap ara
        </h2>

        <p className="text-xs text-slate-600 dark:text-slate-400">
          Kitap bilgilerini ve kapak resmini otomatik doldurmak için ISBN
          numarasını gir. Yapay zeka destekli web aramasıyla kitabın adını,
          yazarını, yayınevini, sayfa sayısını ve kapak görselini almaya
          çalışır.
        </p>

        <div className="flex flex-col md:flex-row gap-3 items-stretch">
          <div className="flex-1">
            <input
              type="text"
              value={isbn}
              onChange={(e) => setIsbn(e.target.value)}
              placeholder="Örn: 9786050634983"
              className="w-full rounded-xl border border-orange-200 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/40"
            />
          </div>
          <button
            type="button"
            onClick={handleSearchISBN}
            disabled={isbnLoading}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary text-white text-sm font-semibold px-4 py-2 shadow-sm hover:brightness-110 disabled:opacity-60"
          >
            {isbnLoading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Aranıyor...</span>
              </>
            ) : (
              <>
                <Search className="w-4 h-4" />
                <span>Ara</span>
              </>
            )}
          </button>
        </div>

        {isbnMessage && (
          <p className="text-[11px] text-slate-700 dark:text-slate-300">
            {isbnMessage}
          </p>
        )}
      </section>

      {/* FORM */}
      <form
        onSubmit={handleSubmit}
        className="space-y-6 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 px-4 py-5 md:px-6 md:py-6"
      >
        {/* Kitap Bilgileri */}
        <section className="space-y-4">
          <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-50">
            Kitap bilgileri
          </h2>

          <div className="grid md:grid-cols-[220px,1fr] gap-4 items-start">
            {/* Kapak önizleme */}
            <div className="space-y-2">
              <div className="aspect-[3/4] w-full max-w-[220px] rounded-2xl border border-dashed border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 flex items-center justify-center overflow-hidden">
                {coverImageUrl ? (
                  <img
                    src={coverImageUrl}
                    alt={title || "Kapak resmi"}
                    className="w-full h-full object-cover object-center"
                  />
                ) : (
                  <div className="flex flex-col items-center justify-center text-slate-400 text-xs gap-2">
                    <div className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
                      <ImageIcon className="w-5 h-5" />
                    </div>
                    <span>Kapak resmi yok</span>
                  </div>
                )}
              </div>
              <p className="text-[11px] text-slate-400">
                Kapak URL alanına geçerli bir görsel linki girdiğinde burada
                önizleme göreceksin.
              </p>
            </div>

            {/* Sağ taraftaki alanlar */}
            <div className="grid md:grid-cols-2 gap-4">
              <div className="md:col-span-2">
                <label className="block text-[11px] font-medium text-slate-500 dark:text-slate-400 mb-1">
                  Kapak görseli URL
                </label>
                <input
                  type="text"
                  value={coverImageUrl}
                  onChange={(e) => setCoverImageUrl(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/30"
                  placeholder="https://..."
                />
              </div>

              <div className="md:col-span-2">
                <label className="block text-[11px] font-medium text-slate-500 dark:text-slate-400 mb-1">
                  Kitap adı <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/30"
                  placeholder="Kitap adını girin"
                />
              </div>

              <div>
                <label className="block text-[11px] font-medium text-slate-500 dark:text-slate-400 mb-1">
                  Yayınevi
                </label>
                <input
                  type="text"
                  value={publisher}
                  onChange={(e) => setPublisher(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/30"
                  placeholder="Yayınevi"
                />
              </div>

              <div>
                <label className="block text-[11px] font-medium text-slate-500 dark:text-slate-400 mb-1">
                  Yazar
                </label>
                <input
                  type="text"
                  value={author}
                  onChange={(e) => setAuthor(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/30"
                  placeholder="Yazar adı"
                />
              </div>

              <div>
                <label className="block text-[11px] font-medium text-slate-500 dark:text-slate-400 mb-1">
                  ISBN
                </label>
                <input
                  type="text"
                  value={isbn}
                  onChange={(e) => setIsbn(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/30"
                  placeholder="978..."
                />
              </div>

              <div>
                <label className="block text-[11px] font-medium text-slate-500 dark:text-slate-400 mb-1">
                  Sayfa Sayısı <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  min={1}
                  value={totalPages || ""}
                  onChange={(e) => {
                    const v = e.target.value;
                    setTotalPages(v ? Number(v) : "");
                  }}
                  className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/30"
                  placeholder="Örn: 320"
                />
              </div>

              <div>
                <label className="block text-[11px] font-medium text-slate-500 dark:text-slate-400 mb-1">
                  Yayınlanma tarihi
                </label>
                <input
                  type="text"
                  value={publishedDate}
                  onChange={(e) => setPublishedDate(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/30"
                  placeholder="Örn: 2020-08-01 veya 2020"
                />
              </div>
            </div>
          </div>
        </section>

        {/* Okuma durumu & puanlar */}
        <section className="space-y-4">
          <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-50">
            Okuma durumu & puanlar
          </h2>

          <div className="grid md:grid-cols-3 gap-4">
            <div>
              <label className="block text-[11px] font-medium text-slate-500 dark:text-slate-400 mb-1">
                Durum
              </label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as BookStatus)}
                className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/30"
              >
                {STATUS_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>

            {status !== "OKUNACAK" && (
              <div>
                <label className="block text-[11px] font-medium text-slate-500 dark:text-slate-400 mb-1">
                  Okunan sayfa
                </label>
                <input
                  type="number"
                  min={0}
                  value={pagesRead === "" ? "" : pagesRead}
                  onChange={(e) =>
                    setPagesRead(
                      e.target.value ? Number(e.target.value) : ""
                    )
                  }
                  disabled={status === "OKUNDU"}
                  className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/30 disabled:opacity-60"
                  placeholder="0"
                />
                {status === "OKUNDU" && (
                  <p className="text-[11px] text-slate-400 mt-1">
                    Kitap bittiğinde okunan sayfa otomatik olarak toplam sayfa
                    sayısına eşitlenir.
                  </p>
                )}
              </div>
            )}

            <div>
              {status === "OKUNACAK" && (
                <StarRating
                  label="Beklentim"
                  value={expectedRating}
                  onChange={setExpectedRating}
                  helper="Kitaba başlamadan önceki beklentin."
                />
              )}

              {status === "OKUNUYOR" && (
                <StarRating
                  label="Şu anki gidişat"
                  value={progressRating}
                  onChange={setProgressRating}
                  helper="Şu ana kadar okuduklarına göre."
                />
              )}

              {status === "OKUNDU" && (
                <StarRating
                  label="Bitmiş kitaba puanım"
                  value={finalRating}
                  onChange={setFinalRating}
                  helper="Genel değerlendirmen."
                />
              )}
            </div>
          </div>
        </section>

        {/* Kategoriler & tarihler */}
        <section className="space-y-4">
          <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-50">
            Kategoriler & tarihler
          </h2>

          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <label className="block text-[11px] font-medium text-slate-500 dark:text-slate-400 mb-1">
                Kategoriler
              </label>
              <div className="flex items-stretch gap-2">
                <input
                  type="text"
                  value={categoriesInput}
                  onChange={(e) => setCategoriesInput(e.target.value)}
                  onKeyDown={handleCategoryKeyDown}
                  className="flex-1 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/30"
                  placeholder="Kategori ekle (örn: Roman, Bilim-Kurgu)"
                />
                <button
                  type="button"
                  onClick={addCategory}
                  className="w-9 rounded-xl bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 flex items-center justify-center hover:brightness-110"
                >
                  <Plus className="w-4 h-4" />
                </button>
              </div>
              {categories.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-2">
                  {categories.map((cat) => (
                    <span
                      key={cat}
                      className="inline-flex items-center gap-1 rounded-full bg-slate-100 dark:bg-slate-800 text-xs text-slate-700 dark:text-slate-200 px-3 py-1"
                    >
                      {cat}
                      <button
                        type="button"
                        onClick={() => removeCategory(cat)}
                        className="ml-1"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>

            <div>
              <label className="block text-[11px] font-medium text-slate-500 dark:text-slate-400 mb-1">
                Raf
              </label>
              <div className="flex items-stretch gap-2">
                <input
                  type="text"
                  value={shelfInput}
                  onChange={(e) => setShelfInput(e.target.value)}
                  onKeyDown={handleShelfKeyDown}
                  className="flex-1 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/30"
                  placeholder="Örn: Favorilerim, Klasikler"
                />
                <button
                  type="button"
                  onClick={addShelf}
                  className="w-9 rounded-xl bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 flex items-center justify-center hover:brightness-110"
                >
                  <Plus className="w-4 h-4" />
                </button>
              </div>
              {shelf && (
                <div className="flex flex-wrap gap-2 mt-2">
                  <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 dark:bg-slate-800 text-xs text-slate-700 dark:text-slate-200 px-3 py-1">
                    {shelf}
                    <button
                      type="button"
                      onClick={clearShelf}
                      className="ml-1"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                </div>
              )}
            </div>

            <div>
              <label className="block text-[11px] font-medium text-slate-500 dark:text-slate-400 mb-1">
                Başlangıç tarihi
              </label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/30"
              />
            </div>

            {status === "OKUNDU" && (
              <div>
                <label className="block text-[11px] font-medium text-slate-500 dark:text-slate-400 mb-1">
                  Bitiş tarihi
                </label>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/30"
                />
              </div>
            )}
          </div>
        </section>

        {/* Notlar & değerlendirme + Özet */}
        <section className="space-y-4">
          <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-50">
            Notlar & değerlendirme
          </h2>

          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="block text-[11px] font-medium text-slate-500 dark:text-slate-400 mb-1">
                Genel notlar
              </label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={4}
                className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/30"
                placeholder="Kitap hakkındaki genel düşüncelerin..."
              />
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-[11px] font-medium text-slate-500 dark:text-slate-400 mb-1">
                  Özet (otomatik gelebilir)
                </label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={4}
                  className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/30"
                  placeholder="Yapay zekanın getirdiği kısa açıklama. İstersen düzenleyebilirsin."
                />
              </div>

              <div>
                <label className="block text-[11px] font-medium text-slate-500 dark:text-slate-400 mb-1">
                  Değerlendirme / yorum
                </label>
                <textarea
                  value={review}
                  onChange={(e) => setReview(e.target.value)}
                  rows={3}
                  className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/30"
                  placeholder="Spoiler içerebilecek detaylı yorumların..."
                />
              </div>
            </div>
          </div>
        </section>

        {error && (
          <div className="text-[11px] text-red-500 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900 rounded-xl px-3 py-2">
            {error}
          </div>
        )}

        <div className="flex justify-end">
          <button
            type="submit"
            disabled={submitting}
            className="inline-flex items-center gap-2 rounded-xl bg-primary text-white text-sm font-semibold px-4 py-2 shadow-sm hover:brightness-110 disabled:opacity-60"
          >
            {submitting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Kaydediliyor...</span>
              </>
            ) : (
              <span>Kitabı ekle</span>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
