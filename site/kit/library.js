// Library chrome shared by every explainer page:
//  · a "◂ Understanding Nature" home link at the start of the chapter bar
//  · cross-link chips:  <a class="xlink" data-x="orbits#moon">The Moon raises them</a>
//    → links to that explainer/chapter if live, or shows "coming soon" if not
//  · a "More from Understanding Nature" footer built from the catalogue
// Expects <body data-explainer="waves" data-root="../">.
import { EXPLAINERS, CATEGORIES, XLINKS, byId } from './catalog.js';

const THEME_ACCENT = { ocean: '#3fb3c9', space: '#f5b95a', sky: '#8ec5ff', light: '#ff9f6b' };

export function initLibrary() {
  const body = document.body;
  const here = body.dataset.explainer;
  const root = body.dataset.root || '../';

  const toc = document.querySelector('.toc');
  if (toc && !toc.querySelector('.home')) toc.insertAdjacentHTML('afterbegin', `<a class="home" href="${root}">Understanding Nature</a>`);

  for (const l of XLINKS.filter((l) => l.from === here)) {
    const text = document.querySelector(`#${l.chapter} .text`);
    if (text) text.insertAdjacentHTML('beforeend', `<p class="xnote"><a class="xlink" data-x="${l.x}">${l.text}</a></p>`);
  }

  document.querySelectorAll('a.xlink[data-x]').forEach((a) => {
    const [id, ch] = a.dataset.x.split('#');
    const e = byId(id);
    if (!e) return;
    const where = e.short + (ch && e.chapters && e.chapters[ch] ? ` · ${e.chapters[ch]}` : '');
    const text = a.innerHTML.trim();
    a.innerHTML = `${text ? `<span class="x-text">${text}</span>` : ''}<span class="x-where">${where}</span>`;
    if (THEME_ACCENT[e.theme]) a.style.setProperty('--x-accent', THEME_ACCENT[e.theme]);
    if (e.status === 'live') a.href = root + e.path + (ch ? `#${ch}` : '');
    else { a.classList.add('soon'); a.removeAttribute('href'); a.title = 'This explainer is still being built'; }
  });

  if (!document.querySelector('.more')) {
    const me = byId(here);
    const rank = (e) => (e.status === 'live' ? 0 : e.status === 'building' ? 1 : 2) + (me && e.category === me.category ? -0.5 : 0);
    const others = EXPLAINERS.filter((e) => e.id !== here).sort((a, b) => rank(a) - rank(b)).slice(0, 6);
    const cat = (id) => (CATEGORIES.find((c) => c.id === id) || {}).name || '';
    const card = (e) => e.status === 'live'
      ? `<a class="more-card" href="${root}${e.path}"><span class="mc-cat">${cat(e.category)}</span><span class="mc-title">${e.title.replace('Understanding ', '')}</span><span class="mc-hook">${e.hook}</span></a>`
      : `<div class="more-card soon"><span class="mc-cat">${cat(e.category)}</span><span class="mc-title">${e.title.replace('Understanding ', '')}</span><span class="mc-hook">${e.hook}</span><span class="mc-soon">${e.status === 'building' ? 'Being built now' : 'Planned'}</span></div>`;
    const html = `<section class="more" aria-label="More explainers"><h2>More from Understanding Nature</h2><p>A growing library of interactive explainers about how the natural world works.</p><div class="more-grid">${others.map(card).join('')}</div></section>
      <p class="lib-foot"><a href="${root}">Understanding Nature</a> · interactive explainers, made to be played with</p>`;
    (document.querySelector('main') || body).insertAdjacentHTML('afterend', html);
  }
}
