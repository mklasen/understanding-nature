// Chapter 3 — why storms spin. Two views:
//  1. a merry-go-round: a ball rolled straight across a spinning disc leaves a curved track on it
//  2. a weather map: air aiming for a low is deflected by Earth's spin (f = 2Ω sin φ) and
//     ends up circling it — spiralling in only as fast as friction lets it.
import { PressureField, stepParcel, coriolis, geostrophic, RHO } from './map-sim.js';
import { MapView } from './map-view.js';
import { fitCanvas, visibleLoop, bindRange, $ } from '../../kit/util.js';

const HOURS_PER_SEC = 3;
const FRICTION = { aloft: 0, sea: 0.36, land: 0.8 }; // × f at 45° (tan of the cross-isobar angle there)

export function initSpin() {
  // ---------- state (declared before any bindRange) ----------
  const canvas = $('spin-canvas'), tcanvas = $('spin-turntable');
  const low = { x: 0, y: 0, dp: -24, R: 560e3 };
  const field = new PressureField([low]);
  const view = new MapView(canvas, field, { widthKm: 3000 });
  let lat = 50, fric = 'sea', parcels = [], seed = 11, ringTimer = 0;
  const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  const dpr = () => Math.min(window.devicePixelRatio || 1, 2);

  function ring() {
    const n = 22, r0 = 1250e3, off = rand();
    for (let i = 0; i < n; i++) {
      const a = ((i + off) / n) * Math.PI * 2;
      parcels.push({ x: r0 * Math.cos(a), y: r0 * Math.sin(a), u: 0, v: 0, trail: [], alpha: 0, age: 0, hue: i % 2 });
    }
    if (parcels.length > 110) parcels.splice(0, parcels.length - 110);
  }
  const f = () => coriolis(lat);
  const k = () => FRICTION[fric] * coriolis(45);

  bindRange($('spin-lat'), (v) => {
    lat = v;
    $('spin-lat-out').textContent = v === 0 ? 'equator' : `${Math.abs(v)}° ${v > 0 ? 'N' : 'S'}`;
    readouts();
  });
  document.querySelectorAll('#spin-fric button').forEach((b) => b.addEventListener('click', () => {
    document.querySelectorAll('#spin-fric button').forEach((x) => x.classList.toggle('on', x === b));
    fric = b.dataset.f; readouts();
  }));
  $('spin-release').addEventListener('click', () => { ring(); ringTimer = 0; });
  document.querySelectorAll('#spin [data-lat]').forEach((b) => b.addEventListener('click', () => {
    const el = $('spin-lat'); el.value = b.dataset.lat; el.dispatchEvent(new Event('input'));
    parcels = []; ring();
  }));

  // average angle at which the air crosses the isobars, measured from the parcels themselves
  function crossAngle() {
    let s = 0, n = 0;
    for (const P of parcels) {
      const r = Math.hypot(P.x, P.y), spd = Math.hypot(P.u, P.v);
      if (P.age < 3 || r < 0.3 * low.R || r > 1.6 * low.R || spd < 1) continue;
      const vr = (P.x * P.u + P.y * P.v) / r;
      s += Math.asin(Math.max(-1, Math.min(1, -vr / spd))); n++;
    }
    return n > 3 ? (s / n) * 180 / Math.PI : null;
  }

  function readouts() {
    const fv = f();
    const spinTxt = Math.abs(lat) < 3 ? 'none — straight in' : lat > 0 ? '↺ anticlockwise' : '↻ clockwise';
    $('spin-dir').textContent = spinTxt;
    $('spin-f').textContent = Math.abs(lat) < 1 ? 'zero' : `${(Math.abs(fv) * 1e4).toFixed(2)} ×10⁻⁴ /s`;
    const [gx, gy] = field.grad(low.R, 0), g = Math.hypot(gx, gy);
    const vg = geostrophic(g, fv);
    $('spin-vg').textContent = Number.isFinite(vg) && vg < 200 ? `${Math.round(vg * 3.6)} km/h` : 'no balance';
    const why = $('spin-why');
    if (Math.abs(lat) < 3) why.innerHTML = 'At the equator the ground under you isn’t turning around a vertical axis, so there is no sideways push. Air rushes <b>straight into the low</b> and fills it within hours. That is why hurricanes never form right on the equator.';
    else if (fric === 'aloft') why.innerHTML = `High up, with no friction, the air ends up flowing <b>along the isobars</b> — round and round the low instead of into it. The push inwards and the Coriolis deflection balance at about ${Number.isFinite(vg) ? Math.round(vg * 3.6) : '—'} km/h.`;
    else why.innerHTML = `Near the ground friction slows the air, so the Coriolis deflection (which grows with speed) can’t quite keep up. The air <b>spirals in</b>, crossing the isobars at an angle — ${fric === 'land' ? 'steeply over rough land' : 'gently over the smooth sea'}. In the middle it has nowhere to go but <b>up</b>.`;
  }

  // ---------- merry-go-round ----------
  const tt = { ang: 0, ball: null, frame: 'ground', omega: 0.9 };
  document.querySelectorAll('#spin-frame button').forEach((b) => b.addEventListener('click', () => {
    document.querySelectorAll('#spin-frame button').forEach((x) => x.classList.toggle('on', x === b));
    tt.frame = b.dataset.frame;
  }));
  $('spin-roll').addEventListener('click', () => { tt.ball = { t: 0, track: [] }; });

  function drawTurntable(dt) {
    const { ctx, w, h } = fitCanvas(tcanvas);
    const sgn = lat >= 0 ? 1 : -1; // northern hemisphere spins anticlockwise seen from above
    const om = tt.omega * sgn * (Math.abs(lat) < 3 ? 0 : 1);
    tt.ang += om * dt;
    const R = Math.min(w * 0.42, h * 0.42), cx = w / 2, cy = h / 2;
    const view = tt.frame === 'disc' ? -tt.ang : 0; // rotate the picture so the disc looks still
    ctx.fillStyle = '#0d1a2e'; ctx.fillRect(0, 0, w, h);
    // the disc
    ctx.save(); ctx.translate(cx, cy); ctx.rotate(-(tt.ang + view));
    ctx.fillStyle = '#1b3150'; ctx.beginPath(); ctx.arc(0, 0, R, 0, 7); ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.12)'; ctx.lineWidth = 1;
    for (let i = 0; i < 8; i++) { ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(R * Math.cos(i * Math.PI / 4), R * Math.sin(i * Math.PI / 4)); ctx.stroke(); }
    ctx.fillStyle = '#ffa477'; ctx.beginPath(); ctx.arc(R * 0.92, 0, 5, 0, 7); ctx.fill(); // a painted marker
    // chalk track the ball leaves on the disc (stored in disc coordinates)
    if (tt.ball && tt.ball.track.length > 1) {
      ctx.strokeStyle = 'rgba(255,240,180,0.9)'; ctx.lineWidth = 2.2; ctx.beginPath();
      tt.ball.track.forEach(([x, y], i) => (i ? ctx.lineTo(x * R, y * R) : ctx.moveTo(x * R, y * R)));
      ctx.stroke();
    }
    ctx.restore();
    ctx.strokeStyle = 'rgba(255,255,255,0.25)'; ctx.beginPath(); ctx.arc(cx, cy, R, 0, 7); ctx.stroke();
    // the ball: rolls in a straight line (seen from the ground), centre → edge, aimed at "12 o'clock"
    if (tt.ball) {
      const b = tt.ball;
      b.t += dt * 0.42;
      const r = Math.min(1, b.t);
      // ground frame position (straight up the screen), and in disc coordinates
      const gx = 0, gy = r; // unit disc, y up
      const a = tt.ang; // disc rotation so far (anticlockwise positive)
      const dxd = gx * Math.cos(a) + gy * Math.sin(a), dyd = -gx * Math.sin(a) + gy * Math.cos(a); // into disc frame
      if (b.t <= 1) b.track.push([dxd, -dyd]);
      const sx = tt.frame === 'disc' ? dxd : gx, sy = tt.frame === 'disc' ? dyd : gy;
      ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(cx + sx * R, cy - sy * R, 7, 0, 7); ctx.fill();
      if (b.t > 1.6) tt.ball = null;
    }
    ctx.font = '600 11.5px ui-sans-serif, system-ui, sans-serif'; ctx.fillStyle = 'rgba(255,255,255,0.8)'; ctx.textAlign = 'left'; ctx.textBaseline = 'top';
    ctx.fillText(tt.frame === 'disc' ? 'Riding the merry-go-round' : 'Watching from the ground', 10, 10);
    ctx.textAlign = 'right';
    ctx.fillText(om === 0 ? 'not spinning' : om > 0 ? 'spinning ↺' : 'spinning ↻', w - 10, 10);
    if (!tt.ball) { ctx.textAlign = 'center'; ctx.textBaseline = 'bottom'; ctx.fillStyle = 'rgba(255,255,255,0.6)'; ctx.fillText('Roll the ball ↓', cx, h - 6); }
  }

  // ---------- weather map ----------
  ring();
  visibleLoop(canvas, (dt) => {
    const { ctx, w, h } = fitCanvas(canvas);
    view.layout(w, h);
    const simDt = dt * HOURS_PER_SEC * 3600, fv = f(), kv = k();
    ringTimer += dt;
    if (ringTimer > 12) { ring(); ringTimer = 0; }
    for (const P of parcels) {
      const sub = 8;
      for (let s = 0; s < sub; s++) stepParcel(P, field, fv, kv, simDt / sub);
      P.age += dt;
      P.trail.push(P.x, P.y); if (P.trail.length > 40) P.trail.splice(0, 2);
      const r = Math.hypot(P.x, P.y);
      P.alpha = Math.min(1, P.age * 1.5) * Math.min(1, r / (0.18 * low.R)) * Math.min(1, (48 - P.age) / 4);
    }
    parcels = parcels.filter((P) => P.alpha > 0.02 || P.age < 0.5);
    view.drawBackground(ctx, dpr());
    view.drawParcels(ctx, parcels, (P, a) => (P.hue ? `rgba(255,240,190,${a})` : `rgba(160,215,255,${a})`));
    view.drawCenters(ctx);
    view.scaleBar(ctx);
    ctx.textAlign = 'right'; ctx.textBaseline = 'top'; ctx.fillStyle = 'rgba(255,255,255,0.7)'; ctx.font = '500 11px ui-sans-serif, system-ui, sans-serif';
    ctx.fillText(`${Math.abs(lat)}°${lat > 0 ? 'N' : lat < 0 ? 'S' : ''} · 1 s ≈ ${HOURS_PER_SEC} h`, w - 10, 10);
    const ang = crossAngle();
    $('spin-angle').textContent = ang === null ? '–' : `${Math.round(Math.max(0, ang))}°`;
  });
  visibleLoop(tcanvas, drawTurntable);
}
