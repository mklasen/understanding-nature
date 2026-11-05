// Chapter 5 — how clouds form. Lift a parcel of air: it cools at 9.8 °C/km until it reaches its
// dew point (cloud base), then more slowly as condensation releases heat. Let it go: if it is warmer
// than its surroundings it keeps rising on its own, to the cloud top. Physics in parcel.js.
import { profile, verdict, at, stepParcel, moistLapse, TROPOPAUSE, MIXED } from './parcel.js';
import { fitCanvas, visibleLoop, bindRange, setRange, $ } from '../../kit/util.js';

const ZMAX = 12500;
const SPEEDUP = 60; // free-rise animation is a ×60 time-lapse (labelled on the canvas)
const PRESETS = {
  summer: { t: 30, rh: 25, lapse: 8, sun: true, lid: false, z: 0 },
  fair: { t: 22, rh: 55, lapse: 6.5, sun: true, lid: true, z: 0 },
  tropics: { t: 30, rh: 75, lapse: 5.5, sun: true, lid: false, z: 0 },
  morning: { t: 3, rh: 97, lapse: 4, sun: false, lid: false, z: 0 },
};

export const fmtH = (m) => (m < 1000 ? `${Math.round(m / 10) * 10} m` : `${(m / 1000).toFixed(m < 10000 ? 2 : 1)} km`);

export function initClouds() {
  const canvas = $('clouds-canvas');
  // state first — bindRange fires immediately
  const prm = { T0: 22, rh: 55, lapse: 6.5, lid: true, mixed: true };
  let P = profile(prm), V = verdict(P);
  const s = { z: 0, w: 0 };
  let free = false, cloudTop = 0, flash = 0, settle = 0, t = 0;
  const zIn = $('clouds-z');

  const rebuild = () => { P = profile(prm); V = verdict(P); readouts(); };
  bindRange($('clouds-t'), (v) => { prm.T0 = v; $('clouds-t-out').textContent = `${v} °C`; rebuild(); });
  bindRange($('clouds-rh'), (v) => { prm.rh = v; rebuild(); });
  bindRange($('clouds-lapse'), (v) => { prm.lapse = v; $('clouds-lapse-out').textContent = `${v.toFixed(1)} °C per km`; rebuild(); });
  $('clouds-sun').addEventListener('change', (e) => { prm.mixed = e.target.checked; rebuild(); });
  $('clouds-lid').addEventListener('change', (e) => { prm.lid = e.target.checked; rebuild(); });
  bindRange(zIn, (v) => {
    $('clouds-z-out').textContent = v < 20 ? 'the ground' : fmtH(v);
    if (zIn.dataset.auto) return; // moved by the animation, not the reader
    s.z = v; s.w = 0; free = false; $('clouds-go').textContent = 'Let it go';
    readouts();
  });
  const syncSlider = () => { zIn.dataset.auto = '1'; setRange(zIn, Math.round(s.z / 50) * 50); delete zIn.dataset.auto; };
  $('clouds-go').addEventListener('click', () => {
    if (free) { free = false; $('clouds-go').textContent = 'Let it go'; return; }
    if (s.z < 1) s.z = 1; // a gentle nudge off the ground
    s.w = 0; free = true; settle = 0; $('clouds-go').textContent = 'Hold it';
    $('clouds-aha').classList.add('lit');
  });
  $('clouds-ground').addEventListener('click', () => { free = false; s.z = 0; s.w = 0; cloudTop = 0; syncSlider(); $('clouds-go').textContent = 'Let it go'; readouts(); });
  document.querySelectorAll('#clouds [data-cpreset]').forEach((b) => b.addEventListener('click', () => {
    const p = PRESETS[b.dataset.cpreset];
    free = false; s.z = 0; s.w = 0; cloudTop = 0;
    $('clouds-sun').checked = p.sun; prm.mixed = p.sun;
    $('clouds-lid').checked = p.lid; prm.lid = p.lid;
    setRange($('clouds-t'), p.t); setRange($('clouds-rh'), p.rh); setRange($('clouds-lapse'), p.lapse);
    syncSlider(); $('clouds-go').textContent = 'Let it go';
    rebuild();
  }));

  function readouts() {
    const Td0 = P.Td0;
    $('clouds-rh-out').textContent = `${Math.round(prm.rh)}% · dew point ${Td0.toFixed(0)} °C`;
    const lcl = P.lcl;
    $('clouds-base').textContent = lcl > ZMAX ? 'none' : lcl < 30 ? 'at the ground' : fmtH(lcl);
    const B = at(P, 'B', s.z);
    $('clouds-here-label').textContent = s.z < 20 ? 'Air at the ground' : `Bubble at ${fmtH(s.z)}`;
    $('clouds-here').textContent = s.z < 20 && Math.abs(B) < 0.6
      ? (prm.mixed ? 'a thermal, +0.5 °C' : 'same as around it')
      : `${Math.abs(B).toFixed(1)} °C ${B >= 0 ? 'warmer ↑' : 'colder ↓'}`;
    $('clouds-top').textContent = V.top ? fmtH(Math.min(V.top, 13500)) : '—';
    $('clouds-verdict').textContent = V.label;
    let why;
    if (s.z < lcl) {
      why = `<span class="tag">Below cloud base</span>Rising air expands and cools <b>9.8 °C per km</b>. Its dew point drops only ~1.8 °C per km, so the gap closes by about 8 °C every km — roughly <b>125 m of height per degree</b>. Here the gap starts at ${(prm.T0 - Td0).toFixed(1)} °C, so cloud base is near ${lcl > ZMAX ? 'the top of the sky — too dry' : fmtH(125 * (prm.T0 - Td0))}.`;
    } else {
      why = `<span class="tag">Inside the cloud</span>Above cloud base the vapour condenses into droplets and releases its hidden heat, so the rising air now cools only <b>${(moistLapse(at(P, 'Tp', s.z), at(P, 'p', s.z)) * 1000).toFixed(1)} °C per km</b> here (instead of 9.8). That extra warmth is the fuel for big clouds.`;
    }
    const tail = {
      dry: ' The air is so dry it would have to climb more than 6 km to make cloud: clear blue sky.',
      thermals: ' The Sun makes thermals, but they run out of lift before they reach cloud base: blue sky, bumpy flights.',
      fog: ' The air is already almost saturated at the ground — fog or a low grey layer, and nothing to make it bubble up.',
      forced: ' Nothing makes this air rise by itself: you only get cloud where it is pushed up — over hills, or at a front.',
      push: ` Lifted past ${fmtH(P.lfc)} it would take off on its own — but that needs a big push: a mountain range or a front.`,
      cumulus: ' Thermals reach cloud base and bubble up a little, but soon run out of buoyancy: fluffy fair-weather cumulus.',
      shower: ' The cloud keeps going for kilometres before the air around it catches up: a tall shower cloud.',
      storm: ` The bubble stays warmer than its surroundings almost to the top of the weather, ${fmtH(V.top)} up: a thunderstorm.`,
    }[V.key];
    $('clouds-why').innerHTML = why + tail;
  }
  readouts();

  // deterministic puffs for the cloud
  const frac = (x) => ((x % 1) + 1) % 1;
  const puffs = Array.from({ length: 40 }, (_, i) => ({ a: frac(Math.sin(i * 12.9898) * 43758.5453), b: frac(Math.sin(i * 78.233) * 12345.678) }));

  let lastRO = 0;
  visibleLoop(canvas, (dt) => {
    t += dt;
    if (free) {
      const sub = 8, h = (dt * SPEEDUP) / sub;
      for (let i = 0; i < sub; i++) stepParcel(P, s, h);
      if (s.z <= 0 && s.w <= 0) { free = false; $('clouds-go').textContent = 'Let it go'; }
      settle = Math.abs(s.w) < 0.15 ? settle + dt : 0;
      syncSlider();
    }
    cloudTop = s.z > cloudTop ? s.z : cloudTop + (s.z - cloudTop) * (1 - Math.exp(-dt * 0.6));
    draw(dt);
    const now = performance.now();
    if (now - lastRO > 200) { lastRO = now; readouts(); }
  });

  function draw(dt) {
    const { ctx, w, h } = fitCanvas(canvas);
    const small = w < 520;
    const font = (px, wgt = 500) => `${wgt} ${px}px ui-sans-serif, system-ui, sans-serif`;
    const pt = 16, pb = 30, pl = small ? 30 : 38;
    const cw = Math.round(w * (small ? 0.56 : 0.58)); // chart | scene
    const Y = (z) => h - pb - (z / ZMAX) * (h - pb - pt);
    const step = 5; // every 50 m
    const lcl = P.lcl;
    // temperature range of the chart
    // skewed axes (like a meteorologist's skew-T): isotherms lean right by SK °C per km, so
    // lines that cool at a typical rate stand upright and small differences become visible
    const SK = 7, sk = (T, z) => T + SK * z / 1000;
    let tmin = 1e9, tmax = -1e9;
    for (let i = 0; i < P.n && P.z[i] <= ZMAX; i += step) {
      const z = P.z[i];
      tmin = Math.min(tmin, sk(P.Te[i], z), sk(P.Tp[i], z)); tmax = Math.max(tmax, sk(P.Te[i], z), sk(P.Tp[i], z));
      if (z < lcl) tmin = Math.min(tmin, sk(P.Td[i], z));
    }
    tmin = Math.floor((tmin - 4) / 5) * 5; tmax = Math.ceil((tmax + 4) / 5) * 5;
    const X = (T, z) => pl + ((sk(T, z) - tmin) / (tmax - tmin)) * (cw - pl - 10);

    // ---- chart panel ----
    ctx.fillStyle = '#0d1a2e'; ctx.fillRect(0, 0, cw, h);
    ctx.font = font(small ? 10 : 11); ctx.textBaseline = 'middle';
    ctx.strokeStyle = 'rgba(255,255,255,0.07)'; ctx.lineWidth = 1;
    ctx.fillStyle = 'rgba(255,255,255,0.5)'; ctx.textAlign = 'center';
    ctx.save(); ctx.beginPath(); ctx.rect(pl, pt, cw - pl, h - pb - pt); ctx.clip();
    for (let T = Math.ceil((tmin - SK * ZMAX / 1000) / 10) * 10; T <= tmax; T += 10) {
      ctx.beginPath(); ctx.moveTo(X(T, 0), Y(0)); ctx.lineTo(X(T, ZMAX), Y(ZMAX)); ctx.stroke();
    }
    ctx.restore();
    for (let T = Math.ceil(tmin / 10) * 10; T <= tmax; T += 10) if (X(T, 0) > pl + 6) ctx.fillText(`${T}°`, X(T, 0), h - pb + 10);
    ctx.fillText('temperature (slanted lines)', (pl + cw) / 2, h - 8);
    ctx.textAlign = 'right';
    for (let z = 0; z <= 12000; z += 2000) {
      ctx.beginPath(); ctx.moveTo(pl, Y(z)); ctx.lineTo(w, Y(z)); ctx.stroke();
      ctx.fillText(z === 0 ? '0' : `${z / 1000} km`, pl - 4, Y(z));
    }
    // buoyant region (parcel warmer than its surroundings)
    ctx.strokeStyle = 'rgba(255,154,90,0.35)'; ctx.lineWidth = Math.max(1.5, (h - pb - pt) / (ZMAX / 50)) + 0.6;
    ctx.beginPath();
    for (let i = 0; i < P.n && P.z[i] <= ZMAX; i += step) if (P.B[i] > 0) { const y = Y(P.z[i]); ctx.moveTo(X(P.Te[i], P.z[i]), y); ctx.lineTo(X(P.Tp[i], P.z[i]), y); }
    ctx.stroke();
    const line = (f, col, width, from = 0, to = ZMAX, dash = null) => {
      ctx.strokeStyle = col; ctx.lineWidth = width; ctx.setLineDash(dash || []);
      ctx.beginPath(); let first = true;
      for (let i = 0; i < P.n && P.z[i] <= ZMAX; i += step) {
        if (P.z[i] < from || P.z[i] > to) continue;
        const x = X(P[f][i], P.z[i]), y = Y(P.z[i]);
        first ? ctx.moveTo(x, y) : ctx.lineTo(x, y); first = false;
      }
      ctx.stroke(); ctx.setLineDash([]);
    };
    line('Te', 'rgba(255,255,255,0.85)', 2);
    if (lcl < ZMAX) line('Td', '#9fd8a5', 1.6, 0, lcl + 10, [5, 4]);
    else line('Td', '#9fd8a5', 1.6, 0, ZMAX, [5, 4]);
    line('Tp', '#ff9a5a', 2.6, 0, Math.min(lcl, ZMAX));
    if (lcl < ZMAX) line('Tp', '#8ec5ff', 2.6, lcl, ZMAX);
    // line labels near the top of the chart
    ctx.font = font(small ? 10 : 11, 600); ctx.textAlign = 'left';
    const zl = 10500, il = Math.round(zl / P.dz);
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    const xe = X(P.Te[il], zl), xp = X(P.Tp[il], zl);
    ctx.fillText('surroundings', Math.min(cw - (small ? 66 : 74), xe + 6), Y(zl) + (xp > xe ? 12 : -12));
    ctx.fillStyle = lcl < zl ? '#8ec5ff' : '#ff9a5a';
    ctx.fillText('rising air', Math.min(cw - 52, xp + 6), Y(zl) + (xp > xe ? -12 : 12));
    ctx.fillStyle = '#9fd8a5';
    const zd = Math.min(lcl, ZMAX) * 0.45, id = Math.round(zd / P.dz);
    if (zd > 300) { ctx.textAlign = 'right'; ctx.fillText('dew point', X(P.Td[id], zd) - 5, Y(zd)); }

    // ---- scene panel ----
    const sx = cw, sw = w - cw, cx = sx + sw * 0.5;
    let g = ctx.createLinearGradient(0, pt, 0, h - pb);
    g.addColorStop(0, '#0c1c3a'); g.addColorStop(0.6, '#2f5c99'); g.addColorStop(1, '#79a8da');
    ctx.fillStyle = g; ctx.fillRect(sx, 0, sw, h - pb);
    ctx.fillStyle = '#0c1c3a'; ctx.fillRect(sx, 0, sw, pt);
    ctx.fillStyle = '#3d5e35'; ctx.fillRect(sx, h - pb, sw, pb);
    ctx.fillStyle = '#2d4a28'; ctx.fillRect(sx, h - pb + pb * 0.5, sw, pb * 0.5);
    // tropopause
    ctx.strokeStyle = 'rgba(255,255,255,0.25)'; ctx.setLineDash([2, 4]); ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(pl, Y(TROPOPAUSE)); ctx.lineTo(w, Y(TROPOPAUSE)); ctx.stroke(); ctx.setLineDash([]);
    ctx.fillStyle = 'rgba(255,255,255,0.55)'; ctx.font = font(small ? 9.5 : 10.5); ctx.textAlign = 'right';
    ctx.fillText('tropopause: the lid on the weather', w - 6, Y(TROPOPAUSE) - 8);
    if (prm.lid) {
      ctx.fillStyle = 'rgba(255,154,90,0.16)'; ctx.fillRect(pl, Y(2200), w - pl, Y(1800) - Y(2200));
      ctx.fillStyle = 'rgba(255,190,150,0.8)'; ctx.font = font(small ? 9.5 : 10.5); ctx.textAlign = 'right'; ctx.fillText('warm lid', w - 6, Y(2000));
    }

    // the cloud: from cloud base up to where the air has been lifted
    const top = Math.min(cloudTop, 13500);
    if (lcl < ZMAX && top > lcl + 20) {
      const yb = Y(lcl), yt = Y(top), depth = yb - yt;
      const width = Math.min(sw * 0.8, 26 + depth * 0.35);
      const n = Math.max(5, Math.min(36, Math.round(depth / 9)));
      for (let k = 0; k < n; k++) {
        const f = k / (n - 1), pf = puffs[k];
        const y = yb - f * depth;
        const wv = width * (0.55 + 0.45 * Math.sin(Math.PI * Math.min(1, f * 1.2 + 0.1)));
        const r = Math.max(7, wv * 0.32);
        const x = cx + (pf.a - 0.5) * (wv - r) * 0.9;
        const shade = 235 - 50 * (1 - f) * Math.min(1, depth / 160);
        ctx.fillStyle = `rgba(${shade},${shade + 4},${shade + 12},0.93)`;
        ctx.beginPath(); ctx.arc(x, y - r * 0.2, r, 0, 7); ctx.fill();
      }
      ctx.fillStyle = 'rgba(160,170,190,0.9)'; ctx.fillRect(cx - width * 0.42, yb - 3, width * 0.84, 5); // flat base
      if (top > 9000) { // anvil spreading along the tropopause
        const aw = Math.min(sw * 0.98, width * 2.2), ay = Y(Math.min(top, TROPOPAUSE + 600));
        ctx.fillStyle = 'rgba(232,238,248,0.92)';
        ctx.beginPath(); ctx.ellipse(cx + aw * 0.12, ay, aw / 2, Math.max(6, depth * 0.035), 0, 0, 7); ctx.fill();
      }
      // rain (and lightning) from deep clouds
      if (top - lcl > 4000) {
        ctx.strokeStyle = 'rgba(190,210,240,0.55)'; ctx.lineWidth = 1;
        for (let i = 0; i < 26; i++) {
          const x = cx + ((i * 37) % 23 - 11) / 11 * width * 0.35, ph = ((t * 1.4 + i * 0.37) % 1);
          const y = yb + 4 + ph * (h - pb - yb - 8);
          ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x - 2, y + 7); ctx.stroke();
        }
        if (top > 8000 && V.key === 'storm') {
          flash -= dt;
          if (flash < -2.5 - (t % 1.7)) flash = 0.12;
          if (flash > 0) {
            ctx.strokeStyle = 'rgba(255,250,210,0.95)'; ctx.lineWidth = 2;
            ctx.beginPath(); let x = cx + width * 0.1, y = yb;
            ctx.moveTo(x, y);
            while (y < h - pb) { y += 10; x += ((y * 7) % 13) - 6; ctx.lineTo(x, Math.min(y, h - pb)); }
            ctx.stroke();
          }
        }
      }
    } else if (lcl < 30) { // fog
      ctx.fillStyle = 'rgba(220,226,236,0.5)'; ctx.fillRect(sx, Y(250), sw, h - pb - Y(250));
    }
    // cloud-base line across both panels
    if (lcl < ZMAX && lcl > 30) {
      ctx.strokeStyle = 'rgba(142,197,255,0.7)'; ctx.setLineDash([6, 4]); ctx.lineWidth = 1.2;
      ctx.beginPath(); ctx.moveTo(pl, Y(lcl)); ctx.lineTo(w, Y(lcl)); ctx.stroke(); ctx.setLineDash([]);
      ctx.fillStyle = '#b3d8ff'; ctx.font = font(small ? 10 : 11, 600); ctx.textAlign = 'left';
      ctx.fillText(`cloud base ${fmtH(lcl)}`, pl + 4, Y(lcl) - 8);
    }

    // the parcel: on the chart and in the scene
    const B = at(P, 'B', s.z), yp = Y(Math.min(s.z, ZMAX));
    const col = B >= 0 ? '#ff9a5a' : '#6fb6ff';
    ctx.fillStyle = '#fff';
    ctx.beginPath(); ctx.arc(X(at(P, 'Te', s.z), s.z), yp, 3, 0, 7); ctx.fill();
    ctx.fillStyle = col; ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.arc(X(at(P, 'Tp', s.z), s.z), yp, 5.5, 0, 7); ctx.fill(); ctx.stroke();
    const r = small ? 11 : 14, by = Math.min(yp, h - pb - r), bx = cx;
    ctx.fillStyle = s.z >= lcl ? 'rgba(255,255,255,0.85)' : 'rgba(255,255,255,0.18)';
    ctx.strokeStyle = col; ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.arc(bx, by, r, 0, 7); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#fff'; ctx.font = font(small ? 10.5 : 12, 700); ctx.textAlign = 'left';
    const lbl = `${B >= 0 ? '+' : '−'}${Math.abs(B).toFixed(1)}°`;
    ctx.fillText(lbl, bx + r + 4, by);
    if (free && Math.abs(s.w) > 0.3) {
      ctx.strokeStyle = 'rgba(255,255,255,0.8)'; ctx.lineWidth = 2;
      const d = Math.sign(s.w), x0 = bx;
      ctx.beginPath(); ctx.moveTo(x0, by - d * (r + 4)); ctx.lineTo(x0, by - d * (r + 16)); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(x0 - 4, by - d * (r + 11)); ctx.lineTo(x0, by - d * (r + 17)); ctx.lineTo(x0 + 4, by - d * (r + 11)); ctx.stroke();
    }

    // honest labels
    ctx.fillStyle = 'rgba(255,255,255,0.65)'; ctx.font = font(small ? 9.5 : 10.5); ctx.textAlign = 'right';
    ctx.fillText(free ? `heights to scale · time ×${SPEEDUP}` : 'heights to scale · widths not', w - 6, pt - 6);
    if (free && Math.abs(s.w) > 0.3) { ctx.textAlign = 'left'; ctx.fillText(`rising ${s.w.toFixed(1)} m/s`, sx + 6, pt - 6); }
    ctx.strokeStyle = 'rgba(255,255,255,0.12)'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(cw + 0.5, 0); ctx.lineTo(cw + 0.5, h); ctx.stroke();
  }
}
