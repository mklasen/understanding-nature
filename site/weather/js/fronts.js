// Chapter 6 — fronts and rain. A schematic (kinematic) cross-section: a warm or cold front
// sweeps past a town; the clouds, rain and the town's weather follow from where the town sits
// relative to the front. Distances, speeds, slopes and cloud heights are typical real values;
// the vertical is exaggerated (labelled on the canvas). Northern-hemisphere winds.
import { fitCanvas, visibleLoop, bindRange, setRange, $ } from '../../kit/util.js';

const ZTOP = 11; // km shown
const hash = (n) => { const x = Math.sin(n * 12.9898 + 78.233) * 43758.5453; return x - Math.floor(x); };
const smooth = (e0, e1, x) => { const t = Math.max(0, Math.min(1, (x - e0) / (e1 - e0))); return t * t * (3 - 2 * t); };

// s = distance ahead of the surface front (km, + = ahead, the side it's moving towards)
const FRONTS = {
  warm: {
    speed: 20,              // km/h — warm fronts are slow
    slope: 150,             // 1 : 150  (real: 1:100 – 1:300)
    window: [-650, 750],    // km around the town
    t: [-48, 12],           // hours
    play: 6,                // model hours per real second
    // height of the frontal surface (cold air beneath) at s
    surf: (s) => (s > 0 ? s / 150 : 0),
    coldSide: 1,            // cold air is ahead (+s)
  },
  cold: {
    speed: 30,              // km/h
    slope: 70,              // 1 : 70 (real: 1:50 – 1:100), steeper still at the nose
    window: [-420, 420],
    t: [-14, 10],
    play: 3,
    surf: (s) => { const d = -s; return d > 0 ? Math.min(5, 1.5 * (1 - Math.exp(-d / 18)) + d / 110) : 0; },
    coldSide: -1,           // cold air is behind (−s)
  },
};

// ---------- the town's weather as a function of where the front is ----------
function townWeather(type, s) {
  if (type === 'warm') {
    const T = 7 + 8 * smooth(40, -40, s);                          // 7 °C cold air → 15 °C warm sector
    const p = s > 1000 ? 1016 : s > 0 ? 1016 - 13 * Math.pow(1 - s / 1000, 1.3) : 1003 - 0.002 * s;
    const kn = s > 1000 ? 3 : s > 0 ? 3 + 7 * (1 - s / 1000) : 8;
    const wind = s > 0 ? `${kn.toFixed(0)} m/s from the SE` : `${kn.toFixed(0)} m/s from the SW`;
    let sky, rain = 0;
    if (s > 1080) sky = 'Clear blue';
    else if (s > 800) sky = 'Cirrus — "mares\' tails"';
    else if (s > 600) sky = 'Cirrostratus — halo round the Sun';
    else if (s > 320) sky = 'Altostratus — Sun as if through frosted glass';
    else if (s > 0) { rain = s > 220 ? 0.4 : 1; sky = rain < 1 ? 'Nimbostratus — rain begins' : 'Nimbostratus — steady rain'; }
    else if (s > -200) { sky = 'Low grey cloud, drizzle, muggy'; rain = 0.25; }
    else sky = 'Mild, cloudy, a few breaks';
    return { T, p, wind, sky, rain };
  }
  const T = 9 + 7 * smooth(-25, 15, s);                             // 16 °C warm sector → 9 °C cold air
  const p = s > 0 ? 1006 - 2 * Math.exp(-s / 120) : Math.min(1012, 1004 + 0.035 * -s);
  const gust = Math.abs(s) < 30;
  const wind = s > 0 ? `${s < 60 ? 9 : 6} m/s from the SW` : gust ? '14 m/s gusting 25, veering NW' : '9 m/s from the NW';
  let sky, rain = 0;
  if (s > 160) sky = 'Warm, humid haze; towers building to the west';
  else if (s > 40) sky = 'Anvil cloud overhead — darkening';
  else if (s > -25) { sky = 'Cumulonimbus: downpour, gusts, maybe thunder'; rain = 1.6; }
  else if (s > -130) { sky = 'Clearing, with passing showers'; rain = 0.3; }
  else sky = 'Clear and crisp, small cumulus';
  return { T, p, wind, sky, rain };
}

// ---------- clouds (in front-relative km) ----------
function cloudsFor(type) {
  if (type === 'warm') return [
    { kind: 'layer', s0: -20, s1: 330, base: (s) => 0.5 + 0.0045 * Math.max(0, s), top: (s) => 5.6 - 0.002 * s, col: [150, 158, 172], a: 0.92, name: 'nimbostratus', ls: 150, lz: 3.2 },
    { kind: 'layer', s0: 260, s1: 660, base: (s) => s / 150 + 0.6, top: (s) => s / 150 + 2.0, col: [190, 198, 212], a: 0.62, name: 'altostratus', ls: 470, lz: -1 },
    { kind: 'layer', s0: 560, s1: 860, base: (s) => 6.3 + (s - 560) / 300, top: (s) => 7.4 + (s - 560) / 300, col: [225, 232, 245], a: 0.38, name: 'cirrostratus', ls: 720, lz: -1 },
    { kind: 'cirrus', s0: 790, s1: 1090, z0: 8.4, z1: 10, name: 'cirrus', ls: 940, lz: 10.3 },
    { kind: 'layer', s0: -230, s1: -10, base: () => 0.35, top: (s) => 1.2 + 0.2 * Math.sin(s / 13), col: [160, 168, 180], a: 0.55, name: '', ls: 0, lz: -1 },
  ];
  return [
    { kind: 'cb', s0: -25, s1: 35, name: 'cumulonimbus', ls: 5, lz: 9.8 },
    { kind: 'puffs', s0: 50, s1: 330, base: 1.1, h: 0.8, n: 7, name: '', seed: 3 },
    { kind: 'layer', s0: -125, s1: -25, base: () => 0.9, top: (s) => 2.4 + 0.4 * Math.sin(s / 25), col: [150, 158, 172], a: 0.6, name: '', ls: 0, lz: -1 },
    { kind: 'puffs', s0: -420, s1: -150, base: 1.0, h: 0.6, n: 7, name: '', seed: 9 },
  ];
}
function rainAt(type, s) { // 0..~1.6 at front-relative s
  if (type === 'warm') {
    if (s > 0 && s < 320) return s > 220 ? 0.45 * smooth(320, 220, s) + 0.2 : 1 - 0.3 * smooth(150, 0, s);
    if (s > -220 && s <= 0) return 0.18;
    return 0;
  }
  if (s > -25 && s < 30) return 1.6;
  if (s > -125 && s <= -25) return hash(Math.floor(s / 18)) > 0.45 ? 0.5 : 0;
  return 0;
}

export function initFronts() {
  const canvas = $('fronts-canvas');
  let type = 'warm', t = FRONTS.warm.t[0], playing = true, motes = [], seed = 1;
  const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  const slider = $('fronts-t');

  function setType(tp) {
    type = tp;
    const F = FRONTS[tp];
    slider.min = F.t[0]; slider.max = F.t[1];
    document.querySelectorAll('#fronts-type button').forEach((b) => b.classList.toggle('on', b.dataset.type === tp));
    motes = [];
    setRange(slider, F.t[0] + (F.t[1] - F.t[0]) * 0.12);
  }
  function label(tt) {
    if (Math.abs(tt) < 0.5) return 'front overhead';
    return tt < 0 ? `arrives in ${Math.round(-tt)} h` : `passed ${Math.round(tt)} h ago`;
  }

  bindRange(slider, (v) => { t = v; $('fronts-t-out').textContent = label(v); readouts(); });
  slider.addEventListener('pointerdown', () => setPlaying(false));
  document.querySelectorAll('#fronts-type button').forEach((b) => b.addEventListener('click', () => setType(b.dataset.type)));
  const play = $('fronts-play');
  function setPlaying(p) { playing = p; play.textContent = p ? '❚❚' : '▶'; play.setAttribute('aria-label', p ? 'Pause' : 'Play'); }
  play.addEventListener('click', () => setPlaying(!playing));
  setType('warm');

  function readouts() {
    const F = FRONTS[type], s = -F.speed * t; // where the town sits relative to the front
    const now = townWeather(type, s), before = townWeather(type, s + F.speed * 0.5), after = townWeather(type, s - F.speed * 0.5);
    const trend = after.p - before.p; // hPa per hour
    $('fronts-temp').textContent = `${now.T.toFixed(0)} °C`;
    $('fronts-p').innerHTML = `${now.p.toFixed(0)} hPa <small>${Math.abs(trend) < 0.12 ? 'steady' : trend < 0 ? `falling ${(-trend).toFixed(1)}/h` : `rising ${trend.toFixed(1)}/h`}</small>`;
    $('fronts-wind').textContent = now.wind;
    $('fronts-sky').textContent = now.sky;
    let why;
    if (type === 'warm') {
      if (s > 800) why = 'The front is still a day and a half away, but its warm air has already climbed the cold air above you to 8–10 km: those wispy cirrus are the first sign. <b>The pressure is starting to fall.</b>';
      else if (s > 320) why = 'The cloud sheet thickens and lowers as the frontal surface gets closer to the ground. The pressure keeps falling: you are moving towards the centre of a low.';
      else if (s > 0) why = '<span class="tag">Rain</span>Warm, moist air sliding up the gentle slope cools as it rises and condenses into a thick layer, hundreds of kilometres wide. That means <b>hours of steady rain</b>, not a quick shower.';
      else if (s > -220) why = 'The front has passed: you are in the <b>warm sector</b>. It\'s suddenly milder, the wind has swung round to the south-west and the pressure has stopped falling. Often grey and drizzly.';
      else why = 'Deep in the warm sector. Look west: a cold front is usually not far behind.';
    } else {
      if (s > 160) why = 'Ahead of the cold front it\'s warm and humid. The pressure sinks slowly. To the west, a wall of towering cloud is building.';
      else if (s > 30) why = 'The anvil of the storm spreads ahead of the front, high up. The sky darkens fast.';
      else if (s > -25) why = '<span class="tag">Downpour</span>The dense cold air shoves under the warm air like a snowplough and throws it <b>straight up</b>. Air lifted that fast builds cumulonimbus: short, violent rain, gusts, sometimes hail and thunder.';
      else if (s > -130) why = 'The front has passed: the temperature has dropped, the wind has veered to the north-west and <b>the pressure is rising</b>. A few showers left over.';
      else why = 'Cold, clear, fresh air with sharp visibility and bubbly little cumulus. "Behind the front" weather.';
    }
    $('fronts-why').innerHTML = why;
  }

  // ---------- motes: air moving relative to the front ----------
  function spawn(m, fresh) {
    const F = FRONTS[type], [x0, x1] = F.window, xf = F.speed * t;
    m.trail = []; m.cloudy = 0;
    if (type === 'warm') {
      if (rnd() < 0.72) { // warm air that overtakes the front and glides up the slope
        m.kind = 'warm'; m.h0 = 0.08 + Math.pow(rnd(), 1.3) * 2.6;
        m.s = (fresh ? x0 + rnd() * (x1 - x0) : x0) - xf;
        if (m.s > 0 && fresh) m.s = -rnd() * 400;
      } else { // cold air ahead, drifting slowly
        m.kind = 'cold'; m.x = x0 + rnd() * (x1 - x0); m.frac = 0.1 + 0.85 * rnd();
      }
    } else {
      if (rnd() < 0.7) { // warm air ahead, run into by the front
        m.kind = 'warm'; m.h0 = 0.08 + Math.pow(rnd(), 1.4) * 2.2; m.stage = 0; m.zUp = 0;
        m.s = fresh ? 30 + rnd() * (x1 - xf) : x1 - xf + 10;
      } else { // cold air behind, keeping pace with the front
        m.kind = 'cold'; m.s = fresh ? x0 - xf + rnd() * (xf - x0) : x0 - xf; m.frac = 0.08 + 0.85 * rnd();
      }
    }
    return m;
  }
  function moveMote(m, dh) { // dh: model hours elapsed (can be 0)
    const F = FRONTS[type], xf = F.speed * t;
    let x, z;
    if (type === 'warm') {
      if (m.kind === 'warm') {
        m.s += 14 * dh;                        // warm air runs ~14 km/h faster than the front
        x = xf + m.s; z = m.h0 + F.surf(m.s);  // ...and glides up, parallel to the frontal surface
        m.cloudy = z - m.h0 > 0.9 ? 1 : 0;      // lifted ~1 km → cooled to its dew point
        if (z > 10.6 || x > F.window[1] + 20) return null;
      } else {
        m.x += 6 * dh; x = m.x; const s = x - xf; z = m.frac * F.surf(s);
        if (s <= 2 || x > F.window[1] + 20) return null;
      }
    } else if (m.kind === 'warm') {
      if (m.stage === 0) { m.s -= 20 * dh; if (m.s < 12 + 6 * m.h0) m.stage = 1; z = m.h0 + 0.4 * smooth(80, 15, m.s); }
      if (m.stage === 1) { m.zUp += 9 * dh * 4; m.s -= 4 * dh; z = m.h0 + 0.4 + m.zUp; if (z > 9.3 + m.h0 * 0.5) { m.stage = 2; m.zA = z; } }
      if (m.stage === 2) { m.s += 25 * dh; z = m.zA; }
      x = xf + m.s;
      m.cloudy = m.stage >= 1 && z > 0.9 ? 1 : 0;
      if (x > F.window[1] + 20 || x < F.window[0] - 20 || (m.stage === 2 && m.s > 190)) return null;
    } else {
      m.s += 4 * dh; x = xf + m.s; z = m.frac * F.surf(m.s);
      if (m.s > -3) return null;
    }
    return [x, z];
  }

  let lastRO = 0;
  visibleLoop(canvas, (dt) => {
    const F = FRONTS[type];
    let dh = 0;
    if (playing) {
      dh = dt * F.play;
      t += dh;
      if (t > F.t[1]) { t = F.t[0]; motes = []; }
      slider.value = t; slider.style.setProperty('--fill', `${((t - F.t[0]) / (F.t[1] - F.t[0])) * 100}%`);
      $('fronts-t-out').textContent = label(t);
      const now = performance.now();
      if (now - lastRO > 300) { lastRO = now; readouts(); }
    } else dh = dt * F.play * 0.35; // when paused, the air keeps drifting gently past a fixed front
    draw(dh);
  });

  function draw(dh) {
    const { ctx, w, h } = fitCanvas(canvas);
    const F = FRONTS[type], [x0, x1] = F.window, span = x1 - x0, xf = F.speed * t;
    const small = w < 520;
    const gy = Math.round(h * (small ? 0.84 : 0.87)), top = 8;
    const X = (x) => ((x - x0) / span) * w, Z = (z) => gy - (z / ZTOP) * (gy - top);
    const XS = (s) => X(xf + s);
    const pxPerKm = w / span;

    // sky
    let g = ctx.createLinearGradient(0, 0, 0, gy);
    g.addColorStop(0, '#1d3a66'); g.addColorStop(1, '#7ea6cf');
    ctx.fillStyle = g; ctx.fillRect(0, 0, w, gy);

    // the cold air mass (wedge) + warm air tint
    ctx.fillStyle = 'rgba(255,150,80,0.10)'; ctx.fillRect(0, 0, w, gy);
    ctx.beginPath(); ctx.moveTo(XS(0), gy);
    const step = Math.max(1, span / w * 2);
    if (F.coldSide > 0) { for (let x = xf; x <= x1 + step; x += step) ctx.lineTo(X(x), Z(F.surf(x - xf))); ctx.lineTo(w, gy); }
    else { for (let x = xf; x >= x0 - step; x -= step) ctx.lineTo(X(x), Z(F.surf(x - xf))); ctx.lineTo(0, gy); }
    ctx.closePath();
    ctx.fillStyle = 'rgba(70,140,255,0.30)'; ctx.fill();
    // frontal surface line
    ctx.beginPath();
    if (F.coldSide > 0) for (let x = xf; x <= x1 + step; x += step) ctx.lineTo(X(x), Z(F.surf(x - xf)));
    else for (let x = xf; x >= x0 - step; x -= step) ctx.lineTo(X(x), Z(F.surf(x - xf)));
    ctx.strokeStyle = type === 'warm' ? 'rgba(255,120,90,0.9)' : 'rgba(110,170,255,0.95)'; ctx.lineWidth = 2; ctx.setLineDash([6, 4]); ctx.stroke(); ctx.setLineDash([]);

    // motes
    const n = small ? 130 : 220;
    while (motes.length < n) motes.push(spawn({}, true));
    for (let i = 0; i < motes.length; i++) {
      const m = motes[i];
      const p = moveMote(m, dh);
      if (!p) { spawn(m, false); continue; }
      m.trail.push(X(p[0]), Z(p[1]));
      if (m.trail.length > 12) m.trail.splice(0, 2);
      const tr = m.trail; if (tr.length < 4) continue;
      ctx.strokeStyle = m.kind === 'cold' ? 'rgba(190,220,255,0.55)' : m.cloudy ? 'rgba(255,255,255,0.75)' : 'rgba(255,210,170,0.6)';
      ctx.lineWidth = m.cloudy ? 1.8 : 1.2;
      ctx.beginPath(); ctx.moveTo(tr[0], tr[1]); for (let k = 2; k < tr.length; k += 2) ctx.lineTo(tr[k], tr[k + 1]); ctx.stroke();
    }

    // rain (drawn before clouds so they sit on top)
    ctx.lineWidth = 1;
    const ph = (performance.now() / 1000) % 1;
    for (let px = 0; px < w; px += small ? 4 : 5) {
      const s = x0 + px / pxPerKm - xf, r = rainAt(type, s);
      if (r <= 0 || hash(px * 0.37) > Math.min(1, r)) continue;
      const base = Z(type === 'cold' && Math.abs(s) < 35 ? 0.8 : type === 'warm' && s > 0 ? 0.5 + 0.0045 * s : 1.0);
      ctx.strokeStyle = `rgba(170,200,240,${0.25 + 0.25 * Math.min(1, r)})`;
      for (let yy = base + ((ph + hash(px)) % 1) * 14; yy < gy; yy += 14) { ctx.beginPath(); ctx.moveTo(px, yy); ctx.lineTo(px - 2, yy + 7); ctx.stroke(); }
    }

    // clouds
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    for (const c of cloudsFor(type)) drawCloud(ctx, c, XS, Z, pxPerKm, w);

    // ground
    g = ctx.createLinearGradient(0, gy, 0, h);
    g.addColorStop(0, '#4f6b3e'); g.addColorStop(1, '#22311d');
    ctx.fillStyle = g; ctx.fillRect(0, gy, w, h - gy);

    // the front's map symbol where it meets the ground
    const fx = XS(0);
    ctx.fillStyle = type === 'warm' ? '#ff6b5a' : '#5aa2ff';
    ctx.beginPath();
    if (type === 'warm') ctx.arc(fx, gy, 7, Math.PI, 0); else { ctx.moveTo(fx - 7, gy); ctx.lineTo(fx, gy - 10); ctx.lineTo(fx + 7, gy); }
    ctx.fill();
    ctx.fillRect(fx - 14, gy - 1.5, 28, 3);

    // the town
    const tx = X(0);
    ctx.strokeStyle = 'rgba(255,255,255,0.35)'; ctx.setLineDash([2, 4]); ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(tx, gy - 4); ctx.lineTo(tx, top + 14); ctx.stroke(); ctx.setLineDash([]);
    ctx.fillStyle = '#f2e6d0';
    for (const [dx, hh] of [[-9, 7], [-1, 10], [7, 6]]) { ctx.fillRect(tx + dx - 3, gy - hh, 6, hh); ctx.beginPath(); ctx.moveTo(tx + dx - 4, gy - hh); ctx.lineTo(tx + dx, gy - hh - 4); ctx.lineTo(tx + dx + 4, gy - hh); ctx.fill(); }

    // labels
    const fs = small ? 10.5 : 12;
    ctx.font = `600 ${fs}px ui-sans-serif, system-ui, sans-serif`;
    const lab = (txt, x, y, col = 'rgba(255,255,255,0.9)', align = 'center') => {
      const tw = ctx.measureText(txt).width;
      if (x < -tw / 2 || x > w + tw / 2) return;
      x = Math.max(tw / 2 + 6, Math.min(w - tw / 2 - 6, x));
      ctx.textAlign = 'center'; ctx.fillStyle = 'rgba(8,17,31,0.45)';
      const bx = x - tw / 2;
      ctx.fillRect(bx - 4, y - fs * 0.75, tw + 8, fs * 1.5);
      ctx.fillStyle = col; ctx.fillText(txt, x, y);
    };
    const lblY = gy + (h - gy) * 0.5;
    ctx.textAlign = 'center'; ctx.fillStyle = '#fff'; ctx.fillText('town', tx, lblY);
    const fl = type === 'warm' ? 'warm front' : 'cold front';
    if (Math.abs(fx - tx) > (small ? 60 : 80)) { ctx.fillStyle = type === 'warm' ? '#ffb0a5' : '#a9cdff'; ctx.fillText(fl, fx, lblY); }
    // air masses
    const coldX = F.coldSide > 0 ? Math.min(x1 - span * 0.12, xf + span * 0.35) : Math.max(x0 + span * 0.12, xf - span * 0.3);
    lab('COLD AIR', X(coldX), Z(Math.max(0.35, F.surf(coldX - xf) * 0.35)), '#cfe2ff');
    if (type === 'warm') lab('WARM, MOIST AIR', w * 0.14, Z(9.7), '#ffd9b8');
    else lab('WARM, MOIST AIR', X(Math.min(x1 - span * 0.12, xf + span * 0.32)), Z(5.6), '#ffd9b8');
    // cloud names (skip on narrow canvases if crowded)
    for (const c of cloudsFor(type)) {
      if (!c.name || c.lz < 0 && !c.name) continue;
      const lx = XS(c.ls);
      let lz = c.lz;
      if (lz < 0) lz = (c.top(c.ls) + c.base(c.ls)) / 2;
      lab(c.name, lx, Z(lz), '#fff');
    }
    // honest scale note + clock
    ctx.textAlign = 'right'; ctx.font = `500 ${small ? 10 : 11.5}px ui-sans-serif, system-ui, sans-serif`;
    const ex = Math.round(((gy - top) / ZTOP) / pxPerKm);
    ctx.fillStyle = 'rgba(255,255,255,0.75)';
    ctx.fillText(`schematic · ${span} km across · ${ZTOP} km high · heights ×${ex}`, w - 8, h - 8);
  }

  function drawCloud(ctx, c, XS, Z, pxPerKm, w) {
    if (c.kind === 'layer') {
      const n = 48, pts = [];
      for (let i = 0; i <= n; i++) { const s = c.s0 + (c.s1 - c.s0) * i / n; pts.push([s, c.top(s) + 0.25 * (hash(Math.round(s / 9)) - 0.5)]); }
      // one soft-edged polygon: top edge lumpy, ends faded with a horizontal gradient
      const xa = XS(c.s0), xb = XS(c.s1);
      if (xb < 0 || xa > w) return;
      const g = ctx.createLinearGradient(xa, 0, xb, 0), col = `${c.col[0]},${c.col[1]},${c.col[2]}`;
      g.addColorStop(0, `rgba(${col},0)`); g.addColorStop(0.15, `rgba(${col},${c.a})`);
      g.addColorStop(0.85, `rgba(${col},${c.a})`); g.addColorStop(1, `rgba(${col},0)`);
      ctx.fillStyle = g; ctx.beginPath();
      pts.forEach(([s, z], i) => (i ? ctx.lineTo(XS(s), Z(z)) : ctx.moveTo(XS(s), Z(z))));
      for (let i = n; i >= 0; i--) { const s = c.s0 + (c.s1 - c.s0) * i / n; ctx.lineTo(XS(s), Z(c.base(s))); }
      ctx.closePath(); ctx.fill();
      // lighter top edge
      ctx.strokeStyle = `rgba(255,255,255,${c.a * 0.35})`; ctx.lineWidth = 1.5; ctx.beginPath();
      pts.forEach(([s, z], i) => (i ? ctx.lineTo(XS(s), Z(z)) : ctx.moveTo(XS(s), Z(z)))); ctx.stroke();
    } else if (c.kind === 'cirrus') {
      ctx.strokeStyle = 'rgba(255,255,255,0.55)'; ctx.lineWidth = 1.4; ctx.lineCap = 'round';
      for (let i = 0; i < 16; i++) {
        const s = c.s0 + (c.s1 - c.s0) * hash(i + 1), z = c.z0 + (c.z1 - c.z0) * hash(i + 7);
        const x = XS(s), y = Z(z), L = 14 + 18 * hash(i + 3);
        ctx.beginPath(); ctx.moveTo(x - L, y + 3); ctx.quadraticCurveTo(x, y - 4, x + L, y - 1); ctx.stroke();
      }
    } else if (c.kind === 'cb') {
      // the storm: stacked cauliflower towers from ~0.8 km to the tropopause (~10 km),
      // flattening into an anvil that streams ahead of the front
      const sc = Z(0) - Z(1); // px per km vertically
      const g = ctx.createLinearGradient(0, Z(10.8), 0, Z(0.8));
      g.addColorStop(0, 'rgba(252,253,255,0.98)'); g.addColorStop(0.65, 'rgba(214,221,233,0.98)'); g.addColorStop(1, 'rgba(96,106,124,0.98)');
      ctx.fillStyle = g;
      // anvil
      ctx.beginPath();
      ctx.moveTo(XS(-38), Z(9.4));
      ctx.quadraticCurveTo(XS(-30), Z(10.9), XS(20), Z(10.8));
      ctx.quadraticCurveTo(XS(110), Z(10.8), XS(175), Z(10.35));
      ctx.quadraticCurveTo(XS(120), Z(10.0), XS(40), Z(8.9));
      ctx.closePath(); ctx.fill();
      // towers: circles whose radius is set in km horizontally, but never thinner than a few px
      const half = Math.max(16, 26 * pxPerKm);
      for (let i = 0; i < 9; i++) {
        const z = 1.4 + i * 0.95, wob = (hash(i + 11) - 0.5) * half * 0.5;
        const r = Math.min(half * (0.75 + 0.3 * hash(i + 5)), sc * 1.3 + half * 0.4);
        ctx.beginPath(); ctx.arc(XS(4) + wob, Z(z), r, 0, 7); ctx.fill();
        ctx.beginPath(); ctx.arc(XS(4) + wob + r * 0.7, Z(z - 0.3), r * 0.7, 0, 7); ctx.fill();
        ctx.beginPath(); ctx.arc(XS(4) + wob - r * 0.7, Z(z - 0.4), r * 0.65, 0, 7); ctx.fill();
      }
      // dark, flat base
      ctx.fillStyle = 'rgba(70,78,96,0.9)';
      ctx.fillRect(XS(4) - half * 1.5, Z(0.8) - 3, half * 3, 5);
    } else if (c.kind === 'puffs') {
      for (let i = 0; i < c.n; i++) {
        const s = c.s0 + (c.s1 - c.s0) * (i + hash(i + c.seed)) / c.n;
        const x = XS(s), yb = Z(c.base), r = Math.max(5, (c.h * (0.6 + 0.6 * hash(i + c.seed * 3)) / ZTOP) * (Z(0) - Z(ZTOP)) * 0.6);
        ctx.fillStyle = 'rgba(245,248,255,0.85)';
        ctx.beginPath(); ctx.arc(x, yb - r * 0.6, r, Math.PI, 0); ctx.arc(x + r * 0.9, yb - r * 0.4, r * 0.7, Math.PI, 0); ctx.arc(x - r * 0.9, yb - r * 0.35, r * 0.6, Math.PI, 0); ctx.closePath(); ctx.fill();
        ctx.fillStyle = 'rgba(160,170,190,0.6)'; ctx.fillRect(x - r * 1.4, yb - 2, r * 2.8, 2);
      }
    }
  }
}
