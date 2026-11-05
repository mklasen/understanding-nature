// Chapter 3 — the Moon, in the shared world. Three viewpoints on the *real* Earth–Moon–Sun at any date:
// above the North Pole (phases & locking), standing on Earth (which side is lit), and from space (your horizon).
import { DEG, TAU, SYNODIC_MONTH, NEW_MOON_EPOCH, daysSinceJ2000, moonAge, phaseName } from './astro.js';
import { World } from './world.js';
import { Viewer, atLocalTime, PLACES } from './viewer.js';
import { v3, label } from './draw.js';
import { $ } from '../../kit/util.js';

const COMPASS = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
const compass = (az) => COMPASS[Math.round((((az / DEG) % 360) + 360) % 360 / 45) % 8];
const clock = (h) => { h = ((h % 24) + 24) % 24; const hh = Math.floor(h), mm = Math.round((h - hh) * 4) * 15; return `${String(mm === 60 ? (hh + 1) % 24 : hh).padStart(2, '0')}:${String(mm % 60).padStart(2, '0')}`; };

export function initMoon() {
  const world = new World({ bodies: ['sun', 'venus', 'earth', 'moon', 'mars', 'jupiter'] });
  let locked = true, fixedFrame = null, place = PLACES.ams;
  const model = {
    state(d) { const s = world.state(d); if (!locked && fixedFrame) s.bodies.moon.frame = fixedFrame; return s; },
    path: (id, d) => world.path(id, d), site: (...a) => world.site(...a), pos: (id, d) => world.pos(id, d),
  };
  const now = daysSinceJ2000(Date.now());
  const minWH = (a) => Math.min(a.w, a.h);

  const local = (d) => {
    const st = world.state(d), site = world.site(d, place.lat, place.lon, st.bodies.earth);
    const dir = (id) => v3.norm(v3.sub(st.bodies[id].pos, site.pos));
    const altaz = (v) => ({ alt: Math.asin(v3.dot(v, site.up)), az: Math.atan2(v3.dot(v, site.east), v3.dot(v, site.north)) });
    const m = dir('moon'), s = dir('sun');
    return { st, site, m, s, moon: altaz(m), sun: altaz(s) };
  };
  const localHours = (d) => { let t = (d + 0.5 + place.lon / 360) % 1; if (t < 0) t += 1; return t * 24; };
  const scanDay = (d, fn) => { const out = []; for (let h = 0; h <= 24; h += 0.25) out.push({ h, ...fn(atLocalTime(d, place.lon, h)) }); return out; };

  // ---- overlays
  const shadowAndNearSide = (a) => {
    const { ctx, st, project } = a;
    const E = st.bodies.earth, M = st.bodies.moon;
    const pe = project(E.pos), dE = a.viewer.drawn.earth;
    if (pe && dE) { // Earth's shadow points away from the Sun and tapers to nothing ~1.38 million km out
      const p1 = project(v3.add(E.pos, v3.mul(v3.norm(E.pos), 1.38e6)));
      if (p1) {
        const ang = Math.atan2(p1.y - pe.y, p1.x - pe.x), L = Math.hypot(p1.x - pe.x, p1.y - pe.y);
        ctx.save(); ctx.translate(pe.x, pe.y); ctx.rotate(ang);
        ctx.fillStyle = 'rgba(0,0,0,0.5)'; ctx.beginPath(); ctx.moveTo(0, -dE.R); ctx.lineTo(L, 0); ctx.lineTo(0, dE.R); ctx.closePath(); ctx.fill();
        ctx.restore();
        label(ctx, "Earth's shadow", pe.x + (p1.x - pe.x) * 0.35, pe.y + (p1.y - pe.y) * 0.35 + 14, { align: 'center', size: 10.5, color: 'rgba(174,182,204,0.65)' });
      }
    }
  };
  const nearSide = (a) => {
    const { ctx, st, project } = a, M = st.bodies.moon, dM = a.viewer.drawn.moon;
    if (!dM || !M.frame) return;
    const nx = [M.frame[0][0], M.frame[1][0], M.frame[2][0]];
    const pm = project(M.pos), pn = project(v3.add(M.pos, v3.mul(nx, 2e4)));
    if (!pm || !pn) return;
    const ang = Math.atan2(pn.y - pm.y, pn.x - pm.x);
    ctx.strokeStyle = '#ff6b6b'; ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.arc(pm.x, pm.y, dM.R + 3, ang - Math.PI / 2, ang + Math.PI / 2); ctx.stroke();
    label(ctx, 'near side', pm.x + Math.cos(ang) * (dM.R + 32), pm.y + Math.sin(ang) * (dM.R + 14), { align: 'center', size: 10, color: '#ff8b8b' });
  };
  const arcToSun = (a) => { // the lit side faces along this great circle, towards the (possibly hidden) Sun
    const { ctx, projectDir } = a;
    const L = local(a.d), om = Math.acos(Math.max(-1, Math.min(1, v3.dot(L.m, L.s))));
    if (om < 0.01) return;
    ctx.strokeStyle = 'rgba(255,207,110,0.75)'; ctx.lineWidth = 1.6; ctx.setLineDash([6, 6]); ctx.beginPath();
    let on = false, cross = null;
    for (let k = 2; k <= 120; k++) {
      const t = k / 120, v = v3.add(v3.mul(L.m, Math.sin((1 - t) * om) / Math.sin(om)), v3.mul(L.s, Math.sin(t * om) / Math.sin(om)));
      if (!cross && v3.dot(v, L.site.up) < 0) cross = v;
      const p = projectDir(v); if (!p) { on = false; continue; }
      on ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y); on = true;
    }
    ctx.stroke(); ctx.setLineDash([]);
    if (cross) { const p = projectDir(cross); if (p && p.x > 40 && p.x < a.w - 40) label(ctx, '☀ Sun, below the horizon', p.x, p.y - 12, { align: 'center', size: 11, color: '#ffcf6e' }); }
  };
  const BOOST = 5;
  const pinAndHorizon = (a) => {
    const { ctx, st, project } = a;
    const E = st.bodies.earth, site = world.site(a.d, place.lat, place.lon, E);
    const R = E.r * BOOST, pin = v3.add(E.pos, v3.mul(site.up, R));
    const pp = project(pin); if (!pp) return;
    const vis = v3.dot(v3.sub(a.B.eye, pin), site.up) > 0;
    ctx.beginPath();
    for (let k = 0; k <= 48; k++) {
      const t = (k / 48) * TAU, q = project(v3.add(pin, v3.add(v3.mul(site.east, R * 0.45 * Math.cos(t)), v3.mul(site.north, R * 0.45 * Math.sin(t)))));
      if (q) k ? ctx.lineTo(q.x, q.y) : ctx.moveTo(q.x, q.y);
    }
    ctx.fillStyle = vis ? 'rgba(120,210,140,0.25)' : 'rgba(120,210,140,0.08)'; ctx.fill();
    ctx.strokeStyle = vis ? 'rgba(140,230,160,0.85)' : 'rgba(140,230,160,0.3)'; ctx.lineWidth = 1.2; ctx.stroke();
    const above = v3.dot(v3.sub(st.bodies.moon.pos, pin), site.up) > 0;
    const pm = project(st.bodies.moon.pos);
    if (pm) { ctx.setLineDash([4, 4]); ctx.strokeStyle = above ? 'rgba(201,212,255,0.85)' : 'rgba(255,120,100,0.75)'; ctx.beginPath(); ctx.moveTo(pp.x, pp.y); ctx.lineTo(pm.x, pm.y); ctx.stroke(); ctx.setLineDash([]); }
    label(ctx, `you · ${place.name.split(' (')[0]}`, pp.x + 8, pp.y - 8, { size: 11, color: '#bff0c8' });
    if (pm) label(ctx, above ? 'above your horizon' : 'below your horizon', pm.x, pm.y + 22, { align: 'center', size: 10.5, color: above ? '#dfe5ff' : '#ff9a88' });
  };

  let acc = 1;
  const viewer = new Viewer($('moon-canvas'), {
    model, d: now,
    rates: [[0, 'Paused'], [1 / 24, '1 h/s'], [1, '1 day/s'], [3, '3 days/s']],
    views: [
      { id: 'above', label: 'Above the North Pole', rate: 1, orbits: ['moon'], indicate: ['sun'], hideLabels: ['moon'],
        floor: { earth: (a) => minWH(a) * 0.05, moon: (a) => minWH(a) * 0.025 },
        cam: { mode: 'orbit', target: 'earth', dist: 1.3e6, yaw: -90, pitch: 89.5, fov: 40 }, under: shadowAndNearSide, over: nearSide,
        note: () => 'The Sun is far off-screen, in the direction of the arrow.' },
      { id: 'sky', label: 'Standing on Earth', rate: 1 / 24, floor: { moon: (a) => minWH(a) * 0.05, sun: (a) => minWH(a) * 0.035 },
        cam: { mode: 'ground', place, az: 180, alt: 25, fov: 78, follow: 'moon', _snap: true }, over: arcToSun,
        title: (a) => `${place.name} · looking ${compass((a.viewer.cam.az || 0) * DEG)}`,
        note: () => 'Zoom in to see the Moon at its true size. Drag to look around.' },
      { id: 'space', label: 'From space', rate: 1 / 24, boost: { earth: BOOST, moon: BOOST }, indicate: ['sun'], hideLabels: ['earth'],
        cam: { mode: 'orbit', target: (st) => v3.add(v3.mul(st.bodies.earth.pos, 0.5), v3.mul(st.bodies.moon.pos, 0.5)), dist: 9.5e5, yaw: 0, pitch: 25, fov: 40 },
        enter: (v) => { const st = world.state(v.d), em = v3.sub(st.bodies.moon.pos, st.bodies.earth.pos); v.cam.yaw = Math.atan2(em[1], em[0]) / DEG - 90; v.cam.pitch = 28; },
        over: (a) => { pinAndHorizon(a); nearSide(a); }, note: () => 'The green disc is your horizon: you can only see what is above it.' },
    ],
    onTick: (dt) => { if ((acc += dt) > 0.25) { acc = 0; readouts(); } },
  });

  // ---- controls
  const ageIn = $('moon-age');
  ageIn.addEventListener('input', () => {
    const k = Math.floor((now - NEW_MOON_EPOCH) / SYNODIC_MONTH);
    const target = NEW_MOON_EPOCH + k * SYNODIC_MONTH + parseFloat(ageIn.value);
    viewer.setRate(0);
    viewer.d = viewer.cam.mode === 'ground' ? atLocalTime(target, place.lon, localHours(viewer.d)) : target;
    readouts();
  });
  $('moon-place').addEventListener('click', (e) => { const b = e.target.closest('button'); if (b) setPlace(b.dataset.place); });
  function setPlace(key) {
    place = PLACES[key];
    $('moon-place').querySelectorAll('button').forEach((x) => x.classList.toggle('on', x.dataset.place === key));
    viewer.views.find((x) => x.id === 'sky').cam.place = place;
    if (viewer.cam.mode === 'ground') { viewer.cam.place = place; viewer.cam.follow = 'moon'; viewer.cam._snap = true; }
    readouts();
  }
  $('moon-unlock').addEventListener('click', () => {
    locked = !locked;
    fixedFrame = locked ? null : world.state(viewer.d).bodies.moon.frame;
    $('moon-unlock').classList.toggle('on', !locked);
    $('moon-unlock').textContent = locked ? 'Stop the Moon spinning' : 'Lock it again';
  });
  document.querySelectorAll('#moon [data-sky]').forEach((b) => b.addEventListener('click', () => {
    const [pl, which] = b.dataset.sky.split('-');
    setPlace(pl);
    const age = { fq: 7.4, lq: 22.1, cr: 3.2 }[which];
    let k = Math.floor((now - NEW_MOON_EPOCH) / SYNODIC_MONTH);
    if (NEW_MOON_EPOCH + k * SYNODIC_MONTH + age < now) k += 1;
    const day = NEW_MOON_EPOCH + k * SYNODIC_MONTH + age;
    const sun = scanDay(day, (d) => ({ alt: local(d).sun.alt }));
    let tSet = 18, tRise = 6;
    for (let i = 1; i < sun.length; i++) {
      if (sun[i - 1].alt > 0 && sun[i].alt <= 0) tSet = sun[i].h;
      if (sun[i - 1].alt <= 0 && sun[i].alt > 0) tRise = sun[i].h;
    }
    viewer.setView('sky');
    viewer.d = atLocalTime(day, place.lon, which === 'lq' ? tRise - 0.6 : tSet + 0.6);
    viewer.cam.follow = 'moon'; viewer.cam._snap = true;
    viewer.setRate(0);
    viewer.wrap.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }));

  function readouts() {
    const d = viewer.d, L = local(d);
    const E = L.st.bodies.earth, M = L.st.bodies.moon;
    const em = v3.norm(v3.sub(M.pos, E.pos)), es = v3.norm(v3.mul(E.pos, -1));
    const elong = Math.acos(Math.max(-1, Math.min(1, v3.dot(em, es))));
    const waxing = v3.cross(es, em)[2] > 0;
    const lit = Math.round(((1 - Math.cos(elong)) / 2) * 100);
    $('moon-phase').textContent = phaseName(waxing ? elong : TAU - elong);
    $('moon-lit').textContent = `${lit}%`;
    const age = moonAge(d);
    $('moon-age-out').textContent = `day ${age.toFixed(1)}`;
    if (document.activeElement !== ageIn) { ageIn.value = age; ageIn.style.setProperty('--fill', `${(age / SYNODIC_MONTH) * 100}%`); }
    const day = scanDay(d, (t) => ({ alt: local(t).moon.alt }));
    let rise = null, hi = day[0];
    for (let i = 1; i < day.length; i++) { if (day[i - 1].alt < 0 && day[i].alt >= 0) rise = day[i].h; if (day[i].alt > hi.alt) hi = day[i]; }
    $('moon-rise').textContent = rise == null ? '—' : clock(rise);
    $('moon-high').textContent = `${clock(hi.h)} · ${Math.max(0, Math.round(hi.alt / DEG))}°`;
    const why = $('moon-why');
    const pn = place.name.split(' (')[0];
    if (viewer.cam.mode !== 'ground') {
      why.innerHTML = `<span class="tag">${pn}</span>Rises around ${rise == null ? '—' : clock(rise)} (local time), highest at ${clock(hi.h)}. The Sun always lights half the Moon; from Earth we see ${lit}% of that half.`;
      return;
    }
    if (L.moon.alt < 0) { why.innerHTML = `<span class="tag">Now</span>The Moon is below the horizon in ${pn}${rise != null ? ` — it rises around <b>${clock(rise)}</b>. Press ▶ to run time` : ''}.`; return; }
    const t = v3.norm(v3.sub(L.s, v3.mul(L.m, v3.dot(L.s, L.m))));
    const upv = v3.norm(v3.sub(L.site.up, v3.mul(L.m, v3.dot(L.site.up, L.m))));
    const right = v3.cross(L.m, upv);
    const th = Math.atan2(v3.dot(t, upv), v3.dot(t, right)) / DEG;
    const side = ['right', 'upper right', 'top', 'upper left', 'left', 'lower left', 'bottom', 'lower right'][Math.round(((th % 360) + 360) % 360 / 45) % 8];
    const sunTxt = L.sun.alt < 0 ? `the Sun, ${Math.round(-L.sun.alt / DEG)}° below the horizon in the ${compass(L.sun.az)}` : `the Sun, up in the ${compass(L.sun.az)} — a daytime Moon`;
    why.innerHTML = `<span class="tag">Why</span>Lit on the <b>${side}</b>, because that side faces ${sunTxt}. The Moon is ${Math.round(L.moon.alt / DEG)}° up in the ${compass(L.moon.az)}.`;
  }
  readouts();
  window.__moon = { viewer, world, readouts };
}
