// Per-pixel lit spheres with textures — one renderer for every body, from every viewpoint.
import { DEG } from './astro.js';
import { isLand } from './land.js';

// ---- textures: (x, y, z) unit vector in the body's frame → [r, g, b] albedo (0–255)
export const TEX = {
  earth(x, y, z) {
    const lat = Math.asin(z), lon = Math.atan2(y, x);
    if (Math.abs(lat) > 1.33) return [220, 230, 240];
    return isLand(lat, lon) ? [92, 138, 78] : [40, 110, 190];
  },
  moon: (() => {
    const MARIA = [[33, -16, 17], [28, 17, 10], [8.5, 31, 11], [17, 59, 7.5], [18, -50, 16], [5, -60, 13], [-5, -38, 10],
      [-21, -17, 10], [-8, 51, 9], [-15, 35, 6], [56, 0, 5.5], [56, -20, 5], [56, 22, 5], [-24, -39, 6], [13, 4, 4.5], [-2, -16, 7]]
      .map(([la, lo, r]) => [Math.cos(la * DEG) * Math.cos(lo * DEG), Math.cos(la * DEG) * Math.sin(lo * DEG), Math.sin(la * DEG), Math.cos(r * DEG)]);
    const ty = [Math.cos(-43 * DEG) * Math.cos(-11 * DEG), Math.cos(-43 * DEG) * Math.sin(-11 * DEG), Math.sin(-43 * DEG)];
    return (x, y, z) => {
      let a = 0.8;
      for (const m of MARIA) { const dd = x * m[0] + y * m[1] + z * m[2]; if (dd > m[3]) a -= Math.min(0.36, ((dd - m[3]) / (1 - m[3])) * 2.2) * 0.9; }
      if (x * ty[0] + y * ty[1] + z * ty[2] > 0.9985) a += 0.25;
      a = Math.max(0.33, a) * (0.92 + 0.08 * Math.sin(x * 37 + y * 23) * Math.cos(y * 19 - z * 29));
      return [240 * a, 238 * a, 230 * a];
    };
  })(),
  jupiter(x, y, z) { const b = Math.sin(z * 14) * 0.5 + 0.5; return [200 + 30 * b, 160 + 30 * b, 120 + 20 * b]; },
  mars(x, y, z) { return Math.abs(z) > 0.93 ? [235, 225, 220] : [200 + 20 * Math.sin(x * 5 + y * 3), 105, 70]; },
  venus() { return [235, 215, 170]; },
  mercury(x, y, z) { return [170 + 15 * Math.sin(x * 9 + z * 7), 162, 150]; },
};

const cache = new Map();
// B: body → view matrix (rows); view axes: x right, y up, z toward the viewer. sun: unit vector in view space.
// nightAlpha: opacity of the unlit side (0 lets a daytime sky show through it). glow: rgb of a thin limb/atmosphere.
export function drawSphere(ctx, cx, cy, R, { B, sun, tex, night = 0.05, nightAlpha = 1, res = 1.4, rim = null, maxN = 420 }) {
  if (R < 1.2) { // too small for texture: a dot with the average colour of the lit fraction
    const c = tex(1, 0, 0);
    ctx.fillStyle = `rgb(${c.map((v) => Math.round(v * (0.35 + 0.65 * Math.max(0, sun[2] * 0.5 + 0.5)))).join(',')})`;
    ctx.beginPath(); ctx.arc(cx, cy, Math.max(R, 0.8), 0, Math.PI * 2); ctx.fill();
    return;
  }
  const N = Math.max(6, Math.min(Math.round(R * 2 * res), maxN));
  let c = cache.get(N);
  if (!c) { const cv = document.createElement('canvas'); cv.width = cv.height = N; const x = cv.getContext('2d'); c = { cv, x, img: x.createImageData(N, N) }; cache.set(N, c); }
  const d = c.img.data;
  for (let j = 0; j < N; j++) {
    const vy = 1 - (2 * (j + 0.5)) / N;
    for (let i = 0; i < N; i++) {
      const vx = (2 * (i + 0.5)) / N - 1;
      const rr = vx * vx + vy * vy, o = (j * N + i) * 4;
      if (rr > 1) { d[o + 3] = 0; continue; }
      const vz = Math.sqrt(1 - rr);
      const bx = B[0][0] * vx + B[1][0] * vy + B[2][0] * vz;
      const by = B[0][1] * vx + B[1][1] * vy + B[2][1] * vz;
      const bz = B[0][2] * vx + B[1][2] * vy + B[2][2] * vz;
      const col = tex(bx, by, Math.max(-1, Math.min(1, bz)));
      const lam = vx * sun[0] + vy * sun[1] + vz * sun[2];
      const day = Math.max(0, Math.min(1, (lam + 0.025) / 0.07));
      const shade = night + (1 - night) * day * (0.5 + 0.5 * Math.pow(Math.max(lam, 0), 0.6));
      const limb = 0.82 + 0.18 * vz;
      d[o] = col[0] * shade * limb; d[o + 1] = col[1] * shade * limb; d[o + 2] = col[2] * shade * limb;
      d[o + 3] = 255 * (nightAlpha + (1 - nightAlpha) * day);
    }
  }
  c.x.putImageData(c.img, 0, 0);
  ctx.drawImage(c.cv, cx - R, cy - R, 2 * R, 2 * R);
  if (rim) { ctx.strokeStyle = rim; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.arc(cx, cy, R + 0.5, 0, Math.PI * 2); ctx.stroke(); }
}

export function drawSunDisc(ctx, x, y, r, { glow = 3.5, alpha = 1 } = {}) {
  const R = Math.max(r, 1.5);
  const g = ctx.createRadialGradient(x, y, R * 0.3, x, y, R * glow + 8);
  g.addColorStop(0, `rgba(255,220,140,${0.55 * alpha})`); g.addColorStop(0.3, `rgba(255,180,80,${0.18 * alpha})`); g.addColorStop(1, 'rgba(255,160,60,0)');
  ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, R * glow + 8, 0, Math.PI * 2); ctx.fill();
  const c = ctx.createRadialGradient(x - R * 0.25, y - R * 0.25, R * 0.1, x, y, R);
  c.addColorStop(0, '#fffbe8'); c.addColorStop(0.75, '#ffe08a'); c.addColorStop(1, '#ffbf55');
  ctx.fillStyle = c; ctx.beginPath(); ctx.arc(x, y, R, 0, Math.PI * 2); ctx.fill();
}
