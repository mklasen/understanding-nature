// Chapter 7 — retrograde motion, in the shared world. Real Earth and Mars (incl. Mars's 1.85° tilt).
// Three viewpoints: from above (the overtaking), Mars in Earth's sky (the loop among real constellations),
// and Mars seen from the Sun (no loop at all).
import { AU, TAU, daysSinceJ2000, dateFromJ2000, fmtDate } from './astro.js';
import { World } from './world.js';
import { Viewer } from './viewer.js';
import { v3, label } from './draw.js';
import { $ } from '../../kit/util.js';

const wrap = (a) => { a = (a + Math.PI) % TAU; if (a < 0) a += TAU; return a - Math.PI; };

export function initRetrograde() {
  const world = new World({ bodies: ['sun', 'earth', 'mars'] });
  const lon = (v) => Math.atan2(v[1], v[0]);
  const seen = (d, from) => v3.sub(world.pos('mars', d), from === 'sun' ? [0, 0, 0] : world.pos('earth', d));
  const minWH = (a) => Math.min(a.w, a.h);
  let nextOpp = null, acc = 1;

  function findNextOpposition(from) {
    const f = (t) => wrap(lon(world.pos('mars', t)) - lon(world.pos('earth', t)));
    let prev = f(from);
    for (let t = from + 4; t < from + 820; t += 4) {
      const v = f(t);
      if (prev > 0 && v <= 0 && prev - v < 1) {
        let a = t - 4, b = t;
        for (let i = 0; i < 20; i++) { const mid = (a + b) / 2; if (f(mid) > 0) a = mid; else b = mid; }
        return (a + b) / 2;
      }
      prev = v;
    }
    return null;
  }

  // ---- overlays
  const sightLine = (a) => { // from Earth through Mars, out to the distant stars; plus where it has pointed lately
    const { ctx, project } = a;
    const RS = 2.7 * AU;
    for (let t = a.d - 300; t < a.d; t += 3) {
      const p1 = v3.mul(v3.norm(seen(t, 'earth')), RS), p2 = v3.mul(v3.norm(seen(t + 3, 'earth')), RS);
      const q1 = project(v3.add(world.pos('earth', t), p1)), q2 = project(v3.add(world.pos('earth', t + 3), p2));
      if (!q1 || !q2) continue;
      const back = wrap(lon(p2) - lon(p1)) < 0;
      ctx.strokeStyle = back ? 'rgba(255,90,60,0.95)' : 'rgba(255,138,92,0.35)'; ctx.lineWidth = back ? 4 : 2.5;
      ctx.beginPath(); ctx.moveTo(q1.x, q1.y); ctx.lineTo(q2.x, q2.y); ctx.stroke();
    }
    const E = world.pos('earth', a.d), dir = v3.norm(seen(a.d, 'earth'));
    const pe = project(E), pf = project(v3.add(E, v3.mul(dir, RS)));
    if (pe && pf) {
      ctx.strokeStyle = 'rgba(255,255,255,0.55)'; ctx.lineWidth = 1.2; ctx.setLineDash([4, 4]);
      ctx.beginPath(); ctx.moveTo(pe.x, pe.y); ctx.lineTo(pf.x, pf.y); ctx.stroke(); ctx.setLineDash([]);
      label(ctx, 'line of sight', pf.x, pf.y - 10, { align: 'center', size: 10.5, color: 'rgba(237,240,247,0.7)' });
    }
  };
  const skyTrail = (from) => (a) => { // Mars's track across the sky over the last 13 months
    const { ctx, projectDir } = a;
    let prev = null, prevV = null;
    for (let t = a.d - 400; t <= a.d; t += 2) {
      const v = v3.norm(seen(t, from)), p = projectDir(v);
      if (p && prev && Math.hypot(p.x - prev.x, p.y - prev.y) < a.w / 3) {
        const back = wrap(lon(v) - lon(prevV)) < 0, age = (a.d - t) / 400;
        ctx.strokeStyle = back ? `rgba(255,90,60,${(1 - age * 0.7).toFixed(2)})` : `rgba(255,138,92,${(0.8 - age * 0.55).toFixed(2)})`;
        ctx.lineWidth = back ? 3 : 2; ctx.beginPath(); ctx.moveTo(prev.x, prev.y); ctx.lineTo(p.x, p.y); ctx.stroke();
      }
      prev = p; prevV = v;
    }
  };

  const viewer = new Viewer($('retro-canvas'), {
    model: world, d: daysSinceJ2000(Date.now()),
    rates: [[0, 'Paused'], [3, '3 days/s'], [10, '10 days/s'], [22, '3 weeks/s']],
    views: [
      { id: 'above', label: 'From above', rate: 22, orbits: ['earth', 'mars'], floor: { sun: (a) => minWH(a) * 0.03, earth: 5, mars: 5 },
        cam: { mode: 'orbit', target: 'sun', dist: 7.6 * AU, yaw: -90, pitch: 70, fov: 40 }, under: sightLine },
      { id: 'sky', label: "Mars in Earth's sky", rate: 10, floor: { mars: 4, sun: 8 },
        cam: { mode: 'look', from: 'earth', lon: 0, lat: 0, fov: 60, follow: 'mars', _snap: true }, under: skyTrail('earth'),
        note: () => 'Looking out from Earth (without the ground), following Mars against the real constellations.' },
      { id: 'sunsky', label: 'Seen from the Sun', rate: 10, floor: { mars: 4, earth: 4 },
        cam: { mode: 'look', from: 'sun', lon: 0, lat: 0, fov: 60, follow: 'mars', _snap: true }, under: skyTrail('sun'),
        note: () => 'The same Mars, watched from the Sun: always forwards.' },
    ],
    onTick: (dt, v) => {
      if ((acc += dt) < 0.2) return; acc = 0;
      const from = v.cam.mode === 'look' && v.cam.from === 'sun' ? 'sun' : 'earth';
      const back = wrap(lon(seen(v.d, from)) - lon(seen(v.d - 1, from))) < 0;
      $('retro-dir').textContent = back ? 'Backwards!' : 'Forwards';
      $('retro-dir').style.color = back ? '#ff8a5c' : '';
      $('retro-dist').textContent = `${Math.round(v3.len(seen(v.d, 'earth')) / 1e6)} M km`;
      if (!nextOpp || nextOpp < v.d) nextOpp = findNextOpposition(v.d);
      $('retro-next').textContent = nextOpp ? fmtDate(dateFromJ2000(nextOpp)) : '—';
    },
  });
  window.__retro = { viewer, world, findNextOpposition };
}
