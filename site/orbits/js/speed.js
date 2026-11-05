// Chapter 8 — how fast are we going, relative to what. One Earth, four frames of reference, one shared world.
// Directions (ecliptic coordinates, derived from galactic l/b):
//   galactic rotation (l = 90°, b = 0°)   → λ ≈ 347°, β ≈ +59.6°  — Sun's motion around the Milky Way
//   CMB dipole        (l = 264°, b = 48°) → λ ≈ 172°, β ≈ −11°    — Sun's motion vs the cosmic background
// In those frames the model is the real world plus a uniform drift of everything at the Sun's velocity.
// Ignored: solar peculiar motion (~20 km/s), the galaxy's curvature over a few years, the Moon's wobble.
import { DEG, TAU, AU, DAY, daysSinceJ2000, SPEEDS, R_EARTH } from './astro.js';
import { World } from './world.js';
import { Viewer } from './viewer.js';
import { v3, label } from './draw.js';
import { bindRange, $ } from '../../kit/util.js';

const dirFrom = (lam, beta) => [Math.cos(beta * DEG) * Math.cos(lam * DEG), Math.cos(beta * DEG) * Math.sin(lam * DEG), Math.sin(beta * DEG)];
const U = { galaxy: dirFrom(347, 59.6), cmb: dirFrom(171.7, -11.1) };
const V = { galaxy: SPEEDS.galactic, cmb: SPEEDS.sunVsCMB };
const KMH = (kms) => kms * 3600;

export function initSpeed() {
  const world = new World({ bodies: ['sun', 'earth'] });
  const t0 = performance.now();
  const S = { frame: 'earth', squeeze: false, lat: 52, dRef: daysSinceJ2000(Date.now()) };
  const drift = (d) => { // offset of the whole solar system at time d in the chosen frame (km)
    if (!U[S.frame]) return [0, 0, 0];
    return v3.mul(U[S.frame], V[S.frame] * (S.squeeze ? 1 / 20 : 1) * (d - S.dRef) * DAY);
  };
  const model = {
    state(d) { const s = world.state(d), o = drift(d); for (const id in s.bodies) s.bodies[id].pos = v3.add(s.bodies[id].pos, o); return s; },
    path: (id, d) => world.path(id, d).map((p) => v3.add(p, drift(d))),
    site: (...a) => world.site(...a), pos: (id, d) => v3.add(world.pos(id, d), drift(d)),
  };
  let acc = 1;
  const span = () => (S.squeeze ? 3 : 1.6) * 365.25;
  const minWH = (a) => Math.min(a.w, a.h);

  // ---- overlays
  const latCircle = (a) => { // Earth's frame: you go round your circle of latitude once a day
    const { ctx, st, project, B } = a, E = st.bodies.earth, la = S.lat * DEG;
    let prev = null;
    for (let k = 0; k <= 144; k++) {
      const lo = (k / 144) * TAU, nb = [Math.cos(la) * Math.cos(lo), Math.cos(la) * Math.sin(lo), Math.sin(la)];
      const n = [0, 1, 2].map((i) => E.frame[i][0] * nb[0] + E.frame[i][1] * nb[1] + E.frame[i][2] * nb[2]);
      const P = v3.add(E.pos, v3.mul(n, E.r * 1.004)), p = project(P), front = v3.dot(n, v3.sub(B.eye, P)) > 0;
      if (prev && p) { ctx.strokeStyle = front ? '#f5b95a' : 'rgba(245,185,90,0.22)'; ctx.lineWidth = front ? 2.5 : 1.3; ctx.beginPath(); ctx.moveTo(prev.x, prev.y); ctx.lineTo(p.x, p.y); ctx.stroke(); }
      prev = p;
    }
    const site = world.site(a.d, S.lat, 4.9, E), pp = project(site.pos);
    if (pp && v3.dot(site.up, v3.sub(B.eye, site.pos)) > 0) { ctx.fillStyle = '#ff5a5a'; ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(pp.x, pp.y, 5, 0, TAU); ctx.fill(); ctx.stroke(); label(ctx, 'you', pp.x + 8, pp.y - 8, { size: 11, color: '#ff9a9a' }); }
    label(ctx, 'Your path: a circle, once a day', 12, a.h - 14, { size: 11, color: '#f5b95a' });
  };
  const corkscrew = (a) => {
    const { ctx, project } = a, sp = span();
    const s0 = project(drift(a.d - sp)), s1 = project(drift(a.d));
    if (s0 && s1) { ctx.strokeStyle = 'rgba(255,207,110,0.55)'; ctx.lineWidth = 1.5; ctx.setLineDash([5, 5]); ctx.beginPath(); ctx.moveTo(s0.x, s0.y); ctx.lineTo(s1.x, s1.y); ctx.stroke(); ctx.setLineDash([]); }
    let prev = null;
    for (let k = 0; k <= 500; k++) {
      const t = a.d - sp + (k / 500) * sp, p = project(model.pos('earth', t));
      if (prev && p) { const f = k / 500; ctx.strokeStyle = `rgba(245,185,90,${(0.15 + 0.85 * f).toFixed(2)})`; ctx.lineWidth = 1 + 1.5 * f; ctx.beginPath(); ctx.moveTo(prev.x, prev.y); ctx.lineTo(p.x, p.y); ctx.stroke(); }
      prev = p;
    }
    label(ctx, `motion → · ${Math.round((V[S.frame] * sp * DAY) / AU)} AU of real travel (${(sp / 365.25).toFixed(1)} years)`, 12, a.h - 14, { size: 11, color: '#f5b95a' });
  };
  // camera for drifting frames: side-on to the motion, centred on the trail
  const sideOn = (v) => {
    const u = U[S.frame], ref = [0, 0, 1];
    const side = v3.norm(v3.add(v3.norm(v3.cross(u, ref)), v3.mul(ref, 0.45)));
    v.cam.yaw = Math.atan2(side[1], side[0]) / DEG; v.cam.pitch = Math.asin(side[2]) / DEG;
    const L = V[S.frame] * (S.squeeze ? 1 / 20 : 1) * span() * DAY;
    v.cam.dist = (L * 0.62) / Math.tan(20 * DEG) + 3 * AU;
  };
  const drifting = (id, title) => ({
    id, label: title, rate: 120, floor: { sun: 6, earth: 4 }, hideLabels: ['earth'],
    cam: { mode: 'orbit', target: (st) => v3.sub(st.bodies.sun.pos, v3.mul(U[id], V[id] * (S.squeeze ? 1 / 20 : 1) * span() * DAY * 0.5)), dist: 100 * AU, yaw: 0, pitch: 20, fov: 40 },
    enter: (v) => { S.frame = id; S.dRef = v.d; sideOn(v); }, over: corkscrew,
    note: () => (S.squeeze ? '<b>Squeezed:</b> the Sun is slowed down 20× here so you can see the coils. In reality each coil is ' : 'Each year the Sun moves ') + `${Math.round((V[id] * 365.25 * DAY) / AU)} AU while Earth circles it at just 1 AU${S.squeeze ? '.' : ' — so the "corkscrew" is a gently wavy line. Zoom in to see the wiggle.'}`,
  });

  const viewer = new Viewer($('speed-canvas'), {
    model, d: S.dRef,
    rates: [[0, 'Paused'], [1 / 8, '3 h/s'], [36, '5 weeks/s'], [120, '4 months/s']],
    views: [
      { id: 'earth', label: 'Earth', rate: 1 / 8, labels: false, cam: { mode: 'orbit', target: 'earth', dist: 3.4e4, yaw: -70, pitch: 38, fov: 40 }, over: latCircle,
        enter: () => { S.frame = 'earth'; }, note: () => `Your circle is ${Math.round(TAU * R_EARTH * Math.cos(S.lat * DEG)).toLocaleString('en')} km around.` },
      { id: 'sun', label: 'Sun', rate: 36, orbits: ['earth'], floor: { sun: (a) => minWH(a) * 0.03, earth: 5 },
        cam: { mode: 'orbit', target: 'sun', dist: 3.2 * AU, yaw: -90, pitch: 40, fov: 40 }, enter: () => { S.frame = 'sun'; },
        note: () => 'Your daily spin-loops (13,000 km across at most) are about 20,000× smaller than this orbit — far too small to see here.' },
      drifting('galaxy', 'Milky Way'),
      drifting('cmb', 'Cosmic background'),
    ],
    onView: (v) => {
      document.querySelectorAll('#speed-rows .speed-row').forEach((r) => r.classList.toggle('on', r.dataset.frame === v.id));
      $('speed-squeeze').style.display = U[v.id] ? '' : 'none';
      $('speed-lat-ctl').style.display = v.id === 'earth' ? '' : 'none';
    },
    onTick: (dt) => { if ((acc += dt) > 0.2) { acc = 0; readouts(); } },
  });
  // the speed rows are the frame switch
  document.querySelectorAll('#speed-rows .speed-row').forEach((r) => r.addEventListener('click', () => viewer.setView(r.dataset.frame)));
  if (viewer.chips) viewer.chips.style.display = 'none';
  $('speed-squeeze').addEventListener('click', () => {
    S.squeeze = !S.squeeze;
    $('speed-squeeze').classList.toggle('on', S.squeeze);
    $('speed-squeeze').textContent = S.squeeze ? 'True proportions' : 'Squeeze the coils';
    viewer.setView(viewer.view.id);
  });
  bindRange($('speed-lat'), (v) => { S.lat = v; $('speed-lat-out').textContent = `${v}°${v === 52 ? ' · Amsterdam' : v === 0 ? ' · equator' : v === 90 ? ' · pole' : ''}`; });

  const earthVel = (d) => { const a = world.pos('earth', d - 0.01), b = world.pos('earth', d + 0.01); return v3.mul(v3.sub(b, a), 1 / (0.02 * DAY)); };
  const fmtKm = (km) => (km < 1000 ? `${km.toFixed(km < 10 ? 2 : 0)} km` : km < 1e6 ? `${Math.round(km).toLocaleString('en')} km` : `${(km / 1e6).toFixed(2)} million km`);
  function readouts() {
    const sec = (performance.now() - t0) / 1000, today = daysSinceJ2000(Date.now());
    const sp = { earth: SPEEDS.spinEquator * Math.cos(S.lat * DEG), sun: v3.len(earthVel(today)), galaxy: SPEEDS.galactic, cmb: SPEEDS.sunVsCMB };
    for (const k of Object.keys(sp)) { $(`sp-${k}`).textContent = `${Math.round(KMH(sp[k])).toLocaleString('en')} km/h`; $(`sd-${k}`).textContent = fmtKm(sp[k] * sec); }
    const tot = v3.add(v3.mul(U.cmb, SPEEDS.sunVsCMB), earthVel(today)), v = v3.len(tot), proj = v3.dot(earthVel(today), U.cmb);
    $('speed-total').textContent = `${Math.round(v)} km/s · ${(KMH(v) / 1e6).toFixed(2)} million km/h`;
    $('speed-total-note').textContent = `Today Earth's orbit is carrying you ${proj > 0 ? 'along with' : 'against'} the Sun's motion (${proj > 0 ? '+' : '−'}${Math.abs(proj).toFixed(0)} km/s). Over a year this swings between about ${Math.round(SPEEDS.sunVsCMB - 29)} and ${Math.round(SPEEDS.sunVsCMB + 29)} km/s. (Your spin adds less than 0.5 km/s.)`;
  }
  readouts();
  window.__speed = { viewer, S };
}
