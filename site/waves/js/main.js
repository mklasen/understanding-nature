import { Ocean } from './ocean-gl.js';
import { visibleLoop } from '../../kit/util.js';
import { bootChapters } from '../../kit/chapters.js';
import { initLibrary } from '../../kit/library.js';

initLibrary();

// hero: a mixed sea — local wind waves + a long swell from a distant storm
try {
  const canvas = document.getElementById('hero-ocean');
  const hero = new Ocean(canvas, { seed: 5 });
  hero.setSea({ Hs: 0.9, Tp: 5.2, U: 7, swell: { Hs: 1.3, Tp: 12.5, dir: -Math.PI / 2 + 0.35 } }, true);
  visibleLoop(canvas, () => {}, { onShow: () => hero.start(), onHide: () => hero.stop() });
  window.__hero = hero;
} catch (e) {
  console.warn('hero ocean failed', e);
}

bootChapters((f) => import(`./${f}`), [
  ['crowd.js', 'initCrowd'],
  ['wind.js', 'initWind'],
  ['energy.js', 'initEnergy'],
  ['swell.js', 'initSwell'],
  ['tsunami.js', 'initTsunami'],
  ['tides.js', 'initTides'],
  ['beach.js', 'initBeach'],
  ['ripples.js', 'initRipples'],
]);
