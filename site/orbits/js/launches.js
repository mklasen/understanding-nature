// Chapter 8 — Launch day: why that date? Real launches, on their real dates, in the shared world.
// Trajectories are Lambert arcs (orbitmech.js): the unique two-body conic that leaves Earth on the launch date and
// reaches the target on the arrival date. They ignore engine burns along the way and (for the Moon trips) the
// Moon's own pull, so they're labelled as approximate paths. Dates/sources are listed in DECISIONS.md.
import { DEG, TAU, AU, TILT, daysSinceJ2000, dateFromJ2000, fmtDate } from './astro.js';
import { World, gmst } from './world.js';
import { Viewer } from './viewer.js';
import { leg, MU_EARTH } from './orbitmech.js';
import { v3, label } from './draw.js';
import { $ } from '../../kit/util.js';

const T = (iso) => daysSinceJ2000(Date.parse(iso));
const wrap = (a) => { a = (a + Math.PI) % TAU; if (a < 0) a += TAU; return a - Math.PI; };
const lon = (v) => Math.atan2(v[1], v[0]);
const fmtDT = (d) => { const t = dateFromJ2000(d); return `${fmtDate(t)} · ${String(t.getUTCHours()).padStart(2, '0')}:${String(t.getUTCMinutes()).padStart(2, '0')} UTC`; };

export function initLaunches() {
  const world = new World({ bodies: ['sun', 'mercury', 'venus', 'earth', 'moon', 'mars', 'jupiter', 'saturn', 'uranus', 'neptune'] });
  const P = (id, d) => world.pos(id, d);
  const rel = (id, d) => v3.sub(P(id, d), P('earth', d)); // Earth-centred
  const minWH = (a) => Math.min(a.w, a.h);

  // ---------- trajectories
  const helio = (from, d1, to, d2) => leg(d1, P(from, d1), d2, P(to, d2));
  const MARS2020 = [
    { name: 'Hope (UAE)', color: '#9fd8a5', leg: helio('earth', T('2020-07-19T21:58Z'), 'mars', T('2021-02-09T15:42Z')) },
    { name: 'Tianwen-1 (China)', color: '#ff8a8a', leg: helio('earth', T('2020-07-23T04:41Z'), 'mars', T('2021-02-10T11:52Z')) },
    { name: 'Perseverance (USA)', color: '#ffd27a', leg: helio('earth', T('2020-07-30T11:50Z'), 'mars', T('2021-02-18T20:55Z')) },
  ];
  const NOW = [ // arrival months only are announced; mid-month used, so these paths are approximate
    { name: 'MMX (Japan)', color: '#ffd27a', leg: helio('earth', T('2026-10-19T19:41Z'), 'mars', T('2027-08-15T00:00Z')) },
    { name: 'ESCAPADE (NASA)', color: '#9fd8a5', leg: helio('earth', T('2026-11-07T09:51Z'), 'mars', T('2027-09-15T00:00Z')) },
  ];
  const vEnc = [['earth', '1977-08-20T14:29Z'], ['jupiter', '1979-07-09T22:29Z'], ['saturn', '1981-08-26T03:24Z'], ['uranus', '1986-01-24T17:59Z'], ['neptune', '1989-08-25T03:56Z']];
  const VOYAGER = vEnc.slice(1).map(([id, iso], i) => ({ name: id, leg: helio(vEnc[i][0], T(vEnc[i][1]), id, T(iso)) }));
  // Moon trips, Earth-centred two-body arcs (positions converted to world coordinates when drawn)
  const moonTrip = (dTLI, dArrive, behindKm, lead = 25) => {
    const m = rel('moon', dArrive), u = v3.norm(m);
    const a = Math.atan2(-u[1], -u[0]) - lead * DEG;
    const r1 = v3.mul([Math.cos(a), Math.sin(a), 0], 6371 + 330);
    const r2 = v3.add(m, v3.mul(u, behindKm));
    return leg(dTLI, r1, dArrive, r2, MU_EARTH);
  };
  const APOLLO = moonTrip(T('1969-07-16T16:22Z'), T('1969-07-19T17:21Z'), 1737 + 111);
  const ART_OUT = moonTrip(T('2026-04-02T23:00Z'), T('2026-04-06T23:00Z'), 1737 + 6545, 15);
  const ART_BACK = (() => {
    const d1 = T('2026-04-06T23:00Z'), d2 = T('2026-04-11T00:00Z');
    const r1 = ART_OUT ? ART_OUT.at(d1) : rel('moon', d1);
    const e = v3.norm(v3.cross([0, 0, 1], r1));
    return leg(d1, r1, d2, v3.mul(v3.norm(v3.add(v3.mul(v3.norm(r1), -1), v3.mul(e, -0.6))), 6371 + 120), MU_EARTH);
  })();

  // ---------- Mars launch windows: Mars ~44° ahead of Earth (Hohmann phase angle)
  function marsWindows(from, count = 4) {
    const f = (t) => wrap(lon(P('mars', t)) - lon(P('earth', t)) - 44 * DEG);
    const out = []; let prev = f(from);
    for (let t = from + 5; t < from + 365 * 12 && out.length < count; t += 5) {
      const v = f(t);
      if (prev > 0 && v <= 0 && prev - v < 1) { let a = t - 5, b = t; for (let i = 0; i < 20; i++) { const m = (a + b) / 2; if (f(m) > 0) a = m; else b = m; } out.push((a + b) / 2); }
      prev = v;
    }
    return out;
  }

  // ---------- drawing helpers
  const drawLeg = (a, L, color, { offset = null, lw = 2, label: name = null, dim = false } = {}) => {
    if (!L) return null;
    const { ctx, project, d } = a;
    const shift = (p, t) => (offset ? v3.add(p, offset(t)) : p);
    ctx.strokeStyle = dim ? color.replace(')', ',0.25)').replace('rgb(', 'rgba(') : color; ctx.lineWidth = lw * 0.6; ctx.setLineDash([4, 5]);
    ctx.globalAlpha = 0.45; ctx.beginPath(); let on = false;
    for (let k = 0; k <= 160; k++) { const t = L.d1 + (k / 160) * (L.d2 - L.d1); const q = project(shift(L.at(t), t)); if (!q) { on = false; continue; } on ? ctx.lineTo(q.x, q.y) : ctx.moveTo(q.x, q.y); on = true; }
    ctx.stroke(); ctx.setLineDash([]); ctx.globalAlpha = 1;
    if (d <= L.d1) return null;
    ctx.strokeStyle = color; ctx.lineWidth = lw; ctx.beginPath(); on = false;
    const end = Math.min(d, L.d2);
    for (let k = 0; k <= 120; k++) { const t = L.d1 + (k / 120) * (end - L.d1); const q = project(shift(L.at(t), t)); if (!q) { on = false; continue; } on ? ctx.lineTo(q.x, q.y) : ctx.moveTo(q.x, q.y); on = true; }
    ctx.stroke();
    const q = project(shift(L.at(end), end));
    if (q) { ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(q.x, q.y, 3.5, 0, TAU); ctx.fill(); if (name) label(ctx, name, q.x + 7, q.y + 10, { size: 10.5, color }); }
    return q;
  };
  // Moon trips are drawn in Earth's frame: every point of the path is placed relative to where Earth is *now*
  const geo = (a) => { const e = P('earth', a.d); return () => e; };

  // Demo-2: the ISS orbital plane at launch, fixed in space while Florida turns underneath it
  const KSC = { lat: 28.6082, lon: -80.6041 }, ISS_I = 51.64 * DEG, EPS = TILT * DEG;
  const eq2ecl = (v) => [v[0], v[1] * Math.cos(EPS) + v[2] * Math.sin(EPS), -v[1] * Math.sin(EPS) + v[2] * Math.cos(EPS)];
  const D2 = T('2020-05-30T19:22:45Z');
  const issPlane = (() => {
    const phi = KSC.lat * DEG, alpha = gmst(D2) + KSC.lon * DEG;
    const u = Math.asin(Math.sin(phi) / Math.sin(ISS_I));
    const O = alpha - Math.atan2(Math.cos(ISS_I) * Math.sin(u), Math.cos(u));
    const n = eq2ecl([Math.sin(ISS_I) * Math.sin(O), -Math.sin(ISS_I) * Math.cos(O), Math.cos(ISS_I)]);
    const N = eq2ecl([Math.cos(O), Math.sin(O), 0]);
    return { n, N, W: v3.cross(n, N) };
  })();
  const kscOffPlane = (d) => { const E = world.state(d).bodies.earth; const s = world.site(d, KSC.lat, KSC.lon, E); return v3.dot(v3.sub(s.pos, E.pos), issPlane.n); };

  // Apollo 11: Tranquility Base on the Moon's surface
  const TRANQ = { lat: 0.674 * DEG, lon: 23.473 * DEG };
  const tranq = (st) => {
    const M = st.bodies.moon, nb = [Math.cos(TRANQ.lat) * Math.cos(TRANQ.lon), Math.cos(TRANQ.lat) * Math.sin(TRANQ.lon), Math.sin(TRANQ.lat)];
    const n = [0, 1, 2].map((i) => M.frame[i][0] * nb[0] + M.frame[i][1] * nb[1] + M.frame[i][2] * nb[2]);
    const sun = v3.norm(v3.sub(st.bodies.sun.pos, M.pos));
    return { n, pos: v3.add(M.pos, v3.mul(n, M.r)), sunElev: Math.asin(v3.dot(n, sun)) / DEG };
  };

  const phaseTxt = (d) => { const a = Math.round(wrap(lon(P('mars', d)) - lon(P('earth', d))) / DEG); return `Mars is ${Math.abs(a)}° ${a >= 0 ? 'ahead of' : 'behind'} Earth`; };
  // ---------- missions
  const MISSIONS = [
    { id: 'mars2020', title: 'Mars 2020', when: 'July 2020', d: T('2020-07-19T12:00Z'), rate: 6, view: 'mars2020',
      why: `<p><b>Three countries, eleven days.</b> The UAE's Hope (19 July), China's Tianwen-1 (23 July) and NASA's Perseverance (30 July 2020) all left for Mars in the same few weeks. Not a coincidence: an efficient path to Mars only works when Mars is about <b>44° ahead</b> of Earth as you leave, so that a half-ellipse around the Sun meets it 7 months later. That alignment comes round once every <b>26 months</b>. Miss it and you wait more than two years.</p>`,
      live: (d) => `${phaseTxt(d)} (ideal for leaving ≈ 44° ahead) · ${fmtDate(dateFromJ2000(d))}` },
    { id: 'now', title: "Mars: today's window", when: 'Oct–Nov 2026', d: T('2026-10-15T00:00Z'), rate: 6, view: 'now',
      why: `<p><b>The door is open right now.</b> JAXA's MMX left on 20 October 2026 (Japan time) to bring back a sample of Mars's moon Phobos, arriving August 2027. NASA's twin ESCAPADE probes launched a year early, in November 2025, and waited near Earth for this alignment; on 7 November 2026 they swing past Earth to head for Mars, arriving September 2027.</p><p id="launch-windows"></p>`,
      live: (d) => `${phaseTxt(d)} (ideal for leaving ≈ 44° ahead) · ${fmtDate(dateFromJ2000(d))}` },
    { id: 'apollo', title: 'Apollo 11', when: '16 July 1969', d: T('1969-07-16T13:32Z'), rate: 0.5, view: 'apollo', sub: [['apollo', 'The trip'], ['apollo-site', 'Landing site, 20 July']],
      why: `<p><b>Timed for sunrise on the Moon.</b> The crew had to judge boulders and craters by their shadows, so the Sun had to be low — roughly 5–14° above the horizon at the landing site. On the Moon that only lasts a few hours per site per month, and the Moon must also be in the right place in its orbit. That gave a launch window of about one day a month for each landing site. A launch on 16 July 1969 meant landing in the Sea of Tranquility on 20 July, shortly after local sunrise; a delay would have moved the landing to a different site.</p>`,
      live: (d) => (viewer.view.id === 'apollo-site' ? `At Tranquility Base the Sun is ${tranq(world.state(d)).sunElev.toFixed(1)}° above the horizon · ${fmtDT(d)}` : `${fmtDT(d)} · path: a two-body sketch (the Moon's own pull is left out)`) },
    { id: 'demo2', title: 'Crew Dragon Demo-2', when: '30 May 2020', d: D2 - 30 / 1440, rate: 1 / 144, view: 'demo2',
      why: `<p><b>A one-second window.</b> SpaceX's first crewed flight had to reach the International Space Station. The station's orbit is a fixed ring in space, tilted 51.6°, and Earth turns underneath it — so Florida passes under that ring only briefly, twice a day. Launch at that instant and you fly straight into the station's plane; launch a few minutes late and you'd need fuel you don't have to steer across. The exact second also sets up the chase to catch the station. On 27 May the weather was bad at launch time and the attempt was scrubbed: the next chance was days later, on 30 May at 19:22:45 UTC.</p><p>Launching east, with Earth's spin, also gives a rocket from Florida a free ~0.41 km/s.</p>`,
      live: (d) => { const m = Math.round((d - D2) * 1440); return `${m === 0 ? 'Launch!' : m < 0 ? `T−${-m} min` : `T+${m} min`} · Florida is ${Math.abs(kscOffPlane(d)).toFixed(0)} km from the station's orbital plane`; } },
    { id: 'artemis2', title: 'Artemis II', when: '1 April 2026', d: T('2026-04-01T22:30Z'), rate: 0.5, view: 'artemis2',
      why: `<p><b>Around the Moon and home without stopping.</b> Artemis II's four astronauts flew a free-return path: the Moon's gravity swung them round its far side (6 April 2026, about 6,500 km above the surface) and back to Earth by 10–11 April. For the trip to close, the Moon has to be in the right place — and NASA adds rules, such as limits on how long the solar-powered Orion capsule may sit in Earth's shadow and a daylight splashdown. Together that leaves a few launch days each month.</p>`,
      live: (d) => `${fmtDT(d)} · path: a two-body sketch (the Moon's pull, which really bends the path round, is left out)` },
    { id: 'voyager2', title: 'Voyager 2', when: '20 Aug 1977', d: T('1977-08-20T14:29Z'), rate: 90, view: 'voyager2',
      why: `<p><b>A once-in-175-years alignment.</b> In the late 1970s Jupiter, Saturn, Uranus and Neptune lined up so that one spacecraft could fly past each in turn, using every planet's gravity to fling it on to the next. Voyager 2 launched on 20 August 1977 and visited Jupiter (1979), Saturn (1981), Uranus (1986) and Neptune (1989) — still the only spacecraft to visit the last two.</p>`,
      live: (d) => { const at = VOYAGER.find((v) => v.leg && d <= v.leg.d2) || VOYAGER[VOYAGER.length - 1]; const p = at.leg ? at.leg.at(d) : [0, 0, 0]; return `${fmtDate(dateFromJ2000(d))} · Voyager 2 is ${(v3.len(p) / AU).toFixed(1)} AU from the Sun, heading for ${at.name[0].toUpperCase() + at.name.slice(1)}`; } },
  ];

  let acc = 1, current = MISSIONS[0];
  // ---------- views
  const marsArcs = (list) => (a) => {
    list.forEach((m) => drawLeg(a, m.leg, m.color, { lw: 2.2 }));
    list.forEach((m, i) => label(a.ctx, `— ${m.name}`, 12, 36 + i * 15, { size: 10.5, color: m.color }));
    const { ctx, project } = a;
    const e = project(P('earth', a.d)), mr = project(P('mars', a.d));
    if (e && mr) { ctx.strokeStyle = 'rgba(255,255,255,0.18)'; ctx.setLineDash([2, 4]); const s = project([0, 0, 0]); ctx.beginPath(); ctx.moveTo(e.x, e.y); ctx.lineTo(s.x, s.y); ctx.lineTo(mr.x, mr.y); ctx.stroke(); ctx.setLineDash([]); }
  };
  const views = [
    { id: 'mars2020', label: 'Mars 2020', bodies: ['sun', 'mercury', 'venus', 'earth', 'mars'], orbits: ['earth', 'mars'], floor: { sun: (a) => minWH(a) * 0.03, earth: 5, mars: 5, default: 3 }, hideLabels: ['moon', 'mercury', 'venus'],
      cam: { mode: 'orbit', target: 'sun', dist: 6.5 * AU, yaw: -90, pitch: 65, fov: 40 }, over: marsArcs(MARS2020),
      note: () => 'Paths are Lambert arcs from the real launch and arrival dates (engine burns along the way left out).' },
    { id: 'now', label: 'Now', bodies: ['sun', 'mercury', 'venus', 'earth', 'mars'], orbits: ['earth', 'mars'], floor: { sun: (a) => minWH(a) * 0.03, earth: 5, mars: 5 }, hideLabels: ['moon', 'mercury', 'venus'],
      cam: { mode: 'orbit', target: 'sun', dist: 6.5 * AU, yaw: -90, pitch: 65, fov: 40 }, over: marsArcs(NOW),
      note: () => 'Arrival months are announced, not days: these paths are approximate.' },
    { id: 'apollo', label: 'Apollo 11', bodies: ['sun', 'earth', 'moon'], orbits: ['moon'], floor: { earth: (a) => minWH(a) * 0.03, moon: (a) => minWH(a) * 0.015 }, indicate: ['sun'],
      cam: { mode: 'orbit', target: 'earth', dist: 1.15e6, yaw: -90, pitch: 70, fov: 40 }, over: (a) => drawLeg(a, APOLLO, '#ffd27a', { offset: geo(a), label: 'Apollo 11' }) },
    { id: 'apollo-site', label: 'Landing site', bodies: ['sun', 'earth', 'moon'], labels: false,
      cam: { mode: 'orbit', target: 'moon', dist: 9000, yaw: 0, pitch: 0, fov: 40 },
      enter: (v) => { const st = world.state(v.d), t = tranq(st); const dir = v3.norm(v3.add(t.n, [0, 0, 0.25])); v.cam.yaw = Math.atan2(dir[1], dir[0]) / DEG; v.cam.pitch = Math.asin(dir[2]) / DEG; },
      over: (a) => { const t = tranq(a.st), p = a.project(t.pos); if (!p) return; const { ctx } = a; ctx.strokeStyle = '#ff6b6b'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(p.x, p.y, 7, 0, TAU); ctx.stroke(); label(ctx, `Tranquility Base · Sun ${t.sunElev.toFixed(0)}° up`, p.x + 11, p.y - 10, { size: 11.5, color: '#ffb0b0' }); },
      note: () => 'The line between day and night (the terminator) runs just west of the landing site: local morning.' },
    { id: 'demo2', label: 'Demo-2', bodies: ['sun', 'earth', 'moon'], labels: false,
      cam: { mode: 'orbit', target: 'earth', dist: 2.6e4, yaw: 0, pitch: 0, fov: 40 },
      enter: (v) => { const E = world.state(D2).bodies.earth, s = world.site(D2, KSC.lat, KSC.lon, E); const dir = v3.norm(v3.add(s.up, v3.mul(issPlane.n, -0.35))); v.cam.yaw = Math.atan2(dir[1], dir[0]) / DEG; v.cam.pitch = Math.asin(dir[2]) / DEG; },
      over: (a) => {
        const { ctx, project, st, B } = a, E = st.bodies.earth, R = 6371 + 420;
        let prev = null;
        for (let k = 0; k <= 160; k++) {
          const t = (k / 160) * TAU, P3 = v3.add(E.pos, v3.add(v3.mul(issPlane.N, R * Math.cos(t)), v3.mul(issPlane.W, R * Math.sin(t))));
          const p = project(P3), front = v3.dot(v3.sub(P3, E.pos), v3.sub(B.eye, E.pos)) > -R * 0.3;
          if (prev && p) { ctx.strokeStyle = front ? 'rgba(159,216,165,0.95)' : 'rgba(159,216,165,0.25)'; ctx.lineWidth = front ? 2 : 1; ctx.beginPath(); ctx.moveTo(prev.x, prev.y); ctx.lineTo(p.x, p.y); ctx.stroke(); }
          prev = p;
        }
        const s = world.site(a.d, KSC.lat, KSC.lon, E), p = project(s.pos);
        if (p) { ctx.fillStyle = '#ff5a5a'; ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(p.x, p.y, 5, 0, TAU); ctx.fill(); ctx.stroke(); label(ctx, 'Kennedy Space Center', p.x + 8, p.y + 12, { size: 11, color: '#ffb0b0' }); }
        label(ctx, "green ring: the space station's orbit (fixed in space)", 12, 36, { size: 10.5, color: 'rgba(159,216,165,0.9)' });
      },
      note: () => 'Sizes and the station\'s height (420 km) to scale. Time runs 10 minutes per second.' },
    { id: 'artemis2', label: 'Artemis II', bodies: ['sun', 'earth', 'moon'], orbits: ['moon'], floor: { earth: (a) => minWH(a) * 0.03, moon: (a) => minWH(a) * 0.015 }, indicate: ['sun'],
      cam: { mode: 'orbit', target: 'earth', dist: 1.2e6, yaw: -90, pitch: 70, fov: 40 },
      over: (a) => { drawLeg(a, ART_OUT, '#ffd27a', { offset: geo(a), label: a.d < T('2026-04-06T23:00Z') ? 'Orion' : null }); drawLeg(a, ART_BACK, '#ffd27a', { offset: geo(a), label: a.d >= T('2026-04-06T23:00Z') ? 'Orion' : null }); } },
    { id: 'voyager2', label: 'Voyager 2', bodies: ['sun', 'jupiter', 'saturn', 'uranus', 'neptune'], orbits: ['jupiter', 'saturn', 'uranus', 'neptune'], floor: { sun: 6, default: 4 }, hideLabels: ['moon', 'mercury', 'venus', 'mars', 'earth'],
      cam: { mode: 'orbit', target: 'sun', dist: 95 * AU, yaw: -90, pitch: 60, fov: 40 },
      over: (a) => VOYAGER.forEach((v, i) => drawLeg(a, v.leg, '#ffd27a', { label: i === VOYAGER.findIndex((x) => x.leg && a.d <= x.leg.d2) ? 'Voyager 2' : null })),
      note: () => 'Path: patched conics through the real encounter dates — each planet\'s gravity bent it towards the next.' },
  ];

  const viewer = new Viewer($('launch-canvas'), {
    model: world, d: MISSIONS[0].d, views, start: 'mars2020',
    rates: [[0, 'Paused'], [1 / 144, '10 min/s'], [0.5, '12 h/s'], [6, '6 days/s'], [90, '3 months/s']],
    onTick: (dt) => { if ((acc += dt) > 0.25) { acc = 0; live(); } },
  });
  if (viewer.chips) viewer.chips.style.display = 'none';

  // ---------- mission picker
  const list = $('launch-list'), sub = $('launch-sub');
  list.innerHTML = MISSIONS.map((m) => `<button data-id="${m.id}"><b>${m.title}</b><span>${m.when}</span></button>`).join('');
  list.addEventListener('click', (e) => { const b = e.target.closest('button'); if (b) pick(b.dataset.id); });
  sub.addEventListener('click', (e) => { const b = e.target.closest('button'); if (!b) return; viewer.setView(b.dataset.view, { keepTime: true }); sub.querySelectorAll('button').forEach((x) => x.classList.toggle('on', x === b)); if (b.dataset.view === 'apollo-site') { viewer.d = T('1969-07-20T20:17Z'); viewer.setRate(0); } });
  function pick(id) {
    const m = MISSIONS.find((x) => x.id === id); current = m;
    list.querySelectorAll('button').forEach((b) => b.classList.toggle('on', b.dataset.id === id));
    viewer.setView(m.view);
    viewer.d = m.d; viewer.setRate(m.rate);
    sub.innerHTML = m.sub ? m.sub.map(([v, l], i) => `<button data-view="${v}" class="${i ? '' : 'on'}">${l}</button>`).join('') : '';
    sub.style.display = m.sub ? '' : 'none';
    $('launch-why').innerHTML = m.why;
    if (id === 'now') {
      const w = marsWindows(daysSinceJ2000(Date.now()) - 60, 5);
      $('launch-windows').innerHTML = `<b>Coming Mars windows</b> (computed here from the planets' positions; each is open for a few weeks around): ${w.map((d) => dateFromJ2000(d).toLocaleString('en', { month: 'short', year: 'numeric', timeZone: 'UTC' })).join(' · ')}. Missions announced for late 2028 include China's Tianwen-3 sample return and ESA's Rosalind Franklin rover — plans can still change.`;
    }
    live();
  }
  function live() { $('launch-live').textContent = current.live(viewer.d); }
  pick('mars2020');
  window.__launches = { viewer, MISSIONS, marsWindows, tranq, kscOffPlane, legs: { MARS2020, NOW, VOYAGER, APOLLO, ART_OUT, ART_BACK } };
}
