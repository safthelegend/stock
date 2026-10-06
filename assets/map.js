/* ============================================================================
   Stock the Block — interactive network map

   Built for a pitch: it has to show that we understand the scale of food
   insecurity in New York, and what this looks like if it spreads. It plays
   as a four-act sequence.

     Act 1  the need      — choropleth of one published indicator, by
                            community district. Real, cited, and the counts
                            in the caption are computed from the data file.
     Act 2  our story     — real, in the order it happened: Stuyvesant and
                            the Essex Market fridge, then Midwood and a
                            Brooklyn fridge, then Brooklyn Tech, then the
                            schools we're in talks with. Ends on "today",
                            which is also where the map rests.
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
   the one third-party request the map makes, and only after a tap; the
   footer and privacy.html say so.
   ========================================================================= */
(function (window, document) {
  "use strict";

  var L = window.L;
  var STB = window.STB;
  if (!L || !STB) return;

  var GEO_URL = "assets/geo/nyc-cd.geojson";
  var SITES_URL = "assets/geo/sites.json";

  /* OpenStreetMap's own tiles. CARTO's free basemaps started stamping "API
     KEY REQUIRED" across the map, so they're gone. OSM's tiles are colourful,
     so design.css greys them (and inverts them in the dark themes) to sit
     quietly under the data. Attribution is required and rendered by
     Leaflet's own control. */
  var TILES = "https://tile.openstreetmap.org/{z}/{x}/{y}.png";
  var TILE_ATTR = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';

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
      /* Set here as well as on the tiles: the tiles load only after a tap,
         and the zoom control needs the range before that. */
      minZoom: 9, maxZoom: 17,
      /* Touch and wheel both start disabled so the map never steals a scroll.
         They are handed back once the visitor deliberately engages. */
      scrollWheelZoom: false,
      dragging: !L.Browser.mobile,
      tap: false,
      keyboard: true
    });

    L.control.zoom({ position: "bottomleft" }).addTo(map);

    /* The street background comes from OpenStreetMap, so loading it sends
       the visitor's IP address there. It waits until someone taps, clicks or
       focuses the map; until then the districts and pins (all served from
       this site) show on a plain background. See privacy.html. */
    var tiles = L.tileLayer(TILES, { attribution: TILE_ATTR, maxZoom: 17, minZoom: 9 });
    function loadTiles() { if (!map.hasLayer(tiles)) tiles.addTo(map); }
    host.addEventListener("pointerdown", loadTiles, { once: true });

    /* Panes keep the draw order stable no matter what order things load in. */
    map.createPane("choro"); map.getPane("choro").style.zIndex = 400;
    map.createPane("routes"); map.getPane("routes").style.zIndex = 450;
    map.createPane("pins"); map.getPane("pins").style.zIndex = 600;

    /* No pin clustering: with a handful of pins, merging them into "3 sites"
       bubbles hid the very schools the map is about. Overlapping labels are
       thinned out instead (declutterLabels). */
    var state = { geo: null, sites: null, choro: null, markers: [], routes: [], seeds: [], spotlit: null };

    /* ---------- interaction gate: never hijack a scroll ---------- */
    var gate = document.createElement("button");
    gate.type = "button";
    gate.className = "map-gate";
    gate.innerHTML = "<span>Tap to explore the map and show streets</span>";
    gate.setAttribute("aria-label", "Enable map panning and zooming");
    host.parentNode.insertBefore(gate, host.nextSibling);

    function engage() {
      loadTiles();
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

    /* ---------- markers ----------
       Schools wear their status (delivering pulses; in talks and planned
       never do). Fridges get their own square mark. */
    function pinFor(place, coords) {
      var fridge = place.kind === "receiving";
      var live = !fridge && place.status === "active";
      var label = fridge ? "Community fridge" : (statusOf[place.status] || place.status);
      var icon = L.divIcon({
        className: "",
        html:
          '<span class="pin-wrap' + (live && !reduced ? " pin-live" : "") + '">' +
            '<span class="pin-dot ' + (fridge ? "pin-fridge" : "pin-" + place.status) + '"></span>' +
            '<span class="pin-text">' + label + '</span>' +
          '</span>',
        iconSize: [14, 14],
        iconAnchor: [7, 7]
      });
      var m = L.marker([coords.lat, coords.lon], {
        pane: "pins", icon: icon, keyboard: true,
        alt: place.name + ", " + place.borough + ", " + label,
        title: place.name
      });
      var link = fridge
        ? (STB.SITES || []).filter(function (s) { return s.dropoff === place.name; }).map(function (s) { return s.name; })
        : (place.dropoff ? [place.dropoff] : []);
      m.bindPopup(
        '<strong>' + place.name + '</strong>' +
        '<span class="pop-line">' + place.borough + '</span>' +
        '<span class="pop-line">' + label + '</span>' +
        (link.length ? '<span class="pop-line">' + (fridge ? "Food from " : "Delivers to ") + link.join(", ") + '</span>' : "") +
        (coords.precision === "borough"
          ? '<span class="pop-note">Exact location not published; pin is borough-level.</span>' : ""),
        { className: "map-pop-leaflet", closeButton: true }
      );
      m.stbPlace = place;
      return m;
    }

    function placesForMap() {
      var all = (STB.SITES || []).concat(STB.RECEIVING_SITES || [STB.RECEIVING_SITE].filter(Boolean));
      return all.filter(function (p) {
        return STB.matchesSiteState ? STB.matchesSiteState(p) : true;
      });
    }

    // Delivering schools in the order they joined.
    function partners() {
      return (STB.SITES || []).filter(function (s) { return s.status === "active"; })
        .sort(function (a, b) { return (a.joined || 99) - (b.joined || 99); });
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
      ACT2: 7800, STEP: 2600,            /* our story: one step per partner, then "in talks" */
      TODAY: 18200,                      /* where the map rests */
      ACT3A: 21200, ACT3B: 24200, ACT3C: 27000, ACT4: 30200, END: 33300
    };
    var SEED_STOPS = [14, 27];   /* how far the bloom has got by 3B and 3C */

    var HUD = {};
    var clock = 0, speed = 1, playing = false, rafId = null, lastFrame = 0;
    /* True while the map shows its resting "today" view; the first Play then
       starts the story from the top rather than from where it rests. */
    var atRest = false;
    var ui = {};

    function buildHud() {
      var shell = host.parentNode;
      var hud = document.createElement("div");
      hud.className = "map-hud";
      hud.innerHTML =
        '<div class="hud-counts" aria-hidden="true">' +
          '<span class="hud-stat"><b id="hudSchools">0</b><span id="hudSchoolsLbl">partner schools</span></span>' +
          '<span class="hud-stat"><b id="hudBoroughs">0</b><span id="hudBoroughsLbl">fridges</span></span>' +
        '</div>' +
        '<p class="hud-caption" id="hudCaption" role="status"></p>';
      shell.appendChild(hud);
      HUD.caption = hud.querySelector("#hudCaption");
      HUD.schools = hud.querySelector("#hudSchools");
      HUD.boroughs = hud.querySelector("#hudBoroughs");
      HUD.schoolsLbl = hud.querySelector("#hudSchoolsLbl");
      HUD.boroughsLbl = hud.querySelector("#hudBoroughsLbl");

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

      ui.play.addEventListener("click", function () {
        if (!playing && atRest) { atRest = false; clock = 0; }
        playing ? pause() : play();
      });
      ui.scrub.addEventListener("input", function () { atRest = false; pause(); seek(+ui.scrub.value); });
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

    /* Real routes only: each delivering school to the fridge it delivers
       to, revealed in the order the schools joined. n = how many show. */
    function syncRoutes(n) {
      var pairs = partners().filter(function (p) { return p.dropoff && coordsFor(p.name) && coordsFor(p.dropoff); });
      n = Math.max(0, Math.min(n, pairs.length));
      while (state.routes.length > n) map.removeLayer(state.routes.pop());
      while (state.routes.length < n) {
        var p = pairs[state.routes.length], a = coordsFor(p.name), b = coordsFor(p.dropoff);
        var line = L.polyline([[a.lat, a.lon], [b.lat, b.lon]], {
          pane: "routes", color: cssVar("--brand"), weight: 3.5, opacity: 0.9, lineCap: "round",
          dashArray: "1 9", className: "route-line" + (reduced ? "" : " route-animate")
        }).addTo(map);
        line.bindTooltip(p.name + " → " + p.dropoff, { sticky: true, className: "map-tip" });
        state.routes.push(line);
      }
    }

    /* Which pins are lit at each point of the story. Pins that haven't come
       up yet are dimmed rather than hidden, so the map never jumps. */
    function syncPins(lit, focus) {
      state.markers.forEach(function (m) {
        var el = m.getElement();
        if (!el) return;
        var name = m.stbPlace.name;
        el.classList.toggle("pin-dim", !!lit && !lit[name]);
        el.classList.toggle("pin-focus", !!focus && !!focus[name]);
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
    function namesOf(list) { var o = {}; list.forEach(function (p) { o[p.name] = 1; }); return o; }
    function joinNames(list) {
      var n = list.map(function (p) { return p.name; });
      return n.length < 3 ? n.join(" and ") : n.slice(0, -1).join(", ") + ", and " + n[n.length - 1];
    }

    function renderAt(t) {
      var seeds = districtSeeds();
      var part = partners();
      var talks = (STB.SITES || []).filter(function (s) { return s.status === "conversation"; });
      var fridges = STB.RECEIVING_SITES || [];

      var withData = 0, above30 = 0;
      state.geo.features.forEach(function (f) {
        if (f.properties.snap === null) return;
        withData++;
        if (f.properties.snap > 30) above30++;
      });

      var spotIdx = -1;
      if (t >= TL.SPOT_AT && t < TL.ACT2) spotIdx = Math.floor((t - TL.SPOT_AT) / TL.SPOT_EACH);
      syncSpotlight(spotIdx);

      /* Our story: step k (0-based) brings in partner k and its fridge; the
         step after the last partner brings in the schools we're talking to. */
      var step = t < TL.ACT2 ? -1 : Math.min(part.length, Math.floor((t - TL.ACT2) / TL.STEP));
      var story = t >= TL.ACT2 && t < TL.TODAY;
      var shown = step < 0 ? [] : part.slice(0, Math.min(step + 1, part.length));
      var shownFridges = fridges.filter(function (f) { return shown.some(function (p) { return p.dropoff === f.name; }); });
      syncRoutes(t < TL.ACT2 ? 0 : t >= TL.TODAY ? part.length : shown.length);

      if (t < TL.ACT2) syncPins({}, null);                       // the need: every pin dimmed
      else if (story && step < part.length) {
        var p = part[step];
        var lit = namesOf(shown.concat(shownFridges));
        var focus = {}; focus[p.name] = 1; if (p.dropoff) focus[p.dropoff] = 1;
        syncPins(lit, focus);
      } else if (story) syncPins(namesOf(part.concat(fridges, talks)), namesOf(talks));
      else syncPins(null, null);                                 // today and beyond: all lit

      var nSeeds = 0;
      if (t >= TL.ACT3A) nSeeds = lerpCount(t, TL.ACT3A, TL.ACT3B, 0, SEED_STOPS[0]);
      if (t >= TL.ACT3B) nSeeds = lerpCount(t, TL.ACT3B, TL.ACT3C, SEED_STOPS[0], SEED_STOPS[1]);
      if (t >= TL.ACT3C) nSeeds = lerpCount(t, TL.ACT3C, TL.ACT4, SEED_STOPS[1], seeds.length);
      syncSeeds(nSeeds);

      if (HUD.mark) HUD.mark.hidden = t < TL.ACT3A;

      if (spotIdx >= 0 && spotIdx < TL.SPOT_N) {
        var sp = rankedDistricts()[spotIdx].feature.properties;
        say(sp.name + " — " + sp.snap + "% of residents on SNAP.");
      } else if (t < TL.ACT2) {
        say("New York City has " + withData + " community districts. In " + above30 +
            " of them, more than 30% of residents are on SNAP.");
      } else if (story && step === 0) {
        say("We started at " + part[0].name + (part[0].dropoff ? ", delivering to the " + part[0].dropoff + "." : "."));
      } else if (story && step < part.length) {
        var q = part[step], fr = q.dropoff && q.dropoff.indexOf("Brooklyn community fridge") === 0 ? "a community fridge in Brooklyn" : "the " + q.dropoff;
        say(step === part.length - 1 && !q.dropoff
          ? "We've just added " + q.name + "."
          : "Then " + q.name + " joined" + (q.dropoff ? ", delivering to " + fr + "." : "."));
      } else if (story) {
        say("Next, we're in talks with " + joinNames(talks) + ".");
      } else if (t < TL.ACT3A) {
        var boros = {};
        fridges.forEach(function (f) { boros[f.borough] = 1; });
        say("Today: " + part.length + " partner schools delivering to community fridges in " +
            Object.keys(boros).join(" and ") + ", and " + talks.length + " more schools in talks.");
      } else if (t < TL.ACT3B) {
        say("If one school inspires the next: the pattern spreads to the districts where need is highest.");
      } else if (t < TL.ACT3C) {
        say("Every district above 20% reached — one share table at a time.");
      } else if (t < TL.ACT4) {
        say("Citywide: a student-run recovery network on top of the need map, feeding food banks and community fridges in every borough.");
      } else {
        say("That's the idea. It grows one school, and one fridge, at a time.");
      }

      /* Counts: partner schools and fridges through our story; once the
         projection runs, schools (real plus illustrative) and boroughs. */
      var projecting = t >= TL.ACT3A;
      var nA = t < TL.ACT2 ? 0 : story ? shown.length : part.length;
      var nB = t < TL.ACT2 ? 0 : story ? shownFridges.length : fridges.length;
      if (HUD.schoolsLbl) HUD.schoolsLbl.textContent = projecting ? "schools" : nA === 1 ? "partner school" : "partner schools";
      if (HUD.boroughsLbl) HUD.boroughsLbl.textContent = projecting ? "boroughs" : nB === 1 ? "fridge" : "fridges";
      if (!projecting) {
        setCount(HUD.schools, nA);
        setCount(HUD.boroughs, nB);
      } else {
        var boroughs = {};
        part.forEach(function (pl) { boroughs[pl.borough] = 1; });
        for (var i = 0; i < nSeeds; i++) boroughs[seeds[i].borough] = 1;
        setCount(HUD.schools, part.length + nSeeds);
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
      syncRoutes(0); syncSeeds(0); syncSpotlight(-1); syncPins(null, null);
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
        /* Status key: the same pin marks the map draws, labelled from the
           same SITE_STATUS table the school list reads. */
        var keys = (STB.SITE_STATUS || []).map(function (st) {
          return '<span class="lg-item"><span class="lg-pin"><span class="pin-dot pin-' + st.key + '"></span></span>' + st.label + "</span>";
        });
        keys.push('<span class="lg-item"><span class="lg-pin"><span class="pin-dot pin-fridge"></span></span>Community fridge</span>');
        host2.innerHTML = '<span class="lg-title">% on SNAP</span>' + items.join("") +
          (keys.length ? '<span class="lg-sep" aria-hidden="true"></span><span class="lg-title">Sites</span>' + keys.join("") : "");
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

      /* No autoplay. The map opens on the real, sourced picture: the need
         shading, our partner schools, the fridges they deliver to and the
         schools we're talking to. Play tells the story from the start. */
      seek(TL.TODAY);
      atRest = true;

      /* Re-tile and re-colour on a theme switch: every colour above is read
         from a custom property, so the map follows the page. */
      var mo = new MutationObserver(function () {
        if (state.choro) state.choro.setStyle(styleFor);
        state.routes.forEach(function (r) { r.setStyle({ color: cssVar("--brand") }); });
      });
      mo.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });

      map.on("zoomend moveend", declutterLabels);
      host.setAttribute("data-ready", "true");
    })["catch"](function () {
      host.innerHTML = '<p class="map-fallback">The map could not be loaded. ' +
        'The full school list, with each school\u2019s status, is on the Getting started page.</p>';
      host.setAttribute("data-ready", "error");
      gate.hidden = true;
    });

    return { map: map, flyToBorough: flyToBorough };
  }

  STB.initNetworkMap = initNetworkMap;
})(window, document);
