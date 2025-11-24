// src/pages/AddBookPage.tsx
import {
  FormEvent,
  KeyboardEvent,
  useState,
  type Dispatch,
  type SetStateAction,
} from "react";
import { useNavigate } from "react-router-dom";
import {
  BookOpen,
  Loader2,
  Sparkles,
  AlertCircle,
  CalendarDays,
  Star,
  Plus,
  X,
} from "lucide-react";
import { addDoc, collection, serverTimestamp } from "firebase/firestore";
import { db } from "../firebase/firebase";
import { useAuth } from "../auth/AuthContext";
import type { BookStatus } from "../types/book";
import { api } from "../apiClient";
interface AIBookResponse {
  found: boolean;
  message?: string;
  title?: string;
  author?: string;
  publisher?: string;
  pageCount?: number;
  publishedDate?: string;
  description?: string;
  coverImageUrl?: string | null;
}

const toTitleCase = (value: string) =>
  value
    .split(" ")
    .filter(Boolean)
    .map(
      (word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
    )
    .join(" ");

function StarRating({
  value,
  onChange,
}: {
  value?: number;
  onChange: (value: number) => void;
}) {
  return (
    <div className="flex items-center gap-1">
      {[1, 2, 3, 4, 5].map((n) => {
        const active = value && value >= n;
        return (
          <button
            key={n}
            type="button"
            onClick={() => onChange(n)}
            className="p-0.5"
          >
            <Star
              className={`w-4 h-4 transition ${
                active
                  ? "fill-yellow-400 text-yellow-400"
                  : "text-slate-300 dark:text-slate-600"
              }`}
            />
          </button>
        );
      })}
      {value && (
        <span className="ml-2 text-xs text-slate-500 dark:text-slate-400">
          {value}/5
        </span>
      )}
    </div>
  );
}

export default function AddBookPage() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [isbn, setIsbn] = useState("");
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [searchInfo, setSearchInfo] = useState<string | null>(null);

  const [title, setTitle] = useState("");
  const [author, setAuthor] = useState("");
  const [publisher, setPublisher] = useState("");
  const [publishedDate, setPublishedDate] = useState("");
  const [description, setDescription] = useState("");
  const [coverImageUrl, setCoverImageUrl] = useState("");

  const [status, setStatus] = useState<BookStatus>("OKUNACAK");
  const [totalPages, setTotalPages] = useState<number | undefined>();
  const [pagesRead, setPagesRead] = useState<number | undefined>();

  const [shelf, setShelf] = useState("");
  const [shelfInput, setShelfInput] = useState("");

  const [categories, setCategories] = useState<string[]>([]);
  const [categoryInput, setCategoryInput] = useState("");

  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  const [notes, setNotes] = useState("");

  const [expectedRating, setExpectedRating] = useState<number | undefined>();
  const [progressRating, setProgressRating] = useState<number | undefined>();
  const [finalRating, setFinalRating] = useState<number | undefined>();

  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  if (!user) {
    return (
      <div className="max-w-xl mx-auto mt-10 rounded-2xl border border-amber-200/80 bg-amber-50/80 dark:border-amber-900/60 dark:bg-amber-950/40 px-4 py-6">
        <h1 className="text-lg font-semibold text-amber-900 dark:text-amber-100 mb-1">
          Giriş gerekli
        </h1>
        <p className="text-sm text-amber-800/90 dark:text-amber-100/90">
          Kitap eklemek için önce giriş yapmalısın.
        </p>
      </div>
    );
  }

  const handleIsbnKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      void handleIsbnSearch();
    }
  };

  const handleIsbnSearch = async () => {
    const trimmed = isbn.trim();

    if (!trimmed) {
      setSearchError("Lütfen bir ISBN gir.");
      return;
    }

    setSearchError(null);
    setSearchInfo(null);
    setSearching(true);

try {
  const res = await fetch(`${import.meta.env.VITE_API_URL}/api/books/ai`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ isbn: trimmed }),
  });


      const data: AIBookResponse = await res.json();

      if (!res.ok || !data.found) {
        setSearchError(
          data.message ||
            "Bu ISBN için otomatik veri bulunamadı. Bilgileri manuel girebilirsin."
        );
        return;
      }

      setSearchInfo(
        "Kitap bilgileri yapay zekâ ile dolduruldu. Gerekirse alanları düzenleyebilirsin."
      );

      if (data.title) setTitle(data.title);
      if (data.author) setAuthor(data.author);
      if (data.publisher) setPublisher(data.publisher);
      if (data.publishedDate) setPublishedDate(data.publishedDate);
      if (typeof data.pageCount === "number" && !Number.isNaN(data.pageCount)) {
        setTotalPages(data.pageCount);
      }
      if (data.description) setDescription(data.description);
      if (data.coverImageUrl) setCoverImageUrl(data.coverImageUrl);
    } catch (err) {
      console.error("AI ISBN arama hatası:", err);
      setSearchError(
        "Bir hata oluştu. Daha sonra tekrar dene veya bilgileri manuel doldur."
      );
    } finally {
      setSearching(false);
    }
  };

  const handleAddShelf = () => {
    const formatted = toTitleCase(shelfInput.trim());
    if (!formatted) return;
    setShelf(formatted);
    setShelfInput("");
  };

  const handleClearShelf = () => {
    setShelf("");
  };

  const handleAddCategory = () => {
    const formatted = toTitleCase(categoryInput.trim());
    if (!formatted) return;
    if (categories.includes(formatted)) {
      setCategoryInput("");
      return;
    }
    setCategories((prev) => [...prev, formatted]);
    setCategoryInput("");
  };

  const handleRemoveCategory = (name: string) => {
    setCategories((prev) => prev.filter((c) => c !== name));
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!user) return;

    if (!title.trim()) {
      setSubmitError("Başlık alanı zorunludur.");
      return;
    }

    setSubmitError(null);
    setSubmitting(true);

    try {
    await addDoc(collection(db, "books"), {
  userId: user.uid,
  title: title.trim(),
  author: author.trim() || null,
  publisher: publisher.trim() || null,

  // 🔥 Basım yılı veri tabanına yaz
  publishYear: publishedDate.trim() || null,

  isbn: isbn.trim() || null,
  totalPages:
    typeof totalPages === "number" && !Number.isNaN(totalPages)
      ? totalPages
      : null,
  coverImageUrl: coverImageUrl.trim() || null,
  status,
  pagesRead:
    typeof pagesRead === "number" && !Number.isNaN(pagesRead)
      ? pagesRead
      : 0,

  // Puanlar
  expectedRating:
    typeof expectedRating === "number" && !Number.isNaN(expectedRating)
      ? expectedRating
      : null,
  currentRating:
    typeof progressRating === "number" && !Number.isNaN(progressRating)
      ? progressRating
      : null,
  finalRating:
    typeof finalRating === "number" && !Number.isNaN(finalRating)
      ? finalRating
      : null,

  overallRating: null,
  categories,
  shelf: shelf.trim() || null,
  startDate: startDate || null,
  endDate: endDate || null,
  notes: notes.trim() || null,

  // 🔥 Açıklama / özet de DB'ye yazılsın
  review: description.trim() || null,

  createdAt: serverTimestamp(),
  updatedAt: serverTimestamp(),
});


      navigate("/library");
    } catch (err) {
      console.error("Kitap ekleme hatası:", err);
      setSubmitError(
        "Kitap eklenirken bir hata oluştu. Lütfen tekrar dene."
      );
    } finally {
      setSubmitting(false);
    }
  };

  // Okuma durumuna göre puanlama açıklaması ve state seçimi
  let ratingTitle = "";
  let ratingDescription = "";
  let ratingValue: number | undefined;
  let ratingSetter: Dispatch<SetStateAction<number | undefined>>;

  switch (status) {
    case "OKUNACAK":
      ratingTitle = "Beklenti puanı";
      ratingDescription =
        "Bu kitaptan beklentin ne kadar yüksek? Okumadan önce hissettiğin merak ve heyecanı işaretle.";
      ratingValue = expectedRating;
      ratingSetter = setExpectedRating;
      break;
    case "OKUNUYOR":
      ratingTitle = "Şu ana kadar";
      ratingDescription =
        "Şimdiye kadar okuduğun kısma göre kitap beklentini ne kadar karşılıyor?";
      ratingValue = progressRating;
      ratingSetter = setProgressRating;
      break;
    case "OKUNDU":
      ratingTitle = "Genel değerlendirme";
      ratingDescription =
        "Kitabı bitirdin. Genel olarak ne kadar beğendin? Bu puan yapay zekâ ile oluşturulacak genel değerlendirmeye de temel olacak.";
      ratingValue = finalRating;
      ratingSetter = setFinalRating;
      break;
    default:
      ratingTitle = "Puan";
      ratingDescription = "";
      ratingValue = finalRating;
      ratingSetter = setFinalRating;
  }

  return (
    <div className="space-y-6">
      {/* Üst başlık */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-slate-50 flex items-center gap-2">
            <span className="inline-flex w-8 h-8 rounded-xl bg-primary/10 text-primary items-center justify-center">
              <BookOpen className="w-4 h-4" />
            </span>
            Yeni kitap ekle
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            ISBN ile otomatik doldur, gerekirse düzenle ve kütüphanene ekle.
          </p>
        </div>

        <div className="inline-flex items-center gap-2 rounded-2xl border border-primary/30 bg-primary/5 px-3 py-2 text-xs text-primary dark:border-primary/40 dark:bg-primary/10">
          <Sparkles className="w-3 h-3" />
          <span>Yapay zekâ ile kitap bilgisi doldurma aktif</span>
        </div>
      </div>

      {/* ISBN ile arama kutusu */}
      <section className="rounded-2xl border border-orange-200/80 bg-gradient-to-r from-orange-50/90 via-amber-50/90 to-yellow-50/90 dark:border-amber-900/60 dark:from-slate-900/90 dark:via-slate-950/90 dark:to-slate-950 px-4 py-4 md:px-5 md:py-5 space-y-3">
        <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-50 flex items-center gap-2">
          <span className="inline-flex w-7 h-7 rounded-xl bg-white/90 dark:bg-slate-900/80 items-center justify-center shadow-sm">
            <BookOpen className="w-4 h-4 text-orange-500" />
          </span>
          ISBN ile kitap ara
        </h2>

        <p className="text-xs text-slate-600 dark:text-slate-400">
          Kitap bilgilerini ve kapak resmini otomatik doldurmak için ISBN
          numarasını gir. Bilgileri daha sonra elle de düzenleyebilirsin.
        </p>

        <div className="flex flex-col sm:flex-row gap-2">
          <div className="relative flex-1">
            <input
              value={isbn}
              onChange={(e) => setIsbn(e.target.value)}
              onKeyDown={handleIsbnKeyDown}
              placeholder="Örn: 9786051711241"
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 pr-20 text-sm text-slate-900 shadow-sm outline-none ring-0 transition focus:border-primary/60 focus:ring-2 focus:ring-primary/30 dark:border-slate-700 dark:bg-slate-900/80 dark:text-slate-50"
            />
            <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-[10px] text-slate-400">
              Enter ile ara
            </span>
          </div>

          <button
            type="button"
            onClick={handleIsbnSearch}
            disabled={searching}
            className="inline-flex items-center justify-center rounded-xl bg-primary px-4 py-2.5 text-sm font-medium text-white shadow-sm transition hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {searching ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
                Aranıyor...
              </>
            ) : (
              <>ISBN ile doldur</>
            )}
          </button>
        </div>

        {searchError && (
          <div className="mt-2 inline-flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-[11px] text-red-700 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-100">
            <AlertCircle className="mt-[2px] w-3.5 h-3.5" />
            <p>{searchError}</p>
          </div>
        )}

        {searchInfo && !searchError && (
          <div className="mt-2 inline-flex items-start gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-[11px] text-emerald-700 dark:border-emerald-900/60 dark:bg-emerald-950/40 dark:text-emerald-100">
            <Sparkles className="mt-[2px] w-3.5 h-3.5" />
            <p>{searchInfo}</p>
          </div>
        )}
      </section>

      {/* Kitap formu */}
      <form
        onSubmit={handleSubmit}
        className="rounded-2xl border border-slate-200/80 bg-slate-50/70 px-4 py-5 shadow-sm dark:border-slate-800/80 dark:bg-slate-900/80 md:px-6 md:py-6 space-y-6"
      >
        {/* Kapak ve temel bilgiler */}
        <div className="grid grid-cols-1 gap-4 md:grid-cols-[160px,minmax(0,1fr)]">
          {/* Kapak */}
          <div className="flex flex-col items-center gap-2">
            <div className="relative flex h-52 w-36 items-center justify-center overflow-hidden rounded-xl border border-slate-200 bg-slate-100 shadow-sm dark:border-slate-700 dark:bg-slate-900">
              {coverImageUrl ? (
                <img
                  src={coverImageUrl}
                  alt={title || "Kapak görseli"}
                  className="h-full w-full object-cover"
                />
              ) : (
                <span className="text-xs font-medium text-slate-400 dark:text-slate-500">
                  Kapak görseli yok
                </span>
              )}
            </div>

            <div className="w-full space-y-1">
              <label className="block text-[11px] font-medium text-slate-500 dark:text-slate-400">
                Kapak görseli URL
              </label>
              <input
                value={coverImageUrl}
                onChange={(e) => setCoverImageUrl(e.target.value)}
                placeholder="İstersen manuel bir görsel URL'si girebilirsin"
                className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-900 shadow-sm outline-none focus:border-primary/60 focus:ring-2 focus:ring-primary/30 dark:border-slate-700 dark:bg-slate-900/80 dark:text-slate-50"
              />
            </div>
          </div>

          {/* Metin alanları */}
          <div className="space-y-4">
            <div className="space-y-1.5">
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-300">
                Kitap adı <span className="text-red-500">*</span>
              </label>
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Örn: Simyacı"
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm outline-none focus:border-primary/60 focus:ring-2 focus:ring-primary/30 dark:border-slate-700 dark:bg-slate-900/80 dark:text-slate-50"
              />
            </div>

            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <div className="space-y-1.5">
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-300">
                  Yazar
                </label>
                <input
                  value={author}
                  onChange={(e) => setAuthor(e.target.value)}
                  placeholder="Örn: Paulo Coelho"
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm outline-none focus:border-primary/60 focus:ring-2 focus:ring-primary/30 dark:border-slate-700 dark:bg-slate-900/80 dark:text-slate-50"
                />
              </div>
              <div className="space-y-1.5">
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-300">
                  Yayınevi
                </label>
                <input
                  value={publisher}
                  onChange={(e) => setPublisher(e.target.value)}
                  placeholder="Örn: Can Yayınları"
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm outline-none focus:border-primary/60 focus:ring-2 focus:ring-primary/30 dark:border-slate-700 dark:bg-slate-900/80 dark:text-slate-50"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
              <div className="space-y-1.5">
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-300">
                  ISBN
                </label>
                <input
                  value={isbn}
                  onChange={(e) => setIsbn(e.target.value)}
                  placeholder="978..."
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm outline-none focus:border-primary/60 focus:ring-2 focus:ring-primary/30 dark:border-slate-700 dark:bg-slate-900/80 dark:text-slate-50"
                />
              </div>
              <div className="space-y-1.5">
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-300">
                  Basım tarihi
                </label>
                <div className="relative">
                  <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
                    <CalendarDays className="w-3.5 h-3.5" />
                  </span>
                  <input
                    value={publishedDate}
                    onChange={(e) => setPublishedDate(e.target.value)}
                    placeholder="Örn: 2020-05"
                    className="w-full rounded-lg border border-slate-200 bg-white px-8 py-2 text-sm text-slate-900 shadow-sm outline-none focus:border-primary/60 focus:ring-2 focus:ring-primary/30 dark:border-slate-700 dark:bg-slate-900/80 dark:text-slate-50"
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-300">
                  Sayfa sayısı
                </label>
                <input
                  type="number"
                  min={1}
                  value={totalPages ?? ""}
                  onChange={(e) => {
                    const v = e.target.value;
                    setTotalPages(v ? Number(v) : undefined);
                  }}
                  placeholder="Örn: 256"
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm outline-none focus:border-primary/60 focus:ring-2 focus:ring-primary/30 dark:border-slate-700 dark:bg-slate-900/80 dark:text-slate-50"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Açıklama */}
        <div className="space-y-1.5">
          <label className="block text-xs font-medium text-slate-600 dark:text-slate-300">
            Açıklama / Özet
          </label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={4}
            placeholder="İstersen kitapla ilgili kısa bir açıklama yazabilirsin."
            className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm outline-none focus:border-primary/60 focus:ring-2 focus:ring-primary/30 dark:border-slate-700 dark:bg-slate-900/80 dark:text-slate-50"
          />
        </div>

        {/* Diğer alanlar */}
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div className="space-y-4">
            {/* Durum */}
            <div className="space-y-1.5">
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-300">
                Okuma durumu
              </label>
              <div className="flex flex-wrap gap-2">
                {([
                  ["OKUNACAK", "Okunacak"],
                  ["OKUNUYOR", "Okunuyor"],
                  ["OKUNDU", "Okundu"],
                ] as [BookStatus, string][]).map(([value, label]) => {
                  const active = status === value;
                  return (
                    <button
                      key={value}
                      type="button"
                      onClick={() => setStatus(value)}
                      className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition ${
                        active
                          ? "border-primary bg-primary/10 text-primary dark:border-primary/70 dark:bg-primary/15"
                          : "border-slate-200 text-slate-600 hover:border-primary/40 hover:text-primary dark:border-slate-700 dark:text-slate-300"
                      }`}
                    >
                      {value === "OKUNACAK" && (
                        <BookOpen className="w-3 h-3" />
                      )}
                      {value === "OKUNUYOR" && (
                        <Loader2 className="w-3 h-3" />
                      )}
                      {value === "OKUNDU" && <Star className="w-3 h-3" />}
                      <span>{label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Raf & kategori */}
            <div className="space-y-3">
              <div className="space-y-1.5">
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-300">
                  Raf / konum
                </label>
                <div className="flex gap-2">
                  <input
                    value={shelfInput}
                    onChange={(e) => setShelfInput(e.target.value)}
                    placeholder="Örn: salon üst raf"
                    className="flex-1 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm outline-none focus:border-primary/60 focus:ring-2 focus:ring-primary/30 dark:border-slate-700 dark:bg-slate-900/80 dark:text-slate-50"
                  />
                  <button
                    type="button"
                    onClick={handleAddShelf}
                    className="inline-flex items-center justify-center rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-sm text-slate-600 shadow-sm transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                </div>
                {shelf && (
                  <div className="flex flex-wrap gap-2 pt-1">
                    <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-1 text-xs text-slate-700 dark:bg-slate-800 dark:text-slate-200">
                      {shelf}
                      <button
                        type="button"
                        onClick={handleClearShelf}
                        className="p-0.5 text-slate-400 hover:text-slate-600 dark:text-slate-500 dark:hover:text-slate-300"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  </div>
                )}
              </div>
              <div className="space-y-1.5">
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-300">
                  Kategoriler
                </label>
                <div className="flex gap-2">
                  <input
                    value={categoryInput}
                    onChange={(e) => setCategoryInput(e.target.value)}
                    placeholder="Örn: bilim kurgu"
                    className="flex-1 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm outline-none focus:border-primary/60 focus:ring-2 focus:ring-primary/30 dark:border-slate-700 dark:bg-slate-900/80 dark:text-slate-50"
                  />
                  <button
                    type="button"
                    onClick={handleAddCategory}
                    className="inline-flex items-center justify-center rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-sm text-slate-600 shadow-sm transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                </div>
                {categories.length > 0 && (
                  <div className="flex flex-wrap gap-2 pt-1">
                    {categories.map((cat) => (
                      <span
                        key={cat}
                        className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-1 text-xs text-slate-700 dark:bg-slate-800 dark:text-slate-200"
                      >
                        {cat}
                        <button
                          type="button"
                          onClick={() => handleRemoveCategory(cat)}
                          className="p-0.5 text-slate-400 hover:text-slate-600 dark:text-slate-500 dark:hover:text-slate-300"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </span>
                    ))}
                  </div>
                )}
                <p className="text-[11px] text-slate-400">
                  Her eklemeden sonra kategori, “
                  <span className="font-medium text-slate-500 dark:text-slate-300">
                    Bilim Kurgu
                  </span>
                  ” gibi baş harfleri büyük olacak şekilde düzenlenir.
                </p>
              </div>
            </div>
          </div>

          {/* Tarihler, sayfa, not ve puan */}
          <div className="space-y-4">
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <div className="space-y-1.5">
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-300">
                  Başlangıç tarihi
                </label>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm outline-none focus:border-primary/60 focus:ring-2 focus:ring-primary/30 dark:border-slate-700 dark:bg-slate-900/80 dark:text-slate-50"
                />
              </div>
              <div className="space-y-1.5">
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-300">
                  Bitiş tarihi
                </label>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  disabled={status !== "OKUNDU"}
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm outline-none focus:border-primary/60 focus:ring-2 focus:ring-primary/30 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400 dark:border-slate-700 dark:bg-slate-900/80 dark:text-slate-50 disabled:dark:bg-slate-900 disabled:dark:text-slate-600"
                />
                {status !== "OKUNDU" && (
                  <p className="text-[11px] text-slate-400">
                    Bu alan sadece kitap &quot;Okundu&quot; olarak işaretlendiğinde
                    aktif olur.
                  </p>
                )}
              </div>
            </div>

            {status === "OKUNUYOR" && (
              <div className="space-y-1.5">
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-300">
                  Şu an kaçıncı sayfadasın?
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min={0}
                    max={totalPages ?? undefined}
                    value={pagesRead ?? ""}
                    onChange={(e) => {
                      const v = e.target.value;
                      setPagesRead(v ? Number(v) : undefined);
                    }}
                    placeholder="Örn: 120"
                    className="w-28 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm outline-none focus:border-primary/60 focus:ring-2 focus:ring-primary/30 dark:border-slate-700 dark:bg-slate-900/80 dark:text-slate-50"
                  />
                  {typeof totalPages === "number" && totalPages > 0 && (
                    <span className="text-[11px] text-slate-400">
                      Toplam {totalPages} sayfa
                    </span>
                  )}
                </div>
              </div>
            )}

            <div className="space-y-1.5">
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-300">
                Kısa not
              </label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
                placeholder="Bu kitapla ilgili kendin için küçük bir not bırak."
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm outline-none focus:border-primary/60 focus:ring-2 focus:ring-primary/30 dark:border-slate-700 dark:bg-slate-900/80 dark:text-slate-50"
              />
            </div>

            {/* Duruma göre yıldızlı puanlama */}
            <div className="space-y-1.5">
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-300">
                {ratingTitle} (1–5 yıldız)
              </label>
              <div className="flex flex-col gap-1.5">
                <StarRating
                  value={ratingValue}
                  onChange={(v) => ratingSetter(v)}
                />
                {ratingDescription && (
                  <p className="text-[11px] text-slate-400">
                    {ratingDescription}
                  </p>
                )}
                {status === "OKUNDU" && (
                  <p className="text-[11px] text-emerald-500 dark:text-emerald-400">
                    Kitap okunduğunda, beklenti, süreç ve final puanına göre
                    yapay zekâ destekli genel bir değerlendirme (overallRating)
                    oluşturulabilir.
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>

        {submitError && (
          <div className="mt-1 inline-flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-[11px] text-red-700 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-100">
            <AlertCircle className="mt-[2px] w-3.5 h-3.5" />
            <p>{submitError}</p>
          </div>
        )}

        <div className="flex items-center justify-end gap-2 pt-2">
          <button
            type="button"
            onClick={() => navigate("/library")}
            className="inline-flex items-center justify-center rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
          >
            Vazgeç
          </button>
          <button
            type="submit"
            disabled={submitting}
            className="inline-flex items-center justify-center rounded-xl bg-primary px-4 py-2.5 text-sm font-medium text-white shadow-sm transition hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {submitting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
                Kaydediliyor...
              </>
            ) : (
              <>Kitabı ekle</>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}