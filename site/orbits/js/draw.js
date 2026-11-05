// Shared Canvas2D drawing: a tiny 3D camera, starfield, Sun, and a CPU-shaded globe.
// No WebGL anywhere — it renders the same on every device (and in GPU-less test browsers).
import { DEG } from './astro.js';
import { isLand } from './land.js';

// ---------- vectors / 3×3 matrices (row-major arrays of 3 rows)
export const v3 = {
  add: (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]],
  sub: (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]],
  mul: (a, s) => [a[0] * s, a[1] * s, a[2] * s],
  dot: (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2],
  cross: (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]],
  len: (a) => Math.hypot(a[0], a[1], a[2]),
  norm: (a) => { const l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l]; },
};
export const mat = {
  apply: (M, v) => [v3.dot(M[0], v), v3.dot(M[1], v), v3.dot(M[2], v)],
  applyT: (M, v) => [ // transpose-apply
    M[0][0] * v[0] + M[1][0] * v[1] + M[2][0] * v[2],
    M[0][1] * v[0] + M[1][1] * v[1] + M[2][1] * v[2],
    M[0][2] * v[0] + M[1][2] * v[1] + M[2][2] * v[2]],
  mul: (A, B) => A.map((row) => [0, 1, 2].map((j) => row[0] * B[0][j] + row[1] * B[1][j] + row[2] * B[2][j])),
  rotZ: (a) => [[Math.cos(a), -Math.sin(a), 0], [Math.sin(a), Math.cos(a), 0], [0, 0, 1]],
  rotX: (a) => [[1, 0, 0], [0, Math.cos(a), -Math.sin(a)], [0, Math.sin(a), Math.cos(a)]],
  rotY: (a) => [[Math.cos(a), 0, Math.sin(a)], [0, 1, 0], [-Math.sin(a), 0, Math.cos(a)]],
};

// ---------- camera: world Z is "up" (ecliptic north). yaw around Z, pitch = elevation above the plane.
export class Camera {
  constructor({ yaw = -90, pitch = 30, scale = 100, persp = 0 } = {}) {
    Object.assign(this, { yaw, pitch, scale, persp, cx: 0, cy: 0, zoom: 1, pinching: false });
    this.update();
  }
  update() {
    const y = this.yaw * DEG, p = this.pitch * DEG;
    const c = [Math.cos(p) * Math.cos(y), Math.cos(p) * Math.sin(y), Math.sin(p)];
    const right = [-Math.sin(y), Math.cos(y), 0];
    this.V = [right, v3.cross(c, right), c]; // world → view (x right, y up, z toward viewer)
    return this;
  }
  // world point → {x, y, z (toward viewer), k (perspective factor)}
  project(P) {
    const v = mat.apply(this.V, P);
    const k = this.persp ? 1 / (1 - v[2] * this.persp) : 1;
    const sc = this.scale * this.zoom;
    return { x: this.cx + v[0] * sc * k, y: this.cy - v[1] * sc * k, z: v[2], k };
  }
  toView(dir) { return mat.apply(this.V, dir); }
  // drag-to-orbit on a canvas
  attachDrag(canvas, onChange, { minPitch = -89, maxPitch = 89 } = {}) {
    let drag = null;
    canvas.style.cursor = 'grab';
    canvas.addEventListener('pointerdown', (e) => { drag = { x: e.clientX, y: e.clientY, yaw: this.yaw, pitch: this.pitch }; canvas.setPointerCapture(e.pointerId); canvas.style.cursor = 'grabbing'; });
    canvas.addEventListener('pointermove', (e) => {
      if (!drag || this.pinching) return;
      this.yaw = drag.yaw - (e.clientX - drag.x) * 0.4;
      this.pitch = Math.max(minPitch, Math.min(maxPitch, drag.pitch + (e.clientY - drag.y) * 0.3));
      this.update(); onChange && onChange();
    });
    const end = () => { drag = null; canvas.style.cursor = 'grab'; };
    canvas.addEventListener('pointerup', end); canvas.addEventListener('pointercancel', end);
  }
}

// ---------- background stars (deterministic)
export function makeStars(n, seed = 1) {
  let s = seed;
  const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  return Array.from({ length: n }, () => ({ x: rnd(), y: rnd(), m: Math.pow(rnd(), 3), t: rnd() * 6.28 }));
}
export function drawStars(ctx, w, h, stars, alpha = 1) {
  for (const st of stars) {
    const a = (0.25 + 0.75 * st.m) * alpha;
    ctx.fillStyle = `rgba(232,236,255,${a.toFixed(3)})`;
    const r = 0.5 + st.m * 1.1;
    ctx.fillRect(st.x * w - r / 2, st.y * h - r / 2, r, r);
  }
}

export function drawSun(ctx, x, y, r, glow = 4) {
  const g = ctx.createRadialGradient(x, y, r * 0.2, x, y, r * glow);
  g.addColorStop(0, 'rgba(255,214,130,0.55)');
  g.addColorStop(0.25, 'rgba(255,180,80,0.18)');
  g.addColorStop(1, 'rgba(255,160,60,0)');
  ctx.fillStyle = g;
  ctx.beginPath(); ctx.arc(x, y, r * glow, 0, Math.PI * 2); ctx.fill();
  const c = ctx.createRadialGradient(x - r * 0.25, y - r * 0.25, r * 0.1, x, y, r);
  c.addColorStop(0, '#fff7dc'); c.addColorStop(0.7, '#ffd27a'); c.addColorStop(1, '#ffb347');
  ctx.fillStyle = c;
  ctx.beginPath(); ctx.arc(x, y, Math.max(r, 0.6), 0, Math.PI * 2); ctx.fill();
}

// a small lit sphere (planet/moon) with day/night side; lightDir in screen space (x right, y down)
export function drawBall(ctx, x, y, r, color, lightDx, lightDy) {
  r = Math.max(r, 0.7);
  ctx.fillStyle = color;
  ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
  if (r < 2.5) return;
  const l = Math.hypot(lightDx, lightDy) || 1;
  const dx = lightDx / l, dy = lightDy / l;
  const g = ctx.createLinearGradient(x + dx * r, y + dy * r, x - dx * r, y - dy * r);
  g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(0.48, 'rgba(0,0,0,0.05)');
  g.addColorStop(0.56, 'rgba(3,5,12,0.78)'); g.addColorStop(1, 'rgba(3,5,12,0.9)');
  ctx.fillStyle = g;
  ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
}

// ---------- the globe
// Body frame: +z = north pole, longitude 0 along +x. `B` = body→view matrix (view: x right, y up, z to viewer).
// sun: unit vector in view space. Features (tropics / polar circles) follow `tiltDeg`.
const globeCache = new Map();
export function drawGlobe(ctx, cx, cy, R, { B, sun, tiltDeg = 23.44, spin = 0, observer = null, res = 1.5,
  ocean = [40, 110, 190], land = true, night = 0.07, grid = true } = {}) {
  const N = Math.max(8, Math.min(Math.round(R * 2 * res), 480));
  let c = globeCache.get(N);
  if (!c) { const cv = document.createElement('canvas'); cv.width = cv.height = N; c = { cv, cx: cv.getContext('2d'), img: null }; c.img = c.cx.createImageData(N, N); globeCache.set(N, c); }
  const d = c.img.data;
  const tropic = tiltDeg * DEG, polar = (90 - tiltDeg) * DEG;
  const lineW = 2.2 / N; // ≈ one pixel in sin(lat) terms near the equator
  for (let j = 0; j < N; j++) {
    const vy = 1 - (2 * (j + 0.5)) / N;
    for (let i = 0; i < N; i++) {
      const vx = (2 * (i + 0.5)) / N - 1;
      const rr = vx * vx + vy * vy;
      const o = (j * N + i) * 4;
      if (rr > 1) { d[o + 3] = 0; continue; }
      const vz = Math.sqrt(1 - rr);
      // to body frame
      const bx = B[0][0] * vx + B[1][0] * vy + B[2][0] * vz;
      const by = B[0][1] * vx + B[1][1] * vy + B[2][1] * vz;
      const bz = B[0][2] * vx + B[1][2] * vy + B[2][2] * vz;
      const lat = Math.asin(Math.max(-1, Math.min(1, bz)));
      const lon = Math.atan2(by, bx) - spin;
      let r = ocean[0], g = ocean[1], b = ocean[2];
      if (land && isLand(lat, lon)) { r = 92; g = 138; b = 78; }
      const alat = Math.abs(lat);
      if (alat > 1.33) { r = 220; g = 230; b = 240; } // polar ice (approximate)
      if (grid) {
        const s = Math.sin(lat);
        const near = (a) => Math.abs(s - Math.sin(a)) < lineW * Math.max(0.6, Math.cos(a) * 1.2);
        if (Math.abs(s) < lineW) { r = 255; g = 255; b = 255; }
        else if (tiltDeg > 0.5 && (near(tropic) || near(-tropic))) { r = 255; g = 196; b = 96; }
        else if (tiltDeg > 0.5 && tiltDeg < 89.5 && (near(polar) || near(-polar))) { r = 150; g = 210; b = 255; }
      }
      // lighting
      const lam = vx * sun[0] + vy * sun[1] + vz * sun[2];
      const day = Math.max(0, Math.min(1, (lam + 0.03) / 0.08)); // soft terminator (twilight)
      const shade = night + (1 - night) * day * (0.55 + 0.45 * Math.max(0, lam));
      const rim = 0.85 + 0.15 * vz;
      d[o] = r * shade * rim; d[o + 1] = g * shade * rim; d[o + 2] = b * shade * rim; d[o + 3] = 255;
    }
  }
  c.cx.putImageData(c.img, 0, 0);
  ctx.save();
  ctx.imageSmoothingEnabled = true;
  ctx.drawImage(c.cv, cx - R, cy - R, 2 * R, 2 * R);
  // atmosphere rim
  ctx.strokeStyle = 'rgba(140,200,255,0.35)'; ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.arc(cx, cy, R + 0.5, 0, Math.PI * 2); ctx.stroke();
  ctx.restore();
  if (observer) {
    // observer marker on the surface at body lat/lon (lon in the rotating frame)
    const la = observer.lat, lo = observer.lon + spin;
    const p = [Math.cos(la) * Math.cos(lo), Math.cos(la) * Math.sin(lo), Math.sin(la)];
    const v = mat.apply(B, p);
    const vis = v[2] > 0;
    ctx.fillStyle = vis ? '#ff5a5a' : 'rgba(255,90,90,0.35)';
    ctx.strokeStyle = '#fff'; ctx.lineWidth = vis ? 1.5 : 0.5;
    ctx.beginPath(); ctx.arc(cx + v[0] * R, cy - v[1] * R, vis ? 4.5 : 3, 0, Math.PI * 2); ctx.fill(); if (vis) ctx.stroke();
    return { x: cx + v[0] * R, y: cy - v[1] * R, visible: vis, view: v };
  }
  return null;
}

// spin-axis direction in world (ecliptic) coords for a tilt, pointing so the north pole leans toward
// ecliptic longitude `towardDeg` (Earth: the north pole leans toward the Sun at the June solstice,
// when the Sun is at ecliptic longitude 90° as seen from Earth).
export function axisDir(tiltDeg, towardDeg = 90) {
  const t = tiltDeg * DEG, a = towardDeg * DEG;
  return [Math.sin(t) * Math.cos(a), Math.sin(t) * Math.sin(a), Math.cos(t)];
}
// body→world matrix for a body with spin axis `axis` (unit). Body x axis lies in the ecliptic-ish plane.
export function bodyFrame(axis) {
  const z = axis;
  let x = v3.cross([0, 0, 1], z);
  if (v3.len(x) < 1e-6) x = [1, 0, 0]; else x = v3.norm(x);
  const y = v3.cross(z, x);
  // columns are x,y,z → rows of the matrix are world components
  return [[x[0], y[0], z[0]], [x[1], y[1], z[1]], [x[2], y[2], z[2]]];
}

export function label(ctx, text, x, y, { color = 'rgba(237,240,247,0.85)', size = 12, align = 'left', base = 'middle', weight = 400 } = {}) {
  ctx.font = `${weight} ${size}px ui-sans-serif, -apple-system, "Segoe UI", Inter, Roboto, sans-serif`;
  ctx.fillStyle = color; ctx.textAlign = align; ctx.textBaseline = base;
  ctx.fillText(text, x, y);
}
export function badge(ctx, text, x, y, { align = 'left', color = '#f5b95a' } = {}) {
  ctx.font = '500 11.5px ui-sans-serif, -apple-system, "Segoe UI", Inter, Roboto, sans-serif';
  const w = ctx.measureText(text).width + 16;
  const x0 = align === 'right' ? x - w : x;
  ctx.fillStyle = 'rgba(5,7,15,0.7)'; ctx.strokeStyle = 'rgba(245,185,90,0.45)'; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.roundRect(x0, y, w, 22, 11); ctx.fill(); ctx.stroke();
  ctx.fillStyle = color; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
  ctx.fillText(text, x0 + 8, y + 11.5);
}
export function arrow(ctx, x0, y0, x1, y1, color, w = 1.6, head = 7) {
  const a = Math.atan2(y1 - y0, x1 - x0);
  ctx.strokeStyle = color; ctx.fillStyle = color; ctx.lineWidth = w;
  ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1 - Math.cos(a) * head * 0.6, y1 - Math.sin(a) * head * 0.6); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(x1, y1);
  ctx.lineTo(x1 - head * Math.cos(a - 0.4), y1 - head * Math.sin(a - 0.4));
  ctx.lineTo(x1 - head * Math.cos(a + 0.4), y1 - head * Math.sin(a + 0.4)); ctx.closePath(); ctx.fill();
}

// ---------- zoom: pinch (touch), ctrl/⌘-wheel or trackpad pinch (desktop), and on-canvas +/− buttons.
// Plain wheel scrolling is left to the page, so the scrollytelling never gets hijacked.
export function attachZoom(canvas, target, { min = 0.5, max = 8, onChange } = {}) {
  if (target.zoom == null) target.zoom = 1;
  const set = (z) => { target.zoom = Math.max(min, Math.min(max, z)); onChange && onChange(target.zoom); };
  canvas.addEventListener('wheel', (e) => {
    if (!e.ctrlKey && !e.metaKey) return;
    e.preventDefault();
    set(target.zoom * Math.exp(-e.deltaY * 0.01));
  }, { passive: false });
  const pts = new Map();
  let start = null;
  canvas.addEventListener('pointerdown', (e) => {
    pts.set(e.pointerId, [e.clientX, e.clientY]);
    if (pts.size === 2) { const [a, b] = [...pts.values()]; start = { d: Math.hypot(a[0] - b[0], a[1] - b[1]), z: target.zoom }; target.pinching = true; }
  });
  canvas.addEventListener('pointermove', (e) => {
    if (!pts.has(e.pointerId)) return;
    pts.set(e.pointerId, [e.clientX, e.clientY]);
    if (pts.size === 2 && start) { const [a, b] = [...pts.values()]; set(start.z * Math.hypot(a[0] - b[0], a[1] - b[1]) / Math.max(start.d, 1)); }
  });
  const up = (e) => { pts.delete(e.pointerId); if (pts.size < 2) { start = null; if (pts.size === 0) target.pinching = false; } };
  canvas.addEventListener('pointerup', up); canvas.addEventListener('pointercancel', up);
  // overlay buttons
  const wrap = document.createElement('div');
  wrap.className = 'zoom-wrap';
  canvas.parentNode.insertBefore(wrap, canvas);
  wrap.appendChild(canvas);
  const ui = document.createElement('div');
  ui.className = 'zoom-ui';
  ui.innerHTML = '<button aria-label="Zoom in">+</button><button aria-label="Zoom out">−</button><button aria-label="Reset zoom" class="z-reset">⟲</button>';
  const [bi, bo, br] = ui.querySelectorAll('button');
  bi.addEventListener('click', () => set(target.zoom * 1.5));
  bo.addEventListener('click', () => set(target.zoom / 1.5));
  br.addEventListener('click', () => set(1));
  wrap.appendChild(ui);
  return { set, wrap };
}
