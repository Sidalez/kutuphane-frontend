// src/pages/AddMediaPage.tsx
import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  query,
  serverTimestamp,
  setDoc,
  where,
} from "firebase/firestore";
import {
  AlertTriangle,
  CalendarDays,
  CheckCircle2,
  Clock,
  ExternalLink,
  Film,
  Heart,
  Layers,
  ImageIcon,
  Info,
  Loader2,
  Play,
  Plus,
  RotateCcw,
  Save,
  Search,
  Sparkles,
  Star,
  Trash2,
  Tv,
  X,
} from "lucide-react";

import { db } from "../firebase/firebase";
import { useAuth } from "../auth/AuthContext";
import type { MediaItem, MediaType, WatchStatus } from "../types/media";

type MediaSearchResult = {
  tmdbId: number;
  type: MediaType;
  title: string;
  originalTitle?: string;
  year?: string;
  overview?: string;
  posterUrl?: string;
  backdropUrl?: string;
  tmdbRating?: number | null;
};

type MediaSeason = {
  seasonNumber: number;
  name: string;
  episodeCount: number;
  airDate?: string | null;
  posterUrl?: string | null;
};

type MediaPerson = {
  id?: number | null;
  name: string;
  originalName?: string;
  character?: string;
  episodeCount?: number;
  profileUrl?: string | null;
  profileOriginalUrl?: string | null;
  imageUrl?: string | null;
  photoUrl?: string | null;
  profile_path?: string | null;
  knownForDepartment?: string;
};

type TvEpisode = {
  seasonNumber: number;
  episodeNumber: number;
  title: string;
  overview?: string;
  airDate?: string | null;
  runtime?: number | null;
  stillUrl?: string | null;
  tmdbRating?: number | null;
};

type TvSeasonDetails = {
  seasonNumber: number;
  name: string;
  overview?: string;
  airDate?: string | null;
  posterUrl?: string | null;
  episodeCount: number;
  episodes: TvEpisode[];
};

type MediaDetails = {
  tmdbId: number;
  imdbId?: string | null;
  type: MediaType;
  title: string;
  originalTitle?: string;
  year?: string;
  overview?: string;
  posterUrl?: string | null;
  backdropUrl?: string | null;
  trailerUrl?: string | null;
  genres?: string[];
  platforms?: string[];
  runtime?: number | null;
  numberOfSeasons?: number;
  numberOfEpisodes?: number;
  seasons?: MediaSeason[];
  director?: string | null;
  creators?: string[];
  cast?: Array<MediaPerson | string>;
  castDetails?: MediaPerson[];
  tmdbRating?: number | null;
  imdbRating?: number | null;
};

type ToastType = "success" | "error" | "info";

type ToastState = {
  type: ToastType;
  message: string;
} | null;

type PreviewImage = {
  url: string;
  title: string;
  subtitle?: string;
} | null;

type MediaShelf = {
  id: string;
  name: string;
  isDefault?: boolean;
};

const DEFAULT_SHELVES: MediaShelf[] = [
  { id: "favorite", name: "Favoriler", isDefault: true },
  { id: "watch-weekend", name: "Hafta sonu", isDefault: true },
  { id: "must-watch", name: "Mutlaka izle", isDefault: true },
  { id: "comfort", name: "Rahat izlemelik", isDefault: true },
];

function todayInputValue() {
  return new Date().toISOString().slice(0, 10);
}

function getMonthKey(date: string) {
  return date.slice(0, 7);
}

function statusLabel(status: WatchStatus) {
  if (status === "IZLENECEK") return "İzlenecek";
  if (status === "IZLENIYOR") return "İzleniyor";
  if (status === "IZLENDI") return "İzlendi";
  return "Bırakıldı";
}

function statusDescription(status: WatchStatus) {
  if (status === "IZLENECEK") return "Planlandı; sadece beklenti puanı ve not tutulur.";
  if (status === "IZLENIYOR") return "Devam ediyor; filmde dakika, dizide bölüm seçimi aktif olur.";
  if (status === "IZLENDI") return "Tamamlandı; dizilerde tüm bölümler otomatik işaretlenir.";
  return "Yarıda bırakıldı; ilerleme kapatılır, notla sebep yazılabilir.";
}

function mediaTypeLabel(type: MediaType) {
  return type === "MOVIE" ? "Film" : "Dizi";
}

function getApiBase() {
  return import.meta.env.VITE_API_URL || "http://localhost:3001";
}

async function postJson<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${getApiBase()}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  const rawText = await res.text();

  let data: any = {};
  try {
    data = rawText ? JSON.parse(rawText) : {};
  } catch {
    throw new Error(`Backend JSON dönmedi: ${rawText.slice(0, 300)}`);
  }

  if (!res.ok) {
    throw new Error(data?.message || data?.error || `HTTP ${res.status}`);
  }

  return data as T;
}

function removeUndefinedDeep<T>(value: T): T {
  if (Array.isArray(value)) {
    return value.map((item) => (item === undefined ? null : removeUndefinedDeep(item))) as T;
  }

  if (
    value &&
    typeof value === "object" &&
    Object.getPrototypeOf(value) === Object.prototype
  ) {
    const cleaned: Record<string, unknown> = {};

    Object.entries(value as Record<string, unknown>).forEach(([key, val]) => {
      if (val !== undefined) cleaned[key] = removeUndefinedDeep(val);
    });

    return cleaned as T;
  }

  return value;
}

function getMediaDocumentId(userId: string, type: MediaType, tmdbId: number) {
  return `${userId}_${type}_${tmdbId}`;
}

function episodeKey(seasonNumber: number, episodeNumber: number) {
  return `S${seasonNumber}E${episodeNumber}`;
}

function getWatchedEpisodeList(watched: Record<string, TvEpisode>) {
  return Object.values(watched).sort((a, b) => {
    if (a.seasonNumber !== b.seasonNumber) return a.seasonNumber - b.seasonNumber;
    return a.episodeNumber - b.episodeNumber;
  });
}

function getPersonName(person: MediaPerson | string) {
  if (typeof person === "string") return person;
  return person.name || person.originalName || "Bilinmiyor";
}

function getPersonMeta(person: MediaPerson | string) {
  if (typeof person === "string") return "";

  const parts = [
    person.character ? `Rol: ${person.character}` : "",
    person.originalName && person.originalName !== person.name ? person.originalName : "",
  ].filter(Boolean);

  return parts.join(" • ");
}

function toOriginalTmdbImage(url?: string | null) {
  const value = String(url || "").trim();
  if (!value) return "";

  if (value.startsWith("/")) return `https://image.tmdb.org/t/p/original${value}`;

  return value.replace(
    /\/t\/p\/(w92|w154|w185|w300|w342|w500|w780|h632)\//,
    "/t/p/original/"
  );
}

function getPersonImageUrl(person: MediaPerson | string, original = false) {
  if (typeof person === "string") return "";

  const raw =
    person.profileOriginalUrl ||
    person.profileUrl ||
    person.imageUrl ||
    person.photoUrl ||
    person.profile_path ||
    "";

  const value = String(raw || "").trim();
  if (!value) return "";

  if (original) return toOriginalTmdbImage(value);
  if (value.startsWith("http")) return value;
  if (value.startsWith("/")) return `https://image.tmdb.org/t/p/w185${value}`;

  return value;
}

function normalizeCastDetailsForSave(
  castDetails?: MediaPerson[],
  cast?: Array<MediaPerson | string>
) {
  const source =
    Array.isArray(castDetails) && castDetails.length > 0
      ? castDetails
      : Array.isArray(cast)
      ? cast
      : [];

  return source
    .map((person) => {
      if (typeof person === "string") {
        return {
          id: null,
          name: person,
          originalName: "",
          character: "",
          episodeCount: 0,
          profileUrl: "",
          profileOriginalUrl: "",
        };
      }

      const imageUrl = getPersonImageUrl(person);
      const originalImageUrl = getPersonImageUrl(person, true) || imageUrl;

      return {
        id: person.id || null,
        name: person.name || person.originalName || "Bilinmiyor",
        originalName: person.originalName || "",
        character: person.character || "",
        episodeCount: Number(person.episodeCount || 0),
        profileUrl: imageUrl,
        profileOriginalUrl: originalImageUrl,
        knownForDepartment: person.knownForDepartment || "",
      };
    })
    .filter((person) => person.name && person.name !== "Bilinmiyor");
}

function getPersonInitials(name: string) {
  const clean = name.trim();
  if (!clean) return "?";

  const parts = clean.split(/\s+/).filter(Boolean);
  if (parts.length === 1) return parts[0].slice(0, 2).toLocaleUpperCase("tr-TR");

  return `${parts[0][0] || ""}${parts[parts.length - 1][0] || ""}`.toLocaleUpperCase("tr-TR");
}

function getExpectedEpisodeCount(media?: MediaDetails | null) {
  if (!media || media.type !== "TV") return 0;

  const fromDetails = Number(media.numberOfEpisodes || 0);
  if (fromDetails > 0) return fromDetails;

  return (media.seasons || []).reduce((sum, season) => sum + Number(season.episodeCount || 0), 0);
}

function calculateOverallRating(values: Array<number | undefined | null>) {
  const valid = values.filter(
    (value): value is number => typeof value === "number" && Number.isFinite(value) && value > 0
  );

  if (valid.length === 0) return undefined;
  return Math.round((valid.reduce((sum, value) => sum + value, 0) / valid.length) * 10) / 10;
}

function RatingStars({ value, size = "h-4 w-4" }: { value?: number; size?: string }) {
  return (
    <div className="flex min-w-0 items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((n) => (
        <Star
          key={n}
          className={`${size} shrink-0 ${
            value && value >= n ? "fill-amber-400 text-amber-400" : "text-slate-300 dark:text-slate-600"
          }`}
        />
      ))}
    </div>
  );
}

function StarRating({
  value,
  onChange,
  disabled = false,
}: {
  value?: number;
  onChange: (value: number | undefined) => void;
  disabled?: boolean;
}) {
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {[1, 2, 3, 4, 5].map((n) => {
        const active = Boolean(value && value >= n);

        return (
          <button
            key={n}
            type="button"
            disabled={disabled}
            onClick={() => onChange(n)}
            className="rounded-xl p-1 transition hover:bg-amber-50 disabled:cursor-not-allowed disabled:opacity-50 dark:hover:bg-amber-900/20"
            aria-label={`${n} yıldız`}
          >
            <Star
              className={`h-6 w-6 transition ${
                active ? "fill-amber-400 text-amber-400" : "text-slate-300 dark:text-slate-600"
              }`}
            />
          </button>
        );
      })}

      <span className="ml-1 rounded-full border border-slate-200 bg-white px-2 py-1 text-xs font-black text-slate-600 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-300">
        {value ? `${value}/5` : "Puan yok"}
      </span>

      {value ? (
        <button
          type="button"
          disabled={disabled}
          onClick={() => onChange(undefined)}
          className="rounded-full px-2 py-1 text-[11px] font-bold text-slate-400 hover:bg-slate-100 hover:text-slate-700 disabled:cursor-not-allowed disabled:opacity-50 dark:hover:bg-slate-800 dark:hover:text-slate-200"
        >
          Temizle
        </button>
      ) : null}
    </div>
  );
}

function ToastBar({ toast, onClose }: { toast: ToastState; onClose: () => void }) {
  if (!toast) return null;

  const styles =
    toast.type === "success"
      ? "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900/70 dark:bg-emerald-950/80 dark:text-emerald-100"
      : toast.type === "error"
      ? "border-rose-200 bg-rose-50 text-rose-800 dark:border-rose-900/70 dark:bg-rose-950/80 dark:text-rose-100"
      : "border-indigo-200 bg-indigo-50 text-indigo-800 dark:border-indigo-900/70 dark:bg-indigo-950/80 dark:text-indigo-100";

  const Icon = toast.type === "success" ? CheckCircle2 : toast.type === "error" ? AlertTriangle : Sparkles;

  return (
    <div className="fixed right-4 top-20 z-[80] w-[calc(100%-2rem)] max-w-md">
      <div className={`rounded-2xl border px-4 py-3 shadow-xl backdrop-blur-md ${styles}`}>
        <div className="flex items-start gap-3">
          <Icon className="mt-0.5 h-4 w-4 flex-shrink-0" />
          <p className="flex-1 text-sm font-medium leading-5">{toast.message}</p>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1 opacity-70 hover:bg-black/5 hover:opacity-100 dark:hover:bg-white/10"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

function FormSection({
  title,
  description,
  icon,
  children,
}: {
  title: string;
  description?: string;
  icon?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="rounded-[1.8rem] border border-slate-200/80 bg-white/95 px-4 py-4 shadow-sm ring-1 ring-white/60 dark:border-slate-800/80 dark:bg-slate-950/75 dark:ring-slate-800/40 sm:px-5">
      <div className="mb-4 flex items-start gap-3">
        {icon ? (
          <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-orange-50 text-orange-600 ring-1 ring-orange-100 dark:bg-orange-950/30 dark:text-orange-200 dark:ring-orange-900/50">
            {icon}
          </span>
        ) : null}
        <div className="min-w-0">
          <h2 className="text-sm font-black tracking-tight text-slate-950 dark:text-slate-50">{title}</h2>
          {description ? <p className="mt-1 text-xs leading-5 text-slate-500 dark:text-slate-400">{description}</p> : null}
        </div>
      </div>
      {children}
    </section>
  );
}

function MediaPersonCard({
  person,
  index,
  onPreview,
}: {
  person: MediaPerson | string;
  index: number;
  onPreview: (image: PreviewImage) => void;
}) {
  const [imageError, setImageError] = useState(false);

  const name = getPersonName(person);
  const meta = getPersonMeta(person);
  const imageUrl = !imageError ? getPersonImageUrl(person) : "";
  const originalImageUrl = !imageError ? getPersonImageUrl(person, true) || imageUrl : "";

  return (
    <article className="group rounded-3xl border border-slate-200/80 bg-white p-3 shadow-sm transition hover:-translate-y-0.5 hover:border-orange-200 hover:shadow-md dark:border-slate-800/80 dark:bg-slate-900/70 dark:hover:border-orange-900/70">
      <div className="flex items-center gap-3">
        <button
          type="button"
          disabled={!originalImageUrl}
          onClick={() => originalImageUrl && onPreview({ url: originalImageUrl, title: name, subtitle: meta })}
          className="relative flex h-16 w-14 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-gradient-to-br from-orange-50 to-indigo-50 text-xs font-black text-orange-700 ring-1 ring-slate-200 transition hover:brightness-105 disabled:cursor-default dark:from-slate-800 dark:to-slate-950 dark:text-orange-200 dark:ring-slate-800"
          title={originalImageUrl ? "Fotoğrafı büyüt" : undefined}
        >
          {imageUrl ? (
            <img
              src={imageUrl}
              alt={name}
              className="h-full w-full object-cover block transition duration-300 group-hover:scale-[1.04]"
              loading="lazy"
              referrerPolicy="no-referrer"
              onError={() => setImageError(true)}
            />
          ) : (
            getPersonInitials(name)
          )}
        </button>

        <div className="min-w-0 flex-1">
          <p className="line-clamp-1 text-sm font-black text-slate-900 dark:text-slate-50" dir="auto">{name}</p>
          {meta ? <p className="mt-0.5 line-clamp-2 text-xs leading-5 text-slate-500 dark:text-slate-400" dir="auto">{meta}</p> : null}
        </div>
      </div>
    </article>
  );
}

function CastShowcase({
  people,
  onPreview,
}: {
  people: Array<MediaPerson | string>;
  onPreview: (image: PreviewImage) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const allPeople = Array.isArray(people) ? people.filter(Boolean) : [];
  const visiblePeople = expanded ? allPeople : allPeople.slice(0, 18);

  if (allPeople.length === 0) {
    return <p className="rounded-2xl border border-dashed border-slate-200 bg-white/70 p-5 text-sm font-medium text-slate-500 dark:border-slate-800 dark:bg-slate-950/50 dark:text-slate-400">Oyuncu bilgisi bulunamadı.</p>;
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs font-bold text-slate-500 dark:text-slate-400">
          {allPeople.length} oyuncu listelendi
        </p>
        {allPeople.length > 18 ? (
          <button
            type="button"
            onClick={() => setExpanded((current) => !current)}
            className="rounded-full border border-slate-200 bg-white px-3 py-1 text-[11px] font-black text-slate-600 transition hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-300"
          >
            {expanded ? "Daha az göster" : `Tümünü göster (${allPeople.length})`}
          </button>
        ) : null}
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 2xl:grid-cols-3">
        {visiblePeople.map((person, index) => (
          <MediaPersonCard
            key={`cast-${getPersonName(person)}-${index}`}
            person={person}
            index={index}
            onPreview={onPreview}
          />
        ))}
      </div>
    </div>
  );
}

function ImagePreviewModal({ preview, onClose }: { preview: PreviewImage; onClose: () => void }) {
  if (!preview) return null;

  return (
    <div className="fixed inset-0 z-[120] bg-slate-950/90 p-3 backdrop-blur-md sm:p-6">
      <button type="button" className="absolute inset-0" onClick={onClose} aria-label="Kapat" />

      <div className="relative mx-auto flex h-full max-w-6xl flex-col items-center justify-center gap-4">
        <div className="absolute left-0 top-0 right-0 flex items-start justify-between gap-3">
          <div className="min-w-0 rounded-2xl border border-white/10 bg-white/10 px-4 py-3 text-white shadow-xl backdrop-blur">
            <p className="truncate text-sm font-black">{preview.title}</p>
            {preview.subtitle ? <p className="mt-0.5 truncate text-xs text-white/65">{preview.subtitle}</p> : null}
          </div>

          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/10 text-white backdrop-blur transition hover:bg-white/20"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <img
          src={preview.url}
          alt={preview.title}
          className="max-h-[82vh] max-w-full rounded-3xl object-contain shadow-2xl ring-1 ring-white/10"
          referrerPolicy="no-referrer"
        />
      </div>
    </div>
  );
}

function RatingMetric({ label, value }: { label: string; value?: number }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50/80 px-3 py-2 dark:border-slate-800 dark:bg-slate-950/50">
      <p className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-400">{label}</p>
      <div className="mt-1 flex items-center justify-between gap-2">
        <RatingStars value={value} size="h-3.5 w-3.5" />
        <span className="shrink-0 text-xs font-black text-slate-700 dark:text-slate-200">{value ? `${value}/5` : "-"}</span>
      </div>
    </div>
  );
}

export default function AddMediaPage() {
  const { user } = useAuth();

  const [type, setType] = useState<MediaType>("MOVIE");
  const [queryText, setQueryText] = useState("");
  const [year, setYear] = useState("");

  const [searching, setSearching] = useState(false);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [saving, setSaving] = useState(false);

  const [searchResults, setSearchResults] = useState<MediaSearchResult[]>([]);
  const [selected, setSelected] = useState<MediaDetails | null>(null);

  const [status, setStatus] = useState<WatchStatus>("IZLENECEK");
  const [watchedMinutes, setWatchedMinutes] = useState("");

  const [userRating, setUserRating] = useState<number | undefined>();
  const [expectedRating, setExpectedRating] = useState<number | undefined>();
  const [progressRating, setProgressRating] = useState<number | undefined>();
  const [startDate, setStartDate] = useState(todayInputValue());
  const [completionDate, setCompletionDate] = useState(todayInputValue());
  const [notes, setNotes] = useState("");
  const [shelves, setShelves] = useState<MediaShelf[]>(DEFAULT_SHELVES);
  const [selectedShelfIds, setSelectedShelfIds] = useState<string[]>([]);
  const [newShelfName, setNewShelfName] = useState("");
  const [savingShelf, setSavingShelf] = useState(false);

  const [loadingSeason, setLoadingSeason] = useState(false);
  const [selectedSeasonNumber, setSelectedSeasonNumber] = useState<number | null>(null);
  const [seasonDetails, setSeasonDetails] = useState<TvSeasonDetails | null>(null);
  const [watchedEpisodes, setWatchedEpisodes] = useState<Record<string, TvEpisode>>({});
  const [watchedEpisodesBeforeComplete, setWatchedEpisodesBeforeComplete] = useState<Record<string, TvEpisode> | null>(null);

  const [toast, setToast] = useState<ToastState>(null);
  const [previewImage, setPreviewImage] = useState<PreviewImage>(null);

  const watchedEpisodeList = useMemo(() => getWatchedEpisodeList(watchedEpisodes), [watchedEpisodes]);

  const lastWatchedEpisode = watchedEpisodeList.length > 0 ? watchedEpisodeList[watchedEpisodeList.length - 1] : null;

  const isPlanned = status === "IZLENECEK";
  const isWatching = status === "IZLENIYOR";
  const isCompleted = status === "IZLENDI";
  const isDropped = status === "BIRAKILDI";
  const isStartDateActive = isWatching || isCompleted || isDropped;
  const isCompletionDateActive = isCompleted;
  const expectedEpisodeCount = getExpectedEpisodeCount(selected);
  const isEpisodeSelectionActive = selected?.type === "TV" && isWatching;
  const isMovieMinuteActive = selected?.type === "MOVIE" && isWatching;

  const activeRatingTitle = isPlanned
    ? "Beklenti puanı"
    : isWatching
    ? "Ara puan"
    : isCompleted
    ? "Final puanı"
    : "Bırakma puanı";

  const activeRatingDescription = isPlanned
    ? "İzlemeden önceki beklentini puanla."
    : isWatching
    ? "Şu ana kadar izlediğin kısma göre değerlendir."
    : isCompleted
    ? "Tamamladıktan sonraki genel değerlendirmeyi gir."
    : "İstersen bıraktığın içeriğe son bir puan bırak.";

  const activeRatingValue = isPlanned
    ? expectedRating
    : isWatching
    ? progressRating
    : userRating;

  const activeRatingSetter = isPlanned
    ? setExpectedRating
    : isWatching
    ? setProgressRating
    : setUserRating;

  const overallRating = calculateOverallRating([expectedRating, progressRating, userRating]);
  const selectedShelves = useMemo(
    () => shelves.filter((shelf) => selectedShelfIds.includes(shelf.id)),
    [shelves, selectedShelfIds]
  );

  const isFavorite = selectedShelfIds.includes("favorite");


  const progress = useMemo(() => {
    if (!selected || selected.type !== "MOVIE") return null;

    const runtime = Number(selected.runtime || 0);
    const watched = isCompleted ? runtime : Number(watchedMinutes || 0);

    if (!runtime || runtime <= 0 || !watched || watched <= 0) return null;

    const safeWatched = Math.min(watched, runtime);
    const percent = Math.round((safeWatched / runtime) * 100);
    const remaining = Math.max(0, runtime - safeWatched);

    return { watched: safeWatched, runtime, remaining, percent };
  }, [selected, watchedMinutes, isCompleted]);

  const showToast = (type: ToastType, message: string) => {
    setToast({ type, message });
    window.setTimeout(() => {
      setToast((current) => (current?.message === message ? null : current));
    }, 4200);
  };

  useEffect(() => {
    if (!user) {
      setShelves(DEFAULT_SHELVES);
      setSelectedShelfIds([]);
      return;
    }

    let cancelled = false;

    const loadShelves = async () => {
      try {
        const q = query(collection(db, "mediaShelves"), where("userId", "==", user.uid));
        const snapshot = await getDocs(q);
        const customShelves = snapshot.docs
          .map((document) => ({
            id: document.id,
            name: String(document.data().name || "").trim(),
            isDefault: false,
          }))
          .filter((shelf) => shelf.name);

        if (!cancelled) {
          const merged = [...DEFAULT_SHELVES, ...customShelves].filter(
            (shelf, index, list) =>
              list.findIndex((item) => item.name.toLocaleLowerCase("tr-TR") === shelf.name.toLocaleLowerCase("tr-TR")) === index
          );
          setShelves(merged);
        }
      } catch (err) {
        console.warn("Raflar alınamadı:", err);
      }
    };

    void loadShelves();

    return () => {
      cancelled = true;
    };
  }, [user?.uid]);

  const toggleShelf = (shelfId: string) => {
    setSelectedShelfIds((current) =>
      current.includes(shelfId)
        ? current.filter((id) => id !== shelfId)
        : [...current, shelfId]
    );
  };

  const createShelf = async () => {
    if (!user) return;

    const name = newShelfName.trim();

    if (!name) {
      showToast("error", "Raf adı yazmalısın.");
      return;
    }

    const exists = shelves.some(
      (shelf) => shelf.name.toLocaleLowerCase("tr-TR") === name.toLocaleLowerCase("tr-TR")
    );

    if (exists) {
      showToast("info", "Bu isimde bir raf zaten var.");
      return;
    }

    setSavingShelf(true);

    try {
      const ref = doc(collection(db, "mediaShelves"));
      await setDoc(ref, {
        userId: user.uid,
        name,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      const createdShelf = { id: ref.id, name, isDefault: false };
      setShelves((current) => [...current, createdShelf]);
      setSelectedShelfIds((current) => [...current, ref.id]);
      setNewShelfName("");
      showToast("success", `“${name}” rafı oluşturuldu.`);
    } catch (err: any) {
      showToast("error", err?.message || "Raf oluşturulurken hata oluştu.");
    } finally {
      setSavingShelf(false);
    }
  };

  const deleteShelf = async (shelf: MediaShelf) => {
    if (shelf.isDefault) {
      showToast("info", "Varsayılan raflar silinemez.");
      return;
    }

    try {
      await deleteDoc(doc(db, "mediaShelves", shelf.id));
      setShelves((current) => current.filter((item) => item.id !== shelf.id));
      setSelectedShelfIds((current) => current.filter((id) => id !== shelf.id));
      showToast("success", `“${shelf.name}” rafı silindi.`);
    } catch (err: any) {
      showToast("error", err?.message || "Raf silinirken hata oluştu.");
    }
  };

  const syncStartDate = (value: string) => {
    setStartDate(value);
    setCompletionDate(value);
  };

  const setQuickStartDate = (offsetDays = 0) => {
    const date = new Date();
    date.setDate(date.getDate() + offsetDays);
    syncStartDate(date.toISOString().slice(0, 10));
  };

  const setQuickCompletionDate = (offsetDays = 0) => {
    const date = new Date();
    date.setDate(date.getDate() + offsetDays);
    setCompletionDate(date.toISOString().slice(0, 10));
  };

  const resetFormAfterSave = () => {
    setSelected(null);
    setSearchResults([]);
    setQueryText("");
    setYear("");
    setWatchedMinutes("");
    setSelectedSeasonNumber(null);
    setSeasonDetails(null);
    setWatchedEpisodes({});
    setWatchedEpisodesBeforeComplete(null);
    setUserRating(undefined);
    setExpectedRating(undefined);
    setProgressRating(undefined);
    setNotes("");
    setSelectedShelfIds([]);
    setStatus("IZLENECEK");
    setStartDate(todayInputValue());
    setCompletionDate(todayInputValue());
  };

  if (!user) {
    return (
      <div className="mx-auto mt-10 max-w-xl rounded-3xl border border-amber-200 bg-amber-50 px-5 py-6 dark:border-amber-900/60 dark:bg-amber-950/40">
        <h1 className="mb-1 text-lg font-black text-amber-900 dark:text-amber-100">Giriş gerekli</h1>
        <p className="text-sm text-amber-800/90 dark:text-amber-100/90">Film veya dizi eklemek için önce giriş yapmalısın.</p>
      </div>
    );
  }

  const handleSearch = async () => {
    const q = queryText.trim();

    if (!q) {
      showToast("error", "Film veya dizi adı yazmalısın.");
      return;
    }

    setToast(null);
    setSelected(null);
    setSearchResults([]);
    setSearching(true);

    try {
      const data = await postJson<{ success: boolean; data: MediaSearchResult[]; message?: string }>("/api/media/search", {
        query: q,
        type,
        year: year.trim() || undefined,
      });

      if (!data.success) {
        showToast("error", data.message || "Arama yapılırken hata oluştu.");
        return;
      }

      setSearchResults(data.data || []);

      if (!data.data || data.data.length === 0) {
        showToast("info", "Sonuç bulunamadı. Başlığı veya yılı değiştirerek tekrar dene.");
      } else {
        showToast("success", `${data.data.length} sonuç bulundu. Doğru içeriği seçebilirsin.`);
      }
    } catch (err: any) {
      console.error("Medya arama hatası:", err);
      showToast("error", err?.message || "Film/dizi araması yapılırken hata oluştu.");
    } finally {
      setSearching(false);
    }
  };

  const handleLoadSeason = async (tmdbId: number, seasonNumber: number) => {
    setLoadingSeason(true);

    try {
      const data = await postJson<{ success: boolean; data: TvSeasonDetails; message?: string }>("/api/media/tv-season", {
        tmdbId,
        seasonNumber,
      });

      if (!data.success) {
        showToast("error", data.message || "Sezon bölümleri alınamadı.");
        return;
      }

      setSelectedSeasonNumber(seasonNumber);
      setSeasonDetails(data.data);
    } catch (err: any) {
      console.error("Sezon detay hatası:", err);
      showToast("error", err?.message || "Sezon bölümleri alınırken hata oluştu.");
    } finally {
      setLoadingSeason(false);
    }
  };

  const selectAllTvEpisodes = async () => {
    if (!selected || selected.type !== "TV") return;

    const seasonList = selected.seasons || [];

    if (seasonList.length === 0) {
      showToast("error", "Bu dizi için sezon bilgisi bulunamadı.");
      return;
    }

    setLoadingSeason(true);

    try {
      const allEpisodes: Record<string, TvEpisode> = {};

      for (const season of seasonList) {
        const data = await postJson<{ success: boolean; data: TvSeasonDetails; message?: string }>("/api/media/tv-season", {
          tmdbId: selected.tmdbId,
          seasonNumber: season.seasonNumber,
        });

        if (!data.success) throw new Error(data.message || `Sezon ${season.seasonNumber} bölümleri alınamadı.`);

        data.data.episodes.forEach((episode) => {
          allEpisodes[episodeKey(episode.seasonNumber, episode.episodeNumber)] = episode;
        });
      }

      setWatchedEpisodes(allEpisodes);

      const firstSeason = seasonList[0]?.seasonNumber || 1;
      const activeSeason = selectedSeasonNumber || firstSeason;
      await handleLoadSeason(selected.tmdbId, activeSeason);
    } catch (err: any) {
      console.error("Tüm bölümleri seçme hatası:", err);
      showToast("error", err?.message || "Tüm bölümler seçilirken hata oluştu.");
    } finally {
      setLoadingSeason(false);
    }
  };

  const handleStatusChange = (nextStatus: WatchStatus) => {
    const previousStatus = status;

    if (selected?.type === "TV" && nextStatus === "IZLENDI" && previousStatus !== "IZLENDI") {
      setWatchedEpisodesBeforeComplete(watchedEpisodes);
    }

    setStatus(nextStatus);

    if (nextStatus === "IZLENIYOR" || nextStatus === "IZLENDI" || nextStatus === "BIRAKILDI") {
      setStartDate((current) => current || todayInputValue());
    }

    if (nextStatus === "IZLENDI") {
      setCompletionDate((current) => current || startDate || todayInputValue());

      if (selected?.type === "MOVIE") {
        setWatchedMinutes(String(selected.runtime || ""));
      }

      if (selected?.type === "TV") {
        void selectAllTvEpisodes();
      }
    }

    if (selected?.type === "TV" && previousStatus === "IZLENDI" && nextStatus !== "IZLENDI") {
      if (watchedEpisodesBeforeComplete) setWatchedEpisodes(watchedEpisodesBeforeComplete);
      setWatchedEpisodesBeforeComplete(null);
    }

    if (nextStatus === "IZLENECEK") {
      setWatchedMinutes("");
    }
  };

  const toggleEpisodeWatched = (episode: TvEpisode) => {
    if (!isEpisodeSelectionActive) {
      showToast("info", "Bölüm seçmek için durumu İzleniyor yapmalısın. İzlendi seçilirse tüm bölümler otomatik seçilir.");
      return;
    }

    const key = episodeKey(episode.seasonNumber, episode.episodeNumber);

    setWatchedEpisodes((prev) => {
      const copy = { ...prev };

      if (copy[key]) delete copy[key];
      else copy[key] = episode;

      const nextCount = Object.keys(copy).length;
      const expected = getExpectedEpisodeCount(selected);

      if (selected?.type === "TV" && expected > 0 && nextCount >= expected) {
        setWatchedEpisodesBeforeComplete(prev);
        window.setTimeout(() => {
          setStatus("IZLENDI");
          setCompletionDate((current) => current || startDate || todayInputValue());
          showToast("success", "Tüm bölümler seçildi. Dizi izlendi olarak işaretlendi.");
        }, 0);
      }

      return copy;
    });
  };

  const handleSelectResult = async (item: MediaSearchResult) => {
    setToast(null);

    const quickDetails: MediaDetails = {
      tmdbId: item.tmdbId,
      type: item.type,
      title: item.title,
      originalTitle: item.originalTitle || "",
      year: item.year || "",
      overview: item.overview || "",
      posterUrl: item.posterUrl || "",
      backdropUrl: item.backdropUrl || "",
      tmdbRating: item.tmdbRating ?? null,
      genres: [],
      platforms: [],
      cast: [],
      castDetails: [],
    };

    setSelected(quickDetails);
    setStatus("IZLENECEK");
    setWatchedMinutes("");
    setUserRating(undefined);
    setExpectedRating(undefined);
    setProgressRating(undefined);
    setNotes("");
    setSelectedShelfIds([]);
    setStartDate(todayInputValue());
    setCompletionDate(todayInputValue());
    setSelectedSeasonNumber(null);
    setSeasonDetails(null);
    setWatchedEpisodes({});
    setWatchedEpisodesBeforeComplete(null);
    setLoadingDetails(true);

    try {
      const data = await postJson<{ success: boolean; data: MediaDetails; message?: string }>("/api/media/details", {
        tmdbId: item.tmdbId,
        type: item.type,
      });

      if (!data.success) {
        showToast("error", data.message || "Detaylar alınamadı.");
        return;
      }

      const details = data.data;

      setSelected({
        ...quickDetails,
        ...details,
        title: details.title || quickDetails.title,
        overview: details.overview || quickDetails.overview,
        posterUrl: details.posterUrl || quickDetails.posterUrl,
        backdropUrl: details.backdropUrl || quickDetails.backdropUrl,
        tmdbRating: details.tmdbRating ?? quickDetails.tmdbRating,
      });
      showToast("success", "Detaylar hızlıca getirildi. Durumu seçip kaydedebilirsin.");

      if (details.type === "TV") {
        const firstSeason = details.seasons?.[0]?.seasonNumber || 1;
        setSelectedSeasonNumber(firstSeason);
        void handleLoadSeason(details.tmdbId, firstSeason);
      }
    } catch (err: any) {
      console.error("Medya detay hatası:", err);
      showToast("error", err?.message || "Detaylar alınırken hata oluştu.");
    } finally {
      setLoadingDetails(false);
    }
  };

  const buildMediaPayload = (): Omit<MediaItem, "id"> & Record<string, any> => {
    if (!user || !selected) throw new Error("Kullanıcı veya medya seçimi eksik.");

    const now = new Date().toISOString();
    const isMovie = selected.type === "MOVIE";

    const runtime =
      selected.runtime !== undefined && selected.runtime !== null && Number.isFinite(Number(selected.runtime))
        ? Number(selected.runtime)
        : undefined;

    const watched =
      isMovie && status === "IZLENDI"
        ? runtime
        : isMovie && status === "IZLENIYOR"
        ? Number(watchedMinutes || 0) || undefined
        : undefined;

    const castDetails = normalizeCastDetailsForSave(selected.castDetails, selected.cast);
    const actionDescription =
      status === "IZLENDI"
        ? selected.type === "TV"
          ? `${selected.title} izlendi olarak eklendi; ${watchedEpisodeList.length} bölüm işaretlendi.`
          : `${selected.title} izlendi olarak eklendi.`
        : status === "IZLENIYOR"
        ? selected.type === "TV"
          ? `${selected.title} izleniyor olarak eklendi; ${watchedEpisodeList.length} bölüm seçildi.`
          : `${selected.title} izleniyor olarak eklendi.`
        : `${selected.title} ${statusLabel(status).toLocaleLowerCase("tr-TR")} olarak eklendi.`;

    return {
      userId: user.uid,
      type: selected.type,
      title: selected.title,
      originalTitle: selected.originalTitle || "",
      year: selected.year || "",
      overview: selected.overview || "",
      posterUrl: selected.posterUrl || "",
      backdropUrl: selected.backdropUrl || "",
      trailerUrl: selected.trailerUrl || "",
      tmdbId: selected.tmdbId,
      imdbId: selected.imdbId || "",
      genres: selected.genres || [],
      platforms: selected.platforms || [],
      tmdbRating:
        selected.tmdbRating !== undefined && selected.tmdbRating !== null && Number.isFinite(Number(selected.tmdbRating))
          ? Number(selected.tmdbRating)
          : undefined,
      imdbRating:
        selected.imdbRating !== undefined && selected.imdbRating !== null && Number.isFinite(Number(selected.imdbRating))
          ? Number(selected.imdbRating)
          : undefined,
      status,
      runtime,
      watchedMinutes: watched,
      numberOfSeasons:
        selected.numberOfSeasons !== undefined && selected.numberOfSeasons !== null
          ? Number(selected.numberOfSeasons)
          : undefined,
      numberOfEpisodes:
        selected.numberOfEpisodes !== undefined && selected.numberOfEpisodes !== null
          ? Number(selected.numberOfEpisodes)
          : undefined,
      currentSeason: selected.type === "TV" && lastWatchedEpisode ? lastWatchedEpisode.seasonNumber : undefined,
      currentEpisode: selected.type === "TV" && lastWatchedEpisode ? lastWatchedEpisode.episodeNumber : undefined,
      watchedEpisodes:
        selected.type === "TV"
          ? watchedEpisodeList.map((episode) => ({
              seasonNumber: episode.seasonNumber,
              episodeNumber: episode.episodeNumber,
              title: episode.title,
              runtime: episode.runtime || null,
              watchedAt: status === "IZLENDI" ? completionDate : startDate,
            }))
          : undefined,
      watchedEpisodeCount: selected.type === "TV" ? watchedEpisodeList.length : undefined,
      director: selected.director || "",
      creators: selected.creators || [],
      cast: (castDetails.length
        ? castDetails.map((person) => person.name).filter(Boolean)
        : (selected.cast || []).map(getPersonName).filter(Boolean)) as any,
      castDetails: castDetails as any,
      userRating: typeof userRating === "number" ? userRating : undefined,
      expectedRating: typeof expectedRating === "number" ? expectedRating : undefined,
      progressRating: typeof progressRating === "number" ? progressRating : undefined,
      overallRating: typeof overallRating === "number" ? overallRating : undefined,
      notes: notes.trim(),
      isFavorite,
      shelves: selectedShelves.map((shelf) => shelf.name),
      shelfIds: selectedShelfIds,
      favoriteShelf: isFavorite ? "Favoriler" : selectedShelves[0]?.name || "",
      favoriteAddedAt: isFavorite ? now : undefined,
      startedAt: status === "IZLENIYOR" || status === "IZLENDI" || status === "BIRAKILDI" ? startDate : undefined,
      watchedAt: status === "IZLENDI" ? completionDate : undefined,
      completedAt: status === "IZLENDI" ? completionDate : undefined,
      createdAt: now,
      updatedAt: now,
      lastActionAt: now,
      lastActionDescription: actionDescription,
      actionHistory: [
        {
          type: "CREATE",
          description: actionDescription,
          actionAt: now,
        },
      ],
    };
  };

  const createWatchLogIfNeeded = async (mediaId: string, media: MediaItem) => {
    if (!user || !selected) return;
    if (status !== "IZLENDI" && status !== "IZLENIYOR") return;

    const date = status === "IZLENDI" ? completionDate : startDate || todayInputValue();

    if (selected.type === "TV") {
      for (const episode of watchedEpisodeList) {
        const cleanLog = removeUndefinedDeep({
          userId: user.uid,
          mediaId,
          mediaType: selected.type,
          title: selected.title,
          date,
          monthKey: getMonthKey(date),
          minutes: Number(episode.runtime || selected.runtime || 0) || 0,
          completed: true,
          seasonNumber: episode.seasonNumber,
          episodeNumber: episode.episodeNumber,
          episodeTitle: episode.title,
          genres: selected.genres || [],
          platform: media.platforms?.[0] || "",
        });

        await addDoc(collection(db, "watchLogs"), {
          ...cleanLog,
          createdAt: serverTimestamp(),
          actionAt: serverTimestamp(),
        });
      }

      return;
    }

    let minutes = 0;
    let completed = false;

    if (status === "IZLENDI") {
      minutes = Number(selected.runtime || 0);
      completed = true;
    } else {
      minutes = Number(watchedMinutes || 0) || 0;
      completed = false;
    }

    if (minutes <= 0) return;

    const cleanLog = removeUndefinedDeep({
      userId: user.uid,
      mediaId,
      mediaType: selected.type,
      title: selected.title,
      date,
      monthKey: getMonthKey(date),
      minutes,
      completed,
      seasonNumber: null,
      episodeNumber: null,
      genres: selected.genres || [],
      platform: media.platforms?.[0] || "",
    });

    await addDoc(collection(db, "watchLogs"), {
      ...cleanLog,
      createdAt: serverTimestamp(),
      actionAt: serverTimestamp(),
    });
  };

  const handleSave = async () => {
    if (!user) {
      showToast("error", "Kayıt yapmak için giriş yapmalısın.");
      return;
    }

    if (!selected) {
      showToast("error", "Önce film veya dizi seçmelisin.");
      return;
    }

    if (selected.type === "MOVIE" && status === "IZLENIYOR") {
      const watched = Number(watchedMinutes || 0);
      const runtime = Number(selected.runtime || 0);

      if (!watched || watched <= 0) {
        showToast("error", "İzleniyor durumunda kaçıncı dakikada kaldığını yazmalısın.");
        return;
      }

      if (runtime && watched > runtime) {
        showToast("error", "İzlenen dakika toplam süreden büyük olamaz.");
        return;
      }
    }

    if (selected.type === "TV" && status === "IZLENIYOR" && watchedEpisodeList.length === 0) {
      showToast("error", "İzleniyor durumunda dizi için izlediğin bölümleri seçmelisin.");
      return;
    }

    if (selected.type === "TV" && status === "IZLENDI" && expectedEpisodeCount > 0 && watchedEpisodeList.length < expectedEpisodeCount) {
      showToast("info", "İzlendi seçildiğinde tüm bölümler otomatik seçilir. Lütfen tekrar kaydet.");
      await selectAllTvEpisodes();
      return;
    }

    setSaving(true);
    setToast(null);

    try {
      const payload = buildMediaPayload();
      const cleanPayload = removeUndefinedDeep(payload);

      const mediaDocId = getMediaDocumentId(user.uid, selected.type, selected.tmdbId);
      const mediaDocRef = doc(db, "mediaItems", mediaDocId);
      const existingMedia = await getDoc(mediaDocRef);

      const duplicateQuery = query(collection(db, "mediaItems"), where("userId", "==", user.uid));
      const duplicateSnapshot = await getDocs(duplicateQuery);
      const hasDuplicate = duplicateSnapshot.docs.some((document) => {
        const data = document.data() as Partial<MediaItem>;
        return document.id !== mediaDocId && data.type === selected.type && Number(data.tmdbId) === Number(selected.tmdbId);
      });

      if (existingMedia.exists() || hasDuplicate) {
        showToast("error", "Bu film/dizi zaten kütüphanende var. Aynı içerik ikinci kez eklenemez.");
        return;
      }

      await setDoc(mediaDocRef, {
        ...cleanPayload,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        lastActionAt: serverTimestamp(),
        lastViewedAt: null,
      });

      await createWatchLogIfNeeded(mediaDocRef.id, {
        id: mediaDocRef.id,
        ...cleanPayload,
      } as MediaItem);

      showToast("success", "Film/dizi başarıyla kaydedildi.");
      resetFormAfterSave();
    } catch (err: any) {
      console.error("Medya kayıt hatası:", err);
      showToast("error", err?.message || "Kayıt yapılırken hata oluştu.");
    } finally {
      setSaving(false);
    }
  };

  const resetForType = (nextType: MediaType) => {
    setType(nextType);
    setSelected(null);
    setSearchResults([]);
    setSeasonDetails(null);
    setWatchedEpisodes({});
    setSelectedSeasonNumber(null);
    setToast(null);
  };

  return (
    <div className="mx-auto max-w-7xl space-y-6 px-0 pb-10">
      <ToastBar toast={toast} onClose={() => setToast(null)} />
      <ImagePreviewModal preview={previewImage} onClose={() => setPreviewImage(null)} />

      <section className="relative overflow-hidden rounded-[2rem] border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-950">
        <div className="pointer-events-none absolute -right-24 -top-24 h-80 w-80 rounded-full bg-orange-500/10 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-28 -left-24 h-80 w-80 rounded-full bg-indigo-500/10 blur-3xl" />

        <div className="relative grid grid-cols-1 gap-5 p-4 sm:p-5 lg:grid-cols-[minmax(0,1fr)_340px] lg:p-6">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-orange-100 bg-orange-50 px-3 py-1 text-[11px] font-black text-orange-700 dark:border-orange-900/60 dark:bg-orange-950/30 dark:text-orange-200">
              <Sparkles className="h-4 w-4" />
              Profesyonel medya ekleme paneli
            </div>

            <h1 className="mt-3 max-w-3xl text-2xl font-black tracking-tight text-slate-950 dark:text-white sm:text-3xl lg:text-4xl">
              Film veya diziyi seç, izleme rafına şık biçimde ekle.
            </h1>

            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500 dark:text-slate-400">
              Arama sonuçları daha sade listelenir; seçimden sonra poster, konu, oyuncu kadrosu, sezon/bölüm ve puanlama alanları tek ekranda düzenli şekilde açılır.
            </p>
          </div>

          <div className="rounded-[1.6rem] border border-slate-200 bg-slate-50 p-2 dark:border-slate-800 dark:bg-slate-900/80">
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => resetForType("MOVIE")}
                className={`inline-flex items-center justify-center gap-2 rounded-2xl px-4 py-3 text-sm font-black transition ${
                  type === "MOVIE"
                    ? "bg-orange-600 text-white shadow-sm"
                    : "text-slate-500 hover:bg-white dark:text-slate-400 dark:hover:bg-slate-800"
                }`}
              >
                <Film className="h-4 w-4" />
                Film
              </button>

              <button
                type="button"
                onClick={() => resetForType("TV")}
                className={`inline-flex items-center justify-center gap-2 rounded-2xl px-4 py-3 text-sm font-black transition ${
                  type === "TV"
                    ? "bg-purple-600 text-white shadow-sm"
                    : "text-slate-500 hover:bg-white dark:text-slate-400 dark:hover:bg-slate-800"
                }`}
              >
                <Tv className="h-4 w-4" />
                Dizi
              </button>
            </div>

            <div className="mt-2 rounded-2xl border border-slate-200 bg-white px-3 py-2 text-xs leading-5 text-slate-500 dark:border-slate-800 dark:bg-slate-950/70 dark:text-slate-400">
              {type === "MOVIE" ? "Film için başlık ve varsa yıl yaz. Poster isim alanının üstüne binmez; sonuçlar temiz kartlarla gelir." : "Dizi için doğru sonucu seçtiğinde sezon ve bölüm alanları otomatik hazırlanır."}
            </div>
          </div>
        </div>

        <div className="relative border-t border-slate-200 bg-slate-50/80 p-3 dark:border-slate-800 dark:bg-slate-900/60 sm:p-4 lg:p-5">
          <div className="grid grid-cols-1 gap-3 lg:grid-cols-[220px_minmax(0,1fr)_140px_132px]">
            <div className="grid grid-cols-2 gap-2 rounded-2xl border border-slate-200 bg-white p-1.5 dark:border-slate-800 dark:bg-slate-950">
              <button
                type="button"
                onClick={() => resetForType("MOVIE")}
                className={`inline-flex h-11 items-center justify-center gap-2 rounded-xl text-xs font-black transition ${type === "MOVIE" ? "bg-slate-950 text-white dark:bg-white dark:text-slate-950" : "text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-900"}`}
              >
                <Film className="h-3.5 w-3.5" />
                Film
              </button>
              <button
                type="button"
                onClick={() => resetForType("TV")}
                className={`inline-flex h-11 items-center justify-center gap-2 rounded-xl text-xs font-black transition ${type === "TV" ? "bg-slate-950 text-white dark:bg-white dark:text-slate-950" : "text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-900"}`}
              >
                <Tv className="h-3.5 w-3.5" />
                Dizi
              </button>
            </div>

            <div className="relative">
              <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                value={queryText}
                onChange={(e) => setQueryText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    void handleSearch();
                  }
                }}
                placeholder={type === "MOVIE" ? "Film adı yaz: Uyku, Inception, Forgotten..." : "Dizi adı yaz: Dark, Bahçıvan, Breaking Bad..."}
                className="h-14 w-full rounded-2xl border border-slate-200 bg-white pl-11 pr-4 text-sm font-semibold text-slate-900 shadow-sm outline-none transition focus:border-orange-400 focus:ring-4 focus:ring-orange-500/10 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-50"
              />
            </div>

            <input
              value={year}
              onChange={(e) => setYear(e.target.value)}
              placeholder="Yıl"
              className="h-14 rounded-2xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-900 shadow-sm outline-none transition focus:border-orange-400 focus:ring-4 focus:ring-orange-500/10 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-50"
            />

            <button
              type="button"
              onClick={handleSearch}
              disabled={searching}
              className="inline-flex h-14 items-center justify-center rounded-2xl bg-orange-600 px-5 text-sm font-black text-white shadow-sm transition hover:bg-orange-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {searching ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Search className="mr-2 h-4 w-4" />}
              Ara
            </button>
          </div>
        </div>
      </section>

      {searchResults.length > 0 && (
        <section className="rounded-[2rem] border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-950 sm:p-5">
          <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h2 className="text-sm font-black text-slate-900 dark:text-slate-50">Arama sonuçları</h2>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                Poster ve isim artık ayrı alanlarda; doğru içeriği seçtiğinde detay kartı aşağıda profesyonel şekilde açılır.
              </p>
            </div>
            <span className="w-fit rounded-full bg-slate-100 px-3 py-1 text-xs font-black text-slate-500 dark:bg-slate-900 dark:text-slate-300">
              {searchResults.length} sonuç
            </span>
          </div>

          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
            {searchResults.map((result) => (
              <button
                key={`${result.type}-${result.tmdbId}`}
                type="button"
                onClick={() => handleSelectResult(result)}
                disabled={loadingDetails}
                className="group rounded-[1.6rem] border border-slate-200 bg-slate-50 p-3 text-left transition hover:-translate-y-0.5 hover:border-orange-300 hover:bg-white hover:shadow-md disabled:cursor-wait disabled:opacity-70 dark:border-slate-800 dark:bg-slate-900/70 dark:hover:border-orange-800 dark:hover:bg-slate-900"
              >
                <div className="grid grid-cols-[74px_minmax(0,1fr)] gap-3">
                  <div className="h-[108px] w-[74px] overflow-hidden rounded-2xl bg-slate-200 shadow-sm ring-1 ring-slate-200 dark:bg-slate-800 dark:ring-slate-800">
                    {result.posterUrl ? (
                      <img src={result.posterUrl} alt={result.title} className="h-full w-full object-cover transition duration-300 group-hover:scale-[1.04]" />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-slate-400">
                        <ImageIcon className="h-5 w-5" />
                      </div>
                    )}
                  </div>

                  <div className="min-w-0 py-1">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="rounded-full bg-slate-900 px-2 py-0.5 text-[10px] font-black text-white dark:bg-white dark:text-slate-950">
                        {mediaTypeLabel(result.type)}
                      </span>
                      {result.year ? <span className="rounded-full bg-white px-2 py-0.5 text-[10px] font-black text-slate-500 dark:bg-slate-950 dark:text-slate-300">{result.year}</span> : null}
                      {result.tmdbRating ? <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-black text-amber-700 dark:bg-amber-950/40 dark:text-amber-200">TMDb {result.tmdbRating}/10</span> : null}
                    </div>

                    <p className="mt-2 line-clamp-2 text-base font-black leading-5 text-slate-900 dark:text-slate-50">{result.title}</p>
                    {result.originalTitle && result.originalTitle !== result.title ? <p className="mt-0.5 line-clamp-1 text-xs text-slate-400">{result.originalTitle}</p> : null}
                    {result.overview ? <p className="mt-2 line-clamp-2 text-xs leading-5 text-slate-500 dark:text-slate-400">{result.overview}</p> : null}

                    <div className="mt-3 inline-flex items-center rounded-full bg-orange-600 px-3 py-1 text-[11px] font-black text-white opacity-0 transition group-hover:opacity-100">
                      Seç ve detayları yükle
                    </div>
                  </div>
                </div>
              </button>
            ))}
          </div>
        </section>
      )}

      <form
        onSubmit={(e) => {
          e.preventDefault();
          void handleSave();
        }}
        className="rounded-[2rem] border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-950 sm:p-5 lg:p-6"
      >
        {!selected ? (
          <div className="rounded-[1.7rem] border border-dashed border-slate-300 bg-slate-50 p-10 text-center dark:border-slate-800 dark:bg-slate-900/50">
            <Film className="mx-auto mb-3 h-10 w-10 text-slate-300" />
            <p className="text-base font-black text-slate-800 dark:text-slate-100">Henüz içerik seçilmedi</p>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Önce film veya dizi ara, ardından sonuçlardan birini seç.</p>
          </div>
        ) : (
          <div className="space-y-6">
            {loadingDetails ? (
              <div className="flex items-center gap-3 rounded-[1.5rem] border border-orange-200 bg-orange-50 px-4 py-3 text-sm font-semibold text-orange-800 dark:border-orange-900/60 dark:bg-orange-950/30 dark:text-orange-100">
                <Loader2 className="h-4 w-4 animate-spin" />
                Detaylar hızlı modda yükleniyor; poster ve temel bilgiler açık, oyuncular birazdan tamamlanacak.
              </div>
            ) : null}

            <section className="relative isolate overflow-hidden rounded-[2rem] border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-950 sm:p-5 lg:p-6">
              {selected.backdropUrl ? (
                <img
                  src={selected.backdropUrl}
                  alt=""
                  aria-hidden="true"
                  className="absolute inset-0 -z-20 h-full w-full object-cover opacity-[0.08] dark:opacity-[0.10]"
                />
              ) : null}
              <div className="absolute inset-0 -z-10 bg-gradient-to-br from-white via-slate-50/95 to-orange-50/70 dark:from-slate-950 dark:via-slate-950/95 dark:to-slate-900" />

              <div className="grid grid-cols-1 gap-5 lg:grid-cols-[210px_minmax(0,1fr)] lg:items-start">
                <div className="flex flex-col items-center gap-3 lg:items-start">
                  <button
                    type="button"
                    onClick={() => selected.posterUrl && setPreviewImage({ url: toOriginalTmdbImage(selected.posterUrl), title: selected.title, subtitle: "Poster" })}
                    className="relative h-[300px] w-[205px] overflow-hidden rounded-[1.8rem] border border-white bg-slate-200 shadow-2xl ring-1 ring-slate-200 transition hover:-translate-y-0.5 hover:shadow-orange-500/10 dark:border-slate-800 dark:bg-slate-800 dark:ring-slate-700"
                    title="Posteri büyüt"
                  >
                    {selected.posterUrl ? (
                      <img src={selected.posterUrl} alt={selected.title} className="h-full w-full object-cover" />
                    ) : (
                      <span className="flex h-full items-center justify-center text-xs font-medium text-slate-400">Poster yok</span>
                    )}
                    <span className="absolute bottom-3 left-1/2 -translate-x-1/2 rounded-full bg-slate-950/75 px-3 py-1 text-[10px] font-black text-white opacity-0 backdrop-blur transition group-hover:opacity-100">
                      Büyüt
                    </span>
                  </button>

                  <div className="flex flex-wrap items-center justify-center gap-2 lg:justify-start">
                    <span className="rounded-full bg-slate-950 px-3 py-1 text-xs font-black text-white dark:bg-white dark:text-slate-950">
                      {mediaTypeLabel(selected.type)}
                    </span>
                    {selected.year ? (
                      <span className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-black text-slate-600 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300">
                        {selected.year}
                      </span>
                    ) : null}
                  </div>
                </div>

                <div className="min-w-0 space-y-4">
                  <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
                    <div className="min-w-0">
                      <p className="mb-2 text-[11px] font-black uppercase tracking-[0.16em] text-orange-600 dark:text-orange-300">Seçilen içerik</p>
                      <h2 className="break-words text-3xl font-black tracking-tight text-slate-950 dark:text-white sm:text-4xl">{selected.title}</h2>
                      {selected.originalTitle && selected.originalTitle !== selected.title ? (
                        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400" dir="auto">{selected.originalTitle}</p>
                      ) : null}
                    </div>

                    {loadingDetails ? (
                      <span className="inline-flex w-fit items-center gap-2 rounded-full border border-orange-200 bg-orange-50 px-3 py-1 text-xs font-black text-orange-700 dark:border-orange-900/60 dark:bg-orange-950/30 dark:text-orange-200">
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        Detaylar yükleniyor
                      </span>
                    ) : null}
                  </div>

                  {selected.overview ? (
                    <p className="max-w-4xl text-sm leading-6 text-slate-600 dark:text-slate-300">{selected.overview}</p>
                  ) : null}

                  <div className="flex flex-wrap gap-2">
                    {(selected.genres || []).map((genre) => (
                      <span key={genre} className="rounded-full border border-slate-200 bg-white px-2.5 py-1 text-xs font-bold text-slate-600 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300">
                        {genre}
                      </span>
                    ))}
                  </div>

                  <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                    <div className="rounded-2xl border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-900/80">
                      <p className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-400">TMDb</p>
                      <p className="mt-1 text-sm font-black text-slate-900 dark:text-slate-50">{selected.tmdbRating ? `${selected.tmdbRating}/10` : "-"}</p>
                    </div>
                    <div className="rounded-2xl border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-900/80">
                      <p className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-400">Süre</p>
                      <p className="mt-1 text-sm font-black text-slate-900 dark:text-slate-50">
                        {selected.type === "MOVIE" ? (selected.runtime ? `${selected.runtime} dk` : "-") : `${selected.numberOfSeasons || 0} sezon`}
                      </p>
                    </div>
                    <div className="rounded-2xl border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-900/80">
                      <p className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-400">Bölüm</p>
                      <p className="mt-1 text-sm font-black text-slate-900 dark:text-slate-50">{selected.type === "TV" ? selected.numberOfEpisodes || 0 : "-"}</p>
                    </div>
                    <div className="rounded-2xl border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-900/80">
                      <p className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-400">Genel</p>
                      <p className="mt-1 text-sm font-black text-slate-900 dark:text-slate-50">{overallRating ? `${overallRating}/5` : "-"}</p>
                    </div>
                  </div>

                  {selected.trailerUrl ? (
                    <a
                      href={selected.trailerUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-2 rounded-full bg-rose-600 px-4 py-2 text-xs font-black text-white shadow-sm transition hover:bg-rose-700"
                    >
                      <Play className="h-4 w-4" />
                      Fragmanı aç
                      <ExternalLink className="h-3.5 w-3.5" />
                    </a>
                  ) : null}
                </div>
              </div>
            </section>

            <div className="grid grid-cols-1 gap-5 xl:grid-cols-[420px_minmax(0,1fr)]">
              <div className="space-y-5 xl:sticky xl:top-5 xl:self-start">
                <FormSection title="İzleme durumu" description="Seçtiğin duruma göre tarih, puan ve ilerleme alanları otomatik değişir." icon={<Sparkles className="h-4 w-4" />}>
                  <div className="grid grid-cols-2 gap-2">
                    {(["IZLENECEK", "IZLENIYOR", "IZLENDI", "BIRAKILDI"] as WatchStatus[]).map((s) => (
                      <button
                        key={s}
                        type="button"
                        onClick={() => handleStatusChange(s)}
                        className={`rounded-2xl border px-3 py-3 text-sm font-black transition ${
                          status === s
                            ? "border-indigo-500 bg-indigo-600 text-white shadow-sm"
                            : "border-slate-200 bg-slate-50 text-slate-600 hover:border-indigo-300 hover:bg-white dark:border-slate-800 dark:bg-slate-950/70 dark:text-slate-300 dark:hover:border-indigo-800 dark:hover:bg-slate-900"
                        }`}
                      >
                        {statusLabel(s)}
                      </button>
                    ))}
                  </div>

                  <div className="mt-3 rounded-2xl border border-slate-200 bg-slate-50 px-3 py-3 text-xs leading-5 text-slate-500 dark:border-slate-800 dark:bg-slate-950/60 dark:text-slate-400">
                    <Info className="mr-1 inline h-3.5 w-3.5" />
                    {statusDescription(status)}
                  </div>
                </FormSection>

                <FormSection title={activeRatingTitle} description={activeRatingDescription} icon={<Star className="h-4 w-4" />}>
                  <StarRating value={activeRatingValue} onChange={activeRatingSetter} />

                  <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-3 xl:grid-cols-1">
                    <RatingMetric label="Beklenti" value={expectedRating} />
                    <RatingMetric label="Ara puan" value={progressRating} />
                    <RatingMetric label="Final" value={userRating} />
                  </div>

                  <div className="mt-3 rounded-2xl border border-indigo-100 bg-indigo-50 p-3 dark:border-indigo-900/70 dark:bg-indigo-950/30">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-[11px] font-black uppercase tracking-[0.14em] text-indigo-700 dark:text-indigo-200">Genel puan sonucu</p>
                        <p className="mt-1 text-[11px] leading-4 text-indigo-700/80 dark:text-indigo-100/80">Girilen puanların ortalaması.</p>
                      </div>
                      <div className="text-right">
                        <RatingStars value={overallRating} />
                        <p className="mt-1 text-xs font-black text-indigo-950 dark:text-indigo-100">{overallRating ? `${overallRating}/5` : "Yok"}</p>
                      </div>
                    </div>
                  </div>
                </FormSection>

                <FormSection title="Tarih ve ilerleme" description="Başlangıç/tamamlama tarihleri raporlara işlenir." icon={<CalendarDays className="h-4 w-4" />}>
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-1">
                    <div className={isStartDateActive ? "" : "opacity-50"}>
                      <label className="block text-xs font-bold text-slate-500 dark:text-slate-300">Başlangıç tarihi</label>
                      <input
                        type="date"
                        value={startDate}
                        disabled={!isStartDateActive}
                        onClick={(e) => isStartDateActive && (e.currentTarget as HTMLInputElement & { showPicker?: () => void }).showPicker?.()}
                        onFocus={(e) => isStartDateActive && (e.currentTarget as HTMLInputElement & { showPicker?: () => void }).showPicker?.()}
                        onChange={(e) => syncStartDate(e.target.value)}
                        className="mt-1.5 w-full cursor-pointer rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm font-medium text-slate-900 outline-none [color-scheme:light] focus:border-indigo-400 focus:ring-4 focus:ring-indigo-500/10 disabled:cursor-not-allowed dark:border-slate-800 dark:bg-slate-950/70 dark:text-slate-50 dark:[color-scheme:dark]"
                      />
                      {isStartDateActive ? (
                        <div className="mt-2 flex gap-2">
                          <button type="button" onClick={() => setQuickStartDate(0)} className="rounded-full bg-slate-100 px-3 py-1 text-[11px] font-bold text-slate-600 dark:bg-slate-800 dark:text-slate-300">Bugün</button>
                          <button type="button" onClick={() => setQuickStartDate(-1)} className="rounded-full bg-slate-100 px-3 py-1 text-[11px] font-bold text-slate-600 dark:bg-slate-800 dark:text-slate-300">Dün</button>
                        </div>
                      ) : null}
                    </div>

                    <div className={isCompletionDateActive ? "" : "opacity-50"}>
                      <label className="block text-xs font-bold text-slate-500 dark:text-slate-300">Tamamlama tarihi</label>
                      <input
                        type="date"
                        value={completionDate}
                        disabled={!isCompletionDateActive}
                        onClick={(e) => isCompletionDateActive && (e.currentTarget as HTMLInputElement & { showPicker?: () => void }).showPicker?.()}
                        onFocus={(e) => isCompletionDateActive && (e.currentTarget as HTMLInputElement & { showPicker?: () => void }).showPicker?.()}
                        onChange={(e) => setCompletionDate(e.target.value)}
                        className="mt-1.5 w-full cursor-pointer rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm font-medium text-slate-900 outline-none [color-scheme:light] focus:border-indigo-400 focus:ring-4 focus:ring-indigo-500/10 disabled:cursor-not-allowed dark:border-slate-800 dark:bg-slate-950/70 dark:text-slate-50 dark:[color-scheme:dark]"
                      />
                      {isCompletionDateActive ? (
                        <div className="mt-2 flex gap-2">
                          <button type="button" onClick={() => setQuickCompletionDate(0)} className="rounded-full bg-slate-100 px-3 py-1 text-[11px] font-bold text-slate-600 dark:bg-slate-800 dark:text-slate-300">Bugün</button>
                          <button type="button" onClick={() => setQuickCompletionDate(-1)} className="rounded-full bg-slate-100 px-3 py-1 text-[11px] font-bold text-slate-600 dark:bg-slate-800 dark:text-slate-300">Dün</button>
                        </div>
                      ) : null}
                    </div>
                  </div>

                  {selected.type === "MOVIE" ? (
                    <div className={isMovieMinuteActive ? "mt-3" : "mt-3 opacity-50"}>
                      <label className="block text-xs font-bold text-slate-500 dark:text-slate-300">Kaldığın dakika</label>
                      <div className="relative mt-1.5">
                        <Clock className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
                        <input
                          type="number"
                          min={0}
                          max={selected.runtime || undefined}
                          value={isCompleted ? selected.runtime || "" : watchedMinutes}
                          disabled={!isMovieMinuteActive}
                          onChange={(e) => setWatchedMinutes(e.target.value)}
                          placeholder={isCompleted ? "Tamamlandı" : "Örn: 63"}
                          className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-8 py-2.5 text-sm font-medium text-slate-900 outline-none focus:border-indigo-400 focus:ring-4 focus:ring-indigo-500/10 disabled:cursor-not-allowed dark:border-slate-800 dark:bg-slate-950/70 dark:text-slate-50"
                        />
                      </div>
                      {progress ? <p className="mt-1.5 text-xs text-slate-500">{progress.watched}/{progress.runtime} dk • {progress.remaining} dk kaldı • %{progress.percent}</p> : null}
                    </div>
                  ) : null}
                </FormSection>

                <FormSection title="Raflar ve not" description="İçeriği birden fazla rafa ekleyebilir, yeni raf oluşturup yönetebilirsin." icon={<Layers className="h-4 w-4" />}>
                  <div className="rounded-3xl border border-slate-200 bg-slate-50/80 p-3 dark:border-slate-800 dark:bg-slate-950/60">
                    <div className="mb-3 flex items-center justify-between gap-3">
                      <div>
                        <p className="text-xs font-black uppercase tracking-[0.14em] text-slate-400">Raf seçimi</p>
                        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Favori, hafta sonu veya kendi özel raflarını seç.</p>
                      </div>
                      <span className="rounded-full bg-white px-2.5 py-1 text-[11px] font-black text-slate-500 ring-1 ring-slate-200 dark:bg-slate-900 dark:text-slate-300 dark:ring-slate-800">
                        {selectedShelves.length} seçili
                      </span>
                    </div>

                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                      {shelves.map((shelf) => {
                        const active = selectedShelfIds.includes(shelf.id);

                        return (
                          <div
                            key={shelf.id}
                            className={`group flex items-center gap-2 rounded-2xl border px-3 py-2 transition ${
                              active
                                ? "border-rose-300 bg-rose-50 text-rose-700 dark:border-rose-800 dark:bg-rose-950/30 dark:text-rose-100"
                                : "border-slate-200 bg-white text-slate-600 hover:border-orange-200 dark:border-slate-800 dark:bg-slate-900/70 dark:text-slate-300"
                            }`}
                          >
                            <button
                              type="button"
                              onClick={() => toggleShelf(shelf.id)}
                              className="flex min-w-0 flex-1 items-center gap-2 text-left text-xs font-black"
                            >
                              <Heart className={`h-4 w-4 shrink-0 ${active ? "fill-current" : ""}`} />
                              <span className="truncate">{shelf.name}</span>
                            </button>

                            {!shelf.isDefault ? (
                              <button
                                type="button"
                                onClick={() => deleteShelf(shelf)}
                                className="rounded-full p-1 text-slate-400 opacity-70 transition hover:bg-rose-100 hover:text-rose-600 group-hover:opacity-100 dark:hover:bg-rose-950"
                                title="Rafı sil"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            ) : null}
                          </div>
                        );
                      })}
                    </div>

                    <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-[minmax(0,1fr)_auto]">
                      <input
                        value={newShelfName}
                        onChange={(e) => setNewShelfName(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            void createShelf();
                          }
                        }}
                        placeholder="Yeni raf adı: Kore dizileri, Oscar filmleri..."
                        className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none transition focus:border-orange-300 focus:ring-4 focus:ring-orange-500/10 dark:border-slate-800 dark:bg-slate-900/80 dark:text-slate-50"
                      />
                      <button
                        type="button"
                        onClick={createShelf}
                        disabled={savingShelf}
                        className="inline-flex items-center justify-center gap-2 rounded-2xl bg-slate-900 px-4 py-2.5 text-sm font-black text-white transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-100"
                      >
                        {savingShelf ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                        Raf ekle
                      </button>
                    </div>
                  </div>

                  <textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    rows={5}
                    placeholder="Bu film/dizi hakkında notların..."
                    className="mt-3 w-full resize-none rounded-2xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm text-slate-900 outline-none transition focus:border-indigo-400 focus:ring-4 focus:ring-indigo-500/10 dark:border-slate-800 dark:bg-slate-950/70 dark:text-slate-50"
                  />
                </FormSection>
              </div>

              <div className="space-y-5">
                {selected.type === "TV" && selected.seasons && selected.seasons.length > 0 ? (
                  <FormSection
                    title="Sezon / bölüm seçimi"
                    description={isCompleted ? "İzlendi seçildiğinde tüm bölümler otomatik seçilir." : isEpisodeSelectionActive ? "İzlediğin bölümlere tik at. Her bölüm raporlara ayrı işlenir." : "Bölüm seçimi için durumu İzleniyor yapmalısın."}
                    icon={<Tv className="h-4 w-4" />}
                  >
                    <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <div className="flex gap-2 overflow-x-auto pb-1">
                        {selected.seasons.map((season) => (
                          <button
                            key={season.seasonNumber}
                            type="button"
                            onClick={() => handleLoadSeason(selected.tmdbId, season.seasonNumber)}
                            className={`flex-shrink-0 rounded-full border px-3 py-1.5 text-xs font-black transition ${
                              selectedSeasonNumber === season.seasonNumber
                                ? "border-purple-400 bg-purple-500 text-white shadow-sm"
                                : "border-slate-200 bg-slate-50 text-slate-500 hover:bg-white dark:border-slate-800 dark:bg-slate-950/70 dark:text-slate-300"
                            }`}
                          >
                            Sezon {season.seasonNumber}
                            <span className="ml-1 opacity-80">({season.episodeCount})</span>
                          </button>
                        ))}
                      </div>

                      <span className="shrink-0 rounded-full bg-purple-50 px-3 py-1 text-xs font-black text-purple-700 dark:bg-purple-950/40 dark:text-purple-200">
                        {watchedEpisodeList.length}/{expectedEpisodeCount || "?"} bölüm
                      </span>
                    </div>

                    {loadingSeason ? (
                      <div className="flex items-center gap-2 py-8 text-sm text-slate-500">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Bölümler yükleniyor...
                      </div>
                    ) : seasonDetails ? (
                      <div className={`grid max-h-[620px] grid-cols-1 gap-2 overflow-y-auto pr-1 ${isEpisodeSelectionActive ? "" : "opacity-70"}`}>
                        {seasonDetails.episodes.map((episode) => {
                          const key = episodeKey(episode.seasonNumber, episode.episodeNumber);
                          const checked = Boolean(watchedEpisodes[key]);
                          const stillOriginal = toOriginalTmdbImage(episode.stillUrl);

                          return (
                            <button
                              key={key}
                              type="button"
                              onClick={() => toggleEpisodeWatched(episode)}
                              className={`w-full rounded-3xl border p-3 text-left transition ${
                                checked
                                  ? "border-emerald-400 bg-emerald-50 dark:border-emerald-800 dark:bg-emerald-950/30"
                                  : "border-slate-200 bg-slate-50 hover:border-purple-300 hover:bg-white dark:border-slate-800 dark:bg-slate-950/50 dark:hover:border-purple-800 dark:hover:bg-slate-900"
                              }`}
                            >
                              <div className="flex gap-3">
                                <div className={`mt-1 flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-lg border ${checked ? "border-emerald-500 bg-emerald-500 text-white" : "border-slate-300 dark:border-slate-700"}`}>
                                  {checked ? <CheckCircle2 className="h-4 w-4" /> : null}
                                </div>

                                {episode.stillUrl ? (
                                  <span
                                    role="button"
                                    tabIndex={0}
                                    onClick={(event) => {
                                      event.stopPropagation();
                                      setPreviewImage({ url: stillOriginal, title: `${episode.episodeNumber}. Bölüm: ${episode.title}`, subtitle: seasonDetails.name });
                                    }}
                                    onKeyDown={(event) => {
                                      if (event.key === "Enter" || event.key === " ") {
                                        event.stopPropagation();
                                        setPreviewImage({ url: stillOriginal, title: `${episode.episodeNumber}. Bölüm: ${episode.title}`, subtitle: seasonDetails.name });
                                      }
                                    }}
                                    className="h-16 w-28 flex-shrink-0 overflow-hidden rounded-2xl bg-slate-200 ring-1 ring-slate-200 transition hover:brightness-110 dark:bg-slate-800 dark:ring-slate-800"
                                  >
                                    <img src={episode.stillUrl} alt={episode.title} className="h-full w-full object-cover" />
                                  </span>
                                ) : null}

                                <div className="min-w-0 flex-1">
                                  <div className="flex items-start justify-between gap-2">
                                    <p className="text-sm font-black text-slate-900 dark:text-slate-50">{episode.episodeNumber}. Bölüm: {episode.title}</p>
                                  </div>
                                  <p className="mt-0.5 text-xs text-slate-500">
                                    {episode.runtime ? `${episode.runtime} dk` : "Süre bilinmiyor"}{episode.airDate ? ` • ${episode.airDate}` : ""}{episode.tmdbRating ? ` • ${episode.tmdbRating}/10` : ""}
                                  </p>
                                  {episode.overview ? <p className="mt-1 line-clamp-2 text-xs leading-5 text-slate-500 dark:text-slate-400">{episode.overview}</p> : null}
                                </div>
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="rounded-2xl border border-dashed border-slate-200 p-8 text-center text-sm text-slate-500 dark:border-slate-800">
                        Sezon seçerek bölüm listesini görüntüleyebilirsin.
                      </div>
                    )}
                  </FormSection>
                ) : null}

                <FormSection title="Ek bilgiler" description="Yönetmen, platform ve oyuncu bilgileri kayda aktarılır." icon={<Info className="h-4 w-4" />}>
                  <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3 dark:border-slate-800 dark:bg-slate-950/50">
                      <p className="text-[11px] font-black uppercase tracking-[0.14em] text-slate-400">Yönetmen / Creator</p>
                      <p className="mt-1 text-sm font-bold text-slate-800 dark:text-slate-100">
                        {selected.type === "MOVIE" ? selected.director || "Bilinmiyor" : selected.creators?.join(", ") || "Bilinmiyor"}
                      </p>
                    </div>
                    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3 dark:border-slate-800 dark:bg-slate-950/50">
                      <p className="text-[11px] font-black uppercase tracking-[0.14em] text-slate-400">Platform</p>
                      <p className="mt-1 line-clamp-2 text-sm font-bold text-slate-800 dark:text-slate-100">{selected.platforms?.length ? selected.platforms.join(", ") : "Bilinmiyor"}</p>
                    </div>
                  </div>

                  <div className="mt-3 rounded-[1.6rem] border border-slate-200 bg-slate-50/80 p-3 dark:border-slate-800 dark:bg-slate-950/50 sm:p-4">
                    <div className="mb-3 flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
                      <div>
                        <p className="text-[11px] font-black uppercase tracking-[0.14em] text-slate-400">Oyuncu kadrosu</p>
                        <p className="mt-1 text-xs leading-5 text-slate-500 dark:text-slate-400">
                          İlk oyuncular büyük kartta, diğerleri kompakt listede gösterilir. Fotoğrafa tıklayınca yüksek kalite açılır.
                        </p>
                      </div>
                      <span className="w-fit rounded-full bg-white px-3 py-1 text-[11px] font-black text-slate-500 ring-1 ring-slate-200 dark:bg-slate-900 dark:text-slate-300 dark:ring-slate-800">
                        {(selected.castDetails?.length || selected.cast?.length || 0)} kişi
                      </span>
                    </div>

                    <CastShowcase
                      people={(selected.castDetails?.length ? selected.castDetails : selected.cast || []) as Array<MediaPerson | string>}
                      onPreview={setPreviewImage}
                    />
                  </div>
                </FormSection>
              </div>
            </div>

            <div className="flex flex-col gap-3 rounded-[1.7rem] border border-slate-200 bg-slate-50 p-3 dark:border-slate-800 dark:bg-slate-900/60 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-start gap-3">
                <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-indigo-100 text-indigo-700 dark:bg-indigo-950/50 dark:text-indigo-200">
                  <Save className="h-5 w-5" />
                </span>
                <div>
                  <p className="text-sm font-black text-slate-900 dark:text-slate-50">Kayda hazır</p>
                  <p className="mt-0.5 text-xs leading-5 text-slate-500 dark:text-slate-400">Kayıt oluşturulduğunda işlem tarihi, puanlar, favori rafı ve izleme bilgileri birlikte saklanır.</p>
                </div>
              </div>

              <button
                type="submit"
                disabled={saving || loadingDetails}
                className="inline-flex items-center justify-center rounded-2xl bg-orange-600 px-5 py-3 text-sm font-black text-white shadow-sm transition hover:bg-orange-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                Medya kaydını oluştur
              </button>
            </div>
          </div>
        )}
      </form>
    </div>
  );
}
