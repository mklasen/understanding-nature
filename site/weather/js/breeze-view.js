// Draws a SeaBreeze simulation as a cross-section: sky by time of day, the sun or moon,
// the temperature of the air as a warm/cool tint, drifting air "motes" that follow the
// simulated wind, surface wind arrows, H/L at the ground, and cumulus where the air rises
// hard enough. Used by the hero and by chapter 1.
import { fitCanvas } from '../../kit/util.js';
import { G, THETA0 } from './breeze-sim.js';

const lerp = (a, b, t) => a + (b - a) * t;
const mix = (c1, c2, t) => c1.map((v, i) => Math.round(lerp(v, c2[i], t)));
const rgb = (c, a = 1) => `rgba(${c[0]},${c[1]},${c[2]},${a})`;

// sky colours (top, horizon) through the day
const SKY = [
  [0, [6, 10, 24], [16, 24, 46]],
  [5, [8, 14, 32], [30, 36, 64]],
  [6.3, [40, 60, 110], [236, 150, 110]],
  [8, [60, 120, 200], [170, 205, 235]],
  [12, [52, 118, 206], [168, 208, 240]],
  [16.5, [58, 112, 196], [180, 205, 232]],
  [18.2, [52, 66, 120], [244, 146, 96]],
  [19.6, [14, 20, 44], [52, 46, 80]],
  [24, [6, 10, 24], [16, 24, 46]],
];
function skyAt(h) {
  for (let i = 1; i < SKY.length; i++) if (h <= SKY[i][0]) {
    const [h0, t0, b0] = SKY[i - 1], [h1, t1, b1] = SKY[i];
    const t = (h - h0) / (h1 - h0);
    return [mix(t0, t1, t), mix(b0, b1, t)];
  }
  return [SKY[0][1], SKY[0][2]];
}

export class BreezeView {
  constructor(canvas, sim, { motes = 420, labels = true, ground = 0.13, compact = false, window: win = null, zTop = sim.Lz } = {}) {
    Object.assign(this, { canvas, sim, labels, groundFrac: ground, compact, zTop });
    this.vw = win ? [sim.coast + win[0], sim.coast + win[1]] : sim.view; // horizontal window (m)
    this.motes = [];
    this.nMotes = motes;
    this.tint = document.createElement('canvas');
    this.tint.width = sim.nx + 1; this.tint.height = sim.nz + 1;
    this.tctx = this.tint.getContext('2d');
    this.img = this.tctx.createImageData(sim.nx + 1, sim.nz + 1);
    this.showTemp = true;
    this.cloud = new Float32Array(sim.nx + 1); // smoothed cloudiness along x
    this.seed = 7;
  }
  rand() { this.seed = (this.seed * 16807) % 2147483647; return this.seed / 2147483647; }
  spawn(m, anywhere = true) {
    const s = this.sim;
    const [a, b] = this.vw;
    m.x = a - 5e3 + this.rand() * (b - a + 10e3);
    m.z = Math.pow(this.rand(), 1.6) * this.zTop * 0.97; // denser near the ground, where the action is
    m.age = anywhere ? this.rand() * 300 : 0;
    m.life = 220 + this.rand() * 260;
    m.trail = [];
    return m;
  }
  // move the motes with the simulated wind for `simDt` seconds of model time
  advance(simDt) {
    const s = this.sim;
    while (this.motes.length < this.nMotes) this.motes.push(this.spawn({}));
    if (this.motes.length > this.nMotes) this.motes.length = this.nMotes;
    const sub = Math.max(1, Math.ceil(simDt / 60));
    const h = simDt / sub;
    for (const m of this.motes) {
      for (let k = 0; k < sub; k++) {
        m.x += s.sample(s.u, m.x, m.z) * h;
        m.z += s.sample(s.w, m.x, m.z) * h;
      }
      m.age += 1;
      if (m.x < this.vw[0] - 8e3 || m.x > this.vw[1] + 8e3 || m.z < 0 || m.z > this.zTop || m.age > m.life) { this.spawn(m, false); continue; }
      m.trail.push(m.x, m.z);
      if (m.trail.length > 16) m.trail.splice(0, 2);
    }
    // cumulus: where air is still rising fast near the top of the boundary layer
    const i0 = Math.floor(this.vw[0] / s.dx), i1 = Math.ceil(this.vw[1] / s.dx);
    for (let i = i0; i <= i1; i++) {
      let wmax = 0;
      for (let z = 500; z <= 1500; z += 250) wmax = Math.max(wmax, s.sample(s.w, i * s.dx, z));
      const target = Math.max(0, Math.min(1, (wmax - 0.25) / 0.7));
      this.cloud[i] += (target - this.cloud[i]) * Math.min(1, simDt / 900);
    }
  }

  draw() {
    const s = this.sim, { ctx, w, h } = fitCanvas(this.canvas);
    this.w = w; this.h = h;
    const gy = Math.round(h * (1 - this.groundFrac)); // ground line
    const [vx0, vx1] = this.vw, span = vx1 - vx0, zTop = this.zTop;
    this.span = span;
    const X = (x) => ((x - vx0) / span) * w, Z = (z) => gy - (z / zTop) * gy;
    this.X = X; this.Z = Z; this.gy = gy;
    const hour = s.clock / 3600;
    const night = hour < 6.2 || hour > 18.8;

    // sky
    const [top, hor] = skyAt(hour);
    let g = ctx.createLinearGradient(0, 0, 0, gy);
    g.addColorStop(0, rgb(top)); g.addColorStop(1, rgb(hor));
    ctx.fillStyle = g; ctx.fillRect(0, 0, w, gy);

    // sun / moon on an arc
    const dayT = (hour - 6) / 12;
    if (dayT > -0.05 && dayT < 1.05) {
      const sx = lerp(w * 0.92, w * 0.08, dayT), sy = gy * (0.9 - 0.75 * Math.sin(Math.PI * Math.min(1, Math.max(0, dayT))));
      const r = Math.max(10, Math.min(w, h) * 0.035);
      const glow = ctx.createRadialGradient(sx, sy, r * 0.3, sx, sy, r * 4);
      glow.addColorStop(0, `rgba(255,236,180,${0.55 * s.sun / 1.5 + 0.15})`); glow.addColorStop(1, 'rgba(255,236,180,0)');
      ctx.fillStyle = glow; ctx.fillRect(sx - r * 4, sy - r * 4, r * 8, r * 8);
      ctx.fillStyle = '#fff3c8'; ctx.beginPath(); ctx.arc(sx, sy, r, 0, 7); ctx.fill();
      if (s.sun < 0.45) { // overcast: a grey veil across the sky
        ctx.fillStyle = `rgba(150,160,175,${(0.45 - s.sun) * 1.3})`; ctx.fillRect(0, 0, w, gy);
      }
    } else {
      const nt = ((hour + 6) % 24) / 12; // 0 at 18h → 1 at 6h
      const mx = lerp(w * 0.9, w * 0.1, nt), my = gy * (0.85 - 0.6 * Math.sin(Math.PI * nt));
      ctx.fillStyle = 'rgba(255,255,255,0.7)';
      for (let i = 0; i < 40; i++) { const sx = ((i * 7919) % 997) / 997 * w, sy = ((i * 104729) % 991) / 991 * gy * 0.7; ctx.fillRect(sx, sy, 1.2, 1.2); }
      ctx.fillStyle = '#e8ecff'; ctx.beginPath(); ctx.arc(mx, my, Math.max(7, Math.min(w, h) * 0.022), 0, 7); ctx.fill();
    }

    // temperature tint (warm = orange, cool = blue)
    if (this.showTemp) {
      // tint = warmer/cooler than the average air at the same height (what drives the flow)
      const d = this.img.data, W = s.nx + 1, i0 = Math.floor(vx0 / s.dx), i1 = Math.ceil(vx1 / s.dx);
      for (let k = 0; k <= s.nz; k++) {
        let mean = 0;
        for (let i = i0; i <= i1; i++) mean += s.b[k * W + i];
        mean /= i1 - i0 + 1;
        for (let i = 0; i <= s.nx; i++) {
        const T = (s.b[k * W + i] - mean) * THETA0 / G; // K warmer/cooler than this level's mean
        const o = ((s.nz - k) * W + i) * 4;
        const a = Math.min(1, Math.abs(T) / 2.5);
        if (T > 0) { d[o] = 255; d[o + 1] = 120; d[o + 2] = 40; } else { d[o] = 60; d[o + 1] = 140; d[o + 2] = 255; }
        d[o + 3] = Math.round(a * (night ? 120 : 105));
      }
      }
      this.tctx.putImageData(this.img, 0, 0);
      ctx.save(); ctx.imageSmoothingEnabled = true;
      // node i sits at x = i·dx; stretch the image so node centres land on the right pixels
      ctx.drawImage(this.tint, vx0 / s.dx + 0.5, s.nz + 0.5 - zTop / s.dz, span / s.dx, zTop / s.dz, 0, 0, w, gy);
      ctx.restore();
    }

    // cumulus clouds where the air rises hard (the sea-breeze front often has a line of them)
    for (let i = Math.floor(vx0 / s.dx); i <= Math.ceil(vx1 / s.dx); i++) {
      const c = this.cloud[i];
      if (c < 0.05) continue;
      const cx = X(i * s.dx), base = Z(1000), r = (w * s.dx / span) * (1.6 + 2.2 * c);
      ctx.fillStyle = `rgba(255,255,255,${0.16 * c})`;
      for (let j = 0; j < 3; j++) {
        ctx.beginPath(); ctx.ellipse(cx + (j - 1) * r * 0.5, base - r * (0.5 + 0.35 * (j === 1)) - c * gy * 0.08, r, r * (0.7 + 0.4 * c), 0, 0, 7); ctx.fill();
      }
    }

    // motes + trails
    ctx.lineCap = 'round';
    const moteCol = night ? '220,230,255' : '255,255,255';
    for (const m of this.motes) {
      const t = m.trail;
      if (t.length < 4) continue;
      const fade = Math.min(1, m.age / 20, (m.life - m.age) / 20);
      ctx.strokeStyle = `rgba(${moteCol},${0.55 * fade})`; ctx.lineWidth = 1.3;
      ctx.beginPath(); ctx.moveTo(X(t[0]), Z(t[1]));
      for (let k = 2; k < t.length; k += 2) ctx.lineTo(X(t[k]), Z(t[k + 1]));
      ctx.stroke();
      ctx.fillStyle = `rgba(${moteCol},${0.9 * fade})`;
      ctx.fillRect(X(m.x) - 1, Z(m.z) - 1, 2, 2);
    }

    // ground: sea on the left, land on the right
    const cx = X(s.coast), ww = w;
    const landT = s.tempAt(s.coast + 15e3) - s.seaTemp;
    const day = !night;
    const sea = night ? [14, 40, 64] : [30, 96, 140], seaDeep = night ? [8, 22, 38] : [16, 56, 92];
    g = ctx.createLinearGradient(0, gy, 0, h);
    g.addColorStop(0, rgb(sea)); g.addColorStop(1, rgb(seaDeep));
    ctx.fillStyle = g; ctx.fillRect(0, gy, cx, h - gy);
    ctx.strokeStyle = 'rgba(255,255,255,0.25)'; ctx.lineWidth = 1;
    for (let x = 6; x < cx - 6; x += 22) { const y = gy + 5 + ((x * 13) % 9); ctx.beginPath(); ctx.moveTo(x, y); ctx.quadraticCurveTo(x + 4, y - 3, x + 8, y); ctx.stroke(); }
    const warm = Math.max(0, Math.min(1, landT / 5)), cool = Math.max(0, Math.min(1, -landT / 3));
    let land = mix(day ? [86, 120, 64] : [34, 48, 34], [176, 112, 58], warm * 0.75);
    land = mix(land, [52, 70, 96], cool * 0.5);
    ctx.fillStyle = rgb(land); ctx.fillRect(cx, gy, w - cx, h - gy);
    ctx.fillStyle = 'rgba(0,0,0,0.18)'; ctx.fillRect(cx, gy + (h - gy) * 0.45, w - cx, h);
    // a sandy beach and a few trees for scale-free texture
    ctx.fillStyle = night ? '#6d6450' : '#e3cf98'; ctx.fillRect(cx - 2, gy, Math.max(6, w * 0.02), 4);
    ctx.fillStyle = night ? 'rgba(20,34,26,0.9)' : 'rgba(40,70,40,0.9)';
    for (let x = cx + w * 0.05; x < w - 8; x += w * 0.07) { ctx.beginPath(); ctx.arc(x, gy - 4, 4, 0, 7); ctx.fill(); ctx.fillRect(x - 0.8, gy - 2, 1.6, 3); }

    if (this.labels) this.drawLabels(ctx, w, h, gy);
  }

  drawLabels(ctx, w, h, gy) {
    const s = this.sim, X = this.X, Z = this.Z, span = this.span;
    const small = w < 520;
    ctx.font = `600 ${small ? 11 : 12.5}px ui-sans-serif, system-ui, sans-serif`;
    ctx.textBaseline = 'middle';
    // SEA / LAND
    ctx.fillStyle = 'rgba(255,255,255,0.85)'; ctx.textAlign = 'center';
    const lblY = gy + (h - gy) * 0.55;
    const seaX = (this.vw[0] + s.coast) / 2, landX = (s.coast + this.vw[1]) / 2;
    ctx.fillText(`SEA ${Math.round(s.tempAt(s.coast - 25e3))}°`, X(seaX), lblY);
    ctx.fillText(`LAND ${Math.round(s.tempAt(s.coast + 25e3))}°`, X(landX), lblY);

    // surface wind arrows at 4 spots
    const spots = [-30e3, -10e3, 8e3, 26e3, 44e3].map((d) => s.coast + d);
    for (const x0 of spots) {
      const u = s.sample(s.u, x0, 60);
      if (Math.abs(u) < 0.3) continue;
      const len = Math.min(w * 0.09, 9 + Math.abs(u) * w * 0.016) * Math.sign(u);
      const y = gy - 10, x = X(x0) - len / 2;
      ctx.strokeStyle = '#fff'; ctx.fillStyle = '#fff'; ctx.lineWidth = 2.4;
      ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + len, y); ctx.stroke();
      const d = Math.sign(len);
      ctx.beginPath(); ctx.moveTo(x + len + d * 4, y); ctx.lineTo(x + len - d * 4, y - 5); ctx.lineTo(x + len - d * 4, y + 5); ctx.fill();
    }

    // H / L at the ground from the hydrostatic pressure
    const p = s.surfacePressure();
    const pS = p[Math.round((s.coast - 25e3) / s.dx)], pL = p[Math.round((s.coast + 25e3) / s.dx)];
    if (Math.abs(pS - pL) > 6) {
      const hiSea = pS > pL;
      const r = small ? 12 : 15, y = gy - (small ? 34 : 42);
      const badge = (txt, x, col) => {
        ctx.fillStyle = 'rgba(8,17,31,0.55)'; ctx.beginPath(); ctx.arc(x, y, r, 0, 7); ctx.fill();
        ctx.strokeStyle = col; ctx.lineWidth = 2; ctx.stroke();
        ctx.fillStyle = col; ctx.font = `700 ${small ? 14 : 17}px ui-sans-serif, system-ui, sans-serif`; ctx.fillText(txt, x, y + 1);
      };
      badge('H', X(hiSea ? seaX : landX), '#9ccfff');
      badge('L', X(hiSea ? landX : seaX), '#ffa477');
    }

    // clock + honest scale note
    ctx.textAlign = 'left'; ctx.font = `600 ${small ? 13 : 15}px ui-sans-serif, system-ui, sans-serif`;
    const hh = Math.floor(s.clock / 3600), mm = Math.floor((s.clock % 3600) / 60);
    ctx.fillStyle = 'rgba(255,255,255,0.95)';
    ctx.fillText(`${String(hh).padStart(2, '0')}:${String(Math.floor(mm / 10) * 10).padStart(2, '0')}`, 12, 18);
    const ex = Math.round((gy / this.zTop) / (w / span));
    ctx.font = `500 ${small ? 10.5 : 11.5}px ui-sans-serif, system-ui, sans-serif`;
    ctx.fillStyle = 'rgba(255,255,255,0.7)'; ctx.textAlign = 'right';
    ctx.fillText(`${Math.round(span / 1000)} km across · ${(this.zTop / 1000).toFixed(1)} km high · heights ×${ex}`, w - 10, 16);
  }
}
