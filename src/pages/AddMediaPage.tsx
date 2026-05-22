// src/pages/AddMediaPage.tsx
import {
  FormEvent,
  useState,
  type Dispatch,
  type SetStateAction,
} from "react";
import { useNavigate } from "react-router-dom";
import {
  Film,
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


/* ---------------- TYPES ---------------- */

type WatchStatus = "IZLENECEK" | "IZLENIYOR" | "IZLENDI";

interface MediaSearchResult {
  id: number;
  type: "movie" | "series";
  title: string;
  year?: string;
  posterUrl?: string;
}

interface MediaDetails {
  type: "movie" | "series";
  title: string;
  posterUrl?: string;
  overview?: string;
  releaseDate?: string;
  imdbRating?: number;
  director?: string;
  cast?: string[];
}

/* ---------------- STAR RATING (AYNI) ---------------- */

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

/* ---------------- PAGE ---------------- */

export default function AddMediaPage() {
  const { user } = useAuth();
  const navigate = useNavigate();

  /* ---- SEARCH ---- */
  const [query, setQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [results, setResults] = useState<MediaSearchResult[]>([]);
  const [selected, setSelected] = useState<MediaDetails | null>(null);

  /* ---- FORM ---- */
  const [status, setStatus] = useState<WatchStatus>("IZLENECEK");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [notes, setNotes] = useState("");

  const [expectedRating, setExpectedRating] = useState<number | undefined>();
  const [progressRating, setProgressRating] = useState<number | undefined>();
  const [finalRating, setFinalRating] = useState<number | undefined>();

  const [categories, setCategories] = useState<string[]>([]);
  const [categoryInput, setCategoryInput] = useState("");

  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  if (!user) {
    return (
      <div className="max-w-xl mx-auto mt-10 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-6">
        <h1 className="text-lg font-semibold">Giriş gerekli</h1>
        <p className="text-sm">Film/Dizi eklemek için giriş yapmalısın.</p>
      </div>
    );
  }

  /* ---------------- SEARCH ---------------- */

  const handleSearch = async () => {
    if (!query.trim()) return;

    setSearching(true);
    setSearchError(null);

    try {
      const res = await apiClient.post("/api/media/search", {
        query,
        type: "multi",
      });
      setResults(res.data.results || []);
    } catch (err) {
      setSearchError("Arama sırasında bir hata oluştu.");
    } finally {
      setSearching(false);
    }
  };

  const selectMedia = async (item: MediaSearchResult) => {
    try {
      const res = await apiClient.get(
        `/api/media/details?type=${item.type}&id=${item.id}`
      );
      setSelected(res.data);
    } catch {
      setSearchError("Detaylar alınamadı.");
    }
  };

  /* ---------------- CATEGORY ---------------- */

  const addCategory = () => {
    const val = categoryInput.trim();
    if (!val || categories.includes(val)) return;
    setCategories((p) => [...p, val]);
    setCategoryInput("");
  };

  const removeCategory = (name: string) => {
    setCategories((p) => p.filter((c) => c !== name));
  };

  /* ---------------- SUBMIT ---------------- */

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!selected) return;

    setSubmitting(true);
    setSubmitError(null);

    try {
      await addDoc(collection(db, "media"), {
        userId: user.uid,
        type: selected.type,
        title: selected.title,
        posterUrl: selected.posterUrl || null,
        overview: selected.overview || null,
        releaseDate: selected.releaseDate || null,
        imdbRating: selected.imdbRating || null,
        director: selected.director || null,
        cast: selected.cast || [],
        status,
        categories,
        startDate: startDate || null,
        endDate: status === "IZLENDI" ? endDate || null : null,
        expectedRating: expectedRating ?? null,
        progressRating: progressRating ?? null,
        finalRating: finalRating ?? null,
        notes: notes.trim() || null,
        createdAt: serverTimestamp(),
      });

      navigate("/library");
    } catch (err) {
      setSubmitError("Kaydedilirken hata oluştu.");
    } finally {
      setSubmitting(false);
    }
  };

  /* ---------------- RATING SWITCH ---------------- */

  let ratingTitle = "";
  let ratingValue: number | undefined;
  let ratingSetter: Dispatch<SetStateAction<number | undefined>>;

  switch (status) {
    case "IZLENECEK":
      ratingTitle = "Beklenti puanı";
      ratingValue = expectedRating;
      ratingSetter = setExpectedRating;
      break;
    case "IZLENIYOR":
      ratingTitle = "Şu ana kadar";
      ratingValue = progressRating;
      ratingSetter = setProgressRating;
      break;
    case "IZLENDI":
      ratingTitle = "Genel değerlendirme";
      ratingValue = finalRating;
      ratingSetter = setFinalRating;
      break;
    default:
      ratingTitle = "";
      ratingValue = undefined;
      ratingSetter = () => {};
  }

  /* ---------------- UI ---------------- */

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <h1 className="text-xl font-bold flex items-center gap-2">
        <Film className="w-5 h-5" />
        Film / Dizi Ekle
      </h1>

      {/* SEARCH */}
      <section className="rounded-2xl border p-4 space-y-3">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Film veya dizi adı"
          className="w-full border rounded-xl px-3 py-2"
        />
        <button
          type="button"
          onClick={handleSearch}
          disabled={searching}
          className="bg-primary text-white px-4 py-2 rounded-xl"
        >
          {searching ? "Aranıyor..." : "Ara"}
        </button>

        {searchError && (
          <p className="text-xs text-red-500">{searchError}</p>
        )}

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {results.map((r) => (
            <div
              key={`${r.type}-${r.id}`}
              onClick={() => selectMedia(r)}
              className="cursor-pointer"
            >
              {r.posterUrl && <img src={r.posterUrl} />}
              <p className="text-xs mt-1">{r.title}</p>
            </div>
          ))}
        </div>
      </section>

      {/* DETAILS */}
      {selected && (
        <>
          <section className="space-y-2">
            <p className="text-sm text-slate-500">{selected.overview}</p>
          </section>

          {/* STATUS */}
          <section className="space-y-2">
            <div className="flex gap-2">
              {(
                [
                  ["IZLENECEK", "İzlenecek"],
                  ["IZLENIYOR", "İzleniyor"],
                  ["IZLENDI", "İzlendi"],
                ] as [WatchStatus, string][]
              ).map(([v, label]) => (
                <button
                  type="button"
                  key={v}
                  onClick={() => setStatus(v)}
                  className={`px-3 py-1 rounded-full text-xs ${
                    status === v
                      ? "bg-primary text-white"
                      : "border"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </section>

          {/* RATING */}
          <section>
            <label className="text-xs">{ratingTitle}</label>
            <StarRating
              value={ratingValue}
              onChange={(v) => ratingSetter(v)}
            />
          </section>

          {/* NOTES */}
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Kısa not"
            className="w-full border rounded-xl p-2 text-sm"
          />

          {/* SUBMIT */}
          {submitError && (
            <p className="text-xs text-red-500">{submitError}</p>
          )}

          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => navigate("/library")}
              className="border px-4 py-2 rounded-xl"
            >
              Vazgeç
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="bg-primary text-white px-4 py-2 rounded-xl"
            >
              {submitting ? "Kaydediliyor..." : "Ekle"}
            </button>
          </div>
        </>
      )}
    </form>
  );
}
