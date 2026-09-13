/* Regenerates og-image.png, the link-preview card.
 *
 * The card used to be a flat PNG with no source, so changing a word in it
 * meant redrawing it by hand. This script is that source. Geometry, palette
 * and type sizes below were measured off the original bitmap, so output stays
 * pixel-aligned with the card that shipped before.
 *
 *   node tools/og-image.mjs
 *
 * Needs playwright (npm i -g playwright) and network access to Google Fonts,
 * which it fetches at run time rather than vendoring binaries into the repo.
 */
import { chromium } from 'playwright';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, 'og-image.png');

/* The card's copy. Keep it consistent with the og:/twitter: descriptions in
   index.html — a card that outruns the page is how a pre-launch site ends up
   claiming numbers it doesn't have. */
const COPY = {
  title: 'Stock the Block',
  stat: 'Launching this fall',
  body: ['Student-run food recovery, NYC.', 'Every box will be logged publicly', 'on Track the Box.'],
  foot: 'TRACK THE BOX · LIVE MANIFEST',
};

const C = { bg:'#EAF2DE', panel:'#F5F5F7', brand:'#2E5A22', ink:'#1D1D1F', accent:'#E8871E', muted:'#86868B' };

/* Ink boxes of the original card, in device pixels at 1200x630. Runs are
   positioned by their ink top-left rather than by line box, so a font tweak
   can't quietly shift the layout. */
const GRID = {
  title: { top: 189, left: 621, width: 507 },
  stat:  { top: 287, left: 621, sizedFrom: '8,000 lbs recovered', width: 404 },
  body:  { top: 359, left: 621, width: 386, leading: 38.5 },
  foot:  { top: 515, left: 620, width: 348, inkHeight: 15 },
};

const FONTS = {
  inter700:      'Inter:wght@700',
  inter400:      'Inter:wght@400',
  robotomono400: 'Roboto+Mono:wght@400',
};
const UA = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

async function fetchFont(spec) {
  const css = await (await fetch(`https://fonts.googleapis.com/css2?family=${spec}&display=swap`,
    { headers: { 'User-Agent': UA } })).text();
  // Take the latin subset; it covers every glyph on the card.
  const block = css.split('/* latin */')[1];
  if (!block) throw new Error(`no latin subset for ${spec}`);
  const url = block.match(/https:\/\/fonts\.gstatic\.com[^)]*/)[0];
  const buf = Buffer.from(await (await fetch(url)).arrayBuffer());
  return buf.toString('base64');
}

const loaded = {};
for (const [name, spec] of Object.entries(FONTS)) loaded[name] = await fetchFont(spec);

const face = (fam, weight, name) =>
  `@font-face{font-family:'${fam}';font-weight:${weight};font-style:normal;` +
  `src:url(data:font/woff2;base64,${loaded[name]}) format('woff2');}`;

const html = `<style>
${face('Inter', 700, 'inter700')}
${face('Inter', 400, 'inter400')}
${face('Roboto Mono', 400, 'robotomono400')}
html,body{margin:0;padding:0}
body{width:1200px;height:630px;background:${C.bg};position:relative;overflow:hidden}
.t{position:absolute;white-space:pre;margin:0}
#title{font-family:'Inter';font-weight:700;color:${C.brand}}
#stat{font-family:'Inter';font-weight:700;color:${C.ink}}
#body{font-family:'Inter';font-weight:400;color:${C.ink};line-height:${GRID.body.leading}px}
#foot{font-family:'Roboto Mono';font-weight:400;color:${C.muted}}
</style>
<svg width="1200" height="630" style="position:absolute;left:0;top:0">
  <rect x="121" y="146" width="402" height="309" rx="43"
        fill="${C.panel}" stroke="${C.brand}" stroke-width="18"/>
  <path d="M112 258.5 L532 258.5" stroke="${C.brand}" stroke-width="18"/>
  <path d="M192 362 L237.5 323 L283 362" fill="none" stroke="${C.brand}"
        stroke-width="30" stroke-linecap="round" stroke-linejoin="round"/>
  <path d="M377 362 L422 323 L467 362" fill="none" stroke="${C.brand}"
        stroke-width="30" stroke-linecap="round" stroke-linejoin="round"/>
  <path d="M262 402 Q324.5 436 387 402" fill="none" stroke="${C.accent}"
        stroke-width="24" stroke-linecap="round"/>
</svg>
<div class="t" id="title">${COPY.title}</div>
<div class="t" id="stat">${COPY.stat}</div>
<div class="t" id="body">${COPY.body.join('<br>')}</div>
<div class="t" id="foot">${COPY.foot}</div>`;

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 1 });
await page.setContent(html);

await page.evaluate(async ({ COPY, GRID }) => {
  await document.fonts.ready;
  const ctx = document.createElement('canvas').getContext('2d');
  const meas = (text, weight, size, fam, ls) => {
    ctx.font = `${weight} ${size}px '${fam}'`;
    ctx.letterSpacing = `${ls}px`;
    const m = ctx.measureText(text);
    return { w: m.width, asc: m.actualBoundingBoxAscent, desc: m.actualBoundingBoxDescent,
             left: m.actualBoundingBoxLeft, fAsc: m.fontBoundingBoxAscent, fDesc: m.fontBoundingBoxDescent };
  };
  // Converge on the point size that reproduces a measured ink dimension.
  const solve = (text, weight, fam, target, ls, dim) => {
    let s = 40;
    for (let i = 0; i < 60; i++) {
      const m = meas(text, weight, s, fam, ls);
      const got = dim === 'w' ? m.w : m.asc + m.desc;
      if (Math.abs(target - got) < 0.05) break;
      s *= target / got;
    }
    return s;
  };
  const place = (id, text, weight, size, fam, ls, top, left) => {
    const el = document.getElementById(id);
    el.style.fontSize = size + 'px';
    el.style.letterSpacing = ls + 'px';
    const m = meas(text, weight, size, fam, ls);
    const lh = parseFloat(getComputedStyle(el).lineHeight) || (m.fAsc + m.fDesc);
    const baselineInBox = (lh - (m.fAsc + m.fDesc)) / 2 + m.fAsc;
    el.style.top  = (top - (baselineInBox - m.asc)) + 'px';
    el.style.left = (left + m.left) + 'px';
  };

  const t = GRID.title;
  place('title', COPY.title, 700, solve(COPY.title, 700, 'Inter', t.width, 0, 'w'), 'Inter', 0, t.top, t.left);

  // The stat line's copy changes between launches, so its size comes from the
  // string it replaced rather than from its own width.
  const s = GRID.stat;
  place('stat', COPY.stat, 700, solve(s.sizedFrom, 700, 'Inter', s.width, 0, 'w'), 'Inter', 0, s.top, s.left);

  const b = GRID.body;
  place('body', COPY.body[0], 400, solve(COPY.body[0], 400, 'Inter', b.width, 0, 'w'), 'Inter', 0, b.top, b.left);

  // Tracked caps: size to the ink height, then open the tracking to fill the width.
  const f = GRID.foot;
  const fSize = solve(COPY.foot, 400, 'Roboto Mono', f.inkHeight, 0, 'h');
  const ls = (f.width - meas(COPY.foot, 400, fSize, 'Roboto Mono', 0).w) / (COPY.foot.length - 1);
  place('foot', COPY.foot, 400, fSize, 'Roboto Mono', ls, f.top, f.left);
}, { COPY, GRID });

await page.screenshot({ path: OUT });
await browser.close();
console.log(`wrote ${path.relative(ROOT, OUT)}`);
await fs.stat(OUT);
