// Chapter 2 — highs, lows and isobars. The pressure-gradient push on its own, no spin yet:
// air runs straight downhill from the high into the low, faster where isobars crowd.
import { PressureField, stepParcel, RHO, coriolis, geostrophic } from './map-sim.js';
import { MapView, speedColor } from './map-view.js';
import { fitCanvas, visibleLoop, bindRange, $ } from '../../kit/util.js';

const HOURS_PER_SEC = 1.2;

export function initPressure() {
  const canvas = $('pressure-canvas');
  const H = { x: -600e3, y: 120e3, dp: 12, R: 650e3 }, L = { x: 600e3, y: -120e3, dp: -12, R: 520e3 };
  const field = new PressureField([H, L]);
  const view = new MapView(canvas, field, { widthKm: 3200 });
  let parcels = [], seed = 3, spawnAcc = 0;
  const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  const dpr = () => Math.min(window.devicePixelRatio || 1, 2);

  function place(dist) { H.x = -dist / 2; L.x = dist / 2; H.y = dist * 0.1; L.y = -dist * 0.1; view.dirty = true; }
  function spawn() {
    const a = rand() * Math.PI * 2, r = (0.15 + 0.5 * rand()) * H.R;
    parcels.push({ x: H.x + r * Math.cos(a), y: H.y + r * Math.sin(a), u: 0, v: 0, trail: [], alpha: 0, age: 0 });
  }

  let dist = 1200e3, diff = 24;
  bindRange($('pressure-dist'), (v) => { dist = v * 1000; place(dist); $('pressure-dist-out').textContent = `${Math.round(v).toLocaleString('en')} km`; readouts(); });
  bindRange($('pressure-diff'), (v) => { diff = v; H.dp = v / 2; L.dp = -v / 2; view.dirty = true; $('pressure-diff-out').textContent = `${v} hPa`; readouts(); });
  $('pressure-clear').addEventListener('click', () => { parcels = []; });

  function readouts() {
    // the push halfway between the two centres
    const mx = (H.x + L.x) / 2, my = (H.y + L.y) / 2;
    const [gx, gy] = field.grad(mx, my), g = Math.hypot(gx, gy);
    const per100 = g * 1e5 / 100;
    const acc = g / RHO; // m/s²
    $('pressure-grad').textContent = `${per100.toFixed(1)} hPa / 100 km`;
    $('pressure-push').textContent = `+${Math.round(acc * 3600 * 3.6)} km/h every hour`;
    const vg = geostrophic(g, coriolis(50)) * 0.7; // real surface wind ≈ 70% of the balanced wind
    $('pressure-real').textContent = `≈ ${Math.round(vg * 3.6)} km/h`;
    const kmh = vg * 3.6;
    const word = kmh < 12 ? 'a light breeze' : kmh < 29 ? 'a moderate breeze' : kmh < 50 ? 'a strong breeze' : kmh < 75 ? 'a gale' : kmh < 103 ? 'a severe gale' : 'a storm';
    $('pressure-why').innerHTML = (per100 < 0.8
      ? 'Isobars far apart: a <b>gentle slope</b> of pressure.'
      : per100 < 2 ? 'The isobars are closer together: a <b>steeper slope</b>, a harder push.'
        : 'Isobars crammed together: a <b>steep slope</b>, a hard push.') + ` On a real weather map this means <b>${word}</b>.`;
  }

  visibleLoop(canvas, (dt) => {
    const { ctx, w, h } = fitCanvas(canvas);
    view.layout(w, h);
    const simDt = dt * HOURS_PER_SEC * 3600;
    spawnAcc += dt * 9;
    while (spawnAcc > 1 && parcels.length < 90) { spawn(); spawnAcc--; }
    const sub = 6;
    for (const P of parcels) {
      for (let s = 0; s < sub; s++) stepParcel(P, field, 0, 1.2e-5, simDt / sub); // no Earth spin; a little friction
      P.age += dt;
      P.trail.push(P.x, P.y); if (P.trail.length > 24) P.trail.splice(0, 2);
      const dL = Math.hypot(P.x - L.x, P.y - L.y);
      // reaching the middle of the low: air piles up and has nowhere to go but up — fade out
      P.alpha = Math.min(1, P.age * 2) * Math.min(1, dL / (0.25 * L.R));
    }
    parcels = parcels.filter((P) => P.alpha > 0.03 || P.age < 0.5);
    view.drawBackground(ctx, dpr());
    view.drawParcels(ctx, parcels, (P, a) => speedColor(Math.hypot(P.u, P.v), a));
    view.drawCenters(ctx);
    const [lx, ly] = view.px(L.x, L.y);
    ctx.font = '600 11px ui-sans-serif, system-ui, sans-serif'; ctx.textAlign = 'center'; ctx.fillStyle = 'rgba(255,190,150,0.9)';
    ctx.fillText('air piles in… and rises', lx, ly - 30);
    view.scaleBar(ctx);
    ctx.textAlign = 'right'; ctx.textBaseline = 'top'; ctx.fillStyle = 'rgba(255,255,255,0.7)'; ctx.font = '500 11px ui-sans-serif, system-ui, sans-serif';
    ctx.fillText('No Earth spin yet · 1 s ≈ 1 hour', w - 10, 10);
  });
}
