// Chapter 1 — solar vs sidereal day.
// Spin rate vs the stars is fixed (23 h 56 m 4 s). The orbit period is a slider. The solar day follows:
//   prograde:   1/T_sol = 1/T_sid − 1/Y      retrograde: 1/T_sol = 1/T_sid + 1/Y
import { SIDEREAL_DAY_H, YEAR, TAU, fmtHM, fmtHMS } from './astro.js';
import { Camera, makeStars, drawStars, drawSun, drawGlobe, label, arrow } from './draw.js';
import { fitCanvas, visibleLoop, bindRange, setRange, $ } from '../../kit/util.js';

const YMIN = 3, YMAX = YEAR; // "days" here are 24 h units of time
const yearFromSlider = (u) => YMIN * Math.pow(YMAX / YMIN, u);
const sliderFromYear = (y) => Math.log(y / YMIN) / Math.log(YMAX / YMIN);

export function initDay() {
  const canvas = $('day-canvas'), tl = $('day-timeline');
  const cam = new Camera({ yaw: -90, pitch: 90 });
  const stars = makeStars(260, 11);
  const S = {
    Yh: YEAR * 24, sign: 1, t: 0, playing: true, rate: 5, // hours of sim per second
    lastNoon: 0, noonTheta: -1.25, // orbit angle at last noon
  };
  const solarDay = () => 1 / (1 / SIDEREAL_DAY_H - S.sign / S.Yh);
  const TH0 = -1.25; // start near the bottom of the orbit, where there's room for the arrows
  const theta = (t) => TH0 + (TAU * t) / S.Yh;                    // orbit angle
  const spin = (t) => (S.sign * TAU * t) / SIDEREAL_DAY_H;  // spin angle vs the stars

  function restart() { S.t = 0; S.lastNoon = 0; S.noonTheta = TH0; }

  bindRange($('day-year'), (u) => {
    S.Yh = yearFromSlider(u) * 24;
    const days = S.Yh / 24;
    $('day-year-out').textContent = days > 300 ? `${days.toFixed(2)} (real)` : days.toFixed(days < 10 ? 1 : 0);
    restart(); readouts();
  });
  $('day-play').addEventListener('click', () => { S.playing = !S.playing; $('day-play').textContent = S.playing ? 'Pause' : 'Play'; });
  $('day-real').addEventListener('click', () => { S.sign = 1; $('day-retro').classList.remove('on'); setRange($('day-year'), 1); });
  $('day-retro').addEventListener('click', () => { S.sign = -S.sign; $('day-retro').classList.toggle('on', S.sign < 0); restart(); readouts(); });

  function readouts() {
    const Ts = solarDay();
    $('day-sid').textContent = fmtHMS(SIDEREAL_DAY_H);
    $('day-sol').textContent = Math.abs(Ts - 24) < 0.01 ? fmtHMS(Ts) : fmtHM(Ts);
    const extraDeg = (360 * Ts) / S.Yh; // how far along the orbit we moved during one solar day
    const extraMin = (Ts - SIDEREAL_DAY_H) * 60;
    $('day-extra').textContent = `${S.sign > 0 ? '+' : '−'}${extraDeg < 10 ? extraDeg.toFixed(2) : Math.round(extraDeg)}° (${S.sign > 0 ? '+' : '−'}${Math.abs(extraMin) < 60 ? Math.abs(extraMin).toFixed(1) + ' min' : fmtHM(Math.abs(extraMin) / 60)})`;
  }

  function frame(dt) {
    if (S.playing) S.t += dt * S.rate;
    const Ts = solarDay();
    while (S.t - S.lastNoon >= Ts) { S.lastNoon += Ts; S.noonTheta = theta(S.lastNoon); }
    draw();
    drawTimeline();
  }

  function draw() {
    const { ctx, w, h } = fitCanvas(canvas);
    ctx.fillStyle = '#0a0e1c'; ctx.fillRect(0, 0, w, h);
    drawStars(ctx, w, h, stars, 0.7);
    const m = Math.min(w, h);
    const narrow = w < 500;
    const Ro = m * (narrow ? 0.32 : 0.33), Re = m * (narrow ? 0.12 : 0.085);
    cam.cx = w / 2; cam.cy = h / 2; cam.scale = Ro;
    // orbit
    ctx.strokeStyle = 'rgba(95,176,240,0.25)'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.arc(w / 2, h / 2, Ro, 0, TAU); ctx.stroke();
    drawSun(ctx, w / 2, h / 2, m * 0.05, 2.6);

    const th = theta(S.t);
    // arc travelled since last noon
    ctx.strokeStyle = 'rgba(245,185,90,0.9)'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(w / 2, h / 2, Ro, -S.noonTheta, -th, true); ctx.stroke();

    // ghost Earth at last noon
    const gx = w / 2 + Math.cos(S.noonTheta) * Ro, gy = h / 2 - Math.sin(S.noonTheta) * Ro;
    const thNow = theta(S.t);
    const sep = Math.hypot(gx - (w / 2 + Math.cos(thNow) * Ro), gy - (h / 2 - Math.sin(thNow) * Ro));
    if (sep > Re * 1.2) {
      ctx.fillStyle = 'rgba(95,176,240,0.12)'; ctx.strokeStyle = 'rgba(95,176,240,0.35)';
      ctx.beginPath(); ctx.arc(gx, gy, Re, 0, TAU); ctx.fill(); ctx.stroke();
      if (sep > Re * 2.2) label(ctx, 'last noon', gx, gy + Re + 12, { align: 'center', size: 11, color: 'rgba(174,182,204,0.8)' });
    }

    const ex = w / 2 + Math.cos(th) * Ro, ey = h / 2 - Math.sin(th) * Ro;
    const sunDir = [-Math.cos(th), -Math.sin(th), 0];
    // person: on the equator, facing the Sun at t = 0
    const personAng = Math.PI + TH0 + spin(S.t);
    const starAng = Math.PI + S.noonTheta; // the zenith direction at last noon = "that same distant star"
    const L = Re * (narrow ? 1.9 : 2.4);
    // star direction (fixed in space) and sun direction — drawn from the surface outward
    const ray = (ang, len, color, lw, dash) => {
      const c = Math.cos(ang), sn = Math.sin(ang);
      if (dash) ctx.setLineDash([4, 5]);
      arrow(ctx, ex + c * (Re + 3), ey - sn * (Re + 3), ex + c * (Re + len), ey - sn * (Re + len), color, lw);
      ctx.setLineDash([]);
    };
    ray(starAng, L, 'rgba(232,236,255,0.8)', 1.4, true);
    {
      const c = Math.cos(starAng), sn = Math.sin(starAng);
      const mx = ex + c * (Re + L * 0.75), my = ey - sn * (Re + L * 0.75);
      const px = sn, py = c; // screen-space perpendicular
      const side = px >= 0 ? 1 : -1;
      label(ctx, '★ to a distant star', mx + px * 12 * side * side, my + py * 12, { align: px >= 0 ? 'left' : 'right', size: 11, color: 'rgba(232,236,255,0.9)' });
    }
    ray(Math.atan2(sunDir[1], sunDir[0]), L * 0.5, 'rgba(255,207,110,0.9)', 1.6, false);

    drawGlobe(ctx, ex, ey, Re, { B: cam.V, sun: cam.toView(sunDir), spin: spin(S.t), tiltDeg: 0, grid: false, res: 1.4 });
    // the person and their "straight up"
    const px = ex + Math.cos(personAng) * Re, py = ey - Math.sin(personAng) * Re;
    arrow(ctx, px, py, ex + Math.cos(personAng) * (Re + L * 0.8), ey - Math.sin(personAng) * (Re + L * 0.8), '#ff6b6b', 2.2);
    ctx.fillStyle = '#ff5a5a'; ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.arc(px, py, 5, 0, TAU); ctx.fill(); ctx.stroke();

    const since = S.t - S.lastNoon;
    label(ctx, `${S.sign > 0 ? '' : 'Spinning backwards · '}hours since noon: ${fmtHM(since)}`, 14, 20, { size: 12.5, color: 'rgba(237,240,247,0.85)' });
    label(ctx, '● you   ↑ straight up', 14, h - 18, { size: 12, color: '#ff8b8b' });
  }

  function drawTimeline() {
    const { ctx, w, h } = fitCanvas(tl);
    ctx.fillStyle = '#0a0e1c'; ctx.fillRect(0, 0, w, h);
    const Ts = solarDay(), Tsid = SIDEREAL_DAY_H;
    const span = Math.max(Ts, Tsid) * 1.08;
    const x0 = 16, x1 = w - 16, y = h * 0.47;
    const X = (t) => x0 + (t / span) * (x1 - x0);
    ctx.strokeStyle = 'rgba(170,185,230,0.25)'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(x0, y); ctx.lineTo(x1, y); ctx.stroke();
    for (let k = 0; k <= span; k += span > 60 ? 12 : 6) {
      ctx.fillStyle = 'rgba(170,185,230,0.4)'; ctx.fillRect(X(k) - 0.5, y - 4, 1, 8);
      label(ctx, `${k} h`, X(k), y + 15, { size: 10.5, align: 'center', color: 'rgba(174,182,204,0.6)' });
    }
    const since = S.t - S.lastNoon;
    ctx.fillStyle = 'rgba(255,107,107,0.5)'; ctx.fillRect(x0, y - 2, X(since) - x0, 4);
    const tick = (t, color) => { ctx.fillStyle = color; ctx.fillRect(X(t) - 1, y - 12, 2, 24); };
    const close = Math.abs(Ts - Tsid) / span < 0.08;
    tick(Tsid, 'rgba(232,236,255,0.9)');
    tick(Ts, '#ffcf6e');
    label(ctx, `★ facing the same star again after ${fmtHM(Tsid)}`, x0, 16, { size: 11.5, color: 'rgba(232,236,255,0.9)' });
    label(ctx, `☀ Sun overhead again after ${fmtHM(Ts)}`, x0, 33, { size: 11.5, color: '#ffcf6e' });
    if (close) {
      // magnifier: the minutes that matter
      const mid = (Ts + Tsid) / 2, half = Math.max(Math.abs(Ts - Tsid), 0.05) * 1.6;
      const bw = Math.min(260, w - 32), bx = w * 0.5 - bw / 2, by = h - 34, bh = 26;
      ctx.fillStyle = 'rgba(16,21,42,0.95)'; ctx.strokeStyle = 'rgba(245,185,90,0.4)';
      ctx.beginPath(); ctx.roundRect(bx, by, bw, bh, 8); ctx.fill(); ctx.stroke();
      const MX = (t) => bx + 12 + ((t - (mid - half)) / (2 * half)) * (bw - 24);
      ctx.fillStyle = 'rgba(170,185,230,0.25)'; ctx.fillRect(bx + 12, by + 12, bw - 24, 2);
      ctx.fillStyle = 'rgba(232,236,255,0.95)'; ctx.fillRect(MX(Tsid) - 1, by + 5, 2, 16);
      ctx.fillStyle = '#ffcf6e'; ctx.fillRect(MX(Ts) - 1, by + 5, 2, 16);
      if (since > mid - half && since < mid + half) { ctx.fillStyle = '#ff6b6b'; ctx.beginPath(); ctx.arc(MX(since), by + 13, 4, 0, TAU); ctx.fill(); }
      label(ctx, `zoomed: ${Math.abs((Ts - Tsid) * 60).toFixed(1)} minutes apart`, bx + bw / 2, by - 7, { size: 11, align: 'center', color: 'rgba(245,185,90,0.9)' });
    }
  }

  readouts();
  visibleLoop(canvas, frame);
  window.__day = { S, solarDay, draw: () => { draw(); drawTimeline(); } };
}
