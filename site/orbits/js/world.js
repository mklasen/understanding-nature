// The shared world: where everything is, and which way it faces, at any moment.
// Units: km, heliocentric ecliptic coordinates (x → March equinox, z → ecliptic north), time d = days since J2000 (UT).
// Chapters that need "what if" physics can wrap or replace this model; the Viewer only needs `state(d)`.
import { PLANETS, planetPos, AU, DEG, TAU, R_SUN, TILT, MOON_INCL } from './astro.js';
import { mat, v3 } from './draw.js';

export const RADIUS = { sun: R_SUN, mercury: 2440, venus: 6052, earth: 6371, moon: 1737.4, mars: 3390, jupiter: 69911, saturn: 58232, uranus: 25362, neptune: 24622 };
export const COLOR = { sun: '#ffd27a', mercury: '#b9b2a8', venus: '#f1d9a6', earth: '#5fb0f0', moon: '#d7dcef', mars: '#ff8a5c', jupiter: '#e0b98a', saturn: '#e8d3a0', uranus: '#a9e0e8', neptune: '#6f8fff' };
export const NAME = { sun: 'Sun', mercury: 'Mercury', venus: 'Venus', earth: 'Earth', moon: 'Moon', mars: 'Mars', jupiter: 'Jupiter', saturn: 'Saturn', uranus: 'Uranus', neptune: 'Neptune' };
const PL = Object.fromEntries(PLANETS.map((p) => [p.name.toLowerCase(), p]));

// Lunar theory with the main perturbations (≈0.1–0.3° in position, ≈0.5% in distance): mean longitude L, mean anomaly M,
// argument of latitude F (from the regressing ascending node). `incl` lets a chapter flatten/steepen the orbit.
export function moonGeo(d, incl = MOON_INCL) {
  // main periodic terms of the lunar theory (Meeus, Astronomical Algorithms ch. 47): ≈0.1° in position
  const L = (218.316 + 13.176396 * d) * DEG, M = (134.963 + 13.064993 * d) * DEG, F = (93.272 + 13.22935 * d) * DEG;
  const D = (297.850 + 12.190749 * d) * DEG, Ms = (357.529 + 0.98560028 * d) * DEG;
  const lam = L + DEG * (6.289 * Math.sin(M) + 1.274 * Math.sin(2 * D - M) + 0.658 * Math.sin(2 * D) + 0.214 * Math.sin(2 * M)
    - 0.186 * Math.sin(Ms) - 0.114 * Math.sin(2 * F) + 0.059 * Math.sin(2 * D - 2 * M) + 0.057 * Math.sin(2 * D - Ms - M));
  const beta = (incl / 5.145) * DEG * (5.128 * Math.sin(F) + 0.281 * Math.sin(M + F) + 0.278 * Math.sin(M - F) + 0.173 * Math.sin(2 * D - F));
  const r = 385001 - 20905 * Math.cos(M) - 3699 * Math.cos(2 * D - M) - 2956 * Math.cos(2 * D) - 570 * Math.cos(2 * M);
  return { lam, beta, r, vec: [r * Math.cos(beta) * Math.cos(lam), r * Math.cos(beta) * Math.sin(lam), r * Math.sin(beta)] };
}
// Greenwich mean sidereal time (rad): Earth's rotation angle relative to the March equinox
export const gmst = (d) => ((280.46061837 + 360.98564736629 * d) % 360) * DEG;

// Earth's body frame → ecliptic: spin about the pole by GMST, then tip the pole by the obliquity
export function earthFrame(d, tiltDeg = TILT) {
  return mat.mul(mat.rotX(-tiltDeg * DEG), mat.rotZ(gmst(d)));
}
// Moon's body frame. The Moon spins uniformly, so its face points at Earth's *mean* direction (mean longitude L),
// not the true one — the difference is the ±8° libration in longitude we see from Earth. z ≈ ecliptic north
// (the real spin axis is 1.5° off; libration in latitude is ignored). x → (mean) Earth, y = east.
export function moonFrame(d) {
  const L = (218.316 + 13.176396 * d) * DEG;
  const x = [-Math.cos(L), -Math.sin(L), 0], z = [0, 0, 1], y = v3.cross(z, x);
  return [[x[0], y[0], z[0]], [x[1], y[1], z[1]], [x[2], y[2], z[2]]];
}

export class World {
  constructor(opts = {}) { this.tilt = opts.tilt ?? TILT; this.moonIncl = opts.moonIncl ?? MOON_INCL; this.bodies = opts.bodies || ['sun', 'mercury', 'venus', 'earth', 'moon', 'mars', 'jupiter']; }
  pos(id, d) {
    if (id === 'sun') return [0, 0, 0];
    if (id === 'moon') return v3.add(this.pos('earth', d), moonGeo(d, this.moonIncl).vec);
    const p = planetPos(PL[id], d);
    return [p.x * AU, p.y * AU, p.z * AU];
  }
  state(d) {
    const out = { d, bodies: {} };
    for (const id of this.bodies) out.bodies[id] = { id, pos: this.pos(id, d), r: RADIUS[id], color: COLOR[id], name: NAME[id] };
    const E = out.bodies.earth;
    if (E) E.frame = earthFrame(d, this.tilt);
    const M = out.bodies.moon;
    if (M) M.frame = moonFrame(d);
    return out;
  }
  // orbit path of a body for drawing (km), relative to its primary at time d
  path(id, d, n = 160) {
    if (id === 'moon') {
      const e = this.pos('earth', d), pts = [];
      for (let k = 0; k <= n; k++) pts.push(v3.add(e, moonGeo(d - 13.66 + (k / n) * 27.32, this.moonIncl).vec));
      return pts;
    }
    const p = PL[id], pts = [];
    for (let k = 0; k <= n; k++) { const q = planetPos(p, d + (k / n) * p.P); pts.push([q.x * AU, q.y * AU, q.z * AU]); }
    return pts;
  }
  // a point on Earth's surface (geographic lat/lon in degrees) in world km, plus its local East/North/Up axes
  site(d, lat, lon, earthState) {
    const F = earthState ? earthState.frame : earthFrame(d, this.tilt);
    const la = lat * DEG, lo = lon * DEG;
    const up = mat.apply(F, [Math.cos(la) * Math.cos(lo), Math.cos(la) * Math.sin(lo), Math.sin(la)]);
    const east = mat.apply(F, [-Math.sin(lo), Math.cos(lo), 0]);
    const north = v3.cross(up, east);
    const E = earthState ? earthState.pos : this.pos('earth', d);
    return { pos: v3.add(E, v3.mul(up, RADIUS.earth)), up, east, north };
  }
}
export { TAU };
