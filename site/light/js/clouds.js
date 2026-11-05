// Chapter 4 — why clouds are white. Real Mie theory (water spheres, averaged over a ±30% size
// spread) for one particle size: left, the particle beside a 550 nm wave at true scale;
// right, how strongly it scatters each colour, and the colour of the scattered light.
import { LAMBDA, SUN, dropletScatter, wavelengthRGB, specToLin, linToRGB, colourName, css } from './optics.js';
import { fitCanvas, visibleLoop, bindRange, setRange, $ } from '../../kit/util.js';

const R0 = 0.0005, R1 = 20, SPAN = Math.log(R1 / R0);
const rOf = (v) => R0 * Math.exp(v * SPAN);
const vOf = (r) => Math.log(r / R0) / SPAN;
const fmtR = (r) => (r < 0.01 ? `${(r * 1000).toFixed(r < 0.002 ? 2 : 1)} nm` : r < 1 ? `${(r * 1000).toFixed(0)} nm` : `${r.toFixed(r < 10 ? 1 : 0)} µm`);
const kind = (r) => (r < 0.02 ? 'like an air molecule (well, bigger)' : r < 0.1 ? 'ultra-fine haze' : r < 0.6 ? 'smoke, fine haze' : r < 3 ? 'mist, sea-salt haze' : 'cloud droplet');

export function initClouds() {
  const canvas = $('clouds-canvas');
  let r = 0.02, sc = null, col = [1, 1, 1], t = 0;

  function compute() {
    const s = LAMBDA.map((l) => dropletScatter(r, l));
    const i550 = LAMBDA.indexOf(550);
    sc = s.map((v) => v / s[i550]);
    const spec = Float64Array.from(sc, (v, i) => v * SUN[i]);
    col = specToLin(spec);
    const ratio = s[LAMBDA.indexOf(450)] / s[LAMBDA.indexOf(650)];
    const d = (2 * r * 1000) / 550;
    $('clouds-x').textContent = d < 0.1 ? `${d.toFixed(d < 0.01 ? 3 : 2)} × a wave` : `${d < 10 ? d.toFixed(1) : Math.round(d)} × a wave`;
    $('clouds-ratio').textContent = `${ratio.toFixed(ratio < 10 ? 1 : 0)}×`;
    const M = Math.max(...col);
    $('clouds-look').innerHTML = `<span class="swatch" style="background:${css(linToRGB(col.map((v) => (v / M) * 0.85)))}"></span>${colourName(col.map((v) => (v / M) * 0.85))}`;
  }
  bindRange($('clouds-r'), (v) => { r = rOf(v); $('clouds-r-out').textContent = `${fmtR(r)} · ${kind(r)}`; compute(); });
  document.querySelectorAll('[data-cloud]').forEach((b) => b.addEventListener('click', () => setRange($('clouds-r'), vOf(parseFloat(b.dataset.cloud)))));

  visibleLoop(canvas, (dt) => {
    t += dt;
    const { ctx, w, h } = fitCanvas(canvas);
    ctx.clearRect(0, 0, w, h);
    const m = w < 560;
    // panel A: the particle and a light wave, to scale
    const A = m ? { x: 0, y: 0, w, h: h * 0.42 } : { x: 0, y: 0, w: w * 0.46, h };
    const B = m ? { x: 0, y: h * 0.42, w, h: h * 0.58 } : { x: w * 0.46, y: 0, w: w * 0.54, h };
    const dUm = 2 * r, lam = 0.55;
    const view = Math.max(lam * 3.2, dUm * 1.6);          // µm across the panel
    const px = (A.w - 28) / view;
    const cy = A.y + A.h * 0.52, cx = A.x + A.w / 2;
    // wave
    ctx.strokeStyle = 'rgba(184,255,120,0.85)'; ctx.lineWidth = 1.6;
    ctx.beginPath();
    const amp = Math.min(A.h * 0.18, Math.max(4, lam * px * 0.35));
    const kx = (2 * Math.PI) / (lam * px);
    const step = Math.max(0.5, Math.min(2, (lam * px) / 16));
    for (let x = A.x + 14; x <= A.x + A.w - 14; x += step) { const y = cy - Math.sin(kx * (x - A.x) - t * 3) * amp; x === A.x + 14 ? ctx.moveTo(x, y) : ctx.lineTo(x, y); }
    ctx.stroke();
    // particle
    const pr = Math.max(1.5, r * px);
    const g = ctx.createRadialGradient(cx - pr * 0.3, cy - pr * 0.3, pr * 0.1, cx, cy, pr);
    g.addColorStop(0, 'rgba(235,245,255,0.95)'); g.addColorStop(1, 'rgba(150,190,240,0.55)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(cx, cy, pr, 0, 7); ctx.fill();
    ctx.font = '11.5px ui-sans-serif, system-ui, sans-serif'; ctx.fillStyle = 'rgba(237,240,247,0.8)'; ctx.textAlign = 'left';
    ctx.fillText('To scale: the particle and a 550 nm light wave', A.x + 12, A.y + 18);
    ctx.fillStyle = 'rgba(174,182,204,0.75)';
    ctx.fillText(`panel width ${view < 1 ? (view * 1000).toFixed(0) + ' nm' : view.toFixed(view < 10 ? 1 : 0) + ' µm'}`, A.x + 12, A.y + A.h - 10);
    if (r * px < 1.5) { ctx.textAlign = 'center'; ctx.fillText('particle: a speck, far smaller than the wave', cx, cy + amp + 22); }

    // panel B: scattering vs colour
    const x0 = B.x + 40, x1 = B.x + B.w - 14, y0 = B.y + (m ? 36 : 54), y1 = B.y + B.h - 28;
    const X = (l) => x0 + ((l - 400) / 300) * (x1 - x0);
    if (sc) {
      const ref = (l) => Math.pow(550 / l, 4);
      const mx = Math.max(...sc.filter((_, i) => LAMBDA[i] >= 400 && LAMBDA[i] <= 700), ref(400)) * 1.05;
      const Y = (v) => y1 - (v / mx) * (y1 - y0);
      LAMBDA.forEach((l, i) => {
        if (l < 400 || l >= 700) return;
        ctx.fillStyle = css(wavelengthRGB(l + 5, 0.9), 0.85);
        const v = (sc[i] + sc[i + 1]) / 2;
        ctx.fillRect(X(l), Y(v), X(l + 10) - X(l) + 0.6, y1 - Y(v));
      });
      ctx.setLineDash([4, 4]); ctx.strokeStyle = 'rgba(142,197,255,0.8)'; ctx.lineWidth = 1.4;
      ctx.beginPath(); for (let l = 400; l <= 700; l += 10) l === 400 ? ctx.moveTo(X(l), Y(ref(l))) : ctx.lineTo(X(l), Y(ref(l))); ctx.stroke();
      ctx.setLineDash([]);
      ctx.strokeStyle = 'rgba(255,255,255,0.25)'; ctx.beginPath(); ctx.moveTo(x0, Y(1)); ctx.lineTo(x1, Y(1)); ctx.stroke();
      ctx.font = '11px ui-sans-serif, system-ui, sans-serif'; ctx.fillStyle = 'rgba(174,182,204,0.75)';
      for (const l of [400, 500, 600, 700]) { ctx.textAlign = l === 400 ? 'left' : l === 700 ? 'right' : 'center'; ctx.fillText(`${l} nm`, X(l), y1 + 15); }
      ctx.textAlign = 'left'; ctx.fillStyle = 'rgba(237,240,247,0.85)'; ctx.font = '11.5px ui-sans-serif, system-ui, sans-serif';
      ctx.fillText('How much each colour is scattered', x0 - 30, B.y + 18);
      ctx.fillStyle = 'rgba(142,197,255,0.9)'; ctx.fillText('- - tiny particles (1/λ⁴)', x0 - 30, B.y + 33);
      // the puff: what a cloud of these particles looks like, lit by sunlight
      const M = Math.max(...col);
      const c = linToRGB(col.map((v) => (v / M) * 0.9));
      const pxp = x1 - 34, pyp = B.y + (m ? 24 : 30);
      const pg = ctx.createRadialGradient(pxp, pyp, 2, pxp, pyp, 24);
      pg.addColorStop(0, css(c, 1)); pg.addColorStop(0.6, css(c, 0.8)); pg.addColorStop(1, css(c, 0));
      ctx.fillStyle = pg; ctx.beginPath(); ctx.arc(pxp, pyp, 24, 0, 7); ctx.fill();
      ctx.fillStyle = 'rgba(174,182,204,0.8)'; ctx.textAlign = 'right'; ctx.font = '10.5px ui-sans-serif, system-ui, sans-serif';
      ctx.fillText('scattered light', pxp - 28, pyp + 4);
    }
  });
}
