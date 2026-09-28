/* ============================================================================
   Stock the Block — shared code for the member portal (members.html)
   ----------------------------------------------------------------------------
   Exposes window.STBP. Loaded after site.js (it uses STB.$ and STB.SITES).

   Read this first: hiding a page section here is only a convenience. Anyone
   can open devtools and un-hide it. What actually stops a stranger reading or
   changing deliveries is the Firestore Security Rules. This file just makes
   the UI match what the rules will allow.
   ============================================================================ */
   (function () {
    "use strict";
    const $ = STB.$;
  
    /* A hint for the public pages: while this note exists, their "Sign in"
       button says "My portal" instead (see site.js). It's only a hint; the real
       check always happens here, when the portal loads. */
    function rememberMember(on) {
      try {
        if (on) localStorage.setItem("stb-member", "1");
        else localStorage.removeItem("stb-member");
      } catch (e) { /* storage blocked (e.g. some private modes): the button just stays "Sign in" */ }
    }
  
    /* ---------- small helpers ---------- */
  
    // Resolves with window.STB_FIREBASE once firebase-init.js has run.
    function ready() {
      return new Promise((resolve, reject) => {
        if (window.STB_FIREBASE) return resolve(window.STB_FIREBASE);
        const t = setTimeout(() => reject(new Error("Firebase did not load. Check your connection and reload.")), 8000);
        addEventListener("stb-firebase-ready", () => { clearTimeout(t); resolve(window.STB_FIREBASE); }, { once: true });
      });
    }
  
    // Build an element: el("p", { className: "x" }, "text", childEl, ...).
    // Text is always set with textContent, never innerHTML, so anything a
    // member types is shown as text and can never run as code on the admin page.
    function el(tag, props, ...kids) {
      const n = document.createElement(tag);
      Object.assign(n, props || {});
      kids.flat().forEach((k) => {
        if (k === null || k === undefined || k === false) return;
        n.appendChild(typeof k === "string" || typeof k === "number" ? document.createTextNode(String(k)) : k);
      });
      return n;
    }
  
    function today() {
      const d = new Date();
      const pad = (x) => String(x).padStart(2, "0");
      return d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate());
    }
  
    function fmtTime(ts) {
      if (!ts || !ts.toDate) return "just now";
      return ts.toDate().toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
    }
  
    function fmtDate(iso) {
      if (!iso) return "";
      const [y, m, d] = iso.split("-").map(Number);
      return new Date(y, m - 1, d).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
    }
  
    const STATUS_LABEL = { pending: "Waiting for review", accepted: "Accepted", rejected: "Rejected" };
    function statusPill(status) {
      return el("span", { className: "d-status s-" + status }, STATUS_LABEL[status] || status);
    }
  
    // Shows a message under a form. kind: "ok" | "err" | "" (neutral).
    function say(node, text, kind) {
      node.textContent = text || "";
      node.className = "p-msg" + (kind ? " is-" + kind : "");
    }
  
    /* ---------- sign-in gate ----------
       gate({ need: "member" | "admin", onReady(ctx) })
       Renders the sign-in button into #gate, watches the auth state, looks up
       the user's role document (roles/{uid}), and shows #app only when the role
       is enough. onReady may return a cleanup function (e.g. a Firestore
       listener's unsubscribe); it runs on sign-out so nothing keeps listening. */
    function gate(opts) {
      const host = $("#gate"), app = $("#app");
      let cleanup = null;
  
      function show(view) {
        host.hidden = view === "app";
        app.hidden = view !== "app";
      }
  
      function renderLoading(text) {
        host.replaceChildren(el("div", { className: "p-card" }, el("p", { className: "p-muted" }, text)));
        show("gate");
      }
  
      function renderSignIn() {
        const msg = el("p", { className: "p-msg", role: "status" });
        const btn = el("button", { type: "button", className: "btn-sm solid" }, "Sign in with Google");
  
        btn.addEventListener("click", async () => {
          btn.disabled = true;
          say(msg, "Opening Google sign-in…");
          try {
            const fb = await ready();
            await fb.signInWithPopup(fb.auth, new fb.GoogleAuthProvider());
            // onAuthStateChanged takes it from here.
          } catch (err) {
            btn.disabled = false;
            if (err.code === "auth/popup-closed-by-user" || err.code === "auth/cancelled-popup-request") {
              say(msg, "");
            } else if (err.code === "auth/popup-blocked") {
              say(msg, "Your browser blocked the sign-in window. Allow popups for this site, then try again.", "err");
            } else if (err.code === "auth/unauthorized-domain") {
              say(msg, "This website isn't on Firebase's list of allowed domains yet. An admin needs to add it.", "err");
            } else {
              console.error(err);
              say(msg, "Sign-in didn't work (" + err.code + "). If you used a school account, try a personal Gmail.", "err");
            }
          }
        });
  
        host.replaceChildren(el("div", { className: "p-card p-narrow" },
          el("h2", { className: "p-h2" }, "Sign in"),
          el("p", { className: "p-muted" }, "Sign in with your Google account. The first time, you'll need an admin to approve you before you can log deliveries."),
          el("div", { className: "p-actions" }, btn),
          msg));
        show("gate");
      }
  
      function renderDenied(fb, user, text) {
        const out = el("button", { type: "button", className: "btn-sm" }, "Sign out");
        out.addEventListener("click", () => fb.signOut(fb.auth));
        host.replaceChildren(el("div", { className: "p-card p-narrow" },
          el("h2", { className: "p-h2" }, "No access yet"),
          el("p", {}, "Signed in as ", el("b", {}, user.email), ". ", text),
          el("div", { className: "p-actions" }, out)));
        show("gate");
      }
  
      renderLoading("Loading…");
      ready().then((fb) => {
        // Every sign-out button on the page, wherever it is.
        document.addEventListener("click", (e) => {
          if (e.target.closest("[data-signout]")) fb.signOut(fb.auth);
        });
  
        fb.onAuthStateChanged(fb.auth, async (user) => {
          if (cleanup) { cleanup(); cleanup = null; }
          if (!user) { rememberMember(false); renderSignIn(); return; }
  
          renderLoading("Checking your access…");
          let role = null;
          try {
            const snap = await fb.getDoc(fb.doc(fb.db, "roles", user.uid));
            role = snap.exists() ? snap.data().role : null;
          } catch (err) { role = null; }
  
          const ok = opts.need === "admin" ? role === "admin" : role === "member" || role === "admin";
          if (!ok) {
            rememberMember(false);
            renderDenied(fb, user, opts.need === "admin"
              ? "This page is for admins only."
              : "Your account exists but hasn't been added as a member. Send an admin this ID: " + user.uid);
            return;
          }
          document.querySelectorAll("[data-who]").forEach((n) => { n.textContent = user.email; });
          document.querySelectorAll("[data-admin-only]").forEach((n) => { n.hidden = role !== "admin"; });
          rememberMember(true);
          show("app");
          cleanup = opts.onReady({ fb, user, role }) || null;
        });
      }).catch((err) => renderLoading(err.message));
    }
  
    /* ---------- the delivery fields ----------
       buildFields(host, values) draws the same inputs in two places (the
       member's new-delivery form and the admin's edit form) and returns
       { read() }. read() returns a clean object or throws an Error whose message
       is shown to the user. The limits match the Firestore rules; if you change
       one, change the other. */
    function buildFields(host, v) {
      v = v || {};
      const schools = el("datalist", { id: "schoolList" + Math.random().toString(36).slice(2, 7) },
        (STB.SITES || []).map((s) => el("option", { value: s.name })));
  
      const date = el("input", { type: "date", required: true, value: v.date || today() });
      const box = el("input", { type: "text", maxLength: 40, value: v.boxId || "", placeholder: "e.g. 0447" });
      const from = el("input", { type: "text", maxLength: 120, required: true, value: v.fromSchool || "" });
      from.setAttribute("list", schools.id);
      const to = el("input", { type: "text", maxLength: 120, required: true, value: v.toSite || "", placeholder: "Pantry, drive or fridge" });
      const weight = el("input", { type: "number", min: "0.1", max: "500", step: "0.1", required: true, value: v.weightLbs || "" });
      const notes = el("textarea", { rows: 3, maxLength: 2000, value: v.notes || "", placeholder: "Anything the reviewer should know" });
  
      const itemsList = el("div", { className: "p-items" });
      const addBtn = el("button", { type: "button", className: "p-link" }, "Add another food");
      function addRow(it) {
        const name = el("input", { type: "text", maxLength: 80, value: (it && it.name) || "", placeholder: "Food, e.g. milk cartons" });
        const qty = el("input", { type: "text", maxLength: 40, value: (it && it.qty) || "", placeholder: "Amount, e.g. 24" });
        name.setAttribute("aria-label", "Food");
        qty.setAttribute("aria-label", "Amount");
        const rm = el("button", { type: "button", className: "p-rm", title: "Remove this food" }, "Remove");
        const row = el("div", { className: "p-item" }, name, qty, rm);
        rm.addEventListener("click", () => { if (itemsList.children.length > 1) row.remove(); else { name.value = ""; qty.value = ""; } });
        itemsList.appendChild(row);
        return name;
      }
      (v.items && v.items.length ? v.items : [{}]).forEach(addRow);
      addBtn.addEventListener("click", () => addRow({}).focus());
  
      host.replaceChildren(schools, el("div", { className: "p-grid" },
        el("label", {}, "Delivery date", date),
        el("label", {}, "Box ID ", el("span", { className: "p-opt" }, "optional"), box),
        el("label", {}, "Picked up from", from),
        el("label", {}, "Delivered to", to),
        el("label", {}, "Total weight (lbs)", weight)),
        el("fieldset", { className: "p-fieldset" }, el("legend", {}, "What was in the box"), itemsList, addBtn),
        el("label", { className: "p-full" }, "Notes ", el("span", { className: "p-opt" }, "optional"), notes));
  
      function read() {
        const items = Array.from(itemsList.children).map((row) => {
          const [n, q] = row.querySelectorAll("input");
          return { name: n.value.trim(), qty: q.value.trim() };
        }).filter((it) => it.name);
        const w = parseFloat(weight.value);
        if (!/^\d{4}-\d{2}-\d{2}$/.test(date.value)) throw new Error("Pick the delivery date.");
        if (!from.value.trim()) { from.focus(); throw new Error("Add the school the food came from."); }
        if (!to.value.trim()) { to.focus(); throw new Error("Add where the food was delivered."); }
        if (!(w > 0 && w <= 500)) { weight.focus(); throw new Error("Weight has to be between 0.1 and 500 lbs."); }
        if (!items.length) throw new Error("List at least one food.");
        if (items.length > 50) throw new Error("That's more than 50 foods. Combine some lines.");
        return {
          date: date.value, boxId: box.value.trim(), fromSchool: from.value.trim(), toSite: to.value.trim(),
          weightLbs: Math.round(w * 10) / 10, items, notes: notes.value.trim()
        };
      }
      return { read };
    }
  
    /* ---------- read-only view of one delivery ---------- */
    function deliveryDetails(d) {
      return el("div", { className: "d-body" },
        el("p", { className: "d-route" }, d.fromSchool, el("span", { className: "d-arrow", ariaHidden: "true" }, " to "), d.toSite),
        el("dl", { className: "d-facts" },
          el("div", {}, el("dt", {}, "Date"), el("dd", {}, fmtDate(d.date))),
          el("div", {}, el("dt", {}, "Weight"), el("dd", {}, d.weightLbs + " lbs")),
          d.boxId ? el("div", {}, el("dt", {}, "Box"), el("dd", {}, d.boxId)) : null),
        el("ul", { className: "d-items" }, (d.items || []).map((it) =>
          el("li", {}, el("span", {}, it.name), it.qty ? el("span", { className: "d-qty" }, it.qty) : null))),
        d.notes ? el("p", { className: "d-notes" }, d.notes) : null);
    }
  
    /* ---------- photo: shrink before upload ----------
       Photos go into Firestore as text (a "data URL"), not into Cloud Storage,
       because Storage now needs a billing account. A Firestore document caps at
       1 MB, so the photo is resized and re-compressed in the browser until it
       fits under ~850 KB. Phone photos start at 3-8 MB; this gets them to
       roughly 150-300 KB, which is plenty to see what was in a box. */
    const MAX_CHARS = 850000;
    async function compressImage(file) {
      if (!file.type.startsWith("image/")) throw new Error("That file isn't an image.");
      const url = URL.createObjectURL(file);
      try {
        const img = await new Promise((res, rej) => {
          const i = new Image();
          i.onload = () => res(i);
          i.onerror = () => rej(new Error("Couldn't read that image. Try a JPG or PNG."));
          i.src = url;
        });
        let side = 1400, quality = 0.75;
        for (let tries = 0; tries < 6; tries++) {
          const k = Math.min(1, side / Math.max(img.naturalWidth, img.naturalHeight));
          const c = document.createElement("canvas");
          c.width = Math.round(img.naturalWidth * k);
          c.height = Math.round(img.naturalHeight * k);
          c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
          const data = c.toDataURL("image/jpeg", quality);
          if (data.length <= MAX_CHARS) return data;
          side = Math.round(side * 0.8); quality = Math.max(0.45, quality - 0.08);
        }
        throw new Error("That photo is too detailed to shrink enough. Try another one.");
      } finally {
        URL.revokeObjectURL(url);
      }
    }
  
    window.STBP = { ready, el, today, fmtTime, fmtDate, statusPill, say, gate, buildFields, deliveryDetails, compressImage };
  
    STB.initTheme();
    STB.initMascotSlots();
  })();