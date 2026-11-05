// Chapter 2 — seasons from axial tilt. Earth's position from its real Kepler orbit (e = 0.0167,
// perihelion ~3 Jan). Axis fixed in space, leaning toward the Sun at the June solstice.
import { DEG, TAU, AU, earth, planetPos, daysSinceJ2000, dateFromJ2000, fmtDayMonth, declination, dayLengthHours, noonAltitude, dailyInsolation, fmtHM } from './astro.js';
import { Camera, makeStars, drawStars, drawSun, drawGlobe, axisDir, bodyFrame, mat, v3, label, attachZoom } from './draw.js';
import { fitCanvas, visibleLoop, bindRange, setRange, $ } from '../../kit/util.js';

const YEAR0 = daysSinceJ2000(Date.UTC(new Date().getUTCFullYear(), 0, 1));

export function initSeasons() {
  const canvas = $('seasons-canvas'), chart = $('seasons-chart');
  const cam = new Camera({ yaw: -90, pitch: 30 });
  cam.attachDrag(canvas, () => (dirty = true), { minPitch: 4, maxPitch: 89 });
  attachZoom(canvas, cam, { min: 0.6, max: 6, onChange: () => (dirty = true) });
  const stars = makeStars(200, 3);
  const now = daysSinceJ2000(Date.now()) - YEAR0;
  const S = { doy: Math.max(0, Math.min(365, now)), tilt: 23.44, lat: 52 * DEG, playing: false, mode: 'day' };
  let dirty = true;

  const geo = (doy) => {
    const d = YEAR0 + doy;
    const p = planetPos(earth, d);
    const r = Math.hypot(p.x, p.y);
    const lambda = Math.atan2(-p.y, -p.x); // Sun's longitude as seen from Earth
    return { d, p: [p.x, p.y, 0], r, lambda, dec: declination(lambda, S.tilt) };
  };

  const dateIn = $('seasons-date');
  dateIn.value = S.doy;
  bindRange(dateIn, (v) => { S.doy = v; $('seasons-date-out').textContent = fmtDayMonth(dateFromJ2000(YEAR0 + v)); dirty = true; });
  bindRange($('seasons-tilt'), (v) => { S.tilt = v; $('seasons-tilt-out').textContent = `${v.toFixed(1)}°${Math.abs(v - 23.44) < 0.05 ? ' (Earth)' : v > 89 ? ' (on its side)' : ''}`; dirty = true; });
  bindRange($('seasons-lat'), (v) => {
    S.lat = v * DEG;
    $('seasons-lat-out').textContent = `${Math.abs(v).toFixed(0)}° ${v >= 0 ? 'N' : 'S'}${latName(v)}`;
    dirty = true;
  });
  $('seasons-play').addEventListener('click', () => { S.playing = !S.playing; $('seasons-play').textContent = S.playing ? '❚❚' : '▶'; });
  document.querySelectorAll('#seasons [data-tilt]').forEach((b) => b.addEventListener('click', () => setRange($('seasons-tilt'), parseFloat(b.dataset.tilt))));
  $('seasons-chart-mode').addEventListener('click', (e) => {
    const b = e.target.closest('button'); if (!b) return;
    S.mode = b.dataset.mode;
    $('seasons-chart-mode').querySelectorAll('button').forEach((x) => x.classList.toggle('on', x === b));
    dirty = true;
  });

  function latName(v) {
    const a = Math.abs(v);
    if (a < 1) return ' · equator';
    if (Math.abs(v - 52) < 1.5) return ' · Amsterdam';
    if (Math.abs(v + 34) < 1.5) return ' · Sydney';
    if (Math.abs(v - 40.7) < 1) return ' · New York';
    if (a > 89) return ' · pole';
    return '';
  }

  function frame(dt) {
    if (S.playing) { S.doy = (S.doy + dt * 30) % 365.25; dateIn.value = S.doy; dateIn.dispatchEvent(new Event('input')); }
    if (!dirty) return;
    dirty = false;
    draw(); drawChart(); readouts();
  }

  function readouts() {
    const g = geo(S.doy);
    const dl = dayLengthHours(S.lat, g.dec);
    $('seasons-day').textContent = dl <= 0.01 ? 'none (polar night)' : dl >= 23.99 ? '24 h (midnight sun)' : fmtHM(dl);
    const alt = noonAltitude(S.lat, g.dec) / DEG;
    $('seasons-noon').textContent = alt <= 0 ? 'below horizon' : `${alt.toFixed(0)}°`;
    const q = dailyInsolation(S.lat, g.dec, g.r);
    $('seasons-ins').textContent = `${Math.round(q)} W`;
    $('seasons-dist').textContent = `${(g.r * AU / 1e6).toFixed(1)} M km`;
    // the "why" sentence
    const north = S.lat >= 0;
    const leanToward = (north ? g.dec : -g.dec);
    const tiltWord = S.tilt < 0.5 ? 'With no tilt, nobody leans toward the Sun: every day is 12 hours everywhere, all year.'
      : Math.abs(leanToward) < 0.05 * S.tilt * DEG ? `Near an equinox: neither hemisphere leans toward the Sun, so days are about 12 hours everywhere.`
      : leanToward > 0 ? `Your hemisphere leans <b>toward</b> the Sun: higher Sun, longer days — summer.`
      : `Your hemisphere leans <b>away</b> from the Sun: low Sun, short days — winter.`;
    const rMin = 0.98329, rMax = 1.01671;
    const distNote = S.tilt < 0.5 ? '' : ` Meanwhile Earth is ${g.r < 0.995 ? '<b>closer</b> to' : g.r > 1.005 ? '<b>farther</b> from' : 'at an average distance from'} the Sun than average (only ±${(((rMax / rMin) ** 2 - 1) * 50).toFixed(1)}% sunlight).`;
    $('seasons-why').innerHTML = `<span class="tag">Why</span>${tiltWord}${distNote}`;
  }

  function draw() {
    const { ctx, w, h } = fitCanvas(canvas);
    ctx.fillStyle = '#0a0e1c'; ctx.fillRect(0, 0, w, h);
    drawStars(ctx, w, h, stars, 0.6);
    const g = geo(S.doy);
    const axis = axisDir(S.tilt, 90);
    const Bw = bodyFrame(axis);
    const wide = w > h * 1.25;
    // layout: orbit panel + close-up panel (side by side on wide, stacked on tall)
    const orbitBox = wide ? { x: 0, y: 0, w: w * 0.56, h } : { x: 0, y: 0, w, h: h * 0.46 };
    const closeBox = wide ? { x: w * 0.56, y: 0, w: w * 0.44, h } : { x: 0, y: h * 0.46, w, h: h * 0.54 };

    // ---- orbit view
    const sp = Math.max(Math.sin(cam.pitch * DEG), 0.15);
    cam.cx = orbitBox.x + orbitBox.w / 2; cam.cy = orbitBox.y + orbitBox.h * 0.52;
    cam.scale = Math.min(orbitBox.w * 0.4, (orbitBox.h * 0.36) / sp);
    cam.update();
    ctx.beginPath();
    for (let k = 0; k <= 120; k++) {
      const q = planetPos(earth, YEAR0 + (k / 120) * 365.26);
      const P = cam.project([q.x, q.y, 0]);
      k ? ctx.lineTo(P.x, P.y) : ctx.moveTo(P.x, P.y);
    }
    ctx.strokeStyle = 'rgba(95,176,240,0.35)'; ctx.lineWidth = 1; ctx.stroke();
    const S0 = cam.project([0, 0, 0]);
    const re = Math.max(12, Math.min(orbitBox.w, orbitBox.h) * 0.06) * Math.sqrt(cam.zoom);
    // key dates: ghost Earths with their (parallel) axes
    const keys = [[79, 'Mar'], [172, 'Jun'], [266, 'Sep'], [355, 'Dec']];
    const bodies = keys.map(([doy, name]) => ({ doy, name, ghost: true })).concat([{ doy: S.doy, ghost: false }]);
    const items = bodies.map((b) => { const gg = geo(b.doy); return { ...b, gg, P: cam.project(gg.p) }; });
    items.push({ sun: true, P: S0 });
    items.sort((a, b) => a.P.z - b.P.z);
    for (const it of items) {
      if (it.sun) { drawSun(ctx, S0.x, S0.y, re * 1.5, 2.4); continue; }
      const { P, gg } = it;
      const r = it.ghost ? re * 0.55 : re;
      const sunV = cam.toView(v3.norm(v3.mul(gg.p, -1)));
      const A = cam.toView(axis);
      if (it.ghost) {
        ctx.globalAlpha = 0.45;
        drawGlobe(ctx, P.x, P.y, r, { B: mat.mul(cam.V, Bw), sun: sunV, tiltDeg: S.tilt, grid: false, land: false, res: 1 });
        ctx.globalAlpha = 1;
        const dx = P.x - S0.x, dy = P.y - S0.y, l = Math.hypot(dx, dy) || 1;
        label(ctx, it.name, P.x + (dx / l) * (r + 12), P.y + (dy / l) * (r + 9), { align: 'center', size: 10.5, color: 'rgba(174,182,204,0.75)' });
      } else {
        drawGlobe(ctx, P.x, P.y, r, { B: mat.mul(cam.V, Bw), sun: sunV, tiltDeg: S.tilt, res: 1.5 });
      }
      ctx.strokeStyle = it.ghost ? 'rgba(255,255,255,0.45)' : '#fff'; ctx.lineWidth = it.ghost ? 1 : 1.6;
      ctx.beginPath(); ctx.moveTo(P.x - A[0] * r * 1.6, P.y + A[1] * r * 1.6); ctx.lineTo(P.x + A[0] * r * 1.6, P.y - A[1] * r * 1.6); ctx.stroke();
      if (!it.ghost) label(ctx, 'N', P.x + A[0] * r * 1.6 + 4, P.y - A[1] * r * 1.6 - 4, { size: 10.5, color: '#fff' });
    }
    // perihelion / aphelion marks
    const per = cam.project(geo(3).p), aph = cam.project(geo(185).p);
    const outward = (P, text) => { // label pushed radially away from the Sun
      const dx = P.x - S0.x, dy = P.y - S0.y, l = Math.hypot(dx, dy) || 1;
      const ly = Math.max(orbitBox.y + 10, Math.min(orbitBox.y + orbitBox.h - 8, P.y + (dy / l) * (re + 18)));
      label(ctx, text, P.x + (dx / l) * (re + 30), ly, { align: 'center', size: 10, color: 'rgba(245,185,90,0.8)' });
    };
    outward(per, 'closest · 3 Jan'); outward(aph, 'farthest · 4 Jul');

    // ---- close-up: looking at Earth from the side, Sun to the left
    const s = v3.norm(v3.mul(g.p, -1));         // Earth → Sun
    const c0 = v3.norm(v3.cross([0, 0, 1], s)); // viewer direction (side-on)…
    const c = v3.norm(v3.add(v3.mul(c0, Math.cos(24 * DEG)), [0, 0, Math.sin(24 * DEG)])); // …from a little above
    const x = v3.mul(s, -1), y = v3.cross(c, x);
    const V = [x, y, c];
    const R = Math.min(closeBox.w, closeBox.h) * 0.34;
    const gx = closeBox.x + closeBox.w * 0.56, gy = closeBox.y + closeBox.h * 0.5;
    // sunlight arrows from the left
    ctx.strokeStyle = 'rgba(255,207,110,0.35)'; ctx.lineWidth = 1.2;
    for (let k = -3; k <= 3; k++) {
      const yy = gy + k * R * 0.32;
      ctx.beginPath(); ctx.moveTo(closeBox.x + 10, yy); ctx.lineTo(gx - R * 1.15, yy); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(gx - R * 1.15, yy); ctx.lineTo(gx - R * 1.15 - 6, yy - 3.5); ctx.lineTo(gx - R * 1.15 - 6, yy + 3.5); ctx.closePath();
      ctx.fillStyle = 'rgba(255,207,110,0.5)'; ctx.fill();
    }
    label(ctx, 'sunlight →', closeBox.x + 12, gy - R * 1.12, { size: 11, color: 'rgba(255,207,110,0.85)' });
    const B = mat.mul(V, Bw);
    const sunView = mat.apply(V, s);
    // put your longitude on the visible face, at the sunlit edge-ish so the circle reads clearly
    const cb = mat.applyT(Bw, c);
    const lonFace = Math.atan2(cb[1], cb[0]);
    drawGlobe(ctx, gx, gy, R, { B, sun: sunView, tiltDeg: S.tilt, spin: 0, res: 1.4, observer: { lat: S.lat, lon: lonFace } });
    // axis
    const A = mat.apply(V, axis);
    ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.6;
    ctx.beginPath(); ctx.moveTo(gx - A[0] * R * 1.3, gy + A[1] * R * 1.3); ctx.lineTo(gx + A[0] * R * 1.3, gy - A[1] * R * 1.3); ctx.stroke();
    label(ctx, 'N', gx + A[0] * R * 1.3 + 5, gy - A[1] * R * 1.3 - 5, { size: 12, color: '#fff', weight: 600 });
    // your latitude circle: yellow where it's day, blue where it's night; dashed on the far side
    const N = 180;
    for (let k = 0; k < N; k++) {
      const pt = (kk) => {
        const lo = (kk / N) * TAU;
        const pb = [Math.cos(S.lat) * Math.cos(lo), Math.cos(S.lat) * Math.sin(lo), Math.sin(S.lat)];
        return mat.apply(B, pb);
      };
      const a = pt(k), b = pt(k + 1);
      const mid = v3.mul(v3.add(a, b), 0.5);
      const lit = v3.dot(mid, sunView) > 0;
      const front = mid[2] > 0;
      ctx.strokeStyle = lit ? (front ? '#ffd27a' : 'rgba(255,210,122,0.35)') : (front ? '#6fa8ff' : 'rgba(111,168,255,0.3)');
      ctx.lineWidth = front ? 3 : 1.5;
      ctx.beginPath(); ctx.moveTo(gx + a[0] * R, gy - a[1] * R); ctx.lineTo(gx + b[0] * R, gy - b[1] * R); ctx.stroke();
    }
    const dl = dayLengthHours(S.lat, g.dec);
    label(ctx, `your latitude: ${Math.round((dl / 24) * 100)}% of the circle in daylight`, closeBox.x + closeBox.w / 2, closeBox.y + closeBox.h - 14, { align: 'center', size: 11.5, color: 'rgba(237,240,247,0.85)' });
    label(ctx, fmtDayMonth(dateFromJ2000(g.d)), closeBox.x + closeBox.w - 12, closeBox.y + 18, { size: 12.5, align: 'right', color: 'rgba(237,240,247,0.8)', weight: 600 });
    if (!wide) { ctx.fillStyle = 'rgba(170,185,230,0.12)'; ctx.fillRect(12, closeBox.y, w - 24, 1); }
    else { ctx.fillStyle = 'rgba(170,185,230,0.12)'; ctx.fillRect(closeBox.x, 12, 1, h - 24); }
  }

  function drawChart() {
    const { ctx, w, h } = fitCanvas(chart);
    ctx.fillStyle = '#0a0e1c'; ctx.fillRect(0, 0, w, h);
    const x0 = 34, x1 = w - 10, y0 = 14, y1 = h - 22;
    const X = (doy) => x0 + (doy / 365.25) * (x1 - x0);
    const isDay = S.mode === 'day';
    const f = (doy, lat) => {
      const g = geo(doy);
      return isDay ? dayLengthHours(lat, g.dec) : dailyInsolation(lat, g.dec, g.r);
    };
    const ymax = isDay ? 24 : 560;
    const Y = (v) => y1 - (v / ymax) * (y1 - y0);
    // grid
    ctx.strokeStyle = 'rgba(170,185,230,0.1)'; ctx.lineWidth = 1;
    const ticks = isDay ? [0, 6, 12, 18, 24] : [0, 200, 400];
    for (const t of ticks) {
      ctx.beginPath(); ctx.moveTo(x0, Y(t)); ctx.lineTo(x1, Y(t)); ctx.stroke();
      label(ctx, isDay ? `${t}h` : `${t}`, x0 - 5, Y(t), { align: 'right', size: 10, color: 'rgba(174,182,204,0.6)' });
    }
    const months = ['J', 'F', 'M', 'A', 'M', 'J', 'J', 'A', 'S', 'O', 'N', 'D'];
    months.forEach((m, i) => label(ctx, m, X(i * 30.44 + 15), h - 9, { align: 'center', size: 10, color: 'rgba(174,182,204,0.6)' }));
    const curve = (lat, color, lw) => {
      ctx.strokeStyle = color; ctx.lineWidth = lw; ctx.beginPath();
      for (let k = 0; k <= 146; k++) { const doy = (k / 146) * 365.25; const v = f(doy, lat); k ? ctx.lineTo(X(doy), Y(v)) : ctx.moveTo(X(doy), Y(v)); }
      ctx.stroke();
    };
    if (Math.abs(S.lat) > 0.01) curve(-S.lat, 'rgba(111,168,255,0.55)', 1.5);
    curve(S.lat, '#ffd27a', 2.2);
    const v = f(S.doy, S.lat);
    ctx.fillStyle = 'rgba(255,255,255,0.25)'; ctx.fillRect(X(S.doy) - 0.5, y0, 1, y1 - y0);
    ctx.fillStyle = '#ff5a5a'; ctx.beginPath(); ctx.arc(X(S.doy), Y(v), 4.5, 0, TAU); ctx.fill();
    const latTxt = `${Math.abs(S.lat / DEG).toFixed(0)}°${S.lat >= 0 ? 'N' : 'S'}`;
    const mirTxt = `${Math.abs(S.lat / DEG).toFixed(0)}°${S.lat >= 0 ? 'S' : 'N'}`;
    label(ctx, `— you (${latTxt})`, x1 - 4, y0 + 2, { align: 'right', size: 10.5, color: '#ffd27a' });
    if (Math.abs(S.lat) > 0.01) label(ctx, `— mirror (${mirTxt})`, x1 - 4, y0 + 16, { align: 'right', size: 10.5, color: 'rgba(111,168,255,0.9)' });
    if (!isDay) label(ctx, 'W/m², 24-h average, top of atmosphere', x0 + 4, y0 + 2, { size: 10, color: 'rgba(174,182,204,0.6)' });
  }

  visibleLoop(canvas, frame);
  new ResizeObserver(() => (dirty = true)).observe(canvas);
  window.__seasons = { S, redraw: () => { dirty = true; draw(); drawChart(); readouts(); } };
}
