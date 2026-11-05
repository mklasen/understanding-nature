// Chapter 6 — why the sea is blue. Measured pure-water absorption (Pope & Fry 1997) plus optional
// plankton (Bricaud-style chlorophyll absorption, Morel-style particle scattering). Light at depth
// z: E(z) = E₀·e^(−Kd·z). Colour seen from above: a two-flow shallow-water model,
// R = R∞(1 − e^(−2Kd·z)) + A_bed·e^(−2Kd·z), with R∞ ≈ 0.33·b_b/(a + b_b).
import { LAMBDA, NL, SUN, aWater, bWater, reflToLin, linToRGB, specToLin, css, clamp } from './optics.js';
import { fitCanvas, visibleLoop, bindRange, $ } from '../../kit/util.js';

const G = (l, m, s) => Math.exp(-0.5 * ((l - m) / s) ** 2);
const BEDS = {
  sand: (l) => 0.3 + 0.15 * ((l - 400) / 300),
  rock: () => 0.05,
  weed: (l) => 0.03 + 0.06 * G(l, 555, 30) + (l > 690 ? 0.1 : 0),
};
// depth profile: a beach shelving to a reef edge, then a drop-off into deep water
const depthAt = (u) => (u < 0.04 ? 0 : u < 0.62 ? 12 * ((u - 0.04) / 0.58) ** 1.6 : u < 0.78 ? 12 + 50 * ((u - 0.62) / 0.16) ** 2 : 1e4);
const ZMAX = 60;

export function initSea() {
  const canvas = $('sea-canvas');
  let chl = 0.05, bed = 'sand', diver = { u: 0.5, z: 8 };
  let K = null, Rinf = null, strip = null;

  function optics() {
    K = new Float64Array(NL); Rinf = new Float64Array(NL);
    for (let i = 0; i < NL; i++) {
      const l = LAMBDA[i];
      const aph = 0.06 * Math.pow(chl, 0.65) * (0.85 * G(l, 440, 45) + 0.4 * G(l, 675, 14) + 0.16);
      const acd = 0.35 * 0.06 * Math.pow(chl, 0.65) * Math.exp(-0.014 * (l - 440));
      const a = aWater(l) + aph + acd;
      const bb = 0.5 * bWater(l) + 0.0035 * Math.pow(chl, 0.62) * (550 / l);
      K[i] = 1.16 * (a + bb);
      Rinf[i] = (0.33 * bb) / (a + bb);
    }
    strip = null;
    readout();
  }
  const left = (l, z) => Math.exp(-K[LAMBDA.indexOf(l)] * z);
  const pct = (x) => (x >= 0.1 ? `${Math.round(x * 100)}%` : x >= 0.001 ? `${(x * 100).toFixed(1)}%` : '< 0.1%');
  function readout() {
    if (!K) return;
    $('sea-d').textContent = `${diver.z.toFixed(diver.z < 10 ? 1 : 0)} m`;
    $('sea-red').textContent = pct(left(650, diver.z));
    $('sea-blue').textContent = pct(left(450, diver.z));
  }
  // colour of the sea seen from above, over water z deep
  function above(z) {
    const A = BEDS[bed];
    const R = new Float64Array(NL);
    for (let i = 0; i < NL; i++) {
      const e = z > 1e3 ? 0 : Math.exp(-2 * K[i] * z);
      // + 2% of a blue sky reflected off the surface
      const sky = 0.02 * 0.25 * Math.pow(550 / LAMBDA[i], 4);
      R[i] = Rinf[i] * (1 - e) + A(LAMBDA[i]) * e + sky;
    }
    return linToRGB(reflToLin(R), 2.1);
  }
  // colour of daylight at depth z, shown at its own brightness (log-compressed)
  function lightAt(z) {
    const s = Float64Array.from(SUN, (v, i) => v * Math.exp(-K[i] * z));
    const c = specToLin(s);
    const Y = 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
    const br = clamp(0.45 + Math.log10(Math.max(Y, 1e-6)) * 0.22, 0.03, 0.45);
    return linToRGB(c.map((v) => (v / Math.max(Y, 1e-9)) * br * 0.6));
  }

  bindRange($('sea-c'), (v) => {
    chl = 0.02 * Math.pow(500, v);
    $('sea-c-out').textContent = chl < 0.1 ? 'crystal clear (open ocean)' : chl < 0.5 ? 'a little' : chl < 2 ? 'coastal, greenish' : 'a plankton bloom';
    optics();
  });
  document.querySelectorAll('#sea-bed button').forEach((b) => b.addEventListener('click', () => {
    bed = b.dataset.bed; strip = null;
    document.querySelectorAll('#sea-bed button').forEach((x) => x.classList.toggle('on', x === b));
  }));

  let geo = null;
  canvas.addEventListener('click', (ev) => {
    if (!geo) return;
    const r = canvas.getBoundingClientRect();
    const x = ev.clientX - r.left, y = ev.clientY - r.top;
    const u = clamp(x / geo.w, 0.06, 0.98);
    const z = clamp(geo.zOf(y), 0.3, Math.min(ZMAX, depthAt(u) - 0.3));
    if (depthAt(u) < 0.6) return;
    diver = { u, z };
    readout();
    document.querySelector('#sea .aha').classList.add('lit');
  });

  visibleLoop(canvas, () => {
    const { ctx, w, h } = fitCanvas(canvas);
    if (!K) return;
    const top = Math.round(h * 0.2), y0 = top + 26, H = h - y0 - 22;
    const yOf = (z) => y0 + Math.sqrt(Math.min(z, ZMAX) / ZMAX) * H;
    const zOf = (y) => ZMAX * ((clamp(y, y0, y0 + H) - y0) / H) ** 2;
    geo = { w, zOf };
    ctx.fillStyle = '#0b0912'; ctx.fillRect(0, 0, w, h);
    // seen from above
    if (!strip || strip.w !== w) {
      strip = { w, cols: [] };
      for (let x = 0; x < w; x += 4) strip.cols.push(above(depthAt(x / w)));
    }
    strip.cols.forEach((c, i) => { ctx.fillStyle = css(c); ctx.fillRect(i * 4, 0, 4.5, top); });
    ctx.fillStyle = css([226, 205, 160]); ctx.fillRect(0, 0, w * 0.04, top);
    ctx.font = '11.5px ui-sans-serif, system-ui, sans-serif'; ctx.textAlign = 'left';
    ctx.fillStyle = 'rgba(10,10,20,0.6)'; ctx.fillRect(8, 6, 170, 18);
    ctx.fillStyle = 'rgba(255,255,255,0.92)'; ctx.fillText('Seen from above (computed)', 13, 19);
    // cross-section: light at each depth
    const bands = 48;
    for (let k = 0; k < bands; k++) {
      const za = ZMAX * (k / bands) ** 2, zb = ZMAX * ((k + 1) / bands) ** 2;
      ctx.fillStyle = css(lightAt((za + zb) / 2));
      ctx.fillRect(0, yOf(za), w, yOf(zb) - yOf(za) + 1);
    }
    ctx.fillStyle = 'rgba(200,230,255,0.5)'; ctx.fillRect(0, y0 - 1, w, 1.5);
    // the seabed: a thin lit surface over dark ground
    const bedLine = () => { ctx.beginPath(); ctx.moveTo(0, y0 - 6); for (let x = 0; x <= w; x += 4) { const z = depthAt(x / w); ctx.lineTo(x, z > 1e3 ? h + 10 : yOf(z)); } };
    bedLine(); ctx.lineTo(w, h + 10); ctx.lineTo(0, h + 10); ctx.closePath();
    ctx.fillStyle = '#17120e'; ctx.fill();
    const bedTint = bed === 'sand' ? [1.0, 0.9, 0.7] : bed === 'rock' ? [0.22, 0.21, 0.21] : [0.35, 0.65, 0.3];
    const bg = ctx.createLinearGradient(0, y0, 0, y0 + H);
    for (const z of [0, 2, 5, 10, 20, 40, 60]) {
      const c = lightAt(z);
      bg.addColorStop(Math.sqrt(z / ZMAX), `rgb(${Math.min(255, c[0] * bedTint[0] * 1.9) | 0},${Math.min(255, c[1] * bedTint[1] * 1.9) | 0},${Math.min(255, c[2] * bedTint[2] * 1.9) | 0})`);
    }
    bedLine(); ctx.strokeStyle = bg; ctx.lineWidth = 9; ctx.stroke();
    ctx.fillStyle = css([226, 205, 160]); ctx.fillRect(0, top, w * 0.04, y0 - top);
    ctx.fillStyle = '#0b0912'; ctx.fillRect(0, top, w, 2);
    // depth ticks
    ctx.fillStyle = 'rgba(255,255,255,0.7)'; ctx.font = '10.5px ui-sans-serif, system-ui, sans-serif'; ctx.textAlign = 'right';
    for (const z of [1, 5, 10, 20, 40, 60]) { const y = yOf(z); ctx.fillRect(w - 6, y, 6, 1); ctx.fillText(`${z} m`, w - 9, y + 4); }
    ctx.textAlign = 'left'; ctx.fillStyle = 'rgba(255,255,255,0.75)';
    ctx.fillText(w < 560 ? 'Cross-section · depth squeezed · colour = light left' : 'Cross-section · depth not to scale (squeezed) · water coloured by the light left at each depth', 8, h - 7);
    ctx.textAlign = 'center';
    const lx = w < 560 ? w * 0.8 : w * 0.88;
    ctx.fillText('deep water:', lx, y0 + H * 0.45); ctx.fillText('nothing comes', lx, y0 + H * 0.45 + 14); ctx.fillText('back from the bottom', lx, y0 + H * 0.45 + 28);
    // the diver with a red wetsuit
    const dx = diver.u * w, dy = yOf(diver.z);
    const suit = Float64Array.from(LAMBDA, (l) => 0.04 + 0.6 * clamp((l - 590) / 40, 0, 1));
    const lit = Float64Array.from(suit, (v, i) => v * Math.exp(-K[i] * diver.z));
    const sc = linToRGB(reflToLin(lit), 1.6 / Math.max(0.03, Math.exp(-K[LAMBDA.indexOf(500)] * diver.z)) ** 0.85);
    ctx.fillStyle = css(sc); ctx.strokeStyle = 'rgba(255,255,255,0.8)'; ctx.lineWidth = 1.2;
    ctx.beginPath(); ctx.ellipse(dx, dy, 15, 6, -0.2, 0, 7); ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.arc(dx + 16, dy - 3, 4.5, 0, 7); ctx.fill(); ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,0.9)';
    ctx.fillText(`red wetsuit at ${diver.z.toFixed(diver.z < 10 ? 1 : 0)} m`, clamp(dx, 70, w - 70), dy - 14);
  });
  optics();
}
