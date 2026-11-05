import { bootChapters } from '../../kit/chapters.js';
import { initLibrary } from '../../kit/library.js';

initLibrary();
bootChapters((f) => import(`./${f}`), [
  ['hero.js', 'initHero'],
  ['spectrum.js', 'initSpectrum'],
  ['sky-ch.js', 'initSkyChapter'],
  ['sunset.js', 'initSunset'],
  ['clouds.js', 'initClouds'],
  ['rainbow.js', 'initRainbow'],
  ['sea.js', 'initSea'],
  ['films.js', 'initFilms'],
  ['cones.js', 'initCones'],
]);
