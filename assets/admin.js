/* ============================================================================
   Stock the Block — the Review tab on members.html (admins only)
   Every delivery, live. Filter by status, look at the photo, accept or reject
   with a note, fix mistakes, or delete.

   This file doesn't sign anyone in. members.js does that, and if the person
   is an admin it calls STBA.start(ctx). Loaded before members.js.
   ============================================================================ */
   (function () {
    "use strict";
    const $ = STB.$, P = STBP, el = P.el;
  
    let ctx = null;
    let all = [];            // every delivery, newest first
    let filter = "pending";
    const drafts = {};       // reviewer notes being typed, by delivery id
    const photos = {};       // loaded photos, by delivery id
    let editing = null;      // id of the card open for editing, or null
    let onPending = () => {}; // told the waiting count, for the badge on the tab
  
    /* ---------- filter buttons ---------- */
    const TABS = [
      { key: "pending", label: "Waiting" },
      { key: "accepted", label: "Accepted" },
      { key: "rejected", label: "Rejected" },
      { key: "all", label: "All" }
    ];
    function renderTabs() {
      const count = (k) => k === "all" ? all.length : all.filter((d) => d.status === k).length;
      onPending(count("pending"));
      $("#reviewFilters").replaceChildren(...TABS.map((t) => {
        const b = el("button", { type: "button", className: "p-tab" }, t.label + " ", el("span", { className: "p-count" }, count(t.key)));
        b.setAttribute("aria-pressed", String(filter === t.key));
        b.addEventListener("click", () => { filter = t.key; render(); });
        return b;
      }));
    }
  
    /* ---------- writes ---------- */
    async function run(card, fn, okText) {
      const msg = card.querySelector(".p-msg");
      card.querySelectorAll("button").forEach((b) => { b.disabled = true; });
      P.say(msg, "Saving…");
      try {
        await fn();
        P.say(msg, okText, "ok");
      } catch (err) {
        console.error(err);
        P.say(msg, err.code === "permission-denied" ? "The database refused this change. Check the rules and your admin role." : "Couldn't save: " + (err.message || err), "err");
      } finally {
        card.querySelectorAll("button").forEach((b) => { b.disabled = false; });
      }
    }
  
    function setStatus(d, status) {
      const { fb, user } = ctx;
      const note = (drafts[d.id] !== undefined ? drafts[d.id] : d.reviewNote || "").trim().slice(0, 1000);
      return fb.updateDoc(fb.doc(fb.db, "deliveries", d.id), {
        status,
        reviewNote: note,
        reviewedBy: user.email,
        reviewedAt: fb.serverTimestamp(),
        updatedAt: fb.serverTimestamp()
      }).then(() => { delete drafts[d.id]; });
    }
  
    function remove(d) {
      const { fb } = ctx;
      const b = fb.writeBatch(fb.db);
      b.delete(fb.doc(fb.db, "deliveries", d.id));
      if (d.hasPhoto) b.delete(fb.doc(fb.db, "deliveryPhotos", d.id));
      return b.commit();
    }
  
    /* ---------- one card ---------- */
    function photoBlock(d) {
      if (!d.hasPhoto) return el("p", { className: "p-muted d-nophoto" }, "No photo attached.");
      const wrap = el("div", { className: "d-photo" });
      if (photos[d.id]) {
        wrap.appendChild(el("img", { src: photos[d.id], alt: "Photo of delivery from " + d.fromSchool }));
        return wrap;
      }
      /* Photos load on request, not with the list, so opening Review doesn't
         download every photo ever taken. */
      const btn = el("button", { type: "button", className: "p-link" }, "Show photo");
      btn.addEventListener("click", async () => {
        btn.disabled = true; btn.textContent = "Loading photo…";
        try {
          const snap = await ctx.fb.getDoc(ctx.fb.doc(ctx.fb.db, "deliveryPhotos", d.id));
          if (!snap.exists()) { btn.textContent = "Photo is missing"; return; }
          photos[d.id] = snap.data().dataUrl;
          wrap.replaceChildren(el("img", { src: photos[d.id], alt: "Photo of delivery from " + d.fromSchool }));
        } catch (err) { btn.disabled = false; btn.textContent = "Couldn't load. Try again"; }
      });
      wrap.appendChild(btn);
      return wrap;
    }
  
    function viewCard(d) {
      const card = el("article", { className: "d-card d-admin" });
      const msg = el("p", { className: "p-msg", role: "status" });
  
      const note = el("textarea", { rows: 2, maxLength: 1000, placeholder: "Note for the member (optional). Say why if you reject.",
        value: drafts[d.id] !== undefined ? drafts[d.id] : d.reviewNote || "" });
      note.setAttribute("aria-label", "Note for the member");
      note.addEventListener("input", () => { drafts[d.id] = note.value; });
  
      const btn = (label, cls, fn) => { const b = el("button", { type: "button", className: "btn-sm " + cls }, label); b.addEventListener("click", fn); return b; };
      const actions = el("div", { className: "p-actions" });
      if (d.status !== "accepted") actions.appendChild(btn("Accept", "solid", () => run(card, () => setStatus(d, "accepted"), "Accepted.")));
      if (d.status !== "rejected") actions.appendChild(btn("Reject", "danger", () => {
        if (!note.value.trim() && !confirm("Reject without a note? The member won't know why.")) return;
        run(card, () => setStatus(d, "rejected"), "Rejected.");
      }));
      if (d.status !== "pending") actions.appendChild(btn("Move back to waiting", "", () => run(card, () => setStatus(d, "pending"), "Moved back to waiting.")));
      actions.appendChild(btn("Edit details", "", () => { editing = d.id; render(); }));
      actions.appendChild(btn("Delete", "quiet", () => {
        if (!confirm("Delete this delivery and its photo for good? This can't be undone.")) return;
        run(card, () => remove(d), "Deleted.");
      }));
  
      const reviewed = d.reviewedBy ? " · reviewed by " + d.reviewedBy + " " + P.fmtTime(d.reviewedAt) : "";
      card.append(
        el("header", { className: "d-head" }, P.statusPill(d.status),
          el("span", { className: "p-muted" }, d.memberEmail + ", logged " + P.fmtTime(d.createdAt) + reviewed)),
        el("div", { className: "d-split" }, P.deliveryDetails(d), photoBlock(d)),
        el("div", { className: "d-temps p-muted" }, d.temps && d.temps.length ? d.temps.length + " temperature readings" : "No temperature readings (sensors not connected yet)."),
        note, actions, msg);
      return card;
    }
  
    function editCard(d) {
      const card = el("article", { className: "d-card d-admin is-editing" });
      card.dataset.id = d.id;
      const host = el("div");
      const fields = P.buildFields(host, d);
      const msg = el("p", { className: "p-msg", role: "status" });
      const save = el("button", { type: "button", className: "btn-sm solid" }, "Save changes");
      const cancel = el("button", { type: "button", className: "btn-sm" }, "Cancel");
      cancel.addEventListener("click", () => { editing = null; render(); });
      save.addEventListener("click", async () => {
        let data;
        try { data = fields.read(); } catch (err) { P.say(msg, err.message, "err"); return; }
        await run(card, () => ctx.fb.updateDoc(ctx.fb.doc(ctx.fb.db, "deliveries", d.id),
          { ...data, updatedAt: ctx.fb.serverTimestamp() }), "Saved.");
        if (msg.classList.contains("is-ok")) { editing = null; render(); }
      });
      card.append(
        el("header", { className: "d-head" }, el("b", {}, "Editing"), el("span", { className: "p-muted" }, "Logged by " + d.memberEmail)),
        host, el("div", { className: "p-actions" }, save, cancel), msg);
      return card;
    }
  
    /* ---------- the list ---------- */
    function render() {
      renderTabs();
      const rows = filter === "all" ? all : all.filter((d) => d.status === filter);
      const host = $("#queue");
      if (!rows.length) {
        host.replaceChildren(el("p", { className: "p-muted p-empty" },
          filter === "pending" ? "Nothing waiting. New deliveries show up here as soon as members log them." : "No deliveries here."));
        return;
      }
      /* If someone else changes a delivery while you're editing it, your open
         form is kept rather than wiped; you'll see their change after you save
         or cancel. */
      const prev = host.querySelector(".is-editing");
      const open = prev && prev.dataset.id === editing ? prev : null;
      host.replaceChildren(...rows.map((d) => d.id === editing ? (open || editCard(d)) : viewCard(d)));
    }
  
    /* ---------- the public log (log.html) ----------
       publicLog holds a trimmed copy of every pending or accepted delivery
       (P.publicEntry). Members add their own entry when they log a delivery;
       from then on it's kept in step here, from the admin's side: accepting,
       editing, rejecting or deleting a delivery changes or removes its entry,
       and deliveries logged before the public log existed get one. Only the
       differences are written, so once it's in step this writes nothing. */
    let pub = null;          // publicLog entries by id, once loaded
    let loaded = false;      // true once the deliveries have loaded
    let syncing = false, syncAgain = false;
    const sameEntry = (a, b) => a && b && a.date === b.date && a.weightLbs === b.weightLbs && a.foods === b.foods && a.status === b.status;

    async function syncPublicLog() {
      if (!ctx || !pub || !loaded) return;
      if (syncing) { syncAgain = true; return; }
      syncing = true;
      try {
        const { fb } = ctx;
        const want = {};
        all.forEach((d) => { const e = P.publicEntry(d); if (e) want[d.id] = e; });
        const ops = [];
        Object.keys(want).forEach((id) => { if (!sameEntry(pub[id], want[id])) ops.push({ id, value: want[id] }); });
        Object.keys(pub).forEach((id) => { if (!want[id]) ops.push({ id, value: null }); });
        for (let i = 0; i < ops.length; i += 400) {   // a batch takes up to 500 writes
          const b = fb.writeBatch(fb.db);
          ops.slice(i, i + 400).forEach((op) => {
            const ref = fb.doc(fb.db, "publicLog", op.id);
            if (op.value) b.set(ref, op.value); else b.delete(ref);
          });
          await b.commit();
        }
      } catch (err) {
        console.error("Couldn't update the public delivery log:", err);
      } finally {
        syncing = false;
        if (syncAgain) { syncAgain = false; syncPublicLog(); }
      }
    }

    window.STBA = {
      // start(ctx, { onPending(n) }) begins listening; returns a stop function.
      start: (c, hooks) => {
        ctx = c;
        onPending = (hooks && hooks.onPending) || (() => {});
        const q = c.fb.query(c.fb.collection(c.fb.db, "deliveries"), c.fb.orderBy("createdAt", "desc"));
        const stop = c.fb.onSnapshot(q, (snap) => {
          all = snap.docs.map((d) => ({ id: d.id, ...d.data({ serverTimestamps: "estimate" }) }));
          loaded = true;
          if (editing && !all.some((d) => d.id === editing)) editing = null;
          render();
          syncPublicLog();
        }, (err) => {
          console.error(err);
          $("#queue").replaceChildren(el("p", { className: "p-msg is-err" }, "Couldn't load deliveries: " + err.code));
        });
        const stopPub = c.fb.onSnapshot(c.fb.collection(c.fb.db, "publicLog"), (snap) => {
          pub = {};
          snap.docs.forEach((d) => { pub[d.id] = d.data(); });
          syncPublicLog();
        }, (err) => console.error("Couldn't read the public delivery log:", err));
        return () => { stop(); stopPub(); ctx = null; all = []; pub = null; loaded = false; editing = null; };
      }
    };
  })();