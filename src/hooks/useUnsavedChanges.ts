import { useAppDialog } from "../components/feedback/DialogProvider";
import { useEffect, useRef } from "react";
import { useBlocker } from "react-router-dom";

/** Compare form values against the loaded or last saved version. */
export function useUnsavedChanges(values: unknown, ready = true) {
  const dialog = useAppDialog();
  const serialized = JSON.stringify(values);
  const baseline = useRef<string>();
  const current = useRef(serialized);
  current.current = serialized;
  if (ready && baseline.current === undefined) baseline.current = serialized;
  const dirty = useRef(false);
  dirty.current = ready && baseline.current !== serialized;
  const blocker = useBlocker(({ currentLocation, nextLocation }) =>
    dirty.current && currentLocation.pathname !== nextLocation.pathname
  );
  useEffect(() => {
    if (blocker.state !== "blocked") return;
    const controller = new AbortController();
    void dialog.confirm({
      title: "Değişikliklerin henüz kaydedilmedi",
      message: "Bu sayfada yaptığın değişiklikleri henüz kaydetmedin. Ayrılmadan önce düzenlemeyi tamamlayabilirsin.",
      cancelLabel: "Düzenlemeye devam et",
      confirmLabel: "Sayfadan ayrıl",
      signal: controller.signal,
    }).then(accepted => {
      if (controller.signal.aborted) return;
      if (accepted) blocker.proceed(); else blocker.reset();
    });
    return () => controller.abort();
  }, [blocker, dialog]);
  useEffect(() => {
    const warn = (event: BeforeUnloadEvent) => {
      if (!dirty.current) return;
      event.preventDefault(); event.returnValue = "";
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, []);
  return (savedValues?: unknown) => {
    baseline.current = savedValues === undefined ? serialized : JSON.stringify(savedValues);
    dirty.current = current.current !== baseline.current;
  };
}
