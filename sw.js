/* Root-level registration shim.

   A service worker may only claim a scope at or below its own directory, and
   GitHub Pages cannot send the Service-Worker-Allowed header that would lift
   that restriction. A worker at assets/sw.js is therefore capped at
   /stock/assets/ — it would never see a page navigation, which is exactly the
   request the network-first strategy exists to handle.

   So the file that gets registered sits here, at the site root, where it can
   claim the whole site; all the actual logic stays in assets/sw.js and is
   pulled in below. importScripts resolves relative to this file. */
importScripts("assets/sw.js");
