// Chapter 8 — how fast are we going, relative to what. One Earth, four frames of reference.
// Directions (ecliptic coordinates, derived from galactic l/b):
//   galactic rotation (l = 90°, b = 0°)   → λ ≈ 347°, β ≈ +59.6°  — Sun's motion around the Milky Way
//   CMB dipole        (l = 264°, b = 48°) → λ ≈ 172°, β ≈ −11°    — Sun's motion vs the cosmic background
// Peculiar solar motion (~20 km/s) and the galaxy's own curvature over a few years are ignored (negligible here).
import { DEG, TAU, AU, DAY, earth, planetPos, daysSinceJ2000, SPEEDS, SIDEREAL_DAY_H, R_EARTH } from './astro.js';
import { Camera, makeStars, drawStars, drawSun, drawGlobe, axisDir, bodyFrame, mat, v3, label, attachZoom } from './draw.js';
import { fitCanvas, visibleLoop, bindRange, $ } from '../../kit/util.js';

const dirFrom = (lam, beta) => [Math.cos(beta * DEG) * Math.cos(lam * DEG), Math.cos(beta * DEG) * Math.sin(lam * DEG), Math.sin(beta * DEG)];
const U_GAL = dirFrom(347, 59.6), U_CMB = dirFrom(171.7, -11.1);
const AU_PER_DAY = (kms) => (kms * DAY) / AU;
const KMH = (kms) => kms * 3600;

export function initSpeed() {
  const canvas = $('speed-canvas');
  const stars = makeStars(220, 81);
  const t0 = performance.now();
  const S = { frame: 'earth', d: daysSinceJ2000(Date.now()), playing: true, squeeze: false, lat: 52 * DEG, phi: 0.9, tilt: 0.45 };
  const cam = new Camera({ yaw: -70, pitch: 38 });
  // drag: Camera for earth/sun frames; custom roll-around-the-motion for galaxy/cmb
  attachZoom(canvas, cam, { min: 0.5, max: 30 });
  let drag = null;
  canvas.style.cursor = 'grab';
  canvas.addEventListener('pointerdown', (e) => { drag = { x: e.clientX, y: e.clientY, yaw: cam.yaw, pitch: cam.pitch, phi: S.phi, tilt: S.tilt }; canvas.setPointerCapture(e.pointerId); });
  canvas.addEventListener('pointermove', (e) => {
    if (!drag || cam.pinching) return;
    const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
    cam.yaw = drag.yaw - dx * 0.4; cam.pitch = Math.max(-85, Math.min(85, drag.pitch + dy * 0.3)); cam.update();
    S.phi = drag.phi + dx * 0.008; S.tilt = Math.max(-1.2, Math.min(1.2, drag.tilt + dy * 0.006));
  });
  const end = () => (drag = null);
  canvas.addEventListener('pointerup', end); canvas.addEventListener('pointercancel', end);

  const rows = [...document.querySelectorAll('#speed-rows .speed-row')];
  rows.forEach((r) => r.addEventListener('click', () => {
    S.frame = r.dataset.frame;
    rows.forEach((x) => x.classList.toggle('on', x === r));
    $('speed-squeeze').style.display = S.frame === 'galaxy' || S.frame === 'cmb' ? '' : 'none';
    $('speed-lat-ctl').style.display = S.frame === 'earth' ? '' : 'none';
  }));
  $('speed-squeeze').style.display = 'none';
  $('speed-squeeze').addEventListener('click', () => { S.squeeze = !S.squeeze; $('speed-squeeze').classList.toggle('on', S.squeeze); $('speed-squeeze').textContent = S.squeeze ? 'True proportions' : 'Squeeze the coils'; });
  $('speed-play').addEventListener('click', () => { S.playing = !S.playing; $('speed-play').textContent = S.playing ? '❚❚' : '▶'; });
  bindRange($('speed-lat'), (v) => { S.lat = v * DEG; $('speed-lat-out').textContent = `${v}°${v === 52 ? ' · Amsterdam' : v === 0 ? ' · equator' : v === 90 ? ' · pole' : ''}`; });

  const spinKms = () => SPEEDS.spinEquator * Math.cos(S.lat);
  const earthVel = (d) => { // km/s, heliocentric ecliptic
    const a = planetPos(earth, d - 0.01), b = planetPos(earth, d + 0.01);
    return [(b.x - a.x) / 0.02 * AU / DAY, (b.y - a.y) / 0.02 * AU / DAY, (b.z - a.z) / 0.02 * AU / DAY];
  };
  const fmtKm = (km) => (km < 1000 ? `${km.toFixed(km < 10 ? 2 : 0)} km` : km < 1e6 ? `${Math.round(km).toLocaleString('en')} km` : `${(km / 1e6).toFixed(2)} million km`);

  function readouts() {
    const sec = (performance.now() - t0) / 1000;
    const vOrb = v3.len(earthVel(S.d));
    const sp = { earth: spinKms(), sun: vOrb, galaxy: SPEEDS.galactic, cmb: SPEEDS.sunVsCMB };
    for (const k of Object.keys(sp)) {
      $(`sp-${k}`).textContent = `${Math.round(KMH(sp[k])).toLocaleString('en')} km/h`;
      $(`sd-${k}`).textContent = fmtKm(sp[k] * sec);
    }
    // vector sum vs the CMB, using today's real date for Earth's orbital velocity
    const today = daysSinceJ2000(Date.now());
    const tot = v3.add(v3.mul(U_CMB, SPEEDS.sunVsCMB), earthVel(today));
    const v = v3.len(tot);
    $('speed-total').textContent = `${Math.round(v)} km/s · ${(KMH(v) / 1e6).toFixed(2)} million km/h`;
    const proj = v3.dot(earthVel(today), U_CMB);
    $('speed-total-note').textContent = `Today Earth's orbit is carrying you ${proj > 0 ? 'along with' : 'against'} the Sun's motion (${proj > 0 ? '+' : '−'}${Math.abs(proj).toFixed(0)} km/s). Over a year this swings between about ${Math.round(SPEEDS.sunVsCMB - 29)} and ${Math.round(SPEEDS.sunVsCMB + 29)} km/s. (Your spin adds less than 0.5 km/s.)`;
  }

  function frame(dt) {
    const rate = { earth: 1 / 8, sun: 36, galaxy: 120, cmb: 120 }[S.frame]; // days per second
    if (S.playing) S.d += dt * rate;
    draw();
    readouts();
  }

  function motionView(u) {
    // view basis: x along the motion; roll around it by phi, tip by tilt
    const ref = Math.abs(u[2]) > 0.9 ? [1, 0, 0] : [0, 0, 1];
    const z0 = v3.norm(v3.cross(u, ref)), y0 = v3.cross(z0, u);
    let z = v3.add(v3.mul(z0, Math.cos(S.phi)), v3.mul(y0, Math.sin(S.phi)));
    let x = u;
    // tip: rotate x and z about y
    const y = v3.norm(v3.cross(z, x));
    const ct = Math.cos(S.tilt), st = Math.sin(S.tilt);
    const x2 = v3.add(v3.mul(x, ct), v3.mul(z, st)), z2 = v3.add(v3.mul(z, ct), v3.mul(x, -st));
    return [x2, y, z2];
  }

  function draw() {
    const { ctx, w, h } = fitCanvas(canvas);
    ctx.fillStyle = '#0a0e1c'; ctx.fillRect(0, 0, w, h);
    drawStars(ctx, w, h, stars, 0.5);
    const m = Math.min(w, h);
    const note = $('speed-note');
    if (S.frame === 'earth') {
      // Earth's frame: you go round the axis once per (sidereal) day
      cam.cx = w / 2; cam.cy = h / 2; cam.scale = m * 0.3; cam.update();
      const R = cam.scale * cam.zoom;
      const axis = axisDir(23.44, 90), Bw = bodyFrame(axis);
      const spin = (S.d * 24 / SIDEREAL_DAY_H) * TAU;
      const p = planetPos(earth, S.d), sunDir = v3.norm([-p.x, -p.y, 0]);
      const B = mat.mul(cam.V, Bw);
      // your circle of latitude
      const circle = (front) => {
        ctx.beginPath(); let started = false;
        for (let k = 0; k <= 120; k++) {
          const lo = (k / 120) * TAU;
          const q = mat.apply(B, [Math.cos(S.lat) * Math.cos(lo), Math.cos(S.lat) * Math.sin(lo), Math.sin(S.lat)]);
          if ((q[2] >= 0) !== front) { started = false; continue; }
          const x = cam.cx + q[0] * R * 1.02, y = cam.cy - q[1] * R * 1.02;
          started ? ctx.lineTo(x, y) : ctx.moveTo(x, y); started = true;
        }
        ctx.strokeStyle = front ? '#f5b95a' : 'rgba(245,185,90,0.25)'; ctx.lineWidth = front ? 2.5 : 1.5; ctx.stroke();
      };
      circle(false);
      drawGlobe(ctx, cam.cx, cam.cy, R, { B, sun: cam.toView(sunDir), spin, grid: false, observer: { lat: S.lat, lon: 0.1 }, res: 1.2 });
      circle(true);
      const A = cam.toView(axis);
      ctx.strokeStyle = 'rgba(255,255,255,0.7)'; ctx.lineWidth = 1.4;
      ctx.beginPath(); ctx.moveTo(cam.cx - A[0] * R * 1.35, cam.cy + A[1] * R * 1.35); ctx.lineTo(cam.cx + A[0] * R * 1.35, cam.cy - A[1] * R * 1.35); ctx.stroke();
      label(ctx, 'Frame: the Earth itself', 12, 18, { size: 12, weight: 600, color: 'rgba(237,240,247,0.85)' });
      label(ctx, 'Your path: a circle, once a day', 12, h - 14, { size: 11, color: '#f5b95a' });
      note.innerHTML = `<b>To scale.</b> Your circle is ${Math.round(TAU * R_EARTH * Math.cos(S.lat)).toLocaleString('en')} km around. Drag to turn the view.`;
      return;
    }
    if (S.frame === 'sun') {
      cam.cx = w / 2; cam.cy = h / 2; cam.scale = m * 0.4; cam.update();
      ctx.beginPath();
      for (let k = 0; k <= 200; k++) { const q = planetPos(earth, S.d - 365.25 + (k / 200) * 365.25); const P = cam.project([q.x, q.y, q.z]); k ? ctx.lineTo(P.x, P.y) : ctx.moveTo(P.x, P.y); }
      ctx.strokeStyle = '#f5b95a'; ctx.lineWidth = 2; ctx.stroke();
      const S0 = cam.project([0, 0, 0]); drawSun(ctx, S0.x, S0.y, 10, 3);
      const q = planetPos(earth, S.d), P = cam.project([q.x, q.y, q.z]);
      ctx.fillStyle = '#5fb0f0'; ctx.beginPath(); ctx.arc(P.x, P.y, 5, 0, TAU); ctx.fill();
      label(ctx, 'Frame: the Sun', 12, 18, { size: 12, weight: 600, color: 'rgba(237,240,247,0.85)' });
      label(ctx, 'Your path: an (almost circular) ellipse, once a year', 12, h - 14, { size: 11, color: '#f5b95a' });
      note.innerHTML = '<b>To scale.</b> Your daily spin-loops (13,000 km across at most) are about 20,000× smaller than this orbit — far too small to see here. The Moon\'s wobble too.';
      return;
    }
    // galaxy / cosmic background: the Sun moves in a straight line (over these few years); Earth spirals around it
    const u = S.frame === 'galaxy' ? U_GAL : U_CMB;
    const vkms = S.frame === 'galaxy' ? SPEEDS.galactic : SPEEDS.sunVsCMB;
    const sq = S.squeeze ? 1 / 20 : 1;
    const vAU = AU_PER_DAY(vkms) * sq; // AU per day
    const span = S.squeeze ? 3 * 365.25 : 1.6 * 365.25;
    const [x, y, z] = motionView(u);
    const V = [x, y, z];
    const pos = (t) => { const q = planetPos(earth, t); return v3.add([q.x, q.y, q.z], v3.mul(u, vAU * (t - S.d))); }; // Sun at origin "now"
    const sunAt = (t) => v3.mul(u, vAU * (t - S.d));
    // fit the trail: from the Sun's position `span` days ago to now
    const L = vAU * span;
    const pts = [];
    for (let k = 0; k <= 500; k++) pts.push(mat.apply(V, pos(S.d - span + (k / 500) * span)));
    let minx = Infinity, maxx = -Infinity, miny = Infinity, maxy = -Infinity;
    for (const p of pts) { minx = Math.min(minx, p[0]); maxx = Math.max(maxx, p[0]); miny = Math.min(miny, p[1]); maxy = Math.max(maxy, p[1]); }
    const k = cam.zoom * Math.min((w * 0.86) / Math.max(maxx - minx, 1e-6), (h * 0.7) / Math.max(maxy - miny, 1e-6));
    // zoom centres on Earth (the newest point), so zooming in shows the coil you're on
    const e0 = pts[pts.length - 1], fx = cam.zoom > 1 ? Math.min(1, (cam.zoom - 1) / 2) : 0;
    const cxw = (minx + maxx) / 2 * (1 - fx) + e0[0] * fx, cyw = (miny + maxy) / 2 * (1 - fx) + e0[1] * fx;
    const ox = w / 2 - cxw * k, oy = h / 2 + cyw * k;
    const SX = (p) => ox + p[0] * k, SY = (p) => oy - p[1] * k;
    // the Sun's path
    const s0 = mat.apply(V, sunAt(S.d - span)), s1 = mat.apply(V, sunAt(S.d));
    ctx.strokeStyle = 'rgba(255,207,110,0.55)'; ctx.lineWidth = 1.5; ctx.setLineDash([5, 5]);
    ctx.beginPath(); ctx.moveTo(SX(s0), SY(s0)); ctx.lineTo(SX(s1), SY(s1)); ctx.stroke(); ctx.setLineDash([]);
    // Earth's corkscrew, fading into the past
    for (let i = 1; i < pts.length; i++) {
      const a = i / pts.length;
      const near = Math.max(0, Math.min(1, 0.5 + pts[i][2] * 0.35)); // depth cue: nearer coils brighter, thicker
      ctx.strokeStyle = `rgba(245,185,90,${((0.15 + 0.85 * a) * (0.45 + 0.55 * near)).toFixed(2)})`; ctx.lineWidth = (1 + a * 1.5) * (0.7 + 0.6 * near);
      ctx.beginPath(); ctx.moveTo(SX(pts[i - 1]), SY(pts[i - 1])); ctx.lineTo(SX(pts[i]), SY(pts[i])); ctx.stroke();
    }
    drawSun(ctx, SX(s1), SY(s1), 6, 3);
    const e = pts[pts.length - 1];
    ctx.fillStyle = '#5fb0f0'; ctx.beginPath(); ctx.arc(SX(e), SY(e), 4.5, 0, TAU); ctx.fill();
    label(ctx, S.frame === 'galaxy' ? 'Frame: the Milky Way' : 'Frame: the cosmic background', 12, 18, { size: 12, weight: 600, color: 'rgba(237,240,247,0.85)' });
    label(ctx, `motion →  ·  ${(L / sq).toFixed(0)} AU of real travel (${(span / 365.25).toFixed(1)} years) shown`, 12, h - 14, { size: 11, color: '#f5b95a' });
    const pitch = AU_PER_DAY(vkms) * 365.25;
    note.innerHTML = S.squeeze
      ? `<b>Squeezed:</b> the Sun is slowed down 20× here so you can see the coils. In reality each coil is ${pitch.toFixed(0)} AU long but only 2 AU across.`
      : `<b>True proportions.</b> Each year the Sun moves ${pitch.toFixed(0)} AU while Earth circles it at just 1 AU — so the "corkscrew" is a gently wavy line. Drag to look along it.`;
  }

  readouts();
  visibleLoop(canvas, frame);
  window.__speed = { S, draw, readouts };
}
