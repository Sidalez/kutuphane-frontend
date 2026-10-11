import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { useAuth } from "../auth/AuthContext";
import { notificationRequest, removeDeviceNotifications } from "./api";

export type NotificationPreferences = {
  enabled: boolean; episodes: boolean; seasons: boolean; reading: boolean; readingFollowUp: boolean; watching: boolean;
  quietEnabled: boolean; quietStart: string; quietEnd: string; delivery: "instant" | "daily";
  digestTime: string; reminderTime: string; timeZone: string;
};
export type AppNotification = { id: string; kind: "episode" | "season" | "reading" | "readingFollowUp" | "watching" | "test"; title: string; body: string; url: string; createdAt: number; read: boolean };
type Config = { ready: boolean; pushReady: boolean; publicKey: string | null };
type Inbox = { preferences: NotificationPreferences; items: AppNotification[]; checkedAt: number | null; deviceCount: number };
const defaults: NotificationPreferences = { enabled: false, episodes: true, seasons: true, reading: false, readingFollowUp: true, watching: false, quietEnabled: true, quietStart: "22:00", quietEnd: "09:00", delivery: "instant", digestTime: "20:00", reminderTime: "20:30", timeZone: "Europe/Istanbul" };
type ContextValue = Inbox & {
  config: Config | null; loading: boolean; busy: boolean; error: string; deviceEnabled: boolean;
  refresh: (check?: boolean) => Promise<void>; savePreferences: (patch: Partial<NotificationPreferences>) => Promise<void>;
  enableDevice: () => Promise<void>; disableDevice: () => Promise<void>; testDevice: () => Promise<void>; markRead: (id?: string) => Promise<void>;
};
const Context = createContext<ContextValue | null>(null);
export { Context as NotificationContext };
export function NotificationProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const uid = user?.uid;
  const currentUid = useRef(uid); currentUid.current = uid;
  const [config, setConfig] = useState<Config | null>(null);
  const [data, setData] = useState<Inbox>({ preferences: defaults, items: [], checkedAt: null, deviceCount: 0 });
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const lock = useRef(false);
  const [error, setError] = useState("");
  const [deviceEnabled, setDeviceEnabled] = useState(false);
  const refresh = useCallback(async (check = false) => {
    if (!uid) return;
    try {
      const cfg = await notificationRequest<Config>("/config");
      if (currentUid.current !== uid) return;
      setConfig(cfg);
      if (!cfg.ready) { setError(""); return; }
      if (check) await notificationRequest("/check", {});
      const inbox = await notificationRequest<Inbox>("");
      if (currentUid.current !== uid) return;
      setData(inbox); setError("");
      if ("serviceWorker" in navigator && "PushManager" in window) {
        const reg = await navigator.serviceWorker.getRegistration();
        const sub = await reg?.pushManager.getSubscription();
        if (currentUid.current !== uid) return;
        setDeviceEnabled(Boolean(sub));
        // Rebind an existing browser subscription after login/account changes; no permission prompt.
        if (sub && cfg.pushReady) await notificationRequest("/subscribe", { subscription: sub.toJSON() });
      }
    } catch (e) { if (currentUid.current === uid) setError(e instanceof Error ? e.message : "Bildirimler getirilemedi."); }
    finally { if (currentUid.current === uid) setLoading(false); }
  }, [uid]);
  useEffect(() => {
    setData({ preferences: defaults, items: [], checkedAt: null, deviceCount: 0 });
    setConfig(null); setError(""); setDeviceEnabled(false); setLoading(Boolean(uid));
    if (!uid) return;
    void refresh();
    const tick = () => { if (document.visibilityState === "visible" && navigator.onLine) void refresh(true); };
    const interval = window.setInterval(tick, 5 * 60000);
    document.addEventListener("visibilitychange", tick); window.addEventListener("online", tick);
    const received = (event: MessageEvent) => { if (event.data?.type === "notification-received") void refresh(); };
    navigator.serviceWorker?.addEventListener("message", received);
    return () => { window.clearInterval(interval); document.removeEventListener("visibilitychange", tick); window.removeEventListener("online", tick); navigator.serviceWorker?.removeEventListener("message", received); };
  }, [uid, refresh]);
  async function action(work: () => Promise<void>) {
    if (lock.current) return;
    lock.current = true; setBusy(true); setError("");
    try { await work(); }
    catch (e) { const message = e instanceof Error ? e.message : "İşlem tamamlanamadı."; setError(message); throw new Error(message); }
    finally { lock.current = false; setBusy(false); }
  }
  async function savePreferences(patch: Partial<NotificationPreferences>) {
    await action(async () => {
      const next = await notificationRequest<{ preferences: NotificationPreferences }>("/preferences", patch);
      setData(value => ({ ...value, preferences: next.preferences }));
      if (patch.enabled) await refresh(true);
    });
  }
  async function enableDevice() {
    // requestPermission must run in the button's user gesture, before network/service-worker awaits.
    if (!config?.pushReady) throw new Error("Telefon bildirimleri için sunucu kurulumu tamamlanmalı.");
    if (!("Notification" in window) || !("PushManager" in window) || !("serviceWorker" in navigator)) throw new Error("Bu tarayıcı telefon bildirimlerini desteklemiyor. iPhone’da uygulamayı ana ekrana ekleyip oradan aç.");
    const permission = Notification.permission === "granted" ? Promise.resolve("granted") : Notification.requestPermission();
    await action(async () => {
      if (await permission !== "granted") throw new Error("Bildirim izni verilmedi. İstersen telefonunun site ayarlarından açabilirsin.");
      let timeout: ReturnType<typeof setTimeout> | undefined;
      const reg = await Promise.race([
        navigator.serviceWorker.ready,
        new Promise<never>((_, reject) => { timeout = setTimeout(() => reject(new Error("Uygulama güncelleniyor. Sayfayı yenileyip tekrar dene.")), 15000); }),
      ]).finally(() => clearTimeout(timeout));
      const existing = await reg.pushManager.getSubscription();
      const key = config.publicKey!;
      const bytes = Uint8Array.from(atob(key.replace(/-/g, "+").replace(/_/g, "/") + "=".repeat((4 - key.length % 4) % 4)), ch => ch.charCodeAt(0));
      const sub = existing || await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: bytes });
      try {
        await notificationRequest("/subscribe", { subscription: sub.toJSON() });
        await notificationRequest("/preferences", { enabled: true });
      } catch (error) { if (!existing) await sub.unsubscribe(); throw error; }
      setDeviceEnabled(true); await refresh(true);
    });
  }
  const disableDevice = () => action(async () => { await removeDeviceNotifications(); setDeviceEnabled(false); await refresh(); });
  const testDevice = () => action(async () => { await notificationRequest("/test", {}); await refresh(); });
  const markRead = (id?: string) => action(async () => {
    await notificationRequest("/read", id ? { id } : { all: true });
    setData(value => ({ ...value, items: value.items.map(item => !id || id === item.id ? { ...item, read: true } : item) }));
  });
  return <Context.Provider value={{ ...data, config, loading, busy, error, deviceEnabled, refresh, savePreferences, enableDevice, disableDevice, testDevice, markRead }}>{children}</Context.Provider>;
}
export function useNotifications() {
  const value = useContext(Context);
  if (!value) throw new Error("NotificationProvider eksik.");
  return value;
}
