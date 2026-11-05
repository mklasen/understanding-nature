// Landing page: category filters + explainer grid (from the catalogue), and a quiet
// "sea meets sky" hero — stars and a Moon above, a horizon of superposed waves below.
import { EXPLAINERS, CATEGORIES } from './kit/catalog.js';
import { fitCanvas, visibleLoop } from './kit/util.js';

const ACCENT = { ocean: '#3fb3c9', space: '#f5b95a', sky: '#8ec5ff', light: '#ff9f6b' };
const CAT_ACCENT = { earth: '#3fb3c9', space: '#f5b95a', weather: '#8ec5ff', light: '#ff9f6b', life: '#9fd8a5' };
const GEN_ART = {
  earth: 'radial-gradient(120% 90% at 80% 10%, #1e6f8a 0%, #0b2a3d 55%, #06131f 100%)',
  space: 'radial-gradient(90% 90% at 75% 30%, #3a2a5a 0%, #121433 45%, #05070f 100%)',
  weather: 'linear-gradient(180deg, #4d7fb3 0%, #9cb9d6 55%, #dfe7ee 100%)',
  light: 'linear-gradient(180deg, #1b1446 0%, #b2456e 55%, #ffb26b 100%)',
  life: 'radial-gradient(120% 90% at 30% 20%, #3f7a4a 0%, #16301d 60%, #0a140d 100%)',
};
const STATUS_RANK = { live: 0, building: 1, planned: 2 };

const catName = (id) => (CATEGORIES.find((c) => c.id === id) || {}).name || '';
const chapterCount = (e) => (e.chapters ? Object.keys(e.chapters).length : 0);

function tile(e) {
  const accent = ACCENT[e.theme] || CAT_ACCENT[e.category];
  const art = e.image
    ? `<div class="art" style="background-image:url('${e.image}'), ${GEN_ART[e.category]}"></div>`
    : `<div class="art gen" style="--gen:${GEN_ART[e.category]}"><span>${e.short}</span></div>`;
  const inner = `${art}<div class="body">
      <span class="cat">${catName(e.category)}</span>
      <h2>${e.title.replace('Understanding ', '')}</h2>
      <p class="hook">${e.hook}</p>
      <p class="blurb">${e.blurb}</p>
      <div class="meta">${e.status === 'live'
        ? `<span>${chapterCount(e)} interactive chapters</span><span class="go">Explore →</span>`
        : `<span class="badge ${e.status}">${e.status === 'building' ? 'Being built' : 'Planned'}</span>`}</div>
    </div>`;
  const style = `style="--t-accent:${accent}"`;
  return e.status === 'live'
    ? `<a class="tile live" href="${e.path}" data-cat="${e.category}" ${style}>${inner}</a>`
    : `<div class="tile ${e.status === 'building' ? 'soon' : 'planned'}" data-cat="${e.category}" ${style}>${inner}</div>`;
}

function renderGrid(cat) {
  const list = EXPLAINERS.filter((e) => cat === 'all' || e.category === cat)
    .sort((a, b) => STATUS_RANK[a.status] - STATUS_RANK[b.status]);
  document.getElementById('grid').innerHTML = list.map(tile).join('');
}

function renderFilters() {
  const el = document.getElementById('filters');
  const count = (id) => EXPLAINERS.filter((e) => id === 'all' || e.category === id).length;
  const btn = (id, name) => `<button role="tab" data-cat="${id}" class="${id === 'all' ? 'on' : ''}">${name}<span class="n">${count(id)}</span></button>`;
  el.innerHTML = btn('all', 'All') + CATEGORIES.filter((c) => count(c.id)).map((c) => btn(c.id, c.name)).join('');
  el.addEventListener('click', (ev) => {
    const b = ev.target.closest('button');
    if (!b) return;
    el.querySelectorAll('button').forEach((x) => x.classList.toggle('on', x === b));
    renderGrid(b.dataset.cat);
  });
}

function hero() {
  const canvas = document.getElementById('lhero-canvas');
  const stars = Array.from({ length: 220 }, () => [Math.random(), Math.random() * 0.62, Math.random(), Math.random() * 6.28]);
  const waves = Array.from({ length: 7 }, (_, i) => ({ k: 0.004 + i * 0.0023 + Math.random() * 0.002, w: 0.25 + Math.random() * 0.5, a: 6 / (1 + i * 0.6), p: Math.random() * 6.28 }));
  let t = 0;
  visibleLoop(canvas, (dt) => {
    t += dt;
    const { ctx, w, h } = fitCanvas(canvas);
    const horizon = h * 0.64;
    const sky = ctx.createLinearGradient(0, 0, 0, horizon);
    sky.addColorStop(0, '#04060d'); sky.addColorStop(0.7, '#0c1830'); sky.addColorStop(1, '#1d3550');
    ctx.fillStyle = sky; ctx.fillRect(0, 0, w, horizon + 1);
    for (const [x, y, b, ph] of stars) {
      const tw = 0.55 + 0.45 * Math.sin(t * (0.6 + b) + ph);
      ctx.fillStyle = `rgba(232,238,255,${(0.25 + b * 0.6) * tw})`;
      ctx.fillRect(x * w, y * h, b > 0.85 ? 1.8 : 1.1, b > 0.85 ? 1.8 : 1.1);
    }
    // the Moon, and its path of light on the water
    const mx = w * 0.76, my = h * 0.24, mr = Math.max(16, Math.min(w, h) * 0.035);
    const glow = ctx.createRadialGradient(mx, my, mr * 0.6, mx, my, mr * 7);
    glow.addColorStop(0, 'rgba(220,230,255,0.25)'); glow.addColorStop(1, 'rgba(220,230,255,0)');
    ctx.fillStyle = glow; ctx.fillRect(mx - mr * 7, my - mr * 7, mr * 14, mr * 14);
    ctx.fillStyle = '#e8ecf8'; ctx.beginPath(); ctx.arc(mx, my, mr, 0, 6.283); ctx.fill();
    ctx.fillStyle = 'rgba(160,170,200,0.35)';
    [[-0.3, -0.2, 0.22], [0.25, 0.15, 0.17], [-0.05, 0.38, 0.12]].forEach(([dx, dy, r]) => { ctx.beginPath(); ctx.arc(mx + dx * mr, my + dy * mr, r * mr, 0, 6.283); ctx.fill(); });
    // the sea: rows of superposed waves, receding to the horizon
    const sea = ctx.createLinearGradient(0, horizon, 0, h);
    sea.addColorStop(0, '#16304a'); sea.addColorStop(1, '#050b14');
    ctx.fillStyle = sea; ctx.fillRect(0, horizon, w, h - horizon);
    const rows = 26;
    for (let r = 0; r < rows; r++) {
      const f = r / (rows - 1);                       // 0 = horizon, 1 = foreground
      const y0 = horizon + Math.pow(f, 1.8) * (h - horizon) * 1.02;
      const amp = 0.4 + f * f * 2.2;
      ctx.beginPath();
      for (let x = 0; x <= w; x += 6) {
        let y = 0;
        for (const wv of waves) y += wv.a * Math.sin(x * wv.k / (0.3 + f) + t * wv.w + wv.p + r * 1.7);
        ctx.lineTo(x, y0 + y * amp * 0.35);
      }
      const nearMoon = 1;
      ctx.strokeStyle = `rgba(160,200,230,${0.05 + f * 0.18})`;
      ctx.lineWidth = 0.6 + f * 1.2;
      ctx.stroke();
      // moonlight glints on this row
      const gx = mx + Math.sin(t * 0.7 + r) * (8 + f * 60);
      const gw = 6 + f * 70;
      const gl = ctx.createLinearGradient(gx - gw, 0, gx + gw, 0);
      gl.addColorStop(0, 'rgba(230,238,255,0)'); gl.addColorStop(0.5, `rgba(230,238,255,${0.12 + 0.35 * (1 - f) * nearMoon})`); gl.addColorStop(1, 'rgba(230,238,255,0)');
      ctx.strokeStyle = gl; ctx.lineWidth = 1 + f * 1.5;
      ctx.beginPath(); ctx.moveTo(gx - gw, y0 + Math.sin(t + r) * amp); ctx.lineTo(gx + gw, y0 + Math.sin(t * 1.3 + r) * amp); ctx.stroke();
    }
  });
}

renderFilters();
renderGrid('all');
hero();
