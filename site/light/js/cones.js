// Chapter 8 — colour is in your head. Cone responses from the CIE 1931 observer via the
// Hunt–Pointer–Estevez matrix (each cone normalised to peak 1). One wavelength, or three lamps
// (630 / 532 / 450 nm, balanced like a screen so that all three at full make white).
import { cieX, cieY, cieZ, xyzToLin, xyzToLMS, WB, linToRGB, wavelengthRGB, colourName, css, clamp } from './optics.js';
import { fitCanvas, visibleLoop, bindRange, $ } from '../../kit/util.js';

const lmsAt = (l) => xyzToLMS([cieX(l), cieY(l), cieZ(l)]);
const PEAK = [0, 1, 2].map((k) => { let m = 0; for (let l = 380; l <= 720; l++) m = Math.max(m, lmsAt(l)[k]); return m; });
const cone = (l) => lmsAt(l).map((v, k) => Math.max(0, v / PEAK[k]));
const linAt = (l) => xyzToLin([cieX(l), cieY(l), cieZ(l)]).map((v, i) => v * WB[i]);
const LAMPS = [630, 532, 450];
// balance the lamps so (1,1,1) gives white (solve M·w = 1)
const M = LAMPS.map(linAt);
function solve3(A, b) {
  const d = (m) => m[0][0] * (m[1][1] * m[2][2] - m[1][2] * m[2][1]) - m[0][1] * (m[1][0] * m[2][2] - m[1][2] * m[2][0]) + m[0][2] * (m[1][0] * m[2][1] - m[1][1] * m[2][0]);
  const D = d(A);
  return [0, 1, 2].map((k) => d(A.map((row, i) => row.map((v, j) => (j === k ? b[i] : v)))) / D);
}
const WL = solve3([[M[0][0], M[1][0], M[2][0]], [M[0][1], M[1][1], M[2][1]], [M[0][2], M[1][2], M[2][2]]], [1, 1, 1]);
// chromaticity in cone space: (l, s) = (L, S) / (L + M + S)
const chrom = (c) => { const s = c[0] + c[1] + c[2] || 1; return [c[0] / s, c[2] / s]; };
// cone responses to the three lamps at full power (white), for scaling the bars
const LMSW = (() => { const t = [0, 0, 0]; LAMPS.forEach((l, i) => cone(l).forEach((v, k) => (t[k] += WL[i] * v))); return Math.max(...t); })();
// (400–650 nm: beyond that the CMF fit's tails make L/(L+M) turn back down, which real cones don't)
const LOCUS = []; for (let l = 400; l <= 650; l += 1) LOCUS.push([l, chrom(cone(l))]);

export function initCones() {
  const canvas = $('cones-canvas');
  let mode = 'one', lam = 580, lamp = [1, 0, 0.8];

  function state() {
    if (mode === 'one') return { lms: cone(lam), lin: linAt(lam).map((v) => v / Math.max(...linAt(lam).map(Math.abs), 1e-9)) };
    const lms = [0, 0, 0], lin = [0, 0, 0];
    LAMPS.forEach((l, i) => { const c = cone(l), q = linAt(l); for (let k = 0; k < 3; k++) { lms[k] += (lamp[i] * WL[i] * c[k]) / LMSW; lin[k] += lamp[i] * WL[i] * q[k]; } });
    return { lms, lin };
  }
  function update() {
    const s = state();
    const name = $('cone-name'), why = $('cone-why');
    if (mode === 'one') {
      const rgb = wavelengthRGB(lam);
      name.innerHTML = `<span class="swatch" style="background:${css(rgb)}"></span>${colourNameSpectral(lam)}`;
      const c = s.lms;
      why.textContent = `${lam} nm light. Your cones fire L ${pc(c[0])}, M ${pc(c[1])}, S ${pc(c[2])} — that ratio is all your brain ever gets.`;
      return;
    }
    const tot = lamp[0] + lamp[1] + lamp[2];
    if (tot < 0.02) { name.textContent = 'darkness'; why.textContent = 'Turn a lamp on.'; return; }
    const rgb = linToRGB(s.lin);
    const cn = colourName(s.lin, { dark: 0.0005 });
    name.innerHTML = `<span class="swatch" style="background:${css(rgb)}"></span>${cn}`;
    // nearest single wavelength in cone chromaticity
    const ch = chrom(s.lms);
    let best = LOCUS[0], bd = 1e9;
    for (const p of LOCUS) { const dd = Math.hypot(p[1][0] - ch[0], p[1][1] - ch[1]); if (dd < bd) { bd = dd; best = p; } }
    const on = LAMPS.filter((_, i) => lamp[i] > 0.02);
    if (bd < 0.012) {
      const fakes = !on.some((l) => Math.abs(l - best[0]) < 8);
      why.textContent = fakes ? `Looks exactly like pure ${best[0]} nm light, yet there is no ${best[0]} nm light here at all. Your cones can't tell the difference: this is how every screen works.` : `This is ${best[0]} nm light, and it looks like it.`;
    } else if (/magenta|pink|violet|purple/.test(cn) && lamp[0] > 0.05 && lamp[2] > 0.05) {
      why.textContent = 'No single wavelength looks like this. Long (L) and short (S) cones fire while M stays quiet, and nothing in the rainbow does that. Your brain invents a colour for it.';
    } else if (cn === 'white' || cn === 'grey' || /pale/.test(cn)) {
      why.textContent = 'All three cones firing in balance reads as white (or a pale tint). There is no "white" wavelength either: white is always a mixture.';
    } else {
      why.textContent = `Closest pure colour: about ${best[0]} nm, but paler. Mixtures can look like rainbow colours mixed with white.`;
    }
  }
  const pc = (v) => `${Math.round(v * 100)}%`;
  function colourNameSpectral(l) { return l < 430 ? 'violet' : l < 485 ? 'blue' : l < 500 ? 'cyan' : l < 565 ? 'green' : l < 585 ? 'yellow' : l < 620 ? 'orange' : 'red'; }

  bindRange($('cone-l'), (v) => { lam = v; $('cone-l-out').textContent = `${v} nm`; update(); });
  [['cone-r', 0], ['cone-g', 1], ['cone-b', 2]].forEach(([id, i]) => bindRange($(id), (v) => { lamp[i] = v; $(`${id}-out`).textContent = `${Math.round(v * 100)}%`; update(); }));
  document.querySelectorAll('#cone-mode button').forEach((b) => b.addEventListener('click', () => {
    mode = b.dataset.mode;
    document.querySelectorAll('#cone-mode button').forEach((x) => x.classList.toggle('on', x === b));
    $('cone-one').hidden = mode !== 'one'; $('cone-mix').hidden = mode !== 'mix';
    update();
  }));

  const CC = ['#ff7a6b', '#7dde7a', '#7aa8ff'];
  visibleLoop(canvas, () => {
    const { ctx, w, h } = fitCanvas(canvas);
    ctx.clearRect(0, 0, w, h);
    const m = w < 560;
    const gx0 = 34, gx1 = m ? w - 12 : w * 0.68, gy0 = 36, gy1 = h - (m ? 128 : 44);
    const X = (l) => gx0 + ((l - 400) / 300) * (gx1 - gx0), Y = (v) => gy1 - v * (gy1 - gy0);
    // spectrum strip
    for (let l = 400; l < 700; l += 2) { ctx.fillStyle = css(wavelengthRGB(l)); ctx.fillRect(X(l), gy1 + 4, X(l + 2) - X(l) + 0.5, 10); }
    // cone curves
    ['L', 'M', 'S'].forEach((nm, k) => {
      ctx.strokeStyle = CC[k]; ctx.lineWidth = 2; ctx.beginPath();
      for (let l = 400; l <= 700; l += 2) { const y = Y(cone(l)[k]); l === 400 ? ctx.moveTo(X(l), y) : ctx.lineTo(X(l), y); }
      ctx.stroke();
    });
    ctx.font = '11.5px ui-sans-serif, system-ui, sans-serif'; ctx.textAlign = 'left';
    ctx.fillStyle = 'rgba(237,240,247,0.8)'; ctx.fillText('How strongly each cone type responds', gx0 - 24, 18);
    [[565, 'L'], [535, 'M'], [445, 'S']].forEach(([l, nm], k) => { ctx.fillStyle = CC[k]; ctx.fillText(nm, X(l) + (k === 1 ? -14 : 4), Y(1) - 4); });
    ctx.fillStyle = 'rgba(174,182,204,0.7)'; ctx.font = '10.5px ui-sans-serif, system-ui, sans-serif';
    for (const l of [400, 500, 600, 700]) { ctx.textAlign = l === 400 ? 'left' : l === 700 ? 'right' : 'center'; ctx.fillText(`${l} nm`, X(l), gy1 + 28); }
    const s = state();
    if (mode === 'one') {
      ctx.strokeStyle = 'rgba(255,255,255,0.85)'; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.moveTo(X(lam), gy0 - 6); ctx.lineTo(X(lam), gy1 + 14); ctx.stroke();
      cone(lam).forEach((v, k) => { ctx.fillStyle = CC[k]; ctx.beginPath(); ctx.arc(X(lam), Y(v), 4.5, 0, 7); ctx.fill(); });
    } else {
      LAMPS.forEach((l, i) => {
        const c = wavelengthRGB(l);
        ctx.strokeStyle = `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},0.95)`; ctx.lineWidth = 3;
        ctx.beginPath(); ctx.moveTo(X(l), gy1); ctx.lineTo(X(l), gy1 - lamp[i] * (gy1 - gy0) * 0.9); ctx.stroke();
      });
    }
    // bars: the three numbers your brain receives
    const bx = m ? 40 : w * 0.74, bw = m ? (w - 80) / 3 : (w * 0.24) / 3, by1 = h - 30, bh = m ? 64 : h - 110;
    const mx = Math.max(1, ...s.lms);
    ['L', 'M', 'S'].forEach((nm, k) => {
      const v = s.lms[k] / mx;
      const x = bx + k * bw + bw * 0.18, ww = bw * 0.64;
      ctx.fillStyle = 'rgba(255,255,255,0.08)'; ctx.fillRect(x, by1 - bh, ww, bh);
      ctx.fillStyle = CC[k]; ctx.fillRect(x, by1 - bh * v, ww, bh * v);
      ctx.fillStyle = 'rgba(237,240,247,0.85)'; ctx.font = '12px ui-sans-serif, system-ui, sans-serif'; ctx.textAlign = 'center';
      ctx.fillText(nm, x + ww / 2, by1 + 15);
    });
    if (!m) { ctx.fillStyle = 'rgba(237,240,247,0.8)'; ctx.font = '11.5px ui-sans-serif, system-ui, sans-serif'; ctx.textAlign = 'left'; ctx.fillText('What your brain receives', bx + 4, by1 - bh - 10); }
  });
}
