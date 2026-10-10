import { auth } from "../firebase/firebase";
import { API_BASE_URL } from "../apiClient";

export async function notificationRequest<T>(path: string, body?: unknown): Promise<T> {
  const token = path === "/config" ? null : await auth.currentUser?.getIdToken();
  if (path !== "/config" && !token) throw new Error("Devam etmek için giriş yapmalısın.");
  const response = await fetch(`${API_BASE_URL.replace(/\/$/, "")}/api/notifications${path}`, {
    method: body === undefined ? "GET" : "POST",
    headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(body === undefined ? {} : { "Content-Type": "application/json" }) },
    body: body === undefined ? undefined : JSON.stringify(body), signal: AbortSignal.timeout(60000),
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.message || "Bildirim işlemi tamamlanamadı.");
  return data;
}

export async function removeDeviceNotifications() {
  if (!("serviceWorker" in navigator)) return;
  const registration = await navigator.serviceWorker.getRegistration();
  const subscription = await registration?.pushManager?.getSubscription();
  if (!subscription) return;
  // Unsubscribe locally even if the server is offline, so logout stops this device's pushes.
  const endpoint = subscription.endpoint;
  await subscription.unsubscribe();
  let timeout: ReturnType<typeof setTimeout> | undefined;
  await Promise.race([
    notificationRequest("/unsubscribe", { endpoint }).catch(() => undefined),
    new Promise<void>(resolve => { timeout = setTimeout(resolve, 3000); }),
  ]).finally(() => clearTimeout(timeout));
}
