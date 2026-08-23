/* ============================================================================
   Stock the Block — interactive network map

   A Leaflet map with three layers, in draw order:

     1. a choropleth of one published food-security indicator, by community
        district;
     2. the schools from STB.SITES plus the one operating receiving site,
        as pulsing markers;
     3. a SCHEMATIC of a run — animated lines from each school to its borough
        receiving point, with illustrative badges.

   Layer 3 is not a record of anything. Nothing has been delivered yet: the
   log is empty and there are no logged runs. So the whole layer is gated
   behind a banner that says so, its figures are marked illustrative, and it
   is off until the visitor asks for it. When the log has real entries, this
   is the seam to replace: feed drawSchematic() from the manifest and drop the
   "schematic" wording.

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

    var state = { geo: null, sites: null, choro: null, markers: [], routes: [], schematicOn: false };

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

    /* ---------- run schematic (explicitly not a record) ---------- */
    function drawSchematic() {
      clearSchematic();
      if (!state.schematicOn) return;
      var byBoro = {};
      placesForMap().forEach(function (p) {
        if (p.kind === "receiving") return;
        (byBoro[p.borough] = byBoro[p.borough] || []).push(p);
      });
      var recv = coordsFor("Receiving site");
      if (!recv) return;

      Object.keys(byBoro).forEach(function (b) {
        byBoro[b].forEach(function (p, i) {
          var c = coordsFor(p.name);
          if (!c) return;
          var line = L.polyline([[c.lat, c.lon], [recv.lat, recv.lon]], {
            pane: "routes",
            color: cssVar("--accent"),
            weight: 2,
            opacity: 0.75,
            dashArray: "6 8",
            className: "route-line" + (reduced ? "" : " route-animate")
          }).addTo(map);
          line.bindTooltip("Schematic route — no run has been logged on this pair",
            { sticky: true, className: "map-tip" });
          state.routes.push(line);

          /* One badge per borough, not per school: every route in a borough
             ends at the same receiving point, so per-school badges pile up
             into an unreadable stack. Sat a third of the way along the line
             from the school, which keeps it clear of both ends. */
          if (i !== 0) return;
          var t = 0.35;
          var mid = L.marker(
            [c.lat + (recv.lat - c.lat) * t, c.lon + (recv.lon - c.lon) * t],
            {
              pane: "routes",
              interactive: false,
              icon: L.divIcon({
                className: "",
                html: '<span class="route-badge">' + b + ' &middot; illustrative<br><em>no pounds recorded</em></span>',
                iconSize: [0, 0]
              })
            }
          );
          if (!reduced) {
            setTimeout(function () { mid.addTo(map); state.routes.push(mid); }, 400);
          } else {
            mid.addTo(map); state.routes.push(mid);
          }
        });
      });
    }

    function clearSchematic() {
      state.routes.forEach(function (r) { map.removeLayer(r); });
      state.routes = [];
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
          drawMarkers();
          drawSchematic();
          if (STB.siteState && STB.siteState.borough) flyToBorough(STB.siteState.borough);
        });
      }

      var toggle = document.getElementById("schematicToggle");
      if (toggle) {
        toggle.addEventListener("click", function () {
          state.schematicOn = !state.schematicOn;
          toggle.setAttribute("aria-pressed", state.schematicOn ? "true" : "false");
          toggle.textContent = state.schematicOn ? "Hide the run schematic" : "Show how a run will work";
          var nb = document.getElementById("schematicNote");
          if (nb) nb.hidden = !state.schematicOn;
          drawSchematic();
        });
      }

      /* Re-tile and re-colour on a theme switch: every colour above is read
         from a custom property, so the map follows the page. */
      var mo = new MutationObserver(function () {
        tiles.setUrl(TILES[isDarkTheme() ? "dark" : "light"]);
        if (state.choro) state.choro.setStyle(styleFor);
        drawSchematic();
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
