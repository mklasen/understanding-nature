// Hero: the shared world, live. Real positions for today; three viewpoints; tap anything to fly to it.
import { AU, daysSinceJ2000 } from './astro.js';
import { World } from './world.js';
import { Viewer, atLocalTime, PLACES } from './viewer.js';
import { $ } from '../../kit/util.js';

export function initHero() {
  const world = new World();
  const now = daysSinceJ2000(Date.now());
  const wideCenter = (w, h) => (w > 900 ? [w * 0.64, h * 0.52] : [w * 0.5, h * 0.6]);
  const viewer = new Viewer($('hero-orrery'), {
    model: world, d: now, timeUI: false, hud: false, floor: 4.5, chipsEl: $('hero-views'), noteEl: $('hero-note'),
    views: [
      { id: 'inner', label: 'Inner planets', rate: 12, orbits: ['mercury', 'venus', 'earth', 'mars'], floor: { sun: 9, moon: 0 }, hideLabels: ['moon'], center: wideCenter,
        cam: { mode: 'orbit', target: 'sun', dist: 3.4 * AU, yaw: -100, pitch: 28, fov: 40 },
        enter: (v) => { const c = v.canvas; v.cam.dist = (c.clientWidth > c.clientHeight ? 3.4 : 5.2) * AU; } },
      { id: 'earthmoon', label: 'Earth & Moon', rate: 1, orbits: ['moon'], indicate: ['sun'], floor: 4, center: wideCenter,
        cam: { mode: 'orbit', target: 'earth', dist: 6.5e5, yaw: -70, pitch: 32, fov: 40 } },
      { id: 'sky', label: "Tonight's sky", rate: 1 / 24, floor: { moon: (a) => Math.min(a.w, a.h) * 0.035, sun: (a) => Math.min(a.w, a.h) * 0.03 },
        cam: { mode: 'ground', place: PLACES.ams, az: 180, alt: 25, fov: 80, follow: 'moon', _snap: true },
        time: (v) => {
          v.d = atLocalTime(daysSinceJ2000(Date.now()), PLACES.ams.lon, 21);
          // face the Moon if it's up tonight, otherwise look south
          const st = world.state(v.d), site = world.site(v.d, PLACES.ams.lat, PLACES.ams.lon, st.bodies.earth);
          const m = st.bodies.moon.pos, up = Math.sign(m[0] - site.pos[0]) * 0 + ((m[0] - site.pos[0]) * site.up[0] + (m[1] - site.pos[1]) * site.up[1] + (m[2] - site.pos[2]) * site.up[2]);
          v.cam.follow = up > 0 ? 'moon' : null;
        } },
    ],
  });
  const speeds = [[0, 'Paused'], [1, '1 day / s'], [12, '12 days / s'], [60, '2 months / s']];
  const btnSpeed = $('hero-speed');
  btnSpeed.addEventListener('click', () => {
    const i = (speeds.findIndex((s) => s[0] === viewer.rate) + 1) % speeds.length;
    viewer.setRate(speeds[i][0]); btnSpeed.textContent = speeds[i][1];
  });
  const btnScale = $('hero-scale');
  btnScale.addEventListener('click', () => { viewer.trueSizes = !viewer.trueSizes; btnScale.classList.toggle('on', viewer.trueSizes); });
  window.__hero = viewer;
}
