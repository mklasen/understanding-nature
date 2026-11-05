// All the astronomy in one place. Chapters only visualise what's computed here.
// Units: km, s, days, degrees at the API edge (radians inside). Sources: IAU / NASA fact sheets,
// J2000 mean orbital elements (Standish 1992, good to well under a degree for centuries around 2000).

export const DEG = Math.PI / 180;
export const TAU = Math.PI * 2;
export const AU = 149_597_870.7;           // km
export const DAY = 86400;                  // s
export const YEAR = 365.25636;             // sidereal year, days
export const TROPICAL_YEAR = 365.24219;    // equinox to equinox — the seasons' year
export const SIDEREAL_DAY_H = 23.9344696;  // hours: one turn relative to the stars
export const SOLAR_DAY_H = 24;             // mean solar day
export const SYNODIC_MONTH = 29.530589;    // new moon to new moon, days
export const SIDEREAL_MONTH = 27.321662;   // one turn relative to the stars
export const DRACONIC_MONTH = 27.212221;   // node to node
export const NODE_PERIOD_Y = 18.6129;      // lunar nodes regress once per 18.6 years
export const TILT = 23.44;                 // Earth's obliquity, degrees
export const MOON_INCL = 5.145;            // Moon's orbit vs ecliptic, degrees
export const E_EARTH = 0.0167;
export const R_SUN = 695_700, R_EARTH = 6371, R_MOON = 1737.4, MOON_DIST = 384_400; // km
export const GM_EARTH = 398_600.4418;      // km^3/s^2
export const SOLAR_CONST = 1361;           // W/m^2 at 1 AU

// ---- the stacked motions (honest numbers + what each is relative to)
export const SPEEDS = {
  spinEquator: TAU * R_EARTH / (SIDEREAL_DAY_H * 3600), // 0.465 km/s
  orbit: 29.78,          // km/s, Earth around the Sun (mean)
  galactic: 230,         // km/s, Sun around the Milky Way centre (220–240 in the literature)
  galacticPeriodMy: 230, // million years per lap (estimates 220–250)
  sunVsCMB: 369.8,       // km/s, Sun relative to the cosmic microwave background (Planck dipole)
  localGroupVsCMB: 620,  // km/s, the Local Group / Milky Way relative to the CMB (≈ 2.2 million km/h)
};

// ---- time
const J2000 = Date.UTC(2000, 0, 1, 12);
export const daysSinceJ2000 = (ms) => (ms - J2000) / 86_400_000;
export const dateFromJ2000 = (d) => new Date(J2000 + d * 86_400_000);

// ---- Kepler
export function solveKepler(M, e) {
  M = ((M % TAU) + TAU) % TAU;
  let E = e < 0.8 ? M : Math.PI;
  for (let i = 0; i < 12; i++) {
    const dE = (E - e * Math.sin(E) - M) / (1 - e * Math.cos(E));
    E -= dE;
    if (Math.abs(dE) < 1e-12) break;
  }
  return E;
}
// position in orbit plane (focus at origin, periapsis along +x); a in any unit
export function keplerXY(a, e, M) {
  const E = solveKepler(M, e);
  const x = a * (Math.cos(E) - e), y = a * Math.sqrt(1 - e * e) * Math.sin(E);
  return { x, y, r: Math.hypot(x, y), nu: Math.atan2(y, x), E };
}

// J2000 mean elements: a [AU], e, i [deg], L (mean longitude) [deg], ϖ (lon. of perihelion), Ω, period [days]
export const PLANETS = [
  { name: 'Mercury', a: 0.38710, e: 0.20563, i: 7.005, L: 252.2503, w: 77.4577, O: 48.331, P: 87.969, r: 2440, color: '#b9b2a8' },
  { name: 'Venus', a: 0.72333, e: 0.00677, i: 3.395, L: 181.9791, w: 131.6025, O: 76.680, P: 224.701, r: 6052, color: '#f1d9a6' },
  { name: 'Earth', a: 1.00000, e: 0.01671, i: 0.000, L: 100.4645, w: 102.9377, O: 0, P: 365.256, r: 6371, color: '#5fb0f0' },
  { name: 'Mars', a: 1.52368, e: 0.09340, i: 1.850, L: 355.4533, w: 336.0602, O: 49.558, P: 686.980, r: 3390, color: '#ff8a5c' },
  { name: 'Jupiter', a: 5.20260, e: 0.04849, i: 1.303, L: 34.3964, w: 14.7284, O: 100.464, P: 4332.59, r: 69911, color: '#e0b98a' },
];
// heliocentric ecliptic position [AU] at day d since J2000
export function planetPos(p, d) {
  const M = (p.L - p.w + 360 * d / p.P) * DEG;
  const { x, y } = keplerXY(p.a, p.e, M);
  // rotate by argument of perihelion (ϖ − Ω), tilt by i about the node line, rotate by Ω
  const w = (p.w - p.O) * DEG, O = p.O * DEG, i = p.i * DEG;
  const xw = x * Math.cos(w) - y * Math.sin(w), yw = x * Math.sin(w) + y * Math.cos(w);
  const yi = yw * Math.cos(i), z = yw * Math.sin(i);
  return { x: xw * Math.cos(O) - yi * Math.sin(O), y: xw * Math.sin(O) + yi * Math.cos(O), z };
}
export const earth = PLANETS[2];

// ---- the Sun as seen from Earth
// Sun's ecliptic longitude λ (0 = March equinox) and Earth–Sun distance, from Earth's Kepler orbit.
export function sunFromEarth(d) {
  const p = planetPos(earth, d);
  return { lambda: Math.atan2(-p.y, -p.x), r: Math.hypot(p.x, p.y) };
}
// solar declination for a given ecliptic longitude and tilt (degrees in, radians out)
export const declination = (lambda, tiltDeg) => Math.asin(Math.sin(tiltDeg * DEG) * Math.sin(lambda));

// hour angle of sunrise/sunset (rad). Returns 0 (polar night) … π (midnight sun). No refraction.
export function sunsetHourAngle(latRad, dec) {
  const c = -Math.tan(latRad) * Math.tan(dec);
  if (c >= 1) return 0;
  if (c <= -1) return Math.PI;
  return Math.acos(c);
}
export const dayLengthHours = (latRad, dec) => (24 * sunsetHourAngle(latRad, dec)) / Math.PI;
export const noonAltitude = (latRad, dec) => Math.PI / 2 - Math.abs(latRad - dec);
// 24-hour mean sunlight on flat ground at the top of the atmosphere, W/m^2
export function dailyInsolation(latRad, dec, rAU = 1) {
  const H = sunsetHourAngle(latRad, dec);
  const q = (SOLAR_CONST / Math.PI) / (rAU * rAU) *
    (H * Math.sin(latRad) * Math.sin(dec) + Math.cos(latRad) * Math.cos(dec) * Math.sin(H));
  return Math.max(0, q);
}

// ---- the Moon (simple, mean motions — enough for phase and eclipse geometry)
export const NEW_MOON_EPOCH = daysSinceJ2000(Date.UTC(2000, 0, 6, 18, 14)); // a known new moon
export const moonAge = (d) => ((((d - NEW_MOON_EPOCH) % SYNODIC_MONTH) + SYNODIC_MONTH) % SYNODIC_MONTH);
export const moonPhaseAngle = (d) => (moonAge(d) / SYNODIC_MONTH) * TAU; // 0 new, π full
export const illuminatedFraction = (phase) => (1 - Math.cos(phase)) / 2;
export function phaseName(phase) {
  const f = ((phase / TAU) % 1 + 1) % 1;
  const names = ['New Moon', 'Waxing crescent', 'First quarter', 'Waxing gibbous', 'Full Moon', 'Waning gibbous', 'Last quarter', 'Waning crescent'];
  return names[Math.round(f * 8) % 8];
}
// Mean longitude of the Moon's ascending node (deg), regressing once per 18.6 yr.
export const moonNode = (d) => 125.0445 - 0.0529538 * d;

// ---- orbits & gravity
export const circularSpeed = (gm, r) => Math.sqrt(gm / r);
export const escapeSpeed = (gm, r) => Math.sqrt(2 * gm / r);
export const keplerPeriodYears = (aAU) => Math.pow(aAU, 1.5);

// ---- small formatting helpers for astronomy-sized numbers
export function fmtBig(x) {
  if (x >= 1e12) return `${(x / 1e12).toFixed(1)} trillion`;
  if (x >= 1e9) return `${(x / 1e9).toFixed(x >= 1e10 ? 0 : 1)} billion`;
  if (x >= 1e6) return `${(x / 1e6).toFixed(x >= 1e7 ? 0 : 1)} million`;
  return Math.round(x).toLocaleString('en');
}
export function fmtHM(hours) {
  let h = Math.floor(hours), m = Math.round((hours - h) * 60);
  if (m === 60) { h += 1; m = 0; }
  return `${h} h ${String(m).padStart(2, '0')} m`;
}
export function fmtHMS(hours) {
  const s = Math.round(hours * 3600);
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), ss = s % 60;
  return `${h} h ${String(m).padStart(2, '0')} m ${String(ss).padStart(2, '0')} s`;
}
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
export const fmtDate = (date) => `${date.getUTCDate()} ${MONTHS[date.getUTCMonth()]} ${date.getUTCFullYear()}`;
export const fmtDayMonth = (date) => `${date.getUTCDate()} ${MONTHS[date.getUTCMonth()]}`;
