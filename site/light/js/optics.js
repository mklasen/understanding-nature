// The science behind every chapter, in one place. Chapters only visualise it.
// Everything works on spectra sampled at LAMBDA (nm) and turns them into screen colour
// with the CIE 1931 observer, so colours on screen are computed, not picked.

// ---------- wavelengths ----------
export const LAMBDA = [];
for (let l = 390; l <= 710; l += 10) LAMBDA.push(l);
export const NL = LAMBDA.length;
export const spectrum = (f) => Float64Array.from(LAMBDA, f);

// ---------- CIE 1931 2° colour matching functions ----------
// Multi-lobe Gaussian fit of Wyman, Sloan & Shirley (2013, JCGT 2(2)) — within a few % of the
// tabulated CIE data across the visible range, and needs no vendored table.
const g = (x, mu, s1, s2) => { const t = (x - mu) / (x < mu ? s1 : s2); return Math.exp(-0.5 * t * t); };
export const cieX = (l) => 1.056 * g(l, 599.8, 37.9, 31.0) + 0.362 * g(l, 442.0, 16.0, 26.7) - 0.065 * g(l, 501.1, 20.4, 26.2);
export const cieY = (l) => 0.821 * g(l, 568.8, 46.9, 40.5) + 0.286 * g(l, 530.9, 16.3, 31.1);
export const cieZ = (l) => 1.217 * g(l, 437.0, 11.8, 36.0) + 0.681 * g(l, 459.0, 26.0, 13.8);
const CX = spectrum(cieX), CY = spectrum(cieY), CZ = spectrum(cieZ);

export function toXYZ(s) {
  let X = 0, Y = 0, Z = 0;
  for (let i = 0; i < NL; i++) { X += s[i] * CX[i]; Y += s[i] * CY[i]; Z += s[i] * CZ[i]; }
  return [X, Y, Z];
}
// XYZ → linear sRGB (D65 primaries)
export function xyzToLin([X, Y, Z]) {
  return [
    3.2406 * X - 1.5372 * Y - 0.4986 * Z,
    -0.9689 * X + 1.8758 * Y + 0.0415 * Z,
    0.0557 * X - 0.2040 * Y + 1.0570 * Z,
  ];
}
// Hunt–Pointer–Estevez: XYZ → cone responses (L, M, S)
export function xyzToLMS([X, Y, Z]) {
  return [0.38971 * X + 0.68898 * Y - 0.07868 * Z, -0.22981 * X + 1.18340 * Y + 0.04641 * Z, Z];
}

// ---------- sunlight ----------
// Sunlight above the atmosphere ≈ a 5778 K black body (the real spectrum has Fraunhofer dips
// and a little less violet; good enough for colour).
export function planck(lnm, T) {
  const l = lnm * 1e-9, h = 6.626e-34, c = 2.998e8, k = 1.381e-23;
  return 1 / (l ** 5 * (Math.exp((h * c) / (l * k * T)) - 1));
}
const p550 = planck(550, 5778);
export const SUN = spectrum((l) => planck(l, 5778) / p550);

// White balance: the camera is balanced so that sunlight *in space* is pure white.
// Anything coloured on screen is then coloured by the physics (air, water, films…).
const SUN_LIN = xyzToLin(toXYZ(SUN));
export const WB = SUN_LIN.map((v) => SUN_LIN[1] / v);
export const SUN_Y = toXYZ(SUN)[1];

// spectrum → linear RGB, white-balanced, scaled so that the bare Sun spectrum has Y = 1
export function specToLin(s) {
  const c = xyzToLin(toXYZ(s));
  return [(c[0] * WB[0]) / SUN_Y, (c[1] * WB[1]) / SUN_Y, (c[2] * WB[2]) / SUN_Y];
}
// spectrum (as fraction of sunlight per wavelength) → linear RGB
export function reflToLin(r) {
  const s = new Float64Array(NL);
  for (let i = 0; i < NL; i++) s[i] = r[i] * SUN[i];
  return specToLin(s);
}

export const gamma = (v) => (v <= 0.0031308 ? 12.92 * v : 1.055 * Math.pow(v, 1 / 2.4) - 0.055);
// linear RGB → css. Out-of-gamut colours are desaturated toward their own grey
// (keeps hue, avoids the garish clipping of raw spectral colours).
export function linToRGB(c, exposure = 1) {
  let [r, gg, b] = c.map((v) => v * exposure);
  const m = Math.min(r, gg, b);
  if (m < 0) { const y = 0.2126 * r + 0.7152 * gg + 0.0722 * b; const t = y / Math.max(y - m, 1e-9); r = y + (r - y) * t; gg = y + (gg - y) * t; b = y + (b - y) * t; }
  const M = Math.max(r, gg, b);
  if (M > 1) { r /= M; gg /= M; b /= M; }
  return [gamma(Math.max(0, r)) * 255, gamma(Math.max(0, gg)) * 255, gamma(Math.max(0, b)) * 255];
}
export const css = (rgb, a = 1) => `rgba(${rgb[0] | 0},${rgb[1] | 0},${rgb[2] | 0},${a})`;
// colour of a spectrum, brightness-normalised (just the hue/saturation)
export function hueOf(s, bright = 0.9) {
  const c = specToLin(s);
  const M = Math.max(c[0], c[1], c[2], 1e-12);
  return linToRGB(c.map((v) => (v / M) * bright));
}

// a single wavelength as a displayable colour (spectral colours lie outside sRGB; desaturated)
export function wavelengthRGB(l, bright = 1) {
  const c = xyzToLin([cieX(l), cieY(l), cieZ(l)]).map((v, i) => v * WB[i]);
  const y = 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
  const m = Math.min(...c);
  let rgb = c;
  if (m < 0) { const t = (y + 0.08) / (y - m + 0.08); rgb = c.map((v) => y + (v - y) * t); }
  const M = Math.max(...rgb, 1e-9);
  // dim the ends of the spectrum the way the eye does, but keep them visible
  const vis = 0.35 + 0.65 * Math.min(1, cieY(l) / 0.25);
  return rgb.map((v) => gamma(Math.max(0, (v / M) * vis * bright)) * 255);
}

// ---------- refractive indices ----------
// water: Cauchy fit through n(400) = 1.343, n(700) = 1.330 (within ±0.001 of measured, 20 °C)
export const nWater = (l) => 1.3240 + 3046 / (l * l);
// glass for the prism: dense flint (SF11-like), Cauchy fit n(400)=1.807, n(700)=1.766
export const nFlint = (l) => 1.7461 + 9810 / (l * l);

// ---------- Rayleigh scattering by air ----------
// scattering coefficient at sea level, per metre: 13.3e-6 at 550 nm, ∝ λ^-4
export const betaRayleigh = (l, n = 4) => 13.3e-6 * Math.pow(550 / l, n);

// ---------- Mie scattering by a sphere (Bohren & Huffman BHMIE, real index) ----------
// returns the scattering efficiency Q_sca (cross-section / geometric area)
export function mieQ(x, m) {
  if (x < 1e-3) { const k = (m * m - 1) / (m * m + 2); return (8 / 3) * x ** 4 * k * k; }
  const nstop = Math.ceil(x + 4 * Math.cbrt(x) + 2);
  const mx = m * x;
  const nmx = Math.ceil(Math.max(nstop, mx)) + 16;
  const D = new Float64Array(nmx + 1);
  for (let n = nmx; n >= 1; n--) D[n - 1] = n / mx - 1 / (D[n] + n / mx);
  let psi0 = Math.cos(x), psi1 = Math.sin(x), chi0 = -Math.sin(x), chi1 = Math.cos(x);
  let q = 0;
  for (let n = 1; n <= nstop; n++) {
    const psi = ((2 * n - 1) / x) * psi1 - psi0;
    const chi = ((2 * n - 1) / x) * chi1 - chi0;
    const fa = D[n] / m + n / x, fb = m * D[n] + n / x;
    const Aa = fa * psi - psi1, Ba = fa * chi - chi1;
    const Ab = fb * psi - psi1, Bb = fb * chi - chi1;
    q += (2 * n + 1) * ((Aa * Aa) / (Aa * Aa + Ba * Ba) + (Ab * Ab) / (Ab * Ab + Bb * Bb));
    psi0 = psi1; psi1 = psi; chi0 = chi1; chi1 = chi;
  }
  return (2 / (x * x)) * q;
}
// scattering per particle (∝ σ = Q·πr²) for water droplets of radius r (µm), averaged over a
// ±30% spread of sizes (real clouds and hazes are never one size; also smooths Mie ripples)
export function dropletScatter(rUm, l) {
  const m = nWater(l);
  let s = 0, w = 0;
  for (let k = -4; k <= 4; k++) {
    const r = rUm * (1 + 0.075 * k);
    const wt = Math.exp(-0.5 * (k / 2.2) ** 2);
    const x = (2 * Math.PI * r * 1000) / l;
    s += wt * mieQ(x, m) * r * r; w += wt;
  }
  return s / w;
}

// ---------- thin films (soap bubble, oil on water) ----------
// exact single-layer (Airy) reflectance at normal incidence, film of index nf, thickness d nm,
// between media n0 (above) and n2 (below)
export function filmReflect(d, l, nf = 1.33, n0 = 1, n2 = 1) {
  const r1 = (n0 - nf) / (n0 + nf), r2 = (nf - n2) / (nf + n2);
  const c = Math.cos((4 * Math.PI * nf * d) / l);
  return (r1 * r1 + r2 * r2 + 2 * r1 * r2 * c) / (1 + r1 * r1 * r2 * r2 + 2 * r1 * r2 * c);
}

// ---------- water: absorption & scattering ----------
// pure-water absorption a(λ) in 1/m, after Pope & Fry (1997), rounded; 390 from Morel et al.
const A_W = { 390: 0.0085, 400: 0.0066, 410: 0.0050, 420: 0.0045, 430: 0.0050, 440: 0.0064, 450: 0.0092, 460: 0.0098, 470: 0.0106, 480: 0.0127, 490: 0.0150, 500: 0.0204, 510: 0.0325, 520: 0.0409, 530: 0.0434, 540: 0.0474, 550: 0.0565, 560: 0.0619, 570: 0.0695, 580: 0.0896, 590: 0.1351, 600: 0.2224, 610: 0.2644, 620: 0.2755, 630: 0.2916, 640: 0.3108, 650: 0.3400, 660: 0.4100, 670: 0.4295, 680: 0.4550, 690: 0.5000, 700: 0.6240, 710: 0.8270 };
export const aWater = (l) => A_W[l];
// molecular scattering of sea water (Morel 1974): 0.0029/m at 500 nm, ∝ λ^-4.32; half goes backwards
export const bWater = (l) => 0.0029 * Math.pow(500 / l, 4.32);

// ---------- small helpers ----------
export const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
export const lerp = (a, b, t) => a + (b - a) * t;
export const DEG = Math.PI / 180;
export function bandName(l) {
  return l < 425 ? 'violet' : l < 490 ? 'blue' : l < 520 ? 'cyan' : l < 565 ? 'green' : l < 590 ? 'yellow' : l < 625 ? 'orange' : 'red';
}

// ---------- naming colours (for readouts) ----------
// from linear RGB (any brightness) to a plain-English name
export function colourName(lin, { dark = 0.004 } = {}) {
  const Y = 0.2126 * lin[0] + 0.7152 * lin[1] + 0.0722 * lin[2];
  if (Y < dark) return 'black';
  const M = Math.max(...lin, 1e-12);
  const [r, g, b] = lin.map((v) => gamma(Math.max(0, v / M)));
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn;
  const sat = mx > 0 ? d / mx : 0;
  if (sat < 0.12) return Y > 0.35 ? 'white' : 'grey';
  let h;
  if (mx === r) h = ((g - b) / d) % 6; else if (mx === g) h = (b - r) / d + 2; else h = (r - g) / d + 4;
  h = (h * 60 + 360) % 360;
  const pale = sat < 0.35 ? 'pale ' : '';
  const n = h < 12 ? 'red' : h < 40 ? 'orange' : h < 68 ? 'yellow' : h < 82 ? 'yellow-green' : h < 160 ? 'green' : h < 196 ? 'turquoise' : h < 250 ? 'blue' : h < 285 ? 'violet' : h < 330 ? 'magenta' : h < 348 ? 'pink' : 'red';
  if (pale && (n === 'magenta' || n === 'red')) return 'pink';
  return pale + n;
}
// 2D refraction of unit direction d at a surface with unit normal nrm (pointing back toward d),
// eta = n1/n2. Returns the new direction, or null for total internal reflection.
export function refract2(d, nrm, eta) {
  const ci = -(d[0] * nrm[0] + d[1] * nrm[1]);
  const k = 1 - eta * eta * (1 - ci * ci);
  if (k < 0) return null;
  const f = eta * ci - Math.sqrt(k);
  return [eta * d[0] + f * nrm[0], eta * d[1] + f * nrm[1]];
}
