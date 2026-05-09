/**
 * Generates public/og-image.png (1200×630).
 *
 * Two-step composite:
 *   1. sharp renders public/favicon.svg → accurate raster (full gradients, glow)
 *   2. resvg renders background + text layer → PNG buffer
 *   3. sharp composites favicon onto background → final PNG
 *
 * Run: node scripts/gen-og-image.mjs
 */
import { createRequire } from 'module';
import { writeFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const require = createRequire(import.meta.url);
const { Resvg }  = require('@resvg/resvg-js');
const sharp      = require('sharp');

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT      = join(__dirname, '..');

// ---------------------------------------------------------------------------
// Layout
// ---------------------------------------------------------------------------

const SCALE   = 5.4;
const BOLT_W  = Math.round(48 * SCALE);   // 259
const BOLT_H  = Math.round(46 * SCALE);   // 248
const BOLT_X  = 85;
const BOLT_Y  = Math.round((630 - BOLT_H) / 2);  // 191

const SEP_X   = BOLT_X + BOLT_W + 34;    // thin vertical rule
const TEXT_X  = SEP_X + 38;              // text zone start

const TITLE_Y    = 305;
const SUBTITLE_Y = 378;

// ---------------------------------------------------------------------------
// Step 1 — render favicon.svg via sharp (librsvg backend — handles full SVG)
// ---------------------------------------------------------------------------

const faviconPath = join(ROOT, 'public', 'favicon.svg');
const faviconPng  = await sharp(faviconPath)
  .resize(BOLT_W, BOLT_H, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
  .png()
  .toBuffer();

// ---------------------------------------------------------------------------
// Step 2 — render background + text via resvg (no bolt here)
// ---------------------------------------------------------------------------

const bgSvg = `\
<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630">
  <defs>
    <radialGradient id="bg" gradientUnits="userSpaceOnUse"
      cx="${BOLT_X + BOLT_W / 2}" cy="315" r="540">
      <stop offset="0%"   stop-color="#1c0e30"/>
      <stop offset="55%"  stop-color="#0d0b14"/>
      <stop offset="100%" stop-color="#0a0a0a"/>
    </radialGradient>
    <filter id="halo" x="-200%" y="-200%" width="500%" height="500%">
      <feGaussianBlur stdDeviation="48"/>
    </filter>
  </defs>

  <!-- Background -->
  <rect width="1200" height="630" fill="url(#bg)"/>

  <!-- Soft purple halo where the bolt will sit -->
  <ellipse
    cx="${BOLT_X + BOLT_W / 2}" cy="315"
    rx="170" ry="158"
    fill="#863bff" fill-opacity="0.18"
    filter="url(#halo)"
  />

  <!-- Thin vertical separator -->
  <line
    x1="${SEP_X}" y1="198"
    x2="${SEP_X}" y2="432"
    stroke="#863bff" stroke-opacity="0.22" stroke-width="1.5"
  />

  <!-- Title -->
  <text
    x="${TEXT_X}" y="${TITLE_Y}"
    font-family="Segoe UI, -apple-system, BlinkMacSystemFont, Helvetica Neue, Arial, sans-serif"
    font-size="92"
    font-weight="700"
    fill="#ffffff"
  >TriageIQ</text>

  <!-- Subtitle -->
  <text
    x="${TEXT_X + 2}" y="${SUBTITLE_Y}"
    font-family="Segoe UI, -apple-system, BlinkMacSystemFont, Helvetica Neue, Arial, sans-serif"
    font-size="30"
    font-weight="400"
    fill="#8a8a9a"
  >ML-powered GitHub issue triage</text>

  <!-- Bottom brand accent bar -->
  <rect x="0" y="622" width="1200" height="8" fill="#863bff" fill-opacity="0.55"/>
</svg>`;

const bgPng = new Resvg(bgSvg, { font: { loadSystemFonts: true } })
  .render()
  .asPng();

// ---------------------------------------------------------------------------
// Step 3 — composite favicon onto background via sharp
// ---------------------------------------------------------------------------

const outPath = join(ROOT, 'public', 'og-image.png');

await sharp(bgPng)
  .composite([{
    input:  faviconPng,
    top:    BOLT_Y,
    left:   BOLT_X,
    blend:  'over',
  }])
  .png({ compressionLevel: 8 })
  .toFile(outPath);

const { size } = await sharp(outPath).metadata();
console.log(`✓  ${outPath}`);
console.log(`   1200×630 px   ${(size / 1024).toFixed(1)} kB`);
