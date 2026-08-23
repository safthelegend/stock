/* ============================================================================
   Stock the Block — service worker

   Two strategies, chosen by what the request is for:

     cache-first   for the things that rarely change and are expensive to
                   re-fetch: the stylesheet, the script, web fonts, and the
                   self-hosted video poster/clip. Served from cache the moment
                   it exists, revalidated in the background.

     network-first for HTML. A stale page is worse than a slow one here,
                   because the whole point of this site is a log that changes.
                   Falls back to cache when the network fails, which is what
                   makes the offline state work at all.

   CACHE_VERSION is the only thing to bump on release. Changing it changes the
   cache name, and activate() deletes every cache that is not the current one,
   so old entries are purged rather than accumulating.
   ============================================================================ */
"use strict";

var CACHE_VERSION = "v4";
var CACHE = "stb-" + CACHE_VERSION;

/* Precached on install. Relative to the worker's scope, so this keeps working
   under /stock/ without any absolute paths. */
var PRECACHE = [
  "./",
  "index.html",
  "getting-started.html",
  "404.html",
  "assets/site.css",
  "assets/site.js",
  "assets/map.js",
  "assets/vendor/leaflet/leaflet.js",
  "assets/vendor/leaflet/leaflet.css",
  "assets/geo/nyc-cd.geojson",
  "assets/geo/sites.json",
  "sw.js"
];

self.addEventListener("install", function (e) {
  e.waitUntil(
    caches.open(CACHE).then(function (c) {
      /* addAll rejects the whole batch if any single entry 404s, which would
         leave the worker uninstalled. Add them individually instead. */
      return Promise.all(PRECACHE.map(function (u) {
        return c.add(new Request(u, { cache: "reload" })).catch(function () {});
      }));
    }).then(function () { return self.skipWaiting(); })
  );
});

self.addEventListener("activate", function (e) {
  e.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(keys.map(function (k) {
        return k === CACHE ? null : caches.delete(k);
      }));
    }).then(function () { return self.clients.claim(); })
  );
});

function isHTML(req) {
  if (req.mode === "navigate") return true;
  var a = req.headers.get("accept") || "";
  return a.indexOf("text/html") > -1;
}

function isStatic(url) {
  return /\.(?:css|js|woff2?|ttf|otf|eot|mp4|webm|jpe?g|png|svg|webp|avif)$/i.test(url.pathname) ||
         /fonts\.(?:googleapis|gstatic)\.com$/.test(url.hostname);
}

/* Network-first: try the network, cache what comes back, fall back to cache,
   then to the offline page if even that misses. */
function networkFirst(e) {
  return fetch(e.request).then(function (res) {
    if (res && res.ok) {
      var copy = res.clone();
      caches.open(CACHE).then(function (c) { c.put(e.request, copy); });
    }
    return res;
  }).catch(function () {
    return caches.match(e.request, { ignoreSearch: true }).then(function (hit) {
      return hit || caches.match("index.html") || caches.match("./");
    });
  });
}

/* Cache-first: serve the cached copy immediately, then refresh it in the
   background so the next load is current without ever blocking on the
   network. */
function cacheFirst(e) {
  return caches.match(e.request).then(function (hit) {
    var net = fetch(e.request).then(function (res) {
      if (res && (res.ok || res.type === "opaque")) {
        var copy = res.clone();
        caches.open(CACHE).then(function (c) { c.put(e.request, copy); });
      }
      return res;
    }).catch(function () { return hit; });
    return hit || net;
  });
}

self.addEventListener("fetch", function (e) {
  var req = e.request;
  if (req.method !== "GET") return;

  var url;
  try { url = new URL(req.url); } catch (err) { return; }
  /* Leave anything that is not http(s) alone — extension and data URLs are
     not ours to cache. */
  if (url.protocol !== "http:" && url.protocol !== "https:") return;

  if (isHTML(req)) { e.respondWith(networkFirst(e)); return; }
  if (isStatic(url)) { e.respondWith(cacheFirst(e)); return; }
  /* Everything else: plain network, with a cache fallback if it is offline. */
  e.respondWith(fetch(req).catch(function () { return caches.match(req); }));
});
