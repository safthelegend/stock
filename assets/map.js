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
      /* Zoom moves to the bottom-left: the top-left corner is where the
         projection watermark has to sit, and that notice outranks a control
         the visitor can reach anywhere. */
      zoomControl: false,
      attributionControl: true,
      /* Touch and wheel both start disabled so the map never steals a scroll.
         They are handed back once the visitor deliberately engages. */
      scrollWheelZoom: false,
      dragging: !L.Browser.mobile,
      tap: false,
      keyboard: true
    });

    L.control.zoom({ position: "bottomleft" }).addTo(map);

    var tiles = L.tileLayer(TILES[isDarkTheme() ? "dark" : "light"], {
      attribution: TILE_ATTR, maxZoom: 17, minZoom: 9, detectRetina: true
    }).addTo(map);

    /* Panes keep the draw order stable no matter what order things load in. */
    map.createPane("choro"); map.getPane("choro").style.zIndex = 400;
    map.createPane("routes"); map.getPane("routes").style.zIndex = 450;
    map.createPane("pins"); map.getPane("pins").style.zIndex = 600;

    var state = { geo: null, sites: null, choro: null, markers: [], routes: [], seeds: [], spotlit: null };


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
          /* A district lifts under the cursor: brighter edge, brought to the
             front so its outline is never clipped by a neighbour. Cheap, and
             it turns a flat fill into something that responds. */
          layer.on("mouseover", function () {
            if (state.spotlit === layer) return;
            layer.setStyle({ weight: 2.5, color: cssVar("--accent"), fillOpacity: Math.min(0.95, (styleFor(f).fillOpacity || 0.3) + 0.16) });
            layer.bringToFront();
          });
          layer.on("mouseout", function () {
            if (state.spotlit === layer) return;
            state.choro.resetStyle(layer);
          });
        }
      }).addTo(map);
    }

    /* Borough names, set once. Without a tile layer under it the outline is
       just shapes; with these it is a map of a city you know. */
    function drawBoroughLabels() {
      Object.keys(state.sites.boroughView).forEach(function (b) {
        if (b === "all") return;
        var v = state.sites.boroughView[b];
        L.marker([v.lat, v.lon], {
          pane: "choro", interactive: false,
          icon: L.divIcon({ className: "", html: '<span class="boro-label">' + b + '</span>', iconSize: [0, 0] })
        }).addTo(map);
      });
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

    /* Declutter. With nine markers the pins themselves rarely collide, but
       their status labels do — two Brooklyn schools a mile apart still overlap
       at citywide zoom. So the label is what gets hidden, per pair, measured
       in screen pixels at the current zoom and re-run whenever the view moves.
       The pin, its shape and its popup always stay: nothing is ever hidden
       that carries status on its own. */
    var LABEL_PAD = 92, LABEL_H = 20;
    function declutterLabels() {
      var boxes = [];
      state.markers.forEach(function (m) {
        var el = m.getElement();
        if (!el) return;
        var lbl = el.querySelector(".pin-text");
        if (!lbl) return;
        var pt = map.latLngToContainerPoint(m.getLatLng());
        var box = { x: pt.x, y: pt.y, w: LABEL_PAD, h: LABEL_H };
        var clash = boxes.some(function (b) {
          return Math.abs(b.x - box.x) < (b.w + box.w) / 2 && Math.abs(b.y - box.y) < b.h;
        });
        el.classList.toggle("pin-muted", clash);
        if (!clash) boxes.push(box);
      });
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
      declutterLabels();
    }

    /* ---------- the projection, as a timeline ----------
       Everything below is a pure function of one number: the playhead, in ms.
       renderAt(t) rebuilds the whole projection state from scratch for any t,
       which is what makes pause, speed and scrubbing possible at all — you
       cannot scrub a pile of setTimeouts. The engine only moves the playhead;
       it never knows what any act contains.

       Acts 1 and 2 are real and sourced. Act 3 is a hypothetical, and the
       watermark inside the map frame says so for as long as it is on screen. */
    var TL = {
      ACT1: 0, SPOT_AT: 2600, SPOT_EACH: 1250, SPOT_N: 4,
      ACT2: 7800, ACT3A: 11400, ACT3B: 14400, ACT3C: 17200, ACT4: 20400, END: 23500
    };
    var SEED_STOPS = [14, 27];   /* how far the bloom has got by 3B and 3C */

    var HUD = {};
    var clock = 0, speed = 1, playing = false, rafId = null, lastFrame = 0;
    var ui = {};

    function buildHud() {
      var shell = host.parentNode;
      var hud = document.createElement("div");
      hud.className = "map-hud";
      hud.innerHTML =
        '<div class="hud-counts" aria-hidden="true">' +
          '<span class="hud-stat"><b id="hudSchools">0</b><span>schools</span></span>' +
          '<span class="hud-stat"><b id="hudBoroughs">0</b><span>boroughs</span></span>' +
        '</div>' +
        '<p class="hud-caption" id="hudCaption" role="status"></p>';
      shell.appendChild(hud);
      HUD.caption = hud.querySelector("#hudCaption");
      HUD.schools = hud.querySelector("#hudSchools");
      HUD.boroughs = hud.querySelector("#hudBoroughs");

      /* The disambiguation watermark lives inside the map frame, not in the
         page flow, so it cannot be scrolled away from the thing it qualifies. */
      var mark = document.createElement("p");
      mark.className = "map-watermark";
      mark.id = "projWatermark";
      mark.hidden = true;
      mark.innerHTML = '<strong>PROJECTION</strong> illustrative scenario — not a forecast, and no dot is a real school';
      shell.appendChild(mark);
      HUD.mark = mark;

      var bar = document.createElement("div");
      bar.className = "map-playbar";
      bar.innerHTML =
        '<button type="button" class="pb-btn pb-play" id="pbPlay" aria-label="Play the projection">' +
          '<span class="pb-icon" aria-hidden="true"></span></button>' +
        '<input type="range" class="pb-scrub" id="pbScrub" min="0" max="' + TL.END + '" step="100" value="0" ' +
          'aria-label="Projection timeline" aria-valuetext="Start">' +
        '<span class="pb-time" id="pbTime">0:00</span>' +
        '<span class="pb-speeds" role="group" aria-label="Playback speed">' +
          [1, 2, 5].map(function (x) {
            return '<button type="button" class="pb-rate" data-speed="' + x + '" aria-pressed="' +
              (x === 1) + '">' + x + '×</button>';
          }).join("") +
        '</span>';
      shell.appendChild(bar);
      ui.play = bar.querySelector("#pbPlay");
      ui.scrub = bar.querySelector("#pbScrub");
      ui.time = bar.querySelector("#pbTime");
      ui.rates = [].slice.call(bar.querySelectorAll(".pb-rate"));

      ui.play.addEventListener("click", function () { playing ? pause() : play(); });
      ui.scrub.addEventListener("input", function () { pause(); seek(+ui.scrub.value); });
      ui.rates.forEach(function (b) {
        b.addEventListener("click", function () {
          speed = +b.getAttribute("data-speed");
          ui.rates.forEach(function (o) { o.setAttribute("aria-pressed", o === b ? "true" : "false"); });
        });
      });
    }

    function say(text) { if (HUD.caption && HUD.caption.textContent !== text) HUD.caption.textContent = text; }
    function setCount(el, v) { if (el && el.textContent !== String(v)) el.textContent = String(v); }
    function fmtTime(ms) {
      var s = Math.round(ms / 1000);
      return Math.floor(s / 60) + ":" + ("0" + (s % 60)).slice(-2);
    }

    /* Centroids come from the geometry itself rather than a second table,
       ordered by need so the scenario spreads where the need is greatest. */
    var seedCache = null;
    function districtSeeds() {
      if (seedCache) return seedCache;
      var out = [];
      state.choro.eachLayer(function (layer) {
        var p = layer.feature.properties;
        if (p.snap === null) return;
        var c = layer.getBounds().getCenter();
        out.push({ lat: c.lat, lon: c.lng, snap: p.snap, borough: p.borough });
      });
      out.sort(function (a, b) { return b.snap - a.snap; });
      seedCache = out;
      return out;
    }
    var rankedCache = null;
    function rankedDistricts() {
      if (rankedCache) return rankedCache;
      var r = [];
      state.choro.eachLayer(function (l) {
        if (l.feature && l.feature.properties.snap !== null) r.push(l);
      });
      r.sort(function (a, b) { return b.feature.properties.snap - a.feature.properties.snap; });
      rankedCache = r;
      return r;
    }

    /* ---------- idempotent layer sync ---------- */
    function syncSpotlight(idx) {
      var want = idx >= 0 && idx < TL.SPOT_N ? rankedDistricts()[idx] : null;
      if (state.spotlit === want) return;
      if (state.spotlit) { var prev = state.spotlit; state.spotlit = null; state.choro.resetStyle(prev); }
      state.spotlit = want;
      if (want) {
        want.setStyle({ weight: 3, color: cssVar("--accent"), fillOpacity: 0.95 });
        want.bringToFront();
      }
    }

    function syncRoutes(on) {
      if (on === (state.routes.length > 0)) return;
      if (!on) {
        state.routes.forEach(function (r) { map.removeLayer(r); });
        state.routes = [];
        return;
      }
      var recv = coordsFor("Receiving site");
      if (!recv) return;
      placesForMap().forEach(function (p) {
        if (p.kind === "receiving") return;
        var c = coordsFor(p.name);
        if (!c) return;
        var line = L.polyline([[c.lat, c.lon], [recv.lat, recv.lon]], {
          pane: "routes", color: cssVar("--accent"), weight: 2, opacity: 0.75,
          dashArray: "6 8", className: "route-line" + (reduced ? "" : " route-animate")
        }).addTo(map);
        line.bindTooltip("Illustrative route — no run has been logged on this pair",
          { sticky: true, className: "map-tip" });
        state.routes.push(line);
      });
    }

    /* Anonymous on purpose: inventing named schools that have not agreed to
       anything is the one thing the rest of this site refuses to do. */
    function syncSeeds(n) {
      var seeds = districtSeeds();
      n = Math.max(0, Math.min(n, seeds.length));
      while (state.seeds.length > n) map.removeLayer(state.seeds.pop());
      while (state.seeds.length < n) {
        var seed = seeds[state.seeds.length];
        var dot = L.circleMarker([seed.lat, seed.lon], {
          pane: "routes", radius: 4 + Math.min(9, seed.snap / 5), weight: 1.5,
          color: cssVar("--accent"), fillColor: cssVar("--accent"), fillOpacity: 0.3,
          className: "seed-dot"
        }).addTo(map);
        dot.bindTooltip("Illustrative school — not a real building",
          { sticky: true, className: "map-tip" });
        state.seeds.push(dot);
      }
    }

    function lerpCount(t, t0, t1, n0, n1) {
      if (t <= t0) return n0;
      if (t >= t1) return n1;
      return Math.round(n0 + (n1 - n0) * (t - t0) / (t1 - t0));
    }

    /* ---------- the one render function ---------- */
    function renderAt(t) {
      var real = placesForMap().filter(function (p) { return p.kind !== "receiving"; }).length;
      var seeds = districtSeeds();

      var withData = 0, above30 = 0;
      state.geo.features.forEach(function (f) {
        if (f.properties.snap === null) return;
        withData++;
        if (f.properties.snap > 30) above30++;
      });

      var spotIdx = -1;
      if (t >= TL.SPOT_AT && t < TL.ACT2) spotIdx = Math.floor((t - TL.SPOT_AT) / TL.SPOT_EACH);
      syncSpotlight(spotIdx);

      syncRoutes(t >= TL.ACT2);

      var nSeeds = 0;
      if (t >= TL.ACT3A) nSeeds = lerpCount(t, TL.ACT3A, TL.ACT3B, 0, SEED_STOPS[0]);
      if (t >= TL.ACT3B) nSeeds = lerpCount(t, TL.ACT3B, TL.ACT3C, SEED_STOPS[0], SEED_STOPS[1]);
      if (t >= TL.ACT3C) nSeeds = lerpCount(t, TL.ACT3C, TL.ACT4, SEED_STOPS[1], seeds.length);
      syncSeeds(nSeeds);

      if (HUD.mark) HUD.mark.hidden = t < TL.ACT3A;

      if (spotIdx >= 0 && spotIdx < TL.SPOT_N) {
        var p = rankedDistricts()[spotIdx].feature.properties;
        say(p.name + " — " + p.snap + "% of residents on SNAP.");
      } else if (t < TL.ACT2) {
        say("New York City has " + withData + " community districts. In " + above30 +
            " of them, more than 30% of residents are on SNAP.");
      } else if (t < TL.ACT3A) {
        say("Today: " + real + " schools tracked, one receiving site operating in Manhattan. The log is still empty.");
      } else if (t < TL.ACT3B) {
        say("If one school inspires the next: the pattern spreads to the districts where need is highest.");
      } else if (t < TL.ACT3C) {
        say("Every district above 20% reached — one share table at a time.");
      } else if (t < TL.ACT4) {
        say("Citywide: a student-run recovery network on top of the need map, feeding partner food banks in every borough.");
      } else {
        say("That is the shape of the idea. It starts with one receiving partner saying yes.");
      }

      var boroughs = {};
      placesForMap().forEach(function (pl) { boroughs[pl.borough] = 1; });
      if (t < TL.ACT2) { setCount(HUD.schools, 0); setCount(HUD.boroughs, 0); }
      else {
        setCount(HUD.schools, real + nSeeds);
        for (var i = 0; i < nSeeds; i++) boroughs[seeds[i].borough] = 1;
        setCount(HUD.boroughs, Object.keys(boroughs).length);
      }

      if (ui.scrub && +ui.scrub.value !== Math.round(t)) ui.scrub.value = Math.round(t);
      if (ui.time) ui.time.textContent = fmtTime(t) + " / " + fmtTime(TL.END);
      if (ui.scrub) ui.scrub.setAttribute("aria-valuetext", HUD.caption ? HUD.caption.textContent : fmtTime(t));
    }

    /* ---------- transport ---------- */
    function setPlayUI() {
      if (!ui.play) return;
      ui.play.classList.toggle("is-playing", playing);
      ui.play.setAttribute("aria-label", playing ? "Pause the projection" : "Play the projection");
    }
    function seek(t) { clock = Math.max(0, Math.min(t, TL.END)); renderAt(clock); }
    function pause() {
      playing = false;
      if (rafId) { cancelAnimationFrame(rafId); rafId = null; }
      setPlayUI();
    }
    function play() {
      if (clock >= TL.END) clock = 0;
      playing = true; setPlayUI();
      lastFrame = performance.now();
      /* Reduced motion gets the finished state rather than a fast one. */
      if (reduced) { seek(TL.END); pause(); return; }
      (function frame(now) {
        if (!playing) return;
        clock += (now - lastFrame) * speed;
        lastFrame = now;
        if (clock >= TL.END) { seek(TL.END); pause(); return; }
        renderAt(clock);
        rafId = requestAnimationFrame(frame);
      })(lastFrame);
    }
    function clearProjection() {
      pause();
      clock = 0;
      syncRoutes(false); syncSeeds(0); syncSpotlight(-1);
      if (HUD.mark) HUD.mark.hidden = true;
      renderAt(0);
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
        /* The legend belongs over the data it explains, not in a strip
           underneath it. Moved onto the map as a floating card. */
        var shell = host.parentNode;
        if (host2.parentNode !== shell) { host2.classList.add("map-legend-card"); shell.appendChild(host2); }
        host2.setAttribute("aria-label", "Legend: " + meta.indicator);
        var items = [];
        for (var i = 0; i <= BREAKS.length; i++) {
          var lo = i === 0 ? 0 : BREAKS[i - 1], hi = BREAKS[i];
          items.push('<span class="lg-item"><span class="lg-sw" style="background:var(--brand); opacity:' +
            RAMP_OPACITY[i] + '"></span>' + (hi === undefined ? lo + "% and over" : lo + "–" + hi + "%") + "</span>");
        }
        items.push('<span class="lg-item"><span class="lg-sw lg-nodata"></span>no data</span>');
        host2.innerHTML = '<span class="lg-title">% on SNAP</span>' + items.join("");
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
      drawBoroughLabels();
      paintLegend(state.geo.meta);
      drawMarkers();

      /* The filter drives the map: one state, two views. */
      if (STB.onSiteState) {
        STB.onSiteState(function () {
          clearProjection();
          drawMarkers();
          if (STB.siteState && STB.siteState.borough) flyToBorough(STB.siteState.borough);
        });
      }

      buildHud();
      renderAt(0);


      /* Plays itself the first time it scrolls into view, which is what a
         pitch surface should do. Never more than once, and never under
         reduced motion, where it jumps to the end instead. */
      if ("IntersectionObserver" in window) {
        var played = false;
        var io = new IntersectionObserver(function (es) {
          es.forEach(function (e) {
            if (!e.isIntersecting || played) return;
            played = true; io.disconnect();
            play();
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

      map.on("zoomend moveend", declutterLabels);
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
