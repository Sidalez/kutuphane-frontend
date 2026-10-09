// src/pages/MediaSuggestionsPage.tsx

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { collection, onSnapshot, query, where } from "firebase/firestore";
import {
  AlertTriangle,
  Brain,
  Calendar,
  CheckCircle2,
  Clapperboard,
  Clock3,
  ExternalLink,
  Film,
  ImageIcon,
  Info,
  Loader2,
  PlayCircle,
  Search,
  Sparkles,
  Star,
  Tv,
  Users,
  Wand2,
  X,
} from "lucide-react";

import { db } from "../firebase/firebase";
import { useAuth } from "../auth/AuthContext";

type MediaType = "ALL" | "MOVIE" | "TV";

type SuggestionMode =
  | "TODAY"
  | "PERSONAL"
  | "SIMILAR"
  | "WATCHING_SIMILAR"
  | "HIGH_RATED_UNWATCHED"
  | "WEEKEND"
  | "GENRE"
  | "PLATFORM";

type WatchStatus = "IZLENECEK" | "IZLENIYOR" | "IZLENDI" | "BIRAKILDI";

type MediaItem = {
  id?: string;
  userId?: string;
  tmdbId?: number;
  type?: "MOVIE" | "TV";
  title?: string;
  status?: WatchStatus;
  genres?: string[];
  platforms?: string[];
  tmdbRating?: number | null;
  userRating?: number | null;
  expectedRating?: number | null;
  posterUrl?: string | null;
};

type SuggestionItem = {
  tmdbId: number;
  type: "MOVIE" | "TV";
  title: string;
  originalTitle?: string;
  year?: string;
  overview?: string;
  posterUrl?: string | null;
  backdropUrl?: string | null;
  tmdbRating?: number | null;
  genres?: string[];
  platforms?: string[];
  reason?: string;
  matchScore?: number;

  aiReason?: string;
  qualityComment?: string;
  bestFor?: string;
  watchAdvice?: string;
};

type MediaSeason = {
  seasonNumber: number;
  name: string;
  episodeCount: number;
  airDate?: string | null;
  posterUrl?: string | null;
};

type CastDetail = {
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
};
type ProviderDetail = {
  id?: number;
  name: string;
  logoUrl?: string | null;
};

type MediaDetails = {
  tmdbId: number;
  imdbId?: string | null;
  type: "MOVIE" | "TV";

  title: string;
  originalTitle?: string;
  year?: string;
  overview?: string;

  posterUrl?: string | null;
  backdropUrl?: string | null;
  trailerUrl?: string | null;

  genres?: string[];
  platforms?: string[];
  providers?: ProviderDetail[];

  runtime?: number | null;

  numberOfSeasons?: number;
  numberOfEpisodes?: number;
  seasons?: MediaSeason[];

  director?: string | null;
  creators?: string[];

  cast?: string[];
  castDetails?: CastDetail[];

  tmdbRating?: number | null;
  imdbRating?: number | null;

  status?: string;
  tagline?: string;
  homepage?: string;

  aiEditorComment?: string;
  aiQualityNote?: string;
  aiWatchAdvice?: string;
};

const API_BASE_URL = (
  import.meta.env.VITE_API_URL ||
  import.meta.env.VITE_API_BASE_URL ||
  "http://localhost:3001"
).replace(/\/$/, "");

const modes: {
  key: SuggestionMode;
  title: string;
  shortTitle: string;
  description: string;
  icon: any;
}[] = [
  {
    key: "TODAY",
    title: "Bugün ne izlesem?",
    shortTitle: "Bugün",
    description:
      "Açıklama, ruh hali, tür ve izleme geçmişine göre kişisel öneriler üretir.",
    icon: Wand2,
  },
  {
    key: "PERSONAL",
    title: "İzlediklerine göre öneriler",
    shortTitle: "Geçmişime göre",
    description:
      "Tamamladığın, beğendiğin ve yüksek puan verdiğin içerikleri analiz eder.",
    icon: Brain,
  },
  {
    key: "SIMILAR",
    title: "Benzer içerik bul",
    shortTitle: "Benzer bul",
    description: "Yazdığın film veya dizi adına benzeyen içerikleri getirir.",
    icon: Search,
  },
  {
    key: "WATCHING_SIMILAR",
    title: "Devam eden dizilerine benzer",
    shortTitle: "Devam eden",
    description: "Şu an izlediğin dizilerden yola çıkarak yakın diziler önerir.",
    icon: Tv,
  },
  {
    key: "HIGH_RATED_UNWATCHED",
    title: "Puanı yüksek ama izlemediklerin",
    shortTitle: "Yüksek puan",
    description:
      "TMDb puanı yüksek, kütüphanende olmayan içerikleri öne çıkarır.",
    icon: Star,
  },
  {
    key: "WEEKEND",
    title: "Bu hafta sonu izlenebilecek 3 film",
    shortTitle: "Hafta sonu",
    description:
      "Hafta sonu için daha kısa, popüler ve rahat izlenebilir filmler getirir.",
    icon: PlayCircle,
  },
  {
    key: "GENRE",
    title: "Türe göre öner",
    shortTitle: "Türe göre",
    description:
      "Dram, bilim kurgu, Kore dizisi, psikolojik gerilim gibi tür/atmosfer bazlı çalışır.",
    icon: Clapperboard,
  },
  {
    key: "PLATFORM",
    title: "Platforma göre öner",
    shortTitle: "Platform",
    description:
      "Netflix, Prime Video, Disney+, Apple TV+ gibi platform filtreleriyle önerir.",
    icon: Sparkles,
  },
];

const providerOptions = [
  "Netflix",
  "Amazon Prime Video",
  "Disney+",
  "Apple TV+",
  "MUBI",
  "BluTV",
  "Gain",
];

const quickGenres = [
  "Dram",
  "Gizem",
  "Gerilim",
  "Bilim Kurgu",
  "Komedi",
  "Romantik",
  "Aksiyon",
  "Kore dizisi",
  "Suç",
  "Fantastik",
  "Psikolojik",
  "Macera",
];

async function postJson<T>(path: string, body: unknown): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  const rawText = await response.text();

  let data: any = {};
  try {
    data = rawText ? JSON.parse(rawText) : {};
  } catch {
    throw new Error(`Backend JSON dönmedi: ${rawText.slice(0, 250)}`);
  }

  if (!response.ok || data?.success === false) {
    throw new Error(data?.message || data?.error || `HTTP ${response.status}`);
  }

  return data as T;
}

function normalizeFiveRating(value: any) {
  const n = Number(value || 0);

  if (!Number.isFinite(n) || n <= 0) return 0;

  if (n <= 5) return n;

  return Math.round((Math.min(n, 10) / 2) * 10) / 10;
}

function buildHistory(items: MediaItem[]) {
  const highRated = items
    .filter((item) => normalizeFiveRating(item.userRating) >= 4)
    .map((item) => ({
      title: item.title,
      tmdbId: item.tmdbId,
      type: item.type,
      genres: item.genres || [],
      rating: normalizeFiveRating(item.userRating),
    }));

  const liked = items
    .filter(
      (item) =>
        item.status === "IZLENDI" || normalizeFiveRating(item.userRating) >= 4
    )
    .map((item) => ({
      title: item.title,
      tmdbId: item.tmdbId,
      type: item.type,
      genres: item.genres || [],
    }));

  const completed = items
    .filter((item) => item.status === "IZLENDI")
    .map((item) => ({
      title: item.title,
      tmdbId: item.tmdbId,
      type: item.type,
      genres: item.genres || [],
    }));

  const watching = items
    .filter((item) => item.status === "IZLENIYOR")
    .map((item) => ({
      title: item.title,
      tmdbId: item.tmdbId,
      type: item.type,
      genres: item.genres || [],
    }));

  const dropped = items
    .filter((item) => item.status === "BIRAKILDI")
    .map((item) => ({
      title: item.title,
      tmdbId: item.tmdbId,
      type: item.type,
      genres: item.genres || [],
    }));

  const alreadyAddedTmdbIds = items
    .filter((item) => item.tmdbId)
    .map((item) => ({
      tmdbId: item.tmdbId,
      type: item.type,
    }));

  return {
    liked,
    highRated,
    completed,
    watching,
    dropped,
    alreadyAddedTmdbIds,
  };
}

function typeLabel(type?: string) {
  if (type === "TV") return "Dizi";
  if (type === "MOVIE") return "Film";
  return "İçerik";
}

function getModePrompt(mode: SuggestionMode) {
  if (mode === "TODAY") {
    return "Bugün nasıl bir şey izlemek istiyorsun? Örn: kısa, sürükleyici, Kore dizisi, çok ağır olmayan...";
  }

  if (mode === "SIMILAR") {
    return "Hangi film veya diziye benzer öneriler istiyorsun?";
  }

  if (mode === "WEEKEND") {
    return "Hafta sonu ruh halini yaz. Örn: yormayan, keyifli, sürükleyici 3 film...";
  }

  if (mode === "GENRE") {
    return "Tür veya atmosfer yaz. Örn: karanlık bilim kurgu, romantik komedi, psikolojik gerilim...";
  }

  if (mode === "PLATFORM") {
    return "Platformda ne tarz içerik aradığını yazabilirsin.";
  }

  return "Ek bir isteğin varsa yazabilirsin.";
}

function getSuggestionKey(item: SuggestionItem) {
  return `${item.type}-${item.tmdbId}`;
}

function getRuntimeText(details?: MediaDetails | null) {
  if (!details) return "";

  if (details.type === "MOVIE") {
    if (!details.runtime) return "";
    return `${details.runtime} dk`;
  }

  const seasons = Number(details.numberOfSeasons || 0);
  const episodes = Number(details.numberOfEpisodes || 0);

  if (!seasons && !episodes) return "";

  return `${seasons || "-"} sezon • ${episodes || "-"} bölüm`;
}

function getCrewText(details?: MediaDetails | null) {
  if (!details) return "";

  if (details.type === "MOVIE") {
    return details.director || "";
  }

  return (details.creators || []).slice(0, 2).join(", ");
}

function getPlatformsText(details?: MediaDetails | null, item?: SuggestionItem) {
  const platforms = details?.platforms?.length
    ? details.platforms
    : item?.platforms || [];

  return platforms.slice(0, 3).join(", ");
}

function getMatchTone(score?: number) {
  const n = Number(score || 0);

  if (n >= 88) {
    return "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-200 dark:border-emerald-800";
  }

  if (n >= 75) {
    return "bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-900/20 dark:text-indigo-200 dark:border-indigo-800";
  }

  return "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/20 dark:text-amber-200 dark:border-amber-800";
}

function getSuggestionLabel(mode: SuggestionMode) {
  if (mode === "TODAY") return "Bugün için";
  if (mode === "PERSONAL") return "Kişisel";
  if (mode === "SIMILAR") return "Benzer";
  if (mode === "WATCHING_SIMILAR") return "Devam edenlere yakın";
  if (mode === "HIGH_RATED_UNWATCHED") return "Yüksek puan";
  if (mode === "WEEKEND") return "Hafta sonu";
  if (mode === "GENRE") return "Türe göre";
  if (mode === "PLATFORM") return "Platform";
  return "Öneri";
}

function PosterBox({
  url,
  title,
  className = "",
}: {
  url?: string | null;
  title: string;
  className?: string;
}) {
  return (
    <div
      className={`overflow-hidden rounded-2xl bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 ${className}`}
    >
      {url ? (
        <img src={url} alt={title} className="h-full w-full object-cover" />
      ) : (
        <div className="h-full w-full flex items-center justify-center text-slate-400">
          <ImageIcon className="w-6 h-6" />
        </div>
      )}
    </div>
  );
}

function getInitials(name?: string) {
  const parts = String(name || "")
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  if (parts.length === 0) return "?";

  return parts
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toLocaleUpperCase("tr-TR");
}

function getActorImageUrl(person?: CastDetail | null) {
  if (!person) return "";

  const raw =
    person.profileUrl ||
    person.profileOriginalUrl ||
    person.imageUrl ||
    person.photoUrl ||
    person.profile_path ||
    "";

  const value = String(raw || "").trim();

  if (!value) return "";

  if (value.startsWith("http")) return value;

  if (value.startsWith("/")) {
    return `https://image.tmdb.org/t/p/w185${value}`;
  }

  return value;
}

function PersonAvatar({ person }: { person: CastDetail }) {
  const [imageError, setImageError] = useState(false);

  const imageUrl = !imageError ? getActorImageUrl(person) : "";

  return (
    <div className="rounded-2xl bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 p-2">
      <div className="flex gap-2">
        <div className="h-16 w-12 rounded-xl overflow-hidden bg-gradient-to-br from-indigo-100 to-purple-100 dark:from-slate-800 dark:to-slate-900 flex-shrink-0">
          {imageUrl ? (
            <img
              src={imageUrl}
              alt={person.name}
              loading="lazy"
              referrerPolicy="no-referrer"
              onError={() => setImageError(true)}
              className="h-full w-full object-cover block"
            />
          ) : (
            <div className="h-full w-full flex items-center justify-center text-[13px] font-black text-indigo-700 dark:text-indigo-200">
              {getInitials(person.name)}
            </div>
          )}
        </div>

        <div className="min-w-0">
          <p className="text-xs font-black text-slate-900 dark:text-slate-100 line-clamp-1">
            {person.name}
          </p>

          {person.originalName && person.originalName !== person.name && (
            <p className="mt-0.5 text-[10px] text-slate-400 line-clamp-1">
              {person.originalName}
            </p>
          )}

          {person.character && (
            <p className="mt-0.5 text-[11px] text-slate-500 line-clamp-2">
              {person.character}
            </p>
          )}

          {person.episodeCount ? (
            <p className="mt-0.5 text-[10px] text-purple-500 font-bold">
              {person.episodeCount} bölüm
            </p>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function StatChip({
  icon,
  label,
  value,
}: {
  icon: ReactNode;
  label: string;
  value: string | number;
}) {
  return (
    <div className="rounded-2xl bg-white/80 dark:bg-slate-900/80 border border-white/80 dark:border-slate-800 px-4 py-3 shadow-sm">
      <div className="flex items-center justify-between gap-2">
        <p className="text-[11px] uppercase tracking-[0.14em] font-bold text-slate-500">
          {label}
        </p>
        {icon}
      </div>
      <p className="mt-1 text-xl font-black text-slate-900 dark:text-slate-50">
        {value}
      </p>
    </div>
  );
}

export default function MediaSuggestionsPage() {
  const { user } = useAuth();

  const [items, setItems] = useState<MediaItem[]>([]);
  const [mode, setMode] = useState<SuggestionMode>("TODAY");
  const [type, setType] = useState<MediaType>("ALL");
  const [provider, setProvider] = useState("");
  const [description, setDescription] = useState("");
  const [similarQuery, setSimilarQuery] = useState("");
  const [genres, setGenres] = useState<string[]>(["Dram", "Gizem"]);

  const [suggestions, setSuggestions] = useState<SuggestionItem[]>([]);
  const [detailsCache, setDetailsCache] = useState<Record<string, MediaDetails>>(
    {}
  );
  const [selectedSuggestion, setSelectedSuggestion] =
    useState<SuggestionItem | null>(null);
  const [selectedDetails, setSelectedDetails] = useState<MediaDetails | null>(
    null
  );

  const [loading, setLoading] = useState(false);
  const [detailLoadingKey, setDetailLoadingKey] = useState<string | null>(null);
  const [pageLoading, setPageLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const history = useMemo(() => buildHistory(items), [items]);

  const selectedMode = useMemo(
    () => modes.find((item) => item.key === mode) || modes[0],
    [mode]
  );

  const topGenresFromHistory = useMemo(() => {
    const map = new Map<string, number>();

    items.forEach((item) => {
      (item.genres || []).forEach((genre) => {
        map.set(genre, (map.get(genre) || 0) + 1);
      });
    });

    return [...map.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 4)
      .map(([genre]) => genre);
  }, [items]);

  useEffect(() => {
    if (!user) {
      setItems([]);
      setPageLoading(false);
      return;
    }

    setPageLoading(true);

    const q = query(
      collection(db, "mediaItems"),
      where("userId", "==", user.uid)
    );

    const unsub = onSnapshot(
      q,
      (snapshot) => {
        const data = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...(doc.data() as Omit<MediaItem, "id">),
        }));

        setItems(data);
        setPageLoading(false);
      },
      (err) => {
        console.error("Öneri geçmişi okunamadı:", err);
        setError(err?.message || "İzleme geçmişi okunamadı.");
        setPageLoading(false);
      }
    );

    return () => unsub();
  }, [user]);

  const toggleGenre = (genre: string) => {
    setGenres((prev) =>
      prev.includes(genre)
        ? prev.filter((item) => item !== genre)
        : [...prev, genre]
    );
  };

  const runSuggestions = async (overrideMode?: SuggestionMode) => {
    const finalMode = overrideMode || mode;

    setLoading(true);
    setError(null);
    setSelectedSuggestion(null);
    setSelectedDetails(null);

    try {
      const body = {
        mode: finalMode,
        type,
        description,
        genres,
        provider,
        query: similarQuery,
        history,
      };

      const data = await postJson<{
        success: boolean;
        mode: SuggestionMode;
        data: SuggestionItem[];
        message?: string;
      }>("/api/media/suggestions", body);

      const list = Array.isArray(data.data) ? data.data : [];

      if (finalMode === "WEEKEND") {
        setSuggestions(list.slice(0, 3));
      } else {
        setSuggestions(list);
      }

      if (list.length === 0) {
        setError(
          data.message ||
            "Bu filtrelerle öneri bulunamadı. Tür, platform veya açıklamayı değiştirerek tekrar dene."
        );
      }
    } catch (err: any) {
      console.error("Öneri hatası:", err);
      setError(err?.message || "Öneriler alınırken hata oluştu.");
      setSuggestions([]);
    } finally {
      setLoading(false);
    }
  };

  const loadDetails = async (item: SuggestionItem) => {
    const key = getSuggestionKey(item);

    setSelectedSuggestion(item);
    setSelectedDetails(detailsCache[key] || null);
    setDetailLoadingKey(key);
    setError(null);

    try {
      if (detailsCache[key]) {
        setSelectedDetails(detailsCache[key]);
        return;
      }

      const data = await postJson<{
        success: boolean;
        data: MediaDetails;
        message?: string;
      }>("/api/media/details-ai", {
        tmdbId: item.tmdbId,
        type: item.type,
      });

      const details = data.data;

      setDetailsCache((prev) => ({
        ...prev,
        [key]: details,
      }));

      setSelectedDetails(details);
    } catch (err: any) {
      console.error("Öneri detay hatası:", err);
      setError(err?.message || "Detaylar alınırken hata oluştu.");
    } finally {
      setDetailLoadingKey(null);
    }
  };

  if (!user) {
    return (
      <div className="max-w-5xl mx-auto py-10">
        <div className="rounded-3xl border border-indigo-100/70 dark:border-slate-800 bg-white/80 dark:bg-slate-900/80 p-8 text-center shadow-sm">
          <p className="text-lg font-semibold text-slate-900 dark:text-slate-50">
            Önerileri görmek için giriş yapmalısın.
          </p>
          <p className="mt-2 text-sm text-slate-500">
            Giriş yaptıktan sonra izleme geçmişine göre kişisel film/dizi
            önerileri oluşturulur.
          </p>
        </div>
      </div>
    );
  }

  const SelectedIcon = selectedMode.icon;

  return (
    <>
      <div className="max-w-7xl mx-auto space-y-6">
        <div
          className="
            relative overflow-hidden rounded-[32px] border
            border-indigo-100/70 dark:border-slate-800/80
            bg-gradient-to-br from-indigo-50 via-purple-50 to-slate-100
            dark:from-slate-950 dark:via-slate-900 dark:to-slate-950
            px-6 py-6 shadow-sm
          "
        >
          <div className="absolute -top-24 right-0 h-56 w-56 rounded-full bg-purple-300/20 blur-3xl" />
          <div className="absolute -bottom-24 left-0 h-56 w-56 rounded-full bg-indigo-300/20 blur-3xl" />

          <div className="relative flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-white/70 dark:border-slate-800 bg-white/80 dark:bg-slate-900/80 px-3 py-1 text-[11px] font-bold text-indigo-800 dark:text-slate-200">
                <Sparkles className="w-4 h-4" />
                <span>AI destekli öneri motoru</span>
                <span className="h-1 w-1 rounded-full bg-indigo-400" />
                <span>{items.length} kayıt analiz edildi</span>
              </div>

              <h1 className="mt-3 text-2xl md:text-3xl font-semibold tracking-tight text-slate-900 dark:text-slate-50">
                Ne izlesem kararını kolaylaştıralım.
              </h1>

              <p className="mt-2 max-w-2xl text-sm text-slate-600 dark:text-slate-400">
                İzleme geçmişin, sevdiğin türler, platform tercihin, ruh halin
                ve benzer içerik isteğin birlikte analiz edilir. Öneriler sadece
                liste olarak değil; neden uygun olduğu, kalite yorumu ve izleme
                tavsiyesiyle birlikte gelir.
              </p>

              {topGenresFromHistory.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-2">
                  <span className="text-xs font-bold text-slate-500">
                    Öne çıkan türlerin:
                  </span>
                  {topGenresFromHistory.map((genre) => (
                    <span
                      key={genre}
                      className="rounded-full bg-white/80 dark:bg-slate-900/80 border border-white/80 dark:border-slate-800 px-2.5 py-1 text-[11px] font-bold text-indigo-700 dark:text-indigo-200"
                    >
                      {genre}
                    </span>
                  ))}
                </div>
              )}
            </div>

            <div className="grid grid-cols-3 gap-3 min-w-[320px]">
              <StatChip
                label="İzlenen"
                value={history.completed.length}
                icon={<CheckCircle2 className="w-4 h-4 text-emerald-500" />}
              />

              <StatChip
                label="Devam"
                value={history.watching.length}
                icon={<Tv className="w-4 h-4 text-purple-500" />}
              />

              <StatChip
                label="Yüksek"
                value={history.highRated.length}
                icon={<Star className="w-4 h-4 text-amber-500 fill-amber-500" />}
              />
            </div>
          </div>
        </div>

        {error && (
          <div className="rounded-3xl border border-rose-100/70 dark:border-rose-900/70 bg-rose-50/80 dark:bg-rose-950/30 px-4 py-3 text-sm text-rose-700 dark:text-rose-200 flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <div className="grid grid-cols-1 xl:grid-cols-[0.82fr_1.18fr] gap-5">
          <div className="rounded-[30px] border border-slate-200/80 dark:border-slate-800 bg-white/90 dark:bg-slate-900/85 p-5 shadow-sm space-y-5">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-400">
                Öneri modu
              </p>

              <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-1 gap-2">
                {modes.map((item) => {
                  const Icon = item.icon;
                  const active = mode === item.key;

                  return (
                    <button
                      key={item.key}
                      type="button"
                      onClick={() => {
                        setMode(item.key);
                        setSuggestions([]);
                        setSelectedSuggestion(null);
                        setSelectedDetails(null);
                      }}
                      className={`text-left rounded-3xl border p-3 transition ${
                        active
                          ? "border-indigo-300 bg-indigo-50 dark:border-indigo-800 dark:bg-indigo-900/20 shadow-sm"
                          : "border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-950/50 hover:border-indigo-200 dark:hover:border-indigo-900"
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <div
                          className={`h-10 w-10 rounded-2xl flex items-center justify-center ${
                            active
                              ? "bg-indigo-500 text-white"
                              : "bg-white dark:bg-slate-900 text-slate-500"
                          }`}
                        >
                          <Icon className="w-5 h-5" />
                        </div>

                        <div className="min-w-0">
                          <p className="text-sm font-black text-slate-900 dark:text-slate-50">
                            {item.title}
                          </p>
                          <p className="mt-1 text-xs leading-5 text-slate-500">
                            {item.description}
                          </p>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="rounded-[30px] border border-slate-200/80 dark:border-slate-800 bg-white/90 dark:bg-slate-900/85 p-5 shadow-sm">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-400">
                  Öneri ayarları
                </p>

                <h2 className="mt-1 text-xl font-black text-slate-900 dark:text-slate-50 flex items-center gap-2">
                  <SelectedIcon className="w-5 h-5 text-indigo-500" />
                  {selectedMode.title}
                </h2>

                <p className="mt-1 text-sm text-slate-500">
                  {selectedMode.description}
                </p>
              </div>

              <span className="hidden md:inline-flex rounded-full bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-100 dark:border-indigo-800 px-3 py-1 text-xs font-black text-indigo-700 dark:text-indigo-200">
                {getSuggestionLabel(mode)}
              </span>
            </div>

            <div className="mt-5 grid grid-cols-1 lg:grid-cols-3 gap-4">
              <div>
                <p className="text-[11px] uppercase tracking-[0.15em] font-bold text-slate-400 mb-2">
                  İçerik tipi
                </p>

                <div className="grid grid-cols-3 gap-2">
                  {[
                    { key: "ALL", label: "Hepsi" },
                    { key: "MOVIE", label: "Film" },
                    { key: "TV", label: "Dizi" },
                  ].map((item) => (
                    <button
                      key={item.key}
                      type="button"
                      onClick={() => setType(item.key as MediaType)}
                      className={`rounded-full border px-3 py-2 text-xs font-bold transition ${
                        type === item.key
                          ? "bg-slate-900 text-white border-slate-900 dark:bg-white dark:text-slate-900 dark:border-white"
                          : "bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-700 text-slate-500"
                      }`}
                    >
                      {item.label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <p className="text-[11px] uppercase tracking-[0.15em] font-bold text-slate-400 mb-2">
                  Platform
                </p>

                <select
                  value={provider}
                  onChange={(e) => setProvider(e.target.value)}
                  className="w-full rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-400/40"
                >
                  <option value="">Platform fark etmez</option>
                  {providerOptions.map((item) => (
                    <option key={item} value={item}>
                      {item}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <p className="text-[11px] uppercase tracking-[0.15em] font-bold text-slate-400 mb-2">
                  Hızlı işlem
                </p>

                <button
                  type="button"
                  onClick={() => runSuggestions()}
                  disabled={loading || pageLoading}
                  className="w-full inline-flex items-center justify-center gap-2 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 text-sm font-bold transition disabled:opacity-60"
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Öneriler hazırlanıyor...
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4" />
                      AI öneri getir
                    </>
                  )}
                </button>
              </div>
            </div>

            {mode === "SIMILAR" && (
              <div className="mt-4">
                <p className="text-[11px] uppercase tracking-[0.15em] font-bold text-slate-400 mb-2">
                  Benzerini bulmak istediğin içerik
                </p>

                <input
                  value={similarQuery}
                  onChange={(e) => setSimilarQuery(e.target.value)}
                  placeholder="Örn: Inception, Dark, Breaking Bad..."
                  className="w-full rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-400/40"
                />
              </div>
            )}

            <div className="mt-4">
              <p className="text-[11px] uppercase tracking-[0.15em] font-bold text-slate-400 mb-2">
                Açıklama / ruh hali
              </p>

              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder={getModePrompt(mode)}
                rows={4}
                className="w-full rounded-3xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-indigo-400/40 resize-none"
              />
            </div>

            <div className="mt-4">
              <p className="text-[11px] uppercase tracking-[0.15em] font-bold text-slate-400 mb-2">
                Tür / atmosfer
              </p>

              <div className="flex flex-wrap gap-2">
                {quickGenres.map((genre) => (
                  <button
                    key={genre}
                    type="button"
                    onClick={() => toggleGenre(genre)}
                    className={`rounded-full border px-3 py-1.5 text-xs font-bold transition ${
                      genres.includes(genre)
                        ? "bg-purple-500 text-white border-purple-500"
                        : "bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-700 text-slate-500"
                    }`}
                  >
                    {genre}
                  </button>
                ))}
              </div>
            </div>

            <div className="mt-5 grid grid-cols-1 md:grid-cols-3 gap-3">
              <button
                type="button"
                onClick={() => {
                  setMode("WEEKEND");
                  runSuggestions("WEEKEND");
                }}
                disabled={loading}
                className="rounded-3xl border border-amber-100 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/20 px-4 py-3 text-left hover:-translate-y-0.5 transition disabled:opacity-60"
              >
                <p className="text-sm font-black text-amber-800 dark:text-amber-100">
                  Hafta sonu 3 film
                </p>
                <p className="mt-1 text-xs text-amber-700/80 dark:text-amber-200/80">
                  Hızlı ve seçilmiş liste oluştur.
                </p>
              </button>

              <button
                type="button"
                onClick={() => {
                  setMode("WATCHING_SIMILAR");
                  runSuggestions("WATCHING_SIMILAR");
                }}
                disabled={loading}
                className="rounded-3xl border border-emerald-100 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-900/20 px-4 py-3 text-left hover:-translate-y-0.5 transition disabled:opacity-60"
              >
                <p className="text-sm font-black text-emerald-800 dark:text-emerald-100">
                  Devam eden dizilerine benzer
                </p>
                <p className="mt-1 text-xs text-emerald-700/80 dark:text-emerald-200/80">
                  Mevcut dizilerinden yola çıkar.
                </p>
              </button>

              <button
                type="button"
                onClick={() => {
                  setMode("HIGH_RATED_UNWATCHED");
                  runSuggestions("HIGH_RATED_UNWATCHED");
                }}
                disabled={loading}
                className="rounded-3xl border border-indigo-100 dark:border-indigo-800 bg-indigo-50 dark:bg-indigo-900/20 px-4 py-3 text-left hover:-translate-y-0.5 transition disabled:opacity-60"
              >
                <p className="text-sm font-black text-indigo-800 dark:text-indigo-100">
                  Puanı yüksek izlemediklerin
                </p>
                <p className="mt-1 text-xs text-indigo-700/80 dark:text-indigo-200/80">
                  Kütüphanende olmayanları getir.
                </p>
              </button>
            </div>
          </div>
        </div>

        <div className="rounded-[30px] border border-slate-200/80 dark:border-slate-800 bg-white/90 dark:bg-slate-900/85 p-5 shadow-sm">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between mb-5">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-400">
                Öneri sonuçları
              </p>
              <h2 className="mt-1 text-lg font-black text-slate-900 dark:text-slate-50">
                Profesyonel öneri kartları
              </h2>
              <p className="mt-1 text-xs text-slate-500">
                “Detayları incele” ile Türkçe AI yorum, oyuncu kadrosu, platform,
                süre, fragman ve kalite notu açılır.
              </p>
            </div>

            <div className="inline-flex items-center gap-2 rounded-full bg-slate-100 dark:bg-slate-950 px-3 py-1 text-xs font-bold text-slate-500">
              <CheckCircle2 className="w-3.5 h-3.5" />
              {suggestions.length} öneri
            </div>
          </div>

          {pageLoading ? (
            <div className="py-14 flex justify-center text-sm text-slate-500">
              <Loader2 className="w-4 h-4 animate-spin mr-2" />
              İzleme geçmişin hazırlanıyor...
            </div>
          ) : loading ? (
            <div className="py-14 flex justify-center text-sm text-slate-500">
              <Loader2 className="w-4 h-4 animate-spin mr-2" />
              Öneriler hazırlanıyor...
            </div>
          ) : suggestions.length === 0 ? (
            <div className="rounded-3xl border border-dashed border-slate-200 dark:border-slate-800 p-10 text-center">
              <div className="mx-auto h-12 w-12 rounded-2xl bg-indigo-50 dark:bg-indigo-900/20 flex items-center justify-center text-indigo-600 dark:text-indigo-200">
                <Sparkles className="w-6 h-6" />
              </div>

              <p className="mt-4 text-sm font-bold text-slate-900 dark:text-slate-50">
                Henüz öneri oluşturulmadı.
              </p>

              <p className="mt-1 text-sm text-slate-500">
                Öneri modu seç, açıklama yaz ve AI öneri motorunu çalıştır.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 2xl:grid-cols-3 gap-4">
              {suggestions.map((item) => {
                const key = getSuggestionKey(item);
                const detail = detailsCache[key];
                const runtimeText = getRuntimeText(detail);
                const crewText = getCrewText(detail);
                const platformText = getPlatformsText(detail, item);

                return (
                  <article
                    key={key}
                    className="group rounded-[28px] border border-slate-200/80 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-950/50 overflow-hidden shadow-sm hover:-translate-y-0.5 hover:shadow-md transition"
                  >
                    <div className="relative h-40 bg-slate-100 dark:bg-slate-900">
                      {item.backdropUrl ? (
                        <img
                          src={item.backdropUrl}
                          alt={item.title}
                          className="w-full h-full object-cover opacity-75 dark:opacity-45"
                        />
                      ) : null}

                      <div className="absolute inset-0 bg-gradient-to-t from-slate-50 dark:from-slate-950 via-slate-50/55 dark:via-slate-950/60 to-transparent" />

                      <div className="absolute top-3 left-3">
                        <span className="inline-flex items-center gap-1 rounded-full bg-white/90 dark:bg-slate-950/90 border border-slate-200 dark:border-slate-800 px-2.5 py-1 text-[11px] font-black text-slate-700 dark:text-slate-200">
                          {item.type === "TV" ? (
                            <Tv className="w-3.5 h-3.5" />
                          ) : (
                            <Film className="w-3.5 h-3.5" />
                          )}
                          {typeLabel(item.type)}
                        </span>
                      </div>

                      {item.matchScore ? (
                        <div className="absolute top-3 right-3">
                          <span
                            className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-black ${getMatchTone(
                              item.matchScore
                            )}`}
                          >
                            %{item.matchScore} uyum
                          </span>
                        </div>
                      ) : null}
                    </div>

                    <div className="px-4 pb-4 -mt-16 relative">
                      <div className="flex gap-3">
                        <PosterBox
                          url={item.posterUrl}
                          title={item.title}
                          className="h-36 w-[96px] flex-shrink-0 border-4 border-slate-50 dark:border-slate-950 shadow-sm"
                        />

                        <div className="pt-16 min-w-0 flex-1">
                          <h3 className="text-base font-black text-slate-900 dark:text-slate-50 line-clamp-2">
                            {item.title}
                          </h3>

                          <div className="mt-2 flex flex-wrap gap-1.5">
                            {item.year && (
                              <span className="inline-flex items-center gap-1 rounded-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 px-2 py-1 text-[11px] font-bold text-slate-500">
                                <Calendar className="w-3 h-3" />
                                {item.year}
                              </span>
                            )}

                            {item.tmdbRating ? (
                              <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 dark:bg-amber-900/20 border border-amber-100 dark:border-amber-800 px-2 py-1 text-[11px] font-bold text-amber-700 dark:text-amber-200">
                                <Star className="w-3 h-3 fill-current" />
                                TMDb {item.tmdbRating}/10
                              </span>
                            ) : null}

                            {runtimeText && (
                              <span className="inline-flex items-center gap-1 rounded-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 px-2 py-1 text-[11px] font-bold text-slate-500">
                                <Clock3 className="w-3 h-3" />
                                {runtimeText}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      {item.overview && (
                        <p className="mt-3 text-sm leading-5 text-slate-600 dark:text-slate-300 line-clamp-3">
                          {item.overview}
                        </p>
                      )}

                      <div className="mt-3 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 px-3 py-3">
                        <div className="flex items-center gap-2 text-[11px] font-black uppercase tracking-[0.14em] text-indigo-600 dark:text-indigo-300">
                          <Info className="w-3.5 h-3.5" />
                          Neden önerildi?
                        </div>
                        <p className="mt-1 text-xs leading-5 text-slate-600 dark:text-slate-300">
                          {item.aiReason ||
                            item.reason ||
                            "İzleme geçmişin, seçtiğin türler ve izleme isteğin dikkate alınarak önerildi."}
                        </p>
                      </div>

                      {item.qualityComment && (
                        <div className="mt-3 rounded-2xl bg-purple-50 dark:bg-purple-900/20 border border-purple-100 dark:border-purple-800 px-3 py-3">
                          <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-purple-700 dark:text-purple-200">
                            Editör yorumu
                          </p>
                          <p className="mt-1 text-xs leading-5 text-purple-900/80 dark:text-purple-100/85">
                            {item.qualityComment}
                          </p>
                        </div>
                      )}

                      {(item.bestFor || item.watchAdvice) && (
                        <div className="mt-3 rounded-2xl bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-100 dark:border-emerald-800 px-3 py-3">
                          <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-emerald-700 dark:text-emerald-200">
                            Ne zaman iyi gider?
                          </p>
                          <p className="mt-1 text-xs leading-5 text-emerald-900/80 dark:text-emerald-100/85">
                            {item.bestFor || item.watchAdvice}
                          </p>
                        </div>
                      )}

                      <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {crewText && (
                          <div className="rounded-2xl bg-slate-100/70 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 px-3 py-2">
                            <p className="text-[10px] uppercase tracking-[0.13em] font-bold text-slate-400">
                              {item.type === "TV" ? "Yaratıcı" : "Yönetmen"}
                            </p>
                            <p className="mt-1 text-xs font-bold text-slate-700 dark:text-slate-200 line-clamp-1">
                              {crewText}
                            </p>
                          </div>
                        )}

                        {platformText && (
                          <div className="rounded-2xl bg-slate-100/70 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 px-3 py-2">
                            <p className="text-[10px] uppercase tracking-[0.13em] font-bold text-slate-400">
                              Platform
                            </p>
                            <p className="mt-1 text-xs font-bold text-slate-700 dark:text-slate-200 line-clamp-1">
                              {platformText}
                            </p>
                          </div>
                        )}
                      </div>

                      <div className="mt-3 flex flex-wrap gap-1.5">
                        {(detail?.genres?.length ? detail.genres : item.genres || [])
                          .slice(0, 5)
                          .map((genre) => (
                            <span
                              key={genre}
                              className="rounded-full bg-slate-100 dark:bg-slate-900 px-2 py-1 text-[11px] text-slate-500 border border-slate-200/70 dark:border-slate-800"
                            >
                              {genre}
                            </span>
                          ))}
                      </div>

                      <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
                        <button
                          type="button"
                          onClick={() => loadDetails(item)}
                          disabled={detailLoadingKey === key}
                          className="inline-flex items-center justify-center gap-1.5 rounded-full bg-slate-900 dark:bg-white px-3 py-1.5 text-xs font-bold text-white dark:text-slate-900 hover:brightness-110 transition disabled:opacity-60"
                        >
                          {detailLoadingKey === key ? (
                            <>
                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                              Detaylar...
                            </>
                          ) : (
                            <>
                              <Info className="w-3.5 h-3.5" />
                              Detayları incele
                            </>
                          )}
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            setMode("SIMILAR");
                            setSimilarQuery(item.title);
                            setDescription(`${item.title} benzeri öneriler getir.`);
                            window.scrollTo({ top: 0, behavior: "smooth" });
                          }}
                          className="inline-flex items-center justify-center rounded-full border border-slate-200 dark:border-slate-700 px-3 py-1.5 text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-white dark:hover:bg-slate-900 transition"
                        >
                          Benzerlerini ara
                        </button>

                        <button
                          type="button"
                          disabled
                          className="inline-flex items-center justify-center rounded-full bg-indigo-600 px-3 py-1.5 text-xs font-bold text-white opacity-50"
                          title="Sonraki adımda aktif edeceğiz"
                        >
                          Kütüphaneye ekle
                        </button>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {selectedSuggestion && (
        <div className="fixed inset-0 z-[110]">
          <button
            type="button"
            className="absolute inset-0 bg-slate-950/75 backdrop-blur-sm"
            onClick={() => {
              setSelectedSuggestion(null);
              setSelectedDetails(null);
            }}
          />

          <div className="absolute inset-0 flex items-center justify-center p-4 pointer-events-none">
            <div className="w-full max-w-6xl max-h-[90vh] overflow-hidden rounded-[32px] bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 shadow-2xl pointer-events-auto">
              <div className="relative h-56 overflow-hidden bg-slate-900">
                {(selectedDetails?.backdropUrl ||
                  selectedSuggestion.backdropUrl) && (
                  <img
                    src={
                      selectedDetails?.backdropUrl ||
                      selectedSuggestion.backdropUrl ||
                      ""
                    }
                    alt={selectedSuggestion.title}
                    className="w-full h-full object-cover opacity-55"
                  />
                )}

                <div className="absolute inset-0 bg-gradient-to-t from-white dark:from-slate-950 via-white/20 dark:via-slate-950/40 to-transparent" />

                <button
                  type="button"
                  onClick={() => {
                    setSelectedSuggestion(null);
                    setSelectedDetails(null);
                  }}
                  className="absolute top-4 right-4 h-10 w-10 rounded-full bg-white/90 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 shadow-sm flex items-center justify-center"
                >
                  <X className="w-5 h-5 text-slate-700 dark:text-slate-200" />
                </button>
              </div>

              <div className="px-5 pb-5 -mt-28 relative overflow-y-auto max-h-[calc(90vh-120px)]">
                <div className="grid grid-cols-1 lg:grid-cols-[230px_1fr] gap-5">
                  <div>
                    <PosterBox
                      url={
                        selectedDetails?.posterUrl ||
                        selectedSuggestion.posterUrl
                      }
                      title={selectedSuggestion.title}
                      className="h-[345px] w-full border-4 border-white dark:border-slate-950 shadow-xl"
                    />

                    <div className="mt-3 grid grid-cols-2 gap-2">
                      {selectedDetails?.trailerUrl && (
                        <a
                          href={selectedDetails.trailerUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center justify-center gap-1.5 rounded-2xl bg-rose-600 text-white px-3 py-2 text-xs font-bold hover:bg-rose-700 transition"
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                          Fragman
                        </a>
                      )}

                      <button
                        type="button"
                        disabled
                        className="inline-flex items-center justify-center rounded-2xl bg-indigo-600 text-white px-3 py-2 text-xs font-bold opacity-50"
                      >
                        Ekle
                      </button>
                    </div>
                  </div>

                  <div className="pt-28 lg:pt-32">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 px-2.5 py-1 text-xs font-black text-slate-700 dark:text-slate-200">
                        {selectedSuggestion.type === "TV" ? (
                          <Tv className="w-3.5 h-3.5" />
                        ) : (
                          <Film className="w-3.5 h-3.5" />
                        )}
                        {typeLabel(selectedSuggestion.type)}
                      </span>

                      {selectedSuggestion.matchScore && (
                        <span
                          className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-black ${getMatchTone(
                            selectedSuggestion.matchScore
                          )}`}
                        >
                          %{selectedSuggestion.matchScore} uyum
                        </span>
                      )}

                      {(selectedDetails?.tmdbRating ||
                        selectedSuggestion.tmdbRating) && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 dark:bg-amber-900/20 border border-amber-100 dark:border-amber-800 px-2.5 py-1 text-xs font-black text-amber-700 dark:text-amber-200">
                          <Star className="w-3.5 h-3.5 fill-current" />
                          TMDb{" "}
                          {selectedDetails?.tmdbRating ||
                            selectedSuggestion.tmdbRating}
                          /10
                        </span>
                      )}

                      {selectedDetails?.imdbRating && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-100 dark:border-yellow-800 px-2.5 py-1 text-xs font-black text-yellow-700 dark:text-yellow-200">
                          IMDb {selectedDetails.imdbRating}/10
                        </span>
                      )}
                    </div>

                    <h2 className="mt-3 text-2xl md:text-3xl font-black text-slate-900 dark:text-slate-50">
                      {selectedDetails?.title || selectedSuggestion.title}
                    </h2>

                    {selectedDetails?.originalTitle &&
                      selectedDetails.originalTitle !== selectedDetails.title && (
                        <p className="mt-1 text-sm text-slate-500">
                          Orijinal ad: {selectedDetails.originalTitle}
                        </p>
                      )}

                    <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-3">
                      <div className="rounded-3xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4">
                        <p className="text-[11px] uppercase tracking-[0.14em] font-bold text-slate-400">
                          Yıl
                        </p>
                        <p className="mt-1 text-base font-black text-slate-900 dark:text-slate-100">
                          {selectedDetails?.year ||
                            selectedSuggestion.year ||
                            "-"}
                        </p>
                      </div>

                      <div className="rounded-3xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4">
                        <p className="text-[11px] uppercase tracking-[0.14em] font-bold text-slate-400">
                          Süre / bölüm
                        </p>
                        <p className="mt-1 text-base font-black text-slate-900 dark:text-slate-100">
                          {getRuntimeText(selectedDetails) || "-"}
                        </p>
                      </div>

                      <div className="rounded-3xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4">
                        <p className="text-[11px] uppercase tracking-[0.14em] font-bold text-slate-400">
                          Platform
                        </p>
                        <p className="mt-1 text-base font-black text-slate-900 dark:text-slate-100 line-clamp-1">
                          {getPlatformsText(
                            selectedDetails,
                            selectedSuggestion
                          ) || "-"}
                        </p>
                      </div>
                    </div>

                    <div className="mt-4 rounded-3xl bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-100 dark:border-indigo-800 p-4">
                      <p className="text-[11px] uppercase tracking-[0.14em] font-black text-indigo-700 dark:text-indigo-200">
                        Neden sana uygun?
                      </p>
                      <p className="mt-2 text-sm leading-6 text-indigo-900/80 dark:text-indigo-100/85">
                        {selectedSuggestion.aiReason ||
                          selectedSuggestion.reason ||
                          "İzleme geçmişin, tür tercihin ve seçtiğin filtrelere göre önerildi."}
                      </p>
                    </div>

                    <div className="mt-4">
                      <p className="text-sm font-black text-slate-900 dark:text-slate-50">
                        Konu
                      </p>
                      <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">
                        {selectedDetails?.overview ||
                          selectedSuggestion.overview ||
                          "Bu içerik için açıklama bulunamadı."}
                      </p>
                    </div>

                    {selectedDetails?.aiEditorComment && (
                      <div className="mt-4 rounded-3xl bg-purple-50 dark:bg-purple-900/20 border border-purple-100 dark:border-purple-800 p-4">
                        <p className="text-[11px] uppercase tracking-[0.14em] font-black text-purple-700 dark:text-purple-200">
                          Yapay zeka editör yorumu
                        </p>
                        <p className="mt-2 text-sm leading-6 text-purple-900/80 dark:text-purple-100/85">
                          {selectedDetails.aiEditorComment}
                        </p>
                      </div>
                    )}

                    {selectedDetails?.aiQualityNote && (
                      <div className="mt-4 rounded-3xl bg-amber-50 dark:bg-amber-900/20 border border-amber-100 dark:border-amber-800 p-4">
                        <p className="text-[11px] uppercase tracking-[0.14em] font-black text-amber-700 dark:text-amber-200">
                          Kalite notu
                        </p>
                        <p className="mt-2 text-sm leading-6 text-amber-900/80 dark:text-amber-100/85">
                          {selectedDetails.aiQualityNote}
                        </p>
                      </div>
                    )}

                    {selectedDetails?.aiWatchAdvice && (
                      <div className="mt-4 rounded-3xl bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-100 dark:border-emerald-800 p-4">
                        <p className="text-[11px] uppercase tracking-[0.14em] font-black text-emerald-700 dark:text-emerald-200">
                          İzleme tavsiyesi
                        </p>
                        <p className="mt-2 text-sm leading-6 text-emerald-900/80 dark:text-emerald-100/85">
                          {selectedDetails.aiWatchAdvice}
                        </p>
                      </div>
                    )}

                    <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div className="rounded-3xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4">
                        <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.14em] font-black text-slate-400">
                          <Users className="w-3.5 h-3.5" />
                          {selectedSuggestion.type === "TV"
                            ? "Yaratıcı"
                            : "Yönetmen"}
                        </div>
                        <p className="mt-2 text-sm font-bold text-slate-800 dark:text-slate-100">
                          {getCrewText(selectedDetails) || "-"}
                        </p>
                      </div>

                      <div className="rounded-3xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4">
                        <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.14em] font-black text-slate-400">
                          <Clapperboard className="w-3.5 h-3.5" />
                          Durum
                        </div>
                        <p className="mt-2 text-sm font-bold text-slate-800 dark:text-slate-100">
                          {selectedDetails?.status || "-"}
                        </p>
                      </div>
                    </div>

                    <div className="mt-4">
                      <div className="flex items-center justify-between gap-3 mb-3">
                        <p className="text-sm font-black text-slate-900 dark:text-slate-50">
                          Oyuncu kadrosu
                        </p>

                        <span className="text-xs font-bold text-slate-400">
                          {(selectedDetails?.castDetails || []).length} kişi
                        </span>
                      </div>

                      {selectedDetails?.castDetails?.length ? (
                        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-2">
                          {selectedDetails.castDetails
                            .slice(0, 12)
                            .map((person, index) => (
                              <PersonAvatar
                                key={`${person.id || index}-${person.name}-${person.character || ""}`}
                                person={person}
                              />
                            ))}
                        </div>
                      ) : (
                        <div className="rounded-2xl border border-dashed border-slate-200 dark:border-slate-800 p-4 text-sm text-slate-500">
                          Oyuncu bilgisi bulunamadı.
                        </div>
                      )}
                    </div>

                    <div className="mt-4 flex flex-wrap gap-1.5">
                      {(selectedDetails?.genres?.length
                        ? selectedDetails.genres
                        : selectedSuggestion.genres || []
                      ).map((genre) => (
                        <span
                          key={genre}
                          className="rounded-full bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 px-2.5 py-1 text-xs font-bold text-slate-600 dark:text-slate-300"
                        >
                          {genre}
                        </span>
                      ))}
                    </div>

                    {detailLoadingKey ===
                      getSuggestionKey(selectedSuggestion) && (
                      <div className="mt-4 flex items-center gap-2 text-sm text-slate-500">
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Detaylar yükleniyor...
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}