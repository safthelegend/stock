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
    /* A procedure row staggers its number, title and body. Not every .prow
       carries all three — the limits rows are a label and a panel — so each
       part is animated only if the row actually has it. */
    $$("[data-prow]").forEach(function (row) {
      var num = row.querySelector("[data-pnum]"), ttl = row.querySelector("[data-ptitle]"), bdy = row.querySelector("[data-pbody]");
      if (!reduced) {
        if (num) num.style.opacity = "0";
        if (ttl) { ttl.style.opacity = "0"; ttl.style.transform = "translateX(" + -16 * f + "px)"; }
        if (bdy) bdy.style.opacity = "0";
      }
      shot(row, function () {
        if (num) { num.style.transition = "opacity 300ms " + PRO; num.style.opacity = "1"; }
        if (ttl) {
          ttl.style.transition = "opacity 500ms " + PRO + " 80ms, transform 500ms " + PRO + " 80ms";
          ttl.style.opacity = "1"; ttl.style.transform = "translateX(0)";
        }
        if (bdy) { bdy.style.transition = "opacity 500ms " + PRO + " 140ms"; bdy.style.opacity = "1"; }
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
  var SCRUB_LENGTH_VH = 150;      /* hero: lid, yaw and drag need the room */
  var MID_SCRUB_LENGTH_VH = 120;  /* mid-page: shine and zoom only, so shorter */

  /* Small scrubbing helpers. sub() remaps a slice of the 0..1 progress value
     onto its own 0..1, so each beat of a sequence can be written as the
     window it occupies. */
  function clamp01(v) { return v < 0 ? 0 : v > 1 ? 1 : v; }
  function sub(p, a, b) { return clamp01((p - a) / (b - a)); }
  function easeOut(t) { return 1 - Math.pow(1 - t, 3); }
  function easeInOut(t) { return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; }

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
     MASCOT BOX RENDERER  —  one geometry module, N configured instances
     ======================================================================
     An extruded cuboid 1.6 x 1.2 x 1.2 with a separate 0.08-deep lid hinged
     on its rear top edge, chevron eyes and an orange smile on the front face,
     drawn in the site's greens.

     This is the only place the vertex maths lives. Both the hero and the
     mid-page container call createMascotBox and then drive render() with
     different state; neither one owns any geometry of its own. render() takes
     everything that can differ between instances as arguments — lid angle,
     yaw, scale, specular sweep — and holds no animation state itself.

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

    /* What is inside, once the lid is all the way up: the sensor pocket on
       the inner rear wall and the logger unit standing in it. The same two
       objects the flat kit diagram draws, in the same theme colours and with
       the same relative stroke weights — a dashed --brand-line-mid outline for
       the pocket, a --sensor-board face with a heavier --brand edge for the
       unit. No insulation cutaway: the walls are not sectioned. */
    /* Both sit high on the inner REAR wall rather than on the floor: the
       camera looks only about ten degrees down, so the floor of a box this
       deep is behind the front wall and nothing placed there would ever be
       seen. A pocket on the wall is where a logger actually rides anyway. */
    var PZ = -hd + 0.004;
    var POCKET = [
      [-0.44, 0.06, PZ], [0.44, 0.06, PZ], [0.44, hh - 0.015, PZ], [-0.44, hh - 0.015, PZ]
    ];
    var LG = { x: 0.26, y0: 0.30, y1: hh - 0.02, z0: -hd + 0.01, z1: -hd + 0.22 };
    var LOGGER = [
      { v: [[-LG.x, LG.y1, LG.z1], [LG.x, LG.y1, LG.z1], [LG.x, LG.y1, LG.z0], [-LG.x, LG.y1, LG.z0]], n: [0, 1, 0], top: true },
      { v: [[-LG.x, LG.y0, LG.z1], [LG.x, LG.y0, LG.z1], [LG.x, LG.y1, LG.z1], [-LG.x, LG.y1, LG.z1]], n: [0, 0, 1], top: true },
      { v: [[LG.x, LG.y0, LG.z1], [LG.x, LG.y0, LG.z0], [LG.x, LG.y1, LG.z0], [LG.x, LG.y1, LG.z1]], n: [1, 0, 0] },
      { v: [[-LG.x, LG.y0, LG.z0], [-LG.x, LG.y0, LG.z1], [-LG.x, LG.y1, LG.z1], [-LG.x, LG.y1, LG.z0]], n: [-1, 0, 0] }
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

    /* scale is applied in screen space, about the canvas centre, so the zoom
       is a true scale-from-centre and does not change the perspective or the
       apparent camera distance.

       frameY nudges the box vertically, in fractions of the canvas height,
       BEFORE the scale is applied. The camera sits above the box and looks
       down, so the box's own screen centre is below the canvas centre; an
       instance that zooms needs those two centres to coincide or it grows off
       the bottom edge. The hero, which never zooms, leaves it at 0. */
    var scale = 1;
    var frameY = typeof opts.frameY === "number" ? opts.frameY : 0;
    function project(p, yaw) {
      var cy = Math.cos(yaw), sy = Math.sin(yaw);
      var x = p[0] * cy + p[2] * sy;
      var z = -p[0] * sy + p[2] * cy;
      var y = p[1] + BOX.Y;
      x -= BOX.CAM[0]; y -= BOX.CAM[1]; z -= BOX.CAM[2];
      var yv = y * cp - z * sp;
      var zv = y * sp + z * cp;
      var d = -zv; if (d < 0.05) d = 0.05;
      return [W / 2 + scale * focal * x / d,
              Hpx / 2 + scale * (frameY * Hpx - focal * yv / d), d];
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

    /* Which of the three theme shades a face takes. One light direction for
       every instance: from the front, and from above. A face's shade is picked
       by which axis its world normal points down, so the ordering is fixed —
       front and top lightest, the sides a step darker, anything back-facing
       darkest, because a back-facing polygon is an inside surface (the
       interior back wall and floor you see once the lid lifts).

       Discrete shades rather than a computed Lambert term, so every colour on
       the box is a named theme custom property and the whole thing re-paints
       correctly on a theme switch. */
    function shadeFor(n, front, fill, side, inner) {
      if (!front) return inner;
      var ax = Math.abs(n[0]), ay = Math.abs(n[1]), az = Math.abs(n[2]);
      if (ax > az && ax > ay) return side;      /* a side face, turned away from the light */
      if (ay >= ax && ay >= az) return n[1] > 0 ? fill : side;   /* lid top lit, underside not */
      return fill;                              /* front face, straight into the light */
    }

    /* The contact shadow. The box used to float: three flat shades and no
       ground, so nothing said where it was sitting. This projects the four
       corners of the base, takes their screen footprint and lays a soft
       radial ellipse under it, squashed and nudged down so it reads as a
       floor shadow rather than a halo. The colour is the same --paper-shadow
       token the cards use, so it disappears correctly in the print palette
       and in any theme that has no shadow. */
    function paintContactShadow(yaw, colour) {
      if (!colour || colour === "transparent") return;
      var c = [[-hw, -hh, -hd], [hw, -hh, -hd], [hw, -hh, hd], [-hw, -hh, hd]]
        .map(function (p) { return project(p, yaw); });
      var minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
      for (var i = 0; i < 4; i++) {
        if (c[i][0] < minX) minX = c[i][0];
        if (c[i][0] > maxX) maxX = c[i][0];
        if (c[i][1] < minY) minY = c[i][1];
        if (c[i][1] > maxY) maxY = c[i][1];
      }
      var cx = (minX + maxX) / 2, cy = maxY - (maxY - minY) * 0.15;
      var rx = (maxX - minX) * 0.62, ry = (maxY - minY) * 0.42;
      if (!(rx > 0) || !(ry > 0)) return;
      ctx.save();
      ctx.translate(cx, cy);
      ctx.scale(1, ry / rx);
      var g = ctx.createRadialGradient(0, 0, 0, 0, 0, rx);
      g.addColorStop(0, colour);
      g.addColorStop(0.55, colour);
      g.addColorStop(1, "transparent");
      ctx.globalAlpha = 0.9;
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(0, 0, rx, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
    }

    /* The specular sweep. A soft diagonal band travelling lower-left to
       upper-right across the canvas, clipped to each lit face in turn, so one
       highlight crosses the front and the top as a single continuous streak
       rather than as two unrelated glints. `t` is 0..1 across the travel;
       `width` is the band's own extent as a fraction of that travel. */
    function paintShine(t, width, colour) {
      var diag = Math.hypot(W, Hpx);
      /* Travel far enough past both corners that the band enters and leaves
         cleanly instead of popping on mid-face. */
      var c = -0.35 + t * 1.7;
      var ux = 0.7071, uy = -0.7071;                 /* lower-left -> upper-right */
      var cx = W / 2, cy = Hpx / 2;
      var px = cx + ux * (c - 0.5) * diag, py = cy + uy * (c - 0.5) * diag;
      var half = width * diag / 2;
      var g = ctx.createLinearGradient(px - ux * half, py - uy * half, px + ux * half, py + uy * half);
      g.addColorStop(0, "transparent");
      g.addColorStop(0.5, colour);
      g.addColorStop(1, "transparent");
      ctx.fillStyle = g;
      ctx.fill();
    }

    /* state:
         lid    lid angle in radians (0 = shut). Callers that scrub it from
                progress use lidAngle() below; the mid-page instance passes 0.
         yaw    radians, applied to every vertex from this one value.
         scale  screen-space zoom about the canvas centre. Default 1.
         shine  0..1 position of the specular sweep, or null for none.
         shineWidth  band extent as a fraction of the sweep. */
    function render(state) {
      state = state || {};
      if (!W || !Hpx) resize();
      var a = state.lid || 0;
      var yaw = state.yaw || 0;
      scale = state.scale || 1;
      var fill = getVar("--mascot-fill") || "#EAF2DE";
      var edge = getVar("--mascot-stroke") || "#2E5A22";
      var side = getVar("--box-side") || fill;
      var inner = getVar("--box-interior") || fill;
      var accent = getVar("--accent") || "#E8871E";
      var shineCol = getVar("--box-shine") || "rgba(255,255,255,0.7)";
      var pocketLine = getVar("--brand-line-mid") || edge;
      var boardCol = getVar("--sensor-board") || side;
      var deepCol = getVar("--sensor-deep") || inner;
      var brandCol = getVar("--brand") || edge;
      var hasShine = typeof state.shine === "number" && state.shine > 0 && state.shine < 1;

      ctx.clearRect(0, 0, W, Hpx);
      paintContactShadow(yaw, getVar("--paper-shadow"));
      var polys = [], i, f, sv, n, k, depth, front;

      for (i = 0; i < BODY.length; i++) {
        f = BODY[i];
        sv = [f.v[0], f.v[1], f.v[2], f.v[3]].map(function (p) { return project(p, yaw); });
        n = rotYaw(f.n, yaw);
        depth = (sv[0][2] + sv[1][2] + sv[2][2] + sv[3][2]) / 4;
        front = facing(f.v, f.n, yaw);
        polys.push({ sv: sv, depth: depth, front: front, n: n, isFace: !!f.face && front });
      }
      for (i = 0; i < LID.length; i++) {
        f = LID[i];
        sv = f.v.map(function (p) { return project(lidPoint(p, a), yaw); });
        n = rotYaw(lidNormal(f.n, a), yaw);
        depth = (sv[0][2] + sv[1][2] + sv[2][2] + sv[3][2]) / 4;
        front = facingPts(f.v.map(function (p) { return lidPoint(p, a); }), lidNormal(f.n, a), yaw);
        polys.push({ sv: sv, depth: depth, front: front, n: n, lid: true });
      }
      /* The hinge, drawn as a heavier line and depth-sorted with everything
         else. It is the body's REAR top edge, and it is exactly the line the
         lid pivots about: the lid's own rear edge lies along it at every
         angle. Drawing the pivot rather than the top-front edge is what makes
         the lid read as hinged, because the one line that never moves is the
         one the lid is visibly attached to. Sorting it in rather than
         stamping it last means the shut lid correctly hides it. */
      /* Only once the lid has actually finished travelling. Part-open, the
         aperture is too shallow to see into and the contents would read as
         painted on the rim. */
      var lidFull = a >= (BOX.MAX_LID_DEG * Math.PI / 180) - 0.002;
      if (lidFull) {
        polys.push({
          sv: POCKET.map(function (p) { return project(p, yaw); }),
          depth: POCKET.reduce(function (t, p) { return t + project(p, yaw)[2]; }, 0) / 4,
          pocket: true
        });
        for (i = 0; i < LOGGER.length; i++) {
          f = LOGGER[i];
          sv = f.v.map(function (p) { return project(p, yaw); });
          depth = (sv[0][2] + sv[1][2] + sv[2][2] + sv[3][2]) / 4;
          polys.push({ sv: sv, depth: depth, logger: true, top: !!f.top });
        }
      }

      var h1 = project([-hw, hh, -hd], yaw), h2 = project([hw, hh, -hd], yaw);
      polys.push({ sv: [h1, h2], depth: (h1[2] + h2[2]) / 2, hinge: true });

      polys.sort(function (p, q) { return q.depth - p.depth; });   /* far to near */

      ctx.lineJoin = "round"; ctx.lineCap = "round";
      var strokeW = Math.max(1, Hpx * 0.006 * scale);
      for (i = 0; i < polys.length; i++) {
        var pl = polys[i];
        if (pl.hinge) {
          ctx.beginPath();
          ctx.moveTo(pl.sv[0][0], pl.sv[0][1]); ctx.lineTo(pl.sv[1][0], pl.sv[1][1]);
          ctx.strokeStyle = edge; ctx.lineWidth = strokeW * 1.5; ctx.stroke();
          continue;
        }
        if (pl.pocket || pl.logger) {
          ctx.beginPath();
          ctx.moveTo(pl.sv[0][0], pl.sv[0][1]);
          for (k = 1; k < pl.sv.length; k++) ctx.lineTo(pl.sv[k][0], pl.sv[k][1]);
          ctx.closePath();
          if (pl.pocket) {
            ctx.setLineDash([strokeW * 3.5, strokeW * 3]);
            ctx.strokeStyle = pocketLine; ctx.lineWidth = strokeW; ctx.stroke();
            ctx.setLineDash([]);
          } else {
            ctx.fillStyle = pl.top ? boardCol : deepCol; ctx.fill();
            ctx.strokeStyle = brandCol; ctx.lineWidth = strokeW * 1.25; ctx.stroke();
          }
          continue;
        }
        ctx.beginPath();
        ctx.moveTo(pl.sv[0][0], pl.sv[0][1]);
        for (k = 1; k < pl.sv.length; k++) ctx.lineTo(pl.sv[k][0], pl.sv[k][1]);
        ctx.closePath();
        ctx.fillStyle = shadeFor(pl.n, pl.front, fill, side, inner);
        ctx.fill();
        if (pl.front) {
          if (hasShine) {
            ctx.save(); ctx.clip();
            paintShine(state.shine, state.shineWidth || 0.5, shineCol);
            ctx.restore();
          }
          ctx.strokeStyle = edge; ctx.lineWidth = strokeW; ctx.stroke();
          if (pl.isFace) {
            ctx.save(); ctx.clip();
            drawFace(pl.sv, blink, edge, accent);
            ctx.restore();
          }
        }
      }

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
    return { render: render, resize: resize, lidAngle: lidAngle };
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
      var paintStatic = function () { box.resize(); box.render({ lid: 0, yaw: 0 }); };
      paintStatic();
      addEventListener("resize", paintStatic, { passive: true });
      return { repaint: paintStatic };
    }

    var MAX_YAW = 45 * Math.PI / 180;      /* clamped. no full spin. */
    var STEP = 9 * Math.PI / 180;          /* keyboard increment */
    var SETTLE_MS = 800;
    /* Scroll drives yaw from -18 to +18 degrees across the whole scrub, off
       the same progress value that opens the lid over 0.0 to 0.7. The two run
       together: the box turns while the lid lifts, which is what makes the
       hinge legible — at yaw 0 the side faces are edge-on and the pivot cannot
       be seen at all. */
    var SCROLL_YAW = 18 * Math.PI / 180;
    function scrollYaw(p) { return (-1 + 2 * clamp01(p)) * SCROLL_YAW; }

    /* Two contributions, kept separate: the scroll's yaw, and the reader's
       drag offset on top of it. Drag is armed only at progress 1.0, where the
       scroll term is pinned at +18 degrees, so the offset always starts from a
       settled base. */
    var progress = 0, yaw = 0, offset = 0, target = 0;
    var dragging = false, dragStartX = 0, dragStartOffset = 0;
    var releasedAt = 0, releasedFrom = 0, settling = false;
    var armed = false, interacted = false;

    /* Idle auto-rotate. Once the scrub has pinned the box and the reader has
       not touched it yet, it turns slowly on its own so the affordance is
       visible without a hint being read. It is an oscillation, not a spin:
       the same clamped yaw range the drag uses, so the box never presents a
       face the geometry was not built to show. The first drag, arrow key or
       touch cancels it for good (usedIt), and it is never armed under
       prefers-reduced-motion because this whole branch is skipped there. */
    var AUTO_AMP = 14 * Math.PI / 180;   /* peak swing either side of the base */
    var AUTO_PERIOD = 9000;              /* ms for a full there-and-back */
    var autoStart = 0;
    function autoTarget(now) {
      if (!autoStart) autoStart = now;
      /* Eased in over the first half period so it starts from rest rather
         than snapping to mid-swing. */
      var t = (now - autoStart) / AUTO_PERIOD;
      var ramp = clamp01(t * 2);
      return clampOffset(Math.sin(t * Math.PI * 2) * AUTO_AMP * ramp);
    }

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
      autoStart = 0;            /* a later re-arm starts the drift from rest */
      canvas.style.cursor = "";
      canvas.removeAttribute("tabindex");
      if (hint) hint.classList.remove("on");
    }
    function usedIt() {
      if (interacted) return;
      interacted = true;
      autoStart = 0;
      if (hint) hint.classList.add("gone");
    }
    /* Clamps the drag offset so the TOTAL yaw stays inside MAX_YAW. The
       scroll term is fixed at scrollYaw(1) whenever drag is armed. */
    function clampOffset(v) {
      var base = scrollYaw(1);
      var lo = -MAX_YAW - base, hi = MAX_YAW - base;
      return v < lo ? lo : v > hi ? hi : v;
    }

    /* ---- mouse ---- */
    canvas.addEventListener("mousedown", function (e) {
      if (!armed) return;
      dragging = true; settling = false;
      dragStartX = e.clientX; dragStartOffset = offset;
      canvas.style.cursor = "grabbing";
      usedIt();
      e.preventDefault();          /* a mouse drag only; never a touch or wheel */
    });
    addEventListener("mousemove", function (e) {
      if (!dragging) return;
      target = clampOffset(dragStartOffset + (e.clientX - dragStartX) * 0.006);
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
      tClaimed = false; dragStartOffset = offset; settling = false;
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
      target = clampOffset(dragStartOffset + dx * 0.006);
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
      if (e.key === "ArrowLeft") target = clampOffset(target - STEP);
      else if (e.key === "ArrowRight") target = clampOffset(target + STEP);
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
        } else if (armed && !interacted && !dragging) {
          target = autoTarget(performance.now());
        }
        offset += (target - offset) * 0.18;       /* never snaps */
        if (Math.abs(target - offset) < 0.0002) offset = target;
        yaw = scrollYaw(progress) + offset;
        box.render({
          lid: box.lidAngle(progress),
          yaw: yaw,
          /* The hero's sweep: a broad band, crossing quickly over the middle
             of the scrub. The mid-page container gets a tighter, slower one so
             the two do not read as the same effect twice. */
          shine: sub(progress, 0.15, 0.45),
          shineWidth: 0.6
        });
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

    return { repaint: function () { box.render({ lid: box.lidAngle(progress), yaw: yaw }); }, scrub: scrub };
  }

  /* ======================================================================
     MID-PAGE CONTAINER — the second instance of the same box
     ======================================================================
     Same renderer, same geometry, different job. Where the hero opens and can
     be turned by hand, this one stays shut for the whole scrub and is never
     draggable: it gets the shine and the zoom instead, so the two instances
     are obviously doing different things.

       0.0 - 0.5   specular sweep, lower-left to upper-right, eased
       0.3 - 1.0   scale 1.0 -> 1.5 from the centre
       0.0 - 1.0   yaw drift, -8 to +8 degrees, a quarter of the hero's
       0.7 - 1.0   supporting copy fades in, staggered

     No drag, no keyboard, no pointer listeners of any kind. */
  var MID = {
    YAW: 8 * Math.PI / 180,
    SCALE_MAX: 1.5,
    FRAME_Y: -0.15,
    /* Tighter and slower than the hero's: a narrower band, and it crosses
       half of a 120vh scrub where the hero's crosses under a third of a
       150vh one. Same mechanism, plainly not the same effect. */
    SHINE_WIDTH: 0.2
  };

  function initMidBox() {
    var canvas = $("#midBox");
    var section = $("#boxpin");
    var sticky = $("#boxpinSticky");
    if (!canvas || !section || !sticky) return null;

    var copy = $$("[data-midcopy]", sticky);
    var box = createMascotBox(canvas, { reduced: reduced, frameY: MID.FRAME_Y });

    function paintCopy(t) {
      for (var i = 0; i < copy.length; i++) {
        /* Staggered: each element starts a little after the one above it and
           still finishes by 1.0. */
        var k = copy.length > 1 ? i / (copy.length - 1) : 0;
        var e = easeOut(clamp01((t - k * 0.35) / (1 - k * 0.35)));
        copy[i].style.opacity = e;
        copy[i].style.transform = "translateY(" + ((1 - e) * 14).toFixed(2) + "px)";
      }
    }

    /* prefers-reduced-motion: the end of the sequence, drawn once. Full scale,
       copy visible, no scroll listener attached and nothing animating. */
    if (reduced) {
      section.style.height = "auto";
      var paintStatic = function () {
        box.resize();
        box.render({ lid: 0, yaw: 0, scale: MID.SCALE_MAX });
      };
      paintStatic();
      paintCopy(1);
      addEventListener("resize", paintStatic, { passive: true });
      return { repaint: paintStatic };
    }

    var progress = 0;
    var scrub = initScrollScrub({
      section: section,
      sticky: sticky,
      scrollLength: MID_SCRUB_LENGTH_VH,
      onProgress: function (p) {
        progress = p;
        var shine = sub(p, 0, 0.5);
        box.render({
          lid: 0,                                  /* shut, at every progress */
          yaw: (-1 + 2 * p) * MID.YAW,
          scale: 1 + easeOut(sub(p, 0.3, 1)) * (MID.SCALE_MAX - 1),
          shine: shine > 0 && shine < 1 ? easeInOut(shine) : shine,
          shineWidth: MID.SHINE_WIDTH
        });
        paintCopy(sub(p, 0.7, 1));
      }
    });

    return {
      repaint: function () { box.render({ lid: 0, yaw: (-1 + 2 * progress) * MID.YAW,
        scale: 1 + easeOut(sub(progress, 0.3, 1)) * (MID.SCALE_MAX - 1) }); },
      scrub: scrub
    };
  }

  /* ======================================================================
     1. COMMAND PALETTE  (Cmd/Ctrl+K)
     ======================================================================
     Fuzzy subsequence match over a hand-authored index. No library. Focus is
     trapped while open and restored to whatever had it when it closes. */
  function fuzzy(needle, hay) {
    /* Subsequence scoring: every needle character must appear in order.
       Consecutive hits and word-start hits score higher, so "hcm" ranks
       "Health code memo" above an incidental h..c..m elsewhere. */
    var n = needle.toLowerCase(), h = hay.toLowerCase();
    if (!n) return { score: 0, hits: [] };
    var hits = [], score = 0, hi = 0, streak = 0;
    for (var ni = 0; ni < n.length; ni++) {
      var found = -1;
      for (; hi < h.length; hi++) if (h[hi] === n[ni]) { found = hi; break; }
      if (found < 0) return null;
      var wordStart = found === 0 || /[^a-z0-9]/.test(h[found - 1]);
      streak = (hits.length && found === hits[hits.length - 1] + 1) ? streak + 1 : 0;
      score += 1 + streak * 2 + (wordStart ? 3 : 0);
      hits.push(found); hi = found + 1;
    }
    score -= hits[0] * 0.05;                 /* earlier matches win ties */
    return { score: score, hits: hits };
  }
  function markUp(text, hits) {
    var out = "", set = {}, i;
    for (i = 0; i < hits.length; i++) set[hits[i]] = 1;
    for (i = 0; i < text.length; i++) {
      var c = text.charAt(i).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
      out += set[i] ? "<mark>" + c + "</mark>" : c;
    }
    return out;
  }

  function initPalette(items) {
    if (!items || !items.length) return null;
    var backdrop = document.createElement("div"); backdrop.id = "paletteBackdrop";
    var box = document.createElement("div");
    box.id = "palette"; box.setAttribute("role", "dialog");
    box.setAttribute("aria-modal", "true"); box.setAttribute("aria-label", "Search this site");
    box.innerHTML =
      '<input id="paletteInput" type="text" autocomplete="off" spellcheck="false" ' +
        'placeholder="Jump to a section, template or page…" role="combobox" ' +
        'aria-expanded="true" aria-controls="paletteList" aria-autocomplete="list">' +
      '<ul id="paletteList" role="listbox" aria-label="Results"></ul>' +
      '<p id="paletteEmpty" hidden>Nothing matches that.</p>' +
      '<div id="paletteHint"><span>↑↓ move</span><span>↵ open</span><span>esc close</span></div>';
    document.body.appendChild(backdrop); document.body.appendChild(box);

    var input = $("#paletteInput", box), list = $("#paletteList", box), empty = $("#paletteEmpty", box);
    var shown = [], sel = 0, open = false, lastFocus = null;

    function score(q) {
      if (!q) return items.map(function (it) { return { it: it, hits: [] }; });
      var out = [];
      items.forEach(function (it) {
        var best = null;
        [it.label, it.kind + " " + it.label, it.keywords || ""].forEach(function (field, idx) {
          var r = fuzzy(q, field);
          if (r && (!best || r.score > best.score)) best = { score: r.score, hits: idx === 0 ? r.hits : [] };
        });
        if (best) out.push({ it: it, hits: best.hits, score: best.score });
      });
      out.sort(function (a, b) { return b.score - a.score; });
      return out;
    }

    function draw() {
      list.innerHTML = shown.map(function (r, i) {
        return '<li role="option" id="pal-' + i + '" aria-selected="' + (i === sel) + '">' +
          '<button type="button" tabindex="-1"><span class="kind">' + r.it.kind + '</span>' +
          '<span>' + (r.hits.length ? markUp(r.it.label, r.hits) : r.it.label) + '</span></button></li>';
      }).join("");
      empty.hidden = shown.length > 0;
      input.setAttribute("aria-activedescendant", shown.length ? "pal-" + sel : "");
      var node = list.children[sel];
      if (node && node.scrollIntoView) node.scrollIntoView({ block: "nearest" });
    }
    function refresh() { shown = score(input.value.trim()); sel = 0; draw(); }

    function show() {
      if (open) return;
      open = true; lastFocus = document.activeElement;
      backdrop.classList.add("on"); box.classList.add("on");
      input.value = ""; refresh(); input.focus();
    }
    function hide() {
      if (!open) return;
      open = false;
      backdrop.classList.remove("on"); box.classList.remove("on");
      /* Focus goes back where it came from, not to the top of the page. */
      if (lastFocus && lastFocus.focus) lastFocus.focus();
    }
    function go(r) {
      if (!r) return;
      hide();
      if (r.it.href) location.href = r.it.href;
      else if (r.it.run) r.it.run();
    }

    list.addEventListener("click", function (e) {
      var li = e.target.closest("li"); if (!li) return;
      go(shown[[].indexOf.call(list.children, li)]);
    });
    list.addEventListener("mousemove", function (e) {
      var li = e.target.closest("li"); if (!li) return;
      var i = [].indexOf.call(list.children, li);
      if (i !== sel) { sel = i; draw(); }
    });
    input.addEventListener("input", refresh);
    backdrop.addEventListener("click", hide);

    box.addEventListener("keydown", function (e) {
      if (e.key === "Escape") { e.preventDefault(); hide(); return; }
      if (e.key === "ArrowDown") { e.preventDefault(); if (shown.length) { sel = (sel + 1) % shown.length; draw(); } return; }
      if (e.key === "ArrowUp") { e.preventDefault(); if (shown.length) { sel = (sel - 1 + shown.length) % shown.length; draw(); } return; }
      if (e.key === "Enter") { e.preventDefault(); go(shown[sel]); return; }
      /* Focus trap: the dialog holds exactly one tabbable node, so Tab has
         nowhere to go and must not escape to the page behind. */
      if (e.key === "Tab") e.preventDefault();
    });

    addEventListener("keydown", function (e) {
      if ((e.metaKey || e.ctrlKey) && (e.key === "k" || e.key === "K")) { e.preventDefault(); open ? hide() : show(); }
    });
    return { show: show, hide: hide };
  }

  /* ======================================================================
     9. SCHOOL SITES — one data array, one filter, one renderer
     ======================================================================
     The three status tiers used to be three hand-maintained <ul>s, which meant
     the counts, the ordering and the caveat about targets all had to be kept
     true by hand. They are one array now: status lives on the record, and the
     view is derived. Adding a school is one line, and promoting one from
     target to operating is one word.

     The list renders from JS, so the markup in index.html carries the same
     rows as a <noscript> fallback — a reader with JS off still gets every
     school and its status, just without the filter. */
  var SITES = [
    { name: "Stuyvesant High School", borough: "Manhattan", status: "operating" },
    { name: "Midwood High School", borough: "Brooklyn", status: "conversation" },
    { name: "James Madison High School", borough: "Brooklyn", status: "conversation" },
    { name: "Brooklyn Technical High School", borough: "Brooklyn", status: "target" },
    { name: "Rachel Carson High School", borough: "Brooklyn", status: "target" },
    { name: "Bronx High School of Science", borough: "Bronx", status: "target" },
    { name: "Townsend Harris High School", borough: "Queens", status: "target" },
    { name: "Queens High School for the Sciences at York College", borough: "Queens", status: "target", tag: "specialized" }
  ];

  var SITE_STATUS = [
    { key: "operating", label: "Operating", note: "Running now. Boxes have a route, a receiving site and a signed agreement." },
    { key: "conversation", label: "In conversation", note: "Talking to staff or administration. Nothing agreed, nothing running." },
    { key: "target", label: "Target", note: "Schools we intend to approach. They have not agreed to anything, and listing one here is not a claim that they have." }
  ];

  /* The one receiving site. It is not a school, so it does not belong in the
     school list, but the map has to show it or the map is a map of origins
     with no destination. Kept beside SITES rather than inside it. */
  var RECEIVING_SITE = { name: "Receiving site", borough: "Manhattan", status: "operating", kind: "receiving" };

  var BOROUGHS = ["Bronx", "Brooklyn", "Manhattan", "Queens", "Staten Island"];

  /* One filter state, read by the list and by the map. Filtering either one
     filters both, because there is only one of them. */
  var siteState = { status: "all", borough: "all" };
  var siteListeners = [];
  function onSiteState(fn) { siteListeners.push(fn); }
  function matchesSiteState(r) {
    return (siteState.status === "all" || r.status === siteState.status) &&
           (siteState.borough === "all" || r.borough === siteState.borough);
  }

  function initSites() {
    var list = document.getElementById("sitesList");
    var filter = document.getElementById("sitesFilter");
    var boroFilter = document.getElementById("sitesBoroughFilter");
    var note = document.getElementById("sitesNote");
    if (!list || !filter) return null;

    function count(key) {
      return key === "all" ? SITES.length : SITES.filter(function (s) { return s.status === key; }).length;
    }
    function boroCount(key) {
      return key === "all" ? SITES.length : SITES.filter(function (s) { return s.borough === key; }).length;
    }

    /* Filter controls, built from the same status table the rows read, so a
       new status cannot appear in one and not the other. Radios rather than
       buttons: it is a single choice out of a named set, which is what a radio
       group is, and it arrives with arrow-key navigation already working.

       The borough group is the same component with a different set fed to it,
       not a second implementation. */
    function buildGroup(host, group, opts) {
      host.innerHTML = opts.map(function (o, i) {
        return '<label class="site-filter-opt">' +
          '<input type="radio" name="' + group + '" value="' + o.key + '"' + (i === 0 ? " checked" : "") + '>' +
          '<span>' + o.label + ' <span class="count">' + o.n + '</span></span>' +
          '</label>';
      }).join("");
    }

    buildGroup(filter, "siteFilter", [{ key: "all", label: "All sites", n: count("all") }].concat(
      SITE_STATUS.map(function (o) { return { key: o.key, label: o.label, n: count(o.key) }; })));

    if (boroFilter) {
      buildGroup(boroFilter, "siteBorough", [{ key: "all", label: "All boroughs", n: boroCount("all") }].concat(
        BOROUGHS.map(function (b) { return { key: b, label: b, n: boroCount(b) }; })));
    }

    function labelFor(key) {
      for (var i = 0; i < SITE_STATUS.length; i++) if (SITE_STATUS[i].key === key) return SITE_STATUS[i];
      return { label: key, note: "" };
    }

    function render() {
      var active = siteState.status;
      var rows = SITES.filter(matchesSiteState);
      if (!rows.length) {
        list.innerHTML = '<p class="site-empty">No schools at this status yet.</p>';
      } else {
        list.innerHTML = '<ul class="site-rows">' + rows.map(function (s, i) {
          var st = labelFor(s.status);
          return '<li class="site-row" style="animation-delay:' + (reduced ? 0 : i * 35) + 'ms">' +
            '<span class="nm">' + s.name + '</span>' +
            '<span class="meta"><span class="boro">' + s.borough + '</span>' +
            (s.tag ? '<span class="tag">' + s.tag + '</span>' : "") + '</span>' +
            '<span class="status s-' + s.status + (s.status === "operating" ? " is-live live-brand" : "") + '">' + st.label + '</span>' +
            '</li>';
        }).join("") + '</ul>';
      }
      if (note) note.textContent = active === "all"
        ? "Every school carries an explicit status. Target sites are schools we intend to approach; they have not agreed to anything, and listing one here is not a claim that they have."
        : labelFor(active).note;
      list.setAttribute("data-filter", active);
      for (var j = 0; j < siteListeners.length; j++) siteListeners[j]();
    }

    function onChange(e) {
      if (!e.target) return;
      if (e.target.name === "siteFilter") { siteState.status = e.target.value; render(); }
      if (e.target.name === "siteBorough") { siteState.borough = e.target.value; render(); }
    }
    filter.addEventListener("change", onChange);
    if (boroFilter) boroFilter.addEventListener("change", onChange);
    render();
    return { render: render, data: SITES };
  }

  /* ======================================================================
     BOROUGH MAP — community districts, one cited indicator, school markers
     ======================================================================
     Inline SVG built from assets/geo/nyc-cd.json: boundaries pre-projected at
     build time, so nothing projects at runtime and no map service, tile layer
     or third-party request is involved.

     The shading is ONE published indicator, stored with the geometry and
     printed under the map with its source and vintage. Districts the source
     does not cover are drawn unshaded and named in the legend as "no data";
     no gap is filled and no index is blended.

     Markers sit at BOROUGH resolution on purpose. The site list records a
     borough for each school and nothing finer, so a pin at a street address
     would be precision this project does not have. */
  var MAP_BREAKS = [10, 20, 30, 40];        /* percent; five classes with the top open */

  function mapClass(v) {
    if (v === null || v === undefined) return -1;
    for (var i = 0; i < MAP_BREAKS.length; i++) if (v < MAP_BREAKS[i]) return i;
    return MAP_BREAKS.length;
  }
  /* A single hue — var(--brand) — stepped by how much of the surface shows
     through it. One ramp that stays legible whether the ground is paper or
     forest, because it is always the theme's own brand over the theme's own
     surface. */
  var MAP_OPACITY = [0.22, 0.38, 0.55, 0.73, 0.92];

  function initBoroughMap() {
    var host = document.getElementById("boroughMap");
    if (!host || !window.fetch) return null;
    var legendHost = document.getElementById("mapLegend");
    var svgNS = "http://www.w3.org/2000/svg";
    function el(n, a) {
      var e = document.createElementNS(svgNS, n);
      for (var k in a) if (a.hasOwnProperty(k)) e.setAttribute(k, a[k]);
      return e;
    }

    fetch("assets/geo/nyc-cd.json").then(function (r) { return r.json(); }).then(function (geo) {
      var vb = geo.viewBox;
      var svg = el("svg", {
        viewBox: "0 0 " + vb[0] + " " + vb[1], "class": "boro-map",
        role: "img",
        "aria-label": "Map of New York City community districts shaded by " +
                      geo.meta.indicator.toLowerCase() + ", with markers for the schools in the list and the one operating receiving site."
      });
      svg.appendChild(el("rect", { x: 0, y: 0, width: vb[0], height: vb[1], fill: "var(--surface)" }));

      geo.districts.forEach(function (d) {
        var c = mapClass(d.snap);
        svg.appendChild(el("path", {
          d: d.d, "class": "cd" + (c < 0 ? " cd-nodata" : ""),
          fill: c < 0 ? "var(--bg)" : "var(--brand)",
          "fill-opacity": c < 0 ? 1 : MAP_OPACITY[c],
          stroke: "var(--line)", "stroke-width": 1.1,
          /* A dashed edge, so "no data" is distinguishable from the lightest
             class without relying on how close two fills look. */
          "stroke-dasharray": c < 0 ? "5 4" : "none"
        }));
      });

      var markerLayer = el("g", { "class": "marker-layer" });
      svg.appendChild(markerLayer);
      host.innerHTML = "";
      host.appendChild(svg);

      /* One popup element, moved and refilled — never one per marker. */
      var pop = document.createElement("div");
      pop.className = "map-pop"; pop.hidden = true;
      host.appendChild(pop);

      function statusLabel(k) {
        for (var i = 0; i < SITE_STATUS.length; i++) if (SITE_STATUS[i].key === k) return SITE_STATUS[i].label;
        return k;
      }

      function drawMarkers() {
        while (markerLayer.firstChild) markerLayer.removeChild(markerLayer.firstChild);
        pop.hidden = true;
        /* SITES is read, never copied. The receiving site rides alongside it. */
        var places = SITES.concat([RECEIVING_SITE]).filter(matchesSiteState);
        var byBoro = {};
        places.forEach(function (p) { (byBoro[p.borough] = byBoro[p.borough] || []).push(p); });

        Object.keys(byBoro).forEach(function (b) {
          var a = geo.boroughAnchors[b];
          if (!a) return;
          var group = byBoro[b];
          var step = 46, top = a[1] - (group.length - 1) * step / 2;
          group.forEach(function (p, i) {
            var x = a[0], y = top + i * step;
            var g = el("g", {
              "class": "pin pin-" + p.status, tabindex: "0", role: "button",
              "aria-label": p.name + ", " + p.borough + ", " + statusLabel(p.status)
            });
            g.appendChild(el("circle", { cx: x, cy: y, r: 9, fill: "var(--surface)", stroke: "var(--text)", "stroke-width": 3.5 }));
            g.appendChild(el("circle", { cx: x, cy: y, r: 4.5, fill: "var(--text)" }));
            var t = el("text", { x: x + 15, y: y + 6, "class": "pin-lbl" });
            t.textContent = statusLabel(p.status);
            g.appendChild(t);
            function show() {
              pop.innerHTML = '<strong>' + p.name + '</strong><span>' + p.borough + '</span><span>' + statusLabel(p.status) + '</span>';
              pop.hidden = false;
              var box = svg.getBoundingClientRect();
              pop.style.left = (x / vb[0] * box.width) + "px";
              pop.style.top = (y / vb[1] * box.height) + "px";
            }
            function hide() { pop.hidden = true; }
            g.addEventListener("mouseenter", show);
            g.addEventListener("mouseleave", hide);
            g.addEventListener("focus", show);
            g.addEventListener("blur", hide);
            markerLayer.appendChild(g);
          });
        });
      }

      /* Legend: the breakpoints in figures, so the ramp reads without colour,
         plus the explicit "no data" class. */
      if (legendHost) {
        var items = [];
        for (var i = 0; i <= MAP_BREAKS.length; i++) {
          var lo = i === 0 ? 0 : MAP_BREAKS[i - 1];
          var hi = MAP_BREAKS[i];
          items.push('<span class="lg-item"><span class="lg-sw" style="background:var(--brand); opacity:' + MAP_OPACITY[i] + '"></span>' +
            (hi === undefined ? lo + "% and over" : lo + "–" + hi + "%") + '</span>');
        }
        items.push('<span class="lg-item"><span class="lg-sw lg-nodata"></span>no data</span>');
        legendHost.innerHTML = items.join("");
      }

      var cite = document.getElementById("mapCite");
      if (cite) {
        cite.textContent = geo.meta.indicator + " (" + geo.meta.units + "). Source: " +
          geo.meta.indicator_source + ". Vintage: " + geo.meta.indicator_vintage +
          ". Boundaries: " + geo.meta.boundaries.split(".")[0] + ".";
      }

      drawMarkers();
      onSiteState(drawMarkers);
      addEventListener("resize", function () { pop.hidden = true; }, { passive: true });
    })["catch"](function () {
      host.innerHTML = '<p class="site-empty">The map data could not be loaded. The list above carries every school and its status.</p>';
    });
    return true;
  }

  /* ======================================================================
     10. SCROLL-IN UTILITY — IntersectionObserver, class-based
     ======================================================================
     The bespoke reveal machinery above (initReveals) drives elements whose
     animation is written in JS. This is the cheap general case: put
     .fade-in-up on anything, and it gets .visible the first time it enters
     the viewport. One observer for the whole page, unobserving as it fires,
     so nothing is still being watched after it has played.

     No observer is created under prefers-reduced-motion, and none is needed
     where IntersectionObserver is missing: in both cases every element is
     marked visible immediately and the CSS resting state is the final one. */
  function initScrollFx(root) {
    var els = $$(".fade-in-up, .fade-in", root);
    if (!els.length) return null;
    if (reduced || !("IntersectionObserver" in window)) {
      els.forEach(function (el) { el.classList.add("visible"); });
      return null;
    }
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (!en.isIntersecting) return;
        en.target.classList.add("visible");
        io.unobserve(en.target);
      });
    }, { rootMargin: "0px 0px -12% 0px", threshold: 0.15 });
    els.forEach(function (el) { io.observe(el); });
    return io;
  }

  /* ======================================================================
     8. READING PROGRESS, CURRENT SECTION, HEADING ANCHORS
     ====================================================================== */
  function initProgress() {
    var bar = document.createElement("div");
    bar.id = "progressBar"; bar.setAttribute("aria-hidden", "true");
    document.body.appendChild(bar);
    var dirty = true;
    addEventListener("scroll", function () { dirty = true; }, { passive: true });
    addEventListener("resize", function () { dirty = true; }, { passive: true });
    (function frame() {
      requestAnimationFrame(frame);
      if (!dirty) return;
      dirty = false;
      var max = document.documentElement.scrollHeight - innerHeight;
      var p = max > 0 ? scrollY / max : 0;
      bar.style.transform = "scaleX(" + (p < 0 ? 0 : p > 1 ? 1 : p).toFixed(4) + ")";
    })();
  }

  function initSectionHighlight() {
    var links = $$('nav.bar .links a[href*="#"]');
    if (!links.length || !("IntersectionObserver" in window)) return;
    var byId = {};
    links.forEach(function (a) {
      var id = a.getAttribute("href").split("#")[1];
      var el = id && document.getElementById(id);
      if (el) byId[id] = a;
    });
    var visible = {};
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) { visible[en.target.id] = en.isIntersecting ? en.intersectionRatio : 0; });
      var best = null, bestV = 0;
      Object.keys(visible).forEach(function (id) { if (visible[id] > bestV) { bestV = visible[id]; best = id; } });
      links.forEach(function (a) { a.removeAttribute("aria-current"); });
      if (best && byId[best]) byId[best].setAttribute("aria-current", "true");
    }, { threshold: [0, 0.15, 0.4, 0.75], rootMargin: "-48px 0px -40% 0px" });
    Object.keys(byId).forEach(function (id) { io.observe(document.getElementById(id)); });
  }

  /* Every h2 and h3 gets a stable id and a copy-link control that is
     keyboard reachable and labelled for a screen reader. */
  function initAnchors() {
    var used = {};
    $$("h2, h3").forEach(function (h) {
      if (h.closest("#palette, .packet-doc")) return;
      var id = h.id;
      if (!id) {
        id = (h.textContent || "").trim().toLowerCase()
          .replace(/[’']/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 48);
        if (!id) return;
        while (used[id] || document.getElementById(id)) id = id.replace(/-\d+$/, "") + "-" + ((used[id] || 1) + 1);
        h.id = id;
      }
      used[id] = 1;
      var b = document.createElement("button");
      b.type = "button"; b.className = "anchor-link";
      var name = (h.textContent || "section").trim().replace(/\s+/g, " ").slice(0, 60);
      b.setAttribute("aria-label", "Copy link to “" + name + "”");
      b.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M10 13a5 5 0 0 0 7 0l2-2a5 5 0 0 0-7-7l-1 1"/><path d="M14 11a5 5 0 0 0-7 0l-2 2a5 5 0 0 0 7 7l1-1"/></svg>';
      b.addEventListener("click", function () {
        var url = location.origin + location.pathname + "#" + h.id;
        var done = function () {
          b.setAttribute("data-copied", "1");
          b.setAttribute("aria-label", "Link copied");
          setTimeout(function () {
            b.removeAttribute("data-copied");
            b.setAttribute("aria-label", "Copy link to “" + name + "”");
          }, 1600);
        };
        if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(url).then(done, done);
        else { location.hash = h.id; done(); }
      });
      h.appendChild(b);
    });
  }

  /* ======================================================================
     7. UNIT TOGGLE — lbs/kg and degF/degC, one control, site-wide
     ======================================================================
     Every convertible number keeps its raw value in a data attribute and the
     text is re-rendered from that on each switch, so flipping back and forth
     any number of times cannot compound a rounding error. */
  var UNIT_KEY = "stb-units";
  function unitMode() {
    try { return localStorage.getItem(UNIT_KEY) === "metric" ? "metric" : "imperial"; } catch (e) { return "imperial"; }
  }
  function renderUnits(root) {
    var metric = unitMode() === "metric";
    $$("[data-lbs]", root).forEach(function (el) {
      var raw = parseFloat(el.getAttribute("data-lbs"));
      if (isNaN(raw)) return;
      el.textContent = metric ? (raw * 0.45359237).toFixed(1) + " kg" : raw.toLocaleString("en-US") + " lbs";
    });
    $$("[data-degf]", root).forEach(function (el) {
      var raw = parseFloat(el.getAttribute("data-degf"));
      if (isNaN(raw)) return;
      el.textContent = metric ? ((raw - 32) * 5 / 9).toFixed(1) + "°C" : raw + "°F";
    });
  }
  function initUnits() {
    var btn = $("#unitToggle");
    if (!btn) return;
    /* The control is site-wide, but a page with nothing convertible on it
       gets no control rather than a dead one. */
    if (!$("[data-lbs]") && !$("[data-degf]")) { btn.hidden = true; return; }
    var live = $("#unitStatus");
    function reflect() {
      var metric = unitMode() === "metric";
      btn.textContent = metric ? "kg · °C" : "lbs · °F";
      btn.setAttribute("aria-label", "Units: " + (metric ? "kilograms and Celsius" : "pounds and Fahrenheit") +
        ". Switch to " + (metric ? "pounds and Fahrenheit" : "kilograms and Celsius") + ".");
    }
    btn.addEventListener("click", function () {
      var next = unitMode() === "metric" ? "imperial" : "metric";
      try { localStorage.setItem(UNIT_KEY, next); } catch (e) {}
      reflect(); renderUnits();
      /* Some readouts compose their own strings (SVG labels, tooltips) and
         cannot be rewritten by the [data-degf] pass, so they listen instead. */
      document.dispatchEvent(new CustomEvent("stb:units"));
      if (live) live.textContent = next === "metric" ? "Kilograms and Celsius" : "Pounds and Fahrenheit";
    });
    reflect(); renderUnits();
  }

  /* ======================================================================
     2. SERVICE WORKER + OFFLINE BANNER
     ====================================================================== */
  function initOffline() {
    var banner = document.createElement("div");
    banner.id = "offlineBanner"; banner.setAttribute("role", "status"); banner.setAttribute("aria-live", "polite");
    banner.textContent = "Offline — showing cached version";
    document.body.appendChild(banner);
    function sync() { banner.classList.toggle("on", navigator.onLine === false); }
    addEventListener("online", sync); addEventListener("offline", sync);
    sync();

    /* Registered on https only. A service worker is not available over
       plain http anyway (localhost aside), and silently failing is worse
       than not trying. */
    if (!("serviceWorker" in navigator)) return;
    if (location.protocol !== "https:" && location.hostname !== "localhost" && location.hostname !== "127.0.0.1") return;
    /* Registered from the site root, not assets/, because a worker can only
       claim a scope at or below its own directory and Pages cannot send
       Service-Worker-Allowed. sw.js is a one-line shim that importScripts()
       the real logic in assets/sw.js. Path stays relative so this works under
       /stock/ without a root-absolute path. */
    navigator.serviceWorker.register("sw.js", { scope: "./" }).catch(function () {});
  }

  global.STB = {
    initPalette: initPalette, initProgress: initProgress,
    initSectionHighlight: initSectionHighlight, initAnchors: initAnchors,
    initUnits: initUnits, renderUnits: renderUnits, unitMode: unitMode,
    initOffline: initOffline,
    SCRUB_LENGTH_VH: SCRUB_LENGTH_VH, MID_SCRUB_LENGTH_VH: MID_SCRUB_LENGTH_VH,
    initScrollScrub: initScrollScrub,
    createMascotBox: createMascotBox, initHeroBox: initHeroBox, initMidBox: initMidBox,
    clamp01: clamp01, sub: sub, easeOut: easeOut, easeInOut: easeInOut,
    $: $, $$: $$,
    reduced: reduced, mob: mob, f: f, EXP: EXP, PRO: PRO,
    ICONS: ICONS, iconSVG: iconSVG, initIcons: initIcons,
    MASCOT_EYES: MASCOT_EYES, MASCOT_SMILE: MASCOT_SMILE,
    MASCOT_LID: MASCOT_LID, MASCOT_LEAN: MASCOT_LEAN,
    mascotSVG: mascotSVG, paintMascot: paintMascot, initMascotSlots: initMascotSlots,
    THEMES: THEMES, currentTheme: currentTheme, storedTheme: storedTheme,
    getVar: getVar, initTheme: initTheme,
    initNav: initNav, initReveals: initReveals,
    SITES: SITES, SITE_STATUS: SITE_STATUS, initSites: initSites,
    RECEIVING_SITE: RECEIVING_SITE, BOROUGHS: BOROUGHS,
    siteState: siteState, onSiteState: onSiteState, matchesSiteState: matchesSiteState,
    initBoroughMap: initBoroughMap,
    initScrollFx: initScrollFx
  };
})(window);
