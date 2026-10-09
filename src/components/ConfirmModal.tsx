import { ReactNode, useEffect } from "react";
import { AlertTriangle, Loader2, X } from "lucide-react";

interface ConfirmModalProps {
  open: boolean;
  title?: string;
  description?: string;
  confirmText?: string;
  cancelText?: string;
  isLoading?: boolean;
  onConfirm: () => void;
  onClose: () => void;
  imageUrl?: string | null;
  imageAlt?: string;
  meta?: ReactNode;
  danger?: boolean;
}

export default function ConfirmModal({
  open,
  title = "Emin misin?",
  description = "Bu işlem geri alınamaz.",
  confirmText = "Sil",
  cancelText = "Vazgeç",
  isLoading = false,
  onConfirm,
  onClose,
  imageUrl,
  imageAlt = "Önizleme",
  meta,
  danger = true,
}: ConfirmModalProps) {
  useEffect(() => {
    if (!open) return;

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !isLoading) {
        onClose();
      }
    };

    document.addEventListener("keydown", onKeyDown);
    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = "";
    };
  }, [open, onClose, isLoading]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[100]">
      <div
        className="absolute inset-0 bg-slate-950/55 backdrop-blur-[2px]"
        onClick={() => !isLoading && onClose()}
      />

      <div className="absolute inset-0 flex items-center justify-center p-4">
        <div
          className="
            w-full max-w-md rounded-3xl border border-slate-200/80 dark:border-slate-800
            bg-white/95 dark:bg-slate-950/95 shadow-2xl
            overflow-hidden
          "
        >
          <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200/70 dark:border-slate-800">
            <div className="flex items-center gap-3">
              <div
                className={`
                  inline-flex h-10 w-10 items-center justify-center rounded-2xl
                  ${danger
                    ? "bg-rose-100 text-rose-600 dark:bg-rose-950/40 dark:text-rose-300"
                    : "bg-amber-100 text-amber-600 dark:bg-amber-950/40 dark:text-amber-300"}
                `}
              >
                <AlertTriangle className="w-5 h-5" />
              </div>

              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
                  {title}
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  İşlemi onaylamadan önce kontrol et.
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={onClose}
              disabled={isLoading}
              className="p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-900 transition"
            >
              <X className="w-4 h-4 text-slate-500" />
            </button>
          </div>

          <div className="px-5 py-5 space-y-4">
            {imageUrl ? (
              <div className="flex items-start gap-4">
                <div className="w-20 h-28 rounded-2xl overflow-hidden bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex-shrink-0">
                  <img
                    src={imageUrl}
                    alt={imageAlt}
                    className="w-full h-full object-cover"
                  />
                </div>

                <div className="min-w-0 flex-1">
                  <p className="text-sm text-slate-600 dark:text-slate-300 leading-6">
                    {description}
                  </p>

                  {meta ? <div className="mt-3">{meta}</div> : null}
                </div>
              </div>
            ) : (
              <>
                <p className="text-sm text-slate-600 dark:text-slate-300 leading-6">
                  {description}
                </p>
                {meta ? <div>{meta}</div> : null}
              </>
            )}
          </div>

          <div className="px-5 pb-5 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              disabled={isLoading}
              className="
                inline-flex items-center justify-center rounded-full
                px-4 py-2 text-sm font-semibold
                border border-slate-200 dark:border-slate-700
                text-slate-700 dark:text-slate-200
                hover:bg-slate-50 dark:hover:bg-slate-900
                transition disabled:opacity-60
              "
            >
              {cancelText}
            </button>

            <button
              type="button"
              onClick={onConfirm}
              disabled={isLoading}
              className="
                inline-flex items-center justify-center gap-2 rounded-full
                px-4 py-2 text-sm font-semibold text-white
                bg-rose-600 hover:bg-rose-700
                transition disabled:opacity-60
              "
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Siliniyor...
                </>
              ) : (
                confirmText
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}