// A landscape under a computed sky: sky.js does the physics, this lays it out, picks the
// exposure, and draws the Sun, hills and stars. Shared by the hero, the sky and sunset chapters.
import { Sky, toneMap, toneRGB, lum, eyeExposure } from './sky.js';
import { gamma, DEG, clamp } from './optics.js';

export class SkyScene {
  constructor(opts = {}) {
    this.sky = new Sky();
    this.o = { horizon: 0.78, elTop: 60, sunX: 0.5, hills: true, stars: true, step: 6, coarse: 12, ...opts };
    this.sunEl = 30;
    this.air = {};
    this.job = 0; this.busy = false; this.pendingStep = 0;
    try {
      this.worker = new Worker(new URL('./sky-worker.js', import.meta.url), { type: 'module' });
      this.worker.onmessage = (ev) => this.receive(ev.data);
      this.worker.onerror = () => { this.worker = null; this.busy = false; };
    } catch (e) { this.worker = null; }
    this.off = document.createElement('canvas');
    this.buf = null; this.img = null; this.E = 20; this.dirty = true; this.fineAt = 0; this.q = 0;
    this.seed = opts.seed || 7;
  }
  setSun(e) { if (e !== this.sunEl) { this.sunEl = e; this.invalidate(); } }
  setAir(p) { this.air = { ...p }; this.sky.set(p); this.invalidate(); }
  invalidate() { this.dirty = true; this.q = 0; }
  // geometry for a canvas of w × h CSS px
  geom(w, h) {
    const yh = Math.round(h * this.o.horizon);
    const dpp = this.o.elTop / yh; // degrees per pixel (same both ways: no distortion)
    const az0 = -this.o.sunX * w * dpp;
    return { yh, dpp, az0, az1: az0 + w * dpp, w, h };
  }
  // compute the sky image (progressive: coarse while things change, fine once settled).
  // The physics runs in a worker when possible, so the page never stalls.
  update(w, h, now = performance.now()) {
    const G = this.geom(w, h);
    const key = `${w}x${h}`;
    if (key !== this.key) { this.key = key; this.invalidate(); }
    if (this.busy) return false;
    let step;
    if (this.dirty) { step = this.o.coarse; this.dirty = false; this.fineAt = now + 160; this.q = 1; }
    else if (this.q === 1 && now >= this.fineAt) { step = this.o.step; this.q = 2; }
    else return false;
    const rw = Math.max(8, Math.round(w / step)), rh = Math.max(6, Math.round(G.yh / step));
    const view = { azMin: G.az0, azMax: G.az1, elMin: 0, elMax: this.o.elTop, sunEl: this.sunEl };
    const sunEl = this.sunEl;
    if (this.worker) {
      this.busy = true;
      this.worker.postMessage({ id: ++this.job, air: this.air, w: rw, h: rh, view });
      this.jobSun = sunEl;
      return false;
    }
    this.finish(this.sky.renderLinear(rw, rh, view), rw, rh, sunEl);
    return true;
  }
  receive({ id, w, h, buf }) {
    this.busy = false;
    if (id !== this.job) return;
    this.finish(buf, w, h, this.jobSun);
  }
  // a finished sky: exposure, tone map, ground and horizon colours
  finish(buf, rw, rh, sunEl) {
    this.buf = buf;
    this.shownSun = sunEl;
    let s = 0;
    for (let i = 0; i < buf.length; i += 3) s += lum([buf[i], buf[i + 1], buf[i + 2]]);
    const skyAvg = s / (rw * rh);
    this.sun = this.sky.sunColour(sunEl);
    const sinE = Math.max(0, Math.sin(sunEl * DEG));
    this.G = lum(this.sun.rgb) * sinE + Math.PI * skyAvg * 0.6;
    this.E = this.o.exposure || eyeExposure(this.G);
    if (this.off.width !== rw || this.off.height !== rh) { this.off.width = rw; this.off.height = rh; this.img = null; }
    const octx = this.off.getContext('2d');
    if (!this.img) this.img = octx.createImageData(rw, rh);
    toneMap(buf, this.img, this.E);
    octx.putImageData(this.img, 0, 0);
    const row = (rh - 1) * rw * 3;
    let hr = 0, hg = 0, hb = 0;
    for (let x = 0; x < rw; x++) { hr += buf[row + x * 3]; hg += buf[row + x * 3 + 1]; hb += buf[row + x * 3 + 2]; }
    this.horizonLin = [hr / rw, hg / rw, hb / rw];
    let ar = 0, ag = 0, ab = 0;
    for (let i = 0; i < buf.length; i += 3) { ar += buf[i]; ag += buf[i + 1]; ab += buf[i + 2]; }
    const n = rw * rh;
    this.skyAvgLin = [ar / n, ag / n, ab / n];
    this.fresh = true;
  }
  // true once after each newly finished sky (for readouts)
  takeFresh() { const f = this.fresh; this.fresh = false; return f; }
  draw(ctx, w, h) {
    const G = this.geom(w, h);
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    if (this.off.width) ctx.drawImage(this.off, 0, 0, w, G.yh + 1);
    const e = this.shownSun ?? this.sunEl;
    // stars come out as the sky darkens
    if (this.o.stars) {
      const dark = clamp((Math.log10(1 / Math.max(this.G * this.E, 1e-9)) - 0.9) / 1.2, 0, 1) * clamp((-e - 3) / 5, 0, 1);
      if (dark > 0.01) {
        let s = this.seed * 9301;
        const r = () => ((s = (s * 16807) % 2147483647) / 2147483647);
        ctx.fillStyle = '#fff';
        for (let i = 0; i < 160; i++) {
          const x = r() * w, y = r() * G.yh * 0.97, m = r();
          ctx.globalAlpha = dark * (0.25 + 0.75 * m * m) * clamp((G.yh - y) / (G.yh * 0.25), 0.2, 1);
          ctx.fillRect(x, y, m > 0.9 ? 2 : 1.2, m > 0.9 ? 2 : 1.2);
        }
        ctx.globalAlpha = 1;
      }
    }
    // the Sun: true position and colour; its brightness is far beyond any screen
    const sx = this.o.sunX * w, sy = G.yh - e / G.dpp;
    if (e > -1 && this.sun) {
      const c = this.sun.rgb, M = Math.max(c[0], c[1], c[2], 1e-12);
      const hue = c.map((v) => gamma(clamp(v / M, 0, 1)) * 255);
      const bright = clamp(Math.log10(M * 1e4) / 4, 0.25, 1);
      const R = Math.max(4, 0.27 / G.dpp) * (w < 500 ? 1.4 : 1.2);
      const glow = ctx.createRadialGradient(sx, sy, R * 0.5, sx, sy, R * 9);
      glow.addColorStop(0, `rgba(${hue[0] | 0},${hue[1] | 0},${hue[2] | 0},${0.55 * bright})`);
      glow.addColorStop(1, `rgba(${hue[0] | 0},${hue[1] | 0},${hue[2] | 0},0)`);
      ctx.fillStyle = glow;
      ctx.beginPath(); ctx.arc(sx, sy, R * 9, 0, 7); ctx.fill();
      const wmix = clamp(bright * 1.1 - 0.15, 0, 0.85);
      ctx.fillStyle = `rgb(${(hue[0] * (1 - wmix) + 255 * wmix) | 0},${(hue[1] * (1 - wmix) + 255 * wmix) | 0},${(hue[2] * (1 - wmix) + 245 * wmix) | 0})`;
      ctx.beginPath(); ctx.arc(sx, sy, R, 0, 7); ctx.fill();
    }
    if (this.o.hills) this.drawGround(ctx, w, h, G);
    return { sx, sy, G };
  }
  drawGround(ctx, w, h, G) {
    if (!this.sun) return;
    const sinE = Math.max(0, Math.sin((this.shownSun ?? this.sunEl) * DEG));
    // ground lit by the direct Sun plus the sky; woods and fields reflect ~5% (more in green)
    const ALB = [0.04, 0.065, 0.03];
    const lit = [0, 1, 2].map((i) => (ALB[i] / Math.PI) * (this.sun.rgb[i] * sinE + Math.PI * this.skyAvgLin[i] * 0.6));
    const far = lit.map((v, i) => v * 0.6 + this.horizonLin[i] * 0.3); // distant hills fade into the air
    const mid = lit.map((v, i) => v * 0.8 + this.horizonLin[i] * 0.08);
    const near = lit.map((v) => v * 0.7);
    const col = (c) => { const t = toneRGB(c, this.E); return `rgb(${t[0] | 0},${t[1] | 0},${t[2] | 0})`; };
    const layer = (base, amp, freq, ph, fill) => {
      ctx.beginPath(); ctx.moveTo(0, h);
      for (let x = 0; x <= w + 8; x += 8) {
        const u = (x / w) * freq;
        const y = base - amp * (0.55 * Math.sin(u * 2.1 + ph) + 0.3 * Math.sin(u * 5.3 + ph * 2.7) + 0.15 * Math.sin(u * 11.7 + ph * 1.3) + 0.6);
        ctx.lineTo(x, y);
      }
      ctx.lineTo(w, h); ctx.closePath(); ctx.fillStyle = fill; ctx.fill();
    };
    const sc = Math.min(1, h / 700);
    ctx.fillStyle = col(far); ctx.fillRect(0, G.yh, w, h - G.yh);
    layer(G.yh + 2, 16 * sc, 3, 1.3, col(far));
    layer(G.yh + 14 * sc, 22 * sc, 2.2, 4.1, col(mid));
    layer(G.yh + 40 * sc, 30 * sc, 1.6, 2.2, col(near));
  }
}
