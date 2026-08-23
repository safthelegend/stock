/* ============================================================================
   Stock the Block — interactive network map

   Built for a pitch: it has to show that we understand the scale of food
   insecurity in New York, and what this looks like if it spreads. It plays
   as a four-act sequence.

     Act 1  the need      — choropleth of one published indicator, by
                            community district. Real, cited, and the counts
                            in the caption are computed from the data file.
     Act 2  today         — the schools from STB.SITES and the one operating
                            receiving site, with the routes a borough run is
                            designed to take. Real, and it says the log is
                            still empty.
     Act 3  if it spreads — anonymous dots blooming across the districts with
                            the highest need. HYPOTHETICAL. A banner stays on
                            screen the whole time it runs, the dots are never
                            named as real schools, and the counter is scenario
                            arithmetic, not a forecast.
     Act 4  the ask       — hold, and hand off to Join the Movement.

   The line between acts 1-2 and act 3 is the important one and it is drawn
   in the UI, not just in this comment. When the log has real entries, act 2
   is the seam to feed from the manifest.

   Leaflet is vendored at assets/vendor/leaflet/ — no CDN. Basemap tiles are
   the one third-party request this site makes; the footer says so.
   ========================================================================= */
(function (window, document) {
  "use strict";

  var L = window.L;
  var STB = window.STB;
  if (!L || !STB) return;

  var GEO_URL = "assets/geo/nyc-cd.geojson";
  var SITES_URL = "assets/geo/sites.json";

  /* Two CARTO basemaps, chosen to match whichever theme is active rather than
     forcing the page into dark. Attribution is required by both CARTO and
     OpenStreetMap and is rendered by Leaflet's own control. */
  var TILES = {
    dark: "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png",
    light: "https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
  };
  var TILE_ATTR =
    '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors, ' +
    '&copy; <a href="https://carto.com/attributions">CARTO</a>';

  /* Same five-class ramp and breakpoints the legend prints, so the map reads
     without colour. */
  var BREAKS = [10, 20, 30, 40];
  var RAMP_OPACITY = [0.22, 0.38, 0.55, 0.73, 0.9];

  function classOf(v) {
    if (v === null || v === undefined) return -1;
    for (var i = 0; i < BREAKS.length; i++) if (v < BREAKS[i]) return i;
    return BREAKS.length;
  }

  function cssVar(name) {
    return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  }
  function isDarkTheme() {
    var t = document.documentElement.getAttribute("data-theme");
    if (t === "dark" || t === "stock") return true;
    if (t === "light") return false;
    return window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches;
  }

  function initNetworkMap() {
    var host = document.getElementById("networkMap");
    if (!host || !window.fetch) return null;

    var reduced = STB.reduced;
    var statusOf = {};
    (STB.SITE_STATUS || []).forEach(function (s) { statusOf[s.key] = s.label; });

    var map = L.map(host, {
      zoomControl: true,
      attributionControl: true,
      /* Touch and wheel both start disabled so the map never steals a scroll.
         They are handed back once the visitor deliberately engages. */
      scrollWheelZoom: false,
      dragging: !L.Browser.mobile,
      tap: false,
      keyboard: true
    });

    var tiles = L.tileLayer(TILES[isDarkTheme() ? "dark" : "light"], {
      attribution: TILE_ATTR, maxZoom: 17, minZoom: 9, detectRetina: true
    }).addTo(map);

    /* Panes keep the draw order stable no matter what order things load in. */
    map.createPane("choro"); map.getPane("choro").style.zIndex = 400;
    map.createPane("routes"); map.getPane("routes").style.zIndex = 450;
    map.createPane("pins"); map.getPane("pins").style.zIndex = 600;

    var state = { geo: null, sites: null, choro: null, markers: [], routes: [], seeds: [] };
    var playBtn = document.getElementById("projectionPlay");

    /* ---------- interaction gate: never hijack a scroll ---------- */
    var gate = document.createElement("button");
    gate.type = "button";
    gate.className = "map-gate";
    gate.innerHTML = "<span>Tap to explore the map</span>";
    gate.setAttribute("aria-label", "Enable map panning and zooming");
    host.parentNode.insertBefore(gate, host.nextSibling);

    function engage() {
      map.dragging.enable();
      map.scrollWheelZoom.enable();
      host.classList.add("is-engaged");
      gate.hidden = true;
      map.invalidateSize();
    }
    gate.addEventListener("click", engage);
    host.addEventListener("focusin", engage);
    /* Releasing the wheel back to the page when the pointer leaves keeps long
       scrolls through the section smooth on a trackpad. */
    host.addEventListener("mouseleave", function () { map.scrollWheelZoom.disable(); });
    host.addEventListener("mouseenter", function () {
      if (host.classList.contains("is-engaged")) map.scrollWheelZoom.enable();
    });

    /* ---------- choropleth ---------- */
    function styleFor(feature) {
      var c = classOf(feature.properties.snap);
      return {
        pane: "choro",
        color: cssVar("--line") || "#888",
        weight: 1,
        dashArray: c < 0 ? "4 3" : null,
        fillColor: c < 0 ? cssVar("--bg") : cssVar("--brand"),
        fillOpacity: c < 0 ? 0.35 : RAMP_OPACITY[c]
      };
    }

    function drawChoropleth() {
      if (state.choro) map.removeLayer(state.choro);
      state.choro = L.geoJSON(state.geo, {
        pane: "choro",
        style: styleFor,
        onEachFeature: function (f, layer) {
          var p = f.properties;
          var val = p.snap === null ? "no published value" : p.snap + "%";
          layer.bindTooltip(
            '<strong>' + p.name + '</strong><br>' + p.borough + '<br>' + val,
            { sticky: true, className: "map-tip" }
          );
        }
      }).addTo(map);
    }

    /* ---------- markers ---------- */
    function pinFor(place, coords) {
      var live = place.status === "operating";
      var icon = L.divIcon({
        className: "",
        html:
          '<span class="pin-wrap' + (live && !reduced ? " pin-live" : "") + '">' +
            '<span class="pin-dot pin-' + place.status + '"></span>' +
            '<span class="pin-text">' + (statusOf[place.status] || place.status) + '</span>' +
          '</span>',
        iconSize: [14, 14],
        iconAnchor: [7, 7]
      });
      var m = L.marker([coords.lat, coords.lon], {
        pane: "pins", icon: icon, keyboard: true,
        alt: place.name + ", " + place.borough + ", " + (statusOf[place.status] || place.status),
        title: place.name
      });
      m.bindPopup(
        '<strong>' + place.name + '</strong>' +
        '<span class="pop-line">' + place.borough + '</span>' +
        '<span class="pop-line">' + (statusOf[place.status] || place.status) + '</span>' +
        (coords.precision === "borough"
          ? '<span class="pop-note">Exact location not published; pin is borough-level.</span>' : ""),
        { className: "map-pop-leaflet", closeButton: true }
      );
      return m;
    }

    function placesForMap() {
      var all = (STB.SITES || []).concat([STB.RECEIVING_SITE].filter(Boolean));
      return all.filter(function (p) {
        return STB.matchesSiteState ? STB.matchesSiteState(p) : true;
      });
    }

    function coordsFor(name) {
      for (var i = 0; i < state.sites.sites.length; i++) {
        if (state.sites.sites[i].name === name) return state.sites.sites[i];
      }
      return null;
    }

    function drawMarkers() {
      state.markers.forEach(function (m) { map.removeLayer(m); });
      state.markers = [];
      placesForMap().forEach(function (p, i) {
        var c = coordsFor(p.name);
        if (!c) return;
        var m = pinFor(p, c);
        m.addTo(map);
        state.markers.push(m);
        /* The pop-in sequence: markers arrive in turn rather than all at once.
           Under reduced motion they are simply there. */
        if (!reduced) {
          var elp = m.getElement();
          if (elp) {
            elp.style.opacity = "0";
            setTimeout(function () {
              elp.style.transition = "opacity 320ms ease, transform 320ms cubic-bezier(0.16,1,0.3,1)";
              elp.style.opacity = "1";
            }, 120 + i * 90);
          }
        }
      });
    }

    /* ---------- the projection sequence ----------
       A pitch needs to show two things: that we understand the scale of the
       need, and what this looks like if it spreads. Act 1 and 2 are real —
       the shading and the counts come from the data files. Act 3 is a
       hypothetical and is labelled as one on screen the whole time it runs.
       Nothing in Act 3 is a forecast, and none of its dots is a real school. */
    var HUD = {};
    function buildHud() {
      var shell = host.parentNode;
      var hud = document.createElement("div");
      hud.className = "map-hud";
      hud.innerHTML =
        '<div class="hud-counts" aria-hidden="true">' +
          '<span class="hud-stat"><b id="hudSchools">0</b><span>schools</span></span>' +
          '<span class="hud-stat"><b id="hudBoroughs">0</b><span>boroughs</span></span>' +
        '</div>' +
        '<p class="hud-caption" id="hudCaption" role="status"></p>' +
        '<p class="hud-flag" id="hudFlag" hidden>PROJECTION — illustrative scenario, not a forecast. No school below is real.</p>';
      shell.appendChild(hud);
      HUD.caption = hud.querySelector("#hudCaption");
      HUD.flag = hud.querySelector("#hudFlag");
      HUD.schools = hud.querySelector("#hudSchools");
      HUD.boroughs = hud.querySelector("#hudBoroughs");
    }

    function say(text) { if (HUD.caption) HUD.caption.textContent = text; }
    function setCount(el, v) { if (el) el.textContent = v; }

    /* Centroids come from the geometry itself rather than a second table. */
    function districtSeeds() {
      var out = [];
      state.choro.eachLayer(function (layer) {
        var p = layer.feature.properties;
        if (p.snap === null) return;
        var c = layer.getBounds().getCenter();
        out.push({ lat: c.lat, lon: c.lng, snap: p.snap, borough: p.borough });
      });
      /* Highest need first: the scenario spreads where the need is greatest. */
      return out.sort(function (a, b) { return b.snap - a.snap; });
    }

    var timers = [];
    function clearTimers() { timers.forEach(clearTimeout); timers = []; }
    function at(ms, fn) { timers.push(setTimeout(fn, ms)); }

    function clearProjection() {
      clearTimers();
      state.routes.forEach(function (r) { map.removeLayer(r); });
      state.routes = [];
      state.seeds.forEach(function (r) { map.removeLayer(r); });
      state.seeds = [];
      if (HUD.flag) HUD.flag.hidden = true;
      setCount(HUD.schools, 0); setCount(HUD.boroughs, 0);
    }

    function drawRoutes() {
      var recv = coordsFor("Receiving site");
      if (!recv) return;
      var byBoro = {};
      placesForMap().forEach(function (p) {
        if (p.kind === "receiving") return;
        (byBoro[p.borough] = byBoro[p.borough] || []).push(p);
      });
      Object.keys(byBoro).forEach(function (b) {
        byBoro[b].forEach(function (p, i) {
          var c = coordsFor(p.name);
          if (!c) return;
          var line = L.polyline([[c.lat, c.lon], [recv.lat, recv.lon]], {
            pane: "routes", color: cssVar("--accent"), weight: 2, opacity: 0.75,
            dashArray: "6 8",
            className: "route-line" + (reduced ? "" : " route-animate")
          }).addTo(map);
          line.bindTooltip("Illustrative route — no run has been logged on this pair",
            { sticky: true, className: "map-tip" });
          state.routes.push(line);
        });
      });
    }

    /* Act 3: dots bloom outward across districts, weighted to the highest
       need. They are anonymous on purpose — inventing named schools that have
       not agreed to anything is exactly what the rest of this site refuses
       to do. */
    function bloom(seeds, from, count, delayStep, done) {
      var placed = 0, boroughs = {};
      placesForMap().forEach(function (p) { boroughs[p.borough] = 1; });
      for (var i = from; i < from + count && i < seeds.length; i++) {
        (function (seed, n) {
          at(reduced ? 0 : (n - from) * delayStep, function () {
            var dot = L.circleMarker([seed.lat, seed.lon], {
              pane: "routes", radius: 0, weight: 1.5,
              color: cssVar("--accent"), fillColor: cssVar("--accent"), fillOpacity: 0.28
            }).addTo(map);
            dot.bindTooltip("Illustrative school — not a real building",
              { sticky: true, className: "map-tip" });
            state.seeds.push(dot);
            var r = 4 + Math.min(9, seed.snap / 5);
            if (reduced) { dot.setRadius(r); }
            else {
              var t0 = performance.now();
              (function grow(now) {
                var k = Math.min(1, (now - t0) / 420);
                dot.setRadius(r * (1 - Math.pow(1 - k, 3)));
                if (k < 1) requestAnimationFrame(grow);
              })(t0);
            }
            placed++;
            boroughs[seed.borough] = 1;
            setCount(HUD.schools, SCENARIO_BASE + (from - 0) + placed);
            setCount(HUD.boroughs, Object.keys(boroughs).length);
            if (placed === count && done) done();
          });
        })(seeds[i], i);
      }
    }

    var SCENARIO_BASE = 0;
    function runSequence() {
      clearProjection();
      var seeds = districtSeeds();
      var real = placesForMap().filter(function (p) { return p.kind !== "receiving"; }).length;
      SCENARIO_BASE = real;

      var above30 = 0, withData = 0;
      state.geo.features.forEach(function (f) {
        if (f.properties.snap === null) return;
        withData++;
        if (f.properties.snap > 30) above30++;
      });

      var t = 0;
      var step = reduced ? 0 : 1;

      /* Act 1 — the need. Real figures, straight from the data file. */
      say("New York City has " + withData + " community districts. In " + above30 +
          " of them, more than 30% of residents are on SNAP.");
      /* setView rather than a zero-duration flyTo: Leaflet's flyTo does not
         take kindly to a duration of 0. */
      var home = state.sites.boroughView.all;
      if (reduced) map.setView([home.lat, home.lon], home.zoom);
      else map.flyTo([home.lat, home.lon], home.zoom, { duration: 1.2 });

      /* Act 2 — where we actually are today. Also real. */
      t += 3200 * step;
      at(t, function () {
        setCount(HUD.schools, real);
        setCount(HUD.boroughs, Object.keys(placesForMap().reduce(function (a, p) {
          a[p.borough] = 1; return a;
        }, {})).length);
        say("Today: " + real + " schools tracked, one receiving site operating in Manhattan. The log is still empty.");
        drawRoutes();
      });

      /* Act 3 — the hypothetical. Flagged for as long as it is on screen. */
      t += 3400 * step;
      at(t, function () {
        if (HUD.flag) HUD.flag.hidden = false;
        say("If one school inspires the next: the pattern spreads to the districts where need is highest.");
        bloom(seeds, 0, Math.min(14, seeds.length), 150 * step);
      });
      t += 3000 * step;
      at(t, function () {
        say("Every district above 20% reached — one share table at a time.");
        bloom(seeds, 14, Math.min(13, Math.max(0, seeds.length - 14)), 120 * step);
      });
      t += 2800 * step;
      at(t, function () {
        say("Citywide: a student-run recovery network on top of the need map, feeding partner food banks in every borough.");
        bloom(seeds, 27, Math.max(0, seeds.length - 27), 70 * step);
      });

      /* Act 4 — hold, and hand off to the ask. */
      t += 3200 * step;
      at(t, function () {
        say("That is the shape of the idea. It starts with one receiving partner saying yes.");
        if (playBtn) { playBtn.textContent = "Replay the projection"; playBtn.disabled = false; }
      });
    }

    /* ---------- view control ---------- */
    function flyToBorough(b) {
      var v = state.sites.boroughView[b] || state.sites.boroughView.all;
      if (!v) return;
      map[reduced ? "setView" : "flyTo"]([v.lat, v.lon], v.zoom, { duration: 0.8 });
    }

    /* ---------- legend + citation ---------- */
    function paintLegend(meta) {
      var host2 = document.getElementById("networkMapLegend");
      if (host2) {
        var items = [];
        for (var i = 0; i <= BREAKS.length; i++) {
          var lo = i === 0 ? 0 : BREAKS[i - 1], hi = BREAKS[i];
          items.push('<span class="lg-item"><span class="lg-sw" style="background:var(--brand); opacity:' +
            RAMP_OPACITY[i] + '"></span>' + (hi === undefined ? lo + "% and over" : lo + "–" + hi + "%") + "</span>");
        }
        items.push('<span class="lg-item"><span class="lg-sw lg-nodata"></span>no data</span>');
        host2.innerHTML = items.join("");
      }
      var cite = document.getElementById("networkMapCite");
      if (cite) {
        cite.textContent = meta.indicator + " (" + meta.geography_level + "). Source: " +
          meta.indicator_source + ". Vintage: " + meta.indicator_vintage +
          ". Boundaries: NYC Department of City Planning via NYC Open Data.";
      }
    }

    /* ---------- load ---------- */
    Promise.all([
      fetch(GEO_URL).then(function (r) { return r.json(); }),
      fetch(SITES_URL).then(function (r) { return r.json(); })
    ]).then(function (res) {
      state.geo = res[0];
      state.sites = res[1];

      var v = state.sites.boroughView.all;
      map.setView([v.lat, v.lon], v.zoom);

      drawChoropleth();
      paintLegend(state.geo.meta);
      drawMarkers();

      /* The filter drives the map: one state, two views. */
      if (STB.onSiteState) {
        STB.onSiteState(function () {
          clearProjection();
          drawMarkers();
          if (playBtn) { playBtn.disabled = false; playBtn.textContent = "Play the projection"; }
          say("Filtered. Press play to run the projection again.");
          if (STB.siteState && STB.siteState.borough) flyToBorough(STB.siteState.borough);
        });
      }

      buildHud();
      say("Press play to see the need, where we are today, and what this looks like if it spreads.");

      if (playBtn) {
        playBtn.addEventListener("click", function () {
          playBtn.disabled = true;
          playBtn.textContent = "Playing…";
          runSequence();
        });
      }
      /* Plays itself the first time it scrolls into view, which is what a
         pitch surface should do. Never more than once, and never under
         reduced motion, where it jumps to the end instead. */
      if ("IntersectionObserver" in window) {
        var played = false;
        var io = new IntersectionObserver(function (es) {
          es.forEach(function (e) {
            if (!e.isIntersecting || played) return;
            played = true; io.disconnect();
            if (playBtn) { playBtn.disabled = true; playBtn.textContent = "Playing…"; }
            runSequence();
          });
        }, { threshold: 0.35 });
        io.observe(host);
      }

      /* Re-tile and re-colour on a theme switch: every colour above is read
         from a custom property, so the map follows the page. */
      var mo = new MutationObserver(function () {
        tiles.setUrl(TILES[isDarkTheme() ? "dark" : "light"]);
        if (state.choro) state.choro.setStyle(styleFor);
      });
      mo.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });

      host.setAttribute("data-ready", "true");
    })["catch"](function () {
      host.innerHTML = '<p class="map-fallback">The map could not be loaded. ' +
        'The school list above carries every school and its status.</p>';
      host.setAttribute("data-ready", "error");
      gate.hidden = true;
    });

    return { map: map, flyToBorough: flyToBorough };
  }

  STB.initNetworkMap = initNetworkMap;
})(window, document);
