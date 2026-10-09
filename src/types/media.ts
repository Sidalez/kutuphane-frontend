// src/types/media.ts

export type MediaType = "MOVIE" | "TV";

export type WatchStatus =
  | "IZLENECEK"
  | "IZLENIYOR"
  | "IZLENDI"
  | "BIRAKILDI";

export type MediaPerson = {
  id?: number;
  name: string;
  originalName?: string;
  character?: string;
  profileUrl?: string | null;
  knownForDepartment?: string;
};

export type WatchedEpisode = {
  seasonNumber: number;
  episodeNumber: number;
  title: string;
  runtime?: number | null;
  watchedAt?: string;
};

export type MediaItem = {
  id?: string;
  userId: string;

  type: MediaType;

  title: string;
  originalTitle?: string;
  year?: string;
  overview?: string;

  posterUrl?: string;
  backdropUrl?: string;
  trailerUrl?: string;

  tmdbId?: number;
  imdbId?: string;

  genres?: string[];
  platforms?: string[];

  tmdbRating?: number;
  imdbRating?: number;

  status: WatchStatus;

  runtime?: number;
  watchedMinutes?: number;

  numberOfSeasons?: number;
  numberOfEpisodes?: number;
  currentSeason?: number;
  currentEpisode?: number;

  watchedEpisodes?: WatchedEpisode[];
  watchedEpisodeCount?: number;

  director?: string;
  creators?: string[];
  cast?: Array<MediaPerson | string>;

  userRating?: number;
  expectedRating?: number;
  notes?: string;

  startedAt?: string;
  startDate?: string;
  watchedAt?: string;
  completedAt?: string;
  completedDate?: string;
  lastActionAt?: any;

  createdAt?: any;
  updatedAt?: any;
};

export type WatchLog = {
  id?: string;
  userId: string;
  mediaId: string;

  mediaType: MediaType;
  title: string;

  date: string;
  monthKey: string;

  minutes: number;
  completed: boolean;

  seasonNumber?: number | null;
  episodeNumber?: number | null;
  episodeTitle?: string;

  genres?: string[];
  platform?: string;

  actionAt?: any;
  createdAt?: any;
};
