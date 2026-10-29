// Uloží stránku do telefonu, aby fungovala i bez signálu.
// Při změně souborů zvyš číslo verze, ať se nová verze stáhne.
const CACHE = "kpn-v3";
const FONTS = "kpn-fonts";   // písmo má vlastní mezipaměť, aby přežilo i změnu verze
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

// při instalaci nové verze stáhnout všechno znovu ze serveru, ne z mezipaměti prohlížeče,
// jinak se může uložit nové index.html se starým app.js
self.addEventListener("install", e => {
  const fresh = ASSETS.map(u => new Request(u, { cache: "reload" }));
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(fresh)).then(() => self.skipWaiting()));
});

const isFont = url => url.hostname === "fonts.googleapis.com" || url.hostname === "fonts.gstatic.com";

self.addEventListener("activate", e => {
  e.waitUntil((async () => {
    const fonts = await caches.open(FONTS);
    for (const key of await caches.keys()) {
      // na github.io sdílí stejný původ i jiné stránky, mazat jen vlastní staré verze
      if (!key.startsWith("kpn-") || key === CACHE || key === FONTS) continue;
      // písmo uložené starší verzí přenést, ať funguje bez internetu hned po aktualizaci
      const old = await caches.open(key);
      for (const req of await old.keys()) {
        if (!isFont(new URL(req.url))) continue;
        const res = await old.match(req);
        if (res) await fonts.put(req, res);
      }
      await caches.delete(key);
    }
    await self.clients.claim();
  })());
});

self.addEventListener("fetch", e => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);

  // písmo z Google Fonts: z mezipaměti, a když tam není, stáhnout a uložit
  if (isFont(url)) {
    e.respondWith(
      caches.open(FONTS).then(c => c.match(req).then(hit => hit || fetch(req).then(res => {
        if (res.ok || res.type === "opaque") c.put(req, res.clone());
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
      const fresh = fetch(req, { cache: "no-cache" }).then(res => {
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
