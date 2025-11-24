// src/components/BookDeleteModal.tsx

import { X, AlertTriangle, CheckCircle2, XCircle } from "lucide-react";

interface ResultState {
  type: "success" | "error";
  message: string;
}

interface Props {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  loading?: boolean;
  result?: ResultState | null; // ✅ silme sonucu için
}

export default function BookDeleteModal({
  open,
  onClose,
  onConfirm,
  loading,
  result,
}: Props) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center">
      <div className="bg-white dark:bg-slate-900 w-full max-w-md p-6 rounded-2xl shadow-xl animate-in zoom-in">
        
        {/* Header */}
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-bold flex items-center gap-2">
            <AlertTriangle className="text-red-500" />
            Kitabı Sil
          </h2>
          <button
            onClick={onClose}
            disabled={loading}
            className="text-slate-400 hover:text-slate-600 disabled:opacity-40"
          >
            <X />
          </button>
        </div>

        <p className="text-slate-600 dark:text-slate-300 mb-6">
          Bu kitabı <strong>tüm okuma kayıtları, notları ve analizleriyle birlikte</strong> kalıcı olarak silmek istediğine emin misin?
        </p>

        {/* Buttons */}
        <div className="flex gap-3">
          <button
            onClick={onClose}
            disabled={loading}
            className="flex-1 py-2 rounded-xl bg-slate-200 dark:bg-slate-800 font-semibold disabled:opacity-60"
          >
            Vazgeç
          </button>

          <button
            onClick={onConfirm}
            disabled={loading}
            className="flex-1 py-2 rounded-xl bg-red-600 text-white font-semibold shadow hover:bg-red-700 transition disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {loading && (
              <span className="w-4 h-4 border-2 border-white/60 border-t-transparent rounded-full animate-spin" />
            )}
            {loading ? "Siliniyor..." : "Tamamen Sil"}
          </button>
        </div>

        {/* ✅ Şekilli sonuç alert'i */}
        {result && (
          <div
            className={`
              mt-4 flex items-center gap-3 px-3 py-2 rounded-xl border text-sm
              animate-in fade-in slide-in-from-bottom
              ${
                result.type === "success"
                  ? "bg-emerald-50 border-emerald-200 text-emerald-800 dark:bg-emerald-900/30 dark:border-emerald-700 dark:text-emerald-100"
                  : "bg-red-50 border-red-200 text-red-800 dark:bg-red-900/30 dark:border-red-700 dark:text-red-100"
              }
            `}
          >
            {result.type === "success" ? (
              <CheckCircle2 className="w-5 h-5" />
            ) : (
              <XCircle className="w-5 h-5" />
            )}
            <p className="font-medium">{result.message}</p>
          </div>
        )}
      </div>
    </div>
  );
}
