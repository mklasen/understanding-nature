// Sea breeze / land breeze: a real (if small) fluid model, no DOM — runs headless in node.
//
// 2-D vertical slice across a coastline (sea on the left, land on the right), Boussinesq
// approximation, vorticity–streamfunction form:
//   Dζ/Dt = −∂b/∂x + f·∂v/∂z + K∇²ζ − ζ/τf   (ζ = ∂u/∂z − ∂w/∂x, buoyancy b = g·θ'/θ0)
//   Dv/Dt = −f·u + K∇²v − v/τf               (v: wind along the coast — Earth's spin turns the breeze)
//   Db/Dt = −N²·w + Q(x,z,t) + K∇²b − b/τr
//   ∇²ψ = ζ,  u = ∂ψ/∂z,  w = −∂ψ/∂x       (closed box, ψ = 0 on every wall, free-slip)
// Q is the Sun warming the ground over land (the sea barely changes temperature in a day:
// its heat capacity is enormous and it mixes); at night the land radiates and cools.
// Poisson solve: exact — sine transform in x, tridiagonal (Thomas) in z.
// Advection: semi-Lagrangian (stable for any time step). Units: SI, time in seconds.

export const G = 9.81, THETA0 = 300, RHO = 1.2, CP = 1005;

export class SeaBreeze {
  constructor({ nx = 128, nz = 40, Lx = 150e3, Lz = 2400, coast = 60e3 } = {}) {
    Object.assign(this, { nx, nz, Lx, Lz, dx: Lx / nx, dz: Lz / nz });
    // the model is wider than what we draw (view: 15–115 km), so its side walls stay out of sight
    this.view = [coast - 45e3, coast + 55e3];
    const n = (nx + 1) * (nz + 1);
    this.zeta = new Float64Array(n); this.v = new Float64Array(n); this.tmp3 = new Float64Array(n); this.b = new Float64Array(n); this.psi = new Float64Array(n);
    this.u = new Float64Array(n); this.w = new Float64Array(n);
    this.tmp = new Float64Array(n); this.tmp2 = new Float64Array(n);
    // physics knobs
    this.lat = 45;               // latitude (°) → Coriolis parameter f = 2Ω·sin φ
    this.N2 = 1.2e-4;            // background stability (s⁻²) — a lightly stable atmosphere
    this.Kh = 1200; this.Kv = 15; // eddy diffusivities (m²/s)
    this.tauF = 5 * 3600;         // friction-ish spin-down of the circulation
    this.tauR = 30 * 3600;        // slow radiative relaxation of temperature anomalies
    this.Hday = 340;              // peak sensible heat flux into the air over land, W/m²
    this.Hnight = 70;             // night-time cooling of the land surface, W/m² (positive = cooling)
    this.hDay = 260; this.hNight = 110; // depth over which ground heating/cooling is felt (m)
    this.sun = 1;                 // 0 = thick overcast … 1.5 = blazing
    this.coast = coast; this.coastW = 2500;
    this.seaTemp = 18;            // °C, fixed — the sea's day/night swing is tiny
    this.clock = 9 * 3600;        // time of day (s since midnight)
    this.t = 0;
    this._dst();
    this.land = new Float64Array(nx + 1);
    for (let i = 0; i <= nx; i++) this.land[i] = 0.5 + 0.5 * Math.tanh((i * this.dx - this.coast) / this.coastW);
  }
  get f() { return 2 * 7.2921e-5 * Math.sin(this.lat * Math.PI / 180); }
  idx(i, k) { return k * (this.nx + 1) + i; }

  // ---- forcing ----
  // sensible heat flux into the air at the ground over land (W/m²) at this time of day
  surfaceFlux(clock = this.clock) {
    const h = ((clock / 3600) % 24 + 24) % 24;
    if (h > 6 && h < 18) return this.sun * this.Hday * Math.sin(Math.PI * (h - 6) / 12);
    return -this.Hnight * (0.4 + 0.6 * Math.min(1, this.sun)); // clear nights cool harder
  }
  // ---- sine-transform Poisson solver ----
  // Fast DST-I of two real rows at once: odd-extend both to length 2N, put one in the real part
  // and one in the imaginary part, FFT. Each odd extension has a purely imaginary transform
  // (−2i·X), so Re(Z) = 2·X_b and Im(Z) = −2·X_a. O(N log N) instead of O(N²).
  _fftInit(n2) {
    this.n2 = n2; this.re = new Float64Array(n2); this.im = new Float64Array(n2);
    this.rev = new Uint32Array(n2); const bits = Math.log2(n2);
    for (let i = 0; i < n2; i++) { let r = 0; for (let b = 0; b < bits; b++) r |= ((i >> b) & 1) << (bits - 1 - b); this.rev[i] = r; }
    this.cosT = new Float64Array(n2 / 2); this.sinT = new Float64Array(n2 / 2);
    for (let i = 0; i < n2 / 2; i++) { this.cosT[i] = Math.cos((2 * Math.PI * i) / n2); this.sinT[i] = -Math.sin((2 * Math.PI * i) / n2); }
  }
  _fft() {
    const { n2, re, im, rev, cosT, sinT } = this;
    for (let i = 0; i < n2; i++) { const j = rev[i]; if (j > i) { let t = re[i]; re[i] = re[j]; re[j] = t; t = im[i]; im[i] = im[j]; im[j] = t; } }
    for (let size = 2; size <= n2; size <<= 1) {
      const half = size >> 1, step = n2 / size;
      for (let st = 0; st < n2; st += size) for (let j = 0, t = 0; j < half; j++, t += step) {
        const a = st + j, b = a + half, wr = cosT[t], wi = sinT[t];
        const xr = re[b] * wr - im[b] * wi, xi = re[b] * wi + im[b] * wr;
        re[b] = re[a] - xr; im[b] = im[a] - xi; re[a] += xr; im[a] += xi;
      }
    }
  }
  // rows A and B (length M = N−1, read via getters) → DST-I coefficients written via setters
  _dstPair(getA, getB, setA, setB, M) {
    const { re, im } = this, N = M + 1, n2 = 2 * N;
    re[0] = im[0] = re[N] = im[N] = 0;
    for (let i = 1; i < N; i++) {
      const a = getA(i - 1), b = getB ? getB(i - 1) : 0;
      re[i] = a; im[i] = b; re[n2 - i] = -a; im[n2 - i] = -b;
    }
    this._fft();
    for (let m = 1; m < N; m++) { setA(m - 1, -im[m] / 2); if (setB) setB(m - 1, re[m] / 2); }
  }
  _dst() {
    const { nx, nz, dx, dz } = this, M = nx - 1;
    this.S = new Float64Array(M * M);
    for (let m = 1; m <= M; m++) for (let i = 1; i <= M; i++) this.S[(m - 1) * M + (i - 1)] = Math.sin(Math.PI * m * i / nx);
    this.lam = new Float64Array(M);
    for (let m = 1; m <= M; m++) this.lam[m - 1] = -(2 - 2 * Math.cos(Math.PI * m / nx)) / (dx * dx);
    this.Zh = new Float64Array(M * (nz + 1));
    this.cp_ = new Float64Array(nz + 1); this.dp_ = new Float64Array(nz + 1);
    this.fast = Number.isInteger(Math.log2(2 * nx));
    if (this.fast) this._fftInit(2 * nx);
  }
  solvePoisson() {
    // layout: Zh[k*M + m] so both transforms are contiguous dot products (S is symmetric)
    const { nx, nz, dz, S, lam, Zh, zeta, psi } = this, M = nx - 1, W = nx + 1;
    if (this.fast) {
      const sc = 2 / nx;
      for (let k = 1; k < nz; k += 2) {
        const kb = k + 1 < nz ? k + 1 : 0;
        this._dstPair((i) => zeta[k * W + 1 + i], kb ? (i) => zeta[kb * W + 1 + i] : null,
          (m, v) => { Zh[k * M + m] = sc * v; }, kb ? (m, v) => { Zh[kb * M + m] = sc * v; } : null, M);
      }
    } else for (let k = 1; k < nz; k++) {
      const zr = k * W + 1, out = k * M;
      for (let m = 0; m < M; m++) {
        let s = 0; const row = m * M;
        for (let i = 0; i < M; i++) s += zeta[zr + i] * S[row + i];
        Zh[out + m] = (2 / nx) * s;
      }
    }
    // per mode: (Ψk+1 − 2Ψk + Ψk−1)/dz² + λΨk = Zk,  Ψ0 = Ψnz = 0
    const a = 1 / (dz * dz), c = this.cp_, d = this.dp_;
    for (let m = 0; m < M; m++) {
      const bdiag = -2 * a + lam[m];
      c[1] = a / bdiag; d[1] = Zh[M + m] / bdiag;
      for (let k = 2; k < nz; k++) {
        const den = bdiag - a * c[k - 1];
        c[k] = a / den; d[k] = (Zh[k * M + m] - a * d[k - 1]) / den;
      }
      Zh[(nz - 1) * M + m] = d[nz - 1];
      for (let k = nz - 2; k >= 1; k--) Zh[k * M + m] = d[k] - c[k] * Zh[(k + 1) * M + m];
    }
    psi.fill(0);
    if (this.fast) {
      for (let k = 1; k < nz; k += 2) {
        const kb = k + 1 < nz ? k + 1 : 0;
        this._dstPair((m) => Zh[k * M + m], kb ? (m) => Zh[kb * M + m] : null,
          (i, v) => { psi[k * W + 1 + i] = v; }, kb ? (i, v) => { psi[kb * W + 1 + i] = v; } : null, M);
      }
      return;
    }
    for (let k = 1; k < nz; k++) {
      const zr = k * M, pr = k * W + 1;
      for (let i = 0; i < M; i++) {
        let s = 0; const row = i * M;
        for (let m = 0; m < M; m++) s += Zh[zr + m] * S[row + m];
        psi[pr + i] = s;
      }
    }
  }
  velocities() {
    const { nx, nz, dx, dz, psi, u, w } = this, W = nx + 1;
    for (let k = 0; k <= nz; k++) for (let i = 0; i <= nx; i++) {
      const j = k * W + i;
      const kp = Math.min(nz, k + 1), km = Math.max(0, k - 1), ip = Math.min(nx, i + 1), im = Math.max(0, i - 1);
      u[j] = (psi[kp * W + i] - psi[km * W + i]) / ((kp - km) * dz);
      w[j] = -(psi[k * W + ip] - psi[k * W + im]) / ((ip - im) * dx);
    }
    // free-slip walls: no flow through them
    for (let i = 0; i <= nx; i++) { w[i] = 0; w[nz * W + i] = 0; }
    for (let k = 0; k <= nz; k++) { u[k * W] = 0; u[k * W + nx] = 0; }
  }
  // bilinear sample of a node field at physical (x, z)
  sample(f, x, z) {
    const { nx, nz, dx, dz } = this, W = nx + 1;
    let fi = x / dx, fk = z / dz;
    fi = fi < 0 ? 0 : fi > nx ? nx : fi; fk = fk < 0 ? 0 : fk > nz ? nz : fk;
    const i = Math.min(nx - 1, fi | 0), k = Math.min(nz - 1, fk | 0), sx = fi - i, sz = fk - k;
    const j = k * W + i;
    return (f[j] * (1 - sx) + f[j + 1] * sx) * (1 - sz) + (f[j + W] * (1 - sx) + f[j + W + 1] * sx) * sz;
  }
  advect(f, out, dt) {
    const { nx, nz, dx, dz, u, w } = this, W = nx + 1;
    for (let k = 0; k <= nz; k++) for (let i = 0; i <= nx; i++) {
      const j = k * W + i, x = i * dx, z = k * dz;
      // midpoint back-trace
      const xm = x - 0.5 * dt * u[j], zm = z - 0.5 * dt * w[j];
      const um = this.sample(u, xm, zm), wm = this.sample(w, xm, zm);
      out[j] = this.sample(f, x - dt * um, z - dt * wm);
    }
  }
  diffuse(f, out, dt) {
    const { nx, nz, dx, dz, Kh, Kv } = this, W = nx + 1;
    const ax = Kh * dt / (dx * dx), az = Kv * dt / (dz * dz);
    for (let k = 0; k <= nz; k++) for (let i = 0; i <= nx; i++) {
      const j = k * W + i;
      const l = f[k * W + Math.max(0, i - 1)], r = f[k * W + Math.min(nx, i + 1)];
      const dn = f[Math.max(0, k - 1) * W + i], up = f[Math.min(nz, k + 1) * W + i];
      out[j] = f[j] + ax * (l + r - 2 * f[j]) + az * (dn + up - 2 * f[j]);
    }
  }

  step(dt = 20) {
    const { nx, nz, dx, dz, zeta, b, v, tmp, tmp2, tmp3, u, w } = this, W = nx + 1, f = this.f;
    this.solvePoisson(); this.velocities();
    // advect
    this.advect(zeta, tmp, dt); this.advect(b, tmp2, dt); this.advect(v, tmp3, dt);
    // buoyancy source of vorticity, stratification, heating
    const H = this.surfaceFlux();
    const day = H > 0, h = day ? this.hDay : this.hNight;
    const q0 = (G / THETA0) * H / (RHO * CP * h); // buoyancy rate at the ground (m/s³)
    for (let k = 0; k <= nz; k++) {
      const prof = Math.exp(-k * dz / h);
      for (let i = 0; i <= nx; i++) {
        const j = k * W + i;
        const bx = (b[k * W + Math.min(nx, i + 1)] - b[k * W + Math.max(0, i - 1)]) / (((i < nx) + (i > 0)) * dx);
        const vz = (v[Math.min(nz, k + 1) * W + i] - v[Math.max(0, k - 1) * W + i]) / (((k < nz) + (k > 0)) * dz);
        tmp[j] += dt * (-bx + f * vz) - dt * tmp[j] / this.tauF;
        tmp3[j] += dt * (-f * u[j]) - dt * tmp3[j] / this.tauF;
        tmp2[j] += dt * (-this.N2 * w[j] + q0 * prof * this.land[i]) - dt * tmp2[j] / this.tauR;
      }
    }
    this.diffuse(tmp, zeta, dt); this.diffuse(tmp2, b, dt); this.diffuse(tmp3, v, dt);
    // free-slip walls: ζ = 0 on the boundary
    for (let i = 0; i <= nx; i++) { zeta[i] = 0; zeta[nz * W + i] = 0; }
    for (let k = 0; k <= nz; k++) { zeta[k * W] = 0; zeta[k * W + nx] = 0; }
    this.t += dt; this.clock = (this.clock + dt) % 86400;
  }
  reset(clockHours = 9) { this.zeta.fill(0); this.v.fill(0); this.b.fill(0); this.psi.fill(0); this.u.fill(0); this.w.fill(0); this.clock = clockHours * 3600; this.t = 0; }

  // ---- diagnostics ----
  tempAt(x, z = 0) { return this.seaTemp + this.sample(this.b, x, z) * THETA0 / G; } // °C (potential-temperature anomaly)
  // hydrostatic surface pressure anomaly (Pa), relative to the domain mean
  surfacePressure() {
    const { nx, nz, dz, b } = this, W = nx + 1, p = new Float64Array(nx + 1);
    let mean = 0;
    for (let i = 0; i <= nx; i++) {
      let s = 0;
      for (let k = 0; k <= nz; k++) s += b[k * W + i] * (k === 0 || k === nz ? 0.5 : 1) * dz;
      p[i] = -RHO * s; mean += p[i];
    }
    mean /= nx + 1;
    for (let i = 0; i <= nx; i++) p[i] -= mean;
    return p;
  }
  // wind ~60 m above the coast: + = from the sea onto the land
  coastWind(z = 60) { return this.sample(this.u, this.coast, z); }
  coastAlong(z = 60) { return this.sample(this.v, this.coast, z); }
  // how far inland the onshore flow reaches (m), 0 if there's no sea breeze
  frontDistance(z = 60) {
    if (this.coastWind(z) <= 0.2) return 0;
    for (let x = this.coast; x < this.view[1]; x += this.dx / 2) if (this.sample(this.u, x, z) < 0.2) return x - this.coast;
    return this.view[1] - this.coast;
  }
  // depth of the onshore layer at the coast (m)
  breezeDepth() {
    const s = Math.sign(this.coastWind());
    for (let z = 60; z < this.Lz; z += this.dz / 2) if (Math.sign(this.sample(this.u, this.coast, z)) !== s) return z;
    return this.Lz;
  }
  maxSpeed() { let m = 0; for (let j = 0; j < this.u.length; j++) m = Math.max(m, Math.abs(this.u[j])); return m; }
}
