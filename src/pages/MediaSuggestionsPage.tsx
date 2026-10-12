import PageLoading from "../components/feedback/PageLoading";
import { pageLoadingConfig } from "../components/feedback/pageLoadingConfig";
// src/pages/MediaSuggestionsPage.tsx

import { useEffect, useMemo, useRef, useState } from "react";
import { collection, onSnapshot, query, where } from "firebase/firestore";
import {
  ArrowUpRight,
  ChevronRight,
  SlidersHorizontal,
  RotateCcw,
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
  numberOfEpisodes?: number;
  numberOfSeasons?: number;
  isMiniseries?: boolean;

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
    description:
      "Şu an izlediğin dizilerden yola çıkarak yakın diziler önerir.",
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
  "HBO Max",
  "TV+",
  "tabii",
  "Exxen",
  "puhutv",
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
    .filter((item) => item.status !== "BIRAKILDI" && normalizeFiveRating(item.userRating) >= 4)
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
        item.status !== "BIRAKILDI" && normalizeFiveRating(item.userRating) >= 4,
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

function getPlatformsText(
  details?: MediaDetails | null,
  item?: SuggestionItem,
) {
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
    return "bg-orange-50 text-orange-700 border-orange-200 dark:bg-orange-900/20 dark:text-orange-200 dark:border-orange-800";
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
        <div className="h-16 w-12 rounded-xl overflow-hidden bg-gradient-to-br from-orange-100 to-orange-100 dark:from-slate-800 dark:to-slate-900 flex-shrink-0">
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
            <div className="h-full w-full flex items-center justify-center text-[13px] font-semibold text-orange-700 dark:text-orange-200">
              {getInitials(person.name)}
            </div>
          )}
        </div>

        <div className="min-w-0">
          <p className="text-xs font-semibold text-slate-900 dark:text-slate-100 line-clamp-1">
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
            <p className="mt-0.5 text-[10px] text-orange-500 font-bold">
              {person.episodeCount} bölüm
            </p>
          ) : null}
        </div>
      </div>
    </div>
  );
}

export default function MediaSuggestionsPage() {
  const { user } = useAuth();
  const detailPanel = useRef<HTMLDivElement>(null);
  const detailRequest = useRef(0);

  const [items, setItems] = useState<MediaItem[]>([]);
  const [mode, setMode] = useState<SuggestionMode>("TODAY");
  const [type, setType] = useState<MediaType>("ALL");
  const [showFilters, setShowFilters] = useState(false);
  const [provider, setProvider] = useState("");
  const [description, setDescription] = useState("");
  const [similarQuery, setSimilarQuery] = useState("");
  const [genres, setGenres] = useState<string[]>([]);

  const [suggestions, setSuggestions] = useState<SuggestionItem[]>([]);
  const [detailsCache, setDetailsCache] = useState<
    Record<string, MediaDetails>
  >({});
  const [selectedSuggestion, setSelectedSuggestion] =
    useState<SuggestionItem | null>(null);
  const [selectedDetails, setSelectedDetails] = useState<MediaDetails | null>(
    null,
  );

  const [loading, setLoading] = useState(false);
  const [detailLoadingKey, setDetailLoadingKey] = useState<string | null>(null);
  const [pageLoading, setPageLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!selectedSuggestion) return;
    const previousFocus = document.activeElement as HTMLElement | null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    detailPanel.current?.focus();
    const keydown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setSelectedSuggestion(null);
        setSelectedDetails(null);
      }
      if (event.key !== "Tab") return;
      const controls = detailPanel.current?.querySelectorAll<HTMLElement>(
        'button:not(:disabled), a[href], input, select, textarea, [tabindex="0"]',
      );
      if (!controls?.length) return;
      const first = controls[0],
        last = controls[controls.length - 1];
      if (
        event.shiftKey &&
        (document.activeElement === first ||
          document.activeElement === detailPanel.current)
      ) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", keydown);
    return () => {
      document.removeEventListener("keydown", keydown);
      document.body.style.overflow = previousOverflow;
      if (previousFocus?.isConnected) previousFocus.focus();
    };
  }, [selectedSuggestion]);

  useEffect(() => {
    if (!suggestions.length) return;
    const frame = requestAnimationFrame(() =>
      document
        .getElementById("discovery-results")
        ?.scrollIntoView({
          behavior: matchMedia("(prefers-reduced-motion: reduce)").matches
            ? "auto"
            : "smooth",
          block: "start",
        }),
    );
    return () => cancelAnimationFrame(frame);
  }, [suggestions]);

  const history = useMemo(() => buildHistory(items), [items]);

  const selectedMode = useMemo(
    () => modes.find((item) => item.key === mode) || modes[0],
    [mode],
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
      where("userId", "==", user.uid),
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
      },
    );

    return () => unsub();
  }, [user]);

  const toggleGenre = (genre: string) => {
    setGenres((prev) =>
      prev.includes(genre)
        ? prev.filter((item) => item !== genre)
        : [...prev, genre],
    );
  };

  const runSuggestions = async (overrideMode?: SuggestionMode) => {
    if (loading || pageLoading) return;
    const finalMode = overrideMode || mode;
    if (finalMode === "SIMILAR" && !similarQuery.trim()) {
      setError("Benzerini bulmak istediğin film veya dizinin adını yaz.");
      return;
    }

    setLoading(true);
    setError(null);
    setSelectedSuggestion(null);
    setSelectedDetails(null);

    try {
      let excludedSuggestions: string[] = [];
      const seenKey = `media-suggestions-seen:${user?.uid || "guest"}`;
      try { const saved = JSON.parse(sessionStorage.getItem(seenKey) || "[]"); if (Array.isArray(saved)) excludedSuggestions = saved.filter(value=>typeof value === "string").slice(-120); } catch {}
      const body = {
        mode: finalMode,
        type,
        description,
        genres,
        provider,
        query: similarQuery,
        history,
        excludedSuggestions,
      };

      const data = await postJson<{
        success: boolean;
        mode: SuggestionMode;
        data: SuggestionItem[];
        message?: string;
      }>("/api/media/suggestions", body);

      const list = Array.isArray(data.data) ? data.data : [];
      try { sessionStorage.setItem(seenKey,JSON.stringify([...new Set([...excludedSuggestions,...list.map(item=>`${item.type}:${item.tmdbId}`)])].slice(-120))); } catch {}

      if (finalMode === "WEEKEND") {
        setSuggestions(list.slice(0, 3));
      } else {
        setSuggestions(list);
      }

      if (list.length === 0) {
        setError(
          data.message ||
            "Bu filtrelerle öneri bulunamadı. Tür, platform veya açıklamayı değiştirerek tekrar dene.",
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
    const request = ++detailRequest.current;

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

      if (detailRequest.current === request) setSelectedDetails(details);
    } catch (err: any) {
      console.error("Öneri detay hatası:", err);
      if (detailRequest.current === request)
        setError(err?.message || "Detaylar alınırken hata oluştu.");
    } finally {
      if (detailRequest.current === request) setDetailLoadingKey(null);
    }
  };

  if (!user) {
    return (
      <div className="max-w-5xl mx-auto py-10">
        <div className="rounded-3xl border border-orange-100/70 dark:border-slate-800 bg-white/80 dark:bg-slate-900/80 p-8 text-center shadow-sm">
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
      <div className="mx-auto max-w-7xl min-w-0 space-y-6 pb-4">
        <header className="relative isolate overflow-hidden rounded-[28px] bg-[#151b25] px-6 py-8 text-white sm:px-10 sm:py-11">
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -right-20 -top-32 h-96 w-96 rounded-full bg-orange-600/20 blur-3xl"
          />
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-y-0 right-0 hidden w-[43%] items-center justify-center gap-4 overflow-hidden opacity-45 lg:flex"
          >
            {[...items]
              .filter((item) => item.posterUrl)
              .slice(0, 3)
              .map((item, index) => (
                <img
                  key={item.id || index}
                  src={item.posterUrl!}
                  alt=""
                  className={`h-64 w-44 shrink-0 rounded-2xl object-cover shadow-2xl ${index === 1 ? "-rotate-6 -translate-y-6" : "rotate-6 translate-y-10"}`}
                />
              ))}
            {!items.some((item) => item.posterUrl) && (
              <Film
                className="h-56 w-56 -rotate-12 text-white/10"
                strokeWidth={0.7}
              />
            )}
            <div className="absolute inset-0 bg-gradient-to-r from-[#151b25] via-[#151b25]/10 to-transparent" />
          </div>
          <div className="relative max-w-xl">
            <p className="flex items-center gap-2 text-xs font-semibold tracking-wide text-orange-300">
              <Clapperboard className="h-4 w-4" /> SANA ÖZEL SEÇKİ
            </p>
            <h1 className="mt-4 text-3xl font-semibold tracking-tight sm:text-4xl sm:leading-tight">
              Bir sonraki favorin
              <br />
              <span className="text-orange-300">burada başlıyor.</span>
            </h1>
            <p className="mt-4 max-w-md text-sm leading-7 text-slate-300">
              Bir film gecesi, uzun bir dizi maratonu ya da hiç beklemediğin bir
              keşif. Bu kez karar vermek keyifli olsun.
            </p>
            <a
              href="#discovery-controls"
              className="mt-6 inline-flex min-h-12 items-center gap-2 rounded-2xl bg-orange-600 px-5 text-sm font-semibold text-white transition hover:bg-orange-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-orange-300"
            >
              Sana uygun olanı bul <ArrowUpRight className="h-4 w-4" />
            </a>
            <div className="mt-6 flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-slate-400">
              <span>
                <span className="font-semibold text-white">
                  {history.completed.length}
                </span>{" "}
                içerik izlendi
              </span>
              <span>
                <span className="font-semibold text-white">
                  {history.watching.length}
                </span>{" "}
                hikâye devam ediyor
              </span>
              {topGenresFromHistory.length > 0 && (
                <span>{topGenresFromHistory.slice(0, 2).join(" · ")}</span>
              )}
            </div>
          </div>
        </header>

        <section
          id="discovery-controls"
          aria-labelledby="discovery-heading"
          className="scroll-mt-24 min-w-0 rounded-[28px] border border-slate-200/80 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:p-7"
        >
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-semibold text-orange-600 dark:text-orange-400">
                İyi bir hikâyeye ne dersin?
              </p>
              <h2
                id="discovery-heading"
                className="mt-1 text-xl font-semibold tracking-tight sm:text-2xl"
              >
                Bugün nasıl bir şey izlemek istersin?
              </h2>
            </div>
            <span className="hidden h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-orange-50 text-orange-600 dark:bg-orange-500/10 sm:flex">
              <Sparkles className="h-5 w-5" />
            </span>
          </div>
          <div
            aria-label="Öneri yaklaşımı"
            className="-mx-1 mt-5 flex gap-2 overflow-x-auto p-1 pb-3 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:flex-wrap"
          >
            {modes.map((option) => {
              const Icon = option.icon;
              return (
                <button
                  key={option.key}
                  type="button"
                  disabled={loading}
                  aria-pressed={mode === option.key}
                  onClick={() => {
                    setMode(option.key);
                    setError(null);
                  }}
                  className={`inline-flex min-h-11 shrink-0 items-center gap-2 rounded-2xl border px-4 text-xs font-semibold transition disabled:opacity-50 ${mode === option.key ? "border-orange-600 bg-orange-600 text-white shadow-sm" : "border-slate-200 bg-white text-slate-600 hover:border-orange-300 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300"}`}
                >
                  <Icon className="h-4 w-4" />
                  {option.shortTitle}
                </button>
              );
            })}
          </div>
          <form
            onSubmit={(event) => {
              event.preventDefault();
              void runSuggestions();
            }}
            className="mt-3"
          >
            <div className="mb-4 flex items-start gap-3 rounded-2xl bg-slate-50 p-4 dark:bg-slate-950/50">
              <SelectedIcon className="mt-0.5 h-5 w-5 shrink-0 text-orange-600" />
              <div>
                <h3 className="text-sm font-semibold">{selectedMode.title}</h3>
                <p className="mt-1 text-xs leading-5 text-slate-500 dark:text-slate-400">
                  {selectedMode.description}
                </p>
              </div>
            </div>
            {mode === "SIMILAR" && (
              <label
                className="mb-4 block text-sm font-medium"
                htmlFor="similar-title"
              >
                Hangi içerik gibi olsun?
                <input
                  id="similar-title"
                  value={similarQuery}
                  onChange={(event) => setSimilarQuery(event.target.value)}
                  placeholder="Örneğin: Dark, Interstellar…"
                  required
                  maxLength={200}
                  className="mt-2 block min-h-12 w-full min-w-0 rounded-2xl border border-slate-200 bg-slate-50 px-4 text-sm outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-500/15 dark:border-slate-700 dark:bg-slate-950"
                />
              </label>
            )}
            <label htmlFor="discovery-mood" className="text-sm font-medium">
              Aklından geçenleri anlat{" "}
              <span className="font-normal text-slate-400">· isteğe bağlı</span>
            </label>
            <textarea
              id="discovery-mood"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              placeholder={getModePrompt(mode)}
              maxLength={2000}
              rows={3}
              className="mt-2 block w-full min-w-0 resize-y rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm leading-6 outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-500/15 dark:border-slate-700 dark:bg-slate-950"
            />
            <div className="mt-3 flex flex-wrap gap-2">
              {[
                "Sürükleyici bir gizem",
                "İçimi ısıtan bir hikâye",
                "Gerçek olaylardan",
                "Kafa dağıtmalık",
                "Mini dizi istiyorum, yerli diziler de olabilir",
              ].map((mood) => (
                <button
                  type="button"
                  key={mood}
                  disabled={loading}
                  onClick={() => setDescription(mood)}
                  className="min-h-9 rounded-full border border-slate-200 px-3 text-xs text-slate-500 transition hover:border-orange-300 hover:text-orange-600 dark:border-slate-700 dark:text-slate-400"
                >
                  {mood}
                </button>
              ))}
            </div>
            <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-5 dark:border-slate-800">
              <div
                aria-label="İçerik türü"
                className="inline-flex rounded-2xl bg-slate-100 p-1 dark:bg-slate-950"
              >
                {(
                  [
                    { key: "ALL", label: "Hepsi", icon: Clapperboard },
                    { key: "MOVIE", label: "Film", icon: Film },
                    { key: "TV", label: "Dizi", icon: Tv },
                  ] as const
                ).map((option) => (
                  <button
                    key={option.key}
                    type="button"
                    aria-pressed={type === option.key}
                    onClick={() => setType(option.key)}
                    className={`flex min-h-10 items-center gap-1.5 rounded-xl px-3 text-xs font-semibold sm:px-4 ${type === option.key ? "bg-white text-slate-900 shadow-sm dark:bg-slate-800 dark:text-white" : "text-slate-500"}`}
                  >
                    <option.icon className="h-3.5 w-3.5" />
                    {option.label}
                  </button>
                ))}
              </div>
              <button
                type="button"
                aria-expanded={showFilters}
                aria-controls="discovery-filters"
                onClick={() => setShowFilters((value) => !value)}
                className="flex min-h-11 items-center gap-2 rounded-xl px-2 text-xs font-semibold text-slate-600 dark:text-slate-300"
              >
                <SlidersHorizontal className="h-4 w-4" />
                Tür ve platform
                {(genres.length > 0 || provider) && (
                  <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-orange-50 px-1 text-orange-700 dark:bg-orange-500/15 dark:text-orange-300">
                    {genres.length + (provider ? 1 : 0)}
                  </span>
                )}
              </button>
            </div>
            {showFilters && (
              <div
                id="discovery-filters"
                className="mt-3 space-y-4 rounded-2xl border border-slate-200 p-4 dark:border-slate-700"
              >
                <label
                  htmlFor="discovery-platform"
                  className="block text-xs font-semibold"
                >
                  Nerede izleyeceksin?
                  <select
                    id="discovery-platform"
                    value={provider}
                    onChange={(event) => setProvider(event.target.value)}
                    className="mt-2 block min-h-12 w-full min-w-0 rounded-xl border border-slate-200 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-950"
                  >
                    <option value="">Platform fark etmez</option>
                    {providerOptions.map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </select>
                </label>
                <fieldset>
                  <legend className="mb-2 text-xs font-semibold">
                    Sevdiğin türler
                  </legend>
                  <div className="flex flex-wrap gap-2">
                    {quickGenres.map((genre) => (
                      <button
                        key={genre}
                        type="button"
                        aria-pressed={genres.includes(genre)}
                        onClick={() => toggleGenre(genre)}
                        className={`min-h-10 rounded-xl border px-3 text-xs transition ${genres.includes(genre) ? "border-orange-300 bg-orange-50 text-orange-700 dark:border-orange-700 dark:bg-orange-500/10 dark:text-orange-300" : "border-slate-200 text-slate-500 dark:border-slate-700"}`}
                      >
                        {genre}
                      </button>
                    ))}
                  </div>
                </fieldset>
                <button
                  type="button"
                  onClick={() => {
                    setGenres([]);
                    setProvider("");
                  }}
                  className="flex min-h-10 items-center gap-2 text-xs font-medium text-slate-500"
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                  Filtreleri sıfırla
                </button>
              </div>
            )}
            {error && (
              <div
                role="alert"
                className="mt-4 flex items-start gap-2 rounded-2xl bg-rose-50 p-4 text-sm leading-6 text-rose-700 dark:bg-rose-500/10 dark:text-rose-300"
              >
                <AlertTriangle className="mt-1 h-4 w-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}
            <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <p className="max-w-sm text-xs leading-5 text-slate-400">
                {items.length
                  ? "İzlediklerin ve tercihlerin bu seçkiye yön verir."
                  : "İlk keşfin için ruh hâlini veya sevdiğin türleri seç."}
              </p>
              <button
                type="submit"
                disabled={loading || pageLoading}
                className="flex min-h-12 shrink-0 items-center justify-center gap-2 rounded-2xl bg-orange-600 px-6 text-sm font-semibold text-white transition hover:bg-orange-700 disabled:opacity-50"
              >
                {loading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Sparkles className="h-4 w-4" />
                )}
                {loading
                  ? "Seçkin hazırlanıyor…"
                  : suggestions.length
                    ? "Yeni bir seçki hazırla"
                    : "Önerileri keşfet"}
              </button>
            </div>
          </form>
        </section>

        <section
          aria-labelledby="discovery-results"
          aria-busy={loading}
          className="min-w-0"
        >
          <div className="mb-5 flex items-end justify-between gap-3">
            <div>
              <p className="text-xs font-semibold text-orange-600 dark:text-orange-400">
                İzlemeye değer hikâyeler
              </p>
              <h2
                id="discovery-results"
                className="mt-1 scroll-mt-24 text-2xl font-semibold tracking-tight"
              >
                {suggestions.length
                  ? "Senin için seçtiklerimiz"
                  : "Biraz ilham al"}
              </h2>
            </div>
            {suggestions.length > 0 && (
              <span className="shrink-0 rounded-full border border-slate-200 px-3 py-1.5 text-xs text-slate-500 dark:border-slate-700">
                {suggestions.length} öneri
              </span>
            )}
          </div>
          {pageLoading ? (
            <PageLoading {...pageLoadingConfig("/media/suggestions")} />
          ) : loading ? (
            <PageLoading
              variant="media-suggestions"
              label="Sana uygun hikâyeler seçiliyor…"
              description="İzleme geçmişin ve tercihlerin değerlendiriliyor."
            />
          ) : suggestions.length === 0 ? (
            <div className="grid gap-3 sm:grid-cols-3">
              {(
                [
                  {
                    mode: "WEEKEND",
                    title: "Hafta sonu sineması",
                    detail: "Üç film, üç farklı dünyaya yolculuk.",
                    icon: Film,
                  },
                  {
                    mode: "WATCHING_SIMILAR",
                    title: "Bir bölüm daha",
                    detail: "Sevdiğin dizilerin izinden yeni hikâyelere.",
                    icon: Tv,
                  },
                  {
                    mode: "HIGH_RATED_UNWATCHED",
                    title: "Gözünden kaçanlar",
                    detail: "Yüksek puanlı, henüz izlemediğin yapımlar.",
                    icon: Star,
                  },
                ] as const
              ).map((option, index) => (
                <button
                  key={option.mode}
                  type="button"
                  onClick={() => {
                    setMode(option.mode);
                    void runSuggestions(option.mode);
                  }}
                  className="group relative overflow-hidden rounded-3xl border border-slate-200 bg-white p-6 text-left transition hover:border-orange-300 hover:shadow-md dark:border-slate-800 dark:bg-slate-900"
                >
                  <span
                    aria-hidden="true"
                    className="absolute right-5 top-3 text-6xl font-semibold text-slate-100 dark:text-slate-800"
                  >
                    0{index + 1}
                  </span>
                  <option.icon
                    className="relative h-6 w-6 text-orange-600"
                    strokeWidth={1.6}
                  />
                  <h3 className="relative mt-8 text-base font-semibold">
                    {option.title}
                  </h3>
                  <p className="relative mt-2 max-w-56 text-xs leading-6 text-slate-500 dark:text-slate-400">
                    {option.detail}
                  </p>
                  <span className="mt-5 inline-flex min-h-10 items-center gap-2 text-xs font-semibold text-orange-600">
                    Seçki oluştur{" "}
                    <ArrowUpRight className="h-4 w-4 transition group-hover:translate-x-0.5" />
                  </span>
                </button>
              ))}
            </div>
          ) : (
            <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
              {suggestions.map((item, index) => {
                const key = getSuggestionKey(item),
                  detail = detailsCache[key];
                return (
                  <article
                    key={key}
                    className="group flex min-w-0 flex-col overflow-hidden rounded-[26px] border border-slate-200 bg-white shadow-sm transition hover:shadow-lg dark:border-slate-800 dark:bg-slate-900"
                  >
                    <button
                      type="button"
                      onClick={() => void loadDetails(item)}
                      aria-label={`${item.title}: detayları incele`}
                      className="relative isolate flex h-72 w-full items-center justify-center overflow-hidden bg-slate-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-orange-500 dark:bg-slate-950 sm:h-80"
                    >
                      {item.backdropUrl && (
                        <img
                          src={item.backdropUrl}
                          alt=""
                          loading="lazy"
                          className="absolute inset-0 -z-20 h-full w-full scale-110 object-cover opacity-25 blur-lg"
                        />
                      )}
                      <div className="absolute inset-0 -z-10 bg-gradient-to-t from-slate-950/70 via-slate-950/10 to-transparent" />
                      <PosterBox
                        url={item.posterUrl}
                        title={item.title}
                        className="h-56 w-36 rounded-xl shadow-2xl transition duration-300 motion-safe:group-hover:-translate-y-1 sm:h-64 sm:w-44"
                      />
                      <span className="absolute left-4 top-4 rounded-full bg-slate-950/70 px-3 py-1.5 text-[11px] font-semibold text-white backdrop-blur-md">
                        {item.type === "TV" ? "Dizi" : "Film"}
                      </span>
                      {typeof item.tmdbRating === "number" &&
                        item.tmdbRating > 0 && (
                          <span className="absolute right-4 top-4 flex items-center gap-1 rounded-full bg-white/95 px-2.5 py-1.5 text-xs font-semibold text-slate-900">
                            <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
                            {item.tmdbRating.toFixed(1)}
                            <span className="text-[9px] text-slate-500">
                              TMDB
                            </span>
                          </span>
                        )}
                      <span className="absolute bottom-4 left-4 text-xs font-medium text-white/80">
                        {String(index + 1).padStart(2, "0")} / SENİN SEÇKİN
                      </span>
                      <span className="absolute bottom-3 right-4 flex h-10 w-10 items-center justify-center rounded-full border border-white/30 bg-white/10 text-white backdrop-blur">
                        <ArrowUpRight className="h-5 w-5" />
                      </span>
                    </button>
                    <div className="flex flex-1 flex-col p-5">
                      <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-500">
                        <span>{item.year || "Yıl bilgisi yok"}</span>
                        {item.genres?.length ? (
                          <>
                            <span aria-hidden="true">·</span>
                            <span>{item.genres.slice(0, 2).join(" / ")}</span>
                          </>
                        ) : null}
                      </div>
                      {item.isMiniseries && <p className="mt-2 text-xs font-semibold text-orange-600">Mini dizi · {item.numberOfSeasons} sezon · {item.numberOfEpisodes} bölüm</p>}
                    <h3 className="mt-2 text-xl font-semibold tracking-tight">
                        {item.title}
                      </h3>
                      {item.originalTitle &&
                        item.originalTitle !== item.title && (
                          <p className="mt-1 text-xs text-slate-400">
                            {item.originalTitle}
                          </p>
                        )}
                      <p className="mt-3 line-clamp-3 text-sm leading-6 text-slate-500 dark:text-slate-400">
                        {item.overview ||
                          "Hikâyeyi ve oyuncu kadrosunu detaylardan keşfet."}
                      </p>
                      {(item.aiReason || item.reason) && (
                        <div className="mt-4 rounded-2xl bg-orange-50/80 p-3.5 dark:bg-orange-500/5">
                          <p className="flex items-center gap-1.5 text-xs font-semibold text-orange-700 dark:text-orange-300">
                            <Sparkles className="h-3.5 w-3.5" />
                            Neden sana uygun?
                          </p>
                          <p className="mt-2 line-clamp-3 text-xs leading-6 text-slate-600 dark:text-slate-400">
                            {item.aiReason || item.reason}
                          </p>
                        </div>
                      )}
                      {getPlatformsText(detail, item) && (
                        <p className="mt-3 line-clamp-2 text-xs leading-5 text-slate-500">
                          <Tv className="mr-1 inline h-3.5 w-3.5" />
                          {getPlatformsText(detail, item)}
                        </p>
                      )}
                      <div className="mt-auto flex items-center gap-2 border-t border-slate-100 pt-4 dark:border-slate-800">
                        <button
                          type="button"
                          disabled={detailLoadingKey === key}
                          onClick={() => void loadDetails(item)}
                          className="mt-4 flex min-h-11 flex-1 items-center justify-center gap-2 rounded-xl bg-slate-900 px-3 text-xs font-semibold text-white transition hover:bg-orange-600 disabled:opacity-50 dark:bg-slate-100 dark:text-slate-900"
                        >
                          {detailLoadingKey === key ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <PlayCircle className="h-4 w-4" />
                          )}
                          Detayları keşfet
                        </button>
                        <button
                          type="button"
                          aria-label={`${item.title} benzeri içerikleri bul`}
                          onClick={() => {
                            setMode("SIMILAR");
                            setSimilarQuery(item.title);
                            setDescription(
                              `${item.title} benzeri öneriler getir.`,
                            );
                            document
                              .getElementById("discovery-controls")
                              ?.scrollIntoView({ behavior: "smooth" });
                          }}
                          className="mt-4 flex min-h-11 items-center justify-center rounded-xl border border-slate-200 px-3 text-xs font-semibold text-slate-500 hover:border-orange-300 dark:border-slate-700"
                        >
                          Benzerini bul
                        </button>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
          {suggestions.length > 0 && (
            <p className="mt-5 text-center text-[11px] leading-5 text-slate-400">
              Platform bilgileri bölgeye ve zamana göre değişebilir. İzlemeden
              önce platformdan kontrol edebilirsin.
            </p>
          )}
        </section>
      </div>

      {selectedSuggestion && (
        <div className="fixed inset-0 z-[110]">
          <button
            type="button"
            aria-label="Detayları kapat"
            className="absolute inset-0 bg-slate-950/75 backdrop-blur-sm"
            onClick={() => {
              setSelectedSuggestion(null);
              setSelectedDetails(null);
            }}
          />

          <div className="absolute inset-0 flex items-center justify-center p-4 pointer-events-none">
            <div
              ref={detailPanel}
              tabIndex={-1}
              role="dialog"
              aria-modal="true"
              aria-label={selectedSuggestion.title}
              className="w-full max-w-6xl max-h-[90dvh] overflow-hidden rounded-[32px] bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 shadow-2xl pointer-events-auto"
            >
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
                  aria-label="Detayları kapat"
                  className="absolute top-4 right-4 h-10 w-10 rounded-full bg-white/90 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 shadow-sm flex items-center justify-center"
                >
                  <X className="w-5 h-5 text-slate-700 dark:text-slate-200" />
                </button>
              </div>

              <div className="px-5 pb-5 -mt-28 relative overflow-y-auto max-h-[calc(90dvh-120px)]">
                <div className="grid grid-cols-1 lg:grid-cols-[230px_1fr] gap-5">
                  <div>
                    <PosterBox
                      url={
                        selectedDetails?.posterUrl ||
                        selectedSuggestion.posterUrl
                      }
                      title={selectedSuggestion.title}
                      className="mx-auto h-[285px] w-[190px] lg:h-[345px] lg:w-full border-4 border-white dark:border-slate-950 shadow-xl"
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
                    </div>
                  </div>

                  <div className="pt-3 lg:pt-32">
                    {error && (
                      <p
                        role="alert"
                        className="mb-3 rounded-xl bg-rose-50 p-3 text-sm text-rose-700 dark:bg-rose-500/10 dark:text-rose-300"
                      >
                        {error}
                      </p>
                    )}
                    {detailLoadingKey && (
                      <p
                        role="status"
                        className="mb-3 flex items-center gap-2 text-sm text-slate-500"
                      >
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Detaylar hazırlanıyor…
                      </p>
                    )}
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 px-2.5 py-1 text-xs font-semibold text-slate-700 dark:text-slate-200">
                        {selectedSuggestion.type === "TV" ? (
                          <Tv className="w-3.5 h-3.5" />
                        ) : (
                          <Film className="w-3.5 h-3.5" />
                        )}
                        {typeLabel(selectedSuggestion.type)}
                      </span>

                      {selectedSuggestion.matchScore && (
                        <span
                          className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${getMatchTone(
                            selectedSuggestion.matchScore,
                          )}`}
                        >
                          %{selectedSuggestion.matchScore} uyum
                        </span>
                      )}

                      {(selectedDetails?.tmdbRating ||
                        selectedSuggestion.tmdbRating) && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 dark:bg-amber-900/20 border border-amber-100 dark:border-amber-800 px-2.5 py-1 text-xs font-semibold text-amber-700 dark:text-amber-200">
                          <Star className="w-3.5 h-3.5 fill-current" />
                          TMDb{" "}
                          {selectedDetails?.tmdbRating ||
                            selectedSuggestion.tmdbRating}
                          /10
                        </span>
                      )}

                      {selectedDetails?.imdbRating && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-100 dark:border-yellow-800 px-2.5 py-1 text-xs font-semibold text-yellow-700 dark:text-yellow-200">
                          IMDb {selectedDetails.imdbRating}/10
                        </span>
                      )}
                    </div>

                    <h2 className="mt-3 text-2xl md:text-3xl font-semibold text-slate-900 dark:text-slate-50">
                      {selectedDetails?.title || selectedSuggestion.title}
                    </h2>

                    {selectedDetails?.originalTitle &&
                      selectedDetails.originalTitle !==
                        selectedDetails.title && (
                        <p className="mt-1 text-sm text-slate-500">
                          Orijinal ad: {selectedDetails.originalTitle}
                        </p>
                      )}

                    <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-3">
                      <div className="rounded-3xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4">
                        <p className="text-[11px] uppercase tracking-[0.14em] font-bold text-slate-400">
                          Yıl
                        </p>
                        <p className="mt-1 text-base font-semibold text-slate-900 dark:text-slate-100">
                          {selectedDetails?.year ||
                            selectedSuggestion.year ||
                            "-"}
                        </p>
                      </div>

                      <div className="rounded-3xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4">
                        <p className="text-[11px] uppercase tracking-[0.14em] font-bold text-slate-400">
                          Süre / bölüm
                        </p>
                        <p className="mt-1 text-base font-semibold text-slate-900 dark:text-slate-100">
                          {getRuntimeText(selectedDetails) || "-"}
                        </p>
                      </div>

                      <div className="rounded-3xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4">
                        <p className="text-[11px] uppercase tracking-[0.14em] font-bold text-slate-400">
                          Platform
                        </p>
                        <p className="mt-1 text-base font-semibold text-slate-900 dark:text-slate-100 line-clamp-1">
                          {getPlatformsText(
                            selectedDetails,
                            selectedSuggestion,
                          ) || "-"}
                        </p>
                      </div>
                    </div>

                    <div className="mt-4 rounded-3xl bg-orange-50 dark:bg-orange-900/20 border border-orange-100 dark:border-orange-800 p-4">
                      <p className="text-[11px] uppercase tracking-[0.14em] font-semibold text-orange-700 dark:text-orange-200">
                        Neden sana uygun?
                      </p>
                      <p className="mt-2 text-sm leading-6 text-orange-900/80 dark:text-orange-100/85">
                        {selectedSuggestion.aiReason ||
                          selectedSuggestion.reason ||
                          "İzleme geçmişin, tür tercihin ve seçtiğin filtrelere göre önerildi."}
                      </p>
                    </div>

                    <div className="mt-4">
                      <p className="text-sm font-semibold text-slate-900 dark:text-slate-50">
                        Konu
                      </p>
                      <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">
                        {selectedDetails?.overview ||
                          selectedSuggestion.overview ||
                          "Bu içerik için açıklama bulunamadı."}
                      </p>
                    </div>

                    {selectedDetails?.aiEditorComment && (
                      <div className="mt-4 rounded-3xl bg-orange-50 dark:bg-orange-900/20 border border-orange-100 dark:border-orange-800 p-4">
                        <p className="text-[11px] uppercase tracking-[0.14em] font-semibold text-orange-700 dark:text-orange-200">
                          Yapay zeka editör yorumu
                        </p>
                        <p className="mt-2 text-sm leading-6 text-orange-900/80 dark:text-orange-100/85">
                          {selectedDetails.aiEditorComment}
                        </p>
                      </div>
                    )}

                    {selectedDetails?.aiQualityNote && (
                      <div className="mt-4 rounded-3xl bg-amber-50 dark:bg-amber-900/20 border border-amber-100 dark:border-amber-800 p-4">
                        <p className="text-[11px] uppercase tracking-[0.14em] font-semibold text-amber-700 dark:text-amber-200">
                          Kalite notu
                        </p>
                        <p className="mt-2 text-sm leading-6 text-amber-900/80 dark:text-amber-100/85">
                          {selectedDetails.aiQualityNote}
                        </p>
                      </div>
                    )}

                    {selectedDetails?.aiWatchAdvice && (
                      <div className="mt-4 rounded-3xl bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-100 dark:border-emerald-800 p-4">
                        <p className="text-[11px] uppercase tracking-[0.14em] font-semibold text-emerald-700 dark:text-emerald-200">
                          İzleme tavsiyesi
                        </p>
                        <p className="mt-2 text-sm leading-6 text-emerald-900/80 dark:text-emerald-100/85">
                          {selectedDetails.aiWatchAdvice}
                        </p>
                      </div>
                    )}

                    <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div className="rounded-3xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4">
                        <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.14em] font-semibold text-slate-400">
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
                        <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.14em] font-semibold text-slate-400">
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
                        <p className="text-sm font-semibold text-slate-900 dark:text-slate-50">
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
                      <PageLoading
                        compact
                        variant="media-detail"
                        label="İçerik bilgileri tamamlanıyor…"
                      />
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
