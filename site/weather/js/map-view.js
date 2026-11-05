// Draws a PressureField as a weather map: soft shading, isobars every 2 hPa, H/L badges,
// and air parcels with fading trails. Shared by chapters 2 and 3.
import { contours } from './map-sim.js';

export class MapView {
  constructor(canvas, field, { widthKm = 3000 } = {}) {
    Object.assign(this, { canvas, field, widthKm });
    this.bg = document.createElement('canvas');
    this.dirty = true;
  }
  // map metres ↔ CSS pixels; origin at the centre of the canvas
  layout(w, h) {
    if (w !== this.w || h !== this.h) { this.w = w; this.h = h; this.dirty = true; }
    this.mpp = (this.widthKm * 1000) / w; // metres per pixel
  }
  px(x, y) { return [this.w / 2 + x / this.mpp, this.h / 2 - y / this.mpp]; }
  m(px, py) { return [(px - this.w / 2) * this.mpp, (this.h / 2 - py) * this.mpp]; }

  renderBackground(dpr) {
    const { w, h, field } = this, c = this.bg;
    c.width = Math.round(w * dpr); c.height = Math.round(h * dpr);
    const ctx = c.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    // shading: a small image, smoothly upscaled (no seams between cells)
    const N = 64, M = Math.max(8, Math.round(N * h / w));
    const sc = document.createElement('canvas'); sc.width = N; sc.height = M;
    const sctx = sc.getContext('2d'), img = sctx.createImageData(N, M);
    for (let j = 0; j < M; j++) for (let i = 0; i < N; i++) {
      const [x, y] = this.m(((i + 0.5) / N) * w, ((j + 0.5) / M) * h);
      const d = field.p(x, y) - 1013, a = Math.min(0.42, Math.abs(d) / 40), o = (j * N + i) * 4;
      if (d > 0) { img.data[o] = 90; img.data[o + 1] = 160; img.data[o + 2] = 255; } else { img.data[o] = 255; img.data[o + 1] = 130; img.data[o + 2] = 80; }
      img.data[o + 3] = Math.round(a * 255);
    }
    sctx.putImageData(img, 0, 0);
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(sc, 0, 0, w, h);
    // isobars
    let lo = Infinity, hi = -Infinity;
    for (const cc of field.centers) { lo = Math.min(lo, 1013 + Math.min(0, cc.dp)); hi = Math.max(hi, 1013 + Math.max(0, cc.dp)); }
    const levels = [];
    for (let L = Math.ceil((lo - 1) / 2) * 2; L <= hi + 1; L += 2) if (L !== 1013) levels.push(L + 0.001);
    const gx = 90, gyN = Math.max(20, Math.round(90 * h / w));
    const lines = contours((u, v) => { const [x, y] = this.m(u * w, v * h); return field.p(x, y); }, gx, gyN, levels);
    ctx.lineWidth = 1.1;
    lines.forEach((segs, li) => {
      const major = Math.round(levels[li]) % 8 === 0;
      ctx.strokeStyle = major ? 'rgba(255,255,255,0.62)' : 'rgba(255,255,255,0.3)';
      ctx.beginPath();
      for (let s = 0; s < segs.length; s += 4) { ctx.moveTo(segs[s] * w, segs[s + 1] * h); ctx.lineTo(segs[s + 2] * w, segs[s + 3] * h); }
      ctx.stroke();
      if (major && segs.length) { // label once, on the segment nearest the top of the map
        let best = 0;
        for (let s = 0; s < segs.length; s += 4) if (segs[s + 1] < segs[best + 1] && segs[s] > 0.08 && segs[s] < 0.92) best = s;
        const [lx, ly] = [segs[best] * w, segs[best + 1] * h];
        if (ly > 14 && ly < h - 14) {
          ctx.font = '600 10px ui-sans-serif, system-ui, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
          ctx.fillStyle = 'rgba(8,17,31,0.75)'; ctx.fillRect(lx - 15, ly - 7, 30, 14);
          ctx.fillStyle = 'rgba(255,255,255,0.8)'; ctx.fillText(Math.round(levels[li]), lx, ly);
        }
      }
    });
    this.dirty = false;
  }

  drawBackground(ctx, dpr) {
    if (this.dirty) this.renderBackground(dpr);
    ctx.fillStyle = '#0d1a2e'; ctx.fillRect(0, 0, this.w, this.h);
    ctx.drawImage(this.bg, 0, 0, this.w, this.h);
  }

  drawCenters(ctx) {
    const small = this.w < 520;
    for (const c of this.field.centers) {
      const [x, y] = this.px(c.x, c.y), hi = c.dp > 0, r = small ? 15 : 18;
      ctx.fillStyle = 'rgba(8,17,31,0.7)'; ctx.beginPath(); ctx.arc(x, y, r, 0, 7); ctx.fill();
      ctx.strokeStyle = hi ? '#9ccfff' : '#ffa477'; ctx.lineWidth = 2.2; ctx.stroke();
      ctx.fillStyle = hi ? '#9ccfff' : '#ffa477';
      ctx.font = `700 ${small ? 15 : 18}px ui-sans-serif, system-ui, sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(hi ? 'H' : 'L', x, y + 1);
      ctx.font = `600 ${small ? 10 : 11}px ui-sans-serif, system-ui, sans-serif`; ctx.fillStyle = 'rgba(255,255,255,0.85)';
      ctx.fillText(`${Math.round(1013 + c.dp)} hPa`, x, y + r + 10);
    }
  }

  // parcels: {x, y, u, v, trail:[], alpha}
  drawParcels(ctx, parcels, colorFor) {
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    for (const P of parcels) {
      const t = P.trail, a = P.alpha ?? 1;
      if (t.length >= 4) {
        ctx.strokeStyle = colorFor(P, 0.5 * a); ctx.lineWidth = 1.6;
        ctx.beginPath();
        let [x, y] = this.px(t[0], t[1]); ctx.moveTo(x, y);
        for (let k = 2; k < t.length; k += 2) { [x, y] = this.px(t[k], t[k + 1]); ctx.lineTo(x, y); }
        ctx.stroke();
      }
      const [x, y] = this.px(P.x, P.y);
      ctx.fillStyle = colorFor(P, a); ctx.beginPath(); ctx.arc(x, y, 2.4, 0, 7); ctx.fill();
    }
  }

  scaleBar(ctx, km = 500) {
    const len = (km * 1000) / this.mpp, x = 12, y = this.h - 14;
    ctx.strokeStyle = 'rgba(255,255,255,0.8)'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(x, y - 4); ctx.lineTo(x, y); ctx.lineTo(x + len, y); ctx.lineTo(x + len, y - 4); ctx.stroke();
    ctx.font = '600 11px ui-sans-serif, system-ui, sans-serif'; ctx.fillStyle = 'rgba(255,255,255,0.85)'; ctx.textAlign = 'left'; ctx.textBaseline = 'bottom';
    ctx.fillText(`${km} km`, x + len + 6, y + 2);
  }
}

// speed → colour (calm blue → strong white-yellow)
export function speedColor(spd, a) {
  const t = Math.min(1, spd / 30);
  const r = Math.round(140 + 115 * t), g = Math.round(200 + 40 * t), b = Math.round(255 - 120 * t);
  return `rgba(${r},${g},${b},${a})`;
}
