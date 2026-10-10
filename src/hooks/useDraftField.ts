import { useEffect, useState } from "react";
export function useDraftField<T>(key: string, field: string, initial: T) {
  const [value, setValue] = useState<T>(() => {
    try { const draft = JSON.parse(sessionStorage.getItem(key) || "{}"); return Object.prototype.hasOwnProperty.call(draft, field) ? draft[field] as T : initial; } catch { return initial; }
  });
  useEffect(() => { try { const draft = JSON.parse(sessionStorage.getItem(key) || "{}"); draft[field] = value; sessionStorage.setItem(key, JSON.stringify(draft)); } catch { /* Storage may be unavailable in private browsing. */ } }, [key, field, value]);
  return [value, setValue] as const;
}
