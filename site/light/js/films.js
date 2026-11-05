// Chapter 7 — thin-film interference. Exact single-layer (Airy) reflectance per wavelength, lit by
// sunlight, seen against a dark background. Soap: water film (n 1.33) in air, draining under
// gravity. Oil: n 1.47 on wet road (water, n 1.33). Below: the two reflected waves for three
// colours, adding or cancelling.
import { LAMBDA, NL, filmReflect, reflToLin, linToRGB, wavelengthRGB, bandName, css, clamp } from './optics.js';
import { fitCanvas, visibleLoop, $ } from '../../kit/util.js';

const KINDS = { soap: { nf: 1.33, n2: 1, exp: 9 }, oil: { nf: 1.47, n2: 1.33, exp: 16 } };
const DMAX = 1600;
function lut(kind) {
  const k = KINDS[kind], out = new Uint8ClampedArray((DMAX + 1) * 3);
  for (let d = 0; d <= DMAX; d++) {
    const R = Float64Array.from(LAMBDA, (l) => filmReflect(d, l, k.nf, 1, k.n2));
    const c = linToRGB(reflToLin(R), k.exp);
    out[d * 3] = c[0]; out[d * 3 + 1] = c[1]; out[d * 3 + 2] = c[2];
  }
  return out;
}

export function initFilms() {
  const canvas = $('films-canvas');
  let kind = 'soap', T = 0, probe = null;
  const LUT = { soap: lut('soap') };
  const off = document.createElement('canvas');
  let geo = null;

  // thickness field (nm): soap drains (thin at the top, thickening downward, thinning with time);
  // oil spreads from a thick centre. Gentle swirls from a few moving sines.
  function thick(u, v, t) {
    const sw = Math.sin(u * 7 + t * 0.7 + Math.sin(v * 5 - t * 0.4) * 1.6) * 0.5 + Math.sin(v * 9 - u * 4 + t * 0.9) * 0.3;
    if (kind === 'soap') {
      const age = (t % 60) / 60;           // a film lives a minute, then pops and re-forms
      const topD = 520 * (1 - age) ** 1.6;
      return Math.max(0, topD + (1100 - topD) * Math.pow(v, 1.25) + sw * 45 * (0.4 + v));
    }
    const r = Math.hypot(u - 0.5, (v - 0.5) * 1.25);
    return Math.max(0, 1250 * Math.exp(-((r / 0.32) ** 2)) + 90 + sw * 70);
  }
  document.querySelectorAll('#film-kind button').forEach((b) => b.addEventListener('click', () => {
    kind = b.dataset.kind; if (!LUT[kind]) LUT[kind] = lut(kind);
    document.querySelectorAll('#film-kind button').forEach((x) => x.classList.toggle('on', x === b));
    probe = null;
  }));
  canvas.addEventListener('click', (ev) => {
    if (!geo) return;
    const r = canvas.getBoundingClientRect();
    const x = ev.clientX - r.left, y = ev.clientY - r.top;
    if (y > geo.fh) return;
    probe = { u: x / geo.w, v: y / geo.fh };
    document.querySelector('#films .aha').classList.add('lit');
  });

  function describe(d) {
    const k = KINDS[kind];
    const R = LAMBDA.map((l) => filmReflect(d, l, k.nf, 1, k.n2));
    const plus = new Set(), minus = new Set();
    for (let i = 1; i < NL - 1; i++) {
      if (LAMBDA[i] < 400 || LAMBDA[i] > 700) continue;
      if (R[i] >= R[i - 1] && R[i] >= R[i + 1]) plus.add(bandName(LAMBDA[i]));
      if (R[i] <= R[i - 1] && R[i] <= R[i + 1]) minus.add(bandName(LAMBDA[i]));
    }
    if (d < 60) return ['nothing', kind === 'soap' ? 'everything: the film looks black' : 'everything a little'];
    return [[...plus].join(', ') || '–', [...minus].join(', ') || '–'];
  }

  visibleLoop(canvas, (dt) => {
    T += dt;
    const { ctx, w, h } = fitCanvas(canvas);
    const fh = Math.round(h * 0.6);
    geo = { w, fh };
    const step = 3, W = Math.ceil(w / step), H = Math.ceil(fh / step);
    if (off.width !== W || off.height !== H) { off.width = W; off.height = H; }
    const o = off.getContext('2d'); const img = o.createImageData(W, H); const d = img.data; const L = LUT[kind];
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const u = x / W, v = y / H;
      const j = (y * W + x) * 4;
      if (kind === 'soap') {
        // a film held in a ring: outside the ring is dark
        const dx = (u - 0.5) * (W / H), dy = v - 0.5;
        if (dx * dx + dy * dy > 0.235) { d[j] = 11; d[j + 1] = 9; d[j + 2] = 18; d[j + 3] = 255; continue; }
      }
      const th = Math.min(DMAX, Math.round(thick(u, v, T)));
      d[j] = L[th * 3]; d[j + 1] = L[th * 3 + 1]; d[j + 2] = L[th * 3 + 2]; d[j + 3] = 255;
      if (kind === 'oil') { d[j] = Math.max(d[j], 14); d[j + 1] = Math.max(d[j + 1], 14); d[j + 2] = Math.max(d[j + 2], 17); }
    }
    o.putImageData(img, 0, 0);
    ctx.fillStyle = '#0b0912'; ctx.fillRect(0, 0, w, h);
    ctx.imageSmoothingEnabled = true; ctx.drawImage(off, 0, 0, w, fh);
    if (kind === 'soap') {
      ctx.strokeStyle = 'rgba(220,220,235,0.6)'; ctx.lineWidth = 6;
      ctx.beginPath(); ctx.arc(w / 2, fh / 2, Math.sqrt(0.235) * fh, 0, 7); ctx.stroke();
    }
    const pr = probe || { u: 0.5, v: kind === 'soap' ? 0.3 : 0.62 };
    const dnm = thick(pr.u, pr.v, T);
    const px = pr.u * w, py = pr.v * fh;
    ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(px, py, 7, 0, 7); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(px - 11, py); ctx.lineTo(px - 4, py); ctx.moveTo(px + 4, py); ctx.lineTo(px + 11, py); ctx.stroke();
    ctx.font = '11.5px ui-sans-serif, system-ui, sans-serif'; ctx.fillStyle = 'rgba(255,255,255,0.85)'; ctx.textAlign = 'left';
    const mob = w < 560;
    ctx.fillText(kind === 'soap' ? (mob ? 'Soap film · tap it' : 'A soap film draining (computed colours) · tap to measure') : (mob ? 'Oil on a wet road · tap it' : 'Oil on a wet road (computed colours) · tap to measure'), 10, 18);
    if (kind === 'soap' && !mob) { ctx.fillStyle = 'rgba(174,182,204,0.75)'; ctx.fillText('thinnest at the top', 10, 34); }
    const [plus, minus] = describe(dnm);
    $('films-d').textContent = `${Math.round(dnm)} nm`;
    $('films-plus').textContent = plus; $('films-minus').textContent = minus;

    // the two reflected waves for three colours
    const k = KINDS[kind];
    const r1 = (1 - k.nf) / (1 + k.nf), r2 = (k.nf - k.n2) / (k.nf + k.n2);
    const rows = [[650, 'red'], [530, 'green'], [450, 'blue']];
    const y0 = fh + 18, rh = (h - y0 - 8) / 3;
    rows.forEach(([l, name], i) => {
      const yc = y0 + rh * i + rh / 2;
      const c = wavelengthRGB(l), col = `rgb(${c[0] | 0},${c[1] | 0},${c[2] | 0})`;
      const delta = (4 * Math.PI * k.nf * dnm) / l;          // extra path of the back reflection
      const a1 = r1, a2 = (1 - r1 * r1) * r2;                    // amplitudes (sign = phase flip)
      const sum = Math.hypot(a1 + a2 * Math.cos(delta), a2 * Math.sin(delta));
      const frac = sum / (Math.abs(a1) + Math.abs(a2));
      const x0 = 112, x1 = w - 10, A = rh * 0.32, kx = (2 * Math.PI) / 70;
      const wave = (amp, ph, style, lw) => {
        ctx.strokeStyle = style; ctx.lineWidth = lw; ctx.beginPath();
        for (let x = x0; x <= x1; x += 2) { const y = yc - amp * Math.sin(kx * (x - x0) - T * 4 + ph); x === x0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y); }
        ctx.stroke();
      };
      const sc = A / (Math.abs(a1) + Math.abs(a2));
      wave(a1 * sc, 0, 'rgba(255,255,255,0.28)', 1);
      wave(a2 * sc, -delta, 'rgba(255,255,255,0.28)', 1);
      // the sum, as one wave of the combined amplitude
      const phs = Math.atan2(-a2 * Math.sin(delta), a1 + a2 * Math.cos(delta));
      wave(sum * sc * Math.sign(1), phs, col, 2.4);
      ctx.fillStyle = col; ctx.font = '12px ui-sans-serif, system-ui, sans-serif'; ctx.textAlign = 'left';
      ctx.fillText(name, 10, yc - 2);
      ctx.fillStyle = 'rgba(237,240,247,0.75)'; ctx.font = '11px ui-sans-serif, system-ui, sans-serif';
      ctx.fillText(frac > 0.75 ? 'adds up ↑' : frac < 0.3 ? 'cancels ✕' : 'partly', 10, yc + 13);
    });
    ctx.fillStyle = 'rgba(174,182,204,0.7)'; ctx.font = '10.5px ui-sans-serif, system-ui, sans-serif'; ctx.textAlign = 'right';
    ctx.fillText(w < 560 ? 'faint: the two reflections · bold: their sum' : 'faint: reflections off front and back · bold: what you see', w - 10, fh + 12);
  });
}
