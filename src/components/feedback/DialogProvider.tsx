import { createContext, useCallback, useContext, useEffect, useId, useMemo, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { AlertTriangle, Info, X } from "lucide-react";

type DialogOptions = {
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: "warning" | "error" | "info";
  signal?: AbortSignal;
};
type Request = DialogOptions & { id: number; alertOnly: boolean; resolve: (accepted: boolean) => void; cleanup?: () => void };
type DialogAPI = { confirm: (options: DialogOptions) => Promise<boolean>; alert: (options: DialogOptions) => Promise<boolean> };
const DialogContext = createContext<DialogAPI | null>(null);

function DialogCard({ request, finish }: { request: Request; finish: (id: number, accepted: boolean) => void }) {
  const panel = useRef<HTMLDivElement>(null);
  const safeButton = useRef<HTMLButtonElement>(null);
  const titleId = useId(), descriptionId = useId();
  useEffect(() => {
    const previousFocus = document.activeElement as HTMLElement | null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    safeButton.current?.focus();
    const keydown = (event: KeyboardEvent) => {
      if (event.key === "Escape") { event.preventDefault(); finish(request.id, false); }
      if (event.key === "Tab") {
        const buttons = panel.current?.querySelectorAll<HTMLButtonElement>("button:not(:disabled)");
        if (!buttons?.length) return;
        const first = buttons[0], last = buttons[buttons.length - 1];
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
      }
    };
    document.addEventListener("keydown", keydown);
    return () => { document.body.style.overflow = previousOverflow; document.removeEventListener("keydown", keydown); if (previousFocus?.isConnected) previousFocus.focus(); };
  }, [request.id, finish]);
  const tone = request.tone || "warning";
  const Icon = tone === "info" ? Info : AlertTriangle;
  return createPortal(<div className="fixed inset-0 z-[100] flex items-end justify-center bg-slate-950/50 p-3 pb-[max(.75rem,env(safe-area-inset-bottom))] backdrop-blur-sm sm:items-center sm:p-6" onClick={() => finish(request.id, false)}>
    <div ref={panel} role="alertdialog" aria-modal="true" aria-labelledby={titleId} aria-describedby={descriptionId} onClick={event => event.stopPropagation()} className="app-page-enter relative max-h-[85dvh] w-full max-w-md overflow-y-auto rounded-[1.75rem] border border-white/70 bg-white p-6 text-slate-900 shadow-2xl dark:border-slate-700 dark:bg-slate-900 dark:text-slate-50">
      <button type="button" aria-label="Uyarıyı kapat" onClick={() => finish(request.id, false)} className="absolute right-3 top-3 flex h-11 w-11 items-center justify-center rounded-full text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"><X className="h-5 w-5" /></button>
      <div className={`mb-5 flex h-14 w-14 items-center justify-center rounded-2xl ${tone === "error" ? "bg-red-50 text-red-600 dark:bg-red-500/10 dark:text-red-400" : tone === "info" ? "bg-blue-50 text-blue-600 dark:bg-blue-500/10 dark:text-blue-400" : "bg-orange-50 text-orange-600 dark:bg-orange-500/10 dark:text-orange-400"}`}><Icon className="h-7 w-7" strokeWidth={1.7} /></div>
      <h2 id={titleId} className="pr-5 text-xl font-semibold tracking-tight">{request.title}</h2>
      <p id={descriptionId} className="mt-3 text-sm leading-6 text-slate-500 dark:text-slate-400">{request.message}</p>
      <div className="mt-6 flex flex-col gap-2">
        {!request.alertOnly && <button ref={safeButton} type="button" onClick={() => finish(request.id, false)} className="min-h-12 rounded-2xl bg-slate-900 px-4 text-sm font-semibold text-white transition hover:bg-slate-800 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-white">{request.cancelLabel || "Vazgeç"}</button>}
        <button ref={request.alertOnly ? safeButton : undefined} type="button" onClick={() => finish(request.id, true)} className={`min-h-12 rounded-2xl px-4 text-sm font-semibold transition ${request.alertOnly ? "bg-primary text-white hover:brightness-110" : tone === "error" ? "text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-500/10" : "text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"}`}>{request.confirmLabel || "Tamam"}</button>
      </div>
    </div>
  </div>, document.body);
}

export function DialogProvider({ children }: { children: ReactNode }) {
  const [queue, setQueue] = useState<Request[]>([]);
  const requests = useRef<Request[]>([]);
  const nextId = useRef(0);
  const finish = useCallback((id: number, accepted: boolean) => {
    const request = requests.current.find(item => item.id === id);
    if (!request) return;
    request.cleanup?.();
    requests.current = requests.current.filter(item => item.id !== id);
    setQueue(requests.current);
    request.resolve(accepted);
  }, []);
  const show = useCallback((options: DialogOptions, alertOnly: boolean) => new Promise<boolean>(resolve => {
    if (options.signal?.aborted) { resolve(false); return; }
    const id = ++nextId.current;
    const abort = () => finish(id, false);
    options.signal?.addEventListener("abort", abort, { once: true });
    const request = { ...options, id, alertOnly, resolve, cleanup: () => options.signal?.removeEventListener("abort", abort) };
    requests.current = [...requests.current, request];
    setQueue(requests.current);
  }), [finish]);
  useEffect(() => () => { requests.current.forEach(request => { request.cleanup?.(); request.resolve(false); }); requests.current = []; }, []);
  const api = useMemo(() => ({confirm: (options: DialogOptions) => show(options, false), alert: (options: DialogOptions) => show(options, true)}), [show]);
  return <DialogContext.Provider value={api}>{children}{queue[0] && <DialogCard key={queue[0].id} request={queue[0]} finish={finish} />}</DialogContext.Provider>;
}
export function useAppDialog() {
  const context = useContext(DialogContext);
  if (!context) throw new Error("DialogProvider is required");
  return context;
}
