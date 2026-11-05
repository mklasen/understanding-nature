// Hero: the same sea-breeze model, full screen, running a little faster.
import { SeaBreeze } from './breeze-sim.js';
import { BreezeView } from './breeze-view.js';
import { visibleLoop, $ } from '../../kit/util.js';

export function initHero() {
  const canvas = $('hero-breeze');
  const sim = new SeaBreeze();
  sim.reset(8);
  for (let i = 0; i < 120; i++) sim.step(40); // ~80 min of spin-up so the breeze is already going
  const mobile = matchMedia('(max-width: 620px)').matches;
  // portrait phones: a narrower, lower window so the breeze isn't hidden under the headline
  const view = mobile
    ? new BreezeView(canvas, sim, { motes: 320, labels: false, ground: 0.3, window: [-22e3, 26e3], zTop: 1500 })
    : new BreezeView(canvas, sim, { motes: 650, labels: false, ground: 0.12, window: [-40e3, 50e3], zTop: 1800 });
  for (let i = 0; i < 12; i++) view.advance(40);
  let acc = 0, lastCap = 0;
  window.__hero = { sim, view };
  visibleLoop(canvas, (dt) => {
    acc += dt * 2400;
    let n = 0;
    while (acc >= 40 && n < 5) { sim.step(40); acc -= 40; n++; }
    if (n === 5) acc = 0;
    view.advance(n * 40);
    view.draw();
    const now = performance.now();
    if (now - lastCap > 400) {
      lastCap = now;
      const hh = Math.floor(sim.clock / 3600), mm = Math.floor((sim.clock % 3600) / 600) * 10;
      const u = sim.coastWind();
      const what = u > 0.8 ? `sea breeze, ${u.toFixed(1)} m/s` : u < -0.6 ? `land breeze, ${(-u).toFixed(1)} m/s` : 'the air is turning around';
      $('hero-clock').textContent = `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')} · ${what}`;
    }
  });
}
