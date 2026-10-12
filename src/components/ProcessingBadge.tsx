export type ProcessingInfo = {
  usedAI: boolean;
  models: Array<{ provider: string; model: string; cached?: boolean }>;
  source?: string;
};

export default function ProcessingBadge({ info }: { info?: ProcessingInfo | null }) {
  if (!info) return null;
  const label = info.usedAI && info.models.length
    ? `Yapay zekâ: ${info.models.map(item => `${item.provider} · ${item.model}${item.cached ? " (önbellek)" : ""}`).join(" / ")}`
    : info.source === "isbn_web_research"
      ? "Bilgi kaynağı: İnternet araştırması · Yapay zekâ kullanılmadı"
      : info.source === "library_rules"
        ? "Kütüphane bilgilerine göre seçildi · Yapay zekâ kullanılmadı"
        : "TMDB verilerine göre seçildi · Yapay zekâ kullanılmadı";
  return <p className="mt-3 break-words text-xs leading-5 text-slate-500 dark:text-slate-400">{label}</p>;
}
