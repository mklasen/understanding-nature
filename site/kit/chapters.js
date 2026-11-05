// Chapter loader shared by every explainer.
// Each chapter is its own ES module, loaded in isolation so one failure can't take
// the page down. Errors are collected on window.__chapterErrors for QA.
//
//   bootChapters((f) => import(`./${f}`), [['hero.js', 'initHero'], ['day.js', 'initDay'], …]);
//
// If any section declares data-module="file.js", only chapters present on the page load
// (handy for test pages); the hero always loads.
export function bootChapters(load, list) {
  window.__chapterErrors = window.__chapterErrors || {};
  const marked = !!document.querySelector('[data-module]');
  for (const [file, fn] of list) {
    if (marked && fn !== 'initHero' && !document.querySelector(`[data-module="${file}"]`)) continue;
    load(file)
      .then((m) => m[fn]())
      .catch((e) => { window.__chapterErrors[file] = String((e && e.stack) || e); console.warn(`chapter ${file} failed:`, e); });
  }
  highlightToc();
  lightAhas();
}

// highlight the chapter currently in view in the sticky table of contents
function highlightToc() {
  const links = [...document.querySelectorAll('.toc a:not(.home)')];
  const io = new IntersectionObserver((entries) => {
    for (const e of entries) {
      if (!e.isIntersecting) continue;
      links.forEach((a) => a.classList.toggle('active', a.getAttribute('href') === `#${e.target.id}`));
    }
  }, { rootMargin: '-45% 0px -50% 0px' });
  document.querySelectorAll('main > section').forEach((s) => io.observe(s));
}

// "aha" boxes light up once a chapter has been interacted with
function lightAhas() {
  document.querySelectorAll('.chapter').forEach((sec) => {
    const aha = sec.querySelector('.aha');
    if (!aha) return;
    const lit = () => aha.classList.add('lit');
    sec.querySelectorAll('input, button').forEach((el) => el.addEventListener(el.tagName === 'INPUT' ? 'input' : 'click', lit, { once: true }));
  });
}
