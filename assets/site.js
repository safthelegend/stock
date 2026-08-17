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
     Verbatim apart from one addition: pages can pass an onChange callback, so
     index.html can repaint its WebGL scenes when the theme flips and
     getting-started.html — which has none — can simply omit it. */
  var html = document.documentElement;
  var sysDark = matchMedia("(prefers-color-scheme: dark)");
  function currentTheme() { return html.getAttribute("data-theme") || (sysDark.matches ? "dark" : "light"); }
  function getVar(n) { return getComputedStyle(html).getPropertyValue(n).trim(); }

  function initTheme(onChange) {
    var toggle = $("#themeToggle");
    if (!toggle) return;
    function fire() { if (typeof onChange === "function") onChange(); }
    function reflectTheme() {
      var dark = currentTheme() === "dark";
      toggle.setAttribute("aria-pressed", dark ? "true" : "false");
      $("#iconMoon").style.display = dark ? "none" : "block";
      $("#iconSun").style.display = dark ? "block" : "none";
    }
    toggle.addEventListener("click", function () {
      var next = currentTheme() === "dark" ? "light" : "dark";
      html.setAttribute("data-theme-anim", "");
      html.setAttribute("data-theme", next);
      try { localStorage.setItem("stb-theme", next); } catch (e) {}
      reflectTheme();
      fire();
    });
    sysDark.addEventListener("change", function () { if (!html.getAttribute("data-theme")) { reflectTheme(); fire(); } });
    reflectTheme();
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

  global.STB = {
    $: $, $$: $$,
    reduced: reduced, mob: mob, f: f, EXP: EXP, PRO: PRO,
    ICONS: ICONS, iconSVG: iconSVG, initIcons: initIcons,
    MASCOT_EYES: MASCOT_EYES, MASCOT_SMILE: MASCOT_SMILE,
    MASCOT_LID: MASCOT_LID, MASCOT_LEAN: MASCOT_LEAN,
    mascotSVG: mascotSVG, paintMascot: paintMascot, initMascotSlots: initMascotSlots,
    currentTheme: currentTheme, getVar: getVar, initTheme: initTheme,
    initNav: initNav, initReveals: initReveals
  };
})(window);
