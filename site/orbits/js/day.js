// Chapter 1 — solar vs sidereal day, in the shared viewer with a "what if" model.
// Spin rate vs the stars is fixed (23 h 56 m 4 s); the year length is a slider; tilt is left out (next chapter).
//   prograde:   1/T_sol = 1/T_sid − 1/Y      retrograde: 1/T_sol = 1/T_sid + 1/Y
import { SIDEREAL_DAY_H, YEAR, TAU, AU, R_SUN, daysSinceJ2000, fmtHM, fmtHMS } from './astro.js';
import { World, RADIUS, COLOR } from './world.js';
import { Viewer } from './viewer.js';
import { v3, mat, label, arrow } from './draw.js';
import { fitCanvas, bindRange, setRange, $ } from '../../kit/util.js';

const YMIN = 3, YMAX = YEAR;
const yearFromSlider = (u) => YMIN * Math.pow(YMAX / YMIN, u);
const TH0 = -Math.PI / 2 - 0.35; // start near the bottom of the orbit (as seen from above)

export function initDay() {
  const world = new World();
  const S = { Yh: YEAR * 24, sign: 1, d0: daysSinceJ2000(Date.now()) };
  const solarDay = () => 1 / (1 / SIDEREAL_DAY_H - S.sign / S.Yh);
  const hours = (d) => (d - S.d0) * 24;
  const theta = (h) => TH0 + (TAU * h) / S.Yh;
  const spin = (h) => TH0 + Math.PI + (S.sign * TAU * h) / SIDEREAL_DAY_H; // body lon 0 faces the Sun at h = 0
  const lastNoon = (h) => Math.floor(h / solarDay()) * solarDay();
  const earthPos = (h) => [Math.cos(theta(h)) * AU, Math.sin(theta(h)) * AU, 0];
  const model = {
    state(d) {
      const h = hours(d);
      return { d, bodies: {
        sun: { id: 'sun', pos: [0, 0, 0], r: R_SUN, color: COLOR.sun, name: 'Sun' },
        earth: { id: 'earth', pos: earthPos(h), r: RADIUS.earth, color: COLOR.earth, name: 'Earth', frame: mat.rotZ(spin(h)) },
      } };
    },
    path: () => Array.from({ length: 161 }, (_, k) => [Math.cos((k / 160) * TAU) * AU, Math.sin((k / 160) * TAU) * AU, 0]),
    site: (d, lat, lon, E) => World.prototype.site.call(world, d, lat, lon, E),
    pos: (id, d) => (id === 'earth' ? earthPos(hours(d)) : [0, 0, 0]),
  };
  const starDir = (h) => { const a = theta(lastNoon(h)) + Math.PI; return [Math.cos(a), Math.sin(a), 0]; }; // zenith at last noon

  // ---- overlays
  const rays = (a) => {
    const { ctx, project } = a, h = hours(a.d), dE = a.viewer.drawn.earth; if (!dE) return;
    const E = earthPos(h), pe = project(E); if (!pe) return;
    const dirScreen = (v) => { const q = project(v3.add(E, v3.mul(v, AU * 0.01))); const dx = q.x - pe.x, dy = q.y - pe.y, l = Math.hypot(dx, dy) || 1; return [dx / l, dy / l]; };
    const L = Math.min(a.w, a.h) * 0.16;
    // arc travelled since last noon
    ctx.strokeStyle = 'rgba(245,185,90,0.9)'; ctx.lineWidth = 3; ctx.beginPath();
    for (let k = 0; k <= 30; k++) { const p = project(earthPos(lastNoon(h) + (k / 30) * (h - lastNoon(h)))); if (p) k ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y); }
    ctx.stroke();
    const ray = (v, len, color, lw, dash) => { const [ux, uy] = dirScreen(v); if (dash) ctx.setLineDash([4, 5]); arrow(ctx, pe.x + ux * (dE.R + 3), pe.y + uy * (dE.R + 3), pe.x + ux * (dE.R + len), pe.y + uy * (dE.R + len), color, lw); ctx.setLineDash([]); return [ux, uy]; };
    const [sx, sy] = ray(starDir(h), L, 'rgba(232,236,255,0.85)', 1.4, true);
    label(ctx, '★ to a distant star', pe.x + sx * (dE.R + L * 0.7) - sy * 14, pe.y + sy * (dE.R + L * 0.7) + sx * 14, { align: -sy >= 0 ? 'left' : 'right', size: 11, color: 'rgba(232,236,255,0.9)' });
    ray(v3.norm(v3.mul(E, -1)), L * 0.45, 'rgba(255,207,110,0.9)', 1.6);
    const you = mat.apply(mat.rotZ(spin(h)), [1, 0, 0]);
    const [ux, uy] = dirScreen(you);
    arrow(ctx, pe.x + ux * dE.R, pe.y + uy * dE.R, pe.x + ux * (dE.R + L * 0.8), pe.y + uy * (dE.R + L * 0.8), '#ff6b6b', 2.2);
    ctx.fillStyle = '#ff5a5a'; ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(pe.x + ux * dE.R, pe.y + uy * dE.R, 5, 0, TAU); ctx.fill(); ctx.stroke();
    label(ctx, `${S.sign > 0 ? '' : 'Spinning backwards · '}hours since noon: ${fmtHM(h - lastNoon(h))}`, 12, 36, { size: 12, color: 'rgba(237,240,247,0.85)' });
    label(ctx, '● you   ↑ straight up', 12, a.h - 14, { size: 12, color: '#ff8b8b' });
  };
  const skyMarks = (a) => { // standing on the equator: the meridian, and the reference star
    const { ctx, projectDir, pose } = a, site = pose.site; if (!site) return;
    ctx.strokeStyle = 'rgba(237,240,247,0.25)'; ctx.setLineDash([4, 6]); ctx.beginPath(); let on = false;
    for (let k = -90; k <= 90; k += 3) { const t = k * Math.PI / 180; const p = projectDir(v3.add(v3.mul(site.up, Math.cos(t)), v3.mul(site.north, Math.sin(t)))); if (!p) { on = false; continue; } on ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y); on = true; }
    ctx.stroke(); ctx.setLineDash([]);
    const p = projectDir(starDir(0));
    if (p) { ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(p.x, p.y, 3.5, 0, TAU); ctx.fill(); label(ctx, '★ your star', p.x + 8, p.y - 8, { size: 11, color: '#fff' }); }
    label(ctx, 'dashed: straight overhead line (the meridian)', 12, 36, { size: 10.5, color: 'rgba(237,240,247,0.7)' });
  };

  const viewer = new Viewer($('day-canvas'), {
    model, d: S.d0,
    rates: [[0, 'Paused'], [1 / 24, '1 h/s'], [5 / 24, '5 h/s'], [1, '1 day/s']], scaleToggle: false,
    views: [
      { id: 'above', label: 'Above the North Pole', rate: 5 / 24, boost: { earth: 2500 }, floor: { sun: (a) => Math.min(a.w, a.h) * 0.05 }, labels: false,
        cam: { mode: 'orbit', target: 'sun', dist: 3.1 * AU, yaw: -90, pitch: 89.5, fov: 40 }, orbits: ['earth'], over: rays,
        note: () => 'Seen from above the North Pole; the tilt is left out until the next chapter.' },
      { id: 'ground', label: 'Standing on the equator', rate: 1, floor: { sun: (a) => Math.min(a.w, a.h) * 0.03 },
        cam: { mode: 'ground', place: { name: 'Equator', lat: 0, lon: 0 }, az: 180, alt: 70, fov: 120 }, over: skyMarks,
        note: () => 'The Sun and your star both cross the overhead line once a day — but not at the same time for long.' },
    ],
    onTick: () => drawTimeline(),
  });
  // the real orbit drawing uses world.path; give the custom model a circle instead
  viewer.model.path = model.path;

  function restart() { S.d0 = viewer.d; }
  bindRange($('day-year'), (u) => {
    S.Yh = yearFromSlider(u) * 24;
    const days = S.Yh / 24;
    $('day-year-out').textContent = days > 300 ? `${days.toFixed(2)} (real)` : days.toFixed(days < 10 ? 1 : 0);
    restart(); readouts();
  });
  $('day-real').addEventListener('click', () => { S.sign = 1; $('day-retro').classList.remove('on'); setRange($('day-year'), 1); });
  $('day-retro').addEventListener('click', () => { S.sign = -S.sign; $('day-retro').classList.toggle('on', S.sign < 0); restart(); readouts(); });

  function readouts() {
    const Ts = solarDay();
    $('day-sid').textContent = fmtHMS(SIDEREAL_DAY_H);
    $('day-sol').textContent = Math.abs(Ts - 24) < 0.01 ? fmtHMS(Ts) : fmtHM(Ts);
    const extraDeg = (360 * Ts) / S.Yh, extraMin = (Ts - SIDEREAL_DAY_H) * 60;
    $('day-extra').textContent = `${S.sign > 0 ? '+' : '−'}${extraDeg < 10 ? extraDeg.toFixed(2) : Math.round(extraDeg)}° (${S.sign > 0 ? '+' : '−'}${Math.abs(extraMin) < 60 ? Math.abs(extraMin).toFixed(1) + ' min' : fmtHM(Math.abs(extraMin) / 60)})`;
  }

  function drawTimeline() {
    const { ctx, w, h } = fitCanvas($('day-timeline'));
    ctx.fillStyle = '#0a0e1c'; ctx.fillRect(0, 0, w, h);
    const Ts = solarDay(), Tsid = SIDEREAL_DAY_H, span = Math.max(Ts, Tsid) * 1.08;
    const x0 = 16, x1 = w - 16, y = h * 0.47, X = (t) => x0 + (t / span) * (x1 - x0);
    ctx.strokeStyle = 'rgba(170,185,230,0.25)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(x0, y); ctx.lineTo(x1, y); ctx.stroke();
    for (let k = 0; k <= span; k += span > 60 ? 12 : 6) { ctx.fillStyle = 'rgba(170,185,230,0.4)'; ctx.fillRect(X(k) - 0.5, y - 4, 1, 8); label(ctx, `${k} h`, X(k), y + 15, { size: 10.5, align: 'center', color: 'rgba(174,182,204,0.6)' }); }
    const hh = hours(viewer.d), since = hh - lastNoon(hh);
    ctx.fillStyle = 'rgba(255,107,107,0.5)'; ctx.fillRect(x0, y - 2, X(since) - x0, 4);
    const tick = (t, c) => { ctx.fillStyle = c; ctx.fillRect(X(t) - 1, y - 12, 2, 24); };
    tick(Tsid, 'rgba(232,236,255,0.9)'); tick(Ts, '#ffcf6e');
    label(ctx, `★ facing the same star again after ${fmtHM(Tsid)}`, x0, 16, { size: 11.5, color: 'rgba(232,236,255,0.9)' });
    label(ctx, `☀ Sun overhead again after ${fmtHM(Ts)}`, x0, 33, { size: 11.5, color: '#ffcf6e' });
    if (Math.abs(Ts - Tsid) / span < 0.08) {
      const mid = (Ts + Tsid) / 2, half = Math.max(Math.abs(Ts - Tsid), 0.05) * 1.6;
      const bw = Math.min(260, w - 32), bx = w * 0.5 - bw / 2, by = h - 34, bh = 26;
      ctx.fillStyle = 'rgba(16,21,42,0.95)'; ctx.strokeStyle = 'rgba(245,185,90,0.4)'; ctx.beginPath(); ctx.roundRect(bx, by, bw, bh, 8); ctx.fill(); ctx.stroke();
      const MX = (t) => bx + 12 + ((t - (mid - half)) / (2 * half)) * (bw - 24);
      ctx.fillStyle = 'rgba(170,185,230,0.25)'; ctx.fillRect(bx + 12, by + 12, bw - 24, 2);
      ctx.fillStyle = 'rgba(232,236,255,0.95)'; ctx.fillRect(MX(Tsid) - 1, by + 5, 2, 16);
      ctx.fillStyle = '#ffcf6e'; ctx.fillRect(MX(Ts) - 1, by + 5, 2, 16);
      if (since > mid - half && since < mid + half) { ctx.fillStyle = '#ff6b6b'; ctx.beginPath(); ctx.arc(MX(since), by + 13, 4, 0, TAU); ctx.fill(); }
      label(ctx, `zoomed: ${Math.abs((Ts - Tsid) * 60).toFixed(1)} minutes apart`, bx + bw / 2, by - 7, { size: 11, align: 'center', color: 'rgba(245,185,90,0.9)' });
    }
  }
  readouts();
  window.__day = { viewer, S };
}
