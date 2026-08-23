#!/usr/bin/env node
/* ============================================================================
   Geocode the school list into assets/geo/sites.json.

   Why this exists
   ---------------
   The pin coordinates shipped in assets/geo/sites.json were typed in from
   publicly known school addresses and never checked against a geocoder. That
   is fine for a first draft and not fine for a map anyone relies on. This
   script replaces them with coordinates from a real geocoding service, so the
   file stops being an assertion and starts being a derived artefact.

   Usage
   -----
     node tools/geocode.mjs            # dry run: prints what it would write
     node tools/geocode.mjs --write    # overwrites assets/geo/sites.json

   It reads the school NAMES from assets/site.js (the SITES array), so the
   school list has exactly one source. Adding a school there and re-running
   this is the whole workflow; there is no second list to keep in sync.

   Service
   -------
   OpenStreetMap Nominatim. Its usage policy requires a real User-Agent and
   at most one request per second, both of which are honoured below. It is a
   build-time dependency only: nothing here runs in a visitor's browser.

   Anything Nominatim cannot resolve is left with its previous coordinates and
   reported as UNRESOLVED rather than being guessed at.
   ========================================================================= */

import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const SITES_JSON = join(ROOT, "assets", "geo", "sites.json");
const SITE_JS = join(ROOT, "assets", "site.js");

const UA = "stock-the-block-site-build/1.0 (https://safthelegend.github.io/stock/)";
const ENDPOINT = "https://nominatim.openstreetmap.org/search";
const CITY_HINT = "New York City, NY, USA";

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/* Pull the school names out of the SITES array rather than duplicating them. */
async function readSiteNames() {
  const src = await readFile(SITE_JS, "utf8");
  const block = src.match(/var SITES = \[([\s\S]*?)\];/);
  if (!block) throw new Error("Could not find the SITES array in assets/site.js");
  return [...block[1].matchAll(/name:\s*"([^"]+)"/g)].map((m) => m[1]);
}

async function geocode(query) {
  const url = `${ENDPOINT}?q=${encodeURIComponent(query)}&format=json&limit=1`;
  const res = await fetch(url, { headers: { "User-Agent": UA, "Accept-Language": "en" } });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  const hits = await res.json();
  if (!hits.length) return null;
  return {
    lat: Number(Number(hits[0].lat).toFixed(4)),
    lon: Number(Number(hits[0].lon).toFixed(4)),
    display: hits[0].display_name
  };
}

async function main() {
  const write = process.argv.includes("--write");
  const doc = JSON.parse(await readFile(SITES_JSON, "utf8"));
  const names = await readSiteNames();

  const byName = new Map(doc.sites.map((s) => [s.name, s]));
  const unresolved = [];
  let changed = 0;

  for (const name of names) {
    const existing = byName.get(name);
    if (!existing) {
      console.log(`NEW      ${name} (not yet in sites.json, will be added)`);
    }
    let hit = null;
    try {
      hit = await geocode(`${name}, ${CITY_HINT}`);
    } catch (err) {
      console.log(`ERROR    ${name}: ${err.message}`);
    }
    await sleep(1100); /* Nominatim: max 1 req/sec */

    if (!hit) {
      unresolved.push(name);
      console.log(`UNRESOLVED ${name} — keeping previous coordinates, if any`);
      continue;
    }
    const moved = existing && (existing.lat !== hit.lat || existing.lon !== hit.lon);
    if (moved) changed++;
    console.log(
      `${moved ? "MOVED   " : "OK      "} ${name}\n           -> ${hit.lat}, ${hit.lon}  (${hit.display})`
    );
    byName.set(name, { name, lat: hit.lat, lon: hit.lon, precision: "address" });
  }

  /* Entries with no published address (the receiving site) are borough-level
     by design and are never overwritten by a geocoder lookup. */
  doc.sites = [...byName.values()];
  doc.meta.verified = unresolved.length === 0;
  doc.meta.verification_note = unresolved.length
    ? `Geocoded ${names.length - unresolved.length} of ${names.length} on ${new Date().toISOString().slice(0, 10)} via Nominatim. UNRESOLVED, still unverified: ${unresolved.join("; ")}.`
    : `All school coordinates geocoded via OpenStreetMap Nominatim on ${new Date().toISOString().slice(0, 10)}.`;

  console.log(`\n${changed} coordinate(s) would change. ${unresolved.length} unresolved.`);
  if (!write) {
    console.log("Dry run. Re-run with --write to update assets/geo/sites.json.");
    return;
  }
  await writeFile(SITES_JSON, JSON.stringify(doc, null, 2) + "\n");
  console.log(`Wrote ${SITES_JSON}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
