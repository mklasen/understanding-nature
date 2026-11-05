// Chapter 1 — Newton's prism. White light → flint-glass prism (real Snell refraction per
// wavelength) → spectrum on a card where you block bands → lens → recombined spot.
import { LAMBDA, NL, SUN, nFlint, refract2, wavelengthRGB, specToLin, linToRGB, colourName, css, DEG } from './optics.js';
import { fitCanvas, visibleLoop, $ } from '../../kit/util.js';

const BANDS = [];
for (let l = 400; l < 700; l += 30) BANDS.push([l, l + 30]);
const NAMES = ['violet', 'violet-blue', 'blue', 'blue', 'cyan', 'green', 'green', 'yellow', 'orange', 'red'];
const bandOf = (l) => Math.max(0, Math.min(BANDS.length - 1, Math.floor((l - 400) / 30)));
const PRESETS = { all: [1, 1, 1, 1, 1, 1, 1, 1, 1, 1], noblue: [0, 0, 0, 0, 1, 1, 1, 1, 1, 1], nogreen: [1, 1, 1, 1, 0, 0, 0, 1, 1, 1], red: [0, 0, 0, 0, 0, 0, 0, 0, 1, 1] };

export function initSpectrum() {
  const canvas = $('prism-canvas');
  const mask = PRESETS.all.slice();
  let layout = null, t = 0;

  // Trace one wavelength through a 60° prism, in maths coordinates (y up), unit side length.
  // Apex (0, √3/2), base corners (∓½, 0). The beam is aimed at the middle of the left face at the
  // angle of minimum deviation for 550 nm (inside, the 550 nm ray runs parallel to the base).
  const SQ = Math.sqrt(3) / 2;
  const nL = [-SQ, 0.5], nR = [SQ, 0.5];             // outward normals of the left / right faces
  const P1 = [-0.25, SQ / 2];                        // middle of the left face
  const i550 = Math.asin(nFlint(550) * 0.5);
  const D0 = [Math.cos(i550 - Math.PI / 6), Math.sin(i550 - Math.PI / 6)];
  function trace(l) {
    const n = nFlint(l);
    const d1 = refract2(D0, nL, 1 / n);
    // meet the right face: points p with (p − (½,0))·nR = 0
    const t = ((0.5 - P1[0]) * nR[0] + (0 - P1[1]) * nR[1]) / (d1[0] * nR[0] + d1[1] * nR[1]);
    const p2 = [P1[0] + d1[0] * t, P1[1] + d1[1] * t];
    const d2 = refract2(d1, [-nR[0], -nR[1]], n);
    return { p1: P1, p2, d2 };
  }

  function build(w, h) {
    const m = w < 560;
    const s = Math.min(w * (m ? 0.2 : 0.15), h * 0.36);    // side length on screen
    const rho = 22 * DEG;                                 // the prism is turned so the colours leave nearly level
    const R = (p) => [p[0] * Math.cos(rho) - p[1] * Math.sin(rho), p[0] * Math.sin(rho) + p[1] * Math.cos(rho)];
    const cx = w * (m ? 0.26 : 0.25), cy = h * 0.5;
    const S = (p) => { const q = R(p); return [cx + q[0] * s, cy - (q[1] - 0.4) * s]; };
    const A = S([0, SQ]), B = S([-0.5, 0]), C = S([0.5, 0]);
    const src = S([P1[0] - D0[0] * 3, P1[1] - D0[1] * 3]);
    const raw = LAMBDA.map((l) => ({ l, t: trace(l) }));
    const ang = (d) => { const q = R(d); return Math.atan2(-q[1], q[0]); }; // on-screen angle
    const th = raw.map((x) => ang(x.t.d2));
    const thMid = ang(trace(550).d2);
    const spread = (ang(trace(400).d2) - ang(trace(700).d2)) / DEG;
    const cardX = w * (m ? 0.6 : 0.56);
    const p2m = S(trace(550).p2);
    const dx = cardX - p2m[0];
    const span = (X) => dx * (Math.tan(thMid + (th[1] - thMid) * X) - Math.tan(thMid + (th[th.length - 2] - thMid) * X));
    let lo = 1, hi = 40; // solve for the exaggeration that makes the spectrum fill ~55% of the height
    for (let k = 0; k < 40; k++) { const mid = (lo + hi) / 2; if (Math.abs(span(mid)) < h * 0.55) lo = mid; else hi = mid; }
    const X = lo;
    const rays = raw.map((x) => ({ l: x.l, r: { p1: S(x.t.p1), p2: S(x.t.p2) } }));
    const onCard = rays.map((x, i) => {
      const a = thMid + (th[i] - thMid) * X;
      return [cardX, x.r.p2[1] + Math.tan(a) * (cardX - x.r.p2[0])];
    });
    // centre the spectrum vertically (the geometry is the same under a vertical shift)
    const ys = onCard.map((p) => p[1]);
    const dy = h * 0.47 - (Math.min(...ys) + Math.max(...ys)) / 2;
    const mv = (p) => { p[1] += dy; };
    [A, B, C, src].forEach(mv);
    rays.forEach((x) => { mv(x.r.p1); mv(x.r.p2); });
    onCard.forEach(mv);
    const lensX = w * (m ? 0.8 : 0.78), spot = [w * (m ? 0.93 : 0.94), h * 0.47];
    layout = { A, B, C, src, rays, onCard, cardX, lensX, spot, spread, X, m, cy: h * 0.47, top: Math.min(...ys) + dy, bot: Math.max(...ys) + dy };
  }

  function mixed() {
    const sp = new Float64Array(NL);
    for (let i = 0; i < NL; i++) sp[i] = SUN[i] * mask[bandOf(LAMBDA[i])];
    return specToLin(sp);
  }
  function update() {
    const lin = mixed();
    const rgb = linToRGB(lin);
    const n = mask.every(Boolean) ? 'white' : mask.every((v) => !v) ? 'nothing' : colourName(lin);
    $('prism-mix').innerHTML = `<span class="swatch" style="background:${css(rgb)}"></span>${n}`;
    const kept = [...new Set(BANDS.map((_, i) => (mask[i] ? NAMES[i] : null)).filter(Boolean))];
    $('prism-kept').textContent = mask.every(Boolean) ? 'all of them' : kept.length ? kept.join(', ') : 'none';
    document.querySelectorAll('[data-prism]').forEach((b) => b.classList.toggle('on', PRESETS[b.dataset.prism].every((v, i) => v === mask[i])));
  }

  document.querySelectorAll('[data-prism]').forEach((b) => b.addEventListener('click', () => { PRESETS[b.dataset.prism].forEach((v, i) => (mask[i] = v)); update(); }));
  canvas.addEventListener('click', (ev) => {
    if (!layout) return;
    const r = canvas.getBoundingClientRect();
    const x = ev.clientX - r.left, y = ev.clientY - r.top;
    if (Math.abs(x - layout.cardX) > 44 || y < layout.top - 20 || y > layout.bot + 20) return;
    // nearest wavelength on the card → its band
    let best = 0, bd = 1e9;
    layout.onCard.forEach((p, i) => { if (LAMBDA[i] >= 400 && LAMBDA[i] <= 700 && Math.abs(p[1] - y) < bd) { bd = Math.abs(p[1] - y); best = i; } });
    const b = bandOf(LAMBDA[best]);
    mask[b] = mask[b] ? 0 : 1;
    update();
    document.querySelector('#spectrum .aha').classList.add('lit');
  });
  update();

  let lastKey = '';
  visibleLoop(canvas, (dt) => {
    t += dt;
    const { ctx, w, h } = fitCanvas(canvas);
    const key = `${w}x${h}`;
    if (key !== lastKey) { build(w, h); lastKey = key; }
    const L = layout;
    ctx.clearRect(0, 0, w, h);
    // incoming white beam
    const r550 = L.rays[16].r;
    ctx.lineCap = 'round';
    ctx.strokeStyle = 'rgba(255,250,240,0.95)'; ctx.lineWidth = 5;
    ctx.beginPath(); ctx.moveTo(L.src[0], L.src[1]); ctx.lineTo(r550.p1[0], r550.p1[1]); ctx.stroke();
    ctx.globalCompositeOperation = 'lighter';
    // through the prism (real, nearly overlapping) and out to the card (fan drawn wider)
    L.rays.forEach((x, i) => {
      if (x.l < 400 || x.l > 700) return;
      const c = wavelengthRGB(x.l);
      const on = mask[bandOf(x.l)];
      ctx.strokeStyle = `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},0.5)`;
      ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(x.r.p1[0], x.r.p1[1]); ctx.lineTo(x.r.p2[0], x.r.p2[1]); ctx.lineTo(L.onCard[i][0], L.onCard[i][1]); ctx.stroke();
      if (on) {
        ctx.strokeStyle = `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},0.42)`;
        ctx.lineWidth = 2.5;
        const ly = L.cy + (L.onCard[i][1] - L.cy) * 1.3;
        ctx.beginPath(); ctx.moveTo(L.onCard[i][0], L.onCard[i][1]); ctx.lineTo(L.lensX, ly); ctx.lineTo(L.spot[0], L.spot[1]); ctx.stroke();
      }
    });
    ctx.globalCompositeOperation = 'source-over';
    // prism
    ctx.beginPath(); ctx.moveTo(...L.A); ctx.lineTo(...L.B); ctx.lineTo(...L.C); ctx.closePath();
    ctx.fillStyle = 'rgba(180,200,255,0.10)'; ctx.fill();
    ctx.strokeStyle = 'rgba(210,225,255,0.6)'; ctx.lineWidth = 1.5; ctx.stroke();
    // the card with the spectrum, blocked bands crossed out
    const cw = L.m ? 14 : 18;
    L.onCard.forEach((p, i) => {
      if (LAMBDA[i] < 400 || LAMBDA[i] > 700) return;
      const q = L.onCard[i + 1] || p;
      const on = mask[bandOf(LAMBDA[i])];
      const c = wavelengthRGB(LAMBDA[i]);
      ctx.fillStyle = on ? css(c) : 'rgba(30,26,44,1)';
      ctx.fillRect(L.cardX - cw / 2, p[1], cw, Math.max(1, q[1] - p[1]) + 0.5);
    });
    ctx.strokeStyle = 'rgba(255,255,255,0.35)'; ctx.lineWidth = 1;
    ctx.strokeRect(L.cardX - cw / 2 - 2, L.top - 6, cw + 4, L.bot - L.top + 12);
    BANDS.forEach(([a, b], k) => {
      if (mask[k]) return;
      const ia = (a - 390) / 10, ib = Math.min(NL - 1, (b - 390) / 10);
      const y = (L.onCard[ia][1] + L.onCard[ib][1]) / 2;
      ctx.strokeStyle = 'rgba(255,255,255,0.55)'; ctx.lineWidth = 1.4;
      ctx.beginPath(); ctx.moveTo(L.cardX - 5, y - 5); ctx.lineTo(L.cardX + 5, y + 5); ctx.moveTo(L.cardX + 5, y - 5); ctx.lineTo(L.cardX - 5, y + 5); ctx.stroke();
    });
    // lens
    ctx.strokeStyle = 'rgba(210,225,255,0.55)'; ctx.fillStyle = 'rgba(180,200,255,0.08)'; ctx.lineWidth = 1.5;
    const lh = (L.bot - L.top) * 0.65 + 12;
    ctx.beginPath(); ctx.ellipse(L.lensX, L.cy, 9, lh, 0, 0, 7); ctx.fill(); ctx.stroke();
    // recombined spot
    const rgb = linToRGB(mixed());
    const pulse = 1 + 0.04 * Math.sin(t * 2);
    const g = ctx.createRadialGradient(L.spot[0], L.spot[1], 2, L.spot[0], L.spot[1], 26 * pulse);
    g.addColorStop(0, css(rgb, 1)); g.addColorStop(0.45, css(rgb, 0.85)); g.addColorStop(1, css(rgb, 0));
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(L.spot[0], L.spot[1], 26 * pulse, 0, 7); ctx.fill();
    // labels
    ctx.fillStyle = 'rgba(237,240,247,0.75)'; ctx.font = `${L.m ? 11 : 12}px ui-sans-serif, system-ui, sans-serif`;
    ctx.textAlign = 'center';
    ctx.fillText('white light', (L.src[0] + r550.p1[0]) / 2 + 20, Math.min(h - 10, (L.src[1] + r550.p1[1]) / 2 + 22));
    ctx.fillText('glass prism', L.A[0], L.B[1] + 20);
    ctx.fillText('tap to block', L.cardX, L.bot + 26);
    ctx.fillText('lens', L.lensX, L.cy + (L.bot - L.top) * 0.65 + 30);
    ctx.fillText('put back together', Math.min(L.spot[0], w - 52), L.spot[1] + 44);
    ctx.textAlign = 'left';
    ctx.fillStyle = 'rgba(174,182,204,0.7)'; ctx.font = '11px ui-sans-serif, system-ui, sans-serif';
    ctx.fillText(`fan drawn ×${Math.round(L.X)} wider than real`, 10, h - 10);
    $('prism-spread').textContent = `${Math.abs(L.spread).toFixed(1)}°`;
  });
}
