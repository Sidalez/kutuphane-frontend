// src/pages/MediaDetailPage.tsx

import { useEffect, useMemo, useState } from "react";
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
  updateDoc,
  where,
} from "firebase/firestore";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  AlertCircle,
  ArrowLeft,
  CalendarDays,
  CheckCircle2,
  ChevronRight,
  Clock,
  ExternalLink,
  Film,
  Heart,
  Layers,
  Loader2,
  Play,
  Plus,
  RotateCcw,
  Save,
  Sparkles,
  Trash2,
  Star,
  Tv,
  X,
} from "lucide-react";

import { db } from "../firebase/firebase";
import { useAuth } from "../auth/AuthContext";
import type { MediaItem, MediaType, WatchStatus } from "../types/media";

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
  watchedAt?: string | null;
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

type MediaDetailsResponse = {
  tmdbId: number;
  type: MediaType;
  title?: string;
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
  cast?: string[];
  castDetails?: MediaPerson[];
  tmdbRating?: number | null;
  imdbRating?: number | null;
};

type Toast = {
  type: "success" | "error" | "info";
  message: string;
};

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

function toInputDate(value?: unknown) {
  const raw = getDateValue(value);

  if (!raw) return todayInputValue();

  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    return raw;
  }

  const date = new Date(raw);

  if (Number.isNaN(date.getTime())) {
    return String(raw).slice(0, 10);
  }

  return date.toISOString().slice(0, 10);
}

function getMonthKey(date: string) {
  return date.slice(0, 7);
}

function getApiBase() {
  return import.meta.env.VITE_API_URL || "http://localhost:3001";
}

async function postJson<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${getApiBase()}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
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
    return value.map((item) =>
      item === undefined ? null : removeUndefinedDeep(item)
    ) as T;
  }

  if (
    value &&
    typeof value === "object" &&
    Object.getPrototypeOf(value) === Object.prototype
  ) {
    const cleaned: Record<string, unknown> = {};

    Object.entries(value as Record<string, unknown>).forEach(([key, val]) => {
      if (val !== undefined) {
        cleaned[key] = removeUndefinedDeep(val);
      }
    });

    return cleaned as T;
  }

  return value;
}

function episodeKey(seasonNumber: number, episodeNumber: number) {
  return `S${seasonNumber}E${episodeNumber}`;
}

function getWatchedEpisodeList(watched: Record<string, TvEpisode>) {
  return Object.values(watched).sort((a, b) => {
    if (a.seasonNumber !== b.seasonNumber) {
      return a.seasonNumber - b.seasonNumber;
    }

    return a.episodeNumber - b.episodeNumber;
  });
}

function statusLabel(status: WatchStatus) {
  if (status === "IZLENECEK") return "İzlenecek";
  if (status === "IZLENIYOR") return "İzleniyor";
  if (status === "IZLENDI") return "İzlendi";
  return "Bırakıldı";
}

function mediaTypeLabel(type?: MediaType) {
  return type === "TV" ? "Dizi" : "Film";
}

function getStatusBadgeClass(status: WatchStatus) {
  if (status === "IZLENDI") {
    return "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-900/20 dark:text-emerald-200";
  }

  if (status === "IZLENIYOR") {
    return "border-sky-200 bg-sky-50 text-sky-700 dark:border-sky-800 dark:bg-sky-900/20 dark:text-sky-200";
  }

  if (status === "BIRAKILDI") {
    return "border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-800 dark:bg-rose-900/20 dark:text-rose-200";
  }

  return "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-800 dark:bg-amber-900/20 dark:text-amber-100";
}

function formatDate(value?: unknown) {
  const raw = getDateValue(value);

  if (!raw) return "";

  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    const [year, month, day] = raw.split("-").map(Number);
    return new Date(year, month - 1, day).toLocaleDateString("tr-TR", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  }

  const date = new Date(raw);

  if (Number.isNaN(date.getTime())) return String(raw);

  return date.toLocaleDateString("tr-TR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function getDateValue(value: any): string {
  if (!value) return "";

  if (typeof value === "string") {
    return value.trim();
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  if (typeof value?.toDate === "function") {
    try {
      return value.toDate().toISOString();
    } catch {
      return "";
    }
  }

  if (typeof value?.seconds === "number") {
    const milliseconds = value.seconds * 1000 + Math.floor(Number(value.nanoseconds || 0) / 1000000);
    return new Date(milliseconds).toISOString();
  }

  return String(value || "").trim();
}

function formatDateTime(value?: unknown) {
  const raw = getDateValue(value);
  if (!raw) return "-";

  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    return formatDate(raw) || "-";
  }

  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) return String(raw).slice(0, 16);

  return date.toLocaleString("tr-TR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function getProgress(item: MediaItem, status: WatchStatus, watchedEpisodesCount: number, watchedMinutesInput: string) {
  if (item.type === "MOVIE") {
    const runtime = Number(item.runtime || 0);
    const watched =
      status === "IZLENDI" ? runtime : Number(watchedMinutesInput || item.watchedMinutes || 0);

    if (!runtime || runtime <= 0) {
      return {
        label: status === "IZLENDI" ? "Tamamlandı" : "Süre bilinmiyor",
        percent: status === "IZLENDI" ? 100 : 0,
        sub: "",
      };
    }

    const safeWatched = Math.min(watched, runtime);
    const percent =
      status === "IZLENDI"
        ? 100
        : Math.round((safeWatched / runtime) * 100);

    return {
      label:
        status === "IZLENDI"
          ? "Tamamlandı"
          : `${safeWatched}/${runtime} dk`,
      percent,
      sub:
        status === "IZLENDI"
          ? `${runtime} dk izlendi`
          : `${Math.max(0, runtime - safeWatched)} dk kaldı`,
    };
  }

  const totalEpisodes = Number(item.numberOfEpisodes || 0);

  if (!totalEpisodes) {
    return {
      label: watchedEpisodesCount
        ? `${watchedEpisodesCount} bölüm seçildi`
        : "Bölüm bilgisi yok",
      percent: status === "IZLENDI" ? 100 : 0,
      sub: "",
    };
  }

  const percent =
    status === "IZLENDI" && watchedEpisodesCount === 0
      ? 100
      : Math.round((Math.min(watchedEpisodesCount, totalEpisodes) / totalEpisodes) * 100);

  return {
    label: `${watchedEpisodesCount}/${totalEpisodes} bölüm`,
    percent,
    sub: `${Math.max(0, totalEpisodes - watchedEpisodesCount)} bölüm kaldı`,
  };
}

function getPersonInitials(name: string) {
  const clean = String(name || "").trim();

  if (!clean) return "?";

  const parts = clean.split(/\s+/).filter(Boolean);

  if (parts.length === 1) {
    return parts[0].slice(0, 2).toLocaleUpperCase("tr-TR");
  }

  return `${parts[0][0] || ""}${parts[parts.length - 1][0] || ""}`.toLocaleUpperCase("tr-TR");
}

function getActorImageUrl(person?: MediaPerson | null) {
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
  if (value.startsWith("/")) return `https://image.tmdb.org/t/p/w185${value}`;

  return value;
}

function getHighQualityImageUrl(src?: string | null) {
  const value = String(src || "").trim();
  if (!value) return "";

  if (value.includes("image.tmdb.org/t/p/")) {
    return value.replace(/\/t\/p\/(w92|w154|w185|w300|w342|w500|w780|h632)\//, "/t/p/original/");
  }

  return value;
}

function getEpisodeText(episode: TvEpisode | { seasonNumber: number; episodeNumber: number; title?: string | null }) {
  const title = String(episode.title || `${episode.episodeNumber}. Bölüm`).trim();
  return `S${episode.seasonNumber} B${episode.episodeNumber} • ${title}`;
}

function getEpisodeHeading(episode: TvEpisode) {
  const title = String(episode.title || `${episode.episodeNumber}. Bölüm`).trim();
  return `${episode.episodeNumber}. Bölüm: ${title}`;
}

function cleanStoredEpisodeActionText(value?: string | null) {
  return String(value || "").trim();
}

function formatActionDateOnly(value?: unknown) {
  const raw = getDateValue(value);
  if (!raw) return "";
  return formatDate(raw);
}

function formatStoredActionText(value?: string | null, actionAt?: unknown) {
  const cleaned = cleanStoredEpisodeActionText(value);
  const actionDate = formatActionDateOnly(actionAt);

  if (!cleaned || !actionDate) return cleaned;

  // Eski kayıtlarda açıklama içine yanlışlıkla izleme tarihi yazılmış olabilir.
  // Son işlemler alanı işlem geçmişidir; bu yüzden cümledeki tarih, işlem tarihiyle eşitlenir.
  return cleaned.replace(
    /\b\d{1,2}\s+(Oca|Ocak|Şub|Şubat|Mar|Mart|Nis|Nisan|May|Mayıs|Haz|Haziran|Tem|Temmuz|Ağu|Ağustos|Eyl|Eylül|Eki|Ekim|Kas|Kasım|Ara|Aralık)\.?\s+\d{4}\s+tarihinde/giu,
    `${actionDate} tarihinde`
  );
}

function getLastWatchedEpisodeInfo(episodes: TvEpisode[]) {
  if (!episodes.length) return null;

  const sorted = [...episodes].sort((a, b) => {
    const aTime = a.watchedAt ? new Date(a.watchedAt).getTime() : 0;
    const bTime = b.watchedAt ? new Date(b.watchedAt).getTime() : 0;

    if (aTime !== bTime) return aTime - bTime;
    if (a.seasonNumber !== b.seasonNumber) return a.seasonNumber - b.seasonNumber;
    return a.episodeNumber - b.episodeNumber;
  });

  const last = sorted[sorted.length - 1];

  return {
    episode: last,
    label: getEpisodeText(last),
    date: last.watchedAt || "",
  };
}

function normalizeActionHistory(value: unknown) {
  if (!Array.isArray(value)) return [];

  return value
    .map((item: any) => ({
      at: item?.at || item?.date || item?.createdAt || "",
      title: String(item?.title || item?.summary || "İşlem kaydı").trim(),
      description: String(item?.description || item?.text || "").trim(),
      details: Array.isArray(item?.details)
        ? item.details.map((detail: any) => String(detail || "").trim()).filter(Boolean)
        : [],
    }))
    .filter((item) => item.title || item.description || item.details.length > 0);
}

function numberOrUndefined(value: unknown) {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : undefined;
}

function isRatingChanged(before: unknown, after: unknown) {
  const b = numberOrUndefined(before);
  const a = numberOrUndefined(after);
  return b !== a;
}

function ratingChangeText(label: string, before: unknown, after: unknown) {
  const b = numberOrUndefined(before);
  const a = numberOrUndefined(after);

  if (!isRatingChanged(before, after)) return "";

  if (!b && a) return `${label} ${a}/5 olarak eklendi.`;
  if (b && !a) return `${label} kaldırıldı.`;
  return `${label} ${b}/5 değerinden ${a}/5 değerine güncellendi.`;
}

function buildActionDetails({
  media,
  previousStatus,
  nextStatus,
  previousWatchedMinutes,
  nextWatchedMinutes,
  previousExpectedRating,
  nextExpectedRating,
  previousProgressRating,
  nextProgressRating,
  previousUserRating,
  nextUserRating,
  previousNotes,
  nextNotes,
  newEpisodes,
  removedEpisodes,
  watchDate,
  actionDate,
}: {
  media: MediaItem;
  previousStatus?: WatchStatus;
  nextStatus: WatchStatus;
  previousWatchedMinutes?: number;
  nextWatchedMinutes?: number;
  previousExpectedRating?: number;
  nextExpectedRating?: number;
  previousProgressRating?: number;
  nextProgressRating?: number;
  previousUserRating?: number;
  nextUserRating?: number;
  previousNotes?: string;
  nextNotes?: string;
  newEpisodes: TvEpisode[];
  removedEpisodes: TvEpisode[];
  watchDate: string;
  actionDate: string;
}) {
  const details: string[] = [];

  if (previousStatus && previousStatus !== nextStatus) {
    details.push(`İzleme durumu ${statusLabel(previousStatus)} → ${statusLabel(nextStatus)} olarak değiştirildi.`);
  }

  [
    ratingChangeText("Beklenti puanı", previousExpectedRating, nextExpectedRating),
    ratingChangeText("Ara puan", previousProgressRating, nextProgressRating),
    ratingChangeText("Final / genel puan", previousUserRating, nextUserRating),
  ]
    .filter(Boolean)
    .forEach((text) => details.push(text));

  if (media.type === "MOVIE") {
    const before = Number(previousWatchedMinutes || 0);
    const after = Number(nextWatchedMinutes || 0);

    if (before !== after) {
      if (nextStatus === "IZLENDI") {
        details.push(`Film ${formatDate(actionDate)} tarihinde tamamlandı olarak işaretlendi.`);
      } else if (after > 0) {
        details.push(`Filmde ${after}. dakikaya kadar izlendi.`);
      }
    }
  }

  newEpisodes.forEach((episode) => {
    details.push(`${getEpisodeText(episode)} ${formatDate(actionDate)} tarihinde izlendi olarak işaretlendi.`);
  });

  removedEpisodes.forEach((episode) => {
    details.push(`${getEpisodeText(episode)} için izleme işareti kaldırıldı.`);
  });

  if ((previousNotes || "").trim() !== (nextNotes || "").trim()) {
    details.push(nextNotes?.trim() ? "Notlar güncellendi." : "Notlar temizlendi.");
  }

  if (details.length === 0) {
    details.push("Kayıt bilgileri güncellendi.");
  }

  return details;
}

function summarizeAction(details: string[]) {
  if (details.length === 0) return "Kayıt güncellendi.";
  if (details.length === 1) return details[0];
  return `${details[0]} +${details.length - 1} işlem daha`;
}

function normalizeCastDetails(value: unknown): MediaPerson[] {
  if (!Array.isArray(value)) return [];

  return value
    .map((person: any) => ({
      id: person?.id ?? null,
      name: String(person?.name || person?.originalName || "").trim(),
      originalName: person?.originalName || "",
      character: person?.character || "",
      episodeCount: Number(person?.episodeCount || 0) || undefined,
      profileUrl:
        person?.profileUrl ||
        person?.profileOriginalUrl ||
        person?.imageUrl ||
        person?.photoUrl ||
        person?.profile_path ||
        "",
      profileOriginalUrl: person?.profileOriginalUrl || "",
      imageUrl: person?.imageUrl || "",
      photoUrl: person?.photoUrl || "",
      profile_path: person?.profile_path || "",
      knownForDepartment: person?.knownForDepartment || "",
    }))
    .filter((person) => person.name);
}

function getCastNames(cast?: unknown, castDetails?: unknown) {
  if (Array.isArray(cast) && cast.length > 0) {
    return cast
      .map((person: any) =>
        typeof person === "string" ? person : person?.name || person?.originalName || ""
      )
      .filter(Boolean);
  }

  return normalizeCastDetails(castDetails).map((person) => person.name).filter(Boolean);
}

function ActorCard({
  person,
  onPreview,
}: {
  person: MediaPerson;
  onPreview?: (src: string, title: string, subtitle?: string) => void;
}) {
  const [imageError, setImageError] = useState(false);
  const imageUrl = !imageError ? getActorImageUrl(person) : "";
  const previewUrl = getHighQualityImageUrl(person.profileOriginalUrl || imageUrl);

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-2 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md dark:border-slate-800 dark:bg-slate-900">
      <div className="flex gap-2">
        <button
          type="button"
          disabled={!previewUrl}
          onClick={() => previewUrl && onPreview?.(previewUrl, person.name, person.character || undefined)}
          className="h-16 w-12 flex-shrink-0 overflow-hidden rounded-xl bg-gradient-to-br from-indigo-100 to-purple-100 ring-1 ring-slate-200 transition hover:scale-[1.04] disabled:cursor-default dark:from-slate-800 dark:to-slate-900 dark:ring-slate-700"
          title={previewUrl ? `${person.name} fotoğrafını büyüt` : person.name}
        >
          {imageUrl ? (
            <img
              src={imageUrl}
              alt={person.name}
              loading="lazy"
              referrerPolicy="no-referrer"
              onError={() => setImageError(true)}
              className="h-full w-full object-cover"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-[13px] font-black text-indigo-700 dark:text-indigo-200">
              {getPersonInitials(person.name)}
            </div>
          )}
        </button>

        <div className="min-w-0 flex-1">
          <p className="line-clamp-1 text-xs font-black text-slate-900 dark:text-slate-100" dir="auto">
            {person.name}
          </p>

          {person.character ? (
            <p className="mt-0.5 line-clamp-2 text-[11px] text-slate-500 dark:text-slate-400" dir="auto">
              {person.character}
            </p>
          ) : null}

          {person.episodeCount ? (
            <p className="mt-0.5 text-[10px] font-bold text-purple-500">
              {person.episodeCount} bölüm
            </p>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function calculateOverallRating(values: Array<number | undefined | null>) {
  const valid = values.filter(
    (value): value is number => typeof value === "number" && Number.isFinite(value) && value > 0
  );

  if (valid.length === 0) return undefined;

  const total = valid.reduce((sum, value) => sum + value, 0);
  return Math.round((total / valid.length) * 10) / 10;
}

function RatingStars({ value, size = "h-4 w-4" }: { value?: number; size?: string }) {
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((n) => (
        <Star
          key={n}
          className={`${size} ${
            value && value >= n
              ? "fill-yellow-400 text-yellow-400"
              : "text-slate-300 dark:text-slate-600"
          }`}
        />
      ))}
    </div>
  );
}

function RatingMetric({ label, value }: { label: string; value?: number }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2.5 dark:border-slate-800 dark:bg-slate-900">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-[10px] font-black uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">
            {label}
          </p>
          <div className="mt-1">
            <RatingStars value={value} size="h-3.5 w-3.5" />
          </div>
        </div>
        <span className="flex-shrink-0 rounded-full border border-slate-200 bg-white px-2 py-1 text-xs font-black text-slate-800 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100">
          {value ? `${value}/5` : "-"}
        </span>
      </div>
    </div>
  );
}

function StarRating({
  value,
  onChange,
  disabled = false,
  label = "Puan",
}: {
  value?: number;
  onChange: (value: number | undefined) => void;
  disabled?: boolean;
  label?: string;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3 dark:border-slate-800 dark:bg-slate-900">
      <div className="flex items-center justify-between gap-3">
        <p className="min-w-0 truncate text-xs font-bold text-slate-600 dark:text-slate-300">
          {label}
        </p>

        {value ? (
          <button
            type="button"
            onClick={() => onChange(undefined)}
            disabled={disabled}
            className="flex-shrink-0 rounded-full px-2 py-1 text-[11px] font-semibold text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 disabled:cursor-not-allowed disabled:opacity-50 dark:hover:bg-slate-800 dark:hover:text-slate-200"
          >
            temizle
          </button>
        ) : null}
      </div>

      <div className="mt-3 flex items-center gap-1.5">
        <div className="flex min-w-0 flex-1 items-center gap-1">
          {[1, 2, 3, 4, 5].map((n) => {
            const active = Boolean(value && value >= n);

            return (
              <button
                key={n}
                type="button"
                onClick={() => onChange(n)}
                disabled={disabled}
                className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-xl transition hover:bg-amber-100 disabled:cursor-not-allowed disabled:opacity-50 dark:hover:bg-amber-900/30"
                aria-label={`${n} yıldız ver`}
              >
                <Star
                  className={`h-5 w-5 transition ${
                    active
                      ? "fill-yellow-400 text-yellow-400"
                      : "text-slate-300 dark:text-slate-600"
                  }`}
                />
              </button>
            );
          })}
        </div>

        <span className="flex-shrink-0 rounded-full border border-slate-200 bg-white px-2.5 py-1 text-xs font-black text-slate-800 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100">
          {value ? `${value}/5` : "-"}
        </span>
      </div>
    </div>
  );
}

function ToastBar({ toast, onClose }: { toast: Toast | null; onClose: () => void }) {
  if (!toast) return null;

  const classes =
    toast.type === "success"
      ? "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900/70 dark:bg-emerald-950/70 dark:text-emerald-100"
      : toast.type === "error"
      ? "border-rose-200 bg-rose-50 text-rose-800 dark:border-rose-900/70 dark:bg-rose-950/70 dark:text-rose-100"
      : "border-indigo-200 bg-indigo-50 text-indigo-800 dark:border-indigo-900/70 dark:bg-indigo-950/70 dark:text-indigo-100";

  return (
    <div className="fixed right-4 top-4 z-[80] w-[calc(100%-2rem)] max-w-sm">
      <div className={`flex items-start gap-3 rounded-2xl border px-4 py-3 shadow-xl backdrop-blur ${classes}`}>
        {toast.type === "success" ? (
          <CheckCircle2 className="mt-0.5 h-4 w-4 flex-shrink-0" />
        ) : (
          <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0" />
        )}
        <p className="flex-1 text-sm font-medium leading-5">{toast.message}</p>
        <button
          type="button"
          onClick={onClose}
          className="rounded-lg p-1 opacity-70 transition hover:bg-black/5 hover:opacity-100 dark:hover:bg-white/10"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

export default function MediaDetailPage() {
  const { id } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();

  const [item, setItem] = useState<MediaItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [status, setStatus] = useState<WatchStatus>("IZLENECEK");
  const [watchedMinutes, setWatchedMinutes] = useState("");
  const [userRating, setUserRating] = useState<number | undefined>();
  const [expectedRating, setExpectedRating] = useState<number | undefined>();
  const [progressRating, setProgressRating] = useState<number | undefined>();
  const [watchDate, setWatchDate] = useState(todayInputValue());
  const [notes, setNotes] = useState("");
  const [shelves, setShelves] = useState<MediaShelf[]>(DEFAULT_SHELVES);
  const [selectedShelfIds, setSelectedShelfIds] = useState<string[]>([]);
  const [newShelfName, setNewShelfName] = useState("");
  const [savingShelf, setSavingShelf] = useState(false);

  const [seasons, setSeasons] = useState<MediaSeason[]>([]);
  const [selectedSeasonNumber, setSelectedSeasonNumber] = useState<number | null>(null);
  const [seasonDetails, setSeasonDetails] = useState<TvSeasonDetails | null>(null);
  const [loadingSeason, setLoadingSeason] = useState(false);

  const [watchedEpisodes, setWatchedEpisodes] = useState<Record<string, TvEpisode>>({});
  const [originalWatchedEpisodes, setOriginalWatchedEpisodes] = useState<Record<string, TvEpisode>>({});
  const [originalWatchedKeys, setOriginalWatchedKeys] = useState<Set<string>>(new Set());
  const [statusResetUnlocked, setStatusResetUnlocked] = useState(false);

  const [toast, setToast] = useState<Toast | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [previewImage, setPreviewImage] = useState<{
    src: string;
    title: string;
    subtitle?: string;
  } | null>(null);
  const [showAllActors, setShowAllActors] = useState(false);
  const [refreshingActors, setRefreshingActors] = useState(false);

  const watchedEpisodeList = useMemo(
    () => getWatchedEpisodeList(watchedEpisodes),
    [watchedEpisodes]
  );

  const lastWatchedEpisode =
    watchedEpisodeList.length > 0 ? watchedEpisodeList[watchedEpisodeList.length - 1] : null;

  const episodeTrackingEnabled = item?.type === "TV" && (status === "IZLENIYOR" || status === "IZLENDI");
  const dateFieldsEnabled = status === "IZLENIYOR" || status === "IZLENDI";
  const movieMinuteEnabled = item?.type === "MOVIE" && status === "IZLENIYOR";
  const isPersistedCompleted = item?.status === "IZLENDI";
  const isStatusLockedByCompletion = Boolean(isPersistedCompleted && !statusResetUnlocked);
  const lastWatchedEpisodeInfo = getLastWatchedEpisodeInfo(watchedEpisodeList);
  const createdDateText = formatDateTime((item as any)?.createdAt);
  const updatedDateText = formatDateTime((item as any)?.lastManualUpdateAt || (item as any)?.updatedAt || (item as any)?.lastActionAt);
  const lastViewedDateText = formatDateTime((item as any)?.lastViewedAt);
  const lastActionDateText = formatDateTime((item as any)?.lastActionAt);
  const lastWatchDateText = formatDateTime((item as any)?.lastWatchedAt || (item as any)?.watchedAt || (item as any)?.completedAt);
  const actionHistory = normalizeActionHistory((item as any)?.actionHistory);
  const castDetailsForDisplay = useMemo(
    () => normalizeCastDetails((item as any)?.castDetails),
    [item]
  );
  const visibleCastDetails = showAllActors
    ? castDetailsForDisplay
    : castDetailsForDisplay.slice(0, 18);
  const hiddenActorCount = Math.max(0, castDetailsForDisplay.length - visibleCastDetails.length);
  const lastActionText = String((item as any)?.lastActionText || "").trim() || "Henüz işlem açıklaması yok.";
  const lastActionDetails = Array.isArray((item as any)?.lastActionDetails)
    ? (item as any).lastActionDetails.map((detail: any) => String(detail || "").trim()).filter(Boolean)
    : [];
  const lastWatchedEpisodeText =
    item?.type === "TV" && ((item as any)?.lastWatchedEpisode?.seasonNumber || lastWatchedEpisodeInfo)
      ? getEpisodeText({
          seasonNumber: Number((item as any)?.lastWatchedEpisode?.seasonNumber || lastWatchedEpisodeInfo?.episode.seasonNumber || 0),
          episodeNumber: Number((item as any)?.lastWatchedEpisode?.episodeNumber || lastWatchedEpisodeInfo?.episode.episodeNumber || 0),
          title: (item as any)?.lastWatchedEpisode?.title || lastWatchedEpisodeInfo?.episode.title || "",
        })
      : item?.type === "MOVIE" && lastWatchDateText !== "-"
      ? "Film izleme kaydı"
      : "-";
  const lastWatchedEpisodeDateText =
    item?.type === "TV" && ((item as any)?.lastWatchedEpisode?.watchedAt || lastWatchedEpisodeInfo?.date)
      ? formatDateTime((item as any)?.lastWatchedEpisode?.watchedAt || lastWatchedEpisodeInfo?.date)
      : lastWatchDateText;

  const progress = useMemo(() => {
    if (!item) return { label: "", percent: 0, sub: "" };
    return getProgress(item, status, watchedEpisodeList.length, watchedMinutes);
  }, [item, status, watchedEpisodeList.length, watchedMinutes]);

  const ratingTitle =
    status === "IZLENECEK"
      ? "Beklenti puanı"
      : status === "IZLENIYOR"
      ? "Şu ana kadar değerlendirme"
      : status === "IZLENDI"
      ? "Genel puan"
      : "Bırakma değerlendirmesi";

  const ratingDescription =
    status === "IZLENECEK"
      ? "Bu içerikten beklentin ne kadar yüksek? İzlemeden önce yalnızca beklenti puanını gir."
      : status === "IZLENIYOR"
      ? "Henüz bitirmeden, şu ana kadar nasıl gittiğini ayrı olarak değerlendir."
      : status === "IZLENDI"
      ? "İçeriği tamamladın. Final genel puanını ver."
      : "Bıraktığın içerik için istersen genel değerlendirme bırak.";

  const activeRating =
    status === "IZLENECEK"
      ? expectedRating
      : status === "IZLENIYOR"
      ? progressRating
      : userRating;

  const setActiveRating =
    status === "IZLENECEK"
      ? setExpectedRating
      : status === "IZLENIYOR"
      ? setProgressRating
      : setUserRating;

  const overallRating = calculateOverallRating([
    expectedRating,
    progressRating,
    userRating,
  ]);

  const selectedShelves = useMemo(
    () => shelves.filter((shelf) => selectedShelfIds.includes(shelf.id)),
    [shelves, selectedShelfIds]
  );

  const isFavorite = selectedShelfIds.includes("favorite");

  const showToast = (type: Toast["type"], message: string) => {
    setToast({ type, message });
    window.setTimeout(() => {
      setToast((current) => (current?.message === message ? null : current));
    }, 3600);
  };

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

  const getShelfNamesFromIds = (ids: string[]) =>
    shelves.filter((shelf) => ids.includes(shelf.id)).map((shelf) => shelf.name);

  const restoreOriginalEpisodeDraft = () => {
    setWatchedEpisodes(originalWatchedEpisodes);
    setOriginalWatchedKeys(new Set(Object.keys(originalWatchedEpisodes)));
  };

  const getAllTvEpisodes = async () => {
    if (!item?.tmdbId || item.type !== "TV") return {};

    let seasonList = seasons;

    if (seasonList.length === 0) {
      const data = await postJson<{
        success: boolean;
        data: MediaDetailsResponse;
        message?: string;
      }>("/api/media/details-ai", {
        tmdbId: item.tmdbId,
        type: "TV",
      });

      seasonList = data.data?.seasons || [];
      setSeasons(seasonList);
    }

    const allEpisodes: Record<string, TvEpisode> = {};
    let firstSeasonDetails: TvSeasonDetails | null = null;

    for (const season of seasonList) {
      if (!season.seasonNumber) continue;

      const response = await postJson<{
        success: boolean;
        data: TvSeasonDetails;
        message?: string;
      }>("/api/media/tv-season", {
        tmdbId: item.tmdbId,
        seasonNumber: season.seasonNumber,
      });

      if (!response.success) continue;

      const details = response.data;
      if (!firstSeasonDetails) firstSeasonDetails = details;

      (details.episodes || []).forEach((episode) => {
        allEpisodes[episodeKey(episode.seasonNumber, episode.episodeNumber)] = {
          ...episode,
          watchedAt: watchDate || todayInputValue(),
        };
      });
    }

    if (firstSeasonDetails) {
      setSelectedSeasonNumber(firstSeasonDetails.seasonNumber);
      setSeasonDetails(firstSeasonDetails);
    }

    return allEpisodes;
  };

  const markAllTvEpisodesAsWatched = async () => {
    if (!item || item.type !== "TV") return;

    try {
      const allEpisodes = await getAllTvEpisodes();
      setWatchedEpisodes(allEpisodes);

      if (Object.keys(allEpisodes).length === 0) {
        showToast("info", "Dizi tamamlandı seçildi fakat bölüm listesi alınamadı. Bölümleri elle seçebilirsin.");
      } else {
        showToast("success", "Dizi tamamlandı olarak işaretlendi. Tüm sezon ve bölümler seçildi.");
      }
    } catch (err: any) {
      console.error("Tüm bölümler işaretlenemedi:", err);
      showToast("error", err?.message || "Tüm bölümler işaretlenirken hata oluştu.");
    }
  };

  const handleStatusSelect = async (nextStatus: WatchStatus) => {
    if (isStatusLockedByCompletion && nextStatus !== "IZLENDI") {
      showToast("info", "Tamamlanmış kayıt tekrar izleniyor veya izlenecek yapılamaz. Önce durum sıfırlama işlemini kullan.");
      return;
    }

    const wasUnsavedTvCompletion =
      item?.type === "TV" && status === "IZLENDI" && item.status !== "IZLENDI";

    if (wasUnsavedTvCompletion && nextStatus !== "IZLENDI") {
      restoreOriginalEpisodeDraft();
      showToast("info", "Kaydedilmemiş tamamlandı seçimi geri alındı; önceki bölüm durumuna dönüldü.");
    }

    setStatus(nextStatus);

    if (nextStatus === "IZLENDI" && item?.type === "MOVIE") {
      setWatchedMinutes(String(item.runtime || ""));
    }

    if (nextStatus === "IZLENDI" && item?.type === "TV") {
      await markAllTvEpisodesAsWatched();
    }

    if (nextStatus === "IZLENECEK") {
      setWatchedMinutes("");
      setWatchedEpisodes({});
    }
  };

  const resetStatusFlow = () => {
    setStatusResetUnlocked(true);
    setStatus("IZLENECEK");
    setWatchedMinutes("");
    setWatchedEpisodes({});
    setProgressRating(undefined);
    setUserRating(undefined);
    setWatchDate(todayInputValue());
    showToast("info", "Durum taslak olarak sıfırlandı. Kaydettiğinde kayıt izlenecek durumuna alınır ve izleme ilerlemesi temizlenir.");
  };

  const loadSeason = async (tmdbId: number, seasonNumber: number) => {
    setLoadingSeason(true);
    setError(null);

    try {
      const data = await postJson<{
        success: boolean;
        data: TvSeasonDetails;
        message?: string;
      }>("/api/media/tv-season", {
        tmdbId,
        seasonNumber,
      });

      if (!data.success) {
        setError(data.message || "Sezon bölümleri alınamadı.");
        return;
      }

      setSelectedSeasonNumber(seasonNumber);
      setSeasonDetails(data.data);
    } catch (err: any) {
      console.error("Sezon detay hatası:", err);
      setError(err?.message || "Sezon bölümleri alınırken hata oluştu.");
      showToast("error", err?.message || "Sezon bölümleri alınırken hata oluştu.");
    } finally {
      setLoadingSeason(false);
    }
  };

  const syncLatestTvMetadata = async (
    media: MediaItem,
    latest: MediaDetailsResponse
  ) => {
    if (!media.id) return media;

    const syncedPatch = removeUndefinedDeep({
      title: latest.title || media.title,
      originalTitle: latest.originalTitle ?? media.originalTitle ?? "",
      year: latest.year ?? media.year ?? "",
      overview: latest.overview ?? media.overview ?? "",
      posterUrl: latest.posterUrl ?? media.posterUrl ?? "",
      backdropUrl: latest.backdropUrl ?? media.backdropUrl ?? "",
      trailerUrl: latest.trailerUrl ?? media.trailerUrl ?? "",
      genres: latest.genres || media.genres || [],
      platforms: latest.platforms || media.platforms || [],
      runtime:
        latest.runtime !== undefined && latest.runtime !== null
          ? Number(latest.runtime)
          : media.runtime ?? null,
      numberOfSeasons:
        latest.numberOfSeasons !== undefined && latest.numberOfSeasons !== null
          ? Number(latest.numberOfSeasons)
          : media.numberOfSeasons ?? null,
      numberOfEpisodes:
        latest.numberOfEpisodes !== undefined && latest.numberOfEpisodes !== null
          ? Number(latest.numberOfEpisodes)
          : media.numberOfEpisodes ?? null,
      director: latest.director ?? media.director ?? "",
      creators: latest.creators || media.creators || [],
      cast: latest.cast || media.cast || [],
      castDetails: latest.castDetails || (media as any).castDetails || [],
      tmdbRating:
        latest.tmdbRating !== undefined && latest.tmdbRating !== null
          ? Number(latest.tmdbRating)
          : media.tmdbRating ?? null,
      imdbRating:
        latest.imdbRating !== undefined && latest.imdbRating !== null
          ? Number(latest.imdbRating)
          : media.imdbRating ?? null,
      metadataSyncedAt: serverTimestamp(),
    });

    await updateDoc(doc(db, "mediaItems", media.id), syncedPatch);

    const syncedMedia = {
      ...media,
      ...syncedPatch,
      metadataSyncedAt: new Date().toISOString(),
    } as MediaItem;

    setItem(syncedMedia);

    return syncedMedia;
  };

  const loadTvSeasons = async (media: MediaItem) => {
    if (!media.tmdbId || media.type !== "TV") return;

    try {
      const data = await postJson<{
        success: boolean;
        data: MediaDetailsResponse;
        message?: string;
      }>("/api/media/details-ai", {
        tmdbId: media.tmdbId,
        type: "TV",
      });

      if (!data.success) return;

      const latest = data.data;
      const seasonList = latest.seasons || [];
      setSeasons(seasonList);

      const syncedMedia = await syncLatestTvMetadata(media, latest);

      const firstSeason =
        syncedMedia.currentSeason || seasonList[0]?.seasonNumber || 1;
      setSelectedSeasonNumber(firstSeason);
      await loadSeason(media.tmdbId, firstSeason);
    } catch (err) {
      console.error("Dizi sezon listesi alınamadı:", err);
    }
  };

  const refreshActorMetadata = async (media: MediaItem, options?: { force?: boolean }) => {
    if (!media.id || !media.tmdbId) return;

    const currentCastDetails = normalizeCastDetails((media as any).castDetails);

    if (!options?.force && currentCastDetails.length >= 24) {
      return;
    }

    setRefreshingActors(true);

    try {
      const data = await postJson<{
        success: boolean;
        data: MediaDetailsResponse;
        message?: string;
      }>("/api/media/details-ai", {
        tmdbId: media.tmdbId,
        type: media.type,
      });

      if (!data.success) return;

      const latest = data.data;
      const latestCastDetails = normalizeCastDetails(latest.castDetails);

      if (latestCastDetails.length === 0) return;

      const shouldUpdate =
        options?.force || latestCastDetails.length > currentCastDetails.length;

      if (!shouldUpdate) return;

      const patch = removeUndefinedDeep({
        cast: getCastNames(latest.cast, latestCastDetails),
        castDetails: latestCastDetails,
        metadataSyncedAt: serverTimestamp(),
      });

      await updateDoc(doc(db, "mediaItems", media.id), patch);

      setItem((prev) =>
        prev
          ? ({
              ...prev,
              ...patch,
              metadataSyncedAt: new Date().toISOString(),
            } as MediaItem)
          : prev
      );

      if (options?.force) {
        showToast("success", `${latestCastDetails.length} kişilik oyuncu kadrosu güncellendi.`);
      }
    } catch (err: any) {
      console.warn("Oyuncu görselleri güncellenemedi:", err);
      if (options?.force) {
        showToast("error", err?.message || "Oyuncu kadrosu güncellenirken hata oluştu.");
      }
    } finally {
      setRefreshingActors(false);
    }
  };

  const syncMissingActorMetadata = async (media: MediaItem) => {
    await refreshActorMetadata(media, { force: false });
  };

  const markMediaViewed = async (media: MediaItem) => {
    if (!media.id) return;

    const viewedAt = new Date().toISOString();

    setItem((prev) =>
      prev
        ? ({
            ...prev,
            lastViewedAt: viewedAt,
          } as MediaItem)
        : prev
    );

    try {
      await updateDoc(doc(db, "mediaItems", media.id), {
        lastViewedAt: serverTimestamp(),
      });
    } catch (err) {
      console.warn("Son görüntüleme tarihi güncellenemedi:", err);
    }
  };

  const loadMedia = async () => {
    if (!user || !id) return;

    setLoading(true);
    setError(null);

    try {
      const ref = doc(db, "mediaItems", id);
      const snap = await getDoc(ref);

      if (!snap.exists()) {
        setError("Bu film/dizi kaydı bulunamadı.");
        return;
      }

      const data = {
        id: snap.id,
        ...(snap.data() as Omit<MediaItem, "id">),
      };

      if (data.userId !== user.uid) {
        setError("Bu kaydı görüntüleme yetkin yok.");
        return;
      }

      setItem(data);
      void markMediaViewed(data);
      void syncMissingActorMetadata(data);
      setStatus(data.status || "IZLENECEK");
      setWatchedMinutes(
        data.watchedMinutes !== undefined && data.watchedMinutes !== null
          ? String(data.watchedMinutes)
          : ""
      );
      setUserRating(
        typeof data.userRating === "number" && Number.isFinite(data.userRating)
          ? data.userRating
          : undefined
      );
      setExpectedRating(
        typeof data.expectedRating === "number" && Number.isFinite(data.expectedRating)
          ? data.expectedRating
          : undefined
      );
      setProgressRating(
        typeof (data as any).progressRating === "number" && Number.isFinite((data as any).progressRating)
          ? (data as any).progressRating
          : undefined
      );
      setNotes(data.notes || "");
      const savedShelfIds = Array.isArray((data as any).shelfIds)
        ? (data as any).shelfIds.map((id: any) => String(id || "")).filter(Boolean)
        : [];
      if ((data as any).isFavorite && !savedShelfIds.includes("favorite")) {
        savedShelfIds.unshift("favorite");
      }
      setSelectedShelfIds(savedShelfIds);
      setWatchDate(toInputDate(data.watchedAt || data.completedAt || data.startedAt));

      const watchedMap: Record<string, TvEpisode> = {};
      const keys = new Set<string>();

      (data.watchedEpisodes || []).forEach((episode: any) => {
        const key = episodeKey(episode.seasonNumber, episode.episodeNumber);
        watchedMap[key] = {
          seasonNumber: episode.seasonNumber,
          episodeNumber: episode.episodeNumber,
          title: episode.title || `Bölüm ${episode.episodeNumber}`,
          overview: episode.overview || "",
          airDate: episode.airDate || null,
          runtime: episode.runtime || null,
          stillUrl: episode.stillUrl || null,
          tmdbRating: episode.tmdbRating || null,
          watchedAt: episode.watchedAt || data.lastWatchedAt || data.watchedAt || data.completedAt || null,
        };
        keys.add(key);
      });

      setWatchedEpisodes(watchedMap);
      setOriginalWatchedEpisodes(watchedMap);
      setOriginalWatchedKeys(keys);
      setStatusResetUnlocked(false);

      if (data.type === "TV") {
        await loadTvSeasons(data);
      }
    } catch (err: any) {
      console.error("Medya detayı alınamadı:", err);
      setError(err?.message || "Medya detayı alınırken hata oluştu.");
      showToast("error", err?.message || "Medya detayı alınırken hata oluştu.");
    } finally {
      setLoading(false);
    }
  };

  const toggleEpisodeWatched = (episode: TvEpisode) => {
    if (!episodeTrackingEnabled) return;

    const key = episodeKey(episode.seasonNumber, episode.episodeNumber);

    setWatchedEpisodes((prev) => {
      const copy = { ...prev };

      if (copy[key]) {
        delete copy[key];
      } else {
        copy[key] = {
          ...episode,
          watchedAt: watchDate || todayInputValue(),
        };
      }

      return copy;
    });
  };

  const markCurrentSeason = () => {
    if (!seasonDetails || !episodeTrackingEnabled) return;

    setWatchedEpisodes((prev) => {
      const copy = { ...prev };

      seasonDetails.episodes.forEach((episode) => {
        copy[episodeKey(episode.seasonNumber, episode.episodeNumber)] = {
          ...episode,
          watchedAt: watchDate || todayInputValue(),
        };
      });

      return copy;
    });
  };

  const clearCurrentSeason = () => {
    if (!seasonDetails || !episodeTrackingEnabled) return;

    setWatchedEpisodes((prev) => {
      const copy = { ...prev };

      seasonDetails.episodes.forEach((episode) => {
        delete copy[episodeKey(episode.seasonNumber, episode.episodeNumber)];
      });

      return copy;
    });
  };

  const clearAllEpisodes = () => {
    if (!episodeTrackingEnabled) return;
    setWatchedEpisodes({});
  };

  const addLogsForNewEpisodes = async (mediaId: string, media: MediaItem, newEpisodes: TvEpisode[]) => {
    if (!user) return;

    for (const episode of newEpisodes) {
      const cleanLog = removeUndefinedDeep({
        userId: user.uid,
        mediaId,
        mediaType: "TV",
        title: media.title,

        date: watchDate,
        monthKey: getMonthKey(watchDate),

        minutes: Number(episode.runtime || media.runtime || 0) || 0,
        completed: true,

        seasonNumber: episode.seasonNumber,
        episodeNumber: episode.episodeNumber,
        episodeTitle: episode.title,

        genres: media.genres || [],
        platform: media.platforms?.[0] || "",
      });

      await addDoc(collection(db, "watchLogs"), {
        ...cleanLog,
        createdAt: serverTimestamp(),
      });
    }
  };

  const removeLogsForRemovedEpisodes = async (mediaId: string, removedKeys: Set<string>) => {
    if (!user || removedKeys.size === 0) return;

    const logsQuery = query(
      collection(db, "watchLogs"),
      where("userId", "==", user.uid),
      where("mediaId", "==", mediaId)
    );

    const snapshot = await getDocs(logsQuery);

    const deletes = snapshot.docs
      .filter((document) => {
        const data = document.data();
        const key = episodeKey(Number(data.seasonNumber || 0), Number(data.episodeNumber || 0));
        return data.mediaType === "TV" && removedKeys.has(key);
      })
      .map((document) => deleteDoc(document.ref));

    await Promise.all(deletes);
  };

  const addMovieLogIfNeeded = async (mediaId: string, media: MediaItem) => {
    if (!user) return;

    const previousStatus = item?.status;
    const previousMinutes = Number(item?.watchedMinutes || 0);
    const nextMinutes =
      status === "IZLENDI"
        ? Number(media.runtime || 0)
        : status === "IZLENIYOR"
        ? Number(watchedMinutes || 0)
        : 0;

    const shouldCreateLog =
      status === "IZLENDI"
        ? previousStatus !== "IZLENDI"
        : status === "IZLENIYOR" && nextMinutes > previousMinutes;

    if (!shouldCreateLog || nextMinutes <= 0) return;

    const cleanLog = removeUndefinedDeep({
      userId: user.uid,
      mediaId,
      mediaType: "MOVIE",
      title: media.title,

      date: watchDate,
      monthKey: getMonthKey(watchDate),

      minutes: nextMinutes,
      completed: status === "IZLENDI",

      seasonNumber: null,
      episodeNumber: null,

      genres: media.genres || [],
      platform: media.platforms?.[0] || "",
    });

    await addDoc(collection(db, "watchLogs"), {
      ...cleanLog,
      createdAt: serverTimestamp(),
    });
  };

  const handleSave = async () => {
    if (!item || !item.id) return;

    if (item.type === "MOVIE" && status === "IZLENIYOR") {
      const watched = Number(watchedMinutes || 0);
      const runtime = Number(item.runtime || 0);

      if (!watched || watched <= 0) {
        showToast("error", "İzleniyor durumunda kaçıncı dakikada kaldığını yazmalısın.");
        return;
      }

      if (runtime && watched > runtime) {
        showToast("error", "İzlenen dakika toplam süreden büyük olamaz.");
        return;
      }
    }

    if (item.type === "TV" && episodeTrackingEnabled && watchedEpisodeList.length === 0) {
      showToast("error", "Dizi için izlediğin bölümleri seçmelisin.");
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const mediaRef = doc(db, "mediaItems", item.id);

      const currentKeys = new Set(
        watchedEpisodeList.map((episode) => episodeKey(episode.seasonNumber, episode.episodeNumber))
      );

      const newEpisodes = watchedEpisodeList.filter(
        (episode) => !originalWatchedKeys.has(episodeKey(episode.seasonNumber, episode.episodeNumber))
      );

      const removedKeys = new Set<string>();
      originalWatchedKeys.forEach((key) => {
        if (!currentKeys.has(key)) removedKeys.add(key);
      });

      const removedEpisodes = Array.from(removedKeys)
        .map((key) => originalWatchedEpisodes[key])
        .filter(Boolean);

      const nextWatchedMinutes =
        item.type === "MOVIE"
          ? status === "IZLENDI"
            ? Number(item.runtime || 0) || null
            : status === "IZLENIYOR"
            ? Number(watchedMinutes || 0) || null
            : null
          : null;

      const actionAtIso = new Date().toISOString();

      const actionDetails = buildActionDetails({
        media: item,
        previousStatus: item.status,
        nextStatus: status,
        previousWatchedMinutes: Number(item.watchedMinutes || 0) || undefined,
        nextWatchedMinutes: nextWatchedMinutes || undefined,
        previousExpectedRating: numberOrUndefined(item.expectedRating),
        nextExpectedRating: expectedRating,
        previousProgressRating: numberOrUndefined((item as any).progressRating),
        nextProgressRating: progressRating,
        previousUserRating: numberOrUndefined(item.userRating),
        nextUserRating: userRating,
        previousNotes: item.notes || "",
        nextNotes: notes,
        newEpisodes,
        removedEpisodes,
        watchDate,
        actionDate: actionAtIso,
      });

      const previousShelfIds = Array.isArray((item as any).shelfIds)
        ? (item as any).shelfIds.map((id: any) => String(id || "")).filter(Boolean)
        : [];
      if ((item as any).isFavorite && !previousShelfIds.includes("favorite")) {
        previousShelfIds.unshift("favorite");
      }
      const nextShelfNames = selectedShelves.map((shelf) => shelf.name);
      const shelfChanged =
        previousShelfIds.length !== selectedShelfIds.length ||
        previousShelfIds.some((id: string) => !selectedShelfIds.includes(id));

      if (shelfChanged) {
        actionDetails.push(
          nextShelfNames.length > 0
            ? `Raflar ${nextShelfNames.join(", ")} olarak güncellendi.`
            : "Tüm raf seçimleri kaldırıldı."
        );
      }

      const actionText = summarizeAction(actionDetails);
      const actionRecord = {
        at: actionAtIso,
        title: actionText,
        description: actionDetails.join(" "),
        details: actionDetails,
      };
      const nextActionHistory = [actionRecord, ...normalizeActionHistory((item as any).actionHistory)].slice(0, 20);

      const updatePayload = removeUndefinedDeep({
        status,

        watchedMinutes: nextWatchedMinutes,

        currentSeason:
          item.type === "TV" && lastWatchedEpisode ? lastWatchedEpisode.seasonNumber : null,

        currentEpisode:
          item.type === "TV" && lastWatchedEpisode ? lastWatchedEpisode.episodeNumber : null,

        watchedEpisodes:
          item.type === "TV"
            ? watchedEpisodeList.map((episode) => ({
                seasonNumber: episode.seasonNumber,
                episodeNumber: episode.episodeNumber,
                title: episode.title,
                overview: episode.overview || "",
                airDate: episode.airDate || null,
                runtime: episode.runtime || null,
                stillUrl: episode.stillUrl || null,
                tmdbRating: episode.tmdbRating || null,
                watchedAt: episode.watchedAt || watchDate,
              }))
            : [],

        watchedEpisodeCount: item.type === "TV" ? watchedEpisodeList.length : null,

        userRating: typeof userRating === "number" ? userRating : null,
        expectedRating: typeof expectedRating === "number" ? expectedRating : null,
        progressRating: typeof progressRating === "number" ? progressRating : null,
        overallRating: typeof overallRating === "number" ? overallRating : null,
        notes: notes.trim() || null,

        startedAt: dateFieldsEnabled ? watchDate : null,
        watchedAt: status === "IZLENDI" ? watchDate : null,
        completedAt: status === "IZLENDI" ? watchDate : null,
        lastWatchedAt: dateFieldsEnabled ? watchDate : null,
        lastWatchedEpisode:
          item.type === "TV" && lastWatchedEpisode
            ? {
                seasonNumber: lastWatchedEpisode.seasonNumber,
                episodeNumber: lastWatchedEpisode.episodeNumber,
                title: lastWatchedEpisode.title,
                watchedAt: lastWatchedEpisode.watchedAt || watchDate,
              }
            : null,
        shelves: selectedShelves.map((shelf) => shelf.name),
        shelfIds: selectedShelfIds,
        isFavorite,
        favoriteShelf: isFavorite ? "Favoriler" : selectedShelves[0]?.name || null,
        favoriteAddedAt:
          isFavorite
            ? ((item as any).favoriteAddedAt || actionAtIso)
            : null,
        lastActionAt: serverTimestamp(),
        lastManualUpdateAt: serverTimestamp(),
        lastActionText: actionText,
        lastActionDetails: actionDetails,
        actionHistory: nextActionHistory,

        updatedAt: serverTimestamp(),
      });

      await updateDoc(mediaRef, updatePayload);

      if (item.type === "TV") {
        await addLogsForNewEpisodes(item.id, item, newEpisodes);
        await removeLogsForRemovedEpisodes(item.id, removedKeys);
      } else {
        await addMovieLogIfNeeded(item.id, item);
      }

      const nextOriginalKeys = new Set(
        watchedEpisodeList.map((episode) => episodeKey(episode.seasonNumber, episode.episodeNumber))
      );

      setOriginalWatchedKeys(nextOriginalKeys);
      setOriginalWatchedEpisodes(watchedEpisodes);
      setStatusResetUnlocked(false);
      setItem((prev) =>
        prev
          ? ({
              ...prev,
              ...updatePayload,
              updatedAt: actionAtIso,
              lastManualUpdateAt: actionAtIso,
              lastActionAt: actionAtIso,
              lastActionText: actionText,
              lastActionDetails: actionDetails,
              actionHistory: nextActionHistory,
              shelves: selectedShelves.map((shelf) => shelf.name),
              shelfIds: selectedShelfIds,
              isFavorite,
              favoriteShelf: isFavorite ? "Favoriler" : selectedShelves[0]?.name || null,
              favoriteAddedAt: isFavorite ? ((prev as any).favoriteAddedAt || actionAtIso) : null,
              lastWatchedAt: dateFieldsEnabled ? watchDate : (prev as any).lastWatchedAt,
            } as MediaItem)
          : prev
      );

      showToast("success", "Medya kaydı güncellendi.");
    } catch (err: any) {
      console.error("Medya güncelleme hatası:", err);
      setError(err?.message || "Medya kaydı güncellenirken hata oluştu.");
      showToast("error", err?.message || "Medya kaydı güncellenirken hata oluştu.");
    } finally {
      setSaving(false);
    }
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
        const shelfQuery = query(collection(db, "mediaShelves"), where("userId", "==", user.uid));
        const snapshot = await getDocs(shelfQuery);
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

  useEffect(() => {
    void loadMedia();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, user?.uid]);

  useEffect(() => {
    if (!item) return;
    const savedShelfIds = Array.isArray((item as any).shelfIds)
      ? (item as any).shelfIds.map((id: any) => String(id || "")).filter(Boolean)
      : [];
    if (savedShelfIds.length > 0) return;

    const savedShelfNames = Array.isArray((item as any).shelves)
      ? (item as any).shelves.map((name: any) => String(name || "").trim()).filter(Boolean)
      : [];

    const mappedIds = shelves
      .filter((shelf) =>
        savedShelfNames.some((name: string) => name.toLocaleLowerCase("tr-TR") === shelf.name.toLocaleLowerCase("tr-TR"))
      )
      .map((shelf) => shelf.id);

    if ((item as any).isFavorite && !mappedIds.includes("favorite")) {
      mappedIds.unshift("favorite");
    }

    if (mappedIds.length > 0) {
      setSelectedShelfIds(mappedIds);
    }
  }, [item?.id, shelves]);

  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <div className="inline-flex items-center gap-2 text-sm text-slate-500">
          <Loader2 className="h-4 w-4 animate-spin" />
          Detaylar yükleniyor...
        </div>
      </div>
    );
  }

  if (!item) {
    return (
      <div className="max-w-5xl mx-auto py-10">
        <div className="rounded-3xl border border-rose-100/70 bg-white/80 p-8 text-center shadow-sm dark:border-slate-800 dark:bg-slate-900/80">
          <AlertCircle className="mx-auto mb-3 h-8 w-8 text-rose-500" />
          <p className="mb-2 text-lg font-medium">Medya kaydı bulunamadı.</p>
          <button
            type="button"
            onClick={() => navigate("/media")}
            className="inline-flex items-center justify-center rounded-full bg-slate-900 px-4 py-2 text-sm font-medium text-slate-50 transition hover:bg-slate-700 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-white"
          >
            Medya kütüphanesine dön
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <ToastBar toast={toast} onClose={() => setToast(null)} />

      {previewImage ? (
        <div className="fixed inset-0 z-[120] flex items-center justify-center bg-slate-950/90 p-3 backdrop-blur-md sm:p-6">
          <button
            type="button"
            aria-label="Önizlemeyi kapat"
            className="absolute inset-0"
            onClick={() => setPreviewImage(null)}
          />

          <div className="relative flex max-h-[94vh] w-full max-w-6xl flex-col overflow-hidden rounded-[2rem] border border-white/10 bg-slate-950 shadow-2xl ring-1 ring-white/10">
            <button
              type="button"
              onClick={() => setPreviewImage(null)}
              className="absolute right-3 top-3 z-10 inline-flex h-10 w-10 items-center justify-center rounded-full bg-white/95 text-slate-950 shadow-lg transition hover:scale-105 hover:bg-white"
            >
              <X className="h-5 w-5" />
            </button>

            <div className="flex min-h-0 flex-1 items-center justify-center bg-[radial-gradient(circle_at_center,#111827_0%,#020617_70%)]">
              <img
                src={previewImage.src}
                alt={previewImage.title}
                className="max-h-[82vh] w-full object-contain drop-shadow-2xl"
              />
            </div>

            <div className="border-t border-white/10 bg-slate-950/95 px-5 py-4">
              <p className="text-sm font-black text-white">{previewImage.title}</p>
              {previewImage.subtitle ? (
                <p className="mt-1 text-xs text-slate-400">{previewImage.subtitle}</p>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}

      <section className="relative overflow-hidden rounded-[2rem] border border-slate-200 bg-slate-50 shadow-sm dark:border-slate-800 dark:bg-slate-950">
        {item.backdropUrl ? (
          <img
            src={item.backdropUrl}
            alt=""
            aria-hidden="true"
            className="absolute inset-0 h-full w-full object-cover opacity-20 dark:opacity-25"
          />
        ) : null}

        <div className="absolute inset-0 bg-gradient-to-br from-white/90 via-slate-50/85 to-slate-100/90 dark:from-slate-950/95 dark:via-slate-950/90 dark:to-slate-900/95" />

        <div className="relative z-10 px-4 py-5 sm:px-5 md:px-6">
          <Link
            to="/media"
            className="inline-flex items-center gap-2 text-xs font-semibold text-slate-500 transition hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
          >
            <ArrowLeft className="h-4 w-4" />
            Film & dizilerime dön
          </Link>

          <div className="mt-5 grid grid-cols-1 gap-6 md:grid-cols-[170px_minmax(0,1fr)] lg:grid-cols-[190px_minmax(0,1fr)] md:items-start">
            <div className="flex min-w-0 flex-col items-center gap-3 md:items-start">
              <div className="relative flex h-60 w-40 shrink-0 items-center justify-center overflow-hidden rounded-2xl border-4 border-white/90 bg-slate-200 shadow-md dark:border-slate-900 dark:bg-slate-800 sm:h-64 sm:w-44 md:h-[255px] md:w-[170px] lg:h-[285px] lg:w-[190px]">
                {item.posterUrl ? (
                  <img
                    src={item.posterUrl}
                    alt={item.title}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="flex h-full w-full flex-col items-center justify-center gap-2 text-slate-400">
                    {item.type === "TV" ? <Tv className="h-8 w-8" /> : <Film className="h-8 w-8" />}
                    <span className="text-xs font-medium">Poster yok</span>
                  </div>
                )}
              </div>

              {item.trailerUrl ? (
                <a
                  href={item.trailerUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex w-40 items-center justify-center gap-2 rounded-xl bg-slate-900 px-3 py-2 text-xs font-semibold text-white shadow-sm transition hover:brightness-110 dark:bg-slate-100 dark:text-slate-900 sm:w-44 md:w-[170px] lg:w-[190px]"
                >
                  <Play className="h-3.5 w-3.5" />
                  Fragman
                  <ExternalLink className="h-3 w-3" />
                </a>
              ) : null}
            </div>

            <div className="min-w-0 space-y-4 overflow-hidden">
              <div className="flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center gap-1 rounded-full bg-white/90 px-3 py-1 text-[11px] font-semibold text-slate-700 shadow-sm ring-1 ring-slate-200 dark:bg-slate-900 dark:text-slate-200 dark:ring-slate-800">
                  {item.type === "TV" ? <Tv className="h-3.5 w-3.5" /> : <Film className="h-3.5 w-3.5" />}
                  {mediaTypeLabel(item.type)}
                </span>

                <span className={`inline-flex items-center gap-1 rounded-full border px-3 py-1 text-[11px] font-semibold shadow-sm ${getStatusBadgeClass(status)}`}>
                  {statusLabel(status)}
                </span>

                {item.year ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-white/90 px-3 py-1 text-[11px] font-semibold text-slate-600 shadow-sm ring-1 ring-slate-200 dark:bg-slate-900 dark:text-slate-300 dark:ring-slate-800">
                    <CalendarDays className="h-3.5 w-3.5" />
                    {item.year}
                  </span>
                ) : null}

                {item.tmdbRating ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-3 py-1 text-[11px] font-semibold text-amber-700 shadow-sm ring-1 ring-amber-100 dark:bg-amber-900/20 dark:text-amber-200 dark:ring-amber-900/50">
                    <Star className="h-3.5 w-3.5 fill-current" />
                    TMDb {item.tmdbRating}/10
                  </span>
                ) : null}
              </div>

              <div className="max-w-4xl min-w-0">
                <h1 className="break-words text-2xl font-semibold leading-tight tracking-tight text-slate-900 dark:text-slate-50 md:text-3xl lg:text-4xl">
                  {item.title}
                </h1>

                {item.originalTitle && item.originalTitle !== item.title ? (
                  <p className="mt-1 break-words text-sm text-slate-500 dark:text-slate-400">
                    {item.originalTitle}
                  </p>
                ) : null}
              </div>

              {item.overview ? (
                <p className="max-w-4xl break-words text-sm leading-6 text-slate-600 dark:text-slate-400">
                  {item.overview}
                </p>
              ) : null}

              <div className="flex max-w-4xl flex-wrap gap-2">
                {(item.genres || []).map((genre) => (
                  <span
                    key={genre}
                    className="rounded-full bg-white px-2.5 py-1 text-[11px] font-medium text-slate-600 shadow-sm ring-1 ring-slate-200 dark:bg-slate-900 dark:text-slate-300 dark:ring-slate-800"
                  >
                    {genre}
                  </span>
                ))}
              </div>

              <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">İlerleme</p>
                  <p className="mt-1 font-bold text-slate-900 dark:text-slate-50">{progress.percent}%</p>
                </div>

                <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">
                    {item.type === "TV" ? "Bölüm" : "Süre"}
                  </p>
                  <p className="mt-1 font-bold text-slate-900 dark:text-slate-50">
                    {item.type === "TV"
                      ? `${watchedEpisodeList.length}/${item.numberOfEpisodes || 0}`
                      : item.runtime
                      ? `${item.runtime} dk`
                      : "Bilinmiyor"}
                  </p>
                </div>

                <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">Genel puan</p>
                  <div className="mt-1 flex items-center justify-between gap-2">
                    <RatingStars value={overallRating} size="h-3.5 w-3.5" />
                    <span className="text-sm font-black text-slate-900 dark:text-slate-50">
                      {overallRating ? `${overallRating}/5` : "-"}
                    </span>
                  </div>
                </div>

                <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">Tarih</p>
                  <p className="mt-1 font-bold text-slate-900 dark:text-slate-50">{dateFieldsEnabled ? formatDate(watchDate) : "-"}</p>
                </div>
              </div>

              <div className="max-w-4xl rounded-2xl border border-slate-200 bg-white p-3 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                <div className="rounded-full bg-slate-200/70 p-1 dark:bg-slate-800">
                  <div
                    className="h-2 rounded-full bg-gradient-to-r from-indigo-500 to-purple-500 transition-all"
                    style={{ width: `${Math.min(100, Math.max(0, progress.percent))}%` }}
                  />
                </div>
                <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">{progress.label}{progress.sub ? ` • ${progress.sub}` : ""}</p>
              </div>

              <div className="grid max-w-4xl grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-5">
                <div className="rounded-2xl border border-slate-200 bg-white px-3 py-2 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                  <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-400">Ekleme tarihi</p>
                  <p className="mt-1 text-xs font-bold text-slate-700 dark:text-slate-200">{createdDateText}</p>
                </div>

                <div className="rounded-2xl border border-slate-200 bg-white px-3 py-2 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                  <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-400">Son görüntüleme</p>
                  <p className="mt-1 text-xs font-bold text-slate-700 dark:text-slate-200">{lastViewedDateText}</p>
                </div>

                <div className="rounded-2xl border border-slate-200 bg-white px-3 py-2 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                  <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-400">Son kayıt güncellemesi</p>
                  <p className="mt-1 text-xs font-bold text-slate-700 dark:text-slate-200">{updatedDateText}</p>
                </div>

                <div className="rounded-2xl border border-slate-200 bg-white px-3 py-2 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                  <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-400">Son işlem tarihi</p>
                  <p className="mt-1 text-xs font-bold text-slate-700 dark:text-slate-200">{lastActionDateText}</p>
                </div>

                <div className="rounded-2xl border border-slate-200 bg-white px-3 py-2 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                  <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-400">Son izleme tarihi</p>
                  <p className="mt-1 text-xs font-bold text-slate-700 dark:text-slate-200">{lastWatchedEpisodeDateText}</p>
                </div>
              </div>

              <div className="grid max-w-4xl grid-cols-1 gap-3 xl:grid-cols-[1fr_1.1fr]">
                <div className="rounded-2xl border border-indigo-100 bg-indigo-50 px-4 py-3 shadow-sm dark:border-indigo-900/60 dark:bg-indigo-950/30">
                  <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-indigo-700 dark:text-indigo-200">En son izlenen içerik</p>
                  <p className="mt-1 text-sm font-black text-indigo-950 dark:text-indigo-100">{lastWatchedEpisodeText}</p>
                  <p className="mt-1 text-[11px] font-semibold text-indigo-700/80 dark:text-indigo-200/80">{lastWatchedEpisodeDateText}</p>
                </div>

                <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                  <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-400">Son işlem açıklaması</p>
                  <p className="mt-1 text-sm font-black text-slate-900 dark:text-slate-50">{formatStoredActionText(lastActionText, (item as any)?.lastActionAt)}</p>
                  {lastActionDetails.length > 0 ? (
                    <ul className="mt-2 space-y-1 text-[11px] font-medium text-slate-500 dark:text-slate-400">
                      {lastActionDetails.slice(0, 3).map((detail, index) => (
                        <li key={`${detail}-${index}`} className="flex gap-1.5">
                          <span className="mt-1 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-indigo-400" />
                          <span>{formatStoredActionText(detail, (item as any)?.lastActionAt)}</span>
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {error ? (
        <div className="flex items-start gap-2 rounded-2xl border border-rose-100/70 bg-rose-50/80 px-4 py-3 text-sm text-rose-700 dark:border-rose-900/70 dark:bg-rose-950/30 dark:text-rose-200">
          <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0" />
          <span>{error}</span>
        </div>
      ) : null}

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[420px_minmax(0,1fr)]">
        <form
          onSubmit={(event) => {
            event.preventDefault();
            void handleSave();
          }}
          className="space-y-5 rounded-[2rem] border border-slate-200 bg-white px-4 py-5 shadow-sm dark:border-slate-800 dark:bg-slate-950 sm:px-5 xl:sticky xl:top-5 xl:col-span-1 xl:self-start"
        >
          <div>
            <h2 className="flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-slate-50">
              <span className="inline-flex h-7 w-7 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <Sparkles className="h-4 w-4" />
              </span>
              İzleme bilgilerini güncelle
            </h2>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              Duruma göre ilgili alanlar otomatik aktifleşir.
            </p>
          </div>

          <div className="rounded-3xl border border-slate-200 bg-slate-50 p-3 dark:border-slate-800 dark:bg-slate-900">
            <div className="flex items-start justify-between gap-3">
              <div>
                <label className="block text-xs font-bold uppercase tracking-[0.14em] text-slate-400">İzleme durumu</label>
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                  Tamamlanmış kayıtlar güvenlik için kilitlenir; değiştirmek için önce sıfırlama kullanılır.
                </p>
              </div>

              {isStatusLockedByCompletion ? (
                <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[10px] font-black text-emerald-700 dark:border-emerald-800 dark:bg-emerald-900/20 dark:text-emerald-200">
                  Kilitli
                </span>
              ) : null}
            </div>

            <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4 xl:grid-cols-2">
              {(["IZLENECEK", "IZLENIYOR", "IZLENDI", "BIRAKILDI"] as WatchStatus[]).map((statusOption) => {
                const disabled = isStatusLockedByCompletion && statusOption !== "IZLENDI";

                return (
                  <button
                    key={statusOption}
                    type="button"
                    disabled={disabled}
                    onClick={() => void handleStatusSelect(statusOption)}
                    className={`rounded-2xl border px-3 py-3 text-xs font-black transition disabled:cursor-not-allowed disabled:opacity-45 ${
                      status === statusOption
                        ? "border-primary bg-primary text-white shadow-sm"
                        : "border-slate-200 bg-white text-slate-600 hover:-translate-y-0.5 hover:border-primary/40 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900/80 dark:text-slate-200"
                    }`}
                  >
                    {statusLabel(statusOption)}
                  </button>
                );
              })}
            </div>

            {isPersistedCompleted ? (
              <button
                type="button"
                onClick={resetStatusFlow}
                className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-black text-rose-700 transition hover:bg-rose-100 dark:border-rose-900/70 dark:bg-rose-950/30 dark:text-rose-200"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                Durumu sıfırla
              </button>
            ) : null}
          </div>

          <div className="space-y-1.5">
            <label className="block text-xs font-medium text-slate-600 dark:text-slate-300">İzleme tarihi</label>
            <div className="relative">
              <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
                <CalendarDays className="h-3.5 w-3.5" />
              </span>
              <input
                type="date"
                value={watchDate}
                disabled={!dateFieldsEnabled}
                onClick={(event) => (event.currentTarget as HTMLInputElement & { showPicker?: () => void }).showPicker?.()}
                onFocus={(event) => (event.currentTarget as HTMLInputElement & { showPicker?: () => void }).showPicker?.()}
                onChange={(event) => setWatchDate(event.target.value)}
                className="w-full cursor-pointer rounded-lg border border-slate-200 bg-white px-8 py-2 text-sm text-slate-900 shadow-sm outline-none transition focus:border-primary/60 focus:ring-2 focus:ring-primary/30 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-700 dark:bg-slate-900/80 dark:text-slate-50"
              />
            </div>
            {!dateFieldsEnabled ? (
              <p className="text-[11px] text-slate-400">Tarih alanı yalnızca izleniyor veya izlendi durumlarında aktiftir.</p>
            ) : null}
          </div>

          {item.type === "MOVIE" ? (
            <div className="space-y-1.5">
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-300">Filmde kaldığın dakika</label>
              <div className="relative">
                <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
                  <Clock className="h-3.5 w-3.5" />
                </span>
                <input
                  type="number"
                  min={0}
                  max={item.runtime || undefined}
                  value={watchedMinutes}
                  disabled={!movieMinuteEnabled}
                  onChange={(event) => setWatchedMinutes(event.target.value)}
                  placeholder={status === "IZLENDI" ? "Tamamı izlendi" : "Örn: 63"}
                  className="w-full rounded-lg border border-slate-200 bg-white px-8 py-2 text-sm text-slate-900 shadow-sm outline-none transition focus:border-primary/60 focus:ring-2 focus:ring-primary/30 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-700 dark:bg-slate-900/80 dark:text-slate-50"
                />
              </div>
              <p className="text-[11px] text-slate-400">
                Dakika alanı sadece “İzleniyor” durumunda kullanılır. “İzlendi” seçilirse film tamamlandı kabul edilir.
              </p>
            </div>
          ) : null}

          <div className="space-y-3 rounded-3xl border border-slate-200 bg-slate-50 p-3 dark:border-slate-800 dark:bg-slate-900">
            <div>
              <p className="text-sm font-semibold text-slate-900 dark:text-slate-50">Duruma göre puanlama</p>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                İzlenecek durumda beklenti, izleniyorsa ara değerlendirme, izlendiğinde final genel puan kullanılır.
              </p>
            </div>

            <StarRating value={activeRating} onChange={setActiveRating} label={ratingTitle} />

            <p className="text-[11px] text-slate-400">{ratingDescription}</p>

            <div className="grid grid-cols-1 gap-2 sm:grid-cols-3 xl:grid-cols-1">
              <RatingMetric label="Beklenti" value={expectedRating} />
              <RatingMetric label="Ara puan" value={progressRating} />
              <RatingMetric label="Final" value={userRating} />
            </div>

            <div className="rounded-2xl border border-indigo-100 bg-indigo-50 px-3 py-2 dark:border-indigo-900/70 dark:bg-indigo-950/40">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-indigo-700 dark:text-indigo-200">Genel puan sonucu</p>
                  <p className="mt-0.5 text-[11px] text-indigo-700/80 dark:text-indigo-100/80">
                    Girilmiş puanların ortalamasıyla hesaplanır.
                  </p>
                </div>
                <div className="text-right">
                  <RatingStars value={overallRating} />
                  <p className="mt-1 text-xs font-black text-indigo-900 dark:text-indigo-100">
                    {overallRating ? `${overallRating}/5` : "Henüz yok"}
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="rounded-3xl border border-slate-200 bg-slate-50 p-3 dark:border-slate-800 dark:bg-slate-900">
            <div className="mb-3 flex items-start justify-between gap-3">
              <div>
                <h3 className="flex items-center gap-2 text-sm font-black text-slate-900 dark:text-slate-50">
                  <span className="inline-flex h-7 w-7 items-center justify-center rounded-xl bg-rose-500/10 text-rose-500">
                    <Layers className="h-4 w-4" />
                  </span>
                  Raflar
                </h3>
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                  Bu içeriği favori veya özel raflarına ekleyip yönetebilirsin.
                </p>
              </div>

              <span className="rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-black text-slate-500 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-300">
                {selectedShelves.length} seçili
              </span>
            </div>

            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-1">
              {shelves.map((shelf) => {
                const active = selectedShelfIds.includes(shelf.id);

                return (
                  <div
                    key={shelf.id}
                    className={`group flex items-center gap-2 rounded-2xl border px-3 py-2 transition ${
                      active
                        ? "border-rose-300 bg-rose-50 text-rose-700 dark:border-rose-800 dark:bg-rose-950/30 dark:text-rose-100"
                        : "border-slate-200 bg-white text-slate-600 hover:border-orange-200 dark:border-slate-800 dark:bg-slate-950/70 dark:text-slate-300"
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

            <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-[minmax(0,1fr)_auto] xl:grid-cols-1">
              <input
                value={newShelfName}
                onChange={(event) => setNewShelfName(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    void createShelf();
                  }
                }}
                placeholder="Yeni raf adı: Kore dizileri..."
                className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none transition focus:border-orange-300 focus:ring-4 focus:ring-orange-500/10 dark:border-slate-800 dark:bg-slate-950/80 dark:text-slate-50"
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

          <div className="space-y-1.5">
            <label className="block text-xs font-medium text-slate-600 dark:text-slate-300">Notlar</label>
            <textarea
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              rows={5}
              placeholder="Bu film/dizi hakkında notların..."
              className="w-full resize-none rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm outline-none transition focus:border-primary/60 focus:ring-2 focus:ring-primary/30 dark:border-slate-700 dark:bg-slate-900/80 dark:text-slate-50"
            />
          </div>

          <button
            type="submit"
            disabled={saving}
            className="inline-flex w-full items-center justify-center rounded-xl bg-primary px-4 py-2.5 text-sm font-medium text-white shadow-sm transition hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {saving ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Kaydediliyor...
              </>
            ) : (
              <>
                <Save className="mr-2 h-4 w-4" />
                Değişiklikleri kaydet
              </>
            )}
          </button>
        </form>

        <div className="space-y-5 xl:col-span-1">
          {item.type === "TV" ? (
            <section className="rounded-[2rem] border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-950 sm:p-5">
              <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                <div>
                  <h2 className="flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-slate-50">
                    <span className="inline-flex h-7 w-7 items-center justify-center rounded-xl bg-purple-500/10 text-purple-600 dark:text-purple-300">
                      <Tv className="h-4 w-4" />
                    </span>
                    İzlenen bölümleri ekle / güncelle
                  </h2>
                  <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                    Sezon seç, izlediğin bölümlere tik at. Eklenen bölümler raporlara işlenir; kaldırılan bölümlerin eski rapor kayıtları da temizlenir.
                  </p>
                </div>

                <div className="rounded-2xl border border-purple-200 bg-purple-50 px-3 py-2 text-xs font-semibold text-purple-700 dark:border-purple-800 dark:bg-purple-900/20 dark:text-purple-200">
                  {watchedEpisodeList.length} bölüm seçildi
                </div>
              </div>

              {!episodeTrackingEnabled ? (
                <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-800 dark:border-amber-800 dark:bg-amber-900/20 dark:text-amber-100">
                  Bölüm seçimi için durumu “İzleniyor” veya “İzlendi” yapmalısın.
                </div>
              ) : null}

              <div className="mt-4 flex gap-2 overflow-x-auto pb-1">
                {seasons.map((season) => (
                  <button
                    key={season.seasonNumber}
                    type="button"
                    onClick={() => item.tmdbId && loadSeason(item.tmdbId, season.seasonNumber)}
                    className={`flex-shrink-0 rounded-full border px-3 py-1.5 text-xs font-bold transition ${
                      selectedSeasonNumber === season.seasonNumber
                        ? "border-purple-400 bg-purple-500 text-white shadow-sm"
                        : "border-slate-200 bg-white text-slate-500 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-950/70 dark:text-slate-300"
                    }`}
                  >
                    Sezon {season.seasonNumber}
                    <span className="ml-1 opacity-80">({season.episodeCount})</span>
                  </button>
                ))}
              </div>

              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={markCurrentSeason}
                  disabled={!episodeTrackingEnabled || !seasonDetails}
                  className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-bold text-emerald-700 transition hover:bg-emerald-100 disabled:cursor-not-allowed disabled:opacity-50 dark:border-emerald-800 dark:bg-emerald-900/20 dark:text-emerald-200"
                >
                  Bu sezonun tamamını işaretle
                </button>

                <button
                  type="button"
                  onClick={clearCurrentSeason}
                  disabled={!episodeTrackingEnabled || !seasonDetails}
                  className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-bold text-slate-600 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-700 dark:bg-slate-950/70 dark:text-slate-300"
                >
                  Bu sezonu temizle
                </button>

                <button
                  type="button"
                  onClick={clearAllEpisodes}
                  disabled={!episodeTrackingEnabled || watchedEpisodeList.length === 0}
                  className="inline-flex items-center gap-1 rounded-full border border-rose-200 bg-rose-50 px-3 py-1.5 text-xs font-bold text-rose-600 transition hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-50 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-200"
                >
                  <RotateCcw className="h-3 w-3" />
                  Tüm seçimi temizle
                </button>
              </div>

              {loadingSeason ? (
                <div className="flex justify-center py-10 text-sm text-slate-500">
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Bölümler yükleniyor...
                </div>
              ) : seasonDetails ? (
                <div className="mt-4 grid max-h-[640px] grid-cols-1 gap-2 overflow-y-auto pr-1">
                  {seasonDetails.episodes.map((episode) => {
                    const key = episodeKey(episode.seasonNumber, episode.episodeNumber);
                    const checked = Boolean(watchedEpisodes[key]);

                    return (
                      <button
                        key={key}
                        type="button"
                        onClick={() => toggleEpisodeWatched(episode)}
                        disabled={!episodeTrackingEnabled}
                        className={`w-full rounded-2xl border p-3 text-left transition disabled:cursor-not-allowed disabled:opacity-60 ${
                          checked
                            ? "border-emerald-300 bg-emerald-50 dark:border-emerald-800 dark:bg-emerald-950/30"
                            : "border-slate-200 bg-white hover:border-purple-300 dark:border-slate-800 dark:bg-slate-900"
                        }`}
                      >
                        <div className="flex gap-3">
                          <div
                            className={`mt-1 flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-md border ${
                              checked
                                ? "border-emerald-500 bg-emerald-500 text-white"
                                : "border-slate-300 dark:border-slate-700"
                            }`}
                          >
                            {checked ? <CheckCircle2 className="h-4 w-4" /> : null}
                          </div>

                          {episode.stillUrl ? (
                            <button
                              type="button"
                              onClick={(event) => {
                                event.stopPropagation();
                                setPreviewImage({
                                  src: getHighQualityImageUrl(episode.stillUrl),
                                  title: episode.title,
                                  subtitle: `Sezon ${episode.seasonNumber}, Bölüm ${episode.episodeNumber}`,
                                });
                              }}
                              className="h-14 w-24 flex-shrink-0 overflow-hidden rounded-xl bg-slate-200 ring-1 ring-slate-200/80 transition hover:scale-[1.03] dark:bg-slate-800 dark:ring-slate-700"
                              title="Bölüm görselini büyüt"
                            >
                              <img
                                src={episode.stillUrl}
                                alt={episode.title}
                                className="h-full w-full object-cover"
                              />
                            </button>
                          ) : null}

                          <div className="min-w-0 flex-1">
                            <div className="flex items-start justify-between gap-2">
                              <p className="text-sm font-bold text-slate-900 dark:text-slate-50">
                                {getEpisodeHeading(episode)}
                              </p>
                              <ChevronRight className="mt-0.5 h-4 w-4 flex-shrink-0 text-slate-300" />
                            </div>

                            <p className="mt-0.5 text-xs text-slate-500">
                              {episode.runtime ? `${episode.runtime} dk` : "Süre bilinmiyor"}
                              {episode.airDate ? ` • ${episode.airDate}` : ""}
                              {episode.tmdbRating ? ` • ${episode.tmdbRating}/10` : ""}
                            </p>

                            {episode.overview ? (
                              <p className="mt-1 line-clamp-2 text-xs text-slate-500">
                                {episode.overview}
                              </p>
                            ) : null}
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              ) : (
                <div className="mt-4 rounded-2xl border border-dashed border-slate-200 p-8 text-center text-sm text-slate-500 dark:border-slate-800">
                  Sezon seçerek bölüm listesini görüntüleyebilirsin.
                </div>
              )}
            </section>
          ) : null}

          {item.type === "TV" && watchedEpisodeList.length > 0 ? (
            <section className="rounded-[2rem] border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-950 sm:p-5">
              <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-50">Seçili izlenen bölümler</h2>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                Kayıtlı bölüm listesini buradan hızlıca kontrol edip kaldırabilirsin.
              </p>

              <div className="mt-3 flex flex-wrap gap-2">
                {watchedEpisodeList.map((episode) => {
                  const key = episodeKey(episode.seasonNumber, episode.episodeNumber);

                  return (
                    <button
                      key={key}
                      type="button"
                      disabled={!episodeTrackingEnabled}
                      onClick={() => toggleEpisodeWatched(episode)}
                      className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700 transition hover:bg-emerald-100 disabled:cursor-not-allowed disabled:opacity-50 dark:border-emerald-800 dark:bg-emerald-900/20 dark:text-emerald-200"
                    >
                      <span>{getEpisodeText(episode)}</span>
                      <X className="h-3 w-3" />
                    </button>
                  );
                })}
              </div>
            </section>
          ) : null}

          {actionHistory.length > 0 ? (
            <section className="rounded-[2rem] border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-950 sm:p-5">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h2 className="text-sm font-black text-slate-900 dark:text-slate-50">Son işlemler</h2>
                  <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                    Puan, durum ve bölüm değişiklikleri açıklamalı olarak tutulur.
                  </p>
                </div>
                <span className="rounded-full border border-slate-200 px-2.5 py-1 text-[11px] font-black text-slate-500 dark:border-slate-800 dark:text-slate-300">
                  {actionHistory.length} kayıt
                </span>
              </div>

              <div className="mt-4 space-y-2">
                {actionHistory.slice(0, 5).map((action, index) => (
                  <div
                    key={`${action.at}-${index}`}
                    className="rounded-2xl border border-slate-200 bg-slate-50 p-3 dark:border-slate-800 dark:bg-slate-900"
                  >
                    <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between">
                      <p className="text-sm font-black text-slate-900 dark:text-slate-50">{formatStoredActionText(action.title, action.at)}</p>
                      <p className="text-[11px] font-bold text-slate-400">{formatDateTime(action.at)}</p>
                    </div>
                    {action.details.length > 0 ? (
                      <ul className="mt-2 space-y-1 text-xs text-slate-500 dark:text-slate-400">
                        {action.details.slice(0, 4).map((detail, detailIndex) => (
                          <li key={`${detail}-${detailIndex}`} className="flex gap-2">
                            <span className="mt-1.5 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-emerald-400" />
                            <span>{formatStoredActionText(detail, action.at)}</span>
                          </li>
                        ))}
                      </ul>
                    ) : action.description ? (
                      <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{formatStoredActionText(action.description, action.at)}</p>
                    ) : null}
                  </div>
                ))}
              </div>
            </section>
          ) : null}

          <section className="rounded-[2rem] border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-950 sm:p-5">
            <p className="mb-3 text-xs font-bold uppercase tracking-[0.14em] text-slate-400">Ek bilgiler</p>

            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3 dark:border-slate-800 dark:bg-slate-900">
                <p className="text-xs font-semibold uppercase text-slate-400">Yönetmen / Creator</p>
                <p className="mt-1 text-sm font-medium text-slate-800 dark:text-slate-100">
                  {item.type === "MOVIE" ? item.director || "Bilinmiyor" : item.creators?.join(", ") || "Bilinmiyor"}
                </p>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3 dark:border-slate-800 dark:bg-slate-900">
                <p className="text-xs font-semibold uppercase text-slate-400">Platformlar</p>
                <p className="mt-1 text-sm font-medium text-slate-800 dark:text-slate-100">
                  {item.platforms && item.platforms.length > 0 ? item.platforms.join(", ") : "Bilinmiyor"}
                </p>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3 dark:border-slate-800 dark:bg-slate-900 md:col-span-2">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-xs font-semibold uppercase text-slate-400">Oyuncular</p>
                    <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
                      Oyuncu kadrosu TMDb detaylarından alınır; eksik görünürse kadroyu yeniden güncelleyebilirsin.
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-black text-slate-500 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-300">
                      {castDetailsForDisplay.length || item.cast?.length || 0} kişi
                    </span>

                    <button
                      type="button"
                      onClick={() => item && void refreshActorMetadata(item, { force: true })}
                      disabled={refreshingActors}
                      className="inline-flex items-center gap-1.5 rounded-full border border-indigo-200 bg-indigo-50 px-3 py-1 text-[11px] font-black text-indigo-700 transition hover:bg-indigo-100 disabled:cursor-not-allowed disabled:opacity-60 dark:border-indigo-900/70 dark:bg-indigo-950/40 dark:text-indigo-200 dark:hover:bg-indigo-900/40"
                    >
                      {refreshingActors ? (
                        <Loader2 className="h-3 w-3 animate-spin" />
                      ) : (
                        <Sparkles className="h-3 w-3" />
                      )}
                      Kadroyu güncelle
                    </button>
                  </div>
                </div>

                {castDetailsForDisplay.length > 0 ? (
                  <>
                    <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-3">
                      {visibleCastDetails.map((person, index) => (
                        <ActorCard
                          key={`${person.id || person.name}-${person.character || index}`}
                          person={person}
                          onPreview={(src, title, subtitle) =>
                            setPreviewImage({
                              src: getHighQualityImageUrl(src),
                              title,
                              subtitle,
                            })
                          }
                        />
                      ))}
                    </div>

                    {castDetailsForDisplay.length > 18 ? (
                      <button
                        type="button"
                        onClick={() => setShowAllActors((current) => !current)}
                        className="mt-3 inline-flex w-full items-center justify-center rounded-2xl border border-slate-200 bg-white px-3 py-2 text-xs font-black text-slate-600 transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200 dark:hover:bg-slate-900"
                      >
                        {showAllActors
                          ? "Oyuncu listesini kısalt"
                          : `${hiddenActorCount} oyuncu daha göster`}
                      </button>
                    ) : null}
                  </>
                ) : item.cast && item.cast.length > 0 ? (
                  <div className="mt-2 flex flex-wrap gap-2">
                    {item.cast.map((name: string) => (
                      <span
                        key={name}
                        className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-600 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300"
                      >
                        {name}
                      </span>
                    ))}
                  </div>
                ) : (
                  <p className="mt-3 rounded-2xl border border-dashed border-slate-200 bg-white p-4 text-sm font-medium text-slate-500 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-400">
                    Oyuncu bilgisi bulunamadı. Kadroyu güncelle butonunu deneyebilirsin.
                  </p>
                )}
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
