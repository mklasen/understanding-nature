// Chapter 1 — the Sun heats unevenly → pressure → wind. A live sea-breeze cell.
import { SeaBreeze, G, THETA0 } from './breeze-sim.js';
import { BreezeView } from './breeze-view.js';
import { visibleLoop, bindRange, $ } from '../../kit/util.js';

const SPEEDS = { slow: 600, normal: 1440, fast: 3600 }; // model seconds per real second

export function initBreeze() {
  const canvas = $('breeze-canvas');
  const sim = new SeaBreeze();
  sim.reset(7);
  const mobile = matchMedia('(max-width: 620px)').matches;
  const view = new BreezeView(canvas, sim, { motes: mobile ? 260 : 420 });
  let speed = SPEEDS.normal, playing = true, acc = 0;
  window.__breeze = { sim, view };

  bindRange($('breeze-sun'), (v) => {
    sim.sun = v;
    $('breeze-sun-out').textContent = v < 0.35 ? 'thick cloud' : v < 0.75 ? 'hazy sun' : v < 1.15 ? 'sunny' : 'blazing';
  });
  document.querySelectorAll('#breeze-speed button').forEach((b) => b.addEventListener('click', () => {
    document.querySelectorAll('#breeze-speed button').forEach((x) => x.classList.toggle('on', x === b));
    speed = SPEEDS[b.dataset.speed];
  }));
  const play = $('breeze-play');
  play.addEventListener('click', () => { playing = !playing; play.textContent = playing ? '❚❚' : '▶'; play.setAttribute('aria-label', playing ? 'Pause' : 'Play'); });
  $('breeze-dawn').addEventListener('click', () => { sim.reset(6); view.motes.length = 0; acc = 0; });
  $('breeze-temp').addEventListener('change', (e) => { view.showTemp = e.target.checked; });

  let lastRO = 0;
  function readouts() {
    const land = sim.tempAt(sim.coast + 25e3), sea = sim.tempAt(sim.coast - 25e3);
    $('breeze-land').textContent = `${land.toFixed(1)} °C`;
    $('breeze-sea').textContent = `${sea.toFixed(1)} °C`;
    const u = sim.coastWind(), v = sim.coastAlong();
    const spd = Math.hypot(u, v);
    $('breeze-wind').textContent = Math.abs(u) < 0.4 ? 'calm' : `${spd.toFixed(1)} m/s ${u > 0 ? 'off the sea' : 'off the land'}`;
    const p = sim.surfacePressure();
    const dp = (p[Math.round((sim.coast - 25e3) / sim.dx)] - p[Math.round((sim.coast + 25e3) / sim.dx)]) / 100;
    $('breeze-dp').textContent = Math.abs(dp) < 0.05 ? 'level' : `${dp > 0 ? 'H at sea' : 'H on land'} +${Math.abs(dp).toFixed(1)} hPa`;
    const hour = sim.clock / 3600, dT = land - sea;
    let why;
    if (sim.sun < 0.3 && hour > 7 && hour < 18) why = 'Under thick cloud the land barely warms, so there is hardly any temperature difference — and hardly any breeze. Overcast days at the coast are often still.';
    else if (u > 1 && dT > 0.5) why = `<span class="tag">Sea breeze</span>The land is <b>${dT.toFixed(1)} °C warmer</b> than the sea. Warm air over the land rises; cooler, denser sea air slides in underneath to replace it, and returns out to sea higher up.` + (sim.frontDistance() > 3e3 ? (sim.frontDistance() >= 54e3 ? ' The cool sea air has filled the <b>whole strip of land</b> in the picture.' : ` The cool sea air has pushed <b>${Math.round(sim.frontDistance() / 1000)} km</b> inland.`) : '');
    else if (u < -0.6) why = `<span class="tag">Land breeze</span>At night the land loses heat fast and the air above it cools below the sea's. Now the flow runs the other way — gentler, and shallower, because the cool layer is thin.`;
    else if (hour >= 6 && hour < 12) why = 'The Sun is up. Land warms quickly; the sea, which mixes heat deep down and has a huge heat capacity, hardly changes. Watch for the air to start moving…';
    else why = 'The temperatures are close to even, so the push is weak. The circulation is turning around.';
    $('breeze-why').innerHTML = why;
    $('breeze-aha').classList.toggle('lit', u > 1.5 || u < -0.8);
  }

  visibleLoop(canvas, (dt) => {
    if (playing) {
      acc += dt * speed;
      let n = 0;
      while (acc >= 40 && n < 6) { sim.step(40); acc -= 40; n++; }
      if (n === 6) acc = 0; // slow device: drop time rather than spiral
      view.advance(n * 40);
    }
    view.draw();
    const now = performance.now();
    if (now - lastRO > 250) { lastRO = now; readouts(); }
  });
}
