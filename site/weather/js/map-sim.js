// Weather-map physics shared by chapters 2 and 3 (no DOM — runs in node).
// A pressure field made of smooth highs and lows, and air parcels pushed by it:
//   du/dt = −(1/ρ)·∂p/∂x + f·v − k·u
//   dv/dt = −(1/ρ)·∂p/∂y − f·u − k·v        (f = 2Ω sin φ, k = surface friction)
// Positions in metres, y pointing north. Integration: half-step push/friction, exact rotation
// by f·dt (so Coriolis never adds or removes energy), half-step push/friction.

export const OMEGA = 7.2921e-5, RHO = 1.2, P0 = 1013;
export const coriolis = (latDeg) => 2 * OMEGA * Math.sin((latDeg * Math.PI) / 180);

export class PressureField {
  constructor(centers = []) { this.centers = centers; } // {x, y (m), dp (hPa), R (m)}
  // pressure in hPa
  p(x, y) {
    let s = P0;
    for (const c of this.centers) { const dx = x - c.x, dy = y - c.y; s += c.dp * Math.exp(-(dx * dx + dy * dy) / (2 * c.R * c.R)); }
    return s;
  }
  // gradient in Pa per metre
  grad(x, y) {
    let gx = 0, gy = 0;
    for (const c of this.centers) {
      const dx = x - c.x, dy = y - c.y, e = c.dp * 100 * Math.exp(-(dx * dx + dy * dy) / (2 * c.R * c.R)) / (c.R * c.R);
      gx -= e * dx; gy -= e * dy;
    }
    return [gx, gy];
  }
}

export function stepParcel(P, field, f, k, dt) {
  const half = (h) => {
    const [gx, gy] = field.grad(P.x, P.y);
    P.u += h * (-gx / RHO - k * P.u);
    P.v += h * (-gy / RHO - k * P.v);
  };
  half(dt / 2);
  const c = Math.cos(f * dt), s = Math.sin(f * dt);
  const u = P.u * c + P.v * s, v = -P.u * s + P.v * c; // rotate clockwise for f > 0 (deflect right)
  P.u = u; P.v = v;
  half(dt / 2);
  P.x += P.u * dt; P.y += P.v * dt;
}

// the speed at which push and Coriolis balance (geostrophic wind), m/s
export const geostrophic = (gradPa, f) => (Math.abs(f) < 1e-7 ? Infinity : gradPa / (RHO * Math.abs(f)));

// contour lines with marching squares on a sampled grid. Returns [[x1,y1,x2,y2], …] per level.
export function contours(sample, nx, ny, levels) {
  const out = levels.map(() => []);
  const v = new Float64Array((nx + 1) * (ny + 1));
  for (let j = 0; j <= ny; j++) for (let i = 0; i <= nx; i++) v[j * (nx + 1) + i] = sample(i / nx, j / ny);
  const W = nx + 1;
  levels.forEach((L, li) => {
    const segs = out[li];
    for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
      const a = v[j * W + i], b = v[j * W + i + 1], c = v[(j + 1) * W + i + 1], d = v[(j + 1) * W + i];
      const idx = (a > L) | ((b > L) << 1) | ((c > L) << 2) | ((d > L) << 3);
      if (idx === 0 || idx === 15) continue;
      const x0 = i / nx, y0 = j / ny, sx = 1 / nx, sy = 1 / ny;
      const e = [
        [x0 + sx * (L - a) / (b - a), y0], // top (a→b)
        [x0 + sx, y0 + sy * (L - b) / (c - b)], // right (b→c)
        [x0 + sx * (L - d) / (c - d), y0 + sy], // bottom (d→c)
        [x0, y0 + sy * (L - a) / (d - a)], // left (a→d)
      ];
      const T = { 1: [[3, 0]], 2: [[0, 1]], 3: [[3, 1]], 4: [[1, 2]], 5: [[3, 0], [1, 2]], 6: [[0, 2]], 7: [[3, 2]], 8: [[2, 3]], 9: [[0, 2]], 10: [[0, 1], [2, 3]], 11: [[1, 2]], 12: [[1, 3]], 13: [[0, 1]], 14: [[0, 3]] }[idx];
      for (const [p, q] of T) segs.push(e[p][0], e[p][1], e[q][0], e[q][1]);
    }
  });
  return out;
}
