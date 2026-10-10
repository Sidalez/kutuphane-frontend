const { test } = require("node:test");
const assert = require("node:assert/strict");
const vm = require("node:vm");
const fs = require("node:fs");
function worker() {
  const handlers = {}, displayed = [], opened = [];
  const self = { location: { origin: "https://kisiseltakip.vercel.app" }, addEventListener: (type, fn) => { handlers[type] = fn; }, registration: { showNotification: async (title, options) => displayed.push({ title, options }) }, clients: { matchAll: async () => [], openWindow: async url => opened.push(url) } };
  vm.runInNewContext(fs.readFileSync("public/push-sw.js", "utf8"), { self, URL });
  return { handlers, displayed, opened };
}
test("push always shows a notification, including malformed payloads", async () => {
  const w = worker(); let task;
  w.handlers.push({ data: { json: () => { throw new Error("invalid"); } }, waitUntil: p => { task = p; } });
  await task; assert.equal(w.displayed[0].title, "Kütüphanem");
});
test("notification clicks open local media but reject external and protocol-relative destinations", async () => {
  const w = worker();
  for (const url of ["/media/show1", "https://evil.test/media/show1", "//evil.test/media/show1", "javascript:alert(1)"]) {
    let task; w.handlers.notificationclick({ notification: { close() {}, data: { url } }, waitUntil: p => { task = p; } }); await task;
  }
  assert.equal(w.opened[0], "https://kisiseltakip.vercel.app/media/show1");
  assert.ok(w.opened.slice(1).every(url => url === "https://kisiseltakip.vercel.app/notifications"));
});
