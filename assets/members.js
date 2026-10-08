/* ============================================================================
   Stock the Block — members.html (the member portal)
   Signs people in, runs the tabs, and handles "Log a delivery" and
   "My deliveries". Admins also get the Review tab (assets/admin.js).
   ============================================================================ */
   (function () {
    "use strict";
    const $ = STB.$, P = STBP, el = P.el;
  
    const form = $("#deliveryForm");
    const msg = $("#deliveryMsg");
    const submitBtn = $("#deliverySubmit");
    const photoInput = $("#photo");
    const preview = $("#photoPreview");
    const drop = $("#photoDrop");
    let fields = null;     // { read() } from buildFields
    let photoData = null;  // compressed data URL, or null
    let ctx = null;        // { fb, user, role } once signed in
  
    /* Each fresh form gets a new box ID straight away, so the member can
       write it on the box label before they save. */
    function resetForm() {
      fields = P.buildFields($("#deliveryFields"), { boxId: P.newBoxId() });
      clearPhoto();
    }
  
    function clearPhoto() {
      photoData = null;
      photoInput.value = "";
      preview.replaceChildren();
      preview.hidden = true;
      drop.hidden = false;
    }
  
    async function takePhoto(file) {
      photoData = null;
      preview.hidden = true;
      if (!file) return;
      say("Shrinking photo…");
      try {
        photoData = await P.compressImage(file);
        const kb = Math.round(photoData.length * 0.75 / 1024);   // base64 is ~4/3 the real size
        const rm = el("button", { type: "button", className: "btn-sm quiet" }, P.icon("x"), "Remove");
        rm.addEventListener("click", () => { clearPhoto(); photoInput.focus(); });
        preview.replaceChildren(
          el("img", { src: photoData, alt: "Photo you're about to attach" }),
          el("div", { className: "p-preview-text" }, el("b", {}, "Photo ready"), el("span", {}, "About " + kb + " KB once it uploads.")),
          rm);
        preview.hidden = false;
        drop.hidden = true;
        say("");
      } catch (err) {
        clearPhoto();
        say(err.message, "err");
      }
    }
  
    photoInput.addEventListener("change", () => takePhoto(photoInput.files[0]));
    // Dropping a file on the photo area works too, on a computer.
    ["dragenter", "dragover"].forEach((t) => drop.addEventListener(t, (e) => { e.preventDefault(); drop.classList.add("is-over"); }));
    ["dragleave", "drop"].forEach((t) => drop.addEventListener(t, () => drop.classList.remove("is-over")));
    drop.addEventListener("drop", (e) => {
      e.preventDefault();
      const file = e.dataTransfer && e.dataTransfer.files[0];
      if (file) takePhoto(file);
    });
  
    function say(text, kind) { P.say(msg, text, kind); }
  
    /* After a save the form is fresh again (with a new box ID), so the note
       saying it worked sits above the form, where the member will look. */
    const saved = $("#savedNote");
    function showSaved(boxId) {
      const view = el("button", { type: "button", className: "btn-sm" }, "See it");
      view.addEventListener("click", () => showTab("mine"));
      saved.replaceChildren(P.icon("check", "saved-ico"),
        el("div", { className: "saved-text" }, el("b", {}, "Saved box " + boxId),
          el("span", {}, "It's waiting for review. The form below has a new box ID for your next delivery.")),
        view);
      saved.hidden = false;
      saved.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  
    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      if (!ctx) return;
      let data;
      try { data = fields.read(); } catch (err) { say(err.message, "err"); return; }
  
      const { fb, user } = ctx;
      saved.hidden = true;
      submitBtn.disabled = true;
      say("Saving…");
      try {
        /* doc(collection(...)) with no id makes a new document reference with a
           random id, without writing anything yet. We need that id first so the
           photo document can share it. */
        const ref = fb.doc(fb.collection(fb.db, "deliveries"));
        /* A batch writes both documents together: either both land or neither
           does, so there's never a delivery pointing at a photo that failed. */
        const batch = fb.writeBatch(fb.db);
        batch.set(ref, {
          ...data,                       // spread: copies every field of data in
          memberUid: user.uid,
          memberEmail: user.email,
          temps: [],                     // filled by the sensor modules later
          hasPhoto: !!photoData,
          status: "pending",
          reviewNote: "",
          createdAt: fb.serverTimestamp(),
          updatedAt: fb.serverTimestamp()
        });
        if (photoData) {
          batch.set(fb.doc(fb.db, "deliveryPhotos", ref.id), { memberUid: user.uid, dataUrl: photoData });
        }
        await batch.commit();
        /* The public log (log.html) gets a trimmed copy: no names, schools,
           sites, notes or photo. See firestore.rules, publicLog. It's written
           on its own, after the delivery, so a problem here never loses the
           delivery; an admin's portal fills in any entry that's missing. */
        const pubRef = fb.doc(fb.db, "publicLog", ref.id);
        const pubEntry = P.publicEntry({ ...data, status: "pending" });
        fb.setDoc(pubRef, pubEntry)
          // Until the live Firestore rules accept a region, write it without.
          .catch((err) => {
            if (err.code === "permission-denied" && pubEntry.region) return fb.setDoc(pubRef, P.publicEntry({ ...data, status: "pending" }, false));
            throw err;
          })
          .catch((err) => console.warn("Public log entry not written yet:", err.code || err));
        resetForm();
        say("");
        showSaved(data.boxId);
      } catch (err) {
        console.error(err);
        say(err.code === "permission-denied"
          ? "The database refused this. Your account may not be a member yet, or a field is over its limit."
          : "Couldn't save. Check your connection and try again. Nothing was sent.", "err");
      } finally {
        submitBtn.disabled = false;
      }
    });
  
    /* The four numbers at the top: this member's own deliveries. */
    function renderStats(rows) {
      const live = rows.filter((d) => d.status !== "rejected");
      const lbs = live.reduce((sum, d) => sum + (Number(d.weightLbs) || 0), 0);
      $("#stDeliveries").textContent = rows.length.toLocaleString("en-US");
      $("#stLbs").textContent = (Math.round(lbs * 10) / 10).toLocaleString("en-US");
      $("#stAccepted").textContent = rows.filter((d) => d.status === "accepted").length.toLocaleString("en-US");
      $("#stPending").textContent = rows.filter((d) => d.status === "pending").length.toLocaleString("en-US");
    }
  
    function renderMine(snap) {
      const host = $("#mine");
      /* Sorted here instead of with orderBy() in the query: combining where()
         and orderBy() on different fields needs a composite index in Firebase,
         and for one member's list, sorting in the browser is free. */
      const rows = snap.docs
        .map((d) => ({ id: d.id, ...d.data({ serverTimestamps: "estimate" }) }))
        .sort((a, b) => (b.createdAt ? b.createdAt.toMillis() : 0) - (a.createdAt ? a.createdAt.toMillis() : 0));
  
      renderStats(rows);
      $("#mineCount").textContent = rows.length ? String(rows.length) : "";
      if (!rows.length) {
        const go = el("button", { type: "button", className: "btn-sm solid" }, "Log a delivery");
        go.addEventListener("click", () => showTab("log"));
        host.replaceChildren(el("div", { className: "p-emptystate" },
          P.mascot("p-empty-mascot"),
          el("h3", {}, "No deliveries yet"),
          el("p", { className: "p-muted" }, "Deliveries you log show up here with their box ID and review status."),
          go));
        STB.initMascotSlots(host);
        return;
      }
      host.replaceChildren(...rows.map((d) =>
        el("article", { className: "d-card" },
          el("header", { className: "d-head" }, P.statusPill(d.status),
            el("span", { className: "p-muted" }, "Logged " + P.fmtTime(d.createdAt))),
          P.deliveryDetails(d),
          d.reviewNote ? el("p", { className: "d-review" }, el("b", {}, "Reviewer: "), d.reviewNote) : null)));
    }
  
    /* ---------- tabs ----------
       The tab lives in the URL (#log, #mine, #review), so the back button works
       and a link like members.html#review opens straight to that tab. */
    let isAdmin = false;
    function showTab(id) {
      if (!["log", "mine", "review"].includes(id) || (id === "review" && !isAdmin)) id = "log";
      document.querySelectorAll("[role=tab]").forEach((t) => t.setAttribute("aria-selected", String(t.dataset.tab === id)));
      document.querySelectorAll("[role=tabpanel]").forEach((p) => { p.hidden = p.id !== "tab-" + id; });
      if (location.hash !== "#" + id) history.replaceState(null, "", "#" + id);
    }
    document.querySelectorAll("[role=tab]").forEach((t) => t.addEventListener("click", () => showTab(t.dataset.tab)));
    addEventListener("hashchange", () => showTab(location.hash.slice(1)));
  
    P.gate({
      need: "member",
      onReady: (c) => {
        ctx = c;
        isAdmin = c.role === "admin";
        const first = (c.user.displayName || "").split(" ")[0];
        $("#hello").textContent = first ? "Hi, " + first : "Hi";
        resetForm();
  
        const q = c.fb.query(c.fb.collection(c.fb.db, "deliveries"), c.fb.where("memberUid", "==", c.user.uid));
        const stopMine = c.fb.onSnapshot(q, renderMine, (err) => {
          console.error(err);
          $("#mine").replaceChildren(el("p", { className: "p-msg is-err" }, "Couldn't load your deliveries: " + err.code));
        });
        const stopReview = isAdmin
          ? STBA.start(c, { onPending: (n) => { $("#pendingCount").textContent = n ? String(n) : ""; } })
          : null;
  
        showTab(location.hash.slice(1));
        return () => { stopMine(); if (stopReview) stopReview(); ctx = null; isAdmin = false; };
      }
    });
  })();