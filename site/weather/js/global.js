// Chapter 7 — the global engine: Hadley, Ferrel and polar cells, and the surface winds they make.
// A schematic, zonally averaged model (no continents): belts shift with the season, surface winds
// are drawn analytically per belt. A globe shows the winds; a pole-to-pole cross-section shows the
// cells that drive them. "If Earth didn't spin" blends to Hadley's single cell per hemisphere.
import { fitCanvas, visibleLoop, bindRange, setRange, $ } from '../../kit/util.js';

const D2R = Math.PI / 180;
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const TILT = 10 * D2R;          // globe viewed from 10°N so both hemispheres show
const DAYS_PER_SEC = 3;         // time-lapse for the drifting air
const DEG_PER_DAY = 86400 / 111195; // degrees of latitude per day at 1 m/s

// ---------- the model ----------
// month: 0 = 1 Jan … 12. ITCZ (zonal mean, over the oceans): ~5°N on average, ~−1.5° in Feb, ~11.5°N in Aug.
export function belts(month) {
  const itcz = 5 + 6.5 * Math.cos(2 * Math.PI * (month - 7.5) / 12);
  const d = itcz - 5; // the rest of the pattern follows the ITCZ, but less
  return { itcz, sthN: 30 + 0.6 * d, sthS: -30 + 0.6 * d, pfN: 60 + 0.5 * d, pfS: -60 + 0.5 * d };
}
// solar declination (for lighting only)
const declination = (month) => 23.44 * Math.sin(2 * Math.PI * (month * 30.44 - 79) / 365.25);

// zonal-mean surface wind (m/s) at latitude `lat`: u eastward, v northward. spin: 1 = real Earth, 0 = no spin.
export function surfaceWind(lat, B, spin = 1) {
  let u = 0, v = 0;
  const bump = (t) => Math.sin(Math.PI * Math.max(0, Math.min(1, t)));
  if (lat >= B.itcz && lat < B.sthN) { const s = bump((lat - B.itcz) / (B.sthN - B.itcz)); u = -6.5 * s; v = -2.8 * s; }        // NE trades
  else if (lat < B.itcz && lat > B.sthS) { const s = bump((B.itcz - lat) / (B.itcz - B.sthS)); u = -6.5 * s; v = 2.8 * s; }      // SE trades
  else if (lat >= B.sthN && lat < B.pfN) { const s = bump((lat - B.sthN) / (B.pfN - B.sthN)); u = 7 * s; v = 2.2 * s; }          // westerlies (from SW)
  else if (lat <= B.sthS && lat > B.pfS) { const s = bump((B.sthS - lat) / (B.sthS - B.pfS)); u = 8.5 * s; v = -2.4 * s; }       // roaring forties (from NW)
  else if (lat >= B.pfN) { const s = bump((lat - B.pfN) / (90 - B.pfN)); u = -3.5 * s; v = -1.2 * s; }                          // polar easterlies
  else { const s = bump((B.pfS - lat) / (B.pfS + 90)); u = -3.5 * s; v = 1.2 * s; }
  if (spin >= 1) return { u, v };
  // no spin: one cell per hemisphere, surface air flows straight back to the (thermal) equator
  let v0;
  if (lat >= B.itcz) v0 = -5 * bump((lat - B.itcz) / (90 - B.itcz)); else v0 = 5 * bump((B.itcz - lat) / (B.itcz + 90));
  return { u: u * spin, v: v * spin + v0 * (1 - spin) };
}

const COMPASS = ['north', 'north-north-east', 'north-east', 'east-north-east', 'east', 'east-south-east', 'south-east', 'south-south-east',
  'south', 'south-south-west', 'south-west', 'west-south-west', 'west', 'west-north-west', 'north-west', 'north-north-west'];
// direction the wind blows FROM
function fromDir(u, v) {
  const ang = Math.atan2(-u, -v) / D2R; // bearing of the source (0 = north, 90 = east)
  return COMPASS[Math.round(((ang + 360) % 360) / 22.5) % 16];
}

export function describe(lat, B, spin) {
  const { u, v } = surfaceWind(lat, B, spin ? 1 : 0);
  const hemi = lat >= B.itcz ? 'N' : 'S';
  const speed = Math.hypot(u, v);
  const near = (x, w = 6) => Math.abs(lat - x) < w;
  if (!spin) {
    return {
      cell: `One giant cell (${hemi === 'N' ? 'northern' : 'southern'} half)`,
      wind: near(B.itcz, 4) ? 'Calm, rising air' : `From the ${fromDir(u, v)}, ~${speed.toFixed(0)} m/s`,
      weather: near(B.itcz, 6) ? 'Rising, rainy air at the thermal equator.' : Math.abs(lat) > 75 ? 'Sinking, dry, icy air.' : 'One slow conveyor: cold air creeping from the pole to the equator.',
    };
  }
  let cell, name, weather;
  if (lat >= B.sthN || lat <= B.sthS) {
    const polar = lat >= B.pfN || lat <= B.pfS;
    cell = polar ? 'Polar cell' : 'Ferrel cell';
    name = polar ? 'polar easterlies' : lat > 0 ? 'westerlies' : 'westerlies (the roaring forties)';
  } else { cell = 'Hadley cell'; name = lat >= B.itcz ? 'north-east trades' : 'south-east trades'; }
  if (near(B.itcz, 5)) { name = 'the doldrums'; weather = 'Rising air: towering thunderstorms and heavy downpours almost every afternoon. Winds light and fickle.'; }
  else if (near(B.sthN, 5) || near(B.sthS, 5)) { name = 'the horse latitudes'; weather = 'Sinking, drying air: clear skies and little rain. Most of the great deserts sit here.'; }
  else if (near(B.pfN, 6) || near(B.pfS, 6)) weather = 'The storm track: cold polar air meets mild air, and lows spin up one after another.';
  else if (cell === 'Hadley cell') weather = 'Steady trade winds, small fair-weather clouds, showers on coasts that face the wind.';
  else if (cell === 'Ferrel cell') weather = 'Changeable: lows and fronts arrive from the west, steered by the jet stream. Rain in any season.';
  else weather = 'Cold, dry, sinking air. Little snow falls — but what falls never melts.';
  const calm = name === 'the doldrums' || name === 'the horse latitudes' || speed < 1.2;
  const wind = calm ? `${name}: light and variable` : `${name}, from the ${fromDir(u, v)}`;
  return { cell, wind: wind.charAt(0).toUpperCase() + wind.slice(1), weather };
}

// ---------- tiny value noise for cloud texture ----------
function hash(i, j) { let h = (i * 374761393 + j * 668265263) | 0; h = (h ^ (h >>> 13)) * 1274126177 | 0; return ((h ^ (h >>> 16)) >>> 0) / 4294967296; }
function noise(x, y) {
  const i = Math.floor(x), j = Math.floor(y), fx = x - i, fy = y - j;
  const sx = fx * fx * (3 - 2 * fx), sy = fy * fy * (3 - 2 * fy);
  const a = hash(i, j), b = hash(i + 1, j), c = hash(i, j + 1), d = hash(i + 1, j + 1);
  return (a + (b - a) * sx) * (1 - sy) + (c + (d - c) * sx) * sy;
}

export function initGlobal() {
  const globe = $('global-globe'), section = $('global-section');
  // state first: bindRange fires immediately
  let month = 6.5, myLat = 52, spinTarget = 1, spin = 1, B = belts(month), texKey = '';
  const mobile = matchMedia('(max-width: 620px)').matches;
  const N = mobile ? 420 : 750;
  const parts = [];
  let seed = 11;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  const spawn = (p) => {
    p.lat = Math.asin(2 * rnd() - 1) / D2R;
    p.lon = -100 + 200 * rnd();
    p.age = 0; p.life = 40 + rnd() * 60; p.trail = [];
    return p;
  };
  for (let i = 0; i < N; i++) { const p = spawn({}); p.age = rnd() * p.life; parts.push(p); }

  const tex = document.createElement('canvas');
  const TEX = mobile ? 180 : 240;
  tex.width = tex.height = TEX;
  const tctx = tex.getContext('2d');
  const img = tctx.createImageData(TEX, TEX);

  function update() {
    B = belts(month);
    const m = Math.floor(month) % 12;
    $('global-month-out').textContent = MONTHS[m];
    $('global-lat-out').textContent = `${Math.abs(myLat).toFixed(0)}°${myLat >= 0 ? 'N' : 'S'}`;
    const d = describe(myLat, B, spinTarget > 0.5);
    $('global-cell').textContent = d.cell;
    $('global-wind').textContent = d.wind;
    $('global-weather').textContent = d.weather;
    const it = B.itcz;
    $('global-why').innerHTML = spinTarget > 0.5
      ? `In ${MONTHS[m]} the rain belt (the <b>ITCZ</b>) sits near <b>${Math.abs(it).toFixed(0)}°${it >= 0 ? 'N' : 'S'}</b> over the oceans, a month or two behind the Sun. Over big continents it swings much further: the Asian monsoon drags it to 20–25°N in July.`
      : 'Without the spin there is no Coriolis effect: the air simply sinks at the poles and slides straight back toward the equator. One cell per hemisphere — Hadley\'s 1735 idea. Real winds don\'t look like this.';
  }

  bindRange($('global-month'), (v) => { month = v; update(); });
  bindRange($('global-lat'), (v) => { myLat = v; update(); });
  $('global-nospin').addEventListener('change', (e) => { spinTarget = e.target.checked ? 0 : 1; update(); $('global-aha').classList.add('lit'); });

  // tap the globe to pick a latitude
  globe.addEventListener('click', (e) => {
    const r = globe.getBoundingClientRect(), g = geom(r.width, r.height);
    const px = (e.clientX - r.left - g.cx) / g.R, py = -(e.clientY - r.top - g.cy) / g.R;
    if (px * px + py * py > 1) return;
    const z = Math.sqrt(1 - px * px - py * py);
    const lat = Math.asin(py * Math.cos(TILT) + z * Math.sin(TILT)) / D2R;
    setRange($('global-lat'), Math.max(-80, Math.min(80, Math.round(lat))));
  });

  function geom(w, h) {
    const R = Math.min(w, h) * 0.44;
    return { R, cx: w / 2, cy: h / 2 + (w < 520 ? 4 : 0) };
  }
  function project(lat, lon) {
    const la = lat * D2R, lo = lon * D2R, cT = Math.cos(TILT), sT = Math.sin(TILT);
    return [Math.cos(la) * Math.sin(lo), cT * Math.sin(la) - sT * Math.cos(la) * Math.cos(lo), sT * Math.sin(la) + cT * Math.cos(la) * Math.cos(lo)];
  }

  // per-pixel globe texture: ocean, cloud belts, dry belts, ice, sunlight
  function renderTexture() {
    const key = `${month.toFixed(2)}|${spin.toFixed(2)}`;
    if (key === texKey) return;
    texKey = key;
    const d = img.data, dec = declination(month) * D2R;
    const sun = [0, Math.sin(dec), Math.cos(dec)]; // world coords: x east, y north, z toward lon 0
    const cT = Math.cos(TILT), sT = Math.sin(TILT);
    for (let j = 0; j < TEX; j++) for (let i = 0; i < TEX; i++) {
      const o = (j * TEX + i) * 4;
      const px = (i + 0.5) / TEX * 2 - 1, py = 1 - (j + 0.5) / TEX * 2, rr = px * px + py * py;
      if (rr > 1) { d[o + 3] = 0; continue; }
      const z = Math.sqrt(1 - rr);
      const sl = py * cT + z * sT, lat = Math.asin(sl) / D2R, lon = Math.atan2(px, z * cT - py * sT) / D2R;
      const cl = Math.cos(lat * D2R);
      // world normal
      const nx = cl * Math.sin(lon * D2R), ny = sl, nz = cl * Math.cos(lon * D2R);
      let r = 22, g = 74, b = 128; // ocean
      const add = (cr, cg, cb, a) => { r += (cr - r) * a; g += (cg - g) * a; b += (cb - b) * a; };
      // ice caps
      const ice = Math.max(0, Math.min(1, (Math.abs(lat) - 72) / 6));
      add(225, 235, 245, ice * 0.9);
      // dry, cloud-free belts near the subtropical highs (only with spin)
      const dry = (Math.exp(-(((lat - B.sthN) / 7) ** 2)) + Math.exp(-(((lat - B.sthS) / 7) ** 2))) * spin;
      add(214, 176, 110, Math.min(0.55, dry * 0.55));
      // ITCZ: clusters of towering storms
      const n1 = noise(lon / 7, lat / 4) * 0.65 + noise(lon / 2.5, lat / 1.6) * 0.35;
      const itcz = Math.exp(-(((lat - B.itcz) / 4.5) ** 2));
      add(250, 252, 255, Math.max(0, Math.min(1, itcz * (n1 * 1.8 - 0.35))));
      // storm track: comma-shaped swirls of grey cloud
      const sw = noise(lon / 10 + lat / 6, lat / 3) * 0.6 + noise(lon / 3.5, lat / 2) * 0.4;
      const storm = (Math.exp(-(((lat - B.pfN) / 7) ** 2)) + Math.exp(-(((lat - B.pfS) / 7) ** 2))) * spin
        + Math.exp(-(((Math.abs(lat) - 70) / 10) ** 2)) * (1 - spin) * 0.3;
      add(205, 212, 224, Math.max(0, Math.min(0.85, storm * (sw * 2 - 0.55))));
      // trade-wind cumulus: small scattered puffs
      const trade = Math.max(0, 1 - Math.abs((lat - B.itcz) / 22)) * (1 - itcz) * spin;
      add(240, 244, 250, Math.max(0, (noise(lon / 1.4, lat / 1.4) - 0.68) * 2.4) * trade);
      // light: soft day side + limb darkening
      const L = 0.42 + 0.58 * Math.max(0, nx * sun[0] + ny * sun[1] + nz * sun[2]);
      const limb = 0.75 + 0.25 * z;
      d[o] = r * L * limb; d[o + 1] = g * L * limb; d[o + 2] = b * L * limb; d[o + 3] = 255;
    }
    tctx.putImageData(img, 0, 0);
  }

  function drawGlobe(dt) {
    const { ctx, w, h } = fitCanvas(globe);
    const { R, cx, cy } = geom(w, h);
    const small = w < 520;
    // space background
    ctx.fillStyle = '#060c18'; ctx.fillRect(0, 0, w, h);
    const halo = ctx.createRadialGradient(cx, cy, R * 0.95, cx, cy, R * 1.12);
    halo.addColorStop(0, 'rgba(142,197,255,0.35)'); halo.addColorStop(1, 'rgba(142,197,255,0)');
    ctx.fillStyle = halo; ctx.beginPath(); ctx.arc(cx, cy, R * 1.12, 0, 7); ctx.fill();
    renderTexture();
    ctx.save(); ctx.beginPath(); ctx.arc(cx, cy, R, 0, 7); ctx.clip();
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(tex, cx - R, cy - R, 2 * R, 2 * R);
    // latitude lines every 30°, equator stronger
    for (let la = -60; la <= 60; la += 30) {
      ctx.strokeStyle = la === 0 ? 'rgba(255,255,255,0.35)' : 'rgba(255,255,255,0.14)';
      ctx.lineWidth = la === 0 ? 1.2 : 1;
      ctx.setLineDash(la === 0 ? [] : [3, 4]);
      ctx.beginPath(); let pen = false;
      for (let lo = -90; lo <= 90; lo += 4) {
        const [x, y, z] = project(la, lo);
        if (z < 0) { pen = false; continue; }
        const X = cx + x * R, Y = cy - y * R;
        if (pen) ctx.lineTo(X, Y); else { ctx.moveTo(X, Y); pen = true; }
      }
      ctx.stroke();
    }
    ctx.setLineDash([]);

    // the air: drift with the surface wind
    const days = Math.min(dt, 0.05) * DAYS_PER_SEC;
    ctx.lineCap = 'round';
    for (const p of parts) {
      const { u, v } = surfaceWind(p.lat, B, spin);
      p.lat += v * DEG_PER_DAY * days;
      p.lon += (u * DEG_PER_DAY * days) / Math.max(0.2, Math.cos(p.lat * D2R));
      p.age += Math.min(dt, 0.05) * 20;
      if (p.lon > 110) p.lon -= 220; if (p.lon < -110) p.lon += 220;
      if (p.age > p.life || Math.abs(p.lat) > 88) { spawn(p); continue; }
      p.trail.push(p.lat, p.lon);
      if (p.trail.length > 18) p.trail.splice(0, 2);
      const t = p.trail;
      if (t.length < 4) continue;
      const fade = Math.min(1, p.age / 6, (p.life - p.age) / 6);
      ctx.strokeStyle = `rgba(255,255,255,${0.6 * fade})`; ctx.lineWidth = small ? 1.1 : 1.3;
      ctx.beginPath(); let pen = false, jump = false;
      for (let k = 0; k < t.length; k += 2) {
        const [x, y, z] = project(t[k], t[k + 1]);
        if (z < 0.02) { pen = false; continue; }
        if (k > 0 && Math.abs(t[k + 1] - t[k - 1]) > 50) jump = true;
        if (pen && !jump) ctx.lineTo(cx + x * R, cy - y * R); else { ctx.moveTo(cx + x * R, cy - y * R); pen = true; jump = false; }
      }
      ctx.stroke();
    }
    // "your latitude" ring
    ctx.strokeStyle = '#8ec5ff'; ctx.lineWidth = 2; ctx.setLineDash([6, 5]);
    ctx.beginPath(); let pen = false;
    for (let lo = -90; lo <= 90; lo += 3) {
      const [x, y, z] = project(myLat, lo);
      if (z < 0) { pen = false; continue; }
      if (pen) ctx.lineTo(cx + x * R, cy - y * R); else { ctx.moveTo(cx + x * R, cy - y * R); pen = true; }
    }
    ctx.stroke(); ctx.setLineDash([]);
    ctx.restore();
    ctx.strokeStyle = 'rgba(255,255,255,0.25)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(cx, cy, R, 0, 7); ctx.stroke();

    // belt labels with a wind arrow, on the left side of the disc
    const fs = small ? 10.5 : 12;
    ctx.font = `600 ${fs}px ui-sans-serif, system-ui, sans-serif`; ctx.textBaseline = 'middle';
    const labels = spin > 0.5 ? [
      [(B.pfN + 90) / 2 + 3, 'polar easterlies'], [(B.sthN + B.pfN) / 2, 'westerlies'], [(B.itcz + B.sthN) / 2, 'NE trades'],
      [B.itcz, 'doldrums'], [(B.itcz + B.sthS) / 2, 'SE trades'], [(B.sthS + B.pfS) / 2, 'westerlies'],
    ] : [[(B.itcz + 90) / 2, 'toward the equator'], [B.itcz, 'rising air'], [(B.itcz - 90) / 2, 'toward the equator']];
    for (const [la, txt] of labels) {
      const lo = -38;
      const [x, y, z] = project(la, lo);
      if (z <= 0) continue;
      const X = cx + x * R, Y = cy - y * R;
      const { u, v } = surfaceWind(la, B, spin);
      const sp = Math.hypot(u, v);
      if (sp > 1) { // arrow in the wind direction (projected)
        const [x2, y2] = project(la + v / sp * 3, lo + u / sp * 3 / Math.cos(la * D2R));
        let ax = (x2 - x) * R, ay = -(y2 - y) * R; const al = Math.hypot(ax, ay) || 1; ax /= al; ay /= al;
        const L = small ? 18 : 24;
        ctx.strokeStyle = '#fff'; ctx.fillStyle = '#fff'; ctx.lineWidth = 2.2;
        ctx.beginPath(); ctx.moveTo(X - ax * L / 2, Y - ay * L / 2); ctx.lineTo(X + ax * L / 2, Y + ay * L / 2); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(X + ax * (L / 2 + 5), Y + ay * (L / 2 + 5)); ctx.lineTo(X + ax * (L / 2 - 3) - ay * 4.5, Y + ay * (L / 2 - 3) + ax * 4.5); ctx.lineTo(X + ax * (L / 2 - 3) + ay * 4.5, Y + ay * (L / 2 - 3) - ax * 4.5); ctx.fill();
      }
      ctx.textAlign = 'left';
      const tw = ctx.measureText(txt).width;
      const lx = X + 16;
      ctx.fillStyle = 'rgba(6,12,24,0.6)'; ctx.fillRect(lx - 4, Y - fs * 0.75, tw + 8, fs * 1.5);
      ctx.fillStyle = '#fff'; ctx.fillText(txt, lx, Y);
    }
    // honest captions
    ctx.font = `500 ${small ? 10 : 11.5}px ui-sans-serif, system-ui, sans-serif`;
    ctx.fillStyle = 'rgba(255,255,255,0.7)'; ctx.textAlign = 'left'; ctx.textBaseline = 'top';
    ctx.fillText(`${MONTHS[Math.floor(month) % 12]} · average surface winds`, 10, 8);
    ctx.textAlign = 'right';
    ctx.fillText('no continents · time-lapse 1 s ≈ 3 days', w - 10, 8);
    ctx.textBaseline = 'bottom'; ctx.textAlign = 'left';
    ctx.fillText('tap the globe to pick a latitude', 10, h - 8);
  }

  function drawSection(t) {
    const { ctx, w, h } = fitCanvas(section);
    const small = w < 520;
    const padL = small ? 8 : 14, padR = small ? 8 : 14, top = small ? 34 : 38, base = h - (small ? 20 : 22);
    const KM = 18; // km shown
    const X = (lat) => padL + (lat + 90) / 180 * (w - padL - padR);
    const Z = (km) => base - (km / KM) * (base - top);
    const trop = (lat) => 8.5 + 8 / (1 + Math.exp((Math.abs(lat) - 35) / 6));
    const g = ctx.createLinearGradient(0, top, 0, base);
    g.addColorStop(0, '#0d1a2e'); g.addColorStop(1, '#1d3a5f');
    ctx.fillStyle = '#08111f'; ctx.fillRect(0, 0, w, h);
    // troposphere
    ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(X(-90), base);
    for (let la = -90; la <= 90; la += 2) ctx.lineTo(X(la), Z(trop(la)));
    ctx.lineTo(X(90), base); ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.25)'; ctx.setLineDash([4, 4]); ctx.beginPath();
    for (let la = -90; la <= 90; la += 2) (la === -90 ? ctx.moveTo : ctx.lineTo).call(ctx, X(la), Z(trop(la)));
    ctx.stroke(); ctx.setLineDash([]);
    // ground
    ctx.fillStyle = '#2a4a3a'; ctx.fillRect(0, base, w, h - base);

    // cells: [from lat, to lat, direction] — dir −1 = rising on the left edge
    const cells = spin > 0.5 ? [
      [-90, B.pfS, 1, 'Polar'], [B.pfS, B.sthS, -1, 'Ferrel'], [B.sthS, B.itcz, 1, 'Hadley'],
      [B.itcz, B.sthN, -1, 'Hadley'], [B.sthN, B.pfN, 1, 'Ferrel'], [B.pfN, 90, -1, 'Polar'],
    ] : [[-90, B.itcz, 1, 'one cell'], [B.itcz, 90, -1, 'one cell']];
    const alpha = spin > 0.5 ? spin : 1 - spin;
    ctx.font = `600 ${small ? 10 : 11.5}px ui-sans-serif, system-ui, sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    for (const [a, b, dir, name] of cells) {
      const mid = (a + b) / 2, H = Math.min(trop(a), trop(b)) * 0.86;
      const ccx = (X(a) + X(b)) / 2, ccy = Z(H / 2), rx = (X(b) - X(a)) / 2 * 0.86, ry = (Z(0) - Z(H)) / 2 * 0.8;
      ctx.strokeStyle = `rgba(255,255,255,${0.28 * alpha})`; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.ellipse(ccx, ccy, rx, ry, 0, 0, 7); ctx.stroke();
      // moving dots along the loop
      ctx.fillStyle = `rgba(255,255,255,${0.9 * alpha})`;
      const nd = Math.max(5, Math.round(rx / 9));
      for (let k = 0; k < nd; k++) {
        const th = (k / nd) * 2 * Math.PI + dir * t * 0.6;
        ctx.beginPath(); ctx.arc(ccx + rx * Math.cos(th), ccy - ry * Math.sin(th), small ? 1.6 : 2, 0, 7); ctx.fill();
      }
      if (rx > 22) { ctx.fillStyle = `rgba(255,255,255,${0.85 * alpha})`; ctx.fillText(name, ccx, ccy); }
      void mid;
    }
    // rising (rain) and sinking (dry) markers at the ground
    const marks = spin > 0.5
      ? [[B.itcz, 'rain', '#8ec5ff'], [B.sthN, 'dry', '#f0c070'], [B.sthS, 'dry', '#f0c070'], [B.pfN, 'storms', '#c9d6ea'], [B.pfS, 'storms', '#c9d6ea']]
      : [[B.itcz, 'rain', '#8ec5ff']];
    ctx.font = `600 ${small ? 9.5 : 11}px ui-sans-serif, system-ui, sans-serif`; ctx.textBaseline = 'top';
    for (const [la, txt, col] of marks) { ctx.fillStyle = col; ctx.fillText(txt, X(la), base + 5); }
    // jet streams at the tropopause (⊙: blowing west → east, toward you)
    if (spin > 0.5) {
      const winterN = Math.cos(2 * Math.PI * (month - 0.5) / 12); // +1 in January
      const jets = [[B.sthN + 1, 12.5, 1 + 0.35 * winterN], [B.sthS - 1, 12.5, 1 - 0.35 * winterN], [B.pfN - 2, 9.5, 0.8 + 0.25 * winterN], [B.pfS + 2, 9.5, 0.8 - 0.25 * winterN]];
      for (const [la, km, s] of jets) {
        const x = X(la), y = Z(Math.min(km, trop(la) - 0.6)), r = (small ? 4.5 : 6) * s;
        ctx.strokeStyle = `rgba(255,170,110,${alpha})`; ctx.fillStyle = `rgba(255,170,110,${alpha})`; ctx.lineWidth = 1.6;
        ctx.beginPath(); ctx.arc(x, y, r, 0, 7); ctx.stroke(); ctx.beginPath(); ctx.arc(x, y, 1.6, 0, 7); ctx.fill();
      }
    }
    // your latitude
    ctx.strokeStyle = '#8ec5ff'; ctx.setLineDash([3, 3]); ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(X(myLat), top); ctx.lineTo(X(myLat), base); ctx.stroke(); ctx.setLineDash([]);
    // axis labels + honest note
    ctx.fillStyle = 'rgba(255,255,255,0.7)'; ctx.font = `500 ${small ? 9.5 : 11}px ui-sans-serif, system-ui, sans-serif`;
    ctx.textBaseline = 'top'; ctx.textAlign = 'left'; ctx.fillText('S pole', padL, 6);
    ctx.textAlign = 'center'; ctx.fillText('equator', X(0), 6);
    ctx.textAlign = 'right'; ctx.fillText('N pole', w - padR, 6);
    const ex = Math.round(((base - top) / KM) / ((w - padL - padR) / 20015));
    ctx.textBaseline = 'top'; ctx.textAlign = 'right'; ctx.fillStyle = 'rgba(255,255,255,0.55)';
    ctx.fillText(`schematic · heights ×${ex}${spin > 0.5 ? (small ? ' · ⊙ jet stream' : ' · ⊙ jet stream (blowing toward you)') : ''}`, w - padR, small ? 18 : 20);
  }

  let t = 0;
  update();
  visibleLoop(globe.closest('.stage') || globe, (dt) => {
    t += dt;
    spin += (spinTarget - spin) * (1 - Math.exp(-dt * 3));
    if (Math.abs(spin - spinTarget) < 0.01) spin = spinTarget;
    drawGlobe(dt);
    drawSection(t);
  });
  window.__global = { belts, surfaceWind, describe, get state() { return { month, myLat, spin, B }; } };
}
