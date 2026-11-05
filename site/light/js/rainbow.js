// Chapter 5 — rainbows. (a) Ray-trace one spherical drop: Snell refraction in, one or two internal
// reflections, out. (b) The bow in the sky, from the same optics: for each wavelength, rays over
// all impact parameters are binned by exit angle, weighted by Fresnel transmission/reflection,
// spread over the Sun's 0.5° disc. Geometric optics only (no supernumerary fringes).
import { nWater, refract2, wavelengthRGB, cieX, cieY, cieZ, xyzToLin, WB, gamma, DEG, clamp, css } from './optics.js';
import { fitCanvas, visibleLoop, bindRange, $ } from '../../kit/util.js';

// Fresnel reflectance for unpolarised light, from medium n1 to n2 at incidence angle i
function fresnelR(n1, n2, i) {
  const st = (n1 / n2) * Math.sin(i);
  if (st >= 1) return 1;
  const ci = Math.cos(i), ct = Math.sqrt(1 - st * st);
  const rs = (n1 * ci - n2 * ct) / (n1 * ci + n2 * ct), rp = (n1 * ct - n2 * ci) / (n1 * ct + n2 * ci);
  return 0.5 * (rs * rs + rp * rp);
}
// angle from the antisolar point, primary (k=1) or secondary (k=2), for impact parameter b
export function bowAngle(b, n, k) {
  const i = Math.asin(b), r = Math.asin(b / n);
  return k === 1 ? (4 * r - 2 * i) / DEG : 180 + (2 * i - 6 * r) / DEG;
}
// brightest angle (rainbow angle) for wavelength l
export function rainbowAngle(l, k = 1) {
  let best = k === 1 ? -1 : 1e9;
  for (let b = 0; b < 1; b += 2e-5) { const a = bowAngle(b, nWater(l), k); if (k === 1 ? a > best : a < best) best = a; }
  return best;
}

// intensity table I(θ) per wavelength → RGB lookup for the sky view
const DTH = 0.05, NTH = Math.round(70 / DTH);
let BOW = null;
function buildBow() {
  const LS = []; for (let l = 400; l <= 700; l += 10) LS.push(l);
  const rgb = new Float32Array(NTH * 3);
  const sunK = Math.round(0.26 / DTH); // Sun's radius in bins
  for (const l of LS) {
    const n = nWater(l);
    const I = new Float64Array(NTH);
    const NB = 40000;
    for (let j = 0; j < NB; j++) {
      const b = (j + 0.5) / NB, i = Math.asin(b), r = Math.asin(b / n);
      const T1 = 1 - fresnelR(1, n, i), Rin = fresnelR(n, 1, r);
      const w = b * T1 * T1; // area weight × in and out
      for (const k of [1, 2]) {
        const th = bowAngle(b, n, k);
        const bin = Math.floor(th / DTH);
        if (bin >= 0 && bin < NTH) I[bin] += w * (k === 1 ? Rin : Rin * Rin);
      }
    }
    // per solid angle, then smear over the solar disc
    for (let q = 0; q < NTH; q++) I[q] /= Math.max(Math.sin((q + 0.5) * DTH * DEG), 1e-3);
    const S = new Float64Array(NTH);
    for (let q = 0; q < NTH; q++) { let s = 0, c = 0; for (let k = -sunK; k <= sunK; k++) { const qq = q + k; if (qq >= 0 && qq < NTH) { const wt = Math.sqrt(1 - (k / (sunK + 1)) ** 2); s += I[qq] * wt; c += wt; } } S[q] = s / c; }
    const c3 = xyzToLin([cieX(l), cieY(l), cieZ(l)]).map((v, i) => v * WB[i]);
    for (let q = 0; q < NTH; q++) for (let c = 0; c < 3; c++) rgb[q * 3 + c] += S[q] * c3[c];
  }
  // normalise so the brightest part of the primary bow ≈ 1
  let M = 0; for (let q = 0; q < NTH; q++) M = Math.max(M, rgb[q * 3 + 1]);
  for (let q = 0; q < rgb.length; q++) rgb[q] /= M;
  BOW = rgb;
}

export function initRainbow() {
  const canvas = $('rain-canvas');
  let mode = 'drop', b = 0.86, many = false, two = false, sunE = 12;
  const red1 = rainbowAngle(650), vio1 = rainbowAngle(400), red2 = rainbowAngle(650, 2), vio2 = rainbowAngle(400, 2);
  const skyImg = { key: '', off: document.createElement('canvas') };

  function readouts() {
    if (mode === 'drop') {
      const k = two ? 2 : 1;
      const a = bowAngle(b, nWater(600), k);
      $('rain-l1').textContent = 'This ray comes back at';
      $('rain-v1').textContent = `${a.toFixed(1)}°`;
      $('rain-l2').textContent = two ? 'Second bow, red' : 'Rainbow, red';
      $('rain-v2').textContent = `${(two ? red2 : red1).toFixed(1)}°`;
      $('rain-l3').textContent = two ? 'Second bow, violet' : 'Rainbow, violet';
      $('rain-v3').textContent = `${(two ? vio2 : vio1).toFixed(1)}°`;
    } else {
      $('rain-l1').textContent = 'Top of the bow';
      $('rain-v1').textContent = red1 - sunE > 0 ? `${(red1 - sunE).toFixed(1)}° up` : 'below the horizon';
      $('rain-l2').textContent = 'Second bow top';
      $('rain-v2').textContent = red2 - sunE > 0 ? `${(vio2 - sunE).toFixed(1)}° up` : 'below the horizon';
      $('rain-l3').textContent = 'Dark band between';
      $('rain-v3').textContent = `${(red2 - red1).toFixed(1)}° wide`;
    }
  }
  bindRange($('rain-b'), (v) => { b = v; $('rain-b-out').textContent = v < 0.05 ? 'dead centre' : v > 0.97 ? 'the very edge' : `${Math.round(v * 100)}% out from the centre`; readouts(); });
  bindRange($('rain-e'), (v) => { sunE = v; $('rain-e-out').textContent = `${v.toFixed(0)}°`; skyImg.key = ''; readouts(); });
  $('rain-many').addEventListener('change', (e) => { many = e.target.checked; });
  $('rain-two').addEventListener('change', (e) => { two = e.target.checked; readouts(); });
  document.querySelectorAll('#rain-mode button').forEach((btn) => btn.addEventListener('click', () => {
    mode = btn.dataset.mode;
    document.querySelectorAll('#rain-mode button').forEach((x) => x.classList.toggle('on', x === btn));
    $('rain-drop-ctl').hidden = mode !== 'drop'; $('rain-sky-ctl').hidden = mode !== 'sky';
    readouts();
    document.querySelector('#rainbow .aha').classList.add('lit');
  }));
  readouts();

  // trace a ray into a unit drop (maths coords, light travelling +x), k internal reflections
  function trace(bb, n, k) {
    const p0 = [-Math.sqrt(1 - bb * bb), bb];
    const pts = [[-3, bb], p0];
    let d = refract2([1, 0], p0, 1 / n);
    let p = p0;
    const leaks = [];
    for (let j = 0; j <= k; j++) {
      const t = -2 * (p[0] * d[0] + p[1] * d[1]);
      p = [p[0] + d[0] * t, p[1] + d[1] * t];
      pts.push(p);
      if (j < k) {
        const out = refract2(d, [-p[0], -p[1]], n);
        if (out) leaks.push([p, out]);
        const dn = d[0] * p[0] + d[1] * p[1];
        d = [d[0] - 2 * dn * p[0], d[1] - 2 * dn * p[1]];
      }
    }
    const out = refract2(d, [-p[0], -p[1]], n);
    return { pts, out, end: p, leaks };
  }

  function drawDrop(ctx, w, h) {
    const R = Math.min(w, h) * (w < 560 ? 0.3 : 0.32);
    const cx = w * 0.5, cy = h * 0.44;
    const S = (p) => [cx + p[0] * R, cy - p[1] * R];
    // the drop
    const g = ctx.createRadialGradient(cx - R * 0.3, cy - R * 0.3, R * 0.1, cx, cy, R);
    g.addColorStop(0, 'rgba(160,200,255,0.16)'); g.addColorStop(1, 'rgba(110,150,230,0.08)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(cx, cy, R, 0, 7); ctx.fill();
    ctx.strokeStyle = 'rgba(180,210,255,0.45)'; ctx.lineWidth = 1.2; ctx.stroke();
    ctx.font = '11.5px ui-sans-serif, system-ui, sans-serif'; ctx.fillStyle = 'rgba(237,240,247,0.75)'; ctx.textAlign = 'left';
    ctx.fillText('sunlight →', 10, 20);
    ctx.fillStyle = 'rgba(174,182,204,0.7)'; ctx.fillText('a raindrop, ~1 mm across (drawn huge)', 10, h - 10);
    const k = two ? 2 : 1;
    const path = (tr, col, lw, ext) => {
      ctx.strokeStyle = col; ctx.lineWidth = lw;
      ctx.beginPath(); tr.pts.forEach((p, i) => { const q = S(p); i ? ctx.lineTo(q[0], q[1]) : ctx.moveTo(q[0], q[1]); });
      if (tr.out) { const q = S([tr.end[0] + tr.out[0] * ext, tr.end[1] + tr.out[1] * ext]); ctx.lineTo(q[0], q[1]); }
      ctx.stroke();
    };
    ctx.lineCap = 'round';
    if (many) {
      ctx.globalCompositeOperation = 'lighter';
      for (let j = 1; j < 40; j++) {
        const bb = j / 40;
        const tr = trace(bb, nWater(600), k);
        const a = bowAngle(bb, nWater(600), k);
        const near = Math.abs(a - (k === 1 ? 42 : 51)) < 1.2;
        path(tr, near ? 'rgba(255,214,120,0.75)' : 'rgba(255,240,210,0.22)', near ? 1.8 : 1, 3.2);
      }
      ctx.globalCompositeOperation = 'source-over';
    }
    // the aimed ray, in seven colours (they separate on the way out)
    ctx.globalCompositeOperation = 'lighter';
    for (let l = 400; l <= 700; l += 50) {
      const tr = trace(b, nWater(l), k);
      const c = wavelengthRGB(l);
      path(tr, `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},0.8)`, 2.2, 3.2);
      // light that leaks out at the back instead of reflecting (most of it!)
      tr.leaks.forEach(([p, o]) => {
        const a = S(p), q = S([p[0] + o[0] * 0.7, p[1] + o[1] * 0.7]);
        ctx.strokeStyle = `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},0.22)`; ctx.lineWidth = 1.4;
        ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(q[0], q[1]); ctx.stroke();
      });
    }
    ctx.globalCompositeOperation = 'source-over';
    // inset: angle vs aim, with the pile-up at the top
    const gx = w - (w < 560 ? 150 : 190) - 10, gy = h - 112, gw = w < 560 ? 150 : 190, gh = 86;
    ctx.fillStyle = 'rgba(11,9,18,0.75)'; ctx.fillRect(gx - 6, gy - 22, gw + 12, gh + 40);
    const amin = k === 1 ? 0 : 50, amax = k === 1 ? 45 : 90;
    const GX = (bb) => gx + bb * gw, GY = (a) => gy + gh - ((a - amin) / (amax - amin)) * gh;
    ctx.strokeStyle = 'rgba(255,214,120,0.9)'; ctx.lineWidth = 1.5; ctx.beginPath();
    for (let j = 0; j <= 100; j++) { const bb = j / 100.5; const a = clamp(bowAngle(bb, nWater(600), k), amin, amax); j ? ctx.lineTo(GX(bb), GY(a)) : ctx.moveTo(GX(bb), GY(a)); }
    ctx.stroke();
    const a0 = clamp(bowAngle(b, nWater(600), k), amin, amax);
    ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(GX(b), GY(a0), 3.5, 0, 7); ctx.fill();
    const ra = k === 1 ? 42 : 51;
    ctx.setLineDash([3, 3]); ctx.strokeStyle = 'rgba(255,255,255,0.35)'; ctx.beginPath(); ctx.moveTo(gx, GY(ra)); ctx.lineTo(gx + gw, GY(ra)); ctx.stroke(); ctx.setLineDash([]);
    ctx.font = '10.5px ui-sans-serif, system-ui, sans-serif'; ctx.fillStyle = 'rgba(237,240,247,0.8)'; ctx.textAlign = 'left';
    ctx.fillText(`exit angle vs aim · rays crowd at ${ra}°`, gx - 2, gy - 8);
    ctx.fillStyle = 'rgba(174,182,204,0.7)';
    ctx.fillText('centre', gx, gy + gh + 13); ctx.textAlign = 'right'; ctx.fillText('edge', gx + gw, gy + gh + 13);
  }

  function drawSky(ctx, w, h) {
    if (!BOW) buildBow();
    const key = `${w}x${h}:${sunE}`;
    const off = skyImg.off;
    const yh = h * 0.8;                    // horizon
    const dpp = 62 / yh;                   // degrees per pixel
    if (skyImg.key !== key) {
      skyImg.key = key;
      const step = 2;
      const W = Math.ceil(w / step), H = Math.ceil(h / step);
      off.width = W; off.height = H;
      const o = off.getContext('2d'); const img = o.createImageData(W, H); const d = img.data;
      const as = [0, -Math.sin(sunE * DEG), Math.cos(sunE * DEG)]; // antisolar direction (looking at it)
      for (let y = 0; y < H; y++) {
        const el = (yh - y * step) * dpp;
        for (let x = 0; x < W; x++) {
          const az = (x * step - w / 2) * dpp;
          const ce = Math.cos(el * DEG);
          const v = [ce * Math.sin(az * DEG), Math.sin(el * DEG), ce * Math.cos(az * DEG)];
          const th = Math.acos(clamp(v[0] * as[0] + v[1] * as[1] + v[2] * as[2], -1, 1)) / DEG;
          // the rain-darkened sky behind the bow
          let r = 0.10 + 0.05 * (el / 60), g = 0.115 + 0.055 * (el / 60), bb = 0.14 + 0.07 * (el / 60);
          const q = Math.floor(th / DTH);
          if (q < NTH && el > -0.2) {
            const k = 0.55; // bow brightness against the rain curtain (illustrative)
            r += BOW[q * 3] * k; g += BOW[q * 3 + 1] * k; bb += BOW[q * 3 + 2] * k;
          }
          const j = (y * W + x) * 4;
          if (el < 0) { r = 0.05; g = 0.06; bb = 0.05; }
          const m = Math.min(r, g, bb); if (m < 0) { const Y = 0.2126 * r + 0.7152 * g + 0.0722 * bb; const t = Y / (Y - m); r = Y + (r - Y) * t; g = Y + (g - Y) * t; bb = Y + (bb - Y) * t; }
          d[j] = gamma(clamp(r, 0, 1)) * 255; d[j + 1] = gamma(clamp(g, 0, 1)) * 255; d[j + 2] = gamma(clamp(bb, 0, 1)) * 255; d[j + 3] = 255;
        }
      }
      o.putImageData(img, 0, 0);
    }
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(off, 0, 0, w, h);
    // you, your shadow, the antisolar point
    const ax = w / 2, ay = yh + sunE / dpp;
    ctx.fillStyle = '#05040a'; ctx.fillRect(0, yh, w, h - yh);
    ctx.fillStyle = 'rgba(255,255,255,0.85)'; ctx.font = '11.5px ui-sans-serif, system-ui, sans-serif'; ctx.textAlign = 'center';
    if (ay < h - 6) {
      ctx.beginPath(); ctx.arc(ax, ay, 3, 0, 7); ctx.fill();
      ctx.fillText('your shadow\'s head (opposite the Sun)', ax, Math.min(h - 8, ay + 18));
      ctx.setLineDash([3, 4]); ctx.strokeStyle = 'rgba(255,255,255,0.4)';
      const r42 = 42 / dpp;
      const ang = -Math.PI / 2 - 0.55;
      ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(ax + Math.cos(ang) * r42, ay + Math.sin(ang) * r42); ctx.stroke(); ctx.setLineDash([]);
      ctx.fillText('42°', ax + Math.cos(ang) * r42 * 0.55 - 14, ay + Math.sin(ang) * r42 * 0.55);
    } else {
      ctx.fillText(`↓ the point opposite the Sun is ${sunE.toFixed(0)}° below the horizon`, ax, h - 10);
    }
    ctx.textAlign = 'left'; ctx.fillStyle = 'rgba(255,255,255,0.8)';
    ctx.fillText('Sun behind you · bow computed from the drop optics', 10, 18);
    if (sunE > red1) { ctx.fillStyle = 'rgba(255,214,150,0.95)'; ctx.fillText('Sun higher than 42°: from the ground, no rainbow', 10, 34); }
  }

  visibleLoop(canvas, () => {
    const { ctx, w, h } = fitCanvas(canvas);
    ctx.clearRect(0, 0, w, h);
    if (mode === 'drop') drawDrop(ctx, w, h); else drawSky(ctx, w, h);
  });
}
