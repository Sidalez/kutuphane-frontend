// src/components/ReadingSessionForm.tsx
import { useEffect, useMemo, useState, FormEvent } from "react";
import { Clock, Timer, Play, Square, CalendarDays, Hash, StickyNote, ListChecks } from "lucide-react";

type Mode = "manual" | "auto";

export interface ReadingSessionPayload {
  mode: Mode;
  date: string;           // "2025-11-24"
  startTime: string;      // "14:30"
  endTime: string;        // "15:10"
  durationMs: number;     // 2400000
  pagesRead?: number | null;
  startPage?: number | null;
  endPage?: number | null;
  notes?: string | null;
}

interface ReadingSessionFormProps {
  onSave: (payload: ReadingSessionPayload) => Promise<void> | void;
  initialDate?: string; // varsayılan bugün gelebilir
}

export default function ReadingSessionForm({
  onSave,
  initialDate,
}: ReadingSessionFormProps) {
  const [mode, setMode] = useState<Mode>("manual");

  // Ortak alanlar
  const [date, setDate] = useState(initialDate || new Date().toISOString().slice(0, 10));
  const [pagesRead, setPagesRead] = useState<number | undefined>();
  const [startPage, setStartPage] = useState<number | undefined>();
  const [endPage, setEndPage] = useState<number | undefined>();
  const [notes, setNotes] = useState("");

  // MANUEL alanlar
  const [manualStartTime, setManualStartTime] = useState("20:00");
  const [manualEndTime, setManualEndTime] = useState("21:00");

  // OTOMATİK kronometre
  const [autoStartTime, setAutoStartTime] = useState("20:00"); // kullanıcı başlangıç saatini seçsin
  const [autoRunning, setAutoRunning] = useState(false);
  const [autoStartTimestamp, setAutoStartTimestamp] = useState<number | null>(null);
  const [autoElapsedMs, setAutoElapsedMs] = useState(0);
  const [autoEndTime, setAutoEndTime] = useState<string | null>(null);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  // Kronometre effect
  useEffect(() => {
    if (!autoRunning || !autoStartTimestamp) return;

    const id = setInterval(() => {
      setAutoElapsedMs(Date.now() - autoStartTimestamp);
    }, 1000);

    return () => clearInterval(id);
  }, [autoRunning, autoStartTimestamp]);

  // Süreyi okunabilir hale getir
  function formatDuration(ms: number) {
    const totalSec = Math.floor(ms / 1000);
    const h = Math.floor(totalSec / 3600);
    const m = Math.floor((totalSec % 3600) / 60);
    const s = totalSec % 60;
    if (h > 0) return `${h} sa ${m} dk ${s} sn`;
    if (m > 0) return `${m} dk ${s} sn`;
    return `${s} sn`;
  }

  const autoDurationLabel = useMemo(
    () => (autoElapsedMs > 0 ? formatDuration(autoElapsedMs) : "Henüz başlamadı"),
    [autoElapsedMs]
  );

  const manualDurationMs = useMemo(() => {
    try {
      const [sh, sm] = manualStartTime.split(":").map(Number);
      const [eh, em] = manualEndTime.split(":").map(Number);
      if (
        Number.isNaN(sh) ||
        Number.isNaN(sm) ||
        Number.isNaN(eh) ||
        Number.isNaN(em)
      )
        return 0;
      const start = new Date(`${date}T${manualStartTime}:00`);
      const end = new Date(`${date}T${manualEndTime}:00`);
      const diff = end.getTime() - start.getTime();
      return diff > 0 ? diff : 0;
    } catch {
      return 0;
    }
  }, [manualStartTime, manualEndTime, date]);

  const manualDurationLabel =
    manualDurationMs > 0 ? formatDuration(manualDurationMs) : "Süre henüz hesaplanamıyor";

  // OTOMATİK: Başlat
  const handleAutoStart = () => {
    setError(null);
    setInfo(null);

    // Kullanıcının seçtiği saate göre start timestamp oluştur
    const now = new Date();
    const [h, m] = autoStartTime.split(":").map(Number);
    if (Number.isNaN(h) || Number.isNaN(m)) {
      setError("Geçerli bir başlangıç saati seç.");
      return;
    }
    const start = new Date(`${date}T${autoStartTime}:00`);
    // Eğer kullanıcı geçmişte bir saat seçtiyse, yine de onu baz alıyoruz
    setAutoStartTimestamp(start.getTime());
    setAutoElapsedMs(0);
    setAutoEndTime(null);
    setAutoRunning(true);
  };

  // OTOMATİK: Bitir
  const handleAutoStop = () => {
    if (!autoStartTimestamp) return;
    setAutoRunning(false);

    const end = new Date();
    const endStr = end.toTimeString().slice(0, 5); // "HH:MM"
    setAutoEndTime(endStr);
    setAutoElapsedMs(end.getTime() - autoStartTimestamp);
    setInfo("Okuma süresi kaydedildi. Şimdi kaydet butonuna basabilirsin.");
  };

  // FORM SUBMIT
  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setInfo(null);

    try {
      setSaving(true);

      let payload: ReadingSessionPayload;

      if (mode === "manual") {
        if (!manualDurationMs) {
          setError("Başlangıç ve bitiş saatlerini doğru girdiğinden emin ol.");
          setSaving(false);
          return;
        }

        payload = {
          mode: "manual",
          date,
          startTime: manualStartTime,
          endTime: manualEndTime,
          durationMs: manualDurationMs,
          pagesRead: pagesRead ?? null,
          startPage: startPage ?? null,
          endPage: endPage ?? null,
          notes: notes.trim() || null,
        };
      } else {
        // auto
        if (!autoStartTimestamp || autoElapsedMs <= 0 || !autoEndTime) {
          setError("Lütfen önce okumayı başlat ve bitir.");
          setSaving(false);
          return;
        }

        payload = {
          mode: "auto",
          date,
          startTime: autoStartTime,
          endTime: autoEndTime,
          durationMs: autoElapsedMs,
          pagesRead: pagesRead ?? null,
          startPage: startPage ?? null,
          endPage: endPage ?? null,
          notes: notes.trim() || null,
        };
      }

      await onSave(payload);
      setInfo("Okuma kaydı başarıyla kaydedildi.");
    } catch (err: any) {
      console.error(err);
      setError(err?.message || "Kayıt sırasında bir hata oluştu.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-2xl border border-slate-200/80 dark:border-slate-800/80 bg-white/80 dark:bg-slate-950/80 p-4 md:p-5 space-y-4 shadow-sm"
    >
      {/* Başlık */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="inline-flex w-8 h-8 rounded-xl bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900 items-center justify-center">
            <Timer className="w-4 h-4" />
          </span>
          <div>
            <p className="text-sm font-semibold text-slate-900 dark:text-slate-50">
              Yeni okuma kaydı
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              İstersen süreyi elle gir, istersen kronometreyle otomatik ölç.
            </p>
          </div>
        </div>
      </div>

      {/* Mod seçimi */}
      <div className="bg-slate-50 dark:bg-slate-900/60 rounded-xl p-1 flex text-xs font-medium">
        <button
          type="button"
          onClick={() => setMode("manual")}
          className={`flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg transition ${
            mode === "manual"
              ? "bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-50 shadow"
              : "text-slate-500"
          }`}
        >
          <ListChecks className="w-3 h-3" />
          Manuel giriş
        </button>
        <button
          type="button"
          onClick={() => setMode("auto")}
          className={`flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg transition ${
            mode === "auto"
              ? "bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-50 shadow"
              : "text-slate-500"
          }`}
        >
          <Clock className="w-3 h-3" />
          Otomatik / kronometre
        </button>
      </div>

      {/* Ortak alanlar */}
      <div className="grid gap-3 md:grid-cols-3">
        <div className="space-y-1">
          <label className="text-[11px] font-medium text-slate-600 dark:text-slate-300 flex items-center gap-1">
            <CalendarDays className="w-3 h-3" />
            Tarih
          </label>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm"
          />
        </div>

        <div className="space-y-1">
          <label className="text-[11px] font-medium text-slate-600 dark:text-slate-300 flex items-center gap-1">
            <Hash className="w-3 h-3" />
            Başlangıç sayfası
          </label>
          <input
            type="number"
            min={0}
            value={startPage ?? ""}
            onChange={(e) =>
              setStartPage(e.target.value ? Number(e.target.value) : undefined)
            }
            placeholder="Örn: 35"
            className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm"
          />
        </div>

        <div className="space-y-1">
          <label className="text-[11px] font-medium text-slate-600 dark:text-slate-300 flex items-center gap-1">
            <Hash className="w-3 h-3" />
            Bitiş sayfası
          </label>
          <input
            type="number"
            min={0}
            value={endPage ?? ""}
            onChange={(e) =>
              setEndPage(e.target.value ? Number(e.target.value) : undefined)
            }
            placeholder="Örn: 78"
            className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm"
          />
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        <div className="space-y-1">
          <label className="text-[11px] font-medium text-slate-600 dark:text-slate-300 flex items-center gap-1">
            <Hash className="w-3 h-3" />
            Toplam okunan sayfa (opsiyonel)
          </label>
          <input
            type="number"
            min={0}
            value={pagesRead ?? ""}
            onChange={(e) =>
              setPagesRead(e.target.value ? Number(e.target.value) : undefined)
            }
            placeholder="Örn: 25"
            className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm"
          />
        </div>
        <div className="md:col-span-2 space-y-1">
          <label className="text-[11px] font-medium text-slate-600 dark:text-slate-300 flex items-center gap-1">
            <StickyNote className="w-3 h-3" />
            Not (opsiyonel)
          </label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
            placeholder="Bu oturumda hissettiklerin, önemli yerler vb."
            className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm"
          />
        </div>
      </div>

      {/* MANUEL MODE */}
      {mode === "manual" && (
        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-900/60 p-3 space-y-3">
          <p className="text-[11px] font-semibold text-slate-600 dark:text-slate-300 flex items-center gap-1">
            <ListChecks className="w-3 h-3" />
            Manuel süre girişi
          </p>
          <div className="grid gap-3 md:grid-cols-3">
            <div className="space-y-1">
              <label className="text-[11px] font-medium text-slate-600 dark:text-slate-300">
                Başlangıç saati
              </label>
              <input
                type="time"
                value={manualStartTime}
                onChange={(e) => setManualStartTime(e.target.value)}
                className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[11px] font-medium text-slate-600 dark:text-slate-300">
                Bitiş saati
              </label>
              <input
                type="time"
                value={manualEndTime}
                onChange={(e) => setManualEndTime(e.target.value)}
                className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[11px] font-medium text-slate-600 dark:text-slate-300">
                Toplam süre
              </label>
              <div className="h-10 inline-flex items-center rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 text-xs text-slate-600 dark:text-slate-300">
                {manualDurationLabel}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* OTOMATİK MODE */}
      {mode === "auto" && (
        <div className="rounded-xl border border-emerald-200/70 dark:border-emerald-800/70 bg-emerald-50/70 dark:bg-emerald-900/40 p-3 space-y-3">
          <div className="flex items-center justify-between gap-2">
            <p className="text-[11px] font-semibold text-emerald-800 dark:text-emerald-100 flex items-center gap-1">
              <Clock className="w-3 h-3" />
              Otomatik süre ölçümü (kronometre)
            </p>
          </div>

          <div className="grid gap-3 md:grid-cols-[minmax(0,1fr),minmax(0,1fr)] items-center">
            <div className="space-y-2">
              <div className="space-y-1">
                <label className="text-[11px] font-medium text-emerald-900 dark:text-emerald-100">
                  Başlangıç saati
                </label>
                <input
                  type="time"
                  value={autoStartTime}
                  onChange={(e) => setAutoStartTime(e.target.value)}
                  disabled={autoRunning}
                  className="w-full rounded-lg border border-emerald-200 dark:border-emerald-700 bg-white dark:bg-emerald-950 px-3 py-2 text-sm disabled:opacity-60"
                />
                <p className="text-[10px] text-emerald-800/80 dark:text-emerald-100/80">
                  Okumaya başlayacağın saati seç, sonra “Başlat”a tıkla.
                </p>
              </div>

              <div className="inline-flex items-center gap-2">
                {!autoRunning ? (
                  <button
                    type="button"
                    onClick={handleAutoStart}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-emerald-700"
                  >
                    <Play className="w-3 h-3" />
                    Okumayı başlat
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={handleAutoStop}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-red-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-red-700"
                  >
                    <Square className="w-3 h-3" />
                    Okumayı bitir
                  </button>
                )}

                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100/80 dark:bg-emerald-950/70 px-2 py-1 text-[10px] text-emerald-900 dark:text-emerald-100">
                  <Timer className="w-3 h-3" />
                  {autoDurationLabel}
                </span>
              </div>
            </div>

            <div className="space-y-2">
              <p className="text-[11px] font-medium text-emerald-900 dark:text-emerald-100">
                Bitiş saati & özet
              </p>
              <div className="rounded-lg border border-emerald-200 dark:border-emerald-700 bg-white/80 dark:bg-emerald-950 px-3 py-2 text-[11px] text-emerald-900 dark:text-emerald-50 space-y-1.5">
                <p>
                  <span className="font-semibold">Bitiş saati:</span>{" "}
                  {autoEndTime || (autoRunning ? "Devam ediyor..." : "-")}
                </p>
                <p>
                  <span className="font-semibold">Toplam süre:</span>{" "}
                  {autoElapsedMs > 0 ? autoDurationLabel : "-"}
                </p>
                <p className="text-[10px] text-emerald-800/80 dark:text-emerald-100/80">
                  Okumayı bitirdikten sonra “Okumayı bitir”e tıkla, ardından
                  aşağıdaki “Kaydet” butonuyla oturumu kütüphanene ekle.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Hata / bilgi */}
      {error && (
        <div className="text-[11px] rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-red-700 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-100">
          {error}
        </div>
      )}
      {info && !error && (
        <div className="text-[11px] rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-emerald-700 dark:border-emerald-900/60 dark:bg-emerald-950/40 dark:text-emerald-100">
          {info}
        </div>
      )}

      {/* Kaydet butonu */}
      <div className="flex justify-end">
        <button
          type="submit"
          disabled={saving}
          className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-slate-800 disabled:opacity-60"
        >
          {saving && <Timer className="w-4 h-4 animate-spin" />}
          Okuma kaydını kaydet
        </button>
      </div>
    </form>
  );
}
