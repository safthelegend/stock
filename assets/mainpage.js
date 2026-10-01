(function () {
    "use strict";
    var $ = STB.$, $$ = STB.$$;
    var reduced = STB.reduced, mob = STB.mob, f = STB.f, EXP = STB.EXP, PRO = STB.PRO;
    /* Mirrors REVEAL_ON_SCROLL in assets/site.js: when reveals are off,
       nothing on this page pre-hides itself either. */
    var armed = STB.revealOnScroll && !reduced;
    var fmtN = function (n) { return n.toLocaleString("en-US"); };

    var STEPS = [
        { num: "01", title: "Collect sealed leftovers", body: "At the end of lunch, students gather unopened, packaged food from the school’s share table.", detail: "NYC school rules say food must be store-packaged, unopened and kept at a safe temperature before it can leave the cafeteria.", state: "collect", icon: "package" },
        { num: "02", title: "Pack it in a cold box", body: "The food is weighed and packed into an insulated box before it leaves the building.", detail: "Each box gets an ID number. We write down its weight, what’s inside and when it was packed, so every pound can be traced.", state: "pack", icon: "archive" },
        { num: "03", title: "Walk it to a food bank", body: "Two students walk the box to a food bank in the same borough. The food bank signs for it.", detail: "Staying inside one borough keeps every trip short, usually under 30 minutes, so food arrives the same afternoon.", state: "deliver", icon: "truck" },
        { num: "04", title: "Post it online", body: "Every delivery goes on a public log: the date, where it came from, where it went and how much it weighed.", detail: "Entries are never edited; fixes are added as new lines. <span class=\"unverified\">Track the Box, the public log, is planned and not live yet.</span>", state: "record", icon: "clipboard-check" }
    ];
    /* ---------- icon set (shared — assets/site.js) ---------- */
    var iconSVG = STB.iconSVG, initIcons = STB.initIcons;
    initIcons();
    var COLD = [
        { t: "1:42 pm", note: "packed", temp: 36 },
        { t: "2:05 pm", note: "on the way", temp: 38 },
        { t: "2:28 pm", note: "handoff", temp: 43 },
        { t: "2:51 pm", note: "delivered", temp: 39 }
    ];
    var SAFE_MAX = 41;

    /* ---------- mascot component (shared — assets/site.js) ---------- */
    var mascotSVG = STB.mascotSVG, paintMascot = STB.paintMascot, initMascotSlots = STB.initMascotSlots;
    initMascotSlots();

    /* ---------- theme ---------- */
    var getVar = STB.getVar;
    STB.initTheme(function () { if (heroBox) heroBox.repaint(); });

    /* ---------- nav ---------- */
    STB.initNav();

    /* ---------- counters ---------- */
    function count(target, onTick, done) {
        if (reduced) { onTick(target); if (done) done(); return; }
        var t0 = performance.now(), dur = 1200;
        (function tick(now) {
            var p = Math.min((now - t0) / dur, 1);
            var v = Math.round(target * (1 - Math.pow(1 - p, 3)));
            onTick(v);
            if (p < 1) requestAnimationFrame(tick); else if (done) done();
        })(t0);
    }
    var heroDone = false, bandDone = false;
    function checkCounters() {
        var vh = innerHeight;
        if (!heroDone) { heroDone = true; }
        if (!bandDone) {
            var r2 = $("#statband").getBoundingClientRect();
            if (r2.top < vh * 0.9 && r2.bottom > 0) {
                bandDone = true;
                /* Only the two sourced NYC figures animate. The third cell is a
                   pre-launch statement, not a number, so there is nothing to count. */
                count(880000, function (v) { $("#statMeals").textContent = fmtN(v); });
                count(4, function (v) { if (!pctTouched) $("#statPct").textContent = v + "%"; });
            }
        }
    }

    /* ---------- 4% what-if slider ----------
       Every input is sourced in the statband cite line. The Comptroller counts
       buildings, not pounds (NYCPS does not track donation weights), so pounds
       come from a per-school recovery figure and are labelled an estimate. */
    /* NYC Comptroller, FY25: 67 buildings donated, out of the 1,675 buildings
       that serve school food. 67 of 1,675 is the 4%; the report also cites
       1,319 buildings, but 67 of 1,319 would be 5%, so 1,675 is the base here. */
    var BUILDINGS = 1675, DONATING = 67;
    var LBS_PER_BUILDING = 2156;                  /* ≈978 kg/school/yr, 2025 share-table study */
    var LBS_PER_MEAL = 1.2;                       /* Feeding America */
    var pctTouched = false;
    (function () {
        var wrap = $("#pctWhatIf"), range = $("#pctRange"), cap = $("#pctCap"), out = $("#pctResult");
        if (!wrap || !range) return;
        wrap.hidden = false;
        function big(n) {
            if (n >= 1e6) return (n / 1e6).toFixed(n >= 1e7 ? 0 : 1).replace(/\.0$/, "") + " million";
            if (n >= 1e4) return fmtN(Math.round(n / 1000) * 1000);
            return fmtN(Math.round(n / 100) * 100);
        }
        function update() {
            var p = +range.value;
            var n = Math.round(BUILDINGS * p / 100);
            var extraLbs = Math.max(0, n - DONATING) * LBS_PER_BUILDING;
            var metric = STB.unitMode && STB.unitMode() === "metric";
            var amount = metric ? big(extraLbs * 0.45359237) + " kg" : big(extraLbs) + " lbs";
            var meals = big(extraLbs / LBS_PER_MEAL);
            range.style.setProperty("--fill", ((p - 4) / 96 * 100).toFixed(2) + "%");
            $("#statPct").textContent = p + "%";
            if (p <= 4) {
                cap.textContent = "of NYC school buildings donate their leftover food";
                out.innerHTML = "That’s " + DONATING + " of " + fmtN(BUILDINGS) + " buildings. Drag to see what more schools could save.";
                range.setAttribute("aria-valuetext", "4 percent, today: " + DONATING + " buildings donate.");
            } else {
                cap.textContent = "If this many NYC school buildings donated (" + fmtN(n) + " of " + fmtN(BUILDINGS) + ")";
                out.innerHTML = "<b>about " + amount + "</b>more food saved each school year, about " + meals +
                    " meals.<span class=\"est\">estimate</span>";
                range.setAttribute("aria-valuetext", p + " percent, " + fmtN(n) + " buildings: about " + amount +
                    " more food saved each school year, about " + meals + " meals. Estimate.");
            }
        }
        range.addEventListener("input", function () { pctTouched = true; update(); });
        update();
    })();

    /* ---------- procedure rows ---------- */
    var stepsHost = $("#steps");
    STEPS.forEach(function (s, idx) {
        var d = document.createElement("div");
        d.className = "prow";
        d.setAttribute("data-prow", "");
        d.innerHTML = '<button type="button" aria-expanded="false"><span class="num" data-pnum>' + s.num + '</span><span class="pmasc"></span><span class="ttl" data-ptitle>' + iconSVG(s.icon) + '<span>' + s.title + '</span></span><span class="bdy" data-pbody>' + s.body + '</span><span class="caret" aria-hidden="true" style="opacity:1;">+</span></button><div class="pdetail"><div><p>' + s.detail + "</p></div></div>";
        var maskHost = d.querySelector(".pmasc");
        maskHost.innerHTML = mascotSVG("idle", {});
        var btn = d.querySelector("button");
        btn.addEventListener("click", function () {
            var open = d.classList.toggle("open");
            btn.setAttribute("aria-expanded", open ? "true" : "false");
            btn.querySelector(".caret").textContent = open ? "−" : "+";
            paintMascot(maskHost.querySelector("svg"), open ? s.state : "idle");
        });
        stepsHost.appendChild(d);
    });

    /* ---------- cold-chain readout ----------
       One instrument readout for one sample run. The status column states the
       whole run's verdict (how many excursions, and the peak); selecting a point
       only adds a secondary line and never changes that verdict.
  
       The trace is a single path stroked with a gradient that switches colour at
       the SAFE_MAX line, so any stretch above the threshold is accent and any
       stretch below is brand — including mid-morph, when the ice-pack what-if
       slides every reading down. COLD is never modified: the what-if lives in
       COLD_ICE, and the recorded run stays on screen as a dashed ghost while it
       is shown. */
    var ICE_DROP_F = 4;
    var COLD_ICE = COLD.map(function (c) { return { t: c.t, note: c.note, temp: c.temp - ICE_DROP_F }; });
    var coldSparkHost = $("#coldSpark");
    var coldPanel = coldSparkHost.closest(".cold-panel");
    var coldChart = coldSparkHost.closest(".cold-chart");

    /* ---------- the panel's mascot ----------
       3D by default: the shared box renderer with the opt-in goggles face,
       probe and ice pack, idling through ±15° and paused while offscreen. The
       solid flat SVG is the fallback for reduced motion, no JS (it ships in the
       markup) and a renderer failure. Either way, mood() crossfades the face. */
    var coldMascot = (function () {
        var host = $("#coldMascot");
        host.innerHTML = STB.mascotSVG("danger", { solid: true });
        var svg = host.querySelector("svg"), mood = "danger", faceFrom = "danger", faceT0 = -1e9;
        var api = { is3D: false, onLand: null };
        var kick = function () { };
        api.mood = function (m) {
            m = m === "danger" ? "danger" : "inrange";
            if (m === mood) return;
            faceFrom = mood; mood = m; faceT0 = performance.now();
            host.classList.toggle("is-danger", m === "danger");
            paintMascot(svg, m);
            kick();
        };
        api.ice = function () { };
        if (reduced || !STB.createMascotBox) return api;

        var canvas = null, box = null, SCALE = 1.3;
        try {
            canvas = document.createElement("canvas");
            host.appendChild(canvas);
            box = STB.createMascotBox(canvas, { reduced: false, varsFrom: canvas, face: "mid", coat: true, probe: "pocket", lidThick: 0.012, frameY: -0.1 });
            box.render({ yaw: 0, lid: 0, scale: SCALE, face: { from: mood, to: mood, t: 1 } });
        } catch (err) {
            if (canvas) canvas.remove();
            return api;
        }
        host.classList.add("is-3d");
        api.is3D = true;

        var YAW = 15 * Math.PI / 180, PERIOD = 6000, LID_OPEN = 50 * Math.PI / 180;
        var ICE_TOP = 1.55, ICE_REST = -0.52;
        var t0 = performance.now(), raf = 0, visible = false, lid = 0, iceY = null, seq = null;
        function clamp01(v) { return v < 0 ? 0 : v > 1 ? 1 : v; }
        /* Falls under "gravity" (k²) and lands with one small bounce. */
        function drop(e, from) {
            var fall = clamp01((e - 160) / 460);
            if (fall < 1) return from + (ICE_REST - from) * fall * fall;
            var b = clamp01((e - 620) / 160);
            return ICE_REST + 0.09 * Math.sin(Math.PI * b) * (1 - b);
        }
        /* Lid lifts (0-240ms), the pack drops in or climbs out (160-680ms), the
           lid settles shut (700-960ms). A re-toggle mid-flight starts from where
           everything is, so fast toggling never jumps. */
        function step(now) {
            var e = now - seq.t0;
            lid = e < 700 ? seq.lid0 + (LID_OPEN - seq.lid0) * easeOut(clamp01(e / 240))
                : LID_OPEN * (1 - easeOut(clamp01((e - 700) / 260)));
            var k = clamp01((e - 160) / 520);
            iceY = seq.on ? drop(e, seq.ice0) : seq.ice0 + (ICE_TOP - seq.ice0) * k * k;
            if (seq.on && !seq.landed && e >= 620) { seq.landed = true; if (api.onLand) api.onLand(); }
            if (e >= 960) { lid = 0; if (!seq.on) iceY = null; seq = null; }
        }
        function frame(now) {
            raf = 0;
            if (seq) step(now);
            box.render({
                scale: SCALE,
                yaw: YAW * Math.sin((now - t0) / PERIOD * Math.PI * 2),
                lid: lid,
                face: { from: faceFrom, to: mood, t: clamp01((now - faceT0) / 250) },
                iceY: iceY
            });
            if (visible) raf = requestAnimationFrame(frame);
        }
        kick = function () { if (visible && !raf) raf = requestAnimationFrame(frame); };
        api.ice = function (on) {
            seq = { on: on, t0: performance.now(), lid0: lid, ice0: iceY === null ? ICE_TOP : iceY, landed: false };
            kick();
        };
        api.mouth = function () {   /* where the frost bursts from, in panel coordinates */
            var r = canvas.getBoundingClientRect(), pr = coldPanel.getBoundingClientRect();
            return { x: r.left - pr.left + r.width / 2, y: r.top - pr.top + r.height * 0.4 };
        };
        if ("IntersectionObserver" in window) {
            new IntersectionObserver(function (es) {
                visible = es[es.length - 1].isIntersecting;
                if (visible) kick();
            }).observe(host);
        } else { visible = true; kick(); }
        return api;
    })();
    var cold = {
        sel: -1,                       /* selected point, or -1 */
        ice: false,                    /* what-if on */
        vals: COLD.map(function (c) { return c.temp; }),   /* values on screen now */
        drawn: false,                  /* draw-on finished (or skipped) */
        morph: 0, draw: 0,             /* rAF ids */
        g: null                        /* geometry + element refs for the current build */
    };

    function svgEl(name, attrs) {
        var el = document.createElementNS("http://www.w3.org/2000/svg", name);
        for (var k in attrs) if (attrs.hasOwnProperty(k)) el.setAttribute(k, attrs[k]);
        return el;
    }
    function easeOut(u) { return 1 - Math.pow(1 - u, 3); }
    function excursions(vals) {
        var n = 0;
        for (var i = 0; i < vals.length; i++) if (vals[i] > SAFE_MAX && (i === 0 || vals[i - 1] <= SAFE_MAX)) n++;
        return n;
    }

    /* ---------- verdict + secondary reading ---------- */
    function renderVerdict() {
        var v = $("#coldVerdict"), tag = $("#coldSimTag");
        var run = cold.ice ? COLD_ICE : COLD;
        var temps = run.map(function (c) { return c.temp; });
        var n = excursions(temps);
        var peak = 0;
        temps.forEach(function (t, i) { if (t > temps[peak]) peak = i; });
        var safe = n === 0;
        var times = n === 1 ? "once" : n + " times";
        if (cold.ice) {
            /* Never a bare "safe" for invented numbers; the "simulated" tag sits on
               its own line under this. */
            v.innerHTML = safe
                ? "With an ice pack: safe the whole trip"
                : "With an ice pack: still too warm " + times;
            tag.hidden = false;
        } else {
            v.innerHTML = safe ? "Safe the whole trip"
                : "Too warm " + times + ': <span data-degf="' + temps[peak] + '"></span> at ' + run[peak].t;
            tag.hidden = true;
        }
        v.className = "cold-verdict " + (safe ? "is-safe" : "is-danger");
        STB.renderUnits(v);
        coldMascot.mood(safe ? "inrange" : "danger");
        renderReading();
    }
    function renderReading() {
        var r = $("#coldReading");
        if (cold.sel < 0) { r.textContent = "Tap a point on the chart to see its reading."; return; }
        var run = cold.ice ? COLD_ICE : COLD, c = run[cold.sel];
        r.innerHTML = "<b>" + c.t + "</b> · " + c.note + " · <b><span data-degf=\"" + c.temp + "\"></span></b>" +
            (cold.ice ? " simulated" : (c.temp > SAFE_MAX ? " · too warm" : " · safe"));
        STB.renderUnits(r);
    }

    /* ---------- build ----------
       Drawn at the host's real pixel width, so text is set in real pixels at
       every size instead of a 640-wide drawing scaled down to 5px type. */
    function buildCold() {
        var W = Math.max(280, Math.round(coldSparkHost.clientWidth || 640));
        var narrow = W < 480;
        /* Desktop: the chart is as tall as the column beside it, so neither side
           has dead space; never shorter than 220. */
        var side = 0;
        if (!narrow && matchMedia("(min-width:641px)").matches) {
            var mEl = $("#coldMascot"), sEl = coldPanel.querySelector(".cold-status");
            side = mEl.getBoundingClientRect().height + sEl.getBoundingClientRect().height + 4;
        }
        var H = Math.round(Math.max(220, Math.min(380, side)));
        var PAD_T = 18, PAD_B = narrow ? 58 : 48;
        var PAD_X = narrow ? 40 : 56;           /* room for centred two-line x labels */
        var all = COLD.concat(COLD_ICE).map(function (c) { return c.temp; }).concat([SAFE_MAX]);
        var lo = Math.min.apply(null, all) - 2, hi = Math.max.apply(null, all) + 2;
        var plotB = H - PAD_B, plotH = plotB - PAD_T, plotW = W - PAD_X * 2;
        function px(i) { return PAD_X + i * plotW / (COLD.length - 1); }
        function py(t) { return PAD_T + (hi - t) / (hi - lo) * plotH; }
        var yr = py(SAFE_MAX);

        var svg = svgEl("svg", {
            viewBox: "0 0 " + W + " " + H, width: W, height: H, class: "cold-spark" + (cold.ice ? " is-ice" : ""), role: "group",
            "aria-label": "Example trip, not a real delivery. Temperatures for box 0447: packed at 36 degrees, 38 on the way, 43 at the handoff, delivered at 39. Safe at 41 or below."
        });
        var defs = svgEl("defs", {});
        /* Hard colour stop at the threshold: above it accent, below it brand. */
        var grad = svgEl("linearGradient", { id: "csGrad", gradientUnits: "userSpaceOnUse", x1: 0, y1: 0, x2: 0, y2: H });
        var f = (yr / H).toFixed(4);
        grad.appendChild(svgEl("stop", { offset: 0, style: "stop-color:var(--accent)" }));
        grad.appendChild(svgEl("stop", { offset: f, style: "stop-color:var(--accent)" }));
        grad.appendChild(svgEl("stop", { offset: f, style: "stop-color:var(--brand)" }));
        grad.appendChild(svgEl("stop", { offset: 1, style: "stop-color:var(--brand)" }));
        defs.appendChild(grad);
        svg.appendChild(defs);

        var zone = svgEl("rect", { x: 0, y: 0, width: W, height: yr, class: "cs-zone" });
        svg.appendChild(zone);
        svg.appendChild(svgEl("line", { x1: 0, x2: W, y1: yr, y2: yr, class: "cs-threshold" }));
        var ruleLbl = svgEl("text", { x: W - 6, y: yr - 8, class: "cs-threshold-lbl", "text-anchor": "end" });
        ruleLbl.appendChild(document.createTextNode("safe ≤ "));
        ruleLbl.appendChild(svgEl("tspan", { "data-degf": SAFE_MAX }));
        svg.appendChild(ruleLbl);

        function pathFor(vals) {
            return vals.map(function (t, i) { return (i ? "L" : "M") + px(i).toFixed(1) + " " + py(t).toFixed(1); }).join(" ");
        }
        var ghost = svgEl("path", { d: pathFor(COLD.map(function (c) { return c.temp; })), class: "cs-ghost" });
        svg.appendChild(ghost);
        var line = svgEl("path", { d: pathFor(cold.vals), class: "cs-line", stroke: "url(#csGrad)" });
        svg.appendChild(line);

        var pts = COLD.map(function (c, i) {
            var g = svgEl("g", { class: "cs-pt", tabindex: "0", role: "button", "aria-pressed": "false" });
            var hit = svgEl("circle", { cx: px(i), cy: 0, r: 16, class: "cs-hit" });
            var dot = svgEl("circle", { cx: px(i), cy: 0, class: "cs-dot" });
            var tl = svgEl("text", { x: px(i), y: 0, class: "cs-temp", "text-anchor": "middle" });
            var xl = svgEl("text", { x: px(i), y: plotB + 12 + 9, class: "cs-xlabel", "text-anchor": "middle" });
            var t1 = svgEl("tspan", { x: px(i) }); t1.textContent = c.t;
            xl.appendChild(t1);
            /* On a phone the four notes cannot sit side by side at a readable size,
               so each multi-word note stacks one word per line. */
            (narrow ? c.note.split(" ") : [c.note]).forEach(function (word, k) {
                var t2 = svgEl("tspan", { x: px(i), dy: k ? 12 : 14, class: "cs-note" }); t2.textContent = word;
                xl.appendChild(t2);
            });
            g.appendChild(hit); g.appendChild(dot); g.appendChild(tl); g.appendChild(xl);
            function select() { cold.sel = i; syncSelection(); renderReading(); }
            g.addEventListener("click", select);
            g.addEventListener("keydown", function (e) {
                if (e.key === "Enter" || e.key === " " || e.key === "Spacebar") { e.preventDefault(); select(); }
            });
            svg.appendChild(g);
            return { g: g, hit: hit, dot: dot, tl: tl };
        });

        coldSparkHost.innerHTML = "";
        coldSparkHost.appendChild(svg);
        STB.renderUnits(coldSparkHost);
        /* Measured after it is in the DOM, for label collision checks. */
        var rl = ruleLbl.getBBox();
        cold.g = {
            W: W, H: H, px: px, py: py, yr: yr, plotB: plotB, PAD_T: PAD_T, svg: svg, line: line, zone: zone,
            pts: pts, pathFor: pathFor, ruleBox: { x: rl.x - 3, y: rl.y - 2, w: rl.width + 6, h: rl.height + 4 }
        };
        place(cold.vals);
        syncSelection();
    }

    /* Temp labels: above a point under the threshold, below one over it; flip
       if that would touch the threshold line or its label. */
    function labelY(i, t, y) {
        var G = cold.g, x = G.px(i), halfW = 18, asc = 9, desc = 3;
        function clash(base) {
            var top = base - asc, bot = base + desc;
            if (top < G.yr + 3 && bot > G.yr - 3) return true;                          /* the line */
            var r = G.ruleBox;
            if (x + halfW > r.x && x - halfW < r.x + r.w && bot > r.y && top < r.y + r.h) return true; /* its label */
            if (top < 2 || bot > G.plotB + 8) return true;                                 /* off the plot */
            return false;
        }
        var above = y - 11, below = y + 19;
        var first = t <= SAFE_MAX ? above : below, second = t <= SAFE_MAX ? below : above;
        return !clash(first) ? first : (!clash(second) ? second : first);
    }
    function place(vals) {
        var G = cold.g; if (!G) return;
        G.line.setAttribute("d", G.pathFor(vals));
        vals.forEach(function (t, i) {
            var p = G.pts[i], y = G.py(t), danger = t > SAFE_MAX, shown = Math.round(t);
            p.dot.setAttribute("cy", y.toFixed(1)); p.hit.setAttribute("cy", y.toFixed(1));
            p.dot.setAttribute("class", "cs-dot" + (danger ? " danger" : ""));
            p.tl.setAttribute("y", labelY(i, t, y).toFixed(1));
            p.tl.setAttribute("class", "cs-temp" + (danger ? " danger" : ""));
            if (p.tl.getAttribute("data-degf") !== String(shown)) { p.tl.setAttribute("data-degf", shown); STB.renderUnits(p.g); }
            var c = (cold.ice ? COLD_ICE : COLD)[i];
            p.g.setAttribute("aria-label", c.t + " " + c.note + ", " + c.temp + " degrees" + (cold.ice ? ", simulated" : "") + (c.temp > SAFE_MAX ? ", above threshold" : ""));
        });
    }
    function syncSelection() {
        if (!cold.g) return;
        cold.g.pts.forEach(function (p, i) {
            p.g.classList.toggle("active", i === cold.sel);
            p.g.setAttribute("aria-pressed", i === cold.sel ? "true" : "false");
        });
    }

    /* ---------- draw-on ----------
       Traces left to right with stroke-dashoffset; each point and its labels
       fade in as the line reaches it, and the danger band pulses once as the
       line first crosses SAFE_MAX. */
    function finishDraw() {
        cancelAnimationFrame(cold.draw);
        cold.drawn = true;
        if (!cold.g) return;
        cold.g.line.style.strokeDasharray = ""; cold.g.line.style.strokeDashoffset = "";
        cold.g.pts.forEach(function (p) { p.g.classList.remove("cs-pending"); });
    }
    function startDraw() {
        if (cold.drawn || !cold.g) return;
        if (reduced) { finishDraw(); return; }
        var G = cold.g, L = G.line.getTotalLength();
        /* Where along the path each vertex, and the first threshold crossing, sit. */
        var vx = [0], acc = 0, cross = -1;
        for (var i = 1; i < cold.vals.length; i++) {
            var ax = G.px(i - 1), ay = G.py(cold.vals[i - 1]), bx = G.px(i), by = G.py(cold.vals[i]);
            var seg = Math.hypot(bx - ax, by - ay);
            if (cross < 0 && (cold.vals[i - 1] <= SAFE_MAX) !== (cold.vals[i] <= SAFE_MAX)) {
                cross = (acc + seg * (SAFE_MAX - cold.vals[i - 1]) / (cold.vals[i] - cold.vals[i - 1])) / L;
            }
            acc += seg; vx.push(acc / L);
        }
        G.line.style.strokeDasharray = L; G.line.style.strokeDashoffset = L;
        var t0 = performance.now(), dur = 1200, pulsed = false;
        (function tick(now) {
            var p = easeOut(Math.min(1, (now - t0) / dur));
            G.line.style.strokeDashoffset = (L * (1 - p)).toFixed(1);
            vx.forEach(function (fr, k) { if (p >= fr - 0.001) G.pts[k].g.classList.remove("cs-pending"); });
            if (!pulsed && cross >= 0 && p >= cross) {
                pulsed = true; G.zone.classList.remove("cs-pulse"); void G.zone.getBBox(); G.zone.classList.add("cs-pulse");
            }
            if (p < 1) cold.draw = requestAnimationFrame(tick); else finishDraw();
        })(t0);
    }

    /* ---------- ice-pack what-if ---------- */
    function morphTo(target) {
        cancelAnimationFrame(cold.morph);
        if (reduced) { cold.vals = target.slice(); place(cold.vals); return; }
        var from = cold.vals.slice(), t0 = performance.now(), dur = 800;
        (function tick(now) {
            var p = easeOut(Math.min(1, (now - t0) / dur));
            cold.vals = from.map(function (v, i) { return v + (target[i] - v) * p; });
            place(cold.vals);
            if (p < 1) cold.morph = requestAnimationFrame(tick);
            else { cold.vals = target.slice(); place(cold.vals); }
        })(t0);
    }
    var icePack = null, frostTimer = 0;
    function dropPoint() {
        /* Just above the run's peak, in panel coordinates. */
        var G = cold.g, peak = 0;
        COLD.forEach(function (c, i) { if (c.temp > COLD[peak].temp) peak = i; });
        var sr = G.svg.getBoundingClientRect(), pr = coldPanel.getBoundingClientRect(), k = sr.width / G.W;
        return { x: sr.left - pr.left + G.px(peak) * k, y: sr.top - pr.top + Math.max(12, (G.PAD_T - 2)) * k, top: sr.top - pr.top };
    }
    function frostBurst(x, y) {
        /* One burst at a time: a fast re-toggle replaces the last one, so nothing
           is ever left behind. */
        var old = coldPanel.querySelector(".cold-frost"); if (old) old.remove();
        clearTimeout(frostTimer);
        if (reduced) return;
        var burst = document.createElement("span");
        burst.className = "cold-frost"; burst.setAttribute("aria-hidden", "true");
        burst.style.left = x.toFixed(1) + "px"; burst.style.top = y.toFixed(1) + "px";
        for (var n = 0; n < 10; n++) {
            var a = (n / 10) * Math.PI * 2 + Math.random() * 0.5, r = 22 + Math.random() * 22;
            var s = document.createElement("i");
            if (n % 3 === 0) s.className = "flake";
            s.style.setProperty("--dx", (Math.cos(a) * r).toFixed(1) + "px");
            s.style.setProperty("--dy", (Math.sin(a) * r).toFixed(1) + "px");
            s.style.animationDelay = (Math.random() * 60).toFixed(0) + "ms";
            burst.appendChild(s);
        }
        coldPanel.appendChild(burst);
        frostTimer = setTimeout(function () { burst.remove(); }, 720);
    }
    coldMascot.onLand = function () { var m = coldMascot.mouth(); frostBurst(m.x, m.y); };
    function iceVisual(on) {
        coldChart.classList.toggle("is-frost", on);
        var old = coldPanel.querySelector(".cold-frost"); if (old) old.remove();
        clearTimeout(frostTimer);
        /* 3D: the pack drops into the mascot's box, and the frost bursts from
           its opening as it lands. */
        if (coldMascot.is3D) { coldMascot.ice(on); return; }
        /* Reduced motion: the state swaps and nothing drops. */
        if (reduced) return;
        /* Flat fallback: a small pack drops onto the chart instead. */
        if (!icePack) {
            icePack = document.createElement("span");
            icePack.className = "cold-icepack"; icePack.setAttribute("aria-hidden", "true");
            icePack.innerHTML = '<svg viewBox="0 0 30 24" width="30" height="24"><rect x="1.5" y="3" width="27" height="19" rx="5" fill="rgba(200,232,255,0.18)" stroke="#CFE8FF" stroke-width="1.5"/><path d="M15 7v11M10.2 9.7l9.6 5.6M10.2 15.3l9.6-5.6" stroke="#E6F4FF" stroke-width="1.5" stroke-linecap="round"/></svg>';
            coldPanel.appendChild(icePack);
        }
        var d = dropPoint();
        icePack.style.left = d.x.toFixed(1) + "px"; icePack.style.top = d.y.toFixed(1) + "px";
        icePack.style.setProperty("--drop", (-(d.y + 24)).toFixed(0) + "px");
        icePack.classList.remove("is-in", "is-out"); void icePack.offsetWidth;
        icePack.classList.add(on ? "is-in" : "is-out");
        if (on) frostBurst(d.x, d.y + 8);
    }
    function setIce(on) {
        cold.ice = on;
        finishDraw();
        var btn = $("#coldIce");
        btn.setAttribute("aria-pressed", on ? "true" : "false");
        btn.querySelector(".cold-ice-lbl").textContent = on ? "Remove ice pack" : "Add ice pack";
        cold.g.svg.classList.toggle("is-ice", on);
        renderVerdict();
        iceVisual(on);
        morphTo((on ? COLD_ICE : COLD).map(function (c) { return c.temp; }));
        $("#coldIceStatus").textContent = on
            ? "Ice pack added. " + $("#coldVerdict").textContent + ". Simulated trip, every reading " + ICE_DROP_F + " degrees colder, not measured."
            : "Ice pack removed. Sample trip: " + $("#coldVerdict").textContent + ".";
    }
    (function () {
        var btn = $("#coldIce");
        btn.hidden = false;
        btn.addEventListener("click", function () { btn.classList.add("tried"); setIce(!cold.ice); });
    })();

    /* ---------- tilt ----------
       Pointer-follow perspective on the panel only; the SVG inside stays a flat
       plane. Mouse and pen only, never touch, never under reduced motion. */
    (function () {
        if (reduced || !matchMedia("(hover: hover) and (pointer: fine)").matches) return;
        var MAX = 4, raf = 0, rx = 0, ry = 0;
        function apply() { raf = 0; coldPanel.style.transform = "perspective(1200px) rotateX(" + rx.toFixed(2) + "deg) rotateY(" + ry.toFixed(2) + "deg)"; }
        coldPanel.addEventListener("pointermove", function (e) {
            if (e.pointerType === "touch") return;
            var r = coldPanel.getBoundingClientRect();
            var nx = (e.clientX - r.left) / r.width - 0.5, ny = (e.clientY - r.top) / r.height - 0.5;
            ry = Math.max(-MAX, Math.min(MAX, nx * 2 * MAX));
            rx = Math.max(-MAX, Math.min(MAX, -ny * 2 * MAX));
            coldPanel.style.transition = "transform 120ms ease-out";
            if (!raf) raf = requestAnimationFrame(apply);
        });
        coldPanel.addEventListener("pointerleave", function () {
            cancelAnimationFrame(raf); raf = 0; rx = 0; ry = 0;
            coldPanel.style.transition = "transform 600ms cubic-bezier(0.16,1,0.3,1)";
            coldPanel.style.transform = "perspective(1200px) rotateX(0deg) rotateY(0deg)";
        });
    })();

    function renderCold() {
        buildCold();
        renderVerdict();
        if (!cold.drawn && !reduced) cold.g.pts.forEach(function (p) { p.g.classList.add("cs-pending"); });
        if (!cold.drawn && !reduced) { cold.g.line.style.strokeDasharray = 1e5; cold.g.line.style.strokeDashoffset = 1e5; }
        if (reduced) cold.drawn = true;
    }
    renderCold();
    if (!cold.drawn) {
        if ("IntersectionObserver" in window) {
            var coldIO = new IntersectionObserver(function (es) {
                es.forEach(function (e) { if (e.isIntersecting) { coldIO.disconnect(); startDraw(); } });
            }, { threshold: 0.35 });
            coldIO.observe(coldPanel);
        } else finishDraw();
    }
    /* Rebuilt at the new width on resize, keeping state. */
    (function () {
        var lastW = coldSparkHost.clientWidth, t = 0;
        addEventListener("resize", function () {
            clearTimeout(t);
            t = setTimeout(function () {
                var w = coldSparkHost.clientWidth;
                if (Math.abs(w - lastW) < 2) return;
                lastW = w; finishDraw(); cancelAnimationFrame(cold.morph);
                cold.vals = (cold.ice ? COLD_ICE : COLD).map(function (c) { return c.temp; });
                buildCold();
                if (icePack && cold.ice) { var d = dropPoint(); icePack.style.left = d.x + "px"; icePack.style.top = d.y + "px"; }
            }, 150);
        }, { passive: true });
    })();

    /* ---------- join form ----------
       Writes each submission into Firestore's contactSubmissions collection
       (see assets/firebase-init.js). The success card only appears once the
       write is confirmed; previously this fired on every submit regardless
       of whether anything was actually sent anywhere. */
    var form = $("#joinForm");
    var joinBtn = form.querySelector("[data-ffb]");
    var joinErr = $("#joinFormError");
    /* firebase-init.js is a <script type="module">, which loads
       asynchronously — a fast click could beat it. Resolves as soon as it's
       ready, or after 4s so a slow/broken load fails visibly instead of
       hanging the button forever. */
    function waitForFirebase() {
        return new Promise(function (resolve) {
            if (window.STB_FIREBASE) return resolve(window.STB_FIREBASE);
            var t = setTimeout(function () { resolve(window.STB_FIREBASE || null); }, 4000);
            addEventListener("stb-firebase-ready", function once() {
                clearTimeout(t);
                removeEventListener("stb-firebase-ready", once);
                resolve(window.STB_FIREBASE);
            });
        });
    }
    /* Spam traps. Bots fill every field, including one people can't see, and
   submit within a second of the page loading. Either way they get the same
   "thanks" card a person gets, so they learn nothing, and nothing is saved. */
    var loadedAt = Date.now();
    function showDone() {
        $("#formWrap").innerHTML = '<div class="done-card"><h3 style="font-size:19px;font-weight:600;margin:0;color:var(--brand);">Logged. We’ll be in touch.</h3><p style="font-size:14px;color:var(--text);margin:8px 0 0;line-height:1.6;">Thanks, expect a reply within a few school days.</p></div>';
        paintMascot($("#mascotJoin svg"), "confirmed");
        setTimeout(function () { paintMascot($("#mascotJoin svg"), "idle"); }, 2000);
    }
    form.addEventListener("submit", function (e) {
        e.preventDefault();
        if (joinErr) joinErr.hidden = true;
        if (form.website.value || Date.now() - loadedAt < 3000) { showDone(); return; }
        var payload = {
            name: form.name.value.trim(), email: form.email.value.trim(), role: form.role.value,
            org: form.org.value.trim(), message: form.message.value.trim()
        };
        joinBtn.disabled = true;
        joinBtn.textContent = "Sending…";
        waitForFirebase().then(function (fb) {
            if (!fb) throw new Error("firebase-unavailable");
            payload.createdAt = fb.serverTimestamp();
            return fb.addDoc(fb.collection(fb.db, "contactSubmissions"), payload);
        }).then(showDone).catch(function () {
            joinBtn.disabled = false;
            joinBtn.textContent = "Get in touch";
            if (joinErr) joinErr.hidden = false;
        });
    });

    /* ---------- scroll FX ---------- */
    var FX = STB.initReveals();
    var shot = FX.shot;
    (function () {
        var items = $$("[data-stat]");
        if (armed) items.forEach(function (el) { el.style.opacity = "0"; el.style.transform = "translateY(" + 32 * f + "px) scale(0.97)"; });
        shot($("#statband"), function () {
            items.forEach(function (el, i) {
                el.style.transition = "opacity 600ms " + EXP + " " + i * 90 + "ms, transform 600ms " + EXP + " " + i * 90 + "ms";
                el.style.opacity = "1"; el.style.transform = "translateY(0) scale(1)";
            });
        });
    })();
    (function () {
        var fields = $$("[data-ff]");
        if (armed) fields.forEach(function (el) {
            el.style.opacity = "0";
            el.style.transform = el.hasAttribute("data-ffb") ? "scale(0.96)" : "translateY(" + 14 * f + "px)";
        });
        shot($("#formWrap"), function () {
            fields.forEach(function (el, i) {
                el.style.transition = "opacity 450ms " + PRO + " " + i * 50 + "ms, transform 450ms " + PRO + " " + i * 50 + "ms";
                el.style.opacity = "1"; el.style.transform = "none";
            });
        });
    })();

    function fxLoop() {
        requestAnimationFrame(fxLoop);
        var vh = innerHeight;
        FX.tick();
        checkCounters();
    }
    requestAnimationFrame(fxLoop);

    /* ---------- hero box: scroll scrub + drag (shared — assets/site.js) ----------
       Replaces the previous WebGL hero and the cafeteria-fridge transition. The
       box geometry, camera and rear-edge lid hinge are carried over unchanged;
       the renderer no longer needs Three.js from a CDN, which also means the box
       now appears for everyone rather than only for readers who can reach it.
  
       Two scroll-driven sections on this page, and only two: this one and the
       mid-page container below it. Both call the same createMascotBox and the
       same initScrollScrub; all that differs is the state each one feeds in. */
    var heroBox = STB.initHeroBox();

    /* One-line school summary under the map, counted from the same table the
       map and the full list read, so the numbers can never drift apart. */
    (function () {
        var el = $("#sitesSummary");
        if (!el || !STB.SITES) return;
        var n = function (k) { return STB.SITES.filter(function (s) { return s.status === k; }).length; };
        el.innerHTML = STB.SITES.length + " schools so far: " + n("setup") + " getting set up, " + n("conversation") +
            " in talks, " + n("target") + " we plan to reach. <a href=\"getting-started.html#sites\">See the full list →</a>";
    })();
    if (STB.initNetworkMap) STB.initNetworkMap();
    STB.initEmblems();
    STB.initGallery();
    STB.initScrollFx();
    STB.initProgress();
    STB.initAnchors();
    STB.initSectionHighlight();
    STB.initUnits();
    STB.initOffline();
    STB.initPalette([
        { kind: "page", label: "Home", href: "index.html#top" },
        { kind: "page", label: "How we track every box", href: "tracking.html", keywords: "tracker manifest delivery log track the box sealed box" },
        { kind: "page", label: "Why now", href: "why.html", keywords: "snap cuts funding limits sources" },
        { kind: "page", label: "Meet the team", href: "team.html", keywords: "team founder students story schools" },
        { kind: "page", label: "Team roles", href: "roles.html" },
        { kind: "page", label: "Getting started", href: "getting-started.html", keywords: "start begin school setup checklist" },
        { kind: "section", label: "How it works", href: "#how", keywords: "steps collect pack deliver log" },
        { kind: "section", label: "Food safety: the ice pack", href: "#sensors", keywords: "temperature cold chain ice pack logger" },
        { kind: "section", label: "The map", href: "#network", keywords: "map snap need boroughs districts" },
        { kind: "section", label: "Learn more", href: "#learn" },
        { kind: "section", label: "Work with us", href: "#join", keywords: "contact signup form" },
        { kind: "template", label: "Health code memo", href: "getting-started.html#doc-health", keywords: "tcs food safety release records health department" },
        { kind: "template", label: "Box spec", href: "getting-started.html#doc-build", keywords: "insulated transport box cut sheet materials" },
        { kind: "template", label: "Partner agreement", href: "getting-started.html#doc-agreement", keywords: "one page signed school receiving site" },
        { kind: "template", label: "Intake workflow", href: "getting-started.html#doc-intake", keywords: "pantry receive confirm close out manifest line" },
        { kind: "tool", label: "Run packet generator", href: "getting-started.html#runPacket", keywords: "print manifest temperature log paperwork" },
        { kind: "tool", label: "Sources", href: "why.html#sources", keywords: "citations footnotes references" }
    ]);
})();