// Service worker: keeps the app working offline. By Callistus Aidoo.
// App files: served from the saved copy instantly, then refreshed in the background,
// so edits you push show up on the next open. You don't need to change anything here.
// Timetables: fetched fresh when online, saved copy when offline.
const CACHE = "umat-timetable";
const SHELL = [
  "./", "index.html", "privacy.html", "terms.html", "styles.css", "app.js", "parser.js", "manifest.webmanifest",
  "vendor/jspdf.umd.min.js", "vendor/jspdf.plugin.autotable.min.js", "vendor/xlsx.full.min.js",
  "icons/icon-192.png", "icons/icon-512.png",
  "timetables/campuses.json", "timetables/essikado.json", "timetables/tarkwa.json"
];
self.addEventListener("install", e => {
  e.waitUntil(caches.open(CACHE).then(c => Promise.all(SHELL.map(u => c.add(new Request(u, { cache: "reload" })).catch(() => {})))).then(() => self.skipWaiting()));
});
self.addEventListener("activate", e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
const keyFor = url => {
  const scope = new URL(self.registration.scope).pathname;
  let p = url.pathname.startsWith(scope) ? url.pathname.slice(scope.length) : url.pathname.replace(/^\//, "");
  return p === "" ? "./" : p;
};
self.addEventListener("fetch", e => {
  const url = new URL(e.request.url);
  if (e.request.method !== "GET" || url.origin !== location.origin) return;
  const key = keyFor(url);
  if (key.startsWith("timetables/")) { // network first
    e.respondWith(fetch(e.request, { cache: "no-cache" }).then(res => {
      if (res.ok) { const copy = res.clone(); caches.open(CACHE).then(c => c.put(key, copy)); }
      return res;
    }).catch(() => caches.match(key).then(hit => hit || Promise.reject(new Error("offline")))));
    return;
  }
  // stale while revalidate
  e.respondWith(caches.open(CACHE).then(async c => {
    const hit = await c.match(key) || await c.match(e.request, { ignoreSearch: true });
    const fresh = fetch(e.request, { cache: "no-cache" }).then(res => { if (res.ok) c.put(key, res.clone()); return res; }).catch(() => null);
    if (hit) { e.waitUntil(fresh); return hit; }
    return (await fresh) || (await c.match("index.html")) || Response.error();
  }));
});
