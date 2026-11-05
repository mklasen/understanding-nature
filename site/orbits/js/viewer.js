// The Viewer: one interactive environment for every chapter.
// - Renders any model with state(d) → { bodies: { id: { pos (km), r (km), frame?, color, name } } } in true perspective.
// - Three camera modes: 'orbit' (around a body), 'ground' (standing on Earth), 'look' (from a body's centre, no horizon).
// - Same controls everywhere: drag to orbit / look around, pinch · ctrl-wheel · +/− to zoom, tap a body to fly to it,
//   view chips for guided viewpoints (with smooth flights between them), a shared time bar, true-size toggle.
// - Honest scale: positions are always true. Bodies are only enlarged to stay visible (or by an explicit, labelled
//   per-view boost), and the note under the canvas says by how much.
import { DEG, TAU, TILT, DAY, fmtDate, dateFromJ2000, daysSinceJ2000 } from './astro.js';
import { v3, label } from './draw.js';
import { drawSphere, drawSunDisc, TEX } from './render.js';
import { STARS, LINES, NAMES } from './stars.js';
import { fitCanvas, visibleLoop, $ } from '../../kit/util.js';

// ---- the sky: J2000 equatorial → ecliptic unit vectors (fixed, at infinity)
const EPS = TILT * DEG, CE = Math.cos(EPS), SE = Math.sin(EPS);
const eq2ecl = (ra, dec) => {
  const x = Math.cos(dec * DEG) * Math.cos(ra * DEG), y = Math.cos(dec * DEG) * Math.sin(ra * DEG), z = Math.sin(dec * DEG);
  return [x, y * CE + z * SE, -y * SE + z * CE];
};
const SKY = [];
for (let i = 0; i < STARS.length; i += 4) {
  const bv = STARS[i + 3], m = STARS[i + 2];
  const t = Math.max(0, Math.min(1, (bv + 0.2) / 1.9));
  SKY.push({ v: eq2ecl(STARS[i], STARS[i + 1]), a: Math.max(0.12, Math.min(1, (5.6 - m) / 4.6)), s: Math.max(0.7, 2.6 - m * 0.42), c: [Math.round(200 + 55 * t), Math.round(215 + 20 * (1 - Math.abs(t - 0.4))), Math.round(255 - 120 * t)] });
}
const CLINES = LINES.map((seg) => { const out = []; for (let i = 0; i < seg.length; i += 2) out.push(eq2ecl(seg[i], seg[i + 1])); return out; });
const CNAMES = NAMES.filter((n) => n[3] <= 1).map((n) => ({ name: n[0], v: eq2ecl(n[1], n[2]) }));

const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const nlerp = (a, b, t) => { let v = v3.add(v3.mul(a, 1 - t), v3.mul(b, t)); if (v3.len(v) < 1e-6) v = v3.add(v, [1e-3, 2e-3, 3e-3]); return v3.norm(v); };
const dirFrom = (yaw, pitch) => [Math.cos(pitch * DEG) * Math.cos(yaw * DEG), Math.cos(pitch * DEG) * Math.sin(yaw * DEG), Math.sin(pitch * DEG)];
const COMPASS = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
const clock = (h) => { h = ((h % 24) + 24) % 24; const hh = Math.floor(h), mm = Math.floor((h - hh) * 60); return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`; };

export class Viewer {
  constructor(canvas, cfg) {
    this.canvas = canvas;
    this.cfg = Object.assign({ floor: 3, timeUI: true, scaleToggle: true, rates: [[0, 'Paused'], [1 / 24, '1 h/s'], [1, '1 day/s'], [12, '12 days/s']] }, cfg);
    this.model = cfg.model;
    this.d = cfg.d ?? daysSinceJ2000(Date.now());
    this.rate = 0; this.playing = true;
    this.trueSizes = false;
    this.hits = []; this.drawn = {};
    this.views = cfg.views;
    this.cam = null; this.view = null; this.trans = null;
    this.buildUI();
    this.setView(cfg.start || this.views[0].id, { instant: true });
    this.bindInput();
    visibleLoop(canvas, (dt) => this.tick(dt), { onShow: () => cfg.onShow && cfg.onShow(this) });
  }

  // ---------------- views & camera
  setView(id, { instant = false, keepTime = false } = {}) {
    const v = this.views.find((x) => x.id === id) || this.views[0];
    const from = this.pose;
    this.view = v;
    this.cam = JSON.parse(JSON.stringify(v.cam));
    if (v.cam.target && typeof v.cam.target === 'function') this.cam.target = v.cam.target;
    if (!keepTime && v.time) v.time(this);
    if (v.rate != null) this.setRate(v.rate);
    this.trans = instant || !from ? null : { from, t: 0, dur: v.flight ?? 1.4 };
    if (this.chips) this.chips.querySelectorAll('button').forEach((b) => b.classList.toggle('on', b.dataset.view === v.id));
    v.enter && v.enter(this);
    this.cfg.onView && this.cfg.onView(v, this);
  }
  flyTo(cam) { const from = this.pose; this.cam = Object.assign({}, this.cam, cam); this.trans = from ? { from, t: 0, dur: 1.4 } : null; }
  targetPos(st, t) {
    if (typeof t === 'function') return t(st, this);
    if (Array.isArray(t)) return t;
    return st.bodies[t]?.pos || [0, 0, 0];
  }
  computePose(st) {
    const c = this.cam;
    if (c.mode === 'ground') {
      const E = st.bodies.earth;
      const site = this.model.site(this.d, c.place.lat, c.place.lon, E);
      if (c.follow && st.bodies[c.follow]) {
        const p = v3.norm(v3.sub(st.bodies[c.follow].pos, site.pos));
        const alt = Math.asin(v3.dot(p, site.up)), az = Math.atan2(v3.dot(p, site.east), v3.dot(p, site.north));
        c.az = c.az + ((((az / DEG - c.az) % 360) + 540) % 360 - 180) * (c._snap ? 1 : 0.12);
        const want = alt < 0 ? 12 : Math.max(8, Math.min(75, (alt / DEG) * 0.8 + 3));
        c.alt += (want - c.alt) * (c._snap ? 1 : 0.12);
        c._snap = false;
      }
      const f = v3.add(v3.add(v3.mul(site.north, Math.cos(c.alt * DEG) * Math.cos(c.az * DEG)), v3.mul(site.east, Math.cos(c.alt * DEG) * Math.sin(c.az * DEG))), v3.mul(site.up, Math.sin(c.alt * DEG)));
      const eye = v3.add(site.pos, v3.mul(site.up, 0.002));
      return { mode: 'ground', target: v3.add(eye, v3.mul(f, 0.001)), dir: v3.mul(f, -1), dist: 0.001, up: site.up, fov: c.fov * DEG, site };
    }
    if (c.mode === 'look') {
      const from = this.targetPos(st, c.from);
      if (c.follow && st.bodies[c.follow]) {
        const p = v3.norm(v3.sub(st.bodies[c.follow].pos, from));
        const lon = Math.atan2(p[1], p[0]) / DEG, lat = Math.asin(p[2]) / DEG;
        c.lon += ((((lon - c.lon) % 360) + 540) % 360 - 180) * (c._snap ? 1 : 0.15); c.lat += (lat - c.lat) * (c._snap ? 1 : 0.15); c._snap = false;
      }
      const f = dirFrom(c.lon, c.lat);
      return { mode: 'look', target: v3.add(from, v3.mul(f, 0.001)), dir: v3.mul(f, -1), dist: 0.001, up: [0, 0, 1], fov: c.fov * DEG, eyeBody: c.from };
    }
    const target = this.targetPos(st, c.target);
    // sunLocked: yaw is measured from the direction of the Sun as seen from the target (camera keeps its angle to the light)
    const yaw = c.sunLocked ? c.yaw + Math.atan2(-target[1], -target[0]) / DEG : c.yaw;
    return { mode: 'orbit', target, dir: dirFrom(yaw, c.pitch), dist: c.dist, up: c.up || [0, 0, 1], fov: (c.fov || 40) * DEG };
  }
  blend(a, b, t) {
    if (!a) return b;
    return {
      mode: t < 0.82 ? (a.mode === 'orbit' ? 'orbit' : b.mode === 'orbit' ? 'orbit' : b.mode) : b.mode,
      target: v3.add(v3.mul(a.target, 1 - t), v3.mul(b.target, t)),
      dir: nlerp(a.dir, b.dir, t), up: nlerp(a.up, b.up, t),
      dist: Math.exp(Math.log(a.dist) * (1 - t) + Math.log(b.dist) * t),
      fov: a.fov + (b.fov - a.fov) * t, site: b.site, eyeBody: b.eyeBody,
    };
  }

  // ---------------- per frame
  tick(dt) {
    if (this.playing) this.d += dt * this.rate;
    this.cfg.onTick && this.cfg.onTick(dt, this);
    const st = this.model.state(this.d);
    this.state = st;
    let pose = this.computePose(st);
    if (this.trans) {
      this.trans.t += dt / this.trans.dur;
      if (this.trans.t >= 1) this.trans = null; else pose = this.blend(this.trans.from, pose, ease(this.trans.t));
    }
    this.pose = pose;
    this.render(st, pose);
    this.updateTimeUI();
  }

  basis(pose) {
    const eye = v3.add(pose.target, v3.mul(pose.dir, pose.dist));
    const f = v3.mul(pose.dir, -1);
    let r = v3.cross(f, pose.up);
    if (v3.len(r) < 1e-6) r = v3.cross(f, [0, 1, 0]);
    r = v3.norm(r);
    const u = v3.cross(r, f);
    return { eye, f, r, u };
  }

  render(st, pose) {
    const { ctx, w, h } = fitCanvas(this.canvas);
    const B = this.basis(pose);
    const F = (Math.min(w, h) / 2) / Math.tan(pose.fov / 2);
    const [cx, cy] = this.view.center ? this.view.center(w, h) : [w / 2, h / 2];
    const project = (P) => {
      const v = v3.sub(P, B.eye); const z = v3.dot(v, B.f);
      if (z <= 1e-9 * v3.len(v) + 1e-6) return null;
      return { x: cx + (v3.dot(v, B.r) / z) * F, y: cy - (v3.dot(v, B.u) / z) * F, z, s: F / z };
    };
    const projectDir = (D) => { const z = v3.dot(D, B.f); if (z <= 0.01) return null; return { x: cx + (v3.dot(D, B.r) / z) * F, y: cy - (v3.dot(D, B.u) / z) * F }; };
    const api = { ctx, w, h, st, d: this.d, pose, B, F, project, projectDir, viewer: this, view: this.view };
    this.api = api;
    const ground = pose.mode === 'ground';
    const sunPos = st.bodies.sun ? st.bodies.sun.pos : [0, 0, 0];
    let sunAlt = -1, starA = 1;
    if (ground) {
      sunAlt = Math.asin(v3.dot(v3.norm(v3.sub(sunPos, B.eye)), pose.site.up)) / DEG;
      const mix = (a, b, t) => a.map((x, i) => Math.round(x + (b[i] - x) * t));
      const tDay = Math.max(0, Math.min(1, (sunAlt + 10) / 14));
      const top = mix([4, 7, 20], [46, 98, 168], tDay), bot = mix([16, 24, 46], [150, 190, 230], tDay);
      const glow = Math.max(0, 1 - Math.abs(sunAlt + 3) / 9);
      const g = ctx.createLinearGradient(0, 0, 0, h);
      g.addColorStop(0, `rgb(${top})`); g.addColorStop(1, `rgb(${mix(bot, [235, 140, 80], glow * 0.55)})`);
      ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
      starA = Math.max(0, Math.min(1, (-sunAlt - 6) / 8));
    } else {
      ctx.fillStyle = '#05070f'; ctx.fillRect(0, 0, w, h);
    }
    api.sunAlt = sunAlt;
    // stars + constellations
    const showC = this.view.constellations ?? (pose.mode !== 'orbit');
    if (starA > 0.02) {
      if (showC) {
        ctx.strokeStyle = `rgba(150,170,230,${(0.28 * starA).toFixed(2)})`; ctx.lineWidth = 0.8;
        for (const seg of CLINES) {
          ctx.beginPath(); let on = false;
          for (const v of seg) { const p = projectDir(v); if (!p) { on = false; continue; } on ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y); on = true; }
          ctx.stroke();
        }
      }
      for (const s of SKY) {
        const p = projectDir(s.v); if (!p || p.x < -2 || p.y < -2 || p.x > w + 2 || p.y > h + 2) continue;
        ctx.fillStyle = `rgba(${s.c[0]},${s.c[1]},${s.c[2]},${(s.a * starA * (pose.mode === 'orbit' ? 0.75 : 1)).toFixed(2)})`;
        ctx.fillRect(p.x - s.s / 2, p.y - s.s / 2, s.s, s.s);
      }
      if (showC && pose.fov < 100 * DEG) for (const n of CNAMES) { const p = projectDir(n.v); if (p && p.x > 20 && p.x < w - 20 && p.y > 20 && p.y < h - 20) label(ctx, n.name, p.x, p.y, { align: 'center', size: 10, color: `rgba(150,170,230,${(0.6 * starA).toFixed(2)})` }); }
    }
    // orbits & trails
    for (const id of this.view.orbits || []) {
      const pts = this.model.path(id, this.d);
      ctx.strokeStyle = id === 'earth' ? 'rgba(95,176,240,0.45)' : id === 'moon' ? 'rgba(201,212,255,0.35)' : 'rgba(170,185,230,0.2)';
      ctx.lineWidth = 1; ctx.beginPath(); let on = false;
      for (const P of pts) { const p = project(P); if (!p) { on = false; continue; } on ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y); on = true; }
      ctx.stroke();
    }
    this.safe('under', api);
    // bodies, far to near
    const scaleNotes = [];
    const list = [];
    for (const id in st.bodies) {
      const b = st.bodies[id];
      if (ground && id === 'earth') continue;
      if (this.view.bodies && !this.view.bodies.includes(id)) continue;
      if (ground && v3.dot(v3.sub(b.pos, pose.site.pos), pose.site.up) < -b.r) continue; // below the horizon
      if (pose.eyeBody && id === pose.eyeBody) continue;
      const p = project(b.pos); if (!p) continue;
      const rTrue = b.r * p.s;
      const boost = (this.trueSizes ? 1 : (this.view.boost?.[id] ?? 1));
      let R = rTrue * boost;
      const floor = this.trueSizes ? 0 : (typeof this.view.floor === 'object' ? (this.view.floor[id] ?? this.cfg.floor) : (this.view.floor ?? this.cfg.floor));
      const fl = typeof floor === 'function' ? floor(api) : floor;
      if (R < fl) R = fl;
      list.push({ id, b, p, R, rTrue });
    }
    list.sort((a, b) => b.p.z - a.p.z);
    this.hits = []; this.drawn = this.drawn || {}; const drawnNow = {};
    const nightA = ground ? Math.max(0, Math.min(1, (-sunAlt - 2) / 8)) : 1;
    for (const it of list) {
      const { id, b, p, R } = it;
      if (p.x < -R - 40 || p.x > w + R + 40 || p.y < -R - 40 || p.y > h + R + 40) continue;
      if (id === 'sun') drawSunDisc(ctx, p.x, p.y, R, { glow: ground ? 5 : 3.2 });
      else {
        const fb = v3.norm(v3.sub(b.pos, B.eye));
        let rb = v3.cross(fb, B.u); if (v3.len(rb) < 1e-6) rb = B.r; rb = v3.norm(rb);
        const ub = v3.cross(rb, fb);
        const V = [rb, ub, v3.mul(fb, -1)];
        const BF = b.frame ? V.map((row) => [0, 1, 2].map((j) => row[0] * b.frame[0][j] + row[1] * b.frame[1][j] + row[2] * b.frame[2][j])) : V;
        const s = v3.norm(v3.sub(sunPos, b.pos));
        const sv = [v3.dot(s, rb), v3.dot(s, ub), -v3.dot(s, fb)];
        drawSphere(ctx, p.x, p.y, R, { B: BF, sun: sv, tex: TEX[id] || (() => [200, 200, 200]), night: id === 'earth' ? 0.09 : 0.04, nightAlpha: id === 'moon' ? nightA : 1, rim: id === 'earth' && R > 6 ? 'rgba(140,200,255,0.35)' : null });
      }
      this.hits.push({ id, x: p.x, y: p.y, r: Math.max(R, 14) });
      drawnNow[id] = { x: p.x, y: p.y, R };
      const enl = R / Math.max(it.rTrue, 1e-12);
      if (enl > 1.5 && R > 0.8) scaleNotes.push([b.name, enl]);
      const showLabel = (this.view.labels ?? true) && (R < 26 || ground) && !(this.view.hideLabels || []).includes(id);
      if (showLabel) label(ctx, b.name, p.x + R + 5, p.y - Math.min(R, 8) - 2, { size: 11.5, color: id === 'earth' ? '#cfe6ff' : 'rgba(237,240,247,0.78)' });
    }
    this.drawn = drawnNow;
    this.safe('over', api);
    // ground & horizon
    if (ground) {
      const S = pose.site, hz = [];
      const az0 = this.cam.az ?? 0;
      for (let k = -100; k <= 100; k += 2) { const a = (az0 + k) * DEG; const p = projectDir(v3.add(v3.mul(S.north, Math.cos(a)), v3.mul(S.east, Math.sin(a)))); if (p) hz.push(p); }
      if (hz.length > 1) {
        ctx.fillStyle = '#080b0a'; ctx.beginPath(); ctx.moveTo(hz[0].x, hz[0].y);
        for (const p of hz) ctx.lineTo(p.x, p.y);
        ctx.lineTo(hz[hz.length - 1].x, h + 5000); ctx.lineTo(hz[0].x, h + 5000); ctx.closePath(); ctx.fill();
        ctx.strokeStyle = 'rgba(160,190,170,0.35)'; ctx.lineWidth = 1; ctx.beginPath(); hz.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y))); ctx.stroke();
      }
      for (let k = 0; k < 8; k++) {
        const a = k * 45 * DEG, p = projectDir(v3.add(v3.mul(S.north, Math.cos(a)), v3.mul(S.east, Math.sin(a))));
        if (p && p.x > 8 && p.x < w - 8) label(ctx, COMPASS[k], p.x, p.y + 14, { align: 'center', size: k % 2 ? 10.5 : 13, weight: k % 2 ? 400 : 600, color: 'rgba(237,240,247,0.75)' });
      }
    }
    // off-screen pointers (e.g. towards the Sun)
    for (const id of this.view.indicate || []) {
      const b = st.bodies[id]; if (!b) continue;
      const v = v3.sub(b.pos, B.eye); const x = v3.dot(v, B.r), y = v3.dot(v, B.u), z = v3.dot(v, B.f);
      const p = z > 0 ? { x: cx + (x / z) * F, y: cy - (y / z) * F } : null;
      if (p && p.x > 0 && p.x < w && p.y > 0 && p.y < h) continue;
      const a = Math.atan2(-y, x);
      const ex = cx + Math.cos(a) * (w / 2 - 26), ey = cy + Math.sin(a) * (h / 2 - 26);
      ctx.fillStyle = id === 'sun' ? '#ffcf6e' : 'rgba(237,240,247,0.85)';
      ctx.save(); ctx.translate(ex, ey); ctx.rotate(a);
      ctx.beginPath(); ctx.moveTo(10, 0); ctx.lineTo(-4, -6); ctx.lineTo(-4, 6); ctx.closePath(); ctx.fill(); ctx.restore();
      label(ctx, `${b.name}`, ex - Math.cos(a) * 20, ey - Math.sin(a) * 14, { align: 'center', size: 11, color: id === 'sun' ? '#ffcf6e' : 'rgba(237,240,247,0.85)' });
    }
    this.safe('top', api);
    // HUD
    const title = this.view.title ? this.view.title(api) : this.view.label;
    if (this.cfg.hud !== false) label(ctx, title, 12, 18, { size: 12, weight: 600, color: 'rgba(237,240,247,0.92)' });
    if (this.noteEl) {
      const base = this.view.note ? this.view.note(api) : '';
      const sz = this.trueSizes ? 'All sizes true.' : scaleNotes.length ? `Enlarged to stay visible: ${scaleNotes.slice(0, 3).map(([n, f]) => `${n} ×${f >= 100 ? Math.round(f / 10) * 10 : Math.round(f)}`).join(', ')}.` : 'All sizes true.';
      const html = `<b>Positions to scale.</b> ${sz} ${base}`;
      if (html !== this._note) { this.noteEl.innerHTML = html; this._note = html; }
    }
  }

  // chapter overlays must never take the whole view down
  safe(hook, api) {
    const fn = this.view[hook]; if (!fn) return;
    try { api.ctx.save(); fn(api); } catch (e) {
      const k = `overlay ${this.view.id}.${hook}`;
      if (!window.__chapterErrors[k]) { window.__chapterErrors[k] = String(e && e.stack || e); console.warn(k, e); }
    } finally { api.ctx.restore(); }
  }

  // ---------------- input
  bindInput() {
    const c = this.canvas;
    const ptrs = new Map();
    let drag = null, pinch = null;
    c.style.cursor = 'grab';
    c.addEventListener('pointerdown', (e) => {
      ptrs.set(e.pointerId, [e.clientX, e.clientY]);
      c.setPointerCapture(e.pointerId);
      if (ptrs.size === 1) drag = { x: e.clientX, y: e.clientY, t: performance.now(), cam: { ...this.cam }, moved: false };
      if (ptrs.size === 2) { const [a, b] = [...ptrs.values()]; pinch = { d: Math.hypot(a[0] - b[0], a[1] - b[1]) }; drag = null; }
    });
    c.addEventListener('pointermove', (e) => {
      if (!ptrs.has(e.pointerId)) return;
      ptrs.set(e.pointerId, [e.clientX, e.clientY]);
      if (pinch && ptrs.size === 2) {
        const [a, b] = [...ptrs.values()]; const d = Math.hypot(a[0] - b[0], a[1] - b[1]);
        this.zoomBy(d / Math.max(pinch.d, 1)); pinch.d = d; return;
      }
      if (!drag) return;
      const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
      if (!drag.moved && Math.hypot(dx, dy) < 4) return;
      drag.moved = true; this.trans = null;
      const cam = this.cam;
      if (cam.mode === 'orbit') {
        cam.yaw = drag.cam.yaw - dx * 0.4; cam.pitch = Math.max(-89.5, Math.min(89.5, drag.cam.pitch + dy * 0.3));
      } else {
        const per = (cam.fov) / c.clientWidth;
        if (cam.mode === 'ground') { cam.az = drag.cam.az - dx * per; cam.alt = Math.max(-10, Math.min(89, drag.cam.alt + dy * per)); }
        else { cam.lon = drag.cam.lon + dx * per; cam.lat = Math.max(-89, Math.min(89, drag.cam.lat + dy * per)); }
        cam.follow = null;
      }
    });
    const up = (e) => {
      ptrs.delete(e.pointerId);
      if (ptrs.size < 2) pinch = null;
      if (drag && !drag.moved && performance.now() - drag.t < 400) this.tap(e);
      if (ptrs.size === 0) drag = null;
    };
    c.addEventListener('pointerup', up); c.addEventListener('pointercancel', (e) => { ptrs.delete(e.pointerId); drag = null; pinch = null; });
    c.addEventListener('wheel', (e) => { if (!e.ctrlKey && !e.metaKey) return; e.preventDefault(); this.zoomBy(Math.exp(-e.deltaY * 0.01)); }, { passive: false });
  }
  zoomBy(f) {
    this.trans = null;
    const c = this.cam;
    if (c.mode === 'orbit') {
      const b = this.state?.bodies[typeof c.target === 'string' ? c.target : ''];
      const min = b ? b.r * 1.6 : 1000;
      c.dist = Math.max(min, Math.min(5e10, c.dist / f));
    } else c.fov = Math.max(0.5, Math.min(110, c.fov / f));
  }
  tap(e) {
    const rect = this.canvas.getBoundingClientRect();
    const x = e.clientX - rect.left, y = e.clientY - rect.top;
    let best = null;
    for (const h of this.hits) { const d = Math.hypot(h.x - x, h.y - y); if (d < h.r && (!best || d < best.d)) best = { ...h, d }; }
    if (!best) return;
    const b = this.state.bodies[best.id];
    if (this.cam.mode === 'orbit') this.flyTo({ target: best.id, dist: Math.max(b.r * 7, best.id === 'sun' ? b.r * 5 : 0) });
    else { this.cam.follow = best.id; this.cam._snap = false; }
    this.cfg.onTap && this.cfg.onTap(best.id, this);
  }

  // ---------------- time
  setRate(r) { this.rate = r; this.playing = r !== 0; this.updateRateUI(); }
  setTime(d) { this.d = d; }

  // ---------------- DOM chrome
  buildUI() {
    const c = this.canvas, parent = c.parentNode;
    const wrap = document.createElement('div'); wrap.className = 'viewer';
    parent.insertBefore(wrap, c);
    if (this.views.length > 1) {
      const chips = this.cfg.chipsEl || document.createElement('div'); chips.classList.add('viewer-views');
      chips.innerHTML = this.views.map((v) => `<button data-view="${v.id}">${v.label}</button>`).join('');
      chips.addEventListener('click', (e) => { const b = e.target.closest('button'); if (b) this.setView(b.dataset.view); });
      if (!this.cfg.chipsEl) wrap.appendChild(chips);
      this.chips = chips;
    }
    const box = document.createElement('div'); box.className = 'zoom-wrap';
    wrap.appendChild(box); box.appendChild(c);
    const ui = document.createElement('div'); ui.className = 'zoom-ui';
    ui.innerHTML = '<button aria-label="Zoom in">+</button><button aria-label="Zoom out">−</button><button aria-label="Back to this view" class="z-reset">⟲</button>';
    const [bi, bo, br] = ui.querySelectorAll('button');
    bi.addEventListener('click', () => this.zoomBy(1.6)); bo.addEventListener('click', () => this.zoomBy(1 / 1.6));
    br.addEventListener('click', () => this.setView(this.view.id, { keepTime: true }));
    box.appendChild(ui);
    if (this.cfg.noteEl !== null) { const note = this.cfg.noteEl || document.createElement('p'); if (!this.cfg.noteEl) { note.className = 'scale-note'; wrap.appendChild(note); } this.noteEl = note; }
    if (this.cfg.timeUI) {
      const t = document.createElement('div'); t.className = 'viewer-time';
      t.innerHTML = `<button class="btn round" data-act="play">❚❚</button><div class="seg small" data-act="rates">${this.cfg.rates.filter((r) => r[0]).map((r) => `<button data-rate="${r[0]}">${r[1]}</button>`).join('')}</div><output data-act="date"></output>${this.cfg.scaleToggle ? '<button class="btn ghost small" data-act="true">True sizes</button>' : ''}<button class="btn ghost small" data-act="now">Now</button>`;
      t.addEventListener('click', (e) => {
        const b = e.target.closest('button'); if (!b) return;
        if (b.dataset.act === 'play') { this.playing = !this.playing; if (this.playing && !this.rate) this.rate = this.cfg.rates[1][0]; this.updateRateUI(); }
        if (b.dataset.rate) this.setRate(parseFloat(b.dataset.rate));
        if (b.dataset.act === 'now') { this.d = daysSinceJ2000(Date.now()); }
        if (b.dataset.act === 'true') { this.trueSizes = !this.trueSizes; b.classList.toggle('on', this.trueSizes); }
      });
      wrap.appendChild(t); this.timeEl = t;
    }
    this.wrap = wrap;
  }
  updateRateUI() {
    if (!this.timeEl) return;
    this.timeEl.querySelector('[data-act=play]').textContent = this.playing ? '❚❚' : '▶';
    this.timeEl.querySelectorAll('[data-rate]').forEach((b) => b.classList.toggle('on', this.playing && parseFloat(b.dataset.rate) === this.rate));
  }
  updateTimeUI() {
    if (!this.timeEl) return;
    const out = this.timeEl.querySelector('[data-act=date]');
    let txt;
    const date = dateFromJ2000(this.d);
    if (this.cam.mode === 'ground') {
      const lt = (date.getUTCHours() + date.getUTCMinutes() / 60) + this.cam.place.lon / 15;
      txt = `${fmtDate(dateFromJ2000(this.d + this.cam.place.lon / 360))} · ${clock(lt)} local`;
    } else txt = `${fmtDate(date)} · ${clock(date.getUTCHours() + date.getUTCMinutes() / 60)} UT`;
    if (txt !== this._dt) { out.textContent = txt; this._dt = txt; }
  }
}

// ---- helpers for chapters
// local (mean solar) time at a longitude → days since J2000 on the same calendar day as d
export function atLocalTime(d, lonDeg, hours) {
  const day = Math.floor(d + 0.5 + lonDeg / 360) - 0.5; // local midnight (UT days since J2000 epoch at noon)
  return day + (hours - lonDeg / 15) / 24;
}
export const PLACES = {
  ams: { name: 'Amsterdam', lat: 52.37, lon: 4.9 },
  eq: { name: 'Quito (equator)', lat: -0.2, lon: -78.5 },
  syd: { name: 'Sydney', lat: -33.87, lon: 151.2 },
};
export { DAY };
