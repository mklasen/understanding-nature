// A rising air parcel — no DOM, runs headless in node.
// Environment: T_env(z) = T0 − Γ·z (+ an optional warm "lid" at ~2 km), isothermal above the
// tropopause (11 km). Pressure from hydrostatics. The parcel starts at the ground with the
// ground's temperature and humidity, cools at the dry adiabatic rate (g/cp ≈ 9.8 K/km) keeping
// its water-vapour mixing ratio, until it saturates (cloud base, the LCL); above that it follows
// the saturated (pseudo-)adiabat, integrated numerically. Virtual-temperature effects ignored.
export const G = 9.81, CP = 1005, RD = 287.04, LV = 2.501e6, EPS = 0.622, K0 = 273.15;
export const DRY = G / CP; // K per metre ≈ 0.00976

// saturation vapour pressure over water, hPa (Bolton 1980); T in °C
export const es = (T) => 6.112 * Math.exp((17.67 * T) / (T + 243.5));
// dew point (°C) from vapour pressure (hPa) — inverse of Bolton
export const dewFromE = (e) => { const l = Math.log(e / 6.112); return (243.5 * l) / (17.67 - l); };
export const mixing = (e, p) => (EPS * e) / (p - e);           // kg/kg
export const eFromMixing = (r, p) => (r * p) / (EPS + r);      // hPa

// saturated adiabatic lapse rate (K/m) at T (°C), p (hPa)
export function moistLapse(T, p) {
  const Tk = T + K0, rs = mixing(es(T), p);
  return (G * (1 + (LV * rs) / (RD * Tk))) / (CP + (LV * LV * rs * EPS) / (RD * Tk * Tk));
}

export const TROPOPAUSE = 11000, MIXED = 1200, EXCESS = 0.5;
// mixed: a sunny afternoon — the Sun has stirred the lowest 1.2 km until it cools at the dry rate,
// and thermals leave the ground 0.5 K warmer than their surroundings
export function envTemp(z, { T0, lapse, lid, mixed }) {
  const zz = Math.min(z, TROPOPAUSE);
  let T = mixed
    ? (zz <= MIXED ? T0 - DRY * zz : T0 - DRY * MIXED - lapse * (zz - MIXED) / 1000)
    : T0 - lapse * zz / 1000;
  if (lid) T += 5 * Math.max(0, Math.min(1, (zz - 1800) / 400)); // +5 K over 1.8–2.2 km: an inversion
  return T;
}

// Build the whole sounding + parcel path on a 10 m grid up to zMax.
export function profile({ T0 = 22, rh = 60, lapse = 6.5, lid = false, mixed = true, p0 = 1013.25, zMax = 14000, dz = 10 } = {}) {
  const env = { T0, lapse, lid, mixed };
  const T00 = T0 + (mixed ? EXCESS : 0);
  const n = Math.round(zMax / dz) + 1;
  const z = new Float64Array(n), Te = new Float64Array(n), p = new Float64Array(n);
  const Tp = new Float64Array(n), Td = new Float64Array(n), B = new Float64Array(n);
  const e0 = (rh / 100) * es(T0);
  const r = mixing(e0, p0);
  let lcl = null;
  p[0] = p0; Te[0] = T0; Tp[0] = T00; Td[0] = dewFromE(e0);
  for (let i = 0; i < n; i++) {
    z[i] = i * dz;
    Te[i] = envTemp(z[i], env);
    if (i > 0) {
      const Tm = (Te[i - 1] + Te[i]) / 2 + K0;
      p[i] = p[i - 1] * Math.exp(-G * dz / (RD * Tm));
      if (lcl === null) {
        Tp[i] = Tp[i - 1] - DRY * dz;
        Td[i] = dewFromE(eFromMixing(r, p[i]));
        if (Td[i] >= Tp[i]) { // saturated: interpolate where the lines crossed
          const a = (Tp[i - 1] - Td[i - 1]), b = (Td[i] - Tp[i]);
          lcl = z[i - 1] + dz * a / (a + b);
          Tp[i] = Td[i] = Tp[i - 1] - DRY * dz * a / (a + b) - moistLapse(Tp[i - 1], p[i]) * dz * b / (a + b);
        }
      } else {
        // midpoint (RK2) step along the saturated adiabat
        const pm = Math.sqrt(p[i - 1] * p[i]);
        const T1 = Tp[i - 1] - moistLapse(Tp[i - 1], p[i - 1]) * dz / 2;
        Tp[i] = Tp[i - 1] - moistLapse(T1, pm) * dz;
        Td[i] = Tp[i];
      }
    }
    B[i] = Tp[i] - Te[i];
  }
  if (Td[0] >= T00 - 1e-9) lcl = 0;
  // level of free convection: lowest level where the parcel is warmer than its surroundings
  let lfc = null, el = null;
  for (let i = 0; i < n; i++) if (B[i] > 0.05) { lfc = z[i]; break; }
  if (lfc !== null) {
    const i0 = Math.round(lfc / dz);
    for (let i = i0; i < n; i++) if (B[i] <= 0) { el = z[i]; break; }
    if (el === null) el = zMax;
  }
  // CAPE (J/kg): buoyant energy between LFC and EL
  let cape = 0;
  if (lfc !== null) for (let i = Math.round(lfc / dz); i < Math.round(el / dz); i++) cape += G * B[i] / (Te[i] + K0) * dz;
  return { z, Te, p, Tp, Td, B, lcl: lcl === null ? Infinity : lcl, lfc, el, cape, dz, n, r, env, Td0: Td[0] };
}

export function at(P, f, zz) {
  const x = Math.max(0, Math.min(P.n - 1, zz / P.dz)), i = Math.min(P.n - 2, Math.floor(x)), s = x - i;
  return P[f][i] * (1 - s) + P[f][i + 1] * s;
}

// What the sky does with this air, if something gives it a push.
export function verdict(P) {
  const { lcl, lfc, el } = P;
  if (lcl > 6000) return { key: 'dry', label: 'Too dry for cloud', top: null };
  if (lfc === null || el <= lcl + 50) {
    if (lfc !== null) return { key: 'thermals', label: 'Dry thermals, no cloud', top: null };
    return { key: lcl < 300 ? 'fog' : 'forced', label: lcl < 300 ? 'Fog or low grey layer' : 'Cloud only where air is forced up', top: null };
  }
  if (lfc > Math.max(3000, lcl + 1500)) return { key: 'push', label: 'Only if pushed up hard', top: el };
  const depth = el - Math.max(lcl, 0);
  if (depth < 1800) return { key: 'cumulus', label: 'Fair-weather cumulus', top: el };
  if (el < 7000 || P.cape < 400) return { key: 'shower', label: 'Shower cloud', top: el };
  return { key: 'storm', label: 'Thunderstorm', top: el };
}

// Free convection: dw/dt = g·(Tp − Te)/Te − |w|w/L − w/τ  (crude drag + mixing with the surroundings)
export function stepParcel(P, s, dt) {
  const b = G * at(P, 'B', s.z) / (at(P, 'Te', s.z) + K0);
  s.w += (b - Math.abs(s.w) * s.w / 400 - s.w / 200) * dt;
  s.z += s.w * dt;
  if (s.z <= 0) { s.z = 0; s.w = Math.max(0, s.w); }
  if (s.z > 13500) { s.z = 13500; s.w = Math.min(0, s.w); }
  return s;
}
