// Chapter 4 — friction: why wind is slower and gustier near the ground, and faster over the sea.
// Physics: the neutral log-law wind profile u(z) = (u*/κ)·ln(z/z0), with the friction velocity u*
// found from the geostrophic drag law (Rossby-number similarity):
//   G = (u*/κ)·√((ln(u*/(f·z0)) − A)² + B²),  sin α = B·u*/(κ·G)   (A = 1.8, B = 4.5)
// Turbulence intensity at height z: I = 1/ln(z/z0); peak 3-s gust ≈ U·√(1 + 7·I) (EN 1991-1-4).
import { fitCanvas, visibleLoop, bindRange, $ } from '../../kit/util.js';

const KAPPA = 0.4, A = 1.8, B = 4.5, F45 = 1.03e-4;
export const SURFACES = {
  sea: { z0: 0.0002, name: 'Open sea' },
  grass: { z0: 0.03, name: 'Open grassland' },
  forest: { z0: 0.5, name: 'Forest', h: 20 },
  city: { z0: 1.0, name: 'City', h: 30 },
};
export function ustar(G, z0, f = F45) {
  let u = 0.04 * G;
  for (let i = 0; i < 60; i++) u = (KAPPA * G) / Math.sqrt((Math.log(u / (f * z0)) - A) ** 2 + B ** 2);
  return u;
}
export function profile(G, z0) {
  const us = ustar(G, z0);
  return {
    us,
    at: (z) => Math.min(G, Math.max(0, (us / KAPPA) * Math.log(Math.max(z, z0 * 1.01) / z0))),
    angle: (Math.asin(Math.min(1, (B * us) / (KAPPA * G))) * 180) / Math.PI,
    I: (z) => 1 / Math.log(Math.max(z, z0 * 2) / z0),
  };
}
export const gustFactor = (I) => Math.sqrt(1 + 7 * I);

const ZTOP = 1000; // m

export function initFriction() {
  const canvas = $('friction-canvas'), chart = $('friction-gusts');
  let G = 15, surf = 'grass', P = profile(G, SURFACES[surf].z0);
  let streaks = [], seed = 5, t = 0;
  const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  // gust signal: a few dozen sines with a −5/3-ish spectrum, scaled to σ = I·U
  const modes = Array.from({ length: 28 }, (_, i) => {
    const fr = 0.004 * Math.pow(1.22, i); // Hz, ~4 min → ~1 s
    return { fr, a: Math.pow(fr, -5 / 6), ph: Math.random() * 7 };
  });
  const norm = Math.sqrt(modes.reduce((s, m) => s + m.a * m.a / 2, 0));
  const turb = (time, offset = 0) => modes.reduce((s, m) => s + m.a * Math.sin(2 * Math.PI * m.fr * time + m.ph + offset * m.fr * 40), 0) / norm;

  function update() {
    P = profile(G, SURFACES[surf].z0);
    const u10 = P.at(10), I10 = P.I(10);
    $('friction-u10').textContent = `${Math.round(u10 * 3.6)} km/h`;
    $('friction-top').textContent = `${Math.round(G * 3.6)} km/h`;
    $('friction-gust').textContent = `${Math.round(u10 * gustFactor(I10) * 3.6)} km/h`;
    $('friction-angle').textContent = `${Math.round(P.angle)}°`;
    $('friction-why').innerHTML = `Near the ground over ${SURFACES[surf].name.toLowerCase()}, the wind keeps only <b>${Math.round((u10 / G) * 100)}%</b> of its speed aloft, and gusts reach <b>${gustFactor(I10).toFixed(1)}×</b> the average. ` +
      (surf === 'sea' ? 'The sea is smooth, so the air slides over it almost unhindered — this is why coasts and islands are windy.' : surf === 'city' || surf === 'forest' ? 'Rough ground churns the air into eddies: slower on average, but far gustier. (Measured 10 m above the ' + (surf === 'city' ? 'rooftops' : 'treetops') + '.)' : 'Grass is fairly smooth, but still drags the lowest air back.');
  }

  // state is ready — now bind controls
  bindRange($('friction-g'), (v) => { G = v; $('friction-g-out').textContent = `${Math.round(v * 3.6)} km/h`; update(); });
  document.querySelectorAll('#friction-surf button').forEach((b) => b.addEventListener('click', () => {
    document.querySelectorAll('#friction-surf button').forEach((x) => x.classList.toggle('on', x === b));
    surf = b.dataset.s; update();
  }));

  // height scale: square-root, so the interesting bottom 100 m gets room
  const Y = (z, top, bot) => bot - (bot - top) * Math.sqrt(Math.max(0, z) / ZTOP);

  function drawSurface(ctx, w, gy, top) {
    const pxPerM = (z) => gy - Y(z, top, gy);
    if (surf === 'sea') {
      ctx.fillStyle = '#1d5f8c'; ctx.fillRect(0, gy, w, 40);
      ctx.strokeStyle = 'rgba(255,255,255,0.35)'; ctx.lineWidth = 1;
      for (let x = (t * 30) % 24 - 24; x < w; x += 24) { ctx.beginPath(); ctx.moveTo(x, gy + 2); ctx.quadraticCurveTo(x + 6, gy - 3, x + 12, gy + 2); ctx.stroke(); }
    } else {
      ctx.fillStyle = surf === 'city' ? '#2d3446' : '#2f4b2c'; ctx.fillRect(0, gy, w, 40);
      if (surf === 'grass') { ctx.strokeStyle = '#6f9a54'; ctx.lineWidth = 1; for (let x = 2; x < w; x += 5) { ctx.beginPath(); ctx.moveTo(x, gy); ctx.lineTo(x + 1.5 + Math.sin(t * 3 + x) * 1.2, gy - 4); ctx.stroke(); } }
      if (surf === 'forest') {
        const hh = pxPerM(20); ctx.fillStyle = '#2f5a35';
        for (let x = 6; x < w; x += 14) { const s = 0.8 + 0.3 * Math.sin(x * 1.7); ctx.beginPath(); ctx.moveTo(x - 7, gy); ctx.lineTo(x, gy - hh * s); ctx.lineTo(x + 7, gy); ctx.fill(); }
      }
      if (surf === 'city') {
        for (let x = 0, i = 0; x < w; i++) {
          const bw = 12 + ((i * 37) % 17), hm = 12 + ((i * 53) % 34);
          ctx.fillStyle = i % 2 ? '#3b4560' : '#323a52'; ctx.fillRect(x, gy - pxPerM(hm), bw - 2, pxPerM(hm));
          ctx.fillStyle = 'rgba(255,220,140,0.35)';
          for (let wy = gy - pxPerM(hm) + 4; wy < gy - 4; wy += 6) for (let wx = x + 3; wx < x + bw - 5; wx += 5) ctx.fillRect(wx, wy, 2, 2);
          x += bw;
        }
      }
    }
  }

  visibleLoop(canvas, (dt) => {
    t += dt;
    const { ctx, w, h } = fitCanvas(canvas);
    const small = w < 520, left = small ? Math.round(w * 0.46) : Math.min(260, Math.round(w * 0.3)), top = 26, gy = h - 34;
    const g = ctx.createLinearGradient(0, 0, 0, gy);
    g.addColorStop(0, '#2b5e9e'); g.addColorStop(1, '#8fb9e0');
    ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);

    // streaks of air: speed from the log profile, jiggle from the turbulence intensity
    const want = small ? 110 : 170;
    while (streaks.length < want) streaks.push({ x: rand() * w, z: ZTOP * Math.pow(rand(), 2), ph: rand() * 100 });
    const pxPerMs = (w - left) / 34; // a 34 m/s wind crosses the panel in one second (time-lapse, labelled)
    ctx.lineCap = 'round';
    for (const s of streaks) {
      const u = P.at(s.z), I = P.I(Math.max(s.z, 0.5));
      const gust = 1 + I * turb(t, s.ph) * 0.9;
      const vx = u * gust * pxPerMs * 0.25;
      s.x += vx * dt;
      s.z = Math.max(0.3, Math.min(ZTOP, s.z + Math.sin(t * 2 + s.ph) * I * u * dt * 4 * Math.sqrt(s.z + 1)));
      if (s.x > w + 20) { s.x = left - 10; s.z = ZTOP * Math.pow(rand(), 2); }
      const y = Y(s.z, top, gy), len = Math.max(2, vx * 0.12);
      if (s.x < left - 4) continue;
      ctx.strokeStyle = `rgba(255,255,255,${0.25 + 0.5 * Math.min(1, u / 20)})`; ctx.lineWidth = 1.4;
      ctx.beginPath(); ctx.moveTo(s.x - len, y); ctx.lineTo(s.x, y); ctx.stroke();
    }

    drawSurface(ctx, w, gy, top);

    // the profile: arrows at fixed heights + the curve
    ctx.fillStyle = 'rgba(8,17,31,0.55)'; ctx.fillRect(0, 0, left - 6, h);
    const scale = (left - 52) / 36; // px per m/s for the arrows in the side panel (slider max 35 m/s)
    ctx.strokeStyle = '#ffd48a'; ctx.lineWidth = 2; ctx.beginPath();
    for (let i = 0; i <= 60; i++) { const z = ZTOP * (i / 60) ** 2 + 0.5, x = 40 + P.at(z) * scale; i ? ctx.lineTo(x, Y(z, top, gy)) : ctx.moveTo(x, Y(z, top, gy)); }
    ctx.stroke();
    ctx.font = `600 ${small ? 10 : 11}px ui-sans-serif, system-ui, sans-serif`; ctx.textBaseline = 'middle';
    for (const z of [2, 10, 50, 100, 300, 1000]) {
      const y = Y(z, top, gy), u = P.at(z);
      ctx.fillStyle = 'rgba(255,255,255,0.65)'; ctx.textAlign = 'right'; ctx.fillText(z >= 1000 ? '1 km' : `${z} m`, 36, y);
      ctx.strokeStyle = 'rgba(255,255,255,0.12)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(40, y); ctx.lineTo(w, y); ctx.stroke();
      const x1 = 40 + u * scale;
      ctx.strokeStyle = '#fff'; ctx.fillStyle = '#fff'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(40, y); ctx.lineTo(x1, y); ctx.stroke();
      if (u > 0.6) { ctx.beginPath(); ctx.moveTo(x1 + 4, y); ctx.lineTo(x1 - 3, y - 4); ctx.lineTo(x1 - 3, y + 4); ctx.fill(); }
    }
    ctx.textAlign = 'left'; ctx.textBaseline = 'top'; ctx.fillStyle = 'rgba(255,255,255,0.8)';
    ctx.fillText('wind speed', 6, 6);
    ctx.textAlign = 'right'; ctx.fillStyle = 'rgba(255,255,255,0.75)';
    ctx.fillText('heights stretched near the ground', w - 8, 6);
  });

  // 10-minute gust trace at 10 m, scrolling
  visibleLoop(chart, () => {
    const { ctx, w, h } = fitCanvas(chart);
    ctx.fillStyle = '#0d1a2e'; ctx.fillRect(0, 0, w, h);
    const u10 = P.at(10), I = P.I(10), span = 600; // s
    const peak = u10 * gustFactor(I), ymax = Math.max(15, G * 1.15);
    const Yv = (v) => h - 18 - (h - 32) * (v / ymax);
    const now = t * 20; // trace runs 20× real time
    ctx.strokeStyle = 'rgba(255,255,255,0.15)'; ctx.lineWidth = 1;
    ctx.setLineDash([4, 4]);
    ctx.beginPath(); ctx.moveTo(0, Yv(u10)); ctx.lineTo(w, Yv(u10)); ctx.stroke();
    ctx.strokeStyle = 'rgba(255,164,119,0.6)'; ctx.beginPath(); ctx.moveTo(0, Yv(peak)); ctx.lineTo(w, Yv(peak)); ctx.stroke();
    ctx.setLineDash([]);
    ctx.strokeStyle = '#8ec5ff'; ctx.lineWidth = 1.6; ctx.beginPath();
    for (let i = 0; i <= w; i += 2) {
      const ts = now - span + (i / w) * span;
      const v = Math.max(0, u10 * (1 + I * turb(ts) * 1.0));
      i ? ctx.lineTo(i, Yv(v)) : ctx.moveTo(i, Yv(v));
    }
    ctx.stroke();
    ctx.font = '600 11px ui-sans-serif, system-ui, sans-serif'; ctx.textBaseline = 'bottom';
    ctx.fillStyle = 'rgba(255,255,255,0.75)'; ctx.textAlign = 'left';
    ctx.fillText(`Wind at 10 m, last 10 minutes · average ${Math.round(u10 * 3.6)} km/h`, 8, 14);
    ctx.fillStyle = 'rgba(255,164,119,0.9)'; ctx.textAlign = 'right';
    ctx.fillText(`typical peak gust ${Math.round(peak * 3.6)}`, w - 8, Yv(peak) - 2);
  });
}
