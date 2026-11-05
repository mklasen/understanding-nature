import { bootChapters } from '../../kit/chapters.js';
import { initLibrary } from '../../kit/library.js';

initLibrary();

bootChapters((f) => import(`./${f}`), [
  ['hero.js', 'initHero'],
  ['breeze.js', 'initBreeze'],
  ['pressure.js', 'initPressure'],
  ['spin.js', 'initSpin'],
  ['friction.js', 'initFriction'],
  ['clouds.js', 'initClouds'],
  ['fronts.js', 'initFronts'],
  ['global.js', 'initGlobal'],
]);
