// Chapter 5 — Newton's cannonball. Real Earth (R = 6371 km, GM = 398600 km³/s²), launch 400 km up,
// horizontal; no air. Integrated with velocity Verlet (dt = 1 s), drawn at true scale with auto-zoom.
import { GM_EARTH, R_EARTH, TAU, circularSpeed, escapeSpeed } from './astro.js';
import { makeStars, drawStars, drawGlobe, label } from './draw.js';
import { fitCanvas, visibleLoop, bindRange, setRange, approach, $ } from '../../kit/util.js';

const H0 = 400, R0 = R_EARTH + H0;
const V_CIRC = circularSpeed(GM_EARTH, R0), V_ESC = escapeSpeed(GM_EARTH, R0);

function simulate(v) {
  let x = 0, y = R0, vx = v, vy = 0, t = 0, swept = 0, prevA = Math.atan2(y, x);
  const pts = [[x, y, 0]];
  const dt = 1;
  let ax = -GM_EARTH * x / R0 ** 3, ay = -GM_EARTH * y / R0 ** 3;
  let end = 'orbit', rmax = R0;
  for (let i = 0; i < 400000; i++) {
    x += vx * dt + 0.5 * ax * dt * dt; y += vy * dt + 0.5 * ay * dt * dt;
    const r = Math.hypot(x, y), r3 = r * r * r;
    const nax = -GM_EARTH * x / r3, nay = -GM_EARTH * y / r3;
    vx += 0.5 * (ax + nax) * dt; vy += 0.5 * (ay + nay) * dt; ax = nax; ay = nay;
    t += dt;
    const a = Math.atan2(y, x);
    let da = a - prevA; if (da > Math.PI) da -= TAU; if (da < -Math.PI) da += TAU;
    swept += da; prevA = a;
    rmax = Math.max(rmax, r);
    if (i % 4 === 0) pts.push([x, y, t]);
    if (r <= R_EARTH) { end = 'land'; break; }
    if (Math.abs(swept) >= TAU) { end = 'orbit'; break; }
    if (r > 14 * R_EARTH) { end = 'escape'; break; }
  }
  pts.push([x, y, t]);
  return { v, pts, end, t, rmax, swept };
}

export function initFalling() {
  const canvas = $('fall-canvas');
  const stars = makeStars(220, 51);
  const S = { v: 5, shots: [], cur: null, simT: 0, view: 1.4 * R_EARTH, yc: 0 };

  const fmtTime = (s) => (s < 3600 ? `${Math.round(s / 60)} min` : s < 86400 ? `${(s / 3600).toFixed(1)} h` : `${(s / 86400).toFixed(1)} days`);
  function predict(v) {
    if (v >= V_ESC) return { text: 'Escapes Earth', time: 'forever' };
    const a = 1 / (2 / R0 - v * v / GM_EARTH);
    const rp = 2 * a - R0; // other apsis (perigee if v < v_circ)
    if (v < V_CIRC && rp < R_EARTH) return { text: 'Falls back down', time: null };
    const T = TAU * Math.sqrt(a ** 3 / GM_EARTH);
    return { text: Math.abs(v - V_CIRC) < 0.03 ? 'Circular orbit' : 'Orbits (an ellipse)', time: `${fmtTime(T)} per lap` };
  }
  function readouts() {
    $('fall-speed').textContent = `${S.v.toFixed(2)} km/s`;
    const shot = S.cur && S.cur.v === S.v ? S.cur : null;
    const p = predict(S.v);
    if (shot && shot.end === 'land' && S.simT >= shot.t) {
      const ang = Math.abs(shot.swept);
      $('fall-outcome').textContent = `Lands ${Math.round(ang * R_EARTH).toLocaleString('en')} km away`;
      $('fall-time').textContent = fmtTime(shot.t);
    } else {
      $('fall-outcome').textContent = p.text;
      $('fall-time').textContent = p.time || (shot ? fmtTime(shot.t) : '—');
    }
  }
  function fire() {
    const shot = simulate(S.v);
    S.shots.push(shot); if (S.shots.length > 7) S.shots.shift();
    S.cur = shot; S.simT = 0;
    readouts();
  }
  bindRange($('fall-v'), (v) => {
    S.v = v;
    $('fall-v-out').textContent = `${v.toFixed(2)} km/s · ${Math.round(v * 3600).toLocaleString('en')} km/h`;
    readouts();
  });
  $('fall-v').addEventListener('change', fire);
  $('fall-fire').addEventListener('click', fire);
  $('fall-clear').addEventListener('click', () => { S.shots = []; S.cur = null; });
  document.querySelectorAll('#falling [data-v]').forEach((b) => b.addEventListener('click', () => { setRange($('fall-v'), parseFloat(b.dataset.v)); fire(); }));

  function frame(dt) {
    if (S.cur) {
      const warp = 700 * Math.max(1, S.cur.rmax / R0) ** 1.5;
      S.simT = Math.min(S.cur.t, S.simT + dt * warp);
      if (S.simT >= S.cur.t) readouts();
    }
    const ra = S.cur ? Math.min(S.cur.rmax, 6 * R_EARTH) : R0; // far point of the path (below Earth)
    const yc = (R0 - ra) / 2;                                   // centre of the path's ellipse
    S.view = approach(S.view, Math.max(1.36 * R_EARTH, ((R0 + ra) / 2) * 1.2), dt, 2.5);
    S.yc = approach(S.yc, ra > 1.5 * R_EARTH ? yc : 0, dt, 2.5);
    draw();
  }

  function draw() {
    const { ctx, w, h } = fitCanvas(canvas);
    ctx.fillStyle = '#0a0e1c'; ctx.fillRect(0, 0, w, h);
    drawStars(ctx, w, h, stars, 0.55);
    const m = Math.min(w, h);
    // the far apsis lies below Earth: shift the centre up a little when zoomed out
    const k = (m * 0.46) / S.view;
    const cx = w / 2, cy = h / 2 + S.yc * k;
    const X = (x) => cx + x * k, Y = (y) => cy - y * k;
    const Re = R_EARTH * k;
    // atmosphere (~100 km, to scale)
    ctx.fillStyle = 'rgba(110,170,255,0.16)'; ctx.beginPath(); ctx.arc(cx, cy, (R_EARTH + 100) * k, 0, TAU); ctx.fill();
    drawGlobe(ctx, cx, cy, Re, { B: [[0, 1, 0], [0, 0, 1], [1, 0, 0]], sun: [-0.6, 0.5, 0.62], spin: 0.3, grid: false, night: 0.25, res: 1.1 });
    // the mountain (to scale: 400 km tall)
    const mx = X(0), base = Y(R_EARTH - 30), peak = Y(R0);
    ctx.fillStyle = '#6d6a63';
    ctx.beginPath(); ctx.moveTo(mx - 320 * k, base); ctx.lineTo(mx - 18 * k, peak); ctx.lineTo(mx + 18 * k, peak); ctx.lineTo(mx + 320 * k, base); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#ddd'; ctx.beginPath(); ctx.moveTo(mx - 90 * k, Y(R0 - 110)); ctx.lineTo(mx - 18 * k, peak); ctx.lineTo(mx + 18 * k, peak); ctx.lineTo(mx + 90 * k, Y(R0 - 110)); ctx.closePath(); ctx.fill();
    // cannon
    ctx.fillStyle = '#2b2f3a'; ctx.fillRect(mx - 6, peak - 9, 22, 7);
    ctx.fillStyle = '#2b2f3a'; ctx.beginPath(); ctx.arc(mx - 2, peak - 3, 4, 0, TAU); ctx.fill();
    // old shots
    for (const s of S.shots) {
      const isCur = s === S.cur;
      ctx.strokeStyle = isCur ? '#f5b95a' : 'rgba(245,185,90,0.28)';
      ctx.lineWidth = isCur ? 2.2 : 1.3;
      ctx.beginPath();
      let last = null;
      for (let i = 0; i < s.pts.length; i++) {
        const p = s.pts[i];
        if (isCur && p[2] > S.simT) break;
        i ? ctx.lineTo(X(p[0]), Y(p[1])) : ctx.moveTo(X(p[0]), Y(p[1]));
        last = p;
      }
      ctx.stroke();
      if (isCur && last) {
        ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(X(last[0]), Y(last[1]), 4, 0, TAU); ctx.fill();
        if (s.end === 'land' && S.simT >= s.t) { ctx.fillStyle = 'rgba(255,120,80,0.8)'; ctx.beginPath(); ctx.arc(X(last[0]), Y(last[1]), 7, 0, TAU); ctx.fill(); }
      }
      if (!isCur) label(ctx, `${s.v.toFixed(1)}`, X(s.pts[s.pts.length - 1][0]) + 5, Y(s.pts[s.pts.length - 1][1]), { size: 9.5, color: 'rgba(245,185,90,0.5)' });
    }
    label(ctx, '400 km mountain, above the air', mx + 14, peak - 18, { size: 10.5, color: 'rgba(237,240,247,0.75)' });
    // scale bar
    const bar = 1000 * k * (S.view > 3 * R_EARTH ? 10 : 1);
    ctx.fillStyle = 'rgba(237,240,247,0.6)'; ctx.fillRect(12, h - 16, bar, 2);
    label(ctx, S.view > 3 * R_EARTH ? '10,000 km' : '1,000 km', 12, h - 26, { size: 10, color: 'rgba(237,240,247,0.6)' });
    label(ctx, `circular orbit needs ${V_CIRC.toFixed(2)} km/s here · escape ${V_ESC.toFixed(1)} km/s`, w - 12, 18, { align: 'right', size: 10.5, color: 'rgba(174,182,204,0.7)' });
  }

  fire();
  visibleLoop(canvas, frame);
  window.__falling = { S, fire, draw };
}
