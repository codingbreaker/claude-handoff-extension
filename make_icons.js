// make_icons.js — unique AI Handoff icon generator
// Design: glowing split-fork arrow on deep dark bg
//   One arrow enters left → splits into two diverging arrows right
//   Colors: electric violet (#7c3aed) → cyan-teal (#06b6d4) fork
//   Never used anywhere — original design by @codingbreaker
// Run: node make_icons.js

const fs   = require('fs');
const path = require('path');
const zlib = require('zlib');

const outDir = path.join(__dirname, 'icons');
if (!fs.existsSync(outDir)) fs.mkdirSync(outDir);

// ── PNG writer ─────────────────────────────────────────────────────────────
function writePng(size, pixelFn) {
  const w = size, h = size;
  const raw = Buffer.alloc(h * (1 + w * 4)); // RGBA
  for (let y = 0; y < h; y++) {
    raw[y * (1 + w * 4)] = 0;
    for (let x = 0; x < w; x++) {
      const [r, g, b, a] = pixelFn(x / (w - 1), y / (h - 1));
      const i = y * (1 + w * 4) + 1 + x * 4;
      raw[i]=r; raw[i+1]=g; raw[i+2]=b; raw[i+3]=a;
    }
  }
  function u32be(n) { const b=Buffer.alloc(4); b.writeUInt32BE(n); return b; }
  function crc32(buf) { let c=0xFFFFFFFF; for(const b of buf){c^=b;for(let i=0;i<8;i++)c=(c&1)?(0xEDB88320^(c>>>1)):(c>>>1);} return(c^0xFFFFFFFF)>>>0; }
  function chunk(type,data) { const t=Buffer.from(type,'ascii'); return Buffer.concat([u32be(data.length),t,data,u32be(crc32(Buffer.concat([t,data])))]); }
  // RGBA PNG (bit depth 8, color type 6)
  const ihdr = Buffer.concat([u32be(w),u32be(h),Buffer.from([8,6,0,0,0])]);
  const idat = zlib.deflateSync(raw,{level:9});
  return Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),chunk('IHDR',ihdr),chunk('IDAT',idat),chunk('IEND',Buffer.alloc(0))]);
}

// ── Math helpers ───────────────────────────────────────────────────────────
const lerp  = (a, b, t) => a + (b - a) * t;
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const dist  = (x1,y1,x2,y2) => Math.sqrt((x1-x2)**2+(y1-y2)**2);

function lerpRGB(c1, c2, t) {
  return [Math.round(lerp(c1[0],c2[0],t)), Math.round(lerp(c1[1],c2[1],t)), Math.round(lerp(c1[2],c2[2],t))];
}

// Distance from point (px,py) to line segment (ax,ay)→(bx,by)
function distToSeg(px,py, ax,ay, bx,by) {
  const dx=bx-ax, dy=by-ay, len2=dx*dx+dy*dy;
  if (len2===0) return dist(px,py,ax,ay);
  const t = clamp(((px-ax)*dx+(py-ay)*dy)/len2, 0, 1);
  return dist(px,py, ax+t*dx, ay+t*dy);
}

// Rounded rectangle SDF
function roundedRect(nx,ny, x,y,w,h, r) {
  const qx = Math.abs(nx - (x+w/2)) - w/2 + r;
  const qy = Math.abs(ny - (y+h/2)) - h/2 + r;
  return Math.sqrt(Math.max(qx,0)**2 + Math.max(qy,0)**2) + Math.min(Math.max(qx,qy),0) - r;
}

// ── ICON PIXEL FUNCTION ────────────────────────────────────────────────────
// Design on a 1×1 unit canvas, coordinates [0,1]
//
//  Background: very dark #0a0a14 rounded square
//  Center:     glowing arrow shaft coming from left (violet)
//  Fork point: ~55% from left, arrow splits into upper-right (cyan) and lower-right (violet)
//  Both arrows end with arrowheads
//  Subtle aura/glow around each path
//
function pixel(nx, ny) {
  // ── ROUNDED SQUARE BACKGROUND ──
  const bgSdf = roundedRect(nx,ny, 0.04,0.04, 0.92,0.92, 0.20);
  if (bgSdf > 0) return [0,0,0,0]; // transparent outside

  // Base background: deep dark blue-black
  const cx=0.5, cy=0.5;
  const bgGrad = clamp(dist(nx,ny,0.35,0.40)*1.6, 0, 1);
  let [r,g,b] = lerpRGB([18,10,40], [8,6,20], bgGrad);
  let a = 255;

  // Subtle inner edge glow on rounded square
  const edgeDist = -bgSdf;
  if (edgeDist < 0.04) {
    const eg = 1 - edgeDist/0.04;
    [r,g,b] = lerpRGB([r,g,b], [90,40,160], eg*0.18);
  }

  // ── ARROW PATHS ──
  // Shaft:  (0.10, 0.50) → (0.54, 0.50)
  // Fork upper: (0.54, 0.50) → (0.86, 0.30)
  // Fork lower: (0.54, 0.50) → (0.86, 0.70)

  const FORK_X = 0.54, FORK_Y = 0.50;

  // --- SHAFT ---
  const dShaft = distToSeg(nx,ny, 0.10,0.50, FORK_X,FORK_Y);
  // --- UPPER ARM ---
  const dUpper = distToSeg(nx,ny, FORK_X,FORK_Y, 0.86,0.30);
  // --- LOWER ARM ---
  const dLower = distToSeg(nx,ny, FORK_X,FORK_Y, 0.86,0.70);

  // Colors
  const VIOLET = [124,58,237];
  const CYAN   = [6,182,212];
  const WHITE  = [240,230,255];

  function applyPath(dist_, colorA, colorB, weight) {
    const CORE  = weight * 0.018;
    const INNER = weight * 0.032;
    const OUTER = weight * 0.060;
    if (dist_ < CORE) {
      const t = dist_/CORE;
      [r,g,b] = lerpRGB(WHITE, lerpRGB(colorA,colorB,0.3), t*t);
      a = 255;
    } else if (dist_ < INNER) {
      const t = (dist_-CORE)/(INNER-CORE);
      [r,g,b] = lerpRGB(lerpRGB(colorA,colorB,0.3), colorA, t);
    } else if (dist_ < OUTER) {
      const t = (dist_-INNER)/(OUTER-INNER);
      const fade = 1 - t*t;
      [r,g,b] = lerpRGB([r,g,b], colorA, fade * 0.55);
    }
  }

  // Apply layers: outer glow first, core last
  applyPath(dShaft, VIOLET, WHITE, 1.0);
  applyPath(dUpper, CYAN,   WHITE, 0.92);
  applyPath(dLower, VIOLET, WHITE, 0.92);

  // ── ARROWHEADS ──
  function arrowhead(tipX,tipY, dirX,dirY, color, sz) {
    // Two lines forming a ">" shape at tip
    const len = Math.sqrt(dirX*dirX+dirY*dirY);
    const ux=dirX/len, uy=dirY/len;
    const px_=-uy, py_=ux; // perpendicular
    const a1x=tipX-ux*sz-px_*sz*0.55, a1y=tipY-uy*sz-py_*sz*0.55;
    const a2x=tipX-ux*sz+px_*sz*0.55, a2y=tipY-uy*sz+py_*sz*0.55;
    const d1 = distToSeg(nx,ny, tipX,tipY, a1x,a1y);
    const d2 = distToSeg(nx,ny, tipX,tipY, a2x,a2y);
    const d  = Math.min(d1,d2);
    const CORE=0.016, INNER=0.030, OUTER=0.052;
    if (d<CORE)       { [r,g,b]=lerpRGB(WHITE,color, d/CORE); }
    else if (d<INNER) { const t=(d-CORE)/(INNER-CORE); [r,g,b]=lerpRGB(color,lerpRGB([r,g,b],color,0.5),t); }
    else if (d<OUTER) { const t=(d-INNER)/(OUTER-INNER); [r,g,b]=lerpRGB([r,g,b],color,(1-t*t)*0.5); }
  }

  arrowhead(0.88, 0.28,  0.32,-0.20, CYAN,   0.13);
  arrowhead(0.88, 0.72,  0.32, 0.20, VIOLET, 0.13);

  // ── FORK DOT (junction circle) ──
  const forkD = dist(nx,ny, FORK_X, FORK_Y);
  if (forkD < 0.045) {
    const fi = 1 - forkD/0.045;
    [r,g,b] = lerpRGB([r,g,b], lerpRGB(VIOLET,CYAN,0.5), fi*fi*0.9);
  }
  if (forkD < 0.022) {
    [r,g,b] = lerpRGB(WHITE, lerpRGB(VIOLET,CYAN,0.5), forkD/0.022);
  }

  // ── ENTRY DOT (left start) ──
  const entryD = dist(nx,ny, 0.10, 0.50);
  if (entryD < 0.030) {
    const ei = 1 - entryD/0.030;
    [r,g,b] = lerpRGB([r,g,b], VIOLET, ei*0.7);
  }

  return [clamp(r,0,255), clamp(g,0,255), clamp(b,0,255), a];
}

// ── Generate all sizes ─────────────────────────────────────────────────────
[16, 32, 48, 128].forEach(size => {
  const buf = writePng(size, pixel);
  const out = path.join(outDir, `icon${size}.png`);
  fs.writeFileSync(out, buf);
  console.log(`✅ icons/icon${size}.png — ${buf.length} bytes`);
});

console.log('\n🔀 AI Handoff icons ready! Reload extension in chrome://extensions');
