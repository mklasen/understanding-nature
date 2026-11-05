// Chapter 4 — why eclipses are rare, in the shared world. The Moon's real orbit (lunar theory in world.js) with an
// adjustable tilt; eclipse test at each syzygy from the Moon's ecliptic latitude β:
//   solar (partial or better, somewhere on Earth): |β| < 1.5°   lunar (partial or total, umbral): |β| < 1.0°
import { DEG, TAU, SYNODIC_MONTH, NEW_MOON_EPOCH, daysSinceJ2000, dateFromJ2000, fmtDate, sunFromEarth, moonNode } from './astro.js';
import { World, moonGeo } from './world.js';
import { Viewer } from './viewer.js';
import { v3, label } from './draw.js';
import { fitCanvas, bindRange, setRange, $ } from '../../kit/util.js';

const SOLAR_LIMIT = 1.5 * DEG, LUNAR_LIMIT = 1.0 * DEG;

export function initEclipses() {
  const world = new World({ bodies: ['sun', 'earth', 'moon'] });
  const S = { events: [], winFrom: 0, flash: null, baseRate: 21 };
  let acc = 1;
  const minWH = (a) => Math.min(a.w, a.h);
  const wrap = (a) => { a = (a + Math.PI) % TAU; if (a < 0) a += TAU; return a - Math.PI; };

  // ---- eclipse bookkeeping (each mean syzygy refined to the true elongation crossing)
  const elong = (t) => wrap(moonGeo(t).lam - sunFromEarth(t).lambda);
  function syzygy(tGuess, full) {
    let t = tGuess;
    for (let i = 0; i < 4; i++) { const e = wrap(elong(t) - (full ? Math.PI : 0)); t -= e / (TAU / SYNODIC_MONTH); }
    return t;
  }
  function syzygies(from, to) {
    const out = [];
    for (let k = Math.floor((from - NEW_MOON_EPOCH) / SYNODIC_MONTH); ; k++) {
      const tn = NEW_MOON_EPOCH + k * SYNODIC_MONTH;
      if (tn - SYNODIC_MONTH > to) break;
      for (const full of [false, true]) {
        const t = syzygy(tn + (full ? SYNODIC_MONTH / 2 : 0), full);
        if (t < from || t > to) continue;
        const b = moonGeo(t, world.moonIncl).beta;
        out.push({ t, full, b, ecl: Math.abs(b) < (full ? LUNAR_LIMIT : SOLAR_LIMIT) });
      }
    }
    return out;
  }
  function rates() {
    const yrs = 60, d0 = daysSinceJ2000(Date.UTC(2000, 0, 1));
    const ev = syzygies(d0, d0 + yrs * 365.25);
    $('eclipse-solar').textContent = (ev.filter((e) => e.ecl && !e.full).length / yrs).toFixed(1);
    $('eclipse-lunar').textContent = (ev.filter((e) => e.ecl && e.full).length / yrs).toFixed(1);
  }
  function events(d) { S.winFrom = d - 200; S.events = syzygies(S.winFrom, S.winFrom + 900); }

  // ---- overlays
  const nodesAndPlane = (a) => {
    const { ctx, st, project } = a, E = st.bodies.earth, M = st.bodies.moon;
    const R = 4.6e5;
    ctx.beginPath();
    for (let k = 0; k <= 96; k++) { const t = (k / 96) * TAU; const p = project(v3.add(E.pos, [R * Math.cos(t), R * Math.sin(t), 0])); if (p) k ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y); }
    ctx.fillStyle = 'rgba(95,176,240,0.08)'; ctx.fill(); ctx.strokeStyle = 'rgba(95,176,240,0.3)'; ctx.lineWidth = 1; ctx.stroke();
    const O = moonNode(a.d) * DEG, n = [Math.cos(O), Math.sin(O), 0];
    const n1 = project(v3.add(E.pos, v3.mul(n, 3.9e5))), n2 = project(v3.add(E.pos, v3.mul(n, -3.9e5)));
    if (n1 && n2) {
      ctx.setLineDash([5, 5]); ctx.strokeStyle = 'rgba(245,185,90,0.65)'; ctx.lineWidth = 1.2;
      ctx.beginPath(); ctx.moveTo(n1.x, n1.y); ctx.lineTo(n2.x, n2.y); ctx.stroke(); ctx.setLineDash([]);
      for (const q of [n1, n2]) { ctx.fillStyle = '#f5b95a'; ctx.beginPath(); ctx.arc(q.x, q.y, 3.5, 0, TAU); ctx.fill(); label(ctx, 'node', q.x + 7, q.y - 8, { size: 10.5, color: 'rgba(245,185,90,0.9)' }); }
    }
    const pm = project(M.pos), foot = project([M.pos[0], M.pos[1], E.pos[2]]);
    if (pm && foot) { ctx.setLineDash([2, 3]); ctx.strokeStyle = 'rgba(201,212,255,0.6)'; ctx.beginPath(); ctx.moveTo(pm.x, pm.y); ctx.lineTo(foot.x, foot.y); ctx.stroke(); ctx.setLineDash([]); }
    const lp = project(v3.add(E.pos, [R * Math.cos(2.4), R * Math.sin(2.4), 0]));
    if (lp) label(ctx, "Earth's orbital plane", lp.x, lp.y + 12, { align: 'center', size: 10.5, color: 'rgba(95,176,240,0.75)' });
  };
  const fromSunMarks = (a) => {
    const { ctx, st, project } = a, E = st.bodies.earth, M = st.bodies.moon;
    const sun = v3.norm(v3.mul(E.pos, -1)), side = v3.norm(v3.cross([0, 0, 1], sun));
    const p1 = project(v3.add(E.pos, v3.mul(side, 2e5))), p2 = project(v3.add(E.pos, v3.mul(side, -2e5)));
    if (p1 && p2) { ctx.strokeStyle = 'rgba(95,176,240,0.35)'; ctx.setLineDash([4, 6]); ctx.beginPath(); ctx.moveTo(p1.x, p1.y); ctx.lineTo(p2.x, p2.y); ctx.stroke(); ctx.setLineDash([]); label(ctx, "Earth's orbital plane", 12, (p1.y + p2.y) / 2 - 8, { size: 10.5, color: 'rgba(95,176,240,0.75)' }); }
    const behind = project(v3.add(E.pos, v3.mul(sun, -3.844e5)));
    if (behind) { // Earth's umbra where the Moon crosses it (≈ 0.72 Earth widths)
      ctx.strokeStyle = 'rgba(255,90,70,0.55)'; ctx.setLineDash([3, 3]); ctx.beginPath(); ctx.arc(behind.x, behind.y, 6371 * 0.72 * behind.s, 0, TAU); ctx.stroke(); ctx.setLineDash([]);
    }
    const pm = project(M.pos), dm = a.viewer.drawn.moon;
    if (pm && dm) {
      const b = moonGeo(a.d, world.moonIncl).beta / DEG;
      const near = v3.dot(v3.sub(M.pos, E.pos), sun) > 0;
      label(ctx, `Moon ${Math.abs(b) < 0.05 ? 'in line' : `${Math.abs(b).toFixed(1)}° ${b > 0 ? 'above' : 'below'}`} · ${near ? 'in front of Earth' : 'behind Earth'}`, pm.x, pm.y + (b > 0 ? -dm.R - 12 : dm.R + 14), { align: 'center', size: 11, color: '#dfe5ff' });
    }
  };
  const flash = (a) => {
    if (!S.flash || performance.now() > S.flash.until) return;
    const { ctx, w } = a, txt = S.flash.text;
    ctx.font = '600 13px ui-sans-serif, -apple-system, "Segoe UI", Inter, Roboto, sans-serif';
    const tw = Math.min(w - 20, ctx.measureText(txt).width + 24);
    ctx.fillStyle = S.flash.full ? 'rgba(160,40,30,0.88)' : 'rgba(180,120,20,0.92)';
    ctx.beginPath(); ctx.roundRect(w / 2 - tw / 2, 30, tw, 28, 14); ctx.fill();
    label(ctx, txt, w / 2, 44, { align: 'center', size: 12.5, weight: 600, color: '#fff' });
  };

  const viewer = new Viewer($('eclipse-canvas'), {
    model: world, d: daysSinceJ2000(Date.now()),
    rates: [[0, 'Paused'], [1, '1 day/s'], [7, '1 week/s'], [21, '3 weeks/s']], scaleToggle: false,
    views: [
      { id: 'fromsun', label: "From the Sun's direction", rate: 1,
        cam: { mode: 'orbit', target: 'earth', dist: 1.2e6, yaw: 0, pitch: 0, fov: 7, sunLocked: true },
        under: fromSunMarks, top: flash, indicate: ['moon'],
        note: () => "A narrow telescope view along the sunlight, sizes true. Red ring: Earth's shadow where the Moon crosses it." },
      { id: 'tilted', label: 'The tilted orbit', rate: 21, orbits: ['moon'], indicate: ['sun'],
        floor: { earth: (a) => minWH(a) * 0.04, moon: (a) => minWH(a) * 0.02 },
        cam: { mode: 'orbit', target: 'earth', dist: 1.35e6, yaw: -60, pitch: 14, fov: 40 }, under: nodesAndPlane, top: flash,
        note: () => "The Moon's tilt is drawn to scale. Drag to look along the plane." },
    ],
    onTick: (dt, v) => {
      if (v.d > S.winFrom + 600 || v.d < S.winFrom) events(v.d);
      const near = S.events.find((e) => e.ecl && Math.abs(e.t - v.d) < 2.5);
      if (near) {
        S.flash = { text: near.full ? "Lunar eclipse — the Moon enters Earth's shadow" : "Solar eclipse — the Moon's shadow touches Earth", full: near.full, until: performance.now() + 1500 };
        if (v.rate > 1.5) { S.baseRate = v.rate; v.rate = 1.2; }
      } else if (v.rate === 1.2) v.rate = S.baseRate;
      if ((acc += dt) > 0.3) { acc = 0; drawTimeline(); next(); }
    },
  });

  function next() {
    const n = S.events.find((e) => e.ecl && e.t > viewer.d + 2.5);
    $('eclipse-next').textContent = n ? `${n.full ? 'Lunar' : 'Solar'}, ${fmtDate(dateFromJ2000(n.t))}` : '—';
  }

  function drawTimeline() {
    const { ctx, w, h } = fitCanvas($('eclipse-timeline'));
    ctx.fillStyle = '#0a0e1c'; ctx.fillRect(0, 0, w, h);
    const span = 540, t0 = viewer.d - 150, x0 = 12, x1 = w - 12;
    const X = (t) => x0 + ((t - t0) / span) * (x1 - x0);
    ctx.fillStyle = 'rgba(245,185,90,0.10)';
    for (let t = t0; t < t0 + span; t += 2) {
      if (Math.abs(Math.sin(sunFromEarth(t).lambda - moonNode(t) * DEG)) < Math.sin(17 * DEG)) ctx.fillRect(X(t), 18, X(t + 2) - X(t) + 0.5, h - 44);
    }
    label(ctx, 'shaded: eclipse seasons (Sun near a node)', x0, 10, { size: 10.5, color: 'rgba(245,185,90,0.8)' });
    const yN = h * 0.36, yF = h * 0.62;
    label(ctx, 'new', x0, yN - 12, { size: 9.5, color: 'rgba(174,182,204,0.6)' });
    label(ctx, 'full', x0, yF + 13, { size: 9.5, color: 'rgba(174,182,204,0.6)' });
    for (const e of S.events) {
      if (e.t < t0 || e.t > t0 + span) continue;
      const x = X(e.t), y = e.full ? yF : yN;
      if (e.ecl) {
        ctx.fillStyle = e.full ? '#d9483b' : '#ffcf6e'; ctx.beginPath(); ctx.arc(x, y, 7, 0, TAU); ctx.fill();
        if (!e.full) { ctx.fillStyle = '#111'; ctx.beginPath(); ctx.arc(x + 1.5, y, 5.5, 0, TAU); ctx.fill(); }
      } else {
        ctx.fillStyle = e.full ? 'rgba(236,235,228,0.85)' : 'rgba(60,64,80,1)'; ctx.strokeStyle = 'rgba(236,235,228,0.5)'; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.arc(x, y, 3.5, 0, TAU); ctx.fill(); if (!e.full) ctx.stroke();
      }
    }
    for (let t = Math.ceil(t0); t < t0 + span; t++) {
      const dt = dateFromJ2000(t); if (dt.getUTCDate() !== 1) continue;
      const mo = dt.getUTCMonth();
      ctx.fillStyle = 'rgba(170,185,230,0.25)'; ctx.fillRect(X(t), h - 24, 1, 5);
      label(ctx, mo === 0 ? String(dt.getUTCFullYear()) : 'JFMAMJJASOND'[mo], X(t) + 2, h - 11, { size: 9.5, color: mo === 0 ? 'rgba(237,240,247,0.8)' : 'rgba(174,182,204,0.5)' });
    }
    ctx.fillStyle = 'rgba(255,255,255,0.7)'; ctx.fillRect(X(viewer.d) - 0.75, 16, 1.5, h - 40);
    label(ctx, '● solar eclipse', x1, yN - 12, { align: 'right', size: 10, color: '#ffcf6e' });
    label(ctx, '● lunar eclipse', x1, yF + 13, { align: 'right', size: 10, color: '#e86a5e' });
  }

  bindRange($('eclipse-incl'), (v) => {
    world.moonIncl = v;
    $('eclipse-incl-out').textContent = `${v.toFixed(1)}°${Math.abs(v - 5.145) < 0.03 ? ' (real)' : ''}`;
    rates(); events(viewer.d); drawTimeline(); next();
  });
  document.querySelectorAll('#eclipses [data-incl]').forEach((b) => b.addEventListener('click', () => setRange($('eclipse-incl'), parseFloat(b.dataset.incl))));
  window.__eclipses = { viewer, world, syzygies, S };
}
