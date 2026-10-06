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
  
    /* ---------- partners ----------
       The only places a delivery can come from or go to. The form offers
       these and nothing else, so every delivery names a partner the same way
       and the totals add up per school and per fridge.
  
       Schools come from STB.SITES in site.js, the same list the map uses:
       only the ones marked "active" (delivering). Mark a school active there
       and it shows up here too.
       Drop-off sites live here. Add one by adding a line; the name is what
       gets saved with each delivery, so don't rename one that's been used. */
    const DROPOFFS = [
      // One Love Community Fridge: onelovecommunityfridge.org/fridges
      { name: "Community Fridge – Bed-Stuy (Lewis Ave)", address: "173 Lewis Ave, Brooklyn, NY 11221", borough: "Brooklyn", org: "One Love Community Fridge", host: "Cafe Botani" },
      { name: "Community Fridge – Bed-Stuy (Tompkins Ave)", address: "343 Tompkins Ave, Brooklyn, NY 11216", borough: "Brooklyn", org: "One Love Community Fridge", host: "Sincerely Tommy" },
      { name: "Community Fridge – Bed-Stuy (Gates Ave)", address: "477 Gates Ave, Brooklyn, NY 11216", borough: "Brooklyn", org: "One Love Community Fridge", host: "Little Grenjai" },
      { name: "Community Fridge – Bushwick", address: "219 McKibbin St, Brooklyn, NY 11206", borough: "Brooklyn", org: "One Love Community Fridge", host: "Sure We Can" },
      { name: "Community Fridge – East Williamsburg", address: "65 Scholes St, Brooklyn, NY 11206", borough: "Brooklyn", org: "One Love Community Fridge", host: "HAVEN Boxing" },
      { name: "Community Fridge – Flatbush", address: "1596 Church Ave, Brooklyn, NY 11226", borough: "Brooklyn", org: "One Love Community Fridge", host: "B’ShERT" },
      { name: "Community Fridge – Gowanus", address: "303 Bond St, Brooklyn, NY 11231", borough: "Brooklyn", org: "One Love Community Fridge", host: "Van Alen Institute" },
      { name: "Community Fridge – Upper West Side", address: "801 Amsterdam Ave, New York, NY 10025", borough: "Manhattan", org: "One Love Community Fridge", host: "Ryan Health" },
      // Essex Market
      { name: "Community Fridge – Lower East Side (Essex Market)", address: "220 Broome St, New York, NY 10002", borough: "Manhattan", org: "Essex Market Community Fridge" }
    ];
    const BOROUGH_ORDER = ["Manhattan", "Brooklyn", "Queens", "Bronx", "Staten Island"];
    const byBorough = (a, b) => (BOROUGH_ORDER.indexOf(a.borough) - BOROUGH_ORDER.indexOf(b.borough)) || a.name.localeCompare(b.name);
  
    function schools() {
      return (STB.SITES || []).filter((s) => s.status === "active").sort(byBorough).map((s) => ({ name: s.name, group: s.borough, meta: s.borough }));
    }
    function dropoffs() {
      return DROPOFFS.slice().sort(byBorough).map((s) => ({
        name: s.name, group: s.borough, meta: s.address,
        search: s.address + " " + s.org + " " + (s.host || ""),
        detail: s.address + " · " + s.org + (s.host ? ", hosted by " + s.host : "")
      }));
    }
    function findDropoff(name) { return DROPOFFS.find((s) => s.name === name) || null; }
  
    /* ---------- box IDs ----------
       Every delivery gets one, made here instead of typed, so they all look
       the same: STB- and six characters, like STB-7K3Q9M. The characters skip
       I, L, O and U, which are easy to misread on a handwritten label. Six of
       them allow about a billion IDs, so two boxes sharing one is very
       unlikely. */
    const ID_CHARS = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";
    function newBoxId() {
      const bytes = new Uint8Array(6);
      crypto.getRandomValues(bytes);
      return "STB-" + Array.from(bytes, (b) => ID_CHARS[b & 31]).join("");
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
  
    /* Icons are fixed strings from this file, never anything a member typed,
       so innerHTML is safe here. */
    const ICON = {
      google: '<svg viewBox="0 0 48 48" width="20" height="20"><path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/><path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/><path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/><path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/></svg>',
      clock: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>',
      tag: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20.6 13.4 13.4 20.6a2 2 0 0 1-2.8 0L3 13V3h10l7.6 7.6a2 2 0 0 1 0 2.8Z"/><circle cx="8" cy="8" r="1.5"/></svg>',
      shield: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3 4 6v6c0 4.5 3.4 8.3 8 9 4.6-.7 8-4.5 8-9V6l-8-3Z"/><path d="m9 12 2 2 4-4"/></svg>',
      lock: '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/></svg>',
      copy: '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="12" height="12" rx="2"/><path d="M5 15V5a2 2 0 0 1 2-2h10"/></svg>',
      check: '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="m5 12 5 5L20 7"/></svg>',
      chevron: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m6 9 6 6 6-6"/></svg>',
      pin: '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 21s-7-6.2-7-11.5a7 7 0 0 1 14 0C19 14.8 12 21 12 21Z"/><circle cx="12" cy="9.5" r="2.5"/></svg>',
      school: '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m2 9 10-5 10 5-10 5L2 9Z"/><path d="M6 11v5c3 2.5 9 2.5 12 0v-5"/></svg>',
      camera: '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 8.5A2.5 2.5 0 0 1 5.5 6H7l1.5-2h7L17 6h1.5A2.5 2.5 0 0 1 21 8.5v9a2.5 2.5 0 0 1-2.5 2.5h-13A2.5 2.5 0 0 1 3 17.5v-9Z"/><circle cx="12" cy="13" r="3.5"/></svg>',
      plus: '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>',
      x: '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M6 6l12 12M18 6 6 18"/></svg>'
    };
    function icon(name, cls) {
      const s = document.createElement("span");
      s.className = "ico" + (cls ? " " + cls : "");
      s.setAttribute("aria-hidden", "true");
      s.innerHTML = ICON[name];
      return s;
    }
  
    // "Sajid Rahman" -> "SR"; no name -> first letter of the email.
    function initials(user) {
      const name = (user.displayName || "").trim();
      if (name) return name.split(/\s+/).slice(0, 2).map((w) => w[0]).join("").toUpperCase();
      return ((user.email || "?")[0] || "?").toUpperCase();
    }
  
    /* A button that copies text, then says "Copied" for a moment. */
    function copyButton(text, label) {
      const word = el("span", {}, label || "Copy");
      const btn = el("button", { type: "button", className: "btn-sm p-copy" }, icon("copy"), word);
      btn.addEventListener("click", async () => {
        try {
          await navigator.clipboard.writeText(text);
        } catch (e) {
          // Older browsers, or clipboard blocked: copy through a hidden field.
          const t = el("textarea", { value: text, readOnly: true, className: "vh" });
          document.body.appendChild(t); t.select();
          try { document.execCommand("copy"); } catch (e2) { /* nothing else to try */ }
          t.remove();
        }
        btn.replaceChildren(icon("check"), el("span", {}, "Copied"));
        btn.classList.add("is-done");
        setTimeout(() => { btn.replaceChildren(icon("copy"), word); btn.classList.remove("is-done"); }, 1600);
      });
      return btn;
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
  
    // A mascot box, drawn by site.js once it's on the page (STB.initMascotSlots).
    function mascot(cls, state) {
      const m = el("span", { className: "mascot-slot " + cls });
      m.dataset.state = state || "idle";
      m.setAttribute("data-blink", "");
      return m;
    }
  
    /* ---------- sign-in gate ----------
       gate({ need: "member" | "admin", onReady(ctx) })
       Renders the sign-in screen into #gate, watches the auth state, looks up
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
  
      function put(node) {
        host.replaceChildren(node);
        STB.initMascotSlots(host);
        show("gate");
      }
  
      function renderLoading(text) {
        put(el("div", { className: "auth auth-solo" },
          el("div", { className: "auth-card auth-status", role: "status" },
            el("span", { className: "p-spin" }), el("p", {}, text))));
      }
  
      function renderProblem(text) {
        const again = el("button", { type: "button", className: "btn-sm solid" }, "Reload");
        again.addEventListener("click", () => location.reload());
        put(el("div", { className: "auth auth-solo" },
          el("div", { className: "auth-card auth-main" },
            el("h1", { className: "auth-h" }, "The portal didn't load"),
            el("p", { className: "auth-p" }, text),
            el("div", { className: "p-actions" }, again))));
      }
  
      function renderSignIn() {
        const msg = el("p", { className: "p-msg", role: "status" });
        const word = el("span", {}, "Continue with Google");
        const btn = el("button", { type: "button", className: "g-btn" }, icon("google", "g-logo"), word);
  
        btn.addEventListener("click", async () => {
          btn.disabled = true;
          word.textContent = "Opening Google…";
          say(msg, "");
          try {
            const fb = await ready();
            await fb.signInWithPopup(fb.auth, new fb.GoogleAuthProvider());
            // onAuthStateChanged takes it from here.
          } catch (err) {
            btn.disabled = false;
            word.textContent = "Continue with Google";
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
  
        const point = (ic, title, text) => el("li", {}, icon(ic, "auth-ico"), el("div", {}, el("b", {}, title), el("span", {}, text)));
        put(el("div", { className: "auth" },
          el("div", { className: "auth-card" },
            el("div", { className: "auth-side" },
              mascot("auth-mascot"),
              el("p", { className: "auth-kicker" }, "Stock the Block"),
              el("h1", { className: "auth-title" }, "Member portal"),
              el("p", { className: "auth-lede" }, "Where our volunteers log deliveries and follow every box from school to fridge."),
              el("ul", { className: "auth-points" },
                point("clock", "Log a delivery in a minute", "Pick the school and the fridge from the list, then add what was in the box."),
                point("tag", "Every box gets a tracking ID", "The portal assigns it, so every delivery can be traced."),
                point("shield", "Checked before it counts", "An admin reviews each delivery before it's added to the public numbers."))),
            el("div", { className: "auth-main" },
              el("h2", { className: "auth-h" }, "Sign in"),
              el("p", { className: "auth-p" }, "Use your Google account to open the portal."),
              btn, msg,
              el("div", { className: "auth-rule" }),
              el("p", { className: "auth-fine" }, el("b", {}, "First time here? "),
                "After you sign in, an admin approves your account. Then you can start logging deliveries."),
              el("p", { className: "auth-fine" }, icon("lock", "auth-lock"),
                "We get your name and email from Google, never your password. Members must be 13 or older. ",
                el("a", { href: "privacy.html#collect-members" }, "Privacy Policy")))),
          el("p", { className: "auth-back" }, el("a", { href: "index.html" }, "← Back to the public site"))));
      }
  
      /* Signed in, but no role yet (or not enough of one). Shows where they
         are in the approval, the ID an admin needs, and a way to check again
         without reloading. */
      function renderDenied(fb, user, needAdmin) {
        const out = el("button", { type: "button", className: "btn-sm" }, "Sign out");
        out.addEventListener("click", () => fb.signOut(fb.auth));
        const recheck = el("button", { type: "button", className: "btn-sm solid" }, "Check again");
        const msg = el("p", { className: "p-msg", role: "status" });
        recheck.addEventListener("click", async () => {
          recheck.disabled = true;
          say(msg, "Checking…");
          const ok = await check(fb, user, true);
          if (!ok) { recheck.disabled = false; say(msg, "Not approved yet. Try again once an admin says you're in.", ""); }
        });
  
        const who = el("div", { className: "acct" },
          el("span", { className: "avatar" }, initials(user)),
          el("div", {}, el("b", {}, user.displayName || "Signed in"), el("span", {}, user.email)));
  
        const body = needAdmin
          ? [el("h1", { className: "auth-h" }, "Admins only"),
             el("p", { className: "auth-p" }, "This page is for Stock the Block admins. Your account doesn't have admin access.")]
          : [el("h1", { className: "auth-h" }, "You're almost in"),
             el("p", { className: "auth-p" }, "An admin needs to approve your account before you can log deliveries."),
             el("ol", { className: "steps" },
               el("li", { className: "is-done" }, el("span", { className: "step-dot" }, icon("check")), "Signed in with Google"),
               el("li", { className: "is-now" }, el("span", { className: "step-dot" }), "An admin approves your account"),
               el("li", {}, el("span", { className: "step-dot" }), "You start logging deliveries")),
             el("div", { className: "uid" },
               el("div", { className: "uid-text" }, el("span", { className: "uid-l" }, "Your member ID"), el("code", {}, user.uid)),
               copyButton(user.uid)),
             el("p", { className: "auth-fine" }, "Send this ID to a Stock the Block admin. Once they've added you, press Check again.")];
  
        put(el("div", { className: "auth auth-solo" },
          el("div", { className: "auth-card auth-main" }, who, ...body,
            el("div", { className: "p-actions" }, needAdmin ? null : recheck, out), msg)));
      }
  
      // Looks up the role and opens the portal if it's enough. Returns true
      // if it opened.
      async function check(fb, user, quiet) {
        if (!quiet) renderLoading("Checking your access…");
        let role = null;
        try {
          const snap = await fb.getDoc(fb.doc(fb.db, "roles", user.uid));
          role = snap.exists() ? snap.data().role : null;
        } catch (err) { role = null; }
  
        const ok = opts.need === "admin" ? role === "admin" : role === "member" || role === "admin";
        if (!ok) {
          rememberMember(false);
          if (!quiet) renderDenied(fb, user, opts.need === "admin");
          return false;
        }
        document.querySelectorAll("[data-who]").forEach((n) => { n.textContent = user.email; });
        document.querySelectorAll("[data-avatar]").forEach((n) => { n.textContent = initials(user); });
        document.querySelectorAll("[data-role]").forEach((n) => { n.textContent = role === "admin" ? "Admin" : "Member"; });
        document.querySelectorAll("[data-admin-only]").forEach((n) => { n.hidden = role !== "admin"; });
        rememberMember(true);
        show("app");
        cleanup = opts.onReady({ fb, user, role }) || null;
        return true;
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
          await check(fb, user, false);
        });
      }).catch((err) => renderProblem(err.message));
    }
  
    /* ---------- pick-from-list field ----------
       combo({ options, value, placeholder, empty }) makes a text box you can
       type into to search, but that only ever holds one of the options. Leave
       it with anything else typed in and it goes back to the last pick.
       Options: { name, group, meta, search?, detail? }. Returns
       { node, input, value(), focus() }. Follows the ARIA combobox pattern, so
       arrow keys, Enter and Escape work, and screen readers hear the list. */
    let comboCount = 0;
    function combo(o) {
      const id = "cb" + (++comboCount);
      const input = el("input", { type: "text", id, placeholder: o.placeholder || "", autocomplete: "off", spellcheck: false });
      input.setAttribute("role", "combobox");
      input.setAttribute("aria-autocomplete", "list");
      input.setAttribute("aria-expanded", "false");
      input.setAttribute("aria-controls", id + "-list");
      const list = el("div", { id: id + "-list", className: "cb-list", hidden: true });
      list.setAttribute("role", "listbox");
      const toggle = el("button", { type: "button", className: "cb-toggle", tabIndex: -1 }, icon("chevron"));
      toggle.setAttribute("aria-label", "Show the list");
      const detail = el("p", { className: "cb-detail" });
      const wrap = el("div", { className: "cb" }, input, toggle, list);
  
      let picked = o.options.find((x) => x.name === o.value) || null;
      let shown = [], active = -1;
  
      const norm = (s) => String(s).toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, " ").trim();
  
      function showDetail() {
        const text = picked ? (picked.detail || "") : "";
        detail.replaceChildren(...(text ? [icon(o.detailIcon || "pin"), el("span", {}, text)] : []));
        detail.hidden = !text;
      }
  
      function setActive(i) {
        const opts = list.querySelectorAll("[role=option]");
        opts.forEach((n, k) => n.classList.toggle("is-active", k === i));
        active = i;
        if (i >= 0 && opts[i]) {
          input.setAttribute("aria-activedescendant", opts[i].id);
          opts[i].scrollIntoView({ block: "nearest" });
        } else {
          input.removeAttribute("aria-activedescendant");
        }
      }
  
      function draw(q) {
        const words = norm(q || "").split(" ").filter(Boolean);
        shown = o.options.filter((x) => { const hay = norm(x.name + " " + (x.search || x.meta || "")); return words.every((w) => hay.includes(w)); });
        list.replaceChildren();
        if (!shown.length) {
          list.appendChild(el("div", { className: "cb-empty" }, o.empty || "Nothing matches."));
          setActive(-1);
          return;
        }
        let group = null, box = list;
        shown.forEach((x, i) => {
          if (x.group !== group) {
            group = x.group;
            const gid = id + "-g" + i;
            box = el("div", { className: "cb-group" }, el("div", { id: gid, className: "cb-group-l" }, group));
            box.setAttribute("role", "group");
            box.setAttribute("aria-labelledby", gid);
            list.appendChild(box);
          }
          const opt = el("div", { id: id + "-o" + i, className: "cb-opt" },
            el("span", { className: "cb-name" }, x.name), x.meta ? el("span", { className: "cb-meta" }, x.meta) : null);
          opt.setAttribute("role", "option");
          opt.setAttribute("aria-selected", String(x === picked));
          opt.addEventListener("mousedown", (e) => e.preventDefault());   // keep focus in the box
          opt.addEventListener("click", () => choose(x));
          box.appendChild(opt);
        });
        // Typing highlights the best match, so Enter takes it. Just opening
        // the list highlights the current pick, if there is one.
        setActive(norm(q || "") ? 0 : shown.indexOf(picked));
      }
  
      function open(q) {
        draw(q);
        list.hidden = false;
        wrap.classList.add("is-open");
        input.setAttribute("aria-expanded", "true");
      }
      function close() {
        list.hidden = true;
        wrap.classList.remove("is-open");
        input.setAttribute("aria-expanded", "false");
        input.removeAttribute("aria-activedescendant");
      }
      function choose(x) {
        picked = x;
        input.value = x.name;
        wrap.classList.remove("is-invalid");
        input.removeAttribute("aria-invalid");
        close();
        showDetail();
      }
      // On leaving: keep an exact match, otherwise go back to the last pick.
      function settle() {
        const typed = norm(input.value);
        if (!typed) { picked = null; input.value = ""; showDetail(); return; }
        const exact = o.options.find((x) => norm(x.name) === typed);
        if (exact) { choose(exact); return; }
        input.value = picked ? picked.name : "";
      }
  
      input.addEventListener("input", () => open(input.value));
      input.addEventListener("focus", () => { if (list.hidden) open(""); });
      input.addEventListener("click", () => { if (list.hidden) open(""); });
      input.addEventListener("blur", () => { close(); settle(); });
      input.addEventListener("keydown", (e) => {
        if (e.key === "ArrowDown" || e.key === "ArrowUp") {
          e.preventDefault();
          if (list.hidden) { open(""); return; }
          if (!shown.length) return;
          if (active < 0) setActive(e.key === "ArrowDown" ? 0 : shown.length - 1);
          else setActive((active + (e.key === "ArrowDown" ? 1 : -1) + shown.length) % shown.length);
        } else if (e.key === "Enter") {
          if (!list.hidden && active >= 0 && shown[active]) { e.preventDefault(); choose(shown[active]); }
        } else if (e.key === "Escape") {
          if (!list.hidden) { e.preventDefault(); e.stopPropagation(); close(); input.value = picked ? picked.name : ""; }
        }
      });
      toggle.addEventListener("mousedown", (e) => e.preventDefault());
      toggle.addEventListener("click", () => {
        if (list.hidden) { input.focus(); open(""); } else close();
      });
  
      input.value = picked ? picked.name : "";
      showDetail();
      return {
        node: el("div", { className: "cb-field" }, wrap, detail),
        input,
        value: () => (picked ? picked.name : ""),
        focus: () => { wrap.classList.add("is-invalid"); input.setAttribute("aria-invalid", "true"); input.focus(); }
      };
    }
  
    /* ---------- the delivery fields ----------
       buildFields(host, values) draws the same inputs in two places (the
       member's new-delivery form and the admin's edit form) and returns
       { read() }. read() returns a clean object or throws an Error whose message
       is shown to the user. The limits match the Firestore rules; if you change
       one, change the other.
  
       The box ID is never typed: a new delivery brings one from newBoxId(),
       and an existing one keeps the one it has. The school and the drop-off
       can only be picked from the partner lists above. A delivery saved before
       those lists existed keeps what was typed until someone picks a partner. */
    function buildFields(host, v) {
      v = v || {};
      const isNew = !v.status;
      const boxId = v.boxId || "";
  
      const date = el("input", { type: "date", required: true, value: v.date || today() });
      const weight = el("input", { type: "number", min: "0.1", max: "500", step: "0.1", required: true, value: v.weightLbs || "", placeholder: "e.g. 12.5" });
      weight.setAttribute("inputmode", "decimal");
      const notes = el("textarea", { rows: 3, maxLength: 2000, value: v.notes || "", placeholder: "Anything the reviewer should know" });
  
      const earlier = (value, list) => value && !list.some((x) => x.name === value)
        ? [{ name: value, group: "Typed in before the partner list", meta: "Pick a partner above to replace it" }] : [];
      const schoolList = schools(), dropList = dropoffs();
      const from = combo({ options: schoolList.concat(earlier(v.fromSchool, schoolList)), value: v.fromSchool,
        placeholder: "Search our partner schools", empty: "No partner school matches. Only schools we work with are listed.", detailIcon: "school" });
      const to = combo({ options: dropList.concat(earlier(v.toSite, dropList)), value: v.toSite,
        placeholder: "Search our partner fridges", empty: "No partner site matches. Only confirmed drop-off sites are listed." });
  
      const itemsList = el("div", { className: "p-items" });
      const addBtn = el("button", { type: "button", className: "p-link p-add" }, icon("plus"), "Add another food");
      function addRow(it) {
        const name = el("input", { type: "text", maxLength: 80, value: (it && it.name) || "", placeholder: "e.g. milk cartons" });
        const qty = el("input", { type: "text", maxLength: 40, value: (it && it.qty) || "", placeholder: "e.g. 24" });
        name.setAttribute("aria-label", "Food");
        qty.setAttribute("aria-label", "Amount");
        const rm = el("button", { type: "button", className: "p-rm", title: "Remove this food" }, icon("x"));
        rm.setAttribute("aria-label", "Remove this food");
        const row = el("div", { className: "p-item" }, name, qty, rm);
        rm.addEventListener("click", () => { if (itemsList.children.length > 1) row.remove(); else { name.value = ""; qty.value = ""; } });
        itemsList.appendChild(row);
        return name;
      }
      (v.items && v.items.length ? v.items : [{}]).forEach(addRow);
      addBtn.addEventListener("click", () => addRow({}).focus());
  
      /* The label is a grid, so its text and "optional" are wrapped in one
         span; left loose they became two rows and pushed that field lower
         than its neighbour. */
      const cap = (text, opt) => el("span", {}, text, opt ? el("span", { className: "p-opt" }, " optional") : null);
      const field = (text, c) => {
        const l = el("label", { htmlFor: c.input.id }, cap(text));
        return el("div", { className: "p-field" }, l, c.node);
      };
      const sec = (n, title, text, ...kids) => el("section", { className: "f-sec" },
        el("header", { className: "f-sec-head" }, el("span", { className: "f-num" }, String(n)),
          el("div", {}, el("h3", {}, title), text ? el("p", {}, text) : null)),
        el("div", { className: "f-body" }, ...kids));
  
      const boxCard = boxId
        ? el("div", { className: "boxid" },
            el("div", { className: "boxid-text" }, el("span", { className: "boxid-l" }, "Box ID"), el("code", { className: "boxid-v" }, boxId)),
            copyButton(boxId))
        : el("div", { className: "boxid is-none" },
            el("div", { className: "boxid-text" }, el("span", { className: "boxid-l" }, "Box ID"),
              el("span", { className: "p-muted" }, "None. This was logged before box IDs were given out automatically.")));
  
      host.replaceChildren(
        sec(1, "Box", isNew
          ? "This delivery's tracking ID. Write it on the box label. Temperature readings will attach to it once the box sensors are ready."
          : "The box ID can't be changed.", boxCard),
        sec(2, "Trip", "Where the food came from and where it went.",
          el("div", { className: "p-grid p-grid-date" }, el("label", {}, cap("Delivery date"), date)),
          el("div", { className: "route" }, field("Picked up from", from), field("Delivered to", to))),
        sec(3, "What was in the box", "List each food and how much. Then weigh the whole box.",
          el("fieldset", { className: "p-fieldset" }, el("legend", {}, "Foods"),
            el("div", { className: "p-item-head", ariaHidden: "true" }, el("span", {}, "Food"), el("span", {}, "Amount")),
            itemsList, addBtn),
          el("div", { className: "p-grid" },
            el("label", {}, cap("Total weight (lbs)"), weight)),
          el("label", { className: "p-full" }, cap("Notes", true), notes)));
  
      function read() {
        const items = Array.from(itemsList.children).map((row) => {
          const [n, q] = row.querySelectorAll("input");
          return { name: n.value.trim(), qty: q.value.trim() };
        }).filter((it) => it.name);
        const w = parseFloat(weight.value);
        if (!/^\d{4}-\d{2}-\d{2}$/.test(date.value)) throw new Error("Pick the delivery date.");
        if (!from.value()) { from.focus(); throw new Error("Pick the school the food came from."); }
        if (!to.value()) { to.focus(); throw new Error("Pick where the food was delivered."); }
        if (!items.length) { itemsList.querySelector("input").focus(); throw new Error("List at least one food."); }
        if (items.length > 50) throw new Error("That's more than 50 foods. Combine some lines.");
        if (!(w > 0 && w <= 500)) { weight.focus(); throw new Error("Weight has to be between 0.1 and 500 lbs."); }
        return {
          date: date.value, boxId, fromSchool: from.value(), toSite: to.value(),
          weightLbs: Math.round(w * 10) / 10, items, notes: notes.value.trim()
        };
      }
      return { read };
    }
  
    /* ---------- read-only view of one delivery ---------- */
    function deliveryDetails(d) {
      const drop = findDropoff(d.toSite);
      const foods = (d.items || []).length;
      const fact = (k, val) => el("div", {}, el("dt", {}, k), el("dd", {}, val));
      return el("div", { className: "d-body" },
        d.boxId ? el("p", { className: "d-boxid" }, el("span", { className: "d-boxid-l" }, "Box"), el("code", {}, d.boxId)) : null,
        el("p", { className: "d-route" }, d.fromSchool,
          el("span", { className: "d-arrow" }, el("span", { ariaHidden: "true" }, " → "), el("span", { className: "vh" }, " to ")), d.toSite),
        drop ? el("p", { className: "d-addr" }, icon("pin"), drop.address) : null,
        el("dl", { className: "d-facts" },
          fact("Date", fmtDate(d.date)),
          fact("Weight", d.weightLbs + " lbs"),
          fact("Foods", foods + (foods === 1 ? " kind" : " kinds"))),
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
  
    /* ---------- the public log's copy of a delivery ----------
       Only what's safe to publish: the date, weight, how many kinds of food,
       and the status. Returns null for a delivery that shouldn't be listed
       (rejected ones). The fields must match firestore.rules, publicLog. */
    function publicEntry(d) {
      if (d.status !== "pending" && d.status !== "accepted") return null;
      return { date: d.date, weightLbs: d.weightLbs, foods: (d.items || []).length, status: d.status };
    }

    window.STBP = { ready, el, icon, mascot, copyButton, today, fmtTime, fmtDate, statusPill, say, gate, buildFields, deliveryDetails, compressImage, publicEntry, newBoxId, DROPOFFS };
  
    STB.initTheme();
    STB.initMascotSlots();
  })();