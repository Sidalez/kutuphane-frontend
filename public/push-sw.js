/* Imported by the existing Workbox worker; keeps offline/update behaviour intact. */
self.addEventListener("push", event => {
  let payload = {};
  try { payload = event.data?.json() || {}; } catch {}
  event.waitUntil(self.registration.showNotification(payload.title || "Kütüphanem", {
    body: payload.body || "Yeni bir bildirimin var.",
    icon: "/icons/icon-192.png?v=2", badge: "/icons/icon-192.png?v=2",
    lang: "tr", dir: "ltr",
    tag: payload.tag || "kutuphanem", data: { url: payload.url || "/notifications" },
  }));
});
self.addEventListener("notificationclick", event => {
  event.notification.close();
  let target = new URL("/notifications", self.location.origin);
  try {
    const candidate = new URL(event.notification.data?.url, self.location.origin);
    if (candidate.origin === self.location.origin && /^\/(notifications|media|library)(\/|$)/.test(candidate.pathname)) target = candidate;
  } catch {}
  event.waitUntil((async () => {
    const windows = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    for (const client of windows) {
      if (new URL(client.url).origin !== target.origin) continue;
      try { const navigated = await client.navigate(target.href); if (navigated) return navigated.focus(); } catch {}
    }
    return self.clients.openWindow(target.href);
  })());
});
