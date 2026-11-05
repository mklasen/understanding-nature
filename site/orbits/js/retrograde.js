// Chapter 7 — retrograde motion. Real (J2000 mean-element) Earth and Mars, including Mars's 1.85° tilt,
// so the sky track shows the actual loops / zig-zags. Toggle the observer between Earth and the Sun.
import { PLANETS, planetPos, daysSinceJ2000, dateFromJ2000, fmtDate, AU, TAU } from './astro.js';
import { makeStars, drawStars, drawSun, drawBall, label } from './draw.js';
import { fitCanvas, visibleLoop, approach, $ } from '../../kit/util.js';

const E = PLANETS[2], M = PLANETS[3];
const wrap = (a) => { a = (a + Math.PI) % TAU; if (a < 0) a += TAU; return a - Math.PI; };

export function initRetrograde() {
  const canvas = $('retro-canvas'), sky = $('retro-sky');
  const stars = makeStars(180, 71);
  // background "stars" fixed in ecliptic longitude/latitude
  const skyStars = makeStars(260, 72).map((s) => ({ lam: s.x * TAU, beta: (s.y - 0.5) * 0.35, m: s.m }));
  const S = { d: daysSinceJ2000(Date.now()), rate: 22, playing: true, view: 'earth', center: null, bc: null, nextOpp: null };

  const apparent = (d, view) => {
    const m = planetPos(M, d);
    const o = view === 'sun' ? { x: 0, y: 0, z: 0 } : planetPos(E, d);
    const gx = m.x - o.x, gy = m.y - o.y, gz = m.z - o.z;
    return { lam: Math.atan2(gy, gx), beta: Math.atan2(gz, Math.hypot(gx, gy)), dist: Math.hypot(gx, gy, gz), m, o };
  };
  function findNextOpposition(from) {
    const f = (t) => { const e = planetPos(E, t), m = planetPos(M, t); return wrap(Math.atan2(m.y, m.x) - Math.atan2(e.y, e.x)); };
    let prev = f(from);
    for (let t = from + 4; t < from + 820; t += 4) {
      const v = f(t);
      if (prev > 0 && v <= 0 && prev - v < 1) { // Earth's longitude passes Mars's
        let a = t - 4, b = t;
        for (let i = 0; i < 20; i++) { const mid = (a + b) / 2; if (f(mid) > 0) a = mid; else b = mid; }
        return (a + b) / 2;
      }
      prev = v;
    }
    return null;
  }

  $('retro-play').addEventListener('click', () => { S.playing = !S.playing; $('retro-play').textContent = S.playing ? '❚❚' : '▶'; });
  $('retro-view').addEventListener('click', (e) => {
    const b = e.target.closest('button'); if (!b) return;
    S.view = b.dataset.view;
    $('retro-view').querySelectorAll('button').forEach((x) => x.classList.toggle('on', x === b));
  });

  function frame(dt) {
    if (S.playing) S.d += dt * S.rate;
    draw(dt); drawSky(dt);
    const now = apparent(S.d, S.view), before = apparent(S.d - 1, S.view);
    const back = wrap(now.lam - before.lam) < 0;
    $('retro-dir').textContent = back ? 'Backwards!' : 'Forwards';
    $('retro-dir').style.color = back ? '#ff8a5c' : '';
    $('retro-dist').textContent = `${Math.round(apparent(S.d, 'earth').dist * AU / 1e6)} M km`;
    if (!S.nextOpp || S.nextOpp < S.d) S.nextOpp = findNextOpposition(S.d);
    $('retro-next').textContent = S.nextOpp ? fmtDate(dateFromJ2000(S.nextOpp)) : '—';
    $('retro-date').textContent = fmtDate(dateFromJ2000(S.d));
  }

  function draw() {
    const { ctx, w, h } = fitCanvas(canvas);
    ctx.fillStyle = '#0a0e1c'; ctx.fillRect(0, 0, w, h);
    drawStars(ctx, w, h, stars, 0.35);
    const m = Math.min(w, h), cx = w / 2, cy = h / 2;
    const RS = 2.2, k = (m * 0.47) / RS;
    const X = (x) => cx + x * k, Y = (y) => cy - y * k;
    // the "sky": a ring of distant stars
    ctx.strokeStyle = 'rgba(232,236,255,0.12)'; ctx.lineWidth = 10;
    ctx.beginPath(); ctx.arc(cx, cy, RS * k, 0, TAU); ctx.stroke();
    for (const st of skyStars) { ctx.fillStyle = `rgba(232,236,255,${(0.3 + 0.6 * st.m).toFixed(2)})`; ctx.fillRect(X(Math.cos(st.lam) * (RS + st.beta * 0.3)) - 0.6, Y(Math.sin(st.lam) * (RS + st.beta * 0.3)) - 0.6, 1.3, 1.3); }
    label(ctx, 'distant stars', cx, cy - RS * k + 16, { align: 'center', size: 10, color: 'rgba(232,236,255,0.55)' });
    // orbits
    for (const [p, c] of [[E, 'rgba(95,176,240,0.35)'], [M, 'rgba(255,138,92,0.35)']]) {
      ctx.strokeStyle = c; ctx.lineWidth = 1; ctx.beginPath();
      for (let j = 0; j <= 120; j++) { const q = planetPos(p, (j / 120) * p.P); j ? ctx.lineTo(X(q.x), Y(q.y)) : ctx.moveTo(X(q.x), Y(q.y)); }
      ctx.stroke();
    }
    // trail of where Mars appears on the sky ring over the past ~10 months
    for (let t = S.d - 300; t < S.d; t += 2) {
      const a = apparent(t, S.view), b = apparent(t + 2, S.view);
      const back = wrap(b.lam - a.lam) < 0;
      ctx.strokeStyle = back ? 'rgba(255,90,60,0.95)' : 'rgba(255,138,92,0.45)';
      ctx.lineWidth = back ? 5 : 3;
      ctx.beginPath(); ctx.arc(cx, cy, RS * k, -a.lam, -b.lam, wrap(b.lam - a.lam) > 0); ctx.stroke();
    }
    const now = apparent(S.d, S.view);
    const ox = X(now.o.x), oy = Y(now.o.y), mx = X(now.m.x), my = Y(now.m.y);
    // sight line
    const hx = X(Math.cos(now.lam) * RS), hy = Y(Math.sin(now.lam) * RS);
    ctx.strokeStyle = 'rgba(255,255,255,0.55)'; ctx.lineWidth = 1.2; ctx.setLineDash([4, 4]);
    ctx.beginPath(); ctx.moveTo(ox, oy); ctx.lineTo(hx, hy); ctx.stroke(); ctx.setLineDash([]);
    ctx.fillStyle = '#ff8a5c'; ctx.beginPath(); ctx.arc(hx, hy, 5, 0, TAU); ctx.fill();
    drawSun(ctx, cx, cy, 9, 3);
    const e = planetPos(E, S.d);
    drawBall(ctx, X(e.x), Y(e.y), 6, '#5fb0f0', cx - X(e.x), cy - Y(e.y));
    drawBall(ctx, mx, my, 5, '#ff8a5c', cx - mx, cy - my);
    label(ctx, 'Earth', X(e.x) + 9, Y(e.y) + 10, { size: 11, color: '#cfe6ff' });
    label(ctx, 'Mars', mx + 8, my - 10, { size: 11, color: '#ffc0a8' });
    label(ctx, S.view === 'sun' ? 'Watching from the Sun' : 'Watching from Earth', 12, 18, { size: 12, weight: 600, color: 'rgba(237,240,247,0.85)' });
    label(ctx, 'Seen from above · orbits to scale', 12, h - 14, { size: 10.5, color: 'rgba(174,182,204,0.6)' });
  }

  function drawSky(dt) {
    const { ctx, w, h } = fitCanvas(sky);
    ctx.fillStyle = '#070a14'; ctx.fillRect(0, 0, w, h);
    const now = apparent(S.d, S.view);
    if (S.center === null) S.center = now.lam;
    // pan gently so Mars stays in view
    const off = wrap(now.lam - S.center);
    if (Math.abs(off) > 0.35) S.center = wrap(S.center + (off - Math.sign(off) * 0.35));
    S.center = wrap(S.center + wrap(now.lam - S.center) * Math.min(1, dt * 0.15));
    if (S.bc === null) S.bc = now.beta;
    S.bc += (now.beta - S.bc) * Math.min(1, dt * 0.5);
    const SPAN = 1.6, BS = 4; // ±46° of longitude; latitude stretched ×4, centred on Mars
    const kx = w / SPAN;
    const X = (lam) => w / 2 - wrap(lam - S.center) * kx;     // east is to the LEFT (as in the sky)
    const Y = (beta) => h * 0.52 - (beta - S.bc) * kx * BS;
    for (const st of skyStars) {
      const x = X(st.lam), y = h * 0.52 - st.beta * 0.25 * kx * BS * 1.6;
      if (x < 0 || x > w) continue;
      ctx.fillStyle = `rgba(232,236,255,${(0.25 + 0.7 * st.m).toFixed(2)})`;
      const r = 0.6 + st.m * 1.4; ctx.fillRect(x - r / 2, y - r / 2, r, r);
    }
    ctx.strokeStyle = 'rgba(245,185,90,0.18)'; ctx.setLineDash([3, 5]);
    ctx.beginPath(); ctx.moveTo(0, Y(0)); ctx.lineTo(w, Y(0)); ctx.stroke(); ctx.setLineDash([]);
    label(ctx, 'ecliptic', w - 10, Y(0) - 7, { size: 9.5, align: 'right', color: 'rgba(245,185,90,0.45)' });
    let prev = null;
    for (let t = S.d - 400; t <= S.d; t += 2) {
      const a = apparent(t, S.view);
      const p = { x: X(a.lam), y: Y(a.beta), lam: a.lam };
      if (prev && Math.abs(p.x - prev.x) < w * 0.5) {
        const back = wrap(a.lam - prev.lam) < 0;
        const age = (S.d - t) / 400;
        ctx.strokeStyle = back ? `rgba(255,90,60,${(1 - age * 0.7).toFixed(2)})` : `rgba(255,138,92,${(0.75 - age * 0.55).toFixed(2)})`;
        ctx.lineWidth = back ? 3 : 2;
        ctx.beginPath(); ctx.moveTo(prev.x, prev.y); ctx.lineTo(p.x, p.y); ctx.stroke();
      }
      prev = p;
    }
    ctx.fillStyle = '#ff8a5c'; ctx.beginPath(); ctx.arc(X(now.lam), Y(now.beta), 5, 0, TAU); ctx.fill();
    label(ctx, `Mars against the stars, ${S.view === 'sun' ? 'from the Sun' : 'from Earth'} (last 13 months)`, 10, 12, { size: 10.5, color: 'rgba(237,240,247,0.75)' });
    label(ctx, '← east', 10, h - 10, { size: 10, color: 'rgba(174,182,204,0.6)' });
    label(ctx, 'west →', w - 10, h - 10, { size: 10, align: 'right', color: 'rgba(174,182,204,0.6)' });
    label(ctx, 'up/down stretched ×4', w / 2, h - 10, { size: 10, align: 'center', color: 'rgba(174,182,204,0.45)' });
  }

  visibleLoop(canvas, frame);
  window.__retro = { S, draw, drawSky, findNextOpposition };
}
