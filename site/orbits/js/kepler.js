// Chapter 6 — Kepler's laws. Exact Kepler motion (solves Kepler's equation), equal-time slices,
// vis-viva speed, and a log–log period/distance chart with the real planets.
import { TAU, AU, keplerXY, keplerPeriodYears } from './astro.js';
import { makeStars, drawStars, drawSun, label, arrow } from './draw.js';
import { fitCanvas, visibleLoop, bindRange, setRange, $ } from '../../kit/util.js';

const GM_SUN = 1.32712440018e11; // km³/s²
const AMIN = 0.3, AMAX = 40;
const aFrom = (u) => AMIN * Math.pow(AMAX / AMIN, u);
const uFrom = (a) => Math.log(a / AMIN) / Math.log(AMAX / AMIN);
const PRESETS = { earth: [1, 0.0167], mercury: [0.387, 0.2056], mars: [1.524, 0.0934], halley: [17.83, 0.967] };
const CHART_PLANETS = [['Me', 0.387], ['V', 0.723], ['E', 1], ['Ma', 1.524], ['J', 5.203], ['S', 9.537], ['U', 19.19], ['N', 30.07]];
const NSLICE = 12, LAP_SECONDS = 9;

export function initKepler() {
  const canvas = $('kepler-canvas'), chart = $('kepler-chart');
  const stars = makeStars(160, 61);
  const S = { e: 0.6, a: 2.1, M: 0, name: '' };

  const fmtT = (y) => (y < 1 ? `${Math.round(y * 365.25)} days` : y < 10 ? `${y.toFixed(2)} years` : `${y.toFixed(y < 100 ? 1 : 0)} years`);
  function readouts() {
    const { r } = keplerXY(S.a, S.e, S.M);
    const v = Math.sqrt(GM_SUN * (2 / (r * AU) - 1 / (S.a * AU)));
    $('kepler-T').textContent = fmtT(keplerPeriodYears(S.a));
    $('kepler-v').textContent = `${v.toFixed(1)} km/s`;
    $('kepler-r').textContent = r < 3 ? `${(r * AU / 1e6).toFixed(0)} M km` : `${r.toFixed(1)} AU`;
    $('kepler-ratio').textContent = `${((1 + S.e) / (1 - S.e)).toFixed(S.e > 0.5 ? 0 : 2)}×`;
  }
  bindRange($('kepler-e'), (v) => { S.e = v; S.name = ''; $('kepler-e-out').textContent = v < 0.005 ? '0 · a circle' : v.toFixed(3); readouts(); });
  bindRange($('kepler-a'), (u) => {
    S.a = aFrom(u); S.name = '';
    $('kepler-a-out').textContent = `${S.a < 10 ? S.a.toFixed(2) : S.a.toFixed(1)} × Earth's`;
    readouts();
  });
  document.querySelectorAll('#kepler [data-orbit]').forEach((b) => b.addEventListener('click', () => {
    const [a, e] = PRESETS[b.dataset.orbit];
    setRange($('kepler-a'), uFrom(a)); setRange($('kepler-e'), e);
    S.name = b.textContent; S.M = 0;
  }));

  function frame(dt) {
    S.M = (S.M + (dt / LAP_SECONDS) * TAU) % TAU;
    draw(); drawChart(); readouts();
  }

  function draw() {
    const { ctx, w, h } = fitCanvas(canvas);
    ctx.fillStyle = '#0a0e1c'; ctx.fillRect(0, 0, w, h);
    drawStars(ctx, w, h, stars, 0.45);
    const { a, e } = S, b = a * Math.sqrt(1 - e * e);
    const k = Math.min((w * 0.86) / (2 * a), (h * 0.74) / (2 * b));
    const cx = w / 2 + a * e * k, cy = h * 0.52; // Sun (focus) position on screen
    const X = (x) => cx + x * k, Y = (y) => cy - y * k;
    // equal-time slices
    const cur = Math.floor(S.M / (TAU / NSLICE));
    for (let s = 0; s < NSLICE; s++) {
      ctx.beginPath(); ctx.moveTo(cx, cy);
      for (let j = 0; j <= 24; j++) {
        const p = keplerXY(a, e, (s + j / 24) * (TAU / NSLICE));
        ctx.lineTo(X(p.x), Y(p.y));
      }
      ctx.closePath();
      const on = s === cur;
      ctx.fillStyle = s % 2 ? `rgba(95,176,240,${on ? 0.42 : 0.16})` : `rgba(245,185,90,${on ? 0.42 : 0.16})`;
      ctx.fill();
    }
    // orbit outline + centre vs focus
    ctx.strokeStyle = 'rgba(237,240,247,0.5)'; ctx.lineWidth = 1.2;
    ctx.beginPath(); ctx.ellipse(X(-a * e), cy, a * k, b * k, 0, 0, TAU); ctx.stroke();
    if (e > 0.08) {
      ctx.fillStyle = 'rgba(237,240,247,0.5)'; ctx.beginPath(); ctx.arc(X(-a * e), cy, 2.5, 0, TAU); ctx.fill();
      label(ctx, 'centre', X(-a * e), cy + 12, { align: 'center', size: 10, color: 'rgba(174,182,204,0.6)' });
      ctx.strokeStyle = 'rgba(237,240,247,0.25)'; ctx.setLineDash([2, 4]);
      ctx.beginPath(); ctx.arc(X(-2 * a * e), cy, 2.5, 0, TAU); ctx.stroke(); ctx.setLineDash([]);
      label(ctx, 'empty focus', X(-2 * a * e), cy - 12, { align: 'center', size: 10, color: 'rgba(174,182,204,0.45)' });
    }
    drawSun(ctx, cx, cy, 7, 3);
    // planet + velocity arrow
    const p = keplerXY(a, e, S.M), p2 = keplerXY(a, e, S.M + 0.002);
    const px = X(p.x), py = Y(p.y);
    const vx = X(p2.x) - px, vy = Y(p2.y) - py, vl = Math.hypot(vx, vy) || 1;
    const vkm = Math.sqrt(GM_SUN * (2 / (p.r * AU) - 1 / (a * AU)));
    const vmax = Math.sqrt(GM_SUN * (2 / (a * (1 - e) * AU) - 1 / (a * AU)));
    const L = 14 + 46 * (vkm / vmax);
    arrow(ctx, px, py, px + (vx / vl) * L, py + (vy / vl) * L, '#9fd8a5', 2, 7);
    ctx.strokeStyle = 'rgba(255,255,255,0.35)'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(px, py); ctx.stroke();
    ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(px, py, 5, 0, TAU); ctx.fill();
    label(ctx, `Each slice = 1/12 of an orbit in time — and the same area.`, 12, 18, { size: 11, color: 'rgba(237,240,247,0.8)' });
    label(ctx, `→ speed`, 12, h - 14, { size: 10.5, color: '#9fd8a5' });
    label(ctx, `sped up: one lap in ${LAP_SECONDS} s${S.name ? ` · ${S.name}` : ''}`, w - 12, h - 14, { size: 10.5, align: 'right', color: 'rgba(174,182,204,0.65)' });
  }

  function drawChart() {
    const { ctx, w, h } = fitCanvas(chart);
    ctx.fillStyle = '#0a0e1c'; ctx.fillRect(0, 0, w, h);
    const x0 = 40, x1 = w - 12, y0 = 12, y1 = h - 26;
    const lx = (a) => Math.log10(a), LX0 = lx(0.2), LX1 = lx(50), LY0 = lx(0.05), LY1 = lx(400);
    const X = (a) => x0 + ((lx(a) - LX0) / (LX1 - LX0)) * (x1 - x0);
    const Y = (t) => y1 - ((lx(t) - LY0) / (LY1 - LY0)) * (y1 - y0);
    ctx.strokeStyle = 'rgba(170,185,230,0.1)'; ctx.lineWidth = 1;
    for (const t of [0.1, 1, 10, 100]) { ctx.beginPath(); ctx.moveTo(x0, Y(t)); ctx.lineTo(x1, Y(t)); ctx.stroke(); label(ctx, `${t}`, x0 - 5, Y(t), { align: 'right', size: 10, color: 'rgba(174,182,204,0.6)' }); }
    for (const a of [0.3, 1, 3, 10, 30]) label(ctx, `${a}`, X(a), h - 16, { align: 'center', size: 10, color: 'rgba(174,182,204,0.6)' });
    label(ctx, 'distance from the Sun (Earth = 1) →', x1, h - 5, { align: 'right', size: 9.5, color: 'rgba(174,182,204,0.55)' });
    label(ctx, 'years per orbit', x0 + 4, y0 + 2, { size: 9.5, color: 'rgba(174,182,204,0.55)' });
    ctx.strokeStyle = 'rgba(245,185,90,0.6)'; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(X(0.2), Y(Math.pow(0.2, 1.5))); ctx.lineTo(X(50), Y(Math.pow(50, 1.5))); ctx.stroke();
    label(ctx, 'T² = a³', X(12), Y(Math.pow(12, 1.5)) + 12, { size: 10.5, color: 'rgba(245,185,90,0.85)' });
    for (const [n, a] of CHART_PLANETS) {
      ctx.fillStyle = n === 'E' ? '#5fb0f0' : 'rgba(237,240,247,0.8)';
      ctx.beginPath(); ctx.arc(X(a), Y(Math.pow(a, 1.5)), 3, 0, TAU); ctx.fill();
      label(ctx, n, X(a) - 4, Y(Math.pow(a, 1.5)) - 9, { align: 'right', size: 9.5, color: 'rgba(237,240,247,0.7)' });
    }
    ctx.fillStyle = '#ff5a5a'; ctx.beginPath(); ctx.arc(X(S.a), Y(keplerPeriodYears(S.a)), 5, 0, TAU); ctx.fill();
  }

  readouts();
  visibleLoop(canvas, frame);
  window.__kepler = { S, draw, drawChart };
}
