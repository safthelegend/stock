/* ============================================================================
   Stock the Block — temperature recorder on "Log a delivery" (members.html)
   Exposes window.STBT. Loaded after portal.js and tempchart.js.

   How the readings get here: the box sensor (an ESP32, temperature_sensor/)
   joins the member's phone hotspot and adds a reading to
   sensors/{sensorUid}/readings once a minute, whether or not anyone is
   watching. Start and Stop here just mark a stretch of time. The readings in
   that stretch are shown live and saved with the delivery as temps.

   The recording is remembered in this browser (localStorage) along with the
   box ID, so closing the tab or reloading mid-delivery loses nothing: the
   readings live in the database, and this only needs the start and stop times.
   ============================================================================ */
(function () {
  "use strict";
  const P = STBP, el = P.el, T = STBTemp;
  const KEY = "stb-temp-session";
  const MAX_READINGS = 500;          // matches firestore.rules (temps.size() <= 500)
  const STALE_MS = 5 * 60 * 1000;    // no reading for 5 minutes: say so

  // { boxId, sensor: { uid, name }, start, stop } or null
  function load() {
    try {
      const s = JSON.parse(localStorage.getItem(KEY));
      return s && s.boxId && s.sensor && s.sensor.uid && Number.isFinite(s.start) ? s : null;
    } catch (e) { return null; }
  }
  function store(s) {
    try { if (s) localStorage.setItem(KEY, JSON.stringify(s)); else localStorage.removeItem(KEY); } catch (e) { /* storage blocked: still works until the tab closes */ }
  }

  const ago = (ms) => {
    const m = Math.floor((Date.now() - ms) / 60000);
    return m < 1 ? "just now" : m === 1 ? "1 minute ago" : m < 60 ? m + " minutes ago" : Math.floor(m / 60) + " h " + (m % 60) + " min ago";
  };

  function recorder(host) {
    let ctx = null, boxId = "", session = null;
    let sensors = null;              // [{ uid, name }] once loaded
    let all = [];                    // every reading since Start, { t, c }
    let stopSensors = null, stopReadings = null, timer = null;

    const kept = () => all.filter((r) => r.t >= session.start && (!session.stop || r.t <= session.stop));

    function listen() {
      if (stopReadings) stopReadings();
      const { fb } = ctx;
      /* Every reading since Start. It keeps listening after Stop too, so a
         reading the sensor took before Stop but sent late (it was off the
         hotspot) still makes it in, until the delivery is saved. */
      const q = fb.query(fb.collection(fb.db, "sensors", session.sensor.uid, "readings"),
        fb.where("at", ">=", new Date(session.start)));
      stopReadings = fb.onSnapshot(q, (snap) => {
        all = snap.docs.map((d) => { const v = d.data(); return { t: v.at && v.at.toMillis ? v.at.toMillis() : NaN, c: v.c }; })
          .filter((r) => Number.isFinite(r.t) && Number.isFinite(r.c)).sort((a, b) => a.t - b.t);
        render();
      }, (err) => { console.error(err); render("Couldn't load readings: " + err.code); });
    }

    function begin(sensor) {
      session = { boxId, sensor, start: Date.now(), stop: null };
      store(session);
      all = [];
      listen();
      render();
    }
    function end() { if (session && !session.stop) { session.stop = Date.now(); store(session); render(); } }
    function resume() { session.stop = null; store(session); render(); }
    function discard() {
      if (!confirm("Throw away this temperature log? The readings stay with the sensor, but this delivery won't have them.")) return;
      finish();
      render();
    }
    function finish() {
      if (stopReadings) { stopReadings(); stopReadings = null; }
      session = null; all = [];
      store(null);
    }

    /* ---------- drawing ---------- */
    function render(problem) {
      if (!ctx) { host.replaceChildren(); return; }
      if (!session) return host.replaceChildren(renderIdle());
      host.replaceChildren(renderSession(problem));
    }

    function renderIdle() {
      if (!sensors) return el("p", { className: "p-muted" }, "Looking for box sensors…");
      if (!sensors.length) return el("p", { className: "p-muted" },
        "No box sensors are set up yet. An admin adds them in Firebase (see temperature_sensor/README.md).");
      const pick = el("select", { className: "tr-pick" }, sensors.map((s) => el("option", { value: s.uid }, s.name)));
      pick.setAttribute("aria-label", "Which sensor is in this box");
      const go = el("button", { type: "button", className: "btn-sm solid" }, "Start recording");
      go.addEventListener("click", () => begin(sensors.find((s) => s.uid === pick.value)));
      return el("div", { className: "tr-idle" },
        el("ol", { className: "tr-steps" },
          el("li", {}, "Turn on your phone's hotspot. On an iPhone, also turn on Maximize Compatibility."),
          el("li", {}, "Switch on the sensor. Its light comes on once it's online."),
          el("li", {}, "Press Start when you pick up the box, and Stop when you drop it off.")),
        el("div", { className: "tr-row" }, pick, go));
    }

    function renderSession(problem) {
      const rows = kept();
      const last = rows[rows.length - 1];
      const recording = !session.stop;
      const btn = (label, cls, fn) => { const b = el("button", { type: "button", className: "btn-sm " + cls }, label); b.addEventListener("click", fn); return b; };

      const now = last
        ? el("div", { className: "tr-now" + (T.toF(last.c) > T.SAFE_MAX_F ? " is-warm" : "") },
            el("span", { className: "tr-temp" }, T.fmtF(T.toF(last.c))),
            el("span", { className: "p-muted" }, (Math.round(last.c * 10) / 10) + "°C · " + ago(last.t)))
        : el("p", { className: "p-muted tr-wait" }, recording
            ? "Waiting for the first reading (up to a minute). Is the hotspot on and the sensor's light lit?"
            : "No readings were recorded.");

      const notes = [];
      if (problem) notes.push(el("p", { className: "p-msg is-err" }, problem));
      if (last && T.toF(last.c) > T.SAFE_MAX_F) notes.push(el("p", { className: "tr-warn" },
        "Warmer than " + T.SAFE_MAX_F + "°F. Add an ice pack and keep the box closed."));
      const quiet = Date.now() - (last ? last.t : session.start);
      if (recording && quiet > STALE_MS) notes.push(el("p", { className: "p-muted" },
        "Nothing new for " + Math.floor(quiet / 60000) + " minutes. The sensor may be off the hotspot; it keeps measuring and catches up when it's back."));

      return el("div", { className: "tr-live" },
        el("div", { className: "tr-head" },
          el("span", { className: "tr-state" + (recording ? " is-on" : "") }, recording ? "Recording" : "Stopped"),
          el("span", { className: "p-muted" }, session.sensor.name + " · since " + T.fmtClock(session.start) +
            (session.stop ? " until " + T.fmtClock(session.stop) : ""))),
        now, ...notes,
        rows.length > 1 ? el("div", { className: "tr-chart" }, T.chart(rows), el("p", { className: "p-muted" }, T.describe(rows))) : null,
        el("div", { className: "tr-row" },
          recording ? btn("Stop recording", "solid", end) : btn("Keep recording", "", resume),
          btn("Discard log", "quiet", discard)),
        el("p", { className: "p-muted tr-foot" }, recording
          ? "You can close this page; recording carries on. The readings are saved with the delivery when you press Save delivery."
          : "These readings are saved with the delivery when you press Save delivery."));
    }

    return {
      /* attach(ctx, boxId): show the recorder for this box. If a recording
         for this box was running when the page closed, it picks up again. */
      attach(c, id) {
        ctx = c; boxId = id;
        const s = load();
        session = s && s.boxId === id ? s : null;
        if (!stopSensors) {
          stopSensors = c.fb.onSnapshot(c.fb.collection(c.fb.db, "sensors"), (snap) => {
            sensors = snap.docs.map((d) => ({ uid: d.id, name: String(d.data().name || "Sensor " + d.id.slice(0, 5)) }))
              .sort((a, b) => a.name.localeCompare(b.name));
            render();
          }, (err) => { console.error(err); sensors = []; render(); });
        }
        if (!timer) timer = setInterval(() => {   // keeps "3 minutes ago" true; skipped while a button has focus
          if (session && !host.contains(document.activeElement)) render();
        }, 20000);
        if (session) listen(); else { all = []; if (stopReadings) { stopReadings(); stopReadings = null; } }
        render();
      },
      detach() {
        [stopSensors, stopReadings].forEach((f) => f && f());
        stopSensors = stopReadings = null;
        clearInterval(timer); timer = null;
        ctx = null; sensors = null;
        render();
      },
      // The readings to save with the delivery: { t, c } with c to 0.01°C.
      readings() {
        if (!session) return [];
        if (!session.stop) end();          // saving ends the recording
        return kept().slice(0, MAX_READINGS).map((r) => ({ t: r.t, c: Math.round(r.c * 100) / 100 }));
      },
      finish
    };
  }

  // The box ID of a recording left running, so the form can keep using it.
  function savedBoxId() { const s = load(); return s ? s.boxId : null; }

  window.STBT = { recorder, savedBoxId };
})();
