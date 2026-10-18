/* ============================================================================
   Stock the Block — temperature log chart
   Exposes window.STBTemp. Used by the member portal (members.html) and the
   public delivery log (log.html), so a temperature log looks the same in both.

   A temperature log is a list of { t, c }: t is the time in milliseconds,
   c the temperature in °C, as the box sensor measured it. It's shown in °F
   because the food-safety rule is in °F: cold food stays at 41°F or colder.
   ============================================================================ */
(function () {
  "use strict";

  const SAFE_MAX_F = 41;
  const SVGNS = "http://www.w3.org/2000/svg";

  const toF = (c) => c * 9 / 5 + 32;
  const fmtF = (f) => (Math.round(f * 10) / 10) + "°F";
  const fmtClock = (ms) => new Date(ms).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });

  // Only well-formed readings, oldest first, so a bad entry can't break a chart.
  function clean(temps) {
    return (Array.isArray(temps) ? temps : [])
      .filter((r) => r && Number.isFinite(r.t) && Number.isFinite(r.c))
      .slice().sort((a, b) => a.t - b.t);
  }

  function summary(temps) {
    const rows = clean(temps);
    if (!rows.length) return null;
    const f = rows.map((r) => toF(r.c));
    return {
      count: rows.length,
      start: rows[0].t,
      end: rows[rows.length - 1].t,
      minF: Math.min(...f),
      maxF: Math.max(...f),
      over: f.filter((x) => x > SAFE_MAX_F).length
    };
  }

  // One line of text: "38 readings · 1:42 PM – 2:51 PM · 36.1°F to 39.4°F".
  function describe(temps) {
    const s = summary(temps);
    if (!s) return "";
    const span = s.count > 1 ? fmtClock(s.start) + " – " + fmtClock(s.end) : fmtClock(s.start);
    return s.count + (s.count === 1 ? " reading" : " readings") + " · " + span + " · " +
      (s.count > 1 ? fmtF(s.minF) + " to " + fmtF(s.maxF) : fmtF(s.maxF));
  }

  function svg(tag, attrs, text) {
    const n = document.createElementNS(SVGNS, tag);
    Object.keys(attrs).forEach((k) => n.setAttribute(k, attrs[k]));
    if (text !== undefined) n.textContent = text;
    return n;
  }

  /* chart(temps) returns an <svg> line chart, with a dashed line at 41°F and
     any reading above it marked. Colours come from the site's theme
     variables, set inline so the chart needs no stylesheet of its own. */
  function chart(temps) {
    const rows = clean(temps);
    const s = summary(rows);
    const W = 600, H = 180, L = 44, R = 14, T = 12, B = 28;
    const root = svg("svg", { viewBox: "0 0 " + W + " " + H, width: "100%", role: "img", style: "display:block;max-width:100%;height:auto;overflow:visible" });
    if (!s) return root;
    root.setAttribute("aria-label", "Temperature log: " + describe(rows) +
      (s.over ? ". " + s.over + " above " + SAFE_MAX_F + "°F." : ". All at or below " + SAFE_MAX_F + "°F."));

    const lo = Math.floor(Math.min(s.minF, 33)), hi = Math.ceil(Math.max(s.maxF, 45));
    const t0 = s.start, t1 = Math.max(s.end, s.start + 60000);
    const x = (t) => L + (t - t0) / (t1 - t0) * (W - L - R);
    const y = (f) => T + (hi - f) / (hi - lo) * (H - T - B);
    const label = (px, py, text, anchor) => svg("text", { x: px, y: py, "text-anchor": anchor,
      style: "fill:var(--text-secondary);font:12px 'DM Mono',ui-monospace,Menlo,monospace" }, text);

    // y axis: bottom, the 41°F line, top
    [lo, hi].forEach((f) => {
      root.appendChild(svg("line", { x1: L, x2: W - R, y1: y(f), y2: y(f), style: "stroke:var(--line);stroke-width:1" }));
      root.appendChild(label(L - 6, y(f) + 4, f + "°", "end"));
    });
    root.appendChild(svg("line", { x1: L, x2: W - R, y1: y(SAFE_MAX_F), y2: y(SAFE_MAX_F),
      style: "stroke:var(--accent);stroke-width:1.5;stroke-dasharray:5 4" }));
    root.appendChild(label(L - 6, y(SAFE_MAX_F) + 4, SAFE_MAX_F + "°", "end"));

    // x axis: first and last time
    root.appendChild(label(L, H - 8, fmtClock(s.start), "start"));
    if (s.count > 1) root.appendChild(label(W - R, H - 8, fmtClock(s.end), "end"));

    // the line, then dots (all of them if there are few, otherwise only the warm ones)
    const pts = rows.map((r) => [x(r.t), y(toF(r.c))]);
    root.appendChild(svg("path", { d: pts.map((p, i) => (i ? "L" : "M") + p[0].toFixed(1) + " " + p[1].toFixed(1)).join(" "),
      style: "fill:none;stroke:var(--brand);stroke-width:2.5;stroke-linejoin:round;stroke-linecap:round" }));
    rows.forEach((r, i) => {
      const warm = toF(r.c) > SAFE_MAX_F;
      if (!warm && rows.length > 30) return;
      root.appendChild(svg("circle", { cx: pts[i][0], cy: pts[i][1], r: warm ? 4 : 3,
        style: warm ? "fill:var(--accent)" : "fill:var(--surface);stroke:var(--brand);stroke-width:2" }));
    });
    return root;
  }

  window.STBTemp = { SAFE_MAX_F, toF, fmtF, fmtClock, clean, summary, describe, chart };
})();
