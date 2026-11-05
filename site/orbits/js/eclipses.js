// Chapter 4 — why eclipses are rare. Moon on a tilted orbit (slider; real 5.145°) whose nodes regress
// every 18.6 yr; Sun direction from Earth's real orbit; mean lunations.
// Eclipse test at each syzygy: Moon's ecliptic latitude β = asin(sin i · sin(λ_moon − Ω)).
//   solar (partial or better, somewhere on Earth): |β| < 1.5°   lunar (partial or total, umbral): |β| < 1.0°
import { DEG, TAU, SYNODIC_MONTH, NEW_MOON_EPOCH, sunFromEarth, moonNode, moonPhaseAngle, daysSinceJ2000, dateFromJ2000, fmtDate } from './astro.js';
import { Camera, makeStars, drawStars, drawGlobe, bodyFrame, axisDir, mat, label, arrow, attachZoom } from './draw.js';
import { fitCanvas, visibleLoop, bindRange, setRange, $ } from '../../kit/util.js';

const SOLAR_LIMIT = 1.5 * DEG, LUNAR_LIMIT = 1.0 * DEG;

export function initEclipses() {
  const canvas = $('eclipse-canvas'), tl = $('eclipse-timeline');
  const cam = new Camera({ yaw: -62, pitch: 20 });
  cam.attachDrag(canvas, null, { minPitch: -60, maxPitch: 89 });
  attachZoom(canvas, cam, { min: 0.6, max: 6 });
  const stars = makeStars(200, 33);
  const S = { d: daysSinceJ2000(Date.now()), incl: 5.145 * DEG, playing: true, rate: 21, flash: null, events: [] };

  const beta = (t, full) => {
    const ls = sunFromEarth(t).lambda + (full ? Math.PI : 0);
    return Math.asin(Math.sin(S.incl) * Math.sin(ls - moonNode(t) * DEG));
  };
  function syzygies(from, to) {
    const out = [];
    let k = Math.floor((from - NEW_MOON_EPOCH) / SYNODIC_MONTH);
    for (;; k++) {
      const tn = NEW_MOON_EPOCH + k * SYNODIC_MONTH;
      if (tn - SYNODIC_MONTH / 2 > to) break;
      for (const full of [false, true]) {
        const t = tn + (full ? SYNODIC_MONTH / 2 : 0);
        if (t < from || t > to) continue;
        const b = beta(t, full);
        out.push({ t, full, b, ecl: Math.abs(b) < (full ? LUNAR_LIMIT : SOLAR_LIMIT) });
      }
    }
    return out;
  }
  function rates() {
    const yrs = 100, d0 = daysSinceJ2000(Date.UTC(2000, 0, 1));
    const ev = syzygies(d0, d0 + yrs * 365.25);
    const sol = ev.filter((e) => e.ecl && !e.full).length / yrs, lun = ev.filter((e) => e.ecl && e.full).length / yrs;
    $('eclipse-solar').textContent = sol.toFixed(1);
    $('eclipse-lunar').textContent = lun.toFixed(1);
  }
  let winFrom = 0;
  function events() {
    winFrom = S.d - 200;
    S.events = syzygies(winFrom, winFrom + 800);
  }

  bindRange($('eclipse-incl'), (v) => {
    S.incl = v * DEG;
    $('eclipse-incl-out').textContent = `${v.toFixed(1)}°${Math.abs(v - 5.145) < 0.03 ? ' (real)' : ''}`;
    rates(); events();
  });
  document.querySelectorAll('#eclipses [data-incl]').forEach((b) => b.addEventListener('click', () => setRange($('eclipse-incl'), parseFloat(b.dataset.incl))));
  $('eclipse-play').addEventListener('click', () => { S.playing = !S.playing; $('eclipse-play').textContent = S.playing ? '❚❚' : '▶'; });

  function frame(dt) {
    // slow down around eclipses so you can see the alignment
    const near = S.events.find((e) => e.ecl && Math.abs(e.t - S.d) < 2.5);
    const rate = near ? 1.6 : S.rate;
    if (S.playing) S.d += dt * rate;
    if (S.d > winFrom + 500) events();
    if (near) S.flash = { text: near.full ? 'Lunar eclipse — the Moon enters Earth’s shadow' : 'Solar eclipse — the Moon’s shadow touches Earth', full: near.full, until: performance.now() + 1800 };
    draw(); drawTimeline();
    $('eclipse-date').textContent = fmtDate(dateFromJ2000(S.d));
  }

  function draw() {
    const { ctx, w, h } = fitCanvas(canvas);
    ctx.fillStyle = '#0a0e1c'; ctx.fillRect(0, 0, w, h);
    drawStars(ctx, w, h, stars, 0.5);
    const m = Math.min(w, h);
    cam.cx = w / 2; cam.cy = h * 0.52; cam.scale = Math.min(w * 0.36, h * 0.6); cam.update();
    const d = S.d;
    const sun = sunFromEarth(d);
    const ls = sun.lambda;
    const sunDir = [Math.cos(ls), Math.sin(ls), 0];
    const O = moonNode(d) * DEG, i = S.incl;
    const lm = ls + moonPhaseAngle(d);
    const orbitPt = (u) => [
      Math.cos(O) * Math.cos(u) - Math.sin(O) * Math.sin(u) * Math.cos(i),
      Math.sin(O) * Math.cos(u) + Math.cos(O) * Math.sin(u) * Math.cos(i),
      Math.sin(u) * Math.sin(i)];
    const P = (v) => cam.project(v);

    // Moon orbit: below-plane half first (dim), then the plane, then the above-plane half
    const orbitHalf = (above) => {
      ctx.strokeStyle = above ? 'rgba(201,212,255,0.85)' : 'rgba(201,212,255,0.3)';
      ctx.lineWidth = above ? 1.8 : 1.2;
      ctx.beginPath();
      for (let k = 0; k <= 90; k++) {
        const u = (above ? 0 : Math.PI) + (k / 90) * Math.PI;
        const q = P(orbitPt(u));
        k ? ctx.lineTo(q.x, q.y) : ctx.moveTo(q.x, q.y);
      }
      ctx.stroke();
    };
    orbitHalf(false);
    // ecliptic plane
    ctx.beginPath();
    for (let k = 0; k <= 96; k++) { const a = (k / 96) * TAU; const q = P([Math.cos(a) * 1.32, Math.sin(a) * 1.32, 0]); k ? ctx.lineTo(q.x, q.y) : ctx.moveTo(q.x, q.y); }
    ctx.fillStyle = 'rgba(95,176,240,0.09)'; ctx.fill();
    ctx.strokeStyle = 'rgba(95,176,240,0.3)'; ctx.lineWidth = 1; ctx.stroke();
    const lp = P([Math.cos(ls + 2.2) * 1.32, Math.sin(ls + 2.2) * 1.32, 0]);
    label(ctx, "Earth's orbital plane", lp.x, lp.y + 12, { align: 'center', size: 10.5, color: 'rgba(95,176,240,0.7)' });

    // Earth's shadow, pointing away from the Sun, lying in the plane
    const sh0 = P([0, 0, 0]), sh1 = P([-sunDir[0] * 1.5, -sunDir[1] * 1.5, 0]);
    const Re = m * 0.065 * cam.zoom;
    ctx.strokeStyle = 'rgba(0,0,0,0.55)'; ctx.lineWidth = Re * 1.5; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(sh0.x, sh0.y); ctx.lineTo(sh1.x, sh1.y); ctx.stroke(); ctx.lineCap = 'butt';
    // sun direction
    const sa = P([sunDir[0] * 0.25, sunDir[1] * 0.25, 0]), sb = P([sunDir[0] * 1.55, sunDir[1] * 1.55, 0]);
    arrow(ctx, sa.x, sa.y, sb.x, sb.y, 'rgba(255,207,110,0.9)', 2, 9);
    label(ctx, '☀ to the Sun', sb.x, sb.y - 12, { align: 'center', size: 11.5, color: '#ffcf6e' });

    // line of nodes
    const n1 = P(orbitPt(0)), n2 = P(orbitPt(Math.PI));
    ctx.setLineDash([5, 5]); ctx.strokeStyle = 'rgba(245,185,90,0.6)'; ctx.lineWidth = 1.2;
    ctx.beginPath(); ctx.moveTo(n1.x, n1.y); ctx.lineTo(n2.x, n2.y); ctx.stroke(); ctx.setLineDash([]);
    for (const q of [n1, n2]) { ctx.fillStyle = '#f5b95a'; ctx.beginPath(); ctx.arc(q.x, q.y, 3.5, 0, TAU); ctx.fill(); }
    label(ctx, 'node', n1.x + 8, n1.y - 8, { size: 10.5, color: 'rgba(245,185,90,0.85)' });
    label(ctx, 'node', n2.x + 8, n2.y - 8, { size: 10.5, color: 'rgba(245,185,90,0.85)' });

    orbitHalf(true);

    // Earth & Moon, depth sorted
    const mp = orbitPt(lm - O);
    const E = P([0, 0, 0]), M = P(mp);
    const sunV = cam.toView(sunDir);
    const drawEarth = () => drawGlobe(ctx, E.x, E.y, Re, { B: mat.mul(cam.V, bodyFrame(axisDir(23.44, 90))), sun: sunV, grid: false, res: 1.2, night: 0.2 });
    const drawMoonBall = () => {
      const r = m * 0.03 * cam.zoom;
      ctx.fillStyle = '#2a2d36'; ctx.beginPath(); ctx.arc(M.x, M.y, r, 0, TAU); ctx.fill();
      // lit half toward the Sun (screen-space approximation)
      const a = Math.atan2(-sunV[1], sunV[0]);
      ctx.fillStyle = '#ecebe4'; ctx.beginPath(); ctx.arc(M.x, M.y, r, a - Math.PI / 2, a + Math.PI / 2); ctx.fill();
      // drop line to the plane: shows above / below
      const foot = P([mp[0], mp[1], 0]);
      ctx.strokeStyle = mp[2] >= 0 ? 'rgba(201,212,255,0.6)' : 'rgba(201,212,255,0.3)'; ctx.lineWidth = 1;
      ctx.setLineDash([2, 3]); ctx.beginPath(); ctx.moveTo(M.x, M.y); ctx.lineTo(foot.x, foot.y); ctx.stroke(); ctx.setLineDash([]);
    };
    if (M.z > E.z) { drawEarth(); drawMoonBall(); } else { drawMoonBall(); drawEarth(); }
    const bNow = Math.asin(mp[2]) / DEG;
    label(ctx, `Moon ${Math.abs(bNow) < 0.05 ? 'on the plane' : `${Math.abs(bNow).toFixed(1)}° ${bNow > 0 ? 'above' : 'below'} the plane`}`, 12, h - 14, { size: 11.5, color: 'rgba(237,240,247,0.8)' });

    if (S.flash && performance.now() < S.flash.until) {
      const txt = S.flash.text;
      ctx.font = '600 13px ui-sans-serif, -apple-system, "Segoe UI", Inter, Roboto, sans-serif';
      const tw = Math.min(w - 20, ctx.measureText(txt).width + 24);
      ctx.fillStyle = S.flash.full ? 'rgba(160,40,30,0.85)' : 'rgba(180,120,20,0.9)';
      ctx.beginPath(); ctx.roundRect(w / 2 - tw / 2, 12, tw, 28, 14); ctx.fill();
      label(ctx, txt, w / 2, 26, { align: 'center', size: 12.5, weight: 600, color: '#fff' });
    }
  }

  function drawTimeline() {
    const { ctx, w, h } = fitCanvas(tl);
    ctx.fillStyle = '#0a0e1c'; ctx.fillRect(0, 0, w, h);
    const span = 540, t0 = S.d - 150;
    const x0 = 12, x1 = w - 12;
    const X = (t) => x0 + ((t - t0) / span) * (x1 - x0);
    // eclipse seasons: Sun within ~17° of a node
    ctx.fillStyle = 'rgba(245,185,90,0.10)';
    for (let t = t0; t < t0 + span; t += 2) {
      const ls = sunFromEarth(t).lambda;
      if (Math.abs(Math.sin(ls - moonNode(t) * DEG)) < Math.sin(17 * DEG)) ctx.fillRect(X(t), 18, X(t + 2) - X(t) + 0.5, h - 44);
    }
    label(ctx, 'shaded: eclipse seasons (Sun near a node)', x0, 10, { size: 10.5, color: 'rgba(245,185,90,0.8)' });
    const yN = h * 0.36, yF = h * 0.62;
    label(ctx, 'new', x0, yN - 12, { size: 9.5, color: 'rgba(174,182,204,0.6)' });
    label(ctx, 'full', x0, yF + 13, { size: 9.5, color: 'rgba(174,182,204,0.6)' });
    for (const e of S.events) {
      if (e.t < t0 || e.t > t0 + span) continue;
      const x = X(e.t), y = e.full ? yF : yN;
      if (e.ecl) {
        ctx.fillStyle = e.full ? '#d9483b' : '#ffcf6e';
        ctx.beginPath(); ctx.arc(x, y, 7, 0, TAU); ctx.fill();
        if (!e.full) { ctx.fillStyle = '#111'; ctx.beginPath(); ctx.arc(x + 1.5, y, 5.5, 0, TAU); ctx.fill(); }
      } else {
        ctx.fillStyle = e.full ? 'rgba(236,235,228,0.85)' : 'rgba(60,64,80,1)';
        ctx.strokeStyle = 'rgba(236,235,228,0.5)'; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.arc(x, y, 3.5, 0, TAU); ctx.fill(); if (!e.full) ctx.stroke();
      }
    }
    // month ticks
    for (let t = Math.ceil(t0); t < t0 + span; t++) {
      const dt = dateFromJ2000(t);
      if (dt.getUTCDate() !== 1) continue;
      const mo = dt.getUTCMonth();
      ctx.fillStyle = 'rgba(170,185,230,0.25)'; ctx.fillRect(X(t), h - 24, 1, 5);
      label(ctx, mo === 0 ? String(dt.getUTCFullYear()) : 'JFMAMJJASOND'[mo], X(t) + 2, h - 11, { size: 9.5, color: mo === 0 ? 'rgba(237,240,247,0.8)' : 'rgba(174,182,204,0.5)' });
    }
    ctx.fillStyle = 'rgba(255,255,255,0.7)'; ctx.fillRect(X(S.d) - 0.75, 16, 1.5, h - 40);
    label(ctx, '● solar eclipse', x1, yN - 12, { align: 'right', size: 10, color: '#ffcf6e' });
    label(ctx, '● lunar eclipse', x1, yF + 13, { align: 'right', size: 10, color: '#e86a5e' });
  }

  events();
  visibleLoop(canvas, frame);
  window.__eclipses = { S, draw, drawTimeline, syzygies };
}
