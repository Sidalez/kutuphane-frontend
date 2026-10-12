function millis(value: any): number {
  const n = typeof value?.toMillis === "function" ? value.toMillis() : value instanceof Date ? value.getTime() : typeof value === "number" ? value : typeof value === "string" ? Date.parse(value) : 0;
  return Number.isFinite(n) ? n : 0;
}
export function lastWatchTime(item: Record<string, any>): number {
  if (item.status === "IZLENECEK") return 0;
  const dates = [item.lastWatchedAt, item.watchedAt, item.completedAt, item.completedDate, item.lastWatchedEpisode?.watchedAt,
    ...(item.watchedEpisodes || []).map((episode: any) => episode.watchedAt)];
  if (item.status === "IZLENIYOR" && (Number(item.watchedMinutes) > 0 || Number(item.watchedEpisodeCount) > 0)) dates.push(item.startedAt);
  return Math.max(0, ...dates.map(millis));
}
export function compareLastWatched(a: Record<string, any>, b: Record<string, any>): number {
  const aTime = lastWatchTime(a), bTime = lastWatchTime(b);
  if (aTime !== bTime) return bTime - aTime;
  // Only actual viewing updates break a same-day tie; edits and automatic status changes do not.
  if (aTime) return millis(b.lastWatchActivityAt) - millis(a.lastWatchActivityAt) || String(a.title || "").localeCompare(String(b.title || ""), "tr");
  return millis(b.createdAt) - millis(a.createdAt) || String(a.title || "").localeCompare(String(b.title || ""), "tr");
}
