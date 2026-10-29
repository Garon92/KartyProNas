// Uloží stránku do telefonu, aby fungovala i bez signálu.
// Při změně souborů zvyš číslo verze, ať se nová verze stáhne.
const CACHE = "kpn-v2";
const ASSETS = [
  "./",
  "index.html",
  "style.css",
  "app.js",
  "cards.js",
  "manifest.webmanifest",
  "icons/icon.svg",
  "icons/icon-192.png",
  "icons/icon-512.png",
  "icons/apple-touch-icon.png"
];

self.addEventListener("install", e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", e => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);

  // písmo z Google Fonts: z mezipaměti, a když tam není, stáhnout a uložit
  if (url.hostname === "fonts.googleapis.com" || url.hostname === "fonts.gstatic.com") {
    e.respondWith(
      caches.open(CACHE).then(c => c.match(req).then(hit => hit || fetch(req).then(res => {
        c.put(req, res.clone());
        return res;
      })))
    );
    return;
  }

  if (url.origin !== location.origin) return;

  // vlastní soubory: hned z mezipaměti a na pozadí stáhnout novější verzi
  e.respondWith(
    caches.open(CACHE).then(async c => {
      const key = req.mode === "navigate" ? "index.html" : req;
      const hit = await c.match(key, { ignoreSearch: true });
      const fresh = fetch(req).then(res => {
        if (res.ok) c.put(key, res.clone());
        return res;
      }).catch(() => hit);
      if (hit) {
        e.waitUntil(fresh);
        return hit;
      }
      return fresh;
    })
  );
});
