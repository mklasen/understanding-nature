// Transfer orbits: Lambert's problem (universal variables, Bate–Mueller–White) and two-body propagation.
// Given where you start, where you must arrive, and how long the trip takes, there is exactly one conic arc
// around the Sun (or Earth) that works. That's why launch dates are dictated by where the planets are.
import { v3 } from './draw.js';

export const MU_SUN = 1.32712440018e11, MU_EARTH = 398600.4418; // km³/s²

const stumpC = (z) => (z > 1e-6 ? (1 - Math.cos(Math.sqrt(z))) / z : z < -1e-6 ? (Math.cosh(Math.sqrt(-z)) - 1) / -z : 0.5 - z / 24);
const stumpS = (z) => {
  if (z > 1e-6) { const s = Math.sqrt(z); return (s - Math.sin(s)) / (s * s * s); }
  if (z < -1e-6) { const s = Math.sqrt(-z); return (Math.sinh(s) - s) / (s * s * s); }
  return 1 / 6 - z / 120;
};

// r1, r2: position vectors (km); tof: seconds; prograde motion about +z. Returns velocity at r1 (km/s) or null.
export function lambert(r1v, r2v, tof, mu = MU_SUN) {
  const r1 = v3.len(r1v), r2 = v3.len(r2v);
  let dth = Math.acos(Math.max(-1, Math.min(1, v3.dot(r1v, r2v) / (r1 * r2))));
  if (v3.cross(r1v, r2v)[2] < 0) dth = 2 * Math.PI - dth;
  const A = Math.sin(dth) * Math.sqrt((r1 * r2) / (1 - Math.cos(dth)));
  if (Math.abs(A) < 1e-9) return null;
  const y = (z) => r1 + r2 + (A * (z * stumpS(z) - 1)) / Math.sqrt(stumpC(z));
  const F = (z) => { const yy = y(z); if (yy < 0) return -Infinity; return Math.pow(yy / stumpC(z), 1.5) * stumpS(z) + A * Math.sqrt(yy) - Math.sqrt(mu) * tof; };
  // bracket and bisect on z (F increases with z)
  let lo = -400, hi = 4 * Math.PI * Math.PI - 1e-6; // z < 0: hyperbolic (e.g. Voyager after Jupiter)
  if (y(lo) < 0) { // move lo just past where y(z) turns positive (bisection — never overshoot the root)
    let a = lo, b = hi;
    for (let i = 0; i < 200; i++) { const m = (a + b) / 2; if (y(m) < 0) a = m; else b = m; }
    lo = b;
  }
  if (F(lo) > 0 || F(hi) < 0) return null;
  for (let i = 0; i < 200; i++) { const m = (lo + hi) / 2; if (F(m) > 0) hi = m; else lo = m; }
  const z = (lo + hi) / 2, yy = y(z);
  const f = 1 - yy / r1, g = A * Math.sqrt(yy / mu);
  return v3.mul(v3.sub(r2v, v3.mul(r1v, f)), 1 / g);
}

// Two-body propagation for any conic (universal variable χ, Curtis alg. 3.3–3.4): position Δt seconds after (r0, v0).
export function conic(r0v, v0v, mu = MU_SUN) {
  const r0 = v3.len(r0v), vr0 = v3.dot(r0v, v0v) / r0, alpha = 2 / r0 - v3.dot(v0v, v0v) / mu, sm = Math.sqrt(mu);
  const Fx = (x, dt) => { const z = alpha * x * x; return (r0 * vr0 / sm) * x * x * stumpC(z) + (1 - alpha * r0) * x * x * x * stumpS(z) + r0 * x - sm * dt; };
  const dFx = (x) => { const z = alpha * x * x; return (r0 * vr0 / sm) * x * (1 - alpha * x * x * stumpS(z)) + (1 - alpha * r0) * x * x * stumpC(z) + r0; };
  return (dt) => {
    // F(χ) increases monotonically: bracket the root, then Newton steps that fall back to bisection
    let lo = 0, hi = Math.max(1, sm * Math.abs(alpha) * dt, (sm * dt) / r0);
    for (let i = 0; i < 80 && Fx(hi, dt) < 0; i++) hi *= 2;
    let x = (lo + hi) / 2;
    for (let i = 0; i < 100; i++) {
      const F = Fx(x, dt);
      if (F > 0) hi = x; else lo = x;
      let nx = x - F / dFx(x);
      if (!(nx > lo && nx < hi)) nx = (lo + hi) / 2;
      if (Math.abs(nx - x) < 1e-9 * Math.max(1, Math.abs(x))) { x = nx; break; }
      x = nx;
    }
    const z = alpha * x * x;
    const f = 1 - (x * x / r0) * stumpC(z), g = dt - (x * x * x * stumpS(z)) / sm;
    return v3.add(v3.mul(r0v, f), v3.mul(v0v, g));
  };
}

// A transfer leg between two dated positions: returns { at(d) → position, points(n) }
export function leg(d1, r1, d2, r2, mu = MU_SUN) {
  const v1 = lambert(r1, r2, (d2 - d1) * 86400, mu);
  if (!v1) return null;
  const pos = conic(r1, v1, mu);
  const at = (d) => pos((Math.max(d1, Math.min(d2, d)) - d1) * 86400);
  const points = (n = 120, upTo = d2) => { const out = []; const end = Math.min(d2, upTo); if (end <= d1) return out; for (let k = 0; k <= n; k++) out.push(at(d1 + (k / n) * (end - d1))); return out; };
  return { d1, d2, v1, at, points };
}
