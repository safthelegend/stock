/* ============================================================================
   Stock the Block — shared behaviour
   ----------------------------------------------------------------------------
   Everything here was identical in index.html and getting-started.html. It is
   copied over verbatim; the only structural change is that the reusable pieces
   now hang off a single global, STB, instead of being duplicated inside each
   page's IIFE.

   Page-specific script stays inline in that page, after this file.

   No build step. Load with:  <script src="assets/site.js"></script>
   ============================================================================ */
(function (global) {
  "use strict";

var $ = function (s, r) { return (r || document).querySelector(s); };
var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
var reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
var mob = innerWidth < 768;
var f = mob ? 0.5 : 1;
var EXP = "cubic-bezier(0.4, 0.14, 0.3, 1)", PRO = "cubic-bezier(0.2, 0, 0.38, 0.9)";

/* Icon set: redrawn from Lucide (ISC-licensed, lucide.dev) at 24x24, stroke-based, inlined
   rather than loaded from a CDN so the site keeps its zero-external-script footprint. */
var ICONS = {
  package: '<path d="m7.5 4.27 9 5.15"></path><path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z"></path><path d="m3.3 7 8.7 5 8.7-5"></path><path d="M12 22V12"></path>',
  archive: '<rect width="20" height="5" x="2" y="3" rx="1"></rect><path d="M4 8v11a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8"></path><path d="M10 12h4"></path>',
  truck: '<path d="M14 18V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v11a1 1 0 0 0 1 1h2"></path><path d="M15 18H9"></path><path d="M19 18h2a1 1 0 0 0 1-1v-3.65a1 1 0 0 0-.22-.624l-3.48-4.35A1 1 0 0 0 17.52 8H14"></path><circle cx="17" cy="18" r="2"></circle><circle cx="7" cy="18" r="2"></circle>',
  "clipboard-check": '<rect width="8" height="4" x="8" y="2" rx="1"></rect><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"></path><path d="m9 14 2 2 4-4"></path>',
  "shield-check": '<path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z"></path><path d="m9 12 2 2 4-4"></path>',
  ruler: '<path d="M21.3 15.3a2.4 2.4 0 0 1 0 3.4l-2.6 2.6a2.4 2.4 0 0 1-3.4 0L2.7 8.7a2.4 2.4 0 0 1 0-3.4l2.6-2.6a2.4 2.4 0 0 1 3.4 0Z"></path><path d="m14.5 12.5 2-2"></path><path d="m11.5 9.5 2-2"></path><path d="m8.5 6.5 2-2"></path><path d="m17.5 15.5 2-2"></path>',
  "file-text": '<path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"></path><path d="M14 2v4a2 2 0 0 0 2 2h4"></path><path d="M10 9H8"></path><path d="M16 13H8"></path><path d="M16 17H8"></path>',
  cpu: '<rect x="4" y="4" width="16" height="16" rx="2"></rect><rect x="9" y="9" width="6" height="6"></rect><path d="M15 2v2"></path><path d="M15 20v2"></path><path d="M9 2v2"></path><path d="M9 20v2"></path><path d="M2 15h2"></path><path d="M2 9h2"></path><path d="M20 15h2"></path><path d="M20 9h2"></path>',
  "clipboard-list": '<rect width="8" height="4" x="8" y="2" rx="1"></rect><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"></path><path d="M12 11h4"></path><path d="M12 16h4"></path><path d="M8 11h.01"></path><path d="M8 16h.01"></path>',
  users: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M22 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path>',
  "map-pin": '<path d="M20 10c0 4.993-5.539 10.193-7.399 11.799a1 1 0 0 1-1.202 0C9.539 20.193 4 14.993 4 10a8 8 0 0 1 16 0"></path><circle cx="12" cy="10" r="3"></circle>',
  handshake: '<path d="m11 17 2 2a1 1 0 1 0 3-3"></path><path d="m14 14 2.5 2.5a1 1 0 1 0 3-3l-3.88-3.88a3 3 0 0 0-4.24 0l-.88.88a1 1 0 1 1-3-3l2.81-2.81a5.79 5.79 0 0 1 7.06-.87l.47.28a2 2 0 0 0 1.42.25L21 4"></path><path d="m21 3 1 11h-2"></path><path d="M3 3 2 14l6.5 6.5a1 1 0 1 0 3-3"></path><path d="M3 4h8"></path>'
};
function iconSVG(name, size) {
  size = size || 20;
  return '<svg class="step-icon" width="' + size + '" height="' + size + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + (ICONS[name] || "") + "</svg>";
}
function initIcons(root) {
  $$("[data-icon]", root).forEach(function (el) {
    if (el.dataset.iconInit) return;
    el.dataset.iconInit = "1";
    el.insertAdjacentHTML("afterbegin", iconSVG(el.getAttribute("data-icon")));
  });
}

/* ---------- mascot component ---------- */
var MASCOT_EYES = {
  idle:      { l: "M63 163 L96 131 L128 163", r: "M182 163 L215 131 L247 163", w: 14 },
  warm:      { l: "M63 163 L96 131 L128 163", r: "M182 163 L215 131 L247 163", w: 14 },
  record:    { l: "M95 146 L96 147 L97 146", r: "M214 146 L215 147 L216 146", w: 38 },
  confirmed: { l: "M63 158 L96 126 L128 158", r: "M182 158 L215 126 L247 158", w: 14 },
  empty:     { l: "M63 150 L96 150 L128 150", r: "M182 150 L215 150 L247 150", w: 14 },
  active:    { l: "M63 141 L96 148 L128 156", r: "M182 156 L215 148 L247 141", w: 14 },
  collect:   { l: "M63 150 L96 122 L128 150", r: "M182 150 L215 122 L247 150", w: 14 },
  pack:      { l: "M63 138 L96 166 L128 138", r: "M182 138 L215 166 L247 138", w: 14 },
  deliver:   { l: "M63 160 L96 134 L128 160", r: "M182 160 L215 134 L247 160", w: 14 },
  neutral:   { l: "M63 158 L96 138 L128 158", r: "M182 158 L215 138 L247 158", w: 14 },
  inrange:   { l: "M74 152 L96 136 L118 152", r: "M193 152 L215 136 L237 152", w: 13 },
  danger:    { l: "M74 146 L96 158 L118 146", r: "M193 146 L215 158 L237 146", w: 13 }
};
var MASCOT_SMILE = {
  idle: "M110 184 Q151 212 193 184", warm: "M110 180 Q151 226 193 180",
  record: "M125 190 L177 190", confirmed: "M110 184 Q151 212 193 184",
  empty: "M130 186 Q151 196 172 186", active: "M125 190 L177 190",
  collect: "M120 186 Q151 208 182 186", pack: "M124 190 L178 190",
  deliver: "M112 184 Q151 210 190 184", neutral: "M118 188 L184 188",
  inrange: "M118 202 Q151 222 184 202", danger: "M124 205 L178 205"
};
var MASCOT_LID = { collect: "translateY(-9px) rotate(-13deg)", pack: "translateY(-4px) rotate(-5deg)" };
var MASCOT_LEAN = { deliver: "rotate(5deg)" };

function mascotSVG(state, opts) {
  opts = opts || {};
  state = MASCOT_EYES[state] ? state : "idle";
  var e = MASCOT_EYES[state], smile = MASCOT_SMILE[state];
  var bare = !!opts.bare, faceless = !!opts.faceless, glasses = !!opts.glasses && !faceless;
  var fill = opts.fill || "var(--mascot-fill)";
  var lidT = MASCOT_LID[state] || "rotate(0deg)";
  var leanT = MASCOT_LEAN[state] || "rotate(0deg)";
  var breatheAnim = opts.breathe ? "lidBreathe 4s ease-in-out infinite" : "none";
  var blinkLAnim = opts.blink ? "blinkL 6s ease-in-out infinite" : "none";
  var blinkRAnim = opts.blink ? "blinkR 6.4s ease-in-out infinite" : "none";
  var informative = !!opts.informative;
  var label = opts.label || "Stock the Block mascot";
  var isRecord = state === "record", isConfirmed = state === "confirmed";
  var bodyMk = bare ? "" : (
    '<rect x="20" y="20" width="260" height="200" rx="28" fill="' + fill + '" style="stroke:var(--mascot-stroke);" stroke-width="12"></rect>' +
    '<g data-lid-g style="transform:' + lidT + ';transform-origin:150px 93px;transition:transform 340ms cubic-bezier(0.16,1,0.3,1);">' +
      '<path d="M26 93 L274 93" fill="none" stroke-width="12" style="stroke:var(--mascot-stroke); animation:' + breatheAnim + ';"></path>' +
    '</g>'
  );
  var glassesMk = glasses ? (
    '<circle cx="96" cy="152" r="36" fill="none" style="stroke:var(--mascot-stroke);" stroke-width="9"></circle>' +
    '<circle cx="215" cy="152" r="36" fill="none" style="stroke:var(--mascot-stroke);" stroke-width="9"></circle>' +
    '<path d="M132 152 L179 152" fill="none" style="stroke:var(--mascot-stroke);" stroke-width="9"></path>'
  ) : "";
  var faceMk = faceless ? "" : (
    '<path data-eye-l d="' + e.l + '" fill="none" stroke-width="' + e.w + '" stroke-linecap="round" stroke-linejoin="round" style="stroke:var(--mascot-stroke); transform-box:fill-box; transform-origin:center; animation:' + blinkLAnim + '; transition:d 260ms cubic-bezier(0.16,1,0.3,1), stroke-width 260ms cubic-bezier(0.16,1,0.3,1);"></path>' +
    '<path data-eye-r d="' + e.r + '" fill="none" stroke-width="' + e.w + '" stroke-linecap="round" stroke-linejoin="round" style="stroke:var(--mascot-stroke); transform-box:fill-box; transform-origin:center; animation:' + blinkRAnim + '; transition:d 260ms cubic-bezier(0.16,1,0.3,1), stroke-width 260ms cubic-bezier(0.16,1,0.3,1);"></path>' +
    '<path data-mouth-stroke d="' + smile + '" fill="none" stroke-width="14" stroke-linecap="round" style="stroke:var(--accent); opacity:' + (isRecord || isConfirmed ? 0 : 1) + '; transition:d 260ms cubic-bezier(0.16,1,0.3,1), opacity 220ms ease;"></path>' +
    '<path data-mouth-o d="M151 170 Q127 170 127 192 Q127 214 151 214 Q175 214 175 192 Q175 170 151 170 Z" style="fill:var(--accent); opacity:' + (isRecord ? 1 : 0) + '; transition:opacity 220ms ease;"></path>' +
    '<path data-mouth-grin d="M112 176 Q151 224 190 176 Q151 198 112 176 Z" style="fill:var(--accent); opacity:' + (isConfirmed ? 1 : 0) + '; transition:opacity 220ms ease;"></path>'
  );
  return '<svg data-mascot data-state="' + state + '" viewBox="0 0 300 260" xmlns="http://www.w3.org/2000/svg" aria-hidden="' + (informative ? "false" : "true") + '" role="' + (informative ? "img" : "presentation") + '"' + (informative ? ' aria-label="' + label + '"' : '') + ' style="width:100%;height:auto;display:block;">' +
    '<g data-lean-g style="transform:' + leanT + ';transform-origin:150px 230px;transition:transform 320ms cubic-bezier(0.16,1,0.3,1);">' + bodyMk + glassesMk + faceMk + '</g></svg>';
}
function paintMascot(svg, state) {
  if (!svg) return;
  state = MASCOT_EYES[state] ? state : "idle";
  var e = MASCOT_EYES[state], smile = MASCOT_SMILE[state];
  var isRecord = state === "record", isConfirmed = state === "confirmed";
  var eyeL = svg.querySelector("[data-eye-l]"), eyeR = svg.querySelector("[data-eye-r]");
  if (eyeL) { eyeL.setAttribute("d", e.l); eyeL.setAttribute("stroke-width", e.w); }
  if (eyeR) { eyeR.setAttribute("d", e.r); eyeR.setAttribute("stroke-width", e.w); }
  var ms = svg.querySelector("[data-mouth-stroke]");
  if (ms) { ms.setAttribute("d", smile); ms.style.opacity = (isRecord || isConfirmed) ? 0 : 1; }
  var mo = svg.querySelector("[data-mouth-o]"); if (mo) mo.style.opacity = isRecord ? 1 : 0;
  var mg = svg.querySelector("[data-mouth-grin]"); if (mg) mg.style.opacity = isConfirmed ? 1 : 0;
  var lidG = svg.querySelector("[data-lid-g]"); if (lidG) lidG.style.transform = MASCOT_LID[state] || "rotate(0deg)";
  var leanG = svg.querySelector("[data-lean-g]"); if (leanG) leanG.style.transform = MASCOT_LEAN[state] || "rotate(0deg)";
  svg.setAttribute("data-state", state);
}
function initMascotSlots(root) {
  $$(".mascot-slot", root).forEach(function (el) {
    if (el.dataset.mascotInit) return;
    el.dataset.mascotInit = "1";
    var state = el.getAttribute("data-state") || "idle";
    el.innerHTML = mascotSVG(state, {
      glasses: el.hasAttribute("data-glasses"),
      bare: el.hasAttribute("data-bare"),
      faceless: el.hasAttribute("data-faceless"),
      fill: el.getAttribute("data-fill"),
      blink: el.hasAttribute("data-blink"),
      breathe: el.hasAttribute("data-breathe"),
      informative: el.hasAttribute("data-informative"),
      label: el.getAttribute("data-label")
    });
  });
}

  /* ---------- theme ----------
     Three modes cycling light -> dark -> stock. "light" and "dark" mirror the
     system preference; "stock" is the brand mode and is opt-in only, never
     reached by preference. The chosen mode persists in localStorage under
     STORE_KEY and is applied by a tiny inline script in each page's <head>, so
     the correct palette is on the element before first paint.

     Pages pass an onChange callback; index.html uses it to repaint scenes that
     read colours from the custom properties rather than from CSS. */
  var THEMES = ["light", "dark", "stock"];
  var THEME_LABEL = { light: "Light", dark: "Dark", stock: "Stock" };
  var STORE_KEY = "stb-theme";
  var html = document.documentElement;
  var sysDark = matchMedia("(prefers-color-scheme: dark)");

  function storedTheme() {
    try {
      var t = localStorage.getItem(STORE_KEY);
      return THEMES.indexOf(t) > -1 ? t : null;
    } catch (e) { return null; }
  }
  /* The mode actually in force: an explicit choice if there is one, otherwise
     whatever the system asks for. */
  function currentTheme() {
    return html.getAttribute("data-theme") || (sysDark.matches ? "dark" : "light");
  }
  function getVar(n) { return getComputedStyle(html).getPropertyValue(n).trim(); }

  function initTheme(onChange) {
    var toggle = $("#themeToggle");
    if (!toggle) return;
    var nameEl = toggle.querySelector(".theme-name");
    var live = $("#themeStatus");
    var iconFor = {
      light: toggle.querySelector('[data-theme-icon="light"]'),
      dark: toggle.querySelector('[data-theme-icon="dark"]'),
      stock: toggle.querySelector('[data-theme-icon="stock"]')
    };

    function reflect() {
      var cur = currentTheme();
      var next = THEMES[(THEMES.indexOf(cur) + 1) % THEMES.length];
      if (nameEl) nameEl.textContent = THEME_LABEL[cur];
      THEMES.forEach(function (t) {
        if (iconFor[t]) iconFor[t].style.display = t === cur ? "block" : "none";
      });
      /* The label names the current mode; the accessible name has to say what
         pressing it will do, or the control reads as a status, not an action. */
      toggle.setAttribute("aria-label", "Colour theme: " + THEME_LABEL[cur] + ". Switch to " + THEME_LABEL[next] + ".");
    }

    toggle.addEventListener("click", function () {
      var next = THEMES[(THEMES.indexOf(currentTheme()) + 1) % THEMES.length];
      html.setAttribute("data-theme-anim", "");
      html.setAttribute("data-theme", next);
      try { localStorage.setItem(STORE_KEY, next); } catch (e) {}
      reflect();
      if (live) live.textContent = THEME_LABEL[next] + " theme";
      if (typeof onChange === "function") onChange();
    });

    /* Only follow the system when the reader has not chosen for themselves. */
    sysDark.addEventListener("change", function () {
      if (html.getAttribute("data-theme")) return;
      reflect();
      if (typeof onChange === "function") onChange();
    });

    reflect();
  }

  /* ---------- nav ---------- */
  function initNav() {
    var nav = $("#nav");
    if (!nav) return;
    addEventListener("scroll", function () { nav.classList.toggle("on", scrollY > 100); }, { passive: true });
  }

  /* ---------- scroll reveal ----------
     initReveals() registers the three reveal patterns both pages share and
     hands back { shot, tick }. Call it AFTER any JS-built rows exist. Pages
     drive tick() from their own requestAnimationFrame loop — index.html folds
     it into the loop that also runs its 3D scenes. */
  function initReveals() {
    var shots = [];
    function shot(el, fire) { if (el && !el.dataset.fxd) { el.dataset.fxd = "1"; shots.push({ el: el, fire: fire, done: false }); } }
    $$("[data-mask]").forEach(function (mk) {
      var lines = $$("[data-line]", mk);
      if (!reduced) lines.forEach(function (l) { l.style.transform = "translateY(110%)"; });
      shot(mk, function () {
        lines.forEach(function (l, i) {
          l.style.transition = "transform 700ms " + EXP + " " + (i * 80) + "ms";
          l.style.transform = "translateY(0)";
        });
      });
    });
    $$("[data-reveal]").forEach(function (el) {
      if (!reduced) { el.style.opacity = "0"; el.style.transform = "translateY(" + 20 * f + "px)"; }
      shot(el, function () {
        el.style.transition = "opacity 600ms " + EXP + ", transform 600ms " + EXP;
        el.style.opacity = "1"; el.style.transform = "translateY(0)";
      });
    });
    $$("[data-prow]").forEach(function (row) {
      var num = row.querySelector("[data-pnum]"), ttl = row.querySelector("[data-ptitle]"), bdy = row.querySelector("[data-pbody]");
      if (!reduced) {
        num.style.opacity = "0";
        ttl.style.opacity = "0"; ttl.style.transform = "translateX(" + -16 * f + "px)";
        bdy.style.opacity = "0";
      }
      shot(row, function () {
        num.style.transition = "opacity 300ms " + PRO; num.style.opacity = "1";
        ttl.style.transition = "opacity 500ms " + PRO + " 80ms, transform 500ms " + PRO + " 80ms";
        ttl.style.opacity = "1"; ttl.style.transform = "translateX(0)";
        bdy.style.transition = "opacity 500ms " + PRO + " 140ms"; bdy.style.opacity = "1";
      });
    });
    function tick() {
      var vh = innerHeight;
      for (var i = 0; i < shots.length; i++) {
        var s = shots[i];
        if (s.done) continue;
        var r = s.el.getBoundingClientRect();
        if (r.top < vh * 0.85 && r.bottom > 0) { s.done = true; s.fire(); }
      }
    }
    return { shot: shot, tick: tick };
  }

  /* ======================================================================
     SCROLL SCRUB FRAMEWORK
     ======================================================================
     A sticky section of configurable height whose normalised progress
     (0..1) is handed to a renderer. The renderer is a plain callback, so
     the pipeline knows nothing about what is being drawn — swap
     onProgress and the same machinery drives something else.

     The scroll budget for the hero is declared once, here. Nothing else
     in the module may hardcode a scroll length. */
  var SCRUB_LENGTH_VH = 150;

  /* Two rules this obeys, deliberately:
       1. The scroll listener sets a flag and nothing else. All reading of
          layout and all rendering happens in the rAF loop below, so a fast
          scroll cannot queue up N synchronous renders.
       2. Nothing here calls preventDefault, and nothing binds wheel, touch
          or key events. The animation is a function of scroll position; it
          never influences it. Scrolling straight past at full speed, by
          wheel, trackpad, space, PgDn or arrow key, is untouched. */
  function initScrollScrub(opts) {
    var section = opts.section;
    var sticky = opts.sticky;
    var onProgress = opts.onProgress;
    var lengthVh = opts.scrollLength || SCRUB_LENGTH_VH;
    if (!section || !sticky || typeof onProgress !== "function") return null;

    section.style.height = lengthVh + "vh";
    sticky.style.position = "sticky";
    sticky.style.top = "0";
    sticky.style.minHeight = "100vh";
    sticky.style.display = "grid";
    sticky.style.alignContent = "center";

    var dirty = true, progress = 0, raf = 0, stopped = false;
    function mark() { dirty = true; }
    addEventListener("scroll", mark, { passive: true });
    addEventListener("resize", mark, { passive: true });

    function measure() {
      var r = section.getBoundingClientRect();
      var range = r.height - innerHeight;
      var p = range > 0 ? -r.top / range : (r.top <= 0 ? 1 : 0);
      progress = p < 0 ? 0 : p > 1 ? 1 : p;
    }

    function frame() {
      if (stopped) return;
      raf = requestAnimationFrame(frame);
      if (dirty) { dirty = false; measure(); }
      onProgress(progress);
    }
    measure();
    raf = requestAnimationFrame(frame);

    return {
      progress: function () { return progress; },
      stop: function () {
        stopped = true; cancelAnimationFrame(raf);
        removeEventListener("scroll", mark); removeEventListener("resize", mark);
      }
    };
  }

  /* ======================================================================
     MASCOT BOX RENDERER
     ======================================================================
     The same box the hero already had — an extruded cuboid 1.6 x 1.2 x 1.2
     with a separate 0.08-deep lid hinged on its rear top edge, chevron eyes
     and an orange smile on the front face, drawn in the site's greens. The
     geometry, proportions, camera and hinge are carried over unchanged from
     the previous WebGL version; only the rasteriser is different, because
     the animation may not pull in an external library.

     Software projection onto a 2D canvas: pinhole camera, painter's
     algorithm, back-facing polygons filled as interior surfaces. No images,
     no library, no WebGL context. */
  var BOX = {
    W: 1.6, H: 1.2, D: 1.2,        /* body, as before */
    LID: 0.08,                     /* lid thickness, as before */
    /* Group offset and camera distance are the one thing nudged from the
       previous version, and only because the lid now opens: at 60 degrees the
       lid's front edge swings up to y=1.68, which the old framing
       (groupY -0.1, camera z 4.6) clipped off the top of the canvas. Pulled
       back to 5.1 and dropped to -0.45, the whole swept volume fits with
       headroom to spare at every progress value. */
    Y: -0.45,
    FOV: 35, CAM: [0, 0.85, 5.1],
    MAX_LID_DEG: 60,               /* the box must still read as a box */
    LID_DONE: 0.7                  /* fully open by 0.7 progress, then holds */
  };

  function createMascotBox(canvas, opts) {
    opts = opts || {};
    var ctx = canvas.getContext("2d");
    var hw = BOX.W / 2, hh = BOX.H / 2, hd = BOX.D / 2;

    /* Body without its top face — the lid is that face, and leaving the
       hole means the interior back wall is genuinely visible through it
       rather than faked. */
    var BODY = [
      { v: [[-hw, -hh, hd], [hw, -hh, hd], [hw, hh, hd], [-hw, hh, hd]], n: [0, 0, 1], face: true },
      { v: [[hw, -hh, -hd], [-hw, -hh, -hd], [-hw, hh, -hd], [hw, hh, -hd]], n: [0, 0, -1] },
      { v: [[-hw, -hh, -hd], [-hw, -hh, hd], [-hw, hh, hd], [-hw, hh, -hd]], n: [-1, 0, 0] },
      { v: [[hw, -hh, hd], [hw, -hh, -hd], [hw, hh, -hd], [hw, hh, hd]], n: [1, 0, 0] },
      { v: [[-hw, -hh, -hd], [hw, -hh, -hd], [hw, -hh, hd], [-hw, -hh, hd]], n: [0, -1, 0] }
    ];
    /* Lid, in hinge-local space: the hinge is the origin, running
       left-to-right across the REAR of the box, so rotation about X lifts
       the front edge off the seam. */
    var L = BOX.LID;
    var LID = [
      { v: [[-hw, 0, BOX.D], [hw, 0, BOX.D], [hw, L, BOX.D], [-hw, L, BOX.D]], n: [0, 0, 1] },
      { v: [[hw, 0, 0], [-hw, 0, 0], [-hw, L, 0], [hw, L, 0]], n: [0, 0, -1] },
      { v: [[-hw, L, 0], [-hw, L, BOX.D], [hw, L, BOX.D], [hw, L, 0]], n: [0, 1, 0] },
      { v: [[-hw, 0, BOX.D], [-hw, 0, 0], [hw, 0, 0], [hw, 0, BOX.D]], n: [0, -1, 0] },
      { v: [[-hw, 0, 0], [-hw, 0, BOX.D], [-hw, L, BOX.D], [-hw, L, 0]], n: [-1, 0, 0] },
      { v: [[hw, 0, BOX.D], [hw, 0, 0], [hw, L, 0], [hw, L, BOX.D]], n: [1, 0, 0] }
    ];

    var pitch = Math.atan2(BOX.CAM[1], BOX.CAM[2]);   /* camera tilts down at the box */
    var cp = Math.cos(pitch), sp = Math.sin(pitch);
    var W = 0, Hpx = 0, dpr = 1, focal = 1;

    function resize() {
      var box = canvas.getBoundingClientRect();
      var cssW = Math.max(1, Math.round(box.width));
      var cssH = Math.max(1, Math.round(box.width));   /* square */
      dpr = Math.min(devicePixelRatio || 1, 2);
      canvas.width = Math.round(cssW * dpr);
      canvas.height = Math.round(cssH * dpr);
      canvas.style.height = cssH + "px";
      W = canvas.width; Hpx = canvas.height;
      focal = (Hpx / 2) / Math.tan((BOX.FOV * Math.PI / 180) / 2);
    }

    function project(p, yaw) {
      var cy = Math.cos(yaw), sy = Math.sin(yaw);
      var x = p[0] * cy + p[2] * sy;
      var z = -p[0] * sy + p[2] * cy;
      var y = p[1] + BOX.Y;
      x -= BOX.CAM[0]; y -= BOX.CAM[1]; z -= BOX.CAM[2];
      var yv = y * cp - z * sp;
      var zv = y * sp + z * cp;
      var d = -zv; if (d < 0.05) d = 0.05;
      return [W / 2 + focal * x / d, Hpx / 2 - focal * yv / d, d];
    }

    function rotYaw(n, yaw) {
      var cy = Math.cos(yaw), sy = Math.sin(yaw);
      return [n[0] * cy + n[2] * sy, n[1], -n[0] * sy + n[2] * cy];
    }
    function lidPoint(p, a) {
      var ca = Math.cos(a), sa = Math.sin(a);
      return [p[0], 0.6 + (p[1] * ca + p[2] * sa), -hd + (-p[1] * sa + p[2] * ca)];
    }
    function lidNormal(n, a) {
      var ca = Math.cos(a), sa = Math.sin(a);
      return [n[0], n[1] * ca + n[2] * sa, -n[1] * sa + n[2] * ca];
    }

    /* Chevron eyes and the orange smile, in the 512-unit space the previous
       face texture used, so the drawing is identical. */
    function drawFace(quad, blink, stroke, accent) {
      function at(u, v) {
        var tl = quad[3], tr = quad[2], bl = quad[0];
        return [tl[0] + u * (tr[0] - tl[0]) + v * (bl[0] - tl[0]),
                tl[1] + u * (tr[1] - tl[1]) + v * (bl[1] - tl[1])];
      }
      var k = 512;
      function line(pts) {
        ctx.beginPath();
        for (var i = 0; i < pts.length; i++) {
          var s = at(pts[i][0] / k, pts[i][1] / k);
          if (i === 0) ctx.moveTo(s[0], s[1]); else ctx.lineTo(s[0], s[1]);
        }
        ctx.stroke();
      }
      var span = Math.hypot(quad[2][0] - quad[3][0], quad[2][1] - quad[3][1]);
      ctx.lineWidth = Math.max(1, span * (26 / k));
      ctx.lineCap = "round"; ctx.lineJoin = "round";
      ctx.strokeStyle = stroke;
      if (blink) { line([[110, 295], [220, 295]]); line([[292, 295], [402, 295]]); }
      else { line([[110, 320], [165, 258], [220, 320]]); line([[292, 320], [347, 258], [402, 320]]); }
      ctx.strokeStyle = accent;
      var seg = [], i, t, mt;
      for (i = 0; i <= 12; i++) {   /* the quadratic smile, subdivided */
        t = i / 12; mt = 1 - t;
        seg.push([mt * mt * 192 + 2 * mt * t * 256 + t * t * 320,
                  mt * mt * 372 + 2 * mt * t * 422 + t * t * 372]);
      }
      line(seg);
    }

    var blink = false;
    if (!opts.reduced) {
      (function blinkLoop() {
        setTimeout(function () {
          blink = true;
          setTimeout(function () { blink = false; }, 140);
          blinkLoop();
        }, 5000 + Math.random() * 2000);
      })();
    }

    /* progress -> lid angle. Eases out to a hard stop at LID_DONE; past
       that point further scrolling changes nothing. */
    function lidAngle(p) {
      var t = p / BOX.LID_DONE; if (t > 1) t = 1; if (t < 0) t = 0;
      var eased = 1 - Math.pow(1 - t, 3);
      return eased * BOX.MAX_LID_DEG * Math.PI / 180;
    }

    function render(progress, yaw) {
      if (!W || !Hpx) resize();
      var a = lidAngle(progress);
      var fill = getVar("--mascot-fill") || "#EAF2DE";
      var edge = getVar("--mascot-stroke") || "#2E5A22";
      var inner = getVar("--box-interior") || fill;
      var accent = getVar("--accent") || "#E8871E";

      ctx.clearRect(0, 0, W, Hpx);
      var polys = [], i, f, sv, n, k, depth, front;

      for (i = 0; i < BODY.length; i++) {
        f = BODY[i];
        sv = [f.v[0], f.v[1], f.v[2], f.v[3]].map(function (p) { return project(p, yaw); });
        n = rotYaw(f.n, yaw);
        depth = (sv[0][2] + sv[1][2] + sv[2][2] + sv[3][2]) / 4;
        front = facing(f.v, f.n, yaw);
        polys.push({ sv: sv, depth: depth, front: front, isFace: !!f.face && front });
      }
      for (i = 0; i < LID.length; i++) {
        f = LID[i];
        sv = f.v.map(function (p) { return project(lidPoint(p, a), yaw); });
        depth = (sv[0][2] + sv[1][2] + sv[2][2] + sv[3][2]) / 4;
        front = facingPts(f.v.map(function (p) { return lidPoint(p, a); }), lidNormal(f.n, a), yaw);
        polys.push({ sv: sv, depth: depth, front: front, lid: true });
      }
      polys.sort(function (p, q) { return q.depth - p.depth; });   /* far to near */

      ctx.lineJoin = "round"; ctx.lineCap = "round";
      var strokeW = Math.max(1, Hpx * 0.006);
      for (i = 0; i < polys.length; i++) {
        var pl = polys[i];
        ctx.beginPath();
        ctx.moveTo(pl.sv[0][0], pl.sv[0][1]);
        for (k = 1; k < pl.sv.length; k++) ctx.lineTo(pl.sv[k][0], pl.sv[k][1]);
        ctx.closePath();
        /* A back-facing polygon is an inside surface: the interior back wall
           and floor you see once the lid lifts. Darker shade of the box
           colour, straight from the theme. */
        ctx.fillStyle = pl.front ? fill : inner;
        ctx.fill();
        if (pl.front) {
          ctx.strokeStyle = edge; ctx.lineWidth = strokeW; ctx.stroke();
          if (pl.isFace) {
            ctx.save(); ctx.clip();
            drawFace(pl.sv, blink, edge, accent);
            ctx.restore();
          }
        }
      }

      /* The seam. It is the body's top-front edge — the very line the lid
         rests on when shut — so the lid always reads as lifting off it
         rather than floating above an unrelated line. */
      var s1 = project([-hw, hh, hd], yaw), s2 = project([hw, hh, hd], yaw);
      ctx.beginPath(); ctx.moveTo(s1[0], s1[1]); ctx.lineTo(s2[0], s2[1]);
      ctx.strokeStyle = edge; ctx.lineWidth = strokeW * 1.5; ctx.stroke();
    }

    function facing(v, n, yaw) { return facingPts(v, rotYaw(n, yaw), yaw); }
    function facingPts(v, n, yaw) {
      var c = [0, 0, 0], i;
      for (i = 0; i < v.length; i++) { c[0] += v[i][0]; c[1] += v[i][1]; c[2] += v[i][2]; }
      c = [c[0] / v.length, c[1] / v.length, c[2] / v.length];
      var cy = Math.cos(yaw), sy = Math.sin(yaw);
      var wx = c[0] * cy + c[2] * sy, wz = -c[0] * sy + c[2] * cy, wy = c[1] + BOX.Y;
      var view = [wx - BOX.CAM[0], wy - BOX.CAM[1], wz - BOX.CAM[2]];
      return (n[0] * view[0] + n[1] * view[1] + n[2] * view[2]) < 0;
    }

    resize();
    addEventListener("resize", resize, { passive: true });
    return { render: render, resize: resize };
  }

  /* ======================================================================
     HERO BOX — scrub + drag, wired together
     ====================================================================== */
  function initHeroBox(cfg) {
    cfg = cfg || {};
    var canvas = $("#heroBox");
    var section = $("#heropin");
    var sticky = $("#top");
    var hint = $("#heroBoxHint");
    if (!canvas || !section || !sticky) return null;

    var box = createMascotBox(canvas, { reduced: reduced });

    /* prefers-reduced-motion: the resting state, drawn once. No scroll
       listener is attached, no drag is armed, nothing animates. */
    if (reduced) {
      canvas.removeAttribute("tabindex");
      if (hint) hint.remove();
      var paintStatic = function () { box.resize(); box.render(0, 0); };
      paintStatic();
      addEventListener("resize", paintStatic, { passive: true });
      return { repaint: paintStatic };
    }

    var MAX_YAW = 45 * Math.PI / 180;      /* clamped. no full spin. */
    var STEP = 9 * Math.PI / 180;          /* keyboard increment */
    var SETTLE_MS = 800;
    var progress = 0, yaw = 0, target = 0;
    var dragging = false, dragStartX = 0, dragStartYaw = 0;
    var releasedAt = 0, releasedFrom = 0, settling = false;
    var armed = false, interacted = false;

    function arm() {
      if (armed) return;
      armed = true;
      canvas.style.cursor = "grab";
      canvas.setAttribute("tabindex", "0");
      if (hint && !interacted) hint.classList.add("on");
    }
    function disarm() {
      if (!armed) return;
      armed = false;
      canvas.style.cursor = "";
      canvas.removeAttribute("tabindex");
      if (hint) hint.classList.remove("on");
    }
    function usedIt() {
      if (interacted) return;
      interacted = true;
      if (hint) hint.classList.add("gone");
    }
    function clampYaw(v) { return v < -MAX_YAW ? -MAX_YAW : v > MAX_YAW ? MAX_YAW : v; }

    /* ---- mouse ---- */
    canvas.addEventListener("mousedown", function (e) {
      if (!armed) return;
      dragging = true; settling = false;
      dragStartX = e.clientX; dragStartYaw = yaw;
      canvas.style.cursor = "grabbing";
      usedIt();
      e.preventDefault();          /* a mouse drag only; never a touch or wheel */
    });
    addEventListener("mousemove", function (e) {
      if (!dragging) return;
      target = clampYaw(dragStartYaw + (e.clientX - dragStartX) * 0.006);
    }, { passive: true });
    addEventListener("mouseup", function () {
      if (!dragging) return;
      dragging = false;
      canvas.style.cursor = armed ? "grab" : "";
      releasedFrom = target; releasedAt = performance.now(); settling = true;
    }, { passive: true });

    /* ---- touch ----
       The gesture has to declare itself horizontal before it is captured.
       touchstart never calls preventDefault, so a vertical or ambiguous
       drag scrolls the page exactly as it would with no listener here. */
    var tId = null, tx0 = 0, ty0 = 0, tClaimed = false;
    canvas.addEventListener("touchstart", function (e) {
      if (!armed || e.touches.length !== 1) return;
      var t = e.touches[0];
      tId = t.identifier; tx0 = t.clientX; ty0 = t.clientY;
      tClaimed = false; dragStartYaw = yaw; settling = false;
      /* deliberately no preventDefault here */
    }, { passive: true });

    canvas.addEventListener("touchmove", function (e) {
      if (tId === null) return;
      var t = null, i;
      for (i = 0; i < e.touches.length; i++) if (e.touches[i].identifier === tId) t = e.touches[i];
      if (!t) return;
      var dx = t.clientX - tx0, dy = t.clientY - ty0;
      if (!tClaimed) {
        /* Only a clearly horizontal gesture becomes a rotate: past 12px AND
           at least 1.5x the vertical travel. Anything else is left alone
           for the rest of the gesture. */
        if (Math.abs(dx) > 12 && Math.abs(dx) > Math.abs(dy) * 1.5) {
          tClaimed = true; dragging = true; usedIt();
        } else if (Math.abs(dy) > 8) {
          tId = null; return;      /* vertical: hand it back to the page, permanently */
        } else return;
      }
      target = clampYaw(dragStartYaw + dx * 0.006);
      if (e.cancelable) e.preventDefault();   /* only once horizontal is proven */
    }, { passive: false });

    function endTouch() {
      if (tId === null) return;
      tId = null;
      if (tClaimed) { dragging = false; releasedFrom = target; releasedAt = performance.now(); settling = true; }
      tClaimed = false;
    }
    canvas.addEventListener("touchend", endTouch, { passive: true });
    canvas.addEventListener("touchcancel", endTouch, { passive: true });

    /* ---- keyboard ----
       Bound to the canvas, not the document, so arrow keys keep scrolling
       the page everywhere else — and still do here unless the box has focus. */
    canvas.addEventListener("keydown", function (e) {
      if (!armed) return;
      if (e.key === "ArrowLeft") target = clampYaw(target - STEP);
      else if (e.key === "ArrowRight") target = clampYaw(target + STEP);
      else return;
      settling = false; usedIt();
      e.preventDefault();      /* the box has focus and is consuming the key */
    });
    canvas.addEventListener("blur", function () {
      if (!dragging) { releasedFrom = target; releasedAt = performance.now(); settling = true; }
    });

    var scrub = initScrollScrub({
      section: section,
      sticky: sticky,
      scrollLength: SCRUB_LENGTH_VH,
      /* The renderer. Swap this callback and the same pipeline drives
         something else — see the raster stub at the end of this function. */
      onProgress: function (p) {
        progress = p;
        if (p >= 1) arm(); else { disarm(); target = 0; }

        if (settling && !dragging) {
          var t = (performance.now() - releasedAt) / SETTLE_MS;
          if (t >= 1) { settling = false; target = 0; }
          else target = releasedFrom * (1 - (1 - Math.pow(1 - t, 3)));
        }
        yaw += (target - yaw) * 0.18;             /* never snaps */
        if (Math.abs(target - yaw) < 0.0002) yaw = target;
        box.render(progress, yaw);
      }
    });

    /* ------------------------------------------------------------------
       ALTERNATE RENDERER STUB — not built, on purpose.
       A pre-rendered raster frame sequence would attach here instead of
       createMascotBox, with no change to initScrollScrub:

         var frames = [];                       // decoded ImageBitmaps
         initScrollScrub({
           section: section, sticky: sticky, scrollLength: SCRUB_LENGTH_VH,
           onProgress: function (p) {
             var i = Math.min(frames.length - 1, Math.round(p * (frames.length - 1)));
             ctx.drawImage(frames[i], 0, 0, canvas.width, canvas.height);
           }
         });

       Left unbuilt: it would mean image downloads, which this phase forbids.
       ------------------------------------------------------------------ */

    return { repaint: function () { box.render(progress, yaw); }, scrub: scrub };
  }

  global.STB = {
    SCRUB_LENGTH_VH: SCRUB_LENGTH_VH, initScrollScrub: initScrollScrub,
    createMascotBox: createMascotBox, initHeroBox: initHeroBox,
    $: $, $$: $$,
    reduced: reduced, mob: mob, f: f, EXP: EXP, PRO: PRO,
    ICONS: ICONS, iconSVG: iconSVG, initIcons: initIcons,
    MASCOT_EYES: MASCOT_EYES, MASCOT_SMILE: MASCOT_SMILE,
    MASCOT_LID: MASCOT_LID, MASCOT_LEAN: MASCOT_LEAN,
    mascotSVG: mascotSVG, paintMascot: paintMascot, initMascotSlots: initMascotSlots,
    THEMES: THEMES, currentTheme: currentTheme, storedTheme: storedTheme,
    getVar: getVar, initTheme: initTheme,
    initNav: initNav, initReveals: initReveals
  };
})(window);
