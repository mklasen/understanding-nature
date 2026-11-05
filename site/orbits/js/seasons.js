// Chapter 2 — seasons from axial tilt, in the shared world. Earth on its real orbit; the tilt slider changes
// Earth's actual obliquity in the model (axis, spin, declination all follow).
import { DEG, TAU, AU, daysSinceJ2000, dateFromJ2000, fmtDayMonth, declination, dayLengthHours, noonAltitude, dailyInsolation, fmtHM, sunFromEarth } from './astro.js';
import { World } from './world.js';
import { Viewer, atLocalTime } from './viewer.js';
import { v3, label, arrow } from './draw.js';
import { fitCanvas, bindRange, setRange, $ } from '../../kit/util.js';

const YEAR0 = daysSinceJ2000(Date.UTC(new Date().getUTCFullYear(), 0, 1));
const LON = 4.9;

export function initSeasons() {
  const world = new World({ bodies: ['sun', 'earth'] });
  const S = { lat: 52 * DEG, mode: 'day' };
  const place = { name: 'You', lat: 52, lon: LON };
  const geo = (d) => { const s = sunFromEarth(d); return { lambda: s.lambda, r: s.r, dec: declination(s.lambda, world.tilt) }; };
  const doyOf = (d) => { const x = (d - YEAR0) % 365.25; return x < 0 ? x + 365.25 : x; };
  const minWH = (a) => Math.min(a.w, a.h);
  let lastKey = ''; // declared early: bindRange() fires immediately and calls sync()

  // ---- overlays
  const axisLine = (a, id = 'earth', k = 1.6) => {
    const { ctx, st, project } = a, E = st.bodies[id], dr = a.viewer.drawn[id]; if (!dr || !E.frame) return;
    const ax = [E.frame[0][2], E.frame[1][2], E.frame[2][2]];
    const p0 = project(E.pos), p1 = project(v3.add(E.pos, v3.mul(ax, 1000))); if (!p0 || !p1) return;
    const dx = p1.x - p0.x, dy = p1.y - p0.y, l = Math.hypot(dx, dy) || 1;
    ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(p0.x - (dx / l) * dr.R * k, p0.y - (dy / l) * dr.R * k); ctx.lineTo(p0.x + (dx / l) * dr.R * k, p0.y + (dy / l) * dr.R * k); ctx.stroke();
    label(ctx, 'N', p0.x + (dx / l) * (dr.R * k + 7), p0.y + (dy / l) * (dr.R * k + 7), { align: 'center', size: 11, weight: 600, color: '#fff' });
  };
  const yearMarks = (a) => {
    const { ctx, project } = a;
    const marks = [[79, 'Mar equinox'], [172, 'Jun solstice'], [265, 'Sep equinox'], [355, 'Dec solstice'], [3, 'closest · 3 Jan'], [185, 'farthest · 4 Jul']];
    for (const [doy, name] of marks) {
      const p = project(world.pos('earth', YEAR0 + doy)); if (!p) continue;
      const close = name.includes('·');
      ctx.fillStyle = close ? 'rgba(245,185,90,0.8)' : 'rgba(237,240,247,0.5)';
      ctx.beginPath(); ctx.arc(p.x, p.y, 2.5, 0, TAU); ctx.fill();
      label(ctx, name, p.x, p.y + (close ? -12 : 14), { align: 'center', size: 10, color: close ? 'rgba(245,185,90,0.85)' : 'rgba(174,182,204,0.75)' });
    }
    axisLine(a);
  };
  const globeLines = (a) => {
    const { ctx, st, project, B } = a, E = st.bodies.earth;
    const sunDir = v3.norm(v3.mul(E.pos, -1));
    const ring = (latDeg, style, dayNight) => {
      const la = latDeg * DEG; let prev = null;
      for (let k = 0; k <= 144; k++) {
        const lo = (k / 144) * TAU;
        const nb = [Math.cos(la) * Math.cos(lo), Math.cos(la) * Math.sin(lo), Math.sin(la)];
        const n = [0, 1, 2].map((i) => E.frame[i][0] * nb[0] + E.frame[i][1] * nb[1] + E.frame[i][2] * nb[2]);
        const P = v3.add(E.pos, v3.mul(n, E.r * 1.003));
        const front = v3.dot(n, v3.sub(B.eye, P)) > 0;
        const p = project(P);
        if (prev && p && (front || dayNight)) {
          ctx.strokeStyle = dayNight ? (v3.dot(n, sunDir) > 0 ? (front ? '#ffd27a' : 'rgba(255,210,122,0.25)') : (front ? '#6fa8ff' : 'rgba(111,168,255,0.22)')) : style;
          ctx.lineWidth = dayNight ? (front ? 3 : 1.4) : 1.1;
          ctx.beginPath(); ctx.moveTo(prev.x, prev.y); ctx.lineTo(p.x, p.y); ctx.stroke();
        }
        prev = p;
      }
    };
    const t = world.tilt;
    ring(0, 'rgba(255,255,255,0.6)');
    if (t > 0.5) { ring(t, 'rgba(255,196,96,0.7)'); ring(-t, 'rgba(255,196,96,0.7)'); }
    if (t > 0.5 && t < 89.5) { ring(90 - t, 'rgba(150,210,255,0.7)'); ring(t - 90, 'rgba(150,210,255,0.7)'); }
    ring(S.lat / DEG, null, true);
    axisLine(a, 'earth', 1.35);
    for (let k = -3; k <= 3; k++) arrow(ctx, 8, a.h / 2 + k * a.h * 0.1, 40, a.h / 2 + k * a.h * 0.1, 'rgba(255,207,110,0.6)', 1.2, 6);
    label(ctx, 'sunlight', 8, a.h / 2 - a.h * 0.33, { size: 10.5, color: 'rgba(255,207,110,0.85)' });
    const dl = dayLengthHours(S.lat, geo(a.d).dec);
    label(ctx, `your latitude: ${Math.round((dl / 24) * 100)}% of its circle in daylight`, 12, 36, { align: 'left', size: 11.5, color: 'rgba(237,240,247,0.85)' });
  };
  const sunPaths = (a) => {
    const { ctx, projectDir, pose } = a; const site0 = pose.site; if (!site0) return;
    const path = (day, style, lw, marks) => {
      ctx.strokeStyle = style; ctx.lineWidth = lw; ctx.beginPath(); let on = false;
      for (let h = 0; h <= 24; h += 0.25) {
        const d = atLocalTime(day, LON, h), st = world.state(d), si = world.site(d, place.lat, LON, st.bodies.earth);
        const sv = v3.norm(v3.sub(st.bodies.sun.pos, si.pos));
        const e = v3.dot(sv, si.east), n = v3.dot(sv, si.north), u = v3.dot(sv, si.up);
        const dir = v3.add(v3.add(v3.mul(site0.east, e), v3.mul(site0.north, n)), v3.mul(site0.up, u));
        const p = u > -0.02 ? projectDir(dir) : null;
        if (!p) { on = false; continue; }
        on ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y); on = true;
        if (marks && Math.abs(h % 3) < 0.01 && u > 0) { ctx.stroke(); ctx.fillStyle = style; ctx.beginPath(); ctx.arc(p.x, p.y, 2.5, 0, TAU); ctx.fill(); label(ctx, `${h}:00`, p.x, p.y - 10, { align: 'center', size: 9.5, color: 'rgba(255,230,170,0.8)' }); ctx.beginPath(); ctx.moveTo(p.x, p.y); }
      }
      ctx.stroke();
    };
    ctx.setLineDash([3, 5]);
    path(YEAR0 + 171, 'rgba(255,207,110,0.45)', 1.2); path(YEAR0 + 354, 'rgba(111,168,255,0.55)', 1.2);
    ctx.setLineDash([]);
    path(a.d, '#ffd27a', 2.2, true);
    label(ctx, '— today   ┄ June (yellow) and December (blue) paths', 12, 36, { size: 10.5, color: 'rgba(237,240,247,0.75)' });
  };

  const viewer = new Viewer($('seasons-canvas'), {
    model: world, d: atLocalTime(daysSinceJ2000(Date.now()), LON, 12),
    rates: [[0, 'Paused'], [1 / 24, '1 h/s'], [3, '3 days/s'], [30, '1 month/s']], scaleToggle: false,
    views: [
      { id: 'year', label: 'The year from above', rate: 0, orbits: ['earth'], boost: { earth: 2500 }, floor: { sun: (a) => minWH(a) * 0.04 },
        cam: { mode: 'orbit', target: 'sun', dist: 3.1 * AU, yaw: -90, pitch: 30, fov: 40 }, over: yearMarks, hideLabels: ['earth', 'sun'] },
      { id: 'beside', label: 'Beside Earth', rate: 0, labels: false,
        cam: { mode: 'orbit', target: 'earth', dist: 4.6e4, yaw: 90, pitch: 18, fov: 40, sunLocked: true }, over: globeLines,
        note: () => 'The camera keeps the Sun to the left as Earth goes round.' },
      { id: 'ground', label: 'Standing at your latitude', rate: 0, floor: { sun: (a) => minWH(a) * 0.03 }, constellations: false,
        cam: { mode: 'ground', place, az: 180, alt: 30, fov: 112 }, over: sunPaths,
        enter: (v) => { v.cam.az = place.lat >= 0 ? 180 : 0; v.cam.place = place; },
        title: () => `Latitude ${Math.abs(place.lat).toFixed(0)}°${place.lat >= 0 ? 'N' : 'S'} · facing ${place.lat >= 0 ? 'south' : 'north'}` },
    ],
    onTick: () => sync(),
  });

  const dateIn = $('seasons-date');
  dateIn.addEventListener('input', () => { viewer.setRate(0); viewer.d = atLocalTime(YEAR0 + parseFloat(dateIn.value), LON, 12); sync(true); });
  bindRange($('seasons-tilt'), (v) => { world.tilt = v; $('seasons-tilt-out').textContent = `${v.toFixed(1)}°${Math.abs(v - 23.44) < 0.05 ? ' (Earth)' : v > 89 ? ' (on its side)' : ''}`; sync(true); });
  bindRange($('seasons-lat'), (v) => {
    S.lat = v * DEG; place.lat = v;
    $('seasons-lat-out').textContent = `${Math.abs(v).toFixed(0)}° ${v >= 0 ? 'N' : 'S'}${latName(v)}`;
    if (viewer.cam.mode === 'ground') viewer.cam.az = v >= 0 ? 180 : 0;
    sync(true);
  });
  document.querySelectorAll('#seasons [data-tilt]').forEach((b) => b.addEventListener('click', () => setRange($('seasons-tilt'), parseFloat(b.dataset.tilt))));
  $('seasons-chart-mode').addEventListener('click', (e) => {
    const b = e.target.closest('button'); if (!b) return;
    S.mode = b.dataset.mode;
    $('seasons-chart-mode').querySelectorAll('button').forEach((x) => x.classList.toggle('on', x === b));
    sync(true);
  });
  function latName(v) {
    if (Math.abs(v) < 1) return ' · equator';
    if (Math.abs(v - 52) < 1.5) return ' · Amsterdam';
    if (Math.abs(v + 34) < 1.5) return ' · Sydney';
    if (Math.abs(v - 40.7) < 1) return ' · New York';
    if (Math.abs(v) > 89) return ' · pole';
    return '';
  }

  function sync(force) {
    const doy = doyOf(viewer.d);
    if (document.activeElement !== dateIn) { dateIn.value = doy; dateIn.style.setProperty('--fill', `${(doy / 365) * 100}%`); }
    $('seasons-date-out').textContent = fmtDayMonth(dateFromJ2000(viewer.d));
    const key = `${Math.round(doy * 4)}|${world.tilt}|${S.lat}|${S.mode}`;
    if (!force && key === lastKey) return;
    lastKey = key;
    readouts(); drawChart();
  }

  function readouts() {
    const g = geo(viewer.d);
    const dl = dayLengthHours(S.lat, g.dec);
    $('seasons-day').textContent = dl <= 0.01 ? 'none (polar night)' : dl >= 23.99 ? '24 h (midnight sun)' : fmtHM(dl);
    const alt = noonAltitude(S.lat, g.dec) / DEG;
    $('seasons-noon').textContent = alt <= 0 ? 'below horizon' : `${alt.toFixed(0)}°`;
    $('seasons-ins').textContent = `${Math.round(dailyInsolation(S.lat, g.dec, g.r))} W`;
    $('seasons-dist').textContent = `${(g.r * AU / 1e6).toFixed(1)} M km`;
    const lean = S.lat >= 0 ? g.dec : -g.dec;
    const tiltWord = world.tilt < 0.5 ? 'With no tilt, nobody leans toward the Sun: every day is 12 hours everywhere, all year.'
      : Math.abs(lean) < 0.05 * world.tilt * DEG ? 'Near an equinox: neither hemisphere leans toward the Sun, so days are about 12 hours everywhere.'
      : lean > 0 ? 'Your hemisphere leans <b>toward</b> the Sun: higher Sun, longer days — summer.'
      : 'Your hemisphere leans <b>away</b> from the Sun: low Sun, short days — winter.';
    const distNote = world.tilt < 0.5 ? '' : ` Meanwhile Earth is ${g.r < 0.995 ? '<b>closer</b> to' : g.r > 1.005 ? '<b>farther</b> from' : 'at an average distance from'} the Sun than average (only ±3.4% sunlight).`;
    $('seasons-why').innerHTML = `<span class="tag">Why</span>${tiltWord}${distNote}`;
  }

  function drawChart() {
    const { ctx, w, h } = fitCanvas($('seasons-chart'));
    ctx.fillStyle = '#0a0e1c'; ctx.fillRect(0, 0, w, h);
    const x0 = 34, x1 = w - 10, y0 = 14, y1 = h - 22;
    const X = (doy) => x0 + (doy / 365.25) * (x1 - x0);
    const isDay = S.mode === 'day';
    const f = (doy, lat) => { const g = geo(YEAR0 + doy); return isDay ? dayLengthHours(lat, g.dec) : dailyInsolation(lat, g.dec, g.r); };
    const ymax = isDay ? 24 : 560, Y = (v) => y1 - (v / ymax) * (y1 - y0);
    ctx.strokeStyle = 'rgba(170,185,230,0.1)'; ctx.lineWidth = 1;
    for (const t of isDay ? [0, 6, 12, 18, 24] : [0, 200, 400]) { ctx.beginPath(); ctx.moveTo(x0, Y(t)); ctx.lineTo(x1, Y(t)); ctx.stroke(); label(ctx, isDay ? `${t}h` : `${t}`, x0 - 5, Y(t), { align: 'right', size: 10, color: 'rgba(174,182,204,0.6)' }); }
    'JFMAMJJASOND'.split('').forEach((m, i) => label(ctx, m, X(i * 30.44 + 15), h - 9, { align: 'center', size: 10, color: 'rgba(174,182,204,0.6)' }));
    const curve = (lat, color, lw) => { ctx.strokeStyle = color; ctx.lineWidth = lw; ctx.beginPath(); for (let k = 0; k <= 146; k++) { const doy = (k / 146) * 365.25, v = f(doy, lat); k ? ctx.lineTo(X(doy), Y(v)) : ctx.moveTo(X(doy), Y(v)); } ctx.stroke(); };
    if (Math.abs(S.lat) > 0.01) curve(-S.lat, 'rgba(111,168,255,0.55)', 1.5);
    curve(S.lat, '#ffd27a', 2.2);
    const doy = doyOf(viewer.d), v = f(doy, S.lat);
    ctx.fillStyle = 'rgba(255,255,255,0.25)'; ctx.fillRect(X(doy) - 0.5, y0, 1, y1 - y0);
    ctx.fillStyle = '#ff5a5a'; ctx.beginPath(); ctx.arc(X(doy), Y(v), 4.5, 0, TAU); ctx.fill();
    const a = Math.abs(S.lat / DEG).toFixed(0);
    label(ctx, `— you (${a}°${S.lat >= 0 ? 'N' : 'S'})`, x1 - 4, y0 + 2, { align: 'right', size: 10.5, color: '#ffd27a' });
    if (Math.abs(S.lat) > 0.01) label(ctx, `— mirror (${a}°${S.lat >= 0 ? 'S' : 'N'})`, x1 - 4, y0 + 16, { align: 'right', size: 10.5, color: 'rgba(111,168,255,0.9)' });
    if (!isDay) label(ctx, 'W/m², 24-h average, top of atmosphere', x0 + 4, y0 + 2, { size: 10, color: 'rgba(174,182,204,0.6)' });
  }

  sync(true);
  window.__seasons = { viewer, world, S };
}
