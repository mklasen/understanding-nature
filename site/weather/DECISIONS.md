# Understanding Weather — design & physics decisions

The model behind each interactive, what was simplified, and why.
Guiding rule (house style): **accurate enough to teach, simple enough to feel.** Every exaggeration
is labelled on the canvas. Numbers below come from running the models headless in node.

## Architecture
- Static, vanilla ES modules, Canvas2D only (the test browser has no WebGL; phones are the main
  audience). One module per chapter, loaded in isolation by `kit/chapters.js`; loops run only while
  visible (`visibleLoop`).
- Physics lives in no-DOM modules (`breeze-sim.js`, …) so it can be checked in node.

## Hero + chapter 1 — the sea breeze (`breeze-sim.js`, `breeze-view.js`)
A genuine (small) fluid model, not an animation: nobody scripts the sea breeze, it emerges.
- **2-D vertical slice across a coast, Boussinesq, vorticity–streamfunction:**
  `Dζ/Dt = −∂b/∂x + f ∂v/∂z + K∇²ζ − ζ/τf`, `Dv/Dt = −f u + K∇²v − v/τf`,
  `Db/Dt = −N² w + Q − b/τr + K∇²b`, `∇²ψ = ζ`. Buoyancy `b = g θ'/θ0`.
  The along-coast wind `v` makes it "2½-D", so Earth's spin (f = 2Ω sin φ, 45°N) turns the breeze
  during the afternoon — and, importantly, stops it running inland forever (without f, a 2-D
  sea breeze keeps going until it hits the wall).
- **Grid** 128 × 40 nodes over 150 km × 2.4 km (dx 1.2 km, dz 60 m); closed box, free slip.
  We **draw only 15–115 km** (sea 45 km, land 55 km) so the walls — where air piles up
  unrealistically — are never on screen. The canvas says "100 km across · 2.4 km high · heights ×N".
- **Poisson solve is exact**: sine transform (DST-I) in x + tridiagonal solve in z (ψ = 0 on walls).
  The DST runs as a radix-2 FFT of the odd extension, two rows per complex FFT (each odd extension
  has a purely imaginary transform, so they separate cleanly into Re/Im) — 3× faster than the
  matrix form, bit-for-bit the same diagnostics. Semi-Lagrangian advection (midpoint back-trace),
  explicit diffusion. Step 40 s; ~1.3 ms/step in node (Poisson 0.6 ms).
- **Forcing.** Over land only (sea's daily swing is tiny: huge heat capacity, mixes metres deep).
  Day: sensible heat flux `H = 340 W/m² · sun · sin(π(h−6)/12)`, spread over an e-folding depth
  of 260 m. Night: −70 W/m² (scaled down under cloud), confined to 110 m — the shallow nocturnal
  inversion. `N² = 1.2e-4 s⁻²`, `Kh = 1200`, `Kv = 15 m²/s`, spin-down `τf = 5 h`, radiative
  relaxation `τr = 30 h`.
- **Pressure** shown as H/L is the hydrostatic surface pressure, `p'(0) = −ρ∫b dz`, relative to the
  mean. **Tint** = warmer/cooler than the average air *at the same height* (that horizontal
  difference is what drives the flow).
- **Cumulus** are drawn where w > 0.25 m/s between 0.5 and 1.5 km — at the sea-breeze front, as in
  reality. Cloud base fixed at 1 km (illustrative; chapter 5 does cloud base properly).

### Sanity checks (45°N, sunny, after a spin-up day)
| | model | typical real sea breeze |
|---|---|---|
| onset | ~09:00 | mid-morning |
| peak onshore wind at 60 m | 4.4 m/s (15:00) | 3–7 m/s |
| depth of onshore layer | 600–850 m | 0.5–1 km |
| land–sea air contrast | ~3–3.5 °C (25 km inland vs offshore) | 3–10 °C at 2 m |
| surface pressure difference | 0.6 hPa | ~0.5–1 hPa |
| inland reach | 40 → 55+ km by late afternoon | 20–60 km, 100+ in hot climates |
| updraft at the front | 1–1.5 m/s | 1–3 m/s |
| veering (NH) | along-coast wind −1.6 m/s by 17:00 (turns clockwise) | turns clockwise in NH |
| land breeze | 1–1.6 m/s, from ~21:00–22:00 | 1–3 m/s, weaker & shallower than the sea breeze |
Known weaknesses: the land–sea contrast at 60 m is smaller than at 2 m (no surface layer); land
breeze sets in a little late; the sea-side air slowly warms ~1.5 °C over the day (return flow).

### Views
- Chapter 1 shows the full 100 km window. The hero uses a narrower, lower window on phones
  (48 km × 1.5 km) so the circulation isn't hidden under the headline.
- Time-lapse: 1 day ≈ 1 min by default (slow/fast options). At most 6 steps per frame; on slow
  devices model time is dropped rather than letting frames pile up.

## Chapters 2 & 3 — pressure maps and Coriolis (`map-sim.js`, `map-view.js`, `pressure.js`, `spin.js`)
- **Pressure field**: a sum of Gaussian highs/lows, `p = 1013 + Σ Δp·exp(−r²/2R²)` (hPa), analytic
  gradient. Isobars every 2 hPa (marching squares on a 90×N grid, cached until the field changes);
  every 8 hPa drawn bolder and labelled.
- **Parcels** obey the horizontal momentum equations exactly as in a textbook:
  `du/dt = −(1/ρ)∂p/∂x + f v − k u`, `dv/dt = −(1/ρ)∂p/∂y − f u − k v`, `f = 2Ω sin φ`.
  Integrator: half push/friction, exact rotation by `f·dt`, half push/friction (Coriolis does no
  work, so no numerical energy gain). Map 3,000–3,200 km wide; time-lapse 1 s ≈ 1.2 h (ch. 2) / 3 h (ch. 3), labelled on the canvas.
- **Chapter 2 deliberately switches Coriolis off** (canvas says "No Earth spin yet"); a little
  friction (k = 1.2e-5 /s) keeps parcels from oscillating forever. Parcels fade in the centre of the
  low ("air piles in… and rises"). Readouts at the midpoint: slope (hPa/100 km), push = |∇p|/ρ as
  "km/h gained per hour", and the *real* wind such a slope gives — geostrophic at 50° × 0.7 for
  surface friction (a common forecaster's rule; ch. 4 shows 50–70%).
- **Chapter 3 friction** `k = c·f(45°)` with c = 0 (aloft), 0.36 (sea), 0.8 (land) — chosen so that in
  steady state `tan α = k/f` gives ~20° over sea and ~38° over land at 45°, matching the textbook
  ranges (10–20° sea, 25–45° land). k is fixed in physical units, so at low latitudes the air crosses
  the isobars more steeply — as it really does.
- **Sanity (node)**, the chapter's low (Δp = −24 hPa, R = 560 km), air released at rest 1,250 km out,
  50°N: frictionless air never reaches the centre (it is turned aside and circles, closest approach
  1,135 km). With sea friction it spirals in over ~4–5 days, with land friction ~2.5–3 days — real
  lows also fill over days. 50°S: same, clockwise. Equator: straight in within ~17 h at up to
  38 m/s, sloshing through the middle (no balance is possible). Slope at R: 2.6 hPa/100 km →
  geostrophic 19 m/s at 50° — a vigorous but ordinary low. Map time-lapse: 1 s ≈ 3 h.
- **Merry-go-round**: the ball moves in a straight line in the ground frame; the chalk track is
  recorded in disc coordinates. "Riding it" counter-rotates the picture. The disc spins anticlockwise
  for northern latitudes, clockwise for southern, and stops at the equator (local vertical spin
  Ω sin φ = 0 there).
- The sink-drain myth gets one line: Coriolis acceleration at 1 m/s ~1e-4 m/s², versus the sink's
  own asymmetries — irrelevant at that scale.

## Chapter 4 — friction and gusts (`friction.js`)
- **Neutral log-law profile** `u(z) = (u*/κ) ln(z/z0)`, capped at the free-atmosphere wind G.
  **u\* from the geostrophic drag law** (Rossby-number similarity, A = 1.8, B = 4.5, κ = 0.4,
  f at 45°), which also gives the **cross-isobar angle** `sin α = B u*/(κ G)`.
- Roughness z0: sea 0.0002 m (Charnock-ish), grass 0.03 m, forest 0.5 m, city 1.0 m (EN 1991-1-4
  categories ~0/II/III/IV). For forest and city, "10 m" means 10 m above the displacement height
  (the treetops/rooftops) — stated in the text.
- **Gusts**: turbulence intensity `I = 1/ln(z/z0)`; peak gust `U·√(1 + 7I)` (Eurocode peak
  velocity pressure). The trace is synthetic turbulence — 28 sines with a −5/3 spectrum, scaled
  to σ = I·U — not a measurement.
- **Sanity (node)**, G = 10 / 20 m/s:

| surface | u10 / G | angle | gust factor | rule of thumb |
|---|---|---|---|---|
| sea | 71% / 68% | 17° / 16° | 1.28 | ~70%, 10–20°, ~1.2–1.3 |
| grass | 53% / 51% | 24° / 23° | 1.49 | ~50%, 20–30°, ~1.4–1.5 |
| forest | 31% / 29% | 33° / 31° | 1.95 | 30–40°, ~1.8–2 |
| city | 24% / 23% | 35° / 33° | 2.15 | ~2 |

- Drawing: heights on a square-root scale (labelled "heights stretched near the ground") so the
  bottom 100 m is visible; the streaks' speeds are a time-lapse.
