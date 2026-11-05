// A physically computed sky: sunlight scattering once off air molecules (Rayleigh, ∝ λ^-n) and
// aerosols (Mie, Henyey–Greenstein phase), absorbed a little by ozone, in a spherical
// 100 km atmosphere. Integrated per wavelength, then turned into colour by the CIE observer.
// Single scattering only — the real sky is a little brighter and paler near the horizon and
// in twilight, where light scatters many times.
import { SUN, WB, SUN_Y, cieX, cieY, cieZ, xyzToLin, gamma, clamp, DEG } from './optics.js';

const RE = 6371e3, HA = 100e3, RA = RE + HA;
const HR = 8000, HM = 1200;
const LS = []; for (let l = 390; l <= 710; l += 20) LS.push(l);
export const SKY_LAMBDA = LS;
const NLs = LS.length;
const SUNs = LS.map((l) => SUN[(l - 390) / 10]);
// per-wavelength contribution to white-balanced linear RGB (20 nm bins → ×2 vs the 10 nm grid)
const W = LS.map((l) => xyzToLin([cieX(l), cieY(l), cieZ(l)]).map((v, i) => (2 * v * WB[i]) / SUN_Y));
// ozone (Chappuis band) absorption at peak density, 1/m — column ≈ 300 DU
const ozone = (l) => 2.4e-6 * Math.exp(-0.5 * ((l - 595) / (l < 595 ? 55 : 60)) ** 2);
const densR = (h) => Math.exp(-h / HR);
const densM = (h) => Math.exp(-h / HM);
const densO = (h) => Math.max(0, 1 - Math.abs(h - 25e3) / 15e3);

// optical-depth table: from altitude h toward zenith angle θ, to the top of the atmosphere
// Each altitude row spans zenith angles from 0 to that altitude's own horizon (90° + dip),
// so the steep change near the horizon is resolved and nothing interpolates into the ground.
const TH = 48, TZ = 400;
let TABLE = null;
const hOf = (u) => HA * u * u;
const horizonZ = (r) => Math.PI / 2 + Math.acos(Math.min(1, RE / r)) - 1e-6;
function buildTable() {
  TABLE = new Float32Array(TH * TZ * 3);
  for (let i = 0; i < TH; i++) {
    const r0 = RE + hOf(i / (TH - 1));
    for (let j = 0; j < TZ; j++) {
      const th = (j / (TZ - 1)) * horizonZ(r0);
      const mu = Math.cos(th);
      const o = (i * TZ + j) * 3;
      const tMax = -r0 * mu + Math.sqrt(Math.max(0, r0 * r0 * (mu * mu - 1) + RA * RA));
      const N = 48;
      let a = 0, b = 0, c = 0;
      for (let k = 0; k < N; k++) {
        const s0 = (k / N) ** 2 * tMax, s1 = ((k + 1) / N) ** 2 * tMax, t = 0.5 * (s0 + s1), ds = s1 - s0;
        const h = Math.sqrt(r0 * r0 + t * t + 2 * r0 * t * mu) - RE;
        a += densR(h) * ds; b += densM(h) * ds; c += densO(h) * ds;
      }
      TABLE[o] = a; TABLE[o + 1] = b; TABLE[o + 2] = c;
    }
  }
}
function lookup(h, mu, out) {
  const u = clamp(Math.sqrt(Math.max(0, h) / HA), 0, 1) * (TH - 1);
  const r = RE + Math.max(0, h);
  const th = Math.acos(clamp(mu, -1, 1)), thH = horizonZ(r);
  if (th > thH) { out[0] = out[1] = out[2] = 1e9; return; } // the Sun is below this point's horizon
  const v = (th / thH) * (TZ - 1);
  const i0 = Math.min(TH - 2, u | 0), j0 = Math.min(TZ - 2, v | 0), fu = u - i0, fv = v - j0;
  for (let k = 0; k < 3; k++) {
    const a = TABLE[(i0 * TZ + j0) * 3 + k], b = TABLE[(i0 * TZ + j0 + 1) * 3 + k];
    const c = TABLE[((i0 + 1) * TZ + j0) * 3 + k], d = TABLE[((i0 + 1) * TZ + j0 + 1) * 3 + k];
    out[k] = (a * (1 - fv) + b * fv) * (1 - fu) + (c * (1 - fv) + d * fv) * fu;
  }
}

export class Sky {
  constructor() {
    if (!TABLE) buildTable();
    this.set({});
  }
  // aod: aerosol optical depth at 550 nm · n: Rayleigh exponent (4 = reality) · air: 0 = no atmosphere
  set({ aod = 0.08, n = 4, air = 1, ozone: oz = true } = {}) {
    this.p = { aod, n, air, oz };
    const bM = aod / HM; // sea-level aerosol extinction at 550 nm
    this.bR = LS.map((l) => air * 13.3e-6 * Math.pow(550 / l, n));
    this.bMs = LS.map((l) => air * 0.9 * bM * Math.pow(550 / l, 1.3));
    this.bMe = LS.map((l) => air * bM * Math.pow(550 / l, 1.3));
    this.bO = LS.map((l) => (oz ? air * ozone(l) : 0));
  }
  // transmittance of sunlight to altitude h (m) for a sun at elevation e (deg), per sky wavelength
  sunTransmit(e, h = 10) {
    const od = [0, 0, 0];
    lookup(h, Math.sin(e * DEG), od);
    return LS.map((_, k) => Math.exp(-(this.bR[k] * od[0] + this.bMe[k] * od[1] + this.bO[k] * od[2])));
  }
  // linear RGB of the direct sunbeam (per unit sunlight in space), plus its spectrum
  sunColour(e) {
    const T = this.sunTransmit(e);
    const rgb = [0, 0, 0];
    for (let k = 0; k < NLs; k++) for (let c = 0; c < 3; c++) rgb[c] += SUNs[k] * T[k] * W[k][c];
    return { rgb, T };
  }
  // spectral radiance (relative) arriving from direction (elevation el, azimuth az from the
  // Sun), observer at h0. Writes NLs values into out; returns out.
  radiance(el, az, sunEl, out, h0 = 10, N = 20) {
    const r0 = RE + h0;
    const ce = Math.cos(el * DEG);
    const d = [ce * Math.sin(az * DEG), Math.sin(el * DEG), ce * Math.cos(az * DEG)];
    const s = [0, Math.sin(sunEl * DEG), Math.cos(sunEl * DEG)];
    const nu = d[0] * s[0] + d[1] * s[1] + d[2] * s[2]; // cos of scattering angle
    const pR = (3 / (16 * Math.PI)) * (1 + nu * nu);
    const gg = 0.76;
    const pM = ((1 - gg * gg) / (4 * Math.PI)) / Math.pow(1 + gg * gg - 2 * gg * nu, 1.5);
    const mu = d[1];
    const tMax = -r0 * mu + Math.sqrt(r0 * r0 * (mu * mu - 1) + RA * RA);
    out.fill(0);
    let cR = 0, cM = 0, cO = 0;
    const od = [0, 0, 0];
    const bR = this.bR, bMs = this.bMs, bMe = this.bMe, bO = this.bO;
    let prevT = 0;
    for (let i = 0; i < N; i++) {
      const t = ((i + 0.5) / N) ** 2 * tMax;
      const ds = (((i + 1) / N) ** 2 - (i / N) ** 2) * tMax;
      const px = t * d[0], py = r0 + t * d[1], pz = t * d[2];
      const r = Math.sqrt(px * px + py * py + pz * pz);
      const h = r - RE;
      const rho = densR(h), rhoM = densM(h), rhoO = densO(h);
      // optical depth from camera (midpoint rule, accumulated)
      const half = t - prevT; prevT = t;
      cR += rho * half; cM += rhoM * half; cO += rhoO * half;
      const muS = (px * s[0] + py * s[1] + pz * s[2]) / r;
      lookup(h, muS, od);
      if (od[0] > 1e8) continue; // this bit of air is in the Earth's shadow
      const aR = cR + od[0], aM = cM + od[1], aO = cO + od[2];
      const sr = rho * pR * ds, sm = rhoM * pM * ds;
      for (let k = 0; k < NLs; k++) {
        const tau = bR[k] * aR + bMe[k] * aM + bO[k] * aO;
        out[k] += Math.exp(-tau) * (bR[k] * sr + bMs[k] * sm);
      }
    }
    for (let k = 0; k < NLs; k++) out[k] *= SUNs[k];
    return out;
  }
  // render a cylindrical view into a Float32Array of linear RGB (w*h*3)
  // view = { azMin, azMax, elMin, elMax, sunEl }
  renderLinear(w, h, view, buf) {
    buf = buf && buf.length === w * h * 3 ? buf : new Float32Array(w * h * 3);
    const L = new Float64Array(NLs);
    const { azMin, azMax, elMin, elMax, sunEl } = view;
    for (let y = 0; y < h; y++) {
      const el = Math.max(0.15, elMax - ((y + 0.5) / h) * (elMax - elMin));
      for (let x = 0; x < w; x++) {
        const az = azMin + ((x + 0.5) / w) * (azMax - azMin);
        this.radiance(el, az, sunEl, L);
        let r = 0, g = 0, b = 0;
        for (let k = 0; k < NLs; k++) { r += L[k] * W[k][0]; g += L[k] * W[k][1]; b += L[k] * W[k][2]; }
        const o = (y * w + x) * 3;
        buf[o] = r; buf[o + 1] = g; buf[o + 2] = b;
      }
    }
    return buf;
  }
  // spectrum of skylight from one direction, on the 20 nm grid (for charts)
  skySpectrum(el, az, sunEl) { return Array.from(this.radiance(el, az, sunEl, new Float64Array(NLs))); }
}

// Hue-preserving tone map: compress luminance (1 − e^−Y), keep the colour's ratios, and only
// roll very bright colours softly toward white (as film and eyes do). Then sRGB gamma.
export function toneRGBinto(r, g, b, E, out, j) {
  r *= E; g *= E; b *= E;
  const m = Math.min(r, g, b);
  let Y = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  if (m < 0) { const t = Y / Math.max(Y - m, 1e-12); r = Y + (r - Y) * t; g = Y + (g - Y) * t; b = Y + (b - Y) * t; }
  if (Y > 1e-12) { const s = (1 - Math.exp(-1.6 * Y)) / (1.6 * Y) * 1.25; r *= s; g *= s; b *= s; }
  const M = Math.max(r, g, b);
  if (M > 1) { const w = (M - 1) / (M + 1); r = r / M * (1 - w) + w; g = g / M * (1 - w) + w; b = b / M * (1 - w) + w; }
  out[j] = gamma(Math.max(0, r)) * 255; out[j + 1] = gamma(Math.max(0, g)) * 255; out[j + 2] = gamma(Math.max(0, b)) * 255;
}
export function toneMap(buf, img, E) {
  const d = img.data;
  for (let i = 0, j = 0; i < buf.length; i += 3, j += 4) { toneRGBinto(buf[i], buf[i + 1], buf[i + 2], E, d, j); d[j + 3] = 255; }
}
export function toneRGB(c, E) { const o = [0, 0, 0]; toneRGBinto(c[0], c[1], c[2], E, o, 0); return o; }
// Exposure "like your eyes": set from the light falling on the ground, but adapting only partly,
// so dusk really does get darker. G = global illuminance in units of full sunlight.
export function eyeExposure(G, k = 15) { return k * Math.pow(Math.max(G, 2e-6) / 0.6, -0.62); }
// luminance of a linear RGB triple
export const lum = (c) => 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
// air mass along the line of sight to the Sun, relative to straight up (from the table)
export function airMass(e) {
  if (!TABLE) buildTable();
  const a = [0, 0, 0], z = [0, 0, 0];
  lookup(10, Math.sin(e * DEG), a); lookup(10, 1, z);
  return a[0] / z[0];
}
