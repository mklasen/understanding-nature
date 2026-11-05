// The shared world: where everything is, and which way it faces, at any moment.
// Units: km, heliocentric ecliptic coordinates (x → March equinox, z → ecliptic north), time d = days since J2000 (UT).
// Chapters that need "what if" physics can wrap or replace this model; the Viewer only needs `state(d)`.
import { PLANETS, planetPos, AU, DEG, TAU, R_SUN, TILT, MOON_INCL } from './astro.js';
import { mat, v3 } from './draw.js';

export const RADIUS = { sun: R_SUN, mercury: 2440, venus: 6052, earth: 6371, moon: 1737.4, mars: 3390, jupiter: 69911 };
export const COLOR = { sun: '#ffd27a', mercury: '#b9b2a8', venus: '#f1d9a6', earth: '#5fb0f0', moon: '#d7dcef', mars: '#ff8a5c', jupiter: '#e0b98a' };
export const NAME = { sun: 'Sun', mercury: 'Mercury', venus: 'Venus', earth: 'Earth', moon: 'Moon', mars: 'Mars', jupiter: 'Jupiter' };
const PL = Object.fromEntries(PLANETS.map((p) => [p.name.toLowerCase(), p]));

// Low-precision lunar theory (≈1° in position, ≈2% in distance): mean longitude L, mean anomaly M,
// argument of latitude F (from the regressing ascending node). `incl` lets a chapter flatten/steepen the orbit.
export function moonGeo(d, incl = MOON_INCL) {
  const L = (218.316 + 13.176396 * d) * DEG, M = (134.963 + 13.064993 * d) * DEG, F = (93.272 + 13.22935 * d) * DEG;
  const lam = L + 6.289 * DEG * Math.sin(M);
  const beta = (incl / 5.145) * 5.128 * DEG * Math.sin(F);
  const r = 385001 - 20905 * Math.cos(M);
  return { lam, beta, r, vec: [r * Math.cos(beta) * Math.cos(lam), r * Math.cos(beta) * Math.sin(lam), r * Math.sin(beta)] };
}
// Greenwich mean sidereal time (rad): Earth's rotation angle relative to the March equinox
export const gmst = (d) => ((280.46061837 + 360.98564736629 * d) % 360) * DEG;

// Earth's body frame → ecliptic: spin about the pole by GMST, then tip the pole by the obliquity
export function earthFrame(d, tiltDeg = TILT) {
  return mat.mul(mat.rotX(-tiltDeg * DEG), mat.rotZ(gmst(d)));
}
// Moon's body frame (tidally locked): x → Earth, z ≈ ecliptic north, y = east
export function moonFrame(moonToEarth) {
  const x = v3.norm(moonToEarth);
  const z = v3.norm(v3.sub([0, 0, 1], v3.mul(x, x[2])));
  const y = v3.cross(z, x);
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
    if (M && E) M.frame = moonFrame(v3.sub(E.pos, M.pos));
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
