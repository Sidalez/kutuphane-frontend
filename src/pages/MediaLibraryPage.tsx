import PageLoading from "../components/feedback/PageLoading";
// src/pages/MediaLibraryPage.tsx

import { useEffect, useMemo, useState } from "react";
import {
  collection,
  doc,
  getDocs,
  onSnapshot,
  query,
  where,
  writeBatch,
} from "firebase/firestore";
import { Link } from "react-router-dom";
import {
  AlertTriangle,
  BarChart2,
  Calendar,
  CheckCircle2,
  Clock,
  Clapperboard,
  Eye,
  Film,
  Filter,
  ImageIcon,
  LibraryBig,
  Loader2,
  Plus,
  Search,
  Star,
  Trash2,
  Tv,
  X,
} from "lucide-react";

import { db } from "../firebase/firebase";
import { useAuth } from "../auth/AuthContext";
import type { MediaItem, MediaType, WatchStatus } from "../types/media";

type MediaFilter = "ALL" | MediaType;
type StatusFilter = "ALL" | WatchStatus;

type PreviewImage = {
  url: string;
  title: string;
};

function statusLabel(status?: WatchStatus) {
  if (status === "IZLENECEK") return "İzlenecek";
  if (status === "IZLENIYOR") return "İzleniyor";
  if (status === "IZLENDI") return "İzlendi";
  if (status === "BIRAKILDI") return "Bırakıldı";
  return "Bilinmiyor";
}

function mediaTypeLabel(type?: MediaType) {
  return type === "TV" ? "Dizi" : "Film";
}

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

function formatDate(value?: string) {
  if (!value) return "";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return value;

  return date.toLocaleDateString("tr-TR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function getStatusDotClass(status?: WatchStatus) {
  if (status === "IZLENDI") return "bg-emerald-400";
  if (status === "IZLENIYOR") return "bg-sky-400";
  if (status === "BIRAKILDI") return "bg-rose-400";
  return "bg-amber-400";
}

function getStatusBadgeClass(status?: WatchStatus) {
  if (status === "IZLENDI") {
    return "bg-emerald-50 text-emerald-700 border-emerald-200/80 dark:bg-emerald-900/20 dark:text-emerald-200 dark:border-emerald-800/80";
  }

  if (status === "IZLENIYOR") {
    return "bg-sky-50 text-sky-700 border-sky-200/80 dark:bg-sky-900/20 dark:text-sky-200 dark:border-sky-800/80";
  }

  if (status === "BIRAKILDI") {
    return "bg-rose-50 text-rose-700 border-rose-200/80 dark:bg-rose-900/20 dark:text-rose-200 dark:border-rose-800/80";
  }

  return "bg-amber-50 text-amber-700 border-amber-200/80 dark:bg-amber-900/20 dark:text-amber-100 dark:border-amber-800/80";
}

function getProgress(item: MediaItem) {
  if (item.type === "MOVIE") {
    const runtime = Number(item.runtime || 0);
    const watched =
      item.status === "IZLENDI" ? runtime : Number(item.watchedMinutes || 0);

    if (!runtime || runtime <= 0) {
      return {
        label: item.status === "IZLENDI" ? "Tamamlandı" : "Süre bilinmiyor",
        percent: item.status === "IZLENDI" ? 100 : 0,
        detail: "",
      };
    }

    const safeWatched = Math.min(watched, runtime);
    const percent =
      item.status === "IZLENDI"
        ? 100
        : Math.round((safeWatched / runtime) * 100);

    const remaining = Math.max(0, runtime - safeWatched);

    return {
      label:
        item.status === "IZLENDI"
          ? "Tamamlandı"
          : `${safeWatched}/${runtime} dk`,
      percent,
      detail:
        item.status === "IZLENDI"
          ? `${runtime} dk izlendi`
          : `${remaining} dk kaldı`,
    };
  }

  const totalEpisodes = Number(item.numberOfEpisodes || 0);
  const watchedEpisodes = Number(item.watchedEpisodeCount || 0);

  if (!totalEpisodes || totalEpisodes <= 0) {
    return {
      label:
        item.currentSeason && item.currentEpisode
          ? `S${item.currentSeason} • B${item.currentEpisode}`
          : "Bölüm bilgisi yok",
      percent: item.status === "IZLENDI" ? 100 : 0,
      detail: "",
    };
  }

  const percent =
    item.status === "IZLENDI" && watchedEpisodes === 0
      ? 100
      : Math.round(
          (Math.min(watchedEpisodes, totalEpisodes) / totalEpisodes) * 100
        );

  return {
    label:
      watchedEpisodes > 0
        ? `${watchedEpisodes}/${totalEpisodes} bölüm`
        : item.currentSeason && item.currentEpisode
        ? `S${item.currentSeason} • B${item.currentEpisode}`
        : `0/${totalEpisodes} bölüm`,
    percent,
    detail:
      item.currentSeason && item.currentEpisode
        ? `Son: Sezon ${item.currentSeason}, Bölüm ${item.currentEpisode}`
        : `${item.numberOfSeasons || 0} sezon`,
  };
}

/**
 * Eski veya yeni kayıt fark etmeksizin puanı 5 yıldız ölçeğine çevirir.
 *
 * Örnek:
 * 4  -> 4/5
 * 5  -> 5/5
 * 8  -> 4/5
 * 10 -> 5/5
 */
function normalizeRatingToFive(value: number) {
  const raw = Number(value || 0);

  if (!Number.isFinite(raw) || raw <= 0) return 0;

  if (raw <= 5) {
    return Math.round(raw * 10) / 10;
  }

  return Math.round((Math.min(raw, 10) / 2) * 10) / 10;
}

function getRatingStars(value: number) {
  const fiveValue = normalizeRatingToFive(value);
  const filledStars = Math.round(fiveValue);

  return Array.from({ length: 5 }, (_, index) => index < filledStars);
}

function getCardRating(item: MediaItem) {
  if (item.status === "IZLENECEK") {
    const expected = Number(item.expectedRating || 0);

    return {
      label: "Beklenti",
      value: expected,
      valueFive: normalizeRatingToFive(expected),
      visible: expected > 0,
    };
  }

  const userRating = Number(item.userRating || 0);

  return {
    label: "Puanım",
    value: userRating,
    valueFive: normalizeRatingToFive(userRating),
    visible: userRating > 0,
  };
}

function getSummaryStats(items: MediaItem[]) {
  const total = items.length;
  const movies = items.filter((item) => item.type === "MOVIE").length;
  const tv = items.filter((item) => item.type === "TV").length;
  const completed = items.filter((item) => item.status === "IZLENDI").length;
  const watching = items.filter((item) => item.status === "IZLENIYOR").length;

  const ratedItems = items
    .map((item) => normalizeRatingToFive(Number(item.userRating || 0)))
    .filter((rating) => rating > 0);

  const averageUserRating =
    ratedItems.length > 0
      ? Math.round(
          (ratedItems.reduce((sum, rating) => sum + rating, 0) /
            ratedItems.length) *
            10
        ) / 10
      : 0;

  const totalMinutes = items.reduce((sum, item) => {
    if (item.type === "MOVIE") {
      if (item.status === "IZLENDI") return sum + Number(item.runtime || 0);
      return sum + Number(item.watchedMinutes || 0);
    }

    if (item.type === "TV") {
      const episodeRuntime = Number(item.runtime || 0);
      const count = Number(item.watchedEpisodeCount || 0);
      return sum + episodeRuntime * count;
    }

    return sum;
  }, 0);

  return {
    total,
    movies,
    tv,
    completed,
    watching,
    hours: Math.round((totalMinutes / 60) * 10) / 10,
    averageUserRating,
  };
}

function getSearchableText(item: MediaItem) {
  const castValues = Array.isArray(item.cast)
    ? item.cast.map((person: any) =>
        typeof person === "string"
          ? person
          : [person?.name, person?.originalName, person?.character]
              .filter(Boolean)
              .join(" ")
      )
    : [];

  return [
    item.title,
    item.originalTitle,
    item.year,
    item.director,
    ...(item.creators || []),
    ...(item.genres || []),
    ...(item.platforms || []),
    ...castValues,
  ]
    .filter(Boolean)
    .join(" ")
    .toLocaleLowerCase("tr-TR");
}

export default function MediaLibraryPage() {
  const { user } = useAuth();

  const [items, setItems] = useState<MediaItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const [deleteTarget, setDeleteTarget] = useState<MediaItem | null>(null);
  const [previewImage, setPreviewImage] = useState<PreviewImage | null>(null);

  const [mediaFilter, setMediaFilter] = useState<MediaFilter>("ALL");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("ALL");
  const [searchText, setSearchText] = useState("");

  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);

  const stats = useMemo(() => getSummaryStats(items), [items]);

  const mediaTabs: { key: MediaFilter; label: string }[] = [
    { key: "ALL", label: "Tümü" },
    { key: "MOVIE", label: "Filmler" },
    { key: "TV", label: "Diziler" },
  ];

  const statusTabs: { key: StatusFilter; label: string }[] = [
    { key: "ALL", label: "Tümü" },
    { key: "IZLENECEK", label: "İzlenecek" },
    { key: "IZLENIYOR", label: "İzleniyor" },
    { key: "IZLENDI", label: "İzlendi" },
    { key: "BIRAKILDI", label: "Bırakıldı" },
  ];

  const filteredItems = useMemo(() => {
    const search = searchText.trim().toLocaleLowerCase("tr-TR");

    return items.filter((item) => {
      const matchesMedia =
        mediaFilter === "ALL" ? true : item.type === mediaFilter;

      const matchesStatus =
        statusFilter === "ALL" ? true : item.status === statusFilter;

      const matchesSearch = search
        ? getSearchableText(item).includes(search)
        : true;

      return matchesMedia && matchesStatus && matchesSearch;
    });
  }, [items, mediaFilter, statusFilter, searchText]);

  useEffect(() => {
    if (!toast) return;

    const timer = window.setTimeout(() => {
      setToast(null);
    }, 2800);

    return () => window.clearTimeout(timer);
  }, [toast]);

  useEffect(() => {
    if (!user) {
      setItems([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    const q = query(
      collection(db, "mediaItems"),
      where("userId", "==", user.uid)
    );

    const unsub = onSnapshot(
      q,
      (snapshot) => {
        const data = snapshot.docs.map((document) => ({
          id: document.id,
          ...(document.data() as Omit<MediaItem, "id">),
        }));

        data.sort((a, b) => {
          const bTime =
            getMillis((b as any).lastActionAt) ||
            getMillis(b.updatedAt) ||
            getMillis(b.createdAt);

          const aTime =
            getMillis((a as any).lastActionAt) ||
            getMillis(a.updatedAt) ||
            getMillis(a.createdAt);

          return bTime - aTime;
        });

        setItems(data);
        setLoading(false);
      },
      (err) => {
        console.error("Medya listeleme hatası:", err);
        setError(err?.message || "Film/dizi kayıtları alınırken hata oluştu.");
        setLoading(false);
      }
    );

    return () => unsub();
  }, [user]);

  const openDeleteModal = (item: MediaItem) => {
    setDeleteTarget(item);
  };

  const closeDeleteModal = () => {
    if (deletingId) return;
    setDeleteTarget(null);
  };

  const handleConfirmDelete = async () => {
    if (!user || !deleteTarget?.id) return;

    setDeletingId(deleteTarget.id);
    setError(null);

    try {
      const batch = writeBatch(db);

      const logsQuery = query(
        collection(db, "watchLogs"),
        where("userId", "==", user.uid),
        where("mediaId", "==", deleteTarget.id)
      );

      const logsSnapshot = await getDocs(logsQuery);

      logsSnapshot.docs.forEach((logDoc) => {
        batch.delete(logDoc.ref);
      });

      batch.delete(doc(db, "mediaItems", deleteTarget.id));

      await batch.commit();

      setToast({
        type: "success",
        message: "Medya kaydı başarıyla silindi.",
      });

      setDeleteTarget(null);
    } catch (err: any) {
      console.error("Medya silme hatası:", err);

      setError(err?.message || "Kayıt silinirken hata oluştu.");

      setToast({
        type: "error",
        message: err?.message || "Kayıt silinirken hata oluştu.",
      });
    } finally {
      setDeletingId(null);
    }
  };

  const openPreview = (url: string | undefined | null, title: string) => {
    if (!url) return;

    setPreviewImage({
      url,
      title,
    });
  };

  if (!user) {
    return (
      <div className="max-w-5xl mx-auto py-10">
        <div className="rounded-3xl border border-amber-100/60 dark:border-slate-800 bg-white/80 dark:bg-slate-900/80 p-8 text-center shadow-sm">
          <p className="text-lg font-medium mb-2">
            Film ve dizi arşivini görmek için giriş yapmalısın.
          </p>
          <p className="text-sm text-slate-500 mb-6">
            Oturum açtıktan sonra eklediğin tüm medya kayıtları burada
            listelenecek.
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
    <>
      <div className="max-w-6xl mx-auto space-y-6">
        {toast && (
          <div className="fixed top-5 right-5 z-[120]">
            <div
              className={`rounded-2xl border px-4 py-3 shadow-lg backdrop-blur-md text-sm font-medium ${
                toast.type === "success"
                  ? "bg-emerald-50/95 border-emerald-200 text-emerald-700 dark:bg-emerald-950/90 dark:border-emerald-800 dark:text-emerald-200"
                  : "bg-rose-50/95 border-rose-200 text-rose-700 dark:bg-rose-950/90 dark:border-rose-800 dark:text-rose-200"
              }`}
            >
              {toast.message}
            </div>
          </div>
        )}

        <div
          className="
            rounded-3xl border
            border-indigo-100/70 dark:border-slate-800/80
            bg-gradient-to-r
            from-indigo-50/95 via-purple-50/90 to-slate-100/95
            dark:from-slate-950 dark:via-slate-900 dark:to-slate-950
            px-6 py-5 shadow-sm
            flex flex-col gap-4 md:flex-row md:items-center md:justify-between
          "
        >
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 rounded-full bg-white/70 dark:bg-slate-900/80 px-3 py-1 text-[11px] font-medium text-indigo-800 dark:text-slate-200">
              <Clapperboard className="w-4 h-4" />
              <span>Kişisel medya arşivin</span>
              <span className="h-1 w-1 rounded-full bg-indigo-400" />
              <span className="text-indigo-700/80 dark:text-slate-400">
                {stats.total} kayıt
              </span>
            </div>

            <h1 className="mt-2 text-2xl md:text-3xl font-semibold tracking-tight text-slate-900 dark:text-slate-50">
              Film ve dizi rafın hazır. 🎬
            </h1>

            <p className="text-sm text-slate-600 dark:text-slate-400 max-w-xl">
              İzlenecekleri planla, izlediklerini kaydet, yarım kalan filmleri
              ve sezon sezon takip ettiğin dizileri tek yerden yönet.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-5 gap-3 mt-3 w-full md:w-auto">
              <div className="flex items-center gap-3 rounded-2xl px-4 py-3 bg-slate-100/80 dark:bg-slate-900/80 border border-slate-200/80 dark:border-slate-700/80">
                <div className="inline-flex items-center justify-center w-9 h-9 rounded-xl bg-white dark:bg-slate-800 shadow-sm">
                  <LibraryBig className="w-5 h-5 text-indigo-700 dark:text-slate-200" />
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

              <div className="flex items-center gap-3 rounded-2xl px-4 py-3 bg-indigo-50/80 dark:bg-indigo-900/20 border border-indigo-200/80 dark:border-indigo-800/80">
                <div className="inline-flex items-center justify-center w-9 h-9 rounded-xl bg-indigo-500/90 dark:bg-indigo-500/80 shadow-sm">
                  <Film className="w-5 h-5 text-white" />
                </div>
                <div className="flex flex-col">
                  <span className="text-[11px] font-semibold tracking-[0.16em] uppercase text-indigo-700/90 dark:text-indigo-200/90">
                    Film
                  </span>
                  <span className="text-lg font-bold text-indigo-900 dark:text-indigo-100">
                    {stats.movies}
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-3 rounded-2xl px-4 py-3 bg-purple-50/80 dark:bg-purple-900/20 border border-purple-200/80 dark:border-purple-800/80">
                <div className="inline-flex items-center justify-center w-9 h-9 rounded-xl bg-purple-500/90 dark:bg-purple-500/80 shadow-sm">
                  <Tv className="w-5 h-5 text-white" />
                </div>
                <div className="flex flex-col">
                  <span className="text-[11px] font-semibold tracking-[0.16em] uppercase text-purple-700/90 dark:text-purple-200/90">
                    Dizi
                  </span>
                  <span className="text-lg font-bold text-purple-900 dark:text-purple-100">
                    {stats.tv}
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-3 rounded-2xl px-4 py-3 bg-emerald-50/80 dark:bg-emerald-900/20 border border-emerald-200/80 dark:border-emerald-800/80">
                <div className="inline-flex items-center justify-center w-9 h-9 rounded-xl bg-emerald-500/90 dark:bg-emerald-500/80 shadow-sm">
                  <CheckCircle2 className="w-5 h-5 text-white" />
                </div>
                <div className="flex flex-col">
                  <span className="text-[11px] font-semibold tracking-[0.16em] uppercase text-emerald-700/80 dark:text-emerald-200/90">
                    İzlendi
                  </span>
                  <span className="text-lg font-bold text-emerald-900 dark:text-emerald-100">
                    {stats.completed}
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-3 rounded-2xl px-4 py-3 bg-amber-50/80 dark:bg-amber-900/20 border border-amber-200/80 dark:border-amber-800/80">
                <div className="inline-flex items-center justify-center w-9 h-9 rounded-xl bg-amber-500/90 dark:bg-amber-500/80 shadow-sm">
                  <Star className="w-5 h-5 text-white fill-white" />
                </div>
                <div className="flex flex-col">
                  <span className="text-[11px] font-semibold tracking-[0.16em] uppercase text-amber-700/80 dark:text-amber-200/90">
                    Ort.
                  </span>
                  <span className="text-lg font-bold text-amber-900 dark:text-amber-100">
                    {stats.averageUserRating
                      ? `${stats.averageUserRating}/5`
                      : "-"}
                  </span>
                </div>
              </div>
            </div>
          </div>

          <div className="flex flex-col items-end gap-3">
            <div className="flex items-center gap-4 text-[11px] text-slate-500 dark:text-slate-400">
              <div className="flex items-center gap-1">
                <span className="h-2.5 w-2.5 rounded-full bg-emerald-400/80" />
                <span>{stats.completed} izlendi</span>
              </div>
              <div className="flex items-center gap-1">
                <span className="h-2.5 w-2.5 rounded-full bg-sky-400/80" />
                <span>{stats.watching} izleniyor</span>
              </div>
            </div>

            <Link
              to="/add-media"
              className="inline-flex items-center justify-center rounded-full px-4 py-2 text-sm font-medium bg-slate-900 text-slate-50 dark:bg-slate-100 dark:text-slate-900 hover:bg-slate-700 dark:hover:bg-white transition gap-2 shadow-sm"
            >
              <Plus className="w-4 h-4" />
              Yeni film / dizi ekle
            </Link>
          </div>
        </div>

        {error && (
          <div className="rounded-3xl border border-rose-100/70 dark:border-rose-900/70 bg-rose-50/80 dark:bg-rose-950/30 px-4 py-3 text-sm text-rose-700 dark:text-rose-200 flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <div className="rounded-3xl border border-indigo-100/70 dark:border-slate-800 bg-white/80 dark:bg-slate-900/80 px-4 py-3 shadow-sm flex flex-col gap-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
            <div className="flex flex-col gap-2">
              <div className="flex items-center gap-2 text-xs font-medium text-slate-500 dark:text-slate-400">
                <div className="inline-flex items-center gap-1 rounded-full bg-slate-100/80 dark:bg-slate-900/90 px-2 py-1">
                  <Filter className="w-3 h-3 text-indigo-500" />
                  <span>Medya türü</span>
                </div>

                {mediaFilter !== "ALL" && (
                  <button
                    type="button"
                    onClick={() => setMediaFilter("ALL")}
                    className="text-[11px] underline underline-offset-2 hover:text-slate-700 dark:hover:text-slate-200"
                  >
                    sıfırla
                  </button>
                )}
              </div>

              <div className="inline-flex items-center gap-1 rounded-full bg-slate-50/80 dark:bg-slate-950/60 p-1 border border-slate-200/80 dark:border-slate-700/80 max-w-full overflow-x-auto">
                {mediaTabs.map((tab) => {
                  const active = tab.key === mediaFilter;

                  return (
                    <button
                      key={tab.key}
                      type="button"
                      onClick={() => setMediaFilter(tab.key)}
                      className={`
                        px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition
                        ${
                          active
                            ? "bg-indigo-500 text-white shadow-sm"
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

            <div className="flex flex-col gap-2">
              <div className="flex items-center gap-2 text-xs font-medium text-slate-500 dark:text-slate-400">
                <div className="inline-flex items-center gap-1 rounded-full bg-slate-100/80 dark:bg-slate-900/90 px-2 py-1">
                  <BarChart2 className="w-3 h-3 text-purple-500" />
                  <span>Durum</span>
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
                            ? "bg-purple-500 text-white shadow-sm"
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

            <div className="w-full lg:w-80">
              <div className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-1 flex items-center gap-2">
                <Search className="w-3 h-3" />
                <span>Başlık, oyuncu, tür veya platform ara</span>

                {(searchText || "").trim().length > 0 && (
                  <button
                    type="button"
                    onClick={() => setSearchText("")}
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
                  placeholder="Örn: Nolan, drama, Netflix..."
                  className="w-full rounded-full border border-indigo-100/70 dark:border-slate-700 bg-white/90 dark:bg-slate-950/70 pl-9 pr-3 py-1.5 text-sm outline-none focus:ring-2 focus:ring-indigo-400/40 dark:focus:ring-slate-100/20 shadow-sm"
                  value={searchText}
                  onChange={(e) => setSearchText(e.target.value)}
                />
              </div>
            </div>
          </div>
        </div>

        {loading ? (
          <PageLoading label="Film ve dizilerin yükleniyor…" />
        ) : filteredItems.length === 0 ? (
          <div className="mt-6">
            <div className="rounded-3xl border border-dashed border-indigo-100/80 dark:border-slate-800 bg-white/80 dark:bg-slate-900/70 p-10 text-center shadow-sm">
              <div className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-indigo-100 text-indigo-700 dark:bg-slate-800 dark:text-slate-200 mb-4">
                <Clapperboard className="w-6 h-6" />
              </div>

              <p className="text-base font-medium mb-1">
                Henüz gösterilecek film veya dizi yok
              </p>

              <p className="text-sm text-slate-500 mb-4">
                Yeni film veya dizi ekleyerek medya arşivini oluşturmaya
                başlayabilirsin.
              </p>

              <Link
                to="/add-media"
                className="inline-flex items-center justify-center rounded-full px-4 py-2 text-sm font-medium bg-slate-900 text-slate-50 dark:bg-slate-100 dark:text-slate-900 hover:bg-slate-700 dark:hover:bg-white transition gap-2"
              >
                <Plus className="w-4 h-4" />
                İlk medya kaydını ekle
              </Link>
            </div>
          </div>
        ) : (
          <div className="mt-4 grid gap-4 grid-cols-1 md:grid-cols-2 xl:grid-cols-3">
            {filteredItems.map((item) => {
              const progress = getProgress(item);
              const rating = getCardRating(item);
              const poster = item.posterUrl || item.backdropUrl || "";

              return (
                <article
                  key={item.id}
                  className="
                    group rounded-3xl border border-slate-200/80 dark:border-slate-800
                    bg-white/90 dark:bg-slate-900/80 shadow-sm
                    hover:-translate-y-0.5 hover:shadow-md
                    transition overflow-hidden
                  "
                >
                  <div className="relative h-28 bg-gradient-to-br from-indigo-100 via-purple-50 to-slate-100 dark:from-slate-900 dark:via-slate-950 dark:to-slate-900">
                    {item.backdropUrl ? (
                      <button
                        type="button"
                        onClick={() =>
                          openPreview(item.backdropUrl, `${item.title} arka plan`)
                        }
                        className="absolute inset-0 w-full h-full"
                      >
                        <img
                          src={item.backdropUrl}
                          alt={item.title}
                          className="w-full h-full object-cover opacity-60 dark:opacity-40"
                        />
                      </button>
                    ) : null}

                    <div className="absolute inset-0 bg-gradient-to-t from-white dark:from-slate-900 via-white/40 dark:via-slate-900/50 to-transparent pointer-events-none" />

                    <div className="absolute top-3 right-3">
                      <span
                        className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-semibold backdrop-blur-sm ${getStatusBadgeClass(
                          item.status
                        )}`}
                      >
                        <span
                          className={`h-2 w-2 rounded-full ${getStatusDotClass(
                            item.status
                          )}`}
                        />
                        {statusLabel(item.status)}
                      </span>
                    </div>
                  </div>

                  <div className="px-4 pb-4 -mt-12 relative">
                    <div className="flex gap-3">
                      <button
                        type="button"
                        onClick={() => openPreview(poster, item.title)}
                        className="w-24 h-36 rounded-2xl overflow-hidden bg-slate-200 dark:bg-slate-800 border-4 border-white dark:border-slate-900 shadow-sm flex-shrink-0 group/poster relative"
                      >
                        {poster ? (
                          <img
                            src={poster}
                            alt={item.title}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-slate-400">
                            <ImageIcon className="w-7 h-7" />
                          </div>
                        )}

                        {poster ? (
                          <span className="absolute inset-0 bg-slate-950/0 group-hover/poster:bg-slate-950/25 transition flex items-center justify-center">
                            <Eye className="w-5 h-5 text-white opacity-0 group-hover/poster:opacity-100 transition" />
                          </span>
                        ) : null}
                      </button>

                      <div className="pt-12 min-w-0 flex-1">
                        <div className="flex flex-wrap gap-1.5">
                          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-slate-100 dark:bg-slate-950 text-slate-600 dark:text-slate-300 text-[11px] font-bold">
                            {item.type === "TV" ? (
                              <Tv className="w-3 h-3" />
                            ) : (
                              <Film className="w-3 h-3" />
                            )}
                            {mediaTypeLabel(item.type)}
                          </span>

                          {item.year && (
                            <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-slate-100 dark:bg-slate-950 text-slate-500 text-[11px] font-bold">
                              <Calendar className="w-3 h-3" />
                              {item.year}
                            </span>
                          )}
                        </div>

                        <h2 className="mt-2 text-lg font-bold tracking-tight text-slate-900 dark:text-slate-50 line-clamp-2">
                          {item.title}
                        </h2>

                     <div className="mt-2 flex flex-wrap items-center gap-1.5">
  {rating.visible && (
    <div className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 dark:bg-amber-900/20 px-2.5 py-1 border border-amber-100 dark:border-amber-800/70">
      <span className="text-[11px] font-bold text-amber-700 dark:text-amber-200">
        {rating.label}
      </span>

      <span className="inline-flex items-center gap-0.5">
        {getRatingStars(rating.value).map((filled, index) => (
          <Star
            key={index}
            className={`w-3.5 h-3.5 ${
              filled
                ? "text-amber-500 fill-amber-500"
                : "text-slate-300 dark:text-slate-700"
            }`}
          />
        ))}
      </span>

      <span className="text-[11px] font-bold text-amber-700 dark:text-amber-200">
        {rating.valueFive}/5
      </span>
    </div>
  )}

  {item.tmdbRating ? (
    <div className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 dark:bg-slate-950 px-2.5 py-1 border border-slate-200 dark:border-slate-800">
      <Star className="w-3.5 h-3.5 text-slate-500 dark:text-slate-300 fill-current" />
      <span className="text-[11px] font-bold text-slate-600 dark:text-slate-300">
        TMDb {item.tmdbRating}/10
      </span>
    </div>
  ) : null}
</div>
                      </div>
                    </div>

                    {item.overview && (
                      <p className="mt-3 text-sm leading-5 text-slate-600 dark:text-slate-300 line-clamp-2">
                        {item.overview}
                      </p>
                    )}

                    <div className="mt-3 flex flex-wrap gap-1.5">
                      {(item.genres || []).slice(0, 4).map((genre) => (
                        <span
                          key={genre}
                          className="px-2 py-1 rounded-full bg-slate-100 dark:bg-slate-950 text-[11px] text-slate-500 dark:text-slate-400"
                        >
                          {genre}
                        </span>
                      ))}
                    </div>

                    <div className="mt-4 rounded-2xl bg-slate-50/80 dark:bg-slate-950/60 border border-slate-200/70 dark:border-slate-800 px-3 py-3">
                      <div className="flex items-center justify-between gap-2 text-xs text-slate-500 mb-1">
                        <span className="font-semibold flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {progress.label}
                        </span>
                        <span>{progress.percent}%</span>
                      </div>

                      <div className="h-2 rounded-full bg-slate-200/70 dark:bg-slate-800 overflow-hidden">
                        <div
                          className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-purple-500"
                          style={{
                            width: `${Math.min(
                              100,
                              Math.max(0, progress.percent)
                            )}%`,
                          }}
                        />
                      </div>

                      {progress.detail && (
                        <p className="mt-1 text-[11px] text-slate-500">
                          {progress.detail}
                        </p>
                      )}
                    </div>

                    <div className="mt-3 rounded-2xl bg-white/70 dark:bg-slate-950/50 border border-slate-200/70 dark:border-slate-800 px-3 py-2 space-y-1">
                      <div className="flex items-center justify-between gap-2 text-[11px] text-slate-500 dark:text-slate-400">
                        <span>Son güncelleme</span>
                        <span className="font-semibold text-slate-700 dark:text-slate-200 text-right">
                          {formatDateTime(item.updatedAt)}
                        </span>
                      </div>

                      <div className="flex items-center justify-between gap-2 text-[11px] text-slate-500 dark:text-slate-400">
                        <span>Son işlem</span>
                        <span className="font-semibold text-slate-700 dark:text-slate-200 text-right">
                          {formatDateTime((item as any).lastActionAt)}
                        </span>
                      </div>
                    </div>

                    <div className="mt-3 flex flex-col gap-2 text-xs text-slate-500">
                      <div className="flex flex-wrap items-center gap-2">
                        {item.type === "MOVIE" && item.runtime ? (
                          <span>{item.runtime} dakika</span>
                        ) : item.type === "TV" ? (
                          <span>
                            {item.numberOfSeasons || 0} sezon •{" "}
                            {item.numberOfEpisodes || 0} bölüm
                          </span>
                        ) : null}

                        {item.watchedAt ? (
                          <span>• {formatDate(item.watchedAt)}</span>
                        ) : null}
                      </div>

                      {item.platforms && item.platforms.length > 0 ? (
                        <p className="line-clamp-1">
                          Platform: {item.platforms.slice(0, 3).join(", ")}
                        </p>
                      ) : null}
                    </div>

                    <div className="mt-4 flex items-center justify-between gap-2">
                      <Link
                        to={`/media/${item.id}`}
                        className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-full bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900 text-xs font-semibold shadow-sm hover:brightness-110 transition"
                      >
                        Detaylar
                      </Link>

                      <button
                        type="button"
                        onClick={() => openDeleteModal(item)}
                        disabled={deletingId === item.id}
                        className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-full border border-rose-200 text-rose-600 hover:bg-rose-50 dark:border-rose-900 dark:text-rose-300 dark:hover:bg-rose-950/30 text-xs font-bold transition disabled:opacity-60"
                      >
                        {deletingId === item.id ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <Trash2 className="w-3.5 h-3.5" />
                        )}
                        Sil
                      </button>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </div>

      {deleteTarget && (
        <div className="fixed inset-0 z-[100]">
          <button
            type="button"
            className="absolute inset-0 bg-slate-950/60 backdrop-blur-[2px]"
            onClick={closeDeleteModal}
          />

          <div className="absolute inset-0 flex items-center justify-center p-4 pointer-events-none">
            <div className="w-full max-w-md rounded-3xl border border-slate-200/80 dark:border-slate-800 bg-white/95 dark:bg-slate-950/95 shadow-2xl overflow-hidden pointer-events-auto">
              <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200/70 dark:border-slate-800">
                <div className="flex items-center gap-3">
                  <div className="inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-rose-100 text-rose-600 dark:bg-rose-950/40 dark:text-rose-300">
                    <AlertTriangle className="w-5 h-5" />
                  </div>

                  <div>
                    <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
                      Medya kaydını sil
                    </h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      Bu işlem geri alınamaz.
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={closeDeleteModal}
                  disabled={!!deletingId}
                  className="p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-900 transition disabled:opacity-60"
                >
                  <X className="w-4 h-4 text-slate-500" />
                </button>
              </div>

              <div className="px-5 py-5">
                <div className="flex items-start gap-4">
                  <div className="w-20 h-28 rounded-2xl overflow-hidden bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex-shrink-0">
                    {deleteTarget.posterUrl || deleteTarget.backdropUrl ? (
                      <img
                        src={deleteTarget.posterUrl || deleteTarget.backdropUrl}
                        alt={deleteTarget.title}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-slate-400">
                        <ImageIcon className="w-6 h-6" />
                      </div>
                    )}
                  </div>

                  <div className="min-w-0 flex-1">
                    <p className="text-sm text-slate-600 dark:text-slate-300 leading-6">
                      <span className="font-bold text-slate-900 dark:text-slate-100">
                        {deleteTarget.title}
                      </span>{" "}
                      kaydını silmek üzeresin. Bu kayıtla ilişkili izleme
                      günlükleri de silinir.
                    </p>

                    <div className="mt-3 space-y-1 text-xs text-slate-500 dark:text-slate-400">
                      <p>
                        <span className="font-semibold text-slate-700 dark:text-slate-200">
                          Tür:
                        </span>{" "}
                        {mediaTypeLabel(deleteTarget.type)}
                      </p>

                      {deleteTarget.year ? (
                        <p>
                          <span className="font-semibold text-slate-700 dark:text-slate-200">
                            Yıl:
                          </span>{" "}
                          {deleteTarget.year}
                        </p>
                      ) : null}

                      <p>
                        <span className="font-semibold text-slate-700 dark:text-slate-200">
                          Durum:
                        </span>{" "}
                        {statusLabel(deleteTarget.status)}
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="px-5 pb-5 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={closeDeleteModal}
                  disabled={!!deletingId}
                  className="inline-flex items-center justify-center rounded-full px-4 py-2 text-sm font-semibold border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-900 transition disabled:opacity-60"
                >
                  Vazgeç
                </button>

                <button
                  type="button"
                  onClick={handleConfirmDelete}
                  disabled={deletingId === deleteTarget.id}
                  className="inline-flex items-center justify-center gap-2 rounded-full px-4 py-2 text-sm font-semibold text-white bg-rose-600 hover:bg-rose-700 transition disabled:opacity-60"
                >
                  {deletingId === deleteTarget.id ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Siliniyor...
                    </>
                  ) : (
                    "Kaydı Sil"
                  )}
                </button>
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