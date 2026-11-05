// Chapter 3 — why sunsets are red. Top: the computed sky toward the Sun. Bottom: a side view of
// the beam crossing the atmosphere (air drawn far thicker than real), with photons scattering
// out of it. Each photon's chance of being scattered on the way is the real 1 − e^(−τ(λ)) for
// this Sun height and haze, so what reaches the observer is what the readouts say.
import { SkyScene } from './scene.js';
import { SKY_LAMBDA, airMass } from './sky.js';
import { SUN, wavelengthRGB, clamp, DEG, gamma } from './optics.js';
import { fitCanvas, visibleLoop, bindRange, $ } from '../../kit/util.js';

const hazeName = (a) => (a < 0.06 ? 'very clean air' : a < 0.15 ? 'clear' : a < 0.35 ? 'hazy' : a < 0.7 ? 'smoky' : 'wildfire smoke');

export function initSunset() {
  const canvas = $('sunset-canvas');
  let e = 20, aod = 0.1, T = null;
  const scene = new SkyScene({ horizon: 0.86, elTop: 26, sunX: 0.5, step: 5, coarse: 10, stars: false, seed: 11 });
  const photons = [];
  // sample wavelengths in proportion to sunlight
  const cdf = []; let acc = 0;
  SKY_LAMBDA.forEach((l) => { acc += SUN[(l - 390) / 10]; cdf.push(acc); });
  const pickK = () => { const u = Math.random() * acc; return cdf.findIndex((c) => c >= u); };

  function apply() {
    scene.setAir({ aod });
    scene.o.elTop = Math.max(26, e + 10);
    scene.setSun(e); scene.invalidate();
    T = scene.sky.sunTransmit(Math.max(e, -0.5));
    const m = airMass(Math.max(e, 0));
    $('sunset-air').textContent = e < -0.5 ? 'set' : `${m < 10 ? m.toFixed(1) : Math.round(m)}× noon`;
    const pct = (x) => (e < -0.5 ? '0%' : x >= 0.1 ? `${Math.round(x * 100)}%` : x >= 0.001 ? `${(x * 100).toFixed(1)}%` : '< 0.1%');
    $('sunset-blue').textContent = pct(T[3]);
    $('sunset-red').textContent = pct(T[13]);
  }
  bindRange($('sunset-e'), (v) => { e = v; $('sunset-e-out').textContent = `${v.toFixed(v < 10 ? 1 : 0)}°`; apply(); });
  bindRange($('sunset-a'), (v) => { aod = 0.02 * Math.pow(60, v); $('sunset-a-out').textContent = `${hazeName(aod)} · AOD ${aod.toFixed(2)}`; apply(); });

  let geo = null;
  visibleLoop(canvas, (dt) => {
    const { ctx, w, h } = fitCanvas(canvas);
    const sh = Math.round(h * 0.36);
    scene.update(w, sh);
    ctx.save(); ctx.beginPath(); ctx.rect(0, 0, w, sh); ctx.clip();
    scene.draw(ctx, w, sh);
    ctx.restore();
    ctx.font = '11.5px ui-sans-serif, system-ui, sans-serif';
    ctx.fillStyle = 'rgba(255,255,255,0.9)'; ctx.textAlign = 'left';
    ctx.fillText('Computed sky, looking toward the Sun', 12, 18);
    ctx.fillStyle = 'rgba(255,255,255,0.6)'; ctx.fillText('Sun drawn in its true colour', 12, 33);

    // ---- side view ----
    const top = sh, H = h - sh;
    ctx.fillStyle = '#0d0a18'; ctx.fillRect(0, top, w, H);
    const R = Math.max(w, H) * 1.5;                 // Earth's radius on screen
    const ox = w * 0.62, oy = top + H * 0.78;         // observer
    const cx = ox, cy = oy + R;                       // Earth's centre
    const atm = H * 0.42;                             // drawn thickness of the air
    const Hs = atm * 0.26;                            // drawn scale height
    const exag = (Hs / R) / (8 / 6371);
    // atmosphere: density falling off with height
    const grd = ctx.createRadialGradient(cx, cy, R, cx, cy, R + atm);
    for (let k = 0; k <= 6; k++) grd.addColorStop(k / 6, `rgba(120,165,255,${0.6 * Math.exp((-k / 6) * atm / Hs)})`);
    ctx.fillStyle = grd; ctx.beginPath(); ctx.arc(cx, cy, R + atm, 0, 7); ctx.fill();
    ctx.fillStyle = '#1b1426'; ctx.beginPath(); ctx.arc(cx, cy, R, 0, 7); ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.18)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(cx, cy, R, Math.PI * 1.2, Math.PI * 1.8); ctx.stroke();
    // the beam: from where it enters the air to the observer
    const ee = Math.max(e, -0.4) * DEG;
    const d = [-Math.cos(ee), -Math.sin(ee)];        // toward the Sun (to the left and up)
    // distance from observer to the top of the drawn atmosphere along d
    const rx = ox - cx, ry = oy - cy, b = rx * d[0] + ry * d[1], c = rx * rx + ry * ry - (R + atm) ** 2;
    const L = -b + Math.sqrt(b * b - c);
    const N = 90;
    // fraction of the beam's total optical depth crossed by each point (drawn density profile)
    const f = new Float64Array(N + 1); let s = 0;
    const pts = [];
    for (let i = 0; i <= N; i++) {
      const q = L * (1 - i / N);
      const px = ox + d[0] * q, py = oy + d[1] * q;
      pts.push([px, py]);
      if (i) { const hh = Math.hypot(px - cx, py - cy) - R; s += Math.exp(-Math.max(0, hh) / Hs); }
      f[i] = s;
    }
    for (let i = 0; i <= N; i++) f[i] /= s || 1;
    geo = { pts, f };
    if (T) {
      const tau = T.map((x) => -Math.log(Math.max(x, 1e-12)));
      // beam colour along the way: what's left of sunlight after a fraction f of the trip
      for (let i = 0; i < N; i++) {
        let r = 0, g = 0, bb = 0, tot = 0;
        SKY_LAMBDA.forEach((l, k) => {
          const a = SUN[(l - 390) / 10] * Math.exp(-tau[k] * f[i]);
          const c2 = wavelengthRGB(l); r += c2[0] * a; g += c2[1] * a; bb += c2[2] * a; tot += SUN[(l - 390) / 10];
        });
        const M = Math.max(r, g, bb, 1e-9), br = clamp(Math.pow(M / tot / 140, 0.4), 0.18, 1);
        ctx.strokeStyle = `rgba(${(r / M) * 255 | 0},${(g / M) * 255 | 0},${(bb / M) * 255 | 0},${br})`;
        ctx.lineWidth = 4;
        ctx.beginPath(); ctx.moveTo(pts[i][0], pts[i][1]); ctx.lineTo(pts[i + 1][0], pts[i + 1][1]); ctx.stroke();
      }
      // photons
      const rate = 60;
      for (let k = 0; k < rate * dt * 1.0 + Math.random() - 0.5; k++) {
        const kk = pickK();
        const fs = Math.random() < 1 - Math.exp(-tau[kk]) ? -Math.log(1 - Math.random() * (1 - Math.exp(-tau[kk]))) / tau[kk] : 2;
        photons.push({ k: kk, u: 0, fs, out: null, life: 1 });
      }
    }
    const speed = 0.32;
    ctx.globalCompositeOperation = 'lighter';
    for (let i = photons.length - 1; i >= 0; i--) {
      const p = photons[i];
      const c2 = wavelengthRGB(SKY_LAMBDA[p.k]);
      if (!p.out) {
        p.u += speed * dt;
        // position along the beam where cumulative optical-depth fraction = p.u
        let j = 0; while (j < N && f[j] < p.u) j++;
        if (p.u >= p.fs && p.fs <= 1) { const a = Math.random() * Math.PI * 2; p.out = { x: pts[j][0], y: pts[j][1], vx: Math.cos(a) * 60, vy: Math.sin(a) * 60 }; }
        else if (j >= N) { photons.splice(i, 1); continue; }
        else { ctx.fillStyle = `rgba(${c2[0] | 0},${c2[1] | 0},${c2[2] | 0},0.95)`; ctx.beginPath(); ctx.arc(pts[j][0], pts[j][1], 2.2, 0, 7); ctx.fill(); }
      }
      if (p.out) {
        p.out.x += p.out.vx * dt; p.out.y += p.out.vy * dt; p.life -= dt * 0.8;
        if (p.life <= 0) { photons.splice(i, 1); continue; }
        ctx.fillStyle = `rgba(${c2[0] | 0},${c2[1] | 0},${c2[2] | 0},${0.8 * p.life})`;
        ctx.beginPath(); ctx.arc(p.out.x, p.out.y, 1.8, 0, 7); ctx.fill();
      }
    }
    ctx.globalCompositeOperation = 'source-over';
    if (photons.length > 600) photons.splice(0, photons.length - 600);
    // observer
    ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(ox, oy - 7, 3.2, 0, 7); ctx.fill(); ctx.fillRect(ox - 1, oy - 4, 2, 5);
    ctx.font = '11.5px ui-sans-serif, system-ui, sans-serif';
    ctx.fillStyle = 'rgba(237,240,247,0.8)'; ctx.textAlign = 'center'; ctx.fillText('you', ox, oy + 14);
    ctx.textAlign = 'left'; ctx.fillStyle = 'rgba(174,182,204,0.75)'; ctx.font = '11px ui-sans-serif, system-ui, sans-serif';
    ctx.fillText(`Side view · air drawn ×${Math.round(exag)} thicker · dots = photons (illustration)`, 10, h - 10);
    ctx.fillStyle = 'rgba(237,240,247,0.85)'; ctx.font = '12px ui-sans-serif, system-ui, sans-serif';
    ctx.fillText('sunlight →', Math.max(6, pts[0][0] + 6), Math.max(top + 16, pts[0][1] - 10));
  });
}
