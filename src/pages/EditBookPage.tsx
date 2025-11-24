// src/pages/EditBookPage.tsx

import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  doc,
  getDoc,
  updateDoc,
  serverTimestamp,
  writeBatch,
  deleteDoc,
  collection,
  getDocs,
} from "firebase/firestore";
import { db } from "../firebase/firebase";
import { useAuth } from "../auth/AuthContext";
import type { Book } from "../types/book";
import BookDeleteModal from "../components/BookDeleteModal";
// import axios from "axios";  // Artık gerekli değil
import { api } from "../apiClient";

import { deleteBookCompletely } from "../utils/deleteBookCompletely";

import {
  ArrowLeft,
  BookOpen,
  CalendarDays,
  Book as BookIcon,
  Building2,
  Sparkles,
  Tag,
  Layers,
  FileText,
  ImagePlus,
  X,
  Trash2, CheckCircle2, AlertTriangle, Loader2,
} from "lucide-react";

const toTitleCase = (value: string) =>
  value
    .split(" ")
    .filter(Boolean)
    .map(
      (word) =>
        word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
    )
    .join(" ");

interface EditForm {
  title: string;
  author: string;
  publisher: string;
  publishYear: string;
  totalPages: string;
  isbn: string;
  summary: string;
  shortNote: string;
  coverImageUrl: string;
  categories: string[];
}

export default function EditBookPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [book, setBook] = useState<any>(null);

const [deleteLoading, setDeleteLoading] = useState(false);
const [deleteAlert, setDeleteAlert] = useState<{
  type: "success" | "error";
  message: string;
} | null>(null);

const [deleteModalOpen, setDeleteModalOpen] = useState(false);


  const { user } = useAuth();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const [form, setForm] = useState<EditForm>({
    title: "",
    author: "",
    publisher: "",
    publishYear: "",
    totalPages: "",
    isbn: "",
    summary: "",
    shortNote: "",
    coverImageUrl: "",
    categories: [],
  });

  // Kategori & raf chip state'leri
  const [categoryInput, setCategoryInput] = useState("");
  const [shelfTags, setShelfTags] = useState<string[]>([]);
  const [shelfInput, setShelfInput] = useState("");

  const inputClass =
    "w-full px-3 py-2.5 rounded-xl border border-amber-200 bg-white text-sm shadow-sm " +
    "focus:outline-none focus:ring-2 focus:ring-amber-300 " +
    "dark:bg-slate-900 dark:border-slate-700 dark:focus:ring-slate-600";

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  };

  // 🔹 Firestore'dan kitabı çek
  useEffect(() => {
    const load = async () => {
      if (!id || !user) return;

      setLoading(true);
      setError(null);

      try {
        const ref = doc(db, "books", id);
        const snap = await getDoc(ref);

        if (!snap.exists()) {
          setError("Kitap bulunamadı.");
          setLoading(false);
          return;
        }

        const data = snap.data() as Book & {
          description?: string;
          publishedDate?: string;
        };

        if (data.userId !== user.uid) {
          setError("Bu kitaba erişim yetkin yok.");
          setLoading(false);
          return;
        }

        // Raf string → chip listesi
        const rawShelf = (data.shelf as string) || "";
        let shelfList: string[] = [];
        if (rawShelf.includes("|")) {
          shelfList = rawShelf
            .split("|")
            .map((t) => t.trim())
            .filter((t) => t.length > 0);
        } else if (rawShelf) {
          shelfList = [rawShelf.trim()];
        }

        setShelfTags(shelfList);
        setShelfInput("");

        setForm({
          title: data.title || "",
          author: data.author || "",
          publisher: data.publisher || "",
          publishYear:
            (data.publishYear as string) || data.publishedDate || "",
          totalPages: data.totalPages ? String(data.totalPages) : "",
          isbn: data.isbn || "",
          summary:
            (data.review as string) ||
            (data.notes as string) ||
            (data as any).description ||
            "",
          shortNote: (data.notes as string) || "",
          coverImageUrl: data.coverImageUrl || "",
          categories: data.categories || [],
        });

        setCategoryInput("");
        setLoading(false);
      } catch (e) {
        console.error(e);
        setError("Kitap bilgileri yüklenirken bir hata oluştu.");
        setLoading(false);
      }
    };

    load();
  }, [id, user]);

  const handleChange = (
    key: keyof EditForm,
    value: string | string[]
  ) => {
    setForm((prev) => ({ ...prev, [key]: value } as EditForm));
  };

  // 🔹 Kategori ekle / sil
  const handleAddCategory = () => {
    const formatted = toTitleCase(categoryInput.trim());
    if (!formatted) return;
    if (form.categories.includes(formatted)) return;
    handleChange("categories", [...form.categories, formatted]);
    setCategoryInput("");
  };

  const handleRemoveCategory = (cat: string) => {
    handleChange(
      "categories",
      form.categories.filter((c) => c !== cat)
    );
  };

  // 🔹 Raf ekle / sil
  const handleAddShelf = () => {
    const formatted = toTitleCase(shelfInput.trim());
    if (!formatted) return;
    if (shelfTags.includes(formatted)) return;
    setShelfTags((prev) => [...prev, formatted]);
    setShelfInput("");
  };

  const handleRemoveShelf = (tag: string) => {
    setShelfTags((prev) => prev.filter((t) => t !== tag));
  };

  // 🔹 AI ile ISBN'den veri çek
  const handleAiLookup = async () => {
    if (!form.isbn.trim()) {
      showToast("Önce geçerli bir ISBN gir.");
      return;
    }

    try {
      setSaving(true);
      const res = await api.post("/api/books/ai", {
        isbn: form.isbn.trim(),
      });

      const data = res.data;

      if (!res.status || res.status >= 400 || data.found === false) {
        showToast(
          data?.message ||
            "Bu ISBN için otomatik veri bulunamadı. Bilgileri manuel düzenleyebilirsin."
        );
        setSaving(false);
        return;
      }

      setForm((prev) => ({
        ...prev,
        title: data.title || prev.title,
        author: data.author || prev.author,
        publisher: data.publisher || prev.publisher,
        publishYear: data.publishedDate || prev.publishYear,
        totalPages:
          typeof data.pageCount === "number" && !Number.isNaN(data.pageCount)
            ? String(data.pageCount)
            : prev.totalPages,
        summary: data.description || prev.summary,
        coverImageUrl:
          prev.coverImageUrl && prev.coverImageUrl.trim() !== ""
            ? prev.coverImageUrl
            : data.coverImageUrl &&
              typeof data.coverImageUrl === "string" &&
              /^https?:\/\//i.test(data.coverImageUrl)
            ? data.coverImageUrl
            : prev.coverImageUrl,
      }));

      showToast("AI ile kitap bilgileri zenginleştirildi.");
    } catch (e) {
      console.error(e);
      showToast("AI kitap bilgisi alınırken bir hata oluştu.");
    } finally {
      setSaving(false);
    }
  };

  // 🔹 Kaydet
  const handleSave = async () => {
    if (!id) return;
    if (!form.title.trim()) {
      showToast("Kitap adı boş olamaz.");
      return;
    }

    try {
      setSaving(true);
      const ref = doc(db, "books", id);

      const shelfValue =
        shelfTags.length > 0
          ? shelfTags
              .map((t) => t.trim())
              .filter((t) => t.length > 0)
              .join(" | ")
          : null;

      await updateDoc(ref, {
        title: form.title.trim(),
        author: form.author.trim() || null,
        publisher: form.publisher.trim() || null,
        publishYear: form.publishYear.trim() || null,
        totalPages: form.totalPages ? Number(form.totalPages) : null,
        isbn: form.isbn.trim() || null,
        review: form.summary.trim() || null,
        notes: form.shortNote.trim() || null,
        shelf: shelfValue,
        categories: form.categories
          .map((c) => c.trim())
          .filter((c) => c !== ""),
        coverImageUrl: form.coverImageUrl.trim() || null,
        updatedAt: serverTimestamp(),
      });

      showToast("Kitap bilgileri başarıyla güncellendi.");
      setTimeout(() => {
        navigate("/library");
      }, 600);
    } catch (e) {
      console.error(e);
      showToast("Kaydedilirken bir hata oluştu.");
    } finally {
      setSaving(false);
    }
  };


const handleDeleteBook = async () => {
  if (!id) return;

  try {
    setDeleteLoading(true);
    setDeleteAlert(null);

    // 🔥 ALT KOLEKSİYONLARI SİL — logs
    const logsSnap = await getDocs(collection(db, "books", id, "logs"));
    for (const log of logsSnap.docs) {
      await deleteDoc(doc(db, "books", id, "logs", log.id));
    }

    // 🔥 ALT KOLEKSİYONLARI SİL — notes
    const notesSnap = await getDocs(collection(db, "books", id, "notes"));
    for (const note of notesSnap.docs) {
      await deleteDoc(doc(db, "books", id, "notes", note.id));
    }

    // 🔥 KİTABI SİL
    await deleteDoc(doc(db, "books", id));

    // ✅ Şekilli alert için mesaj
    setDeleteAlert({
      type: "success",
      message: "Kitap ve tüm verileri başarıyla silindi.",
    });

    // Biraz göster, sonra kütüphaneye dön
    setTimeout(() => {
      setDeleteModalOpen(false);
      navigate("/library");
    }, 1500);
  } catch (err) {
    console.error(err);
    setDeleteAlert({
      type: "error",
      message: "Kitap silinirken bir hata oluştu. Lütfen tekrar dene.",
    });
  } finally {
    setDeleteLoading(false);
  }
};




  


  if (loading) {
    return (
      <div className="p-8 text-center text-slate-500">
        Kitap bilgileri yükleniyor...
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-8 max-w-xl mx-auto text-center text-slate-600 dark:text-slate-300">
        {error}
        <div className="mt-4">
          <button
            onClick={() => navigate("/library")}
            className="px-4 py-2 rounded-full bg-amber-500 text-white text-sm font-semibold"
          >
            Kütüphaneye dön
          </button>
        </div>
      </div>
    );
  }

  return (
    <>
  



      {/* Toast / Alert */}
      {toast && (
        <div className="fixed top-4 right-4 z-40">
          <div className="flex items-start gap-2 rounded-2xl bg-slate-900 text-white px-4 py-3 shadow-xl border border-slate-700 max-w-xs text-xs">
            <div className="mt-0.5">
              <Sparkles className="w-4 h-4 text-amber-400" />
            </div>
            <div className="flex-1">{toast}</div>
          </div>
        </div>
      )}

      <div className="min-h-[calc(100vh-80px)] px-4 py-6 md:px-8 md:py-8 max-w-6xl mx-auto">
        {/* Üst başlık */}
        <div className="flex items-center gap-3 mb-6">
          <button
            onClick={() => navigate(-1)}
            className="p-2 rounded-full bg-white/80 dark:bg-slate-900 shadow-sm border border-amber-100 dark:border-slate-700 hover:bg-white dark:hover:bg-slate-800"
          >
            <ArrowLeft className="w-4 h-4 text-slate-700 dark:text-slate-200" />
          </button>
          <div>
            <div className="text-[11px] uppercase tracking-[0.18em] text-amber-700 dark:text-slate-400">
              Kişisel kütüphanem
            </div>
            <h1 className="text-xl md:text-2xl font-bold text-slate-900 dark:text-slate-50">
              Kitap Bilgilerini Güncelle
            </h1>
          </div>
        </div>

        {/* Ana form kartı */}
        <div className="rounded-3xl border border-amber-100 bg-white/90 dark:bg-slate-950 dark:border-slate-800 shadow-[0_18px_50px_rgba(15,23,42,0.15)] px-5 py-6 md:px-8 md:py-8 space-y-6">
          {/* Üst satır: kapak + temel bilgiler */}
          <div className="flex flex-col md:flex-row gap-6">
            {/* Kapak + kapak URL */}
            <div className="flex flex-col items-center md:items-start gap-3 md:w-[220px]">
              <div className="relative">
                {form.coverImageUrl ? (
                  <img
                    src={form.coverImageUrl}
                    alt={form.title}
                    className="w-40 h-56 md:w-44 md:h-64 object-cover rounded-2xl shadow-lg border border-white/80 dark:border-slate-700 bg-slate-100 dark:bg-slate-900"
                  />
                ) : (
                  <div className="w-40 h-56 md:w-44 md:h-64 rounded-2xl bg-slate-100 dark:bg-slate-900 border border-dashed border-amber-200 dark:border-slate-700 flex items-center justify-center">
                    <BookOpen className="w-8 h-8 text-slate-400" />
                  </div>
                )}
              </div>

              <div className="w-full flex flex-col gap-1">
                <label className="text-xs font-semibold text-slate-600 dark:text-slate-300 flex items-center gap-1.5">
                  <ImagePlus className="w-4 h-4 text-amber-600" />
                  Kapak URL
                </label>
                <input
                  className={inputClass + " text-[11px]"}
                  value={form.coverImageUrl}
                  onChange={(e) =>
                    handleChange("coverImageUrl", e.target.value)
                  }
                  placeholder="İstersen kapak görseli URL'sini buraya yapıştır"
                />
                <p className="text-[10px] text-slate-400 dark:text-slate-500">
                  AI sorgusunda uygun bir kapak bulunursa buraya otomatik
                  yazılır. Dilersen elle de ekleyebilirsin.
                </p>
              </div>
            </div>

            {/* Temel alanlar */}
            <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-5">
              <div className="flex flex-col gap-1">
                <label className="text-xs font-semibold text-slate-600 dark:text-slate-300 flex items-center gap-1.5">
                 <BookIcon className="w-4 h-4 text-amber-600" />

                  Kitap adı
                </label>
                <input
                  className={inputClass}
                  value={form.title}
                  onChange={(e) => handleChange("title", e.target.value)}
                  placeholder="Kitap adını yaz"
                />
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-xs font-semibold text-slate-600 dark:text-slate-300">
                  Yazar
                </label>
                <input
                  className={inputClass}
                  value={form.author}
                  onChange={(e) => handleChange("author", e.target.value)}
                  placeholder="Yazar adı"
                />
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-xs font-semibold text-slate-600 dark:text-slate-300 flex items-center gap-1.5">
                  <Building2 className="w-4 h-4 text-amber-600" />
                  Yayın evi
                </label>
                <input
                  className={inputClass}
                  value={form.publisher}
                  onChange={(e) => handleChange("publisher", e.target.value)}
                  placeholder="Yayınevi"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-semibold text-slate-600 dark:text-slate-300 flex items-center gap-1.5">
                    <CalendarDays className="w-4 h-4 text-amber-600" />
                    Basım yılı
                  </label>
                  <input
                    className={inputClass}
                    value={form.publishYear}
                    onChange={(e) =>
                      handleChange("publishYear", e.target.value)
                    }
                    placeholder="Örn: 2020"
                  />
                </div>

                <div className="flex flex-col gap-1">
                  <label className="text-xs font-semibold text-slate-600 dark:text-slate-300 flex items-center gap-1.5">
                    <BookOpen className="w-4 h-4 text-amber-600" />
                    Sayfa sayısı
                  </label>
                  <input
                    type="number"
                    className={inputClass}
                    value={form.totalPages}
                    onChange={(e) =>
                      handleChange("totalPages", e.target.value)
                    }
                    placeholder="Örn: 320"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* ISBN + AI alanı */}
          <div className="rounded-2xl border border-amber-100 bg-amber-50/60 dark:bg-slate-900/80 dark:border-slate-700 px-4 py-3 flex flex-col md:flex-row md:items-center gap-3">
            <div className="flex-1 flex flex-col gap-1">
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-200 flex items-center gap-1.5">
                ISBN ile otomatik doldur
                <Sparkles className="w-4 h-4 text-amber-600" />
              </label>
              <div className="flex gap-2">
                <input
                  className={inputClass + " flex-1"}
                  value={form.isbn}
                  onChange={(e) => handleChange("isbn", e.target.value)}
                  placeholder="ISBN numarası"
                />
                <button
                  type="button"
                  onClick={handleAiLookup}
                  disabled={saving}
                  className="px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-white text-xs md:text-sm font-semibold shadow disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {saving ? "Sorgulanıyor..." : "AI ile getir"}
                </button>
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                ISBN girip &quot;AI ile getir&quot; dediğinde; kitap adı,
                yazar, yayın evi, basım yılı, sayfa sayısı, özet ve mümkünse
                kapak görseli otomatik doldurulur. Mevcut veriler boşsa
                zenginleştirilir, elle yaptığın değişiklikler korunur.
              </p>
            </div>
          </div>

          {/* Kategori & raf */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-5">
            {/* Kategoriler */}
            <div className="space-y-2">
              <label className="text-xs font-semibold text-slate-600 dark:text-slate-300 flex items-center gap-1.5">
                <Tag className="w-4 h-4 text-amber-600" />
                Kategoriler
              </label>

              {form.categories.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {form.categories.map((cat) => (
                    <span
                      key={cat}
                      className="inline-flex items-center gap-1 rounded-full bg-amber-50 text-amber-800 px-2 py-1 text-[11px] border border-amber-100 dark:bg-slate-900 dark:text-amber-100 dark:border-slate-700"
                    >
                      {cat}
                      <button
                        type="button"
                        onClick={() => handleRemoveCategory(cat)}
                        className="hover:text-red-500"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  ))}
                </div>
              )}

              <div className="flex gap-2">
                <input
                  className={inputClass + " flex-1"}
                  value={categoryInput}
                  onChange={(e) => setCategoryInput(e.target.value)}
                  placeholder="Örn: Bilim Kurgu"
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      handleAddCategory();
                    }
                  }}
                />
                <button
                  type="button"
                  onClick={handleAddCategory}
                  className="px-3 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-white text-xs font-semibold shadow"
                >
                  +
                </button>
              </div>
            </div>

            {/* RAF / KONUM */}
            <div className="space-y-2">
              <label className="text-xs font-semibold text-slate-600 dark:text-slate-300 flex items-center gap-1.5">
                <Layers className="w-4 h-4 text-amber-600" />
                Raf / konum
              </label>

              {shelfTags.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {shelfTags.map((tag) => (
                    <span
                      key={tag}
                      className="inline-flex items-center gap-1 rounded-full bg-slate-50 text-slate-700 px-2 py-1 text-[11px] border border-slate-200 dark:bg-slate-900 dark:text-slate-100 dark:border-slate-700"
                    >
                      {tag}
                      <button
                        type="button"
                        onClick={() => handleRemoveShelf(tag)}
                        className="hover:text-red-500"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  ))}
                </div>
              )}

              <div className="flex gap-2">
                <input
                  className={inputClass + " flex-1"}
                  value={shelfInput}
                  onChange={(e) => setShelfInput(e.target.value)}
                  placeholder="Örn: Salon / Üst Raf"
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      handleAddShelf();
                    }
                  }}
                />
                <button
                  type="button"
                  onClick={handleAddShelf}
                  className="px-3 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-white text-xs font-semibold shadow"
                >
                  +
                </button>
              </div>
            </div>
          </div>

          {/* Açıklama / özet + kısa not */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-5">
            <div className="flex flex-col gap-1">
              <label className="text-xs font-semibold text-slate-600 dark:text-slate-300 flex items-center gap-1.5">
                <FileText className="w-4 h-4 text-amber-600" />
                Açıklama / Özet
              </label>
              <textarea
                className={inputClass + " min-h-[120px] resize-none"}
                value={form.summary}
                onChange={(e) => handleChange("summary", e.target.value)}
                placeholder="Kitabın konusuna dair özet, aldığın genel notlar, aklında kalmasını istediğin şeyler..."
              />
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-xs font-semibold text-slate-600 dark:text-slate-300">
                Kısa not
              </label>
              <textarea
                className={inputClass + " min-h-[120px] resize-none"}
                value={form.shortNote}
                onChange={(e) => handleChange("shortNote", e.target.value)}
                placeholder="Bu kitapla ilgili kendine özel kısa notlar, etiketler, hatırlatmalar..."
              />
            </div>
          </div>

          {/* Kaydet butonu */}
<div className="mt-6 flex justify-between items-center gap-3">
  {/* Sol tarafta silme butonu */}
<button
  onClick={() => setDeleteModalOpen(true)}
  className="flex items-center gap-2 bg-red-600 text-white px-4 py-2 rounded-xl"
>
  Sil
</button>



  {/* Sağ tarafta Kaydet butonu */}
  <button
    type="submit"
    className="px-6 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 
               text-white font-semibold shadow-md shadow-amber-500/30 text-sm"
  >
    Kaydet
  </button>
</div>



        </div>
<BookDeleteModal
  open={deleteModalOpen}
  onClose={() => {
    setDeleteModalOpen(false);
    setDeleteAlert(null); // modal kapatılırken mesajı temizle
  }}
  onConfirm={handleDeleteBook}
  loading={deleteLoading}
  result={deleteAlert}
/>




      </div>
    </>
  );
}
