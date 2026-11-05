// Hero: move the Sun. A computed sky over a landscape, from noon blue to dusk.
import { SkyScene } from './scene.js';
import { airMass } from './sky.js';
import { fitCanvas, visibleLoop, bindRange, setRange, $ } from '../../kit/util.js';

export function initHero() {
  const canvas = $('hero-sky');
  const input = $('hero-sun');
  const mobile = () => canvas.clientWidth < 700;
  const scene = new SkyScene({ horizon: 0.74, elTop: 58, sunX: 0.46, coarse: 14, step: 6 });
  scene.setAir({ aod: 0.06 }); // clean country air
  let playing = false;
  const pct = (x) => (x >= 0.1 ? `${Math.round(x * 100)}%` : x >= 0.001 ? `${(x * 100).toFixed(1)}%` : 'almost none');

  const layout = () => {
    const m = mobile();
    Object.assign(scene.o, m ? { horizon: 0.6, elTop: 64, sunX: 0.62, step: 5, coarse: 10 } : { horizon: 0.74, elTop: 58, sunX: 0.46, step: 6, coarse: 14 });
  };
  layout();

  bindRange(input, (v) => {
    scene.setSun(v);
    $('hero-sun-out').textContent = `${v.toFixed(v < 10 && v > -10 ? 1 : 0)}°`;
    readout(v);
  });
  function readout(e) {
    const el = $('hero-read');
    if (e < -0.6) {
      el.innerHTML = e > -6 ? 'The Sun has set, but it still lights the air <b>high above you</b>. That glow is twilight.' : 'Deep twilight: only the highest air is still in sunlight. The stars come out.';
      return;
    }
    const T = scene.sky.sunTransmit(e);
    const blue = T[3], red = T[13]; // 450 nm, 650 nm
    const m = airMass(Math.max(e, 0));
    el.innerHTML = `Sunlight crosses <b>${m < 10 ? m.toFixed(1) : Math.round(m)}×</b> as much air as from overhead. <b>${pct(blue)}</b> of its blue and <b>${pct(red)}</b> of its red get through.`;
  }

  $('hero-play').addEventListener('click', () => {
    playing = !playing;
    $('hero-play').textContent = playing ? '❚❚ Pause' : '▶ Play a sunset';
    if (playing && parseFloat(input.value) < -7) setRange(input, 25);
  });

  // mouse users can drag the Sun directly (touch keeps vertical scrolling)
  let drag = false;
  const toEl = (ev) => {
    const r = canvas.getBoundingClientRect();
    const G = scene.geom(r.width, r.height);
    return (G.yh - (ev.clientY - r.top)) * G.dpp;
  };
  canvas.addEventListener('pointerdown', (ev) => { if (ev.pointerType !== 'mouse') return; drag = true; canvas.setPointerCapture(ev.pointerId); setRange(input, Math.max(-8, Math.min(55, toEl(ev)))); });
  canvas.addEventListener('pointermove', (ev) => { if (drag) setRange(input, Math.max(-8, Math.min(55, toEl(ev)))); });
  canvas.addEventListener('pointerup', () => { drag = false; });

  let lastW = 0;
  const frame = (dt) => {
    if (playing) {
      const v = parseFloat(input.value);
      // slow down near the horizon, where all the action is
      const rate = v > 12 ? 4 : v > 3 ? 1.6 : 0.8;
      const nv = v - rate * dt;
      if (nv < -8) { playing = false; $('hero-play').textContent = '▶ Play a sunset'; }
      else setRange(input, nv);
    }
    const { ctx, w, h } = fitCanvas(canvas);
    if (w !== lastW) { lastW = w; layout(); scene.invalidate(); }
    scene.update(w, h);
    scene.draw(ctx, w, h);
  };
  visibleLoop(canvas, frame);
  window.__hero = { scene, set: (v) => setRange(input, v) };
}
