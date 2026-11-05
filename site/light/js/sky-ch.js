// Chapter 2 — why the sky is blue. The computed sky (Sun 35° up, looking mostly away from it)
// with a dial for how steeply scattering depends on colour (λ^-n; reality n = 4), and the
// spectrum of sunlight vs. the light the air scatters.
import { SkyScene } from './scene.js';
import { SUN, LAMBDA, wavelengthRGB, colourName, linToRGB, css } from './optics.js';
import { lum } from './sky.js';
import { fitCanvas, visibleLoop, bindRange, setRange, $ } from '../../kit/util.js';

export function initSkyChapter() {
  const canvas = $('sky-canvas');
  let n = 4, air = 1, refLum = 0, t = 0;
  const scene = new SkyScene({ horizon: 0.86, elTop: 64, sunX: 0.88, step: 5, coarse: 10, stars: false, seed: 3 });
  scene.setSun(35);
  const apply = () => { scene.setAir({ aod: 0.1, n, air }); };

  bindRange($('sky-n'), (v) => {
    n = v; air = 1; apply();
    $('sky-n-out').textContent = v === 0 ? 'not at all' : `1 / λ^${v.toFixed(1)}`;
    const r = Math.pow(650 / 450, v);
    $('sky-ratio').textContent = `${r < 10 ? r.toFixed(1) : Math.round(r)}×`;
    $('sky-moon').classList.remove('on');
    $('sky-real').classList.toggle('on', Math.abs(v - 4) < 0.05);
  });
  $('sky-real').addEventListener('click', () => setRange($('sky-n'), 4));
  $('sky-moon').addEventListener('click', () => {
    air = air ? 0 : 1; apply();
    $('sky-moon').classList.toggle('on', !air);
    $('sky-ratio').textContent = air ? $('sky-ratio').textContent : 'no air';
  });

  const lab = (ctx, s, x, y, a = 'left', c = 'rgba(237,240,247,0.8)') => { ctx.fillStyle = c; ctx.textAlign = a; ctx.fillText(s, x, y); };
  visibleLoop(canvas, (dt) => {
    t += dt;
    const { ctx, w, h } = fitCanvas(canvas);
    const sh = Math.round(h * 0.6);
    scene.update(w, sh);
    if (scene.takeFresh()) {
      const L = lum(scene.skyAvgLin);
      if (n === 4 && air) refLum = L;
      const name = air ? colourName(scene.skyAvgLin) : 'black';
      $('sky-col').innerHTML = `<span class="swatch" style="background:${css(linToRGB(scene.skyAvgLin, 1 / Math.max(...scene.skyAvgLin, 1e-9) * 0.8))}"></span>${name}`;
      $('sky-bright').textContent = !air ? 'none: black at noon' : refLum ? `${Math.round((L / refLum) * 100)}% of the real sky` : '–';
    }
    ctx.save();
    ctx.beginPath(); ctx.rect(0, 0, w, sh); ctx.clip();
    scene.draw(ctx, w, sh);
    ctx.restore();
    ctx.font = '11.5px ui-sans-serif, system-ui, sans-serif';
    lab(ctx, air ? (Math.abs(n - 4) < 0.05 ? 'Computed sky · real air · Sun 35° up' : `Thought experiment: scattering ∝ 1/λ^${n.toFixed(1)}`) : 'No atmosphere: nothing to scatter sunlight', 12, 20, 'left', 'rgba(255,255,255,0.9)');

    // spectrum chart
    const x0 = 44, x1 = w - 14, y0 = sh + 34, y1 = h - 28;
    ctx.fillStyle = '#13101f'; ctx.fillRect(0, sh, w, h - sh);
    const X = (l) => x0 + ((l - 400) / 300) * (x1 - x0);
    const sun = (l) => SUN[(l - 390) / 10];
    const sc = (l) => (air ? sun(l) * Math.pow(550 / l, n) : 0);
    let mx = 0; for (const l of LAMBDA) if (l >= 400 && l <= 700) mx = Math.max(mx, sc(l), sun(l));
    const Y = (v) => y1 - (v / mx) * (y1 - y0);
    // filled: scattered light, painted in its own colours
    for (let l = 400; l < 700; l += 10) {
      const c = wavelengthRGB(l + 5, 0.9);
      ctx.fillStyle = css(c, 0.85);
      const v = (sc(l) + sc(l + 10)) / 2;
      ctx.fillRect(X(l), Y(v), X(l + 10) - X(l) + 0.6, y1 - Y(v));
    }
    ctx.strokeStyle = 'rgba(255,255,255,0.85)'; ctx.setLineDash([5, 4]); ctx.lineWidth = 1.6;
    ctx.beginPath(); for (let l = 400; l <= 700; l += 10) l === 400 ? ctx.moveTo(X(l), Y(sun(l))) : ctx.lineTo(X(l), Y(sun(l))); ctx.stroke();
    ctx.setLineDash([]);
    ctx.strokeStyle = 'rgba(255,255,255,0.2)'; ctx.beginPath(); ctx.moveTo(x0, y1 + 0.5); ctx.lineTo(x1, y1 + 0.5); ctx.stroke();
    ctx.font = '11px ui-sans-serif, system-ui, sans-serif';
    for (const l of [400, 500, 600, 700]) lab(ctx, `${l} nm`, X(l), y1 + 15, l === 400 ? 'left' : l === 700 ? 'right' : 'center', 'rgba(174,182,204,0.75)');
    lab(ctx, '- - sunlight', x1, y0 - 14, 'right', 'rgba(255,255,255,0.85)');
    lab(ctx, '■ light scattered by the air', x1, y0 - 1, 'right', 'rgba(142,197,255,0.95)');
    lab(ctx, 'brightness →', 6, y0 - 6, 'left', 'rgba(174,182,204,0.6)');
  });
}
