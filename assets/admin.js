/* ============================================================================
   Stock the Block — the Review tab on members.html (admins only)
   Every delivery, live. Filter by status, look at the photo, accept or reject
   with a note, fix mistakes, or delete. Also where new accounts are verified:
   anyone can sign in and log deliveries, but theirs wait here, off the public
   log, until an admin verifies them.

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

    /* Who's verified: every account with a role (roles/{uid}). "loading"
       until the list arrives; "off" if the database won't share it, which
       means the updated firestore.rules aren't published yet, and then
       everyone counts as verified, as before. */
    let verified = new Set();
    let rolesState = "loading";
    let people = {};         // members/{uid}: { name, email, createdAt }
    const isVerified = (uid) => rolesState !== "ok" || verified.has(uid);
  
    /* ---------- filter buttons ---------- */
    const TABS = [
      { key: "pending", label: "Waiting" },
      { key: "accepted", label: "Accepted" },
      { key: "rejected", label: "Rejected" },
      { key: "all", label: "All" }
    ];
    function renderTabs() {
      const count = (k) => k === "all" ? all.length : all.filter((d) => d.status === k).length;
      onPending(count("pending") + waitingPeople().length);
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
  
    // Verifies an account: gives it the member role. Admin rights are only
    // ever given by hand in the Firebase console.
    function verify(uid) {
      const { fb, user } = ctx;
      return fb.setDoc(fb.doc(fb.db, "roles", uid), { role: "member", verifiedBy: user.email, verifiedAt: fb.serverTimestamp() });
    }
    function askVerify(uid, email) {
      return confirm("Verify " + (email || "this account") + "?\n\nThey become a member. Their deliveries move into review and show on the public delivery log as waiting.");
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
      /* An unverified account's delivery can be rejected or deleted, but not
         accepted until the account is verified. */
      const held = !isVerified(d.memberUid);
      if (held) actions.appendChild(btn("Verify account", "solid", () => {
        if (askVerify(d.memberUid, d.memberEmail)) run(card, () => verify(d.memberUid), "Verified.");
      }));
      else if (d.status !== "accepted") actions.appendChild(btn("Accept", "solid", () => run(card, () => setStatus(d, "accepted"), "Accepted.")));
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
      card.append(...[
        el("header", { className: "d-head" }, P.statusPill(d.status),
          held ? el("span", { className: "d-status s-held" }, "Unverified account") : null,
          el("span", { className: "p-muted" }, d.memberEmail + ", logged " + P.fmtTime(d.createdAt) + reviewed)),
        held ? el("p", { className: "d-held-note" }, "This account isn't verified yet, so the delivery is off the public log. Verify the account to accept it, or reject it if it isn't one of ours.") : null,
        el("div", { className: "d-split" }, P.deliveryDetails(d), photoBlock(d)),
        el("div", { className: "d-temps p-muted" }, d.temps && d.temps.length ? d.temps.length + " temperature readings" : "No temperature readings (sensors not connected yet)."),
        note, actions, msg].filter(Boolean));
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
  
    /* ---------- new accounts to verify ----------
       Everyone who has opened the portal but isn't verified, plus anyone
       whose delivery is waiting without a profile (they signed up before
       profiles were saved). Newest first. */
    function waitingPeople() {
      if (rolesState !== "ok") return [];
      const out = {};
      Object.keys(people).forEach((uid) => { if (!verified.has(uid)) out[uid] = { uid, ...people[uid] }; });
      all.forEach((d) => { if (!verified.has(d.memberUid) && !out[d.memberUid]) out[d.memberUid] = { uid: d.memberUid, name: "", email: d.memberEmail }; });
      const n = (uid) => all.filter((d) => d.memberUid === uid && d.status !== "rejected").length;
      return Object.values(out).map((p) => ({ ...p, deliveries: n(p.uid) }))
        .sort((a, b) => (b.createdAt ? b.createdAt.toMillis() : 0) - (a.createdAt ? a.createdAt.toMillis() : 0));
    }

    function renderPeople() {
      const host = $("#newMembers");
      if (!host) return;
      const list = waitingPeople();
      if (!list.length) { host.hidden = true; host.replaceChildren(); return; }
      host.replaceChildren(
        el("header", { className: "newm-head" },
          el("h2", {}, "New accounts to verify ", el("span", { className: "p-count" }, list.length)),
          el("p", { className: "p-muted" }, "They've signed in but aren't verified. They can log deliveries, which wait here and stay off the public log until you verify them.")),
        el("ul", { className: "newm-list" }, list.map((p) => {
          const row = el("li", { className: "newm-row" });
          const go = el("button", { type: "button", className: "btn-sm solid" }, "Verify");
          go.addEventListener("click", () => { if (askVerify(p.uid, p.email)) run(row, () => verify(p.uid), "Verified."); });
          const bits = [p.email];
          if (p.createdAt && p.createdAt.toDate) bits.push("joined " + P.fmtTime(p.createdAt));
          bits.push(p.deliveries === 1 ? "1 delivery logged" : p.deliveries + " deliveries logged");
          row.append(
            el("span", { className: "avatar", ariaHidden: "true" }, P.initials({ displayName: p.name, email: p.email })),
            el("div", { className: "newm-who" }, el("b", {}, p.name || p.email || "Unnamed account"), el("span", {}, bits.join(" · "))),
            go,
            el("p", { className: "p-msg", role: "status" }));
          return row;
        })));
      host.hidden = false;
    }

    /* ---------- the list ---------- */
    /* The search box narrows whichever status is showing, by box ID, school,
       drop-off site or member email, so a box can be found from its label. */
    const search = $("#reviewSearch");
    if (search) search.addEventListener("input", () => render());
    function matches(d, q) {
      return [d.boxId, d.fromSchool, d.toSite, d.memberEmail].join(" ").toLowerCase().includes(q);
    }

    function render() {
      renderTabs();
      renderPeople();
      const q = search ? search.value.trim().toLowerCase() : "";
      const rows = (filter === "all" ? all : all.filter((d) => d.status === filter)).filter((d) => !q || matches(d, q));
      const host = $("#queue");
      if (!rows.length) {
        host.replaceChildren(el("p", { className: "p-muted p-empty" },
          q ? "No delivery here matches \u201c" + search.value.trim() + "\u201d." + (filter === "all" ? "" : " Try the All filter.") :
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
    /* The region field needs the updated firestore.rules. Until they're
       published, a write with it is refused, so this falls back to leaving it
       out and stops asking for it. */
    let withRegion = true;
    const sameEntry = (a, b) => a && b && a.date === b.date && a.weightLbs === b.weightLbs && a.foods === b.foods && a.status === b.status &&
      (!withRegion || (a.region || null) === (b.region || null));

    async function syncPublicLog() {
      if (!ctx || !pub || !loaded || rolesState === "loading") return;
      if (syncing) { syncAgain = true; return; }
      syncing = true;
      try {
        const { fb } = ctx;
        /* An unverified account's waiting deliveries stay off until it's
           verified. Accepted ones always stay on. */
        const want = {};
        all.forEach((d) => {
          if (d.status === "pending" && !isVerified(d.memberUid)) return;
          const e = P.publicEntry(d, withRegion); if (e) want[d.id] = e;
        });
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
        if (err.code === "permission-denied" && withRegion) { withRegion = false; syncAgain = true; }
        else console.error("Couldn't update the public delivery log:", err);
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
        const stopRoles = c.fb.onSnapshot(c.fb.collection(c.fb.db, "roles"), (snap) => {
          verified = new Set(snap.docs.filter((d) => ["member", "admin"].includes(d.data().role)).map((d) => d.id));
          rolesState = "ok";
          if (loaded) render();
          syncPublicLog();
        }, () => { rolesState = "off"; if (loaded) render(); syncPublicLog(); });
        const stopPeople = c.fb.onSnapshot(c.fb.collection(c.fb.db, "members"), (snap) => {
          people = {};
          snap.docs.forEach((d) => { people[d.id] = d.data({ serverTimestamps: "estimate" }); });
          if (loaded) render();
        }, () => { people = {}; });
        return () => {
          stop(); stopPub(); stopRoles(); stopPeople();
          ctx = null; all = []; pub = null; loaded = false; editing = null;
          verified = new Set(); rolesState = "loading"; people = {};
        };
      }
    };
  })();