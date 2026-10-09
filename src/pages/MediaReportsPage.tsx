// src/pages/MediaReportsPage.tsx

import { useEffect, useMemo, useState } from "react";
import { collection, onSnapshot, query, where } from "firebase/firestore";
import { Link } from "react-router-dom";
import {
  AlertTriangle,
  BarChart3,
  Calendar,
  CheckCircle2,
  Clapperboard,
  Clock3,
  Eye,
  Film,
  Filter,
  ImageIcon,
  LibraryBig,
  Loader2,
  Search,
  Sparkles,
  Star,
  Trophy,
  Tv,
  X,
} from "lucide-react";

import { db } from "../firebase/firebase";
import { useAuth } from "../auth/AuthContext";

type MediaType = "MOVIE" | "TV";
type ViewTab = "GENERAL" | "MOVIE" | "TV";
type WatchStatus = "IZLENECEK" | "IZLENIYOR" | "IZLENDI" | "BIRAKILDI";

type WatchLogItem = {
  id?: string;
  userId: string;
  mediaId: string;
  mediaType: MediaType;
  title: string;

  date?: string;
  monthKey?: string;

  minutes?: number;
  completed?: boolean;

  seasonNumber?: number | null;
  episodeNumber?: number | null;
  episodeTitle?: string;

  genres?: string[];
  platform?: string;

  createdAt?: any;
  actionAt?: any;
};

type MediaMeta = {
  id: string;
  title?: string;
  type?: MediaType;
  status?: WatchStatus;

  posterUrl?: string | null;
  backdropUrl?: string | null;

  genres?: string[];
  platforms?: string[];

  tmdbRating?: number | null;
  year?: string;

  startedAt?: any;
  watchedAt?: any;
  completedAt?: any;
  lastActionAt?: any;

  numberOfEpisodes?: number;
  watchedEpisodeCount?: number;
};

type EnrichedLog = WatchLogItem & {
  posterUrl?: string | null;
  backdropUrl?: string | null;
  tmdbRating?: number | null;
  mediaGenres?: string[];
  mediaPlatforms?: string[];
  year?: string;

  mediaStatus?: WatchStatus;
  mediaStartedAt?: any;
  mediaWatchedAt?: any;
  mediaCompletedAt?: any;
  mediaLastActionAt?: any;

  numberOfEpisodes?: number;
  watchedEpisodeCount?: number;
};

type MonthlySummary = {
  monthKey: string;
  label: string;

  totalMinutes: number;
  logCount: number;

  movieLogs: EnrichedLog[];
  tvEpisodeLogs: EnrichedLog[];
  completedTvItems: MediaMeta[];

  movieCount: number;
  movieCompletedCount: number;
  tvEpisodeCount: number;
  tvCompletedCount: number;

  posters: string[];
};

type PreviewImage = {
  url: string;
  title: string;
};

const monthLabels = [
  { value: "01", label: "Ocak" },
  { value: "02", label: "Şubat" },
  { value: "03", label: "Mart" },
  { value: "04", label: "Nisan" },
  { value: "05", label: "Mayıs" },
  { value: "06", label: "Haziran" },
  { value: "07", label: "Temmuz" },
  { value: "08", label: "Ağustos" },
  { value: "09", label: "Eylül" },
  { value: "10", label: "Ekim" },
  { value: "11", label: "Kasım" },
  { value: "12", label: "Aralık" },
];

function getMillis(value: any) {
  if (!value) return 0;

  if (typeof value?.toMillis === "function") {
    return value.toMillis();
  }

  if (typeof value === "string") {
    const parsed = Date.parse(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  if (value instanceof Date) {
    return value.getTime();
  }

  return 0;
}

function formatDate(value?: string) {
  if (!value) return "-";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return value;

  return date.toLocaleDateString("tr-TR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function formatDateTime(value: any) {
  const millis = getMillis(value);

  if (!millis) return "-";

  return new Date(millis).toLocaleString("tr-TR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatFlexibleDate(value: any) {
  const millis = getMillis(value);

  if (!millis) return "-";

  return new Date(millis).toLocaleDateString("tr-TR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function getDateYear(value: any) {
  const millis = getMillis(value);
  if (!millis) return "";
  return new Date(millis).getFullYear().toString();
}

function getDateMonth(value: any) {
  const millis = getMillis(value);
  if (!millis) return "";
  return String(new Date(millis).getMonth() + 1).padStart(2, "0");
}

function getLogYear(log: WatchLogItem) {
  if (log.date && log.date.length >= 4) {
    return log.date.slice(0, 4);
  }

  if (log.monthKey && log.monthKey.length >= 4) {
    return log.monthKey.slice(0, 4);
  }

  const millis = getMillis(log.actionAt || log.createdAt);

  if (!millis) return "";

  return new Date(millis).getFullYear().toString();
}

function getLogMonth(log: WatchLogItem) {
  if (log.date && log.date.length >= 7) {
    return log.date.slice(5, 7);
  }

  if (log.monthKey && log.monthKey.length >= 7) {
    return log.monthKey.slice(5, 7);
  }

  const millis = getMillis(log.actionAt || log.createdAt);

  if (!millis) return "";

  return String(new Date(millis).getMonth() + 1).padStart(2, "0");
}

function getLogMonthKey(log: WatchLogItem) {
  const year = getLogYear(log);
  const month = getLogMonth(log);

  if (!year || !month) return "Bilinmiyor";

  return `${year}-${month}`;
}

function getMonthKeyFromDateValue(value: any) {
  const millis = getMillis(value);

  if (!millis) return "Bilinmiyor";

  const date = new Date(millis);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");

  return `${year}-${month}`;
}

function formatMonthKey(monthKey: string) {
  if (!monthKey || monthKey === "Bilinmiyor") return "Bilinmiyor";

  const [year, month] = monthKey.split("-");
  const monthLabel = monthLabels.find((item) => item.value === month)?.label;

  return `${monthLabel || month} ${year}`;
}

function mediaTypeLabel(type?: MediaType) {
  return type === "TV" ? "Dizi" : "Film";
}

function watchStatusLabel(status?: WatchStatus) {
  if (status === "IZLENECEK") return "İzlenecek";
  if (status === "IZLENIYOR") return "Devam ediyor";
  if (status === "IZLENDI") return "Tamamlandı";
  if (status === "BIRAKILDI") return "Bırakıldı";
  return "Durum bilinmiyor";
}

function getWatchStatusClass(status?: WatchStatus) {
  if (status === "IZLENDI") {
    return "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-200 dark:border-emerald-800";
  }

  if (status === "IZLENIYOR") {
    return "bg-sky-50 text-sky-700 border-sky-200 dark:bg-sky-900/20 dark:text-sky-200 dark:border-sky-800";
  }

  if (status === "BIRAKILDI") {
    return "bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-900/20 dark:text-rose-200 dark:border-rose-800";
  }

  return "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/20 dark:text-amber-200 dark:border-amber-800";
}

function getTvCompletionDate(item: MediaMeta | EnrichedLog) {
  if ("mediaCompletedAt" in item) {
    return item.mediaCompletedAt || item.mediaWatchedAt || item.mediaLastActionAt || null;
  }

  return item.completedAt || item.watchedAt || item.lastActionAt || null;
}

function formatMinutes(minutes: number) {
  const safe = Math.max(0, Math.round(minutes || 0));

  if (safe < 60) {
    return `${safe} dk`;
  }

  const hours = Math.floor(safe / 60);
  const mins = safe % 60;

  if (mins === 0) {
    return `${hours} sa`;
  }

  return `${hours} sa ${mins} dk`;
}

function makeTitleKey(title?: string, type?: MediaType) {
  return `${type || ""}__${String(title || "")
    .trim()
    .toLocaleLowerCase("tr-TR")}`;
}

function getSearchableText(log: EnrichedLog) {
  return [
    log.title,
    log.episodeTitle,
    log.platform,
    ...(log.genres || []),
    ...(log.mediaGenres || []),
    ...(log.mediaPlatforms || []),
    log.mediaType,
    log.mediaStatus,
  ]
    .filter(Boolean)
    .join(" ")
    .toLocaleLowerCase("tr-TR");
}

function getTopValue(values: string[]) {
  const map = new Map<string, number>();

  values.filter(Boolean).forEach((value) => {
    map.set(value, (map.get(value) || 0) + 1);
  });

  return [...map.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] || "-";
}

function getReportStats(logs: EnrichedLog[]) {
  const totalMinutes = logs.reduce(
    (sum, log) => sum + Number(log.minutes || 0),
    0
  );

  const movieLogs = logs.filter((log) => log.mediaType === "MOVIE");
  const tvLogs = logs.filter((log) => log.mediaType === "TV");

  const uniqueMovies = new Set(movieLogs.map((log) => log.mediaId || log.title));
  const uniqueTitles = new Set(logs.map((log) => log.mediaId || log.title));

  const completedCount = logs.filter((log) => log.completed).length;

  const genreValues = logs.flatMap((log) => [
    ...(log.genres || []),
    ...(log.mediaGenres || []),
  ]);

  const platformValues = logs.flatMap((log) => [
    ...(log.platform ? [log.platform] : []),
    ...((log.mediaPlatforms || []).slice(0, 1)),
  ]);

  const totalTmdbRatings = logs
    .map((log) => Number(log.tmdbRating || 0))
    .filter((rating) => rating > 0);

  const averageTmdbRating =
    totalTmdbRatings.length > 0
      ? Math.round(
          (totalTmdbRatings.reduce((sum, v) => sum + v, 0) /
            totalTmdbRatings.length) *
            10
        ) / 10
      : 0;

  const titleCountMap = new Map<string, number>();
  const titleMinuteMap = new Map<string, number>();

  logs.forEach((log) => {
    const key = log.title || "Bilinmiyor";

    titleCountMap.set(key, (titleCountMap.get(key) || 0) + 1);
    titleMinuteMap.set(
      key,
      (titleMinuteMap.get(key) || 0) + Number(log.minutes || 0)
    );
  });

  const mostLoggedTitle =
    [...titleCountMap.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] || "-";

  const longestEntry = [...titleMinuteMap.entries()].sort(
    (a, b) => b[1] - a[1]
  )[0];

  return {
    totalLogs: logs.length,
    totalMinutes,
    totalHours: Math.round((totalMinutes / 60) * 10) / 10,
    uniqueMovieCount: uniqueMovies.size,
    episodeCount: tvLogs.length,
    uniqueTitleCount: uniqueTitles.size,
    completedCount,
    topGenre: getTopValue(genreValues),
    topPlatform: getTopValue(platformValues),
    averageTmdbRating,
    mostLoggedTitle,
    longestWatchedTitle: longestEntry?.[0] || "-",
    longestWatchedMinutes: longestEntry?.[1] || 0,
  };
}

function uniqueByMediaId(logs: EnrichedLog[]) {
  const map = new Map<string, EnrichedLog>();

  logs.forEach((log) => {
    const key = log.mediaId || `${log.mediaType}-${log.title}`;
    if (!map.has(key)) {
      map.set(key, log);
    }
  });

  return Array.from(map.values());
}

function buildMonthlySummaries(
  logs: EnrichedLog[],
  completedTvItems: MediaMeta[],
  viewTab: ViewTab
): MonthlySummary[] {
  const map = new Map<string, MonthlySummary>();

  const ensureItem = (monthKey: string) => {
    if (!map.has(monthKey)) {
      map.set(monthKey, {
        monthKey,
        label: formatMonthKey(monthKey),
        totalMinutes: 0,
        logCount: 0,
        movieLogs: [],
        tvEpisodeLogs: [],
        completedTvItems: [],
        movieCount: 0,
        movieCompletedCount: 0,
        tvEpisodeCount: 0,
        tvCompletedCount: 0,
        posters: [],
      });
    }

    return map.get(monthKey)!;
  };

  logs.forEach((log) => {
    const monthKey = getLogMonthKey(log);
    const item = ensureItem(monthKey);

    item.totalMinutes += Number(log.minutes || 0);
    item.logCount += 1;

    const poster = log.posterUrl || log.backdropUrl || null;
    if (poster && !item.posters.includes(poster)) {
      item.posters.push(poster);
    }

    if (log.mediaType === "MOVIE" && viewTab !== "TV") {
      item.movieLogs.push(log);
    }

    if (log.mediaType === "TV" && viewTab !== "MOVIE") {
      item.tvEpisodeLogs.push(log);
    }
  });

  completedTvItems.forEach((tv) => {
    if (viewTab === "MOVIE") return;

    const completedDate = getTvCompletionDate(tv);
    const monthKey = getMonthKeyFromDateValue(completedDate);
    const item = ensureItem(monthKey);

    item.completedTvItems.push(tv);

    const poster = tv.posterUrl || tv.backdropUrl || null;
    if (poster && !item.posters.includes(poster)) {
      item.posters.push(poster);
    }
  });

  return Array.from(map.values())
    .map((item) => {
      const uniqueMovies = uniqueByMediaId(item.movieLogs);
      const uniqueCompletedMovies = uniqueByMediaId(
        item.movieLogs.filter((log) => log.completed)
      );

      const uniqueCompletedTv = new Map<string, MediaMeta>();
      item.completedTvItems.forEach((tv) => {
        uniqueCompletedTv.set(tv.id, tv);
      });

      return {
        ...item,
        movieCount: uniqueMovies.length,
        movieCompletedCount: uniqueCompletedMovies.length,
        tvEpisodeCount: item.tvEpisodeLogs.length,
        tvCompletedCount: uniqueCompletedTv.size,
        completedTvItems: Array.from(uniqueCompletedTv.values()),
        posters: item.posters.slice(0, 4),
      };
    })
    .filter((item) => {
      if (viewTab === "MOVIE") {
        return item.movieCount > 0;
      }

      if (viewTab === "TV") {
        return item.tvEpisodeCount > 0 || item.tvCompletedCount > 0;
      }

      return item.movieCount > 0 || item.tvEpisodeCount > 0 || item.tvCompletedCount > 0;
    })
    .sort((a, b) => b.monthKey.localeCompare(a.monthKey));
}

function PosterThumb({
  url,
  title,
  onClick,
  className = "",
}: {
  url?: string | null;
  title: string;
  onClick?: () => void;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={url ? onClick : undefined}
      className={`relative overflow-hidden rounded-2xl bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 ${className}`}
    >
      {url ? (
        <>
          <img src={url} alt={title} className="w-full h-full object-cover" />
          <span className="absolute inset-0 bg-slate-950/0 hover:bg-slate-950/25 transition flex items-center justify-center">
            <Eye className="w-4 h-4 text-white opacity-0 hover:opacity-100 transition" />
          </span>
        </>
      ) : (
        <div className="w-full h-full flex items-center justify-center text-slate-400">
          <ImageIcon className="w-5 h-5" />
        </div>
      )}
    </button>
  );
}

function MiniPosterStack({
  posters,
  title,
  onPreview,
}: {
  posters: string[];
  title: string;
  onPreview: (url: string, title: string) => void;
}) {
  if (posters.length === 0) {
    return (
      <div className="flex -space-x-3">
        {[0, 1, 2].map((index) => (
          <div
            key={index}
            className="h-16 w-11 rounded-2xl border-2 border-white dark:border-slate-950 bg-slate-100 dark:bg-slate-900 flex items-center justify-center text-slate-400"
          >
            <ImageIcon className="w-4 h-4" />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="flex -space-x-3">
      {posters.slice(0, 4).map((poster, index) => (
        <button
          key={`${poster}-${index}`}
          type="button"
          onClick={() => onPreview(poster, title)}
          className="h-16 w-11 rounded-2xl overflow-hidden border-2 border-white dark:border-slate-950 bg-slate-100 dark:bg-slate-900 shadow-sm hover:-translate-y-1 transition"
        >
          <img src={poster} alt={title} className="h-full w-full object-cover" />
        </button>
      ))}
    </div>
  );
}

function SmallInfoCard({
  label,
  value,
  icon,
}: {
  label: string;
  value: string | number;
  icon: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl bg-white/80 dark:bg-slate-900/80 border border-white/80 dark:border-slate-800 p-4 shadow-sm">
      <div className="flex items-center justify-between">
        <span className="text-[11px] uppercase tracking-[0.16em] font-semibold text-slate-500">
          {label}
        </span>
        {icon}
      </div>
      <p className="mt-2 text-2xl font-black text-slate-900 dark:text-slate-50">
        {value}
      </p>
    </div>
  );
}
function getInsightToneClass(tone: "indigo" | "emerald" | "amber" | "purple") {
  if (tone === "emerald") {
    return "bg-emerald-50 dark:bg-emerald-900/20 border-emerald-100 dark:border-emerald-800 text-emerald-800 dark:text-emerald-100";
  }

  if (tone === "amber") {
    return "bg-amber-50 dark:bg-amber-900/20 border-amber-100 dark:border-amber-800 text-amber-800 dark:text-amber-100";
  }

  if (tone === "purple") {
    return "bg-purple-50 dark:bg-purple-900/20 border-purple-100 dark:border-purple-800 text-purple-800 dark:text-purple-100";
  }

  return "bg-indigo-50 dark:bg-indigo-900/20 border-indigo-100 dark:border-indigo-800 text-indigo-800 dark:text-indigo-100";
}

export default function MediaReportsPage() {
  const { user } = useAuth();

  const [rawLogs, setRawLogs] = useState<WatchLogItem[]>([]);
  const [mediaMap, setMediaMap] = useState<Record<string, MediaMeta>>({});
  const [mediaTitleMap, setMediaTitleMap] = useState<Record<string, MediaMeta>>(
    {}
  );
  const [loading, setLoading] = useState(true);

  const [viewTab, setViewTab] = useState<ViewTab>("GENERAL");
  const [yearFilter, setYearFilter] = useState<string>("ALL");
  const [monthFilter, setMonthFilter] = useState<string>("ALL");
  const [searchText, setSearchText] = useState("");

  const [selectedMonth, setSelectedMonth] = useState<MonthlySummary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [previewImage, setPreviewImage] = useState<PreviewImage | null>(null);

  const allLogs = useMemo<EnrichedLog[]>(() => {
    return rawLogs
      .map((log) => {
        const media =
          mediaMap[log.mediaId] ||
          mediaTitleMap[makeTitleKey(log.title, log.mediaType)];

        if (!media) return null;

        return {
          ...log,
          posterUrl: media.posterUrl || media.backdropUrl || null,
          backdropUrl: media.backdropUrl || null,
          tmdbRating: media.tmdbRating || null,
          mediaGenres: media.genres || [],
          mediaPlatforms: media.platforms || [],
          year: media.year || "",

          mediaStatus: media.status,
          mediaStartedAt: media.startedAt,
          mediaWatchedAt: media.watchedAt,
          mediaCompletedAt: media.completedAt,
          mediaLastActionAt: media.lastActionAt,

          numberOfEpisodes: media.numberOfEpisodes || 0,
          watchedEpisodeCount: media.watchedEpisodeCount || 0,
        } as EnrichedLog;
      })
      .filter(Boolean) as EnrichedLog[];
  }, [rawLogs, mediaMap, mediaTitleMap]);

  const hiddenDeletedLogCount = useMemo(() => {
    return rawLogs.length - allLogs.length;
  }, [rawLogs.length, allLogs.length]);

  const years = useMemo(() => {
    return Array.from(
      new Set(allLogs.map((log) => getLogYear(log)).filter(Boolean))
    ).sort((a, b) => b.localeCompare(a));
  }, [allLogs]);

  const filteredLogs = useMemo(() => {
    const search = searchText.trim().toLocaleLowerCase("tr-TR");

    return allLogs.filter((log) => {
      const matchesYear =
        yearFilter === "ALL" ? true : getLogYear(log) === yearFilter;

      const matchesMonth =
        monthFilter === "ALL" ? true : getLogMonth(log) === monthFilter;

      const matchesSearch = search
        ? getSearchableText(log).includes(search)
        : true;

      const matchesTab =
        viewTab === "GENERAL"
          ? true
          : viewTab === "MOVIE"
          ? log.mediaType === "MOVIE"
          : log.mediaType === "TV";

      return matchesYear && matchesMonth && matchesSearch && matchesTab;
    });
  }, [allLogs, viewTab, yearFilter, monthFilter, searchText]);

  const stats = useMemo(() => getReportStats(filteredLogs), [filteredLogs]);

  const completedTvItems = useMemo(() => {
    const search = searchText.trim().toLocaleLowerCase("tr-TR");

    return Object.values(mediaMap)
      .filter((item) => item.type === "TV")
      .filter((item) => item.status === "IZLENDI")
      .filter((item) => {
        const completionDate = getTvCompletionDate(item);

        const matchesYear =
          yearFilter === "ALL"
            ? true
            : getDateYear(completionDate) === yearFilter;

        const matchesMonth =
          monthFilter === "ALL"
            ? true
            : getDateMonth(completionDate) === monthFilter;

        const matchesSearch = search
          ? String(item.title || "")
              .toLocaleLowerCase("tr-TR")
              .includes(search)
          : true;

        if (viewTab === "MOVIE") return false;

        return matchesYear && matchesMonth && matchesSearch;
      })
      .sort((a, b) => {
        return getMillis(getTvCompletionDate(b)) - getMillis(getTvCompletionDate(a));
      });
  }, [mediaMap, yearFilter, monthFilter, searchText, viewTab]);

  const monthlySummaries = useMemo(() => {
    return buildMonthlySummaries(filteredLogs, completedTvItems, viewTab);
  }, [filteredLogs, completedTvItems, viewTab]);
const reportHighlights = useMemo(() => {
  const highestTmdb = [...filteredLogs]
    .filter((log) => Number(log.tmdbRating || 0) > 0)
    .sort((a, b) => Number(b.tmdbRating || 0) - Number(a.tmdbRating || 0))[0];

  const busiestMonth = [...monthlySummaries].sort(
    (a, b) => b.totalMinutes - a.totalMinutes
  )[0];

  const mostMovieMonth = [...monthlySummaries].sort(
    (a, b) => b.movieCount - a.movieCount
  )[0];

  const mostTvMonth = [...monthlySummaries].sort(
    (a, b) =>
      b.tvEpisodeCount +
      b.tvCompletedCount -
      (a.tvEpisodeCount + a.tvCompletedCount)
  )[0];

  return {
    highestTmdb,
    busiestMonth,
    mostMovieMonth,
    mostTvMonth,
  };
}, [filteredLogs, monthlySummaries]);

const smartInsights = useMemo(() => {
  const insights: {
    icon: string;
    title: string;
    description: string;
    value: string;
    tone: "indigo" | "emerald" | "amber" | "purple";
  }[] = [];

  if (filteredLogs.length === 0) {
    return [
      {
        icon: "✨",
        title: "Henüz analiz için yeterli veri yok",
        description:
          "Film veya dizi izleme kaydı ekledikçe burada otomatik yorumlar oluşacak.",
        value: "Veri bekleniyor",
        tone: "indigo" as const,
      },
    ];
  }

  if (reportHighlights.busiestMonth) {
    insights.push({
      icon: "🔥",
      title: "En yoğun izleme ayın",
      description: `${reportHighlights.busiestMonth.label} ayında ${reportHighlights.busiestMonth.movieCount} film, ${reportHighlights.busiestMonth.tvCompletedCount} tamamlanan dizi ve ${reportHighlights.busiestMonth.tvEpisodeCount} bölüm kaydı var.`,
      value: formatMinutes(reportHighlights.busiestMonth.totalMinutes),
      tone: "purple",
    });
  }

  if (stats.episodeCount > stats.uniqueMovieCount) {
    insights.push({
      icon: "📺",
      title: "Dizi ağırlıklı ilerliyorsun",
      description:
        "Bu filtrede dizi bölümü hareketlerin film kayıtlarından daha yoğun görünüyor.",
      value: `${stats.episodeCount} bölüm`,
      tone: "emerald",
    });
  } else if (stats.uniqueMovieCount > stats.episodeCount) {
    insights.push({
      icon: "🎬",
      title: "Film ağırlıklı ilerliyorsun",
      description:
        "Bu filtrede film izleme sayın dizi bölümü kayıtlarından daha yüksek.",
      value: `${stats.uniqueMovieCount} film`,
      tone: "indigo",
    });
  } else {
    insights.push({
      icon: "⚖️",
      title: "Dengeli izleme düzeni",
      description:
        "Film ve dizi tarafında dengeli bir izleme dağılımı oluşmuş.",
      value: "Dengeli",
      tone: "amber",
    });
  }

  if (completedTvItems.length > 0) {
    insights.push({
      icon: "✅",
      title: "Tamamlanan dizi hareketi var",
      description:
        "Seçili yıl/ay filtresinde bitirdiğin diziler ayrıca raporlandı.",
      value: `${completedTvItems.length} dizi`,
      tone: "emerald",
    });
  }

  if (reportHighlights.highestTmdb) {
    insights.push({
      icon: "⭐",
      title: "En yüksek TMDb puanlı içerik",
      description: `${reportHighlights.highestTmdb.title} bu filtrede en yüksek TMDb puanına sahip içerik olarak öne çıkıyor.`,
      value: `${reportHighlights.highestTmdb.tmdbRating}/10`,
      tone: "amber",
    });
  }

  if (stats.topGenre !== "-" || stats.topPlatform !== "-") {
    insights.push({
      icon: "🧭",
      title: "İzleme eğilimin",
      description: `Bu filtrede öne çıkan tür/platform: ${stats.topGenre} • ${stats.topPlatform}`,
      value: "Profil",
      tone: "indigo",
    });
  }

  return insights.slice(0, 4);
}, [
  filteredLogs.length,
  stats.episodeCount,
  stats.uniqueMovieCount,
  stats.topGenre,
  stats.topPlatform,
  completedTvItems.length,
  reportHighlights,
]);
  const tvStatusSummary = useMemo(() => {
    const tvItems = Object.values(mediaMap).filter((item) => item.type === "TV");

    return {
      total: tvItems.length,
      watching: tvItems.filter((item) => item.status === "IZLENIYOR").length,
      completed: tvItems.filter((item) => item.status === "IZLENDI").length,
      dropped: tvItems.filter((item) => item.status === "BIRAKILDI").length,
      planned: tvItems.filter((item) => item.status === "IZLENECEK").length,
    };
  }, [mediaMap]);

  const filterSummaryText = useMemo(() => {
    const yearText = yearFilter === "ALL" ? "Tüm yıllar" : yearFilter;

    const monthText =
      monthFilter === "ALL"
        ? "Tüm aylar"
        : monthLabels.find((month) => month.value === monthFilter)?.label ||
          monthFilter;

    const typeText =
      viewTab === "GENERAL" ? "Genel" : viewTab === "MOVIE" ? "Filmler" : "Diziler";

    return `${yearText} • ${monthText} • ${typeText}`;
  }, [yearFilter, monthFilter, viewTab]);

  const movieLogs = useMemo(
    () =>
      [...filteredLogs]
        .filter((log) => log.mediaType === "MOVIE")
        .sort((a, b) => {
          const bTime =
            Date.parse(b.date || "") ||
            getMillis(b.actionAt) ||
            getMillis(b.createdAt);

          const aTime =
            Date.parse(a.date || "") ||
            getMillis(a.actionAt) ||
            getMillis(a.createdAt);

          return bTime - aTime;
        }),
    [filteredLogs]
  );

  const tvLogs = useMemo(
    () =>
      [...filteredLogs]
        .filter((log) => log.mediaType === "TV")
        .sort((a, b) => {
          const bTime =
            Date.parse(b.date || "") ||
            getMillis(b.actionAt) ||
            getMillis(b.createdAt);

          const aTime =
            Date.parse(a.date || "") ||
            getMillis(a.actionAt) ||
            getMillis(a.createdAt);

          return bTime - aTime;
        }),
    [filteredLogs]
  );

  useEffect(() => {
    if (!user) {
      setRawLogs([]);
      setMediaMap({});
      setMediaTitleMap({});
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    let logsReady = false;
    let mediaReady = false;

    const finishIfReady = () => {
      if (logsReady && mediaReady) {
        setLoading(false);
      }
    };

    const logsQuery = query(
      collection(db, "watchLogs"),
      where("userId", "==", user.uid)
    );

    const mediaQuery = query(
      collection(db, "mediaItems"),
      where("userId", "==", user.uid)
    );

    const unsubLogs = onSnapshot(
      logsQuery,
      (snapshot) => {
        const data = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...(doc.data() as Omit<WatchLogItem, "id">),
        }));

        setRawLogs(data);
        logsReady = true;
        finishIfReady();
      },
      (err) => {
        console.error("watchLogs hata:", err);
        setError(err?.message || "İzleme kayıtları alınırken hata oluştu.");
        logsReady = true;
        finishIfReady();
      }
    );

    const unsubMedia = onSnapshot(
      mediaQuery,
      (snapshot) => {
        const nextMap: Record<string, MediaMeta> = {};
        const nextTitleMap: Record<string, MediaMeta> = {};

        snapshot.docs.forEach((doc) => {
          const data = doc.data() as any;

          const item: MediaMeta = {
            id: doc.id,
            title: data.title || "",
            type: data.type,
            status: data.status,

            posterUrl: data.posterUrl || null,
            backdropUrl: data.backdropUrl || null,

            genres: Array.isArray(data.genres) ? data.genres : [],
            platforms: Array.isArray(data.platforms) ? data.platforms : [],

            tmdbRating: data.tmdbRating || null,
            year: data.year || "",

            startedAt: data.startedAt || null,
            watchedAt: data.watchedAt || null,
            completedAt: data.completedAt || null,
            lastActionAt: data.lastActionAt || null,

            numberOfEpisodes: Number(data.numberOfEpisodes || 0),
            watchedEpisodeCount: Number(data.watchedEpisodeCount || 0),
          };

          nextMap[doc.id] = item;

          const titleKey = makeTitleKey(item.title, item.type);
          if (titleKey) {
            nextTitleMap[titleKey] = item;
          }
        });

        setMediaMap(nextMap);
        setMediaTitleMap(nextTitleMap);

        mediaReady = true;
        finishIfReady();
      },
      (err) => {
        console.error("mediaItems hata:", err);
        setError((prev) => prev || err?.message || "Medya bilgileri alınamadı.");
        mediaReady = true;
        finishIfReady();
      }
    );

    return () => {
      unsubLogs();
      unsubMedia();
    };
  }, [user]);

  const openPreview = (url?: string | null, title?: string) => {
    if (!url) return;

    setPreviewImage({
      url,
      title: title || "Poster",
    });
  };

  const clearFilters = () => {
    setViewTab("GENERAL");
    setYearFilter("ALL");
    setMonthFilter("ALL");
    setSearchText("");
  };

  if (!user) {
    return (
      <div className="max-w-5xl mx-auto py-10">
        <div className="rounded-3xl border border-indigo-100/70 dark:border-slate-800 bg-white/80 dark:bg-slate-900/80 p-8 text-center shadow-sm">
          <p className="text-lg font-medium mb-2">
            İzleme raporlarını görmek için giriş yapmalısın.
          </p>
          <p className="text-sm text-slate-500 mb-6">
            Giriş yaptıktan sonra film ve dizi raporların burada görünecek.
          </p>

          <Link
            to="/login"
            className="inline-flex items-center justify-center rounded-full px-4 py-2 text-sm font-medium bg-slate-900 text-slate-50 dark:bg-slate-100 dark:text-slate-900"
          >
            Giriş yap
          </Link>
        </div>
      </div>
    );
  }

  const showMovies = viewTab === "GENERAL" || viewTab === "MOVIE";
  const showTv = viewTab === "GENERAL" || viewTab === "TV";

  return (
    <>
      <div className="max-w-7xl mx-auto space-y-6">
        <div
          className="
            relative overflow-hidden rounded-[28px] border
            border-indigo-100/70 dark:border-slate-800/80
            bg-gradient-to-br from-indigo-50 via-purple-50 to-slate-100
            dark:from-slate-950 dark:via-slate-900 dark:to-slate-950
            px-6 py-6 shadow-sm
          "
        >
          <div className="absolute -top-24 right-0 h-56 w-56 rounded-full bg-purple-300/20 blur-3xl" />
          <div className="absolute -bottom-24 left-0 h-56 w-56 rounded-full bg-indigo-300/20 blur-3xl" />

          <div className="relative flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
            <div className="space-y-3">
              <div className="inline-flex items-center gap-2 rounded-full border border-white/70 dark:border-slate-800 bg-white/80 dark:bg-slate-900/80 px-3 py-1 text-[11px] font-semibold text-indigo-800 dark:text-slate-200">
                <BarChart3 className="w-4 h-4" />
                <span>İzleme raporları</span>
                <span className="h-1 w-1 rounded-full bg-indigo-400" />
                <span>{filteredLogs.length} kayıt</span>
              </div>

              <div>
                <h1 className="text-2xl md:text-3xl font-semibold tracking-tight text-slate-900 dark:text-slate-50">
                  Film & dizi rapor ekranı
                </h1>
                <p className="mt-2 max-w-2xl text-sm text-slate-600 dark:text-slate-400">
                  Ay ay izlediğin film ve dizi hareketlerini takip et. Ay kartına
                  tıklayarak o ayın içerik detaylarını afişli şekilde inceleyebilirsin.
                </p>
              </div>

              <div className="inline-flex items-center gap-2 rounded-full bg-white/80 dark:bg-slate-900/80 p-1 border border-slate-200/80 dark:border-slate-700/80">
                {[
                  { key: "GENERAL", label: "Genel", icon: LibraryBig },
                  { key: "MOVIE", label: "Filmler", icon: Film },
                  { key: "TV", label: "Diziler", icon: Tv },
                ].map((tab) => {
                  const Icon = tab.icon;
                  const active = viewTab === (tab.key as ViewTab);

                  return (
                    <button
                      key={tab.key}
                      type="button"
                      onClick={() => setViewTab(tab.key as ViewTab)}
                      className={`inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-semibold transition ${
                        active
                          ? "bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900 shadow-sm"
                          : "text-slate-500 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white"
                      }`}
                    >
                      <Icon className="w-4 h-4" />
                      {tab.label}
                    </button>
                  );
                })}
              </div>
            </div>

            <Link
              to="/media"
              className="inline-flex items-center justify-center rounded-full px-4 py-2 text-sm font-semibold bg-slate-900 text-slate-50 dark:bg-slate-100 dark:text-slate-900 hover:bg-slate-700 dark:hover:bg-white transition gap-2 shadow-sm"
            >
              <Clapperboard className="w-4 h-4" />
              Medya kütüphanesine dön
            </Link>
          </div>

          <div className="relative mt-6 grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-3">
            <SmallInfoCard
              label="Toplam süre"
              value={formatMinutes(stats.totalMinutes)}
              icon={<Clock3 className="w-4 h-4 text-indigo-500" />}
            />

            <SmallInfoCard
              label="Film"
              value={stats.uniqueMovieCount}
              icon={<Film className="w-4 h-4 text-indigo-500" />}
            />

            <SmallInfoCard
              label="Dizi bölümü"
              value={stats.episodeCount}
              icon={<Tv className="w-4 h-4 text-purple-500" />}
            />

            <SmallInfoCard
              label="Tamamlandı"
              value={stats.completedCount}
              icon={<CheckCircle2 className="w-4 h-4 text-emerald-500" />}
            />

            <SmallInfoCard
              label="TMDb ort."
              value={stats.averageTmdbRating || "-"}
              icon={<Star className="w-4 h-4 text-amber-500 fill-amber-500" />}
            />
          </div>
        </div>

        {error && (
          <div className="rounded-3xl border border-rose-100/70 dark:border-rose-900/70 bg-rose-50/80 dark:bg-rose-950/30 px-4 py-3 text-sm text-rose-700 dark:text-rose-200 flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {hiddenDeletedLogCount > 0 && (
          <div className="rounded-3xl border border-amber-100/70 dark:border-amber-900/70 bg-amber-50/80 dark:bg-amber-950/20 px-4 py-3 text-sm text-amber-700 dark:text-amber-200">
            Silinmiş film/dizilere ait {hiddenDeletedLogCount} eski izleme
            günlüğü rapordan gizlendi.
          </div>
        )}

        <div className="rounded-[28px] border border-slate-200/80 dark:border-slate-800 bg-white/90 dark:bg-slate-900/85 p-4 shadow-sm">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-4">
            <div className="flex items-center gap-2 text-xs font-semibold text-slate-500 dark:text-slate-400">
              <Filter className="w-4 h-4 text-indigo-500" />
              <span>Filtreler</span>
              <span className="hidden sm:inline text-slate-300 dark:text-slate-700">
                •
              </span>
              <span className="text-indigo-600 dark:text-indigo-300">
                {filterSummaryText}
              </span>
            </div>

            <button
              type="button"
              onClick={clearFilters}
              className="inline-flex items-center justify-center rounded-full px-3 py-1.5 text-xs font-bold border border-slate-200 dark:border-slate-700 text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-950 transition"
            >
              Filtreleri temizle
            </button>
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-[1fr_1fr_1.2fr] gap-4">
            <div>
              <p className="text-[11px] uppercase tracking-[0.16em] font-semibold text-slate-400 mb-2">
                Yıl
              </p>

              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => setYearFilter("ALL")}
                  className={`rounded-full px-3 py-1.5 text-xs font-bold border transition ${
                    yearFilter === "ALL"
                      ? "bg-indigo-500 text-white border-indigo-500"
                      : "bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-700 text-slate-500"
                  }`}
                >
                  Tümü
                </button>

                {years.map((year) => (
                  <button
                    key={year}
                    type="button"
                    onClick={() => setYearFilter(year)}
                    className={`rounded-full px-3 py-1.5 text-xs font-bold border transition ${
                      yearFilter === year
                        ? "bg-indigo-500 text-white border-indigo-500"
                        : "bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-700 text-slate-500"
                    }`}
                  >
                    {year}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <p className="text-[11px] uppercase tracking-[0.16em] font-semibold text-slate-400 mb-2">
                Ay
              </p>

              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => setMonthFilter("ALL")}
                  className={`rounded-full px-3 py-1.5 text-xs font-bold border transition ${
                    monthFilter === "ALL"
                      ? "bg-purple-500 text-white border-purple-500"
                      : "bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-700 text-slate-500"
                  }`}
                >
                  Tümü
                </button>

                {monthLabels.map((month) => (
                  <button
                    key={month.value}
                    type="button"
                    onClick={() => setMonthFilter(month.value)}
                    className={`rounded-full px-3 py-1.5 text-xs font-bold border transition ${
                      monthFilter === month.value
                        ? "bg-purple-500 text-white border-purple-500"
                        : "bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-700 text-slate-500"
                    }`}
                  >
                    {month.label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <p className="text-[11px] uppercase tracking-[0.16em] font-semibold text-slate-400 mb-2">
                Arama
              </p>

              <div className="relative">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  value={searchText}
                  onChange={(e) => setSearchText(e.target.value)}
                  placeholder="Başlık, bölüm, platform, tür..."
                  className="w-full rounded-full border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 pl-9 pr-3 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-400/40 dark:focus:ring-slate-100/20"
                />
              </div>
            </div>
          </div>
        </div>
<div className="grid grid-cols-1 xl:grid-cols-[1.15fr_0.85fr] gap-5">
  <div className="rounded-[28px] border border-slate-200/80 dark:border-slate-800 bg-white/90 dark:bg-slate-900/85 p-5 shadow-sm">
    <div className="flex items-start justify-between gap-3 mb-4">
      <div>
        <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-400">
          Akıllı rapor özeti
        </p>

        <h2 className="mt-1 text-lg font-bold text-slate-900 dark:text-slate-50">
          İzleme davranışına kısa yorum
        </h2>

        <p className="mt-1 text-xs text-slate-500">
          Seçili filtrelere göre otomatik yorumlanır.
        </p>
      </div>

      <Sparkles className="w-5 h-5 text-purple-400" />
    </div>

    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
      {smartInsights.map((insight, index) => (
        <div
          key={`${insight.title}-${index}`}
          className={`rounded-3xl border p-4 ${getInsightToneClass(
            insight.tone
          )}`}
        >
          <div className="flex items-start justify-between gap-3">
            <div className="text-2xl">{insight.icon}</div>

            <span className="rounded-full bg-white/70 dark:bg-slate-950/40 px-2.5 py-1 text-[11px] font-black">
              {insight.value}
            </span>
          </div>

          <h3 className="mt-3 text-sm font-black">{insight.title}</h3>

          <p className="mt-1 text-xs leading-5 opacity-80">
            {insight.description}
          </p>
        </div>
      ))}
    </div>
  </div>

  <div className="rounded-[28px] border border-slate-200/80 dark:border-slate-800 bg-white/90 dark:bg-slate-900/85 p-5 shadow-sm">
    <div className="flex items-start justify-between gap-3 mb-4">
      <div>
        <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-400">
          Enler
        </p>

        <h2 className="mt-1 text-lg font-bold text-slate-900 dark:text-slate-50">
          Öne çıkan kayıtlar
        </h2>
      </div>

      <Trophy className="w-5 h-5 text-amber-400" />
    </div>

    <div className="space-y-3">
      {reportHighlights.highestTmdb ? (
        <div className="rounded-3xl border border-amber-100 dark:border-amber-800 bg-amber-50/80 dark:bg-amber-900/20 p-3">
          <div className="flex gap-3">
            <PosterThumb
              url={reportHighlights.highestTmdb.posterUrl}
              title={reportHighlights.highestTmdb.title}
              onClick={() =>
                openPreview(
                  reportHighlights.highestTmdb?.posterUrl,
                  reportHighlights.highestTmdb?.title
                )
              }
              className="h-20 w-14 flex-shrink-0"
            />

            <div className="min-w-0 flex-1">
              <p className="text-[11px] font-bold uppercase tracking-[0.13em] text-amber-700 dark:text-amber-200">
                En yüksek TMDb
              </p>

              <p className="mt-1 text-sm font-black text-slate-900 dark:text-slate-50 line-clamp-2">
                {reportHighlights.highestTmdb.title}
              </p>

              <p className="mt-1 text-xs font-bold text-amber-700 dark:text-amber-200">
                TMDb {reportHighlights.highestTmdb.tmdbRating}/10
              </p>
            </div>
          </div>
        </div>
      ) : (
        <div className="rounded-3xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/60 p-4 text-sm text-slate-500">
          TMDb puanlı içerik bulunamadı.
        </div>
      )}

      {reportHighlights.busiestMonth ? (
        <button
          type="button"
          onClick={() => setSelectedMonth(reportHighlights.busiestMonth)}
          className="w-full text-left rounded-3xl border border-purple-100 dark:border-purple-800 bg-purple-50/80 dark:bg-purple-900/20 p-3 hover:-translate-y-0.5 hover:shadow-md transition"
        >
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-[0.13em] text-purple-700 dark:text-purple-200">
                En yoğun ay
              </p>

              <p className="mt-1 text-sm font-black text-slate-900 dark:text-slate-50">
                {reportHighlights.busiestMonth.label}
              </p>

              <p className="mt-1 text-xs text-slate-500">
                {reportHighlights.busiestMonth.movieCount} film •{" "}
                {reportHighlights.busiestMonth.tvCompletedCount} dizi •{" "}
                {reportHighlights.busiestMonth.tvEpisodeCount} bölüm
              </p>
            </div>

            <span className="rounded-full bg-white/80 dark:bg-slate-950/50 px-3 py-1 text-xs font-black text-purple-700 dark:text-purple-200">
              {formatMinutes(reportHighlights.busiestMonth.totalMinutes)}
            </span>
          </div>
        </button>
      ) : null}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="rounded-3xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/60 p-4">
          <p className="text-[11px] font-bold uppercase tracking-[0.13em] text-slate-400">
            En filmli ay
          </p>

          <p className="mt-1 text-sm font-black text-slate-900 dark:text-slate-50">
            {reportHighlights.mostMovieMonth?.label || "-"}
          </p>

          <p className="mt-1 text-xs text-slate-500">
            {reportHighlights.mostMovieMonth?.movieCount || 0} film
          </p>
        </div>

        <div className="rounded-3xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/60 p-4">
          <p className="text-[11px] font-bold uppercase tracking-[0.13em] text-slate-400">
            En dizi yoğun ay
          </p>

          <p className="mt-1 text-sm font-black text-slate-900 dark:text-slate-50">
            {reportHighlights.mostTvMonth?.label || "-"}
          </p>

          <p className="mt-1 text-xs text-slate-500">
            {(reportHighlights.mostTvMonth?.tvEpisodeCount || 0) +
              (reportHighlights.mostTvMonth?.tvCompletedCount || 0)}{" "}
            dizi hareketi
          </p>
        </div>
      </div>
    </div>
  </div>
</div>
        <div className="rounded-[28px] border border-slate-200/80 dark:border-slate-800 bg-white/90 dark:bg-slate-900/85 p-5 shadow-sm">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between mb-4">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-400">
                Ay ay izleme özeti
              </p>

              <h2 className="mt-1 text-lg font-bold text-slate-900 dark:text-slate-50">
                Hangi ay ne izledin?
              </h2>

              <p className="mt-1 text-xs text-slate-500">
                Ay kartına tıklayınca o ayın film, dizi ve bölüm detayları açılır.
              </p>
            </div>

            <div className="inline-flex items-center gap-2 rounded-full bg-indigo-50 dark:bg-indigo-900/20 px-3 py-1 text-xs font-bold text-indigo-700 dark:text-indigo-200 border border-indigo-100 dark:border-indigo-800">
              <Sparkles className="w-3.5 h-3.5" />
              {monthlySummaries.length} ay
            </div>
          </div>

          {loading ? (
            <div className="flex justify-center py-10">
              <div className="inline-flex items-center gap-2 text-sm text-slate-500">
                <Loader2 className="w-4 h-4 animate-spin" />
                Ay raporları yükleniyor...
              </div>
            </div>
          ) : monthlySummaries.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-200 dark:border-slate-800 p-8 text-center text-sm text-slate-500">
              Bu filtrelere uygun aylık özet bulunamadı.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
              {monthlySummaries.map((month) => (
                <button
                  key={month.monthKey}
                  type="button"
                  onClick={() => setSelectedMonth(month)}
                  className="
                    text-left rounded-3xl border border-slate-200/80 dark:border-slate-800
                    bg-gradient-to-br from-slate-50 to-white dark:from-slate-950 dark:to-slate-900
                    p-4 hover:-translate-y-0.5 hover:shadow-md transition
                  "
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-black text-slate-900 dark:text-slate-50">
                        {month.label}
                      </p>

                      <p className="mt-1 text-xs text-slate-500">
                        {month.movieCount} film • {month.tvCompletedCount} dizi
                        tamamlandı • {month.tvEpisodeCount} bölüm
                      </p>
                    </div>

                    <MiniPosterStack
                      posters={month.posters}
                      title={month.label}
                      onPreview={openPreview}
                    />
                  </div>

                  <div className="mt-4 grid grid-cols-3 gap-2">
                    <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 px-3 py-2">
                      <p className="text-[10px] uppercase tracking-[0.13em] text-slate-400 font-bold">
                        Film
                      </p>
                      <p className="mt-1 text-lg font-black text-indigo-700 dark:text-indigo-200">
                        {month.movieCount}
                      </p>
                    </div>

                    <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 px-3 py-2">
                      <p className="text-[10px] uppercase tracking-[0.13em] text-slate-400 font-bold">
                        Dizi
                      </p>
                      <p className="mt-1 text-lg font-black text-emerald-700 dark:text-emerald-200">
                        {month.tvCompletedCount}
                      </p>
                    </div>

                    <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 px-3 py-2">
                      <p className="text-[10px] uppercase tracking-[0.13em] text-slate-400 font-bold">
                        Süre
                      </p>
                      <p className="mt-1 text-sm font-black text-purple-700 dark:text-purple-200">
                        {formatMinutes(month.totalMinutes)}
                      </p>
                    </div>
                  </div>

                  <div className="mt-4 flex items-center justify-between text-xs">
                    <span className="text-slate-500">
                      {month.logCount} izleme kaydı
                    </span>

                    <span className="font-bold text-indigo-600 dark:text-indigo-300">
                      Detayları aç
                    </span>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {(viewTab === "GENERAL" || viewTab === "TV") && (
          <div className="rounded-[28px] border border-slate-200/80 dark:border-slate-800 bg-white/90 dark:bg-slate-900/85 p-5 shadow-sm">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-400">
                  Ay bazlı tamamlanan diziler
                </p>

                <h2 className="mt-1 text-lg font-bold text-slate-900 dark:text-slate-50">
                  Bitirdiğin diziler
                </h2>

                <p className="mt-1 text-xs text-slate-500">
                  Bu bölüm, dizinin tamamlanma tarihine göre hesaplanır.
                </p>
              </div>

              <div className="inline-flex items-center gap-2 rounded-full bg-emerald-50 dark:bg-emerald-900/20 px-3 py-1 text-xs font-bold text-emerald-700 dark:text-emerald-200 border border-emerald-100 dark:border-emerald-800">
                <CheckCircle2 className="w-3.5 h-3.5" />
                {completedTvItems.length} dizi
              </div>
            </div>

            {completedTvItems.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-slate-200 dark:border-slate-800 p-7 text-center text-sm text-slate-500">
                Seçili yıl/ay için tamamlanmış dizi bulunamadı.
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                {completedTvItems.map((item) => {
                  const poster = item.posterUrl || item.backdropUrl || null;
                  const completedDate = getTvCompletionDate(item);

                  return (
                    <div
                      key={item.id}
                      className="rounded-3xl border border-slate-200/70 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-950/60 p-3"
                    >
                      <div className="flex gap-3">
                        <PosterThumb
                          url={poster}
                          title={item.title || "Dizi"}
                          onClick={() => openPreview(poster, item.title || "Dizi")}
                          className="h-28 w-20 flex-shrink-0"
                        />

                        <div className="min-w-0 flex-1">
                          <div className="inline-flex items-center gap-1 rounded-full px-2 py-1 text-[11px] font-bold border border-emerald-100 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-200 mb-2">
                            Tamamlandı
                          </div>

                          <p className="text-sm font-bold text-slate-900 dark:text-slate-100 line-clamp-2">
                            {item.title}
                          </p>

                          <p className="mt-1 text-xs text-slate-500">
                            Bitirme tarihi: {formatFlexibleDate(completedDate)}
                          </p>

                          <p className="mt-1 text-xs text-slate-500">
                            Bölüm: {item.watchedEpisodeCount || 0}/
                            {item.numberOfEpisodes || 0}
                          </p>

                          <div className="mt-2 flex flex-wrap gap-1.5">
                            {(item.genres || []).slice(0, 3).map((genre) => (
                              <span
                                key={genre}
                                className="px-2 py-1 rounded-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-[11px] text-slate-500"
                              >
                                {genre}
                              </span>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {viewTab === "GENERAL" && (
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
            <div className="rounded-[28px] border border-slate-200/80 dark:border-slate-800 bg-white/90 dark:bg-slate-900/85 p-5 shadow-sm">
              <div className="flex items-center justify-between gap-3 mb-4">
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-400">
                    Dizi durum özeti
                  </p>
                  <h2 className="mt-1 text-lg font-bold text-slate-900 dark:text-slate-50">
                    Dizilerin genel durumu
                  </h2>
                </div>

                <Tv className="w-5 h-5 text-purple-400" />
              </div>

              <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                <div className="rounded-2xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200/70 dark:border-slate-800 p-3">
                  <p className="text-[11px] text-slate-500">Toplam</p>
                  <p className="mt-1 text-xl font-black text-slate-900 dark:text-slate-100">
                    {tvStatusSummary.total}
                  </p>
                </div>

                <div className="rounded-2xl bg-sky-50 dark:bg-sky-900/20 border border-sky-100 dark:border-sky-800 p-3">
                  <p className="text-[11px] text-sky-700 dark:text-sky-200">
                    Devam
                  </p>
                  <p className="mt-1 text-xl font-black text-sky-800 dark:text-sky-100">
                    {tvStatusSummary.watching}
                  </p>
                </div>

                <div className="rounded-2xl bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-100 dark:border-emerald-800 p-3">
                  <p className="text-[11px] text-emerald-700 dark:text-emerald-200">
                    Tamam
                  </p>
                  <p className="mt-1 text-xl font-black text-emerald-800 dark:text-emerald-100">
                    {tvStatusSummary.completed}
                  </p>
                </div>

                <div className="rounded-2xl bg-rose-50 dark:bg-rose-900/20 border border-rose-100 dark:border-rose-800 p-3">
                  <p className="text-[11px] text-rose-700 dark:text-rose-200">
                    Bırakıldı
                  </p>
                  <p className="mt-1 text-xl font-black text-rose-800 dark:text-rose-100">
                    {tvStatusSummary.dropped}
                  </p>
                </div>

                <div className="rounded-2xl bg-amber-50 dark:bg-amber-900/20 border border-amber-100 dark:border-amber-800 p-3">
                  <p className="text-[11px] text-amber-700 dark:text-amber-200">
                    İzlenecek
                  </p>
                  <p className="mt-1 text-xl font-black text-amber-800 dark:text-amber-100">
                    {tvStatusSummary.planned}
                  </p>
                </div>
              </div>
            </div>

            <div className="rounded-[28px] border border-slate-200/80 dark:border-slate-800 bg-white/90 dark:bg-slate-900/85 p-5 shadow-sm">
              <div className="flex items-center justify-between gap-3 mb-4">
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-400">
                    Öne çıkanlar
                  </p>
                  <h2 className="mt-1 text-lg font-bold text-slate-900 dark:text-slate-50">
                    İzleme davranışın
                  </h2>
                </div>

                <Trophy className="w-5 h-5 text-amber-400" />
              </div>

              <div className="space-y-3">
                <div className="rounded-2xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200/70 dark:border-slate-800 p-4">
                  <p className="text-xs text-slate-500">En çok kaydı olan içerik</p>
                  <p className="mt-1 text-base font-bold text-slate-900 dark:text-slate-100">
                    {stats.mostLoggedTitle}
                  </p>
                </div>

                <div className="rounded-2xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200/70 dark:border-slate-800 p-4">
                  <p className="text-xs text-slate-500">En uzun izleme süresi</p>
                  <p className="mt-1 text-base font-bold text-slate-900 dark:text-slate-100">
                    {stats.longestWatchedTitle}
                  </p>
                  <p className="mt-1 text-xs text-slate-500">
                    {formatMinutes(stats.longestWatchedMinutes)}
                  </p>
                </div>

                <div className="rounded-2xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200/70 dark:border-slate-800 p-4">
                  <p className="text-xs text-slate-500">En sık tür / platform</p>
                  <p className="mt-1 text-base font-bold text-slate-900 dark:text-slate-100">
                    {stats.topGenre} • {stats.topPlatform}
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {loading ? (
          <div className="flex justify-center py-16">
            <div className="inline-flex items-center gap-2 text-sm text-slate-500">
              <Loader2 className="w-4 h-4 animate-spin" />
              Raporlar yükleniyor...
            </div>
          </div>
        ) : filteredLogs.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-slate-200 dark:border-slate-800 bg-white/90 dark:bg-slate-900/80 p-10 text-center text-sm text-slate-500">
            Bu filtrelere uygun izleme kaydı bulunamadı.
          </div>
        ) : (
          <div className="grid grid-cols-1 2xl:grid-cols-2 gap-5">
            {showMovies && (
              <div className="rounded-[28px] border border-slate-200/80 dark:border-slate-800 bg-white/90 dark:bg-slate-900/85 p-5 shadow-sm">
                <div className="flex items-center justify-between gap-3 mb-4">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-400">
                      Film listesi
                    </p>
                    <h2 className="mt-1 text-lg font-bold text-slate-900 dark:text-slate-50">
                      İzlediğin filmler
                    </h2>
                  </div>

                  <div className="inline-flex items-center gap-2 rounded-full bg-indigo-50 dark:bg-indigo-900/20 px-3 py-1 text-xs font-bold text-indigo-700 dark:text-indigo-200 border border-indigo-100 dark:border-indigo-800">
                    <Film className="w-3.5 h-3.5" />
                    {movieLogs.length} kayıt
                  </div>
                </div>

                {movieLogs.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-slate-200 dark:border-slate-800 p-8 text-center text-sm text-slate-500">
                    Bu filtrelerle film kaydı bulunamadı.
                  </div>
                ) : (
                  <div className="space-y-3 max-h-[760px] overflow-y-auto pr-1">
                    {movieLogs.map((log) => (
                      <div
                        key={log.id}
                        className="rounded-3xl border border-slate-200/70 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-950/60 p-3"
                      >
                        <div className="flex gap-3">
                          <PosterThumb
                            url={log.posterUrl}
                            title={log.title}
                            onClick={() => openPreview(log.posterUrl, log.title)}
                            className="h-28 w-20 flex-shrink-0"
                          />

                          <div className="min-w-0 flex-1">
                            <div className="flex items-start justify-between gap-2">
                              <div>
                                <div className="inline-flex items-center gap-1 rounded-full px-2 py-1 text-[11px] font-bold border border-indigo-100 dark:border-indigo-900 bg-white dark:bg-slate-900 text-indigo-700 dark:text-indigo-200 mb-2">
                                  Film
                                </div>

                                <p className="text-sm font-bold text-slate-900 dark:text-slate-100 line-clamp-2">
                                  {log.title}
                                </p>
                              </div>

                              {log.tmdbRating ? (
                                <div className="inline-flex items-center gap-1 rounded-full bg-amber-50 dark:bg-amber-900/20 border border-amber-100 dark:border-amber-800 px-2 py-1 text-[11px] font-bold text-amber-700 dark:text-amber-200">
                                  <Star className="w-3 h-3 fill-current" />
                                  {log.tmdbRating}/10
                                </div>
                              ) : null}
                            </div>

                            <div className="mt-2 flex flex-wrap gap-1.5">
                              <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-[11px] font-semibold text-slate-500">
                                <Calendar className="w-3 h-3" />
                                İzleme: {formatDate(log.date)}
                              </span>

                              <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-[11px] font-semibold text-slate-500">
                                <Clock3 className="w-3 h-3" />
                                {formatMinutes(Number(log.minutes || 0))}
                              </span>

                              {log.completed && (
                                <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-100 dark:border-emerald-800 text-[11px] font-semibold text-emerald-700 dark:text-emerald-200">
                                  <CheckCircle2 className="w-3 h-3" />
                                  Tamamlandı
                                </span>
                              )}
                            </div>

                            <div className="mt-2 flex flex-wrap gap-1.5">
                              {(log.mediaGenres || log.genres || [])
                                .slice(0, 3)
                                .map((genre) => (
                                  <span
                                    key={genre}
                                    className="px-2 py-1 rounded-full bg-slate-100 dark:bg-slate-900 text-[11px] text-slate-500"
                                  >
                                    {genre}
                                  </span>
                                ))}
                            </div>

                            <p className="mt-2 text-[11px] text-slate-400">
                              Kayıt zamanı:{" "}
                              {formatDateTime(log.createdAt || log.actionAt)}
                            </p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {showTv && (
              <div className="rounded-[28px] border border-slate-200/80 dark:border-slate-800 bg-white/90 dark:bg-slate-900/85 p-5 shadow-sm">
                <div className="flex items-center justify-between gap-3 mb-4">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-400">
                      Dizi listesi
                    </p>
                    <h2 className="mt-1 text-lg font-bold text-slate-900 dark:text-slate-50">
                      İzlediğin dizi bölümleri
                    </h2>
                  </div>

                  <div className="inline-flex items-center gap-2 rounded-full bg-purple-50 dark:bg-purple-900/20 px-3 py-1 text-xs font-bold text-purple-700 dark:text-purple-200 border border-purple-100 dark:border-purple-800">
                    <Tv className="w-3.5 h-3.5" />
                    {tvLogs.length} kayıt
                  </div>
                </div>

                {tvLogs.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-slate-200 dark:border-slate-800 p-8 text-center text-sm text-slate-500">
                    Bu filtrelerle dizi kaydı bulunamadı.
                  </div>
                ) : (
                  <div className="space-y-3 max-h-[760px] overflow-y-auto pr-1">
                    {tvLogs.map((log) => (
                      <div
                        key={log.id}
                        className="rounded-3xl border border-slate-200/70 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-950/60 p-3"
                      >
                        <div className="flex gap-3">
                          <PosterThumb
                            url={log.posterUrl}
                            title={log.title}
                            onClick={() => openPreview(log.posterUrl, log.title)}
                            className="h-28 w-20 flex-shrink-0"
                          />

                          <div className="min-w-0 flex-1">
                            <div className="flex items-start justify-between gap-2">
                              <div>
                                <div className="inline-flex items-center gap-1 rounded-full px-2 py-1 text-[11px] font-bold border border-purple-100 dark:border-purple-900 bg-white dark:bg-slate-900 text-purple-700 dark:text-purple-200 mb-2">
                                  Dizi
                                </div>

                                <p className="text-sm font-bold text-slate-900 dark:text-slate-100 line-clamp-2">
                                  {log.title}
                                </p>

                                <p className="mt-1 text-xs text-slate-500">
                                  Sezon {log.seasonNumber || "-"} • Bölüm{" "}
                                  {log.episodeNumber || "-"}
                                  {log.episodeTitle
                                    ? ` • ${log.episodeTitle}`
                                    : ""}
                                </p>

                                <div className="mt-2 flex flex-wrap gap-1.5">
                                  <span
                                    className={`inline-flex items-center gap-1 px-2 py-1 rounded-full border text-[11px] font-bold ${getWatchStatusClass(
                                      log.mediaStatus
                                    )}`}
                                  >
                                    {watchStatusLabel(log.mediaStatus)}
                                  </span>

                                  {log.mediaStatus === "IZLENDI" && (
                                    <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-100 dark:border-emerald-800 text-[11px] font-bold text-emerald-700 dark:text-emerald-200">
                                      Bitirme:{" "}
                                      {formatFlexibleDate(getTvCompletionDate(log))}
                                    </span>
                                  )}
                                </div>
                              </div>

                              {log.tmdbRating ? (
                                <div className="inline-flex items-center gap-1 rounded-full bg-amber-50 dark:bg-amber-900/20 border border-amber-100 dark:border-amber-800 px-2 py-1 text-[11px] font-bold text-amber-700 dark:text-amber-200">
                                  <Star className="w-3 h-3 fill-current" />
                                  {log.tmdbRating}/10
                                </div>
                              ) : null}
                            </div>

                            <div className="mt-2 flex flex-wrap gap-1.5">
                              <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-[11px] font-semibold text-slate-500">
                                <Calendar className="w-3 h-3" />
                                İzleme: {formatDate(log.date)}
                              </span>

                              <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-[11px] font-semibold text-slate-500">
                                <Clock3 className="w-3 h-3" />
                                {formatMinutes(Number(log.minutes || 0))}
                              </span>

                              {log.completed && (
                                <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-100 dark:border-emerald-800 text-[11px] font-semibold text-emerald-700 dark:text-emerald-200">
                                  <CheckCircle2 className="w-3 h-3" />
                                  Bölüm tamamlandı
                                </span>
                              )}
                            </div>

                            <div className="mt-2 flex flex-wrap gap-1.5">
                              {(log.mediaGenres || log.genres || [])
                                .slice(0, 3)
                                .map((genre) => (
                                  <span
                                    key={genre}
                                    className="px-2 py-1 rounded-full bg-slate-100 dark:bg-slate-900 text-[11px] text-slate-500"
                                  >
                                    {genre}
                                  </span>
                                ))}
                            </div>

                            <p className="mt-2 text-[11px] text-slate-400">
                              Kayıt zamanı:{" "}
                              {formatDateTime(log.createdAt || log.actionAt)}
                            </p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {selectedMonth && (
        <div className="fixed inset-0 z-[105]">
          <button
            type="button"
            className="absolute inset-0 bg-slate-950/70 backdrop-blur-sm"
            onClick={() => setSelectedMonth(null)}
          />

          <div className="absolute inset-0 flex items-center justify-center p-4 pointer-events-none">
            <div
              className="
                w-full max-w-6xl max-h-[90vh] overflow-hidden pointer-events-auto
                rounded-[32px] border border-slate-200/80 dark:border-slate-800
                bg-white dark:bg-slate-950 shadow-2xl
              "
            >
              <div className="relative overflow-hidden px-6 py-5 border-b border-slate-200 dark:border-slate-800 bg-gradient-to-br from-indigo-50 via-purple-50 to-slate-100 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950">
                <div className="absolute -top-20 right-10 h-44 w-44 rounded-full bg-purple-300/20 blur-3xl" />

                <div className="relative flex items-start justify-between gap-4">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-[0.16em] text-indigo-600 dark:text-indigo-300">
                      Ay detayları
                    </p>

                    <h2 className="mt-1 text-2xl font-black text-slate-900 dark:text-slate-50">
                      {selectedMonth.label}
                    </h2>

                    <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
                      {selectedMonth.movieCount} film •{" "}
                      {selectedMonth.tvCompletedCount} dizi tamamlandı •{" "}
                      {selectedMonth.tvEpisodeCount} bölüm •{" "}
                      {formatMinutes(selectedMonth.totalMinutes)}
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() => setSelectedMonth(null)}
                    className="h-10 w-10 rounded-full bg-white/90 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 flex items-center justify-center shadow-sm"
                  >
                    <X className="w-5 h-5 text-slate-700 dark:text-slate-200" />
                  </button>
                </div>

                <div className="relative mt-5 grid grid-cols-2 md:grid-cols-4 gap-3">
                  <SmallInfoCard
                    label="Film"
                    value={selectedMonth.movieCount}
                    icon={<Film className="w-4 h-4 text-indigo-500" />}
                  />

                  <SmallInfoCard
                    label="Dizi"
                    value={selectedMonth.tvCompletedCount}
                    icon={<Tv className="w-4 h-4 text-emerald-500" />}
                  />

                  <SmallInfoCard
                    label="Bölüm"
                    value={selectedMonth.tvEpisodeCount}
                    icon={<CheckCircle2 className="w-4 h-4 text-purple-500" />}
                  />

                  <SmallInfoCard
                    label="Süre"
                    value={formatMinutes(selectedMonth.totalMinutes)}
                    icon={<Clock3 className="w-4 h-4 text-amber-500" />}
                  />
                </div>
              </div>

              <div className="p-5 overflow-y-auto max-h-[calc(90vh-230px)] space-y-5">
                <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">
                  <div className="rounded-3xl border border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-900/60 p-4">
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="font-black text-slate-900 dark:text-slate-50">
                        Filmler
                      </h3>

                      <span className="rounded-full bg-indigo-50 dark:bg-indigo-900/20 px-2.5 py-1 text-xs font-bold text-indigo-700 dark:text-indigo-200 border border-indigo-100 dark:border-indigo-800">
                        {uniqueByMediaId(selectedMonth.movieLogs).length}
                      </span>
                    </div>

                    {selectedMonth.movieLogs.length === 0 ? (
                      <div className="rounded-2xl border border-dashed border-slate-200 dark:border-slate-800 p-6 text-center text-sm text-slate-500">
                        Bu ay film kaydı yok.
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {uniqueByMediaId(selectedMonth.movieLogs).map((log) => (
                          <div
                            key={log.id || `${log.mediaId}-${log.title}`}
                            className="flex gap-3 rounded-2xl bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 p-2"
                          >
                            <PosterThumb
                              url={log.posterUrl}
                              title={log.title}
                              onClick={() => openPreview(log.posterUrl, log.title)}
                              className="h-24 w-16 flex-shrink-0"
                            />

                            <div className="min-w-0 flex-1">
                              <p className="text-sm font-bold text-slate-900 dark:text-slate-100 line-clamp-2">
                                {log.title}
                              </p>

                              <p className="mt-1 text-xs text-slate-500">
                                İzleme: {formatDate(log.date)}
                              </p>

                              <p className="mt-1 text-xs text-slate-500">
                                Süre: {formatMinutes(Number(log.minutes || 0))}
                              </p>

                              {log.tmdbRating ? (
                                <p className="mt-1 text-xs font-bold text-amber-600 dark:text-amber-300">
                                  TMDb {log.tmdbRating}/10
                                </p>
                              ) : null}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="rounded-3xl border border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-900/60 p-4">
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="font-black text-slate-900 dark:text-slate-50">
                        Tamamlanan diziler
                      </h3>

                      <span className="rounded-full bg-emerald-50 dark:bg-emerald-900/20 px-2.5 py-1 text-xs font-bold text-emerald-700 dark:text-emerald-200 border border-emerald-100 dark:border-emerald-800">
                        {selectedMonth.completedTvItems.length}
                      </span>
                    </div>

                    {selectedMonth.completedTvItems.length === 0 ? (
                      <div className="rounded-2xl border border-dashed border-slate-200 dark:border-slate-800 p-6 text-center text-sm text-slate-500">
                        Bu ay tamamlanan dizi yok.
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {selectedMonth.completedTvItems.map((tv) => {
                          const poster = tv.posterUrl || tv.backdropUrl || null;

                          return (
                            <div
                              key={tv.id}
                              className="flex gap-3 rounded-2xl bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 p-2"
                            >
                              <PosterThumb
                                url={poster}
                                title={tv.title || "Dizi"}
                                onClick={() => openPreview(poster, tv.title)}
                                className="h-24 w-16 flex-shrink-0"
                              />

                              <div className="min-w-0 flex-1">
                                <p className="text-sm font-bold text-slate-900 dark:text-slate-100 line-clamp-2">
                                  {tv.title}
                                </p>

                                <p className="mt-1 text-xs text-slate-500">
                                  Bitirme:{" "}
                                  {formatFlexibleDate(getTvCompletionDate(tv))}
                                </p>

                                <p className="mt-1 text-xs text-slate-500">
                                  Bölüm: {tv.watchedEpisodeCount || 0}/
                                  {tv.numberOfEpisodes || 0}
                                </p>

                                <span className="mt-2 inline-flex rounded-full bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-100 dark:border-emerald-800 px-2 py-1 text-[11px] font-bold text-emerald-700 dark:text-emerald-200">
                                  Tamamlandı
                                </span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  <div className="rounded-3xl border border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-900/60 p-4">
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="font-black text-slate-900 dark:text-slate-50">
                        Dizi bölümleri
                      </h3>

                      <span className="rounded-full bg-purple-50 dark:bg-purple-900/20 px-2.5 py-1 text-xs font-bold text-purple-700 dark:text-purple-200 border border-purple-100 dark:border-purple-800">
                        {selectedMonth.tvEpisodeLogs.length}
                      </span>
                    </div>

                    {selectedMonth.tvEpisodeLogs.length === 0 ? (
                      <div className="rounded-2xl border border-dashed border-slate-200 dark:border-slate-800 p-6 text-center text-sm text-slate-500">
                        Bu ay dizi bölümü kaydı yok.
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {selectedMonth.tvEpisodeLogs.map((log) => (
                          <div
                            key={log.id || `${log.mediaId}-${log.seasonNumber}-${log.episodeNumber}`}
                            className="flex gap-3 rounded-2xl bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 p-2"
                          >
                            <PosterThumb
                              url={log.posterUrl}
                              title={log.title}
                              onClick={() => openPreview(log.posterUrl, log.title)}
                              className="h-24 w-16 flex-shrink-0"
                            />

                            <div className="min-w-0 flex-1">
                              <p className="text-sm font-bold text-slate-900 dark:text-slate-100 line-clamp-2">
                                {log.title}
                              </p>

                              <p className="mt-1 text-xs text-slate-500">
                                S{log.seasonNumber || "-"} • B
                                {log.episodeNumber || "-"}
                                {log.episodeTitle ? ` • ${log.episodeTitle}` : ""}
                              </p>

                              <p className="mt-1 text-xs text-slate-500">
                                İzleme: {formatDate(log.date)}
                              </p>

                              <p className="mt-1 text-xs text-slate-500">
                                Süre: {formatMinutes(Number(log.minutes || 0))}
                              </p>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {previewImage && (
        <div className="fixed inset-0 z-[110]">
          <button
            type="button"
            className="absolute inset-0 bg-slate-950/75 backdrop-blur-sm"
            onClick={() => setPreviewImage(null)}
          />

          <div className="absolute inset-0 flex items-center justify-center p-4 pointer-events-none">
            <div className="relative max-w-5xl max-h-[90vh] pointer-events-auto">
              <button
                type="button"
                onClick={() => setPreviewImage(null)}
                className="absolute -top-3 -right-3 z-10 h-10 w-10 rounded-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 shadow-lg flex items-center justify-center"
              >
                <X className="w-5 h-5 text-slate-700 dark:text-slate-200" />
              </button>

              <img
                src={previewImage.url}
                alt={previewImage.title}
                className="max-h-[86vh] max-w-full rounded-3xl shadow-2xl object-contain bg-slate-900"
              />

              <p className="mt-3 text-center text-sm text-white/90">
                {previewImage.title}
              </p>
            </div>
          </div>
        </div>
      )}
    </>
  );
}